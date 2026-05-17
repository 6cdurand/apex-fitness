-- 20260518_session_counter_fix_calendar_events.sql
-- Sprint v13 dispatch 01 — supersedes v12-D1.
-- Pivots the session-counter source from trainer_sessions (dead table) to
-- calendar_events (where completions actually land per workoutStore.ts:354-415).
-- Idempotent. Safe to apply whether or not v12-D1 was applied.

BEGIN;

-- 1. DROP v12-D1 triggers + functions if they exist (no-op if not).
DROP TRIGGER IF EXISTS trainer_sessions_recompute_counters ON public.trainer_sessions;
DROP TRIGGER IF EXISTS trainer_clients_offset_recompute ON public.trainer_clients;
DROP FUNCTION IF EXISTS public.recompute_trainer_client_total_sessions();
DROP FUNCTION IF EXISTS public.recompute_after_offset_change();

-- 2. historical_sessions_offset stays — added by v12-D1 (idempotent guard if v12-D1 unapplied).
ALTER TABLE public.trainer_clients
  ADD COLUMN IF NOT EXISTS historical_sessions_offset INTEGER NOT NULL DEFAULT 0;

-- One-time migrate from legacy total_sessions_offset if v12-D1 wasn't applied.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trainer_clients'
    AND column_name='total_sessions_offset'
  ) THEN
    UPDATE public.trainer_clients
       SET historical_sessions_offset = COALESCE(total_sessions_offset, 0)
     WHERE historical_sessions_offset = 0
       AND COALESCE(total_sessions_offset, 0) > 0;
  END IF;
END $$;

-- 3. Idempotent backfill: capture any current manual edit on total_sessions
-- as historical_sessions_offset BEFORE the trigger attaches, so visible
-- numbers stay unchanged on first run. Safe to re-run.
WITH derived AS (
  SELECT
    tc.trainer_id,
    tc.client_id,
    COALESCE(
      (SELECT COUNT(*)::INT
         FROM public.calendar_events ce
        WHERE ce.trainer_id = tc.trainer_id
          AND ce.client_id  = tc.client_id
          AND ce.type       = 'session'
          AND ce.status     = 'completed'
      ), 0) AS counted
  FROM public.trainer_clients tc
)
UPDATE public.trainer_clients tc
   SET historical_sessions_offset = GREATEST(
         tc.historical_sessions_offset,
         COALESCE(tc.total_sessions, 0) - d.counted
       )
  FROM derived d
 WHERE d.trainer_id = tc.trainer_id
   AND d.client_id  = tc.client_id
   AND COALESCE(tc.total_sessions, 0) > d.counted
   AND tc.historical_sessions_offset < (COALESCE(tc.total_sessions, 0) - d.counted);

-- 4. Trigger function: recompute trainer_clients.total_sessions from
-- calendar_events for the affected (trainer_id, client_id) pair.
CREATE OR REPLACE FUNCTION public.recompute_total_sessions_from_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_trainer_id UUID;
  v_client_id  TEXT;
BEGIN
  -- Use OLD for DELETE, NEW for INSERT/UPDATE.
  IF TG_OP = 'DELETE' THEN
    v_trainer_id := OLD.trainer_id;
    v_client_id  := OLD.client_id;
  ELSE
    v_trainer_id := NEW.trainer_id;
    v_client_id  := NEW.client_id;
  END IF;

  -- Skip if no client linkage on the event.
  IF v_client_id IS NULL OR v_trainer_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.trainer_clients tc
     SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
           SELECT COUNT(*)::INT
             FROM public.calendar_events ce
            WHERE ce.trainer_id = v_trainer_id
              AND ce.client_id  = v_client_id
              AND ce.type       = 'session'
              AND ce.status     = 'completed'
         ),
         updated_at = NOW()
   WHERE tc.trainer_id = v_trainer_id
     AND tc.client_id  = v_client_id;

  -- If client linkage CHANGED on UPDATE, recompute the OLD pair too.
  IF TG_OP = 'UPDATE'
     AND (OLD.trainer_id IS DISTINCT FROM NEW.trainer_id
          OR OLD.client_id IS DISTINCT FROM NEW.client_id)
     AND OLD.client_id IS NOT NULL AND OLD.trainer_id IS NOT NULL THEN
    UPDATE public.trainer_clients tc
       SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
             SELECT COUNT(*)::INT
               FROM public.calendar_events ce
              WHERE ce.trainer_id = OLD.trainer_id
                AND ce.client_id  = OLD.client_id
                AND ce.type       = 'session'
                AND ce.status     = 'completed'
           ),
           updated_at = NOW()
     WHERE tc.trainer_id = OLD.trainer_id
       AND tc.client_id  = OLD.client_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_recompute_counters ON public.calendar_events;
CREATE TRIGGER calendar_events_recompute_counters
AFTER INSERT OR UPDATE OF status, type, client_id, trainer_id OR DELETE
ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.recompute_total_sessions_from_calendar();

-- 5. BEFORE-UPDATE trigger on trainer_clients.historical_sessions_offset
-- so manual edits via EditHistoricalOffsetModal recompute total_sessions
-- immediately without waiting for a calendar_events change.
CREATE OR REPLACE FUNCTION public.recompute_after_offset_change_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.historical_sessions_offset IS DISTINCT FROM OLD.historical_sessions_offset THEN
    NEW.total_sessions := COALESCE(NEW.historical_sessions_offset, 0) + (
      SELECT COUNT(*)::INT
        FROM public.calendar_events ce
       WHERE ce.trainer_id = NEW.trainer_id
         AND ce.client_id  = NEW.client_id
         AND ce.type       = 'session'
         AND ce.status     = 'completed'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainer_clients_offset_recompute_v2 ON public.trainer_clients;
CREATE TRIGGER trainer_clients_offset_recompute_v2
BEFORE UPDATE ON public.trainer_clients
FOR EACH ROW
EXECUTE FUNCTION public.recompute_after_offset_change_v2();

-- 6. Final reconcile pass: recompute every trainer_clients row from current
-- calendar_events state. After this, the screenshot's Catherine S = 38 etc.
-- will be EITHER unchanged (if historical_sessions_offset captured the
-- difference in step 3) OR drop to the actual calendar_events count
-- (if the user prefers a clean slate — they can edit the offset upward
-- via EditHistoricalOffsetModal).
UPDATE public.trainer_clients tc
   SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
         SELECT COUNT(*)::INT
           FROM public.calendar_events ce
          WHERE ce.trainer_id = tc.trainer_id
            AND ce.client_id  = tc.client_id
            AND ce.type       = 'session'
            AND ce.status     = 'completed'
       ),
       updated_at = NOW();

COMMIT;

-- POST-APPLY VERIFICATION (run separately):
--   SELECT client_id, total_sessions, historical_sessions_offset
--     FROM public.trainer_clients
--    WHERE trainer_id = '<trainer-uuid>'
--    ORDER BY total_sessions DESC LIMIT 20;
--
--   SELECT client_id, COUNT(*) FILTER (WHERE status='completed') AS completed_events
--     FROM public.calendar_events
--    WHERE trainer_id = '<trainer-uuid>' AND type='session'
--    GROUP BY client_id ORDER BY completed_events DESC LIMIT 20;
--
-- For each client, total_sessions should equal historical_sessions_offset + completed_events.
