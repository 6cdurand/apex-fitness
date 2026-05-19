BEGIN;
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL;
COMMENT ON COLUMN public.notifications.metadata IS
  'v14-D12: optional JSONB blob for type-specific notification detail (e.g., program_edited diff).';
COMMIT;
