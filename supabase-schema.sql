-- APEX Fitness Database Schema for Supabase
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (with password for cross-device login)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profile_photo TEXT,
  bio TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE,
  height NUMERIC,
  weight NUMERIC,
  preferred_unit TEXT DEFAULT 'kg' CHECK (preferred_unit IN ('kg', 'lbs')),
  is_trainer BOOLEAN DEFAULT FALSE,
  is_verified_trainer BOOLEAN DEFAULT FALSE,
  trainer_id UUID REFERENCES users(id),
  mode TEXT DEFAULT 'user' CHECK (mode IN ('user', 'trainer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public insert for registration (no auth required)
CREATE POLICY "Anyone can register" ON users FOR INSERT WITH CHECK (true);
-- Allow public select for login
CREATE POLICY "Anyone can login check" ON users FOR SELECT USING (true);

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exercises JSONB NOT NULL DEFAULT '[]',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  total_volume NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal Bests table
CREATE TABLE IF NOT EXISTS personal_bests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  reps INTEGER NOT NULL,
  one_rep_max NUMERIC NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL,
  workout_id UUID REFERENCES workouts(id),
  UNIQUE(user_id, exercise_id)
);

-- Medals table
CREATE TABLE IF NOT EXISTS medals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL,
  category TEXT NOT NULL,
  earned BOOLEAN DEFAULT FALSE,
  earned_at TIMESTAMPTZ,
  progress NUMERIC DEFAULT 0,
  target NUMERIC DEFAULT 1,
  UNIQUE(user_id, definition_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_start_time ON workouts(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_personal_bests_user_id ON personal_bests(user_id);
CREATE INDEX IF NOT EXISTS idx_medals_user_id ON medals(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE medals ENABLE ROW LEVEL SECURITY;

-- Users can read all users (for trainer/client relationships)
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Users can only see their own workouts
CREATE POLICY "Users can view own workouts" ON workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON workouts FOR DELETE USING (auth.uid() = user_id);

-- Trainers can also see their clients' workouts
CREATE POLICY "Trainers can view client workouts" ON workouts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.id = workouts.user_id AND users.trainer_id = auth.uid()
  )
);

-- Users can only see their own personal bests
CREATE POLICY "Users can view own PBs" ON personal_bests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own PBs" ON personal_bests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own PBs" ON personal_bests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own PBs" ON personal_bests FOR DELETE USING (auth.uid() = user_id);

-- Users can only see their own medals
CREATE POLICY "Users can view own medals" ON medals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medals" ON medals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medals" ON medals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own medals" ON medals FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
