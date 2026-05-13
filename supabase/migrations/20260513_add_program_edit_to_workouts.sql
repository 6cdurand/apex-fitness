-- v10-D2: Add program_edit column to workouts table
-- Stores structural diff when athlete saved program changes

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS program_edit JSONB DEFAULT NULL;

COMMENT ON COLUMN public.workouts.program_edit IS
  'v10-D2: structural diff captured when athlete saved program changes. Format: {programId, dayIndex, added: string[], removed: string[], changed: string[], savedAt: ISO}';
