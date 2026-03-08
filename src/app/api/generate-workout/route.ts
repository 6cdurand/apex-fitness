import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

// NOTE: groq client is created inside POST handler so env vars
// are read at request time (required for Netlify serverless functions)

// Equipment mapping for the prompt
const equipmentDescriptions: Record<string, string> = {
  full_gym: 'Full gym with barbells, dumbbells, cables, selectorized machines, benches, racks, leg press, hack squat, lat pulldown, cable row, chest press machine, shoulder press machine, leg extension, leg curl',
  home_dumbbells: 'Home gym with dumbbells and a bench only',
  bodyweight: 'Bodyweight only, no equipment',
  resistance_bands: 'Resistance bands and bodyweight',
  minimal: 'Minimal equipment: dumbbells and pull-up bar',
};

// Experience-specific rules
function getExperienceRules(expertise: string): string {
  switch (expertise) {
    case 'beginner':
      return `BEGINNER RULES (0-6 months, low confidence):
- Exercise selection: ≥80% machine-based (selectorized + cables) IF machines are available. Free weights ONLY if movement is simple + stable (e.g. DB bench supported, goblet squat to box).
- AVOID: heavy barbell compounds (back squat, deadlift, barbell row), complex Olympic lifts, high-skill plyometrics, heavy walking lunges, unstable/high-fall-risk moves.
- Single-leg work: use supported variations ONLY (split squat holding a rack, step-ups with rails).
- Rep range: Main lifts 10-15 reps, isolation 12-20 reps. RPE 6-8 (2-4 reps in reserve). NEVER program to failure.
- Sets: 2-3 per exercise (most often 3).
- If a machine exists for a movement pattern, ALWAYS prefer the machine:
  * Squat pattern → leg press or hack squat (NOT barbell squat)
  * Hinge pattern → seated/lying leg curl + back extension machine (NOT deadlift)
  * Horizontal press → chest press machine (NOT barbell bench press)
  * Vertical press → shoulder press machine (NOT overhead press)
  * Horizontal pull → seated cable row (NOT barbell row)
  * Vertical pull → lat pulldown (NOT pull-ups)
- Progression note in every exercise: "Double progression: if you hit the top of the rep range for all sets with clean form, increase weight by the smallest increment next time."`;
    case 'intermediate':
      return `INTERMEDIATE RULES (6-24 months):
- Exercise selection: 50-70% machines/cables, 30-50% free weights.
- Add 1-2 key free-weight compounds (bench press, squat, RDL) IF technique is solid.
- Still prefer machines for accessory work (isolation, cable work).
- Rep range: Main compound lifts 6-12 reps. Accessories 10-15 reps. RPE 7-9.
- Sets: 3-4 per exercise.
- Progression note: "Double progression: hit top of rep range for all sets → increase load. If form breaks, reduce load and stay in range."`;
    case 'advanced':
      return `ADVANCED RULES (24+ months):
- Exercise selection based on goal. Machines still used for hypertrophy/accessory work. More variation allowed.
- Rep range: Main lifts 3-10 reps depending on goal. Accessories 8-20 reps. RPE 7-9.
- Sets: 3-5 per exercise.
- Progression note: "Progressive overload: add weight, reps, or sets systematically. Planned deload every 4th week."`;
    default:
      return '';
  }
}

// Goal-specific rules
function getGoalRules(goal: string): string {
  switch (goal) {
    case 'strength':
      return 'GOAL: Strength. Heavy compounds first, lower reps (3-6 for main lifts), longer rest (2-3 min). Focus on progressive overload.';
    case 'hypertrophy':
      return 'GOAL: Hypertrophy. Moderate weight, 8-12 reps for compounds, 10-15 for isolation. Rest 60-90s. Mix compound + isolation. Volume is key.';
    case 'endurance':
      return 'GOAL: Muscular Endurance. Lighter weight, 15-20 reps, shorter rest (30-45s), circuit-style elements allowed.';
    case 'weight_loss':
      return 'GOAL: Fat Loss. Metabolic conditioning focus — supersets, compound movements, minimal rest (30-60s). Include a cardio finisher.';
    default:
      return 'GOAL: General fitness. Balanced approach with moderate volume and varied exercises.';
  }
}

export async function POST(req: NextRequest) {
  try {
    const { goal, expertise, equipment, duration, programMode, days, selectedDays } = await req.json();

    if (!goal || !expertise || !equipment) {
      return NextResponse.json(
        { error: 'Missing required fields: goal, expertise, equipment' },
        { status: 400 }
      );
    }

    const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    const debugInfo = {
      hasGroqKey: !!process.env.GROQ_API_KEY,
      keyLength: process.env.GROQ_API_KEY?.length || 0,
      keyPrefix: process.env.GROQ_API_KEY?.substring(0, 6) || 'NONE',
      isNetlify: !!process.env.NETLIFY,
      nodeEnv: process.env.NODE_ENV,
      matchingKeys: Object.keys(process.env).filter(k => k.toLowerCase().includes('groq')),
    };
    console.log('[generate-workout] ENV check:', JSON.stringify(debugInfo));

    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not found in runtime environment.', debug: debugInfo },
        { status: 500 }
      );
    }

    const groq = createGroq({ apiKey: groqApiKey });

    const equipmentDesc = equipmentDescriptions[equipment] || equipment;
    const durationMinutes = duration || 60;
    const isProgram = programMode && days && days > 1;

    // Build the prompt
    const prompt = isProgram
      ? buildProgramPrompt(goal, expertise, equipmentDesc, durationMinutes, days, selectedDays)
      : buildWorkoutPrompt(goal, expertise, equipmentDesc, durationMinutes);

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
      temperature: 0.3,
    });

    // Parse and validate
    let result;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error('[generate-workout] Failed to parse AI response:', text);
      return NextResponse.json(
        { error: 'Failed to parse workout. Please try again.' },
        { status: 500 }
      );
    }

    if (isProgram) {
      // Validate program structure
      if (!result.days || !Array.isArray(result.days) || result.days.length === 0) {
        return NextResponse.json(
          { error: 'Invalid program structure. Please try again.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ program: result });
    } else {
      // Validate single workout
      if (!result.blocks || !Array.isArray(result.blocks) || result.blocks.length === 0) {
        return NextResponse.json(
          { error: 'Invalid workout structure. Please try again.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ workout: result });
    }
  } catch (error: any) {
    console.error('[generate-workout] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate workout' },
      { status: 500 }
    );
  }
}

// ============ SINGLE WORKOUT PROMPT ============

function buildWorkoutPrompt(goal: string, expertise: string, equipmentDesc: string, durationMinutes: number): string {
  return `You are a certified personal trainer. Generate a SINGLE workout session as JSON.

CLIENT PROFILE:
- Goal: ${goal}
- Experience: ${expertise}
- Equipment: ${equipmentDesc}
- Duration: ~${durationMinutes} minutes

${getExperienceRules(expertise)}

${getGoalRules(goal)}

EXERCISE SAFETY RULES:
- No unstable or high-fall-risk moves as staples for beginners.
- Single-leg work: supported variations first (split squat holding a rack, step-ups with rails).
- Never program to failure for beginners; cap at 1-2 reps in reserve minimum for all levels.

EXERCISE ID WHITELIST (use exact IDs):
MACHINES: leg-press, hack-squat, leg-extension, leg-curl, lying-leg-curl, seated-calf-raises, machine-chest-press, pec-deck, machine-row, lat-pulldown, close-grip-pulldown, cable-row, cable-flyes, cable-lateral-raises, cable-curl, tricep-pushdown, rope-pushdown, cable-overhead-extension, reverse-pec-deck, face-pulls, straight-arm-pulldown, cable-woodchops, hyperextensions
FREE WEIGHTS: bench-press, incline-bench-press, decline-bench-press, dumbbell-bench-press, incline-dumbbell-press, dumbbell-flyes, overhead-press, seated-overhead-press, dumbbell-shoulder-press, arnold-press, lateral-raises, front-raises, barbell-curl, ez-bar-curl, dumbbell-curl, hammer-curls, incline-dumbbell-curl, preacher-curl, concentration-curl, close-grip-bench, skull-crushers, overhead-tricep-extension, kickbacks, barbell-row, pendlay-row, dumbbell-row, t-bar-row, deadlift, sumo-deadlift, romanian-deadlift, dumbbell-rdl, back-squat, front-squat, goblet-squat, bulgarian-split-squat, lunges, walking-lunges, step-ups, hip-thrust, glute-bridge, calf-raises, shrugs, dumbbell-shrugs, upright-rows, kettlebell-swings
BODYWEIGHT: push-ups, diamond-pushups, chest-dips, tricep-dips, pull-ups, chin-ups, plank, side-plank, crunches, russian-twists, leg-raises, hanging-leg-raises, ab-wheel, bicycle-crunches, dead-bugs, mountain-climbers, burpees, box-jumps, jump-rope
CARDIO: treadmill-run, treadmill-walk, cycling, rowing-machine, elliptical, stair-climber, battle-ropes

OUTPUT STRUCTURE:
1. Warm-up block (5-8 min, 3-4 exercises: dynamic stretches + activation)
2. Strength block (big compound lifts first, then accessories — 4-6 exercises)
3. Optional finisher (5-10 min, only if recovery allows — cardio or metabolic)
4. Each exercise MUST have a "notes" field with: coaching cue + progression instruction (e.g. "if you hit 12 reps on all sets with clean form, add 2.5kg next time")

OUTPUT FORMAT (strict JSON, no markdown, no extra text):
{
  "name": "Workout Name",
  "description": "Brief description",
  "estimatedMinutes": ${durationMinutes},
  "blocks": [
    {
      "name": "Block Name",
      "type": "warmup|strength|circuit|cardio",
      "exercises": [
        {
          "exerciseId": "exact-id-from-whitelist",
          "name": "Exercise Name",
          "sets": 3,
          "reps": 10,
          "restSeconds": 60,
          "notes": "Coaching cue. Progression: if you hit top reps on all sets, increase weight next session."
        }
      ]
    }
  ]
}

Generate now. Output ONLY valid JSON.`;
}

// ============ MULTI-DAY PROGRAM PROMPT ============

function buildProgramPrompt(goal: string, expertise: string, equipmentDesc: string, durationMinutes: number, days: number, selectedDays?: string[]): string {
  const dayLabels = selectedDays && selectedDays.length > 0
    ? selectedDays.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
    : `${days} training days per week`;

  return `You are a certified personal trainer. Generate a MULTI-DAY training program as JSON.

CLIENT PROFILE:
- Goal: ${goal}
- Experience: ${expertise}
- Equipment: ${equipmentDesc}
- Session duration: ~${durationMinutes} minutes
- Training days: ${dayLabels} (${days} days/week)

${getExperienceRules(expertise)}

${getGoalRules(goal)}

PROGRAM DESIGN RULES:
1. Split training across ${days} days to cover all major muscle groups with appropriate volume.
2. Each day should have a clear focus (e.g. "Upper Body", "Lower Body", "Push", "Pull", "Full Body").
3. Don't repeat the same exercises across days — use variations instead (e.g. bench press Day 1, incline DB press Day 2).
4. Balance pushing and pulling volume (roughly equal sets for push vs pull).
5. Include warm-up block for every day (5-8 min).
6. Compound movements first, isolation accessories after.
7. Program refresh: designed for a 4-week block. After 4 weeks, rotate machine angles/grips/accessories while keeping same movement patterns.
8. Deload: Week 4 should reduce sets by 30-40% or reduce load. Add a note about this.

EXERCISE SAFETY RULES:
- No unstable or high-fall-risk moves for beginners.
- Single-leg work: supported variations first.
- Never to failure for beginners; cap 1-2 reps in reserve for all.

EXERCISE ID WHITELIST (use exact IDs):
MACHINES: leg-press, hack-squat, leg-extension, leg-curl, lying-leg-curl, seated-calf-raises, machine-chest-press, pec-deck, machine-row, lat-pulldown, close-grip-pulldown, cable-row, cable-flyes, cable-lateral-raises, cable-curl, tricep-pushdown, rope-pushdown, cable-overhead-extension, reverse-pec-deck, face-pulls, straight-arm-pulldown, cable-woodchops, hyperextensions
FREE WEIGHTS: bench-press, incline-bench-press, decline-bench-press, dumbbell-bench-press, incline-dumbbell-press, dumbbell-flyes, overhead-press, seated-overhead-press, dumbbell-shoulder-press, arnold-press, lateral-raises, front-raises, barbell-curl, ez-bar-curl, dumbbell-curl, hammer-curls, incline-dumbbell-curl, preacher-curl, concentration-curl, close-grip-bench, skull-crushers, overhead-tricep-extension, kickbacks, barbell-row, pendlay-row, dumbbell-row, t-bar-row, deadlift, sumo-deadlift, romanian-deadlift, dumbbell-rdl, back-squat, front-squat, goblet-squat, bulgarian-split-squat, lunges, walking-lunges, step-ups, hip-thrust, glute-bridge, calf-raises, shrugs, dumbbell-shrugs, upright-rows, kettlebell-swings
BODYWEIGHT: push-ups, diamond-pushups, chest-dips, tricep-dips, pull-ups, chin-ups, plank, side-plank, crunches, russian-twists, leg-raises, hanging-leg-raises, ab-wheel, bicycle-crunches, dead-bugs, mountain-climbers, burpees, box-jumps, jump-rope
CARDIO: treadmill-run, treadmill-walk, cycling, rowing-machine, elliptical, stair-climber, battle-ropes

OUTPUT FORMAT (strict JSON, no markdown, no extra text):
{
  "name": "Program Name",
  "description": "Brief program description",
  "goal": "${goal}",
  "expertise": "${expertise}",
  "daysPerWeek": ${days},
  "blockLengthWeeks": 4,
  "deloadWeek": 4,
  "days": [
    {
      "dayNumber": 1,
      "dayLabel": "Day 1 - Focus Area",
      "scheduledDay": "${selectedDays?.[0] || 'monday'}",
      "blocks": [
        {
          "name": "Block Name",
          "type": "warmup|strength|circuit|cardio",
          "exercises": [
            {
              "exerciseId": "exact-id",
              "name": "Exercise Name",
              "sets": 3,
              "reps": 10,
              "restSeconds": 60,
              "notes": "Coaching cue + progression instruction"
            }
          ]
        }
      ]
    }
  ],
  "progressionNotes": "Overall progression strategy for this 4-week block",
  "deloadInstructions": "Week 4: reduce sets by 30-40% or reduce load, keep reps easy"
}

Generate ${days} training days now. Output ONLY valid JSON.`;
}
