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

  // --- Summary ---
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
