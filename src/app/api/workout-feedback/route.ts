import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const {
      workoutName,
      duration,
      totalVolume,
      exerciseCount,
      setCount,
      pbCount,
      medalCount,
      exercises,
      pbDetails, // Array of { name, weight, reps, oneRepMax, prevOneRepMax, improvementPct }
      volumeDelta, // { prevAvgVolume, deltaPct } — vs avg of last 4 workouts of same name/template
      isProgramWorkout,
      programDayLabel,
    } = await req.json();

    const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const groq = createGroq({ apiKey: groqApiKey });
    const durationMin = Math.round((duration || 0) / 60);
    const vol = Math.round(totalVolume || 0);

    // Build PB details string
    let pbDetailsStr = '';
    if (Array.isArray(pbDetails) && pbDetails.length > 0) {
      pbDetailsStr = pbDetails
        .slice(0, 3)
        .map((pb: any) => {
          const impr = pb.improvementPct ? ` (+${Math.round(pb.improvementPct)}%)` : '';
          return `${pb.name}: ${pb.weight}kg×${pb.reps} → ${Math.round(pb.oneRepMax)}kg 1RM${impr}`;
        })
        .join('; ');
    }

    // Build volume delta string
    let volumeDeltaStr = '';
    if (volumeDelta && typeof volumeDelta.deltaPct === 'number' && volumeDelta.prevAvgVolume > 0) {
      const sign = volumeDelta.deltaPct >= 0 ? '+' : '';
      volumeDeltaStr = `${sign}${Math.round(volumeDelta.deltaPct)}% vs your last 4 ${workoutName || 'workouts'} (avg ${Math.round(volumeDelta.prevAvgVolume)}kg)`;
    }

    const prompt = `You are an encouraging AI fitness coach. Give post-workout feedback as EXACTLY 3 short lines (total ~60 words, under 280 chars):

LINE 1 — HEADLINE: The single biggest achievement this workout (a PB with exercise name, or a volume milestone, or completion of a tough program day).
LINE 2 — KEY STAT: One concrete number that matters most (volume delta %, 1RM improvement, PR count, or efficient duration).
LINE 3 — MOTIVATION: A forward-looking, personal push (no generic platitudes — reference something specific).

WORKOUT DATA:
- Name: ${workoutName || 'Workout'}
- Duration: ${durationMin} minutes
- Total volume: ${vol}kg
- Exercises: ${exerciseCount || 0}
- Sets completed: ${setCount || 0}
- New PRs: ${pbCount || 0}
- Medals earned: ${medalCount || 0}
${pbDetailsStr ? `- PR details: ${pbDetailsStr}` : ''}
${volumeDeltaStr ? `- Volume trend: ${volumeDeltaStr}` : ''}
${isProgramWorkout && programDayLabel ? `- Program day: ${programDayLabel}` : ''}
${exercises ? `- Key exercises: ${exercises}` : ''}

RULES:
- Write exactly 3 lines separated by single newlines (no bullet characters, no numbering).
- Each line under 100 characters.
- Be specific to THIS workout's data — never generic.
- No hashtags, no emojis.
- Output ONLY the 3 lines, nothing else.`;

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
      temperature: 0.7,
    });

    return NextResponse.json({ feedback: text.trim() });
  } catch (error: any) {
    console.error('[workout-feedback] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate feedback' }, { status: 500 });
  }
}
