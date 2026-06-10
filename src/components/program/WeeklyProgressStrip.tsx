'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Check, Target, Hourglass, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProgramDayLockReason } from '@/lib/stores/trainerStore';
import { resolveStripPills } from '@/lib/weeklyStripPills';

interface WeeklyProgressStripProps {
  program: {
    weeklyPlan: Array<{ id?: string; dayLabel: string; scheduledDay?: string }>;
    trainingDaysPerWeek?: number;
    scheduleMode?: 'fixed' | 'flexible';
    selectedDays?: string[];
  };
  completedDayIndices: number[];
  /** v15-D4: indices of program days locked because the trainer has a
   * future-or-current PT session booked for them this week. Done wins
   * over locked (already filtered upstream). */
  lockedDayIndices?: number[];
  /** v16-D4: per-day lock explanation — trainer name + event date — so the
   * pill tooltip / aria-label reads "Booked with [trainer] on [date]"
   * instead of a generic "booked" string. Optional for safety. */
  lockReasons?: Record<number, ProgramDayLockReason>;
  nextDayIndex: number;
  nextScheduledDay: string | null;
  isScheduledToday: boolean;
  /** v16-D5 BUG-16: slot expansion so the strip renders N pills (N =
   * scheduled-days-per-week) instead of just N=weeklyPlan.length. Lets
   * a 2-unique-workout program on Mon/Wed/Fri render Push/Pull/Push
   * as three pills. Optional for backwards compat — if omitted, falls
   * back to the legacy weeklyPlan-anchored behaviour. */
  weekSlots?: number;
  slotDayIndices?: number[];
  slotScheduledDays?: string[];
  completedSlotCount?: number;
  nextSlotIndex?: number;
  /** v19-fix-10: the suggested day for the resolved next workout (hint,
   * not a binding). Rendered separately from any "<day> → <workout>"
   * pairing in the footer. */
  nextSuggestedDay?: string | null;
}

function lockTooltipFor(lockInfo: ProgramDayLockReason | undefined): string | undefined {
  if (!lockInfo) return 'Booked with your trainer this week';
  return `Booked with ${lockInfo.trainerName}${lockInfo.eventDate ? ` on ${lockInfo.eventDate}` : ''}${lockInfo.eventStartTime ? ` at ${lockInfo.eventStartTime}` : ''}`;
}

export function WeeklyProgressStrip({
  program,
  completedDayIndices,
  lockedDayIndices = [],
  lockReasons,
  nextDayIndex,
  nextScheduledDay,
  isScheduledToday,
  weekSlots,
  slotDayIndices,
  slotScheduledDays,
  nextSuggestedDay,
}: WeeklyProgressStripProps) {
  const totalSessions = program.trainingDaysPerWeek || weekSlots || program.weeklyPlan.length;

  // v16-D5 BUG-16: if the slot-expansion props are present, render N
  // slot-anchored pills (one per scheduled session this week). Falls back
  // to the legacy weeklyPlan-anchored pills if the caller hasn't been
  // updated — keeps trainer view and any other consumer working.
  const hasSlotExpansion =
    typeof weekSlots === 'number' &&
    slotDayIndices &&
    slotDayIndices.length === weekSlots;

  // v19-fix-10 F1/F2: resolve done-by-identity + the single highlighted
  // "next" slot via the shared pure helper (unit-tested). For the legacy
  // (no slot-expansion) path the slots ARE the weeklyPlan indices.
  const planSlotIndices = hasSlotExpansion
    ? slotDayIndices!
    : program.weeklyPlan.map((_, i) => i);
  const resolved = resolveStripPills({
    slotDayIndices: planSlotIndices,
    completedDayIndices,
    lockedDayIndices,
    isScheduledToday,
  });

  const pills = resolved.map(r => {
    const day = program.weeklyPlan[r.planIdx] || { dayLabel: `Day ${String.fromCharCode(65 + r.planIdx)}` };
    const scheduledDayName = hasSlotExpansion
      ? slotScheduledDays?.[r.slotIdx]
      : (program.scheduleMode === 'fixed' ? (day as any).scheduledDay : undefined);
    const label = scheduledDayName
      ? scheduledDayName.slice(0, 3).toUpperCase()
      : `Day ${String.fromCharCode(65 + r.slotIdx)}`;
    return {
      idx: r.slotIdx,
      label,
      dayLabel: (day as any).dayLabel,
      isDone: r.isDone,
      isLocked: r.isLocked,
      isToday: r.isToday,
      isNext: r.isNext,
      lockTooltip: r.isLocked ? lockTooltipFor(lockReasons?.[r.planIdx]) : undefined,
      suggestedDay: scheduledDayName,
    };
  });

  // Header N / M must equal the number of green pills (acceptance #4).
  const completedCount = pills.filter(p => p.isDone).length;
  const nextPill = pills.find(p => p.isToday || p.isNext);
  const suggestedDay = nextSuggestedDay || nextPill?.suggestedDay || nextScheduledDay || null;

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">This Week</h3>
          <p className="text-xs text-gray-500">
            <span className="font-bold text-sky-600">{completedCount}</span>
            {' / '}
            <span className="text-gray-700">{totalSessions}</span>
            {' done'}
          </p>
        </div>
        {/* v19-fix-10 F3: responsive — fixed-width pills that wrap to a
            second row (3–7 sessions) instead of a single flex-1 row that
            clipped/squashed >3 pills on phone widths. */}
        <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-3">
          {pills.map(pill => (
            <div key={pill.idx} className="flex flex-col items-center w-[3.25rem] min-w-0">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  pill.isDone
                    ? 'bg-emerald-100 text-emerald-600'
                    : pill.isLocked
                    ? 'bg-purple-100 text-purple-600'
                    : pill.isToday
                    ? 'bg-sky-500 text-white ring-2 ring-sky-200 animate-pulse'
                    : pill.isNext
                    ? 'bg-sky-100 text-sky-600'
                    : 'bg-gray-100 text-gray-400'
                )}
                title={pill.lockTooltip}
                aria-label={pill.lockTooltip || undefined}
              >
                {pill.isDone ? <Check className="w-4 h-4" /> :
                 pill.isLocked ? <Lock className="w-3.5 h-3.5" /> :
                 pill.isToday ? <Target className="w-4 h-4" /> :
                 <Hourglass className="w-3 h-3" />}
              </div>
              <p className={cn(
                'text-[9px] mt-1 truncate w-full text-center',
                pill.isDone ? 'text-emerald-600 font-medium' :
                pill.isLocked ? 'text-purple-600 font-medium' :
                pill.isToday ? 'text-sky-600 font-medium' :
                'text-gray-500'
              )}>
                {pill.label}
              </p>
              <p className="text-[8px] text-gray-400 truncate w-full text-center">
                {pill.dayLabel}
              </p>
            </div>
          ))}
        </div>
        {/* v19-fix-10 F1: decoupled footer — name the next WORKOUT and, only
            as a hint, its suggested day. Never assert "<day> → <workout>". */}
        {nextPill && completedCount < totalSessions && (
          <p className="text-[11px] text-gray-500 mt-3 text-center">
            Up next: <span className="font-medium text-sky-600">{nextPill.dayLabel}</span>
            {suggestedDay && (
              <span className="text-gray-400">{' · suggested '}<span className="capitalize">{suggestedDay}</span></span>
            )}
          </p>
        )}
        {completedCount >= totalSessions && (
          <p className="text-[11px] text-emerald-600 mt-3 text-center font-medium">
            All done this week! 🎉
          </p>
        )}
      </CardContent>
    </Card>
  );
}
