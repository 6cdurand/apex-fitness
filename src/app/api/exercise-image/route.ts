import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildExercisePrompt } from '@/lib/exerciseImageGen';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Dynamic import of exercise library to get exercise details
async function getExerciseById(exerciseId: string) {
  const { exerciseLibraryMap } = await import('@/lib/exercises');
  return exerciseLibraryMap.get(exerciseId) || null;
}

// ---------------------------------------------------------------------------
// GET  — fetch cached image for an exercise
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const exerciseId = req.nextUrl.searchParams.get('exerciseId');
  if (!exerciseId) {
    return NextResponse.json({ error: 'exerciseId required' }, { status: 400 });
  }

  // Check cache in Supabase
  const { data } = await supabase
    .from('exercise_images')
    .select('image_url')
    .eq('exercise_id', exerciseId)
    .single();

  if (data?.image_url) {
    return NextResponse.json({ imageUrl: data.image_url, cached: true });
  }

  return NextResponse.json({ imageUrl: null, cached: false });
}

// ---------------------------------------------------------------------------
// POST — generate (or return cached) AI image for an exercise
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const { exerciseId } = await req.json();
  if (!exerciseId) {
    return NextResponse.json({ error: 'exerciseId required' }, { status: 400 });
  }

  // 1. Check Supabase cache first
  const { data: cached } = await supabase
    .from('exercise_images')
    .select('image_url')
    .eq('exercise_id', exerciseId)
    .single();

  if (cached?.image_url) {
    return NextResponse.json({ imageUrl: cached.image_url, cached: true });
  }

  // 2. Look up exercise details
  const exercise = await getExerciseById(exerciseId);
  if (!exercise) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
  }

  // 3. Check API key
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured. Add it to .env.local to enable AI image generation.' },
      { status: 503 }
    );
  }

  // 4. Build prompt and call DALL-E
  const prompt = buildExercisePrompt({
    name: exercise.name,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.equipment,
    instructions: exercise.instructions,
  });

  try {
    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
      }),
    });

    if (!dalleRes.ok) {
      const err = await dalleRes.json().catch(() => ({}));
      console.error('[ExerciseImage] DALL-E error:', err);
      return NextResponse.json(
        { error: err?.error?.message || 'Image generation failed' },
        { status: 502 }
      );
    }

    const dalleData = await dalleRes.json();
    const generatedUrl = dalleData.data?.[0]?.url;

    if (!generatedUrl) {
      return NextResponse.json({ error: 'No image returned' }, { status: 502 });
    }

    // 5. Download the image and upload to Supabase Storage for permanence
    let permanentUrl = generatedUrl;
    try {
      const imgRes = await fetch(generatedUrl);
      const imgBlob = await imgRes.blob();
      const imgBuffer = Buffer.from(await imgBlob.arrayBuffer());
      const filePath = `exercise-images/${exerciseId}.png`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, imgBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);
        permanentUrl = publicUrlData.publicUrl;
      }
    } catch (storageErr) {
      // If storage upload fails, we still have the DALL-E URL (valid ~1 hour)
      console.warn('[ExerciseImage] Storage upload failed, using temp URL:', storageErr);
    }

    // 6. Cache in Supabase table
    await supabase.from('exercise_images').upsert({
      exercise_id: exerciseId,
      exercise_name: exercise.name,
      image_url: permanentUrl,
      prompt,
      provider: 'dall-e-3',
      generated_at: new Date().toISOString(),
    });

    return NextResponse.json({ imageUrl: permanentUrl, cached: false });

  } catch (err: any) {
    console.error('[ExerciseImage] Generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
