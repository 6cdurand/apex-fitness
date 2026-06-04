/**
 * v19-fix-10: pure resolution of the "This Week" strip pills.
 *
 * DESIGN (Christo 2026-06-04): FLEXIBLE ORDER. A fixed Mon/Wed/Fri program
 * means "N sessions/week, with SUGGESTED days" — weekday labels are hints,
 * not bindings, and completion is credited to the WORKOUT actually performed.
 *
 * Two rules this helper enforces (and which `WeeklyProgressStrip` renders):
 *
 *  F1 — single "next" = the FIRST slot that is not done and not locked,
 *       in slot order. This is the same next-workout the store resolves for
 *       the Up Next card and Today, so the three views never disagree.
 *
 *  F2 — a pill is DONE by WORKOUT IDENTITY, not a left-anchored count or
 *       slot position. Completing Legs first lights the Legs pill (not Push).
 *       For cycling slots (e.g. Push/Pull/Push) the nth slot mapping to a
 *       workout is done once that workout has >= n completions this week.
 *
 * Pure — no React, no zustand, no Supabase. Unit-tested in
 * `src/lib/__tests__/weeklyStripPills.test.ts`.
 */

export interface StripPillInput {
  /** weeklyPlan index represented by each slot, in slot order. */
  slotDayIndices: number[];
  /** weeklyPlan indices completed this week (a multiset — duplicates allowed). */
  completedDayIndices: number[];
  /** weeklyPlan indices locked by a PT booking this week. */
  lockedDayIndices?: number[];
  /** whether today is a scheduled day (drives isToday vs isNext on the highlight). */
  isScheduledToday: boolean;
}

export interface ResolvedStripPill {
  slotIdx: number;
  planIdx: number;
  isDone: boolean;
  isLocked: boolean;
  isToday: boolean;
  isNext: boolean;
}

export function resolveStripPills(input: StripPillInput): ResolvedStripPill[] {
  const { slotDayIndices, completedDayIndices, isScheduledToday } = input;
  const lockedDayIndices = input.lockedDayIndices || [];

  // F2: completion counts per workout identity (weeklyPlan index).
  const completionCountByPlan = new Map<number, number>();
  for (const ci of completedDayIndices) {
    completionCountByPlan.set(ci, (completionCountByPlan.get(ci) || 0) + 1);
  }

  const seenByPlan = new Map<number, number>();
  const pills: ResolvedStripPill[] = slotDayIndices.map((planIdx, slotIdx) => {
    const occurrence = (seenByPlan.get(planIdx) || 0) + 1;
    seenByPlan.set(planIdx, occurrence);
    const isDone = occurrence <= (completionCountByPlan.get(planIdx) || 0);
    const isLocked = !isDone && lockedDayIndices.includes(planIdx);
    return { slotIdx, planIdx, isDone, isLocked, isToday: false, isNext: false };
  });

  // F1: single highlighted "next" = first not-done, not-locked slot.
  const highlightIdx = pills.findIndex(p => !p.isDone && !p.isLocked);
  if (highlightIdx >= 0) {
    pills[highlightIdx].isToday = isScheduledToday;
    pills[highlightIdx].isNext = !isScheduledToday;
  }

  return pills;
}
