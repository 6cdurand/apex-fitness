/**
 * workoutSync.schemaDriftRetry.test.ts
 *
 * Regression guard for the "Failed to save workout. Check your connection
 * and tap Finish again." bug (2026-05-11). Root cause: v7 sprint dispatch
 * D2 (2026-05-10) added a `blocks` JSONB write to toDbWorkout without
 * shipping the prerequisite ADD COLUMN migration. Every workout-finish
 * failed with Postgres 42703 ("column 'blocks' does not exist") and the
 * UI surfaced this as a connection error.
 *
 * Fix: syncWorkoutToSupabase now detects schema-cache misses on optional
 * columns, strips them, and retries once with the core payload. This file
 * exercises that retry path against a fake Supabase client.
 *
 * Run: npx tsx src/lib/__tests__/workoutSync.schemaDriftRetry.test.ts
 */

// MUST happen before importing supabaseSync — isSupabaseConfigured() short-circuits
// the sync to `return false` if the env vars are absent, which would bypass the
// retry path we're trying to exercise. Use dummy values; we override the real
// client via __setWorkoutSupabaseClientForTests below.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import {
  syncWorkoutToSupabase,
  __setWorkoutSupabaseClientForTests,
} from '../supabaseSync';
import type { Workout } from '../../types/index.js';

// ─── Tiny test helpers (no jest dependency) ────────────────────────────────
let failures = 0;
function assert(cond: boolean, label: string): void {
  if (!cond) {
    console.error(`✗ ${label}`);
    failures += 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

// ─── Fake Supabase upsert chain ────────────────────────────────────────────
//
// The real client exposes:
//   client.from('workouts').upsert(payload).select() → Promise<{data, error}>
//
// Our fake captures every upsert payload it sees and returns a configurable
// sequence of responses so we can simulate "first call fails with 42703,
// second call (with stripped payload) succeeds".
function makeFakeClient(
  responses: Array<{ error: { code?: string; message: string } | null }>,
) {
  const calls: Array<{ table: string; payload: any }> = [];
  let callIdx = 0;
  const client = {
    from(table: string) {
      return {
        upsert(payload: any) {
          calls.push({ table, payload });
          return {
            select() {
              const res = responses[callIdx] ?? { error: null };
              callIdx += 1;
              return Promise.resolve({ data: res.error ? null : [payload], error: res.error });
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

function makeBaseWorkout(): Workout {
  return {
    id: 'wk-test-1',
    userId: 'user-test-1',
    name: 'Schema-Drift Test',
    exercises: [],
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    duration: 1234,
    totalVolume: 0,
    status: 'completed',
    blocks: [
      {
        id: 'block-x',
        type: 'circuit',
        name: 'AMRAP',
        timerSeconds: 600,
        completed: true,
        roundsCompleted: 3,
      },
    ],
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log('workoutSync.schemaDriftRetry');

  // Test 1: 42703 on first call → stripped retry succeeds → returns true.
  {
    const { client, calls } = makeFakeClient([
      { error: { code: '42703', message: "column 'blocks' of relation 'workouts' does not exist" } },
      { error: null },
    ]);
    __setWorkoutSupabaseClientForTests(client);
    const result = await syncWorkoutToSupabase(makeBaseWorkout());
    assert(result === true, 'returns true after 42703 retry succeeds');
    assert(calls.length === 2, 'made exactly two upsert calls');
    assert('blocks' in calls[0].payload, 'first call included blocks');
    assert(!('blocks' in calls[1].payload), 'retry call stripped blocks');
    assert(calls[1].payload.id === 'wk-test-1', 'retry preserved core fields (id)');
    assert(calls[1].payload.user_id === 'user-test-1', 'retry preserved core fields (user_id)');
    __setWorkoutSupabaseClientForTests(null);
  }

  // Test 2: PostgREST schema-cache message on first call → retry path also fires.
  {
    const { client, calls } = makeFakeClient([
      { error: { message: "Could not find the 'blocks' column of 'workouts' in the schema cache" } },
      { error: null },
    ]);
    __setWorkoutSupabaseClientForTests(client);
    const result = await syncWorkoutToSupabase(makeBaseWorkout());
    assert(result === true, 'returns true for PostgREST schema-cache miss too');
    assert(calls.length === 2, 'schema-cache miss also triggers retry');
    __setWorkoutSupabaseClientForTests(null);
  }

  // Test 3: Non-schema error (e.g. unique violation) → NO retry, returns false.
  {
    const { client, calls } = makeFakeClient([
      { error: { code: '23505', message: 'duplicate key value violates unique constraint "workouts_pkey"' } },
    ]);
    __setWorkoutSupabaseClientForTests(client);
    const result = await syncWorkoutToSupabase(makeBaseWorkout());
    assert(result === false, 'returns false on non-schema error');
    assert(calls.length === 1, 'no retry on non-schema error');
    __setWorkoutSupabaseClientForTests(null);
  }

  // Test 4: 42703 on first call AND retry also errors → returns false.
  {
    const { client, calls } = makeFakeClient([
      { error: { code: '42703', message: 'column "blocks" does not exist' } },
      { error: { code: '42501', message: 'permission denied' } },
    ]);
    __setWorkoutSupabaseClientForTests(client);
    const result = await syncWorkoutToSupabase(makeBaseWorkout());
    assert(result === false, 'returns false if retry also fails');
    assert(calls.length === 2, 'retry attempted exactly once even on second failure');
    __setWorkoutSupabaseClientForTests(null);
  }

  // Test 5: Happy path with no schema issue → exactly one call, returns true.
  {
    const { client, calls } = makeFakeClient([{ error: null }]);
    __setWorkoutSupabaseClientForTests(client);
    const result = await syncWorkoutToSupabase(makeBaseWorkout());
    assert(result === true, 'happy path returns true');
    assert(calls.length === 1, 'happy path makes exactly one call');
    assert('blocks' in calls[0].payload, 'happy path keeps blocks in payload');
    __setWorkoutSupabaseClientForTests(null);
  }

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\n✓ All schema-drift retry tests passed');
}

run().catch((e) => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
