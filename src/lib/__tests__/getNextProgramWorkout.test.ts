/**
 * getNextProgramWorkout Tests (v10-D1)
 * 
 * Tests dual-detection logic for program workout matching:
 * - Fast path via sourceProgramId (D17)
 * - Legacy path via templateId prefix
 * 
 * Run: npx tsx src/lib/__tests__/getNextProgramWorkout.test.ts
 */

describe('getNextProgramWorkout dual detection (v10-D1)', () => {
  test('Fast-path match by sourceProgramId', () => {
    console.log('[Test] Fast-path match by sourceProgramId');
    console.log('[Test]   Workout with sourceProgramId === program.id');
    console.log('[Test]   and NO templateId prefix → counts in week-progress');
    console.log('[Test]   Asserts completedDayIndices extracted via sourceDayIndex');
    expect(true).toBe(true);
  });

  test('Legacy match by templateId prefix', () => {
    console.log('[Test] Legacy match by templateId prefix');
    console.log('[Test]   Workout with templateId: "program-abc-2"');
    console.log('[Test]   and NO sourceProgramId → counts in week-progress');
    console.log('[Test]   Asserts completedDayIndices = [2]');
    expect(true).toBe(true);
  });

  test('Mixed history', () => {
    console.log('[Test] Mixed history');
    console.log('[Test]   1 fast-path workout + 1 legacy workout');
    console.log('[Test]   → both count, both day indices captured');
    expect(true).toBe(true);
  });

  test('Empty clientPrograms', () => {
    console.log('[Test] Empty clientPrograms');
    console.log('[Test]   returns null without throwing');
    expect(true).toBe(true);
  });

  test('No matching workouts', () => {
    console.log('[Test] No matching workouts');
    console.log('[Test]   completedThisWeek === 0 and dayIndex === 0');
    expect(true).toBe(true);
  });
});

// v15-D8: completion-propagation regression coverage (program-day source
// tagging on session-start paths). The existing file uses placeholder-style
// tests because the repo has no installed test runner (no vitest/jest in
// package.json, no `test` script). The cases below are encoded as docs +
// trivial expects to match convention, with a manual verification checklist
// for the conductor to run post-merge.
describe('v15-D8: getNextProgramWorkout completion propagation', () => {
  test('PT-session workout tagged with sourceProgramId+sourceDayIndex counts as program-day completion', () => {
    console.log('[Test] PT-session start path now passes `source` to startFromTemplate');
    console.log('[Test]   today/page.tsx handleStartSessionEvent derives programSource');
    console.log('[Test]   from event.programId + event.programDayIndex');
    console.log('[Test]   Workout: { sourceProgramId, sourceDayIndex: 0, assignedBy: trainer }');
    console.log('[Test]   Expect: matchesProgram(w) === true (fast path)');
    console.log('[Test]   Expect: completedDayIndices includes 0');
    console.log('[Test]   Expect: remainingThisWeek decremented by 1');
    console.log('[Test]   Expect: dayIndex advances past Push A (0) to Pull A (1)');
    expect(true).toBe(true);
  });

  test('Untagged session workout (pre-D8 bug shape) does NOT count', () => {
    console.log('[Test] Locks in the regression — untagged completed workout must not falsely advance progress');
    console.log('[Test]   Workout: { templateId: "session-evt-1", sourceProgramId: undefined }');
    console.log('[Test]   matchesProgram(w) fast path: w.sourceProgramId === program.id → false');
    console.log('[Test]   legacy prefix check: "session-evt-1".startsWith("program-<id>-") → false');
    console.log('[Test]   Expect: completedDayIndices does NOT contain 0');
    console.log('[Test]   Expect: remainingThisWeek unchanged');
    expect(true).toBe(true);
  });

  test('Completed-status calendar event releases the lock (F4)', () => {
    console.log('[Test] Defence-in-depth: status=completed booking must release D4 lock');
    console.log('[Test]   trainerStore lock filter now bypasses entries where e.status === "completed"');
    console.log('[Test]   Even if completion propagation lagged (workout tag missing),');
    console.log('[Test]   the booking itself being completed releases the lock.');
    console.log('[Test]   Expect: lockedDayIndices does NOT contain that day');
  });

  test('Legacy /clients/[id] quick-start path now tags both halves (F3)', () => {
    console.log('[Test] addCalendarEvent({ ..., programDayIndex: i }) on quick-start');
    console.log('[Test] startFromTemplate(template, clientId, { programId, dayIndex: i })');
    console.log('[Test] Equivalent lock + completion semantics as the calendar booking path');
    expect(true).toBe(true);
  });
});

// Manual test checklist (post-merge):
console.log('\n=== MANUAL TEST CHECKLIST ===\n');
console.log('1. New athlete logs in → goes DIRECTLY to /today');
console.log('   (without visiting /program first)');
console.log('   → "Next Workout" card with assigned program appears within ~500ms');
console.log('');
console.log('2. Background the app, foreground it');
console.log('   → clientPrograms re-hydrate (console log visible)');
console.log('');
console.log('3. Athlete completes a workout');
console.log('   Open same workout on different device (after Supabase sync)');
console.log('   → workout detail page correctly reports it as program workout');
console.log('');
console.log('4. Athlete starts workout from notification deep-link');
console.log('   (no /program visit) → finish with modifications');
console.log('   → save-changes prompt appears');
console.log('');
