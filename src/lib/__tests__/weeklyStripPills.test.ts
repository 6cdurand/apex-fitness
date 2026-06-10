/**
 * v19-fix-10 regression tests for `resolveStripPills`.
 *
 * Run with: npx tsx src/lib/__tests__/weeklyStripPills.test.ts
 *
 * Covers the DESIGN (flexible order + transient swap):
 *  - next-workout RESOLUTION: single highlighted "next" = first not-done,
 *    not-locked slot (Up Next / strip / Today read the same value).
 *  - DONE-ATTRIBUTION by workout identity (Bug D): completing Legs first
 *    lights the Legs pill, not the left-anchored Push pill.
 *  - cycling slots (Push/Pull/Push): the nth slot mapping to a workout is
 *    done only once that workout has >= n completions.
 *  - PT-locked slots are skipped by the highlight.
 *
 * Pure helper, no React / store / Supabase.
 */

import { resolveStripPills, type ResolvedStripPill } from '../weeklyStripPills';

let passed = 0;
let failed = 0;

function assertEqual<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}\n     expected: ${e}\n     actual:   ${a}`);
  }
}

const doneIdx = (pills: ResolvedStripPill[]) => pills.filter(p => p.isDone).map(p => p.slotIdx);
const highlight = (pills: ResolvedStripPill[]) => {
  const p = pills.find(x => x.isToday || x.isNext);
  return p ? p.slotIdx : -1;
};

(() => {
  // Fixed Mon/Wed/Fri = [Push, Pull, Legs] → slots map 1:1 to plan indices.
  const PPL = [0, 1, 2];

  console.log('\n--- 0 done: next = Push (slot 0), nothing green ---');
  {
    const pills = resolveStripPills({ slotDayIndices: PPL, completedDayIndices: [], isScheduledToday: true });
    assertEqual('no pills done', doneIdx(pills), []);
    assertEqual('highlight = slot 0 (Push)', highlight(pills), 0);
    assertEqual('highlight isToday (scheduled today)', pills[0].isToday, true);
  }

  console.log('\n--- Bug D: complete LEGS first → Legs pill green, NOT Push ---');
  {
    const pills = resolveStripPills({ slotDayIndices: PPL, completedDayIndices: [2], isScheduledToday: false });
    assertEqual('only slot 2 (Legs) done', doneIdx(pills), [2]);
    assertEqual('highlight = slot 0 (Push, first uncompleted)', highlight(pills), 0);
    assertEqual('highlight isNext (not scheduled today)', pills[0].isNext, true);
  }

  console.log('\n--- complete Push too → Push + Legs green, next = Pull ---');
  {
    const pills = resolveStripPills({ slotDayIndices: PPL, completedDayIndices: [2, 0], isScheduledToday: true });
    assertEqual('slots 0 + 2 done', doneIdx(pills).sort(), [0, 2]);
    assertEqual('highlight = slot 1 (Pull)', highlight(pills), 1);
  }

  console.log('\n--- all done → no highlight, all green ---');
  {
    const pills = resolveStripPills({ slotDayIndices: PPL, completedDayIndices: [0, 1, 2], isScheduledToday: true });
    assertEqual('all slots done', doneIdx(pills), [0, 1, 2]);
    assertEqual('no highlight', highlight(pills), -1);
  }

  console.log('\n--- cycling slots Push/Pull/Push ([0,1,0]) ---');
  {
    // Push done once → FIRST Push slot (0) green, SECOND Push slot (2) not.
    const onePush = resolveStripPills({ slotDayIndices: [0, 1, 0], completedDayIndices: [0], isScheduledToday: false });
    assertEqual('one Push completion → only slot 0 done', doneIdx(onePush), [0]);
    assertEqual('highlight = slot 1 (Pull)', highlight(onePush), 1);

    // Push done twice → both Push slots green.
    const twoPush = resolveStripPills({ slotDayIndices: [0, 1, 0], completedDayIndices: [0, 0], isScheduledToday: false });
    assertEqual('two Push completions → slots 0 + 2 done', doneIdx(twoPush).sort(), [0, 2]);
    assertEqual('highlight = slot 1 (Pull)', highlight(twoPush), 1);
  }

  console.log('\n--- PT-locked slot is skipped by the highlight ---');
  {
    // Push (plan 0) locked → next highlight jumps to Pull (slot 1).
    const pills = resolveStripPills({ slotDayIndices: PPL, completedDayIndices: [], lockedDayIndices: [0], isScheduledToday: false });
    assertEqual('slot 0 locked', pills[0].isLocked, true);
    assertEqual('highlight skips locked → slot 1', highlight(pills), 1);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
