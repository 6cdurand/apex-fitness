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
  // Newer workout doesn't have a set at index 3, older one does — should return undefined (we don't reach back further to old workouts; matches the original behavior of taking the most-recent matching workout).
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
  // Index 3 doesn't exist on the newer workout; helper SKIPS the workout and tries the next one (the older one which does have index 3).
  const result = getLastSetForExerciseAtIndex(history, 'bench-press', USER_A, 3);
  assert('falls back to next-recent workout that has the requested set index',
    result?.weight === 70 && result?.workoutId === 'old',
    `got weight=${result?.weight}, id=${result?.workoutId}`);
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

// ============ Summary ============
console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
