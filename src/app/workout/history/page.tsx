'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Workout } from '@/types';
import { Search, Dumbbell, Clock, TrendingUp, ChevronRight, Calendar, X, Flame, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, isThisWeek, isThisMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

export default function WorkoutHistoryPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { workoutHistory } = useWorkoutStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const filteredWorkouts = searchQuery
    ? workoutHistory.filter(w => 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.exercises.some(e => e.exercise.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : workoutHistory;

  // Group workouts by date
  const groupedWorkouts = filteredWorkouts.reduce((groups, workout) => {
    const date = format(new Date(workout.startTime), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(workout);
    return groups;
  }, {} as Record<string, Workout[]>);

  const sortedDates = Object.keys(groupedWorkouts).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Workout History" 
        subtitle={`${workoutHistory.length} total workouts`}
        showBack
      />

      <div className="px-4 py-4">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search workouts or exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {workoutHistory.filter(w => isThisWeek(new Date(w.startTime))).length}
              </p>
              <p className="text-xs text-gray-400">This Week</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">
                {workoutHistory.filter(w => isThisMonth(new Date(w.startTime))).length}
              </p>
              <p className="text-xs text-gray-400">This Month</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-purple-400">
                {workoutHistory.length}
              </p>
              <p className="text-xs text-gray-400">All Time</p>
            </CardContent>
          </Card>
        </div>

        {/* Workout List */}
        <ScrollArea className="h-[calc(100vh-380px)]">
          {sortedDates.length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-16 text-center">
                <Dumbbell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-400 mb-2">No workouts found</h3>
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'Try a different search term' : 'Start your first workout to see it here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <div className="space-y-3">
                    {groupedWorkouts[date].map((workout) => (
                      <Card
                        key={workout.id}
                        className="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-850 transition-colors"
                        onClick={() => setSelectedWorkout(workout)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-white truncate">{workout.name}</h4>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(workout.duration)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Dumbbell className="w-3 h-3" />
                                  {workout.exercises.length} exercises
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  {Math.round(workout.totalVolume).toLocaleString()} kg
                                </span>
                              </div>
                              {/* Exercise tags */}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {workout.exercises.slice(0, 3).map((ex) => (
                                  <Badge 
                                    key={ex.id} 
                                    variant="outline" 
                                    className="text-xs border-gray-700 text-gray-400"
                                  >
                                    {ex.exercise.name}
                                  </Badge>
                                ))}
                                {workout.exercises.length > 3 && (
                                  <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                                    +{workout.exercises.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Workout Summary Modal */}
        <Dialog open={!!selectedWorkout} onOpenChange={() => setSelectedWorkout(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 max-w-md max-h-[80vh] overflow-y-auto">
            {selectedWorkout && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-emerald-400" />
                    {selectedWorkout.name}
                  </DialogTitle>
                  <p className="text-sm text-gray-500">
                    {format(new Date(selectedWorkout.startTime), 'EEEE, MMMM d, yyyy • h:mm a')}
                  </p>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{formatDuration(selectedWorkout.duration)}</p>
                      <p className="text-xs text-gray-500">Duration</p>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{Math.round(selectedWorkout.totalVolume).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Volume (kg)</p>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{selectedWorkout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)}</p>
                      <p className="text-xs text-gray-500">Total Sets</p>
                    </div>
                  </div>

                  {/* Exercises Summary */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Exercises Performed</h3>
                    <div className="space-y-2">
                      {selectedWorkout.exercises.map((ex, idx) => {
                        const completedSets = ex.sets.filter(s => s.completed).length;
                        const bestSet = ex.sets.reduce((best, set) => {
                          if (!set.completed) return best;
                          const volume = (set.weight || 0) * (set.reps || 0);
                          const bestVolume = (best?.weight || 0) * (best?.reps || 0);
                          return volume > bestVolume ? set : best;
                        }, ex.sets[0]);
                        
                        return (
                          <div key={ex.id} className="p-3 bg-gray-800 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-white">{ex.exercise.name}</p>
                                <p className="text-xs text-gray-500">
                                  {completedSets}/{ex.sets.length} sets completed
                                </p>
                              </div>
                              {bestSet && bestSet.weight && (
                                <div className="text-right">
                                  <p className="text-sm font-bold text-emerald-400">
                                    {bestSet.weight}kg × {bestSet.reps}
                                  </p>
                                  <p className="text-xs text-gray-500">Best set</p>
                                </div>
                              )}
                            </div>
                            {/* Set breakdown */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {ex.sets.map((set, setIdx) => (
                                <span
                                  key={set.id}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    set.completed
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-gray-700 text-gray-500'
                                  }`}
                                >
                                  {set.weight || 0}×{set.reps || 0}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* View Full Details Button */}
                  <button
                    onClick={() => {
                      setSelectedWorkout(null);
                      router.push(`/workout/${selectedWorkout.id}`);
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    View Full Details
                  </button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
