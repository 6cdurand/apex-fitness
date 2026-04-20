import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/server/authContext';
import { issueInvitation } from '@/server/identity/inviteService';
import { getSupabaseAdmin } from '@/server/supabaseAdmin';

/**
 * Authenticated trainer-only route. Issues (or refreshes) an invitation
 * for a client.
 *
 * Body: { clientId: string; email: string; clientName?: string; trainerName?: string; sendEmail?: boolean }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let caller;
  try {
    caller = await requireRequestUser();
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('users')
    .select('is_trainer, display_name')
    .eq('id', caller.id)
    .maybeSingle();
  if (!profile?.is_trainer) {
    return NextResponse.json({ error: 'trainer_required' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.clientId || !body.email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Verify trainer actually owns this client relationship.
  const { data: tc } = await admin
    .from('trainer_clients')
    .select('id')
    .eq('trainer_id', caller.id)
    .eq('client_id', body.clientId)
    .maybeSingle();
  if (!tc?.id) {
    return NextResponse.json({ error: 'not_your_client' }, { status: 403 });
  }

  try {
    const result = await issueInvitation({
      trainerId: caller.id,
      clientId: body.clientId,
      email: body.email,
      clientName: body.clientName,
      trainerName: body.trainerName ?? profile.display_name ?? undefined,
      sendEmail: body.sendEmail,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[api/invite/issue] failed:', e);
    return NextResponse.json(
      { error: 'invite_issue_failed', message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
