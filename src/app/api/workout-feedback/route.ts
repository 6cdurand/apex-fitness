import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { workoutName, duration, totalVolume, exerciseCount, setCount, pbCount, medalCount, exercises } = await req.json();

    const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const groq = createGroq({ apiKey: groqApiKey });
    const durationMin = Math.round((duration || 0) / 60);
    const vol = Math.round(totalVolume || 0);

    const prompt = `You are an encouraging AI fitness coach. Give a SHORT, personalized post-workout feedback message (2-3 sentences max, under 200 characters total).

WORKOUT JUST COMPLETED:
- Name: ${workoutName}
- Duration: ${durationMin} minutes
- Total Volume: ${vol}kg
- Exercises: ${exerciseCount}
- Sets completed: ${setCount}
- New PRs: ${pbCount}
- Medals earned: ${medalCount}
${exercises ? `- Key exercises: ${exercises}` : ''}

RULES:
- Be concise, warm and motivating
- Reference specific workout stats naturally
- If they hit PRs, celebrate them
- If volume is high (>8000kg), acknowledge the effort
- If session was short (<20min), praise efficiency
- No generic advice. Be specific to THIS workout.
- Do NOT use hashtags or emojis
- Output ONLY the feedback text, nothing else`;

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
