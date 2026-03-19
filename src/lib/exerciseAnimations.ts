/**
 * Exercise Animation GIF URLs mapped from ExerciseDB v1 (Open Source)
 * Source: https://exercisedb-api.vercel.app
 * 
 * Maps our exercise IDs to animated GIF URLs showing proper form.
 * Used in: exercise info dialogs, exercise picker, workout detail page.
 */

export const exerciseAnimationMap: Record<string, string> = {
  // CHEST
  'bench-press': 'https://static.exercisedb.dev/media/tl0IzmZ.gif',
  'incline-bench-press': 'https://static.exercisedb.dev/media/641mIfk.gif',
  'decline-bench-press': 'https://static.exercisedb.dev/media/YqJw82s.gif',
  'dumbbell-bench-press': 'https://static.exercisedb.dev/media/dQVVxJ8.gif',
  'incline-dumbbell-press': 'https://static.exercisedb.dev/media/PG1kcIb.gif',
  'dumbbell-flyes': 'https://static.exercisedb.dev/media/drfGhTV.gif',
  'cable-flyes': 'https://static.exercisedb.dev/media/tBWXbIT.gif',
  'chest-dips': 'https://static.exercisedb.dev/media/X6C6i5Y.gif',
  'push-ups': 'https://static.exercisedb.dev/media/soIB2rj.gif',
  'machine-chest-press': 'https://static.exercisedb.dev/media/jHAnWmT.gif',
  'pec-deck': 'https://static.exercisedb.dev/media/PQcUlDi.gif',
  'chest-fly-machine': 'https://static.exercisedb.dev/media/PQcUlDi.gif',
  'incline-chest-press-machine': 'https://static.exercisedb.dev/media/jHAnWmT.gif',

  // BACK
  'deadlift': 'https://static.exercisedb.dev/media/Vu5PjpY.gif',
  'sumo-deadlift': 'https://static.exercisedb.dev/media/RYcV1kH.gif',
  'romanian-deadlift': 'https://static.exercisedb.dev/media/goJ6ezq.gif',
  'dumbbell-rdl': 'https://static.exercisedb.dev/media/goJ6ezq.gif',
  'barbell-row': 'https://static.exercisedb.dev/media/SzX3uzM.gif',
  'pendlay-row': 'https://static.exercisedb.dev/media/SzX3uzM.gif',
  'dumbbell-row': 'https://static.exercisedb.dev/media/C0MA9bC.gif',
  'pull-ups': 'https://static.exercisedb.dev/media/G70mEAJ.gif',
  'chin-ups': 'https://static.exercisedb.dev/media/G70mEAJ.gif',
  'lat-pulldown': 'https://static.exercisedb.dev/media/CuaWCmC.gif',
  'close-grip-pulldown': 'https://static.exercisedb.dev/media/CuaWCmC.gif',
  'cable-row': 'https://static.exercisedb.dev/media/hvV79Si.gif',
  't-bar-row': 'https://static.exercisedb.dev/media/ZX9UZmj.gif',
  'machine-row': 'https://static.exercisedb.dev/media/oROuvrX.gif',
  'face-pulls': 'https://static.exercisedb.dev/media/yUdIGNs.gif',
  'straight-arm-pulldown': 'https://static.exercisedb.dev/media/CuaWCmC.gif',
  'hyperextensions': 'https://static.exercisedb.dev/media/Vvwjz6N.gif',
  'seated-row-machine': 'https://static.exercisedb.dev/media/oROuvrX.gif',
  'chest-supported-row-machine': 'https://static.exercisedb.dev/media/oROuvrX.gif',
  'high-row-machine': 'https://static.exercisedb.dev/media/nZZZy9m.gif',

  // SHOULDERS
  'overhead-press': 'https://static.exercisedb.dev/media/u4bAmKp.gif',
  'seated-overhead-press': 'https://static.exercisedb.dev/media/u4bAmKp.gif',
  // dumbbell-shoulder-press and arnold-press removed — was incorrectly mapped to RDL GIF
  'lateral-raises': 'https://static.exercisedb.dev/media/3eGE2JC.gif',
  'cable-lateral-raises': 'https://static.exercisedb.dev/media/3eGE2JC.gif',
  'front-raises': 'https://static.exercisedb.dev/media/3eGE2JC.gif',
  'rear-delt-flyes': 'https://static.exercisedb.dev/media/Ln9iTbU.gif',
  // reverse-pec-deck and rear-delt-machine removed — was incorrectly mapped to pec deck GIF
  'upright-rows': 'https://static.exercisedb.dev/media/UDlhcO8.gif',
  'shrugs': 'https://static.exercisedb.dev/media/dG7tG5y.gif',
  'dumbbell-shrugs': 'https://static.exercisedb.dev/media/NJzBsGJ.gif',
  'machine-shoulder-press': 'https://static.exercisedb.dev/media/67n3r98.gif',
  'lateral-raise-machine': 'https://static.exercisedb.dev/media/3eGE2JC.gif',

  // BICEPS
  'barbell-curl': 'https://static.exercisedb.dev/media/82LxxkW.gif',
  'ez-bar-curl': 'https://static.exercisedb.dev/media/82LxxkW.gif',
  'dumbbell-curl': 'https://static.exercisedb.dev/media/W6PxUkg.gif',
  'hammer-curls': 'https://static.exercisedb.dev/media/W6PxUkg.gif',
  'incline-dumbbell-curl': 'https://static.exercisedb.dev/media/W6PxUkg.gif',
  'preacher-curl': 'https://static.exercisedb.dev/media/82LxxkW.gif',
  'concentration-curl': 'https://static.exercisedb.dev/media/W6PxUkg.gif',
  'cable-curl': 'https://static.exercisedb.dev/media/3ZflifB.gif',
  'spider-curls': 'https://static.exercisedb.dev/media/W6PxUkg.gif',
  'bicep-curl-machine': 'https://static.exercisedb.dev/media/kiJ4Z2K.gif',

  // TRICEPS
  'close-grip-bench': 'https://static.exercisedb.dev/media/J6Dx1Mu.gif',
  'tricep-dips': 'https://static.exercisedb.dev/media/X6C6i5Y.gif',
  'skull-crushers': 'https://static.exercisedb.dev/media/iZop9xO.gif',
  // tricep-pushdown and rope-pushdown removed — was incorrectly mapped to cable curl GIF
  'overhead-tricep-extension': 'https://static.exercisedb.dev/media/5uFK1xr.gif',
  'cable-overhead-extension': 'https://static.exercisedb.dev/media/2IxROQ1.gif',
  // kickbacks removed — was incorrectly mapped to bicep curl GIF
  'diamond-pushups': 'https://static.exercisedb.dev/media/soIB2rj.gif',
  'tricep-extension-machine': 'https://static.exercisedb.dev/media/Ser9eQp.gif',
  'tricep-dip-machine': 'https://static.exercisedb.dev/media/X6C6i5Y.gif',

  // LEGS - QUADS
  'back-squat': 'https://static.exercisedb.dev/media/RYcV1kH.gif',
  'front-squat': 'https://static.exercisedb.dev/media/zG0zs85.gif',
  'goblet-squat': 'https://static.exercisedb.dev/media/yn8yg1r.gif',
  'leg-press': 'https://static.exercisedb.dev/media/Qa55kX1.gif',
  'hack-squat': 'https://static.exercisedb.dev/media/Qa55kX1.gif',
  'leg-extension': 'https://static.exercisedb.dev/media/my33uHU.gif',
  'lunges': 'https://static.exercisedb.dev/media/RRWFUcw.gif',
  'walking-lunges': 'https://static.exercisedb.dev/media/IZVHb27.gif',
  'split-squat': 'https://static.exercisedb.dev/media/RRWFUcw.gif',
  'bulgarian-split-squat': 'https://static.exercisedb.dev/media/RRWFUcw.gif',
  'step-ups': 'https://static.exercisedb.dev/media/aXtJhlg.gif',
  'sissy-squat': 'https://static.exercisedb.dev/media/xdYPUtE.gif',
  'reverse-lunges': 'https://static.exercisedb.dev/media/RRWFUcw.gif',
  'box-squat': 'https://static.exercisedb.dev/media/RYcV1kH.gif',

  // LEGS - HAMSTRINGS / GLUTES
  'leg-curl': 'https://static.exercisedb.dev/media/17lJ1kr.gif',
  'seated-leg-curl': 'https://static.exercisedb.dev/media/Zg3XY7P.gif',
  'stiff-leg-deadlift': 'https://static.exercisedb.dev/media/goJ6ezq.gif',
  'good-mornings': 'https://static.exercisedb.dev/media/XlZ4lAC.gif',
  'hip-thrust': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'glute-bridge': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'banded-glute-bridge': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'cable-kickbacks': 'https://static.exercisedb.dev/media/HEJ6DIX.gif',
  'glute-ham-raise': 'https://static.exercisedb.dev/media/Vvwjz6N.gif',
  'nordic-curl': 'https://static.exercisedb.dev/media/Vvwjz6N.gif',
  'hip-abduction': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'hip-adduction': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'hip-thrust-machine': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'glute-kickback-machine': 'https://static.exercisedb.dev/media/HEJ6DIX.gif',
  'inner-thigh-machine': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'outer-thigh-machine': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'banded-clamshells': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'banded-lateral-walk': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'banded-monster-walk': 'https://static.exercisedb.dev/media/qKBpF7I.gif',

  // CALVES
  'standing-calf-raise': 'https://static.exercisedb.dev/media/dG7tG5y.gif',
  'seated-calf-raise': 'https://static.exercisedb.dev/media/dG7tG5y.gif',
  'donkey-calf-raise': 'https://static.exercisedb.dev/media/dG7tG5y.gif',
  'leg-press-calf-raise': 'https://static.exercisedb.dev/media/Qa55kX1.gif',

  // ABS / CORE
  // crunches and sit-ups removed — was incorrectly mapped to push-up GIF
  // leg-raises and lying-leg-raises removed — was incorrectly mapped to pull-up GIF
  'plank': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'plank-hold': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'side-plank': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'russian-twists': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  // cable-crunches removed — was incorrectly mapped to cable curl GIF
  'ab-wheel-rollout': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'mountain-climbers': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  // bicycle-crunches removed — was incorrectly mapped to push-up GIF
  'dead-bug': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  // pallof-press, woodchoppers, ab-crunch-machine removed — incorrectly mapped GIFs
  'shoulder-tap-plank': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'knee-raises': 'https://static.exercisedb.dev/media/G70mEAJ.gif',

  // FOREARMS
  'wrist-curls': 'https://static.exercisedb.dev/media/82LxxkW.gif',
  'reverse-wrist-curls': 'https://static.exercisedb.dev/media/LsZkfU6.gif',
  // farmers-walk removed — was incorrectly mapped to shrug GIF

  // SMITH MACHINE
  'smith-machine-bench-press': 'https://static.exercisedb.dev/media/trqKQv2.gif',
  'smith-machine-incline-press': 'https://static.exercisedb.dev/media/trqKQv2.gif',
  'smith-machine-squat': 'https://static.exercisedb.dev/media/jFtipLl.gif',
  'smith-machine-shoulder-press': 'https://static.exercisedb.dev/media/67n3r98.gif',
  'smith-machine-row': 'https://static.exercisedb.dev/media/ZX9UZmj.gif',
  'smith-machine-lunge': 'https://static.exercisedb.dev/media/jFtipLl.gif',
  'smith-machine-calf-raise': 'https://static.exercisedb.dev/media/jFtipLl.gif',
  'smith-machine-shrug': 'https://static.exercisedb.dev/media/dG7tG5y.gif',
  'smith-machine-upright-row': 'https://static.exercisedb.dev/media/UDlhcO8.gif',
  'smith-machine-hip-thrust': 'https://static.exercisedb.dev/media/qKBpF7I.gif',

  // CABLE
  'cable-crossover': 'https://static.exercisedb.dev/media/0CXGHya.gif',
  'cable-fly-low-to-high': 'https://static.exercisedb.dev/media/FVmZVhk.gif',

  // MACHINES (additional)
  'rdl-machine': 'https://static.exercisedb.dev/media/goJ6ezq.gif',
  'preacher-curl-machine': 'https://static.exercisedb.dev/media/82LxxkW.gif',
  'assisted-pull-up': 'https://static.exercisedb.dev/media/kiJ4Z2K.gif',

  // KETTLEBELL
  'kettlebell-swing': 'https://static.exercisedb.dev/media/UHJlbu3.gif',
  'kettlebell-deadlift': 'https://static.exercisedb.dev/media/Vu5PjpY.gif',
  'kettlebell-goblet-squat': 'https://static.exercisedb.dev/media/ZA8b5hc.gif',
  'kettlebell-rdl': 'https://static.exercisedb.dev/media/goJ6ezq.gif',

  // OLYMPIC LIFTS
  'power-clean': 'https://static.exercisedb.dev/media/SiWCcTN.gif',
  'power-snatch': 'https://static.exercisedb.dev/media/SiWCcTN.gif',
  'clean-and-jerk': 'https://static.exercisedb.dev/media/vzAxBtt.gif',
  'hang-clean': 'https://static.exercisedb.dev/media/SiWCcTN.gif',
  'hang-snatch': 'https://static.exercisedb.dev/media/SiWCcTN.gif',
  'squat-clean': 'https://static.exercisedb.dev/media/SiWCcTN.gif',

  // COMPOUND / FUNCTIONAL
  'dumbbell-curl-to-press': 'https://static.exercisedb.dev/media/W6PxUkg.gif',
  'med-ball-slams': 'https://static.exercisedb.dev/media/RJa4tCo.gif',
  'push-press': 'https://static.exercisedb.dev/media/FS63wTN.gif',
  'battle-ropes': 'https://static.exercisedb.dev/media/RJa4tCo.gif',

  // BODYWEIGHT / WARMUP / MOBILITY
  'bird-dog': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'cat-cow-stretch': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'cat-cow': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'bodyweight-squat': 'https://static.exercisedb.dev/media/BReCuOn.gif',
  'inchworm': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'inchworms': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'high-knees': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'butt-kicks': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'jumping-jacks': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'scapular-push-ups': 'https://static.exercisedb.dev/media/soIB2rj.gif',
  'band-pull-aparts': 'https://static.exercisedb.dev/media/sTfvVsG.gif',
  'banded-pull-aparts': 'https://static.exercisedb.dev/media/sTfvVsG.gif',
  'banded-face-pulls': 'https://static.exercisedb.dev/media/sTfvVsG.gif',
  'glute-bridges': 'https://static.exercisedb.dev/media/qKBpF7I.gif',
  'bird-dogs': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'dead-bugs': 'https://static.exercisedb.dev/media/X6ytgYZ.gif',
  'clamshells': 'https://static.exercisedb.dev/media/qKBpF7I.gif',

  // CARDIO
  'rowing-machine': 'https://static.exercisedb.dev/media/VPPtusI.gif',
  'running': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'cycling': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'stationary-bike': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'elliptical': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'stair-climber': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'stair-master': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'jump-rope': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'burpees': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'box-jumps': 'https://static.exercisedb.dev/media/P9GFBME.gif',
  'sled-push': 'https://static.exercisedb.dev/media/RJa4tCo.gif',
  'assault-bike': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'ski-erg': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'sprints': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
  'rowing': 'https://static.exercisedb.dev/media/VPPtusI.gif',
  'swimming': 'https://static.exercisedb.dev/media/HsjbB1z.gif',
};

/**
 * Get the animation GIF URL for an exercise by ID.
 * Returns undefined if no animation is available.
 */
export function getExerciseAnimationUrl(exerciseId: string): string | undefined {
  return exerciseAnimationMap[exerciseId];
}
