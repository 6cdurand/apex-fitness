'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
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
} from 'lucide-react';
import { BlockType, MovementPattern, ClientProgram, ClientWorkoutDay, ClientWorkoutBlock, ClientProgramExercise, TrainingGoal, TrainingPhase } from '@/types';
import { exerciseLibrary, filterExercisesBySearch, getExerciseUsageCounts } from '@/lib/exercises';
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
  const { clients, addClientProgram, addCalendarEvent, clientPrograms, savedBlocks, deleteBlock } = useTrainerStore();
  const { workoutHistory } = useWorkoutStore();
  
  const isTrainerMode = user?.mode === 'trainer';
  
  // ── Setup state ──
  const [builderStep, setBuilderStep] = useState<BuilderStep>('setup');
  const [programName, setProgramName] = useState('');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [phase, setPhase] = useState<TrainingPhase>('strength');
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [customWeeks, setCustomWeeks] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [autoRepeat, setAutoRepeat] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientIdParam);
  
  // ── Days state ──
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);
  const [blockLibraryFilter, setBlockLibraryFilter] = useState<BlockType | 'all'>('all');
  const [blockLibrarySearch, setBlockLibrarySearch] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'fixed' | 'flexible'>('fixed');
  
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
    setDaysPerWeek(prev => prev + 1);
  };
  
  const removeDay = (index: number) => {
    if (days.length <= 1) return;
    setDays(prev => prev.filter((_, i) => i !== index));
    setDaysPerWeek(prev => prev - 1);
    if (activeDayIndex >= days.length - 1) setActiveDayIndex(Math.max(0, days.length - 2));
  };
  
  const addDay = () => {
    const newDay: ProgramDay = {
      id: uuidv4(),
      label: `Day ${String.fromCharCode(65 + days.length)}`,
      blocks: [],
    };
    setDays(prev => [...prev, newDay]);
    setDaysPerWeek(prev => prev + 1);
    setActiveDayIndex(days.length);
  };
  
  // ── Filter exercises by block type ──
  const currentBlock = showAddExercise ? days[activeDayIndex]?.blocks.find(b => b.id === showAddExercise) : null;
  
  const filteredExercises = useMemo(() => {
    return filterExercisesBySearch(COMMON_EXERCISES, exerciseSearch, currentBlock?.type || null);
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
    
    const program: ClientProgram = {
      id: uuidv4(),
      clientId: targetClientId,
      trainerId: isTrainerMode ? user.id : user.id,
      templateId: 'custom',
      templateName: programName || 'Custom Program',
      phase: phase as TrainingPhase,
      goal: goal as TrainingGoal,
      weeklyPlan: days.map(d => ({
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
            tempo: e.tempo,
            notes: e.notes,
          })),
        })),
      })),
      trainingDaysPerWeek: daysPerWeek,
      selectedDays: days.map(d => d.scheduledDay).filter(Boolean) as any[],
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
    
    // Create calendar events for scheduled sessions
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    
    const startD = new Date(startDate);
    const todayDow = startD.getDay();
    
    for (let week = 0; week < actualWeeks; week++) {
      days.forEach(day => {
        if (!day.scheduledDay) return;
        const targetDow = dayMap[day.scheduledDay] ?? 1;
        let daysUntil = targetDow - todayDow;
        if (daysUntil < 0) daysUntil += 7;
        
        const eventDate = new Date(startD);
        eventDate.setDate(eventDate.getDate() + daysUntil + (week * 7));
        const dateStr = eventDate.toISOString().split('T')[0];
        
        const totalEx = day.blocks.reduce((s, b) => s + b.exercises.length, 0);
        
        addCalendarEvent({
          title: day.label,
          type: 'workout',
          date: dateStr,
          startTime: '07:00',
          endTime: '08:00',
          clientId: targetClientId,
          trainerId: user.id,
          status: 'scheduled',
          notes: `${totalEx} exercises • ${programName || 'Custom Program'}`,
        });
      });
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
    
    setShowSaveDialog(false);
    toast.success(`Program created! ${actualWeeks * daysPerWeek} sessions scheduled.`);
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
                              <p className="text-sm text-white font-medium truncate">{ex.exerciseName}</p>
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
                                const newSets = prompt('Sets:', String(ex.sets));
                                const newReps = prompt('Reps:', ex.reps);
                                const newRest = prompt('Rest:', ex.rest);
                                if (newSets || newReps || newRest) {
                                  updateExercise(block.id, ex.id, {
                                    ...(newSets ? { sets: parseInt(newSets) || ex.sets } : {}),
                                    ...(newReps ? { reps: newReps } : {}),
                                    ...(newRest ? { rest: newRest } : {}),
                                  });
                                }
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
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Assign Days to Weekdays</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {days.map((day, i) => (
                  <div key={day.id} className="flex items-center gap-3">
                    <span className="text-sm text-white w-24 truncate">{day.label}</span>
                    <Select
                      value={day.scheduledDay || ''}
                      onValueChange={v => setDays(prev => prev.map((d, idx) => idx === i ? { ...d, scheduledDay: v as Weekday } : d))}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs flex-1">
                        <SelectValue placeholder="Pick day..." />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {WEEKDAYS.map(wd => (
                          <SelectItem key={wd} value={wd} className="capitalize">{wd}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] text-gray-500">
                      {day.blocks.reduce((s, b) => s + b.exercises.length, 0)} ex
                    </span>
                  </div>
                ))}
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
                    <p className="text-xs text-gray-400">Workouts will cycle in order. Client sees &quot;Next Workout&quot; and can do it on any day.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {days.map((day, i) => (
                    <div key={day.id} className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg">
                      <span className="text-xs text-gray-500 w-6">{i + 1}.</span>
                      <span className="text-sm text-white flex-1">{day.label}</span>
                      <span className="text-[10px] text-gray-500">{day.blocks.reduce((s, b) => s + b.exercises.length, 0)} exercises</span>
                    </div>
                  ))}
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
                    <Badge className="text-[10px] bg-sky-500/20 text-sky-300 border-0">{daysPerWeek}×/wk</Badge>
                    <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-0">{actualWeeks} weeks</Badge>
                    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-0">{allDaysTotalEx} exercises</Badge>
                    <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-0">{actualWeeks * daysPerWeek} sessions</Badge>
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
              This will create {actualWeeks * daysPerWeek} calendar events over {actualWeeks} weeks.
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
