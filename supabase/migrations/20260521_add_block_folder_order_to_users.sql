-- 20260521_add_block_folder_order_to_users.sql
-- Sprint: v14 dispatch 11
-- Source: briefs/sprint-v14-2026-05-18/v14-fix-11-brief.md
-- Goal: per-trainer ordering for block-library folder chips.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS block_folder_order TEXT[] NULL;

COMMENT ON COLUMN public.users.block_folder_order IS
  'v14-D11: ordered array of block-library folder names for this trainer. NULL or empty = use lexical default. Folder names that exist on saved_blocks but not in this array sort lexically AFTER ordered ones.';

COMMIT;

-- POST-APPLY VERIFICATION:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='users' AND column_name='block_folder_order';
--   -- Expectation: data_type='ARRAY', is_nullable='YES'.
