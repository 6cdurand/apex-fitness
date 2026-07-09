-- =============================================================================
-- db-tests.sql — DB-level verification for the onboarding RPC.
-- Run in the v1 Supabase SQL editor AFTER applying migrations 1 & 2.
-- These correspond to acceptance tests 1–5 (2,3,5 are DB-level guarantees).
-- Use a throwaway trainer/client pair; clean up at the end.
-- =============================================================================

-- SETUP (replace with real ids you can auth as, or run as the trainer via app):
-- Assume :trainer = auth.uid() of a test trainer, :client a text client_id with
-- an existing trainer_clients row.

-- TEST 1 (happy path): RPC writes profile AND flips the flag together.
--   select public.complete_client_onboarding(:trainer, :client,
--     '{"primary_goal":"strength","experience_level":"some","class_ready":"false"}'::jsonb);
--   select
--     (select count(*) from client_profiles where trainer_id=:trainer and client_id=:client) as profiles,
--     (select onboarding_complete from trainer_clients where trainer_id=:trainer and client_id=:client) as flag;
--   -- EXPECT: profiles = 1 AND flag = true.

-- TEST 3 (idempotent re-submit): calling twice keeps exactly one row.
--   select public.complete_client_onboarding(:trainer, :client, '{"primary_goal":"hypertrophy","class_ready":"true"}'::jsonb);
--   select count(*) from client_profiles where trainer_id=:trainer and client_id=:client;
--   -- EXPECT: 1 (updated, not duplicated). Requires the unique constraint (mig 1).

-- TEST 5 (authz): a different trainer cannot write for this pair.
--   -- Run while authed as a DIFFERENT trainer (trainer B):
--   select public.complete_client_onboarding(:trainer /* A */, :client, '{}'::jsonb);
--   -- EXPECT: ERROR  42501 not authorized, and NO new/changed rows.

-- TEST 2 (partial-failure rollback): force the profile insert to fail and prove
-- the flag did NOT flip. Simulate by passing a non-castable numeric field.
--   -- First set the flag false:
--   update trainer_clients set onboarding_complete=false where trainer_id=:trainer and client_id=:client;
--   -- Now call with a bad days_per_week that fails the ::int cast INSIDE the txn:
--   select public.complete_client_onboarding(:trainer, :client, '{"days_per_week":"not-a-number"}'::jsonb);
--   -- EXPECT: ERROR (invalid input syntax for integer).
--   select onboarding_complete from trainer_clients where trainer_id=:trainer and client_id=:client;
--   -- EXPECT: false — the flag update rolled back with the failed insert.

-- CLEANUP:
--   delete from client_profiles where trainer_id=:trainer and client_id=:client;
--   update trainer_clients set onboarding_complete=false where trainer_id=:trainer and client_id=:client;
