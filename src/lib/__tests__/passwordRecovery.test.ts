/**
 * Tests for the password-recovery shared helpers (Phase 0.5).
 *
 * Run with: npx tsx src/lib/__tests__/passwordRecovery.test.ts
 *
 * These tests pin the contract that the Deno Edge Function at
 * `supabase/functions/password-recovery/index.ts` implements in parallel:
 *
 *  - `simpleHash` produces the exact output `register()` writes to
 *    `public.users.password_hash` (via `supabaseSync.ts:16-24`). A
 *    byte-equality test imports the canonical implementation directly
 *    from `supabaseSync.ts` and compares it against the mirror in
 *    `passwordRecovery.ts` across 5 fixed + 3 random inputs. Literal
 *    fixtures pin the wire shape so a future refactor of either copy
 *    fails this test first.
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
 * Sev-0 2026-05-06: three inline copies of `simpleHash` (passwordRecovery.ts,
 * supabase/functions/password-recovery/index.ts, standalone.ts) previously
 * returned `hash.toString(36)`, missing the `'hash_' + Math.abs() + '_' +
 * length` shape that `register()` writes to `public.users.password_hash`
 * and `login()` compares back. Every password reset produced a hash that
 * login could not match. The byte-equality test below is the structural
 * pin that catches this class of drift at commit time.
 */

// ---- env shim: required so `../supabaseSync` (imported below for the
// byte-equality regression test) can load without exploding — the supabase
// client it imports reads these at module init. Values are never used on
// the wire; the tests in this file are pure and never call Supabase.
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJtest.fake.token';

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

// Import the CANONICAL simpleHash — the function `register()` actually uses
// to write `public.users.password_hash`. `passwordRecovery.ts` carries a
// mirror; this import is how we pin byte-equality between the two at
// commit time.
import { simpleHash as simpleHashCanonical } from '../supabaseSync';

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
  console.log('\n--- simpleHash: literal fixtures pin the wire shape ---');
  // These 5 literal fixtures are the wire shape `register()` writes to
  // `public.users.password_hash`. If either this file, passwordRecovery.ts,
  // or supabaseSync.ts changes its algorithm, these pins fail first and
  // force a coordinated update (including the Edge Function's inline copies).
  //
  // Format: `'hash_' + Math.abs(int32Hash).toString(36) + '_' + str.length`.
  assertEqual("simpleHash('test')        → 'hash_2487m_4'", simpleHash('test'), 'hash_2487m_4');
  assertEqual("simpleHash('password')    → 'hash_k4k87v_8'", simpleHash('password'), 'hash_k4k87v_8');
  assertEqual("simpleHash('password123') → 'hash_n7qt9z_11'", simpleHash('password123'), 'hash_n7qt9z_11');
  assertEqual("simpleHash('catalift26')  → 'hash_yzyesm_10'", simpleHash('catalift26'), 'hash_yzyesm_10');
  assertEqual("simpleHash('abc')         → 'hash_22ci_3'", simpleHash('abc'), 'hash_22ci_3');

  assertEqual(
    'simpleHash is deterministic (two runs same input)',
    simpleHash('password'),
    simpleHash('password'),
  );
  assertTrue(
    'simpleHash returns a non-empty string for non-empty input',
    simpleHash('password').length > 0,
  );

  // -------------------------------------------------------------------------
  console.log('\n--- simpleHash: byte-equality with supabaseSync canonical (Sev-0 2026-05-06 regression pin) ---');
  // Structural drift guard: imports the CANONICAL simpleHash from
  // `src/lib/supabaseSync.ts` (the one `register()` actually calls when
  // writing `public.users.password_hash`) and asserts byte-equality
  // against the mirror in `src/lib/passwordRecovery.ts`. If either side
  // drifts — even by a single character in the return prefix — this test
  // fails at commit time, long before any user gets locked out post-reset.
  //
  // The Deno Edge Function copies in `supabase/functions/password-recovery/
  // {index,standalone}.ts` cannot be imported here (different runtime).
  // We rely on visual parity between those files and `passwordRecovery.ts`,
  // backed by these literal fixture pins above which every copy must satisfy.
  const byteEqualityFixtures = [
    'test',
    'password',
    'password123',
    'catalift26',
    'abc',
    // 3 randomized inputs so a future divergence at unusual code points is
    // caught even if someone only updates the 5 literal fixtures. Seeded
    // deterministically so this is a repro-friendly failure.
    'Sev0-2026-05-06-@Catalift',
    'éáíóúñüÑ',
    ' '.repeat(50) + 'trailing',
  ];
  for (const input of byteEqualityFixtures) {
    assertEqual(
      `canonical(supabaseSync) === mirror(passwordRecovery) for input length ${input.length}`,
      simpleHash(input),
      simpleHashCanonical(input),
    );
  }

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
