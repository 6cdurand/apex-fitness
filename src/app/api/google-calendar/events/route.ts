import { NextRequest, NextResponse } from 'next/server';
import { createCalendarEvent, listCalendarEvents, deleteCalendarEvent, refreshAccessToken } from '@/lib/googleCalendar';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

async function getValidAccessToken(userId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
    .single();

  if (error || !data) return null;

  // Check if token is expired
  const expiresAt = new Date(data.expires_at);
  if (expiresAt > new Date()) {
    return data.access_token;
  }

  // Refresh the token
  try {
    const refreshed = await refreshAccessToken(data.refresh_token);
    
    // Update in Supabase
    await supabase
      .from('user_integrations')
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google_calendar');

    return refreshed.access_token;
  } catch {
    return null;
  }
}

// POST /api/google-calendar/events — Create a calendar event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, summary, description, startDateTime, endDateTime, timeZone, recurrence } = body;

    if (!userId || !summary || !startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
    }

    const event = await createCalendarEvent(accessToken, {
      summary,
      description,
      start: { dateTime: startDateTime, timeZone: timeZone || 'Pacific/Auckland' },
      end: { dateTime: endDateTime, timeZone: timeZone || 'Pacific/Auckland' },
      recurrence,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
        ],
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error('[Google Calendar Events] Create error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/google-calendar/events — List calendar events
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const timeMin = request.nextUrl.searchParams.get('timeMin');
    const timeMax = request.nextUrl.searchParams.get('timeMax');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
    }

    const now = new Date();
    const defaultMin = timeMin || now.toISOString();
    const defaultMax = timeMax || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const events = await listCalendarEvents(accessToken, defaultMin, defaultMax);
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('[Google Calendar Events] List error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/google-calendar/events — Delete a calendar event
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eventId } = body;

    if (!userId || !eventId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
    }

    await deleteCalendarEvent(accessToken, eventId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Google Calendar Events] Delete error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
