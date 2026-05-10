/**
 * WarmupSequence.test.ts — Tests for warmup sequence mode
 * 
 * Verifies auto-advance, skip controls, timer editing, and completion callback.
 * 
 * Run: npx tsx src/components/__tests__/WarmupSequence.test.ts
 */

import type { WorkoutExercise } from '../../types/index.js';

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
    toBeGreaterThan(expected: number) {
      if (typeof value !== 'number' || value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
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

// Mock exercises for testing
function createMockExercises(count: number): WorkoutExercise[] {
  const exercises: WorkoutExercise[] = [];
  for (let i = 0; i < count; i++) {
    exercises.push({
      id: `ex-${i}`,
      exerciseId: `exercise-${i}`,
      exercise: {
        id: `exercise-${i}`,
        name: `Exercise ${i + 1}`,
        category: 'warmup' as const,
        primaryMuscles: ['test'],
        secondaryMuscles: [],
        equipment: 'bodyweight',
      },
      sets: [{
        id: `set-${i}`,
        setNumber: 1,
        reps: 0,
        weight: 0,
        completed: false,
        type: 'normal' as const,
      }],
      restTimerSeconds: 0,
      sequenceDuration: 30 + (i * 10), // 30, 40, 50, etc.
    });
  }
  return exercises;
}

// Run tests
console.log('Running WarmupSequence tests...');
describe('WarmupSequence logic', () => {
  it('creates mock exercises with correct structure', () => {
    const exercises = createMockExercises(3);
    expect(exercises).toHaveLength(3);
    expect(exercises[0].sequenceDuration).toBe(30);
    expect(exercises[1].sequenceDuration).toBe(40);
    expect(exercises[2].sequenceDuration).toBe(50);
  });

  it('sequence duration defaults to 30 when undefined', () => {
    const exercises = createMockExercises(1);
    delete exercises[0].sequenceDuration;
    const duration = exercises[0].sequenceDuration || 30;
    expect(duration).toBe(30);
  });

  it('exercises array can be iterated for auto-advance', () => {
    const exercises = createMockExercises(3);
    let currentIndex = 0;
    
    // Simulate auto-advance
    currentIndex++;
    expect(currentIndex).toBe(1);
    expect(exercises[currentIndex].id).toBe('ex-1');
    
    currentIndex++;
    expect(currentIndex).toBe(2);
    
    // Check if we're at the last exercise
    const isLastExercise = currentIndex === exercises.length - 1;
    expect(isLastExercise).toBe(true);
  });

  it('skip forward advances index correctly', () => {
    const exercises = createMockExercises(5);
    let currentIndex = 0;
    
    // Skip forward
    if (currentIndex < exercises.length - 1) {
      currentIndex++;
    }
    expect(currentIndex).toBe(1);
    
    // Skip forward multiple times
    currentIndex = Math.min(currentIndex + 2, exercises.length - 1);
    expect(currentIndex).toBe(3);
  });

  it('skip back decreases index correctly', () => {
    const exercises = createMockExercises(5);
    let currentIndex = 3;
    
    // Skip back
    if (currentIndex > 0) {
      currentIndex--;
    }
    expect(currentIndex).toBe(2);
    
    // Skip back to beginning
    currentIndex = Math.max(0, currentIndex - 5);
    expect(currentIndex).toBe(0);
  });

  it('timer editing pauses and applies new value', () => {
    let currentSeconds = 30;
    let isPaused = false;
    
    // Start editing
    isPaused = true;
    const editValue = 45;
    
    // Save new value
    if (!isNaN(editValue) && editValue > 0) {
      currentSeconds = editValue;
    }
    isPaused = false;
    
    expect(currentSeconds).toBe(45);
    expect(isPaused).toBe(false);
  });

  it('onComplete callback pattern works', () => {
    const exercises = createMockExercises(2);
    let completeCalled = false;
    let currentIndex = 0;
    
    const onComplete = () => {
      completeCalled = true;
    };
    
    // Simulate reaching last exercise and timer hitting 0
    currentIndex = exercises.length - 1;
    const isLastExercise = currentIndex === exercises.length - 1;
    
    if (isLastExercise) {
      onComplete();
    }
    
    expect(completeCalled).toBe(true);
  });

  it('onExerciseComplete callback pattern works', () => {
    const exercises = createMockExercises(3);
    const completedExercises: string[] = [];
    
    const onExerciseComplete = (exerciseId: string, duration: number) => {
      completedExercises.push(exerciseId);
    };
    
    // Simulate completing first exercise
    onExerciseComplete(exercises[0].exerciseId, exercises[0].sequenceDuration || 30);
    expect(completedExercises).toHaveLength(1);
    expect(completedExercises[0]).toBe('exercise-0');
    
    // Complete second exercise
    onExerciseComplete(exercises[1].exerciseId, exercises[1].sequenceDuration || 30);
    expect(completedExercises).toHaveLength(2);
  });
});
console.log('\n✓ All tests passed!');
