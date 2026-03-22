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
  
  instructions: 'Lie on a decline bench, grip the bar slightly wider than shoulder width, lower to lower chest, press up to full extension.',},
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Lie on a flat bench holding dumbbells at chest level, press up until arms are extended, lower with control.',},
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Set bench to 30-45 degrees, press dumbbells up from shoulder level to full extension overhead.',},
  {
    id: 'dumbbell-flyes',
    name: 'Dumbbell Flyes',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Lie on a flat bench, hold dumbbells above chest with slight elbow bend, lower arms out to sides in an arc, squeeze chest to return.',},
  {
    id: 'cable-flyes',
    name: 'Cable Flyes',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand between cable pulleys set at shoulder height, step forward, bring handles together in front of chest with a hugging motion.',},
  {
    id: 'chest-dips',
    name: 'Chest Dips',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  
  instructions: 'Lean forward on parallel bars, lower body by bending arms until chest is stretched, press back up.',},
  {
    id: 'push-ups',
    name: 'Push-Ups',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  
  instructions: 'Start in a high plank, lower chest to the floor by bending elbows, push back up to full arm extension.',},
  {
    id: 'machine-chest-press',
    name: 'Machine Chest Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip handles at chest level, press forward to full extension, return slowly.',},
  {
    id: 'pec-deck',
    name: 'Pec Deck Machine',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with forearms on pads, bring arms together in front of chest, squeeze, then slowly return.',},

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
  
  instructions: 'Take a wide stance with toes pointed out, grip the bar between your legs, drive through your heels to stand up.',},
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'lower_back'],
    secondaryMuscles: ['back'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Hold bar at hip height, hinge at hips pushing them back, lower bar along legs keeping back flat, return to standing.',},
  {
    id: 'dumbbell-rdl',
    name: 'Dumbbell Romanian Deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Hold dumbbells in front of thighs, hinge at hips keeping back flat, lower dumbbells along legs, drive hips forward to stand.',},
  {
    id: 'barbell-row',
    name: 'Barbell Bent-Over Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Hinge forward at hips, grip bar wider than shoulder width, pull bar to lower chest, squeeze shoulder blades together.',},
  {
    id: 'pendlay-row',
    name: 'Pendlay Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Hinge forward until torso is parallel to floor, bar rests on ground each rep, explosively row bar to lower chest.',},
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  
  instructions: 'Place one hand and knee on a bench, row the dumbbell to your hip with the other arm, squeeze shoulder blade at top.',},
  {
    id: 'pull-ups',
    name: 'Pull-Ups',
    primaryMuscles: ['lats', 'back'],
    secondaryMuscles: ['biceps', 'forearms'],
    category: 'compound',
    equipment: 'bodyweight',
  
  instructions: 'Hang from a bar with overhand grip wider than shoulders, pull chin above bar, lower with control.',},
  {
    id: 'chin-ups',
    name: 'Chin-Ups',
    primaryMuscles: ['lats', 'biceps'],
    secondaryMuscles: ['back', 'forearms'],
    category: 'compound',
    equipment: 'bodyweight',
  
  instructions: 'Hang from a bar with underhand grip at shoulder width, pull chin above bar, lower with control.',},
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'back'],
    category: 'compound',
    equipment: 'cable',
  
  instructions: 'Sit at the machine, grip the wide bar overhead, pull bar down to upper chest, squeeze lats, return slowly.',},
  {
    id: 'close-grip-pulldown',
    name: 'Close-Grip Lat Pulldown',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'back'],
    category: 'compound',
    equipment: 'cable',
  
  instructions: 'Sit at the lat pulldown machine, use a close-grip handle, pull down to upper chest, squeeze lats.',},
  {
    id: 'cable-row',
    name: 'Seated Cable Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'cable',
  
  instructions: 'Sit upright at the cable row machine, pull handle to lower chest, squeeze shoulder blades together, return with control.',},
  {
    id: 'single-arm-cable-row',
    name: 'Single Arm Cable Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'traps'],
    category: 'compound',
    equipment: 'cable',
    instructions: 'Stand or sit at a cable machine, grab the handle with one hand, pull toward your torso squeezing your shoulder blade back. Alternate arms.',
  },
  {
    id: 't-bar-row',
    name: 'T-Bar Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Straddle the T-bar, hinge forward, grip handle, row weight to chest while keeping back flat.',},
  {
    id: 'machine-row',
    name: 'Machine Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit at the row machine, grip handles, pull toward torso squeezing shoulder blades, return slowly.',},
  {
    id: 'face-pulls',
    name: 'Face Pulls',
    primaryMuscles: ['back', 'shoulders'],
    secondaryMuscles: ['traps'],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Attach rope to high cable, pull toward face with elbows high, externally rotate at the end, squeeze rear delts.',},
  {
    id: 'straight-arm-pulldown',
    name: 'Straight-Arm Pulldown',
    primaryMuscles: ['lats'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand at a cable machine, arms straight, push the bar down in an arc to your thighs, squeezing lats.',},
  {
    id: 'hyperextensions',
    name: 'Back Extensions (Hyperextensions)',
    primaryMuscles: ['lower_back'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Position yourself face-down on the hyperextension bench, lower torso down, raise back up by extending the lower back.',},

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
  
  instructions: 'Sit on a bench with back support, press barbell from shoulder level overhead to full extension.',},
  {
    id: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Sit or stand, hold dumbbells at shoulder height, press overhead to full extension, lower with control.',},
  {
    id: 'arnold-press',
    name: 'Arnold Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Start with dumbbells at chin height palms facing you, press up while rotating palms to face forward at top.',},
  {
    id: 'lateral-raises',
    name: 'Dumbbell Lateral Raises',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Stand with dumbbells at sides, raise arms out to sides until parallel with floor, lower with control.',},
  {
    id: 'cable-lateral-raises',
    name: 'Cable Lateral Raises',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand sideways to a low cable pulley, raise the handle out to the side until arm is parallel with floor.',},
  {
    id: 'front-raises',
    name: 'Front Raises',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Stand holding dumbbells in front of thighs, raise one or both arms forward to shoulder height, lower slowly.',},
  {
    id: 'rear-delt-flyes',
    name: 'Rear Delt Flyes',
    primaryMuscles: ['shoulders', 'back'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Bend forward at hips, hold dumbbells below chest, raise arms out to sides squeezing rear delts.',},
  {
    id: 'reverse-pec-deck',
    name: 'Reverse Pec Deck',
    primaryMuscles: ['shoulders', 'back'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit facing the pec deck machine, push handles apart by squeezing shoulder blades and rear delts.',},
  {
    id: 'upright-rows',
    name: 'Barbell Upright Rows',
    primaryMuscles: ['shoulders', 'traps'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Hold barbell with narrow grip, pull bar up along your body to chin height, leading with elbows.',},
  {
    id: 'shrugs',
    name: 'Barbell Shrugs',
    primaryMuscles: ['traps'],
    secondaryMuscles: ['shoulders'],
    category: 'isolation',
    equipment: 'barbell',
  
  instructions: 'Hold barbell at arms length, shrug shoulders straight up toward ears, hold briefly, lower.',},
  {
    id: 'dumbbell-shrugs',
    name: 'Dumbbell Shrugs',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Hold dumbbells at your sides, shrug shoulders straight up toward ears, hold briefly, lower.',},

  // BICEPS
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    category: 'isolation',
    equipment: 'barbell',
  
  instructions: 'Stand with barbell at arms length, curl up by bending elbows keeping upper arms still, lower with control.',},
  {
    id: 'ez-bar-curl',
    name: 'EZ Bar Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    category: 'isolation',
    equipment: 'barbell',
  
  instructions: 'Grip the EZ bar on the angled portions, curl up keeping elbows at sides, lower with control.',},
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Bicep Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Stand or sit holding dumbbells at sides, curl up rotating palms to face shoulders, lower slowly.',},
  {
    id: 'hammer-curls',
    name: 'Hammer Curls',
    primaryMuscles: ['biceps', 'forearms'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Hold dumbbells with neutral grip (palms facing each other), curl up keeping wrists neutral throughout.',},
  {
    id: 'incline-dumbbell-curl',
    name: 'Incline Dumbbell Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Sit on an incline bench, let arms hang straight down with dumbbells, curl up, lower slowly for a deep stretch.',},
  {
    id: 'preacher-curl',
    name: 'Preacher Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  
  instructions: 'Rest upper arms on the preacher bench pad, curl the bar up, lower with control for a full stretch.',},
  {
    id: 'concentration-curl',
    name: 'Concentration Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'dumbbell',
  
  instructions: 'Sit on bench, rest elbow against inner thigh, curl dumbbell up to shoulder, squeeze at top.',},
  {
    id: 'cable-curl',
    name: 'Cable Bicep Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand at a low cable pulley, grip the handle, curl up keeping elbows at sides, lower with control.',},
  {
    id: 'spider-curls',
    name: 'Spider Curls',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Lie chest-down on an incline bench, let arms hang straight, curl dumbbells up squeezing biceps.',},

  // TRICEPS
  {
    id: 'close-grip-bench',
    name: 'Close-Grip Bench Press',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Lie on bench, grip bar at shoulder width or narrower, lower to chest, press up focusing on triceps.',},
  {
    id: 'tricep-dips',
    name: 'Tricep Dips',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  
  instructions: 'Support yourself on parallel bars with arms straight, lower body by bending elbows, press back up.',},
  {
    id: 'skull-crushers',
    name: 'Skull Crushers (Lying Tricep Extension)',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  
  instructions: 'Lie on bench holding bar or dumbbells above chest, bend elbows to lower weight toward forehead, extend back up.',},
  {
    id: 'tricep-pushdown',
    name: 'Tricep Pushdown',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand at a high cable pulley, push the bar down by extending elbows, keep upper arms at sides.',},
  {
    id: 'rope-pushdown',
    name: 'Rope Tricep Pushdown',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Attach rope to high cable, push down and spread the rope apart at the bottom, squeeze triceps.',},
  {
    id: 'overhead-tricep-extension',
    name: 'Overhead Tricep Extension',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'dumbbell',
  
  instructions: 'Hold a dumbbell overhead with both hands, lower behind head by bending elbows, extend back up.',},
  {
    id: 'cable-overhead-extension',
    name: 'Cable Overhead Tricep Extension',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Face away from a high cable, grip rope overhead, extend arms forward and up, squeeze triceps.',},
  {
    id: 'kickbacks',
    name: 'Tricep Kickbacks',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'dumbbell',
  
  instructions: 'Hinge forward, hold dumbbell with arm bent at 90 degrees, extend arm straight back, squeeze tricep.',},
  {
    id: 'diamond-pushups',
    name: 'Diamond Push-Ups',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest'],
    category: 'compound',
    equipment: 'bodyweight',
  
  instructions: 'Place hands close together under chest forming a diamond shape, lower chest to hands, push back up.',},

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
  
  instructions: 'Rest barbell on front delts with elbows high, squat down keeping torso upright, drive through heels to stand.',},
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['abs'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Hold a dumbbell or kettlebell at chest level, squat down keeping chest up, push through heels to stand.',},
  {
    id: 'leg-press',
    name: 'Leg Press',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit in the leg press machine, place feet shoulder-width on the platform, lower the weight by bending knees, press back up.',},
  {
    id: 'hack-squat',
    name: 'Hack Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Stand in the hack squat machine, lower body by bending knees, press back up through heels.',},
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with shins behind pad, extend legs straight out, squeeze quads at top, lower slowly.',},
  {
    id: 'lunges',
    name: 'Barbell Lunges',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'barbell',
    alternatingSides: true,
  
  instructions: 'Step forward with one leg, lower back knee toward ground, push off front foot to return. Alternate legs.',},
  {
    id: 'walking-lunges',
    name: 'Walking Lunges',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  
  instructions: 'Step forward into a lunge, drive through front heel to bring back foot forward into next lunge.',},
  {
    id: 'split-squat',
    name: 'Split Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  
  instructions: 'Stand in a staggered stance, lower back knee toward the ground, push through front heel to stand back up.',},
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  
  instructions: 'Place rear foot on a bench behind you, lower back knee toward ground, push through front heel to stand.',},
  {
    id: 'step-ups',
    name: 'Step-Ups',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: [],
    category: 'compound',
    equipment: 'dumbbell',
    alternatingSides: true,
  
  instructions: 'Step onto a box or bench with one foot, drive through that foot to stand on top, step back down. Alternate legs.',},
  {
    id: 'sissy-squat',
    name: 'Sissy Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Hold onto a support, lean back while bending knees, lower body with quads doing the work, push back up.',},

  // LEGS - HAMSTRINGS & GLUTES
  {
    id: 'leg-curl',
    name: 'Lying Leg Curl',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Lie face down on the machine, curl heels toward glutes by contracting hamstrings, lower slowly.',},
  {
    id: 'seated-leg-curl',
    name: 'Seated Leg Curl',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with calves on the pad, curl legs down and back, squeeze hamstrings, return slowly.',},
  {
    id: 'stiff-leg-deadlift',
    name: 'Stiff-Leg Deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Hold barbell, keep legs nearly straight, hinge at hips lowering bar toward feet, return to standing.',},
  {
    id: 'good-mornings',
    name: 'Good Mornings',
    primaryMuscles: ['hamstrings', 'lower_back'],
    secondaryMuscles: ['glutes'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Place barbell on upper back, hinge forward at hips keeping back straight, return to standing.',},
  {
    id: 'hip-thrust',
    name: 'Barbell Hip Thrust',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Sit with upper back against a bench, barbell over hips, drive hips up squeezing glutes at top, lower.',},
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Lie on back with knees bent, drive hips up squeezing glutes at the top, lower with control.',},
  {
    id: 'cable-kickbacks',
    name: 'Cable Glute Kickbacks',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'cable',
  
  instructions: 'Attach ankle strap to low cable, face the machine, kick leg straight back squeezing glutes.',},
  {
    id: 'glute-ham-raise',
    name: 'Glute-Ham Raise',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Lock feet in the GHD machine, lower torso forward with control, pull back up using hamstrings and glutes.',},
  {
    id: 'nordic-curl',
    name: 'Nordic Hamstring Curl',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Kneel with feet anchored, slowly lower your torso forward keeping hips extended, push back up.',},

  // CALVES
  {
    id: 'standing-calf-raise',
    name: 'Standing Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Stand on a raised surface, lower heels below the platform, rise up onto toes squeezing calves.',},
  {
    id: 'seated-calf-raise',
    name: 'Seated Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with knees under the pad, rise up onto toes, squeeze calves at top, lower slowly.',},
  {
    id: 'donkey-calf-raise',
    name: 'Donkey Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Bend at hips with weight on lower back, lower heels below platform, rise up onto toes.',},
  {
    id: 'leg-press-calf-raise',
    name: 'Leg Press Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the leg press, place toes on the bottom edge of platform, push through toes extending ankles.',},

  // ABS & CORE
  {
    id: 'crunches',
    name: 'Crunches',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Lie on back with knees bent, curl shoulders off the floor by contracting abs, lower with control.',},
  {
    id: 'sit-ups',
    name: 'Sit-Ups',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Lie on back with knees bent, sit all the way up by contracting abs, lower back down with control.',},
  {
    id: 'leg-raises',
    name: 'Hanging Leg Raises',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Hang from a bar, raise legs until parallel with the ground or higher, lower with control.',},
  {
    id: 'lying-leg-raises',
    name: 'Lying Leg Raises',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Lie flat on back, keep legs straight, raise them to vertical, lower slowly without touching floor.',},
  {
    id: 'plank',
    name: 'Plank',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Hold a push-up position on forearms or hands, keep body in a straight line from head to heels.',},
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
  
  instructions: 'Sit with torso leaned back, feet off the ground, rotate torso side to side touching the floor.',},
  {
    id: 'cable-crunches',
    name: 'Cable Crunches',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Kneel below a high cable, hold rope behind head, crunch down contracting abs, return slowly.',},
  {
    id: 'ab-wheel-rollout',
    name: 'Ab Wheel Rollout',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'compound',
    equipment: 'other',
  
  instructions: 'Kneel holding the ab wheel, roll forward extending body, pull back using core to return to kneeling.',},
  {
    id: 'mountain-climbers',
    name: 'Mountain Climbers',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'compound',
    equipment: 'bodyweight',
  
  instructions: 'Start in a push-up position, alternate driving knees toward chest in a running motion.',},
  {
    id: 'bicycle-crunches',
    name: 'Bicycle Crunches',
    primaryMuscles: ['abs', 'obliques'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Lie on back, alternate bringing opposite elbow to knee while extending the other leg.',},
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Lie on back with arms up and knees at 90 degrees, extend opposite arm and leg while keeping back flat.',},
  {
    id: 'pallof-press',
    name: 'Pallof Press',
    primaryMuscles: ['abs', 'obliques'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand sideways to a cable, hold handle at chest, press arms straight out resisting rotation, return to chest.',},
  {
    id: 'woodchoppers',
    name: 'Cable Woodchoppers',
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand sideways to a cable, pull the handle diagonally across your body from high to low or low to high.',},

  // FOREARMS
  {
    id: 'wrist-curls',
    name: 'Wrist Curls',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  
  instructions: 'Sit with forearms resting on thighs palms up, curl the bar up by flexing wrists, lower slowly.',},
  {
    id: 'reverse-wrist-curls',
    name: 'Reverse Wrist Curls',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'barbell',
  
  instructions: 'Sit with forearms on thighs palms down, extend wrists lifting the bar, lower slowly.',},
  {
    id: 'farmers-walk',
    name: "Farmer's Walk",
    primaryMuscles: ['forearms', 'traps'],
    secondaryMuscles: ['abs'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Hold heavy dumbbells at sides, walk with upright posture, keeping core tight and shoulders back.',},

  // ADDITIONAL MACHINE EXERCISES
  {
    id: 'machine-shoulder-press',
    name: 'Shoulder Press Machine',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip handles at shoulder height, press overhead to full extension, lower slowly.',},
  {
    id: 'chest-fly-machine',
    name: 'Chest Fly Machine',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip handles with arms wide, bring handles together in front of chest, squeeze, return.',},
  {
    id: 'hip-abduction',
    name: 'Hip Abduction Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with legs together, push knees apart against the pads, squeeze glutes, return slowly.',},
  {
    id: 'hip-adduction',
    name: 'Hip Adduction Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with legs apart, bring knees together against the pads, squeeze inner thighs, return.',},
  {
    id: 'hip-thrust-machine',
    name: 'Hip Thrust Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with upper back supported, drive hips up against the pad, squeeze glutes, lower.',},
  {
    id: 'assisted-dips',
    name: 'Assisted Dips',
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['shoulders'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Kneel or stand on the assist platform, grip parallel bars, lower body by bending arms with machine assistance, press back up.',},
  {
    id: 'assisted-pull-up',
    name: 'Assisted Pull-Up Machine',
    primaryMuscles: ['lats', 'back'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Kneel or stand on the assist platform, grip the bar overhead, pull chin above bar with machine assistance.',},
  {
    id: 'ab-crunch-machine',
    name: 'Ab Crunch Machine',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip handles, crunch forward contracting abs against resistance, return slowly.',},
  {
    id: 'lateral-raise-machine',
    name: 'Lateral Raise Machine',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine with arms under pads, raise arms out to sides to shoulder height, lower slowly.',},
  {
    id: 'bicep-curl-machine',
    name: 'Bicep Curl Machine',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip handles with arms extended, curl up squeezing biceps, lower slowly.',},
  {
    id: 'tricep-extension-machine',
    name: 'Tricep Extension Machine',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip handles, extend arms by pushing down, squeeze triceps, return slowly.',},
  {
    id: 'incline-chest-press-machine',
    name: 'Incline Chest Press Machine',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit in the incline machine, grip handles, press forward and up, return slowly.',},
  {
    id: 'high-row-machine',
    name: 'High Row Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip overhead handles, pull down and back toward your chest, squeeze back.',},
  {
    id: 'rdl-machine',
    name: 'RDL Machine',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Stand in the machine with hips against pad, hinge forward keeping back straight, drive hips to return.',},
  {
    id: 'cable-fly-low-to-high',
    name: 'Low-to-High Cable Fly',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand between low cable pulleys, bring handles up and together in front of upper chest in an arc.',},

  // SMITH MACHINE EXERCISES
  {
    id: 'smith-machine-bench-press',
    name: 'Smith Machine Bench Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Lie on bench under the Smith machine bar, unrack, lower to chest, press up.',},
  {
    id: 'smith-machine-incline-press',
    name: 'Smith Machine Incline Press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Set bench to 30-45 degrees under Smith machine, unrack bar, lower to upper chest, press up.',},
  {
    id: 'smith-machine-squat',
    name: 'Smith Machine Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Stand under the Smith machine bar on upper back, unrack, squat down, drive through heels to stand.',},
  {
    id: 'smith-machine-shoulder-press',
    name: 'Smith Machine Shoulder Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit or stand under the Smith bar at shoulder level, press overhead, lower with control.',},
  {
    id: 'smith-machine-row',
    name: 'Smith Machine Row',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Hinge forward under the Smith machine, grip bar, row to lower chest, squeeze back.',},
  {
    id: 'smith-machine-lunge',
    name: 'Smith Machine Lunge',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    alternatingSides: true,
    equipment: 'machine',
  
  instructions: 'Stand under Smith bar, step one foot forward into a lunge, lower back knee, push back up.',},
  {
    id: 'smith-machine-calf-raise',
    name: 'Smith Machine Calf Raise',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Stand under Smith bar on a raised surface, lower heels, rise onto toes squeezing calves.',},
  {
    id: 'smith-machine-shrug',
    name: 'Smith Machine Shrug',
    primaryMuscles: ['traps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Stand holding Smith bar at arms length, shrug shoulders up toward ears, hold, lower.',},
  {
    id: 'smith-machine-upright-row',
    name: 'Smith Machine Upright Row',
    primaryMuscles: ['shoulders', 'traps'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Stand holding Smith bar with narrow grip, pull up along body to chin height leading with elbows.',},
  {
    id: 'smith-machine-hip-thrust',
    name: 'Smith Machine Hip Thrust',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit with back against a bench, Smith bar over hips, drive hips up squeezing glutes.',},
  
  // ADDITIONAL COMMON MACHINE EXERCISES
  {
    id: 'seated-row-machine',
    name: 'Seated Row Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit at the machine, grip handles, pull toward torso squeezing shoulder blades, return slowly.',},
  {
    id: 'chest-supported-row-machine',
    name: 'Chest Supported Row Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit with chest against the pad, grip handles, row toward torso squeezing back.',},
  {
    id: 'rear-delt-machine',
    name: 'Rear Delt Machine',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit facing the machine, push handles apart by squeezing rear delts and shoulder blades.',},
  {
    id: 'glute-kickback-machine',
    name: 'Glute Kickback Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'isolation',
    alternatingSides: true,
    equipment: 'machine',
  
  instructions: 'Stand in the machine, push one leg back against the pad squeezing glutes, return slowly.',},
  {
    id: 'inner-thigh-machine',
    name: 'Inner Thigh Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit with legs apart, squeeze legs together against the pads, return slowly.',},
  {
    id: 'outer-thigh-machine',
    name: 'Outer Thigh Machine',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit with legs together, push knees apart against the pads, squeeze outer glutes, return.',},
  {
    id: 'preacher-curl-machine',
    name: 'Preacher Curl Machine',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'machine',
  
  instructions: 'Sit with upper arms on the pad, curl handles up squeezing biceps, lower with control.',},
  {
    id: 'tricep-dip-machine',
    name: 'Tricep Dip Machine',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['chest', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit in the machine, grip handles, press down extending arms, squeeze triceps, return slowly.',},
  {
    id: 'cable-crossover',
    name: 'Cable Crossover',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'cable',
  
  instructions: 'Stand between high cable pulleys, step forward, bring handles down and together in front of chest.',},

  // KETTLEBELL & FUNCTIONAL
  {
    id: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['abs', 'shoulders'],
    category: 'compound',
    equipment: 'other',
  
  instructions: 'Stand with feet wider than shoulders, hinge hips to swing kettlebell back between legs, thrust hips forward to swing it up to chest height.',},
  {
    id: 'kettlebell-deadlift',
    name: 'Kettlebell Deadlift',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['lower_back', 'quads'],
    category: 'compound',
    equipment: 'other',
  
  instructions: 'Stand over kettlebell, hinge at hips to grip handle, drive through heels to stand keeping back flat.',},
  {
    id: 'kettlebell-goblet-squat',
    name: 'Kettlebell Goblet Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['abs'],
    category: 'compound',
    equipment: 'other',
  
  instructions: 'Hold kettlebell by horns at chest level, squat down keeping chest up, push through heels to stand.',},
  {
    id: 'kettlebell-rdl',
    name: 'Kettlebell Romanian Deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back'],
    category: 'compound',
    equipment: 'other',
  
  instructions: 'Hold kettlebell with both hands, hinge at hips pushing them back, lower along legs, drive hips forward to stand.',},
  // OLYMPIC / EXPLOSIVE LIFTS
  {
    id: 'power-clean',
    name: 'Power Clean',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['quads', 'traps', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Start with bar on floor, pull explosively from ground, catch bar on front delts in a quarter squat.',},
  {
    id: 'power-snatch',
    name: 'Power Snatch',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['shoulders', 'traps', 'quads'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Start with bar on floor, pull explosively overhead in one motion, catch with arms locked out.',},
  {
    id: 'clean-and-jerk',
    name: 'Clean & Jerk',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['shoulders', 'quads', 'triceps', 'traps'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Clean bar to shoulders, then drive bar overhead by dipping and extending legs.',},
  {
    id: 'hang-clean',
    name: 'Hang Clean',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['traps', 'quads', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Start with bar at hip height, dip and explosively pull bar to shoulders, catching in a quarter squat.',},
  {
    id: 'hang-snatch',
    name: 'Hang Snatch',
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['shoulders', 'traps', 'quads'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Start with bar at hip height, explosively pull bar overhead in one motion, catch with arms locked.',},
  {
    id: 'squat-clean',
    name: 'Squat Clean',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'traps', 'shoulders'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Pull bar from floor, catch on front delts in a full front squat, stand up to complete the lift.',},
  {
    id: 'dumbbell-curl-to-press',
    name: 'Dumbbell Curl to Press',
    primaryMuscles: ['biceps', 'shoulders'],
    secondaryMuscles: ['triceps'],
    category: 'compound',
    equipment: 'dumbbell',
  
  instructions: 'Curl dumbbells to shoulders, then press overhead in one fluid motion, reverse to return.',},
  {
    id: 'reverse-lunges',
    name: 'Reverse Lunges',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    alternatingSides: true,
    equipment: 'dumbbell',
  
  instructions: 'Step one foot backward into a lunge position, lower back knee toward the ground, push off to return. Alternate legs.',},
  {
    id: 'med-ball-slams',
    name: 'Medicine Ball Slams',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders', 'lats'],
    category: 'compound',
    equipment: 'other',
  
  instructions: 'Lift medicine ball overhead, slam it forcefully into the ground, squat to pick it up and repeat.',},
  {
    id: 'box-squat',
    name: 'Box Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Stand in front of a box, squat down to sit briefly on the box, then drive through heels to stand back up.',},
  {
    id: 'push-press',
    name: 'Push Press',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'quads'],
    category: 'compound',
    equipment: 'barbell',
  
  instructions: 'Hold barbell at shoulders, dip knees slightly, then explosively drive bar overhead using leg power.',},
  {
    id: 'battle-ropes',
    name: 'Battle Ropes',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['abs', 'forearms'],
    category: 'compound',
    equipment: 'other',
  
  instructions: 'Hold rope ends, create alternating waves by rapidly raising and lowering arms. Keep core tight.',},
  {
    id: 'shoulder-tap-plank',
    name: 'Shoulder Tap Plank',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Hold a high plank position, lift one hand to tap opposite shoulder, alternate sides while keeping hips still.',},
  {
    id: 'knee-raises',
    name: 'Knee Raises',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'isolation',
    equipment: 'bodyweight',
  
  instructions: 'Hang from a bar or use a captain\'s chair, raise knees toward chest, lower with control.',},

  // WARMUP & MOBILITY EXERCISES
  {
    id: 'banded-glute-bridge',
    name: 'Banded Glute Bridge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Place band above knees, lie on back with knees bent, drive hips up pushing knees out, squeeze glutes.',},
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Lie on back with knees bent, drive hips up squeezing glutes at the top, lower with control.',},
  {
    id: 'banded-clamshells',
    name: 'Banded Clamshells',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Lie on side with band above knees, keep feet together, open top knee against band resistance, lower slowly.',},
  {
    id: 'banded-lateral-walk',
    name: 'Banded Lateral Walk',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['quads'],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Place band above ankles or knees, stand in half squat, step sideways maintaining tension on the band.',},
  {
    id: 'banded-monster-walk',
    name: 'Banded Monster Walk',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['quads'],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Place band above ankles, stand in half squat, walk forward in diagonal steps maintaining band tension.',},
  {
    id: 'bird-dog',
    name: 'Bird Dog',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['glutes', 'lower_back'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'On all fours, extend opposite arm and leg simultaneously, hold briefly, return and switch sides.',},
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Lie on back with arms up and knees at 90 degrees, extend opposite arm and leg while keeping back flat.',},
  {
    id: 'cat-cow-stretch',
    name: 'Cat-Cow Stretch',
    primaryMuscles: ['lower_back'],
    secondaryMuscles: ['abs'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'On all fours, alternate between arching back up (cat) and dropping belly down (cow).',},
  {
    id: 'world-greatest-stretch',
    name: 'World\'s Greatest Stretch',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings', 'quads'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Lunge forward, place opposite hand on ground, rotate torso opening chest toward front leg.',},
  {
    id: 'hip-circles',
    name: 'Hip Circles',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Stand on one leg, lift other knee and make large circles with the hip joint. Switch directions.',},
  {
    id: 'leg-swings',
    name: 'Leg Swings',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['quads', 'glutes'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Hold a support, swing one leg forward and backward in a controlled arc. Switch to side-to-side swings.',},
  {
    id: 'arm-circles',
    name: 'Arm Circles',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Extend arms to sides, make small circles gradually increasing to large circles. Reverse direction.',},
  {
    id: 'shoulder-dislocates',
    name: 'Shoulder Dislocates (Band/Stick)',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Hold a band or stick wide, raise overhead and rotate behind your back keeping arms straight.',},
  {
    id: 'banded-pull-aparts',
    name: 'Banded Pull Aparts',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Hold a band at shoulder width and height, pull hands apart stretching the band, squeeze shoulder blades.',},
  {
    id: 'banded-face-pulls',
    name: 'Banded Face Pulls',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['traps'],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Hold a band at face height, pull apart toward your face with elbows high, externally rotate at the end.',},
  {
    id: 'thoracic-rotations',
    name: 'Thoracic Rotations',
    primaryMuscles: ['back'],
    secondaryMuscles: ['abs'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'On all fours or side-lying, rotate through your thoracic spine opening chest toward ceiling.',},
  {
    id: 'foam-roll-upper-back',
    name: 'Foam Roll Upper Back',
    primaryMuscles: ['back'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Lie on a foam roller placed under upper back, slowly roll from mid-back to shoulders, pausing on tight spots.',},
  {
    id: 'foam-roll-quads',
    name: 'Foam Roll Quads',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Lie face down with foam roller under thighs, roll from hip to just above knee, pausing on tight spots.',},
  {
    id: 'foam-roll-glutes',
    name: 'Foam Roll Glutes',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'other',
  
  instructions: 'Sit on foam roller, cross one ankle over opposite knee, roll over the glute muscles.',},
  {
    id: 'ankle-circles',
    name: 'Ankle Circles',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Lift one foot off ground, rotate ankle in circles clockwise then counterclockwise. Switch feet.',},
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Stand with feet shoulder-width apart, squat down keeping chest up and weight in heels, stand back up.',},
  {
    id: 'inchworm',
    name: 'Inchworm',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['abs', 'shoulders'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Stand, bend forward to place hands on floor, walk hands out to plank, walk feet back to hands, stand up.',},
  {
    id: 'high-knees',
    name: 'High Knees',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['abs'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Run in place, driving knees as high as possible while pumping arms. Maintain an upright posture.',},
  {
    id: 'butt-kicks',
    name: 'Butt Kicks',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Run in place, kicking heels up toward glutes with each step. Keep a quick pace.',},
  {
    id: 'jumping-jacks',
    name: 'Jumping Jacks',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['shoulders', 'calves'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Jump feet out wide while raising arms overhead, jump back to start. Maintain a steady rhythm.',},
  {
    id: 'mountain-climbers',
    name: 'Mountain Climbers',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['quads', 'shoulders'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Start in a push-up position, alternate driving knees toward chest in a running motion.',},
  {
    id: 'plank-hold',
    name: 'Plank Hold',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['shoulders'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Hold a forearm or high plank position keeping body in a straight line. Engage core throughout.',},
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
  
  instructions: 'Sit with front leg bent 90 degrees in front and back leg bent 90 degrees to the side, lean forward.',},
  {
    id: 'hip-flexor-stretch',
    name: 'Hip Flexor Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Kneel on one knee, push hips forward while keeping torso upright. Hold and switch sides.',},
  {
    id: 'pigeon-stretch',
    name: 'Pigeon Stretch',
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'From a lunge, bring front shin across the body, lower hips toward the ground, lean forward.',},
  {
    id: 'seated-hamstring-stretch',
    name: 'Seated Hamstring Stretch',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Sit with one leg extended, reach toward toes hinging at hips until hamstring stretch is felt.',},
  {
    id: 'standing-quad-stretch',
    name: 'Standing Quad Stretch',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Stand on one leg, pull opposite heel toward glutes, hold and switch sides.',},
  {
    id: 'wall-angels',
    name: 'Wall Angels',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['back'],
    category: 'warmup',
    equipment: 'bodyweight',
  
  instructions: 'Stand with back flat against wall, arms in goal-post position, slide arms up and down the wall.',},

  // CARDIO MACHINES (for circuit tracking)
  {
    id: 'rowing-machine',
    name: 'Rowing Machine',
    primaryMuscles: ['back', 'lats'],
    secondaryMuscles: ['biceps', 'quads'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit on the rower, strap feet in, drive with legs first then pull handle to lower chest, reverse to return.',},
  {
    id: 'ski-erg',
    name: 'Ski Erg',
    primaryMuscles: ['lats', 'abs'],
    secondaryMuscles: ['triceps', 'shoulders'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Stand at the machine, reach arms up to grab handles, pull down using lats and core in a skiing motion.',},
  {
    id: 'assault-bike',
    name: 'Assault Bike',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['shoulders', 'abs'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit on the bike, pedal with legs while pushing and pulling the handles with arms.',},
  {
    id: 'stationary-bike',
    name: 'Stationary Bike',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['hamstrings', 'calves'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Sit on the bike, adjust seat height, pedal at desired intensity maintaining good posture.',},
  {
    id: 'stair-master',
    name: 'Stair Master',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['calves'],
    category: 'compound',
    equipment: 'machine',
  
  instructions: 'Step onto the machine, climb stairs at a steady pace, keep upright without leaning on handles.',},

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
  { id: 'arm-circles', name: 'Arm Circles', primaryMuscles: ['shoulders'], secondaryMuscles: [], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Extend arms to sides, make small circles gradually increasing to large circles. Reverse direction.',},
  { id: 'leg-swings', name: 'Leg Swings', primaryMuscles: ['hamstrings', 'quads'], secondaryMuscles: ['glutes'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Hold a support, swing one leg forward and backward in a controlled arc. Switch to side-to-side swings.',},
  { id: 'hip-circles', name: 'Hip Circles', primaryMuscles: ['glutes'], secondaryMuscles: ['lower_back'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Stand on one leg, lift other knee and make large circles with the hip joint. Switch directions.',},
  { id: 'torso-twists', name: 'Torso Twists', primaryMuscles: ['obliques'], secondaryMuscles: ['lower_back'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Stand with feet shoulder-width, rotate torso left and right, letting arms swing naturally.',},
  { id: 'neck-rolls', name: 'Neck Rolls', primaryMuscles: ['traps'], secondaryMuscles: [], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Slowly roll head in circles, gently stretching neck muscles. Reverse direction after several reps.',},
  { id: 'walking-lunges', name: 'Walking Lunges', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Step forward into a lunge, drive through front heel to bring back foot forward into next lunge.',},
  { id: 'high-knees', name: 'High Knees', primaryMuscles: ['quads'], secondaryMuscles: ['abs'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Run in place, driving knees as high as possible while pumping arms. Maintain an upright posture.',},
  { id: 'butt-kicks', name: 'Butt Kicks', primaryMuscles: ['hamstrings'], secondaryMuscles: ['quads'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Run in place, kicking heels up toward glutes with each step. Keep a quick pace.',},
  { id: 'jumping-jacks', name: 'Jumping Jacks', primaryMuscles: ['shoulders'], secondaryMuscles: ['calves'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Jump feet out wide while raising arms overhead, jump back to start. Maintain a steady rhythm.',},
  { id: 'inchworms', name: 'Inchworms', primaryMuscles: ['hamstrings', 'shoulders'], secondaryMuscles: ['abs'], category: 'warmup', equipment: 'bodyweight',
  instructions: 'Stand, bend forward to place hands on floor, walk hands out to plank, walk feet back to hands, stand up.',},
  
  // Activation Exercises
  { id: 'glute-bridges', name: 'Glute Bridges', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], category: 'activation', equipment: 'bodyweight',
  instructions: 'Lie on back with knees bent, drive hips up squeezing glutes at top, lower with control.',},
  { id: 'bird-dogs', name: 'Bird Dogs', primaryMuscles: ['lower_back', 'abs'], secondaryMuscles: ['glutes'], category: 'activation', equipment: 'bodyweight',
  instructions: 'On all fours, extend opposite arm and leg simultaneously, hold briefly, return and switch sides.',},
  { id: 'dead-bugs', name: 'Dead Bugs', primaryMuscles: ['abs'], secondaryMuscles: ['lower_back'], category: 'activation', equipment: 'bodyweight',
  instructions: 'Lie on back, arms up and knees at 90 degrees, extend opposite arm and leg while keeping back flat.',},
  { id: 'clamshells', name: 'Clamshells', primaryMuscles: ['glutes'], secondaryMuscles: [], category: 'activation', equipment: 'bands',
  instructions: 'Lie on side with knees bent, keep feet together, open top knee like a clamshell, close slowly.',},
  { id: 'band-pull-aparts', name: 'Band Pull Aparts', primaryMuscles: ['shoulders', 'back'], secondaryMuscles: ['traps'], category: 'activation', equipment: 'bands',
  instructions: 'Hold a band at shoulder width and height, pull hands apart stretching the band, squeeze shoulder blades.',},
  { id: 'cat-cow', name: 'Cat-Cow Stretch', primaryMuscles: ['lower_back', 'abs'], secondaryMuscles: [], category: 'activation', equipment: 'bodyweight',
  instructions: 'On all fours, alternate between arching back up (cat) and dropping belly down (cow).',},
  { id: 'scapular-push-ups', name: 'Scapular Push-Ups', primaryMuscles: ['shoulders'], secondaryMuscles: ['chest'], category: 'activation', equipment: 'bodyweight',
  instructions: 'In push-up position with arms straight, protract and retract shoulder blades without bending elbows.',},
  { id: 'shoulder-dislocates', name: 'Shoulder Dislocates', primaryMuscles: ['shoulders'], secondaryMuscles: ['chest'], category: 'activation', equipment: 'bands',
  instructions: 'Hold a band or stick wide, raise overhead and rotate behind your back keeping arms straight.',},
  
  // Static Stretches (for cooldown)
  { id: 'hamstring-stretch', name: 'Hamstring Stretch', primaryMuscles: ['hamstrings'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight' },
  { id: 'quad-stretch', name: 'Quad Stretch', primaryMuscles: ['quads'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight',
  instructions: 'Stand on one leg, pull opposite heel toward glutes, keep knees together. Hold and switch sides.',},
  { id: 'hip-flexor-stretch', name: 'Hip Flexor Stretch', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], category: 'stretching', equipment: 'bodyweight',
  instructions: 'Kneel on one knee, push hips forward while keeping torso upright. Hold and switch sides.',},
  { id: 'chest-stretch', name: 'Chest Stretch', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders'], category: 'stretching', equipment: 'bodyweight',
  instructions: 'Place forearm against a wall or doorframe at shoulder height, lean forward until chest stretch is felt.',},
  { id: 'tricep-stretch', name: 'Tricep Stretch', primaryMuscles: ['triceps'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight',
  instructions: 'Raise one arm overhead, bend elbow, use opposite hand to gently push elbow back.',},
  { id: 'lat-stretch', name: 'Lat Stretch', primaryMuscles: ['lats'], secondaryMuscles: [], category: 'stretching', equipment: 'bodyweight' },
  { id: 'pigeon-pose', name: 'Pigeon Pose', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], category: 'stretching', equipment: 'bodyweight',
  instructions: 'From a lunge, bring front shin across the body, lower hips, lean forward over front leg.',},
  { id: 'childs-pose', name: "Child's Pose", primaryMuscles: ['lower_back', 'lats'], secondaryMuscles: ['shoulders'], category: 'stretching', equipment: 'bodyweight' },
];

export const cardioExercises: Exercise[] = [
  { id: 'running', name: 'Running', primaryMuscles: ['quads', 'hamstrings'], secondaryMuscles: ['calves', 'glutes'], category: 'cardio', equipment: 'bodyweight',
  instructions: 'Run at a steady pace with upright posture, landing midfoot, arms swinging naturally at sides.',},
  { id: 'cycling', name: 'Cycling', primaryMuscles: ['quads'], secondaryMuscles: ['hamstrings', 'calves'], category: 'cardio', equipment: 'machine',
  instructions: 'Pedal at desired intensity, maintain good posture, adjust resistance as needed.',},
  { id: 'rowing', name: 'Rowing', primaryMuscles: ['back', 'lats'], secondaryMuscles: ['biceps', 'shoulders'], category: 'cardio', equipment: 'machine',
  instructions: 'Drive with legs, lean back slightly, pull handle to lower chest. Reverse the sequence to return.',},
  { id: 'swimming', name: 'Swimming', primaryMuscles: ['lats', 'shoulders'], secondaryMuscles: ['chest', 'triceps'], category: 'cardio', equipment: 'bodyweight',
  instructions: 'Move through water using chosen stroke technique, maintaining steady breathing rhythm.',},
  { id: 'elliptical', name: 'Elliptical', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'hamstrings'], category: 'cardio', equipment: 'machine',
  instructions: 'Step onto the machine, pedal in an elliptical motion while holding or pushing handles.',},
  { id: 'stair-climber', name: 'Stair Climber', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['calves'], category: 'cardio', equipment: 'machine',
  instructions: 'Step onto the machine, climb stairs at a steady pace, keep upright posture.',},
  { id: 'jump-rope', name: 'Jump Rope', primaryMuscles: ['calves'], secondaryMuscles: ['shoulders', 'quads'], category: 'cardio', equipment: 'other',
  instructions: 'Hold rope handles, swing rope overhead, jump with both feet clearing the rope on each revolution.',},
  { id: 'burpees', name: 'Burpees', primaryMuscles: ['chest', 'quads'], secondaryMuscles: ['shoulders', 'abs'], category: 'cardio', equipment: 'bodyweight',
  instructions: 'Drop to the floor into a push-up, push up, jump feet toward hands, explosively jump up with arms overhead.',},
  { id: 'mountain-climbers', name: 'Mountain Climbers', primaryMuscles: ['abs'], secondaryMuscles: ['shoulders', 'quads'], category: 'cardio', equipment: 'bodyweight',
  instructions: 'Start in a push-up position, alternate driving knees toward chest in a running motion.',},
  { id: 'box-jumps', name: 'Box Jumps', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['calves'], category: 'cardio', equipment: 'other',
  instructions: 'Stand facing a box, swing arms and jump up onto the box landing softly, step back down.',},
  { id: 'battle-ropes', name: 'Battle Ropes', primaryMuscles: ['shoulders'], secondaryMuscles: ['abs', 'back'], category: 'cardio', equipment: 'other',
  instructions: 'Hold rope ends, create alternating waves by rapidly raising and lowering arms. Keep core tight.',},
  { id: 'sled-push', name: 'Sled Push', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['shoulders', 'calves'], category: 'cardio', equipment: 'other',
  instructions: 'Grip the sled handles, lean forward, drive legs to push the sled across the floor.',},
  { id: 'assault-bike', name: 'Assault Bike', primaryMuscles: ['quads'], secondaryMuscles: ['shoulders', 'hamstrings'], category: 'cardio', equipment: 'machine',
  instructions: 'Sit on the bike, pedal with legs while pushing and pulling the handles with arms.',},
  { id: 'ski-erg', name: 'Ski Erg', primaryMuscles: ['lats', 'triceps'], secondaryMuscles: ['abs', 'shoulders'], category: 'cardio', equipment: 'machine',
  instructions: 'Stand at the machine, reach arms up to grab handles, pull down using lats and core in a skiing motion.',},
  { id: 'sprints', name: 'Sprints', primaryMuscles: ['quads', 'hamstrings'], secondaryMuscles: ['glutes', 'calves'], category: 'cardio', equipment: 'bodyweight',
  instructions: 'Run at maximum effort for short distances, focusing on explosive drive and arm pump.',},
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
