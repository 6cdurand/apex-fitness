-- 20260526_saved_programs_rls_canonical.sql
-- Sprint: v14 dispatch 32
-- Source: briefs/sprint-v14-2026-05-18/v14-fix-32-brief.md
-- Goal: heal saved_programs RLS for trainers whose auth.users.id ≠ public.users.id.
--       The original policy `auth.uid() = trainer_id` only succeeds when those two ids
--       align. Per @authStore.ts:71-87 ("the 40 users persisted with a stale
--       user.id = auth.users.id before the canonical-resolve code shipped"), there is
--       a known cohort where they don't, and every saved_programs upsert from those
--       accounts has been silently 403-ing for weeks. The new policy resolves
--       auth.uid() → canonical public.users.id via email match before comparing,
--       so both aligned and stale accounts succeed.

BEGIN;

-- Helper function: resolve auth.uid() → canonical public.users.id by email match.
-- Returns auth.uid() unchanged if the user already has aligned ids (the common case),
-- otherwise returns the public.users.id whose email matches the authenticated user's
-- email in auth.users. STABLE so Postgres can cache the result per query.
CREATE OR REPLACE FUNCTION public.canonical_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pu.id
  FROM public.users pu
  WHERE pu.id = auth.uid()
  UNION ALL
  SELECT pu.id
  FROM public.users pu
  JOIN auth.users au ON lower(au.email) = lower(pu.email)
  WHERE au.id = auth.uid()
    AND pu.id <> auth.uid()
  LIMIT 1
$$;

COMMENT ON FUNCTION public.canonical_user_id() IS
  'Resolves the authenticated user to their canonical public.users.id. Returns auth.uid() directly when ids are aligned, otherwise falls back to email match against auth.users. Used by RLS policies on tables whose trainer_id/user_id FK references public.users(id).';

-- Replace strict equality with canonical resolution.
DROP POLICY IF EXISTS "trainer_owns_saved_programs" ON public.saved_programs;
CREATE POLICY "trainer_owns_saved_programs" ON public.saved_programs
  FOR ALL
  USING (trainer_id = public.canonical_user_id())
  WITH CHECK (trainer_id = public.canonical_user_id());

COMMIT;

-- POST-APPLY VERIFICATION:
--   1. Function exists:
--        SELECT proname FROM pg_proc WHERE proname = 'canonical_user_id';
--      Expectation: 1 row.
--
--   2. Policy uses the helper:
--        SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
--          FROM pg_policy
--         WHERE polrelid = 'public.saved_programs'::regclass;
--      Expectation: using_expr references `canonical_user_id()`.
--
--   3. The real RLS smoke test must run as an authenticated trainer session,
--      NOT in the Supabase SQL Editor. SQL Editor runs as the `postgres`
--      role which (a) has no JWT so `auth.uid()` returns NULL and
--      `canonical_user_id()` returns NULL → NOT NULL violation on
--      `trainer_id`, and (b) bypasses RLS entirely so a successful insert
--      wouldn't prove RLS works anyway. Do the smoke test from the app:
--      sign in as the affected trainer, build a program, hit Save, then run:
--        SELECT id, name, trainer_id FROM public.saved_programs
--         WHERE name = '<your test program name>';
--      Expectation: 1 row, with `trainer_id` equal to that trainer's
--      `public.users.id`.
