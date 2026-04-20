-- ============================================================
-- APEX FITNESS — Identity Hardening ROLLBACK
-- Reverts the identity-v2 cutover if the release needs to be rolled back.
-- Safe to run after re-deploying the previous app bundle.
--
-- What this does:
--   1. Restores permissive RLS policies on the tables the old app relied on,
--      so the old code path (custom auth → public.users only) works again.
--   2. Leaves additive schema changes in place (they are non-breaking for
--      the old code path): new columns, CHECK constraints, NOT VALID FKs,
--      the on_auth_user_created trigger, the claim_invitation RPC, the
--      integrity views / alerts / functions.
--   3. auth.users rows remain but are unused by the old app. No data loss.
--
-- What it does NOT do:
--   * Drop password_hash (it was never removed in the cutover).
--   * Drop auth.users rows (keep them; benign).
--   * Undo UUID type conversions (values are already UUID-shaped; the old
--     code worked off TEXT but accepts UUID too since psql treats them as
--     compatible in SELECT/WHERE clauses).
-- ============================================================

-- ------------------------------------------------------------------
-- Restore permissive policies for the custom-auth code path.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=p_table LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, p_table);
  END LOOP;
END;
$$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','trainer_clients','client_programs','calendar_events','trainer_sessions',
    'session_packages','client_payments','booking_requests','session_workouts',
    'client_programming_profiles','workout_library','circuit_library','saved_blocks',
    'custom_exercises','block_performances','workouts','personal_bests','medals',
    'strength_ratings','client_exercise_history','exercise_notes','personal_bests_history',
    'program_receipts','client_invitations','friendships','conversations','messages',
    'notifications','identity_events'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      PERFORM public._drop_all_policies(tbl);
      EXECUTE format('CREATE POLICY %I_rollback_permissive ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    END IF;
  END LOOP;
END$$;

DROP FUNCTION IF EXISTS public._drop_all_policies(text);

-- ------------------------------------------------------------------
-- Keep the auth trigger in place — it's harmless if the old app
-- isn't using Supabase Auth. If you explicitly want to disable it:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- ------------------------------------------------------------------

-- Status note: run this script, then re-deploy the pre-cutover build.
-- The app falls back to the custom-auth login path; all existing users
-- continue to work. auth.users rows are ignored by the old code.
