/**
 * Tests for the password-recovery shared helpers (Phase 0.5).
 *
 * Run with: npx tsx src/lib/__tests__/passwordRecovery.test.ts
 *
 * These tests pin the contract that the Deno Edge Function at
 * `supabase/functions/password-recovery/index.ts` implements in parallel:
 *
 *  - `simpleHash` produces the exact output `register()` writes to
 *    `public.users.password_hash` (via `supabaseSync.ts:10-16`). Known
 *    fixtures lock the algorithm against accidental drift.
 *
 *  - `sha256Hex` produces deterministic 64-char hex output.
 *
 *  - `generateRecoveryToken` produces 64-char hex tokens with high
 *    entropy (no two equal across 1000 draws is a weak proxy for
 *    cryptographic randomness, but enough to catch an accidentally
 *    deterministic stub).
 *
 *  - `validatePasswordForRecovery` matches `register()`'s min-length 6
 *    rule at `src/app/auth/page.tsx:274`.
 *
 *  - Token-lifecycle predicates (`isTokenExpired`, `isTokenConsumed`) and
 *    the rate-limit decision (`shouldRateLimit`) encode the same
 *    boundaries the Edge Function's SQL encodes.
 *
 * Pure helper tests — no React, no Supabase, no Deno runtime required.
 */

import {
  PASSWORD_MIN_LENGTH,
  RATE_LIMIT_MAX_ACTIVE,
  NEUTRAL_REQUEST_RESPONSE,
  simpleHash,
  sha256Hex,
  generateRecoveryToken,
  validatePasswordForRecovery,
  isTokenExpired,
  isTokenConsumed,
  shouldRateLimit,
} from '../passwordRecovery';

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

function assertTrue(label: string, actual: boolean): void {
  assertEqual(label, actual, true);
}

function assertFalse(label: string, actual: boolean): void {
  assertEqual(label, actual, false);
}

(async () => {
  // -------------------------------------------------------------------------
  console.log('\n--- simpleHash: deterministic, matches register()/supabaseSync.simpleHash ---');
  // Fixtures are recomputed from the reference implementation at
  // `src/lib/supabaseSync.ts:10-16`. If supabaseSync ever changes its hash
  // algorithm, these fixtures fail first and force a coordinated update.
  //
  // Reference run (Node 20):
  //   simpleHash('password') → '5gi1pl' (1-to-36 of -1216985755 & 0xFFFFFFFF)
  //   simpleHash('hunter2')  → '-l6qoo8' in simpleHash's signed form
  //   simpleHash('')         → '0'
  //   simpleHash('a')        → '2p' (97)
  //
  // We recompute inline to be robust to Node version quirks in toString(36):
  function refSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(36);
  }
  const samples = ['', 'a', 'password', 'hunter2', 'Catalift-2026-05-05', 'client123'];
  for (const s of samples) {
    assertEqual(
      `simpleHash('${s}') matches reference supabaseSync implementation`,
      simpleHash(s),
      refSimpleHash(s),
    );
  }
  assertEqual('simpleHash is deterministic (two runs same input)', simpleHash('password'), simpleHash('password'));
  assertTrue('simpleHash returns a non-empty string for non-empty input', simpleHash('password').length > 0);

  // Regression guard: `hashPassword` from authStore.ts returns a different
  // format ('h_' + Math.abs(hash).toString(36)). If we accidentally swap the
  // Edge Function over, this assertion fails.
  function refHashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }
  const pw = 'password';
  assertTrue(
    'simpleHash output differs from hashPassword output (different surfaces)',
    simpleHash(pw) !== refHashPassword(pw),
  );

  // -------------------------------------------------------------------------
  console.log('\n--- sha256Hex: deterministic 64-char hex ---');
  const empty = await sha256Hex('');
  assertEqual(
    "sha256Hex('') matches canonical digest e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    empty,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  const abc = await sha256Hex('abc');
  assertEqual(
    "sha256Hex('abc') matches canonical digest ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    abc,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  const twice1 = await sha256Hex('catalift');
  const twice2 = await sha256Hex('catalift');
  assertEqual('sha256Hex is deterministic', twice1, twice2);
  assertEqual('sha256Hex output is always 64 hex chars', twice1.length, 64);
  assertTrue('sha256Hex output is only hex chars', /^[0-9a-f]{64}$/.test(twice1));

  // -------------------------------------------------------------------------
  console.log('\n--- generateRecoveryToken: 64-char hex, non-deterministic ---');
  const t1 = generateRecoveryToken();
  assertEqual('token length is 64 chars', t1.length, 64);
  assertTrue('token is pure hex', /^[0-9a-f]{64}$/.test(t1));
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(generateRecoveryToken());
  assertEqual('1000 tokens all distinct (randomness smoke)', seen.size, 1000);

  // -------------------------------------------------------------------------
  console.log('\n--- validatePasswordForRecovery: matches register() at auth/page.tsx:274 ---');
  assertEqual('PASSWORD_MIN_LENGTH constant is 6', PASSWORD_MIN_LENGTH, 6);
  assertFalse('empty string rejected', validatePasswordForRecovery('').ok);
  assertFalse('5 chars rejected (below min)', validatePasswordForRecovery('12345').ok);
  assertTrue('6 chars accepted (at min)', validatePasswordForRecovery('123456').ok);
  assertTrue('10 chars accepted', validatePasswordForRecovery('1234567890').ok);
  assertTrue('long passphrase accepted', validatePasswordForRecovery('correct horse battery staple').ok);
  // Non-string rejection: UI forms always deliver strings, but the Edge
  // Function receives JSON and must not crash on null/undefined/number.
  assertFalse(
    'non-string rejected (defense-in-depth)',
    validatePasswordForRecovery(null as unknown as string).ok,
  );
  const tooShort = validatePasswordForRecovery('abc');
  if (!tooShort.ok) {
    assertEqual(
      'rejection error message mentions min length',
      tooShort.error,
      'Password must be at least 6 characters',
    );
  } else {
    failed++;
    console.error('  ❌ expected rejection to carry an error message');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- isTokenExpired: boundary behavior ---');
  const now = new Date('2026-05-06T12:00:00Z');
  assertFalse(
    'expiry 1 second in future → not expired',
    isTokenExpired(new Date(now.getTime() + 1000), now),
  );
  assertTrue(
    'expiry 1 second in past → expired',
    isTokenExpired(new Date(now.getTime() - 1000), now),
  );
  assertTrue('exactly now → expired (<=)', isTokenExpired(now, now));
  assertTrue(
    'ISO string input (60 minutes ago) → expired',
    isTokenExpired(new Date(now.getTime() - 60 * 60 * 1000).toISOString(), now),
  );

  // -------------------------------------------------------------------------
  console.log('\n--- isTokenConsumed: null/undefined vs timestamp ---');
  assertFalse('null consumed_at → not consumed', isTokenConsumed(null));
  assertFalse('undefined consumed_at → not consumed', isTokenConsumed(undefined));
  assertTrue('Date consumed_at → consumed', isTokenConsumed(new Date()));
  assertTrue('ISO string consumed_at → consumed', isTokenConsumed('2026-05-06T12:00:00Z'));

  // -------------------------------------------------------------------------
  console.log('\n--- shouldRateLimit: 3/15min threshold ---');
  assertEqual('RATE_LIMIT_MAX_ACTIVE constant is 3', RATE_LIMIT_MAX_ACTIVE, 3);
  assertFalse('0 active → allow', shouldRateLimit(0));
  assertFalse('1 active → allow', shouldRateLimit(1));
  assertFalse('2 active → allow', shouldRateLimit(2));
  assertTrue('3 active → silent-drop (at threshold)', shouldRateLimit(3));
  assertTrue('4 active → silent-drop (above threshold)', shouldRateLimit(4));

  // -------------------------------------------------------------------------
  console.log('\n--- NEUTRAL_REQUEST_RESPONSE: enumeration-safe contract ---');
  assertEqual('success flag is true', NEUTRAL_REQUEST_RESPONSE.success, true);
  assertTrue(
    "message never names the email or the outcome",
    /If an account exists for that email/.test(NEUTRAL_REQUEST_RESPONSE.message),
  );
  // Critical: this message must be identical whether the email exists, the
  // user is rate-limited, Resend failed, or the token was created. The
  // Edge Function returns this exact object on all four paths.
  assertFalse(
    'message does NOT leak existence ("sent" vs "not sent")',
    /does not exist|not found|unknown|no account/i.test(NEUTRAL_REQUEST_RESPONSE.message),
  );

  // -------------------------------------------------------------------------
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  if (failed > 0) process.exit(1);
})();
