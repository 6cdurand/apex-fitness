-- 20260519_per_client_auto_count_sessions.sql
-- Sprint v14 dispatch 01.
-- Adds per-client auto_count_sessions toggle (default TRUE).
-- When TRUE: total_sessions = historical_sessions_offset + calendar_count (v13-D1 behavior).
-- When FALSE: total_sessions = historical_sessions_offset only; calendar events still
--             land in calendar_events but do not auto-tick total_sessions.
-- Toggle preserves visible total_sessions via offset rebucket in the BEFORE-UPDATE trigger.
-- Idempotent. Builds on v13-D1's 20260518_session_counter_fix_calendar_events.sql.

BEGIN;

-- 1. Add column (idempotent). NOT NULL with DEFAULT TRUE so every existing row
-- gets the v13-D1 behavior on apply — zero visible change for any client.
ALTER TABLE public.trainer_clients
  ADD COLUMN IF NOT EXISTS auto_count_sessions BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Replace the AFTER trigger function on calendar_events to skip pairs where
-- auto_count_sessions = FALSE. Function name + signature are unchanged from
-- v13-D1, so the existing CREATE TRIGGER calendar_events_recompute_counters
-- picks up the new body via CREATE OR REPLACE.
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

  -- v14-D1: gate on auto_count_sessions. When FALSE, this UPDATE matches no
  -- rows for the affected pair and is a no-op. The calendar_events row itself
  -- is unaffected — only the auto-tick is suppressed.
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
     AND tc.client_id::text  = v_client_id::text
     AND COALESCE(tc.auto_count_sessions, TRUE) = TRUE;

  -- If client linkage CHANGED on UPDATE, recompute the OLD pair too (same gate).
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
         AND tc.client_id::text  = v_old_client_id::text
         AND COALESCE(tc.auto_count_sessions, TRUE) = TRUE;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Replace the BEFORE-UPDATE trigger function on trainer_clients to:
--    (a) rebucket offset when auto_count_sessions toggles, preserving visible total_sessions
--    (b) apply the correct formula based on NEW.auto_count_sessions
--    (c) preserve v13-D1 behavior when only offset changes and auto stays TRUE
--    Function name + signature unchanged; existing trigger
--    trainer_clients_offset_recompute_v2 picks up the new body.
CREATE OR REPLACE FUNCTION public.recompute_after_offset_change_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendar_count INT;
  v_old_auto BOOLEAN;
  v_new_auto BOOLEAN;
BEGIN
  v_old_auto := COALESCE(OLD.auto_count_sessions, TRUE);
  v_new_auto := COALESCE(NEW.auto_count_sessions, TRUE);

  -- Compute current calendar_count for this (trainer, client) pair once.
  SELECT COUNT(*)::INT
    INTO v_calendar_count
    FROM public.calendar_events ce
   WHERE ce.trainer_id::text = NEW.trainer_id::text
     AND ce.client_id::text  = NEW.client_id::text
     AND ce.type             = 'session'
     AND ce.status           = 'completed';

  -- v14-D1: when auto_count_sessions toggles, rebucket the offset so that
  -- total_sessions doesn't visibly jump across the toggle.
  IF v_new_auto IS DISTINCT FROM v_old_auto THEN
    IF v_old_auto = TRUE AND v_new_auto = FALSE THEN
      -- ON -> OFF: fold calendar_count into the manual offset bucket.
      NEW.historical_sessions_offset := COALESCE(NEW.historical_sessions_offset, 0) + v_calendar_count;
    ELSIF v_old_auto = FALSE AND v_new_auto = TRUE THEN
      -- OFF -> ON: pull calendar_count out of the offset bucket. Clamp at 0
      -- in case a manual edit drove offset below the calendar tally while OFF.
      NEW.historical_sessions_offset := GREATEST(0, COALESCE(NEW.historical_sessions_offset, 0) - v_calendar_count);
    END IF;
  END IF;

  -- Recompute total_sessions when offset OR auto_count_sessions changed.
  IF NEW.historical_sessions_offset IS DISTINCT FROM OLD.historical_sessions_offset
     OR v_new_auto IS DISTINCT FROM v_old_auto THEN
    IF v_new_auto = TRUE THEN
      NEW.total_sessions := COALESCE(NEW.historical_sessions_offset, 0) + v_calendar_count;
    ELSE
      NEW.total_sessions := COALESCE(NEW.historical_sessions_offset, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The CREATE TRIGGER for trainer_clients_offset_recompute_v2 from v13-D1
-- already exists (BEFORE UPDATE on trainer_clients FOR EACH ROW). It fires on
-- every UPDATE; the function above gates which column-change paths recompute.

-- 4. Reconcile pass: ensure total_sessions matches the ON-formula for every row
-- (every row now has auto_count_sessions=TRUE by default). No-op for rows
-- already correct from v13-D1's reconcile.
UPDATE public.trainer_clients tc
   SET total_sessions = COALESCE(tc.historical_sessions_offset, 0) + (
         SELECT COUNT(*)::INT
           FROM public.calendar_events ce
          WHERE ce.trainer_id::text = tc.trainer_id::text
            AND ce.client_id::text  = tc.client_id::text
            AND ce.type             = 'session'
            AND ce.status           = 'completed'
       ),
       updated_at = NOW()
 WHERE COALESCE(tc.auto_count_sessions, TRUE) = TRUE;

COMMIT;

-- POST-APPLY VERIFICATION (run separately, scoped to your trainer):
--   SELECT client_id, auto_count_sessions, total_sessions,
--          historical_sessions_offset,
--          (SELECT COUNT(*) FROM public.calendar_events ce
--             WHERE ce.trainer_id::text = trainer_clients.trainer_id::text
--               AND ce.client_id::text  = trainer_clients.client_id::text
--               AND ce.type='session' AND ce.status='completed') AS calendar_count
--     FROM public.trainer_clients
--    WHERE trainer_id = '<your-trainer-uuid>'
--    ORDER BY total_sessions DESC;
--
-- Expectation (ON rows): total_sessions = historical_sessions_offset + calendar_count.
-- Expectation (OFF rows after a future toggle): total_sessions = historical_sessions_offset.
