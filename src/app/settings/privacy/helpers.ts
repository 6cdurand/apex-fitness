/**
 * Pure test-seam helpers for `/settings/privacy` (Sev-1, 2026-05-06).
 *
 * Extracted from `page.tsx` so the unit tests can import them without
 * dragging in React, Zustand's persist middleware, the Supabase client,
 * or any other module-load side-effect. See
 * `src/app/settings/privacy/__tests__/privacyHelpers.test.ts`.
 *
 * Keep this file free of runtime dependencies (no `next/*`, no `@/lib/*`,
 * no DOM globals beyond what a pure string builder needs).
 */

/**
 * Canonical route for the Privacy & Security page. Both the page module
 * and `src/app/settings/page.tsx` import this constant, so the button's
 * onClick and the filesystem route can never drift. The regression test
 * pins this to `'/settings/privacy'` and also greps the settings file
 * to confirm the onClick uses the constant (not a hard-coded string).
 */
export const PRIVACY_SETTINGS_ROUTE = '/settings/privacy';

/**
 * Data-export support inbox.
 *
 * NOTE (2026-05-06): ops is provisioning the mailbox — MX records + the
 * mailbox provider (likely Google Workspace) are not yet live. Until
 * provisioning completes, mailto links will bounce. Tracked in
 * command-center BACKLOG: "privacy/data-export-mailbox".
 */
export const DATA_EXPORT_EMAIL = 'hello@catalift.net';

/**
 * How long the Change Password button stays disabled after a click.
 * The `password-recovery` Edge Function's own 3-in-15-min rate limit is
 * the real defence against abuse; this is UI hygiene so a jumpy
 * double-click doesn't fire two invocations before the first toast
 * lands.
 */
export const CHANGE_PASSWORD_COOLDOWN_MS = 30_000;

/**
 * Request body the Change Password card sends to the `password-recovery`
 * Edge Function. Matches the `request` action's expected shape; the
 * function returns the enumeration-safe `NEUTRAL_REQUEST_RESPONSE` from
 * `src/lib/passwordRecovery.ts` regardless of whether the email exists.
 */
export function buildPasswordRecoveryRequestBody(
  email: string,
): { action: 'request'; email: string } {
  return { action: 'request', email };
}

/**
 * Builds the `mailto:` URL for the "Email me my data" button. Extracted
 * as a pure helper so the data-export test can pin the string shape
 * without touching `window.location`.
 *
 * The subject/body are written verbatim (no `encodeURIComponent`) to
 * match the command-center routing prompt and keep the preview text
 * human-readable in mail clients that render it (Gmail, Apple Mail all
 * tolerate the `-` and spaces in the query string).
 */
export function buildDataExportMailto(
  accountEmail: string,
  to: string = DATA_EXPORT_EMAIL,
): string {
  const subject = `Data Export Request - ${accountEmail}`;
  const body =
    `Please send me a copy of all data associated with my Catalift account. ` +
    `Account email: ${accountEmail}`;
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
