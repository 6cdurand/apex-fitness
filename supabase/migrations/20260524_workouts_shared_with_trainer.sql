-- v15-D4: opt-in sharing of standalone (non-program) workouts to a trainer.
-- A client checks "Share with [trainer name]" at finalize time → this column
-- is set to the trainer's user id. Trainer-side recent-workouts queries and
-- /workout/[id] access guards honour this field alongside `assigned_by`.
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS shared_with_trainer_id UUID;

CREATE INDEX IF NOT EXISTS idx_workouts_shared_with_trainer_id
  ON workouts(shared_with_trainer_id)
  WHERE shared_with_trainer_id IS NOT NULL;

-- Verification (run after applying):
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'workouts' AND column_name = 'shared_with_trainer_id';
