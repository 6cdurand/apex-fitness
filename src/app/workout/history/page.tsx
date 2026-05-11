'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useMedalStore, useTrainerStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Workout } from '@/types';
import { Search, Dumbbell, Clock, TrendingUp, ChevronRight, Calendar, X, Flame, Trophy, Edit, Users, StickyNote, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, isThisWeek, isThisMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

export default function WorkoutHistoryPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { workoutHistory, personalBests, updateCompletedWorkout, updateWorkoutNotes } = useWorkoutStore();
  const { saveToWorkoutLibrary } = useTrainerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [editingTimes, setEditingTimes] = useState(false);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [showSaveToLibrary, setShowSaveToLibrary] = useState(false);
  const [saveLibraryName, setSaveLibraryName] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  // Only show the logged-in user's own workouts (privacy: exclude other clients' workouts)
  // Trainers in trainer mode also see PT sessions they conducted (assignedBy)
  const activeWorkouts = workoutHistory.filter(w => {
    if (w.deletedAt) return false;
    if (!user) return false;
    if (w.userId === user.id) return true; // Own workouts
    if (user.isTrainer && user.mode === 'trainer' && w.assignedBy === user.id) return true; // PT sessions trainer ran
    return false;
  });

  const filteredWorkouts = searchQuery
    ? activeWorkouts.filter(w => 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.exercises.some(e => e.exercise.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : activeWorkouts;

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

  const formatDurationLong = (seconds?: number) => {
    if (!seconds) return '--';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const openWorkoutSummary = (workout: Workout) => {
    setSelectedWorkout(workout);
    setEditingTimes(false);
    setEditingNotes(false);
    setEditNotes(workout.privateNotes || workout.notes || '');
    setEditStartTime(new Date(workout.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    setEditEndTime(workout.endTime ? new Date(workout.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  };

  const handleSaveTimes = () => {
    if (!selectedWorkout || !editStartTime || !editEndTime) return;
    const origDate = new Date(selectedWorkout.startTime);
    const dateStr = origDate.toISOString().split('T')[0];
    const [sh, sm] = editStartTime.split(':').map(Number);
    const [eh, em] = editEndTime.split(':').map(Number);
    const newStart = new Date(`${dateStr}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`);
    const newEnd = new Date(`${dateStr}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`);
    if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1);
    const newDuration = Math.round((newEnd.getTime() - newStart.getTime()) / 1000);
    updateCompletedWorkout(selectedWorkout.id, {
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      duration: newDuration,
    });
    // Update local selected workout reference
    setSelectedWorkout({ ...selectedWorkout, startTime: newStart.toISOString(), endTime: newEnd.toISOString(), duration: newDuration });
    setEditingTimes(false);
  };

  const handleSaveNotes = () => {
    if (!selectedWorkout) return;
    updateCompletedWorkout(selectedWorkout.id, { privateNotes: editNotes.trim(), notes: editNotes.trim() });
    setSelectedWorkout({ ...selectedWorkout, notes: editNotes.trim(), privateNotes: editNotes.trim() });
    setEditingNotes(false);
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Workout History" 
        subtitle={`${activeWorkouts.length} total workouts`}
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
            className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
          />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-sky-500">
                {activeWorkouts.filter(w => isThisWeek(new Date(w.startTime))).length}
              </p>
              <p className="text-xs text-gray-500">This Week</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-500">
                {activeWorkouts.filter(w => isThisMonth(new Date(w.startTime))).length}
              </p>
              <p className="text-xs text-gray-500">This Month</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-purple-500">
                {activeWorkouts.length}
              </p>
              <p className="text-xs text-gray-400">All Time</p>
            </CardContent>
          </Card>
        </div>

        {/* Workout List */}
        <ScrollArea className="h-[calc(100vh-380px)]">
          {sortedDates.length === 0 ? (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="py-16 text-center">
                <Dumbbell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-500 mb-2">No workouts found</h3>
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
                        className="bg-white border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => openWorkoutSummary(workout)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{workout.name}</h4>
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
                              {/* Block summary chips (2026-05-11): quick
                                  memory for cardio (distance/duration),
                                  circuit (rounds + style), warmup. Falls
                                  back to exercise-name tags for workouts
                                  without persisted blocks. */}
                              {(() => {
                                const blocks = (workout.blocks || []) as any[];
                                const cardioBlocks = blocks.filter(b => b?.type === 'cardio');
                                const circuitBlocks = blocks.filter(b => b?.type === 'circuit');
                                const warmupBlocks = blocks.filter(b => b?.type === 'warmup' || b?.type === 'cooldown');
                                const hasAnyBlock = cardioBlocks.length + circuitBlocks.length + warmupBlocks.length > 0;
                                if (!hasAnyBlock) {
                                  return (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {workout.exercises.slice(0, 3).map((ex) => (
                                        <Badge
                                          key={ex.id}
                                          variant="outline"
                                          className="text-xs border-gray-200 text-gray-500"
                                        >
                                          {ex.exercise.name}
                                        </Badge>
                                      ))}
                                      {workout.exercises.length > 3 && (
                                        <Badge variant="outline" className="text-xs border-gray-200 text-gray-500">
                                          +{workout.exercises.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {cardioBlocks.map((b, i) => {
                                      const km = typeof b.distanceCompleted === 'number' && b.distanceCompleted > 0
                                        ? `${(b.distanceCompleted / 1000).toFixed(2)}km`
                                        : null;
                                      const mins = typeof b.timerSeconds === 'number' && b.timerSeconds > 0
                                        ? `${Math.round(b.timerSeconds / 60)}min`
                                        : null;
                                      return (
                                        <Badge key={`c-${i}`} className="text-xs bg-green-500/15 text-green-700 border border-green-500/30">
                                          🏃 {b.cardioActivity || 'Cardio'}{(km || mins) ? ` · ${km || mins}` : ''}
                                        </Badge>
                                      );
                                    })}
                                    {circuitBlocks.map((b, i) => (
                                      <Badge key={`x-${i}`} className="text-xs bg-orange-500/15 text-orange-700 border border-orange-500/30">
                                        ⚡ {(b.circuitStyle || 'Circuit').toString().toUpperCase()}
                                        {typeof b.roundsCompleted === 'number' && b.roundsCompleted > 0 ? ` · ${b.roundsCompleted} rds` : ''}
                                      </Badge>
                                    ))}
                                    {warmupBlocks.map((b, i) => (
                                      <Badge key={`w-${i}`} className="text-xs bg-yellow-500/15 text-yellow-700 border border-yellow-500/30">
                                        🔥 {b.name || 'Warm-up'}
                                      </Badge>
                                    ))}
                                    {/* Show first strength exercise name as
                                        the strength summary; deeper detail
                                        lives in the modal. */}
                                    {(() => {
                                      const strengthExCount = workout.exercises.filter(ex => {
                                        const bt = (ex as any).blockType;
                                        return !bt || bt === 'strength';
                                      }).length;
                                      if (strengthExCount === 0) return null;
                                      return (
                                        <Badge className="text-xs bg-blue-500/15 text-blue-700 border border-blue-500/30">
                                          💪 {strengthExCount} strength
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}
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
          <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md max-h-[85vh] overflow-y-auto">
            {selectedWorkout && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-gray-900 flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-sky-400" />
                    {selectedWorkout.name}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500">
                      {format(new Date(selectedWorkout.startTime), 'EEEE, MMMM d, yyyy')}
                    </p>
                    {selectedWorkout.assignedBy && (
                      <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        PT Session
                      </Badge>
                    )}
                  </div>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Session Time — Editable */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-medium">Session Time</span>
                      {editingTimes ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingTimes(false)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveTimes}
                            className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTimes(true)}
                          className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                    </div>
                    {editingTimes ? (
                      <div className="flex items-center gap-2 justify-center">
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm w-24 text-center"
                        />
                        <span className="text-gray-500">→</span>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm w-24 text-center"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <span className="text-gray-900 font-medium">
                          {new Date(selectedWorkout.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                        <span className="text-gray-500">→</span>
                        <span className="text-gray-900 font-medium">
                          {selectedWorkout.endTime
                            ? new Date(selectedWorkout.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                            : '--'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                      <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{formatDurationLong(selectedWorkout.duration)}</p>
                      <p className="text-xs text-gray-500">Duration</p>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                      <Trophy className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{Math.round(selectedWorkout.totalVolume).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Volume (kg)</p>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                      <Dumbbell className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{selectedWorkout.exercises.length}</p>
                      <p className="text-xs text-gray-500">Exercises</p>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                      <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{selectedWorkout.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0)}</p>
                      <p className="text-xs text-gray-500">Sets Done</p>
                    </div>
                  </div>

                  {/* PRs achieved in this workout */}
                  {(() => {
                    const workoutPRs = personalBests.filter(pb => pb.workoutId === selectedWorkout.id);
                    if (workoutPRs.length === 0) return null;
                    return (
                      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-semibold text-amber-400">
                            {workoutPRs.length} PR{workoutPRs.length > 1 ? 's' : ''} Set
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {workoutPRs.map(pr => {
                            const ex = selectedWorkout.exercises.find(e => e.exerciseId === pr.exerciseId);
                            return (
                              <Badge key={pr.id} variant="secondary" className="bg-amber-500/20 text-amber-300 text-xs">
                                {ex?.exercise?.name || pr.exerciseId} — {pr.bestWeight}kg × {pr.bestReps}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Block-level memory (2026-05-11): cardio splits,
                      circuit rounds, warmup sequence durations. Reads
                      from the WorkoutBlockSnapshot[] now persisted in
                      workouts.blocks. Skips strength blocks because the
                      exercises section below already covers them.
                      Renders nothing if the workout has no blocks (back-
                      compat for workouts logged before the migration
                      applied). */}
                  {(selectedWorkout.blocks || []).length > 0 && (() => {
                    const interestingBlocks = (selectedWorkout.blocks || []).filter(
                      (b: any) => b?.type === 'cardio' || b?.type === 'circuit' || b?.type === 'warmup' || b?.type === 'cooldown'
                    );
                    if (interestingBlocks.length === 0) return null;
                    return (
                      <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-3">Block Memory</h3>
                        <div className="space-y-3">
                          {interestingBlocks.map((block: any, idx: number) => {
                            const isCardio = block.type === 'cardio';
                            const isCircuit = block.type === 'circuit';
                            const isWarmupish = block.type === 'warmup' || block.type === 'cooldown';
                            const accent =
                              isCardio ? { border: 'border-green-500/30', bg: 'bg-green-500/5', text: 'text-green-500', icon: '🏃' } :
                              isCircuit ? { border: 'border-orange-500/30', bg: 'bg-orange-500/5', text: 'text-orange-500', icon: '⚡' } :
                              { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5', text: 'text-yellow-600', icon: '🔥' };
                            return (
                              <div key={block.id || idx} className={`p-3 ${accent.bg} ${accent.border} border rounded-xl`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{accent.icon}</span>
                                    <p className={`font-semibold ${accent.text}`}>{block.name || (isCardio ? 'Cardio' : isCircuit ? 'Circuit' : 'Warm-up')}</p>
                                    {isCircuit && block.circuitStyle && (
                                      <Badge variant="secondary" className="text-[10px] uppercase">{block.circuitStyle}</Badge>
                                    )}
                                    {isCardio && block.cardioActivity && (
                                      <Badge variant="secondary" className="text-[10px]">{block.cardioActivity}</Badge>
                                    )}
                                  </div>
                                  {typeof block.timerSeconds === 'number' && block.timerSeconds > 0 && (
                                    <p className="text-xs font-mono text-gray-600">{formatDurationLong(block.timerSeconds)}</p>
                                  )}
                                </div>

                                {/* Cardio: distance, splits, intervals */}
                                {isCardio && (
                                  <div className="space-y-1 text-xs">
                                    {typeof block.distanceCompleted === 'number' && block.distanceCompleted > 0 && (
                                      <p className="text-gray-700">
                                        Distance: <span className="font-semibold">{(block.distanceCompleted / 1000).toFixed(2)} km</span>
                                        {typeof block.targetDistance === 'number' && block.targetDistance > 0 && (
                                          <span className="text-gray-400"> / {(block.targetDistance / 1000).toFixed(1)} km target</span>
                                        )}
                                      </p>
                                    )}
                                    {Array.isArray(block.splits) && block.splits.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Splits</p>
                                        <div className="grid grid-cols-5 gap-1">
                                          {block.splits.map((split: any, splitIdx: number) => (
                                            <div key={splitIdx} className="bg-white border border-gray-200 rounded px-1 py-0.5 text-center">
                                              <p className="text-[10px] text-gray-400">{(split.distance / 1000).toFixed(1)}k</p>
                                              <p className="text-[11px] font-mono text-green-600">{formatDurationLong(split.time)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {Array.isArray(block.intervals) && block.intervals.length > 0 && (
                                      <p className="text-gray-600">
                                        Intervals: <span className="font-semibold">{block.intervals.length}</span>
                                        {' '}({block.intervals.filter((i: any) => i.intensity === 'work').length} work,
                                        {' '}{block.intervals.filter((i: any) => i.intensity === 'rest').length} rest)
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Circuit: rounds + per-round times */}
                                {isCircuit && (
                                  <div className="space-y-1 text-xs">
                                    {typeof block.roundsCompleted === 'number' && (
                                      <p className="text-gray-700">
                                        Rounds: <span className="font-semibold">{block.roundsCompleted}</span>
                                        {typeof block.rounds === 'number' && <span className="text-gray-400"> / {block.rounds} target</span>}
                                      </p>
                                    )}
                                    {Array.isArray(block.roundTimes) && block.roundTimes.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Per-round times</p>
                                        <div className="flex flex-wrap gap-1">
                                          {block.roundTimes.map((rt: number, rtIdx: number) => (
                                            <span key={rtIdx} className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] font-mono text-orange-600">
                                              R{rtIdx + 1}: {formatDurationLong(rt)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Warmup / cooldown: just the timer (already shown above) */}
                                {isWarmupish && (
                                  <p className="text-xs text-gray-600">
                                    {block.completed ? 'Completed' : 'Logged'}
                                    {typeof block.timerSeconds === 'number' && block.timerSeconds > 0 && (
                                      <span className="text-gray-400"> · {formatDurationLong(block.timerSeconds)}</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Exercises Summary */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Exercises Performed</h3>
                    <div className="space-y-2">
                      {selectedWorkout.exercises.map((ex) => {
                        const completedSets = ex.sets.filter(s => s.completed).length;
                        const bestSet = ex.sets.reduce((best, set) => {
                          if (!set.completed) return best;
                          const volume = (set.weight || 0) * (set.reps || 0);
                          const bestVolume = (best?.weight || 0) * (best?.reps || 0);
                          return volume > bestVolume ? set : best;
                        }, ex.sets[0]);
                        
                        return (
                          <div key={ex.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{ex.exercise.name}</p>
                                <p className="text-xs text-gray-500">
                                  {completedSets}/{ex.sets.length} sets completed
                                </p>
                              </div>
                              {bestSet && bestSet.weight ? (
                                <div className="text-right">
                                  <p className="text-sm font-bold text-sky-400">
                                    {bestSet.weight}kg × {bestSet.reps}
                                  </p>
                                  <p className="text-xs text-gray-500">Best set</p>
                                </div>
                              ) : bestSet && bestSet.duration ? (
                                <div className="text-right">
                                  <p className="text-sm font-bold text-sky-400">
                                    {bestSet.duration}s
                                  </p>
                                  <p className="text-xs text-gray-500">Duration</p>
                                </div>
                              ) : null}
                            </div>
                            {/* Set breakdown */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {ex.sets.map((set) => (
                                <span
                                  key={set.id}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    set.completed
                                      ? 'bg-sky-500/20 text-sky-400'
                                      : 'bg-gray-700 text-gray-500'
                                  }`}
                                >
                                  {set.weight ? `${set.weight}×${set.reps || 0}` : set.duration ? `${set.duration}s` : `${set.reps || 0}r`}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Private Notes — only visible to workout creator */}
                  {user && selectedWorkout.userId === user.id && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          🔒 Private Notes <span className="text-gray-400">(only you)</span>
                        </span>
                        {editingNotes ? (
                          <div className="flex gap-2">
                            <button onClick={() => setEditingNotes(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                            <button onClick={handleSaveNotes} className="text-xs text-sky-400 hover:text-sky-300 font-medium">Save</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditNotes(selectedWorkout.privateNotes || selectedWorkout.notes || ''); setEditingNotes(true); }}
                            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            {(selectedWorkout.privateNotes || selectedWorkout.notes) ? 'Edit' : 'Add'}
                          </button>
                        )}
                      </div>
                      {editingNotes ? (
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Add private notes..."
                          className="w-full h-20 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-600">
                          {selectedWorkout.privateNotes || selectedWorkout.notes || <span className="text-gray-600 italic">No private notes</span>}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Shared Notes — visible to both trainer and client */}
                  {selectedWorkout.assignedBy && (
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-sky-600 font-medium flex items-center gap-1">
                          💬 Shared Notes
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedWorkout.sharedNotes || <span className="text-gray-500 italic">No shared notes</span>}
                      </p>
                    </div>
                  )}

                  {/* Save to Library */}
                  {showSaveToLibrary ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      <p className="text-sm font-medium text-gray-900">Save to Workout Library</p>
                      <Input
                        placeholder="Workout name..."
                        value={saveLibraryName}
                        onChange={(e) => setSaveLibraryName(e.target.value)}
                        className="bg-white border-gray-200 text-gray-900"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-sky-500 hover:bg-sky-600"
                          disabled={!saveLibraryName.trim()}
                          onClick={() => {
                            const blocks = (selectedWorkout as any).blocks?.map((block: any) => ({
                              id: block.id,
                              type: block.type || 'strength',
                              name: block.name || 'Block',
                              exercises: selectedWorkout.exercises
                                .filter((ex: any) => ex.blockId === block.id)
                                .map((ex: any) => ({
                                  exerciseId: ex.exerciseId,
                                  exerciseName: ex.exercise?.name,
                                  sets: ex.sets.length,
                                  reps: ex.sets[0]?.reps || 10,
                                  rest: ex.restTimerSeconds || 90,
                                })),
                            })) || [{
                              id: 'default',
                              type: 'strength',
                              name: 'Main',
                              exercises: selectedWorkout.exercises.map((ex: any) => ({
                                exerciseId: ex.exerciseId,
                                exerciseName: ex.exercise?.name,
                                sets: ex.sets.length,
                                reps: ex.sets[0]?.reps || 10,
                                rest: ex.restTimerSeconds || 90,
                              })),
                            }];
                            saveToWorkoutLibrary({
                              name: saveLibraryName.trim(),
                              blocks,
                              estimatedMinutes: selectedWorkout.duration ? Math.round(selectedWorkout.duration / 60) : 45,
                              tags: [],
                            });
                            setShowSaveToLibrary(false);
                            setSaveLibraryName('');
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-600"
                          onClick={() => { setShowSaveToLibrary(false); setSaveLibraryName(''); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-gray-200 text-gray-500 hover:text-gray-900"
                      onClick={() => { setShowSaveToLibrary(true); setSaveLibraryName(selectedWorkout.name); }}
                    >
                      <Bookmark className="w-4 h-4 mr-2" />
                      Save to Library
                    </Button>
                  )}

                  {/* View Full Details Button */}
                  <Button
                    onClick={() => {
                      setSelectedWorkout(null);
                      router.push(`/workout/${selectedWorkout.id}`);
                    }}
                    className="w-full bg-sky-500 hover:bg-sky-600"
                    size="lg"
                  >
                    View Full Details
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
