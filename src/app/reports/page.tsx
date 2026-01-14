'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useReportStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getMuscleDisplayName } from '@/lib/exercises';
import { MuscleGroup } from '@/types';
import { 
  TrendingUp, 
  TrendingDown,
  Dumbbell,
  Clock,
  Trophy,
  Target,
  Flame,
  Calendar,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export default function ReportsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { workoutHistory, personalBests } = useWorkoutStore();
  const { weeklyReports, generateWeeklyReport, getLatestReport } = useReportStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  const latestReport = getLatestReport();

  const handleGenerateReport = () => {
    generateWeeklyReport();
  };

  if (!isAuthenticated) return null;

  // Calculate this week's stats
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  
  const thisWeekWorkouts = workoutHistory.filter(w => {
    const date = new Date(w.startTime);
    return date >= weekStart && date <= weekEnd;
  });

  const thisWeekVolume = thisWeekWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const thisWeekDuration = thisWeekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);

  // Get top muscles by volume
  const muscleVolumes: Record<MuscleGroup, number> = {
    chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0,
    forearms: 0, abs: 0, obliques: 0, quads: 0, hamstrings: 0,
    glutes: 0, calves: 0, traps: 0, lats: 0, lower_back: 0,
  };

  thisWeekWorkouts.forEach(workout => {
    workout.exercises.forEach(ex => {
      let exerciseVolume = 0;
      ex.sets.forEach(s => {
        if (s.completed && s.weight && s.reps) {
          exerciseVolume += s.weight * s.reps;
        }
      });
      ex.exercise.primaryMuscles.forEach(muscle => {
        muscleVolumes[muscle] += exerciseVolume;
      });
    });
  });

  const topMuscles = Object.entries(muscleVolumes)
    .filter(([_, volume]) => volume > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxVolume = topMuscles.length > 0 ? topMuscles[0][1] : 1;

  return (
    <MainLayout>
      <PageHeader 
        title="Weekly Report" 
        subtitle={`${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`}
        action={
          <Button 
            size="sm" 
            onClick={handleGenerateReport}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate
          </Button>
        }
      />

      <ScrollArea className="flex-1">
        <div className="px-4 py-6 space-y-6">
          {/* Week Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Dumbbell className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">{thisWeekWorkouts.length}</p>
                    <p className="text-sm text-gray-400">Workouts</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">
                      {Math.round(thisWeekVolume / 1000)}k
                    </p>
                    <p className="text-sm text-gray-400">Volume (kg)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">
                      {Math.round(thisWeekDuration / 60)}
                    </p>
                    <p className="text-sm text-gray-400">Minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">
                      {personalBests.filter(pb => {
                        const date = new Date(pb.achievedAt);
                        return date >= weekStart && date <= weekEnd;
                      }).length}
                    </p>
                    <p className="text-sm text-gray-400">New PBs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Volume by Muscle Group */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                Volume by Muscle Group
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topMuscles.length === 0 ? (
                <div className="text-center py-8">
                  <Dumbbell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No workout data this week</p>
                  <p className="text-sm text-gray-500">Complete workouts to see your volume breakdown</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topMuscles.map(([muscle, volume]) => (
                    <div key={muscle} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">{getMuscleDisplayName(muscle as MuscleGroup)}</span>
                        <span className="text-white font-medium">{Math.round(volume).toLocaleString()} kg</span>
                      </div>
                      <Progress 
                        value={(volume / maxVolume) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consistency Score */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                Consistency Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-gray-800"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={`${Math.min(thisWeekWorkouts.length * 15, 100) * 2.51} 251`}
                      className="text-emerald-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {Math.min(thisWeekWorkouts.length * 15, 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 mb-2">
                    You completed <span className="text-emerald-400 font-semibold">{thisWeekWorkouts.length}</span> workouts this week.
                  </p>
                  <p className="text-sm text-gray-500">
                    {thisWeekWorkouts.length >= 5 
                      ? "Excellent consistency! Keep it up!" 
                      : thisWeekWorkouts.length >= 3 
                        ? "Good progress! Try to add one more session." 
                        : "Build momentum by scheduling more workouts."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent PBs */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Recent Personal Bests
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {personalBests.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No personal bests yet</p>
                  <p className="text-sm text-gray-500">Keep pushing to set new records</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {personalBests.slice(0, 5).map((pb) => (
                    <div
                      key={pb.id}
                      className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <Trophy className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white capitalize">
                            {pb.exerciseId.replace(/-/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(pb.achievedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-400">{Math.round(pb.oneRepMax)}kg</p>
                        <p className="text-xs text-gray-500">1RM</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Reports */}
          {weeklyReports.length > 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Past Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {weeklyReports.slice(0, 4).map((report) => (
                  <Button
                    key={report.id}
                    variant="ghost"
                    className="w-full justify-start h-14 px-4 text-gray-300 hover:bg-gray-800 rounded-none border-b border-gray-800"
                  >
                    <div className="flex-1 text-left">
                      <p className="font-medium">
                        {format(new Date(report.weekStartDate), 'MMM d')} - {format(new Date(report.weekEndDate), 'MMM d')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {report.totalWorkouts} workouts • {Math.round(report.totalVolume / 1000)}k kg volume
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </MainLayout>
  );
}
