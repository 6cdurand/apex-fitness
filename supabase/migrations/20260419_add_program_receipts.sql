-- Tracks the fact that a given client has seen / received a given program on their device.
-- Used to diagnose cross-device program visibility issues and to power "program delivered"
-- UI in the trainer dashboard. Idempotent insert (one row per program+client).
CREATE TABLE IF NOT EXISTS program_receipts (
  program_id text NOT NULL,
  client_id  text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, client_id)
);

-- Fast lookups by client (for "which programs have I received" queries).
CREATE INDEX IF NOT EXISTS program_receipts_client_idx ON program_receipts (client_id);

-- Fast lookups by program (for "which clients received this program").
CREATE INDEX IF NOT EXISTS program_receipts_program_idx ON program_receipts (program_id);
