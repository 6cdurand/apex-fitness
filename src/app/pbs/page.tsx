'use client';

/**
 * /pbs — v16-D6 Personal Bests detail route.
 *
 * Sprint v16 Dispatch #6. Wired from src/app/profile/page.tsx "See All"
 * button (BUG-23). Self-only view; trainer per-client deep-dive deferred
 * (see brief §4 F4 / §7 Out of scope).
 *
 * PB rule (global, locked v16-D6): best estimated 1RM (e1RM) per exercise.
 * - Brzycki for reps ≤ 6:  weight × (36 / (37 - reps))
 * - Epley for reps 7-20:   weight × (1 + reps / 30)
 * - reps > 20:             excluded (returns 0; doesn't count)
 *
 * Page layout (per brief §4 F3):
 *   - PageHeader with total PB count
 *   - Search + sort row (e1RM desc / recent / alphabetical)
 *   - Card list of PBs; tap a row expands an inline e1RM progression chart
 *     (one point per workout that contained the exercise, best set e1RM)
 *   - Empty state when there are no PBs / no matches
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, Search } from 'lucide-react';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { exerciseLibraryMap } from '@/lib/exercises';

// v16-D6: inline e1RM calc — matches src/lib/exercises.ts:calculate1RM but
// kept local so this page doesn't crash if that module reshuffles. Same
// formulas as the global PB rule; no rounding here so the chart can show
// smooth progression deltas.
function calcE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps > 20) return 0; // excluded from PB
  if (reps === 1) return weight;
  if (reps <= 6) return weight * (36 / (37 - reps)); // Brzycki
  return weight * (1 + reps / 30); // Epley
}

function getExerciseDisplayName(exerciseId: string, fallbackName?: string): string {
  // Prefer the catalog name; fall back to a humanized exerciseId so PBs for
  // ad-hoc / legacy exercises (no catalog entry) still render readably.
  const fromLibrary = exerciseLibraryMap.get(exerciseId)?.name;
  if (fromLibrary) return fromLibrary;
  if (fallbackName) return fallbackName;
  return exerciseId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type SortMode = 'e1rm' | 'recent' | 'alphabetical';

export default function PBsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { personalBests, workoutHistory } = useWorkoutStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('e1rm');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // Index of exerciseId -> display name from history (used as fallback when
  // the catalog lookup misses, e.g. for ad-hoc / template-only exercises).
  const exerciseNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const w of workoutHistory) {
      if (!w?.exercises) continue;
      for (const ex of w.exercises) {
        if (!ex?.exerciseId) continue;
        if (!m[ex.exerciseId] && ex.exercise?.name) {
          m[ex.exerciseId] = ex.exercise.name;
        }
      }
    }
    return m;
  }, [workoutHistory]);

  const userPBs = useMemo(
    () => personalBests.filter((pb) => pb.userId === user?.id),
    [personalBests, user?.id]
  );

  const filtered = useMemo(() => {
    let pbs = userPBs;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      pbs = pbs.filter((pb) => {
        const name = getExerciseDisplayName(pb.exerciseId, exerciseNameMap[pb.exerciseId] || pb.exerciseName).toLowerCase();
        return name.includes(q) || pb.exerciseId.toLowerCase().includes(q);
      });
    }
    const sorted = [...pbs];
    switch (sortBy) {
      case 'e1rm':
        sorted.sort((a, b) => (b.oneRepMax || 0) - (a.oneRepMax || 0));
        break;
      case 'recent':
        sorted.sort(
          (a, b) =>
            new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
        );
        break;
      case 'alphabetical':
        sorted.sort((a, b) => {
          const an = getExerciseDisplayName(a.exerciseId, exerciseNameMap[a.exerciseId] || a.exerciseName);
          const bn = getExerciseDisplayName(b.exerciseId, exerciseNameMap[b.exerciseId] || b.exerciseName);
          return an.localeCompare(bn);
        });
        break;
    }
    return sorted;
  }, [userPBs, searchTerm, sortBy, exerciseNameMap]);

  // Per-exercise progression points (one per workout, best set e1RM in that
  // workout). Sorted chronologically. Empty when no expansion or no history.
  const progressionData = useMemo(() => {
    if (!selectedExerciseId || !user?.id) return [];
    const points: { date: string; ts: number; e1rm: number; weight: number; reps: number }[] = [];
    for (const w of workoutHistory) {
      if (w.userId !== user.id) continue;
      if (w.deletedAt) continue;
      if (w.status && w.status !== 'completed') continue;
      const ts = new Date(w.endTime || w.startTime || 0).getTime();
      if (!isFinite(ts) || ts === 0) continue;
      let bestE1RM = 0;
      let bestSet: { weight: number; reps: number } | null = null;
      for (const ex of w.exercises || []) {
        if (ex.exerciseId !== selectedExerciseId) continue;
        for (const s of ex.sets || []) {
          if (!s.completed || !s.weight || !s.reps) continue;
          const e1rm = calcE1RM(s.weight, s.reps);
          if (e1rm > bestE1RM) {
            bestE1RM = e1rm;
            bestSet = { weight: s.weight, reps: s.reps };
          }
        }
      }
      if (bestSet && bestE1RM > 0) {
        points.push({
          date: format(new Date(ts), 'MMM d'),
          ts,
          e1rm: Math.round(bestE1RM),
          weight: bestSet.weight,
          reps: bestSet.reps,
        });
      }
    }
    points.sort((a, b) => a.ts - b.ts);
    return points;
  }, [selectedExerciseId, workoutHistory, user?.id]);

  if (!isAuthenticated || !user) return null;

  return (
    <MainLayout>
      <PageHeader
        title="Personal Bests"
        subtitle={`${userPBs.length} all-time PB${userPBs.length === 1 ? '' : 's'}`}
        showBack
      />

      <div className="p-4 space-y-3">
        {/* Search + sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search exercise…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="text-sm border border-gray-200 rounded px-2 bg-white text-gray-700"
            aria-label="Sort PBs"
          >
            <option value="e1rm">e1RM (high → low)</option>
            <option value="recent">Recent</option>
            <option value="alphabetical">A → Z</option>
          </select>
        </div>

        {/* List / empty state */}
        {userPBs.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">No personal bests yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Complete a workout with weighted sets to start tracking PBs.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">No PBs match your search</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((pb) => {
              const displayName = getExerciseDisplayName(
                pb.exerciseId,
                exerciseNameMap[pb.exerciseId] || pb.exerciseName
              );
              const isOpen = selectedExerciseId === pb.exerciseId;
              return (
                <Card
                  key={pb.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() =>
                    setSelectedExerciseId(isOpen ? null : pb.exerciseId)
                  }
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {pb.bestWeight}kg × {pb.bestReps} ·{' '}
                          {format(new Date(pb.achievedAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-bold text-amber-500">
                          {Math.round(pb.oneRepMax)}kg
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          e1RM
                        </p>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {progressionData.length >= 2 ? (
                          <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={progressionData}
                                margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" fontSize={10} stroke="#9ca3af" />
                                <YAxis fontSize={10} stroke="#9ca3af" />
                                <Tooltip
                                  contentStyle={{ fontSize: 12 }}
                                  formatter={(value: number, _name, p: any) => {
                                    const w = p?.payload?.weight;
                                    const r = p?.payload?.reps;
                                    return [
                                      `${value}kg e1RM (${w}kg × ${r})`,
                                      'Best set',
                                    ];
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="e1rm"
                                  stroke="#f59e0b"
                                  strokeWidth={2}
                                  dot={{ r: 3, fill: '#f59e0b' }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : progressionData.length === 1 ? (
                          <p className="text-xs text-gray-500">
                            Only one logged session for this exercise — log more
                            to see a progression chart.
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            No history found for this exercise.
                          </p>
                        )}

                        {progressionData.length > 0 && (
                          <div className="mt-3 flex items-center justify-between">
                            <Badge
                              variant="secondary"
                              className="bg-gray-100 text-gray-600"
                            >
                              {progressionData.length} session
                              {progressionData.length === 1 ? '' : 's'} logged
                            </Badge>
                            <span className="text-[11px] text-gray-500">
                              First: {progressionData[0].e1rm}kg → Latest:{' '}
                              {progressionData[progressionData.length - 1].e1rm}kg
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
