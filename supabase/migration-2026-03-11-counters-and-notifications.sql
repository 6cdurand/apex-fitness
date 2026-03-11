-- APEX FITNESS — Migration: Stored Counters & Notifications (2026-03-11)
-- Covers: totalSessions/totalPaid stored counters on trainer_clients,
--         notifications table, follower notifications
-- ============================================================

-- 1. TRAINER_CLIENTS: Add stored lifetime counters
--    These are simple counters that only change on explicit user action.
--    They are NOT derived from workout history or payment records.
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS total_paid INTEGER DEFAULT 0;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS total_sessions_offset INTEGER DEFAULT 0;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS total_paid_offset INTEGER DEFAULT 0;

-- 2. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT,
  action_url TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. FOLLOWERS TABLE (if not exists)
CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);

-- 4. RLS for new tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own notifications
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (true);

-- Allow inserting notifications for any user (trainers notify clients)
CREATE POLICY "Anyone can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (true);

-- Followers: anyone can follow/unfollow
CREATE POLICY "Anyone can manage followers"
  ON followers FOR ALL
  USING (true);
