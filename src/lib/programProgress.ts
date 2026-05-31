// src/lib/programProgress.ts
//
// v18-D3: trainer-side program progress + 3-day end-of-cycle notification.
//
// Pure helpers + localStorage-backed idempotency guard. Kept I/O-light so
// the helper can be unit-tested without React/Supabase. Idempotency keys
// on `<programId>-<endDateISO-yyyy-mm-dd>`; if the trainer extends the
// program (endDate moves later) the key changes and the notification may
// fire once more — desired per brief §1.
//
// Schema note: brief §3 proposes
//   client_programs.end_cycle_notified_at TIMESTAMPTZ
// for cross-device idempotency. Migration is authored as
//   supabase/migrations/20260531_client_programs_endcycle_notified.sql
// but the column is NOT consumed yet — localStorage guard is the v1
// source of truth. Promote to column-backed when the migration is applied
// + supabaseSync wires the round-trip.

import type { ClientProgram } from '@/types';

const MS_PER_DAY = 86400000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export type ProgramProgress = {
  /** Total weeks the program runs for, clamped to >= 1. */
  totalWeeks: number;
  /** 1-indexed current week, clamped to [1, totalWeeks]. */
  currentWeek: number;
  /** Whole-percent completion, clamped to [0, 100]. */
  percent: number;
  /** Days from `now` to `endDate`. Negative if past end. */
  daysRemaining: number;
  /** Resolved end date (from `endDate` directly, or derived). */
  endDate: Date;
};

/**
 * Compute progress for a client program, or `null` when the program has
 * no computable end date (e.g. flexible / undated). Skipping these is the
 * locked decision from brief §1 — flexible programs get NO bar and NO
 * end-of-cycle notification.
 *
 * Duration source decision tree (brief §2):
 *   1. startDate + endDate present → use them directly.
 *   2. startDate + weeks/durationWeeks → derive endDate.
 *   3. otherwise → null (skip).
 *
 * Pre-flight finding (2026-05-31): the ClientProgram type in
 * src/types/index.ts:1145 only exposes `startDate` (required) + `endDate?`.
 * There is NO `weeks` / `durationWeeks` field. So in practice this helper
 * lands on branch (1) for any program with an endDate, and returns null
 * for everything else. The weeks-based branch is kept as a forward-compat
 * fallback in case the type grows a `weeks` field later.
 */
export function computeProgramProgress(
  program: Pick<ClientProgram, 'startDate' | 'endDate'> & {
    weeks?: number;
    durationWeeks?: number;
  } | null | undefined,
  now: Date = new Date(),
): ProgramProgress | null {
  if (!program) return null;

  const start = program.startDate ? new Date(program.startDate) : null;
  if (!start || Number.isNaN(start.getTime())) return null;

  let end: Date | null = program.endDate ? new Date(program.endDate) : null;
  if (!end || Number.isNaN(end.getTime())) {
    const weeks =
      typeof program.weeks === 'number'
        ? program.weeks
        : typeof program.durationWeeks === 'number'
        ? program.durationWeeks
        : null;
    if (!weeks || weeks <= 0) return null; // flexible / unknown duration
    end = new Date(start.getTime() + weeks * MS_PER_WEEK);
  }

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return null;

  const elapsedMs = now.getTime() - start.getTime();
  const totalWeeks = Math.max(1, Math.round(totalMs / MS_PER_WEEK));
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.floor(elapsedMs / MS_PER_WEEK) + 1),
  );
  const percent = Math.min(
    100,
    Math.max(0, Math.round((elapsedMs / totalMs) * 100)),
  );
  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);

  return { totalWeeks, currentWeek, percent, daysRemaining, endDate: end };
}

// ─── Idempotency guards ───────────────────────────────────────────────────
//
// The notification is fired client-side from the trainer's dashboard mount
// effect (brief §F3) — no nightly cron. Without a dedupe key the same
// notification would re-fire on every page load within the 3-day window.
//
// Key shape: apex-endcycle-notified-<programId>-<YYYY-MM-DD>
// The date portion is the program's *current* end date (UTC ISO date),
// which means: if the trainer extends the program (end date moves) the
// key changes and the notification may fire once more for the new end —
// desired per brief §1 ("Program extended/edited").

const ENDCYCLE_KEY_PREFIX = 'apex-endcycle-notified-';

export function endCycleKey(programId: string, endDate: Date | string): string {
  const iso =
    typeof endDate === 'string'
      ? endDate.slice(0, 10)
      : endDate.toISOString().slice(0, 10);
  return `${ENDCYCLE_KEY_PREFIX}${programId}-${iso}`;
}

export function wasEndCycleNotified(
  programId: string,
  endDate: Date | string,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(endCycleKey(programId, endDate)) !== null;
  } catch {
    return false;
  }
}

export function markEndCycleNotified(
  programId: string,
  endDate: Date | string,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(endCycleKey(programId, endDate), new Date().toISOString());
  } catch {
    // Quota / privacy mode — best-effort only. The notification will
    // re-fire on next mount; that's strictly worse than dedupe but not a
    // crash, and only affects the local device.
  }
}
