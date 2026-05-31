-- ============================================================
-- v18-D10 (BUG-L) — Durable session writes
-- ============================================================
-- Background: syncTrainerSessionToSupabase() in src/lib/supabaseSync.ts
-- writes columns that the canonical supabase/schema.sql does not declare on
-- public.trainer_sessions:
--   start_time, end_time, workout_id, rating, feedback, paid, payment_id
--
-- Most live environments already have these (added ad-hoc via the SQL
-- editor when the feature shipped). For any environment that does not,
-- the INSERT/UPSERT returns 42703 "column does not exist", which used to
-- silently drop session rows because the sync was fire-and-forget. v18-D10
-- adds a schema-drift retry in the writer + a merge-on-hydrate in
-- loadFromSupabase so the row is preserved locally and re-pushed; this
-- migration closes the loop by making the optional columns present so the
-- drift retry never has to fire.
--
-- Pure additive, idempotent (`ADD COLUMN IF NOT EXISTS`). Safe to apply on
-- any environment regardless of current state. No data backfill required.
-- ============================================================

ALTER TABLE public.trainer_sessions
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time   TEXT,
  ADD COLUMN IF NOT EXISTS workout_id TEXT,
  ADD COLUMN IF NOT EXISTS rating     INTEGER,
  ADD COLUMN IF NOT EXISTS feedback   TEXT,
  ADD COLUMN IF NOT EXISTS paid       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- Helpful comments so future operators understand why these exist outside
-- the original schema.sql declaration.
COMMENT ON COLUMN public.trainer_sessions.start_time IS
  'v18-D10: HH:MM string for the session window start. Optional; absent rows render with date only.';
COMMENT ON COLUMN public.trainer_sessions.end_time IS
  'v18-D10: HH:MM string for the session window end. Optional.';
COMMENT ON COLUMN public.trainer_sessions.workout_id IS
  'v18-D10: id of the workout completed during this session (if any). Optional.';
COMMENT ON COLUMN public.trainer_sessions.rating IS
  'v18-D10: trainer-entered 1–5 rating for the session. Optional.';
COMMENT ON COLUMN public.trainer_sessions.feedback IS
  'v18-D10: trainer free-text feedback. Optional.';
COMMENT ON COLUMN public.trainer_sessions.paid IS
  'v18-D10: whether this session has been marked paid by the trainer. Optional, defaults false.';
COMMENT ON COLUMN public.trainer_sessions.payment_id IS
  'v18-D10: id of the client_payments row that paid for this session, if any. Optional.';
