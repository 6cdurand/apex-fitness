import { WorkoutExercise } from '@/types';
import { getExerciseById } from './exercises';
import { v4 as uuidv4 } from 'uuid';

// Block types for different workout sections
export type BlockType = 'strength' | 'circuit' | 'cardio' | 'warmup' | 'cooldown';

// Block colors for UI
export const blockColors: Record<BlockType, { bg: string; border: string; text: string }> = {
  strength: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400' },
  circuit: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400' },
  cardio: { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400' },
  warmup: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  cooldown: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400' },
};

// Workout block within a template
export interface WorkoutBlock {
  id: string;
  name: string;
  type: BlockType;
  exercises: WorkoutExercise[];
  rounds?: number; // For circuits
  restBetweenRounds?: number; // Seconds
  timerConfig?: {
    workSeconds: number;
    restSeconds: number;
    intervals?: number;
  };
  notes?: string;
}

// Enhanced trainer template with blocks
export interface TrainerTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'full_body' | 'upper_lower' | 'ppl' | 'focus' | 'circuit' | 'custom';
  sessionsPerWeek: number;
  dayLabel?: string; // e.g., "Day 1", "Upper", "Push"
  blocks: WorkoutBlock[];
  estimatedDuration: number; // minutes
  createdBy: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// Program template (collection of workout templates)
export interface ProgramTemplate {
  id: string;
  name: string;
  description?: string;
  sessionsPerWeek: number;
  workouts: TrainerTemplate[];
  canCycle?: boolean; // If true, cycle through workouts (e.g., 3 workouts for 6 days)
}

// Helper to create workout exercise
function createExercise(
  exerciseId: string,
  sets: number = 3,
  reps: number = 12,
  restTime: number = 90
): WorkoutExercise | null {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) {
    console.warn(`Exercise not found: ${exerciseId}`);
    return null;
  }

  return {
    id: uuidv4(),
    exerciseId,
    exercise,
    sets: Array.from({ length: sets }, (_, idx) => ({
      id: uuidv4(),
      setNumber: idx + 1,
      type: 'normal' as const,
      reps,
      completed: false,
    })),
    restTimerSeconds: restTime,
  };
}

// Helper to create a strength block
function createStrengthBlock(
  name: string,
  exercises: { id: string; sets?: number; reps?: number; rest?: number }[],
  notes?: string
): WorkoutBlock {
  return {
    id: uuidv4(),
    name,
    type: 'strength',
    exercises: exercises
      .map(e => createExercise(e.id, e.sets || 3, e.reps || 12, e.rest || 90))
      .filter(Boolean) as WorkoutExercise[],
    notes,
  };
}

// Helper to create a circuit block
function createCircuitBlock(
  name: string,
  exercises: { id: string; reps?: number }[],
  rounds: number = 3,
  restBetweenRounds: number = 60,
  timerConfig?: { workSeconds: number; restSeconds: number; intervals?: number },
  notes?: string
): WorkoutBlock {
  return {
    id: uuidv4(),
    name,
    type: 'circuit',
    exercises: exercises
      .map(e => createExercise(e.id, 1, e.reps || 12, 0))
      .filter(Boolean) as WorkoutExercise[],
    rounds,
    restBetweenRounds,
    timerConfig,
    notes,
  };
}

// ============ INDIVIDUAL WORKOUT TEMPLATES ============

// FULL BODY - Machine Based (1x/week)
export const fullBodyMachine: TrainerTemplate = {
  id: 'full-body-machine',
  name: 'Full Body (Machine-Based)',
  description: 'Complete full body workout using machines. Ideal for beginners or 1 session per week.',
  category: 'full_body',
  sessionsPerWeek: 1,
  dayLabel: 'Full Body',
  blocks: [
    createStrengthBlock('Main Workout', [
      { id: 'leg-press', sets: 3, reps: 12 },
      { id: 'machine-chest-press', sets: 3, reps: 12 },
      { id: 'machine-row', sets: 3, reps: 12 },
      { id: 'leg-curl', sets: 3, reps: 12 },
      { id: 'lat-pulldown', sets: 3, reps: 12 },
      { id: 'machine-shoulder-press', sets: 3, reps: 12 },
      { id: 'ab-crunch-machine', sets: 3, reps: 15 },
    ]),
  ],
  estimatedDuration: 45,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// FULL BODY + CIRCUIT (2x/week)
export const fullBodyCircuit: TrainerTemplate = {
  id: 'full-body-circuit',
  name: 'Full Body + Circuit',
  description: 'Full body strength work followed by a conditioning circuit.',
  category: 'full_body',
  sessionsPerWeek: 2,
  dayLabel: 'Full Body',
  blocks: [
    createStrengthBlock('Strength', [
      { id: 'leg-press', sets: 3, reps: 12 },
      { id: 'machine-chest-press', sets: 3, reps: 12 },
      { id: 'machine-row', sets: 3, reps: 12 },
      { id: 'leg-curl', sets: 3, reps: 12 },
      { id: 'lat-pulldown', sets: 3, reps: 12 },
      { id: 'machine-shoulder-press', sets: 3, reps: 12 },
      { id: 'ab-crunch-machine', sets: 3, reps: 15 },
    ]),
    createCircuitBlock(
      'Finisher Circuit',
      [
        { id: 'kettlebell-deadlift', reps: 12 },
        { id: 'reverse-lunges', reps: 8 },
        { id: 'dumbbell-curl-to-press', reps: 10 },
      ],
      3,
      60,
      { workSeconds: 60, restSeconds: 30 },
      'Row/Ski/Assault Bike: 60s moderate → 30s hard between rounds'
    ),
  ],
  estimatedDuration: 60,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// UPPER (3-Day Split)
export const upperDay: TrainerTemplate = {
  id: 'upper-3day',
  name: 'Upper Body',
  description: 'Upper body focus - part of 3-day split. All exercises 3 sets x 12-15 reps.',
  category: 'upper_lower',
  sessionsPerWeek: 3,
  dayLabel: 'Upper',
  blocks: [
    createStrengthBlock('Upper Body', [
      { id: 'chest-fly-machine', sets: 3, reps: 15 },
      { id: 'machine-row', sets: 3, reps: 15 },
      { id: 'machine-shoulder-press', sets: 3, reps: 15 },
      { id: 'lat-pulldown', sets: 3, reps: 15 },
      { id: 'cable-curl', sets: 3, reps: 12 },
      { id: 'rope-pushdown', sets: 3, reps: 12 },
    ]),
    createCircuitBlock(
      'Ab Circuit',
      [
        { id: 'plank', reps: 60 },
        { id: 'dead-bug', reps: 6 },
      ],
      3,
      30,
      undefined,
      '30-60 sec plank, 6 reps each side dead bug'
    ),
  ],
  estimatedDuration: 50,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// LOWER (3-Day Split)
export const lowerDay: TrainerTemplate = {
  id: 'lower-3day',
  name: 'Lower Body',
  description: 'Lower body focus - part of 3-day split.',
  category: 'upper_lower',
  sessionsPerWeek: 3,
  dayLabel: 'Lower',
  blocks: [
    createStrengthBlock('Lower Body', [
      { id: 'leg-press', sets: 3, reps: 15 },
      { id: 'seated-leg-curl', sets: 3, reps: 15 },
      { id: 'leg-extension', sets: 3, reps: 15 },
      { id: 'hip-abduction', sets: 3, reps: 15 },
      { id: 'standing-calf-raise', sets: 3, reps: 15 },
      { id: 'ab-crunch-machine', sets: 3, reps: 15 },
    ]),
    createStrengthBlock('Core', [
      { id: 'knee-raises', sets: 3, reps: 12 },
    ], 'Or Pallof Press'),
  ],
  estimatedDuration: 50,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// FULL BODY (3-Day Split)
export const fullBody3Day: TrainerTemplate = {
  id: 'full-body-3day',
  name: 'Full Body',
  description: 'Full body day - part of 3-day split.',
  category: 'upper_lower',
  sessionsPerWeek: 3,
  dayLabel: 'Full Body',
  blocks: [
    createStrengthBlock('Full Body', [
      { id: 'hip-thrust-machine', sets: 3, reps: 12 },
      { id: 'machine-chest-press', sets: 3, reps: 12 },
      { id: 'assisted-pull-up', sets: 3, reps: 10 },
      { id: 'romanian-deadlift', sets: 3, reps: 12 },
      { id: 'lateral-raise-machine', sets: 3, reps: 15 },
    ], 'Or dumbbell lateral raises'),
    {
      id: uuidv4(),
      name: 'Cardio Finisher',
      type: 'cardio',
      exercises: [],
      notes: 'Stair Master 5-10 minutes',
    },
  ],
  estimatedDuration: 55,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// UPPER (Simple 2-Day Split)
export const upperSimple: TrainerTemplate = {
  id: 'upper-simple',
  name: 'Upper Body',
  description: 'Simple upper body workout - 2 sessions per week.',
  category: 'upper_lower',
  sessionsPerWeek: 2,
  dayLabel: 'Upper',
  blocks: [
    createStrengthBlock('Upper Body', [
      { id: 'incline-chest-press-machine', sets: 3, reps: 12 },
      { id: 'machine-row', sets: 3, reps: 12 },
      { id: 'machine-shoulder-press', sets: 3, reps: 12 },
      { id: 'lat-pulldown', sets: 3, reps: 12 },
      { id: 'lateral-raises', sets: 3, reps: 15 },
    ]),
    createStrengthBlock('Arms Superset', [
      { id: 'cable-curl', sets: 3, reps: 12 },
      { id: 'rope-pushdown', sets: 3, reps: 12 },
    ], 'Perform as superset'),
  ],
  estimatedDuration: 45,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// LOWER (Simple 2-Day Split)
export const lowerSimple: TrainerTemplate = {
  id: 'lower-simple',
  name: 'Lower Body',
  description: 'Simple lower body workout - 2 sessions per week.',
  category: 'upper_lower',
  sessionsPerWeek: 2,
  dayLabel: 'Lower',
  blocks: [
    createStrengthBlock('Lower Body', [
      { id: 'leg-press', sets: 3, reps: 12 },
      { id: 'leg-curl', sets: 3, reps: 12 },
      { id: 'leg-extension', sets: 3, reps: 12 },
      { id: 'hip-abduction', sets: 3, reps: 15 },
      { id: 'hip-adduction', sets: 3, reps: 15 },
    ]),
    createStrengthBlock('Calves + Core', [
      { id: 'standing-calf-raise', sets: 3, reps: 15 },
      { id: 'ab-crunch-machine', sets: 3, reps: 15 },
    ]),
  ],
  estimatedDuration: 45,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// FOCUS SPLITS (4x/week)
export const upperChestFocus: TrainerTemplate = {
  id: 'upper-chest-focus',
  name: 'Upper - Chest Focus',
  description: 'Chest-focused upper body day.',
  category: 'focus',
  sessionsPerWeek: 4,
  dayLabel: 'Upper Chest',
  blocks: [
    createStrengthBlock('Chest Focus', [
      { id: 'incline-chest-press-machine', sets: 4, reps: 12 },
      { id: 'cable-fly-low-to-high', sets: 3, reps: 15 },
      { id: 'machine-shoulder-press', sets: 3, reps: 12 },
      { id: 'tricep-pushdown', sets: 3, reps: 15 },
    ]),
  ],
  estimatedDuration: 40,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const lowerQuadFocus: TrainerTemplate = {
  id: 'lower-quad-focus',
  name: 'Lower - Quad Focus',
  description: 'Quad-focused lower body day.',
  category: 'focus',
  sessionsPerWeek: 4,
  dayLabel: 'Lower Quad',
  blocks: [
    createStrengthBlock('Quad Focus', [
      { id: 'hack-squat', sets: 4, reps: 12 },
      { id: 'leg-press', sets: 3, reps: 15 },
      { id: 'leg-extension', sets: 3, reps: 15 },
      { id: 'walking-lunges', sets: 3, reps: 10 },
    ], 'Feet low on leg press'),
  ],
  estimatedDuration: 40,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const upperBackFocus: TrainerTemplate = {
  id: 'upper-back-focus',
  name: 'Upper - Back Focus',
  description: 'Back-focused upper body day.',
  category: 'focus',
  sessionsPerWeek: 4,
  dayLabel: 'Upper Back',
  blocks: [
    createStrengthBlock('Back Focus', [
      { id: 'high-row-machine', sets: 4, reps: 12 },
      { id: 'lat-pulldown', sets: 3, reps: 12 },
      { id: 'rear-delt-flyes', sets: 3, reps: 15 },
      { id: 'cable-row', sets: 3, reps: 12 },
    ], 'Wide grip on pulldown'),
  ],
  estimatedDuration: 40,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const lowerGluteFocus: TrainerTemplate = {
  id: 'lower-glute-focus',
  name: 'Lower - Glute Focus',
  description: 'Glute-focused lower body day.',
  category: 'focus',
  sessionsPerWeek: 4,
  dayLabel: 'Lower Glute',
  blocks: [
    createStrengthBlock('Glute Focus', [
      { id: 'hip-thrust-machine', sets: 4, reps: 12 },
      { id: 'leg-press', sets: 3, reps: 12 },
      { id: 'rdl-machine', sets: 3, reps: 12 },
      { id: 'cable-kickbacks', sets: 3, reps: 15 },
    ], 'Feet high & wide on leg press'),
  ],
  estimatedDuration: 40,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const shouldersArms: TrainerTemplate = {
  id: 'shoulders-arms',
  name: 'Shoulders + Arms',
  description: 'Shoulders and arms focus day.',
  category: 'focus',
  sessionsPerWeek: 6,
  dayLabel: 'Shoulders + Arms',
  blocks: [
    createStrengthBlock('Shoulders + Arms', [
      { id: 'machine-shoulder-press', sets: 4, reps: 12 },
      { id: 'lateral-raises', sets: 3, reps: 15 },
      { id: 'rear-delt-flyes', sets: 3, reps: 15 },
      { id: 'cable-curl', sets: 3, reps: 12 },
      { id: 'rope-pushdown', sets: 3, reps: 12 },
    ]),
  ],
  estimatedDuration: 45,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// PUSH / PULL / LEGS (3x/week)
export const pushDay: TrainerTemplate = {
  id: 'push-day',
  name: 'Push Day',
  description: 'Chest, shoulders, triceps.',
  category: 'ppl',
  sessionsPerWeek: 3,
  dayLabel: 'Push',
  blocks: [
    createStrengthBlock('Push', [
      { id: 'machine-chest-press', sets: 4, reps: 12 },
      { id: 'incline-chest-press-machine', sets: 3, reps: 12 },
      { id: 'machine-shoulder-press', sets: 3, reps: 12 },
      { id: 'pec-deck', sets: 3, reps: 15 },
      { id: 'tricep-extension-machine', sets: 3, reps: 15 },
    ]),
  ],
  estimatedDuration: 50,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const pullDay: TrainerTemplate = {
  id: 'pull-day',
  name: 'Pull Day',
  description: 'Back and biceps.',
  category: 'ppl',
  sessionsPerWeek: 3,
  dayLabel: 'Pull',
  blocks: [
    createStrengthBlock('Pull', [
      { id: 'lat-pulldown', sets: 4, reps: 12 },
      { id: 'machine-row', sets: 4, reps: 12 },
      { id: 'rear-delt-flyes', sets: 3, reps: 15 },
      { id: 'face-pulls', sets: 3, reps: 15 },
      { id: 'bicep-curl-machine', sets: 3, reps: 12 },
    ]),
  ],
  estimatedDuration: 50,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const legsDay: TrainerTemplate = {
  id: 'legs-day',
  name: 'Legs Day',
  description: 'Complete leg workout.',
  category: 'ppl',
  sessionsPerWeek: 3,
  dayLabel: 'Legs',
  blocks: [
    createStrengthBlock('Legs', [
      { id: 'leg-press', sets: 4, reps: 12 },
      { id: 'hack-squat', sets: 3, reps: 12 },
      { id: 'leg-curl', sets: 3, reps: 12 },
      { id: 'leg-extension', sets: 3, reps: 15 },
      { id: 'standing-calf-raise', sets: 4, reps: 15 },
    ]),
  ],
  estimatedDuration: 50,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// CHEST+BACK / SHOULDERS+ARMS / LEGS (3x/week)
export const chestBackDay: TrainerTemplate = {
  id: 'chest-back-day',
  name: 'Chest + Back',
  description: 'Chest and back superset style.',
  category: 'custom',
  sessionsPerWeek: 3,
  dayLabel: 'Chest + Back',
  blocks: [
    createStrengthBlock('Chest + Back', [
      { id: 'machine-chest-press', sets: 4, reps: 12 },
      { id: 'incline-chest-press-machine', sets: 3, reps: 12 },
      { id: 'lat-pulldown', sets: 4, reps: 12 },
      { id: 'machine-row', sets: 3, reps: 12 },
      { id: 'straight-arm-pulldown', sets: 3, reps: 15 },
    ]),
  ],
  estimatedDuration: 55,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const shouldersArmsDay: TrainerTemplate = {
  id: 'shoulders-arms-day',
  name: 'Shoulders + Arms',
  description: 'Shoulders and arms focus.',
  category: 'custom',
  sessionsPerWeek: 3,
  dayLabel: 'Shoulders + Arms',
  blocks: [
    createStrengthBlock('Shoulders + Arms', [
      { id: 'machine-shoulder-press', sets: 4, reps: 12 },
      { id: 'lateral-raises', sets: 3, reps: 15 },
      { id: 'rear-delt-flyes', sets: 3, reps: 15 },
      { id: 'cable-curl', sets: 3, reps: 12 },
      { id: 'rope-pushdown', sets: 3, reps: 12 },
    ]),
  ],
  estimatedDuration: 45,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const legsDay2: TrainerTemplate = {
  id: 'legs-day-2',
  name: 'Legs',
  description: 'Complete leg workout with core.',
  category: 'custom',
  sessionsPerWeek: 3,
  dayLabel: 'Legs',
  blocks: [
    createStrengthBlock('Legs', [
      { id: 'leg-press', sets: 4, reps: 12 },
      { id: 'hack-squat', sets: 3, reps: 12 },
      { id: 'leg-curl', sets: 3, reps: 12 },
      { id: 'hip-thrust-machine', sets: 3, reps: 12 },
    ]),
    createStrengthBlock('Calves + Core', [
      { id: 'standing-calf-raise', sets: 3, reps: 15 },
      { id: 'ab-crunch-machine', sets: 3, reps: 15 },
    ]),
  ],
  estimatedDuration: 55,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============ CIRCUIT TEMPLATES ============

export const circuitStrengthCardio: TrainerTemplate = {
  id: 'circuit-strength-cardio',
  name: 'Circuit: Strength → Cardio',
  description: 'Strength exercises followed by cardio intervals.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Circuit',
  blocks: [
    createCircuitBlock(
      'Strength Circuit',
      [
        { id: 'kettlebell-deadlift', reps: 12 },
        { id: 'reverse-lunges', reps: 8 },
        { id: 'dumbbell-curl-to-press', reps: 10 },
      ],
      3,
      60
    ),
    {
      id: uuidv4(),
      name: 'Cardio',
      type: 'cardio',
      exercises: [],
      timerConfig: { workSeconds: 60, restSeconds: 30 },
      notes: 'Row/Ski/Assault Bike: 60s moderate → 30s hard. 3 rounds.',
    },
  ],
  estimatedDuration: 30,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const circuitLowerBurn: TrainerTemplate = {
  id: 'circuit-lower-burn',
  name: 'Circuit: Lower Body Burn',
  description: 'Lower body focused circuit with bike intervals.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Lower Circuit',
  blocks: [
    createCircuitBlock(
      'Lower Body',
      [
        { id: 'kettlebell-goblet-squat', reps: 12 },
        { id: 'step-ups', reps: 8 },
        { id: 'kettlebell-rdl', reps: 10 },
      ],
      4,
      45,
      { workSeconds: 45, restSeconds: 15 },
      'Bike: 45s steady → 15s sprint between rounds'
    ),
  ],
  estimatedDuration: 25,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const circuitUpperPushPull: TrainerTemplate = {
  id: 'circuit-upper-push-pull',
  name: 'Circuit: Upper Push-Pull',
  description: 'Upper body push-pull circuit with ski erg.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Upper Circuit',
  blocks: [
    createCircuitBlock(
      'Push-Pull',
      [
        { id: 'incline-dumbbell-press', reps: 10 },
        { id: 'machine-row', reps: 12 },
        { id: 'shoulder-tap-plank', reps: 20 },
      ],
      3,
      60,
      undefined,
      'Ski Erg: 500m moderate → 250m fast'
    ),
  ],
  estimatedDuration: 25,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const circuitCoreConditioning: TrainerTemplate = {
  id: 'circuit-core-conditioning',
  name: 'Circuit: Core + Conditioning',
  description: 'Core focused circuit with assault bike.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Core Circuit',
  blocks: [
    createCircuitBlock(
      'Core',
      [
        { id: 'woodchoppers', reps: 10 },
        { id: 'knee-raises', reps: 12 },
        { id: 'hyperextensions', reps: 12 },
      ],
      3,
      45,
      { workSeconds: 30, restSeconds: 30, intervals: 3 },
      'Assault Bike: 30s hard → 30s easy (x3)'
    ),
  ],
  estimatedDuration: 25,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const circuitFullBodyAthletic: TrainerTemplate = {
  id: 'circuit-full-body-athletic',
  name: 'Circuit: Full Body Athletic',
  description: 'Athletic full body circuit with rowing.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Athletic Circuit',
  blocks: [
    createCircuitBlock(
      'Athletic',
      [
        { id: 'kettlebell-swing', reps: 15 },
        { id: 'walking-lunges', reps: 10 },
        { id: 'push-ups', reps: 12 },
      ],
      3,
      60,
      undefined,
      'Row Erg: 300m fast → 300m easy'
    ),
  ],
  estimatedDuration: 25,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const circuitLowImpact: TrainerTemplate = {
  id: 'circuit-low-impact',
  name: 'Circuit: Low Impact (Beginner)',
  description: 'Machine-based low impact circuit for beginners.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Beginner Circuit',
  blocks: [
    createCircuitBlock(
      'Low Impact',
      [
        { id: 'leg-press', reps: 12 },
        { id: 'machine-chest-press', reps: 10 },
        { id: 'lat-pulldown', reps: 12 },
      ],
      3,
      60,
      { workSeconds: 60, restSeconds: 0 },
      'Bike: 60s steady between rounds'
    ),
  ],
  estimatedDuration: 20,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const circuitArmsBurnout: TrainerTemplate = {
  id: 'circuit-arms-burnout',
  name: 'Circuit: Arms Burnout',
  description: 'Arms focused circuit with battle ropes.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Arms Circuit',
  blocks: [
    createCircuitBlock(
      'Arms Burnout',
      [
        { id: 'cable-curl', reps: 12 },
        { id: 'rope-pushdown', reps: 12 },
        { id: 'battle-ropes', reps: 30 },
      ],
      3,
      40,
      { workSeconds: 40, restSeconds: 20 },
      'Ski Erg: 40s hard → 20s rest'
    ),
  ],
  estimatedDuration: 20,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const circuitPower: TrainerTemplate = {
  id: 'circuit-power',
  name: 'Circuit: Power',
  description: 'Power-focused circuit for advanced clients.',
  category: 'circuit',
  sessionsPerWeek: 2,
  dayLabel: 'Power Circuit',
  blocks: [
    createCircuitBlock(
      'Power',
      [
        { id: 'med-ball-slams', reps: 10 },
        { id: 'box-squat', reps: 8 },
        { id: 'push-press', reps: 8 },
      ],
      3,
      60,
      { workSeconds: 20, restSeconds: 40 },
      'Assault Bike: 20s sprint → 40s easy'
    ),
  ],
  estimatedDuration: 25,
  createdBy: 'system',
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============ ALL TEMPLATES EXPORT ============

export const allTrainerTemplates: TrainerTemplate[] = [
  // Full Body
  fullBodyMachine,
  fullBodyCircuit,
  
  // Upper/Lower/Full (3-Day)
  upperDay,
  lowerDay,
  fullBody3Day,
  
  // Upper/Lower Simple (2-Day)
  upperSimple,
  lowerSimple,
  
  // Focus Splits (4-Day)
  upperChestFocus,
  lowerQuadFocus,
  upperBackFocus,
  lowerGluteFocus,
  shouldersArms,
  
  // PPL (3-Day)
  pushDay,
  pullDay,
  legsDay,
  
  // Chest+Back/Shoulders+Arms/Legs (3-Day)
  chestBackDay,
  shouldersArmsDay,
  legsDay2,
  
  // Circuits
  circuitStrengthCardio,
  circuitLowerBurn,
  circuitUpperPushPull,
  circuitCoreConditioning,
  circuitFullBodyAthletic,
  circuitLowImpact,
  circuitArmsBurnout,
  circuitPower,
];

// ============ PROGRAM TEMPLATES ============

export const programTemplates: ProgramTemplate[] = [
  {
    id: 'program-full-body-1x',
    name: 'Full Body (1x/week)',
    description: 'Machine-based full body workout, once per week.',
    sessionsPerWeek: 1,
    workouts: [fullBodyMachine],
  },
  {
    id: 'program-full-body-2x',
    name: 'Full Body + Circuit (2x/week)',
    description: 'Full body with circuit finisher, twice per week.',
    sessionsPerWeek: 2,
    workouts: [fullBodyCircuit],
  },
  {
    id: 'program-upper-lower-full-3x',
    name: 'Upper/Lower/Full Body (3x/week)',
    description: 'Balanced 3-day split targeting all muscle groups.',
    sessionsPerWeek: 3,
    workouts: [upperDay, lowerDay, fullBody3Day],
  },
  {
    id: 'program-upper-lower-2x',
    name: 'Upper/Lower (2x/week)',
    description: 'Simple upper/lower split.',
    sessionsPerWeek: 2,
    workouts: [upperSimple, lowerSimple],
  },
  {
    id: 'program-focus-4x',
    name: 'Focus Splits (4x/week)',
    description: 'Targeted muscle focus each day.',
    sessionsPerWeek: 4,
    workouts: [upperChestFocus, lowerQuadFocus, upperBackFocus, lowerGluteFocus],
  },
  {
    id: 'program-focus-6x',
    name: 'Focus Splits (6x/week)',
    description: 'High frequency focus splits.',
    sessionsPerWeek: 6,
    workouts: [upperChestFocus, lowerQuadFocus, upperBackFocus, lowerGluteFocus, shouldersArms, legsDay],
    canCycle: true,
  },
  {
    id: 'program-ppl-3x',
    name: 'Push/Pull/Legs (3x/week)',
    description: 'Classic PPL split.',
    sessionsPerWeek: 3,
    workouts: [pushDay, pullDay, legsDay],
  },
  {
    id: 'program-chest-back-3x',
    name: 'Chest+Back/Shoulders+Arms/Legs (3x/week)',
    description: 'Alternative 3-day split.',
    sessionsPerWeek: 3,
    workouts: [chestBackDay, shouldersArmsDay, legsDay2],
  },
];

// Get template by ID
export function getTrainerTemplateById(id: string): TrainerTemplate | undefined {
  return allTrainerTemplates.find(t => t.id === id);
}

// Get templates by category
export function getTemplatesByCategory(category: TrainerTemplate['category']): TrainerTemplate[] {
  return allTrainerTemplates.filter(t => t.category === category);
}

// Get program by ID
export function getProgramTemplateById(id: string): ProgramTemplate | undefined {
  return programTemplates.find(p => p.id === id);
}

// Get all circuit templates
export function getCircuitTemplates(): TrainerTemplate[] {
  return allTrainerTemplates.filter(t => t.category === 'circuit');
}
