// Foundation Phase Templates - Machine-based confidence building
import { PGIFTemplate } from '../pgifTemplates';

export const FOUNDATION_TEMPLATES: PGIFTemplate[] = [
  // 2x Full Body
  {
    id: 'f-gen-2x-fb-a',
    name: 'Foundation Full Body A',
    description: 'Machine-based full body workout for building confidence and consistency. Perfect for beginners.',
    shortDescription: 'Machine-based confidence builder',
    phase: 'foundation',
    goals: ['general', 'fat_loss', 'hypertrophy'],
    injuryWarnings: [],
    frequency: 2,
    structure: 'full_body',
    estimatedDuration: 45,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [{
      dayNumber: 1, dayLabel: 'Full Body A', focus: 'Push & Legs Focus',
      blocks: [
        { type: 'warmup', name: 'Activation', exercises: [
          { exerciseId: 'treadmill-walk', exerciseName: 'Treadmill Walk', movementPattern: 'carry', sets: 1, reps: '5 min', rest: '0s', injuryFlags: [] },
          { exerciseId: 'band-pull-apart', exerciseName: 'Band Pull-Aparts', movementPattern: 'pull', sets: 2, reps: '15', rest: '30s', injuryFlags: ['shoulder'] },
        ]},
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['knee', 'hip'] },
          { exerciseId: 'chest-press-machine', exerciseName: 'Chest Press Machine', movementPattern: 'push', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Seated Row Machine', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '90s', injuryFlags: [] },
          { exerciseId: 'shoulder-press-machine', exerciseName: 'Shoulder Press Machine', movementPattern: 'push', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl Machine', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
        ]},
      ],
    }],
  },
  {
    id: 'f-gen-2x-fb-b',
    name: 'Foundation Full Body B',
    description: 'Complementary full body workout with pull and hinge focus. Pairs with Full Body A.',
    shortDescription: 'Pull & hinge focus variant',
    phase: 'foundation',
    goals: ['general', 'fat_loss', 'hypertrophy'],
    injuryWarnings: [],
    frequency: 2,
    structure: 'full_body',
    estimatedDuration: 45,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [{
      dayNumber: 1, dayLabel: 'Full Body B', focus: 'Pull & Hinge Focus',
      blocks: [
        { type: 'warmup', name: 'Activation', exercises: [
          { exerciseId: 'bike-warmup', exerciseName: 'Stationary Bike', movementPattern: 'carry', sets: 1, reps: '5 min', rest: '0s', injuryFlags: [] },
          { exerciseId: 'glute-bridge', exerciseName: 'Glute Bridges', movementPattern: 'hinge', sets: 2, reps: '12', rest: '30s', injuryFlags: ['back'] },
        ]},
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'leg-extension', exerciseName: 'Leg Extension', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'cable-chest-fly', exerciseName: 'Cable Chest Fly', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'rdl-dumbbell', exerciseName: 'Dumbbell RDL', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['back', 'hip'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '60s', injuryFlags: ['shoulder'] },
        ]},
      ],
    }],
  },
  // 3x Full Body
  {
    id: 'f-gen-3x-fb',
    name: 'Foundation 3x Full Body',
    description: 'Three-day full body program with alternating focus. Ideal for building consistent gym habits.',
    shortDescription: '3-day machine-based program',
    phase: 'foundation',
    goals: ['general', 'hypertrophy'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'full_body',
    estimatedDuration: 50,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Day A - Push', focus: 'Chest, Shoulders, Quads', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'chest-press-machine', exerciseName: 'Chest Press', movementPattern: 'push', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'shoulder-press-machine', exerciseName: 'Shoulder Press', movementPattern: 'push', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'leg-extension', exerciseName: 'Leg Extension', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'tricep-pushdown', exerciseName: 'Tricep Pushdown', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Day B - Pull', focus: 'Back, Biceps, Hamstrings', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Seated Row', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '90s', injuryFlags: [] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'bicep-curl-machine', exerciseName: 'Bicep Curl', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Day C - Mixed', focus: 'Full Body Balance', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'goblet-squat', exerciseName: 'Goblet Squat', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'incline-chest-press', exerciseName: 'Incline Press', movementPattern: 'push', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-row', exerciseName: 'Cable Row', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '90s', injuryFlags: [] },
          { exerciseId: 'rdl-dumbbell', exerciseName: 'DB RDL', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['back'] },
          { exerciseId: 'plank', exerciseName: 'Plank', movementPattern: 'core', sets: 3, reps: '30-45s', rest: '60s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
  // 4x Upper/Lower
  {
    id: 'f-gen-4x-ul',
    name: 'Foundation Upper/Lower',
    description: 'Four-day upper/lower split for those ready for more frequency. Clear structure.',
    shortDescription: '4-day upper/lower split',
    phase: 'foundation',
    goals: ['general', 'hypertrophy'],
    injuryWarnings: [],
    frequency: 4,
    structure: 'upper_lower',
    estimatedDuration: 45,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Upper A', focus: 'Chest & Back', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'chest-press-machine', exerciseName: 'Chest Press', movementPattern: 'push', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-chest-fly', exerciseName: 'Cable Fly', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Seated Row', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Lower A', focus: 'Quads & Glutes', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 4, reps: '12-15', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-extension', exerciseName: 'Leg Extension', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'hip-abductor', exerciseName: 'Hip Abductor', movementPattern: 'squat', sets: 3, reps: '15', rest: '60s', injuryFlags: ['hip'] },
          { exerciseId: 'calf-raise-machine', exerciseName: 'Calf Raise', movementPattern: 'squat', sets: 3, reps: '15-20', rest: '45s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Upper B', focus: 'Shoulders & Arms', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'shoulder-press-machine', exerciseName: 'Shoulder Press', movementPattern: 'push', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'lat-pulldown', exerciseName: 'Wide Pulldown', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['shoulder'] },
          { exerciseId: 'db-lateral-raise', exerciseName: 'Lateral Raise', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'tricep-pushdown', exerciseName: 'Tricep Pushdown', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'bicep-curl-machine', exerciseName: 'Bicep Curl', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 4, dayLabel: 'Lower B', focus: 'Hamstrings & Glutes', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'rdl-dumbbell', exerciseName: 'DB RDL', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['back'] },
          { exerciseId: 'leg-press', exerciseName: 'Leg Press (high)', movementPattern: 'squat', sets: 3, reps: '12-15', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'hip-adductor', exerciseName: 'Hip Adductor', movementPattern: 'squat', sets: 3, reps: '15', rest: '60s', injuryFlags: ['hip'] },
          { exerciseId: 'back-extension', exerciseName: 'Back Extension', movementPattern: 'hinge', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['back'] },
        ]}
      ]},
    ],
  },
  // Fat Loss Circuit
  {
    id: 'f-fat-3x-circuit',
    name: 'Foundation Fat Loss Circuit',
    description: 'High-energy circuit training with minimal rest. Great for metabolic conditioning.',
    shortDescription: 'Metabolic circuit training',
    phase: 'foundation',
    goals: ['fat_loss', 'conditioning'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'circuit',
    estimatedDuration: 40,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Circuit A', focus: 'Full Body Burn', blocks: [
        { type: 'work', name: 'Circuit (3 rounds)', exercises: [
          { exerciseId: 'goblet-squat', exerciseName: 'Goblet Squat', movementPattern: 'squat', sets: 3, reps: '12', rest: '20s', injuryFlags: ['knee'] },
          { exerciseId: 'push-up', exerciseName: 'Push-Ups', movementPattern: 'push', sets: 3, reps: '10-12', rest: '20s', injuryFlags: ['shoulder'] },
          { exerciseId: 'cable-row', exerciseName: 'Cable Row', movementPattern: 'pull', sets: 3, reps: '12', rest: '20s', injuryFlags: [] },
          { exerciseId: 'reverse-lunge', exerciseName: 'Reverse Lunges', movementPattern: 'lunge', sets: 3, reps: '10 each', rest: '20s', injuryFlags: ['knee'] },
          { exerciseId: 'plank', exerciseName: 'Plank Hold', movementPattern: 'core', sets: 3, reps: '30s', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Circuit B', focus: 'Upper Focus', blocks: [
        { type: 'work', name: 'Circuit (3 rounds)', exercises: [
          { exerciseId: 'chest-press-machine', exerciseName: 'Chest Press', movementPattern: 'push', sets: 3, reps: '12', rest: '20s', injuryFlags: ['shoulder'] },
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 3, reps: '12', rest: '20s', injuryFlags: ['shoulder'] },
          { exerciseId: 'shoulder-press-machine', exerciseName: 'Shoulder Press', movementPattern: 'push', sets: 3, reps: '12', rest: '20s', injuryFlags: ['shoulder'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '20s', injuryFlags: [] },
          { exerciseId: 'mountain-climber', exerciseName: 'Mountain Climbers', movementPattern: 'core', sets: 3, reps: '20', rest: '60s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Circuit C', focus: 'Lower Focus', blocks: [
        { type: 'work', name: 'Circuit (3 rounds)', exercises: [
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 3, reps: '15', rest: '20s', injuryFlags: ['knee'] },
          { exerciseId: 'walking-lunge', exerciseName: 'Walking Lunges', movementPattern: 'lunge', sets: 3, reps: '12 each', rest: '20s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 3, reps: '12', rest: '20s', injuryFlags: ['knee'] },
          { exerciseId: 'step-up', exerciseName: 'Step-Ups', movementPattern: 'lunge', sets: 3, reps: '10 each', rest: '20s', injuryFlags: ['knee'] },
          { exerciseId: 'bicycle-crunch', exerciseName: 'Bicycle Crunches', movementPattern: 'core', sets: 3, reps: '20', rest: '60s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
  // Hypertrophy Focus
  {
    id: 'f-hyp-3x-fb',
    name: 'Foundation Hypertrophy',
    description: 'Muscle-building focus with time under tension. Machine-based for safety.',
    shortDescription: 'Muscle building focus',
    phase: 'foundation',
    goals: ['hypertrophy'],
    injuryWarnings: [],
    frequency: 3,
    structure: 'full_body',
    estimatedDuration: 55,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Hypertrophy A', focus: 'Chest & Back Volume', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'chest-press-machine', exerciseName: 'Chest Press', movementPattern: 'push', sets: 4, reps: '10-12', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'lat-pulldown', exerciseName: 'Lat Pulldown', movementPattern: 'pull', sets: 4, reps: '10-12', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'incline-chest-press', exerciseName: 'Incline Press', movementPattern: 'push', sets: 3, reps: '12-15', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Seated Row', movementPattern: 'pull', sets: 3, reps: '12-15', rest: '60s', injuryFlags: [] },
          { exerciseId: 'cable-chest-fly', exerciseName: 'Cable Fly', movementPattern: 'push', sets: 3, reps: '15', rest: '45s', injuryFlags: ['shoulder'] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Hypertrophy B', focus: 'Legs Volume', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'leg-press', exerciseName: 'Leg Press', movementPattern: 'squat', sets: 4, reps: '10-12', rest: '90s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-extension', exerciseName: 'Leg Extension', movementPattern: 'squat', sets: 4, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'leg-curl-machine', exerciseName: 'Leg Curl', movementPattern: 'hinge', sets: 4, reps: '12-15', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'hip-abductor', exerciseName: 'Hip Abductor', movementPattern: 'squat', sets: 3, reps: '15', rest: '45s', injuryFlags: ['hip'] },
          { exerciseId: 'calf-raise-machine', exerciseName: 'Calf Raise', movementPattern: 'squat', sets: 4, reps: '15-20', rest: '45s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 3, dayLabel: 'Hypertrophy C', focus: 'Shoulders & Arms', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'shoulder-press-machine', exerciseName: 'Shoulder Press', movementPattern: 'push', sets: 4, reps: '10-12', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'db-lateral-raise', exerciseName: 'Lateral Raise', movementPattern: 'push', sets: 4, reps: '12-15', rest: '45s', injuryFlags: ['shoulder'] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '45s', injuryFlags: [] },
          { exerciseId: 'tricep-pushdown', exerciseName: 'Tricep Pushdown', movementPattern: 'push', sets: 4, reps: '12-15', rest: '45s', injuryFlags: [] },
          { exerciseId: 'bicep-curl-machine', exerciseName: 'Bicep Curl', movementPattern: 'pull', sets: 4, reps: '12-15', rest: '45s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
  // Mobility Focus
  {
    id: 'f-mob-2x',
    name: 'Foundation Mobility',
    description: 'Focus on movement quality and flexibility. Great for desk workers or mobility-limited clients.',
    shortDescription: 'Movement quality focus',
    phase: 'foundation',
    goals: ['mobility', 'general'],
    injuryWarnings: [],
    frequency: 2,
    structure: 'full_body',
    estimatedDuration: 40,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Mobility A', focus: 'Lower Body Mobility', blocks: [
        { type: 'warmup', name: 'Dynamic Warmup', exercises: [
          { exerciseId: 'hip-circle', exerciseName: 'Hip Circles', movementPattern: 'hinge', sets: 2, reps: '10 each', rest: '0s', injuryFlags: [] },
          { exerciseId: 'cat-cow', exerciseName: 'Cat-Cow', movementPattern: 'core', sets: 2, reps: '10', rest: '0s', injuryFlags: [] },
        ]},
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'goblet-squat', exerciseName: 'Goblet Squat (slow)', movementPattern: 'squat', sets: 3, reps: '10', rest: '60s', injuryFlags: ['knee'], notes: '3s down, 2s pause' },
          { exerciseId: 'glute-bridge', exerciseName: 'Glute Bridges', movementPattern: 'hinge', sets: 3, reps: '12', rest: '45s', injuryFlags: [] },
          { exerciseId: 'bird-dog', exerciseName: 'Bird Dogs', movementPattern: 'core', sets: 2, reps: '10 each', rest: '45s', injuryFlags: [] },
          { exerciseId: 'world-greatest-stretch', exerciseName: 'World Greatest Stretch', movementPattern: 'lunge', sets: 2, reps: '5 each', rest: '0s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Mobility B', focus: 'Upper Body Mobility', blocks: [
        { type: 'warmup', name: 'Dynamic Warmup', exercises: [
          { exerciseId: 'arm-circles', exerciseName: 'Arm Circles', movementPattern: 'push', sets: 2, reps: '15 each', rest: '0s', injuryFlags: [] },
          { exerciseId: 'thread-needle', exerciseName: 'Thread the Needle', movementPattern: 'rotation', sets: 2, reps: '8 each', rest: '0s', injuryFlags: [] },
        ]},
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'band-pull-apart', exerciseName: 'Band Pull-Aparts', movementPattern: 'pull', sets: 3, reps: '15', rest: '45s', injuryFlags: [] },
          { exerciseId: 'face-pull', exerciseName: 'Face Pulls', movementPattern: 'pull', sets: 3, reps: '15', rest: '45s', injuryFlags: [] },
          { exerciseId: 'dead-bug', exerciseName: 'Dead Bugs', movementPattern: 'core', sets: 3, reps: '10 each', rest: '45s', injuryFlags: [] },
          { exerciseId: 'wall-slide', exerciseName: 'Wall Slides', movementPattern: 'push', sets: 2, reps: '10', rest: '45s', injuryFlags: ['shoulder'] },
        ]}
      ]},
    ],
  },
  // Pain Reduction / Return
  {
    id: 'f-pain-2x',
    name: 'Foundation Return',
    description: 'Gentle reintroduction to training. Focus on movement quality and confidence rebuilding.',
    shortDescription: 'Gentle return program',
    phase: 'foundation',
    goals: ['pain_reduction', 'mobility'],
    injuryWarnings: [],
    frequency: 2,
    structure: 'full_body',
    estimatedDuration: 35,
    difficulty: 'beginner',
    isPTOnly: true,
    days: [
      { dayNumber: 1, dayLabel: 'Movement A', focus: 'Gentle Activation', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'glute-bridge', exerciseName: 'Glute Bridges', movementPattern: 'hinge', sets: 2, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'bird-dog', exerciseName: 'Bird Dogs', movementPattern: 'core', sets: 2, reps: '8 each', rest: '45s', injuryFlags: [] },
          { exerciseId: 'wall-sit', exerciseName: 'Wall Sit', movementPattern: 'squat', sets: 2, reps: '20s', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'band-pull-apart', exerciseName: 'Band Pull-Aparts', movementPattern: 'pull', sets: 2, reps: '12', rest: '45s', injuryFlags: [] },
          { exerciseId: 'dead-bug', exerciseName: 'Dead Bugs', movementPattern: 'core', sets: 2, reps: '8 each', rest: '45s', injuryFlags: [] },
        ]}
      ]},
      { dayNumber: 2, dayLabel: 'Movement B', focus: 'Light Resistance', blocks: [
        { type: 'work', name: 'Main Work', exercises: [
          { exerciseId: 'goblet-squat', exerciseName: 'Light Goblet Squat', movementPattern: 'squat', sets: 2, reps: '10', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'chest-press-machine', exerciseName: 'Light Chest Press', movementPattern: 'push', sets: 2, reps: '12', rest: '60s', injuryFlags: ['shoulder'] },
          { exerciseId: 'seated-row-machine', exerciseName: 'Light Row', movementPattern: 'pull', sets: 2, reps: '12', rest: '60s', injuryFlags: [] },
          { exerciseId: 'step-up', exerciseName: 'Low Step-Ups', movementPattern: 'lunge', sets: 2, reps: '8 each', rest: '60s', injuryFlags: ['knee'] },
          { exerciseId: 'plank', exerciseName: 'Modified Plank', movementPattern: 'core', sets: 2, reps: '20s', rest: '45s', injuryFlags: [] },
        ]}
      ]},
    ],
  },
];
