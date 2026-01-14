import { ProgramTemplate } from '@/types';

// Helper to create exercise entries
const ex = (
  id: string, slot: string, exId: string, exName: string, 
  pattern: 'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'core' | 'lunge' | 'rotation',
  sets: number, reps: string, rest: string, injuries: ('shoulder' | 'knee' | 'back' | 'hip' | 'ankle' | 'wrist' | 'neck' | 'none')[] = []
) => ({
  id, slot, defaultExerciseId: exId, defaultExerciseName: exName,
  movementPattern: pattern, sets, reps, rest, injuryFlags: injuries
});

// ============ BASE PROGRAM TEMPLATES ============
export const programTemplates: ProgramTemplate[] = [
  // 1. Full Body – Foundation
  {
    id: 'fb-foundation', name: 'Full Body – Foundation',
    description: 'Balanced full body for beginners. Builds movement quality.',
    phases: ['foundation', 'return'], goals: ['general', 'fat_loss', 'mobility', 'hypertrophy'],
    frequencyOptions: [2, 3], structure: 'full_body', classSafe: true,
    days: [{
      id: 'fb-f-a', dayLabel: 'Day A', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Activation', exercises: [
          ex('1', 'Glute Activation', 'glute-bridge', 'Glute Bridge', 'hinge', 2, '12', '30s'),
          ex('2', 'Core Activation', 'dead-bug', 'Dead Bug', 'core', 2, '8 each', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Main Lifts', exercises: [
          ex('3', 'Squat Pattern', 'goblet-squat', 'Goblet Squat', 'squat', 3, '10-12', '90s', ['knee', 'back']),
          ex('4', 'Horizontal Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('5', 'Horizontal Pull', 'cable-row', 'Cable Row', 'pull', 3, '10-12', '90s'),
        ]},
        { id: 'a1', type: 'work', name: 'Accessory', exercises: [
          ex('6', 'Unilateral Leg', 'split-squat', 'Split Squat', 'lunge', 2, '10 each', '60s', ['knee']),
          ex('7', 'Core Stability', 'plank', 'Plank', 'core', 2, '30s', '45s'),
        ]},
      ]
    }, {
      id: 'fb-f-b', dayLabel: 'Day B', dayNumber: 2,
      blocks: [
        { id: 'w2', type: 'warmup', name: 'Activation', exercises: [
          ex('8', 'Hip Activation', 'clamshell', 'Clamshell', 'hinge', 2, '12 each', '30s'),
          ex('9', 'Shoulder Activation', 'band-pull-apart', 'Band Pull Apart', 'pull', 2, '15', '30s'),
        ]},
        { id: 'm2', type: 'work', name: 'Main Lifts', exercises: [
          ex('10', 'Hinge Pattern', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '10-12', '90s', ['back']),
          ex('11', 'Vertical Push', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('12', 'Vertical Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '90s', ['shoulder']),
        ]},
        { id: 'a2', type: 'work', name: 'Accessory', exercises: [
          ex('13', 'Glute Focus', 'hip-thrust', 'Hip Thrust', 'hinge', 3, '12', '60s'),
          ex('14', 'Core', 'pallof-press', 'Pallof Press', 'core', 2, '10 each', '45s'),
        ]},
      ]
    }]
  },

  // 2. Full Body – Hypertrophy 2x/week
  {
    id: 'fb-hypertrophy-2x', name: 'Full Body – Hypertrophy 2x',
    description: 'Build muscle with just 2 days per week. Perfect for busy schedules.',
    phases: ['foundation'], goals: ['hypertrophy', 'general'],
    frequencyOptions: [2], structure: 'full_body', classSafe: true,
    days: [{
      id: 'fb-h2-a', dayLabel: 'Day A', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Activation', exercises: [
          ex('1', 'Glute Activation', 'glute-bridge', 'Glute Bridge', 'hinge', 2, '12', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Main Lifts', exercises: [
          ex('2', 'Squat Pattern', 'leg-press', 'Leg Press', 'squat', 4, '10-12', '90s', ['knee']),
          ex('3', 'Horizontal Push', 'db-bench-press', 'DB Bench Press', 'push', 4, '10-12', '90s', ['shoulder']),
          ex('4', 'Horizontal Pull', 'cable-row', 'Cable Row', 'pull', 4, '10-12', '90s'),
          ex('5', 'Shoulders', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10-12', '60s', ['shoulder']),
          ex('6', 'Hamstrings', 'leg-curl', 'Leg Curl', 'hinge', 3, '12', '60s'),
        ]},
      ]
    }, {
      id: 'fb-h2-b', dayLabel: 'Day B', dayNumber: 2,
      blocks: [
        { id: 'w2', type: 'warmup', name: 'Activation', exercises: [
          ex('7', 'Shoulder Prep', 'band-pull-apart', 'Band Pull Apart', 'pull', 2, '15', '30s'),
        ]},
        { id: 'm2', type: 'work', name: 'Main Lifts', exercises: [
          ex('8', 'Hinge Pattern', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '10-12', '90s', ['back']),
          ex('9', 'Vertical Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 4, '10-12', '90s', ['shoulder']),
          ex('10', 'Incline Push', 'incline-db-press', 'Incline DB Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('11', 'Quads', 'leg-extension', 'Leg Extension', 'squat', 3, '12-15', '60s', ['knee']),
          ex('12', 'Arms', 'tricep-pushdown', 'Tricep Pushdown', 'push', 3, '12', '60s'),
        ]},
      ]
    }]
  },

  // 3. Full Body – Strength 2x/week
  {
    id: 'fb-strength-2x', name: 'Full Body – Strength 2x',
    description: 'Get stronger with 2 training days. Compound focus.',
    phases: ['foundation', 'strength'], goals: ['strength', 'general'],
    frequencyOptions: [2], structure: 'full_body', classSafe: false,
    days: [{
      id: 'fb-s2-a', dayLabel: 'Day A', dayNumber: 1,
      blocks: [
        { id: 'm1', type: 'work', name: 'Main Lifts', exercises: [
          ex('1', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 4, '8', '120s', ['knee', 'back']),
          ex('2', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 4, '8', '90s', ['shoulder']),
          ex('3', 'Pull', 'cable-row', 'Cable Row', 'pull', 4, '8', '90s'),
          ex('4', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '10', '90s', ['back']),
        ]},
      ]
    }, {
      id: 'fb-s2-b', dayLabel: 'Day B', dayNumber: 2,
      blocks: [
        { id: 'm2', type: 'work', name: 'Main Lifts', exercises: [
          ex('5', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '8', '120s', ['back']),
          ex('6', 'V Push', 'db-shoulder-press', 'DB Shoulder Press', 'push', 4, '8', '90s', ['shoulder']),
          ex('7', 'V Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 4, '8', '90s', ['shoulder']),
          ex('8', 'Legs', 'leg-press', 'Leg Press', 'squat', 3, '10', '90s', ['knee']),
        ]},
      ]
    }]
  },

  // 4. Full Body – Strength
  {
    id: 'fb-strength', name: 'Full Body – Strength',
    description: 'Strength-focused full body with compound movements.',
    phases: ['strength'], goals: ['strength', 'general'],
    frequencyOptions: [3], structure: 'full_body', classSafe: false,
    days: [{
      id: 'fb-s-a', dayLabel: 'Day A - Squat', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Prep', exercises: [
          ex('1', 'Hip Mobility', 'hip-circles', 'Hip Circles', 'squat', 2, '10 each', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('2', 'Primary Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '5', '180s', ['knee', 'back']),
          ex('3', 'Horizontal Push', 'bench-press', 'Bench Press', 'push', 4, '6', '150s', ['shoulder']),
          ex('4', 'Horizontal Pull', 'barbell-row', 'Barbell Row', 'pull', 4, '6', '120s', ['back']),
        ]},
      ]
    }, {
      id: 'fb-s-b', dayLabel: 'Day B - Hinge', dayNumber: 2,
      blocks: [
        { id: 'w2', type: 'warmup', name: 'Prep', exercises: [
          ex('5', 'Hip Hinge', 'cat-cow', 'Cat-Cow', 'hinge', 2, '10', '30s'),
        ]},
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('6', 'Primary Hinge', 'deadlift', 'Deadlift', 'hinge', 4, '5', '180s', ['back']),
          ex('7', 'Vertical Push', 'overhead-press', 'Overhead Press', 'push', 4, '6', '150s', ['shoulder']),
          ex('8', 'Vertical Pull', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '6', '120s', ['shoulder']),
        ]},
      ]
    }, {
      id: 'fb-s-c', dayLabel: 'Day C - Power', dayNumber: 3,
      blocks: [
        { id: 'm3', type: 'work', name: 'Main', exercises: [
          ex('9', 'Squat Var', 'front-squat', 'Front Squat', 'squat', 4, '6', '150s', ['knee', 'back']),
          ex('10', 'Push Var', 'incline-bench-press', 'Incline Bench Press', 'push', 4, '8', '120s', ['shoulder']),
          ex('11', 'Pull Var', 'chest-supported-row', 'Chest Supported Row', 'pull', 4, '8', '90s'),
        ]},
      ]
    }]
  },

  // 3. Full Body A/B
  {
    id: 'fb-ab', name: 'Full Body A/B',
    description: 'Alternating full body. Great for 3x/week.',
    phases: ['foundation', 'strength'], goals: ['general', 'hypertrophy'],
    frequencyOptions: [3], structure: 'full_body', classSafe: true,
    days: [{
      id: 'fb-ab-a', dayLabel: 'Workout A', dayNumber: 1,
      blocks: [
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('1', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 3, '8-10', '120s', ['knee', 'back']),
          ex('2', 'Push', 'bench-press', 'Bench Press', 'push', 3, '8-10', '120s', ['shoulder']),
          ex('3', 'Pull', 'barbell-row', 'Barbell Row', 'pull', 3, '8-10', '90s', ['back']),
          ex('4', 'Hamstring', 'leg-curl', 'Leg Curl', 'hinge', 3, '12', '60s'),
        ]},
      ]
    }, {
      id: 'fb-ab-b', dayLabel: 'Workout B', dayNumber: 2,
      blocks: [
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('5', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '8-10', '120s', ['back']),
          ex('6', 'V Push', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('7', 'V Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '90s', ['shoulder']),
          ex('8', 'Quads', 'leg-extension', 'Leg Extension', 'squat', 3, '12', '60s', ['knee']),
        ]},
      ]
    }]
  },

  // 4. Full Body – Circuit
  {
    id: 'fb-circuit', name: 'Full Body – Circuit',
    description: 'High-intensity circuit for fat loss and conditioning.',
    phases: ['foundation'], goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [2, 3], structure: 'circuit', classSafe: true,
    days: [{
      id: 'fb-c-a', dayLabel: 'Circuit A', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Dynamic', exercises: [
          ex('1', 'Cardio', 'jumping-jacks', 'Jumping Jacks', 'squat', 1, '30', '0s'),
        ]},
        { id: 'm1', type: 'work', name: 'Circuit (3-4 rounds)', exercises: [
          ex('2', 'Lower', 'goblet-squat', 'Goblet Squat', 'squat', 1, '12', '15s', ['knee']),
          ex('3', 'Upper Push', 'push-up', 'Push-up', 'push', 1, '10-12', '15s', ['shoulder', 'wrist']),
          ex('4', 'Hinge', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 1, '15', '15s', ['back']),
          ex('5', 'Upper Pull', 'inverted-row', 'Inverted Row', 'pull', 1, '10', '15s'),
          ex('6', 'Core', 'mountain-climbers', 'Mountain Climbers', 'core', 1, '20', '60s'),
        ]},
      ]
    }]
  },

  // 5. Upper/Lower – Foundation
  {
    id: 'ul-foundation', name: 'Upper/Lower – Foundation',
    description: 'Split training for 3-4 days per week.',
    phases: ['foundation'], goals: ['general'],
    frequencyOptions: [3, 4], structure: 'upper_lower', classSafe: true,
    days: [{
      id: 'ul-f-u', dayLabel: 'Upper Body', dayNumber: 1,
      blocks: [
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('1', 'H Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('2', 'H Pull', 'cable-row', 'Cable Row', 'pull', 3, '10-12', '90s'),
          ex('3', 'V Push', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('4', 'V Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '90s', ['shoulder']),
        ]},
      ]
    }, {
      id: 'ul-f-l', dayLabel: 'Lower Body', dayNumber: 2,
      blocks: [
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('5', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 3, '10-12', '90s', ['knee', 'back']),
          ex('6', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '10-12', '90s', ['back']),
          ex('7', 'Unilateral', 'split-squat', 'Split Squat', 'lunge', 3, '10 each', '60s', ['knee']),
          ex('8', 'Glutes', 'hip-thrust', 'Hip Thrust', 'hinge', 3, '12', '60s'),
        ]},
      ]
    }]
  },

  // 6. Upper/Lower – Strength 2x (for strength phase with 2 days)
  {
    id: 'ul-strength-2x', name: 'Upper/Lower – Strength 2x',
    description: 'Strength-focused 2-day split. Upper one day, lower the next.',
    phases: ['strength', 'foundation'], goals: ['strength', 'hypertrophy', 'general'],
    frequencyOptions: [2], structure: 'upper_lower', classSafe: false,
    days: [{
      id: 'ul-s2-u', dayLabel: 'Upper', dayNumber: 1,
      blocks: [
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('1', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 4, '8-10', '90s', ['shoulder']),
          ex('2', 'Pull', 'cable-row', 'Cable Row', 'pull', 4, '8-10', '90s'),
          ex('3', 'V Push', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10', '90s', ['shoulder']),
          ex('4', 'V Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10', '90s', ['shoulder']),
          ex('5', 'Arms', 'tricep-pushdown', 'Tricep Pushdown', 'push', 2, '12', '60s'),
        ]},
      ]
    }, {
      id: 'ul-s2-l', dayLabel: 'Lower', dayNumber: 2,
      blocks: [
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('6', 'Squat', 'leg-press', 'Leg Press', 'squat', 4, '10', '90s', ['knee']),
          ex('7', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '10', '90s', ['back']),
          ex('8', 'Unilateral', 'split-squat', 'Split Squat', 'lunge', 3, '10 each', '60s', ['knee']),
          ex('9', 'Glutes', 'hip-thrust', 'Hip Thrust', 'hinge', 3, '12', '60s'),
          ex('10', 'Core', 'plank', 'Plank', 'core', 3, '30s', '45s'),
        ]},
      ]
    }]
  },

  // 7. Upper/Lower – Strength
  {
    id: 'ul-strength', name: 'Upper/Lower – Strength',
    description: 'Strength-focused 4-day split.',
    phases: ['strength'], goals: ['strength', 'hypertrophy'],
    frequencyOptions: [4], structure: 'upper_lower', classSafe: false,
    days: [{
      id: 'ul-s-ua', dayLabel: 'Upper A', dayNumber: 1,
      blocks: [
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('1', 'Push', 'bench-press', 'Bench Press', 'push', 4, '5', '180s', ['shoulder']),
          ex('2', 'Pull', 'barbell-row', 'Barbell Row', 'pull', 4, '6', '120s', ['back']),
          ex('3', 'V Push', 'overhead-press', 'Overhead Press', 'push', 3, '8', '120s', ['shoulder']),
        ]},
      ]
    }, {
      id: 'ul-s-la', dayLabel: 'Lower A', dayNumber: 2,
      blocks: [
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('4', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '5', '180s', ['knee', 'back']),
          ex('5', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '8', '120s', ['back']),
          ex('6', 'Uni', 'bulgarian-split-squat', 'Bulgarian Split Squat', 'lunge', 3, '8 each', '90s', ['knee']),
        ]},
      ]
    }, {
      id: 'ul-s-ub', dayLabel: 'Upper B', dayNumber: 3,
      blocks: [
        { id: 'm3', type: 'work', name: 'Main', exercises: [
          ex('7', 'Pull', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '6', '150s', ['shoulder']),
          ex('8', 'Push', 'incline-bench-press', 'Incline Bench Press', 'push', 4, '8', '120s', ['shoulder']),
          ex('9', 'Row', 'chest-supported-row', 'Chest Supported Row', 'pull', 3, '10', '90s'),
        ]},
      ]
    }, {
      id: 'ul-s-lb', dayLabel: 'Lower B', dayNumber: 4,
      blocks: [
        { id: 'm4', type: 'work', name: 'Main', exercises: [
          ex('10', 'Hinge', 'deadlift', 'Deadlift', 'hinge', 4, '5', '180s', ['back']),
          ex('11', 'Squat', 'front-squat', 'Front Squat', 'squat', 3, '6', '120s', ['knee', 'back']),
          ex('12', 'Hip', 'barbell-hip-thrust', 'Barbell Hip Thrust', 'hinge', 3, '10', '90s'),
        ]},
      ]
    }]
  },

  // 7. Upper/Lower – Volume
  {
    id: 'ul-volume', name: 'Upper/Lower – Volume',
    description: 'High volume for hypertrophy.',
    phases: ['strength'], goals: ['hypertrophy'],
    frequencyOptions: [4], structure: 'upper_lower', classSafe: false,
    days: [{
      id: 'ul-v-ua', dayLabel: 'Upper A', dayNumber: 1,
      blocks: [
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('1', 'Chest', 'bench-press', 'Bench Press', 'push', 4, '8-10', '90s', ['shoulder']),
          ex('2', 'Back', 'barbell-row', 'Barbell Row', 'pull', 4, '8-10', '90s', ['back']),
          ex('3', 'Shoulders', 'overhead-press', 'Overhead Press', 'push', 3, '10', '90s', ['shoulder']),
          ex('4', 'Lats', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '60s', ['shoulder']),
          ex('5', 'Chest Iso', 'cable-fly', 'Cable Fly', 'push', 3, '12-15', '60s', ['shoulder']),
        ]},
      ]
    }, {
      id: 'ul-v-la', dayLabel: 'Lower A', dayNumber: 2,
      blocks: [
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('6', 'Quads', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '8-10', '120s', ['knee', 'back']),
          ex('7', 'Hams', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '10-12', '90s', ['back']),
          ex('8', 'Quads', 'leg-press', 'Leg Press', 'squat', 3, '12-15', '90s', ['knee']),
          ex('9', 'Hams', 'leg-curl', 'Leg Curl', 'hinge', 3, '12-15', '60s'),
          ex('10', 'Glutes', 'hip-thrust', 'Hip Thrust', 'hinge', 3, '12', '60s'),
        ]},
      ]
    }, {
      id: 'ul-v-ub', dayLabel: 'Upper B', dayNumber: 3,
      blocks: [
        { id: 'm3', type: 'work', name: 'Main', exercises: [
          ex('11', 'Chest', 'incline-db-press', 'Incline DB Press', 'push', 4, '10-12', '90s', ['shoulder']),
          ex('12', 'Back', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '8-10', '90s', ['shoulder']),
          ex('13', 'Shoulders', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('14', 'Rows', 'cable-row', 'Cable Row', 'pull', 3, '10-12', '60s'),
          ex('15', 'Delts', 'lateral-raise', 'Lateral Raise', 'push', 4, '15', '45s', ['shoulder']),
        ]},
      ]
    }, {
      id: 'ul-v-lb', dayLabel: 'Lower B', dayNumber: 4,
      blocks: [
        { id: 'm4', type: 'work', name: 'Main', exercises: [
          ex('16', 'Hinge', 'deadlift', 'Deadlift', 'hinge', 4, '6-8', '150s', ['back']),
          ex('17', 'Uni', 'walking-lunge', 'Walking Lunge', 'lunge', 3, '10 each', '90s', ['knee']),
          ex('18', 'Quads', 'leg-extension', 'Leg Extension', 'squat', 3, '12-15', '60s', ['knee']),
          ex('19', 'Glutes', 'cable-pull-through', 'Cable Pull Through', 'hinge', 3, '12-15', '60s'),
        ]},
      ]
    }]
  },

  // 8. Upper/Lower – Hybrid (conditioning)
  {
    id: 'ul-hybrid', name: 'Upper/Lower – Hybrid',
    description: 'Upper/lower with conditioning finishers.',
    phases: ['strength'], goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [3, 4], structure: 'upper_lower', classSafe: true,
    days: [{
      id: 'ul-h-u', dayLabel: 'Upper', dayNumber: 1,
      blocks: [
        { id: 'm1', type: 'work', name: 'Strength', exercises: [
          ex('1', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '10', '60s', ['shoulder']),
          ex('2', 'Pull', 'cable-row', 'Cable Row', 'pull', 3, '10', '60s'),
          ex('3', 'Shoulders', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10', '60s', ['shoulder']),
          ex('4', 'Back', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10', '60s', ['shoulder']),
        ]},
        { id: 'f1', type: 'work', name: 'Finisher', exercises: [
          ex('5', 'Cardio', 'battle-ropes', 'Battle Ropes', 'push', 3, '30s', '30s'),
        ]},
      ]
    }, {
      id: 'ul-h-l', dayLabel: 'Lower', dayNumber: 2,
      blocks: [
        { id: 'm2', type: 'work', name: 'Strength', exercises: [
          ex('6', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 3, '10', '60s', ['knee']),
          ex('7', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '10', '60s', ['back']),
          ex('8', 'Uni', 'split-squat', 'Split Squat', 'lunge', 3, '10 each', '60s', ['knee']),
        ]},
        { id: 'f2', type: 'work', name: 'Finisher', exercises: [
          ex('9', 'Cardio', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 4, '15', '30s', ['back']),
        ]},
      ]
    }]
  },

  // 9-11. Push/Pull/Legs
  {
    id: 'ppl-classic', name: 'Push/Pull/Legs – Classic',
    description: 'Classic PPL for intermediate lifters.',
    phases: ['strength'], goals: ['hypertrophy', 'strength'],
    frequencyOptions: [4, 5, 6], structure: 'push_pull_legs', classSafe: false,
    days: [{
      id: 'ppl-push', dayLabel: 'Push', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Main', exercises: [
        ex('1', 'Chest', 'bench-press', 'Bench Press', 'push', 4, '6-8', '120s', ['shoulder']),
        ex('2', 'Shoulders', 'overhead-press', 'Overhead Press', 'push', 3, '8-10', '90s', ['shoulder']),
        ex('3', 'Incline', 'incline-db-press', 'Incline DB Press', 'push', 3, '10-12', '90s', ['shoulder']),
        ex('4', 'Delts', 'lateral-raise', 'Lateral Raise', 'push', 3, '15', '45s', ['shoulder']),
        ex('5', 'Triceps', 'tricep-pushdown', 'Tricep Pushdown', 'push', 3, '12', '60s'),
      ]}]
    }, {
      id: 'ppl-pull', dayLabel: 'Pull', dayNumber: 2,
      blocks: [{ id: 'm2', type: 'work', name: 'Main', exercises: [
        ex('6', 'Back', 'barbell-row', 'Barbell Row', 'pull', 4, '6-8', '120s', ['back']),
        ex('7', 'Lats', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '8-10', '90s', ['shoulder']),
        ex('8', 'Rows', 'cable-row', 'Cable Row', 'pull', 3, '10-12', '90s'),
        ex('9', 'Rear Delts', 'face-pull', 'Face Pull', 'pull', 3, '15', '45s'),
        ex('10', 'Biceps', 'barbell-curl', 'Barbell Curl', 'pull', 3, '10-12', '60s'),
      ]}]
    }, {
      id: 'ppl-legs', dayLabel: 'Legs', dayNumber: 3,
      blocks: [{ id: 'm3', type: 'work', name: 'Main', exercises: [
        ex('11', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '6-8', '150s', ['knee', 'back']),
        ex('12', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '8-10', '120s', ['back']),
        ex('13', 'Quads', 'leg-press', 'Leg Press', 'squat', 3, '10-12', '90s', ['knee']),
        ex('14', 'Hams', 'leg-curl', 'Leg Curl', 'hinge', 3, '12', '60s'),
        ex('15', 'Calves', 'calf-raise', 'Calf Raise', 'squat', 4, '15', '45s'),
      ]}]
    }]
  },

  {
    id: 'ppl-strength', name: 'Push/Pull/Legs – Strength',
    description: 'Strength-focused PPL with lower rep ranges.',
    phases: ['strength', 'performance'], goals: ['strength'],
    frequencyOptions: [4, 5], structure: 'push_pull_legs', classSafe: false,
    days: [{
      id: 'ppl-s-push', dayLabel: 'Push', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Main', exercises: [
        ex('1', 'Chest', 'bench-press', 'Bench Press', 'push', 5, '5', '180s', ['shoulder']),
        ex('2', 'OHP', 'overhead-press', 'Overhead Press', 'push', 4, '5', '150s', ['shoulder']),
        ex('3', 'Incline', 'incline-bench-press', 'Incline Bench Press', 'push', 3, '8', '90s', ['shoulder']),
      ]}]
    }, {
      id: 'ppl-s-pull', dayLabel: 'Pull', dayNumber: 2,
      blocks: [{ id: 'm2', type: 'work', name: 'Main', exercises: [
        ex('4', 'Row', 'barbell-row', 'Barbell Row', 'pull', 5, '5', '150s', ['back']),
        ex('5', 'Pullup', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '5', '150s', ['shoulder']),
        ex('6', 'Row', 'chest-supported-row', 'Chest Supported Row', 'pull', 3, '8', '90s'),
      ]}]
    }, {
      id: 'ppl-s-legs', dayLabel: 'Legs', dayNumber: 3,
      blocks: [{ id: 'm3', type: 'work', name: 'Main', exercises: [
        ex('7', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 5, '5', '180s', ['knee', 'back']),
        ex('8', 'Deadlift', 'deadlift', 'Deadlift', 'hinge', 4, '5', '180s', ['back']),
        ex('9', 'Front Squat', 'front-squat', 'Front Squat', 'squat', 3, '6', '120s', ['knee', 'back']),
      ]}]
    }]
  },

  {
    id: 'ppl-volume', name: 'Push/Pull/Legs – Volume',
    description: 'High volume PPL for max hypertrophy.',
    phases: ['strength'], goals: ['hypertrophy'],
    frequencyOptions: [5, 6], structure: 'push_pull_legs', classSafe: false,
    days: [{
      id: 'ppl-v-push', dayLabel: 'Push', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Main', exercises: [
        ex('1', 'Chest', 'bench-press', 'Bench Press', 'push', 4, '8-10', '90s', ['shoulder']),
        ex('2', 'Incline', 'incline-db-press', 'Incline DB Press', 'push', 4, '10-12', '90s', ['shoulder']),
        ex('3', 'Shoulders', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10-12', '90s', ['shoulder']),
        ex('4', 'Fly', 'cable-fly', 'Cable Fly', 'push', 3, '12-15', '60s', ['shoulder']),
        ex('5', 'Delts', 'lateral-raise', 'Lateral Raise', 'push', 4, '15', '45s', ['shoulder']),
        ex('6', 'Triceps', 'tricep-pushdown', 'Tricep Pushdown', 'push', 4, '12', '60s'),
      ]}]
    }, {
      id: 'ppl-v-pull', dayLabel: 'Pull', dayNumber: 2,
      blocks: [{ id: 'm2', type: 'work', name: 'Main', exercises: [
        ex('7', 'Back', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '8-10', '90s', ['shoulder']),
        ex('8', 'Rows', 'barbell-row', 'Barbell Row', 'pull', 4, '8-10', '90s', ['back']),
        ex('9', 'Lats', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '60s', ['shoulder']),
        ex('10', 'Cable', 'cable-row', 'Cable Row', 'pull', 3, '12', '60s'),
        ex('11', 'Rear', 'face-pull', 'Face Pull', 'pull', 3, '15', '45s'),
        ex('12', 'Biceps', 'barbell-curl', 'Barbell Curl', 'pull', 4, '10-12', '60s'),
      ]}]
    }, {
      id: 'ppl-v-legs', dayLabel: 'Legs', dayNumber: 3,
      blocks: [{ id: 'm3', type: 'work', name: 'Main', exercises: [
        ex('13', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '8-10', '120s', ['knee', 'back']),
        ex('14', 'RDL', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '10-12', '90s', ['back']),
        ex('15', 'Press', 'leg-press', 'Leg Press', 'squat', 4, '12-15', '90s', ['knee']),
        ex('16', 'Curl', 'leg-curl', 'Leg Curl', 'hinge', 3, '12-15', '60s'),
        ex('17', 'Ext', 'leg-extension', 'Leg Extension', 'squat', 3, '15', '60s', ['knee']),
        ex('18', 'Calf', 'calf-raise', 'Calf Raise', 'squat', 5, '15', '45s'),
      ]}]
    }]
  },

  // 12. Bro Split
  {
    id: 'bro-split', name: 'Bro Split – Bodybuilding',
    description: 'Classic bodybuilding split hitting each muscle once per week.',
    phases: ['strength'], goals: ['hypertrophy'],
    frequencyOptions: [4, 5], structure: 'split', classSafe: false,
    days: [{
      id: 'bro-chest', dayLabel: 'Chest', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Chest', exercises: [
        ex('1', 'Flat', 'bench-press', 'Bench Press', 'push', 4, '8-10', '90s', ['shoulder']),
        ex('2', 'Incline', 'incline-db-press', 'Incline DB Press', 'push', 4, '10-12', '90s', ['shoulder']),
        ex('3', 'Fly', 'cable-fly', 'Cable Fly', 'push', 3, '12-15', '60s', ['shoulder']),
        ex('4', 'Dips', 'dips', 'Dips', 'push', 3, '10-12', '60s', ['shoulder']),
      ]}]
    }, {
      id: 'bro-back', dayLabel: 'Back', dayNumber: 2,
      blocks: [{ id: 'm2', type: 'work', name: 'Back', exercises: [
        ex('5', 'Pullups', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '8-10', '90s', ['shoulder']),
        ex('6', 'Row', 'barbell-row', 'Barbell Row', 'pull', 4, '8-10', '90s', ['back']),
        ex('7', 'Pulldown', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '60s', ['shoulder']),
        ex('8', 'Cable Row', 'cable-row', 'Cable Row', 'pull', 3, '12', '60s'),
      ]}]
    }, {
      id: 'bro-shoulders', dayLabel: 'Shoulders', dayNumber: 3,
      blocks: [{ id: 'm3', type: 'work', name: 'Shoulders', exercises: [
        ex('9', 'Press', 'overhead-press', 'Overhead Press', 'push', 4, '8-10', '90s', ['shoulder']),
        ex('10', 'Lateral', 'lateral-raise', 'Lateral Raise', 'push', 4, '15', '45s', ['shoulder']),
        ex('11', 'Rear', 'face-pull', 'Face Pull', 'pull', 3, '15', '45s'),
        ex('12', 'Shrugs', 'dumbbell-shrug', 'Dumbbell Shrug', 'pull', 3, '12', '60s'),
      ]}]
    }, {
      id: 'bro-legs', dayLabel: 'Legs', dayNumber: 4,
      blocks: [{ id: 'm4', type: 'work', name: 'Legs', exercises: [
        ex('13', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '8-10', '120s', ['knee', 'back']),
        ex('14', 'RDL', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '10-12', '90s', ['back']),
        ex('15', 'Press', 'leg-press', 'Leg Press', 'squat', 3, '12-15', '90s', ['knee']),
        ex('16', 'Curl', 'leg-curl', 'Leg Curl', 'hinge', 3, '12', '60s'),
        ex('17', 'Ext', 'leg-extension', 'Leg Extension', 'squat', 3, '15', '60s', ['knee']),
      ]}]
    }, {
      id: 'bro-arms', dayLabel: 'Arms', dayNumber: 5,
      blocks: [{ id: 'm5', type: 'work', name: 'Arms', exercises: [
        ex('18', 'Biceps', 'barbell-curl', 'Barbell Curl', 'pull', 4, '10-12', '60s'),
        ex('19', 'Triceps', 'skull-crusher', 'Skull Crusher', 'push', 4, '10-12', '60s'),
        ex('20', 'Hammer', 'hammer-curl', 'Hammer Curl', 'pull', 3, '12', '60s'),
        ex('21', 'Pushdown', 'tricep-pushdown', 'Tricep Pushdown', 'push', 3, '12', '60s'),
      ]}]
    }]
  },

  // 13-15. Circuit Templates
  {
    id: 'circuit-hiit', name: 'Circuit – HIIT Style',
    description: 'High-intensity interval circuits for conditioning.',
    phases: ['foundation'], goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [2, 3], structure: 'circuit', classSafe: true,
    days: [{
      id: 'hiit-a', dayLabel: 'HIIT A', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Warmup', exercises: [
          ex('1', 'Cardio', 'jumping-jacks', 'Jumping Jacks', 'squat', 1, '30', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Circuit (4 rounds)', exercises: [
          ex('2', 'Lower', 'jump-squat', 'Jump Squat', 'squat', 1, '12', '10s', ['knee']),
          ex('3', 'Push', 'push-up', 'Push-up', 'push', 1, '12', '10s', ['shoulder', 'wrist']),
          ex('4', 'Core', 'burpee', 'Burpee', 'core', 1, '8', '10s', ['wrist']),
          ex('5', 'Lower', 'lunge-jump', 'Lunge Jump', 'lunge', 1, '10 each', '10s', ['knee']),
          ex('6', 'Core', 'mountain-climbers', 'Mountain Climbers', 'core', 1, '20', '60s'),
        ]},
      ]
    }]
  },

  {
    id: 'circuit-strength', name: 'Circuit – Strength',
    description: 'Strength-based circuit with heavier loads.',
    phases: ['foundation', 'strength'], goals: ['fat_loss', 'strength'],
    frequencyOptions: [3], structure: 'circuit', classSafe: true,
    days: [{
      id: 'str-circ', dayLabel: 'Strength Circuit', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Circuit (3 rounds)', exercises: [
        ex('1', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 1, '10', '30s', ['knee']),
        ex('2', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 1, '10', '30s', ['shoulder']),
        ex('3', 'Hinge', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 1, '15', '30s', ['back']),
        ex('4', 'Pull', 'cable-row', 'Cable Row', 'pull', 1, '10', '30s'),
        ex('5', 'Core', 'plank', 'Plank', 'core', 1, '30s', '60s'),
      ]}]
    }]
  },

  {
    id: 'circuit-low-impact', name: 'Circuit – Low Impact',
    description: 'Joint-friendly circuit for return-to-training.',
    phases: ['return'], goals: ['conditioning', 'mobility'],
    frequencyOptions: [2, 3], structure: 'circuit', classSafe: true,
    days: [{
      id: 'low-circ', dayLabel: 'Low Impact', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Circuit (3 rounds)', exercises: [
        ex('1', 'Squat', 'bodyweight-squat', 'Bodyweight Squat', 'squat', 1, '12', '20s'),
        ex('2', 'Push', 'wall-push-up', 'Wall Push-up', 'push', 1, '12', '20s'),
        ex('3', 'Hinge', 'glute-bridge', 'Glute Bridge', 'hinge', 1, '15', '20s'),
        ex('4', 'Pull', 'band-row', 'Band Row', 'pull', 1, '12', '20s'),
        ex('5', 'Core', 'dead-bug', 'Dead Bug', 'core', 1, '10 each', '45s'),
      ]}]
    }]
  },

  // 16-17. Return to Training
  {
    id: 'return-mobility', name: 'Return to Training – Mobility',
    description: 'Mobility-focused program for those returning from injury or break.',
    phases: ['return'], goals: ['mobility', 'general'],
    frequencyOptions: [2, 3], structure: 'full_body', classSafe: true,
    days: [{
      id: 'ret-mob', dayLabel: 'Mobility Day', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Dynamic Mobility', exercises: [
          ex('1', 'Hip', 'hip-circles', 'Hip Circles', 'squat', 2, '10 each', '30s'),
          ex('2', 'Spine', 'cat-cow', 'Cat-Cow', 'hinge', 2, '10', '30s'),
          ex('3', 'Shoulders', 'arm-circles', 'Arm Circles', 'push', 2, '10 each', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Movement', exercises: [
          ex('4', 'Squat', 'bodyweight-squat', 'Bodyweight Squat', 'squat', 2, '10', '60s'),
          ex('5', 'Hinge', 'glute-bridge', 'Glute Bridge', 'hinge', 2, '12', '60s'),
          ex('6', 'Push', 'wall-push-up', 'Wall Push-up', 'push', 2, '10', '60s'),
        ]},
        { id: 'c1', type: 'cooldown', name: 'Stretch', exercises: [
          ex('7', 'Hip Flexor', 'hip-flexor-stretch', 'Hip Flexor Stretch', 'hinge', 1, '60s each', '-'),
          ex('8', 'Chest', 'doorway-stretch', 'Doorway Stretch', 'push', 1, '60s', '-'),
        ]},
      ]
    }]
  },

  {
    id: 'return-stability', name: 'Return to Training – Stability',
    description: 'Stability and control-focused for building a solid base.',
    phases: ['return'], goals: ['mobility', 'general'],
    frequencyOptions: [2, 3], structure: 'full_body', classSafe: true,
    days: [{
      id: 'ret-stab', dayLabel: 'Stability Day', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Activation', exercises: [
          ex('1', 'Core', 'dead-bug', 'Dead Bug', 'core', 2, '8 each', '30s'),
          ex('2', 'Glutes', 'clamshell', 'Clamshell', 'hinge', 2, '12 each', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Stability Work', exercises: [
          ex('3', 'Core', 'bird-dog', 'Bird Dog', 'core', 3, '8 each', '45s'),
          ex('4', 'Glutes', 'glute-bridge', 'Glute Bridge', 'hinge', 3, '12', '45s'),
          ex('5', 'Balance', 'single-leg-stand', 'Single Leg Stand', 'squat', 2, '30s each', '30s'),
          ex('6', 'Core', 'plank', 'Plank', 'core', 3, '20-30s', '45s'),
        ]},
      ]
    }]
  },

  // 18. Performance
  {
    id: 'performance-power', name: 'Performance – Power Prep',
    description: 'Power development program for athletic performance.',
    phases: ['performance'], goals: ['strength', 'conditioning', 'athletic_performance'],
    frequencyOptions: [4], structure: 'upper_lower', classSafe: false,
    days: [{
      id: 'perf-upper', dayLabel: 'Upper Power', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Power & Strength', exercises: [
        ex('1', 'Power Push', 'medicine-ball-chest-pass', 'Med Ball Chest Pass', 'push', 3, '8', '90s'),
        ex('2', 'Strength', 'bench-press', 'Bench Press', 'push', 4, '5', '150s', ['shoulder']),
        ex('3', 'Power Pull', 'medicine-ball-slam', 'Med Ball Slam', 'pull', 3, '8', '90s'),
        ex('4', 'Strength', 'barbell-row', 'Barbell Row', 'pull', 4, '6', '120s', ['back']),
      ]}]
    }, {
      id: 'perf-lower', dayLabel: 'Lower Power', dayNumber: 2,
      blocks: [{ id: 'm2', type: 'work', name: 'Power & Strength', exercises: [
        ex('5', 'Power', 'box-jump', 'Box Jump', 'squat', 3, '5', '90s', ['knee']),
        ex('6', 'Strength', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '5', '180s', ['knee', 'back']),
        ex('7', 'Power Hinge', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 3, '10', '90s', ['back']),
        ex('8', 'Strength', 'deadlift', 'Deadlift', 'hinge', 4, '5', '180s', ['back']),
      ]}]
    }]
  },

  // 19-20. Class Prep
  {
    id: 'class-prep-safe', name: 'Class Prep – Group Safe',
    description: 'Preparation for group fitness with class-safe movements.',
    phases: ['foundation'], goals: ['general', 'conditioning'],
    frequencyOptions: [2, 3], structure: 'full_body', classSafe: true,
    days: [{
      id: 'class-a', dayLabel: 'Class Prep A', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Main', exercises: [
        ex('1', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 3, '12', '60s', ['knee']),
        ex('2', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '12', '60s', ['shoulder']),
        ex('3', 'Pull', 'cable-row', 'Cable Row', 'pull', 3, '12', '60s'),
        ex('4', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '12', '60s', ['back']),
        ex('5', 'Core', 'plank', 'Plank', 'core', 3, '30s', '45s'),
      ]}]
    }]
  },

  {
    id: 'class-conditioning', name: 'Class Prep – Conditioning',
    description: 'Conditioning-focused program to prepare for group classes.',
    phases: ['foundation'], goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [3], structure: 'circuit', classSafe: true,
    days: [{
      id: 'class-cond', dayLabel: 'Conditioning', dayNumber: 1,
      blocks: [{ id: 'm1', type: 'work', name: 'Circuit', exercises: [
        ex('1', 'Squat', 'bodyweight-squat', 'Bodyweight Squat', 'squat', 1, '15', '15s'),
        ex('2', 'Push', 'push-up', 'Push-up', 'push', 1, '10', '15s', ['shoulder', 'wrist']),
        ex('3', 'Hinge', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 1, '15', '15s', ['back']),
        ex('4', 'Pull', 'inverted-row', 'Inverted Row', 'pull', 1, '10', '15s'),
        ex('5', 'Core', 'mountain-climbers', 'Mountain Climbers', 'core', 1, '20', '60s'),
      ]}]
    }]
  },

  // ============ 5-DAY TEMPLATES ============

  // 5-Day Foundation (Higher reps, movement quality focus)
  {
    id: 'foundation-5day', name: 'Foundation – 5 Day Hypertrophy',
    description: 'Beginner-friendly 5-day split. Higher rep ranges (10-15) for muscle building and movement quality.',
    phases: ['foundation'], goals: ['hypertrophy', 'general', 'fat_loss'],
    frequencyOptions: [5], structure: 'upper_lower', classSafe: true,
    days: [
      { id: 'f5-upper1', dayLabel: 'Upper A', dayNumber: 1, blocks: [
        { id: 'w1', type: 'warmup', name: 'Activation', exercises: [
          ex('1', 'Shoulder Prep', 'band-pull-apart', 'Band Pull Apart', 'pull', 2, '15', '30s'),
          ex('2', 'Core Activation', 'dead-bug', 'Dead Bug', 'core', 2, '8 each', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('3', 'Horizontal Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '12-15', '90s', ['shoulder']),
          ex('4', 'Horizontal Pull', 'cable-row', 'Cable Row', 'pull', 3, '12-15', '90s'),
          ex('5', 'Vertical Push', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '12-15', '90s', ['shoulder']),
          ex('6', 'Vertical Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '12-15', '90s'),
        ]},
        { id: 'a1', type: 'work', name: 'Accessory', exercises: [
          ex('7', 'Biceps', 'db-curl', 'DB Curl', 'pull', 2, '12-15', '60s'),
          ex('8', 'Triceps', 'tricep-pushdown', 'Tricep Pushdown', 'push', 2, '12-15', '60s'),
        ]}
      ]},
      { id: 'f5-lower1', dayLabel: 'Lower A', dayNumber: 2, blocks: [
        { id: 'w2', type: 'warmup', name: 'Activation', exercises: [
          ex('9', 'Hip Activation', 'glute-bridge', 'Glute Bridge', 'hinge', 2, '12', '30s'),
          ex('10', 'Hip Mobility', 'hip-circles', 'Hip Circles', 'squat', 2, '10 each', '30s'),
        ]},
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('11', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 3, '12-15', '90s', ['knee']),
          ex('12', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '12-15', '90s', ['back']),
          ex('13', 'Unilateral', 'split-squat', 'Split Squat', 'lunge', 3, '10-12 each', '90s', ['knee']),
        ]},
        { id: 'a2', type: 'work', name: 'Accessory', exercises: [
          ex('14', 'Hamstring', 'leg-curl', 'Leg Curl', 'hinge', 3, '12-15', '60s'),
          ex('15', 'Calves', 'calf-raise', 'Calf Raise', 'squat', 3, '15-20', '60s'),
        ]}
      ]},
      { id: 'f5-upper2', dayLabel: 'Upper B', dayNumber: 3, blocks: [
        { id: 'w3', type: 'warmup', name: 'Activation', exercises: [
          ex('16', 'Shoulder Mobility', 'arm-circles', 'Arm Circles', 'push', 2, '10 each', '30s'),
        ]},
        { id: 'm3', type: 'work', name: 'Main', exercises: [
          ex('17', 'Incline Push', 'incline-db-press', 'Incline DB Press', 'push', 3, '12-15', '90s', ['shoulder']),
          ex('18', 'Row', 'db-row', 'DB Row', 'pull', 3, '12-15 each', '90s'),
          ex('19', 'Lateral Raise', 'lateral-raise', 'Lateral Raise', 'push', 3, '15', '60s', ['shoulder']),
          ex('20', 'Face Pull', 'face-pull', 'Face Pull', 'pull', 3, '15', '60s'),
        ]},
        { id: 'a3', type: 'work', name: 'Accessory', exercises: [
          ex('21', 'Hammer Curl', 'hammer-curl', 'Hammer Curl', 'pull', 2, '12-15', '60s'),
          ex('22', 'Overhead Tricep', 'overhead-tricep-ext', 'Overhead Tricep Extension', 'push', 2, '12-15', '60s'),
        ]}
      ]},
      { id: 'f5-lower2', dayLabel: 'Lower B', dayNumber: 4, blocks: [
        { id: 'w4', type: 'warmup', name: 'Activation', exercises: [
          ex('23', 'Glute Activation', 'clamshell', 'Clamshell', 'hinge', 2, '12 each', '30s'),
        ]},
        { id: 'm4', type: 'work', name: 'Main', exercises: [
          ex('24', 'Hinge', 'db-rdl', 'DB Romanian Deadlift', 'hinge', 3, '12-15', '90s', ['back']),
          ex('25', 'Squat Var', 'leg-press', 'Leg Press', 'squat', 3, '12-15', '90s', ['knee']),
          ex('26', 'Hip Thrust', 'hip-thrust', 'Hip Thrust', 'hinge', 3, '12-15', '90s'),
        ]},
        { id: 'a4', type: 'work', name: 'Accessory', exercises: [
          ex('27', 'Leg Extension', 'leg-extension', 'Leg Extension', 'squat', 3, '15', '60s', ['knee']),
          ex('28', 'Core', 'plank', 'Plank', 'core', 3, '30-45s', '45s'),
        ]}
      ]},
      { id: 'f5-full', dayLabel: 'Full Body', dayNumber: 5, blocks: [
        { id: 'w5', type: 'warmup', name: 'Activation', exercises: [
          ex('29', 'Full Body Warm-up', 'jumping-jacks', 'Jumping Jacks', 'core', 2, '20', '30s'),
        ]},
        { id: 'm5', type: 'work', name: 'Full Body Circuit', exercises: [
          ex('30', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 3, '12', '60s', ['knee']),
          ex('31', 'Push', 'push-up', 'Push-up', 'push', 3, '10-15', '60s', ['shoulder', 'wrist']),
          ex('32', 'Pull', 'cable-row', 'Cable Row', 'pull', 3, '12', '60s'),
          ex('33', 'Hinge', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 3, '15', '60s', ['back']),
          ex('34', 'Core', 'bird-dog', 'Bird Dog', 'core', 3, '10 each', '45s'),
        ]}
      ]}
    ]
  },

  // 5-Day Upper/Lower + Full Body
  {
    id: 'ul-5day', name: 'Upper/Lower Split – 5 Day',
    description: 'Classic upper/lower split with extra full body day. Great for hypertrophy.',
    phases: ['strength'], goals: ['hypertrophy', 'strength', 'general'],
    frequencyOptions: [5], structure: 'upper_lower', classSafe: false,
    days: [
      { id: 'ul5-upper1', dayLabel: 'Upper A', dayNumber: 1, blocks: [
        { id: 'w1', type: 'warmup', name: 'Activation', exercises: [
          ex('1', 'Shoulder Prep', 'band-pull-apart', 'Band Pull Apart', 'pull', 2, '15', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Main', exercises: [
          ex('2', 'Horizontal Push', 'bench-press', 'Bench Press', 'push', 4, '6-8', '120s', ['shoulder']),
          ex('3', 'Horizontal Pull', 'barbell-row', 'Barbell Row', 'pull', 4, '6-8', '120s', ['back']),
          ex('4', 'Vertical Push', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '8-10', '90s', ['shoulder']),
          ex('5', 'Vertical Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '8-10', '90s'),
          ex('6', 'Biceps', 'barbell-curl', 'Barbell Curl', 'pull', 3, '10-12', '60s'),
          ex('7', 'Triceps', 'tricep-pushdown', 'Tricep Pushdown', 'push', 3, '10-12', '60s'),
        ]}
      ]},
      { id: 'ul5-lower1', dayLabel: 'Lower A', dayNumber: 2, blocks: [
        { id: 'w2', type: 'warmup', name: 'Activation', exercises: [
          ex('8', 'Hip Activation', 'glute-bridge', 'Glute Bridge', 'hinge', 2, '12', '30s'),
        ]},
        { id: 'm2', type: 'work', name: 'Main', exercises: [
          ex('9', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '6-8', '150s', ['knee', 'back']),
          ex('10', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '8-10', '120s', ['back']),
          ex('11', 'Unilateral', 'bulgarian-split-squat', 'Bulgarian Split Squat', 'lunge', 3, '10 each', '90s', ['knee']),
          ex('12', 'Hamstring', 'leg-curl', 'Leg Curl', 'hinge', 3, '10-12', '60s'),
          ex('13', 'Calves', 'calf-raise', 'Calf Raise', 'squat', 3, '12-15', '60s'),
        ]}
      ]},
      { id: 'ul5-upper2', dayLabel: 'Upper B', dayNumber: 3, blocks: [
        { id: 'm3', type: 'work', name: 'Main', exercises: [
          ex('14', 'Vertical Pull', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '6-8', '120s', ['shoulder']),
          ex('15', 'Incline Push', 'incline-bench-press', 'Incline Bench Press', 'push', 4, '8-10', '90s', ['shoulder']),
          ex('16', 'Cable Row', 'cable-row', 'Cable Row', 'pull', 3, '10-12', '90s'),
          ex('17', 'Lateral Raise', 'lateral-raise', 'Lateral Raise', 'push', 3, '12-15', '60s', ['shoulder']),
          ex('18', 'Face Pull', 'face-pull', 'Face Pull', 'pull', 3, '12-15', '60s'),
        ]}
      ]},
      { id: 'ul5-lower2', dayLabel: 'Lower B', dayNumber: 4, blocks: [
        { id: 'm4', type: 'work', name: 'Main', exercises: [
          ex('19', 'Hinge', 'deadlift', 'Deadlift', 'hinge', 4, '5', '180s', ['back']),
          ex('20', 'Squat Var', 'front-squat', 'Front Squat', 'squat', 3, '8-10', '120s', ['knee', 'back']),
          ex('21', 'Hip Thrust', 'hip-thrust', 'Hip Thrust', 'hinge', 3, '10-12', '90s'),
          ex('22', 'Leg Extension', 'leg-extension', 'Leg Extension', 'squat', 3, '12-15', '60s', ['knee']),
          ex('23', 'Core', 'hanging-leg-raise', 'Hanging Leg Raise', 'core', 3, '10-12', '60s'),
        ]}
      ]},
      { id: 'ul5-full', dayLabel: 'Full Body', dayNumber: 5, blocks: [
        { id: 'm5', type: 'work', name: 'Full Body Circuit', exercises: [
          ex('24', 'Squat', 'goblet-squat', 'Goblet Squat', 'squat', 3, '10', '60s', ['knee']),
          ex('25', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '10', '60s', ['shoulder']),
          ex('26', 'Pull', 'cable-row', 'Cable Row', 'pull', 3, '10', '60s'),
          ex('27', 'Hinge', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 3, '15', '60s', ['back']),
          ex('28', 'Core', 'plank', 'Plank', 'core', 3, '45s', '45s'),
        ]}
      ]}
    ]
  },

  // 5-Day Bro Split (Hypertrophy focused)
  {
    id: 'bro-5day', name: 'Bro Split – 5 Day Hypertrophy',
    description: 'Classic bodybuilding split. One muscle group per day for maximum volume.',
    phases: ['strength'], goals: ['hypertrophy'],
    frequencyOptions: [5], structure: 'split', classSafe: false,
    days: [
      { id: 'bro-chest', dayLabel: 'Chest', dayNumber: 1, blocks: [
        { id: 'm1', type: 'work', name: 'Chest', exercises: [
          ex('1', 'Flat Press', 'bench-press', 'Bench Press', 'push', 4, '6-8', '120s', ['shoulder']),
          ex('2', 'Incline Press', 'incline-db-press', 'Incline DB Press', 'push', 4, '8-10', '90s', ['shoulder']),
          ex('3', 'Cable Fly', 'cable-fly', 'Cable Fly', 'push', 3, '10-12', '60s', ['shoulder']),
          ex('4', 'Dips', 'dips', 'Dips', 'push', 3, '8-12', '90s', ['shoulder']),
        ]}
      ]},
      { id: 'bro-back', dayLabel: 'Back', dayNumber: 2, blocks: [
        { id: 'm2', type: 'work', name: 'Back', exercises: [
          ex('5', 'Pull-ups', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '6-8', '120s', ['shoulder']),
          ex('6', 'Row', 'barbell-row', 'Barbell Row', 'pull', 4, '8-10', '90s', ['back']),
          ex('7', 'Lat Pulldown', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '60s'),
          ex('8', 'Cable Row', 'cable-row', 'Seated Cable Row', 'pull', 3, '10-12', '60s'),
          ex('9', 'Face Pull', 'face-pull', 'Face Pull', 'pull', 3, '15', '45s'),
        ]}
      ]},
      { id: 'bro-shoulders', dayLabel: 'Shoulders', dayNumber: 3, blocks: [
        { id: 'm3', type: 'work', name: 'Shoulders', exercises: [
          ex('10', 'OHP', 'overhead-press', 'Overhead Press', 'push', 4, '6-8', '120s', ['shoulder']),
          ex('11', 'Lateral Raise', 'lateral-raise', 'Lateral Raise', 'push', 4, '12-15', '60s', ['shoulder']),
          ex('12', 'Rear Delt', 'rear-delt-fly', 'Rear Delt Fly', 'pull', 3, '12-15', '60s'),
          ex('13', 'Upright Row', 'upright-row', 'Upright Row', 'pull', 3, '10-12', '60s', ['shoulder']),
        ]}
      ]},
      { id: 'bro-legs', dayLabel: 'Legs', dayNumber: 4, blocks: [
        { id: 'm4', type: 'work', name: 'Legs', exercises: [
          ex('14', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '6-8', '150s', ['knee', 'back']),
          ex('15', 'RDL', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 4, '8-10', '120s', ['back']),
          ex('16', 'Leg Press', 'leg-press', 'Leg Press', 'squat', 3, '10-12', '90s', ['knee']),
          ex('17', 'Leg Curl', 'leg-curl', 'Leg Curl', 'hinge', 3, '10-12', '60s'),
          ex('18', 'Calf Raise', 'calf-raise', 'Calf Raise', 'squat', 4, '12-15', '60s'),
        ]}
      ]},
      { id: 'bro-arms', dayLabel: 'Arms', dayNumber: 5, blocks: [
        { id: 'm5', type: 'work', name: 'Arms', exercises: [
          ex('19', 'Barbell Curl', 'barbell-curl', 'Barbell Curl', 'pull', 4, '8-10', '90s'),
          ex('20', 'Skull Crusher', 'skull-crusher', 'Skull Crusher', 'push', 4, '8-10', '90s'),
          ex('21', 'Hammer Curl', 'hammer-curl', 'Hammer Curl', 'pull', 3, '10-12', '60s'),
          ex('22', 'Tricep Pushdown', 'tricep-pushdown', 'Tricep Pushdown', 'push', 3, '10-12', '60s'),
          ex('23', 'Preacher Curl', 'preacher-curl', 'Preacher Curl', 'pull', 3, '12-15', '60s'),
        ]}
      ]}
    ]
  },

  // 5-Day Push/Pull/Legs + Upper/Lower hybrid
  {
    id: 'ppl-hybrid-5', name: 'PPL Hybrid – 5 Day',
    description: 'Push/Pull/Legs combined with Upper/Lower. Balanced frequency.',
    phases: ['strength', 'foundation'], goals: ['hypertrophy', 'strength', 'general'],
    frequencyOptions: [5], structure: 'push_pull_legs', classSafe: false,
    days: [
      { id: 'ppl5-push', dayLabel: 'Push', dayNumber: 1, blocks: [
        { id: 'm1', type: 'work', name: 'Push', exercises: [
          ex('1', 'Bench', 'bench-press', 'Bench Press', 'push', 4, '6-8', '120s', ['shoulder']),
          ex('2', 'OHP', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '8-10', '90s', ['shoulder']),
          ex('3', 'Incline', 'incline-db-press', 'Incline DB Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('4', 'Lateral', 'lateral-raise', 'Lateral Raise', 'push', 3, '12-15', '60s'),
          ex('5', 'Triceps', 'tricep-pushdown', 'Tricep Pushdown', 'push', 3, '12-15', '60s'),
        ]}
      ]},
      { id: 'ppl5-pull', dayLabel: 'Pull', dayNumber: 2, blocks: [
        { id: 'm2', type: 'work', name: 'Pull', exercises: [
          ex('6', 'Pull-up', 'weighted-pull-up', 'Weighted Pull-up', 'pull', 4, '6-8', '120s', ['shoulder']),
          ex('7', 'Row', 'barbell-row', 'Barbell Row', 'pull', 4, '8-10', '90s', ['back']),
          ex('8', 'Lat Pulldown', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '90s'),
          ex('9', 'Face Pull', 'face-pull', 'Face Pull', 'pull', 3, '15', '60s'),
          ex('10', 'Biceps', 'barbell-curl', 'Barbell Curl', 'pull', 3, '10-12', '60s'),
        ]}
      ]},
      { id: 'ppl5-legs', dayLabel: 'Legs', dayNumber: 3, blocks: [
        { id: 'm3', type: 'work', name: 'Legs', exercises: [
          ex('11', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '6-8', '150s', ['knee', 'back']),
          ex('12', 'RDL', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '8-10', '120s', ['back']),
          ex('13', 'Leg Press', 'leg-press', 'Leg Press', 'squat', 3, '10-12', '90s', ['knee']),
          ex('14', 'Leg Curl', 'leg-curl', 'Leg Curl', 'hinge', 3, '10-12', '60s'),
          ex('15', 'Calf', 'calf-raise', 'Calf Raise', 'squat', 3, '15', '60s'),
        ]}
      ]},
      { id: 'ppl5-upper', dayLabel: 'Upper', dayNumber: 4, blocks: [
        { id: 'm4', type: 'work', name: 'Upper', exercises: [
          ex('16', 'Incline Bench', 'incline-bench-press', 'Incline Bench Press', 'push', 3, '8-10', '90s', ['shoulder']),
          ex('17', 'Cable Row', 'cable-row', 'Cable Row', 'pull', 3, '10-12', '90s'),
          ex('18', 'DB Press', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10-12', '90s', ['shoulder']),
          ex('19', 'Lat Pulldown', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '10-12', '90s'),
          ex('20', 'Face Pull', 'face-pull', 'Face Pull', 'pull', 3, '15', '60s'),
        ]}
      ]},
      { id: 'ppl5-lower', dayLabel: 'Lower', dayNumber: 5, blocks: [
        { id: 'm5', type: 'work', name: 'Lower', exercises: [
          ex('21', 'Deadlift', 'deadlift', 'Deadlift', 'hinge', 4, '5', '180s', ['back']),
          ex('22', 'Split Squat', 'bulgarian-split-squat', 'Bulgarian Split Squat', 'lunge', 3, '10 each', '90s', ['knee']),
          ex('23', 'Hip Thrust', 'hip-thrust', 'Hip Thrust', 'hinge', 3, '10-12', '90s'),
          ex('24', 'Leg Extension', 'leg-extension', 'Leg Extension', 'squat', 3, '12-15', '60s', ['knee']),
          ex('25', 'Core', 'plank', 'Plank', 'core', 3, '45s', '45s'),
        ]}
      ]}
    ]
  },

  // ============ 1X/WEEK TEMPLATES ============
  // For busy clients, maintenance, rehab, PT-only weekly sessions

  // 1x/week - Full Body Maintenance
  {
    id: '1x-maintenance', name: '1x/Week – Maintenance',
    description: 'Single weekly session to maintain strength and mobility. Perfect for busy clients or maintenance phases.',
    phases: ['foundation', 'return'], goals: ['general', 'mobility'],
    frequencyOptions: [1], structure: 'full_body', classSafe: true,
    days: [{
      id: '1x-m-a', dayLabel: 'Full Body', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Activation', exercises: [
          ex('1', 'Hip Activation', 'glute-bridge', 'Glute Bridge', 'hinge', 2, '12', '30s'),
          ex('2', 'Core Prep', 'dead-bug', 'Dead Bug', 'core', 2, '8 each', '30s'),
          ex('3', 'Shoulder Prep', 'band-pull-apart', 'Band Pull Apart', 'pull', 2, '15', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Main Lifts', exercises: [
          ex('4', 'Squat Pattern', 'goblet-squat', 'Goblet Squat', 'squat', 3, '10', '90s', ['knee']),
          ex('5', 'Hinge Pattern', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '10', '90s', ['back']),
          ex('6', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '10', '90s', ['shoulder']),
          ex('7', 'Pull', 'cable-row', 'Cable Row', 'pull', 3, '10', '90s'),
        ]},
        { id: 'a1', type: 'work', name: 'Accessory', exercises: [
          ex('8', 'Lunge', 'walking-lunge', 'Walking Lunge', 'lunge', 2, '10 each', '60s', ['knee']),
          ex('9', 'Core', 'plank', 'Plank', 'core', 2, '30s', '45s'),
        ]},
        { id: 'c1', type: 'cooldown', name: 'Cooldown', exercises: [
          ex('10', 'Mobility', 'hip-circles', 'Hip Circles', 'rotation', 1, '10 each', '0s'),
        ]},
      ]
    }]
  },

  // 1x/week - PT Strength Session
  {
    id: '1x-pt-strength', name: '1x/Week – PT Strength',
    description: 'Intensive PT-led strength session. Coach-heavy, technique focus.',
    phases: ['strength'], goals: ['strength', 'general'],
    frequencyOptions: [1], structure: 'full_body', classSafe: false,
    days: [{
      id: '1x-s-a', dayLabel: 'Strength Day', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Movement Prep', exercises: [
          ex('1', 'Hip Hinge', 'kettlebell-swing', 'Kettlebell Swing', 'hinge', 2, '10', '30s'),
          ex('2', 'Core Brace', 'dead-bug', 'Dead Bug', 'core', 2, '8 each', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Main Lifts', exercises: [
          ex('3', 'Squat', 'barbell-back-squat', 'Barbell Back Squat', 'squat', 4, '5', '180s', ['knee', 'back']),
          ex('4', 'Bench', 'bench-press', 'Bench Press', 'push', 4, '5', '150s', ['shoulder']),
          ex('5', 'Row', 'barbell-row', 'Barbell Row', 'pull', 4, '6-8', '120s', ['back']),
        ]},
        { id: 'a1', type: 'work', name: 'Accessory', exercises: [
          ex('6', 'RDL', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '8', '90s', ['back']),
          ex('7', 'Shoulders', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '8', '90s', ['shoulder']),
          ex('8', 'Core', 'pallof-press', 'Pallof Press', 'core', 2, '10 each', '60s'),
        ]},
      ]
    }]
  },

  // 1x/week - Rehab & Return
  {
    id: '1x-rehab', name: '1x/Week – Rehab Focus',
    description: 'Gentle return-to-training session. Focus on movement quality and pain-free patterns.',
    phases: ['return'], goals: ['pain_reduction', 'mobility'],
    frequencyOptions: [1], structure: 'full_body', classSafe: true,
    days: [{
      id: '1x-r-a', dayLabel: 'Rehab Session', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Mobility Flow', exercises: [
          ex('1', 'Cat-Cow', 'cat-cow', 'Cat-Cow', 'rotation', 2, '10', '30s'),
          ex('2', 'Hip Circles', 'hip-circles', 'Hip Circles', 'rotation', 2, '10 each', '30s'),
          ex('3', 'Bird Dog', 'bird-dog', 'Bird Dog', 'core', 2, '8 each', '30s'),
        ]},
        { id: 'm1', type: 'work', name: 'Strength', exercises: [
          ex('4', 'Goblet Squat', 'goblet-squat', 'Goblet Squat', 'squat', 3, '8', '90s', ['knee']),
          ex('5', 'Glute Bridge', 'glute-bridge', 'Glute Bridge', 'hinge', 3, '12', '60s'),
          ex('6', 'Face Pull', 'face-pull', 'Face Pull', 'pull', 3, '15', '60s'),
          ex('7', 'Split Squat', 'split-squat', 'Split Squat', 'lunge', 2, '8 each', '60s', ['knee']),
        ]},
        { id: 'a1', type: 'work', name: 'Stability', exercises: [
          ex('8', 'Dead Bug', 'dead-bug', 'Dead Bug', 'core', 2, '10 each', '45s'),
          ex('9', 'Clamshell', 'clamshell', 'Clamshell', 'hinge', 2, '15 each', '45s'),
        ]},
      ]
    }]
  },

  // 1x/week - Busy Professional
  {
    id: '1x-busy', name: '1x/Week – Busy Professional',
    description: 'Maximum efficiency for time-poor clients. Hit all major patterns in 45 minutes.',
    phases: ['foundation'], goals: ['general', 'fat_loss'],
    frequencyOptions: [1], structure: 'full_body', classSafe: true,
    days: [{
      id: '1x-b-a', dayLabel: 'Express Full Body', dayNumber: 1,
      blocks: [
        { id: 'w1', type: 'warmup', name: 'Quick Prep', exercises: [
          ex('1', 'Glute Activation', 'glute-bridge', 'Glute Bridge', 'hinge', 1, '10', '20s'),
        ]},
        { id: 'm1', type: 'work', name: 'Circuit', exercises: [
          ex('2', 'Squat', 'leg-press', 'Leg Press', 'squat', 3, '12', '60s', ['knee']),
          ex('3', 'Push', 'db-bench-press', 'DB Bench Press', 'push', 3, '12', '60s', ['shoulder']),
          ex('4', 'Pull', 'lat-pulldown', 'Lat Pulldown', 'pull', 3, '12', '60s'),
          ex('5', 'Hinge', 'romanian-deadlift', 'Romanian Deadlift', 'hinge', 3, '10', '60s', ['back']),
          ex('6', 'Press', 'db-shoulder-press', 'DB Shoulder Press', 'push', 3, '10', '60s', ['shoulder']),
          ex('7', 'Core', 'plank', 'Plank', 'core', 2, '30s', '30s'),
        ]},
      ]
    }]
  },
];

// Goal-based phase recommendations
export const goalToPhaseRecommendation: Record<string, string[]> = {
  'fat_loss': ['foundation', 'strength'],
  'hypertrophy': ['strength'],
  'strength': ['strength'],
  'powerlifting': ['strength', 'performance'],
  'conditioning': ['foundation'],
  'mobility': ['return', 'foundation'],
  'general': ['foundation', 'strength'],
  'pain_reduction': ['return'],
  'athletic_performance': ['strength', 'performance'],
};

// Goal-based rep range presets
export const goalRepPresets: Record<string, { reps: string; rest: string; notes: string }> = {
  'fat_loss': { reps: '8-15', rest: '45-60s', notes: 'Circuit finishers, shorter rest' },
  'hypertrophy': { reps: '6-12', rest: '60-90s', notes: 'Higher volume' },
  'strength': { reps: '3-6', rest: '120-180s', notes: 'Compound focus' },
  'conditioning': { reps: '12-20', rest: '30-45s', notes: 'HIIT style' },
  'mobility': { reps: '10-15', rest: '45-60s', notes: 'Controlled tempo' },
  'pain_reduction': { reps: '10-15', rest: '60s', notes: 'Low load, stability focus' },
};

// Get templates filtered by criteria
export function filterTemplates(
  phase?: string,
  goal?: string,
  frequency?: number,
  injuries?: string[]
): ProgramTemplate[] {
  return programTemplates.filter(template => {
    if (phase && !template.phases.includes(phase as any)) return false;
    if (goal && !template.goals.includes(goal as any)) return false;
    if (frequency && !template.frequencyOptions.includes(frequency)) return false;
    return true;
  });
}
