/**
 * Tests for `computeProgramDayDiff` (D17 Part 4).
 *
 * Run with: npx tsx src/lib/__tests__/programDiff.test.ts
 *
 * Coverage:
 *  - identical exercise lists → no changes.
 *  - one added → addedCount=1, hasChanges=true.
 *  - one removed → removedCount=1, hasChanges=true.
 *  - both added + removed → both counts non-zero.
 *  - null programDay → empty diff (no changes), hasChanges=false.
 *  - empty completed exercises → all original exercises counted as removed.
 *  - duplicate exerciseIds in the completed workout → counted once.
 *  - program block with no exercises array → handled without throwing.
 *  - exerciseName fallback priority (exerciseName > name > 'Exercise').
 *
 * Pure helper, no React / store / Supabase mocking required.
 */

import { computeProgramDayDiff } from '../programDiff';

let passed = 0;
let failed = 0;

function assert(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

(() => {
  console.log('\n--- identical exercise lists ---');
  {
    const completed = {
      exercises: [
        { exerciseId: 'bench-press', exercise: { name: 'Bench Press' } },
        { exerciseId: 'squat', exercise: { name: 'Squat' } },
      ],
    };
    const programDay = {
      blocks: [
        {
          exercises: [
            { exerciseId: 'bench-press', exerciseName: 'Bench Press' },
            { exerciseId: 'squat', exerciseName: 'Squat' },
          ],
        },
      ],
    };
    const diff = computeProgramDayDiff(completed, programDay);
    assert('addedCount=0', diff.addedCount === 0);
    assert('removedCount=0', diff.removedCount === 0);
    assert('hasChanges=false', diff.hasChanges === false);
    assert('added=[]', diff.added.length === 0);
    assert('removed=[]', diff.removed.length === 0);
  }

  console.log('\n--- one added exercise ---');
  {
    const completed = {
      exercises: [
        { exerciseId: 'bench-press', exercise: { name: 'Bench Press' } },
        { exerciseId: 'dumbbell-row', exercise: { name: 'Dumbbell Row' } },
      ],
    };
    const programDay = {
      blocks: [
        { exercises: [{ exerciseId: 'bench-press', exerciseName: 'Bench Press' }] },
      ],
    };
    const diff = computeProgramDayDiff(completed, programDay);
    assert('addedCount=1', diff.addedCount === 1);
    assert('removedCount=0', diff.removedCount === 0);
    assert('hasChanges=true', diff.hasChanges === true);
    assert("added=['Dumbbell Row']", diff.added[0] === 'Dumbbell Row');
  }

  console.log('\n--- one removed exercise ---');
  {
    const completed = {
      exercises: [{ exerciseId: 'bench-press', exercise: { name: 'Bench Press' } }],
    };
    const programDay = {
      blocks: [
        {
          exercises: [
            { exerciseId: 'bench-press', exerciseName: 'Bench Press' },
            { exerciseId: 'overhead-press', exerciseName: 'Overhead Press' },
          ],
        },
      ],
    };
    const diff = computeProgramDayDiff(completed, programDay);
    assert('addedCount=0', diff.addedCount === 0);
    assert('removedCount=1', diff.removedCount === 1);
    assert('hasChanges=true', diff.hasChanges === true);
    assert("removed=['Overhead Press']", diff.removed[0] === 'Overhead Press');
  }

  console.log('\n--- both added and removed ---');
  {
    const completed = {
      exercises: [
        { exerciseId: 'bench-press', exercise: { name: 'Bench Press' } },
        { exerciseId: 'pull-up', exercise: { name: 'Pull Up' } },
      ],
    };
    const programDay = {
      blocks: [
        {
          exercises: [
            { exerciseId: 'bench-press', exerciseName: 'Bench Press' },
            { exerciseId: 'overhead-press', exerciseName: 'Overhead Press' },
          ],
        },
      ],
    };
    const diff = computeProgramDayDiff(completed, programDay);
    assert('addedCount=1', diff.addedCount === 1);
    assert('removedCount=1', diff.removedCount === 1);
    assert('hasChanges=true', diff.hasChanges === true);
    assert("added contains 'Pull Up'", diff.added.includes('Pull Up'));
    assert("removed contains 'Overhead Press'", diff.removed.includes('Overhead Press'));
  }

  console.log('\n--- null programDay ---');
  {
    const completed = {
      exercises: [{ exerciseId: 'bench-press', exercise: { name: 'Bench Press' } }],
    };
    const diff = computeProgramDayDiff(completed, null);
    assert('addedCount=0', diff.addedCount === 0);
    assert('removedCount=0', diff.removedCount === 0);
    assert('hasChanges=false', diff.hasChanges === false);
  }

  console.log('\n--- undefined programDay (same as null) ---');
  {
    const completed = { exercises: [] };
    const diff = computeProgramDayDiff(completed, undefined);
    assert('hasChanges=false', diff.hasChanges === false);
  }

  console.log('\n--- empty completed exercises ---');
  {
    const completed = { exercises: [] };
    const programDay = {
      blocks: [
        {
          exercises: [
            { exerciseId: 'bench-press', exerciseName: 'Bench Press' },
            { exerciseId: 'squat', exerciseName: 'Squat' },
          ],
        },
      ],
    };
    const diff = computeProgramDayDiff(completed, programDay);
    assert('addedCount=0', diff.addedCount === 0);
    assert('removedCount=2 (all originals removed)', diff.removedCount === 2);
    assert('hasChanges=true', diff.hasChanges === true);
  }

  console.log('\n--- duplicate exerciseIds in current are counted once ---');
  {
    const completed = {
      exercises: [
        { exerciseId: 'bench-press', exercise: { name: 'Bench Press' } },
        { exerciseId: 'bench-press', exercise: { name: 'Bench Press' } }, // duplicate
      ],
    };
    const programDay = {
      blocks: [{ exercises: [{ exerciseId: 'squat', exerciseName: 'Squat' }] }],
    };
    const diff = computeProgramDayDiff(completed, programDay);
    assert('addedCount=1 (dupe collapses)', diff.addedCount === 1);
    assert('removedCount=1', diff.removedCount === 1);
    assert('added contains one Bench Press', diff.added.length === 1 && diff.added[0] === 'Bench Press');
  }

  console.log('\n--- program block with no exercises array ---');
  {
    const completed = { exercises: [{ exerciseId: 'squat', exercise: { name: 'Squat' } }] };
    const programDay = { blocks: [{}, { exercises: undefined as any }] };
    const diff = computeProgramDayDiff(completed, programDay);
    assert('does not throw', true);
    assert('addedCount=1 (squat is "new" vs an empty template)', diff.addedCount === 1);
    assert('removedCount=0', diff.removedCount === 0);
  }

  console.log('\n--- exerciseName fallback priority ---');
  {
    const completed = { exercises: [] };
    const programDay = {
      blocks: [
        {
          exercises: [
            { exerciseId: 'a', exerciseName: 'ExerciseName-A' },
            { exerciseId: 'b', name: 'Name-B' }, // no exerciseName, falls back to name
            { exerciseId: 'c' }, // no names at all, falls back to 'Exercise'
          ],
        },
      ],
    };
    const diff = computeProgramDayDiff(completed, programDay);
    assert("removed contains 'ExerciseName-A'", diff.removed.includes('ExerciseName-A'));
    assert("removed contains 'Name-B'", diff.removed.includes('Name-B'));
    assert("removed contains 'Exercise' fallback", diff.removed.includes('Exercise'));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
