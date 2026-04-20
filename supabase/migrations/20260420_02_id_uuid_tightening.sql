-- ============================================================
-- APEX FITNESS — Identity Hardening 02: UUID tightening + FKs
-- Plan: identity-lifecycle-hardening-e9f293.md §2b
-- Additive only. Uses NOT VALID for FK so pre-existing orphans don't
-- block the migration — they surface in migration 03's integrity view.
-- ============================================================

-- ---------------------------------------------------------------
-- Helper: cast TEXT id columns to UUID where values are already
-- UUID-shaped. If a bad value exists, the ALTER aborts and the row
-- must be cleaned manually. We run each ALTER in its own DO block
-- so failures are surfaced per-table.
-- ---------------------------------------------------------------

-- session_workouts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='session_workouts' AND column_name='id' AND data_type='text'
  ) THEN
    ALTER TABLE public.session_workouts ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='session_workouts' AND column_name='trainer_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.session_workouts ALTER COLUMN trainer_id TYPE uuid USING trainer_id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='session_workouts' AND column_name='client_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.session_workouts ALTER COLUMN client_id TYPE uuid USING NULLIF(client_id,'')::uuid;
  END IF;
END$$;

-- workout_library
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='workout_library' AND column_name='id' AND data_type='text'
  ) THEN
    ALTER TABLE public.workout_library ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='workout_library' AND column_name='trainer_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.workout_library ALTER COLUMN trainer_id TYPE uuid USING trainer_id::uuid;
  END IF;
END$$;

-- circuit_library
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='circuit_library' AND column_name='id' AND data_type='text'
  ) THEN
    ALTER TABLE public.circuit_library ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='circuit_library' AND column_name='trainer_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.circuit_library ALTER COLUMN trainer_id TYPE uuid USING trainer_id::uuid;
  END IF;
END$$;

-- saved_blocks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='saved_blocks' AND column_name='id' AND data_type='text'
  ) THEN
    ALTER TABLE public.saved_blocks ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='saved_blocks' AND column_name='trainer_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.saved_blocks ALTER COLUMN trainer_id TYPE uuid USING trainer_id::uuid;
  END IF;
END$$;

-- block_performances
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='block_performances' AND column_name='id' AND data_type='text'
  ) THEN
    ALTER TABLE public.block_performances ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='block_performances' AND column_name='trainer_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.block_performances ALTER COLUMN trainer_id TYPE uuid USING trainer_id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='block_performances' AND column_name='client_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.block_performances ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='block_performances' AND column_name='block_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.block_performances ALTER COLUMN block_id TYPE uuid USING block_id::uuid;
  END IF;
END$$;

-- custom_exercises
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='custom_exercises' AND column_name='id' AND data_type='text'
  ) THEN
    ALTER TABLE public.custom_exercises ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='custom_exercises' AND column_name='trainer_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.custom_exercises ALTER COLUMN trainer_id TYPE uuid USING trainer_id::uuid;
  END IF;
END$$;

-- program_receipts (created in 20260419 migration with text columns)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='program_receipts' AND column_name='program_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.program_receipts ALTER COLUMN program_id TYPE uuid USING program_id::uuid;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='program_receipts' AND column_name='client_id' AND data_type='text'
  ) THEN
    ALTER TABLE public.program_receipts ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
  END IF;
END$$;

-- trainer_clients / trainer_sessions / session_packages / calendar_events / client_payments /
-- client_programs / booking_requests all use text client_id. Convert to uuid.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'trainer_clients','trainer_sessions','session_packages','calendar_events',
    'client_payments','client_programs','booking_requests','client_programming_profiles'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=tbl AND column_name='client_id' AND data_type='text'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN client_id TYPE uuid USING NULLIF(client_id,'''')::uuid',
        tbl
      );
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------
-- Foreign keys — NOT VALID so pre-existing orphans don't block.
-- Migration 03 surfaces orphans; service-role cleanup runs after.
-- ---------------------------------------------------------------
DO $$
BEGIN
  -- session_workouts.trainer_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_workouts_trainer_id_fkey_v2'
  ) THEN
    ALTER TABLE public.session_workouts
      ADD CONSTRAINT session_workouts_trainer_id_fkey_v2
      FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_workouts_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.session_workouts
      ADD CONSTRAINT session_workouts_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
  END IF;

  -- workout_library.trainer_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_library_trainer_id_fkey_v2'
  ) THEN
    ALTER TABLE public.workout_library
      ADD CONSTRAINT workout_library_trainer_id_fkey_v2
      FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  -- circuit_library.trainer_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'circuit_library_trainer_id_fkey_v2'
  ) THEN
    ALTER TABLE public.circuit_library
      ADD CONSTRAINT circuit_library_trainer_id_fkey_v2
      FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  -- saved_blocks.trainer_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_blocks_trainer_id_fkey_v2'
  ) THEN
    ALTER TABLE public.saved_blocks
      ADD CONSTRAINT saved_blocks_trainer_id_fkey_v2
      FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  -- block_performances.trainer_id / client_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'block_performances_trainer_id_fkey_v2'
  ) THEN
    ALTER TABLE public.block_performances
      ADD CONSTRAINT block_performances_trainer_id_fkey_v2
      FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'block_performances_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.block_performances
      ADD CONSTRAINT block_performances_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  -- custom_exercises.trainer_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'custom_exercises_trainer_id_fkey_v2'
  ) THEN
    ALTER TABLE public.custom_exercises
      ADD CONSTRAINT custom_exercises_trainer_id_fkey_v2
      FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  -- program_receipts
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_receipts_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.program_receipts
      ADD CONSTRAINT program_receipts_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_receipts_program_id_fkey_v2'
  ) THEN
    ALTER TABLE public.program_receipts
      ADD CONSTRAINT program_receipts_program_id_fkey_v2
      FOREIGN KEY (program_id) REFERENCES public.client_programs(id) ON DELETE CASCADE NOT VALID;
  END IF;

  -- client_id FKs on trainer_* tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trainer_clients_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.trainer_clients
      ADD CONSTRAINT trainer_clients_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trainer_sessions_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.trainer_sessions
      ADD CONSTRAINT trainer_sessions_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_packages_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.session_packages
      ADD CONSTRAINT session_packages_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_payments_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.client_payments
      ADD CONSTRAINT client_payments_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_programs_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.client_programs
      ADD CONSTRAINT client_programs_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_client_id_fkey_v2'
  ) THEN
    ALTER TABLE public.booking_requests
      ADD CONSTRAINT booking_requests_client_id_fkey_v2
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END$$;

-- ---------------------------------------------------------------
-- Unique constraint on outstanding invitations per (trainer,email).
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_invitations_trainer_email_unique'
  ) THEN
    ALTER TABLE public.client_invitations
      ADD CONSTRAINT client_invitations_trainer_email_unique
      UNIQUE (trainer_id, email);
  END IF;
END$$;

-- ---------------------------------------------------------------
-- claim_invitation RPC — atomic + idempotent.
-- Called server-side with service-role key by inviteService.claimInvitation.
-- Returns the canonical user id and trainer id on success.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_invitation(
  p_token text,
  p_auth_user_id uuid  -- the auth.users id of the claimant (may differ from provisional id)
)
RETURNS TABLE(user_id uuid, trainer_id uuid, email text, was_claimed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_provisional_id uuid;
  v_email text;
  v_trainer uuid;
BEGIN
  -- 1. Load + validate invitation
  SELECT * INTO v_invite
  FROM public.client_invitations
  WHERE invite_token = p_token
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired' USING ERRCODE = 'P0002';
  END IF;

  IF v_invite.status NOT IN ('pending','sent','accepted') THEN
    RAISE EXCEPTION 'invite_unusable_status:%', v_invite.status USING ERRCODE = 'P0003';
  END IF;

  v_provisional_id := v_invite.client_id;
  v_email := v_invite.email;
  v_trainer := v_invite.trainer_id;

  -- 2. Idempotent: if already accepted AND auth user matches, return success.
  IF v_invite.status = 'accepted' AND v_invite.client_id = p_auth_user_id THEN
    RETURN QUERY SELECT v_provisional_id, v_trainer, v_email, false;
    RETURN;
  END IF;

  -- 3. If caller's auth id differs from the provisional id, we need to
  --    either (a) adopt the auth id as the new canonical (rewriting all FKs),
  --    or (b) preserve the provisional id (which the backfill script
  --    guarantees by creating auth.users with id=provisional).
  --    We enforce (b) here: assert they match; caller is responsible for
  --    ensuring auth.users.id = provisional_id BEFORE calling this RPC.
  IF p_auth_user_id <> v_provisional_id THEN
    RAISE EXCEPTION 'auth_id_provisional_mismatch: auth=% provisional=%',
      p_auth_user_id, v_provisional_id USING ERRCODE = 'P0004';
  END IF;

  -- 4. Transition public.users row from placeholder → active.
  UPDATE public.users
  SET account_status = 'active',
      claimed_at = COALESCE(claimed_at, now()),
      auth_migration_status = 'migrated',
      updated_at = now()
  WHERE id = v_provisional_id;

  -- 5. Mark invitation as accepted.
  UPDATE public.client_invitations
  SET status = 'accepted',
      accepted_at = COALESCE(accepted_at, now()),
      client_id = v_provisional_id
  WHERE invite_token = p_token;

  -- 6. Telemetry.
  INSERT INTO public.identity_events (event_type, user_id, payload)
  VALUES (
    'invitation_claimed',
    v_provisional_id,
    jsonb_build_object(
      'trainer_id', v_trainer,
      'email', v_email,
      'token_prefix', substring(p_token from 1 for 8)
    )
  );

  RETURN QUERY SELECT v_provisional_id, v_trainer, v_email, true;
END;
$$;

-- Let anon + authenticated execute the RPC — inner logic is guarded by
-- token validation, so this is safe. Service role always allowed.
GRANT EXECUTE ON FUNCTION public.claim_invitation(text, uuid) TO anon, authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.claim_invitation IS
'Atomic + idempotent invitation claim. Caller (inviteService.claimInvitation) must ensure auth.users.id == provisional client id before calling. Raises SQLSTATE P0001..P0004 on failure.';
