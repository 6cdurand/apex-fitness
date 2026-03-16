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
import { exerciseLibrary, searchExercises, calculate1RM, getMuscleDisplayName, isAssistedExercise, formatAssistedName, formatAssistedWeight } from '@/lib/exercises';
import { syncExerciseHistoryToSupabase } from '@/lib/supabaseSync';
import { getClientDisplayInfo } from '@/lib/clientUtils';
import { getMedalDefinition } from '@/lib/medals';
import { cn } from '@/lib/utils';
import { ExerciseHowTo } from '@/components/ExerciseHowTo';
import { getExerciseAnimationUrl } from '@/lib/exerciseAnimations';
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
  Link2,
  Edit,
  ArrowLeftRight,
  TrendingUp,
  Dumbbell,
  Flame,
  Zap,
  Heart,
  Loader2
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
  const { isAuthenticated, user: currentUser } = useAuthStore();
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
    getExerciseNotes,
    setExerciseNotes,
  } = useWorkoutStore();
  const _medalStore = useMedalStore();
  const { lastDeriveResult } = useWorkoutStore();
  const { createPost } = useSocialStore();
  const { clients, saveToWorkoutLibrary, saveCircuitTemplate, getBestBlockPerformance, getBlockPerformances } = useTrainerStore();
  
  // Get client name if this is a PT session — centralized resolution
  const resolvedClientId = currentClientId || (activeWorkout?.assignedBy ? activeWorkout.userId : null);
  const clientInfo = resolvedClientId ? getClientDisplayInfo(resolvedClientId) : null;
  const clientName = clientInfo?.displayName || null;
  const isPT = !!activeWorkout?.assignedBy;

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
    startTime: string;
    endTime: string;
    previousRating?: { overall: number; overallTier: string; categories: Record<string, { tier: string; score: number }> };
  } | null>(null);
  const [editingTimes, setEditingTimes] = useState(false);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [defaultRestTime, setDefaultRestTime] = useState(90);
  const [autoRestEnabled, setAutoRestEnabled] = useState(true);
  const [newPBs, setNewPBs] = useState<string[]>([]);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [sessionPaid, setSessionPaid] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
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
  
  // Active stretch/timed set timers (setId -> { remaining, total, isRunning })
  const [activeSetTimers, setActiveSetTimers] = useState<Record<string, { remaining: number; total: number; isRunning: boolean }>>({});
  
  // Block system state
  const [workoutBlocks, setWorkoutBlocks] = useState<{
    id: string;
    type: 'warmup' | 'strength' | 'circuit' | 'cardio';
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
    // Cardio-specific fields
    cardioType?: 'run' | 'swim' | 'bike' | 'row' | 'other';
    cardioMode?: 'steady' | 'intervals' | 'distance';
    targetDistance?: number; // in meters
    targetPace?: string; // e.g., "5:00/km"
    intervalWork?: number; // work seconds
    intervalRest?: number; // rest seconds
    intervalRounds?: number;
    currentIntervalPhase?: 'work' | 'rest';
    currentIntervalRound?: number;
    distanceCompleted?: number;
    splits?: { distance: number; time: number }[];
  }[]>([]);
  
  // Circuit exercise reps (exerciseId -> reps)
  const [circuitExerciseReps, setCircuitExerciseReps] = useState<Record<string, number>>({});
  const [showCircuitDialog, setShowCircuitDialog] = useState(false);
  const [circuitConfig, setCircuitConfig] = useState({
    style: 'amrap' as 'amrap' | 'forTime' | 'rounds' | 'emom',
    duration: 600, // 10 min default
    rounds: 3,
  });
  
  // Cardio block config
  const [showCardioDialog, setShowCardioDialog] = useState(false);
  const [cardioConfig, setCardioConfig] = useState({
    type: 'run' as 'run' | 'swim' | 'bike' | 'row' | 'other',
    mode: 'steady' as 'steady' | 'intervals' | 'distance',
    duration: 1200, // 20 min default
    distance: 5000, // 5km default
    intervalWork: 60,
    intervalRest: 30,
    intervalRounds: 8,
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
  // BUT skip redirect if the summary is showing (activeWorkout is null after endWorkout)
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (!activeWorkout && !showSummary && !completedWorkoutData) {
      router.replace('/workout');
    }
  }, [isAuthenticated, activeWorkout, showSummary, completedWorkoutData, router]);

  // Map block types from builder format to active workout format
  const mapBlockType = (type: string): 'warmup' | 'strength' | 'circuit' | 'cardio' => {
    const typeMap: Record<string, 'warmup' | 'strength' | 'circuit' | 'cardio'> = {
      'warmup': 'warmup',
      'work': 'strength',
      'strength': 'strength',
      'circuit': 'circuit',
      'cardio': 'cardio',
      'cooldown': 'warmup', // Map cooldown to warmup styling
    };
    return typeMap[type] || 'strength';
  };

  // Initialize blocks from activeWorkout.blocks (for session workouts)
  useEffect(() => {
    if (activeWorkout?.blocks && activeWorkout.blocks.length > 0 && workoutBlocks.length === 0) {
      const initialBlocks = activeWorkout.blocks.map((block: any) => ({
        id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: mapBlockType(block.type),
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
      console.log('[Active Workout] Initialized blocks:', initialBlocks.map(b => ({ id: b.id, type: b.type, name: b.name })));
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

  // Active set timers (for timed exercises like stretches)
  useEffect(() => {
    const hasRunningTimer = Object.values(activeSetTimers).some(t => t.isRunning && t.remaining > 0);
    if (!hasRunningTimer) return;
    
    const interval = setInterval(() => {
      setActiveSetTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(setId => {
          if (updated[setId].isRunning && updated[setId].remaining > 0) {
            updated[setId] = { ...updated[setId], remaining: updated[setId].remaining - 1 };
          } else if (updated[setId].isRunning && updated[setId].remaining === 0) {
            updated[setId] = { ...updated[setId], isRunning: false };
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSetTimers]);

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
    
    // When searching, search entire library by name, muscles, equipment, and category
    if (exerciseSearch) {
      const search = exerciseSearch.toLowerCase();
      return exerciseLibrary.filter(e => 
        e.name.toLowerCase().includes(search) ||
        e.primaryMuscles.some(m => m.toLowerCase().includes(search)) ||
        e.secondaryMuscles.some(m => m.toLowerCase().includes(search)) ||
        e.equipment.toLowerCase().includes(search) ||
        e.category.toLowerCase().includes(search)
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
  
  const addBlock = (type: 'warmup' | 'strength' | 'circuit' | 'cardio') => {
    if (type === 'warmup' && hasWarmup) return;
    if (type === 'strength' && hasStrength) return;
    
    const circuitCount = workoutBlocks.filter(b => b.type === 'circuit').length;
    const cardioCount = workoutBlocks.filter(b => b.type === 'cardio').length;
    
    const cardioNames: Record<string, string> = {
      run: 'Run',
      swim: 'Swim',
      bike: 'Bike',
      row: 'Row',
      other: 'Cardio',
    };
    
    const newBlock = {
      id: `block-${Date.now()}`,
      type,
      name: type === 'warmup' ? 'Warm-Up' : 
            type === 'strength' ? 'Strength' : 
            type === 'cardio' ? `${cardioNames[cardioConfig.type]} ${cardioCount + 1}` :
            `Circuit ${circuitCount + 1}`,
      ...(type === 'circuit' && {
        circuitStyle: circuitConfig.style,
        circuitDuration: circuitConfig.duration,
        circuitRounds: circuitConfig.rounds,
        timerSeconds: circuitConfig.style === 'forTime' ? 0 : circuitConfig.duration,
        timerRunning: false,
      }),
      ...(type === 'cardio' && {
        cardioType: cardioConfig.type,
        cardioMode: cardioConfig.mode,
        targetDistance: cardioConfig.mode === 'distance' ? cardioConfig.distance : undefined,
        intervalWork: cardioConfig.mode === 'intervals' ? cardioConfig.intervalWork : undefined,
        intervalRest: cardioConfig.mode === 'intervals' ? cardioConfig.intervalRest : undefined,
        intervalRounds: cardioConfig.mode === 'intervals' ? cardioConfig.intervalRounds : undefined,
        timerSeconds: cardioConfig.mode === 'steady' ? cardioConfig.duration : 0,
        timerRunning: false,
        currentIntervalPhase: 'work' as const,
        currentIntervalRound: 1,
        splits: [],
      }),
    };
    
    setWorkoutBlocks([...workoutBlocks, newBlock]);
    setActiveBlockId(newBlock.id);
    
    if (type === 'circuit') {
      setShowCircuitDialog(false);
    }
    if (type === 'cardio') {
      setShowCardioDialog(false);
    }
    
    // Don't show exercise modal for cardio blocks
    if (type !== 'cardio') {
      setShowExerciseModal(true);
    }
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
    
    // Check for new PB - only show toast if the 1RM actually beats the previous best
    const exercise = activeWorkout?.exercises.find(e => e.id === exerciseId);
    if (exercise) {
      const newRM = calculate1RM(weight, reps);
      // Get the updated PB after completeSet ran
      const pb = getPBForExercise(exercise.exerciseId);
      // Only show PB toast if:
      // 1. We have a valid 1RM calculation
      // 2. The stored PB matches our lift (meaning our lift became the new PB)
      // 3. The new 1RM equals the stored oneRepMax (confirming it was actually an improvement)
      if (newRM !== null && pb && pb.oneRepMax === newRM && pb.bestWeight === weight && pb.bestReps === reps) {
        setNewPBs(prev => [...prev, exerciseName]);
        toast.success(`New Personal Best! 🏆 ${exerciseName}: ${Math.round(newRM)}kg 1RM`);
      }
    }
  };

  // Handle starting/stopping a timed set timer (for stretches)
  const handleToggleSetTimer = (setId: string, duration: number, exerciseId: string) => {
    const existingTimer = activeSetTimers[setId];
    
    if (existingTimer?.isRunning) {
      // Stop the timer
      setActiveSetTimers(prev => ({
        ...prev,
        [setId]: { ...prev[setId], isRunning: false }
      }));
    } else if (existingTimer && existingTimer.remaining > 0) {
      // Resume the timer
      setActiveSetTimers(prev => ({
        ...prev,
        [setId]: { ...prev[setId], isRunning: true }
      }));
    } else {
      // Start new timer
      setActiveSetTimers(prev => ({
        ...prev,
        [setId]: { remaining: duration, total: duration, isRunning: true }
      }));
    }
  };

  // Handle completing a timed set
  const handleCompleteTimedSet = (exerciseId: string, setId: string, exerciseName: string) => {
    completeSet(exerciseId, setId);
    // Clear the timer for this set
    setActiveSetTimers(prev => {
      const updated = { ...prev };
      delete updated[setId];
      return updated;
    });
    toast.success(`${exerciseName} completed!`);
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
    
    // Snapshot current strength rating BEFORE ending (for comparison in summary)
    const prevRating = useMedalStore.getState().strengthRating;
    const previousRating = prevRating ? {
      overall: prevRating.overall,
      overallTier: prevRating.overallTier,
      categories: Object.fromEntries(
        Object.entries(prevRating.categories).map(([k, v]: [string, any]) => [k, { tier: v.tier, score: v.totalPoints }])
      ),
    } : undefined;

    const completed = endWorkout(workoutNotes);
    if (completed) {
      // Feed post is now opt-in — created in handleCloseSummary if shareToFeed is checked

      // Session record creation + totalSessions increment is handled by completeWorkout (endWorkout) in store.ts
      // Do NOT duplicate it here — that causes double counting

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
      const endTimeStr = completed.endTime || new Date().toISOString();
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
        startTime: completed.startTime,
        endTime: endTimeStr,
        previousRating,
      });
      // Pre-fill editable time fields
      setEditStartTime(new Date(completed.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setEditEndTime(new Date(endTimeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setShowFinishDialog(false);
      setShowSummary(true);

      // Fetch AI feedback asynchronously
      const isPro = currentUser?.membershipTier === 'pro' || currentUser?.membershipTier === 'trainer';
      if (isPro) {
        setAiFeedbackLoading(true);
        setAiFeedback(null);
        const exerciseNames = completed.exercises
          ?.slice(0, 5)
          .map((ex: any) => ex.exercise?.name)
          .filter(Boolean)
          .join(', ') || '';
        fetch('/api/workout-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workoutName,
            duration,
            totalVolume: completed.totalVolume,
            exerciseCount,
            setCount: completedSetsCount,
            pbCount: newPBs.length,
            medalCount: useWorkoutStore.getState().lastDeriveResult?.medalsAwarded?.length || 0,
            exercises: exerciseNames,
          }),
        })
          .then(r => r.json())
          .then(data => { if (data.feedback) setAiFeedback(data.feedback); })
          .catch(() => {})
          .finally(() => setAiFeedbackLoading(false));
      }
    }
  };

  const handleCloseSummary = () => {
    // Save edited times if changed
    if (editingTimes && completedWorkoutData?.id) {
      const origDate = new Date(completedWorkoutData.startTime);
      const dateStr = origDate.toISOString().split('T')[0];
      const [sh, sm] = editStartTime.split(':').map(Number);
      const [eh, em] = editEndTime.split(':').map(Number);
      const newStart = new Date(`${dateStr}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`);
      const newEnd = new Date(`${dateStr}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`);
      // Handle case where end is past midnight
      if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1);
      const newDuration = Math.round((newEnd.getTime() - newStart.getTime()) / 1000);
      useWorkoutStore.getState().updateCompletedWorkout(completedWorkoutData.id, {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        duration: newDuration,
      });
      setEditingTimes(false);
    }
    // Save notes — PT session notes go to trainerNotes (private), personal workout notes go to notes (visible)
    if (workoutNotes.trim() && completedWorkoutData?.id) {
      if (completedWorkoutData.isPTSession) {
        // Trainer's notes are private — save to trainerNotes field
        useWorkoutStore.getState().updateCompletedWorkout(completedWorkoutData.id, { 
          trainerNotes: workoutNotes.trim() 
        });
      } else {
        // Personal workout — notes visible to user
        useWorkoutStore.getState().updateWorkoutNotes(completedWorkoutData.id, workoutNotes.trim());
      }
    }
    
    // Share to feed (opt-in only)
    if (shareToFeed && completedWorkoutData) {
      const pbText = completedWorkoutData.pbs.length > 0 
        ? ` 🏆 ${completedWorkoutData.pbs.length} new PR${completedWorkoutData.pbs.length > 1 ? 's' : ''}!` 
        : '';
      createPost(
        'workout_complete',
        `Completed ${completedWorkoutData.name}! 💪 ${completedWorkoutData.exercises} exercises, ${Math.round(completedWorkoutData.totalVolume)}kg total volume.${pbText}`,
        undefined,
        completedWorkoutData.id
      );
    }
    
    // Update session paid status and create payment record for PT session
    if (completedWorkoutData?.isPTSession && completedWorkoutData?.clientId) {
      const { getPackagesForClient, updateSessionPackage, addPayment, sessions, toggleSessionPaid } = useTrainerStore.getState();
      const packages = getPackagesForClient(completedWorkoutData.clientId);
      const activePackage = packages.find(p => p.status === 'active');
      const pricePerSession = activePackage?.pricePerSession || 0;
      
      // Find the session record we just created
      const today = new Date().toISOString().split('T')[0];
      const sessionRecord = sessions.find(s => 
        s.clientId === completedWorkoutData.clientId && 
        s.date === today && 
        s.workoutId === completedWorkoutData.id
      );
      
      // Always increment package usedSessions when a PT workout completes
      if (activePackage) {
        updateSessionPackage(activePackage.id, {
          usedSessions: (activePackage.usedSessions || 0) + 1,
          ...(sessionPaid ? { paidSessions: (activePackage.paidSessions || 0) + 1 } : {}),
        });
      }
      
      // Increment totalSessions stored counter on client record (+1 per completed workout)
      const { clients, updateClient } = useTrainerStore.getState();
      const clientRecord = clients.find(c => c.clientId === completedWorkoutData.clientId);
      if (clientRecord) {
        updateClient(completedWorkoutData.clientId, { totalSessions: (clientRecord.totalSessions ?? 0) + 1 });
      }
      
      if (sessionPaid) {
        // Mark session as paid
        if (sessionRecord && !sessionRecord.paid) {
          toggleSessionPaid(sessionRecord.id);
        }
        // Add paid payment record
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
        // Increment totalPaid stored counter on client record
        const freshClient = useTrainerStore.getState().clients.find(c => c.clientId === completedWorkoutData.clientId);
        if (freshClient) {
          updateClient(completedWorkoutData.clientId, { totalPaid: (freshClient.totalPaid ?? 0) + 1 });
        }
      }
    }
    
    setShowSummary(false);
    setCompletedWorkoutData(null);
    setWorkoutNotes('');
    setSessionPaid(false);
    setShareToFeed(false);
    setAiFeedback(null);
    setAiFeedbackLoading(false);
    // Clear derive result so medals don't persist to next workout
    useWorkoutStore.setState({ lastDeriveResult: null });
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

  if (!activeWorkout && !completedWorkoutData) return null;

  const completedSets = activeWorkout?.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed).length, 
    0
  ) || 0;
  const totalSets = activeWorkout?.exercises.reduce(
    (sum, ex) => sum + ex.sets.length, 
    0
  ) || 0;

  // When workout is finished and summary is showing, render ONLY the summary screen
  if (!activeWorkout && completedWorkoutData) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Sticky header with Done button */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 pt-12 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">Workout Complete</h1>
            <Button onClick={handleCloseSummary} className="bg-sky-500 hover:bg-sky-600 h-9 px-5">
              Done
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
          <div className="max-w-sm mx-auto space-y-3">
            {/* Compact Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center flex-shrink-0">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{completedWorkoutData?.name}</p>
                {completedWorkoutData?.isPTSession && (
                  <Badge className="bg-blue-500/20 text-blue-400 text-[10px] h-5">
                    <Users className="w-3 h-3 mr-1" />
                    PT Session
                  </Badge>
                )}
              </div>
            </div>

            {/* Session Time */}
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Session Time</span>
                <button onClick={() => setEditingTimes(!editingTimes)} className="text-[11px] text-sky-500 hover:text-sky-600 flex items-center gap-1">
                  <Edit className="w-3 h-3" />
                  {editingTimes ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {editingTimes ? (
                <div className="flex items-center gap-2 justify-center mt-1">
                  <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm w-24 text-center" />
                  <span className="text-gray-400">→</span>
                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm w-24 text-center" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 text-sm mt-0.5">
                  <span className="text-gray-900 font-medium">{completedWorkoutData?.startTime ? new Date(completedWorkoutData.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-900 font-medium">{completedWorkoutData?.endTime ? new Date(completedWorkoutData.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}</span>
                </div>
              )}
            </div>

            {/* Compact Stats Row */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{formatTime(completedWorkoutData?.duration || 0)}</p>
                <p className="text-[10px] text-gray-500">Duration</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{Math.round(completedWorkoutData?.totalVolume || 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">kg Vol</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-purple-500">{completedWorkoutData?.exercises || 0}</p>
                <p className="text-[10px] text-gray-500">Exercises</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-cyan-500">{completedWorkoutData?.sets || 0}</p>
                <p className="text-[10px] text-gray-500">Sets</p>
              </div>
            </div>
            
            {/* New PRs */}
            {completedWorkoutData?.pbs && completedWorkoutData.pbs.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-amber-400 text-sm">{completedWorkoutData.pbs.length} New PR{completedWorkoutData.pbs.length > 1 ? 's' : ''}!</span>
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {completedWorkoutData.pbs.map((pb, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-amber-500/20 text-amber-300 text-[11px]">{pb}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Medals Earned — top 3 with expand */}
            {lastDeriveResult?.medalsAwarded && lastDeriveResult.medalsAwarded.length > 0 && (() => {
              const medals = lastDeriveResult.medalsAwarded;
              const showAll = (completedWorkoutData as any)?._showAllMedals;
              const visibleMedals = showAll ? medals : medals.slice(0, 3);
              return (
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-3">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-base">🏅</span>
                    <span className="font-semibold text-purple-400 text-sm">{medals.length} Medal{medals.length > 1 ? 's' : ''} Earned!</span>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {visibleMedals.map((medalId, idx) => {
                      const def = getMedalDefinition(medalId);
                      return <Badge key={idx} variant="secondary" className="bg-purple-500/20 text-purple-300 text-[11px]">{def?.icon || '🏅'} {def?.name || medalId}</Badge>;
                    })}
                  </div>
                  {medals.length > 3 && !showAll && (
                    <button
                      onClick={() => setCompletedWorkoutData((prev: any) => prev ? { ...prev, _showAllMedals: true } : prev)}
                      className="w-full text-center text-xs text-purple-400 hover:text-purple-300 mt-2"
                    >
                      Show all {medals.length} medals
                    </button>
                  )}
                  {showAll && medals.length > 3 && (
                    <button
                      onClick={() => setCompletedWorkoutData((prev: any) => prev ? { ...prev, _showAllMedals: false } : prev)}
                      className="w-full text-center text-xs text-purple-400 hover:text-purple-300 mt-2"
                    >
                      Show less
                    </button>
                  )}
                </div>
              );
            })()}

            {/* 🤖 AI Coach Feedback — Pro users only */}
            {(currentUser?.membershipTier === 'pro' || currentUser?.membershipTier === 'trainer') && completedWorkoutData && (
              <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🤖</span>
                  <span className="font-semibold text-indigo-400 text-sm">AI Coach</span>
                  <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[9px] h-4 ml-auto">PRO</Badge>
                </div>
                {aiFeedbackLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <p className="text-xs text-gray-500">Generating personalized feedback...</p>
                  </div>
                ) : aiFeedback ? (
                  <p className="text-xs text-gray-600 leading-relaxed">{aiFeedback}</p>
                ) : (
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {completedWorkoutData.totalVolume > 5000
                      ? `Solid session — ${Math.round(completedWorkoutData.totalVolume).toLocaleString()}kg total volume across ${completedWorkoutData.exercises} exercises. Keep pushing.`
                      : `${completedWorkoutData.exercises} exercises, ${completedWorkoutData.sets} sets completed. Every rep counts — keep showing up.`}
                  </p>
                )}
              </div>
            )}

            {/* Strength Rating — only show if a category improved by ≥10% */}
            {(() => {
              const currentRating = useMedalStore.getState().strengthRating;
              const prev = completedWorkoutData?.previousRating;
              if (!currentRating || !prev) return null;
              const tierColors: Record<string, string> = { untrained: 'text-gray-400', beginner: 'text-green-400', novice: 'text-blue-400', intermediate: 'text-purple-400', advanced: 'text-amber-400', elite: 'text-red-400' };
              
              // Check per-category improvements — only show if any category improved ≥10%
              const categories = ['chest', 'back', 'shoulders', 'legs'] as const;
              const improvedCategories = categories.filter(cat => {
                const currVal = currentRating.categories?.[cat]?.totalPoints;
                const prevVal = (prev.categories as any)?.[cat]?.score;
                if (!currVal || !prevVal || prevVal === 0) return false;
                const pctChange = ((currVal - prevVal) / prevVal) * 100;
                return pctChange >= 10;
              });
              
              if (improvedCategories.length === 0) return null;
              
              const overallDelta = Math.round((currentRating.overall - prev.overall) * 10) / 10;
              const tierChanged = currentRating.overallTier !== prev.overallTier;
              return (
                <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-sky-400" />
                      <span className="font-semibold text-sky-400 text-sm">Strength Rating</span>
                    </div>
                    <Badge variant="outline" className="border-sky-500/30 text-sky-300 text-[10px] h-5">
                      <Dumbbell className="w-3 h-3 mr-1" />
                      Free Weights Only
                    </Badge>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`text-2xl font-bold ${tierColors[currentRating.overallTier] || 'text-white'}`}>{Math.round(currentRating.overall)}</span>
                    {overallDelta > 0 && <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">+{overallDelta}</span>}
                  </div>
                  <p className={`text-xs font-medium text-center ${tierColors[currentRating.overallTier] || 'text-gray-400'}`}>
                    {currentRating.overallTier.charAt(0).toUpperCase() + currentRating.overallTier.slice(1)}
                    {tierChanged && <span className="text-emerald-400 ml-1">↑ from {prev.overallTier}</span>}
                  </p>
                  <div className="flex flex-wrap gap-1 justify-center mt-1.5">
                    {improvedCategories.map(cat => {
                      const currVal = currentRating.categories?.[cat]?.totalPoints || 0;
                      const prevVal = (prev.categories as any)?.[cat]?.score || 1;
                      const pct = Math.round((currVal - prevVal) / prevVal * 100);
                      return (
                        <Badge key={cat} variant="secondary" className="bg-emerald-500/20 text-emerald-300 text-[10px]">
                          {cat.charAt(0).toUpperCase() + cat.slice(1)} +{pct}%
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Session Paid — PT sessions */}
            {completedWorkoutData?.isPTSession && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={sessionPaid} onChange={(e) => setSessionPaid(e.target.checked)} className="w-5 h-5 rounded border-gray-300 bg-white text-sky-500 focus:ring-sky-500" />
                  <div className="text-left">
                    <span className="text-gray-900 font-medium text-sm">Session Paid</span>
                    <p className="text-[11px] text-gray-500">Check if client has paid for this session</p>
                  </div>
                </label>
              </div>
            )}

            {/* Share to Feed */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} className="w-5 h-5 rounded border-gray-300 bg-white text-sky-500 focus:ring-sky-500" />
                <div className="text-left">
                  <span className="text-gray-900 font-medium text-sm">Share to Feed</span>
                  <p className="text-[11px] text-gray-500">Post this workout to your activity feed</p>
                </div>
              </label>
            </div>

            {/* Workout Notes */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block text-left">
                {completedWorkoutData?.isPTSession ? 'Trainer notes (private)' : 'Notes (optional)'}
              </label>
              <textarea
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                placeholder={completedWorkoutData?.isPTSession ? "Session observations, form cues..." : "How did this workout feel?"}
                className={`w-full h-16 px-3 py-2 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 ${completedWorkoutData?.isPTSession ? 'border-amber-500/30 focus:ring-amber-500' : 'border-gray-200 focus:ring-sky-500'}`}
              />
            </div>
            
            {/* Bottom Done button */}
            <Button onClick={handleCloseSummary} className="w-full bg-sky-500 hover:bg-sky-600" size="lg">
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // At this point activeWorkout is guaranteed non-null (early returns above handle null cases)
  const workout = activeWorkout!;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-sky-500 to-sky-600 px-4 pt-12 pb-2">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/today')}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5 mr-1" />
            Minimize
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-white">{workout.name}</h1>
            {/* Client name for PT sessions */}
            {clientName && (
              <p className="text-white/90 text-sm font-medium">with {clientName}</p>
            )}
            {/* PT vs Solo Session Indicator */}
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1",
              workout.assignedBy 
                ? "bg-blue-500/30 text-blue-100" 
                : "bg-white/20 text-white/80"
            )}>
              {workout.assignedBy ? (
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
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowExitDialog(true)}
              className="text-red-200 hover:bg-red-500/20 h-7 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Discard
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-7 w-7 p-0">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-gray-200 shadow-lg">
                <DropdownMenuItem
                  className="text-sky-500 focus:text-sky-600"
                  onClick={() => {
                    setSaveWorkoutName(workout.name || '');
                    setShowSaveWorkoutDialog(true);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Save as Template
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-gray-700 focus:text-gray-900"
                  onClick={() => setShowRestSettings(true)}
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Rest Timer Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-gray-700 focus:text-gray-900"
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
              className="bg-white text-sky-600 hover:bg-gray-100 h-7 text-xs"
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
              size="sm"
              variant="ghost"
              onClick={() => setShowRestSettings(true)}
              className="text-white hover:bg-white/20 gap-1 px-2"
            >
              <Timer className="w-4 h-4" />
              <span className="text-xs font-mono">{autoRestEnabled ? `${defaultRestTime}s` : 'Off'}</span>
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
      <div className="sticky top-[168px] z-40 bg-slate-800 backdrop-blur border-b border-slate-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 mr-2">Add:</span>
          
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
            <span className="w-5 h-5 rounded-full bg-yellow-400 inline-flex items-center justify-center flex-shrink-0"><Flame className="w-3 h-3 text-white" /></span> <span className="hidden sm:inline">Warm-Up</span>
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
            <span className="w-5 h-5 rounded-full bg-blue-500 inline-flex items-center justify-center flex-shrink-0"><Dumbbell className="w-3 h-3 text-white" /></span> <span className="hidden sm:inline">Strength</span>
            {hasStrength && <Check className="w-3 h-3" />}
          </Button>
          
          {/* Circuit Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCircuitDialog(true)}
            className="h-8 px-3 gap-1.5 hover:bg-orange-500/10 text-orange-400/70 hover:text-orange-400"
          >
            <span className="w-5 h-5 rounded-full bg-orange-400 inline-flex items-center justify-center flex-shrink-0"><Zap className="w-3 h-3 text-white" /></span> <span className="hidden sm:inline">Circuit</span>
            <Plus className="w-3 h-3" />
          </Button>
          
          {/* Cardio Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCardioDialog(true)}
            className="h-8 px-3 gap-1.5 hover:bg-green-500/10 text-green-400/70 hover:text-green-400"
          >
            <span className="w-5 h-5 rounded-full bg-rose-400 inline-flex items-center justify-center flex-shrink-0"><Heart className="w-3 h-3 text-white" /></span> <span className="hidden sm:inline">Cardio</span>
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
            className="h-8 px-3 gap-1.5 hover:bg-slate-700 text-slate-400 ml-auto"
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
            const blockExercises = workout.exercises.filter(
              (e: any) => e.blockId === block.id
            );
            const colors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
              warmup: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', accent: 'yellow' },
              strength: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-400', accent: 'blue' },
              circuit: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-400', accent: 'orange' },
              cardio: { bg: 'bg-green-500/10', border: 'border-green-500/50', text: 'text-green-400', accent: 'green' },
            };
            // Default to strength style if block type is unrecognized
            const defaultStyle = { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-400', accent: 'blue' };
            const style = colors[block.type] || defaultStyle;
            
            return (
              <div key={block.id} className={cn("rounded-xl border-2", style.border, style.bg)}>
                {/* Block Header */}
                <div className={cn("flex items-center justify-between p-3 border-b", style.border)}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-5 h-5 rounded-full inline-flex items-center justify-center", block.type === 'warmup' ? 'bg-yellow-400' : block.type === 'circuit' ? 'bg-orange-400' : block.type === 'cardio' ? 'bg-rose-400' : 'bg-blue-500')}>
                      {block.type === 'warmup' && <Flame className="w-3 h-3 text-white" />}
                      {block.type === 'circuit' && <Zap className="w-3 h-3 text-white" />}
                      {block.type === 'cardio' && <Heart className="w-3 h-3 text-white" />}
                      {block.type === 'strength' && <Dumbbell className="w-3 h-3 text-white" />}
                    </span>
                    <div>
                      <h3 className={cn("font-semibold", style.text)}>{block.name}</h3>
                      <p className="text-xs text-gray-500">
                        {block.type === 'cardio' ? (
                          <>
                            {block.cardioMode === 'steady' && `${Math.floor((block.timerSeconds || 0) / 60)}:${((block.timerSeconds || 0) % 60).toString().padStart(2, '0')} elapsed`}
                            {block.cardioMode === 'intervals' && `Round ${block.currentIntervalRound || 1}/${block.intervalRounds || 1} • ${block.currentIntervalPhase?.toUpperCase()}`}
                            {block.cardioMode === 'distance' && `${((block.distanceCompleted || 0) / 1000).toFixed(2)}km / ${((block.targetDistance || 0) / 1000).toFixed(1)}km`}
                          </>
                        ) : (
                          <>
                            {blockExercises.length} exercise{blockExercises.length !== 1 ? 's' : ''}
                            {block.type === 'circuit' && ` • ${block.circuitStyle?.toUpperCase()}`}
                          </>
                        )}
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
                      <DropdownMenuContent align="end" className="bg-white border-gray-200 shadow-lg">
                        {block.type === 'circuit' && (
                          <DropdownMenuItem 
                            className="text-purple-500 focus:text-purple-600"
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
                    {block.type === 'circuit' && (() => {
                      const clientId = workout?.userId || '';
                      // Match by savedBlockId if available, otherwise find best performance by block name
                      const blockRef = (block as any).savedBlockId;
                      const bestPerf = blockRef 
                        ? getBestBlockPerformance(blockRef, clientId)
                        : useTrainerStore.getState().blockPerformances
                            .filter(p => p.clientId === clientId && p.blockName === block.name && p.completionTime)
                            .sort((a, b) => (a.completionTime || Infinity) - (b.completionTime || Infinity))[0];
                      const bestTime = bestPerf?.completionTime;
                      return (
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "text-2xl font-mono font-bold",
                          block.completed ? "text-green-400" : style.text
                        )}>
                          {formatTime(block.timerSeconds || 0)}
                        </div>
                        {bestTime && bestTime > 0 && (
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-gray-500 leading-tight">BEST</span>
                            <span className="text-xs font-mono text-amber-400">{formatTime(bestTime)}</span>
                          </div>
                        )}
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
                      );
                    })()}
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
                          className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                        >
                          <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1 flex items-center gap-1.5">
                            <p className="text-gray-900 font-medium text-sm">{workoutExercise.exercise?.name || 'Exercise'}</p>
                            <ExerciseHowTo exerciseId={workoutExercise.exerciseId} exerciseName={workoutExercise.exercise?.name} />
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
                              className="w-14 h-7 text-center text-sm bg-gray-50 border-gray-200"
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
                ) : block.type === 'cardio' ? (
                  // CARDIO LAYOUT - Timer with activity-specific controls
                  <div className="p-4 space-y-4">
                    {/* Large Timer Display */}
                    <div className="text-center">
                      <div className={cn(
                        "text-5xl font-mono font-bold mb-2",
                        block.timerRunning ? "text-green-400" : "text-white"
                      )}>
                        {formatTime(block.timerSeconds || 0)}
                      </div>
                      
                      {/* Mode-specific info */}
                      {block.cardioMode === 'intervals' && (
                        <div className="flex items-center justify-center gap-4 mb-4">
                          <Badge className={block.currentIntervalPhase === 'work' ? 'bg-green-500' : 'bg-yellow-500'}>
                            {block.currentIntervalPhase === 'work' ? '💪 WORK' : '😮‍💨 REST'}
                          </Badge>
                          <span className="text-gray-400">
                            Round {block.currentIntervalRound || 1} of {block.intervalRounds || 1}
                          </span>
                        </div>
                      )}
                      
                      {block.cardioMode === 'distance' && (
                        <div className="mb-4">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-2xl font-bold text-green-400">
                              {((block.distanceCompleted || 0) / 1000).toFixed(2)} km
                            </span>
                            <span className="text-gray-400">/ {((block.targetDistance || 0) / 1000).toFixed(1)} km</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(100, ((block.distanceCompleted || 0) / (block.targetDistance || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Control Buttons */}
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => resetCircuitTimer(block.id)}
                        className="border-gray-600"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </Button>
                      
                      <Button
                        size="lg"
                        onClick={() => toggleCircuitTimer(block.id)}
                        className={block.timerRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}
                      >
                        {block.timerRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                      </Button>
                      
                      {block.cardioMode === 'distance' && (
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => {
                            // Add a split/lap
                            setWorkoutBlocks(blocks => blocks.map(b => {
                              if (b.id !== block.id) return b;
                              const splits = b.splits || [];
                              const lastSplit = splits[splits.length - 1];
                              const distancePerSplit = (b.targetDistance || 5000) / 10; // 10 splits
                              return {
                                ...b,
                                distanceCompleted: (b.distanceCompleted || 0) + distancePerSplit,
                                splits: [...splits, { 
                                  distance: (b.distanceCompleted || 0) + distancePerSplit, 
                                  time: b.timerSeconds || 0 
                                }],
                              };
                            }));
                            toast.success('Split recorded!');
                          }}
                          className="border-green-500 text-green-400"
                        >
                          📍 Split
                        </Button>
                      )}
                      
                      <Button
                        size="lg"
                        onClick={() => {
                          setWorkoutBlocks(blocks => blocks.map(b => 
                            b.id === block.id ? { ...b, completed: true, timerRunning: false } : b
                          ));
                          toast.success(`${block.name} completed!`);
                        }}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        <Check className="w-5 h-5 mr-1" /> Done
                      </Button>
                    </div>
                    
                    {/* Splits Display for Distance Mode */}
                    {block.cardioMode === 'distance' && block.splits && block.splits.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <p className="text-xs text-gray-500 mb-2">Splits:</p>
                        <div className="grid grid-cols-5 gap-1">
                          {block.splits.map((split, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-1 text-center">
                              <p className="text-xs text-gray-400">{((split.distance) / 1000).toFixed(1)}km</p>
                              <p className="text-sm font-mono text-green-400">{formatTime(split.time)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Completed State */}
                    {block.completed && (
                      <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-center">
                        <p className="text-green-400 font-medium">
                          {block.name} Complete! 🎉
                        </p>
                        <p className="text-sm text-gray-400">
                          Total time: {formatTime(block.timerSeconds || 0)}
                        </p>
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
                        w.userId === workout.userId
                      );
                      const lastWorkout = clientWorkoutHistory.find((w: any) => 
                        w.exercises?.some((e: any) => e.exerciseId === workoutExercise.exerciseId)
                      );
                      const lastExerciseData = lastWorkout?.exercises?.find((e: any) => 
                        e.exerciseId === workoutExercise.exerciseId
                      );
                      const lastSets = lastExerciseData?.sets?.filter((s: any) => s.completed);
                      // Volume comparison
                      const lastVolume = lastSets?.reduce((sum: number, s: any) => sum + ((s.weight || 0) * (s.reps || 0)), 0) || 0;
                      const currentCompletedSets = (workoutExercise.sets || []).filter((s: any) => s.completed);
                      const currentVolume = currentCompletedSets.reduce((sum: number, s: any) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
                      
                      return (
                      <div key={workoutExercise.id} className="bg-white border-b border-gray-100">
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-gray-900">
                                  {isAssistedExercise(workoutExercise.exerciseId, workoutExercise.exercise?.name) 
                                    ? formatAssistedName(workoutExercise.exercise?.name || 'Exercise') 
                                    : (workoutExercise.exercise?.name || 'Exercise')}
                                </p>
                                <ExerciseHowTo exerciseId={workoutExercise.exerciseId} exerciseName={workoutExercise.exercise?.name} />
                                {isAssistedExercise(workoutExercise.exerciseId, workoutExercise.exercise?.name) && (
                                  <Badge className="bg-purple-500/20 text-purple-400 text-[9px] border-0 px-1.5 py-0">−KG</Badge>
                                )}
                                {workoutExercise.isUnilateral && (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] border-0 px-1.5 py-0">L/R</Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{workoutExercise.exercise?.primaryMuscles?.join(', ')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                {(workoutExercise.sets || []).filter((s: any) => s.completed).length}/{(workoutExercise.sets || []).length}
                              </Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedExerciseForNotes(workoutExercise);
                                  // Load persistent notes if workout notes are empty
                                  const persistentNotes = getExerciseNotes(workoutExercise.exerciseId);
                                  setExerciseNotesText(workoutExercise.notes || persistentNotes || '');
                                  setShowExerciseNotesDialog(true);
                                }}
                                className={cn(
                                  "h-8 w-8",
                                  workoutExercise.trainerNotes || workoutExercise.notes || getExerciseNotes(workoutExercise.exerciseId)
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
                                <DropdownMenuContent align="end" className="bg-white border-gray-200 shadow-lg">
                                  <DropdownMenuItem
                                    className={workoutExercise.isUnilateral ? "text-emerald-400 focus:text-emerald-300" : "text-gray-300 focus:text-gray-200"}
                                    onClick={() => updateExercise(workoutExercise.id, { isUnilateral: !workoutExercise.isUnilateral })}
                                  >
                                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                                    {workoutExercise.isUnilateral ? '✓ Alternating Sides' : 'Alternating Sides'}
                                  </DropdownMenuItem>
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
                              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                                <History className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-400">Last: {lastSets.slice(0, 3).map((s: any) => `${s.weight}×${s.reps}`).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Volume Comparison Bar */}
                        {lastVolume > 0 && (
                          <div className="px-4 py-1.5 bg-gray-50 flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">Last: {lastVolume.toLocaleString()}kg</span>
                            <span className={cn(
                              "font-medium",
                              currentVolume > lastVolume ? "text-green-400" : currentVolume < lastVolume ? "text-orange-400" : "text-gray-400"
                            )}>
                              Today: {currentVolume.toLocaleString()}kg
                              {currentVolume > 0 && lastVolume > 0 && (
                                <span className="ml-1">
                                  ({currentVolume >= lastVolume ? '+' : ''}{Math.round(((currentVolume - lastVolume) / lastVolume) * 100)}%)
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {/* Sets Header */}
                        <div className="grid grid-cols-12 gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-gray-50 text-[10px] sm:text-xs text-gray-500 font-medium">
                          <div className="col-span-1">SET</div>
                          {(workoutExercise.exercise?.category === 'stretching' || workoutExercise.exercise?.category === 'cardio' || (workoutExercise as any).blockType === 'cardio') ? (
                            <>
                              <div className="col-span-4 text-center">TIME (sec)</div>
                              <div className="col-span-5 text-center">TIMER</div>
                            </>
                          ) : (
                            <>
                              <div className="col-span-3">PREVIOUS</div>
                              <div className="col-span-3 text-center">{isAssistedExercise(workoutExercise.exerciseId, workoutExercise.exercise?.name) ? '−KG' : 'KG'}</div>
                              <div className="col-span-3 text-center">REPS</div>
                            </>
                          )}
                          <div className="col-span-2"></div>
                        </div>
                        {/* Sets */}
                        <div className="px-2 sm:px-4 pb-2 sm:pb-3 divide-y divide-gray-800/50">
                          {(workoutExercise.sets || []).map((set: any, idx: number) => {
                            const isAssisted = isAssistedExercise(workoutExercise.exerciseId, workoutExercise.exercise?.name);
                            const previousDisplay = (set.previousWeight != null && set.previousReps) 
                              ? `${isAssisted ? '−' : ''}${Math.abs(set.previousWeight)}kg × ${set.previousReps}` 
                              : '—';
                            const isTimedSet = set.isTimed || workoutExercise.exercise?.category === 'stretching' || workoutExercise.exercise?.category === 'cardio' || (workoutExercise as any).blockType === 'cardio';
                            const setTimer = activeSetTimers[set.id];
                            return (
                            <div key={set.id} className={cn("py-1.5 sm:py-2 space-y-1", set.completed && "bg-sky-500/10")}>
                              <div className="grid grid-cols-12 gap-1 sm:gap-2 items-center text-xs sm:text-sm">
                                {/* Set Number/Type */}
                                <div className="col-span-1">
                                  <button className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs",
                                    set.completed && "bg-sky-500 text-white",
                                    !set.completed && workoutExercise.isUnilateral && "bg-emerald-900 text-emerald-400",
                                    !set.completed && !workoutExercise.isUnilateral && "bg-gray-100 text-gray-500"
                                  )}>
                                    {set.completed ? <Check className="w-4 h-4" /> : workoutExercise.isUnilateral ? (idx % 2 === 0 ? 'L' : 'R') : idx + 1}
                                  </button>
                                </div>
                                
                                {isTimedSet ? (
                                  <>
                                    {/* Duration Input for timed sets */}
                                    <div className="col-span-4">
                                      <Input
                                        type="number"
                                        placeholder="30"
                                        value={set.duration || ''}
                                        onChange={(e) => updateSet(workoutExercise.id, set.id, { duration: parseInt(e.target.value) || 30 })}
                                        disabled={set.completed || setTimer?.isRunning}
                                        className={cn("h-9 text-center bg-gray-50 border-gray-200", set.completed && "opacity-50")}
                                      />
                                    </div>
                                    {/* Timer display and controls */}
                                    <div className="col-span-5 flex items-center justify-center gap-2">
                                      {setTimer?.isRunning || (setTimer && setTimer.remaining > 0) ? (
                                        <div className={cn(
                                          "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                                          setTimer.isRunning ? "bg-orange-500/20" : "bg-gray-100"
                                        )}>
                                          <span className={cn(
                                            "font-mono text-lg font-bold",
                                            setTimer.isRunning ? "text-orange-400" : "text-gray-400"
                                          )}>
                                            {Math.floor((setTimer?.remaining || 0) / 60)}:{((setTimer?.remaining || 0) % 60).toString().padStart(2, '0')}
                                          </span>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleToggleSetTimer(set.id, set.duration || 30, workoutExercise.id)}
                                            className="h-7 w-7"
                                          >
                                            {setTimer.isRunning ? <Pause className="w-4 h-4 text-orange-400" /> : <Play className="w-4 h-4 text-gray-400" />}
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleToggleSetTimer(set.id, set.duration || 30, workoutExercise.id)}
                                          disabled={set.completed}
                                          className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                                        >
                                          <Play className="w-4 h-4 mr-1" />
                                          Start
                                        </Button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {/* Previous */}
                                    <div className="col-span-3">
                                      <span className="text-xs text-gray-500">{previousDisplay}</span>
                                    </div>
                                    {/* Weight Input */}
                                    <div className="col-span-3">
                                      <Input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        step="0.5"
                                        value={set.weight != null && set.weight !== undefined ? set.weight : ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === '' || val === undefined) {
                                            updateSet(workoutExercise.id, set.id, { weight: undefined });
                                          } else {
                                            updateSet(workoutExercise.id, set.id, { weight: parseFloat(val) });
                                          }
                                        }}
                                        disabled={set.completed}
                                        className={cn("h-8 sm:h-9 text-center text-xs sm:text-sm bg-gray-50 border-gray-200 px-1", set.completed && "opacity-50")}
                                      />
                                    </div>
                                    {/* Reps Input */}
                                    <div className="col-span-3">
                                      <Input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        value={set.reps != null && set.reps !== undefined ? set.reps : ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === '' || val === undefined) {
                                            updateSet(workoutExercise.id, set.id, { reps: undefined });
                                          } else {
                                            updateSet(workoutExercise.id, set.id, { reps: parseInt(val) });
                                          }
                                        }}
                                        disabled={set.completed}
                                        className={cn("h-8 sm:h-9 text-center text-xs sm:text-sm bg-gray-50 border-gray-200 px-1", set.completed && "opacity-50")}
                                      />
                                    </div>
                                  </>
                                )}
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
                                      onClick={() => isTimedSet 
                                        ? handleCompleteTimedSet(workoutExercise.id, set.id, workoutExercise.exercise?.name || 'Exercise')
                                        : handleCompleteSet(workoutExercise.id, set.id, set.weight ?? 0, set.reps || 0, workoutExercise.exercise?.name || 'Exercise')
                                      }
                                      disabled={isTimedSet ? !set.duration : (set.weight == null || !set.reps)}
                                      className="h-9 w-9 text-sky-400 hover:text-sky-300 hover:bg-sky-500/20 disabled:opacity-30"
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
                                      <DropdownMenuContent align="end" className="bg-white border-gray-200 shadow-lg">
                                        <DropdownMenuItem 
                                          className="text-orange-500 focus:text-orange-600"
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
                              {/* Per-set volume display */}
                              {set.completed && set.weight && set.reps && !isTimedSet && (
                                <div className="flex items-center gap-2 ml-10 mt-0.5">
                                  <span className="text-[10px] text-gray-500">
                                    vol: {(set.weight * set.reps).toFixed(0)}kg
                                  </span>
                                </div>
                              )}
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
                                    disabled={drop.completed}
                                    className={cn("w-16 h-8 text-center bg-gray-50 border-gray-200 text-sm", drop.completed && "opacity-50")}
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
                                    disabled={drop.completed}
                                    className={cn("w-16 h-8 text-center bg-gray-50 border-gray-200 text-sm", drop.completed && "opacity-50")}
                                  />
                                  {/* Drop set complete/undo button */}
                                  {!drop.completed ? (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        const newDrops = [...(set.drops || [])];
                                        newDrops[dropIdx] = { ...drop, completed: true };
                                        updateSet(workoutExercise.id, set.id, { drops: newDrops });
                                      }}
                                      disabled={!drop.weight || !drop.reps}
                                      className="h-7 w-7 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 disabled:opacity-30"
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        const newDrops = [...(set.drops || [])];
                                        newDrops[dropIdx] = { ...drop, completed: false };
                                        updateSet(workoutExercise.id, set.id, { drops: newDrops });
                                      }}
                                      className="h-7 w-7 text-green-400"
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                  )}
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
          {workout.exercises.filter((e: any) => !e.blockId).map((workoutExercise, index) => {
            const pb = getPBForExercise(workoutExercise.exerciseId);
            
            // Check if this exercise is in a superset
            const isInSuperset = !!workoutExercise.groupId;
            const supersetPartners = isInSuperset 
              ? workout.exercises.filter(e => e.groupId === workoutExercise.groupId && e.id !== workoutExercise.id)
              : [];
            const isPairingTarget = supersetPairingId && supersetPairingId !== workoutExercise.id;
            
            // Check if we need to show a block header
            const currentBlockName = (workoutExercise as any).blockName;
            const prevExercise = index > 0 ? workout.exercises[index - 1] : null;
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
                          {blockType === 'warmup' && <span className="w-4 h-4 rounded-full bg-yellow-400 inline-flex items-center justify-center"><Flame className="w-2.5 h-2.5 text-white" /></span>}
                          {blockType === 'work' && <span className="w-4 h-4 rounded-full bg-blue-500 inline-flex items-center justify-center"><Dumbbell className="w-2.5 h-2.5 text-white" /></span>}
                          {blockType === 'circuit' && <span className="w-4 h-4 rounded-full bg-orange-400 inline-flex items-center justify-center"><Zap className="w-2.5 h-2.5 text-white" /></span>}
                          {blockType === 'cooldown' && <span className="w-4 h-4 rounded-full bg-teal-400 inline-flex items-center justify-center"><RotateCcw className="w-2.5 h-2.5 text-white" /></span>}
                          {blockType === 'cardio' && <span className="w-4 h-4 rounded-full bg-rose-400 inline-flex items-center justify-center"><Heart className="w-2.5 h-2.5 text-white" /></span>}
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
                    "bg-white border-gray-200 shadow-sm overflow-hidden transition-all",
                    supersetPairingId === workoutExercise.id && "ring-2 ring-blue-500",
                    isPairingTarget && "cursor-pointer hover:ring-2 hover:ring-sky-500",
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
                        <h3 className="font-semibold text-white">
                          {isAssistedExercise(workoutExercise.exerciseId, workoutExercise.exercise?.name)
                            ? formatAssistedName(workoutExercise.exercise?.name || 'Exercise')
                            : (workoutExercise.exercise?.name || 'Exercise')}
                        </h3>
                        <ExerciseHowTo exerciseId={workoutExercise.exerciseId} exerciseName={workoutExercise.exercise?.name} />
                        {isAssistedExercise(workoutExercise.exerciseId, workoutExercise.exercise?.name) && (
                          <Badge className="bg-purple-500/20 text-purple-400 text-[9px] border-0 px-1.5 py-0">−KG</Badge>
                        )}
                        {workoutExercise.isUnilateral && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] border-0 px-1.5 py-0">L/R</Badge>
                        )}
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
                      <DropdownMenuContent align="end" className="bg-white border-gray-200 shadow-lg">
                        <DropdownMenuItem
                          className={workoutExercise.isUnilateral ? "text-emerald-500 focus:text-emerald-600" : "text-gray-600 focus:text-gray-800"}
                          onClick={() => updateExercise(workoutExercise.id, { isUnilateral: !workoutExercise.isUnilateral })}
                        >
                          <ArrowLeftRight className="w-4 h-4 mr-2" />
                          {workoutExercise.isUnilateral ? '✓ Alternating Sides' : 'Alternating Sides'}
                        </DropdownMenuItem>
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
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
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
                    className="w-full rounded-none border-t border-gray-800 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
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
        <DialogContent className="bg-white border-gray-200 max-w-lg max-h-[85vh]">
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
                  <span className={cn("w-6 h-6 rounded-full inline-flex items-center justify-center", block.type === 'warmup' ? 'bg-yellow-400' : block.type === 'circuit' ? 'bg-orange-400' : 'bg-blue-500')}>
                    {block.type === 'warmup' && <Flame className="w-3.5 h-3.5 text-white" />}
                    {block.type === 'circuit' && <Zap className="w-3.5 h-3.5 text-white" />}
                    {block.type === 'strength' && <Dumbbell className="w-3.5 h-3.5 text-white" />}
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
                {block.type === 'warmup' && 'Showing: Bands, stretches, bodyweight, mobility exercises'}
                {block.type === 'strength' && 'Showing: Barbell, dumbbell, cable, machine exercises'}
                {block.type === 'circuit' && 'Showing: All exercises - tap to select multiple, then save'}
              </div>
            );
          })()}
          
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search exercises..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
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
                      !block && "hover:bg-gray-50",
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
                    {getExerciseAnimationUrl(exercise.id) && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 mr-2">
                        <img
                          src={getExerciseAnimationUrl(exercise.id)}
                          alt={exercise.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
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
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-400 inline-flex items-center justify-center"><Zap className="w-3 h-3 text-white" /></span> Add Circuit Block
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
                    className="bg-gray-50 border-gray-200"
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
                    className="bg-gray-50 border-gray-200"
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

      {/* Cardio Config Dialog */}
      <Dialog open={showCardioDialog} onOpenChange={setShowCardioDialog}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-400 inline-flex items-center justify-center"><Heart className="w-3 h-3 text-white" /></span> Add Cardio Block
            </DialogTitle>
            <DialogDescription>Track your run, swim, bike, or row</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Activity Type</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'run', label: 'Run', icon: '🏃' },
                  { id: 'swim', label: 'Swim', icon: '🏊' },
                  { id: 'bike', label: 'Bike', icon: '🚴' },
                  { id: 'row', label: 'Row', icon: '🚣' },
                  { id: 'other', label: 'Other', icon: '💪' },
                ].map((type) => (
                  <Button
                    key={type.id}
                    type="button"
                    variant={cardioConfig.type === type.id ? 'default' : 'outline'}
                    className={cn(
                      "h-auto py-2 flex-col items-center",
                      cardioConfig.type === type.id 
                        ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' 
                        : 'border-gray-700 hover:bg-green-500/10 hover:border-green-500/50'
                    )}
                    onClick={() => setCardioConfig({ ...cardioConfig, type: type.id as any })}
                  >
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-xs mt-1">{type.label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'steady', label: 'Steady', desc: 'Timed cardio', icon: '⏱️' },
                  { id: 'intervals', label: 'Intervals', desc: 'Work/Rest cycles', icon: '🔄' },
                  { id: 'distance', label: 'Distance', desc: 'Target distance', icon: '📏' },
                ].map((mode) => (
                  <Button
                    key={mode.id}
                    type="button"
                    variant={cardioConfig.mode === mode.id ? 'default' : 'outline'}
                    className={cn(
                      "h-auto py-3 flex-col items-start",
                      cardioConfig.mode === mode.id 
                        ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' 
                        : 'border-gray-700 hover:bg-green-500/10 hover:border-green-500/50'
                    )}
                    onClick={() => setCardioConfig({ ...cardioConfig, mode: mode.id as any })}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span>{mode.icon}</span>
                      <span className="font-semibold">{mode.label}</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">{mode.desc}</p>
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              {cardioConfig.mode === 'steady' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={Math.floor(cardioConfig.duration / 60)}
                    onChange={(e) => setCardioConfig({ ...cardioConfig, duration: (parseInt(e.target.value) || 1) * 60 })}
                    className="bg-gray-50 border-gray-200"
                    min={1}
                  />
                </div>
              )}
              
              {cardioConfig.mode === 'distance' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Target Distance ({cardioConfig.type === 'swim' ? 'meters' : 'km'})
                  </label>
                  <Input
                    type="number"
                    value={cardioConfig.type === 'swim' ? cardioConfig.distance : cardioConfig.distance / 1000}
                    onChange={(e) => setCardioConfig({ 
                      ...cardioConfig, 
                      distance: cardioConfig.type === 'swim' 
                        ? parseInt(e.target.value) || 100 
                        : (parseFloat(e.target.value) || 1) * 1000 
                    })}
                    className="bg-gray-50 border-gray-200"
                    min={cardioConfig.type === 'swim' ? 25 : 0.1}
                    step={cardioConfig.type === 'swim' ? 25 : 0.5}
                  />
                </div>
              )}
              
              {cardioConfig.mode === 'intervals' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Work (sec)</label>
                      <Input
                        type="number"
                        value={cardioConfig.intervalWork}
                        onChange={(e) => setCardioConfig({ ...cardioConfig, intervalWork: parseInt(e.target.value) || 30 })}
                        className="bg-gray-50 border-gray-200"
                        min={10}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Rest (sec)</label>
                      <Input
                        type="number"
                        value={cardioConfig.intervalRest}
                        onChange={(e) => setCardioConfig({ ...cardioConfig, intervalRest: parseInt(e.target.value) || 15 })}
                        className="bg-gray-50 border-gray-200"
                        min={5}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Rounds</label>
                      <Input
                        type="number"
                        value={cardioConfig.intervalRounds}
                        onChange={(e) => setCardioConfig({ ...cardioConfig, intervalRounds: parseInt(e.target.value) || 1 })}
                        className="bg-gray-50 border-gray-200"
                        min={1}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Total: {Math.floor((cardioConfig.intervalWork + cardioConfig.intervalRest) * cardioConfig.intervalRounds / 60)}:{((cardioConfig.intervalWork + cardioConfig.intervalRest) * cardioConfig.intervalRounds % 60).toString().padStart(2, '0')} min
                  </p>
                </>
              )}
            </div>
            
            <Button 
              onClick={() => addBlock('cardio')}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start {cardioConfig.type.charAt(0).toUpperCase() + cardioConfig.type.slice(1)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finish Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Finish Workout?</DialogTitle>
            <DialogDescription>
              You&apos;ve completed {completedSets} of {totalSets} sets.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span className="text-gray-900 font-medium">{formatTime(workoutTimer.seconds)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Exercises</span>
              <span className="text-gray-900 font-medium">{workout.exercises.length}</span>
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
              className="flex-1 border-gray-200"
            >
              Keep Going
            </Button>
            <Button
              onClick={handleFinishWorkout}
              className="flex-1 bg-sky-500 hover:bg-sky-600"
            >
              Finish Workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Discard Workout?</DialogTitle>
            <DialogDescription>
              This will cancel your current workout and all progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowExitDialog(false)}
              className="flex-1 border-gray-200"
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

      {/* Workout Summary Dialog — compact version */}
      <Dialog open={showSummary} onOpenChange={(open) => !open && handleCloseSummary()}>
        <DialogContent className="bg-white border-gray-200 max-w-sm max-h-[85vh] overflow-y-auto">
          <div className="space-y-3 py-2">
            {/* Compact header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">Workout Complete!</h2>
                <p className="text-sm text-gray-500">{completedWorkoutData?.name}</p>
              </div>
              {completedWorkoutData?.isPTSession && (
                <Badge className="bg-blue-500/20 text-blue-400 text-[10px] h-5">
                  <Users className="w-3 h-3 mr-1" /> PT
                </Badge>
              )}
            </div>

            {/* Session Time */}
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Session Time</span>
                <button onClick={() => setEditingTimes(!editingTimes)} className="text-[11px] text-sky-500 hover:text-sky-600 flex items-center gap-1">
                  <Edit className="w-3 h-3" /> {editingTimes ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {editingTimes ? (
                <div className="flex items-center gap-2 justify-center mt-1">
                  <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm w-24 text-center" />
                  <span className="text-gray-400">→</span>
                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm w-24 text-center" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 text-sm mt-0.5">
                  <span className="text-gray-900 font-medium">{completedWorkoutData?.startTime ? new Date(completedWorkoutData.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-900 font-medium">{completedWorkoutData?.endTime ? new Date(completedWorkoutData.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}</span>
                </div>
              )}
            </div>

            {/* Compact Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{formatTime(completedWorkoutData?.duration || 0)}</p>
                <p className="text-[10px] text-gray-500">Duration</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{Math.round(completedWorkoutData?.totalVolume || 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">kg Vol</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-purple-500">{completedWorkoutData?.exercises || 0}</p>
                <p className="text-[10px] text-gray-500">Exercises</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-cyan-500">{completedWorkoutData?.sets || 0}</p>
                <p className="text-[10px] text-gray-500">Sets</p>
              </div>
            </div>
            
            {/* PRs */}
            {completedWorkoutData?.pbs && completedWorkoutData.pbs.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-amber-400 text-sm">{completedWorkoutData.pbs.length} New PR{completedWorkoutData.pbs.length > 1 ? 's' : ''}!</span>
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {completedWorkoutData.pbs.map((pb, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-amber-500/20 text-amber-300 text-[11px]">{pb}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Medals — top 3 with expand */}
            {lastDeriveResult?.medalsAwarded && lastDeriveResult.medalsAwarded.length > 0 && (() => {
              const medals = lastDeriveResult.medalsAwarded;
              const showAll = (completedWorkoutData as any)?._showAllMedals;
              const visibleMedals = showAll ? medals : medals.slice(0, 3);
              return (
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-3">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-base">🏅</span>
                    <span className="font-semibold text-purple-400 text-sm">{medals.length} Medal{medals.length > 1 ? 's' : ''} Earned!</span>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {visibleMedals.map((medalId, idx) => {
                      const def = getMedalDefinition(medalId);
                      return <Badge key={idx} variant="secondary" className="bg-purple-500/20 text-purple-300 text-[11px]">{def?.icon || '🏅'} {def?.name || medalId}</Badge>;
                    })}
                  </div>
                  {medals.length > 3 && !showAll && (
                    <button
                      onClick={() => setCompletedWorkoutData((prev: any) => prev ? { ...prev, _showAllMedals: true } : prev)}
                      className="w-full text-center text-xs text-purple-400 hover:text-purple-300 mt-2"
                    >
                      Show all {medals.length} medals
                    </button>
                  )}
                  {showAll && medals.length > 3 && (
                    <button
                      onClick={() => setCompletedWorkoutData((prev: any) => prev ? { ...prev, _showAllMedals: false } : prev)}
                      className="w-full text-center text-xs text-purple-400 hover:text-purple-300 mt-2"
                    >
                      Show less
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Strength Rating — only show if a category improved by ≥10% */}
            {(() => {
              const currentRating = useMedalStore.getState().strengthRating;
              const prev = completedWorkoutData?.previousRating;
              if (!currentRating || !prev) return null;
              const tierColors: Record<string, string> = { untrained: 'text-gray-400', beginner: 'text-green-400', novice: 'text-blue-400', intermediate: 'text-purple-400', advanced: 'text-amber-400', elite: 'text-red-400' };
              const categories = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'] as const;
              const improvedCategories = categories.filter(cat => {
                const currVal = (currentRating as any)[cat];
                const prevVal = (prev as any)[cat];
                if (!currVal || !prevVal || prevVal === 0) return false;
                return ((currVal - prevVal) / prevVal) * 100 >= 10;
              });
              if (improvedCategories.length === 0) return null;
              const overallDelta = Math.round((currentRating.overall - prev.overall) * 10) / 10;
              const tierChanged = currentRating.overallTier !== prev.overallTier;
              return (
                <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-sky-400" />
                      <span className="font-semibold text-sky-400 text-sm">Strength Rating</span>
                    </div>
                    <Badge variant="outline" className="border-sky-500/30 text-sky-300 text-[10px] h-5">
                      <Dumbbell className="w-3 h-3 mr-1" />
                      Free Weights Only
                    </Badge>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`text-2xl font-bold ${tierColors[currentRating.overallTier] || 'text-white'}`}>{Math.round(currentRating.overall)}</span>
                    {overallDelta > 0 && <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">+{overallDelta}</span>}
                  </div>
                  <p className={`text-xs font-medium text-center ${tierColors[currentRating.overallTier] || 'text-gray-400'}`}>
                    {currentRating.overallTier.charAt(0).toUpperCase() + currentRating.overallTier.slice(1)}
                    {tierChanged && <span className="text-emerald-400 ml-1">↑ from {prev.overallTier}</span>}
                  </p>
                  <div className="flex flex-wrap gap-1 justify-center mt-1.5">
                    {improvedCategories.map(cat => {
                      const pct = Math.round(((currentRating as any)[cat] - (prev as any)[cat]) / (prev as any)[cat] * 100);
                      return (
                        <Badge key={cat} variant="secondary" className="bg-emerald-500/20 text-emerald-300 text-[10px]">
                          {cat.charAt(0).toUpperCase() + cat.slice(1)} +{pct}%
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Session Paid */}
            {completedWorkoutData?.isPTSession && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={sessionPaid} onChange={(e) => setSessionPaid(e.target.checked)} className="w-5 h-5 rounded border-gray-300 bg-white text-sky-500 focus:ring-sky-500" />
                  <div className="text-left">
                    <span className="text-gray-900 font-medium text-sm">Session Paid</span>
                    <p className="text-[11px] text-gray-500">Check if client has paid for this session</p>
                  </div>
                </label>
              </div>
            )}

            {/* Share to Feed */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} className="w-5 h-5 rounded border-gray-300 bg-white text-sky-500 focus:ring-sky-500" />
                <div className="text-left">
                  <span className="text-gray-900 font-medium text-sm">Share to Feed</span>
                  <p className="text-[11px] text-gray-500">Post this workout to your activity feed</p>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block text-left">
                {completedWorkoutData?.isPTSession ? 'Trainer notes (private)' : 'Notes (optional)'}
              </label>
              <textarea
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                placeholder={completedWorkoutData?.isPTSession ? "Session observations, form cues..." : "How did this workout feel?"}
                className={`w-full h-16 px-3 py-2 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 ${completedWorkoutData?.isPTSession ? 'border-amber-500/30 focus:ring-amber-500' : 'border-gray-200 focus:ring-sky-500'}`}
              />
            </div>
            
            <Button onClick={handleCloseSummary} className="w-full bg-sky-500 hover:bg-sky-600" size="lg">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rest Timer Settings Dialog */}
      <Dialog open={showRestSettings} onOpenChange={setShowRestSettings}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Workout Settings</DialogTitle>
            <DialogDescription>
              Configure your rest timer between sets
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Auto Rest Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Auto Rest Timer</p>
                <p className="text-xs text-gray-500">Start timer automatically after completing a set</p>
              </div>
              <button
                onClick={() => setAutoRestEnabled(!autoRestEnabled)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  autoRestEnabled ? "bg-sky-500" : "bg-gray-600"
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
                <span className="text-sm text-gray-500">Default Rest Time</span>
                <span className="text-lg font-semibold text-gray-900">{defaultRestTime}s</span>
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
                  className={defaultRestTime === time ? "bg-sky-500" : "border-gray-200"}
                >
                  {time}s
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => setShowRestSettings(false)}
            className="w-full bg-sky-500 hover:bg-sky-600"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>

      {/* Workout Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <StickyNote className={`w-5 h-5 ${isPT ? 'text-amber-400' : 'text-sky-400'}`} />
              {isPT ? 'Trainer Notes' : 'Workout Notes'}
            </DialogTitle>
            <DialogDescription>
              {isPT 
                ? 'Private notes — client won\'t see these. Session observations, form cues, etc.' 
                : 'Add notes during your workout - they\'ll be saved with this session'}
            </DialogDescription>
          </DialogHeader>
          
          <textarea
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            placeholder={isPT 
              ? "Session observations, form cues, programming adjustments..." 
              : "How's the workout going? Track energy levels, form notes, things to remember..."}
            className={`w-full h-32 px-3 py-2 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 ${
              isPT ? 'border-amber-500/30 focus:ring-amber-500' : 'border-gray-200 focus:ring-sky-500'
            }`}
          />
          
          <Button
            onClick={() => setShowNotesDialog(false)}
            className="w-full bg-sky-500 hover:bg-sky-600"
          >
            Save Notes
          </Button>
        </DialogContent>
      </Dialog>

      {/* Exercise Notes Dialog */}
      <Dialog 
        open={showExerciseNotesDialog} 
        onOpenChange={(open) => {
          if (!open && selectedExerciseForNotes) {
            // Save notes when closing - to both workout and persistent store
            updateExercise(selectedExerciseForNotes.id, { notes: exerciseNotesText });
            setExerciseNotes(selectedExerciseForNotes.exerciseId, exerciseNotesText);
          }
          setShowExerciseNotesDialog(open);
          if (!open) {
            setSelectedExerciseForNotes(null);
            setExerciseNotesText('');
          }
        }}
      >
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-amber-400" />
              {selectedExerciseForNotes?.exercise?.name || 'Exercise'} Notes
            </DialogTitle>
            <DialogDescription>
              View or add notes for this exercise (e.g., incline settings, form cues)
            </DialogDescription>
          </DialogHeader>
          
          {/* Display existing trainer notes if any */}
          {selectedExerciseForNotes?.trainerNotes && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-500 font-medium mb-1">Trainer Notes:</p>
              <p className="text-sm text-gray-900">{selectedExerciseForNotes.trainerNotes}</p>
            </div>
          )}
          
          <textarea
            value={exerciseNotesText}
            onChange={(e) => setExerciseNotesText(e.target.value)}
            placeholder="Add your notes for this exercise..."
            className="w-full h-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          
          <Button
            onClick={() => {
              if (selectedExerciseForNotes) {
                // Save to current workout exercise
                updateExercise(selectedExerciseForNotes.id, { notes: exerciseNotesText });
                // Also save to persistent store so notes appear next time
                setExerciseNotes(selectedExerciseForNotes.exerciseId, exerciseNotesText);
              }
              setShowExerciseNotesDialog(false);
              setSelectedExerciseForNotes(null);
              setExerciseNotesText('');
            }}
            className="w-full bg-amber-500 hover:bg-amber-600"
          >
            Save Notes
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
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-500" />
              Create Superset
            </DialogTitle>
            <DialogDescription>
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
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors"
                  >
                    <p className="font-medium text-gray-900">{ex.exercise?.name}</p>
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
            className="w-full border-gray-200 text-gray-500"
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>

      {/* Save Workout Dialog */}
      <Dialog open={showSaveWorkoutDialog} onOpenChange={setShowSaveWorkoutDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Copy className="w-5 h-5 text-sky-500" />
              Save Workout as Template
            </DialogTitle>
            <DialogDescription>
              Save this workout to your library for future use
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Workout Name</label>
              <Input
                value={saveWorkoutName}
                onChange={(e) => setSaveWorkoutName(e.target.value)}
                placeholder="e.g., Upper Body Push"
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Description (optional)</label>
              <textarea
                value={saveWorkoutDescription}
                onChange={(e) => setSaveWorkoutDescription(e.target.value)}
                placeholder="Brief description of this workout..."
                className="w-full h-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveWorkoutDialog(false)}
              className="flex-1 border-gray-200 text-gray-500"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveWorkout}
              disabled={!saveWorkoutName.trim()}
              className="flex-1 bg-sky-500 hover:bg-sky-600"
            >
              Save to Library
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Circuit Dialog */}
      <Dialog open={showSaveCircuitDialog} onOpenChange={setShowSaveCircuitDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-500" />
              Save Circuit as Template
            </DialogTitle>
            <DialogDescription>
              Save this circuit to your library for future use
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Circuit Name</label>
              <Input
                value={saveCircuitName}
                onChange={(e) => setSaveCircuitName(e.target.value)}
                placeholder="e.g., HIIT Finisher"
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Description (optional)</label>
              <textarea
                value={saveCircuitDescription}
                onChange={(e) => setSaveCircuitDescription(e.target.value)}
                placeholder="Brief description of this circuit..."
                className="w-full h-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="flex-1 border-gray-200 text-gray-500"
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
  const [weight, setWeight] = useState(set.weight != null ? set.weight.toString() : '');
  const [reps, setReps] = useState(set.reps != null ? set.reps.toString() : '');

  const handleComplete = () => {
    const w = weight === '' ? 0 : parseFloat(weight);
    const r = parseInt(reps) || 0;
    // Allow 0 weight for bodyweight exercises (push-ups, dips, etc.)
    if (!isNaN(w) && r > 0) {
      onUpdate({ weight: w, reps: r });
      onComplete(w, r);
    }
  };

  const previousDisplay = (set.previousWeight != null && set.previousReps)
    ? `${set.previousWeight}kg × ${set.previousReps}`
    : '—';

  return (
    <>
      <div className={cn(
        "grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors",
        set.completed && "bg-sky-500/10"
      )}>
        <div className="col-span-2">
          <span className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            set.completed 
              ? "bg-sky-500 text-white" 
              : "bg-gray-100 text-gray-500"
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
                  : "text-gray-500 hover:text-gray-400 hover:bg-gray-100"
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
              onBlur={() => {
                const v = parseFloat(weight);
                onUpdate({ weight: !isNaN(v) ? v : undefined });
              }}
              disabled={set.completed}
              className={cn(
                "h-9 text-center bg-white border-gray-200 text-gray-900 flex-1",
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
            onBlur={() => {
              const v = parseInt(reps);
              onUpdate({ reps: !isNaN(v) && v > 0 ? v : undefined });
            }}
            disabled={set.completed}
            className={cn(
              "h-9 text-center bg-white border-gray-200 text-gray-900",
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
              disabled={!reps || (weight === '' && reps === '')}
              className="h-9 w-9 text-sky-400 hover:text-sky-300 hover:bg-sky-500/20 disabled:opacity-30"
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
              <DropdownMenuContent align="end" className="bg-gray-50 border-gray-200">
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
                  value={drop.weight || ''}
                  onChange={(e) => {
                    const newDrops = [...(set.drops || [])];
                    newDrops[idx] = { ...drop, weight: parseFloat(e.target.value) || 0 };
                    onUpdate({ drops: newDrops });
                  }}
                  className="h-8 text-center bg-white border-gray-200 text-gray-900 text-sm"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={drop.reps || ''}
                  onChange={(e) => {
                    const newDrops = [...(set.drops || [])];
                    newDrops[idx] = { ...drop, reps: parseInt(e.target.value) || 0 };
                    onUpdate({ drops: newDrops });
                  }}
                  className="h-8 text-center bg-white border-gray-200 text-gray-900 text-sm"
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
