import { NextRequest, NextResponse } from 'next/server';
import { getStripeConnectUrl } from '@/lib/stripeConnect';

// GET /api/auth/stripe-connect — Initiates Stripe Connect OAuth flow
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');
    const authUrl = getStripeConnectUrl(state);

    return NextResponse.json({ url: authUrl });
  } catch (error: any) {
    console.error('[Stripe Connect Auth] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
