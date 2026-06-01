-- 20260601_rls_hardening_phase1b_client_invitations.sql
-- Sprint: v19 fix 04 — RLS hardening, phase 1B (AUTHORED, *** NOT APPLIED ***)
-- Source brief: catalift-command-center/briefs/sprint-v19-2026-06-01/
--               v19-fix-04-rls-hardening-phase1.md  (BUG-N12, top priority)
--
-- This completes phase 1: it hardens client_invitations (the highest-risk
-- USING(true) table — invite tokens + client emails are currently world-
-- readable with the public anon key) and adds the two SECURITY DEFINER RPCs
-- the claim flow needs once the open table read is removed.
--
-- ⚠️ DO NOT APPLY until:
--   (a) the phase-1A users have verified logins (lockout posture), AND
--   (b) you have run the VERIFICATION QUERIES below against LIVE PROD and
--       confirmed the actual policy names + trainer_id type. Live prod has
--       diverged from the repo schema files (phase-1A hit a uuid/text
--       mismatch), so we DO NOT trust the repo's policy name
--       ("Allow all client invitations") blindly — the DROP below is
--       name-agnostic (drops EVERY existing policy on the table) to avoid
--       leaving a permissive policy in place (RLS combines permissive
--       policies with OR, which would silently negate the hardening).
--
-- VERIFICATION QUERIES (run read-only first; paste output before applying):
--   -- existing policies on the table:
--   SELECT polname, polcmd,
--          pg_get_expr(polqual, polrelid)      AS using_expr,
--          pg_get_expr(polwithcheck, polrelid) AS check_expr
--     FROM pg_policy WHERE polrelid = 'public.client_invitations'::regclass;
--   -- trainer_id column type (expect uuid -> no cast needed):
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='client_invitations'
--      AND column_name IN ('trainer_id','client_id','email','invite_token','expires_at');
--   -- confirm the table exists:
--   SELECT to_regclass('public.client_invitations');
--
-- APP FLOW (verified 2026-06-01, src/app/invite/page.tsx + src/app/auth/page.tsx):
--   * checkInvitationByToken runs UNAUTHENTICATED (token verify + setup-password
--     gate) -> uses get_invitation_by_token (granted anon). Already re-pointed in
--     src/lib/supabaseSync.ts (RPC-first, legacy fallback).
--   * acceptInvitation only runs AFTER login/register (handleAcceptInvite,
--     handleSetupPassword, handleLogin) -> auth session exists -> accept_invitation
--     uses canonical_user_id() for client_id (== the app user.id the legacy path
--     set; no behavior change, but not spoofable to another user).
--   * sendClientInvitation / getPendingInvitations run as the authenticated
--     trainer -> covered by trainer_id = canonical_user_id().
--
-- DEPLOY ORDER: the app re-point in supabaseSync.ts has a legacy fallback, so
-- it is safe to ship before OR after this migration. Recommended: apply this
-- migration, confirm the RPCs resolve, then the fallback simply stops being
-- used.

BEGIN;

-- canonical_user_id() — re-assert (idempotent; unchanged from v14-D32).
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

-- Drop EVERY existing policy on client_invitations (name-agnostic) so no
-- stray permissive policy survives to OR-open the table.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
     WHERE polrelid = 'public.client_invitations'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.client_invitations', pol.polname);
  END LOOP;
END $$;

-- Trainers see/modify ONLY their own invitations. trainer_id is a uuid FK to
-- public.users(id), so compare uuid = uuid (no cast). VERIFY type before apply.
CREATE POLICY "ci_trainer_select_own" ON public.client_invitations
  FOR SELECT USING (trainer_id = public.canonical_user_id());
CREATE POLICY "ci_trainer_insert_own" ON public.client_invitations
  FOR INSERT WITH CHECK (trainer_id = public.canonical_user_id());
CREATE POLICY "ci_trainer_update_own" ON public.client_invitations
  FOR UPDATE USING (trainer_id = public.canonical_user_id())
            WITH CHECK (trainer_id = public.canonical_user_id());
CREATE POLICY "ci_trainer_delete_own" ON public.client_invitations
  FOR DELETE USING (trainer_id = public.canonical_user_id());

-- RPC: single-row read by token for the UNAUTHENTICATED claim screen. Returns
-- only the matching row's non-sensitive fields; no enumeration possible.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  trainer_id uuid,
  client_id  uuid,
  email      text,
  status     text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ci.trainer_id, ci.client_id, ci.email, ci.status, ci.expires_at
  FROM public.client_invitations ci
  WHERE ci.invite_token = p_token
  LIMIT 1
$$;

-- RPC: the invited (authenticated) user accepts. client_id is set from
-- canonical_user_id() server-side, so a caller cannot accept on behalf of
-- another user (no spoofable id arg). Mirrors the legacy update otherwise.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.canonical_user_id();
  v_rows int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false; -- must be authenticated to accept
  END IF;
  UPDATE public.client_invitations
     SET status = 'accepted',
         accepted_at = NOW(),
         client_id = v_uid
   WHERE invite_token = p_token
     AND expires_at > NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text)       TO authenticated;

COMMIT;

-- ===========================================================================
-- POST-APPLY VERIFICATION (from an AUTHENTICATED app session, not SQL Editor):
--   - trainer sees only their own invitations (getPendingInvitations)
--   - anon /invite?token=... resolves via get_invitation_by_token()
--   - invited user logs in/sets password -> accept_invitation() -> status 'accepted'
--   - a non-owner CANNOT read another trainer's invitations by direct select
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('get_invitation_by_token','accept_invitation');
--
-- MENTAL DRY-RUN (4 cases):
--   aligned trainer   -> canonical = auth.uid() -> sees/sends own invites ✅
--   diverged trainer  -> email fallback resolves public.users.id ✅
--   backfilled user   -> ✅ once they have a session; denied while sessionless
--   anon token-claim  -> table SELECT denied; get_invitation_by_token returns
--                        the one row ✅; accept_invitation returns false (no
--                        session) until they authenticate ✅
--
-- ===========================================================================
-- ROLLBACK (phase 1B) — restore a single permissive policy + (optionally) drop
-- the RPCs. Run if a bad flip blocks trainers/claims.
-- ===========================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS "ci_trainer_select_own" ON public.client_invitations;
--   DROP POLICY IF EXISTS "ci_trainer_insert_own" ON public.client_invitations;
--   DROP POLICY IF EXISTS "ci_trainer_update_own" ON public.client_invitations;
--   DROP POLICY IF EXISTS "ci_trainer_delete_own" ON public.client_invitations;
--   CREATE POLICY "Allow all client invitations" ON public.client_invitations
--     FOR ALL USING (true) WITH CHECK (true);
--   -- The RPCs are additive/safe to keep; drop only if reverting fully:
--   -- DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);
--   -- DROP FUNCTION IF EXISTS public.accept_invitation(text);
-- COMMIT;
