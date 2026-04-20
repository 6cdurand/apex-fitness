import 'server-only';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Integrity monitor — calls fn_integrity_report() and surfaces the result
 * for a cron caller (Vercel cron or pg_cron). On non-trivial findings a
 * webhook post can be made (opt-in via INTEGRITY_ALERT_WEBHOOK env).
 */

export type IntegrityReport = {
  orphans_inserted: number;
  drift_inserted: number;
  duplicates_inserted: number;
  auto_resolved: number;
  ran_at: string;
};

export async function runIntegrityReport(): Promise<IntegrityReport> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fn_integrity_report');
  if (error) throw new Error(`fn_integrity_report failed: ${error.message}`);

  const report = (data ?? {}) as IntegrityReport;

  const nonTrivial =
    (report.orphans_inserted ?? 0) > 0 ||
    (report.drift_inserted ?? 0) > 0 ||
    (report.duplicates_inserted ?? 0) > 0;

  if (nonTrivial) {
    const webhook = process.env.INTEGRITY_ALERT_WEBHOOK;
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: '[apex-integrity]', report }),
        });
      } catch (e) {
        console.error('[integrityMonitor] webhook post failed:', e);
      }
    } else {
      console.warn('[integrityMonitor] non-trivial findings, no webhook configured:', report);
    }
  }

  return report;
}
