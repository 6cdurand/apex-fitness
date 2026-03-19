-- APEX FITNESS — Migration: Account Status (2026-03-19)
-- Distinguishes real user accounts from trainer-created placeholder client files.
-- Placeholder accounts should NOT appear in friend search, community, or be followable.
-- ============================================================

-- 1. Add account_status column to users table
--    'active'      = real account (user registered or accepted invite)
--    'placeholder'  = trainer-created client file (not yet claimed)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';

-- 2. Backfill: mark existing placeholder emails
UPDATE users SET account_status = 'placeholder'
WHERE (email LIKE '%@placeholder.local' OR email LIKE '%@client.apex')
  AND account_status IS DISTINCT FROM 'placeholder';

-- 3. Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
