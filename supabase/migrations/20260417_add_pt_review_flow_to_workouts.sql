-- PT Session Review Flow:
-- For PT sessions the client opens on their device, the trainer reviews the
-- summary first and releases it to the client with an optional coach note.
-- Safe to run multiple times.
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS review_status text;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS coach_note text;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS released_at timestamptz;
