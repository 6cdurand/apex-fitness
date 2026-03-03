// Suggested Programs Library — 20 curated templates
// Based on context-yourproject.md template library spec

export interface ProgramExercise {
  slot: string;
  defaultExercise: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  injuryFlags?: string[];
}

export interface ProgramBlock {
  type: 'warmup' | 'work' | 'cooldown';
  name: string;
  exercises: ProgramExercise[];
}

export interface ProgramDay {
  dayLabel: string;
  blocks: ProgramBlock[];
}

export interface SuggestedProgram {
  id: string;
  name: string;
  description: string;
  phases: ('foundation' | 'strength' | 'performance' | 'return')[];
  goals: ('fat_loss' | 'hypertrophy' | 'strength' | 'conditioning' | 'mobility' | 'general')[];
  frequencyOptions: number[];
  structure: 'full_body' | 'upper_lower' | 'push_pull_legs' | 'split' | 'circuit';
  classSafe: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  weeks: number;
  days: ProgramDay[];
}

export const suggestedPrograms: SuggestedProgram[] = [
  // 1. Full Body – Foundation
  {
    id: 'fb-foundation',
    name: 'Full Body — Foundation',
    description: 'Build movement quality with controlled compound exercises. Perfect for beginners or those returning to training.',
    phases: ['foundation', 'return'],
    goals: ['general', 'fat_loss'],
    frequencyOptions: [2, 3],
    structure: 'full_body',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Day A',
        blocks: [
          {
            type: 'warmup', name: 'Activation',
            exercises: [
              { slot: 'Glute Activation', defaultExercise: 'Glute Bridge', sets: 2, reps: '12', rest: '30s' },
              { slot: 'Core Stability', defaultExercise: 'Dead Bug', sets: 2, reps: '8 each', rest: '30s' },
            ],
          },
          {
            type: 'work', name: 'Main Lifts',
            exercises: [
              { slot: 'Squat Pattern', defaultExercise: 'Goblet Squat', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['knee'] },
              { slot: 'Horizontal Push', defaultExercise: 'DB Bench Press', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['shoulder'] },
              { slot: 'Horizontal Pull', defaultExercise: 'Cable Row', sets: 3, reps: '10-12', rest: '90s' },
            ],
          },
          {
            type: 'work', name: 'Accessory',
            exercises: [
              { slot: 'Single Leg', defaultExercise: 'Split Squat', sets: 2, reps: '10 each', rest: '60s', injuryFlags: ['knee'] },
              { slot: 'Core', defaultExercise: 'Plank', sets: 2, reps: '30s', rest: '30s' },
            ],
          },
        ],
      },
      {
        dayLabel: 'Day B',
        blocks: [
          {
            type: 'warmup', name: 'Activation',
            exercises: [
              { slot: 'Hip Mobility', defaultExercise: 'World\'s Greatest Stretch', sets: 2, reps: '5 each', rest: '30s' },
              { slot: 'Shoulder Prep', defaultExercise: 'Band Pull-Apart', sets: 2, reps: '15', rest: '30s' },
            ],
          },
          {
            type: 'work', name: 'Main Lifts',
            exercises: [
              { slot: 'Hinge Pattern', defaultExercise: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['back'] },
              { slot: 'Vertical Push', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['shoulder'] },
              { slot: 'Vertical Pull', defaultExercise: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90s' },
            ],
          },
          {
            type: 'work', name: 'Accessory',
            exercises: [
              { slot: 'Glute Focus', defaultExercise: 'Hip Thrust', sets: 3, reps: '12', rest: '60s' },
              { slot: 'Carry', defaultExercise: 'Farmer\'s Walk', sets: 2, reps: '30m', rest: '60s' },
            ],
          },
        ],
      },
    ],
  },

  // 2. Full Body – Strength
  {
    id: 'fb-strength',
    name: 'Full Body — Strength',
    description: 'Compound-heavy sessions focused on building overall strength. 3 days per week with adequate recovery.',
    phases: ['strength'],
    goals: ['strength', 'general'],
    frequencyOptions: [3],
    structure: 'full_body',
    classSafe: false,
    difficulty: 'intermediate',
    weeks: 4,
    days: [
      {
        dayLabel: 'Day A — Squat Focus',
        blocks: [
          {
            type: 'warmup', name: 'Movement Prep',
            exercises: [
              { slot: 'Hip Activation', defaultExercise: 'Banded Clamshell', sets: 2, reps: '12 each', rest: '30s' },
            ],
          },
          {
            type: 'work', name: 'Main Lifts',
            exercises: [
              { slot: 'Primary Squat', defaultExercise: 'Back Squat', sets: 4, reps: '5', rest: '180s', injuryFlags: ['knee', 'back'] },
              { slot: 'Horizontal Push', defaultExercise: 'Bench Press', sets: 4, reps: '6', rest: '150s', injuryFlags: ['shoulder'] },
              { slot: 'Horizontal Pull', defaultExercise: 'Barbell Row', sets: 4, reps: '6', rest: '120s' },
            ],
          },
          {
            type: 'work', name: 'Accessory',
            exercises: [
              { slot: 'Lunge Variation', defaultExercise: 'Walking Lunges', sets: 3, reps: '10 each', rest: '60s' },
              { slot: 'Core', defaultExercise: 'Ab Rollout', sets: 3, reps: '10', rest: '60s' },
            ],
          },
        ],
      },
      {
        dayLabel: 'Day B — Press Focus',
        blocks: [
          {
            type: 'warmup', name: 'Shoulder Prep',
            exercises: [
              { slot: 'Rotator Cuff', defaultExercise: 'Band External Rotation', sets: 2, reps: '12 each', rest: '30s' },
            ],
          },
          {
            type: 'work', name: 'Main Lifts',
            exercises: [
              { slot: 'Vertical Push', defaultExercise: 'Overhead Press', sets: 4, reps: '5', rest: '180s', injuryFlags: ['shoulder'] },
              { slot: 'Hinge', defaultExercise: 'Romanian Deadlift', sets: 4, reps: '8', rest: '120s', injuryFlags: ['back'] },
              { slot: 'Vertical Pull', defaultExercise: 'Weighted Pull-Up', sets: 4, reps: '6', rest: '120s' },
            ],
          },
          {
            type: 'work', name: 'Accessory',
            exercises: [
              { slot: 'Triceps', defaultExercise: 'Dips', sets: 3, reps: '8-10', rest: '60s' },
              { slot: 'Biceps', defaultExercise: 'Barbell Curl', sets: 3, reps: '10', rest: '60s' },
            ],
          },
        ],
      },
      {
        dayLabel: 'Day C — Deadlift Focus',
        blocks: [
          {
            type: 'warmup', name: 'Movement Prep',
            exercises: [
              { slot: 'Hip Hinge Prep', defaultExercise: 'Good Mornings (light)', sets: 2, reps: '10', rest: '30s' },
            ],
          },
          {
            type: 'work', name: 'Main Lifts',
            exercises: [
              { slot: 'Primary Hinge', defaultExercise: 'Deadlift', sets: 4, reps: '5', rest: '180s', injuryFlags: ['back'] },
              { slot: 'Incline Push', defaultExercise: 'Incline Bench Press', sets: 4, reps: '6-8', rest: '120s', injuryFlags: ['shoulder'] },
              { slot: 'Row Variation', defaultExercise: 'DB Row', sets: 4, reps: '8 each', rest: '90s' },
            ],
          },
          {
            type: 'work', name: 'Accessory',
            exercises: [
              { slot: 'Leg Press', defaultExercise: 'Leg Press', sets: 3, reps: '10', rest: '90s' },
              { slot: 'Lateral Raise', defaultExercise: 'Lateral Raise', sets: 3, reps: '12-15', rest: '60s' },
            ],
          },
        ],
      },
    ],
  },

  // 3. Full Body A/B
  {
    id: 'fb-ab',
    name: 'Full Body A/B',
    description: 'Alternate between two full-body sessions. Great for 3 days per week — moderate volume, solid variety.',
    phases: ['foundation', 'strength'],
    goals: ['general', 'hypertrophy'],
    frequencyOptions: [3],
    structure: 'full_body',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Workout A',
        blocks: [
          { type: 'warmup', name: 'Warm-Up', exercises: [
            { slot: 'General', defaultExercise: 'Jumping Jacks', sets: 2, reps: '20', rest: '20s' },
          ]},
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Squat', defaultExercise: 'Goblet Squat', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['knee'] },
            { slot: 'Push', defaultExercise: 'DB Bench Press', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['shoulder'] },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Shoulders', defaultExercise: 'Lateral Raise', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Core', defaultExercise: 'Plank', sets: 3, reps: '30s', rest: '30s' },
          ]},
        ],
      },
      {
        dayLabel: 'Workout B',
        blocks: [
          { type: 'warmup', name: 'Warm-Up', exercises: [
            { slot: 'Hip Mobility', defaultExercise: 'Hip Circles', sets: 2, reps: '10 each', rest: '20s' },
          ]},
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Hinge', defaultExercise: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['back'] },
            { slot: 'Push', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10-12', rest: '90s', injuryFlags: ['shoulder'] },
            { slot: 'Pull', defaultExercise: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Glutes', defaultExercise: 'Hip Thrust', sets: 3, reps: '12', rest: '60s' },
            { slot: 'Core', defaultExercise: 'Dead Bug', sets: 3, reps: '8 each', rest: '30s' },
          ]},
        ],
      },
    ],
  },

  // 4. Full Body – Circuit
  {
    id: 'fb-circuit',
    name: 'Full Body — Circuit Style',
    description: 'High-energy circuit sessions for fat loss and conditioning. Minimal rest, maximum calorie burn.',
    phases: ['foundation'],
    goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [2, 3],
    structure: 'circuit',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Circuit A',
        blocks: [
          { type: 'warmup', name: 'Dynamic Warm-Up', exercises: [
            { slot: 'Cardio', defaultExercise: 'High Knees', sets: 1, reps: '30s', rest: '15s' },
            { slot: 'Mobility', defaultExercise: 'Inchworm', sets: 1, reps: '5', rest: '15s' },
          ]},
          { type: 'work', name: 'Circuit — 3 Rounds', exercises: [
            { slot: 'Lower', defaultExercise: 'Goblet Squat', sets: 3, reps: '12', rest: '15s' },
            { slot: 'Push', defaultExercise: 'Push-Ups', sets: 3, reps: '10', rest: '15s' },
            { slot: 'Pull', defaultExercise: 'TRX Row', sets: 3, reps: '10', rest: '15s' },
            { slot: 'Core', defaultExercise: 'Mountain Climbers', sets: 3, reps: '20', rest: '15s' },
            { slot: 'Cardio', defaultExercise: 'Kettlebell Swings', sets: 3, reps: '15', rest: '60s', notes: 'Rest 60s between rounds' },
          ]},
        ],
      },
      {
        dayLabel: 'Circuit B',
        blocks: [
          { type: 'warmup', name: 'Dynamic Warm-Up', exercises: [
            { slot: 'Cardio', defaultExercise: 'Jumping Jacks', sets: 1, reps: '30s', rest: '15s' },
            { slot: 'Mobility', defaultExercise: 'World\'s Greatest Stretch', sets: 1, reps: '5 each', rest: '15s' },
          ]},
          { type: 'work', name: 'Circuit — 3 Rounds', exercises: [
            { slot: 'Hinge', defaultExercise: 'Kettlebell Deadlift', sets: 3, reps: '12', rest: '15s' },
            { slot: 'Push', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10', rest: '15s' },
            { slot: 'Pull', defaultExercise: 'Band Pull-Apart', sets: 3, reps: '15', rest: '15s' },
            { slot: 'Lunge', defaultExercise: 'Reverse Lunges', sets: 3, reps: '10 each', rest: '15s' },
            { slot: 'Finisher', defaultExercise: 'Battle Ropes', sets: 3, reps: '20s', rest: '60s', notes: 'Rest 60s between rounds' },
          ]},
        ],
      },
    ],
  },

  // 5. Upper/Lower – Foundation
  {
    id: 'ul-foundation',
    name: 'Upper/Lower — Foundation',
    description: 'Split upper and lower body days for balanced development. Great introduction to structured training.',
    phases: ['foundation'],
    goals: ['general'],
    frequencyOptions: [3, 4],
    structure: 'upper_lower',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Upper A',
        blocks: [
          { type: 'warmup', name: 'Upper Activation', exercises: [
            { slot: 'Shoulder Prep', defaultExercise: 'Band Pull-Apart', sets: 2, reps: '15', rest: '30s' },
          ]},
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Push', defaultExercise: 'DB Bench Press', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Shoulders', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10-12', rest: '60s' },
            { slot: 'Arms', defaultExercise: 'Bicep Curl', sets: 2, reps: '12', rest: '60s' },
            { slot: 'Core', defaultExercise: 'Plank', sets: 3, reps: '30s', rest: '30s' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower A',
        blocks: [
          { type: 'warmup', name: 'Lower Activation', exercises: [
            { slot: 'Glute Activation', defaultExercise: 'Glute Bridge', sets: 2, reps: '15', rest: '30s' },
          ]},
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Squat', defaultExercise: 'Goblet Squat', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Hinge', defaultExercise: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Single Leg', defaultExercise: 'Walking Lunges', sets: 3, reps: '10 each', rest: '60s' },
            { slot: 'Glutes', defaultExercise: 'Hip Thrust', sets: 3, reps: '12', rest: '60s' },
            { slot: 'Calves', defaultExercise: 'Calf Raises', sets: 3, reps: '15', rest: '45s' },
          ]},
        ],
      },
    ],
  },

  // 6. Upper/Lower – Strength
  {
    id: 'ul-strength',
    name: 'Upper/Lower — Strength',
    description: 'Heavy compounds with proper periodisation. For experienced lifters building serious strength.',
    phases: ['strength'],
    goals: ['strength', 'hypertrophy'],
    frequencyOptions: [4],
    structure: 'upper_lower',
    classSafe: false,
    difficulty: 'intermediate',
    weeks: 4,
    days: [
      {
        dayLabel: 'Upper — Strength',
        blocks: [
          { type: 'warmup', name: 'Prep', exercises: [
            { slot: 'Shoulder', defaultExercise: 'Band External Rotation', sets: 2, reps: '12 each', rest: '30s' },
          ]},
          { type: 'work', name: 'Main Lifts', exercises: [
            { slot: 'Primary Push', defaultExercise: 'Bench Press', sets: 4, reps: '5', rest: '180s' },
            { slot: 'Primary Pull', defaultExercise: 'Barbell Row', sets: 4, reps: '5', rest: '150s' },
            { slot: 'Vertical Push', defaultExercise: 'Overhead Press', sets: 3, reps: '6-8', rest: '120s' },
            { slot: 'Vertical Pull', defaultExercise: 'Weighted Pull-Up', sets: 3, reps: '6-8', rest: '120s' },
          ]},
          { type: 'work', name: 'Accessory', exercises: [
            { slot: 'Lateral Raise', defaultExercise: 'Lateral Raise', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Triceps', defaultExercise: 'Tricep Pushdown', sets: 3, reps: '10-12', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower — Strength',
        blocks: [
          { type: 'warmup', name: 'Prep', exercises: [
            { slot: 'Activation', defaultExercise: 'Banded Clamshell', sets: 2, reps: '12 each', rest: '30s' },
          ]},
          { type: 'work', name: 'Main Lifts', exercises: [
            { slot: 'Primary Squat', defaultExercise: 'Back Squat', sets: 4, reps: '5', rest: '180s' },
            { slot: 'Primary Hinge', defaultExercise: 'Romanian Deadlift', sets: 4, reps: '6-8', rest: '150s' },
            { slot: 'Single Leg', defaultExercise: 'Bulgarian Split Squat', sets: 3, reps: '8 each', rest: '90s' },
          ]},
          { type: 'work', name: 'Accessory', exercises: [
            { slot: 'Leg Extension', defaultExercise: 'Leg Extension', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Hamstring Curl', defaultExercise: 'Leg Curl', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Core', defaultExercise: 'Hanging Leg Raise', sets: 3, reps: '10-12', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Upper — Hypertrophy',
        blocks: [
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Push', defaultExercise: 'Incline DB Press', sets: 4, reps: '8-10', rest: '90s' },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 4, reps: '8-10', rest: '90s' },
            { slot: 'Push', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Pull', defaultExercise: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90s' },
          ]},
          { type: 'work', name: 'Arms & Detail', exercises: [
            { slot: 'Biceps', defaultExercise: 'Incline DB Curl', sets: 3, reps: '10-12', rest: '60s' },
            { slot: 'Triceps', defaultExercise: 'Overhead Tricep Extension', sets: 3, reps: '10-12', rest: '60s' },
            { slot: 'Rear Delts', defaultExercise: 'Face Pull', sets: 3, reps: '15', rest: '45s' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower — Hypertrophy',
        blocks: [
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Squat', defaultExercise: 'Leg Press', sets: 4, reps: '10-12', rest: '120s' },
            { slot: 'Hinge', defaultExercise: 'DB Romanian Deadlift', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Glutes', defaultExercise: 'Hip Thrust', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Single Leg', defaultExercise: 'Walking Lunges', sets: 3, reps: '10 each', rest: '60s' },
          ]},
          { type: 'work', name: 'Isolation', exercises: [
            { slot: 'Quads', defaultExercise: 'Leg Extension', sets: 3, reps: '15', rest: '45s' },
            { slot: 'Hamstrings', defaultExercise: 'Leg Curl', sets: 3, reps: '15', rest: '45s' },
            { slot: 'Calves', defaultExercise: 'Seated Calf Raise', sets: 4, reps: '12-15', rest: '45s' },
          ]},
        ],
      },
    ],
  },

  // 7. Upper/Lower – Volume
  {
    id: 'ul-volume',
    name: 'Upper/Lower — Volume',
    description: 'Higher volume hypertrophy focus. Great for intermediate lifters looking to maximise muscle growth.',
    phases: ['strength'],
    goals: ['hypertrophy'],
    frequencyOptions: [4],
    structure: 'upper_lower',
    classSafe: false,
    difficulty: 'intermediate',
    weeks: 4,
    days: [
      {
        dayLabel: 'Upper A — Push Bias',
        blocks: [
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Push', defaultExercise: 'Bench Press', sets: 4, reps: '8-10', rest: '120s' },
            { slot: 'Pull', defaultExercise: 'DB Row', sets: 4, reps: '8-10', rest: '90s' },
            { slot: 'Push', defaultExercise: 'Incline DB Press', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Pull', defaultExercise: 'Face Pull', sets: 3, reps: '15', rest: '60s' },
            { slot: 'Shoulders', defaultExercise: 'Lateral Raise', sets: 4, reps: '12-15', rest: '45s' },
            { slot: 'Arms', defaultExercise: 'Tricep Pushdown', sets: 3, reps: '12', rest: '45s' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower A — Quad Bias',
        blocks: [
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Squat', defaultExercise: 'Back Squat', sets: 4, reps: '8-10', rest: '150s' },
            { slot: 'Hinge', defaultExercise: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: '120s' },
            { slot: 'Single Leg', defaultExercise: 'Bulgarian Split Squat', sets: 3, reps: '10 each', rest: '90s' },
            { slot: 'Quads', defaultExercise: 'Leg Extension', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Calves', defaultExercise: 'Standing Calf Raise', sets: 4, reps: '15', rest: '45s' },
          ]},
        ],
      },
      {
        dayLabel: 'Upper B — Pull Bias',
        blocks: [
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Pull', defaultExercise: 'Weighted Pull-Up', sets: 4, reps: '6-8', rest: '120s' },
            { slot: 'Push', defaultExercise: 'DB Shoulder Press', sets: 4, reps: '8-10', rest: '90s' },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Push', defaultExercise: 'Cable Fly', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Rear Delts', defaultExercise: 'Reverse Fly', sets: 3, reps: '15', rest: '45s' },
            { slot: 'Arms', defaultExercise: 'Barbell Curl', sets: 3, reps: '10-12', rest: '45s' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower B — Glute/Ham Bias',
        blocks: [
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Hinge', defaultExercise: 'Deadlift', sets: 4, reps: '5', rest: '180s' },
            { slot: 'Glutes', defaultExercise: 'Hip Thrust', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Single Leg', defaultExercise: 'Walking Lunges', sets: 3, reps: '10 each', rest: '60s' },
            { slot: 'Hamstrings', defaultExercise: 'Leg Curl', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Calves', defaultExercise: 'Seated Calf Raise', sets: 4, reps: '15', rest: '45s' },
          ]},
        ],
      },
    ],
  },

  // 8. Upper/Lower – Hybrid (Fat Loss)
  {
    id: 'ul-hybrid',
    name: 'Upper/Lower — Hybrid',
    description: 'Strength work plus conditioning finishers. Designed for fat loss while maintaining muscle.',
    phases: ['strength'],
    goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [3, 4],
    structure: 'upper_lower',
    classSafe: false,
    difficulty: 'intermediate',
    weeks: 4,
    days: [
      {
        dayLabel: 'Upper + Conditioning',
        blocks: [
          { type: 'work', name: 'Strength', exercises: [
            { slot: 'Push', defaultExercise: 'Bench Press', sets: 3, reps: '8', rest: '120s' },
            { slot: 'Pull', defaultExercise: 'Barbell Row', sets: 3, reps: '8', rest: '120s' },
            { slot: 'Shoulders', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10', rest: '90s' },
          ]},
          { type: 'work', name: 'Finisher — 3 Rounds', exercises: [
            { slot: 'Push', defaultExercise: 'Push-Ups', sets: 3, reps: '15', rest: '15s' },
            { slot: 'Pull', defaultExercise: 'Band Pull-Apart', sets: 3, reps: '15', rest: '15s' },
            { slot: 'Core', defaultExercise: 'Mountain Climbers', sets: 3, reps: '20', rest: '60s', notes: 'Rest 60s between rounds' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower + Conditioning',
        blocks: [
          { type: 'work', name: 'Strength', exercises: [
            { slot: 'Squat', defaultExercise: 'Back Squat', sets: 3, reps: '8', rest: '120s' },
            { slot: 'Hinge', defaultExercise: 'Romanian Deadlift', sets: 3, reps: '8', rest: '120s' },
            { slot: 'Glutes', defaultExercise: 'Hip Thrust', sets: 3, reps: '10', rest: '90s' },
          ]},
          { type: 'work', name: 'Finisher — 3 Rounds', exercises: [
            { slot: 'Cardio', defaultExercise: 'Kettlebell Swings', sets: 3, reps: '15', rest: '15s' },
            { slot: 'Lower', defaultExercise: 'Jump Squats', sets: 3, reps: '10', rest: '15s' },
            { slot: 'Core', defaultExercise: 'Plank', sets: 3, reps: '30s', rest: '60s', notes: 'Rest 60s between rounds' },
          ]},
        ],
      },
    ],
  },

  // 9. Push/Pull/Legs – Classic
  {
    id: 'ppl-classic',
    name: 'Push/Pull/Legs — Classic',
    description: 'The classic PPL split. Run it 4-6× per week for maximum volume and hypertrophy.',
    phases: ['strength'],
    goals: ['hypertrophy', 'strength'],
    frequencyOptions: [4, 5, 6],
    structure: 'push_pull_legs',
    classSafe: false,
    difficulty: 'intermediate',
    weeks: 4,
    days: [
      {
        dayLabel: 'Push',
        blocks: [
          { type: 'work', name: 'Main Push', exercises: [
            { slot: 'Flat Press', defaultExercise: 'Bench Press', sets: 4, reps: '6-8', rest: '150s' },
            { slot: 'Incline', defaultExercise: 'Incline DB Press', sets: 3, reps: '8-10', rest: '90s' },
            { slot: 'Shoulders', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Fly', defaultExercise: 'Cable Fly', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Lateral', defaultExercise: 'Lateral Raise', sets: 4, reps: '12-15', rest: '45s' },
            { slot: 'Triceps', defaultExercise: 'Overhead Tricep Extension', sets: 3, reps: '10-12', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Pull',
        blocks: [
          { type: 'work', name: 'Main Pull', exercises: [
            { slot: 'Vertical', defaultExercise: 'Weighted Pull-Up', sets: 4, reps: '6-8', rest: '150s' },
            { slot: 'Horizontal', defaultExercise: 'Barbell Row', sets: 4, reps: '6-8', rest: '120s' },
            { slot: 'Lat Focus', defaultExercise: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Rear Delts', defaultExercise: 'Face Pull', sets: 3, reps: '15', rest: '60s' },
            { slot: 'Biceps', defaultExercise: 'Barbell Curl', sets: 3, reps: '10-12', rest: '60s' },
            { slot: 'Biceps', defaultExercise: 'Hammer Curl', sets: 3, reps: '10-12', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Legs',
        blocks: [
          { type: 'work', name: 'Main Legs', exercises: [
            { slot: 'Squat', defaultExercise: 'Back Squat', sets: 4, reps: '6-8', rest: '180s' },
            { slot: 'Hinge', defaultExercise: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: '120s' },
            { slot: 'Single Leg', defaultExercise: 'Bulgarian Split Squat', sets: 3, reps: '10 each', rest: '90s' },
            { slot: 'Quads', defaultExercise: 'Leg Extension', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Hamstrings', defaultExercise: 'Leg Curl', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Calves', defaultExercise: 'Standing Calf Raise', sets: 4, reps: '12-15', rest: '45s' },
          ]},
        ],
      },
    ],
  },

  // 10. PPL – Strength
  {
    id: 'ppl-strength',
    name: 'Push/Pull/Legs — Strength',
    description: 'PPL with heavier loads and lower reps. For experienced lifters chasing heavy numbers.',
    phases: ['strength', 'performance'],
    goals: ['strength'],
    frequencyOptions: [4, 5],
    structure: 'push_pull_legs',
    classSafe: false,
    difficulty: 'advanced',
    weeks: 4,
    days: [
      {
        dayLabel: 'Push — Heavy',
        blocks: [
          { type: 'work', name: 'Main Lifts', exercises: [
            { slot: 'Primary', defaultExercise: 'Bench Press', sets: 5, reps: '3-5', rest: '180s' },
            { slot: 'Secondary', defaultExercise: 'Overhead Press', sets: 4, reps: '5-6', rest: '150s' },
            { slot: 'Accessory', defaultExercise: 'Incline DB Press', sets: 3, reps: '8-10', rest: '90s' },
            { slot: 'Isolation', defaultExercise: 'Lateral Raise', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Triceps', defaultExercise: 'Close-Grip Bench', sets: 3, reps: '8', rest: '90s' },
          ]},
        ],
      },
      {
        dayLabel: 'Pull — Heavy',
        blocks: [
          { type: 'work', name: 'Main Lifts', exercises: [
            { slot: 'Primary', defaultExercise: 'Deadlift', sets: 5, reps: '3-5', rest: '180s' },
            { slot: 'Secondary', defaultExercise: 'Barbell Row', sets: 4, reps: '5-6', rest: '150s' },
            { slot: 'Lat', defaultExercise: 'Weighted Pull-Up', sets: 3, reps: '6-8', rest: '120s' },
            { slot: 'Rear Delts', defaultExercise: 'Face Pull', sets: 3, reps: '15', rest: '60s' },
            { slot: 'Biceps', defaultExercise: 'Barbell Curl', sets: 3, reps: '8-10', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Legs — Heavy',
        blocks: [
          { type: 'work', name: 'Main Lifts', exercises: [
            { slot: 'Primary', defaultExercise: 'Back Squat', sets: 5, reps: '3-5', rest: '180s' },
            { slot: 'Secondary', defaultExercise: 'Front Squat', sets: 3, reps: '6-8', rest: '150s' },
            { slot: 'Accessory', defaultExercise: 'Leg Press', sets: 3, reps: '8-10', rest: '120s' },
            { slot: 'Hamstrings', defaultExercise: 'Nordic Curl', sets: 3, reps: '6-8', rest: '90s' },
            { slot: 'Calves', defaultExercise: 'Standing Calf Raise', sets: 4, reps: '10-12', rest: '60s' },
          ]},
        ],
      },
    ],
  },

  // 11. PPL – Volume
  {
    id: 'ppl-volume',
    name: 'Push/Pull/Legs — Volume',
    description: 'High-volume PPL for serious hypertrophy. Run 5-6× per week. Not for the faint-hearted.',
    phases: ['strength'],
    goals: ['hypertrophy'],
    frequencyOptions: [5, 6],
    structure: 'push_pull_legs',
    classSafe: false,
    difficulty: 'advanced',
    weeks: 4,
    days: [
      {
        dayLabel: 'Push — Volume',
        blocks: [
          { type: 'work', name: 'Chest & Shoulders', exercises: [
            { slot: 'Flat Press', defaultExercise: 'Bench Press', sets: 4, reps: '8-10', rest: '120s' },
            { slot: 'Incline', defaultExercise: 'Incline DB Press', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Fly', defaultExercise: 'Cable Fly', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Shoulders', defaultExercise: 'DB Shoulder Press', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Lateral', defaultExercise: 'Lateral Raise', sets: 4, reps: '15', rest: '45s' },
            { slot: 'Triceps', defaultExercise: 'Tricep Pushdown', sets: 3, reps: '12-15', rest: '45s' },
            { slot: 'Triceps', defaultExercise: 'Overhead Tricep Extension', sets: 3, reps: '12-15', rest: '45s' },
          ]},
        ],
      },
      {
        dayLabel: 'Pull — Volume',
        blocks: [
          { type: 'work', name: 'Back & Biceps', exercises: [
            { slot: 'Vertical', defaultExercise: 'Lat Pulldown', sets: 4, reps: '8-10', rest: '90s' },
            { slot: 'Horizontal', defaultExercise: 'Cable Row', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Lat Focus', defaultExercise: 'Straight-Arm Pulldown', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Rear Delts', defaultExercise: 'Face Pull', sets: 4, reps: '15', rest: '45s' },
            { slot: 'Rear Delts', defaultExercise: 'Reverse Fly', sets: 3, reps: '12-15', rest: '45s' },
            { slot: 'Biceps', defaultExercise: 'Barbell Curl', sets: 3, reps: '10-12', rest: '60s' },
            { slot: 'Biceps', defaultExercise: 'Incline DB Curl', sets: 3, reps: '10-12', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Legs — Volume',
        blocks: [
          { type: 'work', name: 'Quads & Glutes', exercises: [
            { slot: 'Squat', defaultExercise: 'Back Squat', sets: 4, reps: '8-10', rest: '150s' },
            { slot: 'Leg Press', defaultExercise: 'Leg Press', sets: 4, reps: '10-12', rest: '120s' },
            { slot: 'Single Leg', defaultExercise: 'Walking Lunges', sets: 3, reps: '10 each', rest: '60s' },
            { slot: 'Glutes', defaultExercise: 'Hip Thrust', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Quads', defaultExercise: 'Leg Extension', sets: 3, reps: '15', rest: '45s' },
            { slot: 'Hamstrings', defaultExercise: 'Leg Curl', sets: 3, reps: '15', rest: '45s' },
            { slot: 'Calves', defaultExercise: 'Calf Raises', sets: 5, reps: '15', rest: '45s' },
          ]},
        ],
      },
    ],
  },

  // 12. Bro Split – Bodybuilding
  {
    id: 'bro-split',
    name: 'Bro Split — Bodybuilding',
    description: 'Classic bodybuilding split hitting each muscle once per week with maximum volume. 4-5 days.',
    phases: ['strength'],
    goals: ['hypertrophy'],
    frequencyOptions: [4, 5],
    structure: 'split',
    classSafe: false,
    difficulty: 'intermediate',
    weeks: 4,
    days: [
      {
        dayLabel: 'Chest',
        blocks: [{ type: 'work', name: 'Chest Day', exercises: [
          { slot: 'Flat Press', defaultExercise: 'Bench Press', sets: 4, reps: '6-8', rest: '150s' },
          { slot: 'Incline', defaultExercise: 'Incline DB Press', sets: 4, reps: '8-10', rest: '90s' },
          { slot: 'Fly', defaultExercise: 'Cable Fly', sets: 3, reps: '12-15', rest: '60s' },
          { slot: 'Dips', defaultExercise: 'Dips', sets: 3, reps: '10-12', rest: '90s' },
        ]}],
      },
      {
        dayLabel: 'Back',
        blocks: [{ type: 'work', name: 'Back Day', exercises: [
          { slot: 'Vertical', defaultExercise: 'Weighted Pull-Up', sets: 4, reps: '6-8', rest: '150s' },
          { slot: 'Horizontal', defaultExercise: 'Barbell Row', sets: 4, reps: '6-8', rest: '120s' },
          { slot: 'Lat', defaultExercise: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90s' },
          { slot: 'Row', defaultExercise: 'Cable Row', sets: 3, reps: '10-12', rest: '90s' },
          { slot: 'Rear Delts', defaultExercise: 'Face Pull', sets: 3, reps: '15', rest: '60s' },
        ]}],
      },
      {
        dayLabel: 'Shoulders & Arms',
        blocks: [{ type: 'work', name: 'Shoulders & Arms', exercises: [
          { slot: 'Press', defaultExercise: 'DB Shoulder Press', sets: 4, reps: '8-10', rest: '90s' },
          { slot: 'Lateral', defaultExercise: 'Lateral Raise', sets: 4, reps: '12-15', rest: '45s' },
          { slot: 'Rear', defaultExercise: 'Reverse Fly', sets: 3, reps: '15', rest: '45s' },
          { slot: 'Biceps', defaultExercise: 'Barbell Curl', sets: 3, reps: '10-12', rest: '60s' },
          { slot: 'Triceps', defaultExercise: 'Tricep Pushdown', sets: 3, reps: '10-12', rest: '60s' },
        ]}],
      },
      {
        dayLabel: 'Legs',
        blocks: [{ type: 'work', name: 'Leg Day', exercises: [
          { slot: 'Squat', defaultExercise: 'Back Squat', sets: 4, reps: '6-8', rest: '180s' },
          { slot: 'Hinge', defaultExercise: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: '120s' },
          { slot: 'Single Leg', defaultExercise: 'Walking Lunges', sets: 3, reps: '10 each', rest: '60s' },
          { slot: 'Quads', defaultExercise: 'Leg Extension', sets: 3, reps: '12-15', rest: '60s' },
          { slot: 'Hamstrings', defaultExercise: 'Leg Curl', sets: 3, reps: '12-15', rest: '60s' },
          { slot: 'Calves', defaultExercise: 'Calf Raises', sets: 4, reps: '15', rest: '45s' },
        ]}],
      },
    ],
  },

  // 13. Circuit – HIIT Style
  {
    id: 'circuit-hiit',
    name: 'Circuit — HIIT Style',
    description: 'Fast-paced HIIT circuits for maximum calorie burn. Short rest periods, full body engagement.',
    phases: ['foundation'],
    goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [2, 3],
    structure: 'circuit',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'HIIT A',
        blocks: [
          { type: 'warmup', name: 'Warm-Up', exercises: [
            { slot: 'Dynamic', defaultExercise: 'High Knees', sets: 1, reps: '30s', rest: '15s' },
            { slot: 'Mobility', defaultExercise: 'Arm Circles', sets: 1, reps: '10 each', rest: '15s' },
          ]},
          { type: 'work', name: 'HIIT Circuit — 4 Rounds', exercises: [
            { slot: 'Squat', defaultExercise: 'Jump Squats', sets: 4, reps: '10', rest: '15s' },
            { slot: 'Push', defaultExercise: 'Push-Ups', sets: 4, reps: '10', rest: '15s' },
            { slot: 'Cardio', defaultExercise: 'Burpees', sets: 4, reps: '8', rest: '15s' },
            { slot: 'Core', defaultExercise: 'Mountain Climbers', sets: 4, reps: '20', rest: '15s' },
            { slot: 'Rest', defaultExercise: 'Rest', sets: 4, reps: '60s', rest: '0s', notes: '60s rest between rounds' },
          ]},
        ],
      },
      {
        dayLabel: 'HIIT B',
        blocks: [
          { type: 'warmup', name: 'Warm-Up', exercises: [
            { slot: 'Dynamic', defaultExercise: 'Jumping Jacks', sets: 1, reps: '30s', rest: '15s' },
          ]},
          { type: 'work', name: 'HIIT Circuit — 4 Rounds', exercises: [
            { slot: 'Hinge', defaultExercise: 'Kettlebell Swings', sets: 4, reps: '15', rest: '15s' },
            { slot: 'Lunge', defaultExercise: 'Jump Lunges', sets: 4, reps: '10 each', rest: '15s' },
            { slot: 'Pull', defaultExercise: 'TRX Row', sets: 4, reps: '12', rest: '15s' },
            { slot: 'Core', defaultExercise: 'Plank', sets: 4, reps: '30s', rest: '15s' },
            { slot: 'Rest', defaultExercise: 'Rest', sets: 4, reps: '60s', rest: '0s', notes: '60s rest between rounds' },
          ]},
        ],
      },
    ],
  },

  // 14. Circuit – Strength
  {
    id: 'circuit-strength',
    name: 'Circuit — Strength',
    description: 'Heavier circuits with strength focus. Build muscle while keeping your heart rate elevated.',
    phases: ['foundation', 'strength'],
    goals: ['fat_loss', 'strength'],
    frequencyOptions: [3],
    structure: 'circuit',
    classSafe: true,
    difficulty: 'intermediate',
    weeks: 4,
    days: [
      {
        dayLabel: 'Strength Circuit A',
        blocks: [
          { type: 'work', name: 'Circuit — 4 Rounds', exercises: [
            { slot: 'Squat', defaultExercise: 'Goblet Squat', sets: 4, reps: '10', rest: '20s' },
            { slot: 'Push', defaultExercise: 'DB Bench Press', sets: 4, reps: '10', rest: '20s' },
            { slot: 'Pull', defaultExercise: 'DB Row', sets: 4, reps: '10', rest: '20s' },
            { slot: 'Carry', defaultExercise: 'Farmer\'s Walk', sets: 4, reps: '30m', rest: '90s', notes: 'Rest 90s between rounds' },
          ]},
        ],
      },
      {
        dayLabel: 'Strength Circuit B',
        blocks: [
          { type: 'work', name: 'Circuit — 4 Rounds', exercises: [
            { slot: 'Hinge', defaultExercise: 'Kettlebell Deadlift', sets: 4, reps: '10', rest: '20s' },
            { slot: 'Push', defaultExercise: 'DB Shoulder Press', sets: 4, reps: '10', rest: '20s' },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 4, reps: '10', rest: '20s' },
            { slot: 'Core', defaultExercise: 'Plank', sets: 4, reps: '40s', rest: '90s', notes: 'Rest 90s between rounds' },
          ]},
        ],
      },
    ],
  },

  // 15. Circuit – Low Impact
  {
    id: 'circuit-low-impact',
    name: 'Circuit — Low Impact',
    description: 'Joint-friendly circuits for conditioning. No jumping, no high-impact movements.',
    phases: ['return'],
    goals: ['conditioning', 'mobility'],
    frequencyOptions: [2, 3],
    structure: 'circuit',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Low Impact A',
        blocks: [
          { type: 'warmup', name: 'Gentle Warm-Up', exercises: [
            { slot: 'Mobility', defaultExercise: 'Hip Circles', sets: 2, reps: '10 each', rest: '20s' },
            { slot: 'Activation', defaultExercise: 'Glute Bridge', sets: 2, reps: '12', rest: '20s' },
          ]},
          { type: 'work', name: 'Circuit — 3 Rounds', exercises: [
            { slot: 'Lower', defaultExercise: 'Goblet Squat', sets: 3, reps: '10', rest: '20s' },
            { slot: 'Push', defaultExercise: 'DB Bench Press', sets: 3, reps: '10', rest: '20s' },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 3, reps: '10', rest: '20s' },
            { slot: 'Core', defaultExercise: 'Dead Bug', sets: 3, reps: '8 each', rest: '60s', notes: 'Rest 60s between rounds' },
          ]},
          { type: 'cooldown', name: 'Stretch', exercises: [
            { slot: 'Stretch', defaultExercise: 'Hip Flexor Stretch', sets: 1, reps: '60s each', rest: '0s' },
          ]},
        ],
      },
    ],
  },

  // 16. Return to Training – Mobility
  {
    id: 'return-mobility',
    name: 'Return to Training — Mobility',
    description: 'Gentle full-body sessions focused on movement quality and joint mobility. Perfect after a long break.',
    phases: ['return'],
    goals: ['mobility', 'general'],
    frequencyOptions: [2, 3],
    structure: 'full_body',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Mobility A',
        blocks: [
          { type: 'warmup', name: 'Mobility Flow', exercises: [
            { slot: 'Full Body', defaultExercise: 'World\'s Greatest Stretch', sets: 2, reps: '5 each', rest: '30s' },
            { slot: 'Hip', defaultExercise: 'Hip 90/90', sets: 2, reps: '8 each', rest: '30s' },
          ]},
          { type: 'work', name: 'Controlled Movement', exercises: [
            { slot: 'Squat', defaultExercise: 'Goblet Squat (tempo)', sets: 3, reps: '8', rest: '90s', notes: '3-1-3 tempo' },
            { slot: 'Push', defaultExercise: 'Push-Ups', sets: 3, reps: '8', rest: '60s' },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 3, reps: '10', rest: '60s' },
            { slot: 'Core', defaultExercise: 'Dead Bug', sets: 3, reps: '8 each', rest: '30s' },
          ]},
          { type: 'cooldown', name: 'Stretch', exercises: [
            { slot: 'Full Body', defaultExercise: 'Full Body Stretch Routine', sets: 1, reps: '5 min', rest: '0s' },
          ]},
        ],
      },
    ],
  },

  // 17. Return to Training – Stability
  {
    id: 'return-stability',
    name: 'Return to Training — Stability',
    description: 'Core stability and balance focus. Rebuild your foundation before progressing to heavier work.',
    phases: ['return'],
    goals: ['mobility', 'general'],
    frequencyOptions: [2, 3],
    structure: 'full_body',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Stability A',
        blocks: [
          { type: 'warmup', name: 'Activation', exercises: [
            { slot: 'Core', defaultExercise: 'Dead Bug', sets: 2, reps: '8 each', rest: '30s' },
            { slot: 'Glutes', defaultExercise: 'Banded Clamshell', sets: 2, reps: '12 each', rest: '30s' },
          ]},
          { type: 'work', name: 'Stability Work', exercises: [
            { slot: 'Balance', defaultExercise: 'Single-Leg RDL (light)', sets: 3, reps: '8 each', rest: '60s' },
            { slot: 'Push', defaultExercise: 'DB Bench Press', sets: 3, reps: '10', rest: '60s' },
            { slot: 'Anti-Rotation', defaultExercise: 'Pallof Press', sets: 3, reps: '10 each', rest: '60s' },
            { slot: 'Pull', defaultExercise: 'Band Pull-Apart', sets: 3, reps: '15', rest: '45s' },
          ]},
          { type: 'cooldown', name: 'Stretch', exercises: [
            { slot: 'Hip', defaultExercise: 'Hip Flexor Stretch', sets: 1, reps: '60s each', rest: '0s' },
          ]},
        ],
      },
    ],
  },

  // 18. Performance – Power Prep
  {
    id: 'performance-power',
    name: 'Performance — Power Prep',
    description: 'Transition from strength to power. Includes contrast sets and explosive movements.',
    phases: ['performance'],
    goals: ['strength', 'conditioning'],
    frequencyOptions: [4],
    structure: 'upper_lower',
    classSafe: false,
    difficulty: 'advanced',
    weeks: 4,
    days: [
      {
        dayLabel: 'Upper — Power',
        blocks: [
          { type: 'work', name: 'Power + Strength', exercises: [
            { slot: 'Power', defaultExercise: 'Medicine Ball Chest Pass', sets: 3, reps: '6', rest: '90s', notes: 'Explosive' },
            { slot: 'Strength', defaultExercise: 'Bench Press', sets: 4, reps: '4-6', rest: '150s' },
            { slot: 'Pull', defaultExercise: 'Barbell Row', sets: 4, reps: '6', rest: '120s' },
            { slot: 'Shoulders', defaultExercise: 'Push Press', sets: 3, reps: '5', rest: '120s' },
            { slot: 'Pull', defaultExercise: 'Weighted Pull-Up', sets: 3, reps: '6-8', rest: '120s' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower — Power',
        blocks: [
          { type: 'work', name: 'Power + Strength', exercises: [
            { slot: 'Power', defaultExercise: 'Box Jumps', sets: 3, reps: '5', rest: '90s', notes: 'Step down, don\'t jump' },
            { slot: 'Strength', defaultExercise: 'Back Squat', sets: 4, reps: '4-6', rest: '180s' },
            { slot: 'Hinge', defaultExercise: 'Trap Bar Deadlift', sets: 4, reps: '5', rest: '150s' },
            { slot: 'Single Leg', defaultExercise: 'Bulgarian Split Squat', sets: 3, reps: '8 each', rest: '90s' },
            { slot: 'Core', defaultExercise: 'Ab Rollout', sets: 3, reps: '10', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Upper — Hypertrophy',
        blocks: [
          { type: 'work', name: 'Volume Work', exercises: [
            { slot: 'Push', defaultExercise: 'Incline DB Press', sets: 4, reps: '8-10', rest: '90s' },
            { slot: 'Pull', defaultExercise: 'Cable Row', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Shoulders', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10-12', rest: '90s' },
            { slot: 'Lateral', defaultExercise: 'Lateral Raise', sets: 3, reps: '12-15', rest: '60s' },
            { slot: 'Arms', defaultExercise: 'Superset: Curl + Pushdown', sets: 3, reps: '10-12', rest: '60s' },
          ]},
        ],
      },
      {
        dayLabel: 'Lower — Hypertrophy',
        blocks: [
          { type: 'work', name: 'Volume Work', exercises: [
            { slot: 'Squat', defaultExercise: 'Leg Press', sets: 4, reps: '10-12', rest: '120s' },
            { slot: 'Glutes', defaultExercise: 'Hip Thrust', sets: 4, reps: '10-12', rest: '90s' },
            { slot: 'Lunges', defaultExercise: 'Walking Lunges', sets: 3, reps: '10 each', rest: '60s' },
            { slot: 'Quads', defaultExercise: 'Leg Extension', sets: 3, reps: '15', rest: '45s' },
            { slot: 'Hamstrings', defaultExercise: 'Leg Curl', sets: 3, reps: '15', rest: '45s' },
          ]},
        ],
      },
    ],
  },

  // 19. Class Prep – Group Safe
  {
    id: 'class-group-safe',
    name: 'Class Prep — Group Safe',
    description: 'Build confidence for group fitness classes. Machine-based and bodyweight-friendly movements.',
    phases: ['foundation'],
    goals: ['general', 'conditioning'],
    frequencyOptions: [2, 3],
    structure: 'full_body',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Full Body — Class Prep',
        blocks: [
          { type: 'warmup', name: 'Dynamic Warm-Up', exercises: [
            { slot: 'Cardio', defaultExercise: 'Rowing Machine', sets: 1, reps: '3 min (easy)', rest: '30s' },
          ]},
          { type: 'work', name: 'Main Work', exercises: [
            { slot: 'Legs', defaultExercise: 'Leg Press', sets: 3, reps: '12', rest: '60s' },
            { slot: 'Push', defaultExercise: 'Chest Press Machine', sets: 3, reps: '12', rest: '60s' },
            { slot: 'Pull', defaultExercise: 'Lat Pulldown', sets: 3, reps: '12', rest: '60s' },
            { slot: 'Shoulders', defaultExercise: 'Shoulder Press Machine', sets: 3, reps: '12', rest: '60s' },
            { slot: 'Core', defaultExercise: 'Plank', sets: 3, reps: '30s', rest: '30s' },
          ]},
        ],
      },
    ],
  },

  // 20. Class Prep – Conditioning
  {
    id: 'class-conditioning',
    name: 'Class Prep — Conditioning',
    description: 'Build your cardio base for group fitness. Circuit-style with progressive intensity.',
    phases: ['foundation'],
    goals: ['fat_loss', 'conditioning'],
    frequencyOptions: [3],
    structure: 'circuit',
    classSafe: true,
    difficulty: 'beginner',
    weeks: 4,
    days: [
      {
        dayLabel: 'Conditioning A',
        blocks: [
          { type: 'warmup', name: 'Warm-Up', exercises: [
            { slot: 'Cardio', defaultExercise: 'Bike', sets: 1, reps: '3 min', rest: '30s' },
          ]},
          { type: 'work', name: 'Circuit — 3 Rounds', exercises: [
            { slot: 'Lower', defaultExercise: 'Goblet Squat', sets: 3, reps: '12', rest: '15s' },
            { slot: 'Push', defaultExercise: 'Push-Ups (knees ok)', sets: 3, reps: '10', rest: '15s' },
            { slot: 'Cardio', defaultExercise: 'Rowing Machine', sets: 3, reps: '200m', rest: '15s' },
            { slot: 'Pull', defaultExercise: 'TRX Row', sets: 3, reps: '10', rest: '15s' },
            { slot: 'Core', defaultExercise: 'Dead Bug', sets: 3, reps: '8 each', rest: '60s', notes: 'Rest 60s between rounds' },
          ]},
        ],
      },
      {
        dayLabel: 'Conditioning B',
        blocks: [
          { type: 'warmup', name: 'Warm-Up', exercises: [
            { slot: 'Cardio', defaultExercise: 'Cross Trainer', sets: 1, reps: '3 min', rest: '30s' },
          ]},
          { type: 'work', name: 'Circuit — 3 Rounds', exercises: [
            { slot: 'Hinge', defaultExercise: 'Kettlebell Deadlift', sets: 3, reps: '12', rest: '15s' },
            { slot: 'Press', defaultExercise: 'DB Shoulder Press', sets: 3, reps: '10', rest: '15s' },
            { slot: 'Cardio', defaultExercise: 'Battle Ropes', sets: 3, reps: '20s', rest: '15s' },
            { slot: 'Lunge', defaultExercise: 'Reverse Lunges', sets: 3, reps: '10 each', rest: '15s' },
            { slot: 'Core', defaultExercise: 'Plank', sets: 3, reps: '30s', rest: '60s', notes: 'Rest 60s between rounds' },
          ]},
        ],
      },
    ],
  },
];

// Helper: get unique goals from all programs
export const allGoals = [...new Set(suggestedPrograms.flatMap(p => p.goals))];
export const allStructures = [...new Set(suggestedPrograms.map(p => p.structure))];
export const allDifficulties = ['beginner', 'intermediate', 'advanced'] as const;
