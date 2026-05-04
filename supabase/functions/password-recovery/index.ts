/**
 * Edge Function: password-recovery (Phase 0.5, 2026-05-06)
 *
 * Spec: catalift-command-center/PLAN_magic_link_recovery.md §Backend
 *
 * Single endpoint, three actions dispatched by the request body's `action`
 * field. All responses are JSON with the shared CORS headers.
 *
 *  - `request` : { action: 'request', email }
 *      Generate a token, store its SHA-256 hash in password_reset_tokens,
 *      send a Resend email to the user. Enumeration-safe: unknown emails,
 *      rate-limited users, Resend failures, and DB insert failures all
 *      return the same neutral 200 JSON. Never reveals account existence.
 *
 *  - `verify` : { action: 'verify', token }
 *      Hash the submitted plaintext token, look up the row where the hash
 *      matches AND `consumed_at IS NULL` AND `expires_at > now()`. Returns
 *      the associated user email on success so the UI can confirm what
 *      account is being reset.
 *
 *  - `commit` : { action: 'commit', token, new_password }
 *      Re-validate the token, write the new password_hash to public.users
 *      using the SAME `simpleHash` register() uses (not `hashPassword` from
 *      authStore.ts — that would break cross-device login), mark the
 *      token consumed.
 *
 * Reused helpers from `supabase/functions/_shared/email.ts`:
 *  - `EMAIL_SENDER` (enforced `@send.catalift.net` domain)
 *  - `sendEmail(apiKey, { to, subject, html })`
 *
 * Env vars required:
 *  - RESEND_API_KEY          (already configured for send-client-invite)
 *  - SUPABASE_URL            (Supabase project URL)
 *  - SUPABASE_SERVICE_ROLE_KEY (service-role key; bypasses RLS)
 *  - APP_URL                 (e.g. https://catalift.net; reset link base)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { sendEmail } from '../_shared/email.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://catalift.net';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Pure helpers — BYTE-IDENTICAL copies of `src/lib/passwordRecovery.ts`.
// Do not edit either side without updating both; the tests in
// `src/lib/__tests__/passwordRecovery.test.ts` pin the shared contract.
// ---------------------------------------------------------------------------

const PASSWORD_MIN_LENGTH = 6;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ACTIVE = 3;

const NEUTRAL_REQUEST_RESPONSE = {
  success: true,
  message: 'If an account exists for that email, a recovery link has been sent.',
};

/**
 * Byte-for-byte copy of `simpleHash` from `src/lib/supabaseSync.ts:16-24`.
 * See `src/lib/passwordRecovery.ts` for the Sev-0 2026-05-06 history on
 * why the return shape matters. This Deno copy cannot be imported from
 * `src/lib` (different runtime), so we rely on visual parity + the test
 * fixtures in `src/lib/__tests__/passwordRecovery.test.ts` to catch drift.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(36) + '_' + str.length;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRecoveryToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Supabase service-role client — one-shot factory so we surface env misconfig
// cleanly rather than crashing at first query.
// ---------------------------------------------------------------------------

function serviceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Action: request
// ---------------------------------------------------------------------------

async function handleRequest(body: { email?: string }, clientIp: string): Promise<Response> {
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    // Syntactically invalid: returning 400 here is still enumeration-safe —
    // it tells the attacker their input was malformed, not whether a
    // matching account exists.
    return jsonResponse(400, { success: false, error: 'Invalid email' });
  }

  let db;
  try {
    db = serviceClient();
  } catch (e) {
    console.error('[password-recovery:request] env misconfig:', e);
    return jsonResponse(200, NEUTRAL_REQUEST_RESPONSE);
  }

  // Case-insensitive lookup. `public.users.email` is a UNIQUE TEXT column;
  // lower()-indexed variants have historically been inconsistent here, so we
  // use ilike which matches case-insensitively regardless of stored case.
  const { data: user, error: userErr } = await db
    .from('users')
    .select('id, email, display_name')
    .ilike('email', email)
    .maybeSingle();

  if (userErr) {
    console.error('[password-recovery:request] user lookup failed:', userErr);
    return jsonResponse(200, NEUTRAL_REQUEST_RESPONSE);
  }
  if (!user) {
    // Unknown email → neutral 200. Never log the submitted email to avoid
    // building an enumeration log an attacker could scrape from infra.
    console.log('[password-recovery:request] unknown email → neutral 200');
    return jsonResponse(200, NEUTRAL_REQUEST_RESPONSE);
  }

  // Rate-limit: count non-consumed, non-expired tokens for this user created
  // in the last RATE_LIMIT_WINDOW_MS. At or above RATE_LIMIT_MAX_ACTIVE
  // (3), silent-drop the request.
  const nowIso = new Date().toISOString();
  const windowStartIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: activeCount, error: countErr } = await db
    .from('password_reset_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .gte('created_at', windowStartIso);

  if (!countErr && (activeCount ?? 0) >= RATE_LIMIT_MAX_ACTIVE) {
    console.log(
      `[password-recovery:request] rate-limited user=${user.id} active=${activeCount}`,
    );
    return jsonResponse(200, NEUTRAL_REQUEST_RESPONSE);
  }

  // Generate token, hash for storage, insert row.
  const plainToken = generateRecoveryToken();
  const tokenHash = await sha256Hex(plainToken);

  const { error: insertErr } = await db.from('password_reset_tokens').insert({
    user_id: user.id,
    token_hash: tokenHash,
    request_ip: clientIp || null,
  });
  if (insertErr) {
    console.error('[password-recovery:request] token insert failed:', insertErr);
    return jsonResponse(200, NEUTRAL_REQUEST_RESPONSE);
  }

  // Resend email.
  const firstName =
    (user.display_name as string | null)?.trim().split(/\s+/)[0] || 'there';
  const resetUrl = `${APP_URL}/auth/reset-password?token=${plainToken}`;
  const emailHtml = buildResetEmailHtml(firstName, resetUrl);

  const sendResult = await sendEmail(RESEND_API_KEY || '', {
    to: user.email as string,
    subject: 'Reset your Catalift password',
    html: emailHtml,
  });
  if (!sendResult.success) {
    console.error('[password-recovery:request] Resend failed:', sendResult.error);
    // Token row is already inserted; user can request again if no email
    // arrives. Response stays neutral to preserve enumeration safety even
    // under email-provider outage.
    return jsonResponse(200, NEUTRAL_REQUEST_RESPONSE);
  }

  return jsonResponse(200, NEUTRAL_REQUEST_RESPONSE);
}

// ---------------------------------------------------------------------------
// Action: verify
// ---------------------------------------------------------------------------

async function handleVerify(body: { token?: string }): Promise<Response> {
  const token = (body.token || '').trim();
  if (!token) {
    return jsonResponse(400, { success: false, error: 'Invalid or expired link' });
  }

  let db;
  try {
    db = serviceClient();
  } catch (e) {
    console.error('[password-recovery:verify] env misconfig:', e);
    return jsonResponse(500, { success: false, error: 'Server misconfigured' });
  }

  const tokenHash = await sha256Hex(token);
  const nowIso = new Date().toISOString();

  // Join to users so we can return the email back to the UI. The inner-join
  // semantics (`users!inner`) guarantee we only accept rows with an
  // accompanying user (defensive — FK ON DELETE CASCADE should keep these
  // aligned, but a bad migration could otherwise let orphan rows verify).
  const { data: row, error } = await db
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, consumed_at, users!inner(email)')
    .eq('token_hash', tokenHash)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (error || !row) {
    return jsonResponse(400, { success: false, error: 'Invalid or expired link' });
  }

  // Supabase returns the joined table as an object (maybeSingle) or an
  // array depending on how it resolves the FK. Handle both shapes.
  const joined = (row as { users: { email: string } | { email: string }[] }).users;
  const email = Array.isArray(joined) ? joined[0]?.email : joined?.email;
  if (!email) {
    return jsonResponse(400, { success: false, error: 'Invalid or expired link' });
  }

  return jsonResponse(200, { success: true, email });
}

// ---------------------------------------------------------------------------
// Action: commit
// ---------------------------------------------------------------------------

async function handleCommit(body: {
  token?: string;
  new_password?: string;
}): Promise<Response> {
  const token = (body.token || '').trim();
  const newPassword = body.new_password || '';

  if (!token) {
    return jsonResponse(400, { success: false, error: 'Invalid or expired link' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN_LENGTH) {
    return jsonResponse(400, {
      success: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    });
  }

  let db;
  try {
    db = serviceClient();
  } catch (e) {
    console.error('[password-recovery:commit] env misconfig:', e);
    return jsonResponse(500, { success: false, error: 'Server misconfigured' });
  }

  const tokenHash = await sha256Hex(token);
  const nowIso = new Date().toISOString();

  const { data: row, error: tokenErr } = await db
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (tokenErr || !row) {
    return jsonResponse(400, { success: false, error: 'Invalid or expired link' });
  }

  // CRITICAL: simpleHash (NOT hashPassword) to match register()'s on-disk
  // format at `public.users.password_hash`. See PLAN "CORRECTED 2026-05-05".
  const passwordHash = simpleHash(newPassword);

  const { error: updErr } = await db
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', row.user_id);
  if (updErr) {
    console.error('[password-recovery:commit] password update failed:', updErr);
    return jsonResponse(500, {
      success: false,
      error: 'Failed to update password. Please try again.',
    });
  }

  const { error: consumeErr } = await db
    .from('password_reset_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);
  if (consumeErr) {
    // Password has already been updated successfully; failing to mark the
    // token consumed only means a second click on the same link would also
    // "work" (re-setting the same password). Log and continue rather than
    // returning an error the user can't act on.
    console.error('[password-recovery:commit] consume failed (password already updated):', consumeErr);
  }

  return jsonResponse(200, { success: true });
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '';

  let body: { action?: string; [k: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body' });
  }

  try {
    switch (body.action) {
      case 'request':
        return await handleRequest(body as { email?: string }, clientIp);
      case 'verify':
        return await handleVerify(body as { token?: string });
      case 'commit':
        return await handleCommit(body as { token?: string; new_password?: string });
      default:
        return jsonResponse(400, { success: false, error: 'Unknown action' });
    }
  } catch (err) {
    console.error('[password-recovery] uncaught error:', err);
    return jsonResponse(500, { success: false, error: 'Internal server error' });
  }
});

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Email template — matches the visual language of send-client-invite/index.ts
// but with reset-specific copy per PLAN §"Email template".
// ---------------------------------------------------------------------------

function buildResetEmailHtml(firstName: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; margin: 0;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #111111; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #f97316 100%); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: white;">CATALIFT</h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Ignite Your Rise</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #ffffff;">
            Hi ${escapeHtml(firstName)},
          </h2>
          <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a1a1aa;">
            We received a request to reset your Catalift password.
          </p>
          <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a1a1aa;">
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}" rel="noreferrer" style="display: block; width: 100%; padding: 16px 24px; background: linear-gradient(135deg, #0ea5e9 0%, #f97316 100%); color: white; text-decoration: none; text-align: center; border-radius: 12px; font-weight: 600; font-size: 16px; box-sizing: border-box;">
            Reset My Password
          </a>
          <p style="margin: 24px 0 0 0; font-size: 12px; color: #71717a; text-align: center;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        <div style="padding: 20px 32px; border-top: 1px solid #262626; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #52525b;">
            © ${new Date().getFullYear()} Catalift. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
