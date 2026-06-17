'use client';

/**
 * /profile/reports — v18-D5 Weekly Reports.
 *
 * Replaces the v17-era "coming soon" stub with a real, deterministic
 * weekly summary computed entirely from existing in-store data
 * (useWorkoutStore: workoutHistory + personalBests). No LLM, no schema,
 * no new network calls. The AI/coach-narrative layer + trainer-edit
 * flow remain deferred (FUTURE_IDEAS P2).
 *
 * Week convention: Monday-start (matches src/app/clients/[id]/page.tsx
 * and src/app/payments/page.tsx — both use { weekStartsOn: 1 }).
 *
 * Filters applied to workouts on every read:
 *   - w.userId === user.id              (per-user scope)
 *   - w.status === 'completed'          (skip active/cancelled)
 *   - !w.deletedAt                      (skip soft-deleted)
 *
 * Volume source: workout.totalVolume (already computed at finish time
 * in src/lib/stores/workoutStore.ts). Falls back to summing completed
 * sets if a legacy workout lacks the field.
 *
 * Layout (per brief §3 F3):
 *   - PageHeader + week-of header with ◀ / ▶ nav (bounded)
 *   - At-a-glance row: workouts / volume / sets
 *   - Wins: PBs earned this week
 *   - Vs last week: workouts delta + volume % delta
 *   - Best day: weekday with the most volume
 *   - Empty week + brand-new-user states handled
 */

import { useState, useMemo } from 'react';
import { useAuthStore, useWorkoutStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  format,
  subWeeks,
  addWeeks,
  isAfter,
  isBefore,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import type { Workout, PersonalBest } from '@/types';
import { exerciseLibraryMap } from '@/lib/exercises';

// ---------------------------------------------------------------------------
// Aggregation helpers (pure, deterministic — easy to unit test later)
// ---------------------------------------------------------------------------

type WeeklyReport = {
  weekStart: Date;
  weekEnd: Date;
  workoutsCompleted: number;
  totalVolumeKg: number;
  totalSets: number;
  prsThisWeek: { exerciseName: string; value: string; achievedAt: string }[];
  bestDay: { weekday: string; volume: number } | null;
};

function getDisplayName(exerciseId: string, fallback?: string): string {
  const fromLib = exerciseLibraryMap.get(exerciseId)?.name;
  if (fromLib) return fromLib;
  if (fallback) return fallback;
  return exerciseId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeWorkoutVolume(w: Workout): number {
  // Prefer pre-computed totalVolume (set at finish in workoutStore). Fall
  // back to a recompute so legacy workouts without the field still aggregate.
  if (typeof w.totalVolume === 'number' && w.totalVolume > 0) return w.totalVolume;
  let vol = 0;
  for (const ex of w.exercises || []) {
    for (const s of ex.sets || []) {
      if (s.completed && typeof s.weight === 'number' && typeof s.reps === 'number') {
        vol += s.weight * s.reps;
      }
    }
  }
  return vol;
}

function countCompletedSets(w: Workout): number {
  let n = 0;
  for (const ex of w.exercises || []) {
    for (const s of ex.sets || []) {
      if (s.completed) n++;
    }
  }
  return n;
}

function isUserCompletedWorkout(w: Workout, userId: string): boolean {
  return w.userId === userId && w.status === 'completed' && !w.deletedAt;
}

function summarize(
  workouts: Workout[],
  pbs: PersonalBest[],
  userId: string,
  weekStart: Date,
  weekEnd: Date,
): WeeklyReport {
  const inWeek = workouts.filter((w) => {
    if (!isUserCompletedWorkout(w, userId)) return false;
    const ts = new Date(w.startTime);
    if (isNaN(ts.getTime())) return false;
    return isWithinInterval(ts, { start: weekStart, end: weekEnd });
  });

  let totalVolumeKg = 0;
  let totalSets = 0;
  const volumeByWeekday = new Map<string, number>();

  for (const w of inWeek) {
    const vol = computeWorkoutVolume(w);
    totalVolumeKg += vol;
    totalSets += countCompletedSets(w);
    const weekday = format(new Date(w.startTime), 'EEEE');
    volumeByWeekday.set(weekday, (volumeByWeekday.get(weekday) || 0) + vol);
  }

  let bestDay: WeeklyReport['bestDay'] = null;
  for (const [weekday, volume] of volumeByWeekday) {
    if (volume <= 0) continue;
    if (!bestDay || volume > bestDay.volume) bestDay = { weekday, volume };
  }

  const prsThisWeek = pbs
    .filter((pb) => {
      if (pb.userId !== userId) return false;
      const ts = new Date(pb.achievedAt);
      if (isNaN(ts.getTime())) return false;
      return isWithinInterval(ts, { start: weekStart, end: weekEnd });
    })
    .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
    .map((pb) => ({
      exerciseName: getDisplayName(pb.exerciseId, pb.exerciseName),
      value:
        pb.bestWeight && pb.bestReps
          ? `${Math.round(pb.bestWeight)} kg × ${pb.bestReps} (e1RM ${Math.round(pb.oneRepMax)} kg)`
          : `e1RM ${Math.round(pb.oneRepMax)} kg`,
      achievedAt: pb.achievedAt,
    }));

  return {
    weekStart,
    weekEnd,
    workoutsCompleted: inWeek.length,
    totalVolumeKg: Math.round(totalVolumeKg),
    totalSets,
    prsThisWeek,
    bestDay,
  };
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg} kg`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { user } = useAuthStore();
  const { workoutHistory, personalBests } = useWorkoutStore();

  // Hydration flag — Zustand persist rehydrates client-side. Render a
  // light skeleton until the first client paint to avoid SSR/CSR drift
  // and to avoid showing "no workouts" before the store is ready.
  const { hydrated } = useRequireAuth();

  // Anchor = Monday of the currently viewed week. Starts on the current
  // week and is paged with ◀/▶. Bounded by the user's earliest workout
  // and the present.
  const todayMonday = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const [anchor, setAnchor] = useState<Date>(todayMonday);

  const userId = user?.id || '';

  const userWorkouts = useMemo(
    () => workoutHistory.filter((w) => isUserCompletedWorkout(w, userId)),
    [workoutHistory, userId],
  );

  // Earliest activity defines the back-nav bound.
  const earliestMonday = useMemo<Date | null>(() => {
    let earliest: Date | null = null;
    for (const w of userWorkouts) {
      const ts = new Date(w.startTime);
      if (isNaN(ts.getTime())) continue;
      if (!earliest || ts < earliest) earliest = ts;
    }
    return earliest ? startOfWeek(earliest, { weekStartsOn: 1 }) : null;
  }, [userWorkouts]);

  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekEnd = useMemo(() => endOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);

  const thisReport = useMemo(
    () => summarize(workoutHistory, personalBests, userId, weekStart, weekEnd),
    [workoutHistory, personalBests, userId, weekStart, weekEnd],
  );

  const prevWeekStart = useMemo(() => subWeeks(weekStart, 1), [weekStart]);
  const prevWeekEnd = useMemo(() => endOfWeek(prevWeekStart, { weekStartsOn: 1 }), [prevWeekStart]);

  const prevReport = useMemo(
    () => summarize(workoutHistory, personalBests, userId, prevWeekStart, prevWeekEnd),
    [workoutHistory, personalBests, userId, prevWeekStart, prevWeekEnd],
  );

  // vs-last-week deltas — null when prior week had zero (avoid /0 + show
  // "no prior data" message instead of misleading 100% deltas).
  const workoutsDelta = thisReport.workoutsCompleted - prevReport.workoutsCompleted;
  const volumeDeltaPct =
    prevReport.totalVolumeKg > 0
      ? Math.round(((thisReport.totalVolumeKg - prevReport.totalVolumeKg) / prevReport.totalVolumeKg) * 100)
      : null;
  const hasPriorWeekData = prevReport.workoutsCompleted > 0 || prevReport.totalVolumeKg > 0;

  // Navigation bounds.
  const canGoForward = isBefore(weekStart, todayMonday);
  // canGoBack: only when there's prior activity *before* the currently viewed week.
  // If no workouts yet, no back-nav. If on the earliest-active week, no further back.
  const canGoBack = earliestMonday ? isAfter(weekStart, earliestMonday) : false;

  const goPrev = () => {
    if (!canGoBack) return;
    setAnchor((a) => subWeeks(a, 1));
  };
  const goNext = () => {
    if (!canGoForward) return;
    setAnchor((a) => addWeeks(a, 1));
  };

  const isCurrentWeek = +weekStart === +todayMonday;
  const isEmptyWeek = thisReport.workoutsCompleted === 0;
  const isBrandNew = userWorkouts.length === 0;

  // ---------------- Render ----------------

  if (!hydrated) {
    return (
      <MainLayout>
        <PageHeader title="Weekly Reports" subtitle="Your training week in detail" showBack />
        <div className="px-4 py-6 space-y-3">
          <div className="h-10 rounded bg-gray-100 animate-pulse" />
          <div className="h-24 rounded bg-gray-100 animate-pulse" />
          <div className="h-32 rounded bg-gray-100 animate-pulse" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader title="Weekly Reports" subtitle="Your training week in detail" showBack />
      <div className="px-4 py-6 space-y-4">
        {/* Week selector */}
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={!canGoBack}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {isCurrentWeek ? 'This week' : 'Week of'}
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </div>
          </div>
          <button
            onClick={goNext}
            disabled={!canGoForward}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Brand-new-user / empty-week states */}
        {isBrandNew ? (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-8 text-center">
              <Sparkles className="w-12 h-12 text-sky-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">No workouts yet</h3>
              <p className="text-sm text-gray-500">
                Finish your first session and your weekly summary will appear here automatically.
              </p>
            </CardContent>
          </Card>
        ) : isEmptyWeek ? (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-8 text-center">
              <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">A quiet week</h3>
              <p className="text-sm text-gray-500">
                No completed workouts in this window. Rest weeks count too — page back to see a recent one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* At-a-glance */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-3 text-center">
                  <Dumbbell className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-gray-900">{thisReport.workoutsCompleted}</div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Workouts</div>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-gray-900">{formatVolume(thisReport.totalVolumeKg)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Volume</div>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-3 text-center">
                  <CalendarDays className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-gray-900">{thisReport.totalSets}</div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Sets</div>
                </CardContent>
              </Card>
            </div>

            {/* Wins (PBs this week) */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Wins</h3>
                  {thisReport.prsThisWeek.length > 0 && (
                    <Badge variant="secondary" className="ml-auto bg-amber-50 text-amber-700 border-amber-200">
                      {thisReport.prsThisWeek.length} new PB{thisReport.prsThisWeek.length === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                {thisReport.prsThisWeek.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No new PBs — consistency still counts.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {thisReport.prsThisWeek.map((pb, i) => (
                      <li key={`${pb.exerciseName}-${i}`} className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{pb.exerciseName}</div>
                          <div className="text-xs text-gray-500">{pb.value}</div>
                        </div>
                        <div className="text-[11px] text-gray-400 whitespace-nowrap">
                          {format(new Date(pb.achievedAt), 'EEE')}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Vs last week */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Vs last week</h3>
                {!hasPriorWeekData ? (
                  <p className="text-sm text-gray-500">
                    No data from the prior week yet — give it one more cycle.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <DeltaBlock
                      label="Workouts"
                      delta={workoutsDelta}
                      formatted={`${workoutsDelta > 0 ? '+' : ''}${workoutsDelta}`}
                    />
                    <DeltaBlock
                      label="Volume"
                      delta={volumeDeltaPct ?? 0}
                      formatted={volumeDeltaPct === null ? '—' : `${volumeDeltaPct > 0 ? '+' : ''}${volumeDeltaPct}%`}
                      neutral={volumeDeltaPct === null}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Best day */}
            {thisReport.bestDay && (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">Best day</h3>
                  <p className="text-sm text-gray-700">
                    Your biggest day was <span className="font-semibold">{thisReport.bestDay.weekday}</span>{' '}
                    <span className="text-gray-500">({formatVolume(Math.round(thisReport.bestDay.volume))})</span>.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Light disclaimer — personal summary, not coaching advice */}
            <p className="text-[11px] text-gray-400 text-center pt-2">
              Auto-generated from your completed workouts. Not medical or coaching advice.
            </p>
          </>
        )}
      </div>
    </MainLayout>
  );
}

// ---------------------------------------------------------------------------
// Tiny presentational helper — keeps the deltas readable + a11y-friendly.
// ---------------------------------------------------------------------------

function DeltaBlock({
  label,
  delta,
  formatted,
  neutral,
}: {
  label: string;
  delta: number;
  formatted: string;
  neutral?: boolean;
}) {
  const positive = !neutral && delta > 0;
  const negative = !neutral && delta < 0;
  const color = neutral
    ? 'text-gray-500'
    : positive
    ? 'text-emerald-600'
    : negative
    ? 'text-rose-600'
    : 'text-gray-600';
  const Icon = neutral || delta === 0 ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 flex items-center gap-1 text-base font-semibold ${color}`}>
        <Icon className="w-4 h-4" />
        <span>{formatted}</span>
      </div>
    </div>
  );
}
