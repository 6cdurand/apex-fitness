/**
 * Tests for the personal_bests column-drift fix.
 *
 * Run with: npx tsx src/lib/__tests__/personalBest.test.ts
 *
 * Coverage:
 *  - W3 (AUDIT_workouts_2026-04-30.md Q3): toDbPersonalBest emits exactly the
 *    columns present in public.personal_bests (verified against prod via SQL
 *    2026-05-01): id, user_id, exercise_id, exercise_name, weight, reps,
 *    one_rm, date. NO one_rep_max, NO achieved_at, NO workout_id. Previous
 *    mapping was writing the three stale names and every upsert failed with
 *    Postgres 42703, so user PBs lived only in localStorage.
 *
 *    Test 1 uses set-equality on the emitted keys so any future drift —
 *    either adding a stale column back or forgetting a new column — is
 *    caught at test time rather than at silent-failure time in prod.
 *
 *    Test 2 round-trips a PersonalBest through toDb → fromDb and asserts
 *    semantic equality on the fields that persist (app-side workoutId is
 *    intentionally NOT persisted because the prod table has no such column).
 *
 * Note: supabaseSync.ts pulls in zustand-persisted stores transitively via
 * `supabase` imports in other modules. Under Node/tsx, `localStorage` is
 * not defined, so we install a minimal in-memory shim BEFORE importing the
 * module. We also pre-seed the Supabase env vars so module-load
 * side-effects (e.g. createClient) don't throw. This file does NOT make
 * any network calls — we only import the pure mapping functions.
 */

// ---- env shim -----------------------------------------------------------
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJtest.fake.token';

// ---- localStorage shim for zustand/persist during module load ------------
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

import { toDbPersonalBest, fromDbPersonalBest } from '../supabaseSync';
import type { PersonalBest } from '@/types';

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// Exact DB column set verified against prod (SQL 2026-05-01). `created_at`
// is DB-managed (DEFAULT now()) and is explicitly NOT emitted by the
// upsert path, so it's not in the expected set here.
const EXPECTED_DB_KEYS = new Set<string>([
  'id',
  'user_id',
  'exercise_id',
  'exercise_name',
  'weight',
  'reps',
  'one_rm',
  'date',
]);

const FORBIDDEN_DB_KEYS = new Set<string>([
  'one_rep_max',  // pre-rename name
  'achieved_at',  // pre-rename name
  'workout_id',   // never existed in prod
]);

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

(() => {
  console.log('\n--- W3: toDbPersonalBest emits the exact columns of public.personal_bests ---');

  // --- Test 1: set-equality of emitted keys. ---
  {
    const pb: PersonalBest = {
      id: 'pb-1',
      userId: 'user-alice',
      exerciseId: 'bench-press',
      exerciseName: 'Bench Press',
      oneRepMax: 150.5,
      bestWeight: 140,
      bestReps: 3,
      bestVolume: 420,
      achievedAt: '2026-04-28T10:00:00.000Z',
      workoutId: 'w-123',
    };

    const dbRow = toDbPersonalBest(pb);
    const actualKeys = new Set(Object.keys(dbRow));

    assert(
      'ACCEPTANCE W3: emitted keys are exactly {id, user_id, exercise_id, exercise_name, weight, reps, one_rm, date}',
      setsEqual(actualKeys, EXPECTED_DB_KEYS),
      `actual=${JSON.stringify([...actualKeys].sort())} expected=${JSON.stringify([...EXPECTED_DB_KEYS].sort())}`,
    );

    // Belt-and-braces: explicit forbidden-keys guard so a future edit that
    // re-introduces the stale names fails with a clear signal rather than
    // just "set sizes differ".
    for (const forbidden of FORBIDDEN_DB_KEYS) {
      assert(
        `forbidden stale key \`${forbidden}\` is NOT present in emitted payload`,
        !actualKeys.has(forbidden),
      );
    }

    // Value fidelity spot-checks on the renamed columns.
    assert('one_rm carries the app-side oneRepMax value', dbRow.one_rm === 150.5);
    assert('date carries the app-side achievedAt value', dbRow.date === '2026-04-28T10:00:00.000Z');
    assert('exercise_name carries the app-side exerciseName value', dbRow.exercise_name === 'Bench Press');
    assert('weight and reps are preserved', dbRow.weight === 140 && dbRow.reps === 3);
    assert('id, user_id, exercise_id are preserved', dbRow.id === 'pb-1' && dbRow.user_id === 'user-alice' && dbRow.exercise_id === 'bench-press');
  }

  // --- Test 2: round-trip through toDb + fromDb. ---
  {
    const original: PersonalBest = {
      id: 'pb-roundtrip',
      userId: 'user-bob',
      exerciseId: 'squat',
      exerciseName: 'Back Squat',
      oneRepMax: 200,
      bestWeight: 180,
      bestReps: 5,
      bestVolume: 900,
      achievedAt: '2026-04-29T12:30:00.000Z',
      workoutId: 'w-roundtrip',
    };

    const dbRow = toDbPersonalBest(original);
    const restored = fromDbPersonalBest(dbRow);

    // Fields that persist through the DB mapping must survive the trip.
    assert('round-trip: id preserved', restored.id === original.id);
    assert('round-trip: userId preserved', restored.userId === original.userId);
    assert('round-trip: exerciseId preserved', restored.exerciseId === original.exerciseId);
    assert('round-trip: exerciseName preserved', restored.exerciseName === original.exerciseName);
    assert('round-trip: bestWeight preserved', restored.bestWeight === original.bestWeight);
    assert('round-trip: bestReps preserved', restored.bestReps === original.bestReps);
    assert('round-trip: oneRepMax preserved', restored.oneRepMax === original.oneRepMax);
    assert('round-trip: achievedAt preserved', restored.achievedAt === original.achievedAt);

    // Derived / non-persisted fields.
    // bestVolume is recomputed from weight * reps on the way back, which
    // for single-rep/top-set PBs equals the original (180 * 5 = 900 here).
    assert(
      'round-trip: bestVolume is recomputed from weight*reps',
      restored.bestVolume === original.bestWeight * original.bestReps,
    );
    // workoutId intentionally NOT persisted (no DB column). Restored value
    // is empty string — local writes populate it for PBs set post-sync.
    assert(
      'round-trip: workoutId is intentionally dropped (prod has no workout_id column)',
      restored.workoutId === '',
    );
  }

  // --- Test 3: missing optional exerciseName stays undefined (no crash). ---
  // Covers the pre-W3 localStorage PBs that don't have exerciseName — they
  // must not throw or inject a stale `undefined` literal into the upsert.
  {
    const legacy: PersonalBest = {
      id: 'pb-legacy',
      userId: 'user-carol',
      exerciseId: 'deadlift',
      oneRepMax: 220,
      bestWeight: 200,
      bestReps: 5,
      bestVolume: 1000,
      achievedAt: '2026-04-25T09:00:00.000Z',
      workoutId: 'w-legacy',
    };
    const dbRow = toDbPersonalBest(legacy);
    assert(
      'legacy PB (no exerciseName): exercise_name key is still present (undefined OK for pg-js)',
      Object.prototype.hasOwnProperty.call(dbRow, 'exercise_name'),
    );
    assert(
      'legacy PB: all required columns still emitted',
      setsEqual(new Set(Object.keys(dbRow)), EXPECTED_DB_KEYS),
    );
  }

  // --- D15 Part A: getPBForExercise normalizes the lookup key ---
  //
  // Regression for the program-workout PB-miss bug. PBs are stored with
  // normalizeExerciseId(rawId) applied; the getter used to compare via
  // strict equality on the raw input, so template-sourced ids like
  // 'Bench Press' or 'BENCH_PRESS' never matched the stored
  // 'bench-press'. The fix normalizes inside getPBForExercise.
  //
  // We exercise the live zustand store here (no mocks): localStorage is
  // already shimmed above, and the two stores' default states make no
  // network calls in isolation.
  console.log('\n--- D15 Part A: getPBForExercise normalizes the lookup key ---');
  {
    // Imports are placed inside the IIFE to avoid loading these modules at
    // the top of the file — the file also tests pure DB-mapping functions
    // and we don't want to mutate store state before those earlier blocks
    // have run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useWorkoutStore } = require('../stores/workoutStore');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('../stores/authStore');

    // Seed an active user so getActiveUserId() returns a known id.
    useAuthStore.setState({
      user: {
        id: 'user-alice',
        email: 'alice@test.com',
        displayName: 'Alice',
        mode: 'user',
        isTrainer: false,
      } as unknown as never,
      isAuthenticated: true,
    });

    // Seed a PB for alice with the canonical stored id 'bench-press' and
    // one for bob (different user) to test userId isolation.
    const stored: PersonalBest[] = [
      {
        id: 'pb-bench',
        userId: 'user-alice',
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        oneRepMax: 150,
        bestWeight: 140,
        bestReps: 3,
        bestVolume: 420,
        achievedAt: '2026-04-28T10:00:00.000Z',
        workoutId: 'w-bench',
      },
      {
        id: 'pb-bob-squat',
        userId: 'user-bob',
        exerciseId: 'squat',
        exerciseName: 'Squat',
        oneRepMax: 200,
        bestWeight: 180,
        bestReps: 5,
        bestVolume: 900,
        achievedAt: '2026-04-29T10:00:00.000Z',
        workoutId: 'w-squat',
      },
    ];
    useWorkoutStore.setState({ personalBests: stored, currentClientId: null });

    const getPB = useWorkoutStore.getState().getPBForExercise;

    // Case 1: stored 'bench-press', lookup 'Bench Press' (raw template id).
    const case1 = getPB('Bench Press');
    assert(
      "case 1: lookup 'Bench Press' (raw template id) returns the stored PB",
      case1?.id === 'pb-bench',
      `got ${case1?.id ?? 'undefined'}`,
    );

    // Case 2: lookup 'BENCH_PRESS' (underscores, caps).
    const case2 = getPB('BENCH_PRESS');
    assert(
      "case 2: lookup 'BENCH_PRESS' (underscores, caps) returns the stored PB",
      case2?.id === 'pb-bench',
      `got ${case2?.id ?? 'undefined'}`,
    );

    // Case 3: no PB stored for 'overhead-press' → undefined.
    const case3 = getPB('Overhead Press');
    assert(
      "case 3: lookup with no stored PB returns undefined",
      case3 === undefined,
      `got ${case3?.id ?? 'undefined(correct)'}`,
    );

    // Case 4: bob's squat PB must NOT be returned for alice.
    const case4 = getPB('Squat');
    assert(
      "case 4: another user's PB is not returned (userId isolation)",
      case4 === undefined,
      `got ${case4?.id ?? 'undefined(correct)'}`,
    );

    // Case 5: alias resolution — 'Flat Barbell Bench Press' normalises
    // via exerciseStats aliases to 'bench-press'.
    const case5 = getPB('Flat Barbell Bench Press');
    assert(
      "case 5: alias 'Flat Barbell Bench Press' → 'bench-press' resolves to stored PB",
      case5?.id === 'pb-bench',
      `got ${case5?.id ?? 'undefined'}`,
    );

    // Case 6: REGRESSION GUARD — bench-press PB must NOT be returned when
    // the lookup key is a different exercise ('deadlift').
    const case6 = getPB('deadlift');
    assert(
      "case 6 (regression): 'deadlift' lookup does NOT return the bench-press PB",
      case6 === undefined,
      `got ${case6?.id ?? 'undefined(correct)'}`,
    );

    // Clean up so we don't leak state into later tests if this file is
    // ever extended.
    useWorkoutStore.setState({ personalBests: [], currentClientId: null });
    useAuthStore.setState({ user: null, isAuthenticated: false });
  }

  // --- v18-D6: PB creation path populates exerciseName ---
  //
  // Regression for the Sev-1 bug where checkAndUpdatePB built a PB literal
  // WITHOUT exerciseName, so toDbPersonalBest emitted exercise_name=null
  // and every PB upsert 400'd with Postgres 23502. The existing tests above
  // pass because they hand-build PB literals WITH exerciseName — they never
  // exercise the real creation path. This block drives checkAndUpdatePB and
  // asserts the resulting PB carries a non-empty exerciseName, then verifies
  // the mapper emits a non-null exercise_name for both the new PB and a
  // legacy in-memory PB lacking exerciseName.
  console.log('\n--- v18-D6: checkAndUpdatePB populates exerciseName so PBs persist ---');
  {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useWorkoutStore } = require('../stores/workoutStore');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('../stores/authStore');

    useAuthStore.setState({
      user: {
        id: 'user-pb-create',
        email: 'pbcreate@test.com',
        displayName: 'PB Create',
        mode: 'user',
        isTrainer: false,
      } as unknown as never,
      isAuthenticated: true,
    });
    useWorkoutStore.setState({ personalBests: [], currentClientId: null });

    const checkAndUpdatePB = useWorkoutStore.getState().checkAndUpdatePB;

    // Case A: caller passes exerciseName (the hot path — completeSet has it).
    const createdA = checkAndUpdatePB('bench-press', 100, 5, 'workout-a', 'Bench Press');
    assert(
      'v18-D6 A: created PB carries the caller-supplied exerciseName',
      createdA?.exerciseName === 'Bench Press',
      `got ${JSON.stringify(createdA?.exerciseName)}`,
    );
    assert(
      'v18-D6 A: toDbPersonalBest emits non-null exercise_name for the created PB',
      createdA != null && toDbPersonalBest(createdA).exercise_name != null && toDbPersonalBest(createdA).exercise_name !== '',
      `got ${createdA ? JSON.stringify(toDbPersonalBest(createdA).exercise_name) : 'no PB'}`,
    );

    // Case B: caller omits exerciseName — must still resolve via the catalog
    // (bench-press is in the canonical library) so the upsert never sees null.
    useWorkoutStore.setState({ personalBests: [], currentClientId: null });
    const createdB = checkAndUpdatePB('bench-press', 110, 3, 'workout-b');
    assert(
      'v18-D6 B: created PB resolves exerciseName from the catalog when caller omits it',
      typeof createdB?.exerciseName === 'string' && (createdB?.exerciseName?.length ?? 0) > 0,
      `got ${JSON.stringify(createdB?.exerciseName)}`,
    );
    assert(
      'v18-D6 B: toDbPersonalBest emits non-null exercise_name for catalog-resolved PB',
      createdB != null && toDbPersonalBest(createdB).exercise_name != null && toDbPersonalBest(createdB).exercise_name !== '',
    );

    // Case C: unknown exerciseId — catalog miss must fall back to the id itself,
    // never null/undefined. This guards the "last-resort non-null" promise.
    useWorkoutStore.setState({ personalBests: [], currentClientId: null });
    const createdC = checkAndUpdatePB('some-totally-unknown-exercise-xyz', 50, 5, 'workout-c');
    assert(
      'v18-D6 C: unknown exerciseId still yields a non-empty exerciseName (id fallback)',
      typeof createdC?.exerciseName === 'string' && (createdC?.exerciseName?.length ?? 0) > 0,
      `got ${JSON.stringify(createdC?.exerciseName)}`,
    );
    assert(
      'v18-D6 C: toDbPersonalBest emits non-null exercise_name even for unknown id',
      createdC != null && toDbPersonalBest(createdC).exercise_name != null && toDbPersonalBest(createdC).exercise_name !== '',
    );

    // Case D: defensive mapper fallback — a legacy in-memory PB built
    // before this fix (no exerciseName) must still emit a non-null
    // exercise_name through toDbPersonalBest (= exerciseId fallback).
    const legacyPB: PersonalBest = {
      id: 'pb-legacy-v18d6',
      userId: 'user-pb-create',
      exerciseId: 'deadlift',
      // exerciseName intentionally omitted
      oneRepMax: 220,
      bestWeight: 200,
      bestReps: 5,
      bestVolume: 1000,
      achievedAt: '2026-05-30T09:00:00.000Z',
      workoutId: 'w-legacy',
    };
    const legacyRow = toDbPersonalBest(legacyPB);
    assert(
      'v18-D6 D: mapper fallback — legacy PB without exerciseName still emits non-null exercise_name',
      legacyRow.exercise_name != null && legacyRow.exercise_name !== '',
      `got ${JSON.stringify(legacyRow.exercise_name)}`,
    );
    assert(
      'v18-D6 D: mapper fallback uses exerciseId when exerciseName is missing',
      legacyRow.exercise_name === 'deadlift',
      `got ${JSON.stringify(legacyRow.exercise_name)}`,
    );

    // Cleanup.
    useWorkoutStore.setState({ personalBests: [], currentClientId: null });
    useAuthStore.setState({ user: null, isAuthenticated: false });
  }

  // --- Summary ---
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
