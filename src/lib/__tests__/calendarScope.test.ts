/**
 * Audit tests for `getVisibleCalendarEvents` (v15-D5).
 *
 * Run with: npx tsx src/lib/__tests__/calendarScope.test.ts
 *
 * No external test runner (vitest/jest) is configured in this repo; the
 * existing pattern (see `authGuards.test.ts`, `medalSync.test.ts`, etc.)
 * is a tsx-runnable script with a tiny custom assert harness. This file
 * follows that convention.
 *
 * Coverage maps 1:1 to v15-D5 §H1.F1 hypothesis cases:
 *   1. Shared PT session shows for both trainer and client.
 *   2. Trainer's own personal workout hidden from client.
 *   3. Client's program workout hidden from trainer.
 *   4. Another client's program workout hidden from this client.
 *   5. Cancelled events hidden by default.
 *   6. Cancelled events shown when `hideCancelled: false`.
 *   7. Legacy event missing eventScope+ownerUserId falls back to
 *      clientId/trainerId match.
 */

import { getVisibleCalendarEvents } from '../calendarScope';
import type { CalendarEvent } from '@/types';

const T1 = 'trainer-1';
const C1 = 'client-1';
const C2 = 'client-2';

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

const baseEvent = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e1',
  title: 'PT Session',
  type: 'session',
  date: '2026-05-26',
  status: 'scheduled',
  ...over,
});

(() => {
  console.log('\n--- Test 1: shared PT session is visible to both trainer and client ---');
  {
    const events = [baseEvent({ trainerId: T1, clientId: C1, eventScope: 'shared_session' })];
    assertEqual(
      'trainer sees the shared session',
      getVisibleCalendarEvents(events, { userId: T1, mode: 'trainer' }).length,
      1,
    );
    assertEqual(
      'client sees the shared session',
      getVisibleCalendarEvents(events, { userId: C1, mode: 'user' }).length,
      1,
    );
  }

  console.log("\n--- Test 2: trainer's own personal workout is hidden from client ---");
  {
    const events = [
      baseEvent({
        id: 'e2',
        type: 'workout',
        trainerId: T1,
        eventScope: 'trainer_personal',
        ownerUserId: T1,
      }),
    ];
    assertEqual(
      'trainer sees their own personal workout',
      getVisibleCalendarEvents(events, { userId: T1, mode: 'trainer' }).length,
      1,
    );
    assertEqual(
      "client does NOT see the trainer's personal workout",
      getVisibleCalendarEvents(events, { userId: C1, mode: 'user' }).length,
      0,
    );
  }

  console.log("\n--- Test 3: client's program workout is hidden from trainer's calendar ---");
  {
    const events = [
      baseEvent({
        id: 'e3',
        type: 'workout',
        trainerId: T1,
        clientId: C1,
        eventScope: 'client_assigned',
        ownerUserId: C1,
      }),
    ];
    assertEqual(
      "trainer does NOT see the client's program workout on their own calendar",
      getVisibleCalendarEvents(events, { userId: T1, mode: 'trainer' }).length,
      0,
    );
    assertEqual(
      'client sees their own program workout',
      getVisibleCalendarEvents(events, { userId: C1, mode: 'user' }).length,
      1,
    );
  }

  console.log("\n--- Test 4: another client's program workout is hidden from this client ---");
  {
    const events = [
      baseEvent({
        id: 'e4',
        type: 'workout',
        trainerId: T1,
        clientId: C2,
        eventScope: 'client_assigned',
        ownerUserId: C2,
      }),
    ];
    assertEqual(
      "client C1 does NOT see client C2's program workout",
      getVisibleCalendarEvents(events, { userId: C1, mode: 'user' }).length,
      0,
    );
  }

  console.log('\n--- Test 5: cancelled events hidden by default ---');
  {
    const events = [
      baseEvent({ id: 'e5', trainerId: T1, clientId: C1, status: 'cancelled' }),
    ];
    assertEqual(
      'cancelled event hidden from trainer',
      getVisibleCalendarEvents(events, { userId: T1, mode: 'trainer' }).length,
      0,
    );
    assertEqual(
      'cancelled event hidden from client',
      getVisibleCalendarEvents(events, { userId: C1, mode: 'user' }).length,
      0,
    );
  }

  console.log('\n--- Test 6: cancelled events shown when hideCancelled is false ---');
  {
    const events = [
      baseEvent({ id: 'e6', trainerId: T1, clientId: C1, status: 'cancelled' }),
    ];
    assertEqual(
      'trainer sees cancelled event with hideCancelled:false',
      getVisibleCalendarEvents(
        events,
        { userId: T1, mode: 'trainer' },
        { hideCancelled: false },
      ).length,
      1,
    );
  }

  console.log('\n--- Test 7: legacy event (no eventScope, no ownerUserId) falls back to clientId/trainerId match ---');
  {
    // Pre-v15 event: trainerId + clientId set, neither eventScope nor
    // ownerUserId. Both trainer and client should still see it.
    const events = [baseEvent({ id: 'e7', trainerId: T1, clientId: C1 })];
    assertEqual(
      'legacy event still visible to trainer',
      getVisibleCalendarEvents(events, { userId: T1, mode: 'trainer' }).length,
      1,
    );
    assertEqual(
      'legacy event still visible to client',
      getVisibleCalendarEvents(events, { userId: C1, mode: 'user' }).length,
      1,
    );
  }

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  if (failed > 0) process.exit(1);
})();
