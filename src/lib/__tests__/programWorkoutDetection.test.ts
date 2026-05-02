/**
 * Tests for `detectIsProgramWorkout` (D16 Part A).
 *
 * Run with: npx tsx src/lib/__tests__/programWorkoutDetection.test.ts
 *
 * Coverage:
 *  - templateId 'program-' / 'sched-' prefix → true (fast path).
 *  - templateId empty + workoutName matches an ACTIVE program day → true
 *    (structural fallback for prefix-stripped templates).
 *  - templateId empty + workoutName matches an INACTIVE program day → false
 *    (paused/archived programs must not count).
 *  - templateId empty + no day-label match → false.
 *  - templateId substring-includes activeProgram.id → true.
 *  - workoutUserId mismatches the program clientId → false (different user).
 *  - clientPrograms is empty → false.
 *  - REGRESSION GUARDS:
 *      * `'foo'.includes('')` style false-positive guarded (empty
 *        activeProgram.id MUST NOT cause every templateId to match).
 *      * Prefix path beats structural path — covered by the trivial
 *        prefix-only inputs returning true even with empty programs.
 *
 * Pure helper, no React / store / Supabase mocking required.
 */

import { detectIsProgramWorkout } from '../programWorkoutDetection';

let passed = 0;
let failed = 0;

function assertEqual<T>(label: string, actual: T, expected: T): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(
      `  ❌ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`,
    );
  }
}

(() => {
  console.log('\n--- prefix fast path ---');
  assertEqual(
    "templateId 'program-abc' → true",
    detectIsProgramWorkout({
      templateId: 'program-abc',
      workoutName: 'Push Day',
      workoutUserId: 'u1',
      clientPrograms: [],
    }),
    true,
  );
  assertEqual(
    "templateId 'sched-xyz' → true",
    detectIsProgramWorkout({
      templateId: 'sched-xyz',
      workoutName: 'Pull Day',
      workoutUserId: 'u1',
      clientPrograms: [],
    }),
    true,
  );

  console.log('\n--- structural fallback (active program) ---');
  const activeProgram = {
    id: 'prog-abc',
    clientId: 'u1',
    status: 'active',
    weeklyPlan: [{ dayLabel: 'Push Day' }, { dayLabel: 'Pull Day' }],
  };
  assertEqual(
    "templateId empty, workoutName='Push Day' matches active program day → true",
    detectIsProgramWorkout({
      templateId: '',
      workoutName: 'Push Day',
      workoutUserId: 'u1',
      clientPrograms: [activeProgram],
    }),
    true,
  );
  assertEqual(
    "templateId undefined, workoutName='Pull Day' matches active program day → true",
    detectIsProgramWorkout({
      workoutName: 'Pull Day',
      workoutUserId: 'u1',
      clientPrograms: [activeProgram],
    }),
    true,
  );

  console.log('\n--- inactive program day-label MUST NOT count ---');
  const inactiveProgram = {
    id: 'prog-old',
    clientId: 'u1',
    status: 'paused',
    weeklyPlan: [{ dayLabel: 'Push Day' }],
  };
  assertEqual(
    "templateId empty, workoutName='Push Day' but program is paused → false",
    detectIsProgramWorkout({
      templateId: '',
      workoutName: 'Push Day',
      workoutUserId: 'u1',
      clientPrograms: [inactiveProgram],
    }),
    false,
  );

  console.log('\n--- no day match → false ---');
  assertEqual(
    "templateId empty, workoutName='Random Lift' not in any program day → false",
    detectIsProgramWorkout({
      templateId: '',
      workoutName: 'Random Lift',
      workoutUserId: 'u1',
      clientPrograms: [activeProgram],
    }),
    false,
  );

  console.log('\n--- templateId substring-includes activeProgram.id ---');
  assertEqual(
    "templateId='abc-prog-abc-day-2' includes activeProgram.id 'prog-abc' → true",
    detectIsProgramWorkout({
      templateId: 'abc-prog-abc-day-2',
      workoutName: 'Anything',
      workoutUserId: 'u1',
      clientPrograms: [activeProgram],
    }),
    true,
  );

  console.log('\n--- different user → false ---');
  assertEqual(
    'workoutUserId=u2 but program belongs to u1 → false',
    detectIsProgramWorkout({
      templateId: '',
      workoutName: 'Push Day',
      workoutUserId: 'u2',
      clientPrograms: [activeProgram],
    }),
    false,
  );

  console.log('\n--- empty clientPrograms ---');
  assertEqual(
    'clientPrograms empty + non-prefixed templateId → false',
    detectIsProgramWorkout({
      templateId: 'workout-123',
      workoutName: 'Push Day',
      workoutUserId: 'u1',
      clientPrograms: [],
    }),
    false,
  );
  assertEqual(
    "clientPrograms empty but templateId still has 'program-' prefix → true (prefix beats structural)",
    detectIsProgramWorkout({
      templateId: 'program-anything',
      workoutName: 'Whatever',
      workoutUserId: 'u1',
      clientPrograms: [],
    }),
    true,
  );

  console.log("\n--- regression guard: empty activeProgram.id must NOT make `templateId.includes('')` match ---");
  const programWithEmptyId = {
    id: '',
    clientId: 'u1',
    status: 'active',
    weeklyPlan: [{ dayLabel: 'Some Day' }],
  };
  assertEqual(
    "active program with empty id, non-matching workoutName → false (no spurious includes('') match)",
    detectIsProgramWorkout({
      templateId: 'workout-xyz',
      workoutName: 'Other Day',
      workoutUserId: 'u1',
      clientPrograms: [programWithEmptyId],
    }),
    false,
  );

  console.log('\n--- D17 sourceProgramId fast path ---');
  const u1ActiveProgram = {
    id: 'prog-abc',
    clientId: 'u1',
    status: 'active',
    weeklyPlan: [{ dayLabel: 'Push Day' }],
  };
  assertEqual(
    'sourceProgramId set + matching program for same user → true',
    detectIsProgramWorkout({
      sourceProgramId: 'prog-abc',
      sourceDayIndex: 0,
      templateId: '',
      workoutName: 'Push Day',
      workoutUserId: 'u1',
      clientPrograms: [u1ActiveProgram],
    }),
    true,
  );
  assertEqual(
    'sourceProgramId set + program deleted from clientPrograms → false',
    detectIsProgramWorkout({
      sourceProgramId: 'prog-deleted',
      sourceDayIndex: 0,
      templateId: 'program-prog-deleted-0',
      workoutName: 'Push Day',
      workoutUserId: 'u1',
      clientPrograms: [u1ActiveProgram],
    }),
    false,
  );
  assertEqual(
    "sourceProgramId set + program belongs to another user → false (user mismatch)",
    detectIsProgramWorkout({
      sourceProgramId: 'prog-abc',
      sourceDayIndex: 0,
      templateId: '',
      workoutName: 'Push Day',
      workoutUserId: 'u2',
      clientPrograms: [u1ActiveProgram],
    }),
    false,
  );
  assertEqual(
    "sourceProgramId undefined falls through to legacy detection ('program-' prefix still resolves true)",
    detectIsProgramWorkout({
      templateId: 'program-anything',
      workoutName: 'Push Day',
      workoutUserId: 'u1',
      clientPrograms: [u1ActiveProgram],
    }),
    true,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
