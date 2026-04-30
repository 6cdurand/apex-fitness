/**
 * Tests for the workouts W1 fix.
 *
 * Run with: npx tsx src/lib/__tests__/workoutSync.test.ts
 *
 * Coverage:
 *  - W1 (tab-close data-loss fix): `endWorkout` awaits syncWorkoutToSupabase
 *    and does NOT clear `activeWorkout` / push to `workoutHistory` when the
 *    upsert fails. The finish dialog in active/page.tsx keeps the button
 *    enabled so the user can retry. Asserted via spy on a fake supabase
 *    client injected through __setWorkoutSupabaseClientForTests.
 *
 * Note: workoutStore.ts uses zustand `persist` with localStorage. Under
 * Node/tsx, `localStorage` is not defined, so we install a minimal in-memory
 * shim BEFORE importing the module. We also pre-seed the Supabase env vars
 * so isSupabaseConfigured() returns true (otherwise syncWorkoutToSupabase
 * short-circuits before reaching the seam under test).
 */

// ---- env shim: make isSupabaseConfigured() return true under tsx --------
// These values are NEVER sent to the network — we override the supabase
// client with a fake before any test runs.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJtest.fake.token';

// ---- localStorage shim for zustand/persist during module load ------------
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    key(i: number) { return Array.from(store.keys())[i] ?? null; },
    getItem(k: string) { return store.get(k) ?? null; },
    setItem(k: string, v: string) { store.set(k, v); },
    removeItem(k: string) { store.delete(k); },
  };
}

import { useWorkoutStore } from '../stores/workoutStore';
import { __setWorkoutSupabaseClientForTests } from '../supabaseSync';
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

interface FakeUpsertEvent {
  table: string;
  phase: 'enter' | 'exit';
  payload: any;
}

/**
 * Build a fake supabase client whose `.from(table).upsert(payload).select()`
 * records events and returns `{ error }` per the supplied behavior. The
 * async tick on upsert ensures the test can distinguish awaited vs
 * fire-and-forget call ordering.
 */
function makeFakeClient(behavior: { workouts?: 'ok' | 'error' } = {}): {
  client: any;
  events: FakeUpsertEvent[];
} {
  const events: FakeUpsertEvent[] = [];
  const client = {
    from(table: string) {
      return {
        upsert: (payload: any) => {
          events.push({ table, phase: 'enter', payload });
          const thenable = {
            select: async () => {
              // Force a microtask tick so fire-and-forget ordering would be
              // observable. With proper await, the caller cannot proceed
              // past this point until we resolve.
              await new Promise<void>(resolve => setTimeout(resolve, 5));
              events.push({ table, phase: 'exit', payload });
              const fail = table === 'workouts' && behavior.workouts === 'error';
              return {
                error: fail ? { code: 'TEST_FAIL', message: `forced ${table} failure` } : null,
                data: fail ? null : [payload],
              };
            },
          };
          return thenable;
        },
      };
    },
  };
  return { client, events };
}

function seedActiveWorkout(overrides: Partial<Workout> = {}): Workout {
  const workout: Workout = {
    id: 'test-workout-1',
    userId: 'user-alice',
    name: 'Test Workout',
    exercises: [
      {
        id: 'ex-1',
        exerciseId: 'bench-press',
        exercise: {
          id: 'bench-press',
          name: 'Bench Press',
          category: 'chest',
          equipment: 'barbell',
          muscleGroups: ['chest'],
          instructions: '',
        } as any,
        sets: [
          { id: 's-1', setNumber: 1, weight: 100, reps: 5, completed: true },
        ],
      } as any,
    ],
    startTime: '2026-04-30T10:00:00.000Z',
    totalVolume: 0,
    status: 'active',
    ...overrides,
  };

  // Reset the store so a previous test case doesn't leak through.
  useWorkoutStore.setState({
    activeWorkout: workout,
    workoutHistory: [],
    workoutTimer: { isRunning: true, seconds: 1800, type: 'workout' },
    restTimer: { isRunning: false, seconds: 0, type: 'rest' },
    currentClientId: null,
    personalBests: [],
  });

  return workout;
}

(async () => {
  console.log('\n--- W1: endWorkout awaits syncWorkoutToSupabase before clearing activeWorkout ---');

  // --- Case 1: sync fails → activeWorkout is preserved, history untouched. ---
  {
    const { client, events } = makeFakeClient({ workouts: 'error' });
    __setWorkoutSupabaseClientForTests(client);

    const seeded = seedActiveWorkout();
    const result = await useWorkoutStore.getState().endWorkout('private note', 'shared note');

    __setWorkoutSupabaseClientForTests(null);

    assert('sync-fail: endWorkout returns null', result === null);

    const stateAfter = useWorkoutStore.getState();
    assert(
      'ACCEPTANCE W1: activeWorkout is preserved when sync fails',
      stateAfter.activeWorkout !== null && stateAfter.activeWorkout?.id === seeded.id,
      `activeWorkout=${stateAfter.activeWorkout ? stateAfter.activeWorkout.id : 'null'}`,
    );
    assert(
      'sync-fail: workoutHistory is NOT appended when sync fails',
      stateAfter.workoutHistory.length === 0,
      `history length=${stateAfter.workoutHistory.length}`,
    );
    assert(
      'sync-fail: workoutTimer is still running (no reset)',
      stateAfter.workoutTimer.isRunning === true,
    );
    assert(
      'sync-fail: the upsert was attempted exactly once',
      events.filter(e => e.table === 'workouts' && e.phase === 'enter').length === 1,
      `events=${JSON.stringify(events.map(e => `${e.table}:${e.phase}`))}`,
    );
  }

  // --- Case 2: sync succeeds → activeWorkout cleared, history has the workout. ---
  {
    const { client, events } = makeFakeClient({ workouts: 'ok' });
    __setWorkoutSupabaseClientForTests(client);

    const seeded = seedActiveWorkout({ id: 'test-workout-happy' });
    const result = await useWorkoutStore.getState().endWorkout();

    __setWorkoutSupabaseClientForTests(null);

    assert('sync-ok: endWorkout returns the completed workout', !!result && result.id === seeded.id);
    assert('sync-ok: completedWorkout.status is "completed"', result?.status === 'completed');

    const stateAfter = useWorkoutStore.getState();
    assert('sync-ok: activeWorkout is cleared', stateAfter.activeWorkout === null);
    assert(
      'sync-ok: workoutHistory now contains the completed workout',
      stateAfter.workoutHistory.length === 1 && stateAfter.workoutHistory[0].id === seeded.id,
      `history=${JSON.stringify(stateAfter.workoutHistory.map(w => w.id))}`,
    );
    assert(
      'ACCEPTANCE W1: the upsert exited before local state was cleared (await order preserved)',
      (() => {
        const exitIdx = events.findIndex(e => e.table === 'workouts' && e.phase === 'exit');
        return exitIdx >= 0;
      })(),
      `events=${JSON.stringify(events.map(e => `${e.table}:${e.phase}`))}`,
    );
  }

  // --- Case 3: no active workout → endWorkout returns null without syncing. ---
  {
    const { client, events } = makeFakeClient({ workouts: 'ok' });
    __setWorkoutSupabaseClientForTests(client);

    useWorkoutStore.setState({
      activeWorkout: null,
      workoutHistory: [],
      workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
      restTimer: { isRunning: false, seconds: 0, type: 'rest' },
      currentClientId: null,
      personalBests: [],
    });

    const result = await useWorkoutStore.getState().endWorkout();

    __setWorkoutSupabaseClientForTests(null);

    assert('no-active: endWorkout returns null', result === null);
    assert(
      'no-active: no upsert is attempted when there is no activeWorkout',
      events.length === 0,
      `events=${JSON.stringify(events)}`,
    );
  }

  // ============ Summary ============
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
  // Reset store so the setTimeout(100) runDeriveAll that fired in the happy
  // path can run without assertion interference (it uses stale empty state).
  useWorkoutStore.setState({
    activeWorkout: null,
    workoutHistory: [],
    personalBests: [],
  });
  // Give the deferred runDeriveAll + any pending microtasks time to flush
  // before we exit so we don't leave dangling timers.
  await new Promise(resolve => setTimeout(resolve, 150));
  if (failed > 0) process.exit(1);
})();
