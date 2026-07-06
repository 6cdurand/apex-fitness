# Onboarding atomicity — changes

Branch: `fix/onboarding-atomicity` (off `origin/main`).

## ⚠️ REQUIRED before applying migrations — confirm live schema

My Supabase MCP is pointed at the **v2** project (`igagmdkdzjkxrwnyvgqk`), NOT v1
prod (`pjkqfoeahcpvugolmxew`). I could **not** query the live `client_profiles`
schema. The RPC columns were derived from the app's actual write shape in
`supabaseSync.ts → syncClientProfileToSupabase` (the real contract). Before
applying `20260706_2_*`, run in the v1 Supabase SQL editor and reconcile any
drift:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'client_profiles'
order by ordinal_position;
```

If `client_profiles` does NOT exist in prod, that alone explains the missing
rows (every upsert 404s silently) — create it with the columns below, enable
RLS, and add policy `using/with check (trainer_id = auth.uid())`.

### Columns the app reads/writes (from syncClientProfileToSupabase)
`id, client_id, trainer_id, primary_goal, secondary_goal, custom_goal_text,
training_preference, experience_level, injury_flags (text/json), injury_notes,
days_per_week (int), available_days (text/json), schedule_notes,
session_length (int), train_alone_outside_pt, movement_confidence (text/json),
wants_classes, class_ready (bool), sleep_quality (int), stress_level (int),
job_activity, current_phase, progression_plan (text/json|null),
created_at, updated_at`

## RLS / policy snapshot — REQUIRED before applying

Paste the output of this into `review.md`:

```sql
select * from pg_policies where tablename in ('client_profiles','trainer_clients');
```

## Migrations (apply IN ORDER, manually, in Supabase SQL editor)

1. `supabase/migrations/20260706_1_onboarding_constraints.sql`
   dedupe + `unique (trainer_id, client_id)` + indexes. **Apply first** (the RPC
   uses `ON CONFLICT (trainer_id, client_id)`).
2. `supabase/migrations/20260706_2_complete_client_onboarding_rpc.sql`
   `complete_client_onboarding(uuid, text, jsonb)` SECURITY DEFINER — atomic
   profile upsert + `onboarding_complete=true` in one transaction.
3. `supabase/migrations/20260706_3_onboarding_backfill_and_identity_heal.sql`
   DATA migration — read the diagnostic SELECTs first, then the guarded updates.

## Frontend

- `src/lib/supabaseSync.ts` — new `completeClientOnboarding(trainerId, clientId,
  profile, rpc?)` + `buildOnboardingPayload` + `CompleteOnboardingResult`.
  Retry/backoff (3 attempts, 300/600ms) on transient; NO retry on `42501`/`P0002`.
- `src/app/clients/[id]/onboarding/page.tsx` — `handleFinish` is now `async`:
  awaits the RPC, and ONLY on success mirrors local store (via `setState`, no
  second Supabase write) + books session + saves workout + navigates. On failure
  it keeps the form, shows a toast, does not mark complete. Also:
  - RC-4: `await syncWorkoutToSupabase(consultWorkout)` before local set.
  - RC-6: `contactName: accountName` on the calendar event.
  - RC-9: `onboarding_started/saved/completed/failed` console events w/ requestId.
  - Submit buttons disabled + spinner while `isSubmitting`.
- `src/components/ExerciseImage.tsx` — RC-5: `onError` on `<img>` records the
  dead URL and falls through to the AI-image fetch / empty state.

## Tests

- `src/lib/__tests__/completeClientOnboarding.test.ts` — 19 assertions, all pass.
  `npx tsx src/lib/__tests__/completeClientOnboarding.test.ts`
- DB-level tests (rollback / authz / idempotency) require the live DB after
  migrations — see `db-tests.sql`.
