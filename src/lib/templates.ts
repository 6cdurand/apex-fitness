import { WorkoutTemplate, WorkoutExercise } from '@/types';
import { exerciseLibrary, getExerciseById } from './exercises';
import { v4 as uuidv4 } from 'uuid';

// Helper to create workout exercise from exercise ID
function createWorkoutExercise(
  exerciseId: string,
  sets: { reps: number; weight?: number }[],
  restTime: number = 90
): WorkoutExercise | null {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) return null;

  return {
    id: uuidv4(),
    exerciseId,
    exercise,
    sets: sets.map((s, idx) => ({
      id: uuidv4(),
      setNumber: idx + 1,
      type: 'normal' as const,
      weight: s.weight,
      reps: s.reps,
      completed: false,
    })),
    restTimerSeconds: restTime,
  };
}

// Pre-built workout templates
export const defaultTemplates: WorkoutTemplate[] = [
  // Push Day
  {
    id: 'template-push-day',
    name: 'Push Day',
    description: 'Chest, Shoulders, Triceps focused workout',
    exercises: [
      createWorkoutExercise('bench-press', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 120),
      createWorkoutExercise('incline-dumbbell-press', [
        { reps: 10 }, { reps: 10 }, { reps: 10 }
      ], 90),
      createWorkoutExercise('dumbbell-shoulder-press', [
        { reps: 10 }, { reps: 10 }, { reps: 10 }
      ], 90),
      createWorkoutExercise('lateral-raises', [
        { reps: 12 }, { reps: 12 }, { reps: 12 }
      ], 60),
      createWorkoutExercise('tricep-pushdown', [
        { reps: 12 }, { reps: 12 }, { reps: 12 }
      ], 60),
      createWorkoutExercise('overhead-tricep-extension', [
        { reps: 12 }, { reps: 12 }
      ], 60),
    ].filter(Boolean) as WorkoutExercise[],
    createdBy: 'system',
    isPublic: true,
    category: 'strength',
    estimatedDuration: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Pull Day
  {
    id: 'template-pull-day',
    name: 'Pull Day',
    description: 'Back and Biceps focused workout',
    exercises: [
      createWorkoutExercise('deadlift', [
        { reps: 5 }, { reps: 5 }, { reps: 5 }
      ], 180),
      createWorkoutExercise('barbell-row', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 120),
      createWorkoutExercise('lat-pulldown', [
        { reps: 10 }, { reps: 10 }, { reps: 10 }
      ], 90),
      createWorkoutExercise('cable-row', [
        { reps: 10 }, { reps: 10 }, { reps: 10 }
      ], 90),
      createWorkoutExercise('face-pulls', [
        { reps: 15 }, { reps: 15 }, { reps: 15 }
      ], 60),
      createWorkoutExercise('barbell-curl', [
        { reps: 10 }, { reps: 10 }, { reps: 10 }
      ], 60),
      createWorkoutExercise('hammer-curls', [
        { reps: 12 }, { reps: 12 }
      ], 60),
    ].filter(Boolean) as WorkoutExercise[],
    createdBy: 'system',
    isPublic: true,
    category: 'strength',
    estimatedDuration: 70,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Leg Day
  {
    id: 'template-leg-day',
    name: 'Leg Day',
    description: 'Complete lower body workout',
    exercises: [
      createWorkoutExercise('back-squat', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 180),
      createWorkoutExercise('romanian-deadlift', [
        { reps: 10 }, { reps: 10 }, { reps: 10 }
      ], 120),
      createWorkoutExercise('leg-press', [
        { reps: 12 }, { reps: 12 }, { reps: 12 }
      ], 90),
      createWorkoutExercise('leg-curl', [
        { reps: 12 }, { reps: 12 }, { reps: 12 }
      ], 60),
      createWorkoutExercise('leg-extension', [
        { reps: 12 }, { reps: 12 }, { reps: 12 }
      ], 60),
      createWorkoutExercise('standing-calf-raise', [
        { reps: 15 }, { reps: 15 }, { reps: 15 }
      ], 45),
    ].filter(Boolean) as WorkoutExercise[],
    createdBy: 'system',
    isPublic: true,
    category: 'strength',
    estimatedDuration: 75,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Upper Body
  {
    id: 'template-upper-body',
    name: 'Upper Body',
    description: 'Complete upper body workout',
    exercises: [
      createWorkoutExercise('bench-press', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 120),
      createWorkoutExercise('barbell-row', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 120),
      createWorkoutExercise('overhead-press', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 90),
      createWorkoutExercise('lat-pulldown', [
        { reps: 10 }, { reps: 10 }, { reps: 10 }
      ], 90),
      createWorkoutExercise('dumbbell-curl', [
        { reps: 12 }, { reps: 12 }
      ], 60),
      createWorkoutExercise('tricep-pushdown', [
        { reps: 12 }, { reps: 12 }
      ], 60),
    ].filter(Boolean) as WorkoutExercise[],
    createdBy: 'system',
    isPublic: true,
    category: 'strength',
    estimatedDuration: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Full Body
  {
    id: 'template-full-body',
    name: 'Full Body',
    description: 'Complete full body workout',
    exercises: [
      createWorkoutExercise('back-squat', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 120),
      createWorkoutExercise('bench-press', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 120),
      createWorkoutExercise('barbell-row', [
        { reps: 8 }, { reps: 8 }, { reps: 8 }
      ], 90),
      createWorkoutExercise('overhead-press', [
        { reps: 8 }, { reps: 8 }
      ], 90),
      createWorkoutExercise('romanian-deadlift', [
        { reps: 10 }, { reps: 10 }
      ], 90),
      createWorkoutExercise('plank', [
        { reps: 60 }, { reps: 60 }
      ], 60),
    ].filter(Boolean) as WorkoutExercise[],
    createdBy: 'system',
    isPublic: true,
    category: 'strength',
    estimatedDuration: 55,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Core & Abs
  {
    id: 'template-core',
    name: 'Core & Abs',
    description: 'Dedicated core workout',
    exercises: [
      createWorkoutExercise('plank', [
        { reps: 60 }, { reps: 60 }, { reps: 60 }
      ], 45),
      createWorkoutExercise('cable-crunches', [
        { reps: 15 }, { reps: 15 }, { reps: 15 }
      ], 45),
      createWorkoutExercise('leg-raises', [
        { reps: 12 }, { reps: 12 }, { reps: 12 }
      ], 45),
      createWorkoutExercise('russian-twists', [
        { reps: 20 }, { reps: 20 }, { reps: 20 }
      ], 45),
      createWorkoutExercise('bicycle-crunches', [
        { reps: 20 }, { reps: 20 }
      ], 30),
      createWorkoutExercise('dead-bug', [
        { reps: 10 }, { reps: 10 }
      ], 30),
    ].filter(Boolean) as WorkoutExercise[],
    createdBy: 'system',
    isPublic: true,
    category: 'core',
    estimatedDuration: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function getTemplateById(id: string): WorkoutTemplate | undefined {
  return defaultTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: string): WorkoutTemplate[] {
  return defaultTemplates.filter(t => t.category === category);
}
