-- Apex Fitness Supabase Schema
-- Run this in your Supabase SQL Editor to create all required tables

-- Trainer Sessions table (for cross-device sync)
CREATE TABLE IF NOT EXISTS trainer_sessions (
  id UUID PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  start_time TEXT,
  end_time TEXT,
  duration INTEGER DEFAULT 60,
  type TEXT DEFAULT 'pt_session',
  status TEXT DEFAULT 'scheduled',
  workout_id UUID,
  notes TEXT,
  rating INTEGER,
  feedback TEXT,
  paid BOOLEAN DEFAULT FALSE,
  payment_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Packages table
CREATE TABLE IF NOT EXISTS session_packages (
  id UUID PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  used_sessions INTEGER DEFAULT 0,
  remaining_sessions INTEGER NOT NULL,
  price_total DECIMAL(10,2),
  price_per_session DECIMAL(10,2),
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  payment_id UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trainer Clients relationship table
CREATE TABLE IF NOT EXISTS trainer_clients (
  id UUID PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  notes TEXT,
  goals TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, client_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

-- Friendships/Following table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Strength ratings table (cached calculations)
CREATE TABLE IF NOT EXISTS strength_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  overall_score DECIMAL(5,2),
  level TEXT,
  tier TEXT,
  push_score DECIMAL(5,2),
  pull_score DECIMAL(5,2),
  legs_score DECIMAL(5,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_follower ON friendships(follower_id);
CREATE INDEX IF NOT EXISTS idx_friendships_following ON friendships(following_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_bests_user ON personal_bests(user_id);
CREATE INDEX IF NOT EXISTS idx_medals_user ON medals(user_id);

-- Enable RLS but with permissive policies for the app
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clients ENABLE ROW LEVEL SECURITY;

-- Policies to allow all operations (adjust for production)
CREATE POLICY "Allow all for messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for friendships" ON friendships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for strength_ratings" ON strength_ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for trainer_sessions" ON trainer_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for session_packages" ON session_packages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for trainer_clients" ON trainer_clients FOR ALL USING (true) WITH CHECK (true);

-- Indexes for trainer tables
CREATE INDEX IF NOT EXISTS idx_trainer_sessions_trainer ON trainer_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_sessions_client ON trainer_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_trainer ON session_packages(trainer_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_client ON session_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer ON trainer_clients(trainer_id);
