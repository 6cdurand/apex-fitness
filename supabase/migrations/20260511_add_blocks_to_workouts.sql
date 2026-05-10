-- Migration: add `blocks` JSONB column to public.workouts
--
-- Context: v7 sprint dispatch D2 (commit 6336b65, 2026-05-10) added the
-- WorkoutBlockSnapshot[] persistence path in src/lib/supabaseSync.ts
-- (toDbWorkout / fromDbWorkout) BUT shipped without the corresponding
-- migration. Result: every workout-finish since D2 deployed has been
-- failing with Postgres 42703 ("column 'blocks' does not exist") and
-- the UI mistakenly surfaces this as "Failed to save workout. Check
-- your connection and tap Finish again."
--
-- This migration is idempotent and safe to re-run.
--
-- Schema: blocks is a JSON array of WorkoutBlockSnapshot objects with the
-- shape defined in src/types/index.ts. Captured at workout-finish to
-- persist cardio/circuit-specific state (timerSeconds, roundsCompleted,
-- roundTimes, splits, distanceCompleted, intervals, cardioMode, etc.)
-- that lives only in the active-workout page's local React state and
-- would otherwise be dropped at sync time. See PLAN_circuit_cardio_persistence.md.

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS blocks JSONB;

-- No GIN index needed for now; the column is read back as a snapshot
-- for the workout summary modal and history page, not queried by
-- structure. Add one if analytics need it later.

COMMENT ON COLUMN public.workouts.blocks IS
  'JSON snapshot of WorkoutBlockSnapshot[] captured at workout finish. '
  'Holds cardio/circuit block-level state (timer, rounds, splits, '
  'intervals) that is otherwise lost when only exercises[] is persisted. '
  'Schema lives in src/types/index.ts WorkoutBlockSnapshot. '
  'Added 2026-05-11 to back-fill v7 sprint D2 (commit 6336b65).';
