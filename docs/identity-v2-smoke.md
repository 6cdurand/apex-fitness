# Identity v2 — smoke checklist

Run this checklist against the production (or a production-mirror) environment immediately after an atomic cutover. See also `supabase/migrations/20260420_*.sql` and `supabase/migrations/rollback_20260420.sql`.

## Environment

Required env vars in the deployed app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never `NEXT_PUBLIC_`.
- `ADMIN_RECONCILE_SECRET` — arbitrary long random string; required by `/api/admin/backfill` and `/api/admin/integrity`.
- `INTEGRITY_ALERT_WEBHOOK` — optional; POSTed by `fn_integrity_report` when it finds anything.
- `NEXT_PUBLIC_APP_URL` — used by the invite email to build the claim URL (`https://catalift.net` in prod).

## Supabase dashboard configuration

Go to **Authentication → URL Configuration** in the Supabase dashboard:

- **Site URL**: `https://catalift.net`
- **Redirect URLs (allowlist)** — each `redirectTo` the app ever passes must be listed here, or Supabase silently swaps it for the Site URL:
  - `https://catalift.net/auth/callback` (Google OAuth)
  - `https://catalift.net/auth/reset-password` (forgot-password link)
  - `http://localhost:3000/auth/callback` (local dev)
  - `http://localhost:3000/auth/reset-password` (local dev)

Without these entries the password-reset email link never reaches `/auth/reset-password` — the user is bounced back to the Site URL and the "Choose a new password" screen never renders. The page now surfaces `?error=access_denied&error_code=...` responses as a visible "Reset link not accepted" screen instead of failing silently.

**Email templates (Authentication → Email Templates → Reset Password)** — any of the three default shapes work with `/auth/reset-password`:

- Legacy implicit hash: `{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=recovery&redirect_to={{ .RedirectTo }}` → lands with `#access_token=…&type=recovery`.
- PKCE: same shape, lands with `?code=<code>` (the page calls `exchangeCodeForSession`).
- Token-hash / OTP (newer default): `{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery` → the page calls `verifyOtp({ token_hash, type: 'recovery' })`.

If you customise the template, keep the three query/hash shapes above — don't invent new parameter names.

## 1. Pre-cutover gate (read-only)

Verify there are no blockers before running the cutover:

```sql
-- 1a. Role drift (should be fixed automatically by migration 01 UPDATE, but
--     re-check here in case of manual edits after dump).
SELECT * FROM v_role_drift;

-- 1b. Duplicate emails (CRITICAL — resolve manually before backfill).
SELECT * FROM v_duplicate_emails;

-- 1c. Pending backfill count.
SELECT count(*) FROM users WHERE auth_migration_status = 'pending';

-- 1d. Pre-existing auth.users (should be rare; any row is a potential
--     collision with the backfill script).
SELECT id, email, created_at FROM auth.users;
```

If `v_duplicate_emails` returns rows, STOP — the backfill cannot disambiguate; clean them up first (merge + delete the duplicates).

## 2. Apply migrations

Order matters. Run in Supabase SQL editor or via `supabase db push`:

```
20260420_01_identity_backfill_prep.sql
20260420_02_id_uuid_tightening.sql
20260420_03_integrity_report.sql
20260420_04b_auth_user_trigger.sql
20260420_04_rls_tighten.sql      -- ← RLS lockdown comes LAST
```

After each: run `\d+ users` / `\d+ client_programs` / `\d+ trainer_clients` to confirm column types / constraints / policies.

## 3. Run the backfill

```bash
curl -X POST "https://catalift.net/api/admin/backfill" \
  -H "x-admin-secret: $ADMIN_RECONCILE_SECRET" \
  -H "content-type: application/json" \
  -d '{"dryRun": true}'
```

Expect a JSON report with `scanned`, `migrated`, `skipped`, `failed`, `failures[]`. Fix any `failed` entries (usually duplicate-email or auth-id-conflict cases surfaced in `identity_events`), then re-run without `dryRun`:

```bash
curl -X POST "https://catalift.net/api/admin/backfill" \
  -H "x-admin-secret: $ADMIN_RECONCILE_SECRET" \
  -H "content-type: application/json" \
  -d '{"dryRun": false, "sendRecoveryEmail": true}'
```

Every existing user receives a password-reset email. They click the link and land on `/auth/reset-password` to set their own password.

## 4. Manual flow checks

1. **User-only signup**
   - Visit `/auth`, register with a fresh email.
   - Expect redirect to `/today`.
   - In `public.users`, row has `is_trainer = false`, `account_status = 'active'`, `auth_migration_status = 'migrated'`.

2. **Trainer upgrade**
   - Log in as a user-only account. Go to settings, set trainer mode (or flip `is_trainer` via SQL for the test).
   - `/builder` becomes accessible; Zustand `user.isTrainer === true`.
   - `identity_events` should NOT show a drift event.

3. **OAuth (Google) — first-time**
   - Click "Continue with Google" on `/auth`, complete consent.
   - `/auth/callback` loads, redirects to `/today`.
   - `auth.users` and `public.users` have a row with matching id.

4. **OAuth — existing `public.users` by email**
   - Use a Google account whose email already has a backfilled `public.users` row (from step 3 of "run the backfill").
   - The on-trigger should reuse the same id; programs assigned before the cutover remain visible on `/program` immediately after sign-in.

5. **Password reset**
   - Click "Forgot password?" on `/auth`, submit email.
   - Check inbox → click reset link → `/auth/reset-password`.
   - Set new password → lands on `/today`, logged in.

6. **Invite + claim (core regression case)**
   - As a trainer, create a provisional client with an email (`karen+claim@example.com`).
   - Assign a program to that client in the trainer UI.
   - Issue the invitation (email delivered via the `send-client-invite` Edge Function).
   - Open the invite link in a private window → set password → `/today`.
   - Verify: `client_invitations.status = 'accepted'`, `public.users.account_status = 'active'`, `public.users.id` unchanged, program visible on `/program` for the new session.

7. **Two-device parity**
   - Log the same account in on two browsers.
   - Trainer assigns a new program from device A.
   - Device B: tab regains focus → refetch triggers → new program visible without reload.

## 5. Post-cutover integrity check

```bash
curl -X POST "https://catalift.net/api/admin/integrity" \
  -H "x-admin-secret: $ADMIN_RECONCILE_SECRET"
```

Expect `orphans_inserted: 0`, `drift_inserted: 0`, `duplicates_inserted: 0`. Anything non-zero gets reported to `INTEGRITY_ALERT_WEBHOOK`.

Recommended: schedule this route daily via Vercel cron (POST with header `x-vercel-cron: 1`, no secret needed when that header is present).

## 6. Rollback procedure

If anything goes wrong in the first 24 hours:

1. Re-deploy the previous app bundle (pre-cutover tag).
2. In Supabase SQL editor run `supabase/migrations/rollback_20260420.sql`. This restores permissive RLS policies on every table the old app reads.
3. Leave `auth.users` rows in place — the old app doesn't care about them.
4. Communicate: users who already set a new password via the recovery email can still use it after rollback (their public.users.password_hash was NOT overwritten). Users who haven't yet reset will continue to use the pre-cutover password_hash.
5. After root-causing, re-apply the cutover with fixes.

The follow-up migration `20260420_05_drop_legacy_password.sql` is intentionally **not** part of the cutover; only apply it after 14 days of clean metrics so rollback remains viable.

## 7. Known-clean cases

- `@placeholder.local` / `@client.apex` emails are intentionally skipped by the backfill (their `auth_migration_status` is set to `'skipped'`). They claim via the invite flow, at which point the provisional row transitions to `'active'`.
- An existing `auth.users` row whose id matches the `public.users.id` is a no-op win: the backfill marks it `'migrated'` and moves on.

## 8. Useful queries while monitoring

```sql
-- Delivery of programs to clients, latest first.
SELECT pr.program_id, pr.client_id, pr.received_at, u.email
FROM program_receipts pr JOIN users u ON u.id = pr.client_id
ORDER BY received_at DESC LIMIT 20;

-- Latest identity events.
SELECT event_type, user_id, payload, created_at
FROM identity_events ORDER BY created_at DESC LIMIT 50;

-- Unresolved integrity alerts.
SELECT alert_type, severity, table_name, row_id, payload, created_at
FROM integrity_alerts WHERE resolved = false ORDER BY created_at DESC;
```
