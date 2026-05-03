/**
 * Tests for the PT-session client-history hydration on /workout/active —
 * Track A deliverable A2 (PLAN_exercise_history.md §A2 + Hendrik repro
 * data-layer half).
 *
 * Run with:
 *   npx tsx src/app/workout/active/workoutActive.hydrate.test.ts
 *
 * Strategy:
 *  The mount-effect orchestration on the active page is exposed as three
 *  pure exports from page.tsx (same seam pattern as
 *  __decideIdentityNormalization on SupabaseSync.tsx and the Layer 1
 *  test-seam pattern in identity-reconciliation):
 *
 *    1. shouldHydrateForPTSession(activeWorkoutUserId, authUserId) →
 *       boolean. The cheap guard the effect runs before reaching for any
 *       async work. Tested directly.
 *
 *    2. mergeHydrationIntoState(prev, incoming) → { workoutHistory,
 *       personalBests }. The pure de-duplication used inside the
 *       useWorkoutStore.setState updater. Mirrors the inline pattern in
 *       clients/[id]/page.tsx:134-144 — same de-dupe-by-id semantics, no
 *       new helper module spun up.
 *
 *    3. hydrateClientHistoryIfPTSession(params, deps) →
 *       'skipped' | 'fetched-empty' | 'applied'. The orchestrator with
 *       injected `fetchUserData` + `applyToStore`, so the "exactly one
 *       fetch with the correct id" assertion is verifiable without
 *       mounting React.
 *
 * Coverage (per routing):
 *  1. shouldHydrateForPTSession: returns true when activeWorkoutUserId
 *     differs from authUserId (PT session — the bug case).
 *  2. shouldHydrateForPTSession: returns false when they match (trainer's
 *     own workout — must not re-fetch own data).
 *  3. shouldHydrateForPTSession: returns false when activeWorkoutUserId
 *     is missing (no workout / data race during mount).
 *  4. shouldHydrateForPTSession: returns false when authUserId is missing
 *     (signed-out edge case).
 *  5. mergeHydrationIntoState: appends NEW workouts, deduplicates by
 *     workout id (no double-counting).
 *  6. mergeHydrationIntoState: appends NEW PBs, deduplicates by PB id.
 *  7. mergeHydrationIntoState: empty incoming → no change to prev arrays.
 *  8. hydrateClientHistoryIfPTSession: PT-session path calls
 *     fetchUserData EXACTLY ONCE with activeWorkoutUserId, then merges
 *     into the store via applyToStore.
 *  9. hydrateClientHistoryIfPTSession: trainer-self path skips fetch
 *     entirely (zero calls, zero applyToStore).
 * 10. hydrateClientHistoryIfPTSession: fetch resolves null →
 *     'fetched-empty', applyToStore not called.
 */

// ---- minimal env so module load doesn't blow up -----------------------
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJtest.fake.token';

// ---- localStorage shim ------------------------------------------------
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    key(i: number) { return Array.from(store.keys())[i] ?? null; },
    getItem(k: string) { return store.get(k) ?? null; },
    setItem(k: string, v: string) { store.set(k, v); },
    removeItem(k: string) { store.delete(k); },
  };
}

import {
  shouldHydrateForPTSession,
  mergeHydrationIntoState,
  hydrateClientHistoryIfPTSession,
} from './page';

// ---- assertion runner --------------------------------------------------
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
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
function assertTrue(cond: any, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy, got ${String(cond)}`);
}

// =========================================================================

(async () => {
  console.log('\n--- shouldHydrateForPTSession: guard predicate ---');

  await test('PT session (ids differ) → true', () => {
    assertEqual(
      shouldHydrateForPTSession('client-hendrik', 'trainer-christo'),
      true,
      'different ids → hydrate',
    );
  });

  await test('trainer self-workout (ids match) → false (no re-fetch of own data)', () => {
    assertEqual(
      shouldHydrateForPTSession('trainer-christo', 'trainer-christo'),
      false,
      'matching ids → skip',
    );
  });

  await test('missing activeWorkoutUserId → false', () => {
    assertEqual(shouldHydrateForPTSession(null, 'trainer-christo'), false, 'null active → skip');
    assertEqual(shouldHydrateForPTSession(undefined, 'trainer-christo'), false, 'undef active → skip');
    assertEqual(shouldHydrateForPTSession('', 'trainer-christo'), false, 'empty active → skip');
  });

  await test('missing authUserId → false (signed-out edge case)', () => {
    assertEqual(shouldHydrateForPTSession('client-hendrik', null), false, 'null auth → skip');
    assertEqual(shouldHydrateForPTSession('client-hendrik', undefined), false, 'undef auth → skip');
  });

  // =======================================================================

  console.log('\n--- mergeHydrationIntoState: dedupe by id ---');

  await test('appends new workouts and dedupes by workout id', () => {
    const prev = {
      workoutHistory: [
        { id: 'w1', userId: 'a', startTime: '2026-04-01T00:00:00Z' } as any,
        { id: 'w2', userId: 'a', startTime: '2026-04-02T00:00:00Z' } as any,
      ],
      personalBests: [],
    };
    const incoming = {
      workouts: [
        { id: 'w2', userId: 'a', startTime: '2026-04-02T00:00:00Z' } as any, // dup
        { id: 'w3', userId: 'b', startTime: '2026-04-03T00:00:00Z' } as any, // new
        { id: 'w4', userId: 'b', startTime: '2026-04-04T00:00:00Z' } as any, // new
      ],
      personalBests: [],
    };
    const out = mergeHydrationIntoState(prev, incoming);
    assertEqual(out.workoutHistory.length, 4, 'two prev + two new (one dup dropped)');
    assertEqual(
      out.workoutHistory.map((w) => w.id),
      ['w1', 'w2', 'w3', 'w4'],
      'order: prev preserved, new appended in incoming order',
    );
  });

  await test('appends new PBs and dedupes by PB id', () => {
    const prev = {
      workoutHistory: [],
      personalBests: [
        { id: 'pb1', userId: 'a', exerciseId: 'bench-press', oneRepMax: 100 } as any,
      ],
    };
    const incoming = {
      workouts: [],
      personalBests: [
        { id: 'pb1', userId: 'a', exerciseId: 'bench-press', oneRepMax: 100 } as any, // dup
        { id: 'pb2', userId: 'b', exerciseId: 'cable-row', oneRepMax: 80 } as any, // new
      ],
    };
    const out = mergeHydrationIntoState(prev, incoming);
    assertEqual(out.personalBests.length, 2, 'one prev + one new (one dup dropped)');
    assertEqual(out.personalBests.map((pb) => pb.id), ['pb1', 'pb2'], 'order preserved');
  });

  await test('empty incoming → arrays unchanged (referential identity not required, content is)', () => {
    const prev = {
      workoutHistory: [{ id: 'w1' } as any],
      personalBests: [{ id: 'pb1' } as any],
    };
    const out = mergeHydrationIntoState(prev, { workouts: [], personalBests: [] });
    assertEqual(out.workoutHistory.length, 1, 'workoutHistory unchanged');
    assertEqual(out.personalBests.length, 1, 'personalBests unchanged');
    assertEqual(out.workoutHistory[0].id, 'w1', 'same id');
  });

  await test('all-duplicates incoming → no change', () => {
    const prev = {
      workoutHistory: [{ id: 'w1' } as any, { id: 'w2' } as any],
      personalBests: [{ id: 'pb1' } as any],
    };
    const out = mergeHydrationIntoState(prev, {
      workouts: [{ id: 'w1' } as any, { id: 'w2' } as any],
      personalBests: [{ id: 'pb1' } as any],
    });
    assertEqual(out.workoutHistory.length, 2, 'workoutHistory not duplicated');
    assertEqual(out.personalBests.length, 1, 'personalBests not duplicated');
  });

  // =======================================================================

  console.log('\n--- hydrateClientHistoryIfPTSession: orchestrator ---');

  await test('PT session: fetchUserData called EXACTLY ONCE with the client id, then applyToStore fires with merged data', async () => {
    const fetchCalls: string[] = [];
    const appliedPayloads: any[] = [];
    const result = await hydrateClientHistoryIfPTSession(
      {
        activeWorkoutUserId: '93a0c381-ca68-4e2c-8f82-11aaf45f95e2', // Hendrik
        authUserId: 'trainer-christo',
      },
      {
        fetchUserData: async (id) => {
          fetchCalls.push(id);
          return {
            workouts: [{ id: 'w-hendrik-1', userId: id } as any],
            personalBests: [{ id: 'pb-hendrik-1', userId: id } as any],
          };
        },
        applyToStore: (data) => { appliedPayloads.push(data); },
      },
    );
    assertEqual(result, 'applied', 'orchestrator returns applied');
    assertEqual(fetchCalls.length, 1, 'fetchUserData called exactly once');
    assertEqual(fetchCalls[0], '93a0c381-ca68-4e2c-8f82-11aaf45f95e2', 'called with the client id, NOT the trainer id');
    assertEqual(appliedPayloads.length, 1, 'applyToStore called exactly once');
    assertEqual(
      appliedPayloads[0].workouts.map((w: any) => w.id),
      ['w-hendrik-1'],
      'applied data has the client workout',
    );
  });

  await test('trainer self-workout: fetchUserData NOT called, applyToStore NOT called', async () => {
    const fetchCalls: string[] = [];
    const appliedPayloads: any[] = [];
    const result = await hydrateClientHistoryIfPTSession(
      { activeWorkoutUserId: 'trainer-christo', authUserId: 'trainer-christo' },
      {
        fetchUserData: async (id) => {
          fetchCalls.push(id);
          return { workouts: [], personalBests: [] };
        },
        applyToStore: (data) => { appliedPayloads.push(data); },
      },
    );
    assertEqual(result, 'skipped', 'orchestrator returns skipped');
    assertEqual(fetchCalls.length, 0, 'no fetch (would be a wasted round-trip for own data)');
    assertEqual(appliedPayloads.length, 0, 'no apply');
  });

  await test('PT session but fetchUserData resolves null → fetched-empty, applyToStore NOT called', async () => {
    const appliedPayloads: any[] = [];
    const result = await hydrateClientHistoryIfPTSession(
      { activeWorkoutUserId: 'client-x', authUserId: 'trainer-y' },
      {
        fetchUserData: async () => null,
        applyToStore: (data) => { appliedPayloads.push(data); },
      },
    );
    assertEqual(result, 'fetched-empty', 'returns fetched-empty');
    assertEqual(appliedPayloads.length, 0, 'no apply when fetch returned null');
  });

  await test('PT session: fetched data flows through mergeHydrationIntoState semantics (caller can dedupe)', async () => {
    // Verifies the orchestrator exposes the raw incoming arrays so the
    // caller's setState updater can run mergeHydrationIntoState against
    // the latest store state (not a stale snapshot captured at fetch time).
    let received: any = null;
    await hydrateClientHistoryIfPTSession(
      { activeWorkoutUserId: 'client-z', authUserId: 'trainer-z' },
      {
        fetchUserData: async () => ({
          workouts: [{ id: 'wA' } as any, { id: 'wB' } as any],
          personalBests: [{ id: 'pbA' } as any],
        }),
        applyToStore: (data) => { received = data; },
      },
    );
    assertTrue(received, 'applyToStore received data');
    assertEqual(received.workouts.length, 2, 'two workouts forwarded');
    assertEqual(received.personalBests.length, 1, 'one PB forwarded');
  });

  // =======================================================================

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
