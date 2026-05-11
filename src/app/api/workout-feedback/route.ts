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
      // 2026-05-11 fix #5: block-level aggregate so the coach can talk
      // about cardio / circuit / warmup work even when totalVolume is 0
      // (i.e. non-strength sessions).
      blocksSummary,
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

    // Build volume delta string — only relevant if there was strength work.
    let volumeDeltaStr = '';
    if (volumeDelta && typeof volumeDelta.deltaPct === 'number' && volumeDelta.prevAvgVolume > 0) {
      const sign = volumeDelta.deltaPct >= 0 ? '+' : '';
      volumeDeltaStr = `${sign}${Math.round(volumeDelta.deltaPct)}% vs your last 4 ${workoutName || 'workouts'} (avg ${Math.round(volumeDelta.prevAvgVolume)}kg)`;
    }

    // 2026-05-11 fix #5: Build block summary strings.
    let blockSummaryLines: string[] = [];
    let workoutShape: 'strength' | 'cardio' | 'circuit' | 'mixed' | 'unknown' = 'unknown';
    if (blocksSummary && typeof blocksSummary === 'object') {
      const cardio = Array.isArray(blocksSummary.cardio) ? blocksSummary.cardio : [];
      const circuit = Array.isArray(blocksSummary.circuit) ? blocksSummary.circuit : [];
      const warmup = typeof blocksSummary.warmupCount === 'number' ? blocksSummary.warmupCount : 0;
      const totalKm = typeof blocksSummary.totalCardioDistanceKm === 'number' ? blocksSummary.totalCardioDistanceKm : 0;
      const totalMin = typeof blocksSummary.totalCardioMinutes === 'number' ? blocksSummary.totalCardioMinutes : 0;
      const totalRounds = typeof blocksSummary.totalCircuitRounds === 'number' ? blocksSummary.totalCircuitRounds : 0;

      if (cardio.length > 0) {
        const parts = cardio.slice(0, 3).map((c: any) => {
          const distStr = c.distanceMeters >= 100 ? `${(c.distanceMeters / 1000).toFixed(2)}km` : '';
          const minStr = c.seconds >= 30 ? `${Math.round(c.seconds / 60)}min` : '';
          const detail = [distStr, minStr].filter(Boolean).join(' · ');
          return `${c.activity || 'cardio'} (${c.mode}${detail ? ', ' + detail : ''})`;
        });
        blockSummaryLines.push(`- Cardio: ${parts.join('; ')}${totalKm > 0 ? ` — total ${totalKm.toFixed(2)}km` : ''}${totalMin > 0 ? ` over ${Math.round(totalMin)}min` : ''}`);
      }
      if (circuit.length > 0) {
        const parts = circuit.slice(0, 3).map((c: any) =>
          `${c.style || 'rounds'} ${c.roundsCompleted}${c.roundsTarget ? `/${c.roundsTarget}` : ''} rounds`
        );
        blockSummaryLines.push(`- Circuit: ${parts.join('; ')}${totalRounds > 0 ? ` — ${totalRounds} total rounds` : ''}`);
      }
      if (warmup > 0) {
        blockSummaryLines.push(`- Warm-up/cool-down: ${warmup} block${warmup > 1 ? 's' : ''} completed`);
      }

      const hasStrength = (setCount || 0) > 0 && (totalVolume || 0) > 0;
      const hasCardio = cardio.length > 0;
      const hasCircuit = circuit.length > 0;
      workoutShape =
        hasStrength && (hasCardio || hasCircuit) ? 'mixed' :
        hasCardio && !hasStrength && !hasCircuit ? 'cardio' :
        hasCircuit && !hasStrength && !hasCardio ? 'circuit' :
        hasStrength ? 'strength' :
        'unknown';
    }
    const blockSummaryStr = blockSummaryLines.join('\n');

    // 2026-05-11 fix #5: Adapt the prompt for non-strength sessions.
    // Original prompt assumed every workout had strength volume + PRs,
    // which produced "zero sets / 100% volume drop" for pure cardio.
    const shapeGuidance =
      workoutShape === 'cardio'
        ? 'This is a CARDIO session — talk about distance, pace, duration, and aerobic effort. Do NOT mention sets, volume, or strength PRs.'
        : workoutShape === 'circuit'
          ? 'This is a CIRCUIT/CONDITIONING session — talk about rounds completed, intensity, and conditioning. Do NOT lament low volume or sets.'
          : workoutShape === 'mixed'
            ? 'This is a MIXED session (strength + cardio/circuit). Highlight whichever was the headline component.'
            : workoutShape === 'strength'
              ? 'This is a STRENGTH session. Focus on volume, PRs, set quality.'
              : 'Workout shape unclear — celebrate completion and reference what was actually done.';

    const prompt = `You are an encouraging AI fitness coach. Give post-workout feedback as EXACTLY 3 short lines (total ~60 words, under 280 chars):

LINE 1 — HEADLINE: The single biggest achievement this workout (PB with exercise name, distance milestone, circuit completion, or completion of a tough program day).
LINE 2 — KEY STAT: One concrete number that matters most for THIS session's shape (volume delta %, 1RM improvement, total km, rounds completed, or efficient duration).
LINE 3 — MOTIVATION: A forward-looking, personal push (no generic platitudes — reference something specific from the data).

${shapeGuidance}

WORKOUT DATA:
- Name: ${workoutName || 'Workout'}
- Duration: ${durationMin} minutes
- Total strength volume: ${vol}kg
- Exercises: ${exerciseCount || 0}
- Sets completed: ${setCount || 0}
- New PRs: ${pbCount || 0}
- Medals earned: ${medalCount || 0}
${pbDetailsStr ? `- PR details: ${pbDetailsStr}` : ''}
${volumeDeltaStr ? `- Volume trend: ${volumeDeltaStr}` : ''}
${isProgramWorkout && programDayLabel ? `- Program day: ${programDayLabel}` : ''}
${exercises ? `- Key exercises: ${exercises}` : ''}
${blockSummaryStr ? blockSummaryStr : ''}

RULES:
- Write exactly 3 lines separated by single newlines (no bullet characters, no numbering).
- Each line under 100 characters.
- Be specific to THIS workout's data — never generic.
- If totalVolume is 0 but there was cardio/circuit work, DO NOT say "zero sets" or "volume dropped". Focus on what was actually done.
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
