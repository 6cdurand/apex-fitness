-- 20260530_add_historical_offset_sessions.sql
-- Sprint: v16 dispatch 03
-- Source: /Users/christofit7/Desktop/catalift/catalift-command-center/briefs/sprint-v16-2026-05-29/v16-fix-03-payments-counting-overhaul.md
-- Goal: split the manual session-count offset from the auto-counted total so manual edits are preserved across new auto-counts.

ALTER TABLE trainer_clients
  ADD COLUMN IF NOT EXISTS historical_offset_sessions INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN trainer_clients.historical_offset_sessions IS
  'v16-D3: manual session count offset set by trainer (e.g. importing a client whose history predates the app). The displayed total is historical_offset_sessions + count(completed trainer_sessions for this trainer_clients pair).';

-- One-time backfill: if existing trainer_clients rows have a stored total_sessions
-- value greater than the count of completed sessions, treat the diff as historical
-- offset. (Conservative — only runs if total_sessions column exists; otherwise no-op.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainer_clients' AND column_name = 'total_sessions'
  ) THEN
    UPDATE trainer_clients tc
       SET historical_offset_sessions = GREATEST(
         0,
         COALESCE(tc.total_sessions, 0) -
         COALESCE((
           SELECT COUNT(*) FROM trainer_sessions ts
            WHERE ts.client_id = tc.client_id
              AND ts.trainer_id = tc.trainer_id
              AND ts.status = 'completed'
         ), 0)
       )
     WHERE COALESCE(tc.historical_offset_sessions, 0) = 0;
  END IF;
END $$;
