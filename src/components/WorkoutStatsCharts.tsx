'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, Dumbbell, Calendar, Activity, ChevronRight, Target } from 'lucide-react';
import { format, subDays, eachWeekOfInterval, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { Workout, PersonalBest } from '@/types';
import { useRouter } from 'next/navigation';

interface WorkoutStatsChartsProps {
  workoutHistory: Workout[];
  personalBests: PersonalBest[];
  compact?: boolean;
}

type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

const muscleGroupExercises: Record<MuscleGroup, string[]> = {
  chest: ['bench-press', 'incline-bench', 'dumbbell-press', 'incline-dumbbell', 'cable-fly', 'chest-press', 'push-up', 'chest-fly', 'pec-deck', 'dips', 'machine-chest'],
  back: ['lat-pulldown', 'pulldown', 'barbell-row', 'cable-row', 'deadlift', 'pull-up', 't-bar-row', 'seated-row', 'face-pull', 'row', 'machine-back'],
  legs: ['squat', 'leg-press', 'romanian-deadlift', 'rdl', 'lunges', 'lunge', 'leg-curl', 'leg-extension', 'hip-thrust', 'calf-raise', 'split-squat', 'goblet', 'hack-squat'],
  shoulders: ['overhead-press', 'shoulder-press', 'db-shoulder', 'lateral-raise', 'lateral-raises', 'front-raise', 'rear-delt', 'arnold-press', 'upright-row', 'ohp', 'military-press', 'machine-shoulder'],
  arms: ['bicep-curl', 'curl', 'tricep', 'pushdown', 'hammer-curl', 'preacher', 'skull-crusher', 'dip', 'concentration'],
  core: ['plank', 'crunch', 'sit-up', 'leg-raise', 'ab-wheel', 'cable-crunch', 'woodchop'],
};

const muscleGroupColors: Record<MuscleGroup, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  legs: '#8b5cf6',
  shoulders: '#f59e0b',
  arms: '#10b981',
  core: '#ec4899',
};

export function WorkoutStatsCharts({ workoutHistory, personalBests, compact = false }: WorkoutStatsChartsProps) {
  const router = useRouter();
  const [showAllExercises, setShowAllExercises] = useState(false);

  // Calculate weekly volume data (last 8 weeks) with muscle group filtering
  const weeklyVolumeData = useMemo(() => {
    const weeks = eachWeekOfInterval({
      start: subWeeks(new Date(), 7),
      end: new Date(),
    });

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekWorkouts = workoutHistory.filter(w => {
        const date = new Date(w.startTime);
        return date >= weekStart && date <= weekEnd;
      });

      // Calculate volume per muscle group
      let chestVol = 0, backVol = 0, legsVol = 0, shouldersVol = 0, totalVol = 0;

      weekWorkouts.forEach(w => {
        // Use totalVolume from workout if available, otherwise calculate from exercises
        if (w.totalVolume) {
          totalVol += w.totalVolume;
        }
        
        // Also try to calculate from exercises for muscle group breakdown
        w.exercises?.forEach(ex => {
          const exId = (ex.exerciseId || (ex as any).name || '').toLowerCase().replace(/\s+/g, '-');
          const exVol = ex.sets?.reduce((sum: number, s: any) => sum + ((s.weight || 0) * (s.reps || 0)), 0) || 0;
          
          // Only add to totalVol if we didn't get it from w.totalVolume
          if (!w.totalVolume) totalVol += exVol;

          if (muscleGroupExercises.chest.some(e => exId.includes(e))) chestVol += exVol;
          else if (muscleGroupExercises.back.some(e => exId.includes(e))) backVol += exVol;
          else if (muscleGroupExercises.legs.some(e => exId.includes(e))) legsVol += exVol;
          else if (muscleGroupExercises.shoulders.some(e => exId.includes(e))) shouldersVol += exVol;
        });
      });

      return {
        week: format(weekStart, 'MMM d'),
        total: Math.round(totalVol / 1000),
        chest: Math.round(chestVol / 1000),
        back: Math.round(backVol / 1000),
        legs: Math.round(legsVol / 1000),
        shoulders: Math.round(shouldersVol / 1000),
        workouts: weekWorkouts.length,
      };
    });
  }, [workoutHistory]);

  // Calculate daily workout frequency (last 30 days)
  const dailyFrequencyData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      const dayWorkouts = workoutHistory.filter(w => 
        format(new Date(w.startTime), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      return {
        date: format(date, 'MMM d'),
        shortDate: format(date, 'd'),
        workouts: dayWorkouts.length,
        volume: Math.round(dayWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0) / 1000),
      };
    });
    return last30Days;
  }, [workoutHistory]);

  // Calculate 1RM trends for most used exercises
  const oneRMTrendData = useMemo(() => {
    // Count exercise occurrences and get their 1RM history
    const exerciseData: Record<string, { count: number; history: { date: string; oneRM: number }[] }> = {};
    
    workoutHistory
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .forEach(workout => {
        workout.exercises?.forEach(ex => {
          const exId = ex.exerciseId || '';
          if (!exId) return;
          
          if (!exerciseData[exId]) {
            exerciseData[exId] = { count: 0, history: [] };
          }
          exerciseData[exId].count++;
          
          // Find best set in this workout for 1RM calculation
          let best1RM = 0;
          ex.sets?.filter(s => s.completed && s.weight && s.reps).forEach(set => {
            const oneRM = set.weight! * (1 + set.reps! / 30);
            if (oneRM > best1RM) best1RM = oneRM;
          });
          
          if (best1RM > 0) {
            exerciseData[exId].history.push({
              date: format(new Date(workout.startTime), 'MMM d'),
              oneRM: Math.round(best1RM),
            });
          }
        });
      });
    
    // Get top 4 most used exercises with history
    return Object.entries(exerciseData)
      .filter(([_, data]) => data.history.length >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([exId, data]) => ({
        exerciseId: exId,
        name: exId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        history: data.history.slice(-8), // Last 8 data points
        current1RM: data.history[data.history.length - 1]?.oneRM || 0,
        previous1RM: data.history[data.history.length - 2]?.oneRM || 0,
      }));
  }, [workoutHistory]);


  // Summary stats
  const stats = useMemo(() => {
    const totalWorkouts = workoutHistory.length;
    const totalVolume = workoutHistory.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const totalDuration = workoutHistory.reduce((sum, w) => sum + (w.duration || 0), 0);
    
    const thisWeekStart = startOfWeek(new Date());
    const thisWeekWorkouts = workoutHistory.filter(w => new Date(w.startTime) >= thisWeekStart).length;
    
    const last30Days = subDays(new Date(), 30);
    const last30DaysWorkouts = workoutHistory.filter(w => new Date(w.startTime) >= last30Days).length;

    return {
      totalWorkouts,
      totalVolume: Math.round(totalVolume / 1000),
      totalHours: Math.round(totalDuration / 3600),
      thisWeekWorkouts,
      last30DaysWorkouts,
      avgPerWeek: Math.round(last30DaysWorkouts / 4.3),
    };
  }, [workoutHistory]);

  if (compact) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 bg-gray-800 rounded-lg">
              <p className="text-lg font-bold text-white">{stats.totalWorkouts}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
            <div className="text-center p-2 bg-gray-800 rounded-lg">
              <p className="text-lg font-bold text-sky-400">{stats.thisWeekWorkouts}</p>
              <p className="text-xs text-gray-400">This Week</p>
            </div>
            <div className="text-center p-2 bg-gray-800 rounded-lg">
              <p className="text-lg font-bold text-blue-400">{stats.avgPerWeek}</p>
              <p className="text-xs text-gray-400">Avg/Week</p>
            </div>
          </div>
          
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyVolumeData}>
                <defs>
                  <linearGradient id="volumeGradientCompact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10b981" 
                  fill="url(#volumeGradientCompact)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">Weekly Volume (last 8 weeks)</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gray-800/50 rounded-xl p-3 text-center">
          <Dumbbell className="w-5 h-5 text-sky-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{stats.totalWorkouts}</p>
          <p className="text-[10px] text-gray-500">Workouts</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3 text-center">
          <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{stats.totalVolume}k</p>
          <p className="text-[10px] text-gray-500">Volume (kg)</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3 text-center">
          <Calendar className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{stats.thisWeekWorkouts}</p>
          <p className="text-[10px] text-gray-500">This Week</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3 text-center">
          <Target className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{personalBests.length}</p>
          <p className="text-[10px] text-gray-500">PRs</p>
        </div>
      </div>

      {/* 1RM Trends - Top Exercises */}
      <Card className="bg-gray-900/90 border-gray-800/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              1RM Progress
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400 hover:text-white"
              onClick={() => router.push('/exercises')}
            >
              View All <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {oneRMTrendData.length > 0 ? (
            <div className="space-y-4">
              {oneRMTrendData.slice(0, showAllExercises ? 4 : 2).map((exercise, idx) => {
                const trend = exercise.current1RM - exercise.previous1RM;
                const trendPercent = exercise.previous1RM > 0 
                  ? Math.round((trend / exercise.previous1RM) * 100) 
                  : 0;
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                const color = colors[idx % colors.length];
                
                return (
                  <div key={exercise.exerciseId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => router.push(`/exercises/${exercise.exerciseId}`)}
                        className="text-sm font-medium text-white hover:text-sky-400 transition-colors text-left"
                      >
                        {exercise.name}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{exercise.current1RM}kg</span>
                        {trend !== 0 && (
                          <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trend > 0 ? '+' : ''}{trendPercent}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-16">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={exercise.history}>
                          <XAxis dataKey="date" hide />
                          <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: number) => [`${value}kg`, '1RM']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="oneRM" 
                            stroke={color}
                            strokeWidth={2}
                            dot={{ fill: color, strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5, fill: color }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
              {oneRMTrendData.length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-gray-400 hover:text-white"
                  onClick={() => setShowAllExercises(!showAllExercises)}
                >
                  {showAllExercises ? 'Show Less' : `Show ${oneRMTrendData.length - 2} More`}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Activity className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No exercise data yet</p>
              <p className="text-gray-500 text-xs">Complete workouts to track 1RM trends</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Volume Trend */}
      <Card className="bg-gray-900/90 border-gray-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Dumbbell className="w-4 h-4 text-emerald-400" />
            Weekly Volume Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyVolumeData}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`${value}k kg`, 'Volume']}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10b981" 
                  fill="url(#volumeGradient)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Workout Frequency */}
      <Card className="bg-gray-900/90 border-gray-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-purple-400" />
            Workout Frequency
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyFrequencyData.slice(-14)}>
                <XAxis dataKey="shortDate" hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff', fontSize: 10 }}
                  labelFormatter={(label) => dailyFrequencyData.find(d => d.shortDate === label)?.date}
                  formatter={(value: number) => [`${value}`, 'Workouts']}
                />
                <Bar dataKey="workouts" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-500 text-center mt-1">Last 14 days</p>
        </CardContent>
      </Card>
    </div>
  );
}
