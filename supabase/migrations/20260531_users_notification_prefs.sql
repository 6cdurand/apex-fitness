-- Sprint v18 dispatch 01 (2026-05-31)
-- v18-D1: add per-user notification delivery preferences column.
--
-- Stores the Settings → Notifications toggles (`Email`, `Push`) so they
-- persist across reloads, sessions, and devices. Defaults are ON for both.
--
-- This migration only stores the PREFERENCE. Actual delivery gating —
-- email send paths, push fan-out — must consult `notification_prefs` in a
-- separate change; see v18 backlog (delivery wiring is out of scope here).
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS + idempotent COMMENT.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{"email": true, "push": true}'::jsonb;

COMMENT ON COLUMN users.notification_prefs IS
  'v18-D1: per-user notification delivery preferences. Keys: email (bool), push (bool). Defaults true. Delivery wiring is separate — this only stores the preference.';
