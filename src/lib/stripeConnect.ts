// Stripe Connect Integration
// Handles Express account onboarding for trainers to accept payments

const STRIPE_API = 'https://api.stripe.com/v1';

export function getStripeConnectUrl(state: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/stripe-connect/callback`;

  if (!clientId) {
    throw new Error('STRIPE_CONNECT_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: redirectUri,
    state,
    'stripe_user[business_type]': 'individual',
    'stripe_user[product_description]': 'Personal training and fitness coaching services',
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeStripeCode(code: string): Promise<{
  stripe_user_id: string;
  access_token: string;
  refresh_token: string;
  livemode: boolean;
}> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const response = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_secret: secretKey,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stripe token exchange failed: ${error}`);
  }

  return response.json();
}

export async function createPaymentIntent(
  connectedAccountId: string,
  amount: number, // in cents
  currency: string = 'nzd',
  description: string,
  metadata?: Record<string, string>
): Promise<any> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const params = new URLSearchParams({
    amount: String(amount),
    currency,
    description,
    'transfer_data[destination]': connectedAccountId,
  });

  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      params.append(`metadata[${key}]`, value);
    });
  }

  const response = await fetch(`${STRIPE_API}/payment_intents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create payment intent: ${error}`);
  }

  return response.json();
}

export async function getAccountStatus(accountId: string): Promise<{
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const response = await fetch(`${STRIPE_API}/accounts/${accountId}`, {
    headers: { 'Authorization': `Bearer ${secretKey}` },
  });

  if (!response.ok) {
    throw new Error('Failed to get account status');
  }

  const data = await response.json();
  return {
    charges_enabled: data.charges_enabled,
    payouts_enabled: data.payouts_enabled,
    details_submitted: data.details_submitted,
  };
}

export async function disconnectAccount(accountId: string): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!secretKey || !clientId) {
    throw new Error('Stripe credentials not configured');
  }

  const response = await fetch('https://connect.stripe.com/oauth/deauthorize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      stripe_user_id: accountId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to disconnect Stripe account');
  }
}
