import { NextRequest, NextResponse } from 'next/server';
import { exchangeStripeCode } from '@/lib/stripeConnect';
import { createClient } from '@supabase/supabase-js';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

// GET /api/auth/stripe-connect/callback — Handles Stripe Connect OAuth callback
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    console.error('[Stripe Connect Callback] OAuth error:', error);
    return NextResponse.redirect(`${appUrl}/settings?stripe=error&reason=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?stripe=error&reason=missing_params`);
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for Stripe account details
    const stripeData = await exchangeStripeCode(code);

    // Store in Supabase
    if (supabase) {
      await supabase
        .from('user_integrations')
        .upsert({
          user_id: userId,
          provider: 'stripe_connect',
          access_token: stripeData.access_token,
          refresh_token: stripeData.refresh_token,
          provider_account_id: stripeData.stripe_user_id,
          connected: true,
          metadata: { livemode: stripeData.livemode },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });
    }

    const callbackData = encodeURIComponent(JSON.stringify({
      provider: 'stripe',
      accountId: stripeData.stripe_user_id,
      connected: true,
    }));

    return NextResponse.redirect(`${appUrl}/settings?stripe=success&data=${callbackData}`);
  } catch (err: any) {
    console.error('[Stripe Connect Callback] Error:', err.message);
    return NextResponse.redirect(`${appUrl}/settings?stripe=error&reason=exchange_failed`);
  }
}
