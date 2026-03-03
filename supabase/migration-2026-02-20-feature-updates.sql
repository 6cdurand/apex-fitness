-- APEX FITNESS — Migration: Feature Updates (2026-02-20)
-- Covers: template scheduling, optional email, consultation exercises,
--         standalone program builder, client programs expansion
-- ============================================================

-- 1. USERS TABLE: Make email nullable for clients added without email
--    (Currently: email TEXT UNIQUE NOT NULL)
--    Trainer can add client without email; placeholder used locally.
--    When client eventually provides email, it gets updated.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Add phone column if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'other';
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_unit TEXT DEFAULT 'kg';

-- 2. TRAINER_CLIENTS: Add injury_history field from onboarding
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS injury_history TEXT;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS sessions_done INTEGER DEFAULT 0;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS sessions_left INTEGER DEFAULT 0;

-- 3. CLIENT_PROGRAMS: Expand for standalone builder + scheduling config
--    Existing table has: id, trainer_id, client_id, name, description, days (JSONB), status, start_date, end_date
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'foundation';
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS goal TEXT DEFAULT 'general';
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS weekly_plan JSONB;  -- Full ClientWorkoutDay[] structure
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS training_days_per_week INTEGER;
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS selected_days TEXT[];  -- e.g. {'monday','wednesday','friday'}
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS cycle_across_weeks BOOLEAN DEFAULT false;
ALTER TABLE client_programs ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'pt';  -- 'pt', 'solo', 'mixed'

-- 4. CLIENT_PROGRAMMING_PROFILES: Onboarding assessment data
CREATE TABLE IF NOT EXISTS client_programming_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primary_goal TEXT,
  secondary_goal TEXT,
  custom_goal_text TEXT,
  training_preference TEXT DEFAULT '1:1',
  experience_level TEXT DEFAULT 'some',
  injury_flags TEXT[],
  injury_notes TEXT,
  days_per_week INTEGER DEFAULT 2,
  session_length INTEGER DEFAULT 60,
  train_alone_outside_pt TEXT DEFAULT 'maybe',
  movement_confidence JSONB,  -- {squat: 3, hinge: 3, push: 3, pull: 3, core: 3}
  wants_classes TEXT DEFAULT 'maybe',
  class_ready BOOLEAN DEFAULT false,
  sleep_quality INTEGER,
  stress_level INTEGER,
  job_activity TEXT,
  current_phase TEXT DEFAULT 'foundation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_profiles_client ON client_programming_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_trainer ON client_programming_profiles(trainer_id);

-- 5. WORKOUTS TABLE: Add trainer_notes for consultation workouts
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS trainer_notes TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;  -- Soft delete

-- 6. CALENDAR_EVENTS: Add program-related metadata
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES client_programs(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS schedule_mode TEXT;  -- 'fixed', 'cycle', 'interval'
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS contact_name TEXT;  -- For consultations without linked client

-- 7. SESSION_WORKOUTS: Workouts built in trainer's builder for sessions
CREATE TABLE IF NOT EXISTS session_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT,
  session_id TEXT,
  name TEXT NOT NULL,
  blocks JSONB,  -- Full workout block structure
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_workouts_trainer ON session_workouts(trainer_id);

-- 8. WORKOUT_LIBRARY: Trainer's saved workout templates
CREATE TABLE IF NOT EXISTS workout_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  blocks JSONB,
  category TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workout_library_trainer ON workout_library(trainer_id);

-- 9. RLS for new tables
ALTER TABLE client_programming_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies (trainer can access their own data)
CREATE POLICY "Trainers manage own client profiles"
  ON client_programming_profiles FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "Trainers manage own session workouts"
  ON session_workouts FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "Trainers manage own workout library"
  ON workout_library FOR ALL
  USING (trainer_id = auth.uid());
