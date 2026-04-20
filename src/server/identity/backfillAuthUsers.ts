import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Backfill auth.users from public.users.
 *
 * For every public.users row with auth_migration_status='pending':
 *   1. Skip if email is null, a placeholder domain, or already mapped.
 *   2. admin.createUser({ id, email, password, email_confirm: true })
 *      — passing `id` preserves every existing foreign key reference.
 *   3. Generate a password-recovery link so the user can set their own.
 *   4. Mark auth_migration_status='migrated' (or 'failed' with payload).
 *
 * Safe to run multiple times — `pending` rows are the only ones
 * processed. Errors are logged to identity_events for follow-up.
 */

export type BackfillArgs = {
  batchSize?: number;
  dryRun?: boolean;
  sendRecoveryEmail?: boolean;
};

export type BackfillReport = {
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  failures: Array<{ userId: string; email: string | null; reason: string }>;
};

const PLACEHOLDER_DOMAINS = ['@placeholder.local', '@client.apex'];

function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const lower = email.toLowerCase();
  return PLACEHOLDER_DOMAINS.some((d) => lower.endsWith(d));
}

export async function backfillAuthUsers(args: BackfillArgs = {}): Promise<BackfillReport> {
  const admin = getSupabaseAdmin();
  const batchSize = args.batchSize ?? 100;
  const dryRun = args.dryRun ?? false;

  const report: BackfillReport = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  // Fetch pending rows. One batch at a time, ordered by created_at ASC so
  // if we interrupt we resume cleanly.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: users, error } = await admin
      .from('users')
      .select('id, email, display_name, is_trainer, auth_migration_status, account_status')
      .eq('auth_migration_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      throw new Error(`[backfill] failed to load pending users: ${error.message}`);
    }
    if (!users || users.length === 0) break;

    for (const u of users) {
      report.scanned++;

      // Skip placeholders — they will get an auth.users row when they claim
      // their invitation.
      if (u.account_status === 'placeholder' || isPlaceholderEmail(u.email)) {
        if (!dryRun) {
          await admin
            .from('users')
            .update({ auth_migration_status: 'skipped', updated_at: new Date().toISOString() })
            .eq('id', u.id);
        }
        report.skipped++;
        continue;
      }

      if (!u.email) {
        report.skipped++;
        continue;
      }

      try {
        // Check whether auth.users already has a row for this email.
        const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existingByEmail = existingList?.users?.find(
          (au) => au.email?.toLowerCase() === u.email?.toLowerCase(),
        );

        if (existingByEmail) {
          if (existingByEmail.id === u.id) {
            // Already 1:1 mapped. Mark migrated.
            if (!dryRun) {
              await admin
                .from('users')
                .update({ auth_migration_status: 'migrated', updated_at: new Date().toISOString() })
                .eq('id', u.id);
            }
            report.migrated++;
            continue;
          }
          // ID mismatch — a prior OAuth sign-in created an auth.users row
          // with a different id. Mark this case for manual attention.
          if (!dryRun) {
            await admin
              .from('users')
              .update({ auth_migration_status: 'failed', updated_at: new Date().toISOString() })
              .eq('id', u.id);
            await admin.from('identity_events').insert({
              event_type: 'backfill_auth_id_conflict',
              user_id: u.id,
              payload: {
                public_users_id: u.id,
                auth_users_id: existingByEmail.id,
                email: u.email,
              },
            });
          }
          report.failed++;
          report.failures.push({
            userId: u.id,
            email: u.email,
            reason: `auth.users row exists with id ${existingByEmail.id} !== public.users.id ${u.id}`,
          });
          continue;
        }

        // Create auth.users with preserved id.
        const tempPwd = crypto.randomBytes(24).toString('base64url');
        if (!dryRun) {
          const { error: createErr } = await admin.auth.admin.createUser({
            id: u.id,
            email: u.email,
            password: tempPwd,
            email_confirm: true,
            user_metadata: {
              display_name: u.display_name,
              backfilled_from_public_users: true,
            },
          });
          if (createErr) throw new Error(createErr.message);

          // Send recovery email so the user can set their own password.
          if (args.sendRecoveryEmail) {
            const { error: linkErr } = await admin.auth.admin.generateLink({
              type: 'recovery',
              email: u.email,
            });
            if (linkErr) {
              console.warn('[backfill] recovery link generation failed:', linkErr.message);
            }
          }

          await admin
            .from('users')
            .update({
              auth_migration_status: 'migrated',
              updated_at: new Date().toISOString(),
            })
            .eq('id', u.id);

          await admin.from('identity_events').insert({
            event_type: 'backfill_user_migrated',
            user_id: u.id,
            payload: { email: u.email, sent_recovery: !!args.sendRecoveryEmail },
          });
        }
        report.migrated++;
      } catch (e: any) {
        report.failed++;
        const reason = e?.message ?? String(e);
        report.failures.push({ userId: u.id, email: u.email, reason });
        if (!dryRun) {
          await admin
            .from('users')
            .update({ auth_migration_status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', u.id);
          await admin.from('identity_events').insert({
            event_type: 'backfill_user_failed',
            user_id: u.id,
            payload: { email: u.email, reason },
          });
        }
      }
    }

    if (users.length < batchSize) break;
  }

  return report;
}
