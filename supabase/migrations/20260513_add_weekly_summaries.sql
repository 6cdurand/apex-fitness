-- 20260513_add_weekly_summaries (v10-D5 — DEFERRED TO v11)
-- This migration is INTENTIONALLY commented out. v10 ships client-side
-- weekly report computation. v11 will introduce the cross-device persisted
-- weekly_summaries table for trainer-side viewing and historical archive.
-- DO NOT APPLY YET.

/*
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  workouts_count  INT NOT NULL DEFAULT 0,
  total_volume    NUMERIC NOT NULL DEFAULT 0,
  pbs_count       INT NOT NULL DEFAULT 0,
  medals_earned   INT NOT NULL DEFAULT 0,
  streak_weeks    INT NOT NULL DEFAULT 0,
  data            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own weekly summaries"
  ON public.weekly_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users write own weekly summaries"
  ON public.weekly_summaries FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week
  ON public.weekly_summaries(user_id, week_start);
*/
