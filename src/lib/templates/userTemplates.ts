// User Mode Templates - 5 Basic Templates for Solo Training
import { PGIFTemplate } from '../pgifTemplates';

// These are the 5 basic templates available to regular users (non-trainers)
// for their personal workout sessions

export const USER_TEMPLATES: PGIFTemplate[] = [
  {
    id: 'user-fb-a',
    name: 'Full Body A',
    description: 'Balanced full body workout hitting all major muscle groups. Great for general fitness.',
    shortDescription: 'Balanced full body workout',
    phase: 'foundation',
    goals: ['general'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'full_body',
    estimatedDuration: 45,
    difficulty: 'beginner',
    isUserTemplate: true,
    isPTOnly: false,
    days: [{
      dayNumber: 1, dayLabel: 'Full Body A', focus: 'Push & Legs',
      blocks: [
        { type: 'warmup', name: 'Warmup', exercises: [
          { exerciseId: 'treadmill-walk', exerciseName: '5 Min Walk/Bike', movementPattern: 'carry', sets: 1, reps: '5 min', rest: '0s', injuryFlags: [] },
        ]},
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 3, reps: '12', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'chest-press-machine', exerciseName: 'Chest Press', movementPattern: 'push', sets: 3, reps: '12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Seated Row', movementPattern: 'pull', sets: 3, reps: '12', rest: '90s', injuryFlags: [] },
          { exerciseId: 'shoulder-press-machine', exerciseName: 'Shoulder Press', movementPattern: 'push', sets: 3, reps: '12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'plank', exerciseName: 'Plank', movementPattern: 'core', sets: 3, reps: '30s', rest: '45s', injuryFlags: [] },
        ]},
      ],
    }],
  },
  {
    id: 'user-fb-b',
    name: 'Full Body B',
    description: 'Alternative full body workout with different exercises. Pairs well with Full Body A.',
    shortDescription: 'Alternative full body workout',
    phase: 'foundation',
    goals: ['general'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'full_body',
    estimatedDuration: 45,
    difficulty: 'beginner',
    isUserTemplate: true,
    isPTOnly: false,
    days: [{
      dayNumber: 1, dayLabel: 'Full Body B', focus: 'Pull & Hinge',
      blocks: [
        { type: 'warmup', name: 'Warmup', exercises: [
          { exerciseId: 'bike-warmup', exerciseName: '5 Min Bike', movementPattern: 'carry', sets: 1, reps: '5 min', rest: '0s', injuryFlags: [] },
        ]},
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 3, reps: '12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'leg-extension', exerciseName: 'Leg Extension', movementPattern: 'squat', sets: 3, reps: '12', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'incline-chest-press', exerciseName: 'Incline Press', movementPattern: 'push', sets: 3, reps: '12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'rdl-dumbbell', exerciseName: 'Dumbbell RDL', movementPattern: 'hinge', sets: 3, reps: '12', rest: '90s', injuryFlags: ['back'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'bicycle-crunch', exerciseName: 'Bicycle Crunches', movementPattern: 'core', sets: 3, reps: '20', rest: '45s', injuryFlags: [] },
        ]},
      ],
    }],
  },
  {
    id: 'user-upper',
    name: 'Upper Body',
    description: 'Focus on chest, back, shoulders, and arms. Great for upper body development.',
    shortDescription: 'Upper body focused',
    phase: 'foundation',
    goals: ['general', 'hypertrophy'],
    injuryWarnings: [],
    frequency: 2,
    structure: 'split',
    estimatedDuration: 40,
    difficulty: 'beginner',
    isUserTemplate: true,
    isPTOnly: false,
    days: [{
      dayNumber: 1, dayLabel: 'Upper Body', focus: 'Chest, Back, Shoulders',
      blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'chest-press-machine', exerciseName: 'Chest Press', movementPattern: 'push', sets: 3, reps: '12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 3, reps: '12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'shoulder-press-machine', exerciseName: 'Shoulder Press', movementPattern: 'push', sets: 3, reps: '12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Seated Row', movementPattern: 'pull', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'tricep-pushdown', exerciseName: 'Tricep Pushdown', movementPattern: 'push', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'bicep-curl-machine', exerciseName: 'Bicep Curl', movementPattern: 'pull', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
        ]},
      ],
    }],
  },
  {
    id: 'user-lower',
    name: 'Lower Body',
    description: 'Focus on quads, hamstrings, glutes, and calves. Build leg strength and definition.',
    shortDescription: 'Lower body focused',
    phase: 'foundation',
    goals: ['general', 'hypertrophy'],
    injuryWarnings: [],
    frequency: 2,
    structure: 'split',
    estimatedDuration: 40,
    difficulty: 'beginner',
    isUserTemplate: true,
    isPTOnly: false,
    days: [{
      dayNumber: 1, dayLabel: 'Lower Body', focus: 'Quads, Hamstrings, Glutes',
      blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 4, reps: '12', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-extension', exerciseName: 'Leg Extension', movementPattern: 'squat', sets: 3, reps: '12', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'hip-abductor', exerciseName: 'Hip Abductor', movementPattern: 'squat', sets: 3, reps: '15', rest: '60s', injuryFlags: ['hip'] },
          { exerciseId: 'hip-adductor', exerciseName: 'Hip Adductor', movementPattern: 'squat', sets: 3, reps: '15', rest: '60s', injuryFlags: ['hip'] },
          { exerciseId: 'calf-raise-machine', exerciseName: 'Calf Raise', movementPattern: 'squat', sets: 4, reps: '15', rest: '45s', injuryFlags: [] },
        ]},
      ],
    }],
  },
  {
    id: 'user-quick',
    name: 'Quick 30',
    description: 'Time-efficient full body circuit. Perfect when you\'re short on time but want results.',
    shortDescription: '30-minute express workout',
    phase: 'foundation',
    goals: ['general', 'fat_loss'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'circuit',
    estimatedDuration: 30,
    difficulty: 'beginner',
    isUserTemplate: true,
    isPTOnly: false,
    days: [{
      dayNumber: 1, dayLabel: 'Quick 30', focus: 'Express Full Body',
      blocks: [
        { type: 'work', name: 'Circuit (3 rounds)', exercises: [
          { exerciseId: 'goblet-squat', exerciseName: 'Goblet Squat', movementPattern: 'squat', sets: 3, reps: '12', rest: '30s', injuryFlags: ['knee'] },
          { exerciseId: 'push-up', exerciseName: 'Push-Ups', movementPattern: 'push', sets: 3, reps: '10', rest: '30s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-row', exerciseName: 'Cable Row', movementPattern: 'pull', sets: 3, reps: '12', rest: '30s', injuryFlags: [] },
          { exerciseId: 'reverse-lunge', exerciseName: 'Reverse Lunges', movementPattern: 'lunge', sets: 3, reps: '10 each', rest: '30s', injuryFlags: ['knee'] },
          { exerciseId: 'plank', exerciseName: 'Plank', movementPattern: 'core', sets: 3, reps: '30s', rest: '60s', injuryFlags: [] },
        ]},
      ],
    }],
  },
];

// Helper to get all templates combined
export const getAllTemplates = (): PGIFTemplate[] => {
  // Import dynamically to avoid circular dependencies
  const { FOUNDATION_TEMPLATES } = require('./foundationTemplates');
  const { STRENGTH_TEMPLATES, PERFORMANCE_TEMPLATES, RETURN_TEMPLATES } = require('./strengthTemplates');
  
  return [
    ...FOUNDATION_TEMPLATES,
    ...STRENGTH_TEMPLATES,
    ...PERFORMANCE_TEMPLATES,
    ...RETURN_TEMPLATES,
    ...USER_TEMPLATES,
  ];
};

// Get templates for user mode (non-trainers)
export const getUserTemplates = (): PGIFTemplate[] => {
  return USER_TEMPLATES;
};

// Get templates for trainer mode (all PT templates)
export const getPTTemplates = (): PGIFTemplate[] => {
  const { FOUNDATION_TEMPLATES } = require('./foundationTemplates');
  const { STRENGTH_TEMPLATES, PERFORMANCE_TEMPLATES, RETURN_TEMPLATES } = require('./strengthTemplates');
  
  return [
    ...FOUNDATION_TEMPLATES,
    ...STRENGTH_TEMPLATES,
    ...PERFORMANCE_TEMPLATES,
    ...RETURN_TEMPLATES,
  ].filter(t => t.isPTOnly);
};
