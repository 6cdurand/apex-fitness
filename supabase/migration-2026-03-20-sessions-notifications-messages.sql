-- APEX FITNESS — Migration: Sessions, Notifications & Messages (2026-03-20)
-- Covers: calendar_events missing columns, notifications sender tracking,
--         messages DELETE policy, session_workouts client access,
--         trainer_sessions client access, comprehensive RLS review
-- ============================================================

-- ============================================================
-- 1. CALENDAR_EVENTS: Add missing columns synced by the app
-- ============================================================
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS workout_id TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_group TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Index for recurrence_group (used by bulk delete)
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence
  ON calendar_events(recurrence_group) WHERE recurrence_group IS NOT NULL;

-- ============================================================
-- 2. NOTIFICATIONS: Add sender tracking + ensure all CRUD policies
-- ============================================================
-- sender_id tracks who created the notification (trainer id, system, etc.)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id TEXT;

-- The app uses both 'link' and 'action_url' — ensure link column exists
-- (Already added in migration-2026-03-18 but safe to re-run)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- DELETE policy was added in migration-2026-03-18 but use IF NOT EXISTS pattern:
-- Supabase doesn't support IF NOT EXISTS for policies, so we drop+recreate safely
DO $$
BEGIN
  -- Ensure DELETE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users delete own notifications'
  ) THEN
    CREATE POLICY "Users delete own notifications"
      ON notifications FOR DELETE
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- ============================================================
-- 3. MESSAGES: Ensure DELETE policy exists
--    The schema.sql has FOR ALL on sender_id OR receiver_id,
--    but if it was created as SELECT-only, we need explicit DELETE.
-- ============================================================
DO $$
BEGIN
  -- Check if a broad "Own messages" FOR ALL policy exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'messages' AND policyname = 'Own messages' AND cmd = 'ALL'
  ) THEN
    -- Already covers DELETE — no action needed
    RAISE NOTICE 'messages: "Own messages" FOR ALL policy exists, DELETE is covered';
  ELSE
    -- Add explicit DELETE policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'messages' AND policyname = 'Users delete own messages'
    ) THEN
      CREATE POLICY "Users delete own messages"
        ON messages FOR DELETE
        USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 4. CONVERSATIONS: Ensure DELETE policy exists
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversations' AND cmd = 'ALL'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'conversations' AND policyname = 'Users delete own conversations'
    ) THEN
      CREATE POLICY "Users delete own conversations"
        ON conversations FOR DELETE
        USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 5. SESSION_WORKOUTS: Ensure clients can SELECT their own workouts
--    Current policy is FOR ALL USING (true) which is permissive.
--    If that policy exists, clients already have access.
--    If not, add a client-read policy.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_workouts' AND cmd = 'ALL'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'session_workouts' AND policyname = 'Clients read own session workouts'
    ) THEN
      CREATE POLICY "Clients read own session workouts"
        ON session_workouts FOR SELECT
        USING (client_id = auth.uid()::text);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 6. TRAINER_SESSIONS: Allow clients to read their own sessions
--    Currently only trainer_id = auth.uid() policy exists.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trainer_sessions' AND policyname = 'Clients read own trainer sessions'
  ) THEN
    CREATE POLICY "Clients read own trainer sessions"
      ON trainer_sessions FOR SELECT
      USING (client_id = auth.uid()::text);
  END IF;
END $$;

-- Index on trainer_sessions.client_id for client-side fetching
CREATE INDEX IF NOT EXISTS idx_trainer_sessions_client ON trainer_sessions(client_id);

-- ============================================================
-- 7. CLIENT_PROGRAMS: Ensure weeklyPlan JSONB is preserved
--    The rotation (rotateProgramDay) modifies the 'days' JSONB
--    column in-place — no new columns needed.
--    Just ensure the client can UPDATE their own program's
--    nextWorkoutIndex (for flexible cycling).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_programs' AND policyname = 'Clients update own program progress'
  ) THEN
    CREATE POLICY "Clients update own program progress"
      ON client_programs FOR UPDATE
      USING (client_id = auth.uid()::text);
  END IF;
END $$;

-- ============================================================
-- 8. BOOKING_REQUESTS: Allow clients to read and respond to their own
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_requests' AND policyname = 'Clients manage own booking requests'
  ) THEN
    CREATE POLICY "Clients manage own booking requests"
      ON booking_requests FOR ALL
      USING (client_id = auth.uid()::text);
  END IF;
END $$;

-- Index for client-side booking request fetching
CREATE INDEX IF NOT EXISTS idx_booking_requests_client ON booking_requests(client_id);

-- ============================================================
-- 9. SESSION_PACKAGES: Allow clients to read their own packages
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_packages' AND policyname = 'Clients read own session packages'
  ) THEN
    CREATE POLICY "Clients read own session packages"
      ON session_packages FOR SELECT
      USING (client_id = auth.uid()::text);
  END IF;
END $$;

-- Index for client-side package fetching
CREATE INDEX IF NOT EXISTS idx_session_packages_client ON session_packages(client_id);

-- ============================================================
-- DONE! This migration ensures:
-- ✅ calendar_events has all columns the app syncs (date, color, workout_id, recurrence_group, contact_name, duration)
-- ✅ notifications has sender_id + link columns and full CRUD policies
-- ✅ messages has DELETE policy for both sender and receiver
-- ✅ conversations has DELETE policy
-- ✅ session_workouts accessible to clients
-- ✅ trainer_sessions readable by clients (for booked PT sessions)
-- ✅ client_programs updatable by clients (for flexible program cycling)
-- ✅ booking_requests accessible to clients
-- ✅ session_packages readable by clients
-- ============================================================
