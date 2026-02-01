-- APEX FITNESS - Migration 2026-02-02
-- Medal progression tracking - adds timesEarned field
-- Run this ENTIRE script in Supabase SQL Editor

-- ==========================================
-- 1. ADD TIMES_EARNED TO MEDALS TABLE
-- Tracks how many times a medal condition has been met
-- ==========================================
ALTER TABLE medals ADD COLUMN IF NOT EXISTS times_earned INTEGER DEFAULT 1;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS definition_id TEXT;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS rarity TEXT;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE medals ADD COLUMN IF NOT EXISTS target INTEGER DEFAULT 1;

-- Set default times_earned for existing medals
UPDATE medals SET times_earned = 1 WHERE times_earned IS NULL;

-- ==========================================
-- 2. CREATE USER_MEDALS TABLE (if using separate table)
-- Alternative approach - stores medal instances per user
-- ==========================================
CREATE TABLE IF NOT EXISTS user_medals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  definition_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  icon TEXT,
  tier TEXT,
  category TEXT,
  rarity TEXT,
  earned BOOLEAN DEFAULT true,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  times_earned INTEGER DEFAULT 1,
  is_evolving BOOLEAN DEFAULT false,
  current_evolution_tier TEXT,
  next_evolution_target INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, definition_id)
);

CREATE INDEX IF NOT EXISTS idx_user_medals_user ON user_medals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_medals_definition ON user_medals(definition_id);
CREATE INDEX IF NOT EXISTS idx_user_medals_category ON user_medals(category);

-- Disable RLS for simplicity (app handles auth)
ALTER TABLE user_medals DISABLE ROW LEVEL SECURITY;
GRANT ALL ON user_medals TO anon, authenticated;

-- ==========================================
-- 3. FUNCTION TO SYNC MEDAL FROM APP
-- Called when earnMedal is triggered
-- ==========================================
CREATE OR REPLACE FUNCTION upsert_user_medal(
  p_id TEXT,
  p_user_id TEXT,
  p_definition_id TEXT,
  p_name TEXT,
  p_description TEXT,
  p_icon TEXT,
  p_tier TEXT,
  p_category TEXT,
  p_rarity TEXT,
  p_earned BOOLEAN,
  p_earned_at TIMESTAMPTZ,
  p_progress INTEGER,
  p_target INTEGER,
  p_times_earned INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO user_medals (
    id, user_id, definition_id, name, description, icon, 
    tier, category, rarity, earned, earned_at, progress, target, times_earned, updated_at
  ) VALUES (
    p_id, p_user_id, p_definition_id, p_name, p_description, p_icon,
    p_tier, p_category, p_rarity, p_earned, p_earned_at, p_progress, p_target, p_times_earned, NOW()
  )
  ON CONFLICT (user_id, definition_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    tier = EXCLUDED.tier,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    earned = EXCLUDED.earned,
    earned_at = COALESCE(user_medals.earned_at, EXCLUDED.earned_at),
    progress = EXCLUDED.progress,
    target = EXCLUDED.target,
    times_earned = EXCLUDED.times_earned,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 4. MIGRATE EXISTING MEDALS DATA
-- Copy any existing medals to new format
-- ==========================================
INSERT INTO user_medals (id, user_id, definition_id, name, tier, category, earned, earned_at, times_earned)
SELECT 
  id::TEXT,
  user_id::TEXT,
  medal_type,
  medal_type,
  'bronze',
  'milestone',
  true,
  achieved_at,
  1
FROM medals
WHERE NOT EXISTS (
  SELECT 1 FROM user_medals um WHERE um.user_id = medals.user_id::TEXT AND um.definition_id = medals.medal_type
)
ON CONFLICT (user_id, definition_id) DO NOTHING;

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$ BEGIN RAISE NOTICE 'Migration complete: Medal progression tracking added'; END $$;
