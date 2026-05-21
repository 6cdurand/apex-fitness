-- 20260525_saved_programs_schedule_mode.sql
-- Sprint: v14 dispatch 28
-- Source: briefs/sprint-v14-2026-05-18/v14-fix-28-brief.md
-- Goal: persist the raw `scheduleMode` ('fixed' | 'flexible') on
--       saved_programs so the assign path doesn't have to reverse-parse
--       the human-readable `structure` label. v14-D26 added the field in
--       app code (saveProgramAsTemplate payload + assignSavedProgramToClient
--       fallback chain) but the column itself was never added — so the
--       value silently dropped on upsert and assigned programs were forced
--       through the `structure === 'Flexible'` string-match fallback.
--       Without this column, flexible programs round-tripped via the
--       template path were getting assigned as `scheduleMode: 'fixed'`.

BEGIN;

ALTER TABLE public.saved_programs
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT
  CHECK (schedule_mode IS NULL OR schedule_mode IN ('fixed', 'flexible'));

COMMIT;

-- POST-APPLY VERIFICATION:
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'saved_programs'
--      AND column_name = 'schedule_mode';
--   -- Expectation: 1 row, data_type='text'.
--
-- Existing rows have NULL schedule_mode. The assign-path fallback at
-- trainerStore.assignSavedProgramToClient picks them up via the legacy
-- `structure === 'Flexible'` parse, so no backfill required.
