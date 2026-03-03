// Exercise Relations Mapping for Swap Suggestions
// Maps exercises to similar alternatives based on movement pattern, muscle focus, and equipment

export interface ExerciseRelation {
  id: string;
  name: string;
  movementPattern: 'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'core' | 'lunge' | 'rotation';
  primaryMuscles: string[];
  equipment: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'bands' | 'other';
  similarExercises: string[]; // IDs of similar exercises
}

// Exercise database with relations
export const EXERCISE_RELATIONS: Record<string, ExerciseRelation> = {
  // SQUAT PATTERN
  'barbell-back-squat': {
    id: 'barbell-back-squat',
    name: 'Barbell Back Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'barbell',
    similarExercises: ['front-squat', 'goblet-squat', 'leg-press', 'hack-squat', 'smith-squat'],
  },
  'front-squat': {
    id: 'front-squat',
    name: 'Front Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'core'],
    equipment: 'barbell',
    similarExercises: ['barbell-back-squat', 'goblet-squat', 'leg-press', 'hack-squat'],
  },
  'goblet-squat': {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'dumbbell',
    similarExercises: ['barbell-back-squat', 'front-squat', 'leg-press', 'bodyweight-squat'],
  },
  'leg-press': {
    id: 'leg-press',
    name: 'Leg Press',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'machine',
    similarExercises: ['barbell-back-squat', 'hack-squat', 'smith-squat', 'goblet-squat'],
  },
  'hack-squat': {
    id: 'hack-squat',
    name: 'Hack Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads'],
    equipment: 'machine',
    similarExercises: ['leg-press', 'barbell-back-squat', 'front-squat', 'smith-squat'],
  },
  'smith-squat': {
    id: 'smith-squat',
    name: 'Smith Machine Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'machine',
    similarExercises: ['barbell-back-squat', 'leg-press', 'hack-squat'],
  },
  
  // HINGE PATTERN
  'deadlift': {
    id: 'deadlift',
    name: 'Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes', 'back'],
    equipment: 'barbell',
    similarExercises: ['romanian-deadlift', 'trap-bar-deadlift', 'sumo-deadlift', 'hip-thrust'],
  },
  'romanian-deadlift': {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    equipment: 'barbell',
    similarExercises: ['deadlift', 'db-romanian-deadlift', 'good-morning', 'hip-thrust'],
  },
  'db-romanian-deadlift': {
    id: 'db-romanian-deadlift',
    name: 'DB Romanian Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    equipment: 'dumbbell',
    similarExercises: ['romanian-deadlift', 'single-leg-rdl', 'hip-thrust'],
  },
  'hip-thrust': {
    id: 'hip-thrust',
    name: 'Hip Thrust',
    movementPattern: 'hinge',
    primaryMuscles: ['glutes'],
    equipment: 'barbell',
    similarExercises: ['glute-bridge', 'cable-pull-through', 'romanian-deadlift'],
  },
  'kettlebell-swing': {
    id: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    movementPattern: 'hinge',
    primaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'kettlebell',
    similarExercises: ['hip-thrust', 'kettlebell-deadlift', 'romanian-deadlift', 'kettlebell-rdl'],
  },
  'kettlebell-deadlift': {
    id: 'kettlebell-deadlift',
    name: 'Kettlebell Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'kettlebell',
    similarExercises: ['deadlift', 'kettlebell-swing', 'kettlebell-rdl', 'romanian-deadlift'],
  },
  'kettlebell-rdl': {
    id: 'kettlebell-rdl',
    name: 'Kettlebell Romanian Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    equipment: 'kettlebell',
    similarExercises: ['romanian-deadlift', 'db-romanian-deadlift', 'kettlebell-deadlift', 'kettlebell-swing'],
  },
  'kettlebell-goblet-squat': {
    id: 'kettlebell-goblet-squat',
    name: 'Kettlebell Goblet Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'kettlebell',
    similarExercises: ['goblet-squat', 'barbell-back-squat', 'front-squat', 'leg-press'],
  },
  'dumbbell-rdl': {
    id: 'dumbbell-rdl',
    name: 'Dumbbell Romanian Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    equipment: 'dumbbell',
    similarExercises: ['romanian-deadlift', 'db-romanian-deadlift', 'kettlebell-rdl', 'hip-thrust'],
  },
  
  // PUSH PATTERN - HORIZONTAL
  'bench-press': {
    id: 'bench-press',
    name: 'Bench Press',
    movementPattern: 'push',
    primaryMuscles: ['chest', 'triceps'],
    equipment: 'barbell',
    similarExercises: ['db-bench-press', 'incline-bench-press', 'machine-chest-press', 'push-up'],
  },
  'db-bench-press': {
    id: 'db-bench-press',
    name: 'DB Bench Press',
    movementPattern: 'push',
    primaryMuscles: ['chest', 'triceps'],
    equipment: 'dumbbell',
    similarExercises: ['bench-press', 'incline-db-press', 'machine-chest-press', 'push-up'],
  },
  'incline-bench-press': {
    id: 'incline-bench-press',
    name: 'Incline Bench Press',
    movementPattern: 'push',
    primaryMuscles: ['chest', 'shoulders'],
    equipment: 'barbell',
    similarExercises: ['incline-db-press', 'bench-press', 'machine-incline-press'],
  },
  'incline-db-press': {
    id: 'incline-db-press',
    name: 'Incline DB Press',
    movementPattern: 'push',
    primaryMuscles: ['chest', 'shoulders'],
    equipment: 'dumbbell',
    similarExercises: ['incline-bench-press', 'db-bench-press', 'machine-incline-press'],
  },
  'push-up': {
    id: 'push-up',
    name: 'Push-up',
    movementPattern: 'push',
    primaryMuscles: ['chest', 'triceps'],
    equipment: 'bodyweight',
    similarExercises: ['bench-press', 'db-bench-press', 'machine-chest-press'],
  },
  
  // PUSH PATTERN - VERTICAL
  'overhead-press': {
    id: 'overhead-press',
    name: 'Overhead Press',
    movementPattern: 'push',
    primaryMuscles: ['shoulders', 'triceps'],
    equipment: 'barbell',
    similarExercises: ['db-shoulder-press', 'machine-shoulder-press', 'arnold-press', 'landmine-press'],
  },
  'db-shoulder-press': {
    id: 'db-shoulder-press',
    name: 'DB Shoulder Press',
    movementPattern: 'push',
    primaryMuscles: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
    similarExercises: ['overhead-press', 'machine-shoulder-press', 'arnold-press'],
  },
  
  // PULL PATTERN - HORIZONTAL
  'barbell-row': {
    id: 'barbell-row',
    name: 'Barbell Row',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipment: 'barbell',
    similarExercises: ['db-row', 'cable-row', 't-bar-row', 'machine-row'],
  },
  'db-row': {
    id: 'db-row',
    name: 'DB Row',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipment: 'dumbbell',
    similarExercises: ['barbell-row', 'cable-row', 'machine-row'],
  },
  'cable-row': {
    id: 'cable-row',
    name: 'Cable Row',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipment: 'cable',
    similarExercises: ['barbell-row', 'db-row', 'machine-row', 't-bar-row'],
  },
  
  // PULL PATTERN - VERTICAL
  'lat-pulldown': {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    movementPattern: 'pull',
    primaryMuscles: ['lats', 'biceps'],
    equipment: 'cable',
    similarExercises: ['pull-up', 'assisted-pull-up', 'straight-arm-pulldown'],
  },
  'pull-up': {
    id: 'pull-up',
    name: 'Pull-up',
    movementPattern: 'pull',
    primaryMuscles: ['lats', 'biceps'],
    equipment: 'bodyweight',
    similarExercises: ['lat-pulldown', 'assisted-pull-up', 'chin-up'],
  },
  'weighted-pull-up': {
    id: 'weighted-pull-up',
    name: 'Weighted Pull-up',
    movementPattern: 'pull',
    primaryMuscles: ['lats', 'biceps'],
    equipment: 'bodyweight',
    similarExercises: ['pull-up', 'lat-pulldown', 'chin-up'],
  },
  
  // LUNGE PATTERN
  'split-squat': {
    id: 'split-squat',
    name: 'Split Squat',
    movementPattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'bodyweight',
    similarExercises: ['bulgarian-split-squat', 'walking-lunge', 'reverse-lunge', 'step-up'],
  },
  'bulgarian-split-squat': {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    movementPattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'dumbbell',
    similarExercises: ['split-squat', 'walking-lunge', 'reverse-lunge', 'step-up'],
  },
  'walking-lunge': {
    id: 'walking-lunge',
    name: 'Walking Lunge',
    movementPattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    equipment: 'bodyweight',
    similarExercises: ['split-squat', 'bulgarian-split-squat', 'reverse-lunge'],
  },
  
  // CORE
  'plank': {
    id: 'plank',
    name: 'Plank',
    movementPattern: 'core',
    primaryMuscles: ['abs', 'obliques'],
    equipment: 'bodyweight',
    similarExercises: ['dead-bug', 'bird-dog', 'ab-wheel', 'pallof-press'],
  },
  'dead-bug': {
    id: 'dead-bug',
    name: 'Dead Bug',
    movementPattern: 'core',
    primaryMuscles: ['abs'],
    equipment: 'bodyweight',
    similarExercises: ['plank', 'bird-dog', 'hollow-hold'],
  },
  'pallof-press': {
    id: 'pallof-press',
    name: 'Pallof Press',
    movementPattern: 'core',
    primaryMuscles: ['abs', 'obliques'],
    equipment: 'cable',
    similarExercises: ['plank', 'russian-twist', 'wood-chop'],
  },
  'hanging-leg-raise': {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    movementPattern: 'core',
    primaryMuscles: ['abs'],
    equipment: 'bodyweight',
    similarExercises: ['captain-chair-raise', 'lying-leg-raise', 'ab-crunch'],
  },
};

// Get swap suggestions for an exercise
export function getSwapSuggestions(exerciseId: string): {
  similarMovement: ExerciseRelation[];
  sameMuscle: ExerciseRelation[];
  equipmentAlternatives: ExerciseRelation[];
} {
  const exercise = EXERCISE_RELATIONS[exerciseId];
  if (!exercise) {
    return { similarMovement: [], sameMuscle: [], equipmentAlternatives: [] };
  }

  const allExercises = Object.values(EXERCISE_RELATIONS);
  
  // Similar movement pattern
  const similarMovement = allExercises.filter(
    e => e.id !== exerciseId && e.movementPattern === exercise.movementPattern
  );
  
  // Same primary muscle focus
  const sameMuscle = allExercises.filter(
    e => e.id !== exerciseId && 
    e.primaryMuscles.some(m => exercise.primaryMuscles.includes(m))
  );
  
  // Equipment alternatives (same movement, different equipment)
  const equipmentAlternatives = allExercises.filter(
    e => e.id !== exerciseId && 
    e.movementPattern === exercise.movementPattern &&
    e.equipment !== exercise.equipment
  );

  return {
    similarMovement: similarMovement.slice(0, 5),
    sameMuscle: sameMuscle.slice(0, 5),
    equipmentAlternatives: equipmentAlternatives.slice(0, 5),
  };
}

// Get directly related exercises (from the similarExercises array)
export function getDirectSwaps(exerciseId: string): ExerciseRelation[] {
  const exercise = EXERCISE_RELATIONS[exerciseId];
  if (!exercise) return [];
  
  return exercise.similarExercises
    .map(id => EXERCISE_RELATIONS[id])
    .filter(Boolean);
}
