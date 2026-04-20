-- ============================================================
-- APEX FITNESS — Identity Hardening 05: auth_user_id linking
-- Plan: identity-lifecycle-hardening (OR-clause profile resolve)
--
-- WHY
--   After the v2 cutover, most profiles have public.users.id = auth.users.id,
--   but a subset of pre-cutover accounts signing in via OAuth for the first
--   time will receive a fresh auth.users.id that does NOT match their
--   historical public.users.id. Those profiles need a second lookup key so
--   loadProfile() can resolve them via:
--     .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
--
-- WHAT
--   1. adds public.users.auth_user_id (nullable uuid, FK → auth.users)
--   2. partial unique + lookup indexes
--   3. backfills existing rows (by id, then by email)
--   4. rewrites handle_new_auth_user() so new auth.users inserts link an
--      existing public.users row by email instead of creating duplicates.
--
-- Idempotent. Safe to run repeatedly. Additive only (no destructive ops).
-- ============================================================

-- 1. Column --------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- 2. FK → auth.users(id). NOT VALID so pre-existing rows don't block it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END$$;

-- 3. Unique per auth user (nulls allowed, non-nulls must be unique).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id_uniq
  ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 4. Plain lookup index for the `.or(auth_user_id.eq.X)` read path.
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON public.users(auth_user_id);

-- 5. Backfill ------------------------------------------------
--    5a. Rows whose public.users.id already matches an auth.users.id get
--        auth_user_id mirrored (keeps the OR-clause a single-index hit).
UPDATE public.users u
   SET auth_user_id = u.id
  FROM auth.users a
 WHERE a.id = u.id
   AND u.auth_user_id IS NULL;

--    5b. Rows that only match auth.users by email (pre-cutover profiles
--        whose id differs from their auth user) get linked.
UPDATE public.users u
   SET auth_user_id = a.id,
       auth_migration_status = 'migrated'
  FROM auth.users a
 WHERE u.auth_user_id IS NULL
   AND u.email IS NOT NULL
   AND a.email IS NOT NULL
   AND lower(u.email) = lower(a.email)
   AND a.id <> u.id;

-- 6. Rewrite the auth.users → public.users trigger.
--    The previous version did INSERT ... ON CONFLICT (id) and could
--    create duplicate public.users rows when a pre-cutover account
--    (same email, different id) signs in via OAuth for the first time.
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
  v_existing_id uuid;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_display_name := COALESCE(
    v_meta->>'display_name',
    v_meta->>'full_name',
    v_meta->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_avatar := COALESCE(v_meta->>'avatar_url', v_meta->>'picture');

  -- Case A: a public.users row with the same id already exists
  --         (normal path: backfill or the v2 signup flow put it there).
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    UPDATE public.users
       SET email                 = COALESCE(NEW.email, email),
           auth_user_id          = NEW.id,
           auth_migration_status = 'migrated',
           updated_at            = now(),
           account_status        = CASE
             WHEN account_status = 'placeholder' THEN 'active'
             ELSE account_status
           END,
           claimed_at            = CASE
             WHEN account_status = 'placeholder' THEN now()
             ELSE claimed_at
           END
     WHERE id = NEW.id;

    INSERT INTO public.identity_events (event_type, user_id, payload)
    VALUES ('auth_user_linked_by_id', NEW.id,
            jsonb_build_object('email', NEW.email));

    RETURN NEW;
  END IF;

  -- Case B: a public.users row with the same email (case-insensitive)
  --         exists but a different id — link it instead of duplicating.
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM public.users
     WHERE email IS NOT NULL
       AND lower(email) = lower(NEW.email)
       AND auth_user_id IS NULL          -- don't poach an already-linked row
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.users
         SET auth_user_id          = NEW.id,
             auth_migration_status = 'migrated',
             updated_at            = now(),
             account_status        = CASE
               WHEN account_status = 'placeholder' THEN 'active'
               ELSE account_status
             END,
             claimed_at            = CASE
               WHEN account_status = 'placeholder' THEN now()
               ELSE claimed_at
             END
       WHERE id = v_existing_id;

      INSERT INTO public.identity_events (event_type, user_id, payload)
      VALUES ('auth_user_linked_by_email', v_existing_id,
              jsonb_build_object('email', NEW.email,
                                 'auth_user_id', NEW.id));

      RETURN NEW;
    END IF;
  END IF;

  -- Case C: no matching row — insert fresh (id = auth.users.id, mirror
  --         auth_user_id so the OR-clause hits the primary key path).
  INSERT INTO public.users (
    id, email, auth_user_id, display_name, username,
    avatar_url, account_status, auth_migration_status,
    gender, preferred_unit, is_trainer, is_verified_trainer,
    mode, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.id,
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
  );

  INSERT INTO public.identity_events (event_type, user_id, payload)
  VALUES ('auth_user_created', NEW.id,
          jsonb_build_object('email', NEW.email));

  RETURN NEW;
END;
$$;

-- Trigger re-create (idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
'Mirrors auth.users into public.users: matches by id, then by email, then inserts. Promotes placeholders to active.';

COMMENT ON COLUMN public.users.auth_user_id IS
'Optional back-reference to auth.users.id for accounts whose public.users.id predates Supabase Auth. Populated by handle_new_auth_user() and backfilled in 20260421_01.';
