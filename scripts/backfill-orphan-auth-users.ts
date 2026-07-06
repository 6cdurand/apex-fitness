/**
 * v19-fix-04 STAGE A — credential backfill for active "orphan" users.
 *
 * Context (see brief: catalift-command-center/briefs/sprint-v19-2026-06-01/
 * v19-fix-04-rls-hardening-phase1.md):
 *   Some active `public.users` rows have NO matching `auth.users` row. They
 *   currently log in only via the localStorage fast-path, so `auth.uid()` is
 *   NULL when they hit Supabase. The upcoming RLS hardening (Stage B) scopes
 *   policies to `canonical_user_id()`, which returns NULL for these users →
 *   they would be locked out. This script gives each one a real `auth.users`
 *   row and emails them a Supabase-native "set your password" recovery link
 *   (delivered through the project's configured SMTP provider, Resend).
 *
 * SAFETY / SCOPE:
 *   - Run-once, server-side ONLY. Requires the *service_role* key.
 *     NEVER expose service_role in client/app code. This file lives in
 *     scripts/ and is never imported by the Next.js client bundle.
 *   - Idempotent: re-checks for an existing auth.users row per email before
 *     creating, and treats "already registered" as a skip.
 *   - DRY-RUN BY DEFAULT. It will NOT create users or send any email unless
 *     you pass --execute. This is deliberate: --execute emails real users.
 *   - Touches ONLY active accounts with a syntactically valid email. The 13
 *     placeholders and the 1 malformed-email row are explicitly excluded and
 *     listed separately for manual cleanup.
 *
 * Trigger interaction (verified safe): inserting into auth.users fires
 *   public.handle_new_auth_user(), which does
 *     INSERT INTO public.users(id=<new auth id>, email=<same>) ON CONFLICT (id)...
 *   The new auth id differs from the orphan's existing public.users.id, so the
 *   ON CONFLICT (id) does not match; the insert then violates the
 *   `users.email` UNIQUE constraint and is swallowed by the trigger's
 *   `EXCEPTION WHEN OTHERS`. Net effect: NO duplicate public.users row; the
 *   original row (with correct is_trainer/mode) is preserved. The user joins
 *   the "diverged" cohort, resolved by canonical_user_id()'s email fallback.
 *
 * USAGE:
 *   # 1) Dry run (default) — prints the worklist + counts, sends nothing:
 *   SUPABASE_URL=https://<proj>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/backfill-orphan-auth-users.ts
 *
 *   # 2) Execute — creates auth.users rows + sends recovery emails:
 *   SUPABASE_URL=https://<proj>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   APP_URL=https://catalift.net \
 *   npx tsx scripts/backfill-orphan-auth-users.ts --execute
 *
 * Optional flags:
 *   --execute    actually create users + send emails (default: dry-run)
 *   --limit=N    cap how many orphans are processed this run (default: 1000)
 */
/* eslint-disable no-console */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface Args {
  execute: boolean;
  limit: number;
  exclude: string[];
}

interface OrphanRow {
  public_user_id: string;
  email: string;
  is_trainer: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { execute: false, limit: 1000, exclude: [] };
  for (const a of argv.slice(2)) {
    if (a === '--execute') args.execute = true;
    else if (a.startsWith('--limit=')) args.limit = Math.max(1, Number(a.split('=')[1]) || 1000);
    else if (a.startsWith('--exclude=')) {
      args.exclude = a
        .split('=')[1]
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return args;
}

/**
 * An orphan is excluded from this run if its email exactly matches an
 * exclude token, or its domain ends with one (so `--exclude=example.com`
 * skips `r***@example.com`). Excluded rows are NOT created/emailed but are
 * still counted in the BEFORE/AFTER orphan totals so the residual is honest.
 */
function isExcluded(email: string, exclude: string[]): boolean {
  if (exclude.length === 0) return false;
  const e = email.toLowerCase();
  const domain = e.slice(e.indexOf('@') + 1);
  return exclude.some((token) => e === token || domain === token || domain.endsWith(`.${token}`));
}

/** Redact an email for logging: `alice@example.com` -> `a***@example.com`. */
function redact(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const first = email[0];
  const domain = email.slice(at + 1);
  return `${first}***@${domain}`;
}

const PLACEHOLDER_DOMAINS = ['@placeholder.local', '@client.apex'];

function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const e = email.toLowerCase();
  return PLACEHOLDER_DOMAINS.some((d) => e.endsWith(d));
}

/** Syntactic validity matching the brief's `email like '%@%'` + a local part. */
function isSyntacticallyValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.indexOf('@');
  return at > 0 && at < email.length - 1;
}

/**
 * Build the set of all lowercased emails that currently have an auth.users
 * row. auth.users is not exposed through PostgREST, so we page through the
 * Admin API. With ~71 users this is a single page, but we page defensively.
 */
async function loadAuthEmailSet(supabase: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  const perPage = 1000;
  let page = 1;
  // Hard stop at 100 pages (100k users) to avoid an accidental infinite loop.
  for (; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.admin.listUsers page ${page} failed: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) emails.add(u.email.toLowerCase());
    }
    if (users.length < perPage) break;
  }
  return emails;
}

/**
 * Active public.users with a syntactically valid, non-placeholder email.
 * This is the universe from which we subtract those that already have an
 * auth.users row to derive the orphan worklist.
 */
async function loadActiveCandidates(
  supabase: SupabaseClient,
): Promise<{ id: string; email: string; is_trainer: boolean }[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, is_trainer')
    .eq('account_status', 'active')
    .like('email', '%@%');
  if (error) throw new Error(`public.users read failed: ${error.message}`);
  return (data ?? []).map((r: { id: string; email: string | null; is_trainer: boolean | null }) => ({
    id: r.id,
    email: (r.email ?? '').trim(),
    is_trainer: Boolean(r.is_trainer),
  }));
}

function computeOrphans(
  active: { id: string; email: string; is_trainer: boolean }[],
  authEmails: Set<string>,
): OrphanRow[] {
  const orphans: OrphanRow[] = [];
  for (const u of active) {
    if (!isSyntacticallyValidEmail(u.email)) continue;
    if (isPlaceholderEmail(u.email)) continue;
    if (authEmails.has(u.email.toLowerCase())) continue;
    orphans.push({ public_user_id: u.id, email: u.email, is_trainer: u.is_trainer });
  }
  // Trainers first, then alphabetical — matches the brief's worklist ordering.
  orphans.sort((a, b) => {
    if (a.is_trainer !== b.is_trainer) return a.is_trainer ? -1 : 1;
    return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
  });
  return orphans;
}

async function main() {
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = (process.env.APP_URL || 'https://catalift.net').replace(/\/+$/, '');
  const redirectTo = `${appUrl}/auth/update-password`;

  if (!url || !key) {
    console.error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.\n' +
        'This script needs the service_role key (server-side only). Aborting.',
    );
    process.exit(2);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    `[backfill] mode=${args.execute ? 'EXECUTE' : 'dry-run'} limit=${args.limit} redirectTo=${redirectTo}`,
  );

  // ---- BEFORE snapshot --------------------------------------------------
  const authEmailsBefore = await loadAuthEmailSet(supabase);
  const active = await loadActiveCandidates(supabase);
  const orphansBefore = computeOrphans(active, authEmailsBefore);

  console.log(
    `[backfill] BEFORE: active_candidates=${active.length} ` +
      `auth_rows=${authEmailsBefore.size} active_orphans=${orphansBefore.length}`,
  );

  // Surface (but never touch) the excluded rows for Christo's manual cleanup.
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, account_status, is_trainer');
  const placeholders = (allUsers ?? []).filter(
    (u: { email: string | null; account_status: string | null }) =>
      u.account_status === 'placeholder' || isPlaceholderEmail(u.email),
  );
  const malformed = (allUsers ?? []).filter(
    (u: { email: string | null; account_status: string | null }) =>
      u.account_status === 'active' &&
      !isPlaceholderEmail(u.email) &&
      !isSyntacticallyValidEmail(u.email),
  );
  console.log(
    `[backfill] EXCLUDED (NOT backfilled): placeholders=${placeholders.length} ` +
      `malformed_email_active=${malformed.length}`,
  );
  for (const m of malformed) {
    console.log(`[backfill]   malformed-active id=${m.id} email=${redact(m.email ?? '')}`);
  }

  const excluded = orphansBefore.filter((o) => isExcluded(o.email, args.exclude));
  for (const x of excluded) {
    console.log(`[backfill] EXCLUDED by --exclude (skipped this run): ${redact(x.email)}`);
  }
  const worklist = orphansBefore
    .filter((o) => !isExcluded(o.email, args.exclude))
    .slice(0, args.limit);
  if (worklist.length === 0) {
    console.log('[backfill] No active orphans to process. Nothing to do.');
    return;
  }

  let created = 0;
  let skippedExisting = 0;
  let emailsSent = 0;
  let emailErrors = 0;
  let createErrors = 0;

  for (const row of worklist) {
    const tag = `${redact(row.email)}${row.is_trainer ? ' (trainer)' : ''}`;

    // Idempotency re-check inside the loop: skip if an auth row now exists.
    if (authEmailsBefore.has(row.email.toLowerCase())) {
      skippedExisting++;
      console.log(`[backfill] SKIP existing auth row: ${tag}`);
      continue;
    }

    if (!args.execute) {
      console.log(`[backfill] DRY-RUN would create + email: ${tag}`);
      continue;
    }

    // 1) Create the auth.users row (no password; user sets it via recovery).
    const { error: createErr } = await supabase.auth.admin.createUser({
      email: row.email,
      email_confirm: true,
    });
    if (createErr) {
      const msg = (createErr.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        skippedExisting++;
        console.log(`[backfill] SKIP already-registered (race): ${tag}`);
      } else {
        createErrors++;
        console.error(`[backfill] CREATE FAILED ${tag}: ${createErr.message}`);
        continue; // don't email if we couldn't create
      }
    } else {
      created++;
      console.log(`[backfill] CREATED auth row: ${tag}`);
    }

    // 2) Send the Supabase-native recovery ("set your password") email via
    //    the project's configured SMTP (Resend). Lands on /auth/update-password.
    const { error: mailErr } = await supabase.auth.resetPasswordForEmail(row.email, {
      redirectTo,
    });
    if (mailErr) {
      emailErrors++;
      console.error(`[backfill] EMAIL FAILED ${tag}: ${mailErr.message}`);
    } else {
      emailsSent++;
      console.log(`[backfill] EMAIL sent (recovery): ${tag}`);
    }
  }

  // ---- AFTER snapshot ---------------------------------------------------
  const authEmailsAfter = await loadAuthEmailSet(supabase);
  const activeAfter = await loadActiveCandidates(supabase);
  const orphansAfter = computeOrphans(activeAfter, authEmailsAfter);

  console.log('[backfill] summary', {
    mode: args.execute ? 'EXECUTE' : 'dry-run',
    worklist: worklist.length,
    excluded_by_flag: excluded.length,
    created,
    skipped_existing: skippedExisting,
    emails_sent: emailsSent,
    email_errors: emailErrors,
    create_errors: createErrors,
  });
  console.log(
    `[backfill] AFTER: auth_rows=${authEmailsAfter.size} active_orphans=${orphansAfter.length} ` +
      `(before=${orphansBefore.length})`,
  );
  if (!args.execute) {
    console.log('[backfill] DRY-RUN complete — no users created, no emails sent. Re-run with --execute.');
  } else if (orphansAfter.length !== 0) {
    const residualAllExcluded =
      orphansAfter.length === excluded.length &&
      orphansAfter.every((o) => isExcluded(o.email, args.exclude));
    if (residualAllExcluded) {
      console.log(
        `[backfill] active-orphan count = ${orphansAfter.length}, all intentionally ` +
          `excluded via --exclude (${args.exclude.join(',')}). Backfilled cohort complete.`,
      );
    } else {
      console.warn(
        `[backfill] WARNING: active_orphans is ${orphansAfter.length}, expected ` +
          `${excluded.length} (excluded). Review CREATE/EMAIL errors above before declaring Stage A done.`,
      );
    }
  } else {
    console.log('[backfill] active-orphan count = 0. Stage A backfill complete.');
  }
}

main().catch((e) => {
  console.error('[backfill] fatal:', e);
  process.exit(1);
});
