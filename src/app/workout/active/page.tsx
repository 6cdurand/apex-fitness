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
import { syncExerciseHistoryToSupabase } from '@/lib/supabaseSync';
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
  StickyNote,
  History,
  Link2
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
    workoutHistory,
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
    currentClientId,
  } = useWorkoutStore();
  const _medalStore = useMedalStore(); // Medal earning handled by store.ts endWorkout
  const { createPost } = useSocialStore();
  const { clients, saveToWorkoutLibrary, saveCircuitTemplate } = useTrainerStore();
  
  // Get client name if this is a PT session
  // Try multiple lookup methods since clientId might be stored differently
  const currentClient = currentClientId 
    ? clients.find(c => c.clientId === currentClientId || c.id === currentClientId)
    : activeWorkout?.assignedBy 
      ? clients.find(c => c.clientId === activeWorkout.userId)
      : null;
  
  // Get display name from client object, or fall back to looking up in stored users
  const [clientName, setClientName] = useState<string | null>(null);
  
  useEffect(() => {
    if (currentClient?.client?.displayName || currentClient?.client?.username) {
      setClientName(currentClient.client.displayName || currentClient.client.username || null);
    } else if (currentClientId || (activeWorkout?.assignedBy && activeWorkout?.userId)) {
      // Try to get from localStorage as fallback
      const targetId = currentClientId || activeWorkout?.userId;
      if (targetId) {
        try {
          const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
          const user = storedUsers.find((u: any) => u.id === targetId);
          if (user) {
            setClientName(user.displayName || user.username || null);
          }
        } catch (e) {
          console.error('Error looking up client name:', e);
        }
      }
    }
  }, [currentClient, currentClientId, activeWorkout]);

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
  const [sessionPaid, setSessionPaid] = useState(false);
  const [supersetPairingId, setSupersetPairingId] = useState<string | null>(null);
  
  // Save workout state
  const [showSaveWorkoutDialog, setShowSaveWorkoutDialog] = useState(false);
  const [saveWorkoutName, setSaveWorkoutName] = useState('');
  const [saveWorkoutDescription, setSaveWorkoutDescription] = useState('');
  
  // Save circuit state
  const [showSaveCircuitDialog, setShowSaveCircuitDialog] = useState(false);
  const [saveCircuitName, setSaveCircuitName] = useState('');
  const [saveCircuitDescription, setSaveCircuitDescription] = useState('');
  const [circuitToSave, setCircuitToSave] = useState<any>(null);
  
  // Per-set rest timers (setId -> { remaining seconds, total seconds })
  const [setRestTimers, setSetRestTimers] = useState<Record<string, { remaining: number; total: number }>>({});
  
  // Block system state
  const [workoutBlocks, setWorkoutBlocks] = useState<{
    id: string;
    type: 'warmup' | 'strength' | 'circuit';
    name: string;
    circuitStyle?: 'amrap' | 'forTime' | 'rounds' | 'emom';
    circuitDuration?: number; // in seconds
    circuitRounds?: number;
    timerRunning?: boolean;
    timerSeconds?: number;
    completed?: boolean;
    circuitComplete?: boolean;
    // Round tracking for circuits
    roundsCompleted?: { roundNumber: number; completedAt: number; duration: number }[];
    currentRoundStart?: number;
  }[]>([]);
  
  // Circuit exercise reps (exerciseId -> reps)
  const [circuitExerciseReps, setCircuitExerciseReps] = useState<Record<string, number>>({});
  const [showCircuitDialog, setShowCircuitDialog] = useState(false);
  const [circuitConfig, setCircuitConfig] = useState({
    style: 'amrap' as 'amrap' | 'forTime' | 'rounds' | 'emom',
    duration: 600, // 10 min default
    rounds: 3,
  });
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [circuitExerciseSelection, setCircuitExerciseSelection] = useState<Exercise[]>([]);
  const [showExerciseNotesDialog, setShowExerciseNotesDialog] = useState(false);
  const [selectedExerciseForNotes, setSelectedExerciseForNotes] = useState<any>(null);
  const [exerciseNotesText, setExerciseNotesText] = useState('');
  
  // Superset state
  const [showSupersetPicker, setShowSupersetPicker] = useState(false);
  const [supersetSourceExercise, setSupersetSourceExercise] = useState<any>(null);
  
  // Check if blocks exist
  const hasWarmup = workoutBlocks.some(b => b.type === 'warmup');
  const hasStrength = workoutBlocks.some(b => b.type === 'strength');

  // Redirect if not authenticated or no active workout
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (!activeWorkout) {
      router.replace('/workout');
    }
  }, [isAuthenticated, activeWorkout, router]);

  // Initialize blocks from activeWorkout.blocks (for session workouts)
  useEffect(() => {
    if (activeWorkout?.blocks && activeWorkout.blocks.length > 0 && workoutBlocks.length === 0) {
      const initialBlocks = activeWorkout.blocks.map((block: any) => ({
        id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: block.type || 'strength',
        name: block.name || 'Block',
        circuitStyle: block.circuitStyle,
        circuitDuration: block.circuitDuration,
        circuitRounds: block.rounds || block.circuitRounds,
        timerRunning: false,
        timerSeconds: 0,
        completed: false,
        circuitComplete: false,
        roundsCompleted: [],
      }));
      setWorkoutBlocks(initialBlocks);
    }
  }, [activeWorkout?.blocks]);

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

  // Per-set rest timers tick
  useEffect(() => {
    const hasActiveTimers = Object.values(setRestTimers).some(t => t.remaining > 0);
    if (!hasActiveTimers) return;
    
    const interval = setInterval(() => {
      setSetRestTimers(prev => {
        const updated: Record<string, { remaining: number; total: number }> = {};
        for (const [setId, timer] of Object.entries(prev)) {
          if (timer.remaining > 0) {
            updated[setId] = { ...timer, remaining: timer.remaining - 1 };
          }
          // Remove timers that hit zero (cleanup)
        }
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [setRestTimers]);

  // Warmup exercises - use category filter
  const warmupExercises = exerciseLibrary.filter(e => e.category === 'warmup');
  
  // Strength exercises - compound and isolation movements
  const strengthExercises = exerciseLibrary.filter(e => 
    e.category === 'compound' || e.category === 'isolation'
  );

  // Get exercises based on active block type
  const getFilteredExercises = () => {
    const block = workoutBlocks.find(b => b.id === activeBlockId);
    
    // When searching, search entire library first
    if (exerciseSearch) {
      return exerciseLibrary.filter(e => 
        e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        e.primaryMuscles.some(m => m.toLowerCase().includes(exerciseSearch.toLowerCase())) ||
        e.equipment.toLowerCase().includes(exerciseSearch.toLowerCase())
      );
    }
    
    // When not searching, filter by block type
    if (!block) return exerciseLibrary;
    
    return block.type === 'warmup' ? warmupExercises : 
           block.type === 'strength' ? strengthExercises : 
           exerciseLibrary;
  };

  const handleAddExercise = (exercise: Exercise) => {
    const block = workoutBlocks.find(b => b.id === activeBlockId);
    
    // For circuits, use multi-select mode
    if (block?.type === 'circuit') {
      const isSelected = circuitExerciseSelection.some(e => e.id === exercise.id);
      if (isSelected) {
        setCircuitExerciseSelection(circuitExerciseSelection.filter(e => e.id !== exercise.id));
      } else {
        setCircuitExerciseSelection([...circuitExerciseSelection, exercise]);
      }
      return;
    }
    
    const blockMetadata = block ? {
      blockName: block.name,
      blockType: block.type,
      blockId: block.id,
    } : {};
    
    addExercise({ ...exercise, ...blockMetadata } as any);
    setShowExerciseModal(false);
    setExerciseSearch('');
    toast.success(`Added ${exercise.name}${block ? ` to ${block.name}` : ''}`);
  };
  
  const handleSaveCircuitExercises = () => {
    const block = workoutBlocks.find(b => b.id === activeBlockId);
    if (!block) return;
    
    circuitExerciseSelection.forEach(exercise => {
      addExercise({
        ...exercise,
        blockName: block.name,
        blockType: block.type,
        blockId: block.id,
      } as any);
    });
    
    setCircuitExerciseSelection([]);
    setShowExerciseModal(false);
    setExerciseSearch('');
    toast.success(`Added ${circuitExerciseSelection.length} exercises to ${block.name}`);
  };
  
  const addBlock = (type: 'warmup' | 'strength' | 'circuit') => {
    if (type === 'warmup' && hasWarmup) return;
    if (type === 'strength' && hasStrength) return;
    
    const circuitCount = workoutBlocks.filter(b => b.type === 'circuit').length;
    const newBlock = {
      id: `block-${Date.now()}`,
      type,
      name: type === 'warmup' ? 'Warm-Up' : 
            type === 'strength' ? 'Strength' : 
            `Circuit ${circuitCount + 1}`,
      ...(type === 'circuit' && {
        circuitStyle: circuitConfig.style,
        circuitDuration: circuitConfig.duration,
        circuitRounds: circuitConfig.rounds,
        timerSeconds: circuitConfig.style === 'forTime' ? 0 : circuitConfig.duration,
        timerRunning: false,
      }),
    };
    
    setWorkoutBlocks([...workoutBlocks, newBlock]);
    setActiveBlockId(newBlock.id);
    
    if (type === 'circuit') {
      setShowCircuitDialog(false);
    }
    
    setShowExerciseModal(true);
    toast.success(`${newBlock.name} block added`);
  };
  
  // Circuit timer effect
  useEffect(() => {
    const runningCircuit = workoutBlocks.find(b => b.timerRunning);
    if (!runningCircuit) return;
    
    const interval = setInterval(() => {
      setWorkoutBlocks(blocks => blocks.map(b => {
        if (b.id !== runningCircuit.id || !b.timerRunning) return b;
        
        const isCountdown = b.circuitStyle === 'amrap' || b.circuitStyle === 'emom';
        const newSeconds = isCountdown ? (b.timerSeconds || 0) - 1 : (b.timerSeconds || 0) + 1;
        
        // Stop if countdown reaches 0
        if (isCountdown && newSeconds <= 0) {
          toast.success(`${b.name} complete!`);
          return { ...b, timerSeconds: 0, timerRunning: false, completed: true };
        }
        
        return { ...b, timerSeconds: newSeconds };
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [workoutBlocks]);
  
  const toggleCircuitTimer = (blockId: string) => {
    setWorkoutBlocks(blocks => blocks.map(b => 
      b.id === blockId ? { ...b, timerRunning: !b.timerRunning } : b
    ));
  };
  
  const resetCircuitTimer = (blockId: string) => {
    setWorkoutBlocks(blocks => blocks.map(b => {
      if (b.id !== blockId) return b;
      const isCountdown = b.circuitStyle === 'amrap' || b.circuitStyle === 'emom';
      return { 
        ...b, 
        timerSeconds: isCountdown ? b.circuitDuration : 0, 
        timerRunning: false,
        completed: false,
        roundsCompleted: [],
        currentRoundStart: undefined,
      };
    }));
  };
  
  const completeCircuitRound = (blockId: string) => {
    setWorkoutBlocks(blocks => blocks.map(b => {
      if (b.id !== blockId) return b;
      const currentRounds = b.roundsCompleted || [];
      const roundNumber = currentRounds.length + 1;
      const now = Date.now();
      const duration = b.currentRoundStart ? Math.floor((now - b.currentRoundStart) / 1000) : (b.timerSeconds || 0);
      const totalRounds = b.circuitRounds || 5;
      const isLastRound = roundNumber >= totalRounds;
      
      return {
        ...b,
        roundsCompleted: [...currentRounds, { roundNumber, completedAt: now, duration }],
        currentRoundStart: isLastRound ? undefined : now, // Stop timer on final round
        timerRunning: isLastRound ? false : true,
        circuitComplete: isLastRound,
      };
    }));
    toast.success('Round completed!');
  };
  
  const startCircuitRound = (blockId: string) => {
    setWorkoutBlocks(blocks => blocks.map(b => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        currentRoundStart: Date.now(),
        timerRunning: true,
        timerSeconds: b.circuitStyle === 'forTime' ? 0 : b.timerSeconds,
      };
    }));
  };
  
  const addCircuitRound = (blockId: string) => {
    setWorkoutBlocks(blocks => blocks.map(b => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        circuitRounds: (b.circuitRounds || 5) + 1,
        circuitComplete: false, // Reset complete status
      };
    }));
    toast.success('Added extra round!');
  };
  
  const finishCircuit = (blockId: string) => {
    setWorkoutBlocks(blocks => blocks.map(b => {
      if (b.id !== blockId) return b;
      const now = Date.now();
      const currentRounds = b.roundsCompleted || [];
      
      // Complete current round if timer is running
      if (b.currentRoundStart) {
        const duration = Math.floor((now - b.currentRoundStart) / 1000);
        return {
          ...b,
          roundsCompleted: [...currentRounds, { roundNumber: currentRounds.length + 1, completedAt: now, duration }],
          currentRoundStart: undefined,
          timerRunning: false,
          circuitComplete: true,
        };
      }
      
      return {
        ...b,
        timerRunning: false,
        circuitComplete: true,
      };
    }));
    toast.success('Circuit finished!');
  };
  
  const deleteBlock = (blockId: string) => {
    // Remove all exercises associated with this block
    const blockExercises = activeWorkout?.exercises.filter((e: any) => e.blockId === blockId) || [];
    blockExercises.forEach((ex: any) => {
      removeExercise(ex.id);
    });
    // Remove the block itself
    setWorkoutBlocks(blocks => blocks.filter(b => b.id !== blockId));
    toast.success('Block deleted');
  };

  const { startRestTimer } = useWorkoutStore();
  
  const handleCompleteSet = (exerciseId: string, setId: string, weight: number, reps: number, exerciseName: string) => {
    completeSet(exerciseId, setId);
    
    // Clear all previous rest timers when starting a new set (auto-finish)
    setSetRestTimers({});
    
    // Auto-start rest timer if enabled
    if (autoRestEnabled && defaultRestTime > 0) {
      startRestTimer(defaultRestTime, exerciseId);
      // Start per-set rest timer for this set only
      setSetRestTimers({
        [setId]: { remaining: defaultRestTime, total: defaultRestTime }
      });
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

  // Handle adding drop set to an exercise
  const handleAddDropSet = (exerciseId: string) => {
    const exercise = activeWorkout?.exercises.find(e => e.id === exerciseId);
    if (!exercise) return;
    
    // Add drop set data to each set in this exercise
    exercise.sets.forEach(set => {
      const currentDrops = set.drops || [];
      updateSet(exerciseId, set.id, {
        drops: [...currentDrops, { id: `drop-${Date.now()}`, weight: 0, reps: 0 }]
      });
    });
    toast.success('Drop set added to all sets');
  };

  // Handle creating superset between exercises
  const handleCreateSuperset = (targetExerciseId: string) => {
    if (!supersetSourceExercise || !activeWorkout) return;
    
    const groupId = `superset-${Date.now()}`;
    
    // Update source exercise with groupId
    updateExercise(supersetSourceExercise.id, { 
      groupId, 
      groupType: 'superset',
      groupOrder: 'A1'
    });
    
    // Update target exercise with same groupId
    updateExercise(targetExerciseId, { 
      groupId, 
      groupType: 'superset',
      groupOrder: 'A2'
    });
    
    setShowSupersetPicker(false);
    setSupersetSourceExercise(null);
    toast.success('Superset created!');
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
    
    const completed = endWorkout(workoutNotes);
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

      // Sync exercise history to Supabase for client tracking
      const currentUser = useAuthStore.getState().user;
      const targetUserId = clientId || currentUser?.id;
      if (targetUserId && completed.exercises) {
        completed.exercises.forEach((ex: any) => {
          const bestSet = ex.sets.reduce((best: any, set: any) => {
            if (!set.completed) return best;
            const volume = (set.weight || 0) * (set.reps || 0);
            const bestVolume = (best?.weight || 0) * (best?.reps || 0);
            return volume > bestVolume ? set : best;
          }, null);
          
          syncExerciseHistoryToSupabase(
            targetUserId,
            ex.exerciseId,
            ex.exercise?.name || 'Unknown',
            ex.blockType || null,
            bestSet?.weight,
            bestSet?.reps
          );
        });
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
    
    // Update session paid status and add payment record for PT session
    if (completedWorkoutData?.isPTSession && completedWorkoutData?.clientId && sessionPaid) {
      const { getPackagesForClient, updateSessionPackage, addPayment, sessions, toggleSessionPaid } = useTrainerStore.getState();
      const packages = getPackagesForClient(completedWorkoutData.clientId);
      const activePackage = packages.find(p => p.status === 'active');
      const pricePerSession = activePackage?.pricePerSession || 0;
      
      // Find the session record we just created and mark it as paid
      const today = new Date().toISOString().split('T')[0];
      const sessionRecord = sessions.find(s => 
        s.clientId === completedWorkoutData.clientId && 
        s.date === today && 
        s.workoutId === completedWorkoutData.id
      );
      if (sessionRecord && !sessionRecord.paid) {
        toggleSessionPaid(sessionRecord.id);
      }
      
      // Add payment record for tracking
      if (pricePerSession > 0) {
        addPayment({
          clientId: completedWorkoutData.clientId,
          trainerId: useAuthStore.getState().user?.id || '',
          amount: pricePerSession,
          currency: 'NZD',
          type: 'single_session',
          status: 'paid',
          method: 'cash',
          description: `PT Session - ${completedWorkoutData.name}`,
          paidAt: new Date().toISOString(),
        });
      }
      
      if (activePackage) {
        // Increment paid sessions
        updateSessionPackage(activePackage.id, {
          paidSessions: (activePackage.paidSessions || 0) + 1,
        });
      }
    }
    
    setShowSummary(false);
    setCompletedWorkoutData(null);
    setWorkoutNotes('');
    setSessionPaid(false);
    router.push('/workout');
  };

  const handleCancelWorkout = () => {
    cancelWorkout();
    toast('Workout cancelled');
    router.push('/workout');
  };

  // Save current workout as template
  const handleSaveWorkout = () => {
    if (!saveWorkoutName.trim() || !activeWorkout) return;
    
    // Convert current exercises to blocks format
    const blocks = workoutBlocks.map(block => {
      const blockExercises = activeWorkout.exercises
        .filter((ex: any) => ex.blockId === block.id)
        .map((ex: any) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exercise?.name,
          sets: ex.sets.length,
          reps: ex.sets[0]?.reps || 10,
          rest: ex.restTimerSeconds || 90,
        }));
      return {
        id: block.id,
        type: block.type,
        name: block.name,
        exercises: blockExercises,
        circuitStyle: block.circuitStyle,
        circuitRounds: block.circuitRounds,
        circuitDuration: block.circuitDuration,
      };
    });
    
    saveToWorkoutLibrary({
      name: saveWorkoutName.trim(),
      description: saveWorkoutDescription.trim() || undefined,
      blocks,
      estimatedMinutes: Math.round(workoutTimer.seconds / 60) || 45,
      tags: [],
    });
    
    toast.success('Workout saved to library!');
    setShowSaveWorkoutDialog(false);
    setSaveWorkoutName('');
    setSaveWorkoutDescription('');
  };

  // Save circuit block as template
  const handleSaveCircuit = () => {
    if (!saveCircuitName.trim() || !circuitToSave) return;
    
    const blockExercises = activeWorkout?.exercises
      .filter((ex: any) => ex.blockId === circuitToSave.id)
      .map((ex: any) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exercise?.name,
        sets: ex.sets.length,
        reps: ex.sets[0]?.reps || 10,
        rest: ex.restTimerSeconds || 30,
      })) || [];
    
    saveCircuitTemplate({
      name: saveCircuitName.trim(),
      description: saveCircuitDescription.trim() || undefined,
      exercises: blockExercises,
      circuitStyle: circuitToSave.circuitStyle || 'rounds',
      rounds: circuitToSave.circuitRounds,
      duration: circuitToSave.circuitDuration,
      restBetweenRounds: '60',
      tags: [],
    });
    
    toast.success('Circuit saved to library!');
    setShowSaveCircuitDialog(false);
    setSaveCircuitName('');
    setSaveCircuitDescription('');
    setCircuitToSave(null);
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
            {/* Client name for PT sessions */}
            {clientName && (
              <p className="text-white/90 text-sm font-medium">with {clientName}</p>
            )}
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
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                <DropdownMenuItem
                  className="text-emerald-400 focus:text-emerald-300"
                  onClick={() => {
                    setSaveWorkoutName(activeWorkout.name || '');
                    setShowSaveWorkoutDialog(true);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Save as Template
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-gray-300 focus:text-white"
                  onClick={() => setShowRestSettings(true)}
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Rest Timer Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-gray-300 focus:text-white"
                  onClick={() => setShowNotesDialog(true)}
                >
                  <StickyNote className="w-4 h-4 mr-2" />
                  Workout Notes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              onClick={() => setShowFinishDialog(true)}
              className="bg-white text-emerald-600 hover:bg-gray-100"
            >
              <Check className="w-4 h-4 mr-1" />
              Finish
            </Button>
          </div>
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

      {/* Block Panel - Add blocks from here */}
      <div className="sticky top-[168px] z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-2">Add:</span>
          
          {/* Warmup Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!hasWarmup) {
                addBlock('warmup');
              } else {
                const warmupBlock = workoutBlocks.find(b => b.type === 'warmup');
                if (warmupBlock) {
                  setActiveBlockId(warmupBlock.id);
                  setShowExerciseModal(true);
                }
              }
            }}
            className={cn(
              "h-8 px-3 gap-1.5",
              hasWarmup 
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" 
                : "hover:bg-yellow-500/10 text-yellow-400/70 hover:text-yellow-400"
            )}
          >
            🔥 <span className="hidden sm:inline">Warm-Up</span>
            {hasWarmup && <Check className="w-3 h-3" />}
          </Button>
          
          {/* Strength Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!hasStrength) {
                addBlock('strength');
              } else {
                const strengthBlock = workoutBlocks.find(b => b.type === 'strength');
                if (strengthBlock) {
                  setActiveBlockId(strengthBlock.id);
                  setShowExerciseModal(true);
                }
              }
            }}
            className={cn(
              "h-8 px-3 gap-1.5",
              hasStrength 
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                : "hover:bg-blue-500/10 text-blue-400/70 hover:text-blue-400"
            )}
          >
            💪 <span className="hidden sm:inline">Strength</span>
            {hasStrength && <Check className="w-3 h-3" />}
          </Button>
          
          {/* Circuit Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCircuitDialog(true)}
            className="h-8 px-3 gap-1.5 hover:bg-orange-500/10 text-orange-400/70 hover:text-orange-400"
          >
            ⚡ <span className="hidden sm:inline">Circuit</span>
            <Plus className="w-3 h-3" />
          </Button>
          
          {/* Quick Add */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActiveBlockId(null);
              setShowExerciseModal(true);
            }}
            className="h-8 px-3 gap-1.5 hover:bg-gray-700 text-gray-400 ml-auto"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Exercise</span>
          </Button>
        </div>
      </div>

      {/* Rest Timer - Small inline banner at top */}
      {restTimer.isRunning && restTimer.seconds > 0 && (
        <div className="fixed top-16 inset-x-0 z-40 px-4">
          <div className="bg-blue-600 rounded-xl p-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-white" />
              <span className="text-2xl font-bold text-white font-mono tabular-nums">
                {formatTime(restTimer.seconds)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const newTime = Math.max(0, restTimer.seconds - 15);
                  if (newTime === 0) {
                    resetRestTimer();
                  } else {
                    useWorkoutStore.getState().adjustRestTimer(-15);
                  }
                }}
                className="text-white hover:bg-white/20 h-8 px-2"
              >
                -15s
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => useWorkoutStore.getState().adjustRestTimer(15)}
                className="text-white hover:bg-white/20 h-8 px-2"
              >
                +15s
              </Button>
              <Button
                size="sm"
                onClick={resetRestTimer}
                className="bg-white text-blue-600 hover:bg-white/90 h-8"
              >
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

      {/* Exercise List with Block Sections */}
      <ScrollArea className="flex-1 pb-32">
        <div className="px-4 py-4 space-y-4">
          
          {/* Render workout blocks */}
          {workoutBlocks.map((block) => {
            const blockExercises = activeWorkout.exercises.filter(
              (e: any) => e.blockId === block.id
            );
            const colors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
              warmup: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', accent: 'yellow' },
              strength: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-400', accent: 'blue' },
              circuit: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-400', accent: 'orange' },
            };
            // Default to strength style if block type is unrecognized
            const defaultStyle = { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-400', accent: 'blue' };
            const style = colors[block.type] || defaultStyle;
            
            return (
              <div key={block.id} className={cn("rounded-xl border-2", style.border, style.bg)}>
                {/* Block Header */}
                <div className={cn("flex items-center justify-between p-3 border-b", style.border)}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {block.type === 'warmup' ? '🔥' : block.type === 'circuit' ? '⚡' : '💪'}
                    </span>
                    <div>
                      <h3 className={cn("font-semibold", style.text)}>{block.name}</h3>
                      <p className="text-xs text-gray-500">
                        {blockExercises.length} exercise{blockExercises.length !== 1 ? 's' : ''}
                        {block.type === 'circuit' && ` • ${block.circuitStyle?.toUpperCase()}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Block Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                        {block.type === 'circuit' && (
                          <DropdownMenuItem 
                            className="text-purple-400 focus:text-purple-300"
                            onClick={() => {
                              setSaveCircuitName(block.name || 'Circuit');
                              setCircuitToSave(block);
                              setShowSaveCircuitDialog(true);
                            }}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Save Circuit to Library
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem 
                          className="text-red-400 focus:text-red-300 focus:bg-red-500/20"
                          onClick={() => deleteBlock(block.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Block
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Circuit Timer */}
                    {block.type === 'circuit' && (
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "text-2xl font-mono font-bold",
                        block.completed ? "text-green-400" : style.text
                      )}>
                        {formatTime(block.timerSeconds || 0)}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleCircuitTimer(block.id)}
                        className={cn("h-8 w-8", style.text)}
                      >
                        {block.timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => resetCircuitTimer(block.id)}
                        className="h-8 w-8 text-gray-400"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                    )}
                  </div>
                </div>
                
                {/* Block Exercises - Different layout for circuits vs other blocks */}
                {block.type === 'circuit' ? (
                  // CIRCUIT LAYOUT - Exercise list with reps + round tracking
                  <div className="p-3 space-y-3">
                    {/* Exercise List */}
                    <div className="space-y-1">
                      {blockExercises.map((workoutExercise: any, idx: number) => (
                        <div 
                          key={workoutExercise.id} 
                          className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg"
                        >
                          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-white font-medium text-sm">{workoutExercise.exercise?.name || 'Exercise'}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={circuitExerciseReps[workoutExercise.id] || (workoutExercise.sets || [])[0]?.reps || ''}
                              onChange={(e) => {
                                const reps = parseInt(e.target.value) || 0;
                                setCircuitExerciseReps(prev => ({ ...prev, [workoutExercise.id]: reps }));
                                if ((workoutExercise.sets || [])[0]) {
                                  updateSet(workoutExercise.id, (workoutExercise.sets || [])[0].id, { reps });
                                }
                              }}
                              className="w-14 h-7 text-center text-sm bg-gray-900 border-gray-700"
                              placeholder="reps"
                            />
                            <span className="text-xs text-gray-500">reps</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeExercise(workoutExercise.id)}
                            className="h-6 w-6 text-gray-500 hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Round Tracking */}
                    {blockExercises.length > 0 && (
                      <div className="border-t border-orange-500/20 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-orange-400">Rounds</p>
                          <span className="text-xs text-gray-500">
                            {(block.roundsCompleted?.length || 0)}/{block.circuitRounds || '∞'} completed
                          </span>
                        </div>
                        
                        {/* Round checkboxes */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {Array.from({ length: block.circuitRounds || 5 }).map((_, idx) => {
                            const roundNum = idx + 1;
                            const completedRound = block.roundsCompleted?.find(r => r.roundNumber === roundNum);
                            const isCompleted = !!completedRound;
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => !isCompleted && completeCircuitRound(block.id)}
                                disabled={isCompleted || (block.roundsCompleted?.length || 0) !== idx}
                                className={cn(
                                  "w-12 h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all",
                                  isCompleted 
                                    ? "bg-orange-500 border-orange-500 text-white" 
                                    : (block.roundsCompleted?.length || 0) === idx
                                      ? "border-orange-500 text-orange-400 hover:bg-orange-500/20 cursor-pointer"
                                      : "border-gray-700 text-gray-600 cursor-not-allowed"
                                )}
                              >
                                {isCompleted ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    <span className="text-[10px]">{formatTime(completedRound.duration)}</span>
                                  </>
                                ) : (
                                  <span className="font-bold">{roundNum}</span>
                                )}
                              </button>
                            );
                          })}
                          {/* Add Round Button */}
                          <button
                            onClick={() => addCircuitRound(block.id)}
                            className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 hover:border-orange-500 hover:text-orange-400 transition-all"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        
                        {/* Start/Complete Round Button */}
                        {block.circuitComplete ? (
                          <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-center">
                            <p className="text-green-400 font-medium">Circuit Complete! 🎉</p>
                          </div>
                        ) : !block.currentRoundStart ? (
                          <Button
                            onClick={() => startCircuitRound(block.id)}
                            className="w-full bg-orange-500 hover:bg-orange-600"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start Round {(block.roundsCompleted?.length || 0) + 1}
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <Button
                              onClick={() => completeCircuitRound(block.id)}
                              variant="outline"
                              className="w-full border-orange-500 text-orange-400 hover:bg-orange-500/20"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Complete Round {(block.roundsCompleted?.length || 0) + 1}
                            </Button>
                            <Button
                              onClick={() => finishCircuit(block.id)}
                              className="w-full bg-green-500 hover:bg-green-600"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Finish Circuit
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  // WARMUP/STRENGTH LAYOUT - Full-width exercise cards with sets
                  <div className="divide-y divide-gray-800">
                    {blockExercises.map((workoutExercise: any) => {
                      const exercisePB = getPBForExercise(workoutExercise.exerciseId);
                      // Filter workout history by current client/user to show only their previous results
                      const clientWorkoutHistory = workoutHistory.filter((w: any) => 
                        w.userId === activeWorkout.userId
                      );
                      const lastWorkout = clientWorkoutHistory.find((w: any) => 
                        w.exercises?.some((e: any) => e.exerciseId === workoutExercise.exerciseId)
                      );
                      const lastSets = lastWorkout?.exercises?.find((e: any) => 
                        e.exerciseId === workoutExercise.exerciseId
                      )?.sets?.filter((s: any) => s.completed);
                      
                      return (
                      <div key={workoutExercise.id} className="bg-gray-900/30">
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-white">{workoutExercise.exercise?.name || 'Exercise'}</p>
                              <p className="text-xs text-gray-500">{workoutExercise.exercise?.primaryMuscles?.join(', ')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-gray-800 text-gray-400">
                                {(workoutExercise.sets || []).filter((s: any) => s.completed).length}/{(workoutExercise.sets || []).length}
                              </Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedExerciseForNotes(workoutExercise);
                                  setShowExerciseNotesDialog(true);
                                }}
                                className={cn(
                                  "h-8 w-8",
                                  workoutExercise.trainerNotes || workoutExercise.notes 
                                    ? "text-amber-400 hover:text-amber-300" 
                                    : "text-gray-500 hover:text-gray-300"
                                )}
                              >
                                <StickyNote className="w-4 h-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-gray-500 hover:text-gray-300"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                                  <DropdownMenuItem
                                    className="text-blue-400 focus:text-blue-300"
                                    onClick={() => {
                                      setSupersetSourceExercise(workoutExercise);
                                      setShowSupersetPicker(true);
                                    }}
                                  >
                                    <Link2 className="w-4 h-4 mr-2" />
                                    {workoutExercise.groupId ? 'Edit Superset' : 'Create Superset'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-purple-400 focus:text-purple-300"
                                    onClick={() => handleAddDropSet(workoutExercise.id)}
                                  >
                                    <ChevronDown className="w-4 h-4 mr-2" />
                                    Add Drop Set
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-gray-700" />
                                  <DropdownMenuItem
                                    className="text-red-400 focus:text-red-300"
                                    onClick={() => removeExercise(workoutExercise.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remove Exercise
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          {/* PB and Previous Results */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {exercisePB && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded">
                                <Trophy className="w-3 h-3 text-amber-400" />
                                <span className="text-amber-400">PB: {exercisePB.bestWeight}kg × {exercisePB.bestReps}</span>
                              </div>
                            )}
                            {lastSets && lastSets.length > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded">
                                <History className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-400">Last: {lastSets.slice(0, 3).map((s: any) => `${s.weight}×${s.reps}`).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Sets Header */}
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800/50 text-xs text-gray-500 font-medium">
                          <div className="col-span-1">SET</div>
                          <div className="col-span-3">PREVIOUS</div>
                          <div className="col-span-3 text-center">KG</div>
                          <div className="col-span-3 text-center">REPS</div>
                          <div className="col-span-2"></div>
                        </div>
                        {/* Sets */}
                        <div className="px-4 pb-3 divide-y divide-gray-800/50">
                          {(workoutExercise.sets || []).map((set: any, idx: number) => {
                            const previousDisplay = set.previousWeight && set.previousReps 
                              ? `${set.previousWeight}kg × ${set.previousReps}` 
                              : '—';
                            return (
                            <div key={set.id} className={cn("py-2 space-y-1", set.completed && "bg-emerald-500/10")}>
                              <div className="grid grid-cols-12 gap-2 items-center text-sm">
                                {/* Set Number/Type */}
                                <div className="col-span-1">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs",
                                        set.completed && "bg-emerald-500 text-white",
                                        !set.completed && set.type === 'warmup' && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
                                        !set.completed && set.type === 'dropset' && "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                                        !set.completed && set.type === 'failure' && "bg-red-500/20 text-red-400 border border-red-500/30",
                                        !set.completed && (!set.type || set.type === 'normal') && "bg-gray-800 text-gray-400"
                                      )}>
                                        {set.completed ? <Check className="w-4 h-4" /> : set.type === 'warmup' ? 'W' : set.type === 'dropset' ? 'D' : set.type === 'failure' ? 'F' : idx + 1}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-gray-900 border-gray-700">
                                      <DropdownMenuItem 
                                        onClick={() => updateSet(workoutExercise.id, set.id, { type: 'normal' })}
                                        className="text-gray-300 focus:text-white focus:bg-gray-700"
                                      >
                                        Normal Set
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => updateSet(workoutExercise.id, set.id, { type: 'warmup' })}
                                        className="text-yellow-400 focus:text-yellow-300 focus:bg-gray-700"
                                      >
                                        Warm-up Set
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => updateSet(workoutExercise.id, set.id, { type: 'dropset' })}
                                        className="text-purple-400 focus:text-purple-300 focus:bg-gray-700"
                                      >
                                        Drop Set
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => updateSet(workoutExercise.id, set.id, { type: 'failure' })}
                                        className="text-red-400 focus:text-red-300 focus:bg-gray-700"
                                      >
                                        Failure Set
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                {/* Previous */}
                                <div className="col-span-3">
                                  <span className="text-xs text-gray-500">{previousDisplay}</span>
                                </div>
                                {/* Weight Input */}
                                <div className="col-span-3">
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={set.weight || ''}
                                    onChange={(e) => updateSet(workoutExercise.id, set.id, { weight: parseFloat(e.target.value) || 0 })}
                                    disabled={set.completed}
                                    className={cn("h-9 text-center bg-gray-800 border-gray-700", set.completed && "opacity-50")}
                                  />
                                </div>
                                {/* Reps Input */}
                                <div className="col-span-3">
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={set.reps || ''}
                                    onChange={(e) => updateSet(workoutExercise.id, set.id, { reps: parseInt(e.target.value) || 0 })}
                                    disabled={set.completed}
                                    className={cn("h-9 text-center bg-gray-800 border-gray-700", set.completed && "opacity-50")}
                                  />
                                </div>
                                {/* Complete Button / Rest Timer */}
                                <div className="col-span-2 flex justify-end items-center gap-1">
                                  {/* Per-set rest timer countdown */}
                                  {setRestTimers[set.id]?.remaining > 0 && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded text-xs">
                                      <Timer className="w-3 h-3 text-blue-400" />
                                      <span className="text-blue-400 font-mono">
                                        {Math.floor(setRestTimers[set.id].remaining / 60)}:{(setRestTimers[set.id].remaining % 60).toString().padStart(2, '0')}
                                      </span>
                                    </div>
                                  )}
                                  {!set.completed ? (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleCompleteSet(workoutExercise.id, set.id, set.weight ?? 0, set.reps || 0, workoutExercise.exercise?.name || 'Exercise')}
                                      disabled={set.weight === undefined || set.weight === null || !set.reps}
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
                                          onClick={() => uncompleteSet(workoutExercise.id, set.id)}
                                        >
                                          <RotateCcw className="w-4 h-4 mr-2" />
                                          Undo / Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-gray-700" />
                                        <DropdownMenuItem 
                                          className="text-red-400 focus:text-red-300"
                                          onClick={() => removeSet(workoutExercise.id, set.id)}
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete Set
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                              {/* Drop set additional weights */}
                              {set.type === 'dropset' && set.drops?.map((drop: any, dropIdx: number) => (
                                <div key={drop.id} className="flex items-center gap-2 text-sm ml-10 pl-2 border-l-2 border-purple-500/30">
                                  <span className="text-xs text-purple-400">↓</span>
                                  <Input
                                    type="number"
                                    placeholder="kg"
                                    value={drop.weight || ''}
                                    onChange={(e) => {
                                      const newDrops = [...(set.drops || [])];
                                      newDrops[dropIdx] = { ...drop, weight: parseFloat(e.target.value) || 0 };
                                      updateSet(workoutExercise.id, set.id, { drops: newDrops });
                                    }}
                                    className="w-16 h-8 text-center bg-gray-800 border-gray-700 text-sm"
                                  />
                                  <span className="text-gray-600">×</span>
                                  <Input
                                    type="number"
                                    placeholder="reps"
                                    value={drop.reps || ''}
                                    onChange={(e) => {
                                      const newDrops = [...(set.drops || [])];
                                      newDrops[dropIdx] = { ...drop, reps: parseInt(e.target.value) || 0 };
                                      updateSet(workoutExercise.id, set.id, { drops: newDrops });
                                    }}
                                    className="w-16 h-8 text-center bg-gray-800 border-gray-700 text-sm"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      const newDrops = set.drops.filter((_: any, i: number) => i !== dropIdx);
                                      updateSet(workoutExercise.id, set.id, { drops: newDrops });
                                    }}
                                    className="h-6 w-6 text-gray-500 hover:text-red-400"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                              {set.type === 'dropset' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newDrop = { id: `drop-${Date.now()}`, weight: 0, reps: 0 };
                                    updateSet(workoutExercise.id, set.id, { drops: [...(set.drops || []), newDrop] });
                                  }}
                                  className="ml-10 text-xs text-purple-400 hover:text-purple-300 h-6"
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Add Drop
                                </Button>
                              )}
                            </div>
                          );})}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addSet(workoutExercise.id)}
                            className="w-full text-xs text-gray-500 hover:text-white h-8"
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Set
                          </Button>
                        </div>
                      </div>
                    );})}
                  </div>
                )}
                
                {/* Add Exercise to Block */}
                <div className="p-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActiveBlockId(block.id);
                      setShowExerciseModal(true);
                    }}
                    className={cn(
                      "w-full h-10 border-2 border-dashed rounded-lg",
                      block.type === 'warmup' && "border-yellow-500/30 text-yellow-400/70 hover:bg-yellow-500/10",
                      block.type === 'strength' && "border-blue-500/30 text-blue-400/70 hover:bg-blue-500/10",
                      block.type === 'circuit' && "border-orange-500/30 text-orange-400/70 hover:bg-orange-500/10",
                    )}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Exercise
                  </Button>
                </div>
              </div>
            );
          })}
          
          {/* Exercises without blocks */}
          {activeWorkout.exercises.filter((e: any) => !e.blockId).map((workoutExercise, index) => {
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
                {/* Block Header - Color coded like builder */}
                {showBlockHeader && (() => {
                  const blockType = (workoutExercise as any).blockType;
                  const colors: Record<string, { gradient: string; text: string; bg: string }> = {
                    warmup: { gradient: 'from-yellow-500/50', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                    work: { gradient: 'from-blue-500/50', text: 'text-blue-400', bg: 'bg-blue-500/10' },
                    circuit: { gradient: 'from-orange-500/50', text: 'text-orange-400', bg: 'bg-orange-500/10' },
                    cooldown: { gradient: 'from-purple-500/50', text: 'text-purple-400', bg: 'bg-purple-500/10' },
                    cardio: { gradient: 'from-green-500/50', text: 'text-green-400', bg: 'bg-green-500/10' },
                  };
                  const style = colors[blockType] || colors.work;
                  
                  return (
                    <div className={`space-y-2 pt-3 pb-2 px-3 rounded-lg ${style.bg} border border-${blockType === 'warmup' ? 'yellow' : blockType === 'circuit' ? 'orange' : blockType === 'cooldown' ? 'purple' : blockType === 'cardio' ? 'green' : 'blue'}-500/20`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-px flex-1 bg-gradient-to-r ${style.gradient} to-transparent`} />
                        <span className={`text-sm font-semibold ${style.text} px-2 flex items-center gap-2`}>
                          {blockType === 'warmup' && '🔥'}
                          {blockType === 'work' && '💪'}
                          {blockType === 'circuit' && '⚡'}
                          {blockType === 'cooldown' && '🧘'}
                          {blockType === 'cardio' && '🏃'}
                          {currentBlockName}
                        </span>
                        <div className={`h-px flex-1 bg-gradient-to-l ${style.gradient} to-transparent`} />
                      </div>
                      {/* Circuit block timing info */}
                      {blockType === 'circuit' && (workoutExercise as any).circuitRounds && (
                        <div className="flex items-center justify-center gap-2 text-xs text-orange-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            {(workoutExercise as any).circuitRounds} rounds × {(workoutExercise as any).roundDuration || '5min'}
                            {(workoutExercise as any).restBetweenRounds && ` • ${(workoutExercise as any).restBetweenRounds} rest`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                        <h3 className="font-semibold text-white">{workoutExercise.exercise?.name || 'Exercise'}</h3>
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
                            (workoutExercise.sets || []).forEach((s, idx) => {
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
                            const sets = workoutExercise.sets || [];
                            const lastSet = sets[sets.length - 1];
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
                    {(workoutExercise.sets || []).map((set) => (
                      <SetRow
                        key={set.id}
                        set={set}
                        exerciseId={workoutExercise.id}
                        exerciseName={workoutExercise.exercise?.name || 'Exercise'}
                        onUpdate={(updates) => updateSet(workoutExercise.id, set.id, updates)}
                        onComplete={(weight, reps) => handleCompleteSet(workoutExercise.id, set.id, weight, reps, workoutExercise.exercise?.name || 'Exercise')}
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

        </div>
      </ScrollArea>

      {/* Exercise Modal */}
      <Dialog open={showExerciseModal} onOpenChange={(open) => {
        setShowExerciseModal(open);
        if (!open) {
          setExerciseSearch('');
          setCircuitExerciseSelection([]);
        }
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[85vh]">
          <DialogHeader>
            {activeBlockId && (() => {
              const block = workoutBlocks.find(b => b.id === activeBlockId);
              if (!block) return null;
              const colors: Record<string, { bg: string; border: string; text: string }> = {
                warmup: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
                strength: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400' },
                circuit: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400' },
              };
              // Default to strength style
              const defaultStyle = { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400' };
              const style = colors[block.type] || defaultStyle;
              return (
                <div className={cn("flex items-center gap-3 p-3 rounded-lg", style.bg, style.border, "border")}>
                  <span className="text-xl">
                    {block.type === 'warmup' && '🔥'}
                    {block.type === 'strength' && '💪'}
                    {block.type === 'circuit' && '⚡'}
                  </span>
                  <div className="flex-1">
                    <p className={cn("font-semibold", style.text)}>{block.name}</p>
                    <p className="text-xs text-gray-400">
                      {block.type === 'warmup' && 'Select warm-up & mobility exercises'}
                      {block.type === 'strength' && 'Select strength & resistance exercises'}
                      {block.type === 'circuit' && `Select exercises for ${block.circuitStyle?.toUpperCase()} circuit`}
                    </p>
                  </div>
                  {block.type === 'circuit' && circuitExerciseSelection.length > 0 && (
                    <Badge className="bg-orange-500">{circuitExerciseSelection.length} selected</Badge>
                  )}
                </div>
              );
            })()}
            {!activeBlockId && (
              <>
                <DialogTitle className="text-white">Add Exercise</DialogTitle>
                <DialogDescription>Search and add any exercise to your workout</DialogDescription>
              </>
            )}
          </DialogHeader>
          
          {/* Exercise type indicator */}
          {activeBlockId && (() => {
            const block = workoutBlocks.find(b => b.id === activeBlockId);
            if (!block) return null;
            return (
              <div className={cn(
                "text-xs px-3 py-1.5 rounded-md mb-2",
                block.type === 'warmup' && "bg-yellow-500/10 text-yellow-400",
                block.type === 'strength' && "bg-blue-500/10 text-blue-400",
                block.type === 'circuit' && "bg-orange-500/10 text-orange-400",
              )}>
                {block.type === 'warmup' && '🔥 Showing: Bands, stretches, bodyweight, mobility exercises'}
                {block.type === 'strength' && '💪 Showing: Barbell, dumbbell, cable, machine exercises'}
                {block.type === 'circuit' && '⚡ Showing: All exercises - tap to select multiple, then save'}
              </div>
            );
          })()}
          
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search exercises..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              autoFocus
            />
          </div>

          <ScrollArea className="max-h-[45vh]">
            <div className="space-y-1 pr-4">
              {getFilteredExercises().slice(0, 50).map((exercise) => {
                const block = workoutBlocks.find(b => b.id === activeBlockId);
                const isSelected = circuitExerciseSelection.some(e => e.id === exercise.id);
                return (
                  <Button
                    key={exercise.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-auto py-3 px-4",
                      block?.type === 'warmup' && "hover:bg-yellow-500/10",
                      block?.type === 'strength' && "hover:bg-blue-500/10",
                      block?.type === 'circuit' && "hover:bg-orange-500/10",
                      block?.type === 'circuit' && isSelected && "bg-orange-500/20 border border-orange-500/50",
                      !block && "hover:bg-gray-800",
                    )}
                    onClick={() => handleAddExercise(exercise)}
                  >
                    {block?.type === 'circuit' && (
                      <div className={cn(
                        "w-5 h-5 rounded border-2 mr-3 flex items-center justify-center",
                        isSelected ? "bg-orange-500 border-orange-500" : "border-gray-600"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    )}
                    <div className="text-left flex-1">
                      <p className="font-medium text-white">{exercise.name}</p>
                      <p className="text-xs text-gray-500">
                        {exercise.primaryMuscles.map(m => getMuscleDisplayName(m)).join(', ')} • {exercise.equipment}
                      </p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
          
          {/* Circuit Save Button */}
          {(() => {
            const block = workoutBlocks.find(b => b.id === activeBlockId);
            if (block?.type === 'circuit' && circuitExerciseSelection.length > 0) {
              return (
                <div className="pt-3 border-t border-gray-800">
                  <Button
                    onClick={handleSaveCircuitExercises}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Add {circuitExerciseSelection.length} Exercise{circuitExerciseSelection.length > 1 ? 's' : ''} to Circuit
                  </Button>
                </div>
              );
            }
            return null;
          })()}
        </DialogContent>
      </Dialog>

      {/* Circuit Config Dialog */}
      <Dialog open={showCircuitDialog} onOpenChange={setShowCircuitDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <span>⚡</span> Add Circuit Block
            </DialogTitle>
            <DialogDescription>Configure your circuit settings</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Circuit Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'amrap', label: 'AMRAP', desc: 'As many rounds as possible', icon: '♾️' },
                  { id: 'forTime', label: 'For Time', desc: 'Complete as fast as possible', icon: '🏁' },
                  { id: 'emom', label: 'EMOM', desc: 'Every minute on the minute', icon: '⏱️' },
                  { id: 'rounds', label: 'Rounds', desc: 'Fixed number of rounds', icon: '🔄' },
                ].map((style) => (
                  <Button
                    key={style.id}
                    type="button"
                    variant={circuitConfig.style === style.id ? 'default' : 'outline'}
                    className={cn(
                      "h-auto py-3 flex-col items-start",
                      circuitConfig.style === style.id 
                        ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500' 
                        : 'border-gray-700 hover:bg-orange-500/10 hover:border-orange-500/50'
                    )}
                    onClick={() => setCircuitConfig({ ...circuitConfig, style: style.id as any })}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span>{style.icon}</span>
                      <span className="font-semibold">{style.label}</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">{style.desc}</p>
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {(circuitConfig.style === 'amrap' || circuitConfig.style === 'emom') && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={Math.floor(circuitConfig.duration / 60)}
                    onChange={(e) => setCircuitConfig({ ...circuitConfig, duration: (parseInt(e.target.value) || 1) * 60 })}
                    className="bg-gray-800 border-gray-700"
                    min={1}
                  />
                </div>
              )}
              {(circuitConfig.style === 'rounds' || circuitConfig.style === 'forTime') && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Rounds</label>
                  <Input
                    type="number"
                    value={circuitConfig.rounds}
                    onChange={(e) => setCircuitConfig({ ...circuitConfig, rounds: parseInt(e.target.value) || 1 })}
                    className="bg-gray-800 border-gray-700"
                    min={1}
                  />
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => addBlock('circuit')}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Circuit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

            {/* Session Paid Checkbox - Only for PT sessions */}
            {completedWorkoutData?.isPTSession && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sessionPaid}
                    onChange={(e) => setSessionPaid(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="text-left">
                    <span className="text-white font-medium">Session Paid</span>
                    <p className="text-xs text-gray-400">Check if client has paid for this session</p>
                  </div>
                </label>
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

      {/* Exercise Notes Dialog */}
      <Dialog 
        open={showExerciseNotesDialog} 
        onOpenChange={(open) => {
          setShowExerciseNotesDialog(open);
          if (!open) setSelectedExerciseForNotes(null);
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-amber-400" />
              {selectedExerciseForNotes?.exercise?.name || 'Exercise'} Notes
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              View or add notes for this exercise (e.g., incline settings, form cues)
            </DialogDescription>
          </DialogHeader>
          
          {/* Display existing trainer notes if any */}
          {selectedExerciseForNotes?.trainerNotes && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-400 font-medium mb-1">Trainer Notes:</p>
              <p className="text-sm text-white">{selectedExerciseForNotes.trainerNotes}</p>
            </div>
          )}
          
          <textarea
            value={selectedExerciseForNotes?.notes || ''}
            onChange={(e) => {
              if (selectedExerciseForNotes) {
                updateExercise(selectedExerciseForNotes.id, { notes: e.target.value });
              }
            }}
            placeholder="Add your notes for this exercise..."
            className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          
          <Button
            onClick={() => {
              setShowExerciseNotesDialog(false);
              setSelectedExerciseForNotes(null);
            }}
            className="w-full bg-amber-500 hover:bg-amber-600"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>

      {/* Superset Picker Dialog */}
      <Dialog 
        open={showSupersetPicker} 
        onOpenChange={(open) => {
          setShowSupersetPicker(open);
          if (!open) setSupersetSourceExercise(null);
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-400" />
              Create Superset
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Select another exercise to pair with {supersetSourceExercise?.exercise?.name}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {activeWorkout?.exercises
                .filter(ex => ex.id !== supersetSourceExercise?.id && !ex.groupId)
                .map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => handleCreateSuperset(ex.id)}
                    className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
                  >
                    <p className="font-medium text-white">{ex.exercise?.name}</p>
                    <p className="text-xs text-gray-500">{ex.sets.length} sets</p>
                  </button>
                ))}
            </div>
          </ScrollArea>
          
          <Button
            variant="outline"
            onClick={() => {
              setShowSupersetPicker(false);
              setSupersetSourceExercise(null);
            }}
            className="w-full border-gray-700 text-gray-400"
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>

      {/* Save Workout Dialog */}
      <Dialog open={showSaveWorkoutDialog} onOpenChange={setShowSaveWorkoutDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-emerald-400" />
              Save Workout as Template
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Save this workout to your library for future use
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Workout Name</label>
              <Input
                value={saveWorkoutName}
                onChange={(e) => setSaveWorkoutName(e.target.value)}
                placeholder="e.g., Upper Body Push"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description (optional)</label>
              <textarea
                value={saveWorkoutDescription}
                onChange={(e) => setSaveWorkoutDescription(e.target.value)}
                placeholder="Brief description of this workout..."
                className="w-full h-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveWorkoutDialog(false)}
              className="flex-1 border-gray-700 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveWorkout}
              disabled={!saveWorkoutName.trim()}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
            >
              Save to Library
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Circuit Dialog */}
      <Dialog open={showSaveCircuitDialog} onOpenChange={setShowSaveCircuitDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-400" />
              Save Circuit as Template
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Save this circuit to your library for future use
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Circuit Name</label>
              <Input
                value={saveCircuitName}
                onChange={(e) => setSaveCircuitName(e.target.value)}
                placeholder="e.g., HIIT Finisher"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description (optional)</label>
              <textarea
                value={saveCircuitDescription}
                onChange={(e) => setSaveCircuitDescription(e.target.value)}
                placeholder="Brief description of this circuit..."
                className="w-full h-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveCircuitDialog(false);
                setCircuitToSave(null);
              }}
              className="flex-1 border-gray-700 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCircuit}
              disabled={!saveCircuitName.trim()}
              className="flex-1 bg-purple-500 hover:bg-purple-600"
            >
              Save to Library
            </Button>
          </div>
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
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onUpdate({ isAssisted: !set.isAssisted })}
              disabled={set.completed}
              className={cn(
                "h-7 w-7 shrink-0",
                set.isAssisted 
                  ? "text-blue-400 bg-blue-500/20 hover:bg-blue-500/30" 
                  : "text-gray-500 hover:text-gray-400 hover:bg-gray-800"
              )}
              title={set.isAssisted ? "Assisted (weight helps you)" : "Normal weight"}
            >
              <span className="text-xs font-bold">{set.isAssisted ? '-' : '+'}</span>
            </Button>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={() => onUpdate({ weight: parseFloat(weight) || undefined })}
              disabled={set.completed}
              className={cn(
                "h-9 text-center bg-gray-800 border-gray-700 text-white flex-1",
                set.completed && "opacity-50",
                set.isAssisted && "border-blue-500/50"
              )}
            />
          </div>
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
