-- ============================================================
-- APEX FITNESS — Identity Hardening 04b: auth.users trigger
-- Plan: identity-lifecycle-hardening-e9f293.md §4c
-- When Supabase Auth creates a new auth.users row (via signUp,
-- signInWithOAuth, or admin.createUser), automatically upsert a
-- corresponding public.users row with the same id so the 1:1 mapping
-- holds without any client-side code needing to do the insert.
-- Idempotent: re-running is a no-op.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_avatar text;
  v_meta jsonb;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_display_name := COALESCE(
    v_meta->>'display_name',
    v_meta->>'full_name',
    v_meta->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_avatar := COALESCE(v_meta->>'avatar_url', v_meta->>'picture');

  -- Insert if new, otherwise leave the row alone — the app is the
  -- source of truth for is_trainer / mode / other profile fields.
  INSERT INTO public.users (
    id, email, display_name, username,
    avatar_url, account_status, auth_migration_status,
    gender, preferred_unit, is_trainer, is_verified_trainer,
    mode, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    split_part(NEW.email, '@', 1),
    v_avatar,
    'active',
    'migrated',
    'other',
    'kg',
    false,
    false,
    'user',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.users.email),
        updated_at = now(),
        -- Preserve existing account_status unless it was 'placeholder'
        -- (this covers the invite-claim path — the placeholder becomes active).
        account_status = CASE
          WHEN public.users.account_status = 'placeholder' THEN 'active'
          ELSE public.users.account_status
        END,
        auth_migration_status = 'migrated',
        claimed_at = CASE
          WHEN public.users.account_status = 'placeholder' THEN now()
          ELSE public.users.claimed_at
        END;

  -- Telemetry
  INSERT INTO public.identity_events (event_type, user_id, payload)
  VALUES ('auth_user_created', NEW.id, jsonb_build_object('email', NEW.email));

  RETURN NEW;
END;
$$;

-- Drop + recreate so re-runs work cleanly.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
'Mirrors new auth.users rows into public.users (1:1 by id). Promotes placeholder rows to active on claim.';
