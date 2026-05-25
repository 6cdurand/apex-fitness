/**
 * Tests for getLastSetForExercise helpers (v12-D4).
 *
 * Run with: npx tsx src/lib/__tests__/getLastSetForExercise.test.ts
 *
 * Covers the three bugs that caused "previous results from a month ago":
 *  1. No sort by completion date → array-order win
 *  2. No filter on status='completed' → drafts could match
 *  3. No filter on !deletedAt → soft-deleted workouts could match
 *
 * Plus the PB userId mismatch scenario (caller passes explicit userId).
 */

import {
  getLastSetForExercise,
  getLastSetForExerciseAtIndex,
  getLastWorkoutWithExercise,
  getMostRecentExerciseData,
  getBestExerciseRecord,
  getBestVolumeForExercise,
} from '../getLastSetForExercise';
import type { Workout } from '@/types';

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

const USER_A = 'user-alice';
const USER_B = 'user-bob';

// Helper: build a minimal Workout for testing
function mkWorkout(opts: {
  id: string;
  userId?: string;
  endTime?: string;
  startTime?: string;
  status?: 'active' | 'completed' | 'cancelled';
  deletedAt?: string;
  exerciseId?: string;
  sets?: Array<{ completed: boolean; weight?: number; reps?: number; duration?: number }>;
}): Workout {
  return {
    id: opts.id,
    name: 'Test Workout',
    userId: opts.userId ?? USER_A,
    startTime: opts.startTime ?? '2026-05-01T10:00:00Z',
    endTime: opts.endTime,
    status: opts.status ?? 'completed',
    totalVolume: 0,
    deletedAt: opts.deletedAt,
    exercises: [
      {
        id: `we-${opts.id}`,
        exerciseId: opts.exerciseId ?? 'bench-press',
        exercise: { id: opts.exerciseId ?? 'bench-press', name: 'Bench Press' } as any,
        sets: (opts.sets ?? []).map((s, i) => ({
          id: `s-${opts.id}-${i}`,
          setNumber: i + 1,
          type: 'normal' as const,
          completed: s.completed,
          weight: s.weight,
          reps: s.reps,
          duration: s.duration,
        })),
        restTimerSeconds: 90,
      } as any,
    ],
  };
}

// ============ Bug 1: sort by date ============
console.log('\n--- Bug 1: sort by date (most recent wins, not array-first) ---');

{
  // Array has OLDER workout first, NEWER workout second.
  const history: Workout[] = [
    mkWorkout({ id: 'old', endTime: '2026-04-01T10:00:00Z', sets: [{ completed: true, weight: 60, reps: 5 }] }),
    mkWorkout({ id: 'new', endTime: '2026-05-10T10:00:00Z', sets: [{ completed: true, weight: 80, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'bench-press', USER_A);
  assert('returns NEWER workout (80kg), not array-first OLDER (60kg)',
    result?.weight === 80 && result?.workoutId === 'new',
    `got weight=${result?.weight}, id=${result?.workoutId}`);
}

{
  // Falls back to startTime when endTime is missing on one workout.
  const history: Workout[] = [
    mkWorkout({ id: 'has-end', endTime: '2026-04-01T10:00:00Z', startTime: '2026-04-01T09:00:00Z', sets: [{ completed: true, weight: 50, reps: 5 }] }),
    mkWorkout({ id: 'no-end', endTime: undefined, startTime: '2026-05-10T09:00:00Z', sets: [{ completed: true, weight: 70, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'bench-press', USER_A);
  assert('uses startTime fallback when endTime missing',
    result?.weight === 70,
    `got weight=${result?.weight}`);
}

// ============ Bug 2: filter by status ============
console.log('\n--- Bug 2: filter by status=completed ---');

{
  const history: Workout[] = [
    mkWorkout({ id: 'draft', status: 'active', endTime: '2026-05-12T10:00:00Z', sets: [{ completed: true, weight: 100, reps: 5 }] }),
    mkWorkout({ id: 'completed', status: 'completed', endTime: '2026-05-10T10:00:00Z', sets: [{ completed: true, weight: 75, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'bench-press', USER_A);
  assert('skips active/draft workouts even when newer',
    result?.weight === 75 && result?.workoutId === 'completed',
    `got weight=${result?.weight}, id=${result?.workoutId}`);
}

{
  const history: Workout[] = [
    mkWorkout({ id: 'cancelled', status: 'cancelled', endTime: '2026-05-12T10:00:00Z', sets: [{ completed: true, weight: 200, reps: 5 }] }),
    mkWorkout({ id: 'completed', status: 'completed', endTime: '2026-05-10T10:00:00Z', sets: [{ completed: true, weight: 75, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'bench-press', USER_A);
  assert('skips cancelled workouts',
    result?.weight === 75,
    `got weight=${result?.weight}`);
}

// ============ Bug 3: filter by deletedAt ============
console.log('\n--- Bug 3: filter by deletedAt (soft-deleted excluded) ---');

{
  const history: Workout[] = [
    mkWorkout({ id: 'deleted', deletedAt: '2026-05-13T00:00:00Z', endTime: '2026-05-12T10:00:00Z', sets: [{ completed: true, weight: 150, reps: 5 }] }),
    mkWorkout({ id: 'active', endTime: '2026-05-10T10:00:00Z', sets: [{ completed: true, weight: 75, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'bench-press', USER_A);
  assert('skips soft-deleted workouts even when newer',
    result?.weight === 75 && result?.workoutId === 'active',
    `got weight=${result?.weight}, id=${result?.workoutId}`);
}

// ============ Bug 4: userId scoping ============
console.log('\n--- Bug 4: userId scoping (other users excluded) ---');

{
  const history: Workout[] = [
    mkWorkout({ id: 'bobs', userId: USER_B, endTime: '2026-05-12T10:00:00Z', sets: [{ completed: true, weight: 999, reps: 5 }] }),
    mkWorkout({ id: 'alices', userId: USER_A, endTime: '2026-05-10T10:00:00Z', sets: [{ completed: true, weight: 60, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'bench-press', USER_A);
  assert("only returns USER_A's workouts (ignores USER_B's)",
    result?.weight === 60 && result?.workoutId === 'alices',
    `got weight=${result?.weight}, id=${result?.workoutId}`);
}

// ============ Bug 5: no match ============
console.log('\n--- Bug 5: no matching workout ---');

{
  const history: Workout[] = [
    mkWorkout({ id: 'w1', exerciseId: 'squat', sets: [{ completed: true, weight: 100, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'deadlift', USER_A);
  assert('returns undefined when no matching exercise found',
    result === undefined,
    `got ${JSON.stringify(result)}`);
}

{
  const result = getLastSetForExercise([], 'bench-press', USER_A);
  assert('returns undefined on empty history',
    result === undefined);
}

{
  // Workout has the exercise but no COMPLETED sets
  const history: Workout[] = [
    mkWorkout({ id: 'w1', sets: [{ completed: false, weight: 60, reps: 5 }] }),
  ];
  const result = getLastSetForExercise(history, 'bench-press', USER_A);
  assert('returns undefined when matching exercise has no completed sets',
    result === undefined);
}

// ============ Bug 6: getLastSetForExerciseAtIndex ============
console.log('\n--- Bug 6: getLastSetForExerciseAtIndex returns set at the right index from right workout ---');

{
  // Two completed workouts, both with 3 sets. We want set #2 (index 1) from the NEWER one.
  const history: Workout[] = [
    mkWorkout({
      id: 'old',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: true, weight: 50, reps: 8 },
        { completed: true, weight: 60, reps: 6 },
        { completed: true, weight: 65, reps: 5 },
      ],
    }),
    mkWorkout({
      id: 'new',
      endTime: '2026-05-10T10:00:00Z',
      sets: [
        { completed: true, weight: 70, reps: 8 },
        { completed: true, weight: 80, reps: 6 },
        { completed: true, weight: 85, reps: 5 },
      ],
    }),
  ];
  const result = getLastSetForExerciseAtIndex(history, 'bench-press', USER_A, 1);
  assert('returns set #2 (index 1) from NEWER workout',
    result?.weight === 80 && result?.reps === 6,
    `got weight=${result?.weight}, reps=${result?.reps}`);
}

{
  // v15-D2: NO FALLTHROUGH. Newer workout has 2 sets, older workout has 4.
  // The helper MUST NOT reach back to the older workout when newSetIndex
  // exceeds the most-recent workout's set count — that fallthrough was
  // the H1 bug behind reproduction R2 (Ab Crunch: 5 PREVIOUS rows shown
  // for a Mar 17 workout that only had 2 sets).
  const history: Workout[] = [
    mkWorkout({
      id: 'old',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: true, weight: 50, reps: 8 },
        { completed: true, weight: 60, reps: 6 },
        { completed: true, weight: 65, reps: 5 },
        { completed: true, weight: 70, reps: 4 },
      ],
    }),
    mkWorkout({
      id: 'new',
      endTime: '2026-05-10T10:00:00Z',
      sets: [
        { completed: true, weight: 80, reps: 8 },
        { completed: true, weight: 85, reps: 6 },
      ],
    }),
  ];
  const result = getLastSetForExerciseAtIndex(history, 'bench-press', USER_A, 3);
  assert('v15-D2 NO-FALLTHROUGH: returns undefined when index >= most-recent length',
    result === undefined,
    `expected undefined, got weight=${result?.weight}, id=${result?.workoutId}`);
}

// ============ Bug 7: getLastWorkoutWithExercise (used by active page) ============
console.log('\n--- Bug 7: getLastWorkoutWithExercise returns most-recent completed workout for exercise ---');

{
  const history: Workout[] = [
    mkWorkout({ id: 'old', endTime: '2026-04-01T10:00:00Z', sets: [{ completed: true, weight: 50, reps: 5 }] }),
    mkWorkout({ id: 'recent-draft', status: 'active', endTime: '2026-05-12T10:00:00Z', sets: [{ completed: true, weight: 999, reps: 5 }] }),
    mkWorkout({ id: 'recent-deleted', deletedAt: '2026-05-13T00:00:00Z', endTime: '2026-05-12T11:00:00Z', sets: [{ completed: true, weight: 888, reps: 5 }] }),
    mkWorkout({ id: 'recent-complete', endTime: '2026-05-10T10:00:00Z', sets: [{ completed: true, weight: 75, reps: 5 }] }),
  ];
  const result = getLastWorkoutWithExercise(history, 'bench-press', USER_A);
  assert('returns most-recent COMPLETED workout, ignoring drafts and deleted',
    result?.id === 'recent-complete',
    `got id=${result?.id}`);
}

// ============ v15-D2: getMostRecentExerciseData (single source of truth) ============
console.log('\n--- v15-D2: getMostRecentExerciseData returns full set array from most-recent workout ---');

{
  // Reproduction R2 fixture: most-recent has 2 sets, older has 5.
  // Result.sets MUST be exactly length 2; .sets[3] MUST be undefined.
  // It must NOT pull D/E from the older workout.
  const history: Workout[] = [
    mkWorkout({
      id: 'five-set-older',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: true, weight: 100, reps: 5 }, // A
        { completed: true, weight: 105, reps: 5 }, // B
        { completed: true, weight: 110, reps: 5 }, // C
        { completed: true, weight: 115, reps: 5 }, // D
        { completed: true, weight: 120, reps: 5 }, // E
      ],
    }),
    mkWorkout({
      id: 'two-set-newest',
      endTime: '2026-05-10T10:00:00Z',
      sets: [
        { completed: true, weight: 80, reps: 8 }, // a
        { completed: true, weight: 85, reps: 6 }, // b
      ],
    }),
  ];
  const result = getMostRecentExerciseData(history, 'bench-press', USER_A);
  assert('returns most-recent workout sets only (length 2)',
    result?.sets.length === 2 && result?.workoutId === 'two-set-newest',
    `got length=${result?.sets.length}, id=${result?.workoutId}`);
  assert('sets[0] is the most-recent first set (a)',
    result?.sets[0]?.weight === 80 && result?.sets[0]?.reps === 8,
    `got ${JSON.stringify(result?.sets[0])}`);
  assert('sets[1] is the most-recent second set (b)',
    result?.sets[1]?.weight === 85 && result?.sets[1]?.reps === 6,
    `got ${JSON.stringify(result?.sets[1])}`);
  assert('sets[3] is undefined — no fallthrough to older workout (must not return D)',
    (result?.sets[3] as any) === undefined,
    `expected undefined, got ${JSON.stringify(result?.sets[3])}`);
}

{
  // Skip drafts + deleted + other-user workouts when picking "most recent".
  const history: Workout[] = [
    mkWorkout({ id: 'bobs', userId: USER_B, endTime: '2026-05-15T10:00:00Z', sets: [{ completed: true, weight: 999, reps: 5 }] }),
    mkWorkout({ id: 'draft', status: 'active', endTime: '2026-05-14T10:00:00Z', sets: [{ completed: true, weight: 888, reps: 5 }] }),
    mkWorkout({ id: 'deleted', deletedAt: '2026-05-13T01:00:00Z', endTime: '2026-05-13T00:00:00Z', sets: [{ completed: true, weight: 777, reps: 5 }] }),
    mkWorkout({ id: 'good',  endTime: '2026-05-10T10:00:00Z', sets: [{ completed: true, weight: 70, reps: 8 }, { completed: true, weight: 75, reps: 6 }] }),
  ];
  const result = getMostRecentExerciseData(history, 'bench-press', USER_A);
  assert('skips other-user / draft / deleted; returns the correct workout',
    result?.workoutId === 'good' && result?.sets.length === 2,
    `got id=${result?.workoutId}, length=${result?.sets.length}`);
}

{
  // setIndex on the returned sets reflects original position in the
  // historical workout's sets[] (some sets may be uncompleted and skipped).
  const history: Workout[] = [
    mkWorkout({
      id: 'mixed',
      endTime: '2026-05-10T10:00:00Z',
      sets: [
        { completed: true, weight: 80, reps: 8 },
        { completed: false, weight: 0, reps: 0 }, // skipped
        { completed: true, weight: 85, reps: 6 },
      ],
    }),
  ];
  const result = getMostRecentExerciseData(history, 'bench-press', USER_A);
  assert('skips uncompleted intermediate sets and reports original setIndex',
    result?.sets.length === 2 && result?.sets[0].setIndex === 0 && result?.sets[1].setIndex === 2,
    `got ${JSON.stringify(result?.sets.map(s => s.setIndex))}`);
}

{
  // Header strip + per-set column read the SAME workout (reproduction R3 fix).
  // Build a fixture where most-recent has [A, B, C] and an older workout has
  // [X, Y, Z, W, T]. Both header and column must source from [A, B, C].
  const history: Workout[] = [
    mkWorkout({
      id: 'older',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: true, weight: 200, reps: 10 }, // X
        { completed: true, weight: 210, reps: 10 }, // Y
        { completed: true, weight: 220, reps: 10 }, // Z
        { completed: true, weight: 230, reps: 10 }, // W
        { completed: true, weight: 240, reps: 10 }, // T
      ],
    }),
    mkWorkout({
      id: 'newest',
      endTime: '2026-05-15T10:00:00Z',
      sets: [
        { completed: true, weight: 85, reps: 15 }, // A
        { completed: true, weight: 85, reps: 16 }, // B
        { completed: true, weight: 95, reps: 15 }, // C
      ],
    }),
  ];
  const result = getMostRecentExerciseData(history, 'bench-press', USER_A);
  // Both consumers (header strip + per-set column) destructure from this same
  // object, so they CANNOT diverge.
  assert('header strip + per-set column converge on same workout (R3 regression guard)',
    result?.workoutId === 'newest' && result?.sets.length === 3,
    `got id=${result?.workoutId}, length=${result?.sets.length}`);
  assert('sets[3] is undefined — older workout sets W/T must NOT leak in',
    (result?.sets[3] as any) === undefined);
  assert('first three sets match the [A, B, C] shape exactly',
    result?.sets[0]?.weight === 85 && result?.sets[0]?.reps === 15 &&
    result?.sets[1]?.weight === 85 && result?.sets[1]?.reps === 16 &&
    result?.sets[2]?.weight === 95 && result?.sets[2]?.reps === 15,
    `got ${JSON.stringify(result?.sets)}`);
}

{
  // Trainer-mode user scoping: workoutHistory contains both trainer + client
  // workouts; calling with client-uid must only consider client's.
  const TRAINER = 'trainer-uid';
  const CLIENT = 'client-uid';
  const history: Workout[] = [
    mkWorkout({ id: 'trainer-self', userId: TRAINER, endTime: '2026-05-20T10:00:00Z', sets: [{ completed: true, weight: 200, reps: 5 }] }),
    mkWorkout({ id: 'client-pt',   userId: CLIENT,  endTime: '2026-05-18T10:00:00Z', sets: [{ completed: true, weight: 40, reps: 12 }] }),
  ];
  const result = getMostRecentExerciseData(history, 'bench-press', CLIENT);
  assert('trainer-mode: ignores trainer-self workouts when called for client',
    result?.workoutId === 'client-pt' && result?.sets[0]?.weight === 40,
    `got id=${result?.workoutId}, weight=${result?.sets[0]?.weight}`);
}

// ============ v15-D7: getBestExerciseRecord ============
console.log('\n--- v15-D7: getBestExerciseRecord returns all-time-best single-set record ---');

{
  // Returns the highest-weight set across all workouts for the exercise.
  const history: Workout[] = [
    mkWorkout({ id: 'w1', endTime: '2026-04-01T10:00:00Z', sets: [{ completed: true, weight: 100, reps: 10 }] }),
    mkWorkout({ id: 'w2', endTime: '2026-04-15T10:00:00Z', sets: [{ completed: true, weight: 120, reps: 8 }] }),
    mkWorkout({ id: 'w3', endTime: '2026-05-01T10:00:00Z', sets: [{ completed: true, weight: 110, reps: 12 }] }),
  ];
  const result = getBestExerciseRecord(history, 'bench-press', USER_A);
  assert('returns the highest-weight set across all workouts (120kg x 8)',
    result?.bestWeight === 120 && result?.bestReps === 8,
    `got weight=${result?.bestWeight}, reps=${result?.bestReps}`);
  assert('workoutId points to the workout containing the best set',
    result?.workoutId === 'w2',
    `got id=${result?.workoutId}`);
}

{
  // Ties on weight broken by higher reps.
  const history: Workout[] = [
    mkWorkout({ id: 'w1', endTime: '2026-04-01T10:00:00Z', sets: [{ completed: true, weight: 100, reps: 8 }] }),
    mkWorkout({ id: 'w2', endTime: '2026-04-15T10:00:00Z', sets: [{ completed: true, weight: 100, reps: 12 }] }),
  ];
  const result = getBestExerciseRecord(history, 'bench-press', USER_A);
  assert('ties broken by higher reps (100kg x 12 beats 100kg x 8)',
    result?.bestWeight === 100 && result?.bestReps === 12,
    `got weight=${result?.bestWeight}, reps=${result?.bestReps}`);
}

{
  // Uncompleted sets ignored even when heavier.
  const history: Workout[] = [
    mkWorkout({
      id: 'w1',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: false, weight: 200, reps: 5 },  // uncompleted — ignored
        { completed: true,  weight: 100, reps: 10 },
      ],
    }),
  ];
  const result = getBestExerciseRecord(history, 'bench-press', USER_A);
  assert('skips uncompleted sets (returns 100kg, not 200kg)',
    result?.bestWeight === 100,
    `got weight=${result?.bestWeight}`);
}

{
  // Returns undefined when no completed workout contains the exercise.
  const history: Workout[] = [
    mkWorkout({ id: 'w1', exerciseId: 'squat', sets: [{ completed: true, weight: 100, reps: 10 }] }),
  ];
  const result = getBestExerciseRecord(history, 'bench-press', USER_A);
  assert('returns undefined when exercise not in any workout',
    result === undefined,
    `got ${JSON.stringify(result)}`);
}

{
  // Duration-only sets (cardio) skipped — PB concept = weight x reps.
  const history: Workout[] = [
    mkWorkout({
      id: 'w1',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: true, duration: 600 },               // no weight — ignored
        { completed: true, weight: 50, reps: 0 },          // zero reps — ignored
        { completed: true, weight: 80, reps: 6 },
      ],
    }),
  ];
  const result = getBestExerciseRecord(history, 'bench-press', USER_A);
  assert('skips duration-only and zero-reps sets',
    result?.bestWeight === 80 && result?.bestReps === 6,
    `got weight=${result?.bestWeight}, reps=${result?.bestReps}`);
}

{
  // userId scoping: other user's heavier set ignored.
  const history: Workout[] = [
    mkWorkout({ id: 'bobs',   userId: USER_B, endTime: '2026-04-15T10:00:00Z', sets: [{ completed: true, weight: 999, reps: 5 }] }),
    mkWorkout({ id: 'alices', userId: USER_A, endTime: '2026-04-01T10:00:00Z', sets: [{ completed: true, weight: 80, reps: 8 }] }),
  ];
  const result = getBestExerciseRecord(history, 'bench-press', USER_A);
  assert('userId scoping: ignores other users\' workouts',
    result?.bestWeight === 80,
    `got weight=${result?.bestWeight}`);
}

// ============ v15-D7: getBestVolumeForExercise ============
console.log('\n--- v15-D7: getBestVolumeForExercise returns max single-workout total volume ---');

{
  // Returns the max single-workout total volume for the exercise.
  const history: Workout[] = [
    mkWorkout({
      id: 'w1',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: true, weight: 100, reps: 10 },  // 1000
        { completed: true, weight: 100, reps: 10 },  // 1000 = 2000 total
      ],
    }),
    mkWorkout({
      id: 'w2',
      endTime: '2026-04-15T10:00:00Z',
      sets: [
        { completed: true, weight: 110, reps: 10 },  // 1100
        { completed: true, weight: 110, reps: 10 },  // 1100 = 2200 total <- max
      ],
    }),
    mkWorkout({
      id: 'w3',
      endTime: '2026-05-01T10:00:00Z',
      sets: [
        { completed: true, weight: 80, reps: 5 },    // 400 total
      ],
    }),
  ];
  const result = getBestVolumeForExercise(history, 'bench-press', USER_A);
  assert('returns max workout-level volume (2200)',
    result === 2200,
    `got ${result}`);
}

{
  // Uncompleted sets excluded from the per-workout volume sum.
  const history: Workout[] = [
    mkWorkout({
      id: 'w1',
      endTime: '2026-04-01T10:00:00Z',
      sets: [
        { completed: true,  weight: 100, reps: 10 }, // 1000 counted
        { completed: false, weight: 200, reps: 10 }, // 2000 — IGNORED
      ],
    }),
  ];
  const result = getBestVolumeForExercise(history, 'bench-press', USER_A);
  assert('skips uncompleted sets in volume sum (returns 1000)',
    result === 1000,
    `got ${result}`);
}

{
  // Returns 0 when no completed workout contains the exercise.
  const result = getBestVolumeForExercise([], 'bench-press', USER_A);
  assert('returns 0 on empty history',
    result === 0,
    `got ${result}`);
}

{
  // Returns 0 when only other users have the exercise.
  const history: Workout[] = [
    mkWorkout({ id: 'bobs', userId: USER_B, endTime: '2026-04-15T10:00:00Z', sets: [{ completed: true, weight: 100, reps: 10 }] }),
  ];
  const result = getBestVolumeForExercise(history, 'bench-press', USER_A);
  assert('userId scoping: returns 0 when only other users have the exercise',
    result === 0,
    `got ${result}`);
}

{
  // Skips drafts and soft-deleted workouts.
  const history: Workout[] = [
    mkWorkout({ id: 'draft',   status: 'active',                endTime: '2026-04-20T10:00:00Z', sets: [{ completed: true, weight: 200, reps: 10 }] }), // 2000 — ignored
    mkWorkout({ id: 'deleted', deletedAt: '2026-04-19T00:00:00Z', endTime: '2026-04-18T10:00:00Z', sets: [{ completed: true, weight: 300, reps: 10 }] }), // 3000 — ignored
    mkWorkout({ id: 'good',    endTime: '2026-04-01T10:00:00Z', sets: [{ completed: true, weight: 50, reps: 10 }] }),  // 500
  ];
  const result = getBestVolumeForExercise(history, 'bench-press', USER_A);
  assert('skips draft + soft-deleted workouts (returns 500)',
    result === 500,
    `got ${result}`);
}

// ============ Summary ============
console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
