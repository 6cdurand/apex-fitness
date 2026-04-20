import { NextRequest, NextResponse } from 'next/server';
import { backfillAuthUsers } from '@/server/identity/backfillAuthUsers';

/**
 * Protected admin route to run the auth.users backfill.
 *
 * Guarded by ADMIN_RECONCILE_SECRET — callers must supply
 * `x-admin-secret: <secret>` header. If the env var is unset the route
 * rejects every request.
 *
 * Body (JSON):
 *   { dryRun?: boolean, sendRecoveryEmail?: boolean, batchSize?: number }
 *
 * Returns the backfill report on success.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_RECONCILE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'ADMIN_RECONCILE_SECRET not configured' },
      { status: 503 },
    );
  }
  const provided = req.headers.get('x-admin-secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is valid.
  }

  try {
    const report = await backfillAuthUsers({
      batchSize: body.batchSize,
      dryRun: !!body.dryRun,
      sendRecoveryEmail: body.sendRecoveryEmail !== false,
    });
    return NextResponse.json({ ok: true, report });
  } catch (e: any) {
    console.error('[api/admin/backfill] failed:', e);
    return NextResponse.json(
      { error: 'backfill_failed', message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
