-- 20260513_add_exercise_video_suggestions (v11-D3 — DEFERRED)
-- This migration is INTENTIONALLY commented out. v11 ships the suggestion
-- intake UI + API route, but table creation is deferred until we're ready
-- to start collecting. Apply via Supabase Dashboard when ready.
-- DO NOT APPLY YET.

/*
-- v11-D3: exercise video suggestion intake from athletes/trainers.
-- Allows users to suggest YouTube URLs or notes for exercises that lack animations.

CREATE TABLE IF NOT EXISTS public.exercise_video_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id     TEXT NOT NULL,
  exercise_name   TEXT,
  suggested_url   TEXT NOT NULL,
  note            TEXT,
  submitted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by exercise
CREATE INDEX IF NOT EXISTS idx_exercise_video_suggestions_exercise
  ON public.exercise_video_suggestions(exercise_id);

-- Index for admin review workflow
CREATE INDEX IF NOT EXISTS idx_exercise_video_suggestions_reviewed
  ON public.exercise_video_suggestions(reviewed)
  WHERE reviewed = FALSE;

-- Enable RLS
ALTER TABLE public.exercise_video_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own suggestions
CREATE POLICY "users insert suggestions" ON public.exercise_video_suggestions
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- All authenticated users can read suggestions (tighten when admin role exists)
CREATE POLICY "authenticated read all" ON public.exercise_video_suggestions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Future: admin update policy for marking reviewed = true
*/
