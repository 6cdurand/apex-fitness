import { Exercise, MuscleGroup, Equipment } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Comprehensive exercise library with muscle targeting (deduplicated — first occurrence of each ID wins)
const _rawExerciseLibrary: Exercise[] = [
  // CHEST
  {
    id: 'bench-press',
    name: 'Barbell Bench Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
    instructions: 'Lie on bench, grip bar slightly wider than shoulder width, lower to chest, press up.',
  },
  {
    id: 'incline-bench-press',
    name: 'Incline Barbell Bench Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
    instructions: 'Set bench to 30-45 degrees, perform bench press motion.',
  },
  {
    id: 'decline-bench-press',
    name: 'Decline Barbell Bench Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'dumbbell',
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'dumbbell',
  },
  {
    id: 'dumbbell-flyes',
    name: 'Dumbbell Flyes',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'cable-flyes',
    name: 'Cable Flyes',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'chest-dips',
    name: 'Chest Dips',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  },
  {
    id: 'push-ups',
    name: 'Push-Ups',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  },
  {
    id: 'machine-chest-press',
    name: 'Machine Chest Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'pec-deck',
    name: 'Pec Deck Machine',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },

  // BACK
  {
    id: 'deadlift',
    name: 'Conventional Deadlift',
    primaryMuscles: ['back', 'lower_back', 'glutes', 'hamstrings'],
    secondaryMuscles: ['traps', 'forearms'],
    category: 'compound',
    equipment: 'barbell',
    instructions: 'Stand with feet hip-width, grip bar, keep back straight, lift by extending hips and knees.',
  },
  {
    id: 'sumo-deadlift',
    name: 'Sumo Deadlift',
    primaryMuscles: ['back', 'glutes', 'quads'],
    secondaryMuscles: ['hamstrings', 'lower_back'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'lower_back'],
    secondaryMuscles: ['back'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'dumbbell-rdl',
    name: 'Dumbbell Romanian Deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'dumbbell',
  },
  {
    id: 'barbell-row',
    name: 'Barbell Bent-Over Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'pendlay-row',
    name: 'Pendlay Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  },
  {
    id: 'pull-ups',
    name: 'Pull-Ups',
    primaryMuscles: ['lats', 'back'],
    secondaryMuscles: ['biceps', 'forearms'],
    category: 'compound',
    equipment: 'bodyweight',
  },
  {
    id: 'chin-ups',
    name: 'Chin-Ups',
    primaryMuscles: ['lats', 'biceps'],
    secondaryMuscles: ['back', 'forearms'],
    category: 'compound',
    equipment: 'bodyweight',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'back'],
    category: 'compound',
    equipment: 'cable',
  },
  {
    id: 'close-grip-pulldown',
    name: 'Close-Grip Lat Pulldown',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'back'],
    category: 'compound',
    equipment: 'cable',
  },
  {
    id: 'cable-row',
    name: 'Seated Cable Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'cable',
  },
  {
    id: 't-bar-row',
    name: 'T-Bar Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'machine-row',
    name: 'Machine Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'face-pulls',
    name: 'Face Pulls',
    primaryMuscles: ['back', 'shoulders'],
    secondaryMuscles: ['traps'],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'straight-arm-pulldown',
    name: 'Straight-Arm Pulldown',
    primaryMuscles: ['lats'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'hyperextensions',
    name: 'Back Extensions (Hyperextensions)',
    primaryMuscles: ['lower_back'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    category: 'isolation',
    equipment: 'bodyweight',
  },

  // SHOULDERS
  {
    id: 'overhead-press',
    name: 'Barbell Overhead Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
    instructions: 'Stand with bar at shoulder height, press overhead, fully extend arms.',
  },
  {
    id: 'seated-overhead-press',
    name: 'Seated Barbell Overhead Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'dumbbell',
  },
  {
    id: 'arnold-press',
    name: 'Arnold Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'dumbbell',
  },
  {
    id: 'lateral-raises',
    name: 'Dumbbell Lateral Raises',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'cable-lateral-raises',
    name: 'Cable Lateral Raises',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'front-raises',
    name: 'Front Raises',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'rear-delt-flyes',
    name: 'Rear Delt Flyes',
    primaryMuscles: ['shoulders', 'back'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'reverse-pec-deck',
    name: 'Reverse Pec Deck',
    primaryMuscles: ['shoulders', 'back'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'upright-rows',
    name: 'Barbell Upright Rows',
    primaryMuscles: ['shoulders', 'traps'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'shrugs',
    name: 'Barbell Shrugs',
    primaryMuscles: ['traps'],
    secondaryMuscles: ['shoulders'],
    category: 'isolation',
    equipment: 'barbell',
  },
  {
    id: 'dumbbell-shrugs',
    name: 'Dumbbell Shrugs',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },

  // BICEPS
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    category: 'isolation',
    equipment: 'barbell',
  },
  {
    id: 'ez-bar-curl',
    name: 'EZ Bar Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    category: 'isolation',
    equipment: 'barbell',
  },
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Bicep Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'hammer-curls',
    name: 'Hammer Curls',
    primaryMuscles: ['biceps', 'forearms'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'incline-dumbbell-curl',
    name: 'Incline Dumbbell Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'preacher-curl',
    name: 'Preacher Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  },
  {
    id: 'concentration-curl',
    name: 'Concentration Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'dumbbell',
  },
  {
    id: 'cable-curl',
    name: 'Cable Bicep Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'spider-curls',
    name: 'Spider Curls',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },

  // TRICEPS
  {
    id: 'close-grip-bench',
    name: 'Close-Grip Bench Press',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'tricep-dips',
    name: 'Tricep Dips',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  },
  {
    id: 'skull-crushers',
    name: 'Skull Crushers (Lying Tricep Extension)',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  },
  {
    id: 'tricep-pushdown',
    name: 'Tricep Pushdown',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'rope-pushdown',
    name: 'Rope Tricep Pushdown',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'overhead-tricep-extension',
    name: 'Overhead Tricep Extension',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  },
  {
    id: 'cable-overhead-extension',
    name: 'Cable Overhead Tricep Extension',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'kickbacks',
    name: 'Tricep Kickbacks',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'dumbbell',
  },
  {
    id: 'diamond-pushups',
    name: 'Diamond Push-Ups',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest'],
    category: 'compound',
    equipment: 'bodyweight',
  },

  // LEGS - QUADS
  {
    id: 'back-squat',
    name: 'Barbell Back Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'lower_back'],
    category: 'compound',
    equipment: 'barbell',
    instructions: 'Bar on upper back, feet shoulder-width, squat down keeping chest up, drive through heels.',
  },
  {
    id: 'front-squat',
    name: 'Front Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'abs'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['abs'],
    category: 'compound',
    equipment: 'dumbbell',
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'hack-squat',
    name: 'Hack Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'lunges',
    name: 'Barbell Lunges',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'barbell',
    alternatingSides: true,
  },
  {
    id: 'walking-lunges',
    name: 'Walking Lunges',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  },
  {
    id: 'split-squat',
    name: 'Split Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  },
  {
    id: 'step-ups',
    name: 'Step-Ups',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: [],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  },
  {
    id: 'sissy-squat',
    name: 'Sissy Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },

  // LEGS - HAMSTRINGS & GLUTES
  {
    id: 'leg-curl',
    name: 'Lying Leg Curl',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'seated-leg-curl',
    name: 'Seated Leg Curl',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'stiff-leg-deadlift',
    name: 'Stiff-Leg Deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'good-mornings',
    name: 'Good Mornings',
    primaryMuscles: ['hamstrings', 'lower_back'],
    secondaryMuscles: ['glutes'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'hip-thrust',
    name: 'Barbell Hip Thrust',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'cable-kickbacks',
    name: 'Cable Glute Kickbacks',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'cable',
  },
  {
    id: 'glute-ham-raise',
    name: 'Glute-Ham Raise',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'nordic-curl',
    name: 'Nordic Hamstring Curl',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },

  // CALVES
  {
    id: 'standing-calf-raise',
    name: 'Standing Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'seated-calf-raise',
    name: 'Seated Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'donkey-calf-raise',
    name: 'Donkey Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'leg-press-calf-raise',
    name: 'Leg Press Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },

  // ABS & CORE
  {
    id: 'crunches',
    name: 'Crunches',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'sit-ups',
    name: 'Sit-Ups',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'leg-raises',
    name: 'Hanging Leg Raises',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'lying-leg-raises',
    name: 'Lying Leg Raises',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'plank',
    name: 'Plank',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'side-plank',
    name: 'Side Plank',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'russian-twists',
    name: 'Russian Twists',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'cable-crunches',
    name: 'Cable Crunches',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'ab-wheel-rollout',
    name: 'Ab Wheel Rollout',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'compound',
    equipment: 'other',
  },
  {
    id: 'mountain-climbers',
    name: 'Mountain Climbers',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  },
  {
    id: 'bicycle-crunches',
    name: 'Bicycle Crunches',
    primaryMuscles: ['abs', 'obliques'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'pallof-press',
    name: 'Pallof Press',
    primaryMuscles: ['abs', 'obliques'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },
  {
    id: 'woodchoppers',
    name: 'Cable Woodchoppers',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    category: 'isolation',
    equipment: 'cable',
  },

  // FOREARMS
  {
    id: 'wrist-curls',
    name: 'Wrist Curls',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  },
  {
    id: 'reverse-wrist-curls',
    name: 'Reverse Wrist Curls',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  },
  {
    id: 'farmers-walk',
    name: "Farmer's Walk",
    primaryMuscles: ['forearms', 'traps'],
    secondaryMuscles: ['abs'],
    category: 'compound',
    equipment: 'dumbbell',
  },

  // ADDITIONAL MACHINE EXERCISES
  {
    id: 'machine-shoulder-press',
    name: 'Shoulder Press Machine',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'chest-fly-machine',
    name: 'Chest Fly Machine',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'hip-abduction',
    name: 'Hip Abduction Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'hip-adduction',
    name: 'Hip Adduction Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'hip-thrust-machine',
    name: 'Hip Thrust Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'assisted-pull-up',
    name: 'Assisted Pull-Up Machine',
    primaryMuscles: ['lats', 'back'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'ab-crunch-machine',
    name: 'Ab Crunch Machine',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'lateral-raise-machine',
    name: 'Lateral Raise Machine',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'bicep-curl-machine',
    name: 'Bicep Curl Machine',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'tricep-extension-machine',
    name: 'Tricep Extension Machine',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'incline-chest-press-machine',
    name: 'Incline Chest Press Machine',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'high-row-machine',
    name: 'High Row Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'rdl-machine',
    name: 'RDL Machine',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'cable-fly-low-to-high',
    name: 'Low-to-High Cable Fly',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    category: 'isolation',
    equipment: 'cable',
  },

  // SMITH MACHINE EXERCISES
  {
    id: 'smith-machine-bench-press',
    name: 'Smith Machine Bench Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-incline-press',
    name: 'Smith Machine Incline Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-squat',
    name: 'Smith Machine Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-shoulder-press',
    name: 'Smith Machine Shoulder Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-row',
    name: 'Smith Machine Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-lunge',
    name: 'Smith Machine Lunge',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    alternatingSides: true,
    equipment: 'machine',
  },
  {
    id: 'smith-machine-calf-raise',
    name: 'Smith Machine Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-shrug',
    name: 'Smith Machine Shrug',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-upright-row',
    name: 'Smith Machine Upright Row',
    primaryMuscles: ['shoulders', 'traps'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'smith-machine-hip-thrust',
    name: 'Smith Machine Hip Thrust',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  },
  
  // ADDITIONAL COMMON MACHINE EXERCISES
  {
    id: 'seated-row-machine',
    name: 'Seated Row Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'chest-supported-row-machine',
    name: 'Chest Supported Row Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'rear-delt-machine',
    name: 'Rear Delt Machine',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'glute-kickback-machine',
    name: 'Glute Kickback Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'machine',
  },
  {
    id: 'inner-thigh-machine',
    name: 'Inner Thigh Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'outer-thigh-machine',
    name: 'Outer Thigh Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'preacher-curl-machine',
    name: 'Preacher Curl Machine',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  },
  {
    id: 'tricep-dip-machine',
    name: 'Tricep Dip Machine',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'cable-crossover',
    name: 'Cable Crossover',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  },

  // KETTLEBELL & FUNCTIONAL
  {
    id: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['abs', 'shoulders'],
    category: 'compound',
    equipment: 'other',
  },
  {
    id: 'kettlebell-deadlift',
    name: 'Kettlebell Deadlift',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['lower_back', 'quads'],
    category: 'compound',
    equipment: 'other',
  },
  {
    id: 'kettlebell-goblet-squat',
    name: 'Kettlebell Goblet Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['abs'],
    category: 'compound',
    equipment: 'other',
  },
  {
    id: 'kettlebell-rdl',
    name: 'Kettlebell Romanian Deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'other',
  },
  // OLYMPIC / EXPLOSIVE LIFTS
  {
    id: 'power-clean',
    name: 'Power Clean',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['quads', 'traps', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'power-snatch',
    name: 'Power Snatch',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['shoulders', 'traps', 'quads'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'clean-and-jerk',
    name: 'Clean & Jerk',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['shoulders', 'quads', 'triceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'hang-clean',
    name: 'Hang Clean',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['traps', 'quads', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'hang-snatch',
    name: 'Hang Snatch',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['shoulders', 'traps', 'quads'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'squat-clean',
    name: 'Squat Clean',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'traps', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'dumbbell-curl-to-press',
    name: 'Dumbbell Curl to Press',
    primaryMuscles: ['biceps', 'shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'dumbbell',
  },
  {
    id: 'reverse-lunges',
    name: 'Reverse Lunges',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    alternatingSides: true,
    equipment: 'dumbbell',
  },
  {
    id: 'med-ball-slams',
    name: 'Medicine Ball Slams',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders', 'lats'],
    category: 'compound',
    equipment: 'other',
  },
  {
    id: 'box-squat',
    name: 'Box Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'push-press',
    name: 'Push Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'quads'],
    category: 'compound',
    equipment: 'barbell',
  },
  {
    id: 'battle-ropes',
    name: 'Battle Ropes',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['abs', 'forearms'],
    category: 'compound',
    equipment: 'other',
  },
  {
    id: 'shoulder-tap-plank',
    name: 'Shoulder Tap Plank',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'isolation',
    equipment: 'bodyweight',
  },
  {
    id: 'knee-raises',
    name: 'Knee Raises',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  },

  // WARMUP & MOBILITY EXERCISES
  {
    id: 'banded-glute-bridge',
    name: 'Banded Glute Bridge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'banded-clamshells',
    name: 'Banded Clamshells',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'banded-lateral-walk',
    name: 'Banded Lateral Walk',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['quads'],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'banded-monster-walk',
    name: 'Banded Monster Walk',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['quads'],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'bird-dog',
    name: 'Bird Dog',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['glutes', 'lower_back'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'cat-cow-stretch',
    name: 'Cat-Cow Stretch',
    primaryMuscles: ['lower_back'],
    secondaryMuscles: ['abs'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'world-greatest-stretch',
    name: 'World\'s Greatest Stretch',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings', 'quads'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'hip-circles',
    name: 'Hip Circles',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'leg-swings',
    name: 'Leg Swings',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['quads', 'glutes'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'arm-circles',
    name: 'Arm Circles',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'shoulder-dislocates',
    name: 'Shoulder Dislocates (Band/Stick)',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'banded-pull-aparts',
    name: 'Banded Pull Aparts',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'banded-face-pulls',
    name: 'Banded Face Pulls',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['traps'],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'thoracic-rotations',
    name: 'Thoracic Rotations',
    primaryMuscles: ['back'],
    secondaryMuscles: ['abs'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'foam-roll-upper-back',
    name: 'Foam Roll Upper Back',
    primaryMuscles: ['back'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'foam-roll-quads',
    name: 'Foam Roll Quads',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'foam-roll-glutes',
    name: 'Foam Roll Glutes',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  },
  {
    id: 'ankle-circles',
    name: 'Ankle Circles',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'inchworm',
    name: 'Inchworm',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['abs', 'shoulders'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'high-knees',
    name: 'High Knees',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['abs'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'butt-kicks',
    name: 'Butt Kicks',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'jumping-jacks',
    name: 'Jumping Jacks',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['shoulders', 'calves'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'mountain-climbers',
    name: 'Mountain Climbers',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['quads', 'shoulders'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'plank-hold',
    name: 'Plank Hold',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'side-plank',
    name: 'Side Plank',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: '90-90-hip-stretch',
    name: '90/90 Hip Stretch',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Hip Flexor Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'pigeon-stretch',
    name: 'Pigeon Stretch',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'seated-hamstring-stretch',
    name: 'Seated Hamstring Stretch',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'standing-quad-stretch',
    name: 'Standing Quad Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  },
  {
    id: 'wall-angels',
    name: 'Wall Angels',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    category: 'warmup',
    equipment: 'bodyweight',
  },

  // CARDIO MACHINES (for circuit tracking)
  {
    id: 'rowing-machine',
    name: 'Rowing Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'quads'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'ski-erg',
    name: 'Ski Erg',
    primaryMuscles: ['lats', 'abs'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'assault-bike',
    name: 'Assault Bike',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['shoulders', 'abs'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'stationary-bike',
    name: 'Stationary Bike',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['hamstrings', 'calves'],
    category: 'compound',
    equipment: 'machine',
  },
  {
    id: 'stair-master',
    name: 'Stair Master',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['calves'],
    category: 'compound',
    equipment: 'machine',
  },

  // STRETCHES
  {
    id: 'neck-flexion-stretch',
    name: 'Neck Flexion Stretch',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Gently tilt head forward, bringing chin toward chest. Hold.',
  },
  {
    id: 'upper-trapezius-stretch',
    name: 'Upper Trapezius Stretch',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Tilt head to one side, gently pulling with hand. Hold and repeat other side.',
  },
  {
    id: 'levator-scapulae-stretch',
    name: 'Levator Scapulae Stretch',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Turn head 45 degrees, look down toward armpit. Gently pull head down.',
  },
  {
    id: 'scalene-stretch',
    name: 'Scalene Stretch',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Tilt head to side while reaching opposite arm down. Hold and switch sides.',
  },
  {
    id: 'chest-pec-stretch',
    name: 'Chest (Pec) Stretch',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Place forearm against wall or doorframe, lean forward until stretch is felt in chest.',
  },
  {
    id: 'lat-stretch',
    name: 'Lat Stretch',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['obliques'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Hold onto a sturdy object, lean back and to the side to stretch lats.',
  },
  {
    id: 'shoulder-cross-body-stretch',
    name: 'Shoulder Cross-Body Stretch',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Pull one arm across body with opposite hand. Hold and switch sides.',
  },
  {
    id: 'overhead-triceps-stretch',
    name: 'Overhead Triceps Stretch',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['shoulders'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Raise arm overhead, bend elbow, use other hand to gently push elbow back.',
  },
  {
    id: 'thoracic-extension-stretch',
    name: 'Thoracic Extension Stretch',
    primaryMuscles: ['back'],
    secondaryMuscles: ['chest'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Using foam roller or bench, extend upper back over the support.',
  },
  {
    id: 'thoracic-rotation-stretch',
    name: 'Thoracic Rotation Stretch',
    primaryMuscles: ['back'],
    secondaryMuscles: ['obliques'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'On all fours, place one hand behind head, rotate torso to open chest toward ceiling.',
  },
  {
    id: 'cat-cow-stretch',
    name: 'Cat-Cow Stretch',
    primaryMuscles: ['back'],
    secondaryMuscles: ['abs'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'On all fours, alternate between arching back up (cat) and dropping belly down (cow).',
  },
  {
    id: 'childs-pose',
    name: "Child's Pose",
    primaryMuscles: ['back'],
    secondaryMuscles: ['shoulders', 'glutes'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Kneel, sit back on heels, reach arms forward on floor, rest forehead down.',
  },
  {
    id: 'standing-side-bend-stretch',
    name: 'Standing Side Bend Stretch',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['lats'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Stand tall, reach one arm overhead and lean to opposite side. Hold and switch.',
  },
  {
    id: 'hip-flexor-lunge-stretch',
    name: 'Hip Flexor (Lunge) Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Kneel on one knee, push hips forward while keeping torso upright.',
  },
  {
    id: 'quadriceps-stretch',
    name: 'Quadriceps Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Standing or lying, pull heel toward glutes. Keep knees together.',
  },
  {
    id: 'hamstring-stretch',
    name: 'Hamstring Stretch',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['lower_back'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Seated or standing, extend leg and hinge at hips to reach toward toes.',
  },
  {
    id: 'adductor-groin-stretch',
    name: 'Adductor (Groin) Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Wide stance, shift weight to one side, bending that knee while keeping other leg straight.',
  },
  {
    id: 'figure-4-glute-stretch',
    name: 'Figure-4 Glute Stretch',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['quads'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Lying on back, cross one ankle over opposite knee, pull thigh toward chest.',
  },
  {
    id: 'piriformis-stretch',
    name: 'Piriformis Stretch',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Seated, cross one leg over the other, rotate torso toward bent knee.',
  },
  {
    id: 'it-band-stretch',
    name: 'IT Band Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Standing, cross one leg behind the other, lean away from back leg.',
  },
  {
    id: 'calf-gastrocnemius-stretch',
    name: 'Calf (Gastrocnemius) Stretch',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Step one foot back, keep heel down and leg straight, lean forward.',
  },
  {
    id: 'soleus-stretch',
    name: 'Soleus Stretch',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Similar to calf stretch but with back knee slightly bent.',
  },
  {
    id: 'ankle-dorsiflexion-stretch',
    name: 'Ankle Dorsiflexion Stretch',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Kneel with one foot forward, drive knee over toes while keeping heel down.',
  },
  {
    id: 'forward-fold',
    name: 'Forward Fold',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['lower_back'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Stand with feet together, hinge at hips, let upper body hang toward floor.',
  },
  {
    id: 'seated-spinal-twist',
    name: 'Seated Spinal Twist',
    primaryMuscles: ['back'],
    secondaryMuscles: ['obliques'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Seated, cross one leg over, twist torso toward bent knee using opposite elbow.',
  },
  {
    id: 'butterfly-stretch',
    name: 'Butterfly Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Seated, bring soles of feet together, let knees fall outward, gently press down.',
  },
  {
    id: 'kneeling-back-stretch',
    name: 'Kneeling Back Stretch',
    primaryMuscles: ['back'],
    secondaryMuscles: ['lats'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Kneel, reach arms forward on floor, sink hips back while keeping arms extended.',
  },
  {
    id: 'cobra-upward-dog-stretch',
    name: 'Cobra / Upward Dog Stretch',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['chest', 'back'],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Lie face down, press hands into floor, lift chest while keeping hips down.',
  },
  {
    id: 'wrist-flexor-stretch',
    name: 'Wrist Flexor Stretch',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Extend arm, palm up, use other hand to pull fingers back toward body.',
  },
  {
    id: 'wrist-extensor-stretch',
    name: 'Wrist Extensor Stretch',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    category: 'stretching',
    equipment: 'bodyweight',
    instructions: 'Extend arm, palm down, use other hand to pull fingers toward body.',
  },
];

// Deduplicated export — first occurrence of each ID wins
export const exerciseLibrary: Exercise[] = (() => {
  const seen = new Set<string>();
  return _rawExerciseLibrary.filter(ex => {
    if (seen.has(ex.id)) return false;
    seen.add(ex.id);
    return true;
  });
})();

// Get exercise by ID — O(1) via pre-built Map
export function getExerciseById(id: string): Exercise | undefined {
  return exerciseLibraryMap.get(id);
}

// Search exercises by name, muscles, equipment, and category
export function searchExercises(query: string): Exercise[] {
  const lowerQuery = query.toLowerCase();
  return exerciseLibrary.filter(e => 
    e.name.toLowerCase().includes(lowerQuery) ||
    e.primaryMuscles.some(m => m.toLowerCase().includes(lowerQuery)) ||
    e.secondaryMuscles.some(m => m.toLowerCase().includes(lowerQuery)) ||
    e.equipment.toLowerCase().includes(lowerQuery) ||
    e.category.toLowerCase().includes(lowerQuery)
  );
}

// Get exercises by muscle group
export function getExercisesByMuscle(muscle: MuscleGroup): Exercise[] {
  return exerciseLibrary.filter(e => 
    e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle)
  );
}

// Get exercises by equipment
export function getExercisesByEquipment(equipment: Equipment): Exercise[] {
  return exerciseLibrary.filter(e => e.equipment === equipment);
}

// Calculate estimated 1RM
// Uses Brzycki formula for 1-6 reps (most accurate for strength sets)
// Uses Epley formula for 7+ reps
export function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight; // Actual 1RM, no calculation needed
  if (reps <= 6) {
    // Brzycki formula: weight × (36 / (37 - reps))
    return Math.round(weight * (36 / (37 - reps)));
  }
  // Epley formula for higher reps: weight × (1 + reps / 30)
  return Math.round(weight * (1 + reps / 30));
}

// Calculate weight for target reps from 1RM
export function calculateWeightFromRM(oneRM: number, targetReps: number): number {
  if (targetReps === 1) return oneRM;
  return Math.round(oneRM / (1 + targetReps / 30));
}

// Get muscle group display name
export function getMuscleDisplayName(muscle: MuscleGroup): string {
  const names: Record<MuscleGroup, string> = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Forearms',
    abs: 'Abs',
    obliques: 'Obliques',
    quads: 'Quads',
    hamstrings: 'Hamstrings',
    glutes: 'Glutes',
    calves: 'Calves',
    traps: 'Traps',
    lats: 'Lats',
    lower_back: 'Lower Back',
  };
  return names[muscle] || muscle;
}

// Create custom exercise
export function createCustomExercise(
  name: string,
  primaryMuscles: MuscleGroup[],
  secondaryMuscles: MuscleGroup[],
  equipment: Equipment,
  createdBy: string
): Exercise {
  return {
    id: uuidv4(),
    name,
    primaryMuscles,
    secondaryMuscles,
    category: 'isolation',
    equipment,
    isCustom: true,
    createdBy,
  };
}

// ============ BLOCK TYPE EXERCISE FILTERING ============

// Get exercises suitable for a specific block type
export function getExercisesForBlockType(blockType: string): Exercise[] {
  const all = allExercises;
  
  switch (blockType) {
    case 'warmup':
      return all.filter(ex => 
        ex.category === 'warmup' || 
        ex.category === 'stretching' || 
        ex.category === 'activation' ||
        // Include some light cardio for warmup
        (ex.category === 'cardio' && ['jumping-jacks', 'high-knees', 'butt-kicks', 'jump-rope'].includes(ex.id))
      );
    case 'cooldown':
      return all.filter(ex => 
        ex.category === 'stretching'
      );
    case 'cardio':
      return all.filter(ex => 
        ex.category === 'cardio'
      );
    case 'work':
    case 'circuit':
    default:
      // Work blocks can use all strength exercises
      return all.filter(ex => 
        ex.category === 'compound' || 
        ex.category === 'isolation'
      );
  }
}

// Warmup, activation, and cardio exercises
export const warmupExercises: Exercise[] = [
  // Dynamic Stretches
  { id: 'arm-circles', name: 'Arm Circles', primaryMuscles: ['shoulders'], secondaryMuscles: [], category: 'warmup', equipment: 'bodyweight' },
  { id: 'leg-swings', name: 'Leg Swings', primaryMuscles: ['hamstrings', 'quads'], secondaryMuscles: ['glutes'], category: 'warmup', equipment: 'bodyweight' },
  { id: 'hip-circles', name: 'Hip Circles', primaryMuscles: ['glutes'], secondaryMuscles: ['lower_back'], category: 'warmup', equipment: 'bodyweight' },
  { id: 'torso-twists', name: 'Torso Twists', primaryMuscles: ['obliques'], secondaryMuscles: ['lower_back'], category: 'warmup', equipment: 'bodyweight' },
  { id: 'neck-rolls', name: 'Neck Rolls', primaryMuscles: ['traps'], secondaryMuscles: [], category: 'warmup', equipment: 'bodyweight' },
  { id: 'walking-lunges', name: 'Walking Lunges', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'], category: 'warmup', equipment: 'bodyweight' },
  { id: 'high-knees', name: 'High Knees', primaryMuscles: ['quads'], secondaryMuscles: ['abs'], category: 'warmup', equipment: 'bodyweight' },
  { id: 'butt-kicks', name: 'Butt Kicks', primaryMuscles: ['hamstrings'], secondaryMuscles: ['quads'], category: 'warmup', equipment: 'bodyweight' },
  { id: 'jumping-jacks', name: 'Jumping Jacks', primaryMuscles: ['shoulders'], secondaryMuscles: ['calves'], category: 'warmup', equipment: 'bodyweight' },
  { id: 'inchworms', name: 'Inchworms', primaryMuscles: ['hamstrings', 'shoulders'], secondaryMuscles: ['abs'], category: 'warmup', equipment: 'bodyweight' },
  
  // Activation Exercises
  { id: 'glute-bridges', name: 'Glute Bridges', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], category: 'activation', equipment: 'bodyweight' },
  { id: 'bird-dogs', name: 'Bird Dogs', primaryMuscles: ['lower_back', 'abs'], secondaryMuscles: ['glutes'], category: 'activation', equipment: 'bodyweight' },
  { id: 'dead-bugs', name: 'Dead Bugs', primaryMuscles: ['abs'], secondaryMuscles: ['lower_back'], category: 'activation', equipment: 'bodyweight' },
  { id: 'clamshells', name: 'Clamshells', primaryMuscles: ['glutes'], secondaryMuscles: [], category: 'activation', equipment: 'bands' },
  { id: 'band-pull-aparts', name: 'Band Pull Aparts', primaryMuscles: ['shoulders', 'back'], secondaryMuscles: ['traps'], category: 'activation', equipment: 'bands' },
  { id: 'cat-cow', name: 'Cat-Cow Stretch', primaryMuscles: ['lower_back', 'abs'], secondaryMuscles: [], category: 'activation', equipment: 'bodyweight' },
  { id: 'scapular-push-ups', name: 'Scapular Push-Ups', primaryMuscles: ['shoulders'], secondaryMuscles: ['chest'], category: 'activation', equipment: 'bodyweight' },
  { id: 'shoulder-dislocates', name: 'Shoulder Dislocates', primaryMuscles: ['shoulders'], secondaryMuscles: ['chest'], category: 'activation', equipment: 'bands' },
  
  // Static Stretches (for cooldown)
  { id: 'hamstring-stretch', name: 'Hamstring Stretch', primaryMuscles: ['hamstrings'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight' },
  { id: 'quad-stretch', name: 'Quad Stretch', primaryMuscles: ['quads'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight' },
  { id: 'hip-flexor-stretch', name: 'Hip Flexor Stretch', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], category: 'stretching', equipment: 'bodyweight' },
  { id: 'chest-stretch', name: 'Chest Stretch', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders'], category: 'stretching', equipment: 'bodyweight' },
  { id: 'tricep-stretch', name: 'Tricep Stretch', primaryMuscles: ['triceps'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight' },
  { id: 'lat-stretch', name: 'Lat Stretch', primaryMuscles: ['lats'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight' },
  { id: 'pigeon-pose', name: 'Pigeon Pose', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], category: 'stretching', equipment: 'bodyweight' },
  { id: 'childs-pose', name: "Child's Pose", primaryMuscles: ['lower_back', 'lats'], secondaryMuscles: ['shoulders'], category: 'stretching', equipment: 'bodyweight' },
];

export const cardioExercises: Exercise[] = [
  { id: 'running', name: 'Running', primaryMuscles: ['quads', 'hamstrings'], secondaryMuscles: ['calves', 'glutes'], category: 'cardio', equipment: 'bodyweight' },
  { id: 'cycling', name: 'Cycling', primaryMuscles: ['quads'], secondaryMuscles: ['hamstrings', 'calves'], category: 'cardio', equipment: 'machine' },
  { id: 'rowing', name: 'Rowing', primaryMuscles: ['back', 'lats'], secondaryMuscles: ['biceps', 'shoulders'], category: 'cardio', equipment: 'machine' },
  { id: 'swimming', name: 'Swimming', primaryMuscles: ['lats', 'shoulders'], secondaryMuscles: ['chest', 'triceps'], category: 'cardio', equipment: 'bodyweight' },
  { id: 'elliptical', name: 'Elliptical', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'hamstrings'], category: 'cardio', equipment: 'machine' },
  { id: 'stair-climber', name: 'Stair Climber', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['calves'], category: 'cardio', equipment: 'machine' },
  { id: 'jump-rope', name: 'Jump Rope', primaryMuscles: ['calves'], secondaryMuscles: ['shoulders', 'quads'], category: 'cardio', equipment: 'other' },
  { id: 'burpees', name: 'Burpees', primaryMuscles: ['chest', 'quads'], secondaryMuscles: ['shoulders', 'abs'], category: 'cardio', equipment: 'bodyweight' },
  { id: 'mountain-climbers', name: 'Mountain Climbers', primaryMuscles: ['abs'], secondaryMuscles: ['shoulders', 'quads'], category: 'cardio', equipment: 'bodyweight' },
  { id: 'box-jumps', name: 'Box Jumps', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['calves'], category: 'cardio', equipment: 'other' },
  { id: 'battle-ropes', name: 'Battle Ropes', primaryMuscles: ['shoulders'], secondaryMuscles: ['abs', 'back'], category: 'cardio', equipment: 'other' },
  { id: 'sled-push', name: 'Sled Push', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['shoulders', 'calves'], category: 'cardio', equipment: 'other' },
  { id: 'assault-bike', name: 'Assault Bike', primaryMuscles: ['quads'], secondaryMuscles: ['shoulders', 'hamstrings'], category: 'cardio', equipment: 'machine' },
  { id: 'ski-erg', name: 'Ski Erg', primaryMuscles: ['lats', 'triceps'], secondaryMuscles: ['abs', 'shoulders'], category: 'cardio', equipment: 'machine' },
  { id: 'sprints', name: 'Sprints', primaryMuscles: ['quads', 'hamstrings'], secondaryMuscles: ['glutes', 'calves'], category: 'cardio', equipment: 'bodyweight' },
];

// Combined exercise library with all categories (deduplicated — exerciseLibrary takes priority)
export const allExercises: Exercise[] = (() => {
  const seen = new Set<string>();
  const result: Exercise[] = [];
  for (const ex of [...exerciseLibrary, ...warmupExercises, ...cardioExercises]) {
    if (!seen.has(ex.id)) {
      seen.add(ex.id);
      result.push(ex);
    }
  }
  return result;
})();

// ============ EXERCISE LOOKUP MAP (O(1) by ID) ============

// Pre-built map for O(1) exercise lookups — use instead of exerciseLibrary.find()
export const exerciseLibraryMap: Map<string, Exercise> = new Map(
  allExercises.map(ex => [ex.id, ex])
);

// ============ UNIFIED EXERCISE SEARCH ============

// Efficient search across name, aliases, muscles, equipment, category, pattern
// Used by all exercise pickers across the app for consistent search behavior
export function filterExercisesBySearch(
  exercises: Array<{ id: string; name: string; pattern?: string; aliases?: string[]; isCustom?: boolean }>,
  query: string,
  blockType?: string | null,
): typeof exercises {
  const search = query.toLowerCase().trim();

  return exercises.filter(ex => {
    // Search filter
    if (search) {
      const libEntry = exerciseLibraryMap.get(ex.id);
      const matchesSearch =
        ex.name.toLowerCase().includes(search) ||
        (ex.aliases?.some(a => a.toLowerCase().includes(search)) ?? false) ||
        (libEntry?.primaryMuscles?.some(m => m.toLowerCase().includes(search)) ?? false) ||
        (libEntry?.secondaryMuscles?.some(m => m.toLowerCase().includes(search)) ?? false) ||
        (libEntry?.equipment?.toLowerCase().includes(search) ?? false) ||
        (libEntry?.category?.toLowerCase().includes(search) ?? false) ||
        (ex.pattern?.toLowerCase().includes(search) ?? false);
      if (!matchesSearch) return false;
    }

    // Block type filter
    if (blockType) {
      const pattern = (ex.pattern || '').toLowerCase();
      const category = ((ex as any).category || exerciseLibraryMap.get(ex.id)?.category || '').toLowerCase();

      switch (blockType) {
        case 'warmup':
          return pattern === 'warmup' || category === 'warmup' || category === 'stretching' || category === 'activation';
        case 'cooldown':
          return pattern === 'warmup' || category === 'stretching';
        case 'cardio':
          return pattern === 'cardio' || category === 'cardio';
        case 'work':
        case 'circuit':
        default:
          return pattern !== 'warmup' && pattern !== 'cardio' &&
            category !== 'warmup' && category !== 'cardio' &&
            category !== 'stretching' && category !== 'activation';
      }
    }

    return true;
  });
}

// ============ EXERCISE USAGE COUNTS ============

// ============ ASSISTED EXERCISE HELPERS ============

// Check if an exercise is an assisted movement (weight = counterbalance, progress toward 0)
export function isAssistedExercise(exerciseId: string, exerciseName?: string): boolean {
  const id = exerciseId.toLowerCase();
  const name = (exerciseName || '').toLowerCase();
  return id.includes('assisted') || name.includes('assisted');
}

// Format assisted exercise name: "Assisted Pull-Up Machine" → "Pull-Up Machine (Assisted)"
export function formatAssistedName(name: string): string {
  if (!name.toLowerCase().includes('assisted')) return name;
  const cleaned = name.replace(/\bassisted\b\s*/i, '').trim();
  return `${cleaned} (Assisted)`;
}

// Format weight display for assisted exercises: shows negative value
export function formatAssistedWeight(weight: number, isAssisted: boolean): string {
  if (!isAssisted || weight === 0) return `${weight}`;
  return `−${Math.abs(weight)}`;
}

// Calculate volume for a single set, handling assisted and bodyweight exercises
// Assisted: (bodyweight - assistedWeight) × reps, fallback to reps×1 if no bodyweight
// Bodyweight (0 weight): reps×1
// Normal: weight × reps
export function getSetVolume(
  weight: number | undefined,
  reps: number,
  isAssisted: boolean,
  userBodyweight?: number,
): number {
  if (isAssisted) {
    if (userBodyweight && userBodyweight > 0 && weight && weight > 0) {
      const effectiveLoad = Math.max(userBodyweight - weight, 0);
      return effectiveLoad * reps;
    }
    return 1 * reps; // Fallback: no bodyweight set
  }
  const effectiveWeight = (weight && weight > 0) ? weight : 1;
  return effectiveWeight * reps;
}

// Look up a user's bodyweight from localStorage users array
export function getUserBodyweight(userId: string): number | undefined {
  try {
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const user = storedUsers.find((u: any) => u.id === userId);
    return user?.weight || undefined;
  } catch {
    return undefined;
  }
}

// Count how many times each exercise has been completed across workout history
// Pass userId for self-mode, or clientId for trainer mode
export function getExerciseUsageCounts(
  workoutHistory: Array<{ userId?: string; deletedAt?: string; exercises?: Array<{ exerciseId?: string }> }>,
  userId: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const w of workoutHistory) {
    if (w.userId !== userId || w.deletedAt) continue;
    if (!w.exercises) continue;
    for (const ex of w.exercises) {
      const id = ex.exerciseId || '';
      if (id) counts[id] = (counts[id] || 0) + 1;
    }
  }
  return counts;
}
