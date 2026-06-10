/**
 * Detect whether a completed workout is a program workout (D16 Part A).
 *
 * The original prefix-based detection in handleFinishWorkout
 *
 *   const isProgramWorkout = tplId.startsWith('program-') || tplId.startsWith('sched-')
 *
 * silently missed any workout whose templateId lost the prefix somewhere
 * upstream (or never had one — e.g. cross-device replays, certain
 * notification-driven starts). When detection failed, the D15 Part B
 * "Save changes to program?" modal never showed, the trainer never got
 * the program-edit notification, and the trainer-side diff card was
 * never rendered.
 *
 * Fallback: if the prefix check fails, look up the user's ACTIVE program
 * and treat the workout as a program workout when EITHER
 *
 *   - the workout name matches one of the program's `dayLabel` values, OR
 *   - the templateId contains the activeProgram.id as a substring.
 *
 * False positives are benign: the user gets one extra "save changes?"
 * prompt they can dismiss. False negatives silently break the trainer
 * notification + diff flow, which is much worse.
 *
 * Pure function — no React, no zustand, no Supabase. Unit-tested in
 * `src/lib/__tests__/programWorkoutDetection.test.ts`.
 */

export interface ProgramDetectionInput {
  // D17: explicit start-time tags. When `sourceProgramId` is present the
  // helper short-circuits on a definitive store lookup, skipping the
  // fragile legacy templateId-prefix inference entirely.
  sourceProgramId?: string;
  sourceDayIndex?: number;
  templateId?: string;
  workoutName?: string;
  workoutUserId: string;
  clientPrograms: Array<{
    id: string;
    clientId: string;
    status: string;
    weeklyPlan?: Array<{ dayLabel?: string }>;
  }>;
}

export function detectIsProgramWorkout(args: ProgramDetectionInput): boolean {
  // D17 fast path — explicit source tag written at start time.
  // Definitive POSITIVE: the workout was launched from a known program day
  // for this user.
  //
  // v19-fix-11: previously this branch HARD-RETURNED `some(...)` — i.e. it
  // returned false whenever the store lookup missed. That is fail-unsafe:
  // a `sourceProgramId` tag is strong evidence this WAS a program workout,
  // but the program can legitimately be absent from `clientPrograms` at
  // finish time (not loaded on /workout/active, or a `client_id`
  // divergence — see v19-fix-09). When that happened, detection returned
  // false and the "Save changes to program?" modal silently never fired,
  // even though `templateId` still carried the `program-…` prefix. We now
  // only SHORT-CIRCUIT on a positive match and otherwise fall through to
  // the prefix + structural fallback below (false positives are benign —
  // one dismissable prompt — false negatives break the trainer flow).
  if (args.sourceProgramId) {
    const matched = args.clientPrograms.some(
      (p) => p.id === args.sourceProgramId && p.clientId === args.workoutUserId,
    );
    if (matched) return true;
  }

  const tplId = args.templateId || '';

  // Fast path — explicit prefix.
  if (tplId.startsWith('program-') || tplId.startsWith('sched-')) {
    return true;
  }

  // Structural fallback. Only consider the user's ACTIVE program; an
  // inactive (paused / completed / archived) program day-label match is
  // not enough to override the prefix check.
  const activeProgram = args.clientPrograms.find(
    (p) => p.clientId === args.workoutUserId && p.status === 'active',
  );
  if (!activeProgram) return false;

  const dayLabels = new Set<string>(
    (activeProgram.weeklyPlan || [])
      .map((d) => d.dayLabel)
      .filter((label): label is string => !!label),
  );
  if (args.workoutName && dayLabels.has(args.workoutName)) return true;

  // Guard against `'foo'.includes('')` returning true. activeProgram.id
  // is the canonical anchor; we only fall through if it's non-empty.
  if (tplId && activeProgram.id && tplId.includes(activeProgram.id)) {
    return true;
  }

  return false;
}
