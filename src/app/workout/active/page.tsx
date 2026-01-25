'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useMedalStore, useSocialStore, useTrainerStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { exerciseLibrary, searchExercises, calculate1RM, getMuscleDisplayName } from '@/lib/exercises';
import { cn } from '@/lib/utils';
import { Exercise, WorkoutSet } from '@/types';
import { 
  Plus, 
  X, 
  Check, 
  Clock, 
  MoreVertical,
  Trash2,
  Copy,
  Timer,
  Trophy,
  ChevronDown,
  Search,
  Pause,
  Play,
  RotateCcw,
  User,
  Users,
  Settings,
  StickyNote
} from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { 
    activeWorkout,
    workoutTimer,
    restTimer,
    addExercise,
    removeExercise,
    updateExercise,
    addSet,
    removeSet,
    updateSet,
    completeSet,
    uncompleteSet,
    endWorkout,
    cancelWorkout,
    tickWorkoutTimer,
    tickRestTimer,
    pauseWorkoutTimer,
    startWorkoutTimer,
    resetRestTimer,
    getPBForExercise,
  } = useWorkoutStore();
  const _medalStore = useMedalStore(); // Medal earning handled by store.ts endWorkout
  const { createPost } = useSocialStore();

  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showRestSettings, setShowRestSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<{
    id: string;
    name: string;
    duration: number;
    exercises: number;
    sets: number;
    totalVolume: number;
    pbs: string[];
    isPTSession: boolean;
    clientId?: string;
  } | null>(null);
  const [defaultRestTime, setDefaultRestTime] = useState(90);
  const [autoRestEnabled, setAutoRestEnabled] = useState(true);
  const [newPBs, setNewPBs] = useState<string[]>([]);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [supersetPairingId, setSupersetPairingId] = useState<string | null>(null); // Exercise ID being paired

  // Redirect if not authenticated or no active workout
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (!activeWorkout) {
      router.replace('/workout');
    }
  }, [isAuthenticated, activeWorkout, router]);

  // Workout timer
  useEffect(() => {
    if (!workoutTimer.isRunning) return;
    const interval = setInterval(tickWorkoutTimer, 1000);
    return () => clearInterval(interval);
  }, [workoutTimer.isRunning, tickWorkoutTimer]);

  // Rest timer
  useEffect(() => {
    if (!restTimer.isRunning) return;
    const interval = setInterval(tickRestTimer, 1000);
    return () => clearInterval(interval);
  }, [restTimer.isRunning, tickRestTimer]);

  const handleAddExercise = (exercise: Exercise) => {
    addExercise(exercise);
    setShowExerciseSearch(false);
    setExerciseSearch('');
    
    // If in superset pairing mode, automatically pair the new exercise
    if (supersetPairingId) {
      // Small delay to ensure exercise is added first
      setTimeout(() => {
        const newExercise = useWorkoutStore.getState().activeWorkout?.exercises.slice(-1)[0];
        if (newExercise) {
          const groupId = `superset-${Date.now()}`;
          updateExercise(supersetPairingId, { groupId, groupOrder: 'A1' });
          updateExercise(newExercise.id, { groupId, groupOrder: 'A2' });
          setSupersetPairingId(null);
          toast.success('Superset created!', {
            description: `${exercise.name} paired as superset`,
          });
        }
      }, 100);
    } else {
      toast.success(`Added ${exercise.name}`);
    }
  };

  const { startRestTimer } = useWorkoutStore();
  
  const handleCompleteSet = (exerciseId: string, setId: string, weight: number, reps: number, exerciseName: string) => {
    completeSet(exerciseId, setId);
    
    // Auto-start rest timer if enabled
    if (autoRestEnabled && defaultRestTime > 0) {
      startRestTimer(defaultRestTime, exerciseId);
    }
    
    // Check for new PB
    const exercise = activeWorkout?.exercises.find(e => e.id === exerciseId);
    if (exercise) {
      const pb = getPBForExercise(exercise.exerciseId);
      const newRM = calculate1RM(weight, reps);
      if (!pb || newRM > pb.oneRepMax) {
        setNewPBs(prev => [...prev, exerciseName]);
        toast.success(`New Personal Best! 🏆 ${exerciseName}: ${Math.round(newRM)}kg 1RM`);
      }
    }
  };

  const handleFinishWorkout = () => {
    // Capture workout info before ending
    const workoutName = activeWorkout?.name || 'Workout';
    const isPT = !!activeWorkout?.assignedBy;
    const clientId = activeWorkout?.userId;
    const trainerId = activeWorkout?.assignedBy;
    const duration = workoutTimer.seconds;
    const exerciseCount = activeWorkout?.exercises.length || 0;
    const completedSetsCount = activeWorkout?.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0
    ) || 0;
    
    const completed = endWorkout();
    if (completed) {
      // Create feed post with PB info
      const pbText = newPBs.length > 0 ? ` 🏆 ${newPBs.length} new PR${newPBs.length > 1 ? 's' : ''}!` : '';
      createPost(
        'workout_complete',
        `Completed ${completed.name}! 💪 ${completed.exercises.length} exercises, ${Math.round(completed.totalVolume)}kg total volume.${pbText}`,
        undefined,
        completed.id
      );

      // Create session record for PT sessions to track session count
      if (isPT && clientId && trainerId) {
        const { addSession, useSessionFromPackage, getPackagesForClient } = useTrainerStore.getState();
        const today = new Date().toISOString().split('T')[0];
        
        // Add completed session
        addSession({
          trainerId,
          clientId,
          date: today,
          startTime: new Date(completed.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          duration: Math.round(duration / 60),
          type: 'pt_session',
          status: 'completed',
          paid: false,
          notes: workoutName,
          workoutId: completed.id,
        });
        
        // Use session from active package if exists
        const packages = getPackagesForClient(clientId);
        const activePackage = packages.find(p => p.status === 'active' && p.remainingSessions > 0);
        if (activePackage) {
          useSessionFromPackage(activePackage.id);
        }
      }

      // Show summary popup instead of redirecting
      setCompletedWorkoutData({
        id: completed.id,
        name: workoutName,
        duration,
        exercises: exerciseCount,
        sets: completedSetsCount,
        totalVolume: completed.totalVolume,
        pbs: newPBs,
        isPTSession: isPT,
        clientId: isPT ? clientId : undefined,
      });
      setShowFinishDialog(false);
      setShowSummary(true);
    }
  };

  const handleCloseSummary = () => {
    // Save notes if provided
    if (workoutNotes.trim() && completedWorkoutData?.id) {
      useWorkoutStore.getState().updateWorkoutNotes(completedWorkoutData.id, workoutNotes.trim());
    }
    setShowSummary(false);
    setCompletedWorkoutData(null);
    setWorkoutNotes('');
    router.push('/workout');
  };

  const handleCancelWorkout = () => {
    cancelWorkout();
    toast('Workout cancelled');
    router.push('/workout');
  };

  const filteredExercises = exerciseSearch 
    ? searchExercises(exerciseSearch)
    : exerciseLibrary;

  if (!activeWorkout) return null;

  const completedSets = activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed).length, 
    0
  );
  const totalSets = activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.sets.length, 
    0
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 pt-12 pb-2">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExitDialog(true)}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5 mr-1" />
            Exit
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-white">{activeWorkout.name}</h1>
            {/* PT vs Solo Session Indicator */}
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1",
              activeWorkout.assignedBy 
                ? "bg-blue-500/30 text-blue-100" 
                : "bg-white/20 text-white/80"
            )}>
              {activeWorkout.assignedBy ? (
                <>
                  <Users className="w-3 h-3" />
                  PT Session
                </>
              ) : (
                <>
                  <User className="w-3 h-3" />
                  Solo Workout
                </>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowFinishDialog(true)}
            className="bg-white text-emerald-600 hover:bg-gray-100"
          >
            <Check className="w-4 h-4 mr-1" />
            Finish
          </Button>
        </div>

        {/* Timer Bar */}
        <div className="flex items-center justify-between bg-white/10 rounded-xl p-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">
                {formatTime(workoutTimer.seconds)}
              </p>
              <p className="text-xs text-white/70">Duration</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={workoutTimer.isRunning ? pauseWorkoutTimer : startWorkoutTimer}
              className="text-white hover:bg-white/20"
            >
              {workoutTimer.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowNotesDialog(true)}
              className={cn("text-white hover:bg-white/20", workoutNotes && "bg-white/20")}
            >
              <StickyNote className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowRestSettings(true)}
              className="text-white hover:bg-white/20"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          <div className="text-right">
            <p className="text-lg font-semibold text-white">
              {completedSets}/{totalSets}
            </p>
            <p className="text-xs text-white/70">Sets done</p>
          </div>
        </div>

        {/* Progress Bar - Below timer, not overlapping */}
        <div className="w-full bg-white/20 rounded-full h-2">
          <div 
            className="bg-white h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      </header>

      {/* Rest Timer Overlay */}
      {restTimer.isRunning && restTimer.seconds > 0 && (
        <div className="fixed inset-x-0 top-32 z-40 px-4">
          <div className="bg-blue-500 rounded-xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer className="w-6 h-6 text-white animate-pulse" />
              <div>
                <p className="text-white font-semibold">Rest Timer</p>
                <p className="text-4xl font-bold text-white font-mono">
                  {formatTime(restTimer.seconds)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={resetRestTimer}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Superset Pairing Mode Banner */}
      {supersetPairingId && (
        <div className="fixed inset-x-0 top-32 z-40 px-4">
          <div className="bg-purple-500 rounded-xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-white" />
              <div>
                <p className="text-white font-semibold">Superset Mode</p>
                <p className="text-sm text-white/80">Tap exercise or add new one below</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSupersetPairingId(null)}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Exercise List */}
      <ScrollArea className="flex-1 pb-32">
        <div className="px-4 py-4 space-y-4">
          {activeWorkout.exercises.map((workoutExercise, index) => {
            const pb = getPBForExercise(workoutExercise.exerciseId);
            
            // Check if this exercise is in a superset
            const isInSuperset = !!workoutExercise.groupId;
            const supersetPartners = isInSuperset 
              ? activeWorkout.exercises.filter(e => e.groupId === workoutExercise.groupId && e.id !== workoutExercise.id)
              : [];
            const isPairingTarget = supersetPairingId && supersetPairingId !== workoutExercise.id;
            
            // Check if we need to show a block header
            const currentBlockName = (workoutExercise as any).blockName;
            const prevExercise = index > 0 ? activeWorkout.exercises[index - 1] : null;
            const prevBlockName = prevExercise ? (prevExercise as any).blockName : null;
            const showBlockHeader = currentBlockName && currentBlockName !== prevBlockName;
            
            return (
              <React.Fragment key={workoutExercise.id}>
                {/* Block Header */}
                {showBlockHeader && (
                  <div className="space-y-1 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/50 to-transparent" />
                      <span className="text-sm font-semibold text-emerald-400 px-2">{currentBlockName}</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/50 to-transparent" />
                    </div>
                    {/* Circuit block timing info */}
                    {(workoutExercise as any).blockType === 'circuit' && (workoutExercise as any).circuitRounds && (
                      <div className="flex items-center justify-center gap-2 text-xs text-orange-400">
                        <Clock className="w-3 h-3" />
                        <span>
                          {(workoutExercise as any).circuitRounds} rounds × {(workoutExercise as any).roundDuration || '5min'}
                          {(workoutExercise as any).restBetweenRounds && ` • ${(workoutExercise as any).restBetweenRounds} rest`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <Card 
                  className={cn(
                    "bg-gray-900 border-gray-800 overflow-hidden transition-all",
                    supersetPairingId === workoutExercise.id && "ring-2 ring-blue-500",
                    isPairingTarget && "cursor-pointer hover:ring-2 hover:ring-emerald-500",
                    isInSuperset && "border-l-4 border-l-purple-500"
                  )}
                  onClick={() => {
                    if (isPairingTarget) {
                      // Complete the superset pairing
                      const groupId = `superset-${Date.now()}`;
                      updateExercise(supersetPairingId, { groupId, groupOrder: 'A1' });
                      updateExercise(workoutExercise.id, { groupId, groupOrder: 'A2' });
                      setSupersetPairingId(null);
                      toast.success('Superset created!', {
                        description: 'Exercises are now linked together',
                      });
                    }
                  }}
                >
                  <CardContent className="p-0">
                  {/* Superset indicator */}
                  {isInSuperset && (
                    <div className="bg-purple-500/20 px-4 py-1 flex items-center gap-2">
                      <Users className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">
                        Superset with {supersetPartners.map(p => p.exercise.name).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {/* Exercise Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{workoutExercise.exercise.name}</h3>
                        {pb && (
                          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">
                            <Trophy className="w-3 h-3 mr-1" />
                            {Math.round(pb.oneRepMax)}kg 1RM
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {workoutExercise.exercise?.primaryMuscles?.map(m => getMuscleDisplayName(m)).join(', ') || 'General'}
                      </p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                        <DropdownMenuItem 
                          className="text-gray-300 focus:text-white focus:bg-gray-700"
                          onClick={() => {
                            // Copy previous sets
                            workoutExercise.sets.forEach((s, idx) => {
                              if (s.previousWeight && s.previousReps) {
                                updateSet(workoutExercise.id, s.id, {
                                  weight: s.previousWeight,
                                  reps: s.previousReps,
                                });
                              }
                            });
                            toast.success('Copied previous values');
                          }}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Previous
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-gray-300 focus:text-white focus:bg-gray-700">
                          <Timer className="w-4 h-4 mr-2" />
                          Set Rest Timer ({workoutExercise.restTimerSeconds}s)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem 
                          className="text-gray-300 focus:text-white focus:bg-gray-700"
                          onClick={() => {
                            // Add a drop set to the last completed set
                            const lastSet = workoutExercise.sets[workoutExercise.sets.length - 1];
                            if (lastSet) {
                              const currentDrops = lastSet.drops || [];
                              const newDrop = {
                                id: `drop-${Date.now()}`,
                                weight: lastSet.weight ? Math.round(lastSet.weight * 0.8) : 0,
                                reps: 0,
                              };
                              updateSet(workoutExercise.id, lastSet.id, {
                                drops: [...currentDrops, newDrop],
                              });
                              toast.success('Drop set added');
                            }
                          }}
                        >
                          <ChevronDown className="w-4 h-4 mr-2" />
                          + Drop Set
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-gray-300 focus:text-white focus:bg-gray-700"
                          onClick={() => {
                            if (workoutExercise.groupId) {
                              // Remove from superset
                              updateExercise(workoutExercise.id, { groupId: undefined, groupOrder: undefined });
                              toast.success('Removed from superset');
                            } else {
                              // Start superset pairing mode
                              setSupersetPairingId(workoutExercise.id);
                              toast.info('Tap another exercise to superset with', {
                                description: 'Or tap Cancel below to exit',
                              });
                            }
                          }}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          {workoutExercise.groupId ? 'Remove from Superset' : 'Create Superset'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem 
                          className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                          onClick={() => removeExercise(workoutExercise.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove Exercise
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Sets Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800/50 text-xs text-gray-500 font-medium">
                    <div className="col-span-2">SET</div>
                    <div className="col-span-3">PREVIOUS</div>
                    <div className="col-span-3 text-center">KG</div>
                    <div className="col-span-3 text-center">
                      {(workoutExercise as any).repType === 'time' ? (
                        <span className="text-blue-400">DURATION</span>
                      ) : 'REPS'}
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                  
                  {/* Time-based exercise hint */}
                  {(workoutExercise as any).repType === 'time' && (
                    <div className="px-4 py-1 bg-blue-500/10 text-xs text-blue-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Timed exercise - enter duration in seconds
                    </div>
                  )}

                  {/* Sets */}
                  <div className="divide-y divide-gray-800/50">
                    {workoutExercise.sets.map((set) => (
                      <SetRow
                        key={set.id}
                        set={set}
                        exerciseId={workoutExercise.id}
                        exerciseName={workoutExercise.exercise.name}
                        onUpdate={(updates) => updateSet(workoutExercise.id, set.id, updates)}
                        onComplete={(weight, reps) => handleCompleteSet(workoutExercise.id, set.id, weight, reps, workoutExercise.exercise.name)}
                        onUncomplete={() => uncompleteSet(workoutExercise.id, set.id)}
                        onRemove={() => removeSet(workoutExercise.id, set.id)}
                      />
                    ))}
                  </div>

                  {/* Add Set Button */}
                  <Button
                    variant="ghost"
                    onClick={() => addSet(workoutExercise.id)}
                    className="w-full rounded-none border-t border-gray-800 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Set
                  </Button>
                </CardContent>
                </Card>
              </React.Fragment>
            );
          })}

          {/* Add Exercise Button */}
          <Dialog open={showExerciseSearch} onOpenChange={setShowExerciseSearch}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-14 border-dashed border-2 border-gray-700 bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Exercise
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="text-white">Add Exercise</DialogTitle>
                <DialogDescription>Search and add exercises to your workout</DialogDescription>
              </DialogHeader>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search exercises..."
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  autoFocus
                />
              </div>

              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-2 pr-4">
                  {filteredExercises.slice(0, 30).map((exercise) => (
                    <Button
                      key={exercise.id}
                      variant="ghost"
                      className="w-full justify-start h-auto py-3 px-4 hover:bg-gray-800"
                      onClick={() => handleAddExercise(exercise)}
                    >
                      <div className="text-left">
                        <p className="font-medium text-white">{exercise.name}</p>
                        <p className="text-xs text-gray-500">
                          {exercise.primaryMuscles.map(m => getMuscleDisplayName(m)).join(', ')} • {exercise.equipment}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </ScrollArea>

      {/* Finish Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Finish Workout?</DialogTitle>
            <DialogDescription>
              You&apos;ve completed {completedSets} of {totalSets} sets.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span className="text-white font-medium">{formatTime(workoutTimer.seconds)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Exercises</span>
              <span className="text-white font-medium">{activeWorkout.exercises.length}</span>
            </div>
            {newPBs.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">New PBs</span>
                <span className="text-amber-400 font-medium">{newPBs.length} 🏆</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowFinishDialog(false)}
              className="flex-1 border-gray-700"
            >
              Keep Going
            </Button>
            <Button
              onClick={handleFinishWorkout}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
            >
              Finish Workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Discard Workout?</DialogTitle>
            <DialogDescription>
              This will cancel your current workout and all progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowExitDialog(false)}
              className="flex-1 border-gray-700"
            >
              Continue Workout
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelWorkout}
              className="flex-1"
            >
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workout Summary Dialog */}
      <Dialog open={showSummary} onOpenChange={(open) => !open && handleCloseSummary()}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          <div className="text-center py-4">
            {/* Success Icon */}
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">Workout Complete!</h2>
            {completedWorkoutData?.isPTSession && (
              <Badge className="bg-blue-500/20 text-blue-400 mb-2">
                <Users className="w-3 h-3 mr-1" />
                PT Session
              </Badge>
            )}
            <p className="text-gray-400 mb-6">{completedWorkoutData?.name}</p>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gray-800 rounded-xl p-4">
                <Clock className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">
                  {formatTime(completedWorkoutData?.duration || 0)}
                </p>
                <p className="text-xs text-gray-500">Duration</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">
                  {Math.round(completedWorkoutData?.totalVolume || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">kg Volume</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="w-5 h-5 mx-auto mb-1 text-purple-400 font-bold text-lg">
                  {completedWorkoutData?.exercises || 0}
                </div>
                <p className="text-xs text-gray-500">Exercises</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="w-5 h-5 mx-auto mb-1 text-cyan-400 font-bold text-lg">
                  {completedWorkoutData?.sets || 0}
                </div>
                <p className="text-xs text-gray-500">Sets</p>
              </div>
            </div>
            
            {/* New PRs Section */}
            {completedWorkoutData?.pbs && completedWorkoutData.pbs.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold text-amber-400">
                    {completedWorkoutData.pbs.length} New PR{completedWorkoutData.pbs.length > 1 ? 's' : ''}!
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {completedWorkoutData.pbs.map((pb, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-amber-500/20 text-amber-300">
                      {pb}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Workout Notes */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block text-left">Add notes (optional)</label>
              <textarea
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                placeholder="How did this workout feel? Any notes for next time..."
                className="w-full h-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <Button
              onClick={handleCloseSummary}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              size="lg"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rest Timer Settings Dialog */}
      <Dialog open={showRestSettings} onOpenChange={setShowRestSettings}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Workout Settings</DialogTitle>
            <DialogDescription>
              Configure your rest timer between sets
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Auto Rest Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-white">Auto Rest Timer</p>
                <p className="text-xs text-gray-400">Start timer automatically after completing a set</p>
              </div>
              <button
                onClick={() => setAutoRestEnabled(!autoRestEnabled)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  autoRestEnabled ? "bg-emerald-500" : "bg-gray-600"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                    autoRestEnabled ? "translate-x-7" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div className={cn(!autoRestEnabled && "opacity-50 pointer-events-none")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Default Rest Time</span>
                <span className="text-lg font-semibold text-white">{defaultRestTime}s</span>
              </div>
              <Slider
                value={[defaultRestTime]}
                onValueChange={(v) => setDefaultRestTime(v[0])}
                min={15}
                max={300}
                step={15}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>15s</span>
                <span>5 min</span>
              </div>
            </div>

            <div className={cn("grid grid-cols-4 gap-2", !autoRestEnabled && "opacity-50 pointer-events-none")}>
              {[30, 60, 90, 120].map((time) => (
                <Button
                  key={time}
                  variant={defaultRestTime === time ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDefaultRestTime(time)}
                  className={defaultRestTime === time ? "bg-emerald-500" : "border-gray-700"}
                >
                  {time}s
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => setShowRestSettings(false)}
            className="w-full bg-emerald-500 hover:bg-emerald-600"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>

      {/* Workout Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-emerald-400" />
              Workout Notes
            </DialogTitle>
            <DialogDescription>
              Add notes during your workout - they'll be saved with this session
            </DialogDescription>
          </DialogHeader>
          
          <textarea
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            placeholder="How's the workout going? Track energy levels, form notes, things to remember..."
            className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          
          <Button
            onClick={() => setShowNotesDialog(false)}
            className="w-full bg-emerald-500 hover:bg-emerald-600"
          >
            Save Notes
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Set Row Component
function SetRow({
  set,
  exerciseId,
  exerciseName,
  onUpdate,
  onComplete,
  onUncomplete,
  onRemove,
}: {
  set: WorkoutSet;
  exerciseId: string;
  exerciseName: string;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: (weight: number, reps: number) => void;
  onUncomplete: () => void;
  onRemove: () => void;
}) {
  const [weight, setWeight] = useState(set.weight?.toString() || '');
  const [reps, setReps] = useState(set.reps?.toString() || '');

  const handleComplete = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps) || 0;
    // Allow 0 or negative weight for bodyweight exercises (assisted dips)
    if (!isNaN(w) && r > 0) {
      onUpdate({ weight: w, reps: r });
      onComplete(w, r);
    }
  };

  const previousDisplay = set.previousWeight && set.previousReps
    ? `${set.previousWeight}kg × ${set.previousReps}`
    : '—';

  return (
    <>
      <div className={cn(
        "grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors",
        set.completed && "bg-emerald-500/10"
      )}>
        <div className="col-span-2">
          <span className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            set.completed 
              ? "bg-emerald-500 text-white" 
              : "bg-gray-800 text-gray-400"
          )}>
            {set.completed ? <Check className="w-4 h-4" /> : set.setNumber}
          </span>
        </div>
        
        <div className="col-span-3">
          <span className="text-xs text-gray-500">{previousDisplay}</span>
        </div>
        
        <div className="col-span-3">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => onUpdate({ weight: parseFloat(weight) || undefined })}
            disabled={set.completed}
            className={cn(
              "h-9 text-center bg-gray-800 border-gray-700 text-white",
              set.completed && "opacity-50"
            )}
          />
        </div>
        
        <div className="col-span-3">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={() => onUpdate({ reps: parseInt(reps) || undefined })}
            disabled={set.completed}
            className={cn(
              "h-9 text-center bg-gray-800 border-gray-700 text-white",
              set.completed && "opacity-50"
            )}
          />
        </div>
        
        <div className="col-span-1 flex justify-end">
          {!set.completed ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleComplete}
              disabled={weight === '' || !reps}
              className="h-9 w-9 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-30"
            >
              <Check className="w-5 h-5" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                <DropdownMenuItem 
                  className="text-orange-400 focus:text-orange-300"
                  onClick={onUncomplete}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Undo / Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem 
                  className="text-red-400 focus:text-red-300"
                  onClick={onRemove}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Set
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {/* Drop Sets - shaded rows under main set */}
      {set.drops && set.drops.length > 0 && (
        <div className="border-l-2 border-orange-500/50 ml-4">
          {set.drops.map((drop, idx) => (
            <div 
              key={drop.id} 
              className="grid grid-cols-12 gap-2 px-4 py-2 items-center bg-orange-500/10"
            >
              <div className="col-span-2">
                <Badge variant="outline" className="text-xs bg-orange-500/20 border-orange-500/30 text-orange-400">
                  Drop {idx + 1}
                </Badge>
              </div>
              <div className="col-span-3">
                <span className="text-xs text-gray-500">—</span>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue={drop.weight || ''}
                  className="h-8 text-center bg-gray-800/50 border-gray-700 text-white text-sm"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  defaultValue={drop.reps || ''}
                  className="h-8 text-center bg-gray-800/50 border-gray-700 text-white text-sm"
                />
              </div>
              <div className="col-span-1"></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
