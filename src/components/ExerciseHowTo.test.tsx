/**
 * Tests for the ExerciseHowTo popup scoping logic — Track A deliverable A1
 * (PLAN_exercise_history.md §A1, Hendrik repro + W9).
 *
 * Run with:
 *   npx tsx src/components/ExerciseHowTo.test.tsx
 *
 * Strategy:
 *  The component's history/PB lookups go through two pure helpers exported
 *  from ExerciseHowTo.tsx. Testing those helpers directly covers the
 *  behavioural contract (popup reads from getActiveUserId(), not from the
 *  auth user) without needing a full React DOM harness. Same pattern as
 *  `SupabaseSync.identityNormalization.test.tsx` which tests
 *  `__decideIdentityNormalization` rather than rendering the component.
 *
 * Coverage (per routing):
 *  1. `resolveScopedUserId` returns getActiveUserId() when a workout is
 *     active (trainer running a PT session → client id).
 *  2. `resolveScopedUserId` falls back to auth user.id when no active
 *     workout (trainer viewing the popup outside a session).
 *  3. `resolveScopedUserId` falls back to auth user.id when the workout
 *     store returns null/empty for the active id.
 *  4. `isMaleForUser` returns the trainer's gender flag when
 *     scopedUserId === auth user.id (self-case).
 *  5. `isMaleForUser` returns the CLIENT's gender when scopedUserId
 *     points at a trainer-store client (PT-session case — the whole
 *     point of W9). Female client → false, male client → true.
 *  6. `isMaleForUser` defaults to true when the scoped user can't be
 *     located in either auth or trainer-clients (matches today's
 *     default so legacy callers don't regress).
 */

// ---- tiny assertion runner -------------------------------------------
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ❌ ${name}\n     ${e?.message ?? e}`);
  }
}
function assertEqual<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

import { resolveScopedUserId, isMaleForUser } from './ExerciseHowTo';

// =========================================================================

console.log('\n--- resolveScopedUserId: active-workout user wins ---');

test('returns getActiveUserId() when a workout is active (PT session → client id)', () => {
  assertEqual(
    resolveScopedUserId('client-hendrik', 'trainer-christo'),
    'client-hendrik',
    'scoped id is the client, not the trainer',
  );
});

test('falls back to auth user.id when no active workout', () => {
  assertEqual(
    resolveScopedUserId(null, 'trainer-christo'),
    'trainer-christo',
    'no active workout → self',
  );
});

test('falls back to auth user.id when active id is undefined', () => {
  assertEqual(
    resolveScopedUserId(undefined, 'trainer-christo'),
    'trainer-christo',
    'undefined active id → self',
  );
});

test('returns undefined when neither is present (not authenticated, no workout)', () => {
  assertEqual(resolveScopedUserId(null, null), undefined, 'no ids at all → undefined');
  assertEqual(resolveScopedUserId(undefined, undefined), undefined, 'both undefined → undefined');
});

test('empty-string active id does NOT mask auth id (avoids accidental trainer→"" lookup)', () => {
  // getActiveUserId() in workoutStore returns '' when currentClientId is
  // falsy AND user is null (defensive fallback in the store).
  // An empty id must not be treated as "active" — fall back to auth.
  assertEqual(
    resolveScopedUserId('', 'trainer-christo'),
    'trainer-christo',
    'empty-string active id → auth fallback',
  );
});

// =========================================================================

console.log('\n--- isMaleForUser: self-case reads trainer auth gender ---');

test('self-case: scopedUserId === auth user.id → uses auth gender (male)', () => {
  const authUser = { id: 'trainer-christo', gender: 'male' as const };
  assertEqual(
    isMaleForUser('trainer-christo', authUser, []),
    true,
    'male auth user → true',
  );
});

test('self-case: auth gender female → false', () => {
  const authUser = { id: 'trainer-alice', gender: 'female' as const };
  assertEqual(
    isMaleForUser('trainer-alice', authUser, []),
    false,
    'female auth user → false',
  );
});

test('self-case: auth gender "other" → true (same default as today: anything not "female")', () => {
  const authUser = { id: 'trainer-sam', gender: 'other' as const };
  assertEqual(
    isMaleForUser('trainer-sam', authUser, []),
    true,
    'non-female auth gender → true (matches legacy `user.gender !== \'female\'` predicate)',
  );
});

// =========================================================================

console.log('\n--- isMaleForUser: PT-session reads CLIENT gender (W9 core fix) ---');

test('PT session with female client (Hendrik-repro-analog): reads client.gender, not trainer.gender', () => {
  const authUser = { id: 'trainer-christo', gender: 'male' as const };
  const clients = [
    { clientId: 'client-alice', client: { gender: 'female' as const } },
  ];
  // Trainer is male; client is female. Popup must reflect the CLIENT.
  assertEqual(
    isMaleForUser('client-alice', authUser, clients),
    false,
    'female client → false even though trainer is male',
  );
});

test('PT session with male client: returns true from client.gender', () => {
  const authUser = { id: 'trainer-alice', gender: 'female' as const };
  const clients = [
    { clientId: 'client-bob', client: { gender: 'male' as const } },
  ];
  // Trainer is female; client is male. Popup must reflect the CLIENT.
  assertEqual(
    isMaleForUser('client-bob', authUser, clients),
    true,
    'male client → true even though trainer is female',
  );
});

test('PT session: picks the right client when multiple are loaded', () => {
  const authUser = { id: 'trainer-christo', gender: 'male' as const };
  const clients = [
    { clientId: 'client-alice', client: { gender: 'female' as const } },
    { clientId: 'client-bob', client: { gender: 'male' as const } },
    { clientId: 'client-carol', client: { gender: 'female' as const } },
  ];
  assertEqual(
    isMaleForUser('client-carol', authUser, clients),
    false,
    'looked up carol (female), not alice/bob',
  );
});

// =========================================================================

console.log('\n--- isMaleForUser: defaults when lookup fails ---');

test('default true when scopedUserId is undefined', () => {
  assertEqual(
    isMaleForUser(undefined, null, []),
    true,
    'no scoped user → default true',
  );
});

test('default true when scoped client is not in trainer-clients (unknown)', () => {
  const authUser = { id: 'trainer-christo', gender: 'male' as const };
  assertEqual(
    isMaleForUser('client-not-loaded', authUser, []),
    true,
    'unknown client → default true',
  );
});

test('default true when trainer-client row exists but .client.gender is missing', () => {
  const authUser = { id: 'trainer-christo', gender: 'male' as const };
  const clients = [
    { clientId: 'client-x', client: {} as any }, // no gender field
  ];
  assertEqual(
    isMaleForUser('client-x', authUser, clients),
    true,
    'missing gender → default true',
  );
});

test('default true when trainer-client row exists but .client is undefined (placeholder)', () => {
  const authUser = { id: 'trainer-christo', gender: 'male' as const };
  const clients = [
    { clientId: 'client-placeholder', client: undefined },
  ];
  assertEqual(
    isMaleForUser('client-placeholder', authUser, clients),
    true,
    'placeholder client (no .client sub-object) → default true',
  );
});

// =========================================================================

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);

if (failed > 0) process.exit(1);
