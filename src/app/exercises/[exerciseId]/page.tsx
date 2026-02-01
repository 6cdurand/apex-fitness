'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useWorkoutStore } from '@/lib/store';
import { useAuthStore } from '@/lib/store';
import { maleTierRanges, femaleTierRanges, getTierBgColor, calculate1RM } from '@/lib/strengthRating';
import { calculateExerciseStats, normalizeExerciseId, getSmoothed1RMTrend } from '@/lib/exerciseStats';
import { Trophy, TrendingUp, Calendar, Target, Dumbbell, BarChart3, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { Workout, WorkoutExercise, WorkoutSet } from '@/types';

type StrengthTier = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

export default function ExerciseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params.exerciseId as string;
  const { personalBests, workoutHistory } = useWorkoutStore();
  const { user } = useAuthStore();
  
  const isMale = user?.gender !== 'female';
  const normalizedId = normalizeExerciseId(exerciseId);
  const tierRanges = isMale ? maleTierRanges : femaleTierRanges;
  const ranges = tierRanges[normalizedId];

  // Calculate comprehensive exercise stats
  const stats = useMemo(() => {
    if (!user?.id) return null;
    const result = calculateExerciseStats(normalizedId, workoutHistory, user.id, isMale);
    console.log(`[ExerciseStats] ${normalizedId}: ${result?.totalSessions || 0} sessions, ${result?.totalSets || 0} sets, workouts: ${workoutHistory.filter(w => w.userId === user.id).length}`);
    return result;
  }, [normalizedId, workoutHistory, user?.id, isMale]);

  // Get smoothed 1RM trend for graph
  const oneRMTrendData = useMemo(() => {
    if (!stats?.sessions) return [];
    return getSmoothed1RMTrend(stats.sessions, 3);
  }, [stats?.sessions]);

  const exerciseName = normalizedId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Use stats data or fallback to PB lookup
  const pb = personalBests.find(p => p.exerciseId === normalizedId && p.userId === user?.id);
  const weight = stats?.allTimeBest1RM || pb?.oneRepMax || 0;
  const bestWeight = stats?.allTimeBestWeight || pb?.bestWeight || 0;

  // Calculate current tier and progress
  let currentTier: StrengthTier = 'beginner';
  let tierProgress = 0;
  let nextTierWeight = ranges?.novice?.[0] || 0;

  if (ranges && weight > 0) {
    if (weight >= ranges.elite[0]) {
      currentTier = 'elite';
      tierProgress = Math.min(100, ((weight - ranges.elite[0]) / (ranges.elite[1] - ranges.elite[0])) * 100);
      nextTierWeight = ranges.elite[1];
    } else if (weight >= ranges.advanced[0]) {
      currentTier = 'advanced';
      tierProgress = ((weight - ranges.advanced[0]) / (ranges.advanced[1] - ranges.advanced[0])) * 100;
      nextTierWeight = ranges.elite[0];
    } else if (weight >= ranges.intermediate[0]) {
      currentTier = 'intermediate';
      tierProgress = ((weight - ranges.intermediate[0]) / (ranges.intermediate[1] - ranges.intermediate[0])) * 100;
      nextTierWeight = ranges.advanced[0];
    } else if (weight >= ranges.novice[0]) {
      currentTier = 'novice';
      tierProgress = ((weight - ranges.novice[0]) / (ranges.novice[1] - ranges.novice[0])) * 100;
      nextTierWeight = ranges.intermediate[0];
    } else {
      currentTier = 'beginner';
      tierProgress = ranges.beginner[1] > 0 ? (weight / ranges.beginner[1]) * 100 : 0;
      nextTierWeight = ranges.novice[0];
    }
  }

  const getTierTextColor = (tier: StrengthTier) => {
    switch (tier) {
      case 'elite': return 'text-orange-400';
      case 'advanced': return 'text-purple-400';
      case 'intermediate': return 'text-blue-400';
      case 'novice': return 'text-sky-400';
      default: return 'text-slate-400';
    }
  };

  const tiers: { name: StrengthTier; range: [number, number] }[] = ranges ? [
    { name: 'beginner', range: ranges.beginner },
    { name: 'novice', range: ranges.novice },
    { name: 'intermediate', range: ranges.intermediate },
    { name: 'advanced', range: ranges.advanced },
    { name: 'elite', range: ranges.elite },
  ] : [];

  // Find best by common rep ranges
  const repRanges = [1, 3, 5, 8, 10, 12];
  const bestByReps = repRanges.map(reps => ({
    reps,
    best: stats?.bestByRepRange[reps] || null,
  })).filter(r => r.best);

  // Calculate max values for graph scaling
  const maxOneRM = oneRMTrendData.length > 0 ? Math.max(...oneRMTrendData.map(d => d.oneRM)) : 0;
  const maxVolume = stats?.sessions?.length ? Math.max(...stats.sessions.map(s => s.totalVolume)) : 0;

  return (
    <MainLayout>
      <PageHeader 
        title={exerciseName}
        subtitle={isMale ? 'Male Standards' : 'Female Standards'}
        showBack
      />
      
      <div className="px-4 py-6 space-y-6 -mt-4">
        {/* Current Stats Hero */}
        <Card className="bg-slate-900/90 border-slate-800">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <p className="text-sm text-slate-500 mb-2">Estimated 1RM</p>
              <p className="text-5xl font-bold text-white mb-2">
                {weight > 0 ? `${Math.round(weight)}kg` : '—'}
              </p>
              {weight > 0 && ranges && (
                <Badge className={`${getTierBgColor(currentTier)} ${getTierTextColor(currentTier)} border-0`}>
                  {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                </Badge>
              )}
            </div>

            {weight > 0 && ranges && (
              <>
                <Progress 
                  value={tierProgress} 
                  tier={currentTier}
                  className="h-3 mb-3"
                />
                <p className="text-center text-sm text-slate-400">
                  {currentTier === 'elite' 
                    ? `${Math.round(tierProgress)}% through Elite tier`
                    : `${Math.round(nextTierWeight - weight)}kg to ${currentTier === 'beginner' ? 'Novice' : currentTier === 'novice' ? 'Intermediate' : currentTier === 'intermediate' ? 'Advanced' : 'Elite'}`
                  }
                </p>
              </>
            )}

            {weight === 0 && (
              <p className="text-center text-slate-500 text-sm">
                Complete this exercise in a workout to track your progress
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-4 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-orange-400" />
              <p className="text-xl font-bold text-white">{bestWeight > 0 ? `${bestWeight}kg` : '—'}</p>
              <p className="text-xs text-slate-500">Best Weight</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-sky-400" />
              <p className="text-xl font-bold text-white">{Math.round(weight)}kg</p>
              <p className="text-xs text-slate-500">Est. 1RM</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-white">{stats?.totalSessions || 0}</p>
              <p className="text-[10px] text-slate-500">Sessions</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-white">{stats?.totalSets || 0}</p>
              <p className="text-[10px] text-slate-500">Total Sets</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-white">{stats?.totalVolume ? `${Math.round(stats.totalVolume / 1000)}k` : '0'}</p>
              <p className="text-[10px] text-slate-500">Total Volume</p>
            </CardContent>
          </Card>
        </div>

        {/* 1RM Trend Graph */}
        {oneRMTrendData.length > 1 && (
          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                1RM Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40 flex items-end gap-1">
                {oneRMTrendData.slice(-12).map((point, idx) => {
                  const height = maxOneRM > 0 ? (point.oneRM / maxOneRM) * 100 : 0;
                  const isPR = point.oneRM === maxOneRM;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className={`w-full rounded-t transition-all ${isPR ? 'bg-orange-500' : 'bg-sky-500'}`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                      <span className="text-[8px] text-slate-500 -rotate-45 origin-left">
                        {format(new Date(point.date), 'M/d')}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-xs text-slate-400">
                <span>Smoothed trend (3-session avg)</span>
                <span className="text-orange-400">● = PR</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Volume Per Session Graph */}
        {stats?.sessions && stats.sessions.length > 1 && (
          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                Volume Per Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 flex items-end gap-1">
                {stats.sessions.slice(-12).map((session, idx) => {
                  const height = maxVolume > 0 ? (session.totalVolume / maxVolume) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-2">Last {Math.min(12, stats.sessions.length)} sessions</p>
            </CardContent>
          </Card>
        )}

        {/* Best by Rep Range */}
        {bestByReps.length > 0 && (
          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-purple-400" />
                Best by Rep Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {bestByReps.map(({ reps, best }) => (
                  <div key={reps} className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">{reps}RM</p>
                    <p className="text-lg font-bold text-white">{best?.weight}kg</p>
                    <p className="text-[10px] text-slate-500">≈{Math.round(best?.oneRM || 0)}kg 1RM</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tier Standards */}
        {tiers.length > 0 && (
          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-sky-400" />
                Strength Standards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tiers.map((tier) => {
                const isCurrentTier = tier.name === currentTier;
                const isAchieved = weight >= tier.range[0];
                
                return (
                  <div 
                    key={tier.name}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isCurrentTier 
                        ? `${getTierBgColor(tier.name)} border border-slate-700` 
                        : 'bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isAchieved && (
                        <div className={`w-2 h-2 rounded-full ${
                          tier.name === 'elite' ? 'bg-orange-400' :
                          tier.name === 'advanced' ? 'bg-purple-400' :
                          tier.name === 'intermediate' ? 'bg-blue-400' :
                          tier.name === 'novice' ? 'bg-sky-400' : 'bg-slate-400'
                        }`} />
                      )}
                      <span className={`font-medium ${isCurrentTier ? 'text-white' : 'text-slate-400'}`}>
                        {tier.name.charAt(0).toUpperCase() + tier.name.slice(1)}
                      </span>
                    </div>
                    <span className={`font-mono ${isCurrentTier ? 'text-white' : 'text-slate-500'}`}>
                      {tier.range[0]} – {tier.range[1]}kg
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Sessions */}
        {stats?.sessions && stats.sessions.length > 0 && (
          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.sessions.slice(-5).reverse().map((session, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl ${session.isPR ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-slate-800/50'}`}
                >
                  <div className="flex items-center gap-2">
                    {session.isPR && <Trophy className="w-4 h-4 text-orange-400" />}
                    <span className="text-slate-400">
                      {format(new Date(session.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white font-medium">
                      {session.totalSets} sets
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      {session.topSet.weight}kg × {session.topSet.reps}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
