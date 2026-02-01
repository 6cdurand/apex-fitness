-- APEX FITNESS - Profile Visibility & Privacy Migration
-- Run this in Supabase SQL Editor

-- ==========================================
-- ADD PRIVACY COLUMNS TO USERS TABLE
-- ==========================================

-- Add is_public_profile column (defaults to true for existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN DEFAULT true;

-- Add exercise_unit column for kg/lb preference
ALTER TABLE users ADD COLUMN IF NOT EXISTS exercise_unit TEXT DEFAULT 'kg';

-- Add gender for strength rating calculations
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';

-- ==========================================
-- FRIENDS/FOLLOWING TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active', -- 'pending', 'active', 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- ==========================================
-- PROFILE VISIBILITY FUNCTION
-- Returns true if viewer can see target's profile
-- ==========================================

CREATE OR REPLACE FUNCTION can_view_profile(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  target_is_public BOOLEAN;
  is_trainer_client BOOLEAN;
  is_friend BOOLEAN;
BEGIN
  -- Can always view own profile
  IF viewer_id = target_id THEN
    RETURN true;
  END IF;

  -- Check if target profile is public
  SELECT COALESCE(is_public_profile, true) INTO target_is_public
  FROM users WHERE id = target_id;
  
  IF target_is_public THEN
    RETURN true;
  END IF;

  -- Check if viewer is target's trainer
  SELECT EXISTS(
    SELECT 1 FROM trainer_clients 
    WHERE trainer_id = viewer_id AND client_id = target_id
  ) INTO is_trainer_client;
  
  IF is_trainer_client THEN
    RETURN true;
  END IF;

  -- Check if target is viewer's trainer (client viewing trainer)
  SELECT EXISTS(
    SELECT 1 FROM trainer_clients 
    WHERE trainer_id = target_id AND client_id = viewer_id
  ) INTO is_trainer_client;
  
  IF is_trainer_client THEN
    RETURN true;
  END IF;

  -- Check if they are friends (mutual follow or explicit friend relationship)
  SELECT EXISTS(
    SELECT 1 FROM user_follows 
    WHERE (follower_id = viewer_id AND following_id = target_id AND status = 'active')
    OR (follower_id = target_id AND following_id = viewer_id AND status = 'active')
  ) INTO is_friend;
  
  RETURN is_friend;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- GET VISIBLE PROFILES FOR A USER
-- Returns list of user IDs the viewer can see
-- ==========================================

CREATE OR REPLACE FUNCTION get_visible_profiles(viewer_id UUID)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id FROM users u
  WHERE 
    u.id = viewer_id -- Own profile
    OR u.is_public_profile = true -- Public profiles
    OR EXISTS( -- Is trainer's client
      SELECT 1 FROM trainer_clients tc 
      WHERE tc.trainer_id = viewer_id AND tc.client_id = u.id
    )
    OR EXISTS( -- Client viewing trainer
      SELECT 1 FROM trainer_clients tc 
      WHERE tc.trainer_id = u.id AND tc.client_id = viewer_id
    )
    OR EXISTS( -- Friends
      SELECT 1 FROM user_follows uf 
      WHERE (uf.follower_id = viewer_id AND uf.following_id = u.id AND uf.status = 'active')
      OR (uf.follower_id = u.id AND uf.following_id = viewer_id AND uf.status = 'active')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- GET CLIENT STRENGTH RATINGS FOR TRAINER
-- Returns strength ratings for all trainer's clients
-- ==========================================

CREATE OR REPLACE FUNCTION get_trainer_client_ratings(trainer_user_id UUID)
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  category TEXT,
  rating NUMERIC,
  level TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as client_id,
    u.name as client_name,
    sr.category,
    sr.rating,
    sr.level,
    sr.updated_at
  FROM trainer_clients tc
  JOIN users u ON u.id = tc.client_id
  LEFT JOIN strength_ratings sr ON sr.user_id = u.id
  WHERE tc.trainer_id = trainer_user_id
  ORDER BY u.name, sr.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Enable RLS on strength_ratings if not already enabled
ALTER TABLE strength_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own strength ratings
CREATE POLICY IF NOT EXISTS "Users can view own ratings" ON strength_ratings
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Trainers can view their clients' strength ratings
CREATE POLICY IF NOT EXISTS "Trainers can view client ratings" ON strength_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients 
      WHERE trainer_id = auth.uid() AND client_id = strength_ratings.user_id
    )
  );

-- Policy: Public profiles can be viewed by anyone
CREATE POLICY IF NOT EXISTS "Public profiles ratings visible" ON strength_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = strength_ratings.user_id AND is_public_profile = true
    )
  );

-- Policy: Friends can view each other's ratings
CREATE POLICY IF NOT EXISTS "Friends can view ratings" ON strength_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_follows 
      WHERE status = 'active'
      AND ((follower_id = auth.uid() AND following_id = strength_ratings.user_id)
        OR (follower_id = strength_ratings.user_id AND following_id = auth.uid()))
    )
  );

-- Enable RLS on personal_bests
ALTER TABLE personal_bests ENABLE ROW LEVEL SECURITY;

-- Similar policies for personal_bests
CREATE POLICY IF NOT EXISTS "Users can view own PBs" ON personal_bests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Trainers can view client PBs" ON personal_bests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients 
      WHERE trainer_id = auth.uid() AND client_id = personal_bests.user_id
    )
  );

CREATE POLICY IF NOT EXISTS "Public profiles PBs visible" ON personal_bests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = personal_bests.user_id AND is_public_profile = true
    )
  );

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_strength_ratings_user ON strength_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_bests_user ON personal_bests(user_id);
CREATE INDEX IF NOT EXISTS idx_users_public ON users(is_public_profile) WHERE is_public_profile = true;
