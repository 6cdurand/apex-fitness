-- =============================================================================
-- 20260706_3_onboarding_backfill_and_identity_heal.sql
-- Onboarding atomicity — STEP 3 of 3 (APPLY LAST).
--
-- ⚠️  DO NOT AUTO-APPLY. Run manually in the Supabase SQL editor (v1 prod
--     project pjkqfoeahcpvugolmxew) after reviewing EACH statement. This is a
--     DATA migration — read the diagnostic SELECTs first, then run the updates.
--
-- Two independent, reversible remediations:
--   A. RC-1 cleanup: flag rows that claim onboarding_complete=true but have NO
--      client_profiles row (the partial-save victims) back to false so the
--      trainer is prompted to re-complete. We do NOT fabricate answers.
--   B. RC-3/RC-6 prevention: re-point any placeholder client_id that has since
--      gained a real auth users.id onto the canonical id, so a client can never
--      be stranded / render as "unknown" again.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Detect + reconcile complete-but-no-profile (RC-1)
-- -----------------------------------------------------------------------------
-- A.1 DIAGNOSTIC — run first, inspect the list:
--
--   select tc.trainer_id, tc.client_id
--   from trainer_clients tc
--   left join client_profiles cp
--     on cp.trainer_id = tc.trainer_id and cp.client_id = tc.client_id
--   where tc.onboarding_complete = true and cp.id is null;

-- A.2 REMEDIATION — set the flag back to false so the app re-prompts.
--     Reversible: re-running onboarding sets it true again (now atomically).
update trainer_clients tc
set onboarding_complete = false, updated_at = now()
where tc.onboarding_complete = true
  and not exists (
    select 1 from client_profiles cp
    where cp.trainer_id = tc.trainer_id and cp.client_id = tc.client_id
  );

-- -----------------------------------------------------------------------------
-- B. Identity-heal: placeholder client_id -> canonical auth users.id (RC-3/RC-6)
-- -----------------------------------------------------------------------------
-- B.1 DIAGNOSTIC — find trainer_clients whose client_id points at a row that is
--     NOT keyed on its own auth id but a real auth account exists for the same
--     email. Inspect before running B.2.
--
--   select tc.trainer_id,
--          tc.client_id            as stale_id,
--          auth_u.id               as canonical_id,
--          u.email
--   from trainer_clients tc
--   join public.users u   on u.id = tc.client_id
--   join auth.users  auth_u on lower(auth_u.email) = lower(u.email)
--   where auth_u.id::text <> tc.client_id;
--
-- B.2 REMEDIATION — re-point every reference from stale_id to canonical_id.
--     ⚠️  Run inside an explicit transaction and only after reviewing B.1.
--     Uncomment and run per (stale_id, canonical_id) pair, or wrap in a loop.
--     Order matters only in that all FK targets (public.users) must already
--     hold the canonical row (they do — the identity migrations are applied).
--
--   begin;
--     update trainer_clients   set client_id = :canonical_id where client_id = :stale_id;
--     update client_profiles   set client_id = :canonical_id where client_id = :stale_id;
--     update workouts          set user_id   = :canonical_id where user_id   = :stale_id;
--     update calendar_events   set client_id = :canonical_id where client_id = :stale_id;
--     update trainer_sessions  set client_id = :canonical_id where client_id = :stale_id;
--   commit;
--
-- Rollback: the inverse UPDATE (swap :canonical_id and :stale_id) — but only if
-- the canonical row did not already own rows before the heal. Prefer taking a
-- backup of the affected rows before running B.2.
