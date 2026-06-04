/**
 * v19-fix-11 regression: the "Save changes to program?" modal must fire
 * after a structural edit (added exercise) to a program workout.
 *
 * Run with: npx tsx src/lib/__tests__/programEditModalGating.test.ts
 *
 * The finish flow (workout/active/page.tsx ~L1664) gates the modal on:
 *
 *     isProgramWorkout && programDiff.hasChanges
 *
 * where `isProgramWorkout = detectIsProgramWorkout(...)` and
 * `programDiff = computeProgramDayDiff(completed, weeklyPlan[dayIdx])`.
 * This test exercises BOTH real pure functions and asserts that gate, so a
 * regression in either link (detection OR diff) is caught.
 *
 * Key case (the repro): a workout TAGGED with sourceProgramId whose program
 * is NOT in the store at finish time (not loaded / client_id divergence) —
 * previously detection hard-returned false and the modal silently never
 * fired. fix-11 makes detection fall through to the `program-` prefix path.
 */

import { detectIsProgramWorkout } from '../programWorkoutDetection';
import { computeProgramDayDiff } from '../programDiff';

let passed = 0;
let failed = 0;
function assertEqual<T>(label: string, actual: T, expected: T): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  }
}

// Program day (Push) as stored in weeklyPlan: Bench is NOT in it.
const pushDay = {
  blocks: [
    {
      exercises: [
        { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sets: [{ weight: 40, reps: 8 }] },
        { exerciseId: 'ex-dip', exerciseName: 'Dips', sets: [{ weight: 0, reps: 10 }] },
      ],
    },
  ],
};

// Completed workout = the two prescribed exercises + an ADDED Bench Press.
const completedWithAddedBench = {
  exercises: [
    { exerciseId: 'ex-ohp', exercise: { name: 'Overhead Press' }, sets: [{ weight: 40, reps: 8, completed: true }] },
    { exerciseId: 'ex-dip', exercise: { name: 'Dips' }, sets: [{ weight: 0, reps: 10, completed: true }] },
    { exerciseId: 'ex-bench', exercise: { name: 'Bench Press' }, sets: [{ weight: 60, reps: 8, completed: true }] },
  ],
};

// Identical-to-template completion (no structural change).
const completedUnchanged = {
  exercises: [
    { exerciseId: 'ex-ohp', exercise: { name: 'Overhead Press' }, sets: [{ weight: 40, reps: 8, completed: true }] },
    { exerciseId: 'ex-dip', exercise: { name: 'Dips' }, sets: [{ weight: 0, reps: 10, completed: true }] },
  ],
};

const activeProgram = {
  id: 'prog-1',
  clientId: 'u1',
  status: 'active',
  weeklyPlan: [{ dayLabel: 'Push' }],
};

(() => {
  console.log('\n--- added exercise + program IN store → modal fires ---');
  {
    const isProgramWorkout = detectIsProgramWorkout({
      sourceProgramId: 'prog-1',
      sourceDayIndex: 0,
      templateId: 'program-prog-1-0',
      workoutName: 'Push',
      workoutUserId: 'u1',
      clientPrograms: [activeProgram],
    });
    const diff = computeProgramDayDiff(completedWithAddedBench, pushDay);
    assertEqual('isProgramWorkout', isProgramWorkout, true);
    assertEqual('diff.added includes Bench Press', diff.added.includes('Bench Press'), true);
    assertEqual('diff.hasChanges', diff.hasChanges, true);
    assertEqual('MODAL FIRES (gate)', isProgramWorkout && diff.hasChanges, true);
  }

  console.log('\n--- fix-11 repro: program MISSING from store but tagged → still fires ---');
  {
    const isProgramWorkout = detectIsProgramWorkout({
      sourceProgramId: 'prog-1',
      sourceDayIndex: 0,
      templateId: 'program-prog-1-0', // prefix carries the fall-through
      workoutName: 'Push',
      workoutUserId: 'u1',
      clientPrograms: [], // not loaded / client_id divergence
    });
    const diff = computeProgramDayDiff(completedWithAddedBench, pushDay);
    assertEqual('isProgramWorkout via fall-through', isProgramWorkout, true);
    assertEqual('MODAL FIRES even with empty store', isProgramWorkout && diff.hasChanges, true);
  }

  console.log('\n--- no structural change → modal does NOT fire on add/remove ---');
  {
    const isProgramWorkout = detectIsProgramWorkout({
      sourceProgramId: 'prog-1',
      sourceDayIndex: 0,
      templateId: 'program-prog-1-0',
      workoutName: 'Push',
      workoutUserId: 'u1',
      clientPrograms: [activeProgram],
    });
    const diff = computeProgramDayDiff(completedUnchanged, pushDay);
    assertEqual('no added exercises', diff.added.length, 0);
    assertEqual('no removed exercises', diff.removed.length, 0);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
