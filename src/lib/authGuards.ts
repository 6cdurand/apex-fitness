/**
 * Auth UI gating helpers for the /auth flow.
 *
 * Extracted as pure functions so the Sev-0 emergency-disable + setup-password
 * bypass fix can be regression-tested without pulling in a React testing
 * framework (see `src/lib/__tests__/authGuards.test.ts`).
 *
 * Context (Sev-0 2026-05-04):
 *  1. The in-app "Forgot password?" flow performed an unauthenticated write
 *     of `public.users.password_hash` keyed only by email, with no token or
 *     email-ownership verification. Reachable by any registered trainer
 *     via `/clients` → `fetchAllUsersFromSupabase()` → local `apex-users`
 *     seed → forgot-password submit.
 *  2. `/auth?email=X` (with no `invite` token) opened the setup-password
 *     flow for the supplied email, letting attackers either (a) rewrite a
 *     placeholder client's password or (b) register a new account in the
 *     victim's name.
 *
 * Phase 1 will rebuild both flows on top of a server-validated magic-link
 * token (Resend delivery, dedicated `/auth/reset-password?token=XXX` route,
 * Edge Function or Supabase Auth for validation). Until then, both attack
 * surfaces are closed by this module + the `/auth` page integration.
 */

/**
 * Feature flag for the in-app forgot-password flow.
 *
 * Phase 0.5 (2026-05-06): flipped `true` when the magic-link recovery flow
 * shipped. The Edge Function at
 * `supabase/functions/password-recovery/index.ts` owns the token issue +
 * commit paths; the UI on `/auth` + `/auth/reset-password` routes through it.
 *
 * While `true`:
 *  - The `/auth` page renders a functional "Forgot password?" trigger that
 *    opens the email-only recovery request modal.
 *  - The modal calls the `password-recovery` Edge Function's `request`
 *    action, which generates a token, stores its SHA-256 hash, and emails
 *    the plaintext link via Resend (enumeration-safe neutral response).
 *  - `/auth/reset-password?token=...` verifies + commits the new password
 *    via the Edge Function's `verify` and `commit` actions.
 *
 * Flipping back to `false` is the kill-switch if a magic-link regression
 * surfaces in prod (Sev-0 2026-05-04 playbook applies):
 *  - The `/auth` page swaps the trigger button for static
 *    "contact your trainer" copy.
 *  - The recovery request modal render is gated off.
 *  - `handleForgotPassword` short-circuits before hitting the Edge Function.
 *  - Reset link pages still verify, but users will bounce to `/auth`.
 */
export const ENABLE_USER_PASSWORD_RESET = true;

/**
 * Decides whether the `/auth` page should open the setup-password flow
 * (the first-login password-creation screen shown to invited clients).
 *
 * Rule: setup-password is ONLY legitimate when a non-empty invite token
 * has been verified against `client_invitations` via
 * `checkInvitationByToken` (caller passes the result as `inviteValid`).
 *
 * The previous implementation fell back to opening the setup flow whenever
 * an `?email=` URL parameter was present — even with no invite token or
 * with a token-lookup failure. That was the 2026-05-04 bypass vector; this
 * helper locks it down.
 */
export function canOpenSetupPasswordFlow(args: {
  inviteToken: string | null | undefined;
  inviteValid: boolean;
}): boolean {
  const token = (args.inviteToken ?? '').trim();
  if (token.length === 0) return false;
  return args.inviteValid === true;
}

/**
 * Whether the `/auth` forgot-password submit handler is allowed to run.
 * Mirrors `ENABLE_USER_PASSWORD_RESET` so the component can import a
 * single named helper (and tests can assert the block is in place).
 */
export function shouldProcessForgotPasswordSubmit(): boolean {
  return ENABLE_USER_PASSWORD_RESET;
}
