import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthUrl } from '@/lib/googleCalendar';

// GET /api/auth/google-calendar — Initiates Google Calendar OAuth flow
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Encode userId in state so we can associate tokens after callback
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');
    const authUrl = getGoogleOAuthUrl(state);

    return NextResponse.json({ url: authUrl });
  } catch (error: any) {
    console.error('[Google Calendar Auth] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
