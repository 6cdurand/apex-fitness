import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { exerciseId, exerciseName } = await req.json();

  if (!exerciseId || !exerciseName) {
    return NextResponse.json({ error: 'exerciseId and exerciseName required' }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 });
  }

  // Get exercise details for better context
  let exerciseContext = '';
  try {
    const { getExerciseById } = await import('@/lib/exercises');
    const exercise = getExerciseById(exerciseId);
    if (exercise) {
      exerciseContext = `Equipment: ${exercise.equipment}. Primary muscles: ${exercise.primaryMuscles.join(', ')}. Category: ${exercise.category}.`;
      if (exercise.instructions) {
        exerciseContext += ` Basic instructions: ${exercise.instructions}`;
      }
    }
  } catch {}

  const systemPrompt = `You are a certified personal trainer and exercise science expert. Generate detailed form guidance for exercises. Always respond with valid JSON only, no markdown.`;

  const userPrompt = `Generate a detailed form guide for the exercise: "${exerciseName}".
${exerciseContext}

Respond with ONLY this JSON structure (no markdown, no code blocks):
{
  "setup": "One paragraph describing the starting position and setup",
  "execution": ["Step 1...", "Step 2...", "Step 3...", "Step 4..."],
  "commonMistakes": ["Mistake 1...", "Mistake 2...", "Mistake 3..."],
  "tips": ["Pro tip 1...", "Pro tip 2..."]
}

Keep each step concise (1-2 sentences). Include 3-5 execution steps, 2-4 common mistakes, and 2-3 pro tips.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[ExerciseForm] Groq error:', err);
      return NextResponse.json({ error: 'AI generation failed' }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try finding JSON object in the text
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        }
      }
    }

    if (!parsed || !parsed.setup) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
    }

    return NextResponse.json({
      setup: parsed.setup || '',
      execution: parsed.execution || [],
      commonMistakes: parsed.commonMistakes || [],
      tips: parsed.tips || [],
    });
  } catch (err: any) {
    console.error('[ExerciseForm] Error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
