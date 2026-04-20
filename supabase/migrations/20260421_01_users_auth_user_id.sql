-- ============================================================
-- APEX FITNESS — Identity Hardening 05: auth_user_id linking (safe v2)
-- Plan: identity-lifecycle-hardening (OR-clause profile resolve)
--
-- WHY
--   loadProfile() resolves the signed-in profile via:
--     .or(`id.eq.${userId},auth_user_id.eq.${userId}`).maybeSingle()
--   so this migration MUST NOT:
--     (a) leave two public.users rows linked to the same auth user, or
--     (b) link row Y's auth_user_id to a value X where another row
--         already owns id = X.
--   Either case would make .maybeSingle() fail on every subsequent
--   login for that auth user (PGRST116 "more than one row").
--
-- SAFETY ORDER (matches the ordering requested in review)
--   1. add column + FK                     (no indexes yet)
--   2. backfill by id                      (always safe — id is unique)
--   3. backfill by email, guarded          (skips any row that could
--                                            cause duplicate-link or
--                                            OR-clause ambiguity)
--   4. conflict reporting                  (every skipped row logged to
--                                            public.identity_events)
--   5. partial UNIQUE index, guarded       (skipped with RAISE NOTICE if
--                                            residual duplicates remain;
--                                            can be added in a follow-up
--                                            migration after operator
--                                            reconciliation)
--   6. handle_new_auth_user() rewrite      (semantics extended:
--                                            ambiguous-email signins no
--                                            longer fall through to an
--                                            INSERT that duplicates the
--                                            email; instead a fallback
--                                            profile is created with
--                                            email=NULL and
--                                            auth_migration_status =
--                                            'pending_review' so the
--                                            "never duplicate an email"
--                                            invariant holds strictly.)
--
-- Conservative throughout: no deletes, no merges, no clobbering an
-- existing non-null auth_user_id, no destructive updates. Idempotent.
-- ============================================================

-- 1. Column --------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- 1b. Extend the auth_migration_status CHECK constraint so the trigger
--     can write 'pending_review' on the ambiguous-email fallback path.
--     Idempotent: DROP IF EXISTS + ADD always leaves the table with the
--     extended domain, whether this migration runs for the first time
--     or is re-applied.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_auth_migration_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_auth_migration_status_check
  CHECK (auth_migration_status IN (
    'pending',
    'migrated',
    'failed',
    'skipped',
    'pending_review'
  ));

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

-- 3. Backfill pass 1 — public.users.id already equals an auth.users.id.
--    Safe by construction: id is the primary key, so at most one row
--    can have id = X for any given X.
UPDATE public.users u
   SET auth_user_id = u.id
  FROM auth.users a
 WHERE a.id = u.id
   AND u.auth_user_id IS NULL;

-- 4. Backfill pass 2 — by email, ONLY when ALL THREE guards hold:
--      (i)   exactly one public.users row has this lowered email
--            (no duplicate profiles sharing an email),
--      (ii)  no other public.users row already has auth_user_id = a.id
--            (the auth user isn't already linked somewhere),
--      (iii) no public.users row has id = a.id
--            (otherwise the OR-clause would match 2 rows and
--             .maybeSingle() would raise PGRST116 on every login).
UPDATE public.users u
   SET auth_user_id          = a.id,
       auth_migration_status = 'migrated'
  FROM auth.users a
 WHERE u.auth_user_id IS NULL
   AND u.email IS NOT NULL
   AND a.email IS NOT NULL
   AND lower(u.email) = lower(a.email)
   AND a.id <> u.id
   -- Guard (i): exactly one public.users row for this email
   AND (
     SELECT count(*) FROM public.users u2
      WHERE u2.email IS NOT NULL
        AND lower(u2.email) = lower(u.email)
   ) = 1
   -- Guard (ii): no other row already links to this auth user
   AND NOT EXISTS (
     SELECT 1 FROM public.users u3
      WHERE u3.auth_user_id = a.id
   )
   -- Guard (iii): no row currently has id = a.id
   AND NOT EXISTS (
     SELECT 1 FROM public.users u4
      WHERE u4.id = a.id
   );

-- 5. Conflict reporting ---------------------------------------
--    Log — don't fix — every row that SHOULD have linked by email but
--    was skipped. Operators triage via public.identity_events. No
--    destructive action is taken; merging profiles is a human decision.

-- 5a. Duplicate public.users rows sharing an email (guard (i) failed).
INSERT INTO public.identity_events (event_type, user_id, payload)
SELECT DISTINCT ON (lower(u.email))
       'duplicate_public_users_by_email',
       u.id,
       jsonb_build_object(
         'email', u.email,
         'duplicate_ids', (
           SELECT jsonb_agg(u2.id ORDER BY u2.created_at)
             FROM public.users u2
            WHERE lower(u2.email) = lower(u.email)
         )
       )
  FROM public.users u
 WHERE u.email IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.users u2
      WHERE u2.id <> u.id
        AND u2.email IS NOT NULL
        AND lower(u2.email) = lower(u.email)
   );

-- 5b. auth.users exists for this email but its id is already taken as
--     a public.users.id by a different row (guard (iii) failed).
INSERT INTO public.identity_events (event_type, user_id, payload)
SELECT 'auth_id_taken_by_other_profile',
       u.id,
       jsonb_build_object(
         'email', u.email,
         'auth_user_id', a.id
       )
  FROM public.users u
  JOIN auth.users a
    ON u.email IS NOT NULL
   AND a.email IS NOT NULL
   AND lower(u.email) = lower(a.email)
 WHERE u.auth_user_id IS NULL
   AND a.id <> u.id
   AND EXISTS (
     SELECT 1 FROM public.users u4
      WHERE u4.id = a.id
   );

-- 5c. auth.users.id already claimed by another linked profile (guard (ii)).
INSERT INTO public.identity_events (event_type, user_id, payload)
SELECT 'auth_user_already_linked',
       u.id,
       jsonb_build_object(
         'email', u.email,
         'auth_user_id', a.id,
         'claimed_by_profile', (
           SELECT u3.id FROM public.users u3
            WHERE u3.auth_user_id = a.id
            LIMIT 1
         )
       )
  FROM public.users u
  JOIN auth.users a
    ON u.email IS NOT NULL
   AND a.email IS NOT NULL
   AND lower(u.email) = lower(a.email)
 WHERE u.auth_user_id IS NULL
   AND a.id <> u.id
   AND EXISTS (
     SELECT 1 FROM public.users u3
      WHERE u3.auth_user_id = a.id
        AND u3.id <> u.id
   );

-- 6. Indexes --------------------------------------------------
-- 6a. Plain (non-unique) lookup index — always safe to add.
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON public.users(auth_user_id);

-- 6b. Partial UNIQUE index — only if zero residual duplicates.
--     If duplicates remain, RAISE NOTICE and skip; the unique index can
--     be added in a follow-up migration once rows flagged in
--     public.identity_events have been reconciled by an operator.
DO $$
DECLARE
  v_dup_count int;
  v_sample    text;
BEGIN
  SELECT count(*), min(auth_user_id::text)
    INTO v_dup_count, v_sample
    FROM (
      SELECT auth_user_id
        FROM public.users
       WHERE auth_user_id IS NOT NULL
       GROUP BY auth_user_id
      HAVING count(*) > 1
    ) dups;

  IF v_dup_count > 0 THEN
    RAISE NOTICE
      'SKIPPING UNIQUE index on public.users.auth_user_id: % duplicate value(s) remain (sample=%). Inspect public.identity_events, reconcile manually, then run this migration again.',
      v_dup_count, v_sample;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname  = 'idx_users_auth_user_id_uniq'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX idx_users_auth_user_id_uniq
                 ON public.users(auth_user_id)
              WHERE auth_user_id IS NOT NULL';
    END IF;
  END IF;
END$$;

-- 7. Trigger: handle_new_auth_user() --------------------------
--    Four-way dispatch. Hard invariant: NEVER creates a second
--    public.users row carrying an email that already exists on another
--    public.users row.
--
--      Case A  — public.users row with id = NEW.id exists.
--                Update in place; promote placeholder → active.
--      Case B  — exactly one public.users row with matching email
--                (case-insensitive) AND auth_user_id IS NULL. Link
--                via auth_user_id.
--      Case B' — MORE than one candidate row shares NEW.email
--                (ambiguous). Insert a FALLBACK profile instead of
--                propagating the duplicate email:
--                  id                    = NEW.id
--                  auth_user_id          = NEW.id
--                  email                 = NULL   -- blank on purpose
--                  username              = NULL
--                  auth_migration_status = 'pending_review'
--                Log identity_events type
--                'auth_user_email_ambiguous_fallback_profile_created'
--                with the original email and candidate count. Operators
--                reconcile via supabase/manual_followups.sql, then
--                re-set the email on the fallback row.
--      Case C  — no email match at all (NEW.email is NULL, or zero
--                unlinked candidates). Insert fresh with NEW.email
--                (safe here — there is no competing row).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_avatar       text;
  v_meta         jsonb;
  v_existing_id  uuid;
  v_email_matches int;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_display_name := COALESCE(
    v_meta->>'display_name',
    v_meta->>'full_name',
    v_meta->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_avatar := COALESCE(v_meta->>'avatar_url', v_meta->>'picture');

  -- Case A: public.users row with the same id already exists.
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

  -- Case B: exactly one public.users row matches by email with
  --         auth_user_id IS NULL. Link via auth_user_id.
  IF NEW.email IS NOT NULL THEN
    SELECT count(*) INTO v_email_matches
      FROM public.users
     WHERE email IS NOT NULL
       AND lower(email) = lower(NEW.email)
       AND auth_user_id IS NULL;

    IF v_email_matches = 1 THEN
      SELECT id INTO v_existing_id
        FROM public.users
       WHERE email IS NOT NULL
         AND lower(email) = lower(NEW.email)
         AND auth_user_id IS NULL
       LIMIT 1;

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

    ELSIF v_email_matches > 1 THEN
      -- Case B' — AMBIGUOUS email. Do NOT create another row carrying
      -- NEW.email; that would compound the duplicate problem this
      -- migration exists to prevent. Instead insert a fallback profile
      -- with email = NULL and flag it for operator review.
      INSERT INTO public.users (
        id, email, auth_user_id, display_name, username,
        avatar_url, account_status, auth_migration_status,
        gender, preferred_unit, is_trainer, is_verified_trainer,
        mode, created_at, updated_at
      )
      VALUES (
        NEW.id,
        NULL,                -- intentionally blank to uphold the
                             -- "no duplicate email" invariant
        NEW.id,              -- mirror auth id so the OR-clause's
                             -- id.eq half resolves on first login
        v_display_name,
        NULL,                -- no username derivable without email;
                             -- operator sets during review
        v_avatar,
        'active',
        'pending_review',    -- flag; gates manual_followups.sql workflow
        'other',
        'kg',
        false,
        false,
        'user',
        now(),
        now()
      );

      INSERT INTO public.identity_events (event_type, user_id, payload)
      VALUES (
        'auth_user_email_ambiguous_fallback_profile_created',
        NEW.id,
        jsonb_build_object(
          'original_email',  NEW.email,
          'candidate_count', v_email_matches
        )
      );

      RETURN NEW;
    END IF;
  END IF;

  -- Case C: no email match (NEW.email IS NULL, or zero unlinked
  --         candidates). Safe to insert with NEW.email because no
  --         existing public.users row carries it.
  --         id = auth.users.id so the primary-key half of the OR-clause
  --         resolves on first login.
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
'Mirrors auth.users → public.users. Dispatch: id match → update; single unlinked email → link via auth_user_id; ambiguous email → fallback row with email=NULL + auth_migration_status=pending_review; otherwise insert fresh. Never duplicates profiles by email.';

COMMENT ON COLUMN public.users.auth_user_id IS
'Back-reference to auth.users.id for accounts whose public.users.id predates Supabase Auth. Nullable; unique when set (partial unique index added in 20260421_01 if no residual duplicates).';
