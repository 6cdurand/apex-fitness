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
  // Definitive: the workout was launched from a known program day for
  // this user. Returns false if the program has since been deleted or
  // the tag points at another user's program (defensive — should never
  // happen but keeps the contract tight).
  if (args.sourceProgramId) {
    return args.clientPrograms.some(
      (p) => p.id === args.sourceProgramId && p.clientId === args.workoutUserId,
    );
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
