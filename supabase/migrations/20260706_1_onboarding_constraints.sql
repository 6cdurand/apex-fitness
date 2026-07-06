-- =============================================================================
-- 20260706_1_onboarding_constraints.sql
-- Onboarding atomicity — STEP 1 of 3 (APPLY FIRST).
--
-- ⚠️  DO NOT AUTO-APPLY. Run manually in the Supabase SQL editor (v1 prod
--     project pjkqfoeahcpvugolmxew) after reviewing. This file is tracked for
--     history only.
--
-- Purpose: give client_profiles a one-row-per-(trainer_id, client_id) guarantee
-- so the onboarding RPC can use ON CONFLICT (trainer_id, client_id) and the
-- profile row is atomically tied to the trainer↔client pair. Additive + safe.
--
-- RC-2: today client_profiles upserts key only on `id` ('profile-'+clientId),
-- with no unique (trainer_id, client_id). The RPC in step 2 REQUIRES this
-- constraint, so this migration MUST be applied before step 2.
-- =============================================================================

-- 1. Pre-check for duplicates that would block the unique constraint.
--    Run this SELECT first and inspect the result:
--
--    select trainer_id, client_id, count(*)
--    from client_profiles
--    group by trainer_id, client_id
--    having count(*) > 1;
--
--    If it returns rows, the dedupe below keeps the newest updated_at per pair
--    and deletes the older duplicates. Review before running.

-- 2. Dedupe: keep the newest row per (trainer_id, client_id).
delete from client_profiles a
using client_profiles b
where a.trainer_id = b.trainer_id
  and a.client_id = b.client_id
  and a.id <> b.id
  and coalesce(a.updated_at, a.created_at, 'epoch'::timestamptz)
      < coalesce(b.updated_at, b.created_at, 'epoch'::timestamptz);

-- 3. Add the unique constraint (idempotent guard).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_profiles_trainer_client_uniq'
  ) then
    alter table client_profiles
      add constraint client_profiles_trainer_client_uniq unique (trainer_id, client_id);
  end if;
end $$;

-- 4. Supporting indexes (additive).
create index if not exists idx_client_profiles_pair    on client_profiles(trainer_id, client_id);
create index if not exists idx_client_profiles_updated on client_profiles(updated_at);
create index if not exists idx_trainer_clients_updated on trainer_clients(updated_at);
