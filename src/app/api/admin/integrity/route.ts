import { NextRequest, NextResponse } from 'next/server';
import { runIntegrityReport } from '@/server/identity/integrityMonitor';

/**
 * Protected admin route to run the integrity report.
 *
 * Guarded by ADMIN_RECONCILE_SECRET (header `x-admin-secret`) — or by
 * VERCEL_CRON=1 header if Vercel cron calls it. If no secret is configured
 * the route rejects every request.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: NextRequest) {
  const secret = process.env.ADMIN_RECONCILE_SECRET;
  const isCron = req.headers.get('x-vercel-cron') === '1';
  if (!secret && !isCron) {
    return NextResponse.json(
      { error: 'ADMIN_RECONCILE_SECRET not configured' },
      { status: 503 },
    );
  }
  if (!isCron) {
    const provided = req.headers.get('x-admin-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  try {
    const report = await runIntegrityReport();
    return NextResponse.json({ ok: true, report });
  } catch (e: any) {
    console.error('[api/admin/integrity] failed:', e);
    return NextResponse.json(
      { error: 'integrity_failed', message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest) { return handle(req); }
