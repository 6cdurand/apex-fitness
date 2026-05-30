'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Check, Target, Hourglass, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProgramDayLockReason } from '@/lib/stores/trainerStore';

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
  completedSlotCount,
  nextSlotIndex,
}: WeeklyProgressStripProps) {
  const totalSessions = program.trainingDaysPerWeek || weekSlots || program.weeklyPlan.length;
  const completedCount = completedDayIndices.length;

  // v16-D5 BUG-16: if the slot-expansion props are present, render N
  // slot-anchored pills (one per scheduled session this week). Falls back
  // to the legacy weeklyPlan-anchored pills if the caller hasn't been
  // updated — keeps trainer view and any other consumer working.
  const hasSlotExpansion =
    typeof weekSlots === 'number' &&
    slotDayIndices &&
    slotDayIndices.length === weekSlots;

  const pills = hasSlotExpansion
    ? Array.from({ length: weekSlots! }, (_, slotIdx) => {
        // Resolve which weeklyPlan entry this slot represents (modulo for
        // cycling: Push/Pull on Mon/Wed/Fri → [0, 1, 0]).
        const planIdx = slotDayIndices![slotIdx];
        const day = program.weeklyPlan[planIdx] || { dayLabel: `Day ${String.fromCharCode(65 + planIdx)}` };
        // Left-anchored progress: slot i is "done" if i < completedSlotCount.
        // This avoids the previous bug where doing Push twice (Mon + Fri)
        // would only mark one pill done because completedDayIndices kept
        // returning [0, 0] and includes-checking treated them as the same.
        const isDone = (completedSlotCount ?? completedCount) > slotIdx;
        // Lock: any slot whose underlying workout is locked by a PT booking.
        const isLocked = !isDone && lockedDayIndices.includes(planIdx);
        // Today / next: highlight the slot the cycle is currently on.
        const isToday = !isLocked && slotIdx === (nextSlotIndex ?? 0) && isScheduledToday;
        const isNext = !isLocked && slotIdx === (nextSlotIndex ?? 0) && !isDone && !isScheduledToday;
        const scheduledDayName = slotScheduledDays?.[slotIdx];
        const label = scheduledDayName
          ? scheduledDayName.slice(0, 3).toUpperCase()
          : `Day ${String.fromCharCode(65 + slotIdx)}`;

        const lockInfo = isLocked ? lockReasons?.[planIdx] : undefined;
        const lockTooltip = isLocked
          ? lockInfo
            ? `Booked with ${lockInfo.trainerName}${lockInfo.eventDate ? ` on ${lockInfo.eventDate}` : ''}${lockInfo.eventStartTime ? ` at ${lockInfo.eventStartTime}` : ''}`
            : 'Booked with your trainer this week'
          : undefined;

        return {
          idx: slotIdx,
          label,
          dayLabel: day.dayLabel,
          isDone,
          isLocked,
          isToday,
          isNext,
          lockTooltip,
        };
      })
    : program.weeklyPlan.map((day, idx) => {
        const isDone = completedDayIndices.includes(idx);
        const isLocked = !isDone && lockedDayIndices.includes(idx);
        const isToday = !isLocked && idx === nextDayIndex && isScheduledToday;
        const isNext = !isLocked && idx === nextDayIndex && !isDone && !isScheduledToday;
        const label = program.scheduleMode === 'fixed' && day.scheduledDay
          ? day.scheduledDay.slice(0, 3).toUpperCase()
          : `Day ${String.fromCharCode(65 + idx)}`;

        const lockInfo = isLocked ? lockReasons?.[idx] : undefined;
        const lockTooltip = isLocked
          ? lockInfo
            ? `Booked with ${lockInfo.trainerName}${lockInfo.eventDate ? ` on ${lockInfo.eventDate}` : ''}${lockInfo.eventStartTime ? ` at ${lockInfo.eventStartTime}` : ''}`
            : 'Booked with your trainer this week'
          : undefined;

        return {
          idx,
          label,
          dayLabel: day.dayLabel,
          isDone,
          isLocked,
          isToday,
          isNext,
          lockTooltip,
        };
      });

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
        <div className="flex items-center justify-between gap-1">
          {pills.map(pill => (
            <div key={pill.idx} className="flex flex-col items-center flex-1 min-w-0">
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
        {nextScheduledDay && !isScheduledToday && completedCount < totalSessions && (
          <p className="text-[11px] text-gray-500 mt-3 text-center">
            Next up: <span className="font-medium capitalize text-sky-600">{nextScheduledDay}</span>
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
