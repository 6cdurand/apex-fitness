-- 20260514_add_session_counter_consistency.sql
-- Sprint: v12 dispatch 01 (D1)
-- Source audit: catalift-command-center/AUDIT_session_counter_drift_2026-05-13.md
-- Goal: stop trainer_clients.total_sessions drift by deriving it from
--       trainer_sessions via trigger. session_packages.used_sessions is
--       NOT covered here (still app-managed; revisit when sessions get a
--       package_id link in v13+).
--
-- Idempotent: re-running this script is a no-op once applied.
-- Apply via Supabase Dashboard -> SQL Editor.

-- ============================================================
-- Step 1: Schema additions
-- ============================================================

-- 1a. trainer_clients.historical_sessions_offset
--     Replaces the legacy total_sessions_offset which is too generic and
--     was unused by the trigger logic. Keeps the legacy column around so
--     old app code that still reads/writes total_sessions_offset doesn't
--     crash; new code should use historical_sessions_offset.
ALTER TABLE public.trainer_clients
  ADD COLUMN IF NOT EXISTS historical_sessions_offset INTEGER NOT NULL DEFAULT 0;

-- 1b. trainer_sessions.deleted_at
--     Soft-delete support. The trigger filters on deleted_at IS NULL so
--     callers can delete a session row without losing history.
ALTER TABLE public.trainer_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 1c. Indexes that the trigger will hit on every session insert/update.
CREATE INDEX IF NOT EXISTS idx_trainer_sessions_client_status
  ON public.trainer_sessions (client_id, trainer_id, status)
  WHERE deleted_at IS NULL;

-- ============================================================
-- Step 2: One-time data migration: legacy offset -> new offset
-- ============================================================
-- If the legacy column has a value greater than the new column, fold it in.
-- Idempotent: GREATEST keeps whichever number is larger (i.e. preserves any
-- value already set in the new column on a re-run).
UPDATE public.trainer_clients
   SET historical_sessions_offset = GREATEST(
         historical_sessions_offset,
         COALESCE(total_sessions_offset, 0)
       )
 WHERE total_sessions_offset IS NOT NULL
   AND total_sessions_offset > 0;

-- ============================================================
-- Step 3: Backfill — capture current manual edits as offset
-- ============================================================
-- Before the trigger attaches, snapshot the current total_sessions vs the
-- count of actual completed/no-show sessions in trainer_sessions. Any
-- excess gets captured as the historical offset, so when the trigger fires
-- and recomputes total_sessions = offset + count, the persisted value is
-- unchanged.
--
-- Idempotent guard: only updates rows where the offset hasn't already
-- absorbed the difference (re-running picks up any new manual edits).
UPDATE public.trainer_clients tc
   SET historical_sessions_offset = GREATEST(
         tc.historical_sessions_offset,
         GREATEST(
           0,
           COALESCE(tc.total_sessions, 0) - (
             SELECT COUNT(*)
               FROM public.trainer_sessions ts
              WHERE ts.client_id = tc.client_id
                AND ts.trainer_id = tc.trainer_id
                AND ts.status IN ('completed', 'no_show')
                AND ts.deleted_at IS NULL
           )
         )
       )
 WHERE tc.total_sessions IS NOT NULL;

-- ============================================================
-- Step 4: Trigger function — recompute on session change
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_trainer_client_total_sessions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_client_id  TEXT;
  v_trainer_id UUID;
  v_offset     INTEGER;
  v_count      INTEGER;
BEGIN
  v_client_id  := COALESCE(NEW.client_id, OLD.client_id);
  v_trainer_id := COALESCE(NEW.trainer_id, OLD.trainer_id);

  -- No-op if no trainer_clients row exists yet (e.g., session created
  -- before the relationship row).
  SELECT historical_sessions_offset INTO v_offset
    FROM public.trainer_clients
   WHERE client_id  = v_client_id
     AND trainer_id = v_trainer_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.trainer_sessions
   WHERE client_id  = v_client_id
     AND trainer_id = v_trainer_id
     AND status IN ('completed', 'no_show')
     AND deleted_at IS NULL;

  UPDATE public.trainer_clients
     SET total_sessions = COALESCE(v_offset, 0) + v_count,
         updated_at     = NOW()
   WHERE client_id  = v_client_id
     AND trainer_id = v_trainer_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trainer_sessions_recompute_counters
  ON public.trainer_sessions;

CREATE TRIGGER trainer_sessions_recompute_counters
  AFTER INSERT OR UPDATE OR DELETE ON public.trainer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_trainer_client_total_sessions();

-- ============================================================
-- Step 5: BEFORE-UPDATE trigger — recompute when offset changes
-- ============================================================
-- When a trainer edits the historical offset via the UI (D3), we need
-- total_sessions to reflect the new offset immediately, not on the next
-- session row change.
CREATE OR REPLACE FUNCTION public.recompute_after_offset_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NEW.historical_sessions_offset IS DISTINCT FROM OLD.historical_sessions_offset THEN
    SELECT COUNT(*) INTO v_count
      FROM public.trainer_sessions
     WHERE client_id  = NEW.client_id
       AND trainer_id = NEW.trainer_id
       AND status IN ('completed', 'no_show')
       AND deleted_at IS NULL;

    NEW.total_sessions := COALESCE(NEW.historical_sessions_offset, 0) + v_count;
    NEW.updated_at     := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainer_clients_offset_recompute
  ON public.trainer_clients;

CREATE TRIGGER trainer_clients_offset_recompute
  BEFORE UPDATE OF historical_sessions_offset ON public.trainer_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_after_offset_change();

-- ============================================================
-- Step 6: Final reconcile pass for every trainer_clients row
-- ============================================================
-- Ensures every existing row's total_sessions is now offset + count.
-- After backfill above, this should be a no-op for rows that already
-- matched, but it covers any row whose total_sessions was below the
-- count (e.g., a row missing manual edits).
UPDATE public.trainer_clients tc
   SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
         SELECT COUNT(*)
           FROM public.trainer_sessions ts
          WHERE ts.client_id  = tc.client_id
            AND ts.trainer_id = tc.trainer_id
            AND ts.status IN ('completed', 'no_show')
            AND ts.deleted_at IS NULL
       ),
       updated_at = NOW();

-- ============================================================
-- Done. Verification queries (run separately in SQL editor):
--   SELECT client_id, total_sessions, historical_sessions_offset
--     FROM trainer_clients ORDER BY total_sessions DESC LIMIT 20;
--
--   SELECT tc.client_id,
--          tc.total_sessions AS stored,
--          tc.historical_sessions_offset AS offset,
--          (SELECT COUNT(*) FROM trainer_sessions ts
--             WHERE ts.client_id  = tc.client_id
--               AND ts.trainer_id = tc.trainer_id
--               AND ts.status IN ('completed','no_show')
--               AND ts.deleted_at IS NULL) AS counted
--     FROM trainer_clients tc
--    WHERE tc.total_sessions <> tc.historical_sessions_offset + (
--      SELECT COUNT(*) FROM trainer_sessions ts
--        WHERE ts.client_id  = tc.client_id
--          AND ts.trainer_id = tc.trainer_id
--          AND ts.status IN ('completed','no_show')
--          AND ts.deleted_at IS NULL);
--   -- (should return 0 rows after migration)
-- ============================================================
