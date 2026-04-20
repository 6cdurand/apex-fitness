-- Migration: Add folder column to saved_blocks for block library organisation
-- Date: 2026-04-20
-- Description: Enables grouping saved blocks into named folders (e.g. "Foundation")
--              without replacing the existing block type categorisation.
--              Folder is a free-text label derived from SavedBlock.folder in code.

ALTER TABLE saved_blocks
  ADD COLUMN IF NOT EXISTS folder TEXT;

-- Composite index for fast "blocks in this folder for this trainer" queries.
CREATE INDEX IF NOT EXISTS idx_saved_blocks_trainer_folder
  ON saved_blocks(trainer_id, folder);
