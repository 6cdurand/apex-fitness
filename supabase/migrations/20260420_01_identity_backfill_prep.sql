-- ============================================================
-- APEX FITNESS — Identity Hardening 01: Backfill prep
-- Plan: identity-lifecycle-hardening-e9f293.md §2a
-- Idempotent. Safe to run repeatedly. Additive only (no destructive ops).
-- ============================================================

-- 1. Columns for auth-migration bookkeeping + provisional-claim timestamp.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_migration_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- 2. CHECK constraints — use DO blocks so re-runs don't fail on existing constraints.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_account_status_check
      CHECK (account_status IS NULL OR account_status IN ('active','placeholder','deleted'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_mode_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_mode_check
      CHECK (mode IS NULL OR mode IN ('user','trainer','athlete'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_migration_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_migration_status_check
      CHECK (auth_migration_status IN ('pending','migrated','failed','skipped'));
  END IF;
END$$;

-- 3. Normalise role drift — any row where mode='trainer' but is_trainer=false
--    gets is_trainer=true (is_trainer is canonical, mode is presentation only).
UPDATE public.users
SET is_trainer = true
WHERE mode = 'trainer' AND is_trainer IS DISTINCT FROM true;

-- 4. Index for backfill script pagination.
CREATE INDEX IF NOT EXISTS idx_users_auth_migration_status
  ON public.users(auth_migration_status)
  WHERE auth_migration_status <> 'migrated';

-- 5. Telemetry: lightweight log table for role-drift detections at runtime.
CREATE TABLE IF NOT EXISTS public.identity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,            -- e.g. 'role_drift_detected','backfill_attempt'
  user_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_events_type_created
  ON public.identity_events(event_type, created_at DESC);

ALTER TABLE public.identity_events ENABLE ROW LEVEL SECURITY;

-- Temporarily permissive (locked down in migration 04). Service role always bypasses RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='identity_events' AND policyname='identity_events_allow_all_tmp'
  ) THEN
    CREATE POLICY identity_events_allow_all_tmp ON public.identity_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;
