-- Migration: Saved Blocks (Block Library) for cross-device sync
-- Date: 2026-02-03
-- Description: Creates tables for storing trainer's saved workout blocks that can be synced across devices

-- ============================================
-- SAVED BLOCKS TABLE
-- ============================================
-- Stores workout blocks saved to the trainer's block library

CREATE TABLE IF NOT EXISTS saved_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('warmup', 'work', 'cooldown', 'cardio', 'circuit')),
  
  -- Exercises stored as JSONB array
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Circuit-specific settings
  circuit_style TEXT CHECK (circuit_style IN ('rounds', 'amrap', 'emom', 'forTime', 'tabata')),
  circuit_rounds INTEGER,
  circuit_duration INTEGER, -- seconds for AMRAP/For Time
  circuit_rest_between INTEGER, -- seconds between rounds
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries by trainer
CREATE INDEX IF NOT EXISTS idx_saved_blocks_trainer_id ON saved_blocks(trainer_id);
CREATE INDEX IF NOT EXISTS idx_saved_blocks_block_type ON saved_blocks(block_type);

-- Enable Row Level Security
ALTER TABLE saved_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Trainers can only see and manage their own blocks
CREATE POLICY "Trainers can view own saved blocks"
  ON saved_blocks FOR SELECT
  USING (auth.uid() = trainer_id);

CREATE POLICY "Trainers can insert own saved blocks"
  ON saved_blocks FOR INSERT
  WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Trainers can update own saved blocks"
  ON saved_blocks FOR UPDATE
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Trainers can delete own saved blocks"
  ON saved_blocks FOR DELETE
  USING (auth.uid() = trainer_id);

-- ============================================
-- BLOCK PERFORMANCE TRACKING TABLE
-- ============================================
-- Tracks client performance on named blocks over time

CREATE TABLE IF NOT EXISTS block_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES saved_blocks(id) ON DELETE SET NULL,
  block_name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID, -- Reference to the workout this was performed in
  
  -- Performance data stored as JSONB array
  -- Each exercise has: { exerciseId, exerciseName, sets: [{ weight, reps, rpe }] }
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Block-level metrics
  total_volume NUMERIC, -- sum of all weight × reps
  duration_seconds INTEGER, -- how long the block took
  notes TEXT,
  
  -- Timestamps
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_block_performances_client_id ON block_performances(client_id);
CREATE INDEX IF NOT EXISTS idx_block_performances_trainer_id ON block_performances(trainer_id);
CREATE INDEX IF NOT EXISTS idx_block_performances_block_id ON block_performances(block_id);
CREATE INDEX IF NOT EXISTS idx_block_performances_performed_at ON block_performances(performed_at DESC);

-- Enable Row Level Security
ALTER TABLE block_performances ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Trainers can see client performances, clients can see their own
CREATE POLICY "Trainers can view client block performances"
  ON block_performances FOR SELECT
  USING (auth.uid() = trainer_id OR auth.uid() = client_id);

CREATE POLICY "Trainers can insert block performances"
  ON block_performances FOR INSERT
  WITH CHECK (auth.uid() = trainer_id OR auth.uid() = client_id);

CREATE POLICY "Trainers can update own client performances"
  ON block_performances FOR UPDATE
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Trainers can delete own client performances"
  ON block_performances FOR DELETE
  USING (auth.uid() = trainer_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
-- Automatically update the updated_at timestamp

CREATE OR REPLACE FUNCTION update_saved_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_saved_blocks_updated_at
  BEFORE UPDATE ON saved_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_blocks_updated_at();

-- ============================================
-- EXERCISES JSONB STRUCTURE
-- ============================================
-- The exercises column stores an array of exercise objects:
-- [
--   {
--     "id": "uuid",
--     "exerciseId": "bench-press",
--     "exerciseName": "Bench Press",
--     "sets": 4,
--     "reps": "8-10",
--     "repType": "reps",
--     "rest": "90s",
--     "tempo": "3010",
--     "notes": "Focus on chest stretch",
--     "setStyle": "fixed"
--   }
-- ]

-- ============================================
-- SAMPLE QUERIES
-- ============================================
-- Get all saved blocks for a trainer:
-- SELECT * FROM saved_blocks WHERE trainer_id = 'trainer-uuid' ORDER BY created_at DESC;

-- Get blocks by type:
-- SELECT * FROM saved_blocks WHERE trainer_id = 'trainer-uuid' AND block_type = 'circuit';

-- Get performance history for a specific block:
-- SELECT * FROM block_performances WHERE block_id = 'block-uuid' ORDER BY performed_at DESC;

-- Get all performances for a client:
-- SELECT * FROM block_performances WHERE client_id = 'client-uuid' ORDER BY performed_at DESC;
