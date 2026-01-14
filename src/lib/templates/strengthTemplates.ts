// Strength & Performance Phase Templates
import { PGIFTemplate } from '../pgifTemplates';

export const STRENGTH_TEMPLATES: PGIFTemplate[] = [
  // Strength 3x PPL
  {
    id: 's-str-3x-ppl',
    name: 'Strength Push/Pull/Legs',
    description: 'Classic PPL split with progressive overload focus. Compound movements with accessory work.',
    shortDescription: 'Classic PPL for strength',
    phase: 'strength',
    goals: ['strength', 'hypertrophy'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'push_pull_legs',
    estimatedDuration: 60,
    difficulty: 'intermediate',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Push Day', focus: 'Chest, Shoulders, Triceps', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-bench-press', exerciseName: 'Bench Press', movementPattern: 'push', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['shoulder'], notes: 'Focus on controlled descent' },
          { exerciseId: 'incline-dumbbell-press', exerciseName: 'Incline DB Press', movementPattern: 'push', sets: 3, reps: '8-10', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'overhead-press', exerciseName: 'Overhead Press', movementPattern: 'push', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-chest-fly', exerciseName: 'Cable Fly', movementPattern: 'push', sets: 3, reps: '10-12', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'tricep-dip', exerciseName: 'Tricep Dips', movementPattern: 'push', sets: 3, reps: '8-10', rest: '90s', injuryFlags: ['shoulder'] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Pull Day', focus: 'Back, Biceps, Rear Delts', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-row', exerciseName: 'Barbell Row', movementPattern: 'pull', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['back'], notes: 'Maintain neutral spine' },
          { exerciseId: 'pull-up', exerciseName: 'Pull-Ups', movementPattern: 'pull', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-cable-row', exerciseName: 'Cable Row', movementPattern: 'pull', sets: 3, reps: '8-10', rest: '90s', injuryFlags: [] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'barbell-curl', exerciseName: 'Barbell Curl', movementPattern: 'pull', sets: 3, reps: '8-10', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Legs Day', focus: 'Quads, Hamstrings, Glutes', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-squat', exerciseName: 'Barbell Squat', movementPattern: 'squat', sets: 4, reps: '6-8', rest: '180s', injuryFlags: ['knee', 'back'], notes: 'Full depth, braced core' },
          { exerciseId: 'romanian-deadlift', exerciseName: 'Romanian Deadlift', movementPattern: 'hinge', sets: 4, reps: '8-10', rest: '120s', injuryFlags: ['back'] },
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '10-12', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'calf-raise', exerciseName: 'Calf Raise', movementPattern: 'squat', sets: 4, reps: '12-15', rest: '45s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
  // Strength 4x Upper/Lower
  {
    id: 's-str-4x-ul',
    name: 'Strength Upper/Lower 4x',
    description: 'Four-day upper/lower split with heavy compound focus. Strength and hypertrophy balanced.',
    shortDescription: 'Heavy compound 4-day split',
    phase: 'strength',
    goals: ['strength', 'powerlifting'],
    injuryWarnings: [],
    frequency: 4,
    structure: 'upper_lower',
    estimatedDuration: 65,
    difficulty: 'intermediate',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Upper Strength', focus: 'Heavy Pressing', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-bench-press', exerciseName: 'Bench Press', movementPattern: 'push', sets: 5, reps: '5', rest: '180s', injuryFlags: ['shoulder'] },
          { exerciseId: 'barbell-row', exerciseName: 'Barbell Row', movementPattern: 'pull', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['back'] },
          { exerciseId: 'overhead-press', exerciseName: 'OHP', movementPattern: 'push', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['shoulder'] },
          { exerciseId: 'pull-up', exerciseName: 'Pull-Ups', movementPattern: 'pull', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['shoulder'] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Lower Strength', focus: 'Heavy Squats', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-squat', exerciseName: 'Back Squat', movementPattern: 'squat', sets: 5, reps: '5', rest: '180s', injuryFlags: ['knee', 'back'] },
          { exerciseId: 'romanian-deadlift', exerciseName: 'RDL', movementPattern: 'hinge', sets: 4, reps: '8', rest: '120s', injuryFlags: ['back'] },
          { exerciseId: 'bulgarian-split-squat', exerciseName: 'Bulgarian Split', movementPattern: 'lunge', sets: 3, reps: '10 each', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Upper Hypertrophy', focus: 'Volume Work', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'incline-dumbbell-press', exerciseName: 'Incline DB Press', movementPattern: 'push', sets: 4, reps: '10-12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-row', exerciseName: 'Cable Row', movementPattern: 'pull', sets: 4, reps: '10-12', rest: '90s', injuryFlags: [] },
          { exerciseId: 'db-lateral-raise', exerciseName: 'Lateral Raise', movementPattern: 'push', sets: 4, reps: '12-15', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pull', movementPattern: 'pull', sets: 3, reps: '15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'tricep-pushdown', exerciseName: 'Tricep Pushdown', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 4, dayLabel: 'Lower Hypertrophy', focus: 'Volume Work', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'front-squat', exerciseName: 'Front Squat', movementPattern: 'squat', sets: 4, reps: '8-10', rest: '120s', injuryFlags: ['knee', 'wrist'] },
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 4, reps: '12-15', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'walking-lunge', exerciseName: 'Walking Lunge', movementPattern: 'lunge', sets: 3, reps: '12 each', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-extension', exerciseName: 'Leg Extension', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
        ]}
      ]},
    ],
  },
  // Hypertrophy 5x Bro Split
  {
    id: 's-hyp-5x-bro',
    name: 'Strength Bro Split',
    description: 'Classic 5-day bodybuilding split. One muscle group per day with high volume.',
    shortDescription: '5-day bodybuilding split',
    phase: 'strength',
    goals: ['hypertrophy'],
    injuryWarnings: [],
    frequency: 5,
    structure: 'split',
    estimatedDuration: 60,
    difficulty: 'intermediate',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Chest', focus: 'Chest Volume', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-bench-press', exerciseName: 'Bench Press', movementPattern: 'push', sets: 4, reps: '8-10', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'incline-dumbbell-press', exerciseName: 'Incline DB Press', movementPattern: 'push', sets: 4, reps: '10-12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-chest-fly', exerciseName: 'Cable Fly', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'chest-dip', exerciseName: 'Chest Dips', movementPattern: 'push', sets: 3, reps: '10-12', rest: '60s', injuryFlags: ['shoulder'] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Back', focus: 'Back Volume', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-row', exerciseName: 'Barbell Row', movementPattern: 'pull', sets: 4, reps: '8-10', rest: '90s', injuryFlags: ['back'] },
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 4, reps: '10-12', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-row', exerciseName: 'Cable Row', movementPattern: 'pull', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'straight-arm-pulldown', exerciseName: 'Straight Arm Pulldown', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Shoulders', focus: 'Shoulder Volume', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'overhead-press', exerciseName: 'OHP', movementPattern: 'push', sets: 4, reps: '8-10', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'db-lateral-raise', exerciseName: 'Lateral Raise', movementPattern: 'push', sets: 4, reps: '12-15', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pull', movementPattern: 'pull', sets: 4, reps: '15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'rear-delt-fly', exerciseName: 'Rear Delt Fly', movementPattern: 'pull', sets: 3, reps: '15', rest: '45s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 4, dayLabel: 'Legs', focus: 'Leg Volume', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-squat', exerciseName: 'Back Squat', movementPattern: 'squat', sets: 4, reps: '8-10', rest: '120s', injuryFlags: ['knee', 'back'] },
          { exerciseId: 'romanian-deadlift', exerciseName: 'RDL', movementPattern: 'hinge', sets: 4, reps: '10-12', rest: '90s', injuryFlags: ['back'] },
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'calf-raise', exerciseName: 'Calf Raise', movementPattern: 'squat', sets: 4, reps: '15-20', rest: '45s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 5, dayLabel: 'Arms', focus: 'Arms Volume', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-curl', exerciseName: 'Barbell Curl', movementPattern: 'pull', sets: 4, reps: '10-12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'skull-crusher', exerciseName: 'Skull Crushers', movementPattern: 'push', sets: 4, reps: '10-12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'hammer-curl', exerciseName: 'Hammer Curl', movementPattern: 'pull', sets: 3, reps: '12', rest: '45s', injuryFlags: [] },
          { exerciseId: 'tricep-pushdown', exerciseName: 'Tricep Pushdown', movementPattern: 'push', sets: 3, reps: '12-15', rest: '45s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
];

// Performance Phase Templates
export const PERFORMANCE_TEMPLATES: PGIFTemplate[] = [
  {
    id: 'p-ath-3x',
    name: 'Athletic Performance',
    description: 'Power-focused training for athletic performance. Explosive movements with strength foundation.',
    shortDescription: 'Power and explosiveness',
    phase: 'performance',
    goals: ['athletic_performance', 'strength'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'full_body',
    estimatedDuration: 70,
    difficulty: 'advanced',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Power Day', focus: 'Explosive Movements', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'power-clean', exerciseName: 'Power Clean', movementPattern: 'hinge', sets: 5, reps: '3', rest: '180s', injuryFlags: ['back', 'wrist'], notes: 'Triple extension focus' },
          { exerciseId: 'box-jump', exerciseName: 'Box Jumps', movementPattern: 'squat', sets: 4, reps: '5', rest: '90s', injuryFlags: ['knee', 'ankle'] },
          { exerciseId: 'barbell-squat', exerciseName: 'Back Squat', movementPattern: 'squat', sets: 5, reps: '3-5', rest: '180s', injuryFlags: ['knee', 'back'] },
          { exerciseId: 'push-press', exerciseName: 'Push Press', movementPattern: 'push', sets: 4, reps: '5', rest: '120s', injuryFlags: ['shoulder'] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Speed Day', focus: 'Velocity & Agility', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'broad-jump', exerciseName: 'Broad Jumps', movementPattern: 'squat', sets: 4, reps: '5', rest: '90s', injuryFlags: ['knee', 'ankle'] },
          { exerciseId: 'medicine-ball-slam', exerciseName: 'Med Ball Slams', movementPattern: 'hinge', sets: 4, reps: '8', rest: '60s', injuryFlags: ['back'] },
          { exerciseId: 'kettlebell-swing', exerciseName: 'KB Swings', movementPattern: 'hinge', sets: 4, reps: '12', rest: '60s', injuryFlags: ['back'] },
          { exerciseId: 'plyo-push-up', exerciseName: 'Plyo Push-Ups', movementPattern: 'push', sets: 4, reps: '8', rest: '90s', injuryFlags: ['shoulder', 'wrist'] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Strength Day', focus: 'Max Effort', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'deadlift', exerciseName: 'Deadlift', movementPattern: 'hinge', sets: 5, reps: '3', rest: '180s', injuryFlags: ['back'] },
          { exerciseId: 'barbell-bench-press', exerciseName: 'Bench Press', movementPattern: 'push', sets: 5, reps: '3-5', rest: '180s', injuryFlags: ['shoulder'] },
          { exerciseId: 'weighted-pull-up', exerciseName: 'Weighted Pull-Ups', movementPattern: 'pull', sets: 4, reps: '5', rest: '120s', injuryFlags: ['shoulder'] },
          { exerciseId: 'farmers-carry', exerciseName: 'Farmers Carry', movementPattern: 'carry', sets: 3, reps: '40m', rest: '90s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
  {
    id: 'p-pl-4x',
    name: 'Powerlifting Prep',
    description: 'Competition-style powerlifting training. Squat, bench, deadlift focused with accessories.',
    shortDescription: 'SBD competition prep',
    phase: 'performance',
    goals: ['powerlifting', 'strength'],
    injuryWarnings: [],
    frequency: 4,
    structure: 'split',
    estimatedDuration: 75,
    difficulty: 'advanced',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Squat Day', focus: 'Squat Focus', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-squat', exerciseName: 'Competition Squat', movementPattern: 'squat', sets: 5, reps: '3', rest: '240s', injuryFlags: ['knee', 'back'] },
          { exerciseId: 'pause-squat', exerciseName: 'Pause Squat', movementPattern: 'squat', sets: 3, reps: '5', rest: '180s', injuryFlags: ['knee', 'back'] },
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 3, reps: '10', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Bench Day', focus: 'Bench Focus', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'barbell-bench-press', exerciseName: 'Competition Bench', movementPattern: 'push', sets: 5, reps: '3', rest: '240s', injuryFlags: ['shoulder'] },
          { exerciseId: 'close-grip-bench', exerciseName: 'Close Grip Bench', movementPattern: 'push', sets: 3, reps: '6-8', rest: '120s', injuryFlags: ['shoulder'] },
          { exerciseId: 'barbell-row', exerciseName: 'Barbell Row', movementPattern: 'pull', sets: 4, reps: '8', rest: '90s', injuryFlags: ['back'] },
          { exerciseId: 'tricep-pushdown', exerciseName: 'Tricep Pushdown', movementPattern: 'push', sets: 3, reps: '12', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Deadlift Day', focus: 'Deadlift Focus', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'deadlift', exerciseName: 'Competition Deadlift', movementPattern: 'hinge', sets: 5, reps: '3', rest: '240s', injuryFlags: ['back'] },
          { exerciseId: 'deficit-deadlift', exerciseName: 'Deficit Deadlift', movementPattern: 'hinge', sets: 3, reps: '5', rest: '180s', injuryFlags: ['back'] },
          { exerciseId: 'barbell-row', exerciseName: 'Pendlay Row', movementPattern: 'pull', sets: 4, reps: '6', rest: '90s', injuryFlags: ['back'] },
          { exerciseId: 'back-extension', exerciseName: 'Back Extension', movementPattern: 'hinge', sets: 3, reps: '12', rest: '60s', injuryFlags: ['back'] },
        ]}
      ]},
      { dayNumber: 4, dayLabel: 'Accessory', focus: 'Weak Points', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'front-squat', exerciseName: 'Front Squat', movementPattern: 'squat', sets: 4, reps: '6', rest: '120s', injuryFlags: ['knee', 'wrist'] },
          { exerciseId: 'incline-dumbbell-press', exerciseName: 'Incline DB Press', movementPattern: 'push', sets: 4, reps: '10', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'pull-up', exerciseName: 'Pull-Ups', movementPattern: 'pull', sets: 4, reps: '8-10', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '60s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
];

// Return/Rehab Phase Templates
export const RETURN_TEMPLATES: PGIFTemplate[] = [
  {
    id: 'r-gen-2x',
    name: 'Return to Training',
    description: 'Gentle reintroduction after injury or break. Movement quality and confidence focus.',
    shortDescription: 'Gentle return program',
    phase: 'return',
    goals: ['pain_reduction', 'mobility', 'general'],
    injuryWarnings: [],
    frequency: 2,
    structure: 'full_body',
    estimatedDuration: 35,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Movement A', focus: 'Activation', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'glute-bridge', exerciseName: 'Glute Bridges', movementPattern: 'hinge', sets: 2, reps: '15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'bird-dog', exerciseName: 'Bird Dogs', movementPattern: 'core', sets: 2, reps: '10 each', rest: '45s', injuryFlags: [] },
          { exerciseId: 'wall-sit', exerciseName: 'Wall Sit', movementPattern: 'squat', sets: 2, reps: '30s', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'band-pull-apart', exerciseName: 'Band Pull-Aparts', movementPattern: 'pull', sets: 2, reps: '15', rest: '45s', injuryFlags: [] },
          { exerciseId: 'dead-bug', exerciseName: 'Dead Bugs', movementPattern: 'core', sets: 2, reps: '10 each', rest: '45s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Movement B', focus: 'Light Resistance', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'goblet-squat', exerciseName: 'Light Goblet Squat', movementPattern: 'squat', sets: 2, reps: '10', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'chest-press-machine', exerciseName: 'Light Chest Press', movementPattern: 'push', sets: 2, reps: '12', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Light Row', movementPattern: 'pull', sets: 2, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'step-up', exerciseName: 'Low Step-Ups', movementPattern: 'lunge', sets: 2, reps: '8 each', rest: '60s', injuryFlags: ['knee'] },
        ]}
      ]},
    ],
  },
];
