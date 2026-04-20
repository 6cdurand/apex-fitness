import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/server/authContext';
import { createProvisionalClient } from '@/server/identity/inviteService';
import { getSupabaseAdmin } from '@/server/supabaseAdmin';

/**
 * Authenticated trainer-only route. Creates a provisional client file
 * (public.users row with account_status='placeholder' + trainer_clients link).
 *
 * Body: { displayName: string; email?: string; notes?: string; goals?: string[]; gender?: string }
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

  // Verify the caller is a trainer (is_trainer=true in public.users).
  const admin = getSupabaseAdmin();
  const { data: profile, error: profileErr } = await admin
    .from('users')
    .select('is_trainer')
    .eq('id', caller.id)
    .maybeSingle();
  if (profileErr || !profile?.is_trainer) {
    return NextResponse.json({ error: 'trainer_required' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.displayName || typeof body.displayName !== 'string') {
    return NextResponse.json({ error: 'missing_display_name' }, { status: 400 });
  }

  try {
    const result = await createProvisionalClient({
      trainerId: caller.id,
      displayName: body.displayName,
      email: body.email,
      onboarding: {
        notes: body.notes,
        goals: body.goals,
        gender: body.gender,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[api/clients/provisional] failed:', e);
    return NextResponse.json(
      { error: 'provisional_create_failed', message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
