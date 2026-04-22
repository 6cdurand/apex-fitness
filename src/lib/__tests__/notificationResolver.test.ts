/**
 * Tests for notificationResolver — program-assigned deep linking with
 * backward-compat fallback for legacy rows that lack program_id.
 *
 * Run with: npx tsx src/lib/__tests__/notificationResolver.test.ts
 * Or integrate with Jest/Vitest when a test framework is added.
 */

import {
  buildProgramUrl,
  getExplicitUrl,
  isProgramAssigned,
  resolveNotificationTarget,
  PROGRAM_ROUTE,
  type LatestActiveProgramLookup,
} from '../notificationResolver';

// ============ Simple test runner ============
let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}
async function assertAsync(label: string, condition: Promise<boolean> | boolean) {
  const ok = await condition;
  assert(label, ok);
}

// ============ buildProgramUrl ============
console.log('\n--- buildProgramUrl ---');

assert(
  'with id → /program?programId=<id>',
  buildProgramUrl('abc-123') === '/program?programId=abc-123',
);
assert(
  'encodes special characters in id',
  buildProgramUrl('a/b c') === '/program?programId=a%2Fb%20c',
);
assert('no id → bare /program', buildProgramUrl() === '/program');
assert('empty string id → bare /program', buildProgramUrl('') === '/program');
assert('null id → bare /program', buildProgramUrl(null) === '/program');

// ============ getExplicitUrl ============
console.log('\n--- getExplicitUrl ---');

assert('prefers actionUrl over link', getExplicitUrl({ actionUrl: '/a', link: '/b' } as any) === '/a');
assert('falls back to link when actionUrl missing', getExplicitUrl({ link: '/b' } as any) === '/b');
assert('returns null when both missing', getExplicitUrl({} as any) === null);
assert('returns null when both empty strings', getExplicitUrl({ actionUrl: '', link: '' } as any) === null);
assert('tolerates null input', getExplicitUrl(null) === null);
assert('tolerates undefined input', getExplicitUrl(undefined) === null);
assert('trims whitespace-only strings to null', getExplicitUrl({ actionUrl: '   ' } as any) === null);

// ============ isProgramAssigned ============
console.log('\n--- isProgramAssigned ---');

assert('true for program_assigned', isProgramAssigned({ type: 'program_assigned' } as any));
assert('false for other types', !isProgramAssigned({ type: 'friend_request' } as any));
assert('false for null', !isProgramAssigned(null));
assert('false for empty object', !isProgramAssigned({} as any));

// ============ resolveNotificationTarget ============
console.log('\n--- resolveNotificationTarget ---');

const lookupReturning = (id: string | null): LatestActiveProgramLookup => async () =>
  id ? { id } : null;
const lookupThrowing: LatestActiveProgramLookup = async () => {
  throw new Error('supabase down');
};

(async () => {
  // 1) program_assigned with programId → navigate to /program?programId=<id>
  await assertAsync(
    'program_assigned + programId → direct navigate',
    (async () => {
      const r = await resolveNotificationTarget(
        { type: 'program_assigned', programId: 'p-1' } as any,
        'user-1',
        lookupReturning('p-999'), // should NOT be called
      );
      return r.kind === 'navigate' && r.url === '/program?programId=p-1';
    })(),
  );

  // 2) legacy program_assigned (no programId) with active program present
  //    → fallback lookup hits, navigates with resolved id.
  await assertAsync(
    'legacy program_assigned + active program found → navigate via lookup',
    (async () => {
      const r = await resolveNotificationTarget(
        { type: 'program_assigned' } as any,
        'user-1',
        lookupReturning('p-xyz'),
      );
      return r.kind === 'navigate' && r.url === '/program?programId=p-xyz';
    })(),
  );

  // 3) legacy program_assigned, no active program → empty message
  await assertAsync(
    'legacy program_assigned + no active program → empty message',
    (async () => {
      const r = await resolveNotificationTarget(
        { type: 'program_assigned' } as any,
        'user-1',
        lookupReturning(null),
      );
      return r.kind === 'empty' && r.message === 'No active program found yet.';
    })(),
  );

  // 4) legacy program_assigned with no clientId → degrade to /program (UX
  //    still works; page shows its own "no active program" state if empty).
  await assertAsync(
    'legacy program_assigned + no clientId → navigate to /program',
    (async () => {
      let called = false;
      const r = await resolveNotificationTarget(
        { type: 'program_assigned' } as any,
        null,
        (async () => {
          called = true;
          return null;
        }) as LatestActiveProgramLookup,
      );
      return r.kind === 'navigate' && r.url === PROGRAM_ROUTE && !called;
    })(),
  );

  // 5) lookup throws → degrade gracefully to /program; do not propagate error.
  await assertAsync(
    'lookup throws → navigate to /program (no throw)',
    (async () => {
      const r = await resolveNotificationTarget(
        { type: 'program_assigned' } as any,
        'user-1',
        lookupThrowing,
      );
      return r.kind === 'navigate' && r.url === PROGRAM_ROUTE;
    })(),
  );

  // 6) Non-program type with actionUrl → navigate to that URL (legacy behavior).
  await assertAsync(
    'non-program type + actionUrl → navigate to actionUrl',
    (async () => {
      const r = await resolveNotificationTarget(
        { type: 'friend_request', actionUrl: '/friends' } as any,
        'user-1',
        lookupReturning('p-xyz'),
      );
      return r.kind === 'navigate' && r.url === '/friends';
    })(),
  );

  // 7) Non-program type with only link (legacy row) → navigate via link.
  await assertAsync(
    'non-program type + link only → navigate to link',
    (async () => {
      const r = await resolveNotificationTarget(
        { type: 'achievement', link: '/medals' } as any,
        'user-1',
        lookupReturning(null),
      );
      return r.kind === 'navigate' && r.url === '/medals';
    })(),
  );

  // 8) Non-program type with no URL at all → noop (don't crash).
  await assertAsync(
    'non-program type with nothing → noop',
    (async () => {
      const r = await resolveNotificationTarget(
        { type: 'system' } as any,
        'user-1',
        lookupReturning(null),
      );
      return r.kind === 'noop';
    })(),
  );

  // 9) null notification → noop (defensive).
  await assertAsync(
    'null notification → noop',
    (async () => {
      const r = await resolveNotificationTarget(null, 'user-1', lookupReturning(null));
      return r.kind === 'noop';
    })(),
  );

  // 10) Lookup is NOT called when programId is present (perf / fewer queries).
  await assertAsync(
    'programId present → lookup is not called',
    (async () => {
      let called = 0;
      const lookup: LatestActiveProgramLookup = async () => {
        called++;
        return null;
      };
      await resolveNotificationTarget(
        { type: 'program_assigned', programId: 'p-1' } as any,
        'user-1',
        lookup,
      );
      return called === 0;
    })(),
  );

  // 11) Legacy row where sender_id / link / program_id are all absent does
  //     not throw during resolution (data-access hardening).
  await assertAsync(
    'fully-sparse legacy row does not throw',
    (async () => {
      try {
        await resolveNotificationTarget(
          { id: 'n-1', userId: 'u-1', type: 'program_assigned', title: '' } as any,
          'u-1',
          lookupReturning(null),
        );
        return true;
      } catch {
        return false;
      }
    })(),
  );

  // ============ Summary ============
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
