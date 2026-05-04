/**
 * Password-recovery shared helpers (Phase 0.5, 2026-05-06).
 *
 * The canonical spec lives at:
 *   catalift-command-center/PLAN_magic_link_recovery.md
 *
 * This module hosts the pure, Node + browser compatible primitives that back
 * the `/auth/reset-password` UI and its client-side validation. The Deno
 * Edge Function at `supabase/functions/password-recovery/index.ts` carries
 * BYTE-IDENTICAL copies of these primitives (Deno cannot import from
 * `src/lib` because the Edge Function runs on Supabase's Deno runtime, not
 * the Next.js app). The regression tests in
 * `src/lib/__tests__/passwordRecovery.test.ts` lock down the contract so a
 * future drift between the two copies will be caught.
 *
 * DECISIONS (see PLAN_magic_link_recovery.md "CORRECTED 2026-05-05" block):
 *
 *  1. `simpleHash` is the hash used for `public.users.password_hash` writes.
 *     Register() writes via `supabaseSync.simpleHash`; the Edge Function's
 *     commit action MUST match bit-for-bit or users will be locked out of
 *     Supabase cross-device login after resetting their password. Do NOT
 *     substitute `hashPassword` from `authStore.ts` — different output.
 *
 *  2. Password min length is 6 to match `register()`'s validation at
 *     `src/app/auth/page.tsx:274`. Hardening the whole auth surface
 *     (register + login + reset + change-password) to a stronger policy is
 *     a Phase 1 ticket, not this PR.
 *
 *  3. Token shape: 32 random bytes, hex-encoded → 64-char string. SHA-256
 *     hashed before DB storage; plaintext only ever lives in the emailed
 *     URL. Never log the plaintext token.
 */

// ---------------------------------------------------------------------------
// Config constants (shared by UI + Edge Function)
// ---------------------------------------------------------------------------

/** Minimum password length — matches `register()` at `src/app/auth/page.tsx:274`. */
export const PASSWORD_MIN_LENGTH = 6;

/** Rate-limit window for `request` action: counts non-consumed, non-expired tokens. */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
/** Max allowed active recovery tokens inside the window before silent-drop. */
export const RATE_LIMIT_MAX_ACTIVE = 3;

/** Token expiry matches DB default `now() + interval '1 hour'`. */
export const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Enumeration-safe response returned to the client regardless of whether the
 * email exists, the rate-limit triggered, the Resend call failed, or the
 * token was created successfully. Same shape, same message, same 200 status.
 */
export const NEUTRAL_REQUEST_RESPONSE = {
  success: true,
  message: 'If an account exists for that email, a recovery link has been sent.',
} as const;

// ---------------------------------------------------------------------------
// simpleHash — ported verbatim from `src/lib/supabaseSync.ts:10-16`
// ---------------------------------------------------------------------------

/**
 * Exact copy of the private `simpleHash` function that `register()` uses to
 * write `public.users.password_hash`. Must stay byte-for-byte identical with
 * both `supabaseSync.ts` and the Edge Function's inline copy; the tests
 * pin all three to the same fixtures.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

// ---------------------------------------------------------------------------
// SHA-256 hex — Web Crypto, works in browser, Node 18+, and Deno
// ---------------------------------------------------------------------------

/**
 * Produces the hex-encoded SHA-256 of the input, using Web Crypto's
 * `crypto.subtle.digest`. Works in the browser, Node 18+ (via global
 * `crypto`), and Deno. Used to derive the stored `token_hash` from the
 * plaintext token at both the request (insert) and verify (lookup) sites.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Token generation — 32 random bytes, hex-encoded (64 chars)
// ---------------------------------------------------------------------------

/**
 * Cryptographically random 32-byte token, hex-encoded → always 64 chars.
 * Used server-side only (Edge Function request action); the UI never
 * generates tokens. Exposed here so the unit tests can exercise the shape
 * and randomness properties against an identical implementation.
 */
export function generateRecoveryToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Password validation — matches `register()` at `src/app/auth/page.tsx:274`
// ---------------------------------------------------------------------------

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validates a new password for the recovery commit action. Returns the same
 * error shape the Edge Function returns on the wire so the UI can use this
 * as a pre-flight check without second-guessing the server.
 *
 * Rule (locked to match `register()`): length >= 6. No character-class
 * requirements until the Phase 1 auth-surface hardening ticket.
 */
export function validatePasswordForRecovery(password: string): PasswordValidationResult {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Token lifecycle predicates — pure functions testable without a DB
// ---------------------------------------------------------------------------

/**
 * Returns true iff the token row is currently expired. The Edge Function's
 * DB query encodes the same condition (`expires_at > now()`), but exposing
 * it as a pure predicate lets the unit tests lock down the boundary
 * behavior (exactly-at-expiry, just-before, just-after).
 */
export function isTokenExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return exp.getTime() <= now.getTime();
}

/**
 * Returns true iff the token has been marked consumed. Trivial wrapper, but
 * named so the Edge Function and the tests can share an identical check
 * and future refactors (e.g., "consumed" becoming a multi-state enum)
 * update exactly one place.
 */
export function isTokenConsumed(consumedAt: Date | string | null | undefined): boolean {
  return consumedAt !== null && consumedAt !== undefined;
}

/**
 * Returns true iff a new `request` action should be silent-dropped for
 * enumeration safety under the rate-limit policy.
 *
 * The Edge Function computes `activeTokenCount` via a SQL COUNT over rows
 * where `user_id = $1 AND consumed_at IS NULL AND expires_at > now() AND
 * created_at >= now() - interval '15 minutes'`. This helper encodes the
 * final comparison so the UI and tests see the same threshold.
 */
export function shouldRateLimit(activeTokenCount: number): boolean {
  return activeTokenCount >= RATE_LIMIT_MAX_ACTIVE;
}
