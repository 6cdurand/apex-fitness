# Onboarding atomicity — review

## Root causes addressed
- **RC-1** — `handleFinish` fired two independent, un-awaited writes → now ONE
  atomic RPC (`complete_client_onboarding`); the client awaits it and only marks
  complete / navigates on success.
- **RC-2** — no `unique (trainer_id, client_id)` → added (migration 1); RPC uses
  `ON CONFLICT (trainer_id, client_id)`.
- **RC-3** — identity divergence prevention folded into migration 3 (identity-heal).
- **RC-4** — consultation workout was local-only → now `await syncWorkoutToSupabase`.
- **RC-5** — dead `static.exercisedb.dev` CDN → `<img> onError` fallback in
  `ExerciseImage.tsx` (map repoint deferred — see Follow-ups).
- **RC-6** — "unknown" name → `contactName` passed to the calendar event
  (resolveClientDisplayName priority 4). Client `display_name` is already
  persisted at account creation via `registerUserToSupabase`.

## Experience-test pass (trainer role)
- **Happy path** — profile + flag land atomically; UI mirrors instantly.
- **Server failure** — form stays, error toast, NOT marked complete, no navigate.
- **Double-submit** — `isSubmitting` guard + disabled buttons.
- **Auth mismatch** — RPC raises 42501; client shows "Not authorized", no retry.
- **Offline / transient** — 3 attempts w/ backoff before failing loudly.
- **Cross-device** — device B reads the SAME server state (profile present +
  flag set) because both were written in one transaction.

## Class / sign-off
Class B (SECURITY DEFINER RPC + migrations + RLS surface). Christo must:
1. Confirm live `client_profiles` schema (see changes.md) and reconcile the RPC.
2. Apply migrations 1→2→3 IN ORDER in the Supabase SQL editor.
3. Paste `pg_policies` output here before/after.
4. Deploy frontend; onboard a test client end-to-end on 2 devices.

## pg_policies snapshot (PASTE HERE)
```
-- select * from pg_policies where tablename in ('client_profiles','trainer_clients');
```

## Deviations / risks
- Live schema not verified from here (MCP points at v2) — RPC derived from the
  app write shape; **must reconcile before apply**.
- Denormalized `trainer_clients.goals/injuryHistory/notes` are now mirrored
  locally only (canonical answers live in `client_profiles`, per the canonical
  decision + read-path §4). If any server-side reader depends on those
  trainer_clients columns cross-device, revisit.
- DB-level tests (rollback/authz/idempotency) are provided as SQL to run against
  the live DB (`db-tests.sql`) — not runnable from here without v1 prod access.
