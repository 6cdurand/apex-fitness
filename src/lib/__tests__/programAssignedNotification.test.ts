/**
 * Tests for `__buildProgramAssignedNotification` (D12 Part A).
 *
 * Run with: npx tsx src/lib/__tests__/programAssignedNotification.test.ts
 *
 * Coverage:
 *  - Shape: userId / type / title / programId / senderId / link / actionUrl
 *    all match the contract expected by the addNotification consumer.
 *  - Rich message when workoutCount + daysPerWeek + actualWeeks are all
 *    present and positive (matches the main `program/builder` save path).
 *  - Fallback message when any of those counts are missing/zero
 *    (matches the preview + alternate-client builder paths).
 *  - Singular/plural grammar for 1 workout and 1 week.
 *  - `link === actionUrl === '/program?programId=<urlEncoded>'`.
 *  - Empty-string `templateName` treated as missing.
 *  - `senderId` passes through unchanged.
 *
 * Pure helper — no React / store / Supabase mocking required.
 */

import {
  __buildProgramAssignedNotification,
  type BuildProgramAssignedNotificationInput,
} from '../programAssignedNotification';

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
  console.log('\n--- shape: required fields pass through ---');
  {
    const out = __buildProgramAssignedNotification({
      program: { id: 'prog-1', clientId: 'client-1', templateName: 'Hypertrophy Block' },
      trainerName: 'Alice',
      senderId: 'trainer-1',
      workoutCount: 4,
      daysPerWeek: 4,
      actualWeeks: 8,
    });
    assertEqual('userId === program.clientId', out.userId, 'client-1');
    assertEqual('type is program_assigned', out.type, 'program_assigned');
    assertEqual('title is "New Program Assigned"', out.title, 'New Program Assigned');
    assertEqual('programId passes through', out.programId, 'prog-1');
    assertEqual('senderId passes through', out.senderId, 'trainer-1');
    assertEqual('link is deep-link', out.link, '/program?programId=prog-1');
    assertEqual('actionUrl === link', out.actionUrl, out.link);
  }

  console.log('\n--- rich message when all counts present ---');
  {
    const out = __buildProgramAssignedNotification({
      program: { id: 'p', clientId: 'c', templateName: 'Hypertrophy Block' },
      trainerName: 'Alice',
      senderId: 's',
      workoutCount: 4,
      daysPerWeek: 4,
      actualWeeks: 8,
    });
    assertEqual(
      'rich message with day/week/weeks',
      out.message,
      'Alice assigned you "Hypertrophy Block" — 4 workouts, 4×/week for 8 weeks',
    );
  }

  console.log('\n--- fallback message when any count missing ---');
  for (const [label, patch] of [
    ['actualWeeks missing', { actualWeeks: undefined }],
    ['daysPerWeek missing', { daysPerWeek: undefined }],
    ['workoutCount missing', { workoutCount: undefined }],
    ['actualWeeks 0', { actualWeeks: 0 }],
    ['daysPerWeek 0', { daysPerWeek: 0 }],
    ['workoutCount 0', { workoutCount: 0 }],
  ] as const) {
    const input: BuildProgramAssignedNotificationInput = {
      program: { id: 'p', clientId: 'c', templateName: 'Strength' },
      trainerName: 'Bob',
      senderId: 's',
      workoutCount: 3,
      daysPerWeek: 3,
      actualWeeks: 4,
      ...(patch as Partial<BuildProgramAssignedNotificationInput>),
    };
    const out = __buildProgramAssignedNotification(input);
    assertEqual(
      `fallback — ${label}`,
      out.message,
      'Bob assigned you a new program: Strength',
    );
  }

  console.log('\n--- singular grammar for 1 workout / 1 week ---');
  {
    const out = __buildProgramAssignedNotification({
      program: { id: 'p', clientId: 'c', templateName: 'Intro' },
      trainerName: 'Dana',
      senderId: 's',
      workoutCount: 1,
      daysPerWeek: 1,
      actualWeeks: 1,
    });
    assertEqual(
      'singular workout + week',
      out.message,
      'Dana assigned you "Intro" — 1 workout, 1×/week for 1 week',
    );
  }

  console.log('\n--- templateName handling ---');
  {
    const out = __buildProgramAssignedNotification({
      program: { id: 'p', clientId: 'c' },
      trainerName: 'Charlie',
      senderId: 's',
      workoutCount: 2,
      actualWeeks: 4,
      // daysPerWeek missing — fallback path
    });
    assertEqual(
      'missing templateName → "Training Program"',
      out.message,
      'Charlie assigned you a new program: Training Program',
    );
  }
  {
    const out = __buildProgramAssignedNotification({
      program: { id: 'p', clientId: 'c', templateName: '   ' },
      trainerName: 'T',
      senderId: 's',
      workoutCount: 2,
      daysPerWeek: 2,
      actualWeeks: 2,
    });
    assertEqual(
      'whitespace templateName → "Training Program"',
      out.message,
      'T assigned you "Training Program" — 2 workouts, 2×/week for 2 weeks',
    );
  }
  {
    const out = __buildProgramAssignedNotification({
      program: { id: 'p', clientId: 'c', templateName: '' },
      trainerName: 'T',
      senderId: 's',
      workoutCount: 2,
      daysPerWeek: 2,
      actualWeeks: 2,
    });
    assertEqual(
      'empty templateName → "Training Program"',
      out.message,
      'T assigned you "Training Program" — 2 workouts, 2×/week for 2 weeks',
    );
  }

  console.log('\n--- URL-encodes programId with reserved chars ---');
  {
    const out = __buildProgramAssignedNotification({
      program: { id: 'prog/with space', clientId: 'c', templateName: 'X' },
      trainerName: 'E',
      senderId: 's',
      workoutCount: 3,
      daysPerWeek: 3,
      actualWeeks: 4,
    });
    assertEqual(
      'programId encoded',
      out.link,
      '/program?programId=prog%2Fwith%20space',
    );
    assertEqual('actionUrl mirrors link', out.actionUrl, out.link);
  }
})();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
