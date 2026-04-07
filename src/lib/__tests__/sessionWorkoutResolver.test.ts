import { isUuid, isEventCompleted } from '../sessionWorkoutResolver';
import type { CalendarEvent } from '@/types';

// ============ isUuid ============

describe('isUuid', () => {
  it('returns true for valid UUID v4', () => {
    expect(isUuid('fd3cd528-75e4-4716-aadd-6f0f631ca231')).toBe(true);
    expect(isUuid('2bd072d9-88e7-4ba4-be8a-e66b2b403c2a')).toBe(true);
    expect(isUuid('93a0c381-ca68-4e2c-8f82-11aaf45f95e2')).toBe(true);
  });

  it('returns true for UUID v1', () => {
    expect(isUuid('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
  });

  it('returns false for legacy session-workout tokens', () => {
    expect(isUuid('session-workout-1774766788794')).toBe(false);
  });

  it('returns false for arbitrary strings', () => {
    expect(isUuid('hello-world')).toBe(false);
    expect(isUuid('12345')).toBe(false);
    expect(isUuid('')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it('handles whitespace-padded UUIDs', () => {
    expect(isUuid('  fd3cd528-75e4-4716-aadd-6f0f631ca231  ')).toBe(true);
  });
});

// ============ isEventCompleted ============

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    title: 'Session',
    type: 'session',
    date: '2025-04-07',
    status: 'scheduled',
    ...overrides,
  };
}

describe('isEventCompleted', () => {
  it('returns true when event.status is completed', () => {
    expect(isEventCompleted(makeEvent({ status: 'completed' }))).toBe(true);
  });

  it('returns false when event.status is scheduled', () => {
    expect(isEventCompleted(makeEvent({ status: 'scheduled' }))).toBe(false);
  });

  it('returns false when event.status is cancelled', () => {
    expect(isEventCompleted(makeEvent({ status: 'cancelled' }))).toBe(false);
  });

  it('returns false for scheduled event even if workoutId exists', () => {
    // This is the Hendrik scenario: event is scheduled, but there are completed workouts for the client.
    // isEventCompleted should ONLY look at event.status, not external workout state.
    expect(isEventCompleted(makeEvent({
      status: 'scheduled',
      workoutId: 'fd3cd528-75e4-4716-aadd-6f0f631ca231',
      clientId: '93a0c381-ca68-4e2c-8f82-11aaf45f95e2',
    }))).toBe(false);
  });
});

// ============ resolveWorkoutForSession ============
// Note: resolveWorkoutForSession is async and calls Supabase,
// so full integration tests would need a mock. Here we test the
// logic flow via isUuid which is the gating check.

describe('resolveWorkoutForSession gating logic', () => {
  it('non-UUID workoutId would short-circuit to null (Jason scenario)', () => {
    const event = makeEvent({
      workoutId: 'session-workout-1774766788794',
      clientId: '2bd072d9-88e7-4ba4-be8a-e66b2b403c2a',
    });
    // The resolver checks isUuid first — this would return false
    expect(isUuid(event.workoutId)).toBe(false);
  });

  it('valid UUID workoutId passes the gate', () => {
    const event = makeEvent({
      workoutId: 'fd3cd528-75e4-4716-aadd-6f0f631ca231',
    });
    expect(isUuid(event.workoutId)).toBe(true);
  });

  it('missing workoutId fails the gate', () => {
    const event = makeEvent({});
    expect(isUuid(event.workoutId)).toBe(false);
  });
});
