import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getUserInfo } from '@/lib/googleCalendar';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

// GET /api/auth/google-calendar/callback — Handles OAuth callback
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    console.error('[Google Calendar Callback] OAuth error:', error);
    return NextResponse.redirect(`${appUrl}/settings?gcal=error&reason=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?gcal=error&reason=missing_params`);
  }

  try {
    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get Google user info (email)
    const googleUser = await getUserInfo(tokens.access_token);

    // Store tokens in Supabase
    if (supabase) {
      const { error: upsertError } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: userId,
          provider: 'google_calendar',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          provider_email: googleUser.email,
          provider_name: googleUser.name,
          connected: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });

      if (upsertError) {
        console.error('[Google Calendar Callback] Supabase error:', upsertError.message);
        // Fall back to localStorage-based approach via query params
      }
    }

    // Redirect back to settings with success + token info encoded for client-side storage
    const callbackData = encodeURIComponent(JSON.stringify({
      provider: 'calendar',
      email: googleUser.email,
      name: googleUser.name,
      connected: true,
    }));

    return NextResponse.redirect(`${appUrl}/settings?gcal=success&data=${callbackData}`);
  } catch (err: any) {
    console.error('[Google Calendar Callback] Error:', err.message);
    return NextResponse.redirect(`${appUrl}/settings?gcal=error&reason=token_exchange_failed`);
  }
}
