import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { exerciseId, exerciseName, url, note, submittedBy } = body;

    if (!exerciseId || !url) {
      return NextResponse.json({ error: 'exerciseId and url required' }, { status: 400 });
    }

    // Best-effort persist to a logging table. Falls back to console.log if table missing.
    try {
      await supabase.from('exercise_video_suggestions').insert({
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        suggested_url: url,
        note: note ?? null,
        submitted_by: submittedBy ?? null,
      });
    } catch (e: any) {
      console.warn('[exercise-suggestion] table missing or insert failed:', e?.message || e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bad request' }, { status: 400 });
  }
}
