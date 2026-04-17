-- Add AI summary column to workouts for persistent workout feedback
-- Safe to run multiple times
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ai_summary text;
