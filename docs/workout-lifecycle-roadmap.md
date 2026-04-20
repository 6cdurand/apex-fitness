# Workout lifecycle — reliability roadmap

**Status:** planning document. Nothing in this file is shipped yet.
Each section below is a separate workstream that needs its own scoping,
migration, and smoke test. Do not treat any section as "just go do it."

**Last updated:** 2026-04-21

---

## What's already shipped

These are resolved and in production as of commit `f5b73f1`:

- **Auth bootstrap no longer hangs the UI.** `@/Users/christofit7/apex-fitness/src/lib/stores/authStore.ts` has a local `withTimeout` on every `supabase.auth.*` call and bootstrap is fully decoupled from `isLoading`. Sign In / Create Account buttons can never be disabled by a hung session fetch again.
- **Shared `withTimeout` helper** at `@/Users/christofit7/apex-fitness/src/lib/asyncUtils.ts` (accepts `PromiseLike<T>` so it also wraps Supabase `PostgrestFilterBuilder`).
- **Session-workout resolver is bounded.** `@/Users/christofit7/apex-fitness/src/lib/sessionWorkoutResolver.ts` wraps its 6-step Supabase chain in a 12s outer timeout; failure returns `null` so callers degrade gracefully.
- **Start-session UI watchdog.** `@/Users/christofit7/apex-fitness/src/app/today/page.tsx` has a 15s belt-and-suspenders timer + `try/catch` that surfaces the real error text to the user.
- **Completion sync is bounded and visible.** `syncWorkoutToSupabase` / `syncPBToSupabase` / `syncMedalToSupabase` in `@/Users/christofit7/apex-fitness/src/lib/supabaseSync.ts` have internal timeouts (15s / 10s / 10s), and `@/Users/christofit7/apex-fitness/src/lib/stores/workoutStore.ts:endWorkout` now toasts on sync failure instead of silently eating the error.
- **Pure client-side demo mode** (no Supabase Auth involvement).
- **Sign-up error surfacing** maps `email_taken` / `weak_password` / `invalid_email` / `rate_limited` / `profile_update_failed` to specific toasts, not a blanket "email already exists" lie.

What the above does **not** do:

- No atomic server-side transactions for start/complete.
- No explicit `scheduled → in_progress → completed` state machine.
- No Realtime cross-device sync.
- No RLS audit beyond what's currently in migrations.
- No idempotency keys, offline queue, or retry.
- No tests.

Those are the A–H workstreams below.

---

## Workstream A — Explicit state machine

**Goal:** one canonical source of truth for workout/session status.

**Current state (grounded in code):**
- `workouts.status` is either `'active' | 'completed'` (plus a soft-delete flag elsewhere). See `@/Users/christofit7/apex-fitness/src/types`.
- `calendar_events.status` is patched to `'completed'` opportunistically from the client after `endWorkout` — see `@/Users/christofit7/apex-fitness/src/lib/stores/workoutStore.ts:332-352`. There is no `'in_progress'` state and no single source of truth.
- `trainer_sessions`, `session_workouts`, and `calendar_events` all carry partially-overlapping status fields.

**Proposed changes:**
1. Add migration: `ALTER TABLE workouts ADD COLUMN IF NOT EXISTS status_v2 text CHECK (status_v2 IN ('scheduled','in_progress','completed','cancelled'));` (dual-write during rollout, then cut over).
2. Add `started_at`, `completed_at`, `cancelled_at` timestamps on `workouts`.
3. Add a **partial unique index** to prevent duplicate active workouts:
   `CREATE UNIQUE INDEX workouts_one_active_per_user ON workouts(user_id) WHERE status_v2 IN ('scheduled','in_progress');`
4. Client-side: `endWorkout` / `startWorkout` set `status_v2` transactionally via RPC (workstream B).

**Effort:** ~1 day. **Risk:** medium — partial index needs backfill; any existing duplicate active rows will block the index creation.
**Depends on:** workstream D (migrations framework).
**Ready to ship standalone:** no — pair with B.

---

## Workstream B — Robust `start_workout` RPC

**Goal:** one server-side operation that validates, creates-or-reuses, marks scheduled, audits, returns payload. Idempotent.

**Current state:**
- Start path is entirely client-side: `@/Users/christofit7/apex-fitness/src/lib/sessionWorkoutResolver.ts` does 6 sequential calls, `@/Users/christofit7/apex-fitness/src/lib/stores/workoutStore.ts:startWorkout` creates the local `Workout`, `syncWorkoutToSupabase` fire-and-forgets.
- Duplicate active workouts are possible on double-tap if network is slow.

**Proposed RPC:** `public.start_workout(p_event_id uuid, p_client_id uuid, p_idempotency_key text) returns jsonb`

Behavior:
1. `SECURITY DEFINER`; function owner = `postgres`; `SET search_path = public, pg_temp`.
2. Validate caller is `auth.uid()` and either owns the calendar event OR is the assigned trainer.
3. Look up existing `workouts` row for `(user_id, event_id)` with `status_v2 IN ('scheduled','in_progress')`. If found → return it.
4. Otherwise insert new `workouts` row with `status_v2 = 'in_progress'`, `started_at = now()`.
5. If `p_event_id` provided, `UPDATE calendar_events SET status = 'in_progress' WHERE id = p_event_id AND (user_id = auth.uid() OR trainer_id = auth.uid())`.
6. Return `{ workout_id, status, started_at, blocks, session_workout_id }`.

Idempotency: `p_idempotency_key` persisted to a `start_workout_audit` table with a unique index on `(user_id, idempotency_key)`. Repeat calls within a window return the cached workout_id.

**Effort:** ~2–3 days. **Risk:** medium (SECURITY DEFINER needs careful auth check; getting RLS + SECURITY DEFINER to coexist cleanly takes thinking).
**Depends on:** A.
**Ready to ship standalone:** no — pair with A.

---

## Workstream C — Atomic `complete_workout` RPC

**Goal:** one server-side transaction that finalises a workout + all derived rows, or rolls everything back.

**Current state:**
- `@/Users/christofit7/apex-fitness/src/lib/stores/workoutStore.ts:endWorkout` does ~5 separate writes across `workouts`, `calendar_events`, `sessions`, `personal_bests`, `medals`, client-side. Any subset can fail independently (partial-write risk).
- Ships one toast per call path, no transactional semantics.

**Proposed RPC:** `public.complete_workout(p_workout_id uuid, p_summary jsonb) returns jsonb`

Steps inside a single transaction:
1. Validate caller owns workout OR is assigned trainer.
2. `UPDATE workouts SET status_v2='completed', end_time=now(), duration=..., total_volume=..., summary_snapshot=p_summary WHERE id=p_workout_id`.
3. `INSERT INTO block_performances (workout_id, block_id, ...) SELECT ...` from `p_summary -> 'blocks'`.
4. `INSERT INTO personal_bests ... ON CONFLICT (user_id, exercise_id) DO UPDATE` for each new PB in `p_summary -> 'pbs'`.
5. `INSERT INTO medals ... ON CONFLICT (user_id, definition_id) DO UPDATE` for each awarded medal.
6. If linked session: `UPDATE calendar_events SET status='completed'`, update `trainer_sessions`/`session_workouts` counters.
7. Optionally create `notifications` row for the trainer.
8. Return `{ workout_id, pbs_created, medals_awarded, session_marked_complete }`.

If any step throws, the whole thing rolls back. Client replaces the current in-store data with the RPC response (single source of truth).

**Effort:** ~3–5 days. **Risk:** high — `deriveAll` currently runs client-side and the PB/medal computation logic would need to be ported to SQL or remain client-side (computed payload passed into the RPC, which is simpler but means the server trusts the client's PB claims).

Pragmatic option: **keep `deriveAll` client-side**, have the client compute PBs + medals in JS, then pass `{ pbs, medals, block_performances }` as `p_summary` to the RPC which just writes them atomically. Server validates caller owns the workout; doesn't re-derive. This trades some integrity for dramatically smaller scope.

**Depends on:** A, B, D.

---

## Workstream D — Migrations + constraint alignment

**Goal:** schema exactly matches every `on_conflict` target in client code; `NOT NULL` + defaults on fields the business logic requires.

**Known constraint gaps:**
- `medals(user_id, definition_id)` unique index — already added (noted in user request).
- `personal_bests(user_id, exercise_id)` unique index — **needs verification**. `syncPBToSupabase` uses `.upsert(..., { onConflict: 'user_id,exercise_id' })` at `@/Users/christofit7/apex-fitness/src/lib/supabaseSync.ts:905-914`, so this constraint MUST exist or the upsert fails.
- `calendar_events` vs `session_workouts` linkage — `event.workout_id` pointing at `session_workouts.id` is a foreign key that may not exist.

**Migration plan:**

```sql
-- 20260422_01_workout_constraints.sql
-- Unique index for personal_bests upsert target
CREATE UNIQUE INDEX IF NOT EXISTS personal_bests_user_exercise_uq
  ON personal_bests(user_id, exercise_id);

-- Unique index for medals upsert target (assumed already applied)
CREATE UNIQUE INDEX IF NOT EXISTS medals_user_definition_uq
  ON medals(user_id, definition_id);

-- Prevent duplicate active workouts per user
CREATE UNIQUE INDEX IF NOT EXISTS workouts_one_active_per_user
  ON workouts(user_id)
  WHERE status IN ('active','in_progress');  -- keep in sync with workstream A

-- NOT NULL hardening for fields the app assumes
ALTER TABLE workouts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE workouts ALTER COLUMN start_time SET NOT NULL;
ALTER TABLE personal_bests ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE personal_bests ALTER COLUMN exercise_id SET NOT NULL;
```

Before applying: run the consistency-check script (workstream H) to find violating rows, clean them up, then apply.

**Effort:** ~0.5 day to write, ~1 day to clean up preexisting duplicates.
**Ready to ship standalone:** yes, with caveats — run the consistency script first.

---

## Workstream E — RLS hardening

**Goal:** users only read/write their own workout-result rows; trainers only touch assigned clients; RPCs work under `SECURITY DEFINER` safely.

**Current state:** identity-v2 migration (`@/Users/christofit7/apex-fitness/supabase/migrations/20260420_04_rls_tighten.sql` and `@/Users/christofit7/apex-fitness/supabase/migrations/20260421_01_users_auth_user_id.sql`) addresses `users` table RLS but we haven't audited:

- `workouts`
- `personal_bests`
- `medals`
- `block_performances`
- `session_workouts`
- `trainer_sessions`

Each needs a policy like:

```sql
-- workouts: owner can CRUD their own rows; assigned trainer can read.
CREATE POLICY workouts_self ON workouts
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY workouts_trainer_read ON workouts
  FOR SELECT USING (
    assigned_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.trainer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        AND tc.client_id = workouts.user_id
        AND tc.status = 'active'
    )
  );
```

RPCs from B and C use `SECURITY DEFINER` and embed the same ownership check in the function body. This must be audited — SECURITY DEFINER bypasses RLS by default so a flawed check is a privilege-escalation bug.

**Effort:** ~2–3 days (audit + test each table). **Risk:** high — wrong policies silently break writes; too-permissive policies leak data. Needs a dedicated test matrix.
**Depends on:** A, B, C (policies reference `status_v2`, RPC signatures).

---

## Workstream F — Cross-device realtime sync

**Goal:** booked sessions, status changes, and completed workouts propagate in near real-time to other devices.

**Proposed channels:**
- `supabase.channel('workouts:' + userId).on('postgres_changes', { event: '*', schema: 'public', table: 'workouts', filter: `user_id=eq.${userId}` }, ...)`.
- Same pattern for `calendar_events` (filter by `user_id` OR `trainer_id`) and `trainer_sessions`.

**Fallback:**
- On app foreground (`visibilitychange` listener already exists at `@/Users/christofit7/apex-fitness/src/app/today/page.tsx:100-117`), trigger a full refetch regardless.
- On realtime subscription `SUBSCRIBED` transition after a disconnect, refetch the delta.

**Reconciliation rule:** server `updated_at` wins over local optimistic state unless the local version is in an uncommitted edit buffer.

**Effort:** ~2–3 days. **Risk:** medium — realtime subscriptions are easy to start, hard to stop (leak listeners on route change). Every subscription needs a matching `channel.unsubscribe()` in a cleanup effect.

**Ready to ship standalone:** yes, but it compounds if A/B/C are ongoing.

---

## Workstream G — Client reliability

**Goal:** debounce + idempotency + offline queue + actionable errors.

**Concrete items:**
1. **Debounce start/complete buttons.** `handleStartSessionEvent` already has a `startingEventId` guard; extend same pattern to the "Finish Workout" button in `@/Users/christofit7/apex-fitness/src/app/workout/active/page.tsx`.
2. **Idempotency key.** Generate `crypto.randomUUID()` on first tap, pass to start/complete RPC (workstream B/C). Repeat taps in the same session reuse the key.
3. **Offline queue.** Wrap every `syncXToSupabase` call in a persistent queue (`localStorage`-backed) that retries on reconnect. Something like:
   ```ts
   // src/lib/syncQueue.ts
   enqueue({ type: 'workout', payload }) → retry with exponential backoff
   ```
4. **Error mapping.** Map Postgres error codes to UI messages:
   - `23505` (unique violation) → "This workout already exists."
   - `42501` (RLS denial) → "Permission denied. Sign out and back in."
   - `PGRST116` (Supabase no rows) → item-specific.
5. **`updated_at` / `version` reconciliation.** Every table gets an `updated_at` trigger; local state stamps its own `updated_at` on edit; on sync, later wins.

**Effort:** ~3–5 days. **Risk:** medium — the offline queue is easy to get wrong (data loss if users clear `localStorage` mid-queue).
**Ready to ship standalone:** items 1, 2, 4 — yes. Item 3 is its own workstream.

---

## Workstream H — Observability + tests + consistency script

**Structured logging:**
- Every start/complete call site emits a log with `{ request_id, user_id, workout_id, session_id, elapsed_ms }`.
- `request_id` is `crypto.randomUUID()`, propagated through RPC calls as a parameter and written to an `audit_log` table by the RPC.

**Integration tests (Playwright or Vitest + Supabase local):**
1. `start_workout` — happy path.
2. `start_workout` — repeated tap returns same workout_id (idempotency).
3. `complete_workout` — all-or-nothing success.
4. `complete_workout` — injected failure on medals step rolls back everything.
5. Realtime — device B sees workout_id appear within 2s of device A calling `complete_workout`.
6. RLS — trainer can read assigned-client workouts, cannot read unassigned-client workouts.

**Consistency check script:** `scripts/workout-consistency-check.ts` (Node, runs against prod with service role):
- Completed sessions without completed workouts.
- Completed workouts without block_performances rows.
- Completed workouts with PBs/medals that aren't in `personal_bests`/`medals`.
- Duplicate active workouts per `user_id`.

Prints a summary; optionally writes to an `integrity_report` table.

**Effort:** ~3 days for logging + script, ~5 days for the test suite.
**Ready to ship standalone:** yes, even before A–G. Running the consistency script now would likely find real issues.

---

## Recommended order

Ordered by **user impact per day of engineering**:

1. **D** (constraints + unique indexes) — prevents future partial-write bugs at the database level, low risk.
2. **H** consistency script — tells us what's already broken before we start fixing.
3. **C** (complete_workout RPC, pragmatic variant) — atomic writes on the hot path that users feel most.
4. **A** (state machine) + **B** (start_workout RPC) — prevents duplicate active workouts and makes start reliable end-to-end.
5. **E** (RLS audit) — required security hardening once RPCs exist.
6. **F** (realtime) — UX polish; requires A–C to be stable first.
7. **G** (offline queue + error mapping) — last, because it layers on top of everything.

Each is 2–5 days of focused engineering. **Total: 3–5 weeks of one engineer.**

---

## What we explicitly don't do

- Port `deriveAll` to SQL. Keep PB/medal derivation client-side and trust the signed payload sent to `complete_workout`.
- Break backwards compatibility with current mobile clients. All new columns are nullable with defaults; new RPCs coexist with old client calls during rollout.
- Rewrite all client stores. `workoutStore` + `trainerStore` + `authStore` stay; only sync boundaries change.
- Introduce a new backend framework / Edge Functions for items that fit as Postgres RPCs. Edge Functions are for non-transactional work (emails, webhooks).

---

## Rollout template (apply per workstream)

1. **Staging deploy** behind a feature flag (`NEXT_PUBLIC_USE_V2_WORKOUT_RPC`).
2. **Dual-write** period: client calls both old path and new RPC, compares results in logs.
3. **Read cutover** first, write cutover second.
4. **Post-deploy verification checklist:**
   - Consistency script reports zero drift.
   - Sentry / console error rate flat.
   - 95p latency for start/complete ≤ 500ms.
   - User-reported stuck-button / missing-data reports = 0 for 48h.
5. **Remove old code path** only after ≥ 7 days clean.
6. **Rollback plan:** flip feature flag off. Old path must remain intact until removal step.

---

## Questions for the user before any workstream starts

1. Is there a staging Supabase project, or are we working against prod with feature flags?
2. Are there existing clients on old schema versions (mobile app builds) that we can't force to upgrade?
3. What's the acceptable downtime window for migrations that need table locks (e.g., adding `NOT NULL` without a default to a large table)?
4. Is there an on-call rotation for post-deploy verification, or should every rollout be explicitly scheduled?

Do not start on any workstream without answers to these.
