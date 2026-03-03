import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

// POST /api/health-data — Receive health data from native iOS/Android app
// Apple HealthKit or Google Health Connect pushes data here
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, provider, data } = body;

    if (!userId || !provider || !data) {
      return NextResponse.json({ error: 'Missing required fields: userId, provider, data' }, { status: 400 });
    }

    if (!['apple_health', 'google_health'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider. Must be apple_health or google_health' }, { status: 400 });
    }

    // Validate data shape
    const { date, steps, calories, heartRate, sleep, activeMinutes } = data;
    if (!date) {
      return NextResponse.json({ error: 'data.date is required' }, { status: 400 });
    }

    // Store in Supabase
    if (supabase) {
      const { error } = await supabase
        .from('health_data')
        .upsert({
          user_id: userId,
          provider,
          date,
          steps: steps || null,
          calories: calories || null,
          heart_rate_avg: heartRate?.avg || null,
          heart_rate_max: heartRate?.max || null,
          heart_rate_resting: heartRate?.resting || null,
          sleep_hours: sleep?.hours || null,
          sleep_quality: sleep?.quality || null,
          active_minutes: activeMinutes || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider,date' });

      if (error) {
        console.error('[Health Data] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to store health data' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Health Data] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/health-data — Retrieve health data for a user
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    let query = supabase
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query.limit(90);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[Health Data] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
