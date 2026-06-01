-- 20260601_rls_hardening_phase1a_self_owned.sql
-- Sprint: v19 fix 04 — RLS hardening, phase 1A (PARTIAL apply, Christo's call)
-- Source brief: catalift-command-center/briefs/sprint-v19-2026-06-01/
--               v19-fix-04-rls-hardening-phase1.md
--
-- This is the "apply minus client_invitations" subset of
-- 20260601_rls_hardening_phase1_canonical.sql. It hardens the SELF-OWNED
-- tables only. client_invitations + the get_invitation_by_token /
-- accept_invitation RPCs are DEFERRED to the full migration until the
-- claim/accept RPC flow is verified.
--
-- 2026-06-01 PROD-SCHEMA CORRECTION (live prod diverged from repo schema):
--   * notifications.user_id and health_data.user_id are UUID (NOT text) ->
--     compare uuid = uuid, NO ::text cast.
--   * user_integrations and followers DO NOT EXIST in prod public schema.
--     - user_integrations: migration 003_integrations_tables.sql never applied.
--     - the follows table is public.user_follows, whose writes are ALREADY
--       scoped (auth.uid() = follower_id) and whose read is open. Left
--       untouched here; canonical-izing its writes is a phase-2 item.
--   * Existing permissive policies (exact prod names) being replaced:
--       notifications -> "notifications_rollback_permissive" (FOR ALL true)
--       health_data   -> "permissive_all_health_data"        (FOR ALL true)
--
-- ⚠️ LOCKOUT NOTE: the 14 users backfilled in Stage A on 2026-06-01 have an
--    auth.users row but no auth SESSION until they set a password via their
--    recovery link. Until then canonical_user_id() is NULL for them and these
--    scoped policies will DENY their notifications / health_data reads+writes
--    (data is NOT deleted; sync resumes once they log in). Applied with
--    rollback ready, per Christo. Rollback block is at the bottom.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

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

-- notifications (user_id UUID). Replace the single FOR ALL permissive policy.
-- INSERT stays open so trainers can create notifications FOR clients;
-- SELECT/UPDATE/DELETE are owner-scoped (uuid = uuid, no cast).
DROP POLICY IF EXISTS "notifications_rollback_permissive" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (user_id = public.canonical_user_id());
CREATE POLICY "notif_insert_any" ON public.notifications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (user_id = public.canonical_user_id())
            WITH CHECK (user_id = public.canonical_user_id());
CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE USING (user_id = public.canonical_user_id());

-- health_data (user_id UUID). Replace the single FOR ALL permissive policy.
DROP POLICY IF EXISTS "permissive_all_health_data" ON public.health_data;

CREATE POLICY "hd_select_own" ON public.health_data
  FOR SELECT USING (user_id = public.canonical_user_id());
CREATE POLICY "hd_insert_own" ON public.health_data
  FOR INSERT WITH CHECK (user_id = public.canonical_user_id());
CREATE POLICY "hd_update_own" ON public.health_data
  FOR UPDATE USING (user_id = public.canonical_user_id())
            WITH CHECK (user_id = public.canonical_user_id());
CREATE POLICY "hd_delete_own" ON public.health_data
  FOR DELETE USING (user_id = public.canonical_user_id());

-- user_follows: LEFT UNTOUCHED. Writes already scoped (auth.uid()=follower_id),
-- read open (follower counts). Canonical-izing its writes is a phase-2 item.
-- user_integrations: NOT PRESENT in prod — out of scope.

COMMIT;

-- ===========================================================================
-- ROLLBACK (phase 1A) — re-creates the permissive policies. Run if a bad flip
-- locks users out.
-- ===========================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
--   DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
--   DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
--   DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
--   CREATE POLICY "notifications_rollback_permissive" ON public.notifications
--     FOR ALL USING (true) WITH CHECK (true);
--
--   DROP POLICY IF EXISTS "hd_select_own" ON public.health_data;
--   DROP POLICY IF EXISTS "hd_insert_own" ON public.health_data;
--   DROP POLICY IF EXISTS "hd_update_own" ON public.health_data;
--   DROP POLICY IF EXISTS "hd_delete_own" ON public.health_data;
--   CREATE POLICY "permissive_all_health_data" ON public.health_data
--     FOR ALL USING (true);
-- COMMIT;
