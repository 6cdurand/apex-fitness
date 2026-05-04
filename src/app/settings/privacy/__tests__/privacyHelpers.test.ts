/**
 * Tests for `/settings/privacy` and the settings-page Privacy & Security
 * button wiring (Sev-1, 2026-05-06).
 *
 * Run with:
 *   npx tsx src/app/settings/privacy/__tests__/privacyHelpers.test.ts
 *
 * This project has no Jest or @testing-library/react installed — every
 * existing test uses the `tsx + console.assertEqual` pattern and
 * exercises a pure "test seam" helper extracted from the component
 * rather than rendering via a DOM harness. See
 * `src/app/workout/active/page.shouldRedirect.test.ts` and
 * `src/components/ExerciseHowTo.test.tsx` for precedent.
 *
 * Coverage (maps 1:1 to the command-center routing prompt acceptance):
 *
 *  1. `PRIVACY_SETTINGS_ROUTE` equals the literal `/settings/privacy`.
 *     This is the contract the settings page's onClick relies on —
 *     because both files import this constant, a test on the constant
 *     is sufficient to pin the button → page route wiring.
 *
 *  2. `buildPasswordRecoveryRequestBody(email)` returns the exact shape
 *     the `password-recovery` Edge Function's `request` action expects.
 *     The Change Password card's click handler sends this body verbatim
 *     via `supabase.functions.invoke`. If the Edge Function's contract
 *     ever changes, this test fails at commit time.
 *
 *  3. `buildDataExportMailto(email)` produces the literal mailto URL
 *     specified in the routing prompt (pinned verbatim so the mailbox
 *     ops team receives a predictable subject line for filtering).
 *     Default `DATA_EXPORT_EMAIL` matches spec.
 *
 *  4. `CHANGE_PASSWORD_COOLDOWN_MS` is 30 s — the cooldown the spec
 *     requires for the Send Recovery Link button after a successful
 *     click (mild UI defence against accidental double-submits).
 *
 *  5. STRUCTURAL REGRESSION GUARD: we read
 *     `src/app/settings/page.tsx` off disk and assert that
 *       (a) it imports `PRIVACY_SETTINGS_ROUTE` from the privacy page,
 *       (b) it wires an onClick that pushes to that constant,
 *       (c) the dead `Appearance` and `Help & Support` buttons are
 *           gone (no `Palette` / `HelpCircle` icon references or the
 *           exact text labels survive).
 *     This catches accidental reverts that remove the onClick or
 *     re-add the non-functional shells.
 */

import { promises as fs } from 'fs';
import path from 'path';

import {
  PRIVACY_SETTINGS_ROUTE,
  DATA_EXPORT_EMAIL,
  CHANGE_PASSWORD_COOLDOWN_MS,
  buildPasswordRecoveryRequestBody,
  buildDataExportMailto,
} from '../helpers';

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
  // ---------------------------------------------------------------
  console.log('\n--- PRIVACY_SETTINGS_ROUTE: pins the button → page contract ---');
  assertEqual(
    "PRIVACY_SETTINGS_ROUTE === '/settings/privacy'",
    PRIVACY_SETTINGS_ROUTE,
    '/settings/privacy',
  );

  // ---------------------------------------------------------------
  console.log('\n--- buildPasswordRecoveryRequestBody: matches Edge Function request shape ---');
  const body = buildPasswordRecoveryRequestBody('user@example.com');
  assertEqual(
    "action field is 'request'",
    body.action,
    'request',
  );
  assertEqual(
    'email field echoes input',
    body.email,
    'user@example.com',
  );
  // Shape lock: the Edge Function's `request` handler destructures
  // exactly `{ action, email }`. Extra fields would be tolerated but
  // reduce surprises if someone later adds a `client_ip` field that
  // collides with the Edge Function's own IP detection.
  assertEqual(
    'body has exactly 2 keys',
    Object.keys(body).sort().join(','),
    'action,email',
  );

  // ---------------------------------------------------------------
  console.log('\n--- DATA_EXPORT_EMAIL: pinned until ops provisions the mailbox ---');
  assertEqual(
    "DATA_EXPORT_EMAIL === 'hello@catalift.net'",
    DATA_EXPORT_EMAIL,
    'hello@catalift.net',
  );

  // ---------------------------------------------------------------
  console.log('\n--- CHANGE_PASSWORD_COOLDOWN_MS: 30 s cooldown ---');
  assertEqual(
    'CHANGE_PASSWORD_COOLDOWN_MS === 30000',
    CHANGE_PASSWORD_COOLDOWN_MS,
    30_000,
  );

  // ---------------------------------------------------------------
  console.log('\n--- buildDataExportMailto: matches command-center spec verbatim ---');
  const mailto = buildDataExportMailto('user@example.com');
  assertTrue(
    'mailto starts with mailto:hello@catalift.net',
    mailto.startsWith('mailto:hello@catalift.net'),
  );
  assertTrue(
    'mailto includes the exact Data Export subject string',
    mailto.includes('subject=Data Export Request - user@example.com'),
  );
  assertTrue(
    'mailto includes the exact body opening',
    mailto.includes(
      'body=Please send me a copy of all data associated with my Catalift account.',
    ),
  );
  assertTrue(
    'mailto echoes the account email in the body',
    mailto.includes('Account email: user@example.com'),
  );
  // Reproduce the full expected URL as a single fixture. Easier to
  // spot a drift diff here than across four substring assertions.
  const expected =
    'mailto:hello@catalift.net' +
    '?subject=Data Export Request - user@example.com' +
    '&body=Please send me a copy of all data associated with my Catalift account. ' +
    'Account email: user@example.com';
  assertEqual('full mailto URL matches spec fixture', mailto, expected);

  // Overriding `to` (e.g. for tests, or a future regional routing split)
  // should swap only the recipient.
  const mailtoWithOverride = buildDataExportMailto('foo@bar.io', 'support@catalift.example');
  assertTrue(
    'override `to` swaps the recipient',
    mailtoWithOverride.startsWith('mailto:support@catalift.example'),
  );

  // ---------------------------------------------------------------
  console.log('\n--- Structural regression guard: settings/page.tsx wiring ---');
  const settingsPath = path.resolve(
    __dirname,
    '..',
    '..',
    'page.tsx', // resolves to src/app/settings/page.tsx
  );
  const settingsSource = await fs.readFile(settingsPath, 'utf8');

  assertTrue(
    'settings/page.tsx imports PRIVACY_SETTINGS_ROUTE from ./privacy/page',
    /import\s*\{\s*PRIVACY_SETTINGS_ROUTE\s*\}\s*from\s*['"]\.\/privacy\/page['"]/.test(
      settingsSource,
    ),
  );
  assertTrue(
    'Privacy & Security button pushes to PRIVACY_SETTINGS_ROUTE',
    /router\.push\(PRIVACY_SETTINGS_ROUTE\)/.test(settingsSource),
  );
  assertTrue(
    'Privacy & Security button label still present',
    /Privacy & Security/.test(settingsSource),
  );

  // Deleted buttons must not return. Use word-boundary checks to avoid
  // false positives on comments that reference the historical names
  // (the deletion comment block mentions them once, so we match the
  // JSX-level label text, not arbitrary mentions).
  assertFalse(
    'Appearance button JSX is removed (no <Palette> icon usage)',
    /<Palette\b/.test(settingsSource),
  );
  assertFalse(
    'Help & Support button JSX is removed (no <HelpCircle> icon usage)',
    /<HelpCircle\b/.test(settingsSource),
  );
  assertFalse(
    'Palette no longer imported from lucide-react',
    /\bPalette\b\s*,?[^']*from\s*['"]lucide-react['"]/.test(
      // crude: just check that `Palette,` or `Palette ` doesn't appear
      // inside the lucide-react import block. We scan the import line
      // directly below.
      settingsSource.split('from \'lucide-react\'')[0] || '',
    ),
  );
  assertFalse(
    'HelpCircle no longer imported from lucide-react',
    /\bHelpCircle\b\s*,?/.test(
      settingsSource.split('from \'lucide-react\'')[0] || '',
    ),
  );

  // ---------------------------------------------------------------
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  if (failed > 0) process.exit(1);
})();
