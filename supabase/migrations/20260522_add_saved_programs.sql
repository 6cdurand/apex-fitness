-- 20260522_add_saved_programs.sql
-- Sprint: v14 dispatch 03 (supersedes never-applied v12-D8 schema)
-- Source: briefs/sprint-v14-2026-05-18/v14-fix-03-brief.md
-- Goal: persist trainer-saved programs separately from curated system templates so trainers
--       can reuse their own designs across clients via a "My Templates" tab on the Select page.

BEGIN;

CREATE TABLE IF NOT EXISTS public.saved_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  phase TEXT,
  goals TEXT[],
  duration_weeks INTEGER NOT NULL,
  days_per_week INTEGER NOT NULL,
  structure TEXT,
  -- v14-D3: class_safe column kept for forward-compat but unused in UI (badge + filter removed).
  class_safe BOOLEAN DEFAULT false,
  auto_repeat BOOLEAN DEFAULT false,

  -- Body of the program: days[] -> blocks[] -> exercises[]. JSONB matches in-memory ProgramDay[].
  days JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  source_template_id TEXT,
  times_assigned INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_programs_trainer ON public.saved_programs(trainer_id);
CREATE INDEX IF NOT EXISTS idx_saved_programs_phase ON public.saved_programs(phase);
CREATE INDEX IF NOT EXISTS idx_saved_programs_updated ON public.saved_programs(updated_at DESC);

ALTER TABLE public.saved_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_owns_saved_programs" ON public.saved_programs;
CREATE POLICY "trainer_owns_saved_programs" ON public.saved_programs
  FOR ALL USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

COMMIT;

-- POST-APPLY VERIFICATION:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name='saved_programs';
--   -- Expectation: 1 row.
--
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.saved_programs'::regclass;
--   -- Expectation: 'trainer_owns_saved_programs'.
