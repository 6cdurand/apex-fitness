'use client';

import { useReportStore, useWorkoutStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export function WeeklyReportPreviewCard({ userId }: { userId: string }) {
  const router = useRouter();
  const { workoutHistory, personalBests } = useWorkoutStore();
  const { getLatestReport } = useReportStore();

  // Compute week-to-date stats client-side (fresh, no waiting for report gen)
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() + offset);

  const thisWeekWorkouts = workoutHistory.filter(w =>
    w.userId === userId &&
    w.status === 'completed' &&
    !w.deletedAt &&
    new Date(w.startTime) >= weekStart
  );

  const thisWeekVolume = thisWeekWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const thisWeekPBs = personalBests.filter(pb =>
    pb.userId === userId && new Date(pb.achievedAt) >= weekStart
  );

  const lastReport = getLatestReport();
  const hasData = thisWeekWorkouts.length > 0;

  if (!hasData && !lastReport) {
    return null; // Don't show empty state on first-week users
  }

  return (
    <Card className="bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Your week so far</h3>
          </div>
          <p className="text-[10px] text-gray-500">
            Week of {format(weekStart, 'MMM d')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{thisWeekWorkouts.length}</p>
            <p className="text-[10px] text-gray-500">workouts</p>
          </div>
          <div className="text-center border-l border-r border-sky-200">
            <p className="text-xl font-bold text-gray-900">{Math.round(thisWeekVolume).toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">kg volume</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-amber-500">{thisWeekPBs.length}</p>
            <p className="text-[10px] text-gray-500">new PBs</p>
          </div>
        </div>

        {lastReport && (
          <p className="text-[11px] text-gray-600 mb-2">
            Last week: {lastReport.totalWorkouts} workouts, {Math.round(lastReport.totalVolume).toLocaleString()}kg
          </p>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-sky-600 hover:bg-sky-100 text-xs"
          onClick={() => router.push('/profile/reports')}
        >
          View full report
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
