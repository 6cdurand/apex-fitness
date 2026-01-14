'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Workout } from '@/types';
import { format, subDays, startOfDay } from 'date-fns';

interface VolumeChartProps {
  workouts: Workout[];
  days?: number;
  title?: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export function VolumeChart({ workouts, days = 30, title = 'Volume Over Time' }: VolumeChartProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    const startDate = subDays(now, days);
    
    // Get top 5 exercises by total volume
    const exerciseVolumes: Record<string, { name: string; total: number }> = {};
    
    workouts.forEach(workout => {
      workout.exercises?.forEach(ex => {
        const exName = ex.exercise?.name || 'Unknown';
        const exId = ex.exerciseId;
        if (!exerciseVolumes[exId]) {
          exerciseVolumes[exId] = { name: exName, total: 0 };
        }
        ex.sets?.forEach(set => {
          if (set.completed && set.weight && set.reps) {
            exerciseVolumes[exId].total += set.weight * set.reps;
          }
        });
      });
    });
    
    const topExercises = Object.entries(exerciseVolumes)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([id, data]) => ({ id, name: data.name }));
    
    // Build daily data for each top exercise
    const dailyData: Record<string, Record<string, number>> = {};
    
    for (let i = 0; i <= days; i++) {
      const date = format(subDays(now, days - i), 'MM/dd');
      dailyData[date] = {};
      topExercises.forEach(ex => {
        dailyData[date][ex.id] = 0;
      });
    }
    
    workouts.forEach(workout => {
      const workoutDate = new Date(workout.startTime);
      if (workoutDate < startDate) return;
      
      const dateKey = format(workoutDate, 'MM/dd');
      if (!dailyData[dateKey]) return;
      
      workout.exercises?.forEach(ex => {
        if (!dailyData[dateKey][ex.exerciseId]) return;
        ex.sets?.forEach(set => {
          if (set.completed && set.weight && set.reps) {
            dailyData[dateKey][ex.exerciseId] += set.weight * set.reps;
          }
        });
      });
    });
    
    return {
      topExercises,
      dailyData: Object.entries(dailyData).map(([date, volumes]) => ({
        date,
        ...volumes,
      })),
    };
  }, [workouts, days]);

  const maxVolume = useMemo(() => {
    let max = 0;
    chartData.dailyData.forEach(day => {
      chartData.topExercises.forEach(ex => {
        const val = (day as any)[ex.id] || 0;
        if (val > max) max = val;
      });
    });
    return max || 1000;
  }, [chartData]);

  if (chartData.topExercises.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-gray-500">
            Complete workouts to see volume trends
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {chartData.topExercises.map((ex, i) => (
            <div key={ex.id} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-xs text-gray-400 truncate max-w-24">{ex.name}</span>
            </div>
          ))}
        </div>
        
        {/* Chart */}
        <div className="h-48 relative">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-gray-500">
            <span>{Math.round(maxVolume / 1000)}k</span>
            <span>{Math.round(maxVolume / 2000)}k</span>
            <span>0</span>
          </div>
          
          {/* Chart area */}
          <div className="ml-12 h-full pb-6 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-gray-800" />
              <div className="border-b border-gray-800" />
              <div className="border-b border-gray-800" />
            </div>
            
            {/* Bars */}
            <div className="absolute inset-0 flex items-end gap-px overflow-hidden">
              {chartData.dailyData.slice(-14).map((day, dayIdx) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-px h-full justify-end">
                  {chartData.topExercises.map((ex, exIdx) => {
                    const val = (day as any)[ex.id] || 0;
                    const height = (val / maxVolume) * 100;
                    return (
                      <div
                        key={ex.id}
                        className="w-full rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(height, val > 0 ? 2 : 0)}%`,
                          backgroundColor: COLORS[exIdx % COLORS.length],
                          opacity: 0.8,
                        }}
                        title={`${ex.name}: ${val.toLocaleString()} kg`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            
            {/* X-axis labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 -mb-5">
              {chartData.dailyData.slice(-14).filter((_, i) => i % 3 === 0).map(day => (
                <span key={day.date}>{day.date}</span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MuscleProgressChartProps {
  workouts: Workout[];
  muscleGroup: 'chest' | 'back' | 'shoulders' | 'legs';
  title?: string;
}

const MUSCLE_EXERCISES: Record<string, string[]> = {
  chest: ['bench-press', 'incline-bench', 'dumbbell-fly', 'cable-crossover', 'push-up'],
  back: ['deadlift', 'barbell-row', 'pull-up', 'lat-pulldown', 'seated-row'],
  shoulders: ['overhead-press', 'lateral-raise', 'front-raise', 'face-pull', 'shrug'],
  legs: ['squat', 'leg-press', 'romanian-deadlift', 'leg-curl', 'leg-extension', 'calf-raise'],
};

export function MuscleProgressChart({ workouts, muscleGroup, title }: MuscleProgressChartProps) {
  const chartData = useMemo(() => {
    const targetExercises = MUSCLE_EXERCISES[muscleGroup] || [];
    const days = 30;
    const now = new Date();
    
    // Build weekly totals
    const weeklyData: { week: string; volume: number }[] = [];
    
    for (let w = 0; w < 4; w++) {
      const weekStart = subDays(now, (3 - w) * 7 + 7);
      const weekEnd = subDays(now, (3 - w) * 7);
      const weekLabel = `Week ${w + 1}`;
      
      let weekVolume = 0;
      workouts.forEach(workout => {
        const date = new Date(workout.startTime);
        if (date >= weekStart && date < weekEnd) {
          workout.exercises?.forEach(ex => {
            const exId = ex.exerciseId?.toLowerCase().replace(/\s+/g, '-') || '';
            const exName = ex.exercise?.name?.toLowerCase().replace(/\s+/g, '-') || '';
            if (targetExercises.some(t => exId.includes(t) || exName.includes(t))) {
              ex.sets?.forEach(set => {
                if (set.completed && set.weight && set.reps) {
                  weekVolume += set.weight * set.reps;
                }
              });
            }
          });
        }
      });
      
      weeklyData.push({ week: weekLabel, volume: weekVolume });
    }
    
    return weeklyData;
  }, [workouts, muscleGroup]);

  const maxVolume = Math.max(...chartData.map(d => d.volume), 1000);
  const displayTitle = title || `${muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)} Progress`;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm">{displayTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-24 flex items-end gap-2">
          {chartData.map((week, i) => {
            const height = (week.volume / maxVolume) * 100;
            const color = muscleGroup === 'chest' ? '#ef4444' 
              : muscleGroup === 'back' ? '#3b82f6'
              : muscleGroup === 'shoulders' ? '#f59e0b'
              : '#10b981';
            return (
              <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full rounded-t transition-all"
                  style={{ 
                    height: `${Math.max(height, week.volume > 0 ? 8 : 4)}%`,
                    backgroundColor: color,
                    opacity: 0.3 + (i * 0.2),
                  }}
                />
                <span className="text-xs text-gray-500">W{i + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-400">
            Total: {chartData.reduce((sum, d) => sum + d.volume, 0).toLocaleString()} kg
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
