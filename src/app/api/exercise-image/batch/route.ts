import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// POST — batch fetch cached image URLs for multiple exercise IDs
export async function POST(req: NextRequest) {
  const { exerciseIds } = await req.json();
  if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) {
    return NextResponse.json({ images: {} });
  }

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ images: {} });

  // Limit batch size
  const ids = exerciseIds.slice(0, 100);

  const { data, error } = await supabase
    .from('exercise_images')
    .select('exercise_id, image_url')
    .in('exercise_id', ids);

  if (error) {
    console.error('[ExerciseImage/batch] Supabase error:', error);
    return NextResponse.json({ images: {} });
  }

  const images: Record<string, string> = {};
  data?.forEach((row: any) => {
    images[row.exercise_id] = row.image_url;
  });

  return NextResponse.json({ images });
}
