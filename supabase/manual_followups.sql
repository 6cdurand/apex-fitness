-- ============================================================
-- APEX FITNESS — Manual follow-ups for migration 20260421_01
-- Location: supabase/manual_followups.sql
--
-- *** THIS FILE IS NOT A MIGRATION ***
-- Do NOT move it under supabase/migrations/. It is a diagnostic
-- report + templated UPDATE script for a human operator to run in
-- the Supabase SQL editor AFTER 20260421_01_users_auth_user_id
-- has been applied and reported residual conflicts.
--
-- Structure:
--   SECTION 1 — Summary counts of rows needing attention.
--   SECTION 2 — Detailed per-row listings with full conflict reasons.
--   SECTION 3 — Templated, one-row-at-a-time UPDATE blocks
--               (commented out) that retire stale profiles safely.
--   SECTION 4 — Finalization: guarded CREATE of the partial UNIQUE
--               index on public.users.auth_user_id once all
--               conflicts are resolved.
--   SECTION 5 — Invariant checks to run after any Section 3 UPDATE.
--
-- NO DELETE statements. NO mass updates. NO merges of user data.
-- Each templated UPDATE mutates exactly one row by id, writes an
-- audit entry to public.identity_events, and is safe to run
-- repeatedly (idempotent). All mutations are wrapped in a
-- BEGIN/COMMIT block so the operator can ROLLBACK on inspection.
-- ============================================================


-- ============================================================
-- SECTION 1 — Summary
-- ============================================================
-- Counts of rows needing manual attention, bucketed by reason.
-- Expect all zeros in a healthy state.
WITH dup_groups AS (
  SELECT lower(u.email) AS norm_email, count(*) AS n
    FROM public.users u
   WHERE u.email IS NOT NULL
   GROUP BY lower(u.email)
  HAVING count(*) > 1
),
id_taken AS (
  SELECT u.id
    FROM public.users u
    JOIN auth.users a
      ON u.email IS NOT NULL
     AND a.email IS NOT NULL
     AND lower(u.email) = lower(a.email)
   WHERE u.auth_user_id IS NULL
     AND a.id <> u.id
     AND EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = a.id)
),
already_linked AS (
  SELECT u.id
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
     )
),
no_auth_match AS (
  SELECT u.id
    FROM public.users u
   WHERE u.auth_user_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM auth.users a
        WHERE u.email IS NOT NULL
          AND a.email IS NOT NULL
          AND lower(a.email) = lower(u.email)
     )
)
SELECT 'duplicate_public_users_by_email' AS bucket,
       (SELECT count(*) FROM dup_groups)           AS affected_email_groups,
       (SELECT COALESCE(sum(n), 0) FROM dup_groups) AS affected_rows
UNION ALL
SELECT 'auth_id_taken_by_other_profile',
       NULL,
       (SELECT count(*) FROM id_taken)
UNION ALL
SELECT 'auth_user_already_linked',
       NULL,
       (SELECT count(*) FROM already_linked)
UNION ALL
SELECT 'unlinked_no_auth_match (informational only)',
       NULL,
       (SELECT count(*) FROM no_auth_match);


-- ============================================================
-- SECTION 2 — Detail listings
-- ============================================================

-- 2A. duplicate_public_users_by_email
-- Groups of 2+ public.users rows sharing an email (case-insensitive).
-- None were linked via auth_user_id. Use Section 3A to retire all
-- but the canonical one per group.
SELECT lower(u.email)  AS norm_email,
       count(*)        AS dup_count,
       jsonb_agg(
         jsonb_build_object(
           'id',             u.id,
           'email',          u.email,
           'display_name',   u.display_name,
           'username',       u.username,
           'is_trainer',     u.is_trainer,
           'account_status', u.account_status,
           'auth_user_id',   u.auth_user_id,
           'created_at',     u.created_at,
           'updated_at',     u.updated_at,
           'workout_count',
             (SELECT count(*) FROM public.workouts w
               WHERE w.user_id = u.id),
           'trainer_client_count',
             (SELECT count(*) FROM public.trainer_clients tc
               WHERE tc.client_id = u.id OR tc.trainer_id = u.id)
         )
         ORDER BY u.created_at
       ) AS profiles
  FROM public.users u
 WHERE u.email IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.users u2
      WHERE u2.id <> u.id
        AND u2.email IS NOT NULL
        AND lower(u2.email) = lower(u.email)
   )
 GROUP BY lower(u.email)
 ORDER BY dup_count DESC, norm_email;

-- 2B. auth_id_taken_by_other_profile
-- Unlinked profile Y shares an email with auth.users row A, but
-- A.id is ALREADY the id of a DIFFERENT public.users row.
-- Either Y is a stale duplicate of the id-owner (use 3C to retire
-- Y), or Y is the real record and the id-owner is a stale fresh
-- signup to retire (use 3B to retire the id-owner + link Y).
SELECT u.id                       AS unlinked_profile_id,
       u.email                    AS unlinked_email,
       u.display_name             AS unlinked_name,
       u.is_trainer               AS unlinked_is_trainer,
       u.account_status           AS unlinked_status,
       u.created_at               AS unlinked_created_at,
       (SELECT count(*) FROM public.workouts w
         WHERE w.user_id = u.id)  AS unlinked_workout_count,
       a.id                       AS target_auth_id,
       a.email                    AS target_auth_email,
       a.created_at               AS target_auth_created_at,
       claimed_row.id             AS id_owner_profile_id,
       claimed_row.email          AS id_owner_email,
       claimed_row.display_name   AS id_owner_name,
       claimed_row.is_trainer     AS id_owner_is_trainer,
       claimed_row.account_status AS id_owner_status,
       claimed_row.auth_user_id   AS id_owner_current_auth_link,
       claimed_row.created_at     AS id_owner_created_at,
       (SELECT count(*) FROM public.workouts w
         WHERE w.user_id = claimed_row.id) AS id_owner_workout_count
  FROM public.users u
  JOIN auth.users a
    ON u.email IS NOT NULL
   AND a.email IS NOT NULL
   AND lower(u.email) = lower(a.email)
  JOIN public.users claimed_row ON claimed_row.id = a.id
 WHERE u.auth_user_id IS NULL
   AND a.id <> u.id
 ORDER BY u.created_at;

-- 2C. auth_user_already_linked
-- Unlinked profile Y shares an email with an auth user whose id is
-- already linked via auth_user_id on ANOTHER public.users row Z.
-- Y is the redundant one — use Section 3A to retire it.
SELECT u.id                     AS unlinked_profile_id,
       u.email                  AS unlinked_email,
       u.display_name           AS unlinked_name,
       u.account_status         AS unlinked_status,
       u.created_at             AS unlinked_created_at,
       (SELECT count(*) FROM public.workouts w
         WHERE w.user_id = u.id) AS unlinked_workout_count,
       a.id                     AS target_auth_id,
       a.email                  AS target_auth_email,
       linked.id                AS already_linked_profile_id,
       linked.email             AS already_linked_email,
       linked.display_name      AS already_linked_name,
       linked.account_status    AS already_linked_status,
       linked.created_at        AS already_linked_created_at
  FROM public.users u
  JOIN auth.users a
    ON u.email IS NOT NULL
   AND a.email IS NOT NULL
   AND lower(u.email) = lower(a.email)
  JOIN public.users linked
    ON linked.auth_user_id = a.id
 WHERE u.auth_user_id IS NULL
   AND a.id <> u.id
   AND linked.id <> u.id
 ORDER BY u.created_at;

-- 2D. unlinked-but-no-auth-match (informational only)
-- Profiles with auth_user_id IS NULL AND no matching auth.users row.
-- These will auto-link on the user's next sign-in (trigger Case B).
-- No manual action required; listed only for transparency.
SELECT u.id,
       u.email,
       u.display_name,
       u.account_status,
       u.auth_migration_status,
       u.created_at
  FROM public.users u
 WHERE u.auth_user_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM auth.users a
      WHERE u.email IS NOT NULL
        AND a.email IS NOT NULL
        AND lower(a.email) = lower(u.email)
   )
 ORDER BY u.created_at;

-- 2E. Raw audit trail (last 7 days).
SELECT ie.created_at,
       ie.event_type,
       ie.user_id,
       ie.payload
  FROM public.identity_events ie
 WHERE ie.event_type IN (
         'duplicate_public_users_by_email',
         'auth_id_taken_by_other_profile',
         'auth_user_already_linked',
         'auth_user_email_ambiguous',
         'profile_retired_manual',
         'auth_user_linked_manual'
       )
   AND ie.created_at > now() - interval '7 days'
 ORDER BY ie.created_at DESC;


-- ============================================================
-- SECTION 3 — Templated one-row UPDATE blocks (COMMENTED OUT)
--
-- For each conflicting row from Section 2:
--   (a) copy the block that matches the resolution you want,
--   (b) paste into a fresh SQL editor tab,
--   (c) fill in the UUIDs,
--   (d) remove the leading "-- " from every mutation line,
--   (e) run. Each block mutates exactly one row + writes an
--       audit event. BEGIN/COMMIT are included so you can
--       ROLLBACK if the pre-commit SELECT shows unexpected state.
--
-- Every block preserves row data (workouts, PBs, medals, FKs via
-- id are untouched) and only nullifies email + sets
-- account_status='deleted' to remove the row from future Case B
-- linking attempts. Nothing is ever deleted.
-- ============================================================

-- ------------------------------------------------------------
-- 3A. Retire a duplicate-email profile.
--     Use for: Section 2A (duplicate-email groups) and
--              Section 2C (auth_user_already_linked).
--
-- PARAMS
--   <PROFILE_ID_TO_RETIRE>  — public.users.id of the row to retire.
-- ------------------------------------------------------------
-- BEGIN;
--   -- Pre-commit inspection: confirm the row you're about to retire.
--   SELECT id, email, display_name, account_status, auth_user_id,
--          (SELECT count(*) FROM public.workouts w WHERE w.user_id = id) AS workouts,
--          (SELECT count(*) FROM public.trainer_clients tc
--            WHERE tc.client_id = id OR tc.trainer_id = id) AS trainer_links
--     FROM public.users
--    WHERE id = '<PROFILE_ID_TO_RETIRE>'::uuid;
--
--   -- Audit log BEFORE the mutation (captures the pre-retire email).
--   INSERT INTO public.identity_events (event_type, user_id, payload)
--   SELECT 'profile_retired_manual',
--          id,
--          jsonb_build_object(
--            'reason',          'duplicate_email_or_redundant',
--            'original_email',  email,
--            'original_status', account_status,
--            'retired_at',      now()
--          )
--     FROM public.users
--    WHERE id = '<PROFILE_ID_TO_RETIRE>'::uuid;
--
--   -- The mutation: nullify email, flag deleted. No other fields touched.
--   UPDATE public.users
--      SET email          = NULL,
--          account_status = 'deleted',
--          updated_at     = now()
--    WHERE id = '<PROFILE_ID_TO_RETIRE>'::uuid;
-- COMMIT;
-- -- If the SELECT above looked wrong, use ROLLBACK; instead of COMMIT.


-- ------------------------------------------------------------
-- 3B. Section 2B — "unlinked row is canonical, id-owner is stale".
--     (i)  retire the stale id-owner (nulls its email).
--     (ii) link the canonical row's auth_user_id so future logins
--          resolve via .or(auth_user_id.eq.<auth_id>).
--
-- PARAMS
--   <ID_OWNER_PROFILE_ID>  — stale row currently owning id = <TARGET_AUTH_ID>.
--   <UNLINKED_PROFILE_ID>  — canonical row that should keep its data.
--   <TARGET_AUTH_ID>       — auth.users.id (same as <ID_OWNER_PROFILE_ID>).
-- ------------------------------------------------------------
-- BEGIN;
--   -- Pre-commit inspection.
--   SELECT 'id_owner' AS role, id, email, display_name, account_status,
--          (SELECT count(*) FROM public.workouts w WHERE w.user_id = id) AS workouts
--     FROM public.users WHERE id = '<ID_OWNER_PROFILE_ID>'::uuid
--   UNION ALL
--   SELECT 'unlinked', id, email, display_name, account_status,
--          (SELECT count(*) FROM public.workouts w WHERE w.user_id = id)
--     FROM public.users WHERE id = '<UNLINKED_PROFILE_ID>'::uuid;
--
--   -- (i) retire stale id-owner
--   INSERT INTO public.identity_events (event_type, user_id, payload)
--   SELECT 'profile_retired_manual',
--          id,
--          jsonb_build_object(
--            'reason',          'stale_id_owner',
--            'original_email',  email,
--            'original_status', account_status,
--            'retired_at',      now()
--          )
--     FROM public.users
--    WHERE id = '<ID_OWNER_PROFILE_ID>'::uuid;
--
--   UPDATE public.users
--      SET email          = NULL,
--          account_status = 'deleted',
--          updated_at     = now()
--    WHERE id = '<ID_OWNER_PROFILE_ID>'::uuid;
--
--   -- (ii) link the canonical row via auth_user_id
--   UPDATE public.users
--      SET auth_user_id          = '<TARGET_AUTH_ID>'::uuid,
--          auth_migration_status = 'migrated',
--          updated_at            = now()
--    WHERE id              = '<UNLINKED_PROFILE_ID>'::uuid
--      AND auth_user_id IS NULL;          -- belt-and-braces: never overwrite
--
--   INSERT INTO public.identity_events (event_type, user_id, payload)
--   VALUES (
--     'auth_user_linked_manual',
--     '<UNLINKED_PROFILE_ID>'::uuid,
--     jsonb_build_object(
--       'auth_user_id', '<TARGET_AUTH_ID>'::uuid,
--       'linked_at',    now(),
--       'reason',       'manual_followup_2B_canonical'
--     )
--   );
-- COMMIT;


-- ------------------------------------------------------------
-- 3C. Section 2B — "unlinked row is stale, id-owner is canonical".
--     Retire the unlinked row only. Do NOT touch the id-owner; it
--     already has id = auth.users.id which loadProfile() will
--     resolve via .or(id.eq.<auth_id>).
--
-- PARAMS
--   <UNLINKED_PROFILE_ID>  — stale unlinked row to retire.
-- ------------------------------------------------------------
-- BEGIN;
--   SELECT id, email, display_name, account_status,
--          (SELECT count(*) FROM public.workouts w WHERE w.user_id = id) AS workouts
--     FROM public.users
--    WHERE id = '<UNLINKED_PROFILE_ID>'::uuid;
--
--   INSERT INTO public.identity_events (event_type, user_id, payload)
--   SELECT 'profile_retired_manual',
--          id,
--          jsonb_build_object(
--            'reason',          'stale_unlinked_profile',
--            'original_email',  email,
--            'original_status', account_status,
--            'retired_at',      now()
--          )
--     FROM public.users
--    WHERE id = '<UNLINKED_PROFILE_ID>'::uuid;
--
--   UPDATE public.users
--      SET email          = NULL,
--          account_status = 'deleted',
--          updated_at     = now()
--    WHERE id = '<UNLINKED_PROFILE_ID>'::uuid;
-- COMMIT;


-- ------------------------------------------------------------
-- 3D. Explicit link without retiring anything.
--     Use when the operator has verified BY HAND that an unlinked
--     profile should be linked to a specific auth user and there is
--     no competing row. Skips the retire step entirely.
--
-- PARAMS
--   <UNLINKED_PROFILE_ID>  — row to link.
--   <TARGET_AUTH_ID>       — auth.users.id to link it to.
-- ------------------------------------------------------------
-- BEGIN;
--   -- Pre-flight invariants: target auth id must exist and must
--   -- not already be linked elsewhere; target profile id must not
--   -- collide with <TARGET_AUTH_ID>.
--   SELECT 'auth_exists'          AS check, count(*)
--     FROM auth.users WHERE id = '<TARGET_AUTH_ID>'::uuid
--   UNION ALL
--   SELECT 'auth_already_linked',  count(*)
--     FROM public.users WHERE auth_user_id = '<TARGET_AUTH_ID>'::uuid
--   UNION ALL
--   SELECT 'id_collision',         count(*)
--     FROM public.users WHERE id = '<TARGET_AUTH_ID>'::uuid
--                         AND id <> '<UNLINKED_PROFILE_ID>'::uuid;
--   -- Expect: auth_exists=1, auth_already_linked=0, id_collision=0.
--   -- If NOT, ROLLBACK and switch to 3B or 3C.
--
--   UPDATE public.users
--      SET auth_user_id          = '<TARGET_AUTH_ID>'::uuid,
--          auth_migration_status = 'migrated',
--          updated_at            = now()
--    WHERE id              = '<UNLINKED_PROFILE_ID>'::uuid
--      AND auth_user_id IS NULL;
--
--   INSERT INTO public.identity_events (event_type, user_id, payload)
--   VALUES (
--     'auth_user_linked_manual',
--     '<UNLINKED_PROFILE_ID>'::uuid,
--     jsonb_build_object(
--       'auth_user_id', '<TARGET_AUTH_ID>'::uuid,
--       'linked_at',    now(),
--       'reason',       'manual_followup_3D_direct_link'
--     )
--   );
-- COMMIT;


-- ============================================================
-- SECTION 4 — Finalization: create partial UNIQUE index
-- ============================================================
-- Run after every Section 3 UPDATE you intend to run. This block
-- re-checks for residual duplicate auth_user_id values and ONLY
-- creates the partial unique index if none remain. Safe to run
-- repeatedly. No destructive action if it can't proceed.
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
    ) d;

  IF v_dup_count > 0 THEN
    RAISE NOTICE
      'NOT creating unique index: % duplicate auth_user_id value(s) remain (sample=%). Inspect Section 2 and Section 5 queries; resolve with a Section 3 block, then re-run this DO block.',
      v_dup_count, v_sample;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname  = 'idx_users_auth_user_id_uniq'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_users_auth_user_id_uniq
               ON public.users(auth_user_id)
            WHERE auth_user_id IS NOT NULL';
    RAISE NOTICE 'CREATE UNIQUE INDEX idx_users_auth_user_id_uniq — done.';
  ELSE
    RAISE NOTICE 'idx_users_auth_user_id_uniq already exists — no-op.';
  END IF;
END$$;


-- ============================================================
-- SECTION 5 — Invariant checks (run after ANY Section 3 UPDATE)
-- ============================================================

-- (1) No two profiles share the same auth_user_id. Expect: 0 rows.
SELECT auth_user_id,
       count(*)                       AS n,
       array_agg(id ORDER BY created_at) AS profile_ids
  FROM public.users
 WHERE auth_user_id IS NOT NULL
 GROUP BY auth_user_id
HAVING count(*) > 1;

-- (2) No OR-clause ambiguity: row X has id=Y AND another row Z has
--     auth_user_id=Y. Expect: 0 rows.
SELECT a.id           AS row_owning_id,
       b.id           AS row_linking_to_id,
       b.auth_user_id AS shared_auth,
       a.email        AS row_a_email,
       b.email        AS row_b_email
  FROM public.users b
  JOIN public.users a ON a.id = b.auth_user_id
 WHERE a.id <> b.id;

-- (3) Bucket-by-bucket residuals. Expect: remaining=0 in every row.
SELECT 'duplicate_by_email' AS bucket,
       (SELECT count(*) FROM (
          SELECT lower(email) FROM public.users
           WHERE email IS NOT NULL
           GROUP BY lower(email) HAVING count(*) > 1
        ) x)                             AS remaining
UNION ALL
SELECT 'auth_id_taken',
       (SELECT count(*)
          FROM public.users u
          JOIN auth.users a
            ON u.email IS NOT NULL AND a.email IS NOT NULL
           AND lower(u.email) = lower(a.email)
         WHERE u.auth_user_id IS NULL
           AND a.id <> u.id
           AND EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = a.id))
UNION ALL
SELECT 'auth_already_linked',
       (SELECT count(*)
          FROM public.users u
          JOIN auth.users a
            ON u.email IS NOT NULL AND a.email IS NOT NULL
           AND lower(u.email) = lower(a.email)
         WHERE u.auth_user_id IS NULL
           AND a.id <> u.id
           AND EXISTS (
             SELECT 1 FROM public.users u3
              WHERE u3.auth_user_id = a.id AND u3.id <> u.id
           ));

-- (4) Link coverage summary.
SELECT count(*)                                         AS total,
       count(*) FILTER (WHERE auth_user_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE auth_user_id IS NULL)     AS unlinked,
       count(*) FILTER (WHERE account_status = 'deleted')
                                                        AS retired,
       count(*) FILTER (WHERE account_status = 'placeholder')
                                                        AS placeholders
  FROM public.users;
