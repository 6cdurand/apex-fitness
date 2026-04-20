import { NextRequest, NextResponse } from 'next/server';
import { claimInvitation } from '@/server/identity/inviteService';

/**
 * Public but token-guarded route for claiming a client invitation.
 *
 * Body:
 *   {
 *     token: string;
 *     newPassword?: string;  // required for email+password claims
 *   }
 *
 * Returns the canonical user id + trainer id + (if newly created) the
 * password that was set so the client can sign the user in with it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : undefined;
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
  }

  try {
    const result = await claimInvitation({ token, newPassword });
    // Do NOT return the password in production unless the caller needs it
    // to sign the user in immediately. The client page here needs it.
    return NextResponse.json({
      ok: true,
      userId: result.userId,
      trainerId: result.trainerId,
      email: result.email,
      sessionEmail: result.sessionEmail,
      sessionPassword: result.sessionPassword,
      wasClaimedNow: result.wasClaimedNow,
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const known = [
      'invite_not_found',
      'invite_expired',
      'invite_missing_email',
    ];
    const status = known.some((k) => msg.startsWith(k)) ? 400 : 500;
    console.error('[api/invite/claim] failed:', msg);
    return NextResponse.json({ error: 'claim_failed', message: msg }, { status });
  }
}
