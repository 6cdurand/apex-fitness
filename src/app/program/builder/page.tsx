'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, useTrainerStore, useSocialStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Flame,
  Dumbbell,
  RotateCcw,
  Search,
  X,
  Target,
  Heart,
  Loader2,
  Calendar,
  ChevronRight,
  Copy,
  GripVertical,
  Zap,
  Check,
  RefreshCw,
  Edit,
  Eye,
  ArrowLeftRight,
  Clock,
} from 'lucide-react';
import { BlockType, MovementPattern, ClientProgram, ClientWorkoutDay, ClientWorkoutBlock, ClientProgramExercise, TrainingGoal, TrainingPhase, CalendarEvent } from '@/types';
import { exerciseLibrary, filterExercisesBySearch, getExerciseUsageCounts, exerciseLibraryMap } from '@/lib/exercises';
import { TEMPO_PRESETS, REST_PRESETS } from '@/lib/workoutEstimator';
import { useWorkoutStore } from '@/lib/store';
import { getSwapSuggestions, getDirectSwaps } from '@/lib/exerciseRelations';
import { getClientDisplayInfo } from '@/lib/clientUtils';

// ── Constants ──────────────────────────────────────────────
const TRAINING_PHASES = [
  { id: 'none', name: 'No Phase', sets: 3, reps: '8-12', rest: '60s' },
  { id: 'strength', name: 'Strength', sets: 5, reps: '3-5', rest: '180s' },
  { id: 'hypertrophy', name: 'Hypertrophy', sets: 4, reps: '8-12', rest: '90s' },
  { id: 'power', name: 'Power', sets: 5, reps: '1-3', rest: '180s' },
  { id: 'endurance', name: 'Endurance', sets: 3, reps: '15-20', rest: '45s' },
  { id: 'deload', name: 'Deload', sets: 2, reps: '10-12', rest: '60s' },
];

const BLOCK_TYPES: { value: BlockType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'warmup', label: 'Warm-up', icon: <Flame className="h-4 w-4 text-yellow-500" />, color: 'yellow' },
  { value: 'work', label: 'Strength', icon: <Dumbbell className="h-4 w-4 text-blue-400" />, color: 'blue' },
  { value: 'circuit', label: 'Circuit', icon: <Target className="h-4 w-4 text-orange-400" />, color: 'orange' },
  { value: 'cardio', label: 'Cardio', icon: <Heart className="h-4 w-4 text-green-500" />, color: 'green' },
  { value: 'cooldown', label: 'Cool-down', icon: <RotateCcw className="h-4 w-4 text-purple-500" />, color: 'purple' },
];

// Set style options (matching workout builder)
const SET_STYLES = [
  { id: 'fixed', name: 'Fixed', description: 'Same reps each set', icon: '⬜' },
  { id: 'pyramid', name: 'Pyramid', description: '12→10→8→6', icon: '🔺' },
  { id: 'reverse-pyramid', name: 'Rev Pyramid', description: '6→8→10→12', icon: '🔻' },
  { id: '5x5', name: '5×5', description: '5 sets of 5', icon: '5️⃣' },
  { id: 'drop-set', name: 'Drop Set', description: 'No rest between', icon: '⬇️' },
  { id: 'amrap', name: 'AMRAP', description: 'Max reps', icon: '♾️' },
];

const getBlockStyles = (type: BlockType) => {
  const styles: Record<BlockType, { bg: string; border: string; badge: string }> = {
    warmup: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
    work: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    circuit: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
    cardio: { bg: 'bg-green-500/10', border: 'border-green-500/30', badge: 'bg-green-500/20 text-green-400 border-green-500/50' },
    cooldown: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
  };
  return styles[type] || styles.work;
};

// Compact exercise list for the builder
const COMMON_EXERCISES = [
  { id: 'barbell-back-squat', name: 'Barbell Back Squat', pattern: 'squat' },
  { id: 'goblet-squat', name: 'Goblet Squat', pattern: 'squat' },
  { id: 'front-squat', name: 'Front Squat', pattern: 'squat' },
  { id: 'leg-press', name: 'Leg Press', pattern: 'squat' },
  { id: 'deadlift', name: 'Deadlift', pattern: 'hinge' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', pattern: 'hinge' },
  { id: 'hip-thrust', name: 'Hip Thrust', pattern: 'hinge' },
  { id: 'bench-press', name: 'Bench Press', pattern: 'push' },
  { id: 'db-bench-press', name: 'DB Bench Press', pattern: 'push' },
  { id: 'incline-bench-press', name: 'Incline Bench Press', pattern: 'push' },
  { id: 'overhead-press', name: 'Overhead Press', pattern: 'push' },
  { id: 'db-shoulder-press', name: 'DB Shoulder Press', pattern: 'push' },
  { id: 'dips', name: 'Dips', pattern: 'push' },
  { id: 'barbell-row', name: 'Barbell Row', pattern: 'pull' },
  { id: 'cable-row', name: 'Cable Row', pattern: 'pull' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', pattern: 'pull' },
  { id: 'weighted-pull-up', name: 'Weighted Pull-up', pattern: 'pull' },
  { id: 't-bar-row', name: 'T-Bar Row', pattern: 'pull' },
  { id: 'face-pull', name: 'Face Pull', pattern: 'pull' },
  { id: 'plank', name: 'Plank', pattern: 'core' },
  { id: 'dead-bug', name: 'Dead Bug', pattern: 'core' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', pattern: 'core' },
  { id: 'split-squat', name: 'Split Squat', pattern: 'lunge' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', pattern: 'lunge' },
  { id: 'walking-lunge', name: 'Walking Lunge', pattern: 'lunge' },
  { id: 'leg-curl', name: 'Leg Curl', pattern: 'hinge' },
  { id: 'leg-extension', name: 'Leg Extension', pattern: 'squat' },
  { id: 'calf-raise', name: 'Calf Raise', pattern: 'squat' },
  { id: 'bicep-curl', name: 'Bicep Curl', pattern: 'pull' },
  { id: 'hammer-curl', name: 'Hammer Curl', pattern: 'pull' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', pattern: 'push' },
  { id: 'skull-crusher', name: 'Skull Crusher', pattern: 'push' },
  { id: 'lateral-raise', name: 'Lateral Raise', pattern: 'push' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', pattern: 'pull' },
  { id: 'cable-fly', name: 'Cable Fly', pattern: 'push' },
  { id: 'pec-deck', name: 'Pec Deck', pattern: 'push' },
  { id: 'glute-bridge', name: 'Glute Bridge', pattern: 'warmup' },
  { id: 'band-pull-apart', name: 'Band Pull Apart', pattern: 'warmup' },
  { id: 'hip-circles', name: 'Hip Circles', pattern: 'warmup' },
  { id: 'cat-cow', name: 'Cat-Cow', pattern: 'warmup' },
  { id: 'world-greatest-stretch', name: "World's Greatest Stretch", pattern: 'warmup' },
  { id: 'foam-roll-quads', name: 'Foam Roll Quads', pattern: 'warmup' },
  { id: 'treadmill-run', name: 'Treadmill Run', pattern: 'cardio' },
  { id: 'rowing-machine', name: 'Rowing Machine', pattern: 'cardio' },
  { id: 'assault-bike', name: 'Assault Bike', pattern: 'cardio' },
  { id: 'stairmaster', name: 'Stairmaster', pattern: 'cardio' },
  { id: 'jump-rope', name: 'Jump Rope', pattern: 'cardio' },
  { id: 'machine-chest-press', name: 'Machine Chest Press', pattern: 'push' },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', pattern: 'push' },
  { id: 'machine-row', name: 'Machine Row', pattern: 'pull' },
  { id: 'machine-lat-pulldown', name: 'Machine Lat Pulldown', pattern: 'pull' },
  { id: 'machine-leg-press', name: 'Machine Leg Press', pattern: 'squat' },
  { id: 'machine-leg-curl', name: 'Machine Leg Curl', pattern: 'hinge' },
  { id: 'machine-leg-extension', name: 'Machine Leg Extension', pattern: 'squat' },
  { id: 'hip-abduction', name: 'Hip Abduction Machine', pattern: 'squat' },
  { id: 'hip-adduction', name: 'Hip Adduction Machine', pattern: 'squat' },
  { id: 'hyperextension', name: 'Hyperextension', pattern: 'hinge' },
];

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Weekday = typeof WEEKDAYS[number];

const DAY_LABEL_PRESETS: Record<number, string[]> = {
  2: ['Day A', 'Day B'],
  3: ['Push', 'Pull', 'Legs'],
  4: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
  6: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'],
};

const DEFAULT_SCHEDULE: Record<number, Weekday[]> = {
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
};

// ── Types ──────────────────────────────────────────────────
interface ProgramExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  movementPattern: string;
  sets: number;
  reps: string;
  rest: string;
  repType?: 'reps' | 'time';
  setStyle?: 'fixed' | 'pyramid' | 'reverse-pyramid' | '5x5' | 'drop-set' | 'amrap';
  tempo?: string;
  notes?: string;
}

interface ProgramBlock {
  id: string;
  type: BlockType;
  name: string;
  exercises: ProgramExercise[];
}

interface ProgramDay {
  id: string;
  label: string;
  scheduledDay?: Weekday;
  blocks: ProgramBlock[];
}

type BuilderStep = 'setup' | 'days' | 'schedule';

// ── Loading ────────────────────────────────────────────────
function BuilderLoading() {
  return (
    <div className="container mx-auto p-4 max-w-4xl flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-sky-500" />
        <p className="text-muted-foreground">Loading program builder...</p>
      </div>
    </div>
  );
}

export default function ProgramBuilderPage() {
  return (
    <Suspense fallback={<BuilderLoading />}>
      <ProgramBuilderContent />
    </Suspense>
  );
}

// ── Main Component ─────────────────────────────────────────
function ProgramBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get('clientId');
  
  const { user } = useAuthStore();
  const { clients, addClientProgram, updateClientProgram, addCalendarEvent, deleteCalendarEvent, calendarEvents, clientPrograms, savedBlocks, deleteBlock, getActiveProgram } = useTrainerStore();
  const { workoutHistory } = useWorkoutStore();
  const { addNotification } = useSocialStore();
  
  const isTrainerMode = user?.mode === 'trainer';
  
  // Check for existing program to edit
  const existingProgram = clientIdParam ? getActiveProgram(clientIdParam) : null;
  const isEditMode = !!existingProgram;
  
  // ── Setup state ──
  const [builderStep, setBuilderStep] = useState<BuilderStep>(isEditMode ? 'days' : 'setup');
  const [programName, setProgramName] = useState(existingProgram?.templateName || '');
  const [goal, setGoal] = useState<TrainingGoal>(existingProgram?.goal as TrainingGoal || 'hypertrophy');
  const [phase, setPhase] = useState<TrainingPhase>(existingProgram?.phase as TrainingPhase || 'strength');
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [customWeeks, setCustomWeeks] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(existingProgram?.weeklyPlan?.length || 3);
  const [autoRepeat, setAutoRepeat] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientIdParam);
  
  // ── Days state — load from existing program if editing ──
  const [days, setDays] = useState<ProgramDay[]>(() => {
    if (existingProgram?.weeklyPlan) {
      return existingProgram.weeklyPlan.map((day: any, i: number) => ({
        id: day.id || uuidv4(),
        label: day.dayLabel || `Day ${String.fromCharCode(65 + i)}`,
        scheduledDay: day.scheduledDay as Weekday | undefined,
        blocks: (day.blocks || []).map((block: any) => ({
          id: block.id || uuidv4(),
          type: block.type || 'work',
          name: block.name || 'Main Lifts',
          exercises: (block.exercises || []).map((ex: any) => ({
            id: ex.id || uuidv4(),
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            movementPattern: ex.movementPattern || 'compound',
            sets: ex.sets || 3,
            reps: ex.reps || '8-12',
            rest: ex.rest || '60s',
            repType: ex.repType,
            setStyle: ex.setStyle,
            tempo: ex.tempo,
            notes: ex.notes,
          })),
        })),
      }));
    }
    return [];
  });
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);
  const [blockLibraryFilter, setBlockLibraryFilter] = useState<BlockType | 'all'>('all');
  const [blockLibrarySearch, setBlockLibrarySearch] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'fixed' | 'flexible'>(existingProgram?.scheduleMode || 'fixed');
  const [trainingFrequency, setTrainingFrequency] = useState(existingProgram?.trainingDaysPerWeek || daysPerWeek);
  const [fixedDays, setFixedDays] = useState<Weekday[]>(existingProgram?.selectedDays as Weekday[] || []);
  const [sessionPTMap, setSessionPTMap] = useState<Record<number, 'pt' | 'personal'>>(existingProgram?.sessionPTMap || {});
  
  // ── Exercise edit dialog state ──
  const [editingExercise, setEditingExercise] = useState<{ blockId: string; exercise: ProgramExercise } | null>(null);
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  
  // ── Schedule state ──
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  // ── Save dialog ──
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [libraryName, setLibraryName] = useState('');
  
  const actualWeeks = durationWeeks === 0 ? parseInt(customWeeks) || 4 : durationWeeks;
  
  // Initialize days when moving from setup to days step
  const initializeDays = () => {
    const labels = DAY_LABEL_PRESETS[daysPerWeek] || Array.from({ length: daysPerWeek }, (_, i) => `Day ${String.fromCharCode(65 + i)}`);
    const schedule = DEFAULT_SCHEDULE[daysPerWeek] || WEEKDAYS.slice(0, daysPerWeek);
    
    const newDays: ProgramDay[] = labels.map((label, i) => ({
      id: uuidv4(),
      label,
      scheduledDay: schedule[i] as Weekday,
      blocks: [],
    }));
    
    setDays(newDays);
    setActiveDayIndex(0);
  };
  
  // ── Block/Exercise handlers ──
  const addBlock = (type: BlockType) => {
    const blockNames: Record<BlockType, string> = {
      warmup: 'Warm-up',
      work: 'Main Lifts',
      circuit: 'Circuit',
      cardio: 'Cardio',
      cooldown: 'Cool-down',
    };
    
    setDays(prev => prev.map((day, i) => {
      if (i !== activeDayIndex) return day;
      return {
        ...day,
        blocks: [...day.blocks, {
          id: uuidv4(),
          type,
          name: blockNames[type],
          exercises: [],
        }],
      };
    }));
  };
  
  const removeBlock = (blockId: string) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== activeDayIndex) return day;
      return { ...day, blocks: day.blocks.filter(b => b.id !== blockId) };
    }));
  };
  
  const addExerciseToBlock = (blockId: string, exercise: { id: string; name: string; pattern: string }) => {
    const phaseConfig = TRAINING_PHASES.find(p => p.id === phase) || TRAINING_PHASES[0];
    
    setDays(prev => prev.map((day, i) => {
      if (i !== activeDayIndex) return day;
      return {
        ...day,
        blocks: day.blocks.map(block => {
          if (block.id !== blockId) return block;
          return {
            ...block,
            exercises: [...block.exercises, {
              id: uuidv4(),
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              movementPattern: exercise.pattern,
              sets: phaseConfig.sets,
              reps: phaseConfig.reps,
              rest: phaseConfig.rest,
            }],
          };
        }),
      };
    }));
    setShowAddExercise(null);
    setExerciseSearch('');
  };
  
  const removeExercise = (blockId: string, exerciseId: string) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== activeDayIndex) return day;
      return {
        ...day,
        blocks: day.blocks.map(block => {
          if (block.id !== blockId) return block;
          return { ...block, exercises: block.exercises.filter(e => e.id !== exerciseId) };
        }),
      };
    }));
  };
  
  const updateExercise = (blockId: string, exerciseId: string, updates: Partial<ProgramExercise>) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== activeDayIndex) return day;
      return {
        ...day,
        blocks: day.blocks.map(block => {
          if (block.id !== blockId) return block;
          return {
            ...block,
            exercises: block.exercises.map(e => e.id === exerciseId ? { ...e, ...updates } : e),
          };
        }),
      };
    }));
  };
  
  const copyDay = (fromIndex: number) => {
    const source = days[fromIndex];
    const newDay: ProgramDay = {
      id: uuidv4(),
      label: `${source.label} (Copy)`,
      blocks: source.blocks.map(b => ({
        ...b,
        id: uuidv4(),
        exercises: b.exercises.map(e => ({ ...e, id: uuidv4() })),
      })),
    };
    setDays(prev => [...prev, newDay]);
  };
  
  const removeDay = (index: number) => {
    if (days.length <= 1) return;
    setDays(prev => prev.filter((_, i) => i !== index));
    if (activeDayIndex >= days.length - 1) setActiveDayIndex(Math.max(0, days.length - 2));
  };
  
  const addDay = () => {
    const newDay: ProgramDay = {
      id: uuidv4(),
      label: `Day ${String.fromCharCode(65 + days.length)}`,
      blocks: [],
    };
    setDays(prev => [...prev, newDay]);
    setActiveDayIndex(days.length);
  };
  
  // ── Filter exercises by block type ──
  const currentBlock = showAddExercise ? days[activeDayIndex]?.blocks.find(b => b.id === showAddExercise) : null;
  
  const filteredExercises = useMemo(() => {
    // Use full exercise library for search, fall back to COMMON_EXERCISES when no search query
    const source = exerciseSearch.trim()
      ? exerciseLibrary.map(e => ({ id: e.id, name: e.name, pattern: e.category }))
      : COMMON_EXERCISES;
    return filterExercisesBySearch(source, exerciseSearch, currentBlock?.type || null);
  }, [exerciseSearch, currentBlock]);
  
  // Exercise usage counts for the target user
  const targetUserId = isTrainerMode ? (selectedClientId || '') : (user?.id || '');
  const exerciseUsageCounts = useMemo(() => {
    if (!targetUserId) return {};
    return getExerciseUsageCounts(workoutHistory, targetUserId);
  }, [workoutHistory, targetUserId]);
  
  // ── Block Library: use savedBlocks from store ──
  const filteredLibraryBlocks = useMemo(() => {
    let blocks = savedBlocks || [];
    if (blockLibraryFilter !== 'all') {
      blocks = blocks.filter(b => b.type === blockLibraryFilter);
    }
    if (blockLibrarySearch.trim()) {
      const q = blockLibrarySearch.toLowerCase();
      blocks = blocks.filter(b => 
        b.name.toLowerCase().includes(q) || 
        b.exercises.some(e => (e.exerciseName || '').toLowerCase().includes(q))
      );
    }
    return blocks;
  }, [savedBlocks, blockLibraryFilter, blockLibrarySearch]);

  const addBlockFromLibrary = (savedBlock: any) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== activeDayIndex) return day;
      return {
        ...day,
        blocks: [...day.blocks, {
          id: uuidv4(),
          type: savedBlock.type,
          name: savedBlock.name,
          exercises: (savedBlock.exercises || []).map((e: any) => ({
            id: uuidv4(),
            exerciseId: e.exerciseId || e.id,
            exerciseName: e.exerciseName || e.name || 'Exercise',
            movementPattern: e.movementPattern || '',
            sets: e.sets || 3,
            reps: typeof e.reps === 'string' ? e.reps : '8-12',
            rest: e.rest || '90s',
          })),
        }],
      };
    }));
    setShowBlockLibrary(false);
    toast.success(`Added "${savedBlock.name}" block`);
  };

  // ── Stats ──
  const activeDay = days[activeDayIndex];
  const totalBlocks = activeDay?.blocks.length || 0;
  const totalExercises = activeDay?.blocks.reduce((s, b) => s + b.exercises.length, 0) || 0;
  const allDaysTotalEx = days.reduce((s, d) => s + d.blocks.reduce((s2, b) => s2 + b.exercises.length, 0), 0);
  
  // ── Save program ──
  const handleSaveProgram = () => {
    if (!user) return;
    
    const targetClientId = isTrainerMode ? (selectedClientId || '') : user.id;
    
    const weeklyPlan = days.map(d => ({
      id: d.id,
      dayLabel: d.label,
      scheduledDay: d.scheduledDay,
      blocks: d.blocks.map(b => ({
        id: b.id,
        type: b.type,
        name: b.name,
        exercises: b.exercises.map(e => ({
          id: e.id,
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          movementPattern: e.movementPattern as MovementPattern,
          sets: e.sets,
          reps: e.reps,
          rest: e.rest,
          repType: e.repType,
          setStyle: e.setStyle,
          tempo: e.tempo,
          notes: e.notes,
        })),
      })),
    }));
    
    const effectiveFrequency = scheduleMode === 'flexible' ? trainingFrequency : (fixedDays.length || days.length);
    const effectiveDays = scheduleMode === 'fixed' ? fixedDays : [];
    
    const programFields = {
      templateName: programName || 'Custom Program',
      phase: phase as TrainingPhase,
      goal: goal as TrainingGoal,
      weeklyPlan,
      scheduleMode,
      trainingDaysPerWeek: effectiveFrequency,
      cycleAcrossWeeks: effectiveFrequency > days.length,
      selectedDays: effectiveDays as any[],
      sessionPTMap,
      nextWorkoutIndex: 0,
    };
    
    if (isEditMode && existingProgram) {
      updateClientProgram(existingProgram.id, { ...programFields, updatedAt: new Date().toISOString() });
      setShowSaveDialog(false);
      toast.success('Program updated!');
      router.back();
      return;
    }
    
    const program: ClientProgram = {
      id: uuidv4(),
      clientId: targetClientId,
      trainerId: isTrainerMode ? user.id : user.id,
      templateId: 'custom',
      ...programFields,
      startDate,
      endDate: (() => {
        const start = new Date(startDate);
        start.setDate(start.getDate() + actualWeeks * 7);
        return start.toISOString().split('T')[0];
      })(),
      status: 'active',
      autoRepeat,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    addClientProgram(program);
    
    // Auto-create calendar events for all weeks
    const programRecurrenceGroup = `program-${program.id}`;
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const startD = new Date(startDate);
    let cycleIdx = 0; // Tracks which workout in the cycle
    
    // Collect events to create, checking for conflicts
    const eventsToCreate: Array<Omit<CalendarEvent, 'id'>> = [];
    
    if (scheduleMode === 'fixed' && fixedDays.length > 0) {
      // Fixed: cycle workouts across fixed weekdays, shifting each week
      for (let week = 0; week < actualWeeks; week++) {
        fixedDays.forEach((wd, slotIdx) => {
          const workoutIdx = cycleIdx % days.length;
          const day = days[workoutIdx];
          const targetDow = dayMap[wd] ?? 1;
          const weekStart = new Date(startD);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (targetDow === 0 ? 7 : targetDow) + (week * 7));
          if (weekStart < startD && week === 0) { weekStart.setDate(weekStart.getDate() + 7); }
          const dateStr = weekStart.toISOString().split('T')[0];
          const totalEx = day.blocks.reduce((s, b) => s + b.exercises.length, 0);
          const isPT = sessionPTMap[slotIdx] === 'pt';
          
          eventsToCreate.push({
            title: `${day.label} - ${programName || 'Program'}`,
            type: isPT ? 'session' : 'workout',
            date: dateStr,
            startTime: isPT ? '09:00' : '07:00',
            endTime: isPT ? '10:00' : '08:00',
            clientId: targetClientId,
            trainerId: user.id,
            status: 'scheduled',
            notes: `${totalEx} exercises • ${isPT ? 'PT Session' : 'Personal'} • Week ${week + 1}`,
            recurrenceGroup: programRecurrenceGroup,
          });
          cycleIdx++;
        });
      }
    } else if (scheduleMode === 'flexible') {
      // Flexible: spread sessions across the week, cycling workouts
      const spreadDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const gap = Math.max(1, Math.floor(7 / trainingFrequency));
      
      for (let week = 0; week < actualWeeks; week++) {
        for (let s = 0; s < trainingFrequency; s++) {
          const workoutIdx = cycleIdx % days.length;
          const day = days[workoutIdx];
          const spreadIdx = Math.min(s * gap, 6);
          const wd = spreadDays[spreadIdx];
          const targetDow = dayMap[wd] ?? 1;
          const weekStart = new Date(startD);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (targetDow === 0 ? 7 : targetDow) + (week * 7));
          if (weekStart < startD && week === 0) { weekStart.setDate(weekStart.getDate() + 7); }
          const dateStr = weekStart.toISOString().split('T')[0];
          const totalEx = day.blocks.reduce((s2, b) => s2 + b.exercises.length, 0);
          const isPT = sessionPTMap[s] === 'pt';
          
          eventsToCreate.push({
            title: `${day.label} - ${programName || 'Program'}`,
            type: isPT ? 'session' : 'workout',
            date: dateStr,
            startTime: isPT ? '09:00' : '07:00',
            endTime: isPT ? '10:00' : '08:00',
            clientId: targetClientId,
            trainerId: user.id,
            status: 'scheduled',
            notes: `${totalEx} exercises • ${isPT ? 'PT Session' : 'Personal'} • Week ${week + 1}`,
            recurrenceGroup: programRecurrenceGroup,
          });
          cycleIdx++;
        }
      }
    }
    
    // Check for conflicts and create events
    const existingEvents = calendarEvents.filter(e => e.clientId === targetClientId && e.status !== 'cancelled');
    let conflictsReplaced = 0;
    eventsToCreate.forEach(evt => {
      // Find conflicting events on the same date with overlapping times
      const conflicts = existingEvents.filter(existing => {
        if (existing.date !== evt.date) return false;
        if (!existing.startTime || !evt.startTime) return false;
        // Check time overlap
        const eStart = existing.startTime.replace(':', '');
        const eEnd = (existing.endTime || '23:59').replace(':', '');
        const nStart = evt.startTime!.replace(':', '');
        const nEnd = (evt.endTime || '23:59').replace(':', '');
        return nStart < eEnd && nEnd > eStart;
      });
      // Replace conflicting events
      conflicts.forEach(c => {
        deleteCalendarEvent(c.id);
        conflictsReplaced++;
      });
      addCalendarEvent(evt);
    });
    if (conflictsReplaced > 0) {
      toast.info(`Replaced ${conflictsReplaced} conflicting event${conflictsReplaced > 1 ? 's' : ''} on the calendar`);
    }
    
    // Save to library if requested
    if (saveToLibrary && libraryName.trim()) {
      const savedPrograms = JSON.parse(localStorage.getItem(`apex-program-library-${user.id}`) || '[]');
      savedPrograms.push({
        id: uuidv4(),
        name: libraryName.trim(),
        description: `${daysPerWeek}×/wk • ${actualWeeks} weeks • ${goal}`,
        goal,
        phase,
        daysPerWeek,
        weeks: actualWeeks,
        autoRepeat,
        days: days.map(d => ({ label: d.label, scheduledDay: d.scheduledDay, blocks: d.blocks })),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(`apex-program-library-${user.id}`, JSON.stringify(savedPrograms));
    }
    
    // Send notification to the client about their new program
    if (isTrainerMode && targetClientId && targetClientId !== user.id) {
      addNotification({
        userId: targetClientId,
        type: 'program_assigned',
        title: 'New Program Assigned',
        message: `Your trainer assigned you "${programName || 'Custom Program'}" — ${days.length} workouts, ${effectiveFrequency}×/week for ${actualWeeks} weeks`,
        actionUrl: '/program',
      });
    }
    
    setShowSaveDialog(false);
    const totalSessions = actualWeeks * effectiveFrequency;
    toast.success(`Program created! ${totalSessions} sessions scheduled.`);
    router.back();
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <MainLayout>
      <PageHeader
        title="Program Builder"
        subtitle={builderStep === 'setup' ? 'Set up your program' : builderStep === 'days' ? `Building ${programName || 'Program'}` : 'Schedule & activate'}
        showBack
      />

      <div className="px-4 py-4 space-y-4 pb-32">
        {/* ── Progress Steps ── */}
        <div className="flex gap-2">
          {['Setup', 'Build Days', 'Schedule'].map((label, i) => {
            const steps: BuilderStep[] = ['setup', 'days', 'schedule'];
            const isActive = steps.indexOf(builderStep) >= i;
            return (
              <div key={label} className="flex-1 text-center">
                <div className={`h-1 rounded-full mb-1 ${isActive ? 'bg-sky-500' : 'bg-gray-700'}`} />
                <span className={`text-[10px] ${isActive ? 'text-sky-400' : 'text-gray-600'}`}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* STEP 1: SETUP                                         */}
        {/* ══════════════════════════════════════════════════════ */}
        {builderStep === 'setup' && (
          <div className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Program Name</Label>
                  <Input
                    value={programName}
                    onChange={e => setProgramName(e.target.value)}
                    placeholder="e.g. 8-Week Hypertrophy"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                {isTrainerMode && (
                  <div className="space-y-2">
                    <Label className="text-gray-300">Client</Label>
                    <Select value={selectedClientId || ''} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select client..." />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {clients.map(c => {
                          const info = getClientDisplayInfo(c.clientId);
                          return (
                            <SelectItem key={c.clientId} value={c.clientId}>
                              {info.displayName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Goal</Label>
                    <Select value={goal} onValueChange={v => setGoal(v as TrainingGoal)}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="hypertrophy">Muscle Growth</SelectItem>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="fat_loss">Fat Loss</SelectItem>
                        <SelectItem value="conditioning">Conditioning</SelectItem>
                        <SelectItem value="general">General Fitness</SelectItem>
                        <SelectItem value="mobility">Mobility</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Phase</Label>
                    <Select value={phase} onValueChange={v => setPhase(v as TrainingPhase)}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="foundation">Foundation</SelectItem>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="return">Return</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Duration</Label>
                    <Select value={String(durationWeeks)} onValueChange={v => setDurationWeeks(parseInt(v))}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="4">4 weeks</SelectItem>
                        <SelectItem value="6">6 weeks</SelectItem>
                        <SelectItem value="8">8 weeks</SelectItem>
                        <SelectItem value="12">12 weeks</SelectItem>
                        <SelectItem value="0">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {durationWeeks === 0 && (
                    <div className="space-y-2">
                      <Label className="text-gray-300">Weeks</Label>
                      <Input
                        type="number"
                        value={customWeeks}
                        onChange={e => setCustomWeeks(e.target.value)}
                        placeholder="e.g. 16"
                        className="bg-gray-800 border-gray-700 text-white"
                        min={1}
                        max={52}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Days / Week</Label>
                    <Select value={String(daysPerWeek)} onValueChange={v => setDaysPerWeek(parseInt(v))}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {[2, 3, 4, 5, 6].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}× / week</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white text-sm">Auto-repeat</p>
                    <p className="text-xs text-gray-500">Restart program after completion</p>
                  </div>
                  <Switch
                    checked={autoRepeat}
                    onCheckedChange={setAutoRepeat}
                    className="data-[state=checked]:bg-sky-500"
                  />
                </div>
              </CardContent>
            </Card>
            
            <Button
              className="w-full bg-sky-500 hover:bg-sky-600"
              onClick={() => {
                if (!programName.trim()) {
                  toast.error('Please enter a program name');
                  return;
                }
                initializeDays();
                setBuilderStep('days');
              }}
            >
              Continue to Build Days <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* STEP 2: BUILD DAYS                                    */}
        {/* ══════════════════════════════════════════════════════ */}
        {builderStep === 'days' && (
          <div className="space-y-4">
            {/* Day tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {days.map((day, i) => (
                <button
                  key={day.id}
                  onClick={() => setActiveDayIndex(i)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    i === activeDayIndex
                      ? 'bg-sky-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {day.label}
                  <span className="ml-1 text-[10px] opacity-70">
                    ({day.blocks.reduce((s, b) => s + b.exercises.length, 0)})
                  </span>
                </button>
              ))}
              <button
                onClick={addDay}
                className="flex-shrink-0 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-sky-400 hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {/* Day name + actions */}
            {activeDay && (
              <div className="flex items-center gap-2">
                <Input
                  value={activeDay.label}
                  onChange={e => setDays(prev => prev.map((d, i) => i === activeDayIndex ? { ...d, label: e.target.value } : d))}
                  className="bg-gray-800 border-gray-700 text-white text-sm h-9 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-400 hover:text-sky-400"
                  onClick={() => copyDay(activeDayIndex)}
                  title="Copy day"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                {days.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-gray-400 hover:text-red-400"
                    onClick={() => removeDay(activeDayIndex)}
                    title="Remove day"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            
            {/* Add Block: type buttons + library */}
            <div className="flex gap-1 flex-wrap items-center">
              <span className="text-xs text-gray-500 mr-1">Add Block:</span>
              {BLOCK_TYPES.map(bt => (
                <Button
                  key={bt.value}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-gray-700 text-gray-300 hover:border-gray-500 gap-1"
                  onClick={() => addBlock(bt.value)}
                >
                  {bt.icon} {bt.label}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs gap-1 ${showBlockLibrary ? 'border-sky-500 text-sky-400 bg-sky-500/10' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}
                onClick={() => { setShowBlockLibrary(true); setBlockLibraryFilter('all'); setBlockLibrarySearch(''); }}
              >
                <Dumbbell className="h-3.5 w-3.5" /> Block Library ({savedBlocks.length})
              </Button>
            </div>
            
            {/* Blocks & exercises */}
            {activeDay?.blocks.length === 0 && (
              <Card className="bg-gray-900/50 border-gray-800 border-dashed">
                <CardContent className="p-8 text-center">
                  <Dumbbell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Add a block to start building this day</p>
                </CardContent>
              </Card>
            )}
            
            {activeDay?.blocks.map((block) => {
              const styles = getBlockStyles(block.type);
              const blockIcon = BLOCK_TYPES.find(bt => bt.value === block.type)?.icon;
              return (
                <Card key={block.id} className={`${styles.bg} ${styles.border} border overflow-hidden`}>
                  <CardContent className="p-0">
                    {/* Block header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex-shrink-0">{blockIcon}</span>
                        <Input
                          value={block.name}
                          onChange={e => {
                            setDays(prev => prev.map((d, i) => {
                              if (i !== activeDayIndex) return d;
                              return { ...d, blocks: d.blocks.map(b => b.id === block.id ? { ...b, name: e.target.value } : b) };
                            }));
                          }}
                          className="bg-transparent border-none text-white text-sm font-medium h-7 p-0 focus-visible:ring-0"
                        />
                        <Badge className={`text-[10px] ${styles.badge} border flex-shrink-0`}>
                          {block.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-sky-400"
                          title="Save block to library"
                          onClick={() => {
                            const { saveBlock } = useTrainerStore.getState();
                            saveBlock({
                              name: block.name,
                              type: block.type,
                              exercises: block.exercises.map(e => ({
                                id: e.id,
                                exerciseId: e.exerciseId,
                                exerciseName: e.exerciseName,
                                sets: e.sets,
                                reps: e.reps,
                                rest: e.rest,
                              })),
                            });
                            toast.success(`"${block.name}" saved to library`);
                          }}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-red-400"
                          onClick={() => removeBlock(block.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Numbered exercise list */}
                    <div className="divide-y divide-white/5">
                      {block.exercises.map((ex, exIdx) => (
                        <div key={ex.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors">
                          <GripVertical className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 cursor-grab" />
                          <span className="text-xs text-gray-500 w-5 flex-shrink-0">{exIdx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm text-gray-900 font-medium truncate">{ex.exerciseName}</p>
                              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {ex.sets} × {ex.reps} reps · {ex.rest} rest
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-500 hover:text-sky-400"
                              onClick={() => {
                                setEditingExercise({ blockId: block.id, exercise: { ...ex } });
                                setShowSwapPanel(false);
                                setSwapSearch('');
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-500 hover:text-red-400"
                              onClick={() => removeExercise(block.id, ex.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Add exercise button */}
                    <div className="px-3 py-2 border-t border-white/5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-gray-400 hover:text-white w-full"
                        onClick={() => { setShowAddExercise(block.id); setExerciseSearch(''); }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Exercise
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Bottom nav for days step */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-gray-700 text-gray-300"
                onClick={() => setBuilderStep('setup')}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-sky-500 hover:bg-sky-600"
                onClick={() => {
                  if (allDaysTotalEx === 0) {
                    toast.error('Add at least one exercise to continue');
                    return;
                  }
                  setBuilderStep('schedule');
                }}
              >
                Schedule <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
        
        {/* ══════════════════════════════════════════════════════ */}
        {/* STEP 3: SCHEDULE                                      */}
        {/* ══════════════════════════════════════════════════════ */}
        {builderStep === 'schedule' && (
          <div className="space-y-4">
            {/* Schedule mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-3 rounded-xl border text-left transition-all ${scheduleMode === 'fixed' ? 'border-sky-500 bg-sky-500/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}
                onClick={() => setScheduleMode('fixed')}
              >
                <Calendar className="w-5 h-5 text-sky-400 mb-1" />
                <p className="text-sm text-white font-medium">Fixed Days</p>
                <p className="text-[10px] text-gray-400">Repeat every week on set days</p>
              </button>
              <button
                className={`p-3 rounded-xl border text-left transition-all ${scheduleMode === 'flexible' ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}
                onClick={() => setScheduleMode('flexible')}
              >
                <RefreshCw className="w-5 h-5 text-amber-400 mb-1" />
                <p className="text-sm text-white font-medium">Flexible</p>
                <p className="text-[10px] text-gray-400">Do workouts on any day — shows as &quot;Next Workout&quot;</p>
              </button>
            </div>

            {scheduleMode === 'fixed' && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm mb-2 block">Training Days</Label>
                  <p className="text-[10px] text-gray-500 mb-2">Pick which days the client trains. Workouts cycle across these days.</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(wd => {
                      const isSelected = fixedDays.includes(wd);
                      return (
                        <button
                          key={wd}
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                            isSelected ? 'bg-sky-500 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                          }`}
                          onClick={() => {
                            setFixedDays(prev => 
                              isSelected ? prev.filter(d => d !== wd) : [...prev, wd].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
                            );
                          }}
                        >
                          {wd.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {fixedDays.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm">Session Schedule Preview</Label>
                    <p className="text-[10px] text-gray-500">
                      {fixedDays.length} training days, cycling through {days.length} workouts
                      {fixedDays.length > days.length && ' (pattern shifts each week)'}
                    </p>
                    <div className="space-y-1.5">
                      {fixedDays.map((wd, slotIdx) => {
                        const workoutIdx = slotIdx % days.length;
                        const isPT = sessionPTMap[slotIdx] === 'pt';
                        return (
                          <div key={wd} className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg">
                            <span className="text-xs text-gray-500 capitalize w-12">{wd.slice(0, 3)}</span>
                            <span className="text-sm text-white flex-1">{days[workoutIdx]?.label || 'Workout'}</span>
                            <button
                              type="button"
                              onClick={() => setSessionPTMap(prev => ({ ...prev, [slotIdx]: isPT ? 'personal' : 'pt' }))}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                isPT ? 'bg-sky-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              }`}
                            >
                              {isPT ? 'PT' : 'Personal'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {scheduleMode === 'flexible' && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <RefreshCw className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Flexible Schedule</p>
                    <p className="text-xs text-gray-400">Workouts cycle in order. Client sees &quot;Next Workout&quot; and does it on any day.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <Label className="text-gray-300 text-sm flex-shrink-0">Frequency</Label>
                  <Select value={String(trainingFrequency)} onValueChange={v => setTrainingFrequency(parseInt(v))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2,3,4,5,6,7].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}×/wk</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-gray-500">cycling {days.length} workouts</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-sm">Weekly Sessions</Label>
                  <p className="text-[10px] text-gray-500 mb-1">Set each session as PT or Personal</p>
                  {Array.from({ length: trainingFrequency }, (_, slotIdx) => {
                    const workoutIdx = slotIdx % days.length;
                    const isPT = sessionPTMap[slotIdx] === 'pt';
                    return (
                      <div key={slotIdx} className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg">
                        <span className="text-xs text-gray-500 w-6">{slotIdx + 1}.</span>
                        <span className="text-sm text-white flex-1">{days[workoutIdx]?.label || 'Workout'}</span>
                        <span className="text-[10px] text-gray-500">{days[workoutIdx]?.blocks.reduce((s, b) => s + b.exercises.length, 0) || 0} ex</span>
                        <button
                          type="button"
                          onClick={() => setSessionPTMap(prev => ({ ...prev, [slotIdx]: isPT ? 'personal' : 'pt' }))}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                            isPT ? 'bg-sky-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {isPT ? 'PT' : 'Personal'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            )}
            
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div className="p-3 bg-gray-800/50 rounded-lg space-y-1">
                  <p className="text-sm text-white font-medium">Program Summary</p>
                  <p className="text-xs text-gray-400">{programName}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className="text-[10px] bg-sky-500/20 text-sky-300 border-0">{scheduleMode === 'flexible' ? trainingFrequency : fixedDays.length || days.length}×/wk</Badge>
                    <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-0">{actualWeeks} weeks</Badge>
                    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-0">{allDaysTotalEx} exercises</Badge>
                    <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-0">{actualWeeks * (scheduleMode === 'flexible' ? trainingFrequency : fixedDays.length || days.length)} sessions</Badge>
                    {autoRepeat && <Badge className="text-[10px] bg-orange-500/20 text-orange-300 border-0">Auto-repeat</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-700 text-gray-300"
                onClick={() => setBuilderStep('days')}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={() => setShowSaveDialog(true)}
              >
                <Save className="w-4 h-4 mr-2" /> Activate Program
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Exercise Dialog ── */}
      <Dialog open={!!showAddExercise} onOpenChange={() => setShowAddExercise(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="text-white">Add Exercise</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={exerciseSearch}
              onChange={e => setExerciseSearch(e.target.value)}
              placeholder="Search exercises..."
              className="bg-gray-800 border-gray-700 text-white pl-10"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-[45vh]">
            <div className="space-y-1">
              {filteredExercises.slice(0, 30).map(ex => {
                const count = exerciseUsageCounts[ex.id] || 0;
                return (
                  <button
                    key={ex.id}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 text-sm text-white flex items-center gap-2 transition-colors"
                    onClick={() => showAddExercise && addExerciseToBlock(showAddExercise, { ...ex, pattern: ex.pattern || 'compound' })}
                  >
                    <span className="flex-1">{ex.name}</span>
                    {count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium">{count}×</span>
                    )}
                    <span className="text-[10px] text-gray-500">{ex.pattern}</span>
                  </button>
                );
              })}
              {filteredExercises.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No exercises found</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Save/Activate Dialog ── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Activate Program</DialogTitle>
            <DialogDescription className="text-gray-400">
              This will create {actualWeeks * (scheduleMode === 'flexible' ? trainingFrequency : (fixedDays.length || days.length))} calendar events over {actualWeeks} weeks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div>
                <p className="font-medium text-white text-sm">Save to Program Library</p>
                <p className="text-xs text-gray-500">Reuse this program later</p>
              </div>
              <Switch
                checked={saveToLibrary}
                onCheckedChange={setSaveToLibrary}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
            {saveToLibrary && (
              <div className="space-y-2">
                <Label className="text-gray-300">Library Name</Label>
                <Input
                  value={libraryName}
                  onChange={e => setLibraryName(e.target.value)}
                  placeholder={programName || 'Program name...'}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-700 text-gray-300"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={handleSaveProgram}
              >
                <Calendar className="w-4 h-4 mr-2" /> Activate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Block Library Dialog ── */}
      <Dialog open={showBlockLibrary} onOpenChange={setShowBlockLibrary}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-md max-h-[80vh] p-0">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-sky-400" />
                <DialogTitle className="text-white text-lg font-semibold">Block Library</DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white text-xs gap-1"
                onClick={() => { toast.success('Block library synced'); }}
              >
                <RefreshCw className="w-3 h-3" /> Sync
              </Button>
            </div>
            
            <div className="flex gap-1 flex-wrap mb-3">
              <Button
                size="sm"
                className={`h-7 text-xs ${blockLibraryFilter === 'all' ? 'bg-sky-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                onClick={() => setBlockLibraryFilter('all')}
              >
                All
              </Button>
              {BLOCK_TYPES.map(bt => (
                <Button
                  key={bt.value}
                  size="sm"
                  className={`h-7 text-xs gap-1 ${blockLibraryFilter === bt.value ? 'bg-sky-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                  onClick={() => setBlockLibraryFilter(bt.value)}
                >
                  {bt.icon} {bt.label}
                </Button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={blockLibrarySearch}
                onChange={e => setBlockLibrarySearch(e.target.value)}
                placeholder="Search blocks or exercises..."
                className="bg-gray-800 border-gray-700 text-white pl-10 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="max-h-[50vh] p-4">
            <div className="space-y-3">
              {filteredLibraryBlocks.length === 0 && (
                <div className="text-center py-8">
                  <Dumbbell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No blocks found</p>
                  <p className="text-xs text-gray-600 mt-1">Create blocks in the workout builder to see them here</p>
                </div>
              )}
              {filteredLibraryBlocks.map((sb) => {
                const styles = getBlockStyles(sb.type);
                const blockIcon = BLOCK_TYPES.find(bt => bt.value === sb.type)?.icon;
                return (
                  <Card
                    key={sb.id}
                    className={`${styles.bg} ${styles.border} border cursor-pointer hover:ring-1 hover:ring-sky-500/50 transition-all`}
                    onClick={() => addBlockFromLibrary(sb)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="flex-shrink-0">{blockIcon}</span>
                          <span className="text-sm text-white font-medium truncate">{sb.name}</span>
                          <Badge className={`text-[10px] ${styles.badge} border flex-shrink-0`}>{sb.type}</Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-sky-400"
                            onClick={(e) => { e.stopPropagation(); }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-red-400"
                            onClick={(e) => { e.stopPropagation(); deleteBlock(sb.id); toast.success('Block deleted'); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{sb.exercises.length} exercises</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Exercise Edit Dialog (rich, matching workout builder) ── */}
      <Dialog open={!!editingExercise} onOpenChange={(open) => {
        if (!open) {
          setEditingExercise(null);
          setShowSwapPanel(false);
          setSwapSearch('');
        }
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Exercise</DialogTitle>
          </DialogHeader>
          {editingExercise && (
            <div className="space-y-4">
              {/* Exercise name + badge + swap button */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-400 text-xs">Exercise</Label>
                  <p className="font-medium text-white">{editingExercise.exercise.exerciseName}</p>
                  <Badge variant="outline" className="text-xs capitalize mt-1 border-gray-600 text-gray-300">
                    {exerciseLibraryMap.get(editingExercise.exercise.exerciseId)?.category || editingExercise.exercise.movementPattern}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:text-white"
                  onClick={() => setShowSwapPanel(!showSwapPanel)}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  {showSwapPanel ? 'Hide Swaps' : 'Swap Exercise'}
                </Button>
              </div>

              {/* Swap Suggestions Panel */}
              {showSwapPanel && (
                <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                  <Tabs defaultValue="similar" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-3 bg-gray-800">
                      <TabsTrigger value="similar" className="text-xs">
                        <Dumbbell className="h-3 w-3 mr-1" />
                        Similar
                      </TabsTrigger>
                      <TabsTrigger value="muscle" className="text-xs">
                        <Target className="h-3 w-3 mr-1" />
                        Same Pattern
                      </TabsTrigger>
                      <TabsTrigger value="all" className="text-xs">
                        <Search className="h-3 w-3 mr-1" />
                        All Exercises
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="similar" className="mt-2">
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {getDirectSwaps(editingExercise.exercise.exerciseId).length > 0 ? (
                            getDirectSwaps(editingExercise.exercise.exerciseId).map(ex => (
                              <Button
                                key={ex.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-left h-auto py-2 text-gray-300 hover:text-white hover:bg-gray-700"
                                onClick={() => {
                                  setEditingExercise({
                                    ...editingExercise,
                                    exercise: {
                                      ...editingExercise.exercise,
                                      exerciseId: ex.id,
                                      exerciseName: ex.name,
                                    }
                                  });
                                  setShowSwapPanel(false);
                                }}
                              >
                                <div>
                                  <p className="font-medium text-sm">{ex.name}</p>
                                  <p className="text-xs text-gray-500">{ex.equipment}</p>
                                </div>
                              </Button>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No direct swaps available</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="muscle" className="mt-2">
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {(() => {
                            const currentLib = exerciseLibraryMap.get(editingExercise.exercise.exerciseId);
                            const currentMuscles = currentLib?.primaryMuscles || [];
                            return COMMON_EXERCISES.filter(ex => {
                              if (ex.id === editingExercise.exercise.exerciseId) return false;
                              if (ex.pattern === editingExercise.exercise.movementPattern) return true;
                              const lib = exerciseLibraryMap.get(ex.id);
                              return lib?.primaryMuscles?.some(m => currentMuscles.includes(m as any)) ?? false;
                            }).map(ex => {
                              const lib = exerciseLibraryMap.get(ex.id);
                              return (
                                <Button
                                  key={ex.id}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-left h-auto py-2 text-gray-300 hover:text-white hover:bg-gray-700"
                                  onClick={() => {
                                    setEditingExercise({
                                      ...editingExercise,
                                      exercise: {
                                        ...editingExercise.exercise,
                                        exerciseId: ex.id,
                                        exerciseName: ex.name,
                                        movementPattern: ex.pattern,
                                      }
                                    });
                                    setShowSwapPanel(false);
                                  }}
                                >
                                  <div>
                                    <p className="font-medium text-sm">{ex.name}</p>
                                    <p className="text-xs text-gray-500 capitalize">
                                      {lib?.primaryMuscles?.join(', ') || ex.pattern}
                                    </p>
                                  </div>
                                </Button>
                              );
                            });
                          })()}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="all" className="mt-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          value={swapSearch}
                          onChange={(e) => setSwapSearch(e.target.value)}
                          placeholder="Search all exercises..."
                          className="pl-9 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
                        />
                      </div>
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {filterExercisesBySearch(exerciseLibrary, swapSearch)
                          .filter(ex => ex.id !== editingExercise.exercise.exerciseId)
                          .slice(0, 50)
                          .map(ex => {
                            const libEntry = exerciseLibraryMap.get(ex.id);
                            return (
                              <Button
                                key={ex.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-left h-auto py-2 text-gray-300 hover:text-white hover:bg-gray-700"
                                onClick={() => {
                                  setEditingExercise({
                                    ...editingExercise,
                                    exercise: {
                                      ...editingExercise.exercise,
                                      exerciseId: ex.id,
                                      exerciseName: ex.name,
                                      movementPattern: ex.pattern || '',
                                    }
                                  });
                                  setShowSwapPanel(false);
                                  setSwapSearch('');
                                }}
                              >
                                <div>
                                  <p className="font-medium text-sm">{ex.name}</p>
                                  <p className="text-xs text-gray-500 capitalize">
                                    {libEntry?.equipment || ex.pattern}
                                    {libEntry?.primaryMuscles?.length ? ` · ${libEntry.primaryMuscles.join(', ')}` : ''}
                                  </p>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Set Style Selection */}
              <div>
                <Label className="mb-2 block text-gray-300">Set Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {SET_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={`h-auto py-2 px-2 flex flex-col items-center justify-center text-center rounded-md border overflow-hidden transition-colors ${
                        (editingExercise.exercise.setStyle || 'fixed') === style.id
                          ? 'bg-sky-500 border-sky-500 text-white'
                          : 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800'
                      }`}
                      onClick={() => {
                        let newSets = editingExercise.exercise.sets;
                        let newReps = editingExercise.exercise.reps;
                        if (style.id === '5x5') { newSets = 5; newReps = '5'; }
                        else if (style.id === 'pyramid') { newSets = 4; newReps = '12→10→8→6'; }
                        else if (style.id === 'reverse-pyramid') { newSets = 4; newReps = '6→8→10→12'; }
                        else if (style.id === 'drop-set') { newSets = 3; newReps = '10→10→10'; }
                        else if (style.id === 'amrap') { newReps = 'AMRAP'; }
                        setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, setStyle: style.id as any, sets: newSets, reps: newReps }
                        });
                      }}
                    >
                      <span className="font-medium text-sm whitespace-nowrap">{style.icon} {style.name}</span>
                      <span className="text-xs opacity-70 truncate w-full">{style.description}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  These are suggestions - edit sets/reps below to record actual performance
                </p>
              </div>

              {/* Measurement Type (Reps vs Time) */}
              <div>
                <Label className="mb-2 block text-gray-300">Measurement Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={(editingExercise.exercise.repType || 'reps') === 'reps' ? 'default' : 'outline'}
                    size="sm"
                    className={(editingExercise.exercise.repType || 'reps') === 'reps' ? 'bg-sky-500 hover:bg-sky-600' : 'border-gray-600 text-gray-300'}
                    onClick={() => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, repType: 'reps', reps: editingExercise.exercise.repType === 'time' ? '10' : editingExercise.exercise.reps }
                    })}
                  >
                    Reps
                  </Button>
                  <Button
                    type="button"
                    variant={editingExercise.exercise.repType === 'time' ? 'default' : 'outline'}
                    size="sm"
                    className={editingExercise.exercise.repType === 'time' ? 'bg-blue-500 hover:bg-blue-600' : 'border-gray-600 text-gray-300'}
                    onClick={() => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, repType: 'time', reps: editingExercise.exercise.repType === 'reps' || !editingExercise.exercise.repType ? '30s' : editingExercise.exercise.reps }
                    })}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Time
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {editingExercise.exercise.repType === 'time'
                    ? 'Use for cardio, holds, stretches (e.g., 30s, 1min, 5min)'
                    : 'Standard repetition counting'
                  }
                </p>
              </div>

              {/* Sets / Reps / Rest */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-gray-300">Sets</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editingExercise.exercise.sets}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, sets: parseInt(e.target.value) || 0 }
                    })}
                    className="bg-gray-800/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{editingExercise.exercise.repType === 'time' ? 'Duration' : 'Reps'}</Label>
                  <Input
                    value={editingExercise.exercise.reps}
                    placeholder={editingExercise.exercise.repType === 'time' ? '30s' : '8-12'}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, reps: e.target.value }
                    })}
                    className="bg-gray-800/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Rest</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {REST_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        type="button"
                        variant={editingExercise.exercise.rest === `${preset.value}s` ? 'default' : 'outline'}
                        size="sm"
                        className={`text-xs h-6 px-2 ${editingExercise.exercise.rest === `${preset.value}s` ? 'bg-sky-500 hover:bg-sky-600' : 'border-gray-600 text-gray-300'}`}
                        onClick={() => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, rest: `${preset.value}s` }
                        })}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tempo */}
              <div>
                <Label className="mb-2 block text-gray-300">Tempo</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {Object.entries(TEMPO_PRESETS).map(([key, preset]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={editingExercise.exercise.tempo === preset.tempo.join('') ? 'default' : 'outline'}
                      size="sm"
                      className={`text-xs h-7 ${editingExercise.exercise.tempo === preset.tempo.join('') ? 'bg-sky-500 hover:bg-sky-600' : 'border-gray-600 text-gray-300'}`}
                      onClick={() => setEditingExercise({
                        ...editingExercise,
                        exercise: { ...editingExercise.exercise, tempo: preset.tempo.join('') }
                      })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={!editingExercise.exercise.tempo ? 'default' : 'outline'}
                    size="sm"
                    className={`text-xs h-7 ${!editingExercise.exercise.tempo ? 'bg-gray-600' : 'border-gray-600 text-gray-300'}`}
                    onClick={() => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, tempo: '' }
                    })}
                  >
                    None
                  </Button>
                </div>
                <Input
                  value={editingExercise.exercise.tempo || ''}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    exercise: { ...editingExercise.exercise, tempo: e.target.value }
                  })}
                  placeholder="Custom: 3010"
                  className="h-8 bg-gray-800/50 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingExercise.exercise.tempo
                    ? `${editingExercise.exercise.tempo[0] || 0}s down, ${editingExercise.exercise.tempo[1] || 0}s pause, ${editingExercise.exercise.tempo[2] || 0}s up, ${editingExercise.exercise.tempo[3] || 0}s top`
                    : 'Eccentric-pause-concentric-pause (affects time estimate)'}
                </p>
              </div>

              {/* Coaching Notes */}
              <div>
                <Label className="text-gray-300">Coaching Notes (optional)</Label>
                <Input
                  value={editingExercise.exercise.notes || ''}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    exercise: { ...editingExercise.exercise, notes: e.target.value }
                  })}
                  placeholder="Any coaching cues for this exercise..."
                  className="bg-gray-800/50 border-gray-700 text-white"
                />
              </div>

              {/* Save button */}
              <Button
                className="w-full bg-sky-500 hover:bg-sky-600"
                onClick={() => {
                  updateExercise(editingExercise.blockId, editingExercise.exercise.id, {
                    exerciseId: editingExercise.exercise.exerciseId,
                    exerciseName: editingExercise.exercise.exerciseName,
                    movementPattern: editingExercise.exercise.movementPattern,
                    sets: editingExercise.exercise.sets,
                    reps: editingExercise.exercise.reps,
                    rest: editingExercise.exercise.rest,
                    repType: editingExercise.exercise.repType,
                    setStyle: editingExercise.exercise.setStyle,
                    tempo: editingExercise.exercise.tempo,
                    notes: editingExercise.exercise.notes,
                  });
                  setEditingExercise(null);
                  setShowSwapPanel(false);
                }}
              >
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Bottom bar (days step only) ── */}
      {builderStep === 'days' && (
        <div className="fixed bottom-16 left-0 right-0 bg-gray-900/95 border-t border-gray-800 px-4 py-3 backdrop-blur-sm z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {totalBlocks} blocks • {totalExercises} exercises
            </span>
            <span className="text-xs text-gray-500">
              {allDaysTotalEx} total across {days.length} days
            </span>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
