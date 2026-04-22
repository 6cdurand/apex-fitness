/**
 * One-off backfill: populate `notifications.program_id` for legacy
 * `program_assigned` rows that were inserted before the notification
 * creation path was fixed.
 *
 * This script is:
 *   - NOT auto-run on app boot.
 *   - Idempotent: only writes when program_id is NULL and a single
 *     high-confidence candidate exists.
 *   - Conservative: if more than one plausible client_programs row
 *     matches, the notification is skipped and logged, never guessed.
 *
 * Run locally with a Supabase *service role* key (bypasses RLS, required
 * so the script can read every user's rows):
 *
 *   SUPABASE_URL=https://<proj>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/backfill-program-notifications.ts
 *
 * Optional flags:
 *   --dry-run           don't write, just print the plan
 *   --window-minutes=N  widen the created_at matching window (default 10)
 *   --limit=N           cap the number of notifications processed (default 500)
 */
/* eslint-disable no-console */

import { createClient } from '@supabase/supabase-js';

interface Args {
  dryRun: boolean;
  windowMinutes: number;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, windowMinutes: 10, limit: 500 };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--window-minutes=')) args.windowMinutes = Math.max(1, Number(a.split('=')[1]) || 10);
    else if (a.startsWith('--limit=')) args.limit = Math.max(1, Number(a.split('=')[1]) || 500);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.');
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`[backfill] mode=${args.dryRun ? 'dry-run' : 'write'} window=${args.windowMinutes}m limit=${args.limit}`);

  // 1) Find candidate notifications: program_assigned with no program_id.
  const { data: candidates, error: cErr } = await supabase
    .from('notifications')
    .select('id, user_id, type, created_at, program_id')
    .eq('type', 'program_assigned')
    .is('program_id', null)
    .order('created_at', { ascending: false })
    .limit(args.limit);
  if (cErr) {
    console.error('[backfill] Failed to read notifications:', cErr.message);
    process.exit(1);
  }
  const rows = candidates || [];
  console.log(`[backfill] ${rows.length} candidate notification(s) to resolve`);

  let matched = 0;
  let skippedAmbiguous = 0;
  let skippedNone = 0;
  let written = 0;
  let errors = 0;
  const windowMs = args.windowMinutes * 60 * 1000;

  for (const n of rows) {
    const notifCreated = new Date(n.created_at).getTime();
    if (Number.isNaN(notifCreated)) {
      skippedNone++;
      continue;
    }

    // 2) For each candidate, look up client_programs for that client in
    //    a small time window around the notification's created_at. A
    //    single candidate => high confidence; otherwise skip.
    const lo = new Date(notifCreated - windowMs).toISOString();
    const hi = new Date(notifCreated + windowMs).toISOString();
    const { data: progs, error: pErr } = await supabase
      .from('client_programs')
      .select('id, client_id, created_at, status')
      .eq('client_id', n.user_id)
      .gte('created_at', lo)
      .lte('created_at', hi);
    if (pErr) {
      console.error(`[backfill] notif=${n.id} program lookup failed:`, pErr.message);
      errors++;
      continue;
    }
    const progList = progs || [];
    if (progList.length === 0) {
      skippedNone++;
      console.log(`[backfill] notif=${n.id} skip: no program in ±${args.windowMinutes}m`);
      continue;
    }
    if (progList.length > 1) {
      skippedAmbiguous++;
      console.log(
        `[backfill] notif=${n.id} skip: ${progList.length} candidates (ambiguous) — ids=${progList
          .map((p: any) => p.id)
          .join(',')}`,
      );
      continue;
    }
    const winner = progList[0];
    matched++;
    console.log(`[backfill] notif=${n.id} -> program=${winner.id}`);

    if (args.dryRun) continue;

    const { error: uErr } = await supabase
      .from('notifications')
      .update({ program_id: winner.id })
      .eq('id', n.id)
      .is('program_id', null); // idempotent guard: don't clobber concurrent writes
    if (uErr) {
      console.error(`[backfill] notif=${n.id} update failed:`, uErr.message);
      errors++;
      continue;
    }
    written++;
  }

  console.log('[backfill] summary', {
    candidates: rows.length,
    matched,
    skipped_ambiguous: skippedAmbiguous,
    skipped_none: skippedNone,
    written,
    errors,
    dryRun: args.dryRun,
  });
}

main().catch((e) => {
  console.error('[backfill] fatal:', e);
  process.exit(1);
});
