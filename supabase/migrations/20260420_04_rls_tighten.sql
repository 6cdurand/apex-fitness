-- ============================================================
-- APEX FITNESS — Identity Hardening 04: RLS tighten
-- Plan: identity-lifecycle-hardening-e9f293.md §2d + §5
-- Replaces permissive USING(true) policies with least-privilege
-- auth.uid()-keyed policies. Assumes 01/02 have run and that
-- Supabase Auth is now the canonical identity source (auth.users.id
-- == public.users.id for every real user).
-- Service role bypasses RLS, so backfill + reconciliation still work.
-- ============================================================

-- ---------------------------------------------------------------
-- Helper: drop every policy on a table so we can re-create cleanly.
-- Safer than tracking individual policy names that may differ
-- between environments.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename=p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, p_table);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------
-- users
-- ---------------------------------------------------------------
SELECT public._drop_all_policies('users');

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_read_self ON public.users
  FOR SELECT USING (id = auth.uid());

-- Trainers can read their clients.
CREATE POLICY users_read_trainers_clients ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trainer_clients tc
      WHERE tc.trainer_id = auth.uid() AND tc.client_id = users.id
    )
  );

-- Clients can read their trainer.
CREATE POLICY users_read_own_trainer ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trainer_clients tc
      WHERE tc.client_id = auth.uid() AND tc.trainer_id = users.id
    )
  );

CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY users_insert_self ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------
-- trainer_clients
-- ---------------------------------------------------------------
SELECT public._drop_all_policies('trainer_clients');
ALTER TABLE public.trainer_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY trainer_clients_trainer_full ON public.trainer_clients
  FOR ALL USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

CREATE POLICY trainer_clients_client_read ON public.trainer_clients
  FOR SELECT USING (client_id = auth.uid());

-- ---------------------------------------------------------------
-- Trainer-owned, client-readable tables
-- ---------------------------------------------------------------
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_programs','calendar_events','trainer_sessions','session_packages',
    'client_payments','booking_requests','session_workouts','client_programming_profiles'
  ]
  LOOP
    PERFORM public._drop_all_policies(tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I_trainer_full ON public.%I FOR ALL USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_client_read ON public.%I FOR SELECT USING (client_id = auth.uid())',
      tbl, tbl
    );
  END LOOP;
END$$;

-- ---------------------------------------------------------------
-- Trainer-private libraries
-- ---------------------------------------------------------------
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'workout_library','circuit_library','saved_blocks','custom_exercises','block_performances'
  ]
  LOOP
    PERFORM public._drop_all_policies(tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I_trainer_full ON public.%I FOR ALL USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid())',
      tbl, tbl
    );
  END LOOP;
END$$;

-- block_performances: client can also read their own rows.
CREATE POLICY block_performances_client_read ON public.block_performances
  FOR SELECT USING (client_id = auth.uid());

-- ---------------------------------------------------------------
-- User-owned progress tables (self + assigned trainer can read)
-- ---------------------------------------------------------------
SELECT public._drop_all_policies('workouts');
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY workouts_self_full ON public.workouts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY workouts_assigned_trainer_read ON public.workouts
  FOR SELECT USING (
    assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trainer_clients tc
      WHERE tc.trainer_id = auth.uid() AND tc.client_id = workouts.user_id
    )
  );

CREATE POLICY workouts_trainer_insert ON public.workouts
  FOR INSERT WITH CHECK (
    assigned_by = auth.uid()
    OR user_id = auth.uid()
  );

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'personal_bests','medals','strength_ratings','client_exercise_history',
    'exercise_notes','personal_bests_history'
  ]
  LOOP
    PERFORM public._drop_all_policies(tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I_self_full ON public.%I FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      tbl, tbl
    );
    EXECUTE format(
      $q$CREATE POLICY %I_trainer_read ON public.%I FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.trainer_clients tc WHERE tc.trainer_id = auth.uid() AND tc.client_id = %I.user_id)
      )$q$,
      tbl, tbl, tbl
    );
  END LOOP;
END$$;

-- ---------------------------------------------------------------
-- program_receipts: client inserts their own receipt; trainer reads for their programs.
-- ---------------------------------------------------------------
SELECT public._drop_all_policies('program_receipts');
ALTER TABLE public.program_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_receipts_client_write ON public.program_receipts
  FOR ALL USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

CREATE POLICY program_receipts_trainer_read ON public.program_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_programs cp
      WHERE cp.id = program_receipts.program_id AND cp.trainer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------
-- client_invitations — service-role only path for writes.
-- Authenticated users may read their own pending invitation by token
-- via the /claim server route, not via client-side SQL.
-- ---------------------------------------------------------------
SELECT public._drop_all_policies('client_invitations');
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_invitations_trainer_manage ON public.client_invitations
  FOR ALL USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

-- No anon/authenticated SELECT on other trainers' invitations.

-- ---------------------------------------------------------------
-- social tables (friendships / conversations / messages)
-- Only lock down if they exist in this environment.
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='friendships') THEN
    PERFORM public._drop_all_policies('friendships');
    ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
    CREATE POLICY friendships_participants ON public.friendships
      FOR ALL USING (follower_id = auth.uid() OR following_id = auth.uid())
      WITH CHECK (follower_id = auth.uid());
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations') THEN
    PERFORM public._drop_all_policies('conversations');
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY conversations_participants ON public.conversations
      FOR ALL USING (participant_1 = auth.uid() OR participant_2 = auth.uid());
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages') THEN
    PERFORM public._drop_all_policies('messages');
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY messages_participants ON public.messages
      FOR ALL USING (sender_id = auth.uid() OR receiver_id = auth.uid())
      WITH CHECK (sender_id = auth.uid());
  END IF;
END$$;

-- ---------------------------------------------------------------
-- notifications — self-read; trainer can insert for own client.
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    PERFORM public._drop_all_policies('notifications');
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    CREATE POLICY notifications_self_rw ON public.notifications
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY notifications_trainer_insert ON public.notifications
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.trainer_clients tc
          WHERE tc.trainer_id = auth.uid() AND tc.client_id = notifications.user_id
        )
      );
  END IF;
END$$;

-- ---------------------------------------------------------------
-- identity_events: service role only from here on.
-- ---------------------------------------------------------------
SELECT public._drop_all_policies('identity_events');
ALTER TABLE public.identity_events ENABLE ROW LEVEL SECURITY;
-- No policy => default deny for anon/authenticated; service role bypasses RLS.

-- ---------------------------------------------------------------
-- Cleanup helper.
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public._drop_all_policies(text);
