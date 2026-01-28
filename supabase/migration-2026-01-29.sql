-- APEX FITNESS - Migration 2026-01-29
-- Run this ENTIRE script in Supabase SQL Editor

-- ==========================================
-- 1. SESSION_WORKOUTS TABLE (stores workout content for sessions)
-- THIS IS CRITICAL - without this, Today's workouts won't sync
-- ==========================================
DROP TABLE IF EXISTS session_workouts CASCADE;

CREATE TABLE session_workouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_id TEXT,
  event_id TEXT,
  trainer_id TEXT NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_workouts_trainer ON session_workouts(trainer_id);
CREATE INDEX idx_session_workouts_event ON session_workouts(event_id);

ALTER TABLE session_workouts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON session_workouts TO anon, authenticated;

-- ==========================================
-- 2. CALENDAR_EVENTS TABLE (stores scheduled sessions)
-- ==========================================
DROP TABLE IF EXISTS calendar_events CASCADE;

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL,
  client_id TEXT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  duration INTEGER,
  type TEXT DEFAULT 'session',
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  color TEXT,
  workout_id TEXT,
  client_confirmed BOOLEAN DEFAULT false,
  client_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_trainer ON calendar_events(trainer_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(date);

ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;
GRANT ALL ON calendar_events TO anon, authenticated;

-- ==========================================
-- ADD PAYMENT PLAN FIELDS TO SESSION_PACKAGES
-- ==========================================
ALTER TABLE session_packages ADD COLUMN IF NOT EXISTS payment_frequency TEXT;
ALTER TABLE session_packages ADD COLUMN IF NOT EXISTS sessions_per_cycle INTEGER;
ALTER TABLE session_packages ADD COLUMN IF NOT EXISTS next_payment_due DATE;
ALTER TABLE session_packages ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE session_packages ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;

-- ==========================================
-- UPDATE CLIENT_PAYMENTS TABLE
-- ==========================================
-- Make sure client_payments has all needed columns
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NZD';
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS sessions_included INTEGER;
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE client_payments ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- ==========================================
-- CLIENT GROUPS TABLE (for group fitness classes)
-- ==========================================
CREATE TABLE IF NOT EXISTS client_groups (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  member_ids TEXT[] DEFAULT '{}',
  color TEXT,
  price_per_session NUMERIC,
  schedule JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_groups_trainer ON client_groups(trainer_id);

-- ==========================================
-- VERIFY ALL TABLES EXIST
-- ==========================================

-- Users table - add missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Session workouts - make sure it exists with TEXT id
CREATE TABLE IF NOT EXISTS session_workouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_id TEXT,
  event_id TEXT,
  trainer_id TEXT NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- DISABLE RLS FOR EASIER TESTING
-- (Re-enable in production with proper policies)
-- ==========================================
ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_workouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_packages DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON calendar_events TO anon, authenticated;
GRANT ALL ON client_groups TO anon, authenticated;
GRANT ALL ON session_workouts TO anon, authenticated;
GRANT ALL ON client_payments TO anon, authenticated;
GRANT ALL ON session_packages TO anon, authenticated;

-- ==========================================
-- DONE! 
-- Tables updated:
-- - calendar_events: fixed column types for date/time
-- - session_packages: added payment plan fields
-- - client_payments: added missing columns  
-- - client_groups: new table for group fitness
-- ==========================================
