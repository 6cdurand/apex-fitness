-- =============================================================================
-- F0-B — public.users RLS + privilege hardening  (DRAFT — DO NOT APPLY AS-IS)
-- =============================================================================
-- Sprint: F0 PII hardening (SEV-0: anon-readable users + legacy password_hash).
-- Inventory: 23 read paths signed off (17 direct + 3 rpc + 3 views).
--
-- !!! THIS FILE IS A REVIEW ARTIFACT. It is NOT auto-applied. !!!
-- The prod supabase_migrations table is empty (RLS is managed by hand), so
-- nothing here runs until Christo pastes it into the dashboard SQL editor,
-- STAGE BY STAGE, in the order below. Applying STAGE 2 before STAGE 1 + the
-- companion code PR are deployed WILL break the app.
--
-- ---------------------------------------------------------------------------
-- APPLY-ORDER RUNBOOK (read before touching prod)
-- ---------------------------------------------------------------------------
--   STAGE 0  [DONE]  F0-A PR #42 — the 4 from('users').select('*') reads now
--                    use explicit column lists (no password_hash). MUST be
--                    merged + deployed before STAGE 2's column GRANT, because
--                    `select *` errors once SELECT on password_hash is revoked.
--
--   STAGE 1  [ADDITIVE — safe to apply any time]  Create the helper +
--            SECURITY DEFINER read RPCs and their grants. Changes NO existing
--            behavior; the direct table reads keep working.
--
--   CODE PR  [between stages]  Switch broad reads #2/#4/#5/#6 -> user_directory()
--            and (optional) #7 -> email_exists(); audit EVERY users `.select()`
--            incl. RETURNING after insert/update/upsert for `*`/password_hash.
--            Merge + deploy. (See [FLAG: SELECT-STAR BLAST RADIUS] below.)
--
--   ORPHAN   [gates STAGE 2 anon revoke]  Resolve the 1 residual active orphan
--            (id feda842b-10ec-4ebb-98fb-2d58c5f934d3, reserved example.com test
--            row, 0 activity). Delete/triage as dead — do NOT revoke anon until
--            this is cleared. See [FLAG: ANON REVOKE GATE].
--
--   STAGE 2  [LOCKDOWN — apply LAST, after STAGE 1 + CODE PR are live]  Drop the
--            permissive policy, add scoped RLS, revoke + column-grant, remediate
--            views.
-- =============================================================================


-- #############################################################################
-- ## STAGE 1 — additive helpers + read RPCs (safe to apply independently)     ##
-- #############################################################################

-- [SQL BLOCK 1.1] Relationship helper.
-- [FLAG] SECURITY DEFINER on purpose: it must read trainer_clients regardless of
--        that table's own RLS, and it lets the users SELECT policy avoid a
--        recursive RLS evaluation. canonical_user_id() is already SECURITY
--        DEFINER, so no recursion against public.users either.
-- [FLAG] No status filter: a trainer should see a client row even when the link
--        is 'pending'/'paused'. Add `and tc.status = 'active'` ONLY if the brief
--        wants active-only visibility (this is an over-tighten lever — confirm).
create or replace function public.is_my_trainer_or_client(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trainer_clients tc
    where (tc.trainer_id = public.canonical_user_id() and tc.client_id = target)
       or (tc.client_id  = public.canonical_user_id() and tc.trainer_id = target)
  );
$$;
revoke all on function public.is_my_trainer_or_client(uuid) from public, anon;
grant execute on function public.is_my_trainer_or_client(uuid) to authenticated;


-- [SQL BLOCK 1.2] user_directory(): SECURITY DEFINER read-through that replaces
--   the cross-user direct reads #2 (fetchAllUsers), #4 (fetchAllTrainers),
--   #5 (getValidUserIds), #6 (resolveCanonicalUserByEmail). Returns exactly the
--   columns mapUserFromSupabase consumes — NEVER password_hash.
-- [FLAG] EXPOSURE NOTE: this preserves today's behavior (any authenticated user
--        can already enumerate all users via the current open table). It does
--        NOT tighten authenticated cross-user reads — it just removes the anon
--        path + password_hash. A future phase could scope the projection
--        (social pages only need id/display_name/username/profile_photo) and/or
--        drop `email` from the directory. Flagged for your call; not tightened
--        here to avoid an over-tighten regression.
create or replace function public.user_directory(
  p_trainers_only boolean default false,
  p_email text default null
)
returns table (
  id uuid,
  email text,
  username text,
  display_name text,
  gender text,
  date_of_birth date,
  height numeric,
  weight numeric,
  preferred_unit text,
  is_trainer boolean,
  is_verified_trainer boolean,
  mode text,
  trainer_id uuid,
  profile_photo text,
  account_status text,
  notification_prefs jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email, u.username, u.display_name, u.gender, u.date_of_birth,
         u.height, u.weight, u.preferred_unit, u.is_trainer, u.is_verified_trainer,
         u.mode, u.trainer_id, u.profile_photo, u.account_status, u.notification_prefs
  from public.users u
  where u.account_status is distinct from 'placeholder'
    and (not p_trainers_only or u.is_trainer = true)
    and (p_email is null or lower(u.email) = lower(p_email));
$$;
revoke all on function public.user_directory(boolean, text) from public, anon;
grant execute on function public.user_directory(boolean, text) to authenticated;
-- [FLAG: ANON CALLERS] /community, /friends, /profile, /trainer call these while
--   the (now-empty) localStorage fast-path cohort is unauthenticated. Those
--   calls will return 0 rows for anon and the pages already fall back to local
--   cache. Acceptable because the orphan cohort is 1 dead row; revisit if real
--   anon users are ever expected to read the directory.


-- [SQL BLOCK 1.3] email_exists(): replaces #7 (checkEmailExistsInSupabase).
-- [FLAG: PROBABLY UNNECESSARY] #7 has NO callers in src today (dead code), and
--   registration uniqueness is already enforced by supabase.auth.signUp. Include
--   this ONLY if you want a pre-auth duplicate-email pre-check. If kept, it is
--   pre-auth, so it is granted to anon as well as authenticated. If you drop #7
--   instead, delete this block.
create or replace function public.email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where lower(email) = lower(p_email));
$$;
revoke all on function public.email_exists(text) from public;
grant execute on function public.email_exists(text) to anon, authenticated;


-- #############################################################################
-- ## STAGE 2 — LOCKDOWN  (apply LAST: after STAGE 1 + CODE PR are deployed,    ##
-- ##            and after the 1 residual orphan is triaged)                    ##
-- #############################################################################

-- [SQL BLOCK 2.1] Drop the wide-open policy (ALL / role public / using true).
drop policy if exists users_rollback_permissive on public.users;

-- [SQL BLOCK 2.2] Scoped RLS. Read = self OR trainer<->client link. No public
--   profile gate (discovery is served by user_directory()). Writes = self-only.
-- [FLAG] Policies target `authenticated` only. anon gets NO policy => no rows.
--        service_role bypasses RLS (edge fns + scripts unaffected).
alter table public.users enable row level security;  -- already enabled; explicit.

create policy users_select_self_or_linked on public.users
for select
to authenticated
using (
  id = public.canonical_user_id()
  or public.is_my_trainer_or_client(id)
);

-- [FLAG: INSERT PATH] The primary new-row writer is the handle_new_auth_user
--   trigger (SECURITY DEFINER -> bypasses RLS), so signup is unaffected. This
--   self-insert policy only governs any direct app insert; app registration
--   upserts resolve to UPDATE once the trigger row exists. VERIFY registration +
--   placeholder-claim still succeed on staging before applying.
create policy users_insert_self on public.users
for insert
to authenticated
with check (id = public.canonical_user_id());

create policy users_update_self on public.users
for update
to authenticated
using (id = public.canonical_user_id())
with check (id = public.canonical_user_id());

create policy users_delete_self on public.users
for delete
to authenticated
using (id = public.canonical_user_id());

-- [SQL BLOCK 2.3] Privilege hardening: kill table-wide SELECT (incl.
--   password_hash), re-grant column-scoped SELECT to authenticated only.
-- [FLAG: SELECT-STAR BLAST RADIUS] *** #1 RISK ***
--   Column-level SELECT means `SELECT *` / unqualified PostgREST `.select()`
--   (including RETURNING after insert/update/upsert) ERRORS with "permission
--   denied for column password_hash". F0-A (PR #42) cleared the 4 read
--   select('*'). BEFORE applying this block the CODE PR MUST also confirm NO
--   users write chains call `.select()` / `.select('*')` (audit upsertUser,
--   updateUserInSupabase, link/delete paths). Otherwise writes break.
-- [FLAG: ANON REVOKE GATE] Do NOT run the `from anon` part until the 1 residual
--   orphan is migrated or deleted (it currently authenticates only via the anon
--   fast-path). With the cohort at 1 dead test row this is effectively clear;
--   confirm, then apply.
revoke select on public.users from anon, authenticated;
-- defense-in-depth: anon never legitimately writes users (RLS already blocks it,
-- since canonical_user_id() is null for anon).
revoke insert, update, delete on public.users from anon;

grant select (
  id, email, username, display_name, gender, date_of_birth, height, weight,
  preferred_unit, is_trainer, is_verified_trainer, trainer_id, mode, created_at,
  updated_at, is_public_profile, exercise_unit, notification_preferences,
  account_status, auth_migration_status, claimed_at, auth_user_id, profile_photo,
  notification_prefs, auto_count_sessions_default, block_folder_order
) on public.users to authenticated;
-- NOTE: 26 columns — every column EXCEPT password_hash (ordinal 4). Keep this
--       list in sync if the table gains columns. (F0-C will later drop the
--       password_hash column outright; it is still written by the service-role
--       recovery edge fns, so it stays for now.)


-- #############################################################################
-- ## STAGE 2 (cont.) — VIEWS REMEDIATION                                      ##
-- #############################################################################
-- The replacement above does NOT close these: they are SECURITY DEFINER views
-- with SELECT granted to anon+authenticated, so they bypass users RLS entirely.
-- None are referenced by app code (verified via grep). Lock them to admins.
-- [FLAG] If any is consumed by an internal dashboard that authenticates as
--        `authenticated`, keep that grant; per the code sweep, none are.

-- [SQL BLOCK 2.4] Audit views (duplicate emails / orphan audit / role drift):
--   admin-only. Revoke client roles entirely.
revoke all on public.v_duplicate_emails from anon, authenticated, public;
revoke all on public.v_orphan_audit     from anon, authenticated, public;
revoke all on public.v_role_drift        from anon, authenticated, public;

-- [SQL BLOCK 2.5] user_follow_counts: advisor-flagged exposed_auth_users. Not
--   used by app code. Revoke anon at minimum; revoke authenticated too if you
--   confirm no internal consumer. Optionally re-create with security_invoker so
--   it can never out-read the caller again.
revoke all on public.user_follow_counts from anon, authenticated, public;
-- OPTIONAL hardening (Postgres 15+): make the surviving views honor caller RLS.
-- alter view public.v_duplicate_emails set (security_invoker = on);
-- alter view public.v_orphan_audit     set (security_invoker = on);
-- alter view public.v_role_drift        set (security_invoker = on);
-- alter view public.user_follow_counts  set (security_invoker = on);


-- #############################################################################
-- ## POST-APPLY VERIFICATION (run as anon + as a test authenticated user)     ##
-- #############################################################################
-- 1. anon:           select from users  -> 0 rows / permission denied.
-- 2. anon:           select user_directory() -> 0 rows (or denied for #7 paths).
-- 3. authenticated:  select own row -> ok; select another unrelated user -> 0.
-- 4. authenticated:  trainer selects a linked client -> 1 row; unlinked -> 0.
-- 5. authenticated:  select * from users -> MUST error (password_hash denied),
--                    proving the column mask holds.
-- 6. authenticated:  user_directory()/user_directory(true) -> rows w/o password_hash.
-- 7. e2e gate green on the CODE PR (login -> /today -> assign -> session -> payment).
-- =============================================================================
