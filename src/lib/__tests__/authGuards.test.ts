/**
 * Regression tests for the Sev-0 2026-05-04 forgot-password + setup-password
 * emergency disable. See `src/lib/authGuards.ts` for context.
 *
 * Run with: npx tsx src/lib/__tests__/authGuards.test.ts
 *
 * Scenario coverage (maps 1:1 to the Step 2B-EXPANDED routing-prompt test
 * expectations):
 *
 *  Test 1 — Forgot-password UI is globally disabled.
 *           `ENABLE_USER_PASSWORD_RESET === false` AND
 *           `shouldProcessForgotPasswordSubmit() === false`.
 *           The `/auth` page replaces the trigger button with contact
 *           copy and gates the modal render on this flag, so no Reset
 *           Password modal can open from any state.
 *
 *  Test 2 — `/auth?email=victim@example.com` (no `invite` token) MUST NOT
 *           open the setup-password flow. Only the login email is
 *           pre-filled. Exercises the bypass vector at
 *           `auth/page.tsx:74-80` (pre-fix).
 *
 *  Test 3 — `/auth?invite=VALID_TOKEN&email=X` (valid token) still opens
 *           the setup-password flow. Regression guard for the legitimate
 *           placeholder-claim path that trainer invitations depend on.
 *
 *  Test 4 — Invalid / expired / missing-token invite scenarios all
 *           block the setup-password flow. The old code path fell back
 *           to emailParam whenever `checkInvitationByToken` returned
 *           `{ valid: false }` or threw; that fallback is now removed.
 *
 * Pure helper tests — no React / store / Supabase mocking required.
 */

import {
  ENABLE_USER_PASSWORD_RESET,
  canOpenSetupPasswordFlow,
  shouldProcessForgotPasswordSubmit,
} from '../authGuards';

let passed = 0;
let failed = 0;

function assertEqual<T>(label: string, actual: T, expected: T): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(
      `  ❌ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`,
    );
  }
}

(() => {
  console.log('\n--- Test 1: forgot-password feature flag is hard-disabled ---');
  assertEqual(
    'ENABLE_USER_PASSWORD_RESET is false (Phase 1 will flip to true)',
    ENABLE_USER_PASSWORD_RESET,
    false,
  );
  assertEqual(
    'shouldProcessForgotPasswordSubmit() blocks the submit handler',
    shouldProcessForgotPasswordSubmit(),
    false,
  );

  console.log('\n--- Test 2: /auth?email=X (no invite) does NOT open setup flow ---');
  assertEqual(
    'null invite token → setup flow blocked',
    canOpenSetupPasswordFlow({ inviteToken: null, inviteValid: false }),
    false,
  );
  assertEqual(
    'undefined invite token → setup flow blocked',
    canOpenSetupPasswordFlow({ inviteToken: undefined, inviteValid: false }),
    false,
  );
  assertEqual(
    'empty-string invite token → setup flow blocked',
    canOpenSetupPasswordFlow({ inviteToken: '', inviteValid: false }),
    false,
  );
  assertEqual(
    'whitespace-only invite token → setup flow blocked',
    canOpenSetupPasswordFlow({ inviteToken: '   ', inviteValid: false }),
    false,
  );
  // Hostile defense-in-depth: even if a caller somehow passes `inviteValid:true`
  // with no token, the guard still blocks. This prevents a future refactor
  // from re-introducing the emailParam bypass by accident.
  assertEqual(
    'no token + inviteValid=true (should never happen) → still blocked',
    canOpenSetupPasswordFlow({ inviteToken: null, inviteValid: true }),
    false,
  );

  console.log('\n--- Test 3: /auth?invite=VALID_TOKEN opens setup flow (regression guard) ---');
  assertEqual(
    'valid token + inviteValid=true → setup flow opens',
    canOpenSetupPasswordFlow({ inviteToken: 'some-invite-token-abc', inviteValid: true }),
    true,
  );
  assertEqual(
    'short token + inviteValid=true → setup flow opens (length is not a gate here)',
    canOpenSetupPasswordFlow({ inviteToken: 'T', inviteValid: true }),
    true,
  );

  console.log('\n--- Test 4: invalid/expired tokens do NOT open setup flow ---');
  assertEqual(
    'token present but inviteValid=false (checkInvitationByToken rejected) → blocked',
    canOpenSetupPasswordFlow({ inviteToken: 'some-invite-token-abc', inviteValid: false }),
    false,
  );
  // Guards against JS truthiness quirks where callers might pass non-boolean.
  assertEqual(
    'token present but inviteValid="true" string (not === true) → blocked',
    canOpenSetupPasswordFlow({
      inviteToken: 'some-invite-token-abc',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inviteValid: 'true' as any,
    }),
    false,
  );
})();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
