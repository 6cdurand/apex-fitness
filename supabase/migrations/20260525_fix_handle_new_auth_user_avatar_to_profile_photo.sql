-- 20260525_fix_handle_new_auth_user_avatar_to_profile_photo.sql
-- Sprint: v15 dispatch 06
-- Source brief: command-center/briefs/sprint-v15-2026-05-24/v15-fix-06-supabase-auth-password-fix.md
--
-- Goal: fix handle_new_auth_user() so the avatar from OAuth metadata lands
--       in public.users.profile_photo (the actual column) instead of a
--       non-existent avatar_url column. No business logic changes.
--
-- BEFORE APPLYING: paste the output of
--   SELECT pg_get_functiondef('public.handle_new_auth_user'::regproc);
-- into a scratch file so you have a known-good pre-image for rollback.
-- The template below is defensive: it should be safe to apply even if the
-- existing function body differed slightly, because CREATE OR REPLACE
-- FUNCTION is idempotent.
--
-- Apply via: Supabase Dashboard -> SQL Editor -> paste -> Run.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username    TEXT;
  v_display     TEXT;
  v_photo       TEXT;
BEGIN
  -- Username: prefer explicit metadata, fall back to email local-part.
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'preferred_username',
    split_part(NEW.email, '@', 1)
  );

  -- Display name: prefer full_name (Google) or name (other providers),
  -- fall back to username.
  v_display := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    v_username
  );

  -- Profile photo: Google sends `picture`, others send `avatar_url`.
  -- Coalesce both into the renamed `profile_photo` column. NEVER reference
  -- a column called `avatar_url` on public.users — that column does not
  -- exist on this schema (the column is `profile_photo`).
  v_photo := COALESCE(
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.users (
    id,
    email,
    username,
    display_name,
    profile_photo,
    mode,
    account_status,
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    v_username,
    v_display,
    v_photo,
    'user',
    'active',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email         = EXCLUDED.email,
    profile_photo = COALESCE(EXCLUDED.profile_photo, public.users.profile_photo);
    -- Note: username + display_name preserved on conflict so a user editing
    -- their profile and then re-signing in with Google doesn't lose changes.

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth signup on profile-row failure. Log + continue.
  RAISE WARNING 'handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Document deprecation of password_hash so future devs see the warning
-- before re-introducing a legacy code path.
COMMENT ON COLUMN public.users.password_hash IS
  'DEPRECATED 2026-05-25 (v15-D6): app now uses Supabase Auth (auth.users.encrypted_password) for credential storage. This column is no longer read or written by application code. Left in place for rollback safety; do NOT drop without a follow-up migration.';
