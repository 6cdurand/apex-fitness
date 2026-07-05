-- ============================================================================
-- group7 — identity forward-fix: ensure_self_identity() RPC
-- ============================================================================
--
-- ⚠️  FLAGGED FOR MANUAL APPLICATION BY CHRISTO — NOT AUTO-APPLIED.
--     Run in Supabase SQL editor: PRE-CHECK → apply → POST-CHECK.
--     The app code (PR group7) calls this RPC right after authentication, but
--     it FAILS OPEN (RPC error → falls back to auth.uid() locally) so deploying
--     the app before this lands does not break signups — it just doesn't yet
--     adopt placeholders / enforce the invariant server-side.
--
-- WHAT IT DOES
--   Makes the CALLER's public.users row aligned so public.users.id = auth.uid()
--   (the JWT `sub`). It is the SINGLE creation path for a signed-up user's
--   identity row:
--     1. already aligned (id = auth.uid())  -> no-op, returns auth.uid().
--     2. a row exists for the caller's email -> ADOPT it: re-key that row (and
--        all child references) from its old id onto auth.uid() via the existing
--        prod function public.reconcile_user_identity(old, new, dry_run). This
--        is how a trainer-created bulk-import placeholder (auth_user_id IS NULL)
--        carries its pre-assigned programs/notes onto the new auth identity.
--     3. otherwise -> INSERT a fresh aligned row.
--   Idempotent. SECURITY DEFINER so it can read/adopt rows the caller's RLS
--   would otherwise hide (diverged accounts cannot see their own row).
--
-- DEPENDENCY (already in prod — do NOT recreate here):
--   public.reconcile_user_identity(p_old_id uuid, p_new_id uuid, p_dry_run boolean)
--   Guards: old must exist, new must NOT already exist in public.users, new must
--   exist in auth.users.
--
-- ----------------------------------------------------------------------------
-- PRE-CHECK (expect diverged = 0 before AND after):
--   SELECT count(*) FROM public.users
--   WHERE auth_user_id IS NOT NULL AND auth_user_id <> id;
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_self_identity(p_email text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ensure_self_identity: no auth context';
  END IF;

  -- already aligned -> nothing to do
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid) THEN
    RETURN v_uid;
  END IF;

  v_email := lower(coalesce(p_email, (auth.jwt() ->> 'email')));

  -- adopt a pre-existing row by email (bulk-import placeholder or legacy row)
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.users
    WHERE lower(email) = v_email
    ORDER BY (auth_user_id IS NULL) DESC   -- prefer an unclaimed placeholder
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    PERFORM public.reconcile_user_identity(v_existing, v_uid, false);  -- re-key onto auth id
    RETURN v_uid;
  END IF;

  -- brand-new user -> create an aligned row
  INSERT INTO public.users (id, auth_user_id, email, account_status)
  VALUES (v_uid, v_uid, v_email, 'active')
  ON CONFLICT (id) DO NOTHING;

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_self_identity(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_self_identity(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- POST-CHECK (must still be 0):
--   SELECT count(*) FROM public.users
--   WHERE auth_user_id IS NOT NULL AND auth_user_id <> id;
-- ----------------------------------------------------------------------------
