-- APEX FITNESS — Migration: Program Scheduling Overhaul (2026-03-18)
-- Covers: training_days JSONB column on client_programs, RLS for client access,
--         notification link column, calendar event client access
-- ============================================================

-- 1. CLIENT_PROGRAMS: Add training_days JSONB column for scheduling config
--    Stores: { scheduleMode, trainingDaysPerWeek, selectedDays, cycleAcrossWeeks,
--              sessionPTMap, nextWorkoutIndex, autoRepeat, sessionType }
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS training_days JSONB;

-- 2. NOTIFICATIONS: Add link column (sync uses 'link', DB had 'action_url')
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- 3. CLIENT_PROGRAMS: Add index on client_id for client-side fetching
CREATE INDEX IF NOT EXISTS idx_client_programs_client ON client_programs(client_id);

-- 4. CALENDAR_EVENTS: Add index on client_id for client-side fetching
CREATE INDEX IF NOT EXISTS idx_calendar_events_client ON calendar_events(client_id);

-- 5. RLS: Allow clients to READ their own programs
--    (Existing policy only allows trainer_id = auth.uid())
CREATE POLICY "Clients read own programs"
  ON client_programs FOR SELECT
  USING (client_id = auth.uid()::text);

-- 6. RLS: Allow clients to READ their own calendar events
CREATE POLICY "Clients read own calendar events"
  ON calendar_events FOR SELECT
  USING (client_id = auth.uid()::text);

-- 7. RLS: Allow clients to UPDATE their own calendar events (e.g. confirm session)
CREATE POLICY "Clients update own calendar events"
  ON calendar_events FOR UPDATE
  USING (client_id = auth.uid()::text);

-- 8. NOTIFICATIONS: Allow deleting own notifications
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid()::text);
