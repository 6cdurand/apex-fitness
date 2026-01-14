'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Legend,
} from 'recharts';
import { TrendingUp, Dumbbell, Calendar, Trophy, ChevronDown } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks } from 'date-fns';
import { Workout, PersonalBest } from '@/types';

interface WorkoutStatsChartsProps {
  workoutHistory: Workout[];
  personalBests: PersonalBest[];
  compact?: boolean;
}

type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'shoulders';

const muscleGroupExercises: Record<MuscleGroup, string[]> = {
  all: [],
  chest: ['bench-press', 'incline-bench', 'dumbbell-press', 'incline-dumbbell', 'cable-fly', 'chest-press', 'push-up', 'chest-fly', 'pec-deck', 'dips'],
  back: ['lat-pulldown', 'pulldown', 'barbell-row', 'cable-row', 'deadlift', 'pull-up', 't-bar-row', 'seated-row', 'face-pull', 'row'],
  legs: ['squat', 'leg-press', 'romanian-deadlift', 'rdl', 'lunges', 'lunge', 'leg-curl', 'leg-extension', 'hip-thrust', 'calf-raise', 'split-squat', 'goblet'],
  shoulders: ['overhead-press', 'shoulder-press', 'db-shoulder', 'lateral-raise', 'lateral-raises', 'front-raise', 'rear-delt', 'arnold-press', 'upright-row', 'ohp', 'military-press'],
};

const muscleGroupColors: Record<MuscleGroup, string> = {
  all: '#10b981',
  chest: '#ef4444',
  back: '#3b82f6',
  legs: '#8b5cf6',
  shoulders: '#f59e0b',
};

export function WorkoutStatsCharts({ workoutHistory, personalBests, compact = false }: WorkoutStatsChartsProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup>('all');

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
        w.exercises?.forEach(ex => {
          const exId = ex.exerciseId?.toLowerCase() || '';
          const exVol = ex.sets?.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0) || 0;
          totalVol += exVol;

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

  // Multi-exercise comparison data grouped by muscle
  const exerciseComparisonData = useMemo(() => {
    const result: Record<MuscleGroup, { exerciseId: string; name: string; current1RM: number; color: string }[]> = {
      all: [],
      chest: [],
      back: [],
      legs: [],
      shoulders: [],
    };

    personalBests.forEach(pb => {
      const exId = pb.exerciseId.toLowerCase();
      const name = pb.exerciseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const entry = { exerciseId: pb.exerciseId, name, current1RM: Math.round(pb.oneRepMax), color: '' };

      if (muscleGroupExercises.chest.some(e => exId.includes(e))) {
        entry.color = muscleGroupColors.chest;
        result.chest.push(entry);
      } else if (muscleGroupExercises.back.some(e => exId.includes(e))) {
        entry.color = muscleGroupColors.back;
        result.back.push(entry);
      } else if (muscleGroupExercises.legs.some(e => exId.includes(e))) {
        entry.color = muscleGroupColors.legs;
        result.legs.push(entry);
      } else if (muscleGroupExercises.shoulders.some(e => exId.includes(e))) {
        entry.color = muscleGroupColors.shoulders;
        result.shoulders.push(entry);
      }
    });

    // Sort by 1RM descending
    Object.keys(result).forEach(key => {
      result[key as MuscleGroup].sort((a, b) => b.current1RM - a.current1RM);
    });

    return result;
  }, [personalBests]);

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
            <TrendingUp className="w-4 h-4 text-emerald-400" />
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
              <p className="text-lg font-bold text-emerald-400">{stats.thisWeekWorkouts}</p>
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
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <Dumbbell className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.totalWorkouts}</p>
            <p className="text-xs text-gray-400">Total Workouts</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.totalVolume}k</p>
            <p className="text-xs text-gray-400">Total Volume (kg)</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.thisWeekWorkouts}</p>
            <p className="text-xs text-gray-400">This Week</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{personalBests.length}</p>
            <p className="text-xs text-gray-400">Personal Bests</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="volume" className="w-full">
        <TabsList className="grid grid-cols-3 bg-gray-900">
          <TabsTrigger value="volume">Volume</TabsTrigger>
          <TabsTrigger value="frequency">Frequency</TabsTrigger>
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
        </TabsList>

        {/* Weekly Volume Chart */}
        <TabsContent value="volume">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">Weekly Training Volume</CardTitle>
                <div className="flex gap-1">
                  {(['all', 'chest', 'back', 'legs', 'shoulders'] as MuscleGroup[]).map(group => (
                    <Button
                      key={group}
                      size="sm"
                      variant={selectedMuscleGroup === group ? 'default' : 'ghost'}
                      className={`text-xs px-2 py-1 h-7 ${
                        selectedMuscleGroup === group 
                          ? 'bg-emerald-500' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                      onClick={() => setSelectedMuscleGroup(group)}
                    >
                      {group.charAt(0).toUpperCase() + group.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {selectedMuscleGroup === 'all' ? (
                    <BarChart data={weeklyVolumeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      <Bar dataKey="chest" stackId="a" fill={muscleGroupColors.chest} name="Chest" />
                      <Bar dataKey="back" stackId="a" fill={muscleGroupColors.back} name="Back" />
                      <Bar dataKey="legs" stackId="a" fill={muscleGroupColors.legs} name="Legs" />
                      <Bar dataKey="shoulders" stackId="a" fill={muscleGroupColors.shoulders} name="Shoulders" />
                    </BarChart>
                  ) : (
                    <AreaChart data={weeklyVolumeData}>
                      <defs>
                        <linearGradient id={`gradient-${selectedMuscleGroup}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={muscleGroupColors[selectedMuscleGroup]} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={muscleGroupColors[selectedMuscleGroup]} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`${value}k kg`, selectedMuscleGroup.charAt(0).toUpperCase() + selectedMuscleGroup.slice(1)]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey={selectedMuscleGroup} 
                        stroke={muscleGroupColors[selectedMuscleGroup]} 
                        fill={`url(#gradient-${selectedMuscleGroup})`}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workout Frequency Chart */}
        <TabsContent value="frequency">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Daily Activity (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyFrequencyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="shortDate" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={{ stroke: '#374151' }} interval={4} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#374151' }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      labelFormatter={(label) => dailyFrequencyData.find(d => d.shortDate === label)?.date}
                      formatter={(value: number) => [`${value} workout${value !== 1 ? 's' : ''}`, 'Sessions']}
                    />
                    <Bar dataKey="workouts" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exercise Comparison by Muscle Group */}
        <TabsContent value="exercises">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Exercise Comparison (1RM)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(['chest', 'back', 'legs', 'shoulders'] as MuscleGroup[]).map(group => {
                  const exercises = exerciseComparisonData[group];
                  if (exercises.length === 0) return null;
                  
                  return (
                    <div key={group} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: muscleGroupColors[group] }} />
                        <span className="text-sm font-medium text-white capitalize">{group}</span>
                      </div>
                      <div className="space-y-1">
                        {exercises.slice(0, 4).map(ex => (
                          <div key={ex.exerciseId} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-32 truncate">{ex.name}</span>
                            <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all"
                                style={{ 
                                  width: `${Math.min((ex.current1RM / 200) * 100, 100)}%`,
                                  backgroundColor: muscleGroupColors[group],
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-white w-12 text-right">{ex.current1RM}kg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.values(exerciseComparisonData).every(arr => arr.length === 0) && (
                  <div className="text-center py-8">
                    <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No personal bests recorded yet</p>
                    <p className="text-sm text-gray-500">Complete workouts to track your 1RM progress</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
