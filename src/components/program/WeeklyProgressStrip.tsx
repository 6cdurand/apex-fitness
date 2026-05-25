'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Check, Target, Hourglass, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  nextDayIndex: number;
  nextScheduledDay: string | null;
  isScheduledToday: boolean;
}

export function WeeklyProgressStrip({
  program,
  completedDayIndices,
  lockedDayIndices = [],
  nextDayIndex,
  nextScheduledDay,
  isScheduledToday,
}: WeeklyProgressStripProps) {
  const totalSessions = program.trainingDaysPerWeek || program.weeklyPlan.length;
  const completedCount = completedDayIndices.length;

  // For fixed schedule, anchor pills to scheduled days. For flexible, show generic day-letters.
  const pills = program.weeklyPlan.map((day, idx) => {
    const isDone = completedDayIndices.includes(idx);
    // v15-D4: lock pill (purple) when trainer has booked PT for this day this
    // week and it isn't already done. Done > locked in visual precedence.
    const isLocked = !isDone && lockedDayIndices.includes(idx);
    const isToday = !isLocked && idx === nextDayIndex && isScheduledToday;
    const isNext = !isLocked && idx === nextDayIndex && !isDone && !isScheduledToday;
    const label = program.scheduleMode === 'fixed' && day.scheduledDay
      ? day.scheduledDay.slice(0, 3).toUpperCase()
      : `Day ${String.fromCharCode(65 + idx)}`;
    
    return {
      idx,
      label,
      dayLabel: day.dayLabel,
      isDone,
      isLocked,
      isToday,
      isNext,
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
                title={pill.isLocked ? 'Booked with your trainer this week' : undefined}
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
