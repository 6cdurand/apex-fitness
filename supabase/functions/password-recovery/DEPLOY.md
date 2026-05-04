# Deploying `password-recovery` Edge Function

Phase 0.5 magic-link password recovery. Spec: `catalift-command-center/PLAN_magic_link_recovery.md`.

## Prerequisites

1. `password_reset_tokens` table exists in the target Supabase project.
   The migration is authored by `catalift-data/` Cascade at
   `catalift-data/migrations/20260506_01_password_reset_tokens.sql`.
   Apply it via Supabase Dashboard → SQL Editor before deploying the
   function. Verify with:

   ```sql
   select count(*) from public.password_reset_tokens;
   ```

2. The following env vars are set in Supabase for the Edge Function:

   | Key | Value | Notes |
   |---|---|---|
   | `RESEND_API_KEY` | already set for `send-client-invite` | reuse |
   | `SUPABASE_URL` | auto-injected by Supabase | no action |
   | `SUPABASE_SERVICE_ROLE_KEY` | auto-injected by Supabase | no action |
   | `APP_URL` | `https://catalift.net` (prod) or staging URL | set per env |

   Confirm in Dashboard → Edge Functions → password-recovery → Settings
   after creation.

## Option A — Supabase CLI

```bash
# from catalift-web/apex-fitness
supabase functions deploy password-recovery
```

This uploads `supabase/functions/password-recovery/index.ts` and resolves
the `../_shared/email.ts` import on the Supabase side.

## Option B — Dashboard paste

If the CLI is not linked to the project:

1. Dashboard → Edge Functions → Create Function → name `password-recovery`.
2. Paste the entire contents of
   `supabase/functions/password-recovery/standalone.ts` into the editor.
3. Deploy.

The `standalone.ts` file inlines the `_shared/email.ts` helpers so the
Dashboard editor (which cannot resolve relative imports) builds cleanly.

## Post-deploy smoke

Replace `$BASE` with the deployed function URL (e.g.
`https://xxxxxxxxxx.supabase.co/functions/v1/password-recovery`) and
`$ANON` with the project anon key.

### 1. Unknown action → 400

```bash
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"action":"nope"}'
# Expected: {"success":false,"error":"Unknown action"}
```

### 2. Request — unknown email → neutral 200

```bash
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"action":"request","email":"nobody@nowhere.example"}'
# Expected: {"success":true,"message":"If an account exists for that email, a recovery link has been sent."}
# Expected: NO Resend email delivered (since the email is not in public.users)
```

### 3. Request — known email → neutral 200 + Resend email arrives

```bash
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"action":"request","email":"<your-test-inbox>"}'
# Expected: same neutral response
# Expected: email arrives within ~30s from hello@send.catalift.net
# Expected: reset link of shape $APP_URL/auth/reset-password?token=<64-hex>
```

### 4. Verify — invalid token → 400

```bash
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","token":"aaaaaaaa"}'
# Expected: {"success":false,"error":"Invalid or expired link"}
```

### 5. Verify — valid token → 200 + email

```bash
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","token":"<plaintext-token-from-email-url>"}'
# Expected: {"success":true,"email":"<your-test-inbox>"}
```

### 6. Commit — weak password → 400

```bash
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"action":"commit","token":"<plaintext-token>","new_password":"abc"}'
# Expected: {"success":false,"error":"Password must be at least 6 characters"}
```

### 7. Commit — valid password → 200

```bash
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"action":"commit","token":"<plaintext-token>","new_password":"newpass123"}'
# Expected: {"success":true}
```

### 8. Commit — reused token → 400

```bash
# Re-run the same request as #7 (same token).
# Expected: {"success":false,"error":"Invalid or expired link"}  (token consumed)
```

### 9. Rate limit — 4 requests within 15 min for same known email

```bash
for i in 1 2 3 4; do
  curl -sS -X POST "$BASE" \
    -H "Authorization: Bearer $ANON" \
    -H "Content-Type: application/json" \
    -d '{"action":"request","email":"<your-test-inbox>"}' && echo
done
# Expected: all 4 return the same neutral 200 JSON.
# Expected: only the first 3 actually deliver email; the 4th is silent-dropped.
# Verify in Resend dashboard or your inbox that only 3 emails arrived.
```

## Rollback

If something goes wrong in prod:

1. Flip `ENABLE_USER_PASSWORD_RESET` in `src/lib/authGuards.ts` back to
   `false`, commit, push, deploy web. This removes the UI trigger and
   gates the modal render — users cannot reach the function.
2. Optionally: Dashboard → Edge Functions → password-recovery → Pause
   the function to hard-block inbound requests.
3. The `password_reset_tokens` table can stay; unused rows expire after
   1 hour and are harmless.

## Files

- `index.ts` — runtime Edge Function. Imports `../_shared/email.ts` at
  build time; use with `supabase functions deploy`.
- `standalone.ts` — flattened copy for Dashboard paste. Inlines the
  `sendEmail` helper so no cross-file imports are needed. Keep in sync
  with `index.ts`.
- This file — deployment + smoke walkthrough.
