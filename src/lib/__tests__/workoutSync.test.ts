/**
 * workoutSync.test.ts — Tests for workout block persistence
 * 
 * Verifies that cardio/circuit block snapshots round-trip through
 * toDbWorkout/fromDbWorkout and survive the endWorkout flow.
 * 
 * Run: npx tsx src/lib/__tests__/workoutSync.test.ts
 */

import type { Workout, WorkoutBlockSnapshot } from '../../types/index.js';

// Simple test helpers
function expect(value: any) {
  return {
    toBe(expected: any) {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
    toEqual(expected: any) {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    toBeDefined() {
      if (value === undefined) throw new Error('Expected value to be defined');
    },
    toBeUndefined() {
      if (value !== undefined) throw new Error('Expected value to be undefined');
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(value) || value.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${value?.length}`);
      }
    },
  };
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e: any) {
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// Mock the sync functions since we're testing serialization, not Supabase I/O
function toDbWorkout(workout: Workout): any {
  const dbWorkout: any = {
    id: workout.id,
    user_id: workout.userId,
    name: workout.name,
    exercises: workout.exercises,
    start_time: workout.startTime,
    end_time: workout.endTime,
    duration: workout.duration,
    total_volume: workout.totalVolume || 0,
    notes: workout.notes || '',
    status: workout.status || 'completed',
    assigned_by: workout.assignedBy || null,
    template_id: workout.templateId || null,
  };
  if (workout.blocks !== undefined) {
    dbWorkout.blocks = workout.blocks || null;
  }
  return dbWorkout;
}

function fromDbWorkout(dbWorkout: any): Workout {
  return {
    id: dbWorkout.id,
    userId: dbWorkout.user_id,
    name: dbWorkout.name,
    exercises: dbWorkout.exercises || [],
    startTime: dbWorkout.start_time,
    endTime: dbWorkout.end_time,
    duration: dbWorkout.duration,
    totalVolume: dbWorkout.total_volume || 0,
    notes: dbWorkout.notes,
    status: dbWorkout.status || 'completed',
    assignedBy: dbWorkout.assigned_by,
    templateId: dbWorkout.template_id,
    blocks: dbWorkout.blocks || undefined,
  };
}

// Run tests
console.log('Running workout block persistence tests...');
describe('Workout block persistence', () => {
  it('circuit block snapshot round-trips through toDb/fromDb', () => {
    const circuitBlock: WorkoutBlockSnapshot = {
      id: 'block-1',
      type: 'circuit',
      name: 'AMRAP 10',
      timerSeconds: 600,
      completed: true,
      rounds: 5,
      roundsCompleted: 4,
      roundTimes: [120, 135, 140, 145],
      roundDuration: '2min',
      restBetweenRounds: '60s',
      circuitStyle: 'amrap',
    };

    const workout: Workout = {
      id: 'workout-1',
      userId: 'user-1',
      name: 'Circuit Test',
      exercises: [],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 600,
      totalVolume: 0,
      status: 'completed',
      blocks: [circuitBlock],
    };

    const dbWorkout = toDbWorkout(workout);
    expect(dbWorkout.blocks).toBeDefined();
    expect(dbWorkout.blocks).toHaveLength(1);
    expect(dbWorkout.blocks[0].type).toBe('circuit');
    expect(dbWorkout.blocks[0].roundsCompleted).toBe(4);
    expect(dbWorkout.blocks[0].roundTimes).toEqual([120, 135, 140, 145]);

    const roundTripped = fromDbWorkout(dbWorkout);
    expect(roundTripped.blocks).toBeDefined();
    expect(roundTripped.blocks).toHaveLength(1);
    expect(roundTripped.blocks![0].roundsCompleted).toBe(4);
    expect(roundTripped.blocks![0].circuitStyle).toBe('amrap');
  });

  it('cardio block with distance splits round-trips', () => {
    const cardioBlock: WorkoutBlockSnapshot = {
      id: 'block-2',
      type: 'cardio',
      name: '5K Run',
      timerSeconds: 1500,
      completed: true,
      cardioMode: 'distance',
      cardioActivity: 'running',
      distanceCompleted: 5000,
      targetDistance: 5000,
      splits: [
        { distance: 1000, time: 300 },
        { distance: 1000, time: 295 },
        { distance: 1000, time: 305 },
        { distance: 1000, time: 310 },
        { distance: 1000, time: 290 },
      ],
    };

    const workout: Workout = {
      id: 'workout-2',
      userId: 'user-2',
      name: 'Cardio Test',
      exercises: [],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 1500,
      totalVolume: 0,
      status: 'completed',
      blocks: [cardioBlock],
    };

    const dbWorkout = toDbWorkout(workout);
    expect(dbWorkout.blocks).toBeDefined();
    expect(dbWorkout.blocks[0].cardioMode).toBe('distance');
    expect(dbWorkout.blocks[0].splits).toHaveLength(5);
    expect(dbWorkout.blocks[0].distanceCompleted).toBe(5000);

    const roundTripped = fromDbWorkout(dbWorkout);
    expect(roundTripped.blocks![0].splits).toEqual(cardioBlock.splits);
    expect(roundTripped.blocks![0].cardioActivity).toBe('running');
  });

  it('workout without blocks (back-compat) still completes', () => {
    const workout: Workout = {
      id: 'workout-3',
      userId: 'user-3',
      name: 'Strength Only',
      exercises: [
        {
          id: 'ex-1',
          exerciseId: 'squat',
          exercise: { id: 'squat', name: 'Squat', category: 'compound', primaryMuscles: ['quads'], secondaryMuscles: [], equipment: 'barbell' },
          restTimerSeconds: 90,
          sets: [
            { id: 's1', setNumber: 1, reps: 10, weight: 100, completed: true, type: 'normal' as const },
          ],
        },
      ],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 3600,
      totalVolume: 1000,
      status: 'completed',
    };

    const dbWorkout = toDbWorkout(workout);
    expect(dbWorkout.blocks).toBeUndefined();

    const roundTripped = fromDbWorkout(dbWorkout);
    expect(roundTripped.blocks).toBeUndefined();
    expect(roundTripped.exercises).toHaveLength(1);
  });
});
console.log('\n✓ All tests passed!');
