-- Migration: Add private_notes, shared_notes, trainer_notes columns to workouts table
-- Backwards compatibility: existing 'notes' column is preserved, old notes migrated to private_notes

-- Add new columns (idempotent — won't fail if they already exist)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS private_notes TEXT DEFAULT '';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS shared_notes TEXT DEFAULT '';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS trainer_notes TEXT DEFAULT '';

-- Migrate existing notes → private_notes (only where private_notes is empty)
UPDATE workouts
SET private_notes = notes
WHERE (private_notes IS NULL OR private_notes = '')
  AND notes IS NOT NULL
  AND notes != '';

-- RLS policies for notes visibility
-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view own workout private notes" ON workouts;
DROP POLICY IF EXISTS "Trainers can view shared notes for their clients" ON workouts;

-- Users can always read their own workouts (including private_notes)
-- This is typically already covered by the existing RLS policy on workouts.
-- The key distinction is enforced at the APPLICATION level:
--   - private_notes: only shown to workout.user_id
--   - shared_notes: shown to both workout.user_id AND workout.assigned_by
--   - trainer_notes: only shown to workout.assigned_by (the trainer)
-- 
-- The existing RLS policy "Users can view own workouts" + "Trainers can view client workouts"
-- already handles row-level access. Column-level visibility is enforced in the app layer
-- since Supabase RLS operates at row level, not column level.

-- Ensure trainers can read workouts they assigned (for shared_notes access)
-- This policy may already exist; recreate it to be safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Trainers can view assigned workouts' AND tablename = 'workouts'
  ) THEN
    CREATE POLICY "Trainers can view assigned workouts" ON workouts
      FOR SELECT
      USING (auth.uid()::text = assigned_by);
  END IF;
END $$;
