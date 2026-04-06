-- Migration: Add calendar event scoping to separate trainer personal events from client-assigned workouts
-- Also add program_id linkage for cascade delete support

-- Add program_id to link calendar events to client programs
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS program_id text;

-- Add owner/scope fields for calendar event visibility
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_scope text DEFAULT 'shared_session'
  CHECK (event_scope IN ('trainer_personal', 'client_assigned', 'shared_session'));

-- Backfill owner_user_id from existing data:
-- If trainer_id is set and client_id is NULL, it's a trainer personal event
-- If client_id is set, the client owns it
UPDATE calendar_events
SET owner_user_id = CASE
    WHEN client_id IS NOT NULL THEN client_id::uuid
    WHEN trainer_id IS NOT NULL THEN trainer_id::uuid
    ELSE NULL
  END
WHERE owner_user_id IS NULL;

-- Backfill event_scope:
-- type = 'workout' with client_id => client_assigned
-- type = 'pt' or type = 'session' => shared_session
-- no client_id => trainer_personal
UPDATE calendar_events
SET event_scope = CASE
    WHEN type = 'workout' AND client_id IS NOT NULL THEN 'client_assigned'
    WHEN client_id IS NULL THEN 'trainer_personal'
    ELSE 'shared_session'
  END
WHERE event_scope = 'shared_session' OR event_scope IS NULL;

-- Index for efficient calendar queries by owner
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON calendar_events(owner_user_id, event_scope);

-- Index for cascade delete lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_program ON calendar_events(program_id);
