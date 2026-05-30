-- 20260530_add_deep_link_path_to_notifications.sql
-- Sprint: v16 dispatch 07 (fix/v16-7-notification-deep-links)
-- Source brief: /Users/christofit7/Desktop/catalift/catalift-command-center/briefs/sprint-v16-2026-05-29/v16-fix-07-notification-deep-links.md
--
-- Goal:
--   Add `deep_link_path` so the in-app notifications page can deep-link a
--   tap to the relevant resource (e.g. workout summary at /workout/{id}).
--   v16-D7 wires this through:
--     - write : syncNotificationToSupabase  (src/lib/supabaseSync.ts)
--     - read  : fetchNotificationsFromSupabase
--     - route : resolveNotificationTarget   (src/lib/notificationResolver.ts)
--                preference order: deepLinkPath > actionUrl > link
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS. Safe to re-run.
-- This migration is recorded for repo history; Christo applied it to
-- Supabase prod on 2026-05-30 ahead of dispatch.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS deep_link_path TEXT NULL;

COMMENT ON COLUMN notifications.deep_link_path IS
  'v16-D7: in-app deep-link path (e.g. /workout/{id}). Frontend reads this on tap and routes via Next.js router. Falls back to action_url / link for legacy rows.';
