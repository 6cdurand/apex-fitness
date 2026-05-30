-- v17-D2: track when a notification has appeared in the panel so the
-- bell-badge can show only the unseen-since-last-open count instead of
-- the lifetime row count.
--
-- Semantic split:
--   notifications.read    BOOLEAN  -- user clicked the row to deep-link
--   notifications.seen_at TIMESTAMP -- user opened the panel after this row was created
--
-- Idempotent: safe to re-run. The partial index speeds up the badge query
-- ("SELECT count(*) WHERE user_id = $1 AND seen_at IS NULL").
--
-- Applied to production via Supabase Dashboard SQL Editor on 2026-05-30
-- ahead of dispatch; this file exists for repo history / fresh-env replay.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN notifications.seen_at IS
  'v17-D2: timestamp when the recipient first opened the notification panel after this row was created. NULL = unseen (counted in badge). NOT NULL = seen (excluded from badge). Distinct from `read` (per-row click-through).';

CREATE INDEX IF NOT EXISTS idx_notifications_user_unseen
  ON notifications (user_id)
  WHERE seen_at IS NULL;
