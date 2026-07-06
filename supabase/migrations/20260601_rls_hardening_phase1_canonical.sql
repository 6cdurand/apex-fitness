-- 20260601_rls_hardening_phase1_canonical.sql
-- Sprint: v19 fix 04 — Permissive-RLS hardening, phase 1 (backfill-first)
-- Source brief: catalift-command-center/briefs/sprint-v19-2026-06-01/
--               v19-fix-04-rls-hardening-phase1.md
--
-- ⚠️ DO NOT APPLY until v19-fix-04 STAGE A is confirmed AND the backfilled
--    users can log in. Applying this before those users have a real auth
--    session (auth.uid()) will deny them all reads/writes (canonical_user_id()
--    returns NULL for sessionless users). Stage A backfilled 14/15 active
--    orphans on 2026-06-01; the 1 residual (r***@example.com, RFC-2606 test
--    domain) was intentionally skipped and will be denied by these policies
--    until cleaned up — acceptable per Christo.
--
-- Scope (phase 1, highest-risk tables only — NOT all 11):
--   1. client_invitations  (BUG-N12, top priority)
--   2. notifications, user_integrations, health_data, followers
--
-- canonical_user_id() already exists (20260526_saved_programs_rls_canonical.sql):
--   SECURITY DEFINER, resolves auth.uid() -> public.users.id by direct match
--   then email fallback. Returns NULL for sessionless callers. We re-assert it
--   here with CREATE OR REPLACE for idempotency / self-containment.
--
-- IMPORTANT TYPE NOTE: the owner columns on notifications / followers /
-- user_integrations / health_data are TEXT (they store the app's user.id =
-- canonical public.users.id as text), so every comparison casts the uuid
-- result of canonical_user_id() with ::text. client_invitations.trainer_id is
-- a real uuid FK, so no cast there.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. canonical_user_id() — re-assert (idempotent; unchanged from v14-D32).
-- ---------------------------------------------------------------------------
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

-- ===========================================================================
-- 1. client_invitations  (BUG-N12)
-- ===========================================================================
-- The anon claim path reads an invitation BY TOKEN while UNAUTHENTICATED, so
-- we cannot scope SELECT to canonical_user_id(). Instead:
--   - Table policies: trainers see/modify only their own invites.
--   - Anon read-by-token  -> SECURITY DEFINER RPC get_invitation_by_token().
--   - Authenticated accept -> SECURITY DEFINER RPC accept_invitation().
-- This prevents enumeration of tokens/emails via a blanket table SELECT.

DROP POLICY IF EXISTS "Allow all client invitations" ON public.client_invitations;

-- Trainers can read their own invitations.
CREATE POLICY "ci_trainer_select_own" ON public.client_invitations
  FOR SELECT
  USING (trainer_id = public.canonical_user_id());

-- Trainers can create invitations they own.
CREATE POLICY "ci_trainer_insert_own" ON public.client_invitations
  FOR INSERT
  WITH CHECK (trainer_id = public.canonical_user_id());

-- Trainers can update their own invitations (e.g. mark sent/failed).
CREATE POLICY "ci_trainer_update_own" ON public.client_invitations
  FOR UPDATE
  USING (trainer_id = public.canonical_user_id())
  WITH CHECK (trainer_id = public.canonical_user_id());

-- Trainers can delete their own invitations.
CREATE POLICY "ci_trainer_delete_own" ON public.client_invitations
  FOR DELETE
  USING (trainer_id = public.canonical_user_id());

-- RPC: single-row read by token for the UNAUTHENTICATED claim screen.
-- Returns ONLY the matching row's non-sensitive fields; no way to enumerate.
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

-- RPC: the invited user accepts. Uses canonical_user_id() for client_id so a
-- caller cannot accept an invite on behalf of someone else (no spoofable
-- p_user_id arg). auth.uid() is still readable inside SECURITY DEFINER.
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
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- ===========================================================================
-- 2. notifications  (owner col: user_id TEXT)
-- ===========================================================================
-- READ is the leak vector, so SELECT/UPDATE/DELETE are scoped to the owner.
-- INSERT stays permissive ON PURPOSE: trainers create notifications FOR their
-- clients (e.g. program_assigned). Scoping INSERT to the owner would break
-- that cross-user flow. Inserting a notification is not a data-disclosure.
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
-- (INSERT) "Anyone can create notifications" is intentionally LEFT IN PLACE.

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT
  USING (user_id = public.canonical_user_id()::text);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE
  USING (user_id = public.canonical_user_id()::text)
  WITH CHECK (user_id = public.canonical_user_id()::text);

CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE
  USING (user_id = public.canonical_user_id()::text);

-- ===========================================================================
-- 3. user_integrations  (owner col: user_id TEXT) — OAuth tokens, fully self-owned
-- ===========================================================================
DROP POLICY IF EXISTS "Users can view own integrations"   ON public.user_integrations;
DROP POLICY IF EXISTS "Users can insert own integrations" ON public.user_integrations;
DROP POLICY IF EXISTS "Users can update own integrations" ON public.user_integrations;

CREATE POLICY "ui_select_own" ON public.user_integrations
  FOR SELECT
  USING (user_id = public.canonical_user_id()::text);

CREATE POLICY "ui_insert_own" ON public.user_integrations
  FOR INSERT
  WITH CHECK (user_id = public.canonical_user_id()::text);

CREATE POLICY "ui_update_own" ON public.user_integrations
  FOR UPDATE
  USING (user_id = public.canonical_user_id()::text)
  WITH CHECK (user_id = public.canonical_user_id()::text);

-- ===========================================================================
-- 4. health_data  (owner col: user_id TEXT) — fully self-owned
-- ===========================================================================
DROP POLICY IF EXISTS "Users can view own health data"   ON public.health_data;
DROP POLICY IF EXISTS "Users can insert own health data" ON public.health_data;
DROP POLICY IF EXISTS "Users can update own health data" ON public.health_data;

CREATE POLICY "hd_select_own" ON public.health_data
  FOR SELECT
  USING (user_id = public.canonical_user_id()::text);

CREATE POLICY "hd_insert_own" ON public.health_data
  FOR INSERT
  WITH CHECK (user_id = public.canonical_user_id()::text);

CREATE POLICY "hd_update_own" ON public.health_data
  FOR UPDATE
  USING (user_id = public.canonical_user_id()::text)
  WITH CHECK (user_id = public.canonical_user_id()::text);

-- ===========================================================================
-- 5. followers  (owner cols: follower_id TEXT, following_id TEXT)
-- ===========================================================================
-- Writes (follow/unfollow) are locked to the acting user (follower_id = me).
-- SELECT is intentionally LEFT PERMISSIVE for phase 1: the follow graph is
-- low-sensitivity (user ids only, no tokens/emails) and public follower
-- counts depend on broad reads. A stricter read policy is deferred to a
-- phase-2 brief to avoid breaking profile follower counts.
DROP POLICY IF EXISTS "Anyone can manage followers" ON public.followers;

CREATE POLICY "fol_select_all" ON public.followers
  FOR SELECT
  USING (true);

CREATE POLICY "fol_insert_self" ON public.followers
  FOR INSERT
  WITH CHECK (follower_id = public.canonical_user_id()::text);

CREATE POLICY "fol_delete_self" ON public.followers
  FOR DELETE
  USING (follower_id = public.canonical_user_id()::text);

COMMIT;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run from an AUTHENTICATED app session, NOT the SQL
-- Editor — the editor runs as `postgres` with no JWT, so auth.uid() is NULL,
-- canonical_user_id() is NULL, and RLS is bypassed anyway).
--   1. Policies present:
--        SELECT polname, pg_get_expr(polqual, polrelid)
--          FROM pg_policy WHERE polrelid = 'public.client_invitations'::regclass;
--   2. RPCs present + granted:
--        SELECT proname FROM pg_proc
--         WHERE proname IN ('get_invitation_by_token','accept_invitation');
--   3. App smoke tests (signed in):
--        - trainer sees only their own invitations
--        - anon claim screen resolves a token via get_invitation_by_token()
--        - invited user accepts via accept_invitation() -> status 'accepted'
--        - trainer->client program assignment still creates a notification
--        - a user sees only their own notifications
--        - integrations / health_data read+write only own rows
--
-- ===========================================================================
-- ROLLBACK (re-create the permissive policies; run if a bad flip locks users
-- out). Paste this block into the SQL Editor to revert phase 1 fast.
-- ===========================================================================
-- BEGIN;
--   -- client_invitations
--   DROP POLICY IF EXISTS "ci_trainer_select_own"  ON public.client_invitations;
--   DROP POLICY IF EXISTS "ci_trainer_insert_own"  ON public.client_invitations;
--   DROP POLICY IF EXISTS "ci_trainer_update_own"  ON public.client_invitations;
--   DROP POLICY IF EXISTS "ci_trainer_delete_own"  ON public.client_invitations;
--   CREATE POLICY "Allow all client invitations" ON public.client_invitations
--     FOR ALL USING (true) WITH CHECK (true);
--   -- (Optional) the RPCs are additive and safe to leave in place; drop if desired:
--   -- DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);
--   -- DROP FUNCTION IF EXISTS public.accept_invitation(text);
--
--   -- notifications
--   DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
--   DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
--   DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
--   CREATE POLICY "Users read own notifications"   ON public.notifications FOR SELECT USING (true);
--   CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (true);
--   CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid()::text);
--
--   -- user_integrations
--   DROP POLICY IF EXISTS "ui_select_own" ON public.user_integrations;
--   DROP POLICY IF EXISTS "ui_insert_own" ON public.user_integrations;
--   DROP POLICY IF EXISTS "ui_update_own" ON public.user_integrations;
--   CREATE POLICY "Users can view own integrations"   ON public.user_integrations FOR SELECT USING (true);
--   CREATE POLICY "Users can insert own integrations" ON public.user_integrations FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Users can update own integrations" ON public.user_integrations FOR UPDATE USING (true);
--
--   -- health_data
--   DROP POLICY IF EXISTS "hd_select_own" ON public.health_data;
--   DROP POLICY IF EXISTS "hd_insert_own" ON public.health_data;
--   DROP POLICY IF EXISTS "hd_update_own" ON public.health_data;
--   CREATE POLICY "Users can view own health data"   ON public.health_data FOR SELECT USING (true);
--   CREATE POLICY "Users can insert own health data" ON public.health_data FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Users can update own health data" ON public.health_data FOR UPDATE USING (true);
--
--   -- followers
--   DROP POLICY IF EXISTS "fol_select_all"   ON public.followers;
--   DROP POLICY IF EXISTS "fol_insert_self"  ON public.followers;
--   DROP POLICY IF EXISTS "fol_delete_self"  ON public.followers;
--   CREATE POLICY "Anyone can manage followers" ON public.followers FOR ALL USING (true);
-- COMMIT;
