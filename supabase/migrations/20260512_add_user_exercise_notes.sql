-- Exercise notes sync table (v9-04)
-- Stores per-exercise sticky notes for athletes (personal) and trainers (for specific clients)

CREATE TABLE IF NOT EXISTS public.user_exercise_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  notes TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one note per (user, trainer, exercise) combination
-- COALESCE ensures NULL trainer_id is treated distinctly from any UUID
CREATE UNIQUE INDEX IF NOT EXISTS user_exercise_notes_unique_idx 
  ON public.user_exercise_notes(user_id, COALESCE(trainer_id, '00000000-0000-0000-0000-000000000000'::uuid), exercise_id);

-- Index for efficient lookups by user
CREATE INDEX IF NOT EXISTS user_exercise_notes_user_idx ON public.user_exercise_notes(user_id);

-- Trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_user_exercise_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_exercise_notes_updated_at_trigger ON public.user_exercise_notes;
CREATE TRIGGER user_exercise_notes_updated_at_trigger
  BEFORE UPDATE ON public.user_exercise_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_exercise_notes_updated_at();

-- RLS policies
ALTER TABLE public.user_exercise_notes ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own notes (both personal and trainer-assigned)
DROP POLICY IF EXISTS "Users can read their own exercise notes" ON public.user_exercise_notes;
CREATE POLICY "Users can read their own exercise notes"
  ON public.user_exercise_notes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: users can insert/update their own notes (personal notes, trainer_id NULL)
DROP POLICY IF EXISTS "Users can manage their personal exercise notes" ON public.user_exercise_notes;
CREATE POLICY "Users can manage their personal exercise notes"
  ON public.user_exercise_notes
  FOR ALL
  USING (auth.uid() = user_id AND trainer_id IS NULL)
  WITH CHECK (auth.uid() = user_id AND trainer_id IS NULL);

-- Policy: trainers can insert/update notes for their clients
DROP POLICY IF EXISTS "Trainers can manage client exercise notes" ON public.user_exercise_notes;
CREATE POLICY "Trainers can manage client exercise notes"
  ON public.user_exercise_notes
  FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

-- Policy: users can delete their own personal notes
DROP POLICY IF EXISTS "Users can delete their personal exercise notes" ON public.user_exercise_notes;
CREATE POLICY "Users can delete their personal exercise notes"
  ON public.user_exercise_notes
  FOR DELETE
  USING (auth.uid() = user_id AND trainer_id IS NULL);

COMMENT ON TABLE public.user_exercise_notes IS 'Per-exercise sticky notes. If trainer_id IS NULL: athlete personal note. If trainer_id IS NOT NULL: trainer note for that athlete.';
