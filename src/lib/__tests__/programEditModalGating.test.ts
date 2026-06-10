/**
 * v19-fix-11 regression: the "Save changes to program?" modal must fire
 * after a structural edit (added exercise) to a program workout.
 *
 * Run with: npx tsx src/lib/__tests__/programEditModalGating.test.ts
 *
 * The finish flow (workout/active/page.tsx ~L1679) gates the modal on:
 *
 *     isProgramWorkout && programDiff.hasStructuralChanges
 *
 * v19-fix-11b: the gate is STRUCTURAL change only (added/removed exercises),
 * NOT `hasChanges` (which also counts set/rep/weight `changed`). A set/rep-
 * only edit must go straight to the summary with no prompt.
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

// SAME exercises, but different weights/reps only (normal logging, not a
// program edit). Must NOT fire the modal (fix-11b acceptance #2).
const completedSetRepOnly = {
  exercises: [
    { exerciseId: 'ex-ohp', exercise: { name: 'Overhead Press' }, sets: [{ weight: 45, reps: 6, completed: true }] },
    { exerciseId: 'ex-dip', exercise: { name: 'Dips' }, sets: [{ weight: 5, reps: 12, completed: true }] },
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
    assertEqual('diff.hasStructuralChanges', diff.hasStructuralChanges, true);
    assertEqual('MODAL FIRES (structural gate)', isProgramWorkout && diff.hasStructuralChanges, true);
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
    assertEqual('MODAL FIRES even with empty store', isProgramWorkout && diff.hasStructuralChanges, true);
  }

  console.log('\n--- removed exercise → modal fires ---');
  {
    const isProgramWorkout = detectIsProgramWorkout({
      sourceProgramId: 'prog-1', sourceDayIndex: 0, templateId: 'program-prog-1-0',
      workoutName: 'Push', workoutUserId: 'u1', clientPrograms: [activeProgram],
    });
    // Dropped Dips from the prescribed day.
    const completedRemoved = {
      exercises: [
        { exerciseId: 'ex-ohp', exercise: { name: 'Overhead Press' }, sets: [{ weight: 40, reps: 8, completed: true }] },
      ],
    };
    const diff = computeProgramDayDiff(completedRemoved, pushDay);
    assertEqual('diff.removed includes Dips', diff.removed.includes('Dips'), true);
    assertEqual('diff.hasStructuralChanges', diff.hasStructuralChanges, true);
    assertEqual('MODAL FIRES (removed)', isProgramWorkout && diff.hasStructuralChanges, true);
  }

  console.log('\n--- fix-11b: set/rep/weight-only edit → NO modal (straight to summary) ---');
  {
    const isProgramWorkout = detectIsProgramWorkout({
      sourceProgramId: 'prog-1', sourceDayIndex: 0, templateId: 'program-prog-1-0',
      workoutName: 'Push', workoutUserId: 'u1', clientPrograms: [activeProgram],
    });
    const diff = computeProgramDayDiff(completedSetRepOnly, pushDay);
    assertEqual('diff.changedCount > 0 (weights/reps differ)', diff.changedCount > 0, true);
    assertEqual('diff.addedCount === 0', diff.addedCount, 0);
    assertEqual('diff.removedCount === 0', diff.removedCount, 0);
    assertEqual('diff.hasChanges (legacy) still true', diff.hasChanges, true);
    assertEqual('diff.hasStructuralChanges === false', diff.hasStructuralChanges, false);
    assertEqual('MODAL DOES NOT FIRE (structural gate)', isProgramWorkout && diff.hasStructuralChanges, false);
  }

  console.log('\n--- identical-to-template → NO modal ---');
  {
    const isProgramWorkout = detectIsProgramWorkout({
      sourceProgramId: 'prog-1', sourceDayIndex: 0, templateId: 'program-prog-1-0',
      workoutName: 'Push', workoutUserId: 'u1', clientPrograms: [activeProgram],
    });
    const diff = computeProgramDayDiff(completedUnchanged, pushDay);
    assertEqual('no added exercises', diff.added.length, 0);
    assertEqual('no removed exercises', diff.removed.length, 0);
    assertEqual('hasStructuralChanges === false', diff.hasStructuralChanges, false);
    assertEqual('MODAL DOES NOT FIRE', isProgramWorkout && diff.hasStructuralChanges, false);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
