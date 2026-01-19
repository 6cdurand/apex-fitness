-- APEX FITNESS - Complete Database Schema
-- Run this in Supabase SQL Editor to create all tables with proper relationships

-- ==========================================
-- CORE USER TABLE (if not exists)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  is_trainer BOOLEAN DEFAULT false,
  mode TEXT DEFAULT 'athlete',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- USER DATA TABLES (linked to users)
-- ==========================================

-- Personal Bests
CREATE TABLE IF NOT EXISTS personal_bests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  weight NUMERIC,
  reps INTEGER,
  one_rm NUMERIC,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

-- Medals/Achievements
CREATE TABLE IF NOT EXISTS medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medal_type TEXT NOT NULL,
  exercise_id TEXT,
  exercise_name TEXT,
  weight NUMERIC,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strength Ratings
CREATE TABLE IF NOT EXISTS strength_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  rating NUMERIC,
  level TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Workout History
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  exercises JSONB,
  duration INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SOCIAL TABLES
-- ==========================================

-- Friendships/Following
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TRAINER TABLES (linked to trainer user)
-- ==========================================

-- Trainer's Clients (relationship table)
CREATE TABLE IF NOT EXISTS trainer_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  onboarding_complete BOOLEAN DEFAULT false,
  notes TEXT,
  goals TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, client_id)
);

-- Trainer Sessions
CREATE TABLE IF NOT EXISTS trainer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  duration INTEGER DEFAULT 60,
  type TEXT DEFAULT 'training',
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  exercises JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Packages
CREATE TABLE IF NOT EXISTS session_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  used_sessions INTEGER DEFAULT 0,
  price NUMERIC,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'session',
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  location TEXT,
  recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  client_confirmed BOOLEAN DEFAULT false,
  client_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Payments
CREATE TABLE IF NOT EXISTS client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT DEFAULT 'session',
  status TEXT DEFAULT 'completed',
  date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  package_id UUID REFERENCES session_packages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Programs
CREATE TABLE IF NOT EXISTS client_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  days JSONB,
  status TEXT DEFAULT 'active',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking Requests
CREATE TABLE IF NOT EXISTS booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  requested_date TIMESTAMPTZ NOT NULL,
  requested_time TEXT,
  duration INTEGER DEFAULT 60,
  type TEXT DEFAULT 'training',
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_personal_bests_user ON personal_bests(user_id);
CREATE INDEX IF NOT EXISTS idx_medals_user ON medals(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_follower ON friendships(follower_id);
CREATE INDEX IF NOT EXISTS idx_friendships_following ON friendships(following_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer ON trainer_clients(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_sessions_trainer ON trainer_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_trainer ON calendar_events(trainer_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_trainer ON client_payments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_trainer ON client_programs(trainer_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE medals ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users to access their own data)
-- Users can read all users (for profiles) but only update their own
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Personal data - users can only access their own
CREATE POLICY "Own personal bests" ON personal_bests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own medals" ON medals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own strength ratings" ON strength_ratings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own workouts" ON workouts FOR ALL USING (auth.uid() = user_id);

-- Social - users can see their own friendships
CREATE POLICY "Own friendships" ON friendships FOR ALL USING (auth.uid() = follower_id OR auth.uid() = following_id);
CREATE POLICY "Own conversations" ON conversations FOR ALL USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Own messages" ON messages FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Trainer data - trainers can only access their own data
CREATE POLICY "Own trainer clients" ON trainer_clients FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Own trainer sessions" ON trainer_sessions FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Own session packages" ON session_packages FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Own calendar events" ON calendar_events FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Own client payments" ON client_payments FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Own client programs" ON client_programs FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Own booking requests" ON booking_requests FOR ALL USING (auth.uid() = trainer_id);

-- ==========================================
-- DONE! All tables created with:
-- - Proper foreign key relationships
-- - CASCADE DELETE (when user deleted, all their data is deleted)
-- - Indexes for fast queries
-- - Row Level Security for data isolation
-- ==========================================
