-- 20260520_hybrid_auto_count_default.sql
-- Sprint: v14 dispatch 10
-- Source: briefs/sprint-v14-2026-05-18/v14-fix-10-brief.md
-- Goal: Add trainer-level auto_count_sessions_default to users; make trainer_clients.auto_count_sessions
--       nullable (NULL = follow trainer default); replace trigger function bodies to fall back through
--       per-client override → trainer default → TRUE; add AFTER trigger on users for bulk rebucket
--       when the trainer's default flips.

BEGIN;

-- 1. Add trainer-level default to users table.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auto_count_sessions_default BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Make trainer_clients.auto_count_sessions nullable. NULL now means "follow trainer default".
--    Existing TRUE/FALSE values are preserved as explicit overrides (semantically: "Force ON" / "Force OFF").
ALTER TABLE public.trainer_clients
  ALTER COLUMN auto_count_sessions DROP NOT NULL,
  ALTER COLUMN auto_count_sessions DROP DEFAULT;

-- 3. Replace the AFTER trigger function on calendar_events.
--    Effective auto-count = COALESCE(per-client override, trainer default, TRUE).
--    Function name + signature unchanged; existing AFTER trigger on calendar_events picks up new body.
CREATE OR REPLACE FUNCTION public.recompute_total_sessions_from_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_trainer_id UUID;
  v_client_id UUID;
  v_old_trainer_id UUID;
  v_old_client_id UUID;
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

  -- v14-D10: effective auto-count = per-client override OR trainer default OR TRUE.
  -- The UPDATE filter does the gate via COALESCE on both columns.
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
   FROM public.users u
   WHERE tc.trainer_id::text = v_trainer_id::text
     AND tc.client_id::text  = v_client_id::text
     AND u.id::text          = tc.trainer_id::text
     AND COALESCE(tc.auto_count_sessions, u.auto_count_sessions_default, TRUE) = TRUE;

  -- If linkage CHANGED on UPDATE, recompute the OLD pair too (same gate).
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
       FROM public.users u
       WHERE tc.trainer_id::text = v_old_trainer_id::text
         AND tc.client_id::text  = v_old_client_id::text
         AND u.id::text          = tc.trainer_id::text
         AND COALESCE(tc.auto_count_sessions, u.auto_count_sessions_default, TRUE) = TRUE;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Replace the BEFORE-UPDATE trigger function on trainer_clients.
--    Effective auto = COALESCE(per-client, trainer default, TRUE).
--    Rebucket fires when EFFECTIVE auto changes (handles per-client override flip).
--    Function name + signature unchanged.
CREATE OR REPLACE FUNCTION public.recompute_after_offset_change_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendar_count INT;
  v_trainer_default BOOLEAN;
  v_old_auto BOOLEAN;
  v_new_auto BOOLEAN;
BEGIN
  -- Resolve trainer default. If the trainer's users row is missing for any reason, fall back to TRUE.
  SELECT auto_count_sessions_default
    INTO v_trainer_default
    FROM public.users
   WHERE id::text = NEW.trainer_id::text;
  v_trainer_default := COALESCE(v_trainer_default, TRUE);

  v_old_auto := COALESCE(OLD.auto_count_sessions, v_trainer_default, TRUE);
  v_new_auto := COALESCE(NEW.auto_count_sessions, v_trainer_default, TRUE);

  SELECT COUNT(*)::INT
    INTO v_calendar_count
    FROM public.calendar_events ce
   WHERE ce.trainer_id::text = NEW.trainer_id::text
     AND ce.client_id::text  = NEW.client_id::text
     AND ce.type             = 'session'
     AND ce.status           = 'completed';

  -- v14-D10: rebucket on EFFECTIVE auto-count change.
  --   ON -> OFF: fold calendar_count into manual offset bucket.
  --   OFF -> ON: pull calendar_count out (clamped at 0).
  IF v_new_auto IS DISTINCT FROM v_old_auto THEN
    IF v_old_auto = TRUE AND v_new_auto = FALSE THEN
      NEW.historical_sessions_offset := COALESCE(NEW.historical_sessions_offset, 0) + v_calendar_count;
    ELSIF v_old_auto = FALSE AND v_new_auto = TRUE THEN
      NEW.historical_sessions_offset := GREATEST(0, COALESCE(NEW.historical_sessions_offset, 0) - v_calendar_count);
    END IF;
  END IF;

  -- Recompute total_sessions when offset OR effective auto changed.
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

-- 5. NEW trigger function on users to bulk-rebucket "follow default" trainer_clients rows
--    when the trainer's auto_count_sessions_default flips.
CREATE OR REPLACE FUNCTION public.recompute_clients_on_trainer_default_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_default BOOLEAN;
  v_new_default BOOLEAN;
BEGIN
  -- Only react when auto_count_sessions_default actually changed.
  IF NEW.auto_count_sessions_default IS NOT DISTINCT FROM OLD.auto_count_sessions_default THEN
    RETURN NEW;
  END IF;

  v_old_default := COALESCE(OLD.auto_count_sessions_default, TRUE);
  v_new_default := COALESCE(NEW.auto_count_sessions_default, TRUE);

  IF v_old_default = v_new_default THEN
    RETURN NEW;
  END IF;

  -- Bulk rebucket: update historical_sessions_offset for every "follow default" pair
  -- (trainer_clients.auto_count_sessions IS NULL) belonging to this trainer.
  -- Pairs WITHOUT any completed calendar_events are skipped by the INNER JOIN, which is
  -- semantically correct (their visible count is offset either way; no rebucket needed).
  -- The BEFORE-UPDATE trigger on trainer_clients then recomputes total_sessions from
  -- the new offset using the new effective auto value.
  IF v_old_default = TRUE AND v_new_default = FALSE THEN
    -- ON -> OFF: each pair's calendar_count folds into offset.
    UPDATE public.trainer_clients tc
       SET historical_sessions_offset = COALESCE(tc.historical_sessions_offset, 0) + cc.calendar_count,
           updated_at = NOW()
      FROM (
        SELECT ce.trainer_id, ce.client_id, COUNT(*)::INT AS calendar_count
          FROM public.calendar_events ce
         WHERE ce.type='session' AND ce.status='completed'
         GROUP BY ce.trainer_id, ce.client_id
      ) cc
     WHERE tc.trainer_id::text = NEW.id::text
       AND tc.auto_count_sessions IS NULL
       AND cc.trainer_id::text = tc.trainer_id::text
       AND cc.client_id::text  = tc.client_id::text;
  ELSIF v_old_default = FALSE AND v_new_default = TRUE THEN
    -- OFF -> ON: each pair's calendar_count pulls out of offset (clamp at 0).
    UPDATE public.trainer_clients tc
       SET historical_sessions_offset = GREATEST(0, COALESCE(tc.historical_sessions_offset, 0) - cc.calendar_count),
           updated_at = NOW()
      FROM (
        SELECT ce.trainer_id, ce.client_id, COUNT(*)::INT AS calendar_count
          FROM public.calendar_events ce
         WHERE ce.type='session' AND ce.status='completed'
         GROUP BY ce.trainer_id, ce.client_id
      ) cc
     WHERE tc.trainer_id::text = NEW.id::text
       AND tc.auto_count_sessions IS NULL
       AND cc.trainer_id::text = tc.trainer_id::text
       AND cc.client_id::text  = tc.client_id::text;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Wire the trigger.
DROP TRIGGER IF EXISTS users_auto_count_default_recompute ON public.users;
CREATE TRIGGER users_auto_count_default_recompute
  AFTER UPDATE OF auto_count_sessions_default ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_clients_on_trainer_default_change();

-- 7. Reconcile pass: ensure every existing trainer_clients row's total_sessions matches the
--    new effective formula (per-client override OR trainer default OR TRUE).
--    No-op for rows already correct from v14-D1's reconcile (all auto_count_sessions were TRUE then).
UPDATE public.trainer_clients tc
   SET total_sessions = CASE
         WHEN COALESCE(tc.auto_count_sessions, u.auto_count_sessions_default, TRUE) = TRUE
           THEN COALESCE(tc.historical_sessions_offset, 0) + (
             SELECT COUNT(*)::INT FROM public.calendar_events ce
              WHERE ce.trainer_id::text = tc.trainer_id::text
                AND ce.client_id::text  = tc.client_id::text
                AND ce.type='session' AND ce.status='completed'
           )
         ELSE COALESCE(tc.historical_sessions_offset, 0)
       END,
       updated_at = NOW()
  FROM public.users u
 WHERE u.id::text = tc.trainer_id::text;

COMMIT;

-- POST-APPLY VERIFICATION (run separately):
--   -- Confirm the new column exists with the right default.
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='users' AND column_name='auto_count_sessions_default';
--   -- Expectation: column_default='true', is_nullable='NO'.
--
--   -- Confirm trainer_clients.auto_count_sessions is now nullable.
--   SELECT column_name, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='trainer_clients' AND column_name='auto_count_sessions';
--   -- Expectation: is_nullable='YES', column_default=NULL.
--
--   -- Sanity for a known trainer (replace UUID): per-client effective formula matches visible total.
--   WITH trainer AS (SELECT id, auto_count_sessions_default FROM public.users WHERE id='<your-trainer-uuid>')
--   SELECT tc.client_id,
--          tc.auto_count_sessions AS per_client,
--          (SELECT auto_count_sessions_default FROM trainer) AS trainer_default,
--          COALESCE(tc.auto_count_sessions, (SELECT auto_count_sessions_default FROM trainer), TRUE) AS effective_auto,
--          tc.historical_sessions_offset AS offset,
--          (SELECT COUNT(*) FROM public.calendar_events ce
--             WHERE ce.trainer_id::text=tc.trainer_id::text AND ce.client_id::text=tc.client_id::text
--               AND ce.type='session' AND ce.status='completed') AS calendar_count,
--          tc.total_sessions AS visible_total
--     FROM public.trainer_clients tc
--    WHERE tc.trainer_id::text=(SELECT id::text FROM trainer);
