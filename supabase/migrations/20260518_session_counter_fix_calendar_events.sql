-- 20260518_session_counter_fix_calendar_events.sql
-- Sprint v13 dispatch 01 — supersedes v12-D1.
-- Pivots the session-counter source from trainer_sessions (dead table) to
-- calendar_events (where completions actually land per workoutStore.ts:354-415).
-- Idempotent. Type-safe across uuid/text column variations.

BEGIN;

-- 1. DROP v12-D1 triggers + functions if they exist (no-op if not).
DROP TRIGGER IF EXISTS trainer_sessions_recompute_counters ON public.trainer_sessions;
DROP TRIGGER IF EXISTS trainer_clients_offset_recompute ON public.trainer_clients;
DROP TRIGGER IF EXISTS trainer_clients_offset_recompute_v2 ON public.trainer_clients;
DROP TRIGGER IF EXISTS calendar_events_recompute_counters ON public.calendar_events;
DROP FUNCTION IF EXISTS public.recompute_trainer_client_total_sessions();
DROP FUNCTION IF EXISTS public.recompute_after_offset_change();
DROP FUNCTION IF EXISTS public.recompute_after_offset_change_v2();
DROP FUNCTION IF EXISTS public.recompute_total_sessions_from_calendar();

-- 2. Add historical_sessions_offset column (idempotent).
ALTER TABLE public.trainer_clients
  ADD COLUMN IF NOT EXISTS historical_sessions_offset INTEGER NOT NULL DEFAULT 0;

-- One-time migrate from legacy total_sessions_offset if it exists.
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
-- TYPE-SAFE: cast both sides of join keys to text.
WITH derived AS (
  SELECT
    tc.trainer_id,
    tc.client_id,
    COALESCE(
      (SELECT COUNT(*)::INT
         FROM public.calendar_events ce
        WHERE ce.trainer_id::text = tc.trainer_id::text
          AND ce.client_id::text  = tc.client_id::text
          AND ce.type             = 'session'
          AND ce.status           = 'completed'
      ), 0) AS counted
  FROM public.trainer_clients tc
)
UPDATE public.trainer_clients tc
   SET historical_sessions_offset = GREATEST(
         tc.historical_sessions_offset,
         COALESCE(tc.total_sessions, 0) - d.counted
       )
  FROM derived d
 WHERE d.trainer_id::text = tc.trainer_id::text
   AND d.client_id::text  = tc.client_id::text
   AND COALESCE(tc.total_sessions, 0) > d.counted
   AND tc.historical_sessions_offset < (COALESCE(tc.total_sessions, 0) - d.counted);

-- 4. Trigger function on calendar_events.
-- TYPE-SAFE: variable types matched to source column via %TYPE; joins cast to text.
CREATE OR REPLACE FUNCTION public.recompute_total_sessions_from_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_trainer_id calendar_events.trainer_id%TYPE;
  v_client_id  calendar_events.client_id%TYPE;
  v_old_trainer_id calendar_events.trainer_id%TYPE;
  v_old_client_id  calendar_events.client_id%TYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_trainer_id := OLD.trainer_id;
    v_client_id  := OLD.client_id;
  ELSE
    v_trainer_id := NEW.trainer_id;
    v_client_id  := NEW.client_id;
  END IF;

  IF v_client_id IS NULL OR v_trainer_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.trainer_clients tc
     SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
           SELECT COUNT(*)::INT
             FROM public.calendar_events ce
            WHERE ce.trainer_id::text = v_trainer_id::text
              AND ce.client_id::text  = v_client_id::text
              AND ce.type             = 'session'
              AND ce.status           = 'completed'
         ),
         updated_at = NOW()
   WHERE tc.trainer_id::text = v_trainer_id::text
     AND tc.client_id::text  = v_client_id::text;

  IF TG_OP = 'UPDATE' THEN
    v_old_trainer_id := OLD.trainer_id;
    v_old_client_id  := OLD.client_id;
    IF (v_old_trainer_id IS DISTINCT FROM v_trainer_id
        OR v_old_client_id IS DISTINCT FROM v_client_id)
       AND v_old_client_id IS NOT NULL AND v_old_trainer_id IS NOT NULL THEN
      UPDATE public.trainer_clients tc
         SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
               SELECT COUNT(*)::INT
                 FROM public.calendar_events ce
                WHERE ce.trainer_id::text = v_old_trainer_id::text
                  AND ce.client_id::text  = v_old_client_id::text
                  AND ce.type             = 'session'
                  AND ce.status           = 'completed'
             ),
             updated_at = NOW()
       WHERE tc.trainer_id::text = v_old_trainer_id::text
         AND tc.client_id::text  = v_old_client_id::text;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER calendar_events_recompute_counters
AFTER INSERT OR UPDATE OF status, type, client_id, trainer_id OR DELETE
ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.recompute_total_sessions_from_calendar();

-- 5. BEFORE-UPDATE trigger on trainer_clients.historical_sessions_offset.
-- TYPE-SAFE: subquery joins cast to text.
CREATE OR REPLACE FUNCTION public.recompute_after_offset_change_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.historical_sessions_offset IS DISTINCT FROM OLD.historical_sessions_offset THEN
    NEW.total_sessions := COALESCE(NEW.historical_sessions_offset, 0) + (
      SELECT COUNT(*)::INT
        FROM public.calendar_events ce
       WHERE ce.trainer_id::text = NEW.trainer_id::text
         AND ce.client_id::text  = NEW.client_id::text
         AND ce.type             = 'session'
         AND ce.status           = 'completed'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trainer_clients_offset_recompute_v2
BEFORE UPDATE ON public.trainer_clients
FOR EACH ROW
EXECUTE FUNCTION public.recompute_after_offset_change_v2();

-- 6. Final reconcile pass: recompute every trainer_clients row from current
-- calendar_events state. TYPE-SAFE: cast both sides of subquery join.
UPDATE public.trainer_clients tc
   SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
         SELECT COUNT(*)::INT
           FROM public.calendar_events ce
          WHERE ce.trainer_id::text = tc.trainer_id::text
            AND ce.client_id::text  = tc.client_id::text
            AND ce.type             = 'session'
            AND ce.status           = 'completed'
       ),
       updated_at = NOW();

COMMIT;
