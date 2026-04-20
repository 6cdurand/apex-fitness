-- ============================================================
-- APEX FITNESS — Identity Hardening 03: Integrity audit
-- Plan: identity-lifecycle-hardening-e9f293.md §2c
-- Creates a union view of orphan rows + an alerts table + a reporting
-- function. The function is SECURITY DEFINER so it can be called by
-- service-role only (nightly cron via Vercel or pg_cron).
-- ============================================================

-- 1. Alerts table — structured records of each integrity-report run.
CREATE TABLE IF NOT EXISTS public.integrity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,          -- 'orphan_row','role_drift','duplicate_email', etc.
  severity text NOT NULL DEFAULT 'info',  -- 'info','warn','critical'
  table_name text,
  row_id uuid,
  payload jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_alerts_unresolved
  ON public.integrity_alerts(created_at DESC)
  WHERE resolved = false;

ALTER TABLE public.integrity_alerts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no one else reads this table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='integrity_alerts' AND policyname='integrity_alerts_service_only'
  ) THEN
    CREATE POLICY integrity_alerts_service_only ON public.integrity_alerts
      FOR ALL USING (false) WITH CHECK (false);
  END IF;
END$$;

-- 2. Orphan-audit view — rows whose trainer_id or client_id is not in users.
CREATE OR REPLACE VIEW public.v_orphan_audit AS
  SELECT 'calendar_events' AS table_name, id, 'client_id' AS column_name, client_id::text AS bad_value
    FROM public.calendar_events
    WHERE client_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = calendar_events.client_id)
  UNION ALL
  SELECT 'calendar_events', id, 'trainer_id', trainer_id::text
    FROM public.calendar_events
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = calendar_events.trainer_id)
  UNION ALL
  SELECT 'booking_requests', id, 'client_id', client_id::text
    FROM public.booking_requests
    WHERE client_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = booking_requests.client_id)
  UNION ALL
  SELECT 'booking_requests', id, 'trainer_id', trainer_id::text
    FROM public.booking_requests
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = booking_requests.trainer_id)
  UNION ALL
  SELECT 'client_programs', id, 'client_id', client_id::text
    FROM public.client_programs
    WHERE client_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = client_programs.client_id)
  UNION ALL
  SELECT 'client_programs', id, 'trainer_id', trainer_id::text
    FROM public.client_programs
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = client_programs.trainer_id)
  UNION ALL
  SELECT 'trainer_clients', id, 'client_id', client_id::text
    FROM public.trainer_clients
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = trainer_clients.client_id)
  UNION ALL
  SELECT 'trainer_clients', id, 'trainer_id', trainer_id::text
    FROM public.trainer_clients
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = trainer_clients.trainer_id)
  UNION ALL
  SELECT 'program_receipts', program_id, 'client_id', client_id::text
    FROM public.program_receipts
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = program_receipts.client_id);

COMMENT ON VIEW public.v_orphan_audit IS
'Union of rows whose trainer_id / client_id does not resolve in public.users. Populated by fn_integrity_report into public.integrity_alerts.';

-- 3. Role-drift view — public.users rows where is_trainer and mode disagree.
CREATE OR REPLACE VIEW public.v_role_drift AS
  SELECT id, email, is_trainer, mode
    FROM public.users
    WHERE (mode = 'trainer' AND is_trainer = false)
       OR (mode <> 'trainer' AND is_trainer = true AND mode IS NOT NULL);

-- 4. Duplicate-email view — should never have >1 row per lowercased email.
CREATE OR REPLACE VIEW public.v_duplicate_emails AS
  SELECT lower(email) AS email_normalised, COUNT(*) AS dupe_count,
         array_agg(id) AS user_ids
    FROM public.users
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING COUNT(*) > 1;

-- 5. fn_integrity_report — idempotent; appends new alerts, marks resolved rows.
CREATE OR REPLACE FUNCTION public.fn_integrity_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orphans_inserted int := 0;
  v_drift_inserted int := 0;
  v_dupes_inserted int := 0;
  v_resolved_count int := 0;
BEGIN
  -- Orphan rows: insert one alert per (table, column, row) that isn't already open.
  WITH ins AS (
    INSERT INTO public.integrity_alerts (alert_type, severity, table_name, row_id, payload)
    SELECT 'orphan_row', 'warn', oa.table_name, oa.id,
           jsonb_build_object('column', oa.column_name, 'bad_value', oa.bad_value)
    FROM public.v_orphan_audit oa
    WHERE NOT EXISTS (
      SELECT 1 FROM public.integrity_alerts ia
      WHERE ia.alert_type='orphan_row' AND ia.resolved=false
        AND ia.table_name=oa.table_name AND ia.row_id=oa.id
        AND ia.payload->>'column' = oa.column_name
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_orphans_inserted FROM ins;

  -- Role-drift alerts.
  WITH ins AS (
    INSERT INTO public.integrity_alerts (alert_type, severity, table_name, row_id, payload)
    SELECT 'role_drift', 'warn', 'users', rd.id,
           jsonb_build_object('is_trainer', rd.is_trainer, 'mode', rd.mode)
    FROM public.v_role_drift rd
    WHERE NOT EXISTS (
      SELECT 1 FROM public.integrity_alerts ia
      WHERE ia.alert_type='role_drift' AND ia.resolved=false
        AND ia.row_id=rd.id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_drift_inserted FROM ins;

  -- Duplicate-email alerts.
  WITH ins AS (
    INSERT INTO public.integrity_alerts (alert_type, severity, table_name, row_id, payload)
    SELECT 'duplicate_email', 'critical', 'users', NULL,
           jsonb_build_object('email', de.email_normalised, 'count', de.dupe_count, 'user_ids', de.user_ids)
    FROM public.v_duplicate_emails de
    WHERE NOT EXISTS (
      SELECT 1 FROM public.integrity_alerts ia
      WHERE ia.alert_type='duplicate_email' AND ia.resolved=false
        AND ia.payload->>'email' = de.email_normalised
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_dupes_inserted FROM ins;

  -- Auto-resolve orphan-row alerts whose underlying row now resolves cleanly.
  WITH upd AS (
    UPDATE public.integrity_alerts ia
    SET resolved = true, resolved_at = now()
    WHERE ia.alert_type = 'orphan_row'
      AND ia.resolved = false
      AND NOT EXISTS (
        SELECT 1 FROM public.v_orphan_audit oa
        WHERE oa.table_name = ia.table_name
          AND oa.id = ia.row_id
          AND oa.column_name = ia.payload->>'column'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_resolved_count FROM upd;

  RETURN jsonb_build_object(
    'orphans_inserted', v_orphans_inserted,
    'drift_inserted', v_drift_inserted,
    'duplicates_inserted', v_dupes_inserted,
    'auto_resolved', v_resolved_count,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.fn_integrity_report IS
'Populates public.integrity_alerts from v_orphan_audit / v_role_drift / v_duplicate_emails. Idempotent. Intended to run nightly via Vercel cron or pg_cron.';

-- Service role only — grant explicitly in case a future role needs it.
REVOKE ALL ON FUNCTION public.fn_integrity_report FROM PUBLIC;
