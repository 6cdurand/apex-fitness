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
 * HARD-DISABLED feature flag for the in-app forgot-password flow.
 *
 * While `false`:
 *  - The "Forgot password?" trigger button is replaced with static
 *    "contact your trainer" copy on `/auth` (no way to open the modal).
 *  - The Reset Password modal JSX render is gated so even a stale
 *    `showForgotPassword=true` state cannot surface UI.
 *  - The `handleForgotPassword` submit handler short-circuits before any
 *    Supabase write.
 *
 * Must remain `false` until the magic-link-with-server-validated-token
 * rebuild ships in Phase 1.
 */
export const ENABLE_USER_PASSWORD_RESET = false;

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
