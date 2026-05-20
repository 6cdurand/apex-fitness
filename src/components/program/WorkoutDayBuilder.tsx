'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CreateFolderDialog } from '@/components/program/CreateFolderDialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExerciseImage } from '@/components/ExerciseImage';
import { ExerciseHowTo } from '@/components/ExerciseHowTo';
import {
  Plus,
  Trash2,
  GripVertical,
  Edit2,
  Save,
  Flame,
  Dumbbell,
  RotateCcw,
  Search,
  X,
  Target,
  Heart,
  ArrowLeftRight,
  Eye,
  ChevronDown,
  Link,
  Link2,
  TrendingDown,
  ChevronUp,
  Clock,
  // v14-D23: Block Library icons (ported from /workout/builder)
  BookmarkPlus,
  FolderPlus,
  MoreVertical,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BlockType } from '@/types';
import { filterExercisesBySearch, getExerciseUsageCounts, exerciseLibraryMap } from '@/lib/exercises';
import { searchExercises } from '@/lib/exerciseSearch';
import { getSwapSuggestions, getDirectSwaps } from '@/lib/exerciseRelations';
import { useWorkoutStore, useTrainerStore, useAuthStore } from '@/lib/store';
import { TEMPO_PRESETS, REST_PRESETS } from '@/lib/workoutEstimator';

// Types matching workout builder
interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  movementPattern: string;
  sets: number;
  reps: string;
  repType: 'reps' | 'time';
  rest: string;
  tempo?: string;
  notes?: string;
  setStyle: 'fixed' | 'pyramid' | 'reverse-pyramid' | '5x5' | 'drop-set' | 'amrap';
  setDetails?: string[];
  // v14-D6: superset grouping
  groupId?: string;
  groupType?: 'superset' | 'triset' | 'giant_set';
  groupOrder?: string;
  // v14-D6: planned drop-set follow-up steps
  dropSetSteps?: Array<{
    id: string;
    dropType: 'weight' | 'reps';
    amount: string;
    notes?: string;
  }>;
  // v14-D15a: cardio-specific fields (mode-gated by isCardio || movementPattern === 'cardio')
  isCardio?: boolean;
  cardioType?: 'distance' | 'time' | 'intervals';
  distance?: string;
  distanceUnit?: 'km' | 'mi' | 'm';
  targetTime?: string;
  intervals?: number;
  intervalWork?: string;
  intervalRest?: string;
}

interface WorkoutBlock {
  id: string;
  type: BlockType;
  name: string;
  exercises: WorkoutExercise[];
  circuitStyle?: 'rounds' | 'amrap' | 'emom' | 'forTime' | 'tabata';
  rounds?: number;
  roundDuration?: string;
  restBetweenRounds?: string;
  targetTime?: string;
  workInterval?: string;
  restInterval?: string;
  sequenceMode?: boolean;
}

export interface WorkoutDayBuilderProps {
  blocks: WorkoutBlock[];
  onBlocksChange: (blocks: WorkoutBlock[]) => void;
  dayLabel?: string;
  /**
   * v14-D23: When true (default), the component renders the full Block Library
   * affordances: "ð Block Library" button in the Add Block row, the
   * "Save to Block Library" item on each block's kebab menu, and all related
   * dialogs (Save / Replace / Library list / Folder create / Delete confirm).
   * Pass false to mount a stripped-down builder (e.g. legacy callers that
   * don't want the saved-block surface).
   */
  enableBlockLibrary?: boolean;
  /**
   * v14-D24: When true (default), the component renders the Training Phase
   * selector above the Add Block row. The selector lets the trainer mass-apply
   * sets/reps/rest across all exercises in the day (Strength / Hypertrophy /
   * Power / Endurance / Deload). Switching back to "No Phase" restores the
   * config that was active before any phase was applied. /program/builder
   * mounts one builder per day, so each day gets its own independent selector.
   */
  enablePhaseSelector?: boolean;
  targetUserId?: string;
  /**
   * v14-D19: Optional empty-state slot rendered ABOVE the "Add Block" chips when
   * blocks.length === 0. Used by /workout/builder to surface its template picker;
   * /program/builder doesn't pass this and gets the bare empty state.
   */
  emptyStateSlot?: React.ReactNode;
}

const BLOCK_TYPES: { value: BlockType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'warmup', label: 'Warm-up', icon: <Flame className="h-4 w-4 text-yellow-500" />, color: 'yellow' },
  { value: 'work', label: 'Strength', icon: <Dumbbell className="h-4 w-4 text-blue-400" />, color: 'blue' },
  { value: 'circuit', label: 'Circuit', icon: <Target className="h-4 w-4 text-orange-400" />, color: 'orange' },
  { value: 'cardio', label: 'Cardio', icon: <Heart className="h-4 w-4 text-green-500" />, color: 'green' },
  { value: 'cooldown', label: 'Cool-down', icon: <RotateCcw className="h-4 w-4 text-purple-500" />, color: 'purple' },
];

// v14-D24: Training phases ported from /workout/builder. Used by the optional
// Training Phase selector to mass-apply sets/reps/rest to all exercises.
const TRAINING_PHASES = [
  { id: 'none', name: 'No Phase', sets: 3, reps: '8-12', rest: '60s', description: 'Custom configuration' },
  { id: 'strength', name: 'Strength', sets: 5, reps: '3-5', rest: '180s', description: 'Heavy weight, low reps, long rest' },
  { id: 'hypertrophy', name: 'Hypertrophy', sets: 4, reps: '8-12', rest: '90s', description: 'Moderate weight, muscle growth focus' },
  { id: 'power', name: 'Power', sets: 5, reps: '1-3', rest: '180s', description: 'Explosive movements, very heavy' },
  { id: 'endurance', name: 'Endurance', sets: 3, reps: '15-20', rest: '45s', description: 'Light weight, high reps, short rest' },
  { id: 'deload', name: 'Deload', sets: 2, reps: '10-12', rest: '60s', description: 'Recovery week, reduced volume' },
];

const SET_STYLES = [
  { id: 'fixed', name: 'Fixed', description: 'Same reps each set', icon: '⬜' },
  { id: 'pyramid', name: 'Pyramid', description: '12→10→8→6', icon: '🔺' },
  { id: 'reverse-pyramid', name: 'Rev Pyramid', description: '6→8→10→12', icon: '🔻' },
  { id: '5x5', name: '5×5', description: '5 sets of 5', icon: '5️⃣' },
  { id: 'drop-set', name: 'Drop Set', description: 'No rest between', icon: '⬇️' },
  { id: 'amrap', name: 'AMRAP', description: 'Max reps', icon: '♾️' },
];

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
  { id: 'foam-roll-quads', name: 'Foam Roll Quads', pattern: 'warmup' },
  { id: 'treadmill-run', name: 'Treadmill Run', pattern: 'cardio' },
  { id: 'rowing-machine', name: 'Rowing Machine', pattern: 'cardio' },
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

export function WorkoutDayBuilder({
  blocks,
  onBlocksChange,
  dayLabel,
  enableBlockLibrary = true,
  enablePhaseSelector = true,
  targetUserId,
  emptyStateSlot,
}: WorkoutDayBuilderProps) {
  const { workoutHistory } = useWorkoutStore();
  // v14-D23: Block Library data layer is sourced from trainerStore so the
  // same saved-block list shows up on /workout/builder and /program/builder.
  const {
    savedBlocks,
    saveBlock,
    deleteBlock,
    loadFromSupabase,
    blockPerformances,
    getBestBlockPerformance,
  } = useTrainerStore();
  
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [editingExercise, setEditingExercise] = useState<{ blockId: string; exercise: WorkoutExercise } | null>(null);
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  // v14-D15a: swap panel filters for All Exercises tab
  const [exerciseFilters, setExerciseFilters] = useState<{
    muscleGroup: string[];
    equipment: string[];
  }>({ muscleGroup: [], equipment: [] });
  // v14-D6: superset picker state
  const [supersetSource, setSupersetSource] = useState<{ blockId: string; exerciseId: string } | null>(null);

  // v14-D23: Block Library state — ported verbatim from /workout/builder so
  // both pages share one Block Library surface. All gated by `enableBlockLibrary`
  // at render time; on /program/builder this prop now flips to true.
  const [showBlockLibraryDialog, setShowBlockLibraryDialog] = useState(false);
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null);
  const [isSyncingBlocks, setIsSyncingBlocks] = useState(false);
  const [showSaveBlockDialog, setShowSaveBlockDialog] = useState(false);
  const [blockLibraryName, setBlockLibraryName] = useState('');
  const [blockLibraryFolder, setBlockLibraryFolder] = useState('');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [blockLibraryFilter, setBlockLibraryFilter] = useState<BlockType | 'all'>('all');
  const [blockFolderFilter, setBlockFolderFilter] = useState<string>('all');
  const [blockLibrarySearch, setBlockLibrarySearch] = useState('');
  const [showReplaceBlockDialog, setShowReplaceBlockDialog] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<any>(null);
  const [existingBlockToReplace, setExistingBlockToReplace] = useState<string | null>(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [moveTargetBlockId, setMoveTargetBlockId] = useState<string | null>(null);

  // v14-D24: Training Phase state — ported from /workout/builder.
  // `previousPhaseConfig` snapshots the (sets, reps, rest) of the first
  // exercise in the first block right before a phase is applied, so toggling
  // back to "No Phase" can restore that single source-of-truth config across
  // all exercises. (The page-level original applied the same restore.)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('none');
  const [previousPhaseConfig, setPreviousPhaseConfig] = useState<{ sets: number; reps: string; rest: string } | null>(null);
  const selectedPhase = TRAINING_PHASES.find(p => p.id === selectedPhaseId);

  const applyPhaseToExercises = (phaseId: string) => {
    const phase = TRAINING_PHASES.find(p => p.id === phaseId);
    if (!phase || phaseId === 'none') return;

    if (blocks.length > 0 && blocks[0].exercises.length > 0) {
      const firstEx = blocks[0].exercises[0];
      setPreviousPhaseConfig({ sets: firstEx.sets, reps: firstEx.reps, rest: firstEx.rest });
    }

    onBlocksChange(blocks.map(block => ({
      ...block,
      exercises: block.exercises.map(ex => ({
        ...ex,
        sets: phase.sets,
        reps: phase.reps,
        rest: phase.rest,
      })),
    })));
  };

  const restorePreviousConfig = () => {
    if (!previousPhaseConfig) return;
    onBlocksChange(blocks.map(block => ({
      ...block,
      exercises: block.exercises.map(ex => ({
        ...ex,
        sets: previousPhaseConfig.sets,
        reps: previousPhaseConfig.reps,
        rest: previousPhaseConfig.rest,
      })),
    })));
    setPreviousPhaseConfig(null);
  };

  const handlePhaseChange = (newPhaseId: string) => {
    if (newPhaseId === 'none' && selectedPhaseId !== 'none') {
      restorePreviousConfig();
    } else if (newPhaseId !== 'none') {
      applyPhaseToExercises(newPhaseId);
    }
    setSelectedPhaseId(newPhaseId);
  };

  const exerciseUsageCounts = useMemo(() => {
    if (!targetUserId) return {};
    return getExerciseUsageCounts(workoutHistory, targetUserId);
  }, [workoutHistory, targetUserId]);
  
  const sortBlocks = (blocksToSort: WorkoutBlock[]): WorkoutBlock[] => {
    const order: Record<BlockType, number> = { warmup: 0, work: 1, cardio: 2, circuit: 3, cooldown: 4 };
    return [...blocksToSort].sort((a, b) => order[a.type] - order[b.type]);
  };
  
  const addBlock = (type: BlockType) => {
    const newBlock: WorkoutBlock = {
      id: `block-${Date.now()}`,
      type,
      name: type === 'warmup' ? 'Warm-up' : type === 'cooldown' ? 'Cool-down' : type === 'circuit' ? 'Circuit' : 'Strength',
      exercises: [],
      ...((type === 'warmup' || type === 'cooldown') && { sequenceMode: true }),
      ...(type === 'circuit' && { rounds: 3, roundDuration: '5min', restBetweenRounds: '60s' }),
    };
    onBlocksChange(sortBlocks([...blocks, newBlock]));
  };
  
  const removeBlock = (blockId: string) => {
    onBlocksChange(blocks.filter(b => b.id !== blockId));
  };
  
  const updateBlockName = (blockId: string, name: string) => {
    onBlocksChange(blocks.map(b => b.id === blockId ? { ...b, name } : b));
  };
  
  const addExercise = (blockId: string, exercise: { id: string; name: string; pattern: string }) => {
    const isTimeBased = exercise.pattern === 'warmup' || exercise.pattern === 'cardio';
    const block = blocks.find(b => b.id === blockId);
    const isCircuitBlock = block?.type === 'circuit';
    
    const newExercise: WorkoutExercise = {
      id: `ex-${Date.now()}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      movementPattern: exercise.pattern,
      sets: isCircuitBlock ? 1 : 3,
      reps: isTimeBased ? '30s' : '8-12',
      repType: isTimeBased ? 'time' : 'reps',
      rest: isCircuitBlock ? '0s' : '60s',
      setStyle: 'fixed',
    };
    
    onBlocksChange(blocks.map(b => 
      b.id === blockId ? { ...b, exercises: [...b.exercises, newExercise] } : b
    ));
    setShowAddExercise(null);
    setExerciseSearch('');
  };
  
  const removeExercise = (blockId: string, exerciseId: string) => {
    onBlocksChange(blocks.map(b => 
      b.id === blockId ? { ...b, exercises: b.exercises.filter(e => e.id !== exerciseId) } : b
    ));
  };
  
  const updateExercise = (blockId: string, exerciseId: string, updates: Partial<WorkoutExercise>) => {
    onBlocksChange(blocks.map(b => 
      b.id === blockId 
        ? { ...b, exercises: b.exercises.map(e => e.id === exerciseId ? { ...e, ...updates } : e) }
        : b
    ));
  };
  
  const saveExerciseEdit = () => {
    if (!editingExercise) return;
    updateExercise(editingExercise.blockId, editingExercise.exercise.id, editingExercise.exercise);
    setEditingExercise(null);
  };

  // v14-D6: drop-set and superset handlers
  const handleAddDropSetStep = (blockId: string, exerciseId: string) => {
    onBlocksChange(blocks.map(b => b.id !== blockId ? b : {
      ...b,
      exercises: b.exercises.map(e => e.id !== exerciseId ? e : {
        ...e,
        dropSetSteps: [
          ...(e.dropSetSteps ?? []),
          { id: crypto.randomUUID(), dropType: 'weight' as const, amount: '-10kg' },
        ],
      }),
    }));
  };

  const openSupersetPicker = (blockId: string, sourceExerciseId: string) => {
    setSupersetSource({ blockId, exerciseId: sourceExerciseId });
  };

  const handlePairSuperset = (targetExerciseId: string) => {
    if (!supersetSource) return;
    const { blockId, exerciseId: sourceId } = supersetSource;
    const groupId = `superset-${Date.now()}`;
    onBlocksChange(blocks.map(b => b.id !== blockId ? b : {
      ...b,
      exercises: b.exercises.map(e => {
        if (e.id === sourceId) return { ...e, groupId, groupType: 'superset' as const, groupOrder: 'A1' };
        if (e.id === targetExerciseId) return { ...e, groupId, groupType: 'superset' as const, groupOrder: 'A2' };
        return e;
      }),
    }));
    setSupersetSource(null);
    toast.success('Superset created.');
  };

  const handleRemoveFromSuperset = (blockId: string, exerciseId: string) => {
    const block = blocks.find(b => b.id === blockId);
    const sourceEx = block?.exercises.find(e => e.id === exerciseId);
    if (!sourceEx?.groupId) return;
    const sharedGroupId = sourceEx.groupId;
    onBlocksChange(blocks.map(b => b.id !== blockId ? b : {
      ...b,
      exercises: b.exercises.map(e => e.groupId === sharedGroupId
        ? { ...e, groupId: undefined, groupType: undefined, groupOrder: undefined }
        : e),
    }));
    toast.success('Superset removed.');
  };

  const updateDropSetStep = (blockId: string, exerciseId: string, stepId: string, patch: Partial<{ dropType: 'weight' | 'reps'; amount: string; notes?: string }>) => {
    onBlocksChange(blocks.map(b => b.id !== blockId ? b : {
      ...b,
      exercises: b.exercises.map(e => e.id !== exerciseId ? e : {
        ...e,
        dropSetSteps: (e.dropSetSteps ?? []).map(s => s.id === stepId ? { ...s, ...patch } : s),
      }),
    }));
  };

  const removeDropSetStep = (blockId: string, exerciseId: string, stepId: string) => {
    onBlocksChange(blocks.map(b => b.id !== blockId ? b : {
      ...b,
      exercises: b.exercises.map(e => e.id !== exerciseId ? e : {
        ...e,
        dropSetSteps: (e.dropSetSteps ?? []).filter(s => s.id !== stepId),
      }),
    }));
  };

  // Edit 4: Exercise reorder handlers
  const handleMoveExercise = (blockId: string, exerciseId: string, direction: 'up' | 'down') => {
    onBlocksChange(blocks.map(b => {
      if (b.id !== blockId) return b;
      const arr = [...b.exercises];
      const idx = arr.findIndex(e => e.id === exerciseId);
      if (idx < 0) return b;
      const ex = arr[idx];

      // Group-aware: if in a superset, move the WHOLE group as one unit.
      let groupIdxs = [idx];
      if (ex.groupId) {
        groupIdxs = arr.map((e, i) => e.groupId === ex.groupId ? i : -1).filter(i => i >= 0);
      }
      const groupItems = groupIdxs.map(i => arr[i]);
      const before = Math.min(...groupIdxs);
      const after = Math.max(...groupIdxs);

      if (direction === 'up' && before === 0) return b;
      if (direction === 'down' && after === arr.length - 1) return b;

      // Swap target index — if it's in a superset, jump over the whole partner group.
      const swapIdx = direction === 'up' ? before - 1 : after + 1;
      const swapWith = arr[swapIdx];
      let swapGroupIdxs = [swapIdx];
      if (swapWith.groupId) {
        swapGroupIdxs = arr.map((e, i) => e.groupId === swapWith.groupId ? i : -1).filter(i => i >= 0);
      }
      const swapItems = swapGroupIdxs.map(i => arr[i]);

      const remaining = arr.filter((_, i) => !groupIdxs.includes(i) && !swapGroupIdxs.includes(i));
      const insertAt = direction === 'up' ? Math.min(...swapGroupIdxs) : Math.min(...groupIdxs);
      const reordered = [
        ...remaining.slice(0, insertAt),
        ...(direction === 'up' ? [...groupItems, ...swapItems] : [...swapItems, ...groupItems]),
        ...remaining.slice(insertAt),
      ];
      return { ...b, exercises: reordered };
    }));
  };

  const isFirstExerciseInBlock = (exercise: WorkoutExercise, targetBlock: WorkoutBlock) => {
    if (exercise.groupId) {
      const groupIdxs = targetBlock.exercises
        .map((e: WorkoutExercise, i: number) => e.groupId === exercise.groupId ? i : -1)
        .filter((i: number) => i >= 0);
      return groupIdxs.length > 0 && Math.min(...groupIdxs) === 0;
    }
    return targetBlock.exercises[0]?.id === exercise.id;
  };

  const isLastExerciseInBlock = (exercise: WorkoutExercise, targetBlock: WorkoutBlock) => {
    if (exercise.groupId) {
      const groupIdxs = targetBlock.exercises
        .map((e: WorkoutExercise, i: number) => e.groupId === exercise.groupId ? i : -1)
        .filter((i: number) => i >= 0);
      return groupIdxs.length > 0 && Math.max(...groupIdxs) === targetBlock.exercises.length - 1;
    }
    return targetBlock.exercises[targetBlock.exercises.length - 1]?.id === exercise.id;
  };

  // Edit 1: Order exercises so superset pairs render adjacent
  const orderExercisesForRender = (exercises: WorkoutExercise[]) => {
    const remaining = [...exercises];
    const out: typeof remaining = [];
    while (remaining.length > 0) {
      const head = remaining.shift()!;
      out.push(head);
      if (head.groupId && head.groupOrder === 'A1') {
        const partners = remaining
          .filter(e => e.groupId === head.groupId)
          .sort((a, b) => (a.groupOrder ?? '').localeCompare(b.groupOrder ?? ''));
        for (const p of partners) {
          out.push(p);
          remaining.splice(remaining.indexOf(p), 1);
        }
      }
    }
    return out;
  };

  // Edit 2: Extract exercise card body helper
  const renderExerciseCardBody = (ex: WorkoutExercise, block: WorkoutBlock) => {
    const exIdx = block.exercises.findIndex(e => e.id === ex.id);
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors">
          <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 cursor-grab" />
          
          {/* Exercise image */}
          <div className="w-10 h-10 flex-shrink-0">
            <ExerciseImage
              exerciseId={ex.exerciseId}
              size="sm"
              className="rounded-md"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-white font-medium truncate">{ex.exerciseName}</p>
              <ExerciseHowTo exerciseId={ex.exerciseId} exerciseName={ex.exerciseName} />
            </div>
            <p className="text-xs text-gray-200 mt-0.5">
              {ex.sets} × {ex.reps} {ex.repType === 'time' ? '' : 'reps'} · {ex.rest} rest
            </p>
          </div>
          
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Edit 4: Up/down reorder buttons */}
            <div className="flex flex-col gap-0 mr-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-300 hover:text-white disabled:opacity-30"
                title="Move up"
                disabled={isFirstExerciseInBlock(ex, block)}
                onClick={() => handleMoveExercise(block.id, ex.id, 'up')}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-300 hover:text-white disabled:opacity-30"
                title="Move down"
                disabled={isLastExerciseInBlock(ex, block)}
                onClick={() => handleMoveExercise(block.id, ex.id, 'down')}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-300 hover:text-amber-400"
                        title="Link to another exercise">
                  <Link className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAddDropSetStep(block.id, ex.id)}>
                  <ChevronDown className="w-4 h-4 mr-2 text-orange-400" />
                  Add drop set step
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openSupersetPicker(block.id, ex.id)}
                                  disabled={!!ex.groupId}>
                  <ArrowLeftRight className="w-4 h-4 mr-2 text-amber-400" />
                  {ex.groupId ? 'Already in superset' : 'Superset with…'}
                </DropdownMenuItem>
                {ex.groupId && (
                  <DropdownMenuItem onClick={() => handleRemoveFromSuperset(block.id, ex.id)}>
                    <X className="w-4 h-4 mr-2 text-red-400" />
                    Remove from superset
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-300 hover:text-sky-400"
              onClick={() => {
                setEditingExercise({ blockId: block.id, exercise: { ...ex } });
                setShowSwapPanel(false);
              }}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-300 hover:text-red-400"
              onClick={() => removeExercise(block.id, ex.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Edit 3: Beefed-up drop-set pots rendering */}
        {(ex.dropSetSteps?.length ?? 0) > 0 && (
          <div className="mt-2 ml-12 mr-3 mb-2.5 space-y-1.5">
            {ex.dropSetSteps!.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-500/15 border border-orange-500/40 shadow-inner"
              >
                <TrendingDown className="w-4 h-4 text-orange-300 flex-shrink-0" />
                <span className="text-[10px] font-bold text-orange-200 uppercase tracking-wider min-w-[44px]">
                  Drop {idx + 1}
                </span>
                <Select
                  value={step.dropType}
                  onValueChange={(v) => updateDropSetStep(block.id, ex.id, step.id, { dropType: v as 'weight' | 'reps' })}
                >
                  <SelectTrigger className="h-7 w-28 text-xs bg-orange-950/50 border-orange-500/40 text-orange-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight">Drop weight</SelectItem>
                    <SelectItem value="reps">Drop to reps</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={step.amount}
                  onChange={(e) => updateDropSetStep(block.id, ex.id, step.id, { amount: e.target.value })}
                  className="h-7 w-24 text-xs bg-orange-950/50 border-orange-500/40 text-orange-100 placeholder:text-orange-300/40"
                  placeholder={step.dropType === 'weight' ? '-10kg' : '5'}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-auto text-orange-300 hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => removeDropSetStep(block.id, ex.id, step.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };
  
  const currentBlock = showAddExercise ? blocks.find(b => b.id === showAddExercise) : null;
  
  const filteredExercises = useMemo(() => {
    if (exerciseSearch.trim()) {
      return searchExercises(exerciseSearch, { blockType: currentBlock?.type ?? null }).map(ex => ({
        id: ex.id,
        name: ex.name,
        pattern: ex.category as string,
      }));
    }
    return filterExercisesBySearch(COMMON_EXERCISES, '', currentBlock?.type || null);
  }, [exerciseSearch, currentBlock]);
  
  // Swap suggestions
  const swapExercise = editingExercise && !showSwapPanel ? null : editingExercise?.exercise;
  const swapSuggestions = useMemo(() => {
    if (!swapExercise) return { samePattern: [], similarPattern: [] };
    const samePattern = getDirectSwaps(swapExercise.exerciseId).map((rel: any) => rel.id);
    const allSuggestions = getSwapSuggestions(swapExercise.exerciseId);
    const similarPattern = allSuggestions.similarMovement
      .map((rel: any) => rel.id)
      .filter((id: string) => !samePattern.includes(id));
    return { samePattern, similarPattern };
  }, [swapExercise]);
  
  const handleSwap = (newExerciseId: string) => {
    if (!editingExercise) return;
    const newExercise = exerciseLibraryMap.get(newExerciseId);
    if (!newExercise) return;
    
    updateExercise(editingExercise.blockId, editingExercise.exercise.id, {
      exerciseId: newExerciseId,
      exerciseName: newExercise.name,
      movementPattern: newExercise.category,
    });
    
    setEditingExercise(null);
    setSwapSearch('');
    toast.success(`Swapped to ${newExercise.name}`);
  };
  
  const swapFilteredExercises = useMemo(() => {
    if (swapSearch.trim()) {
      return searchExercises(swapSearch, {}).map(ex => ({ id: ex.id, name: ex.name, pattern: ex.category }));
    }
    return [];
  }, [swapSearch]);

  // v14-D23: Block Library handlers (ported from /workout/builder).
  // These all read/write through the trainerStore destructured at the top of
  // the component and through `blocks`/`onBlocksChange` props — NO direct
  // setBlocks calls (the page mounting the component owns the canonical list).
  const handleSaveBlock = (forceReplace = false) => {
    if (!blockLibraryName.trim() || !activeBlockId) {
      toast.error('Please enter a block name');
      return;
    }
    const block = blocks.find(b => b.id === activeBlockId);
    if (!block) return;

    // Check for an existing block with the same (case-insensitive) name.
    const existingBlock = savedBlocks.find(
      (b: any) => b.name.toLowerCase() === blockLibraryName.trim().toLowerCase()
    );
    if (existingBlock && !forceReplace) {
      setExistingBlockToReplace(existingBlock.id);
      setShowReplaceBlockDialog(true);
      return;
    }
    if (existingBlock && forceReplace) {
      deleteBlock(existingBlock.id);
    }

    saveBlock({
      name: blockLibraryName,
      type: block.type,
      folder: blockLibraryFolder.trim() || undefined,
      exercises: block.exercises.map(ex => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        sets: ex.sets,
        reps: ex.reps,
        repType: ex.repType,
        rest: ex.rest,
        tempo: ex.tempo,
        notes: ex.notes,
        setStyle: ex.setStyle,
      })),
      circuitStyle: block.circuitStyle,
      circuitRounds: block.rounds,
      circuitDuration: block.roundDuration ? parseInt(block.roundDuration) * 60 : undefined,
      circuitRestBetween: block.restBetweenRounds ? parseInt(block.restBetweenRounds) : undefined,
    });

    toast.success(
      forceReplace
        ? `"${blockLibraryName}" replaced in block library!`
        : `"${blockLibraryName}" saved to block library!`
    );
    setShowSaveBlockDialog(false);
    setShowReplaceBlockDialog(false);
    setBlockLibraryName('');
    setBlockLibraryFolder('');
    setActiveBlockId(null);
    setExistingBlockToReplace(null);
  };

  const handleReplaceBlock = () => {
    handleSaveBlock(true);
  };

  const handleCancelReplace = () => {
    setShowReplaceBlockDialog(false);
    setExistingBlockToReplace(null);
  };

  const handleSyncBlockLibrary = async () => {
    setIsSyncingBlocks(true);
    try {
      const { syncSavedBlockToSupabase } = await import('@/lib/supabaseSync');
      const trainerId = useAuthStore.getState().user?.id;
      if (!trainerId) {
        toast.error('Please log in to sync blocks');
        return;
      }
      // Push every local saved block, then re-pull canonical list.
      for (const block of savedBlocks) {
        await syncSavedBlockToSupabase({
          id: block.id,
          name: block.name,
          type: block.type,
          trainerId: block.trainerId,
          exercises: block.exercises,
          circuitStyle: block.circuitStyle,
          circuitRounds: block.circuitRounds,
          circuitDuration: block.circuitDuration,
          circuitRestBetween: block.circuitRestBetween,
          createdAt: block.createdAt,
          updatedAt: block.updatedAt,
        });
      }
      await loadFromSupabase(trainerId);
      toast.success('Block library synced!');
    } catch (error) {
      console.error('Error syncing blocks:', error);
      toast.error('Failed to sync blocks');
    } finally {
      setIsSyncingBlocks(false);
    }
  };

  const handleLoadBlock = (savedBlock: typeof savedBlocks[0]) => {
    const newBlock: WorkoutBlock = {
      id: `block-${Date.now()}`,
      type: savedBlock.type,
      name: savedBlock.name,
      exercises: savedBlock.exercises.map((ex: any) => ({
        ...ex,
        id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        movementPattern: ex.movementPattern || 'compound',
        repType: ex.repType || 'reps',
        setStyle: ex.setStyle || 'fixed',
      })),
      circuitStyle: savedBlock.circuitStyle,
      rounds: savedBlock.circuitRounds,
      roundDuration: savedBlock.circuitDuration ? `${Math.floor(savedBlock.circuitDuration / 60)}min` : undefined,
      restBetweenRounds: savedBlock.circuitRestBetween ? `${savedBlock.circuitRestBetween}s` : undefined,
    };
    onBlocksChange(sortBlocks([...blocks, newBlock]));
    // Keep dialog open so the trainer can stack multiple blocks at once.
    toast.success(`Added "${savedBlock.name}" block`);
  };

  return (
    <div className="space-y-4">
      {dayLabel && (
        <div className="text-sm text-gray-400 font-medium">{dayLabel}</div>
      )}

      {/* v14-D24: Training Phase selector — ported from /workout/builder.
          Default-on. Lives at the very top of the day's builder so it acts as
          a header-level switch. Each <WorkoutDayBuilder> mount has its own
          phase state, which means /program/builder Build Days gets one
          independent selector per day. */}
      {enablePhaseSelector && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <Label className="mb-2 block">Training Phase</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecting a phase will auto-configure sets, reps, and rest for all exercises
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRAINING_PHASES.map((phase) => (
                <Button
                  key={phase.id}
                  variant={selectedPhaseId === phase.id ? 'default' : 'outline'}
                  className={`h-auto py-2 px-3 flex-col items-start ${
                    selectedPhaseId === phase.id
                      ? phase.id === 'strength' ? 'bg-red-500 hover:bg-red-600'
                      : phase.id === 'hypertrophy' ? 'bg-blue-500 hover:bg-blue-600'
                      : phase.id === 'power' ? 'bg-purple-500 hover:bg-purple-600'
                      : phase.id === 'endurance' ? 'bg-orange-500 hover:bg-orange-600'
                      : phase.id === 'deload' ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gray-500 hover:bg-gray-600'
                      : ''
                  }`}
                  onClick={() => handlePhaseChange(phase.id)}
                >
                  <span className="font-medium">{phase.name}</span>
                  {phase.id !== 'none' && (
                    <span className="text-xs opacity-80">{phase.sets}×{phase.reps} • {phase.rest}</span>
                  )}
                </Button>
              ))}
            </div>
            {selectedPhaseId !== 'none' && (
              <p className="text-xs text-sky-400 mt-2">
                ✓ {selectedPhase?.description}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Block row */}
      {/* v14-D23: This is the SINGLE Add Block row visible on /workout/builder
          and /program/builder. The Block Library button is appended here when
          enableBlockLibrary === true so the duplicate page-level row that used
          to exist on /workout/builder is gone. */}
      <div className="flex gap-1 flex-wrap items-center">
        <span className="text-xs text-gray-400 mr-1">Add Block:</span>
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
        {enableBlockLibrary && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBlockLibraryDialog(true)}
            className="h-8 text-xs gap-1 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
          >
            📚 Block Library{savedBlocks.length > 0 && ` (${savedBlocks.length})`}
          </Button>
        )}
      </div>
      
      {/* Blocks */}
      {blocks.length === 0 && (
        <>
          {emptyStateSlot && <div className="mb-4">{emptyStateSlot}</div>}
          <Card className="bg-gray-900/50 border-gray-800 border-dashed">
            <CardContent className="p-8 text-center">
              <Dumbbell className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Add a block to start building this {dayLabel || 'workout'}</p>
            </CardContent>
          </Card>
        </>
      )}
      
      {blocks.map((block) => {
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
                    onChange={e => updateBlockName(block.id, e.target.value)}
                    className="bg-transparent border-none text-white text-sm font-medium h-7 p-0 focus-visible:ring-0"
                  />
                  <Badge className={`text-[10px] ${styles.badge} border flex-shrink-0`}>
                    {block.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* v14-D23: Per-block kebab — currently hosts the
                      "Save to Block Library" affordance, gated by
                      enableBlockLibrary. Future block-level actions can land
                      in this menu. */}
                  {enableBlockLibrary && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-purple-400"
                          title="Block actions"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setActiveBlockId(block.id);
                            setBlockLibraryName(block.name);
                            setBlockLibraryFolder('');
                            setShowSaveBlockDialog(true);
                          }}
                        >
                          <BookmarkPlus className="w-4 h-4 mr-2 text-purple-400" />
                          Save to Block Library
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
              
              <div className="bg-gray-900/60">
                {/* Exercise list - Edit 2: Group superset pairs with visual treatment */}
                <div className="divide-y divide-white/5">
                  {(() => {
                    const ordered = orderExercisesForRender(block.exercises);
                    const out: React.ReactNode[] = [];
                    let i = 0;
                    while (i < ordered.length) {
                      const ex = ordered[i];
                      if (ex.groupId && ex.groupType === 'superset') {
                        const group = [ex];
                        let j = i + 1;
                        while (j < ordered.length && ordered[j].groupId === ex.groupId) {
                          group.push(ordered[j]);
                          j++;
                        }
                        out.push(
                          <div
                            key={`superset-${ex.groupId}`}
                            className="relative rounded-lg ring-2 ring-amber-500/40 bg-amber-500/5 mx-2 my-3 px-2 pt-3 pb-1"
                          >
                            {/* SUPERSET badge ribbon */}
                            <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-amber-500 text-gray-900 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1 shadow">
                              <Link2 className="w-3 h-3" />
                              Superset — {group.length} exercises
                            </div>
                            <div className="space-y-1">
                              {group.map((member, idx) => (
                                <React.Fragment key={member.id}>
                                  <div className="flex items-center gap-2 px-1 mb-0.5">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/25 text-amber-300 font-bold text-[11px] flex-shrink-0">
                                      {member.groupOrder ?? `A${idx + 1}`}
                                    </span>
                                    <span className="text-[10px] text-amber-300/90 uppercase tracking-wider font-semibold">
                                      {member.groupOrder === 'A1' ? 'Do first' : 'Then immediately'}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="ml-auto h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                      onClick={() => handleRemoveFromSuperset(block.id, member.id)}
                                    >
                                      <X className="w-3 h-3 mr-0.5" /> Unpair
                                    </Button>
                                  </div>
                                  {/* The existing per-exercise card body, extracted into a helper */}
                                  {renderExerciseCardBody(member, block)}
                                  {/* Chain link between members */}
                                  {idx < group.length - 1 && (
                                    <div className="flex justify-center py-1.5">
                                      <div className="flex flex-col items-center gap-0.5">
                                        <Link2 className="w-5 h-5 text-amber-400" />
                                        <span className="text-[9px] text-amber-300/60 uppercase tracking-wider">linked</span>
                                      </div>
                                    </div>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        );
                        i = j;
                      } else {
                        out.push(<div key={ex.id}>{renderExerciseCardBody(ex, block)}</div>);
                        i++;
                      }
                    }
                    return out;
                  })()}
                </div>
                
                {/* Add exercise button */}
                <div className="px-3 py-2 border-t border-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-300 hover:text-white w-full"
                    onClick={() => { setShowAddExercise(block.id); setExerciseSearch(''); }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Exercise
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Add Exercise Dialog */}
      <Dialog open={!!showAddExercise} onOpenChange={() => setShowAddExercise(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={exerciseSearch}
                onChange={e => setExerciseSearch(e.target.value)}
                placeholder="Search exercises..."
                className="pl-10 bg-gray-800 border-gray-700 text-white"
                autoFocus
              />
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {filteredExercises.map(ex => {
                  const usageCount = exerciseUsageCounts[ex.id] || 0;
                  const safeEx = { id: ex.id, name: ex.name, pattern: ex.pattern || 'compound' };
                  return (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(showAddExercise!, safeEx)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
                      <ExerciseImage exerciseId={ex.id} size="sm" className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{ex.pattern}</p>
                      </div>
                      {usageCount > 0 && (
                        <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-400/50 flex-shrink-0">
                          {usageCount}× used
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Exercise Dialog */}
      <Dialog open={!!editingExercise} onOpenChange={() => { setEditingExercise(null); setShowSwapPanel(false); }}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {showSwapPanel ? 'Swap Exercise' : 'Edit Exercise'}
            </DialogTitle>
          </DialogHeader>
          
          {!showSwapPanel && editingExercise && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ExerciseImage exerciseId={editingExercise.exercise.exerciseId} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{editingExercise.exercise.exerciseName}</p>
                  <p className="text-xs text-gray-400 capitalize">{editingExercise.exercise.movementPattern}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700 text-gray-300 hover:border-sky-500 hover:text-sky-400"
                  onClick={() => setShowSwapPanel(true)}
                >
                  <ArrowLeftRight className="w-3 h-3 mr-1" /> Swap
                </Button>
              </div>
              
              {/* v14-D15a: Cardio vs Strength branch */}
              {((editingExercise.exercise.movementPattern as string) === 'cardio' || (editingExercise.exercise as any).isCardio) ? (
                /* CARDIO-SPECIFIC UI */
                <div className="space-y-4">
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-sm text-orange-400 font-medium">🏃 Cardio Exercise</p>
                    <p className="text-xs text-gray-400 mt-1">Configure distance, time, or intervals for this cardio activity</p>
                  </div>
                  
                  {/* Cardio Type Selection */}
                  <div>
                    <Label className="text-xs text-gray-400 mb-2 block">Cardio Mode</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={(editingExercise.exercise as any).cardioType === 'distance' ? 'default' : 'outline'}
                        className={(editingExercise.exercise as any).cardioType === 'distance' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                        onClick={() => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, cardioType: 'distance', isCardio: true } as any
                        })}
                      >
                        📏 Distance
                      </Button>
                      <Button
                        type="button"
                        variant={(editingExercise.exercise as any).cardioType === 'time' ? 'default' : 'outline'}
                        className={(editingExercise.exercise as any).cardioType === 'time' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        onClick={() => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, cardioType: 'time', isCardio: true } as any
                        })}
                      >
                        ⏱️ Time Only
                      </Button>
                      <Button
                        type="button"
                        variant={(editingExercise.exercise as any).cardioType === 'intervals' ? 'default' : 'outline'}
                        className={(editingExercise.exercise as any).cardioType === 'intervals' ? 'bg-purple-500 hover:bg-purple-600' : ''}
                        onClick={() => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, cardioType: 'intervals', isCardio: true } as any
                        })}
                      >
                        🔄 Intervals
                      </Button>
                    </div>
                  </div>
                  
                  {/* Distance Mode */}
                  {(editingExercise.exercise as any).cardioType === 'distance' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Distance</Label>
                        <Input
                          value={(editingExercise.exercise as any).distance || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, distance: e.target.value } as any
                          })}
                          placeholder="e.g., 5"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Unit</Label>
                        <div className="flex gap-1 mt-1">
                          {(['km', 'mi', 'm'] as const).map(unit => (
                            <Button
                              key={unit}
                              type="button"
                              size="sm"
                              variant={(editingExercise.exercise as any).distanceUnit === unit ? 'default' : 'outline'}
                              className={(editingExercise.exercise as any).distanceUnit === unit ? 'bg-orange-500 hover:bg-orange-600' : ''}
                              onClick={() => setEditingExercise({
                                ...editingExercise,
                                exercise: { ...editingExercise.exercise, distanceUnit: unit } as any
                              })}
                            >
                              {unit}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-gray-400 mb-1 block">Target Time (optional)</Label>
                        <Input
                          value={(editingExercise.exercise as any).targetTime || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, targetTime: e.target.value } as any
                          })}
                          placeholder="e.g., 25:00 or leave blank to just time"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Time Only Mode */}
                  {(editingExercise.exercise as any).cardioType === 'time' && (
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">Duration</Label>
                      <Input
                        value={(editingExercise.exercise as any).targetTime || ''}
                        onChange={(e) => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, targetTime: e.target.value } as any
                        })}
                        placeholder="e.g., 30:00, 1:00:00, or leave blank to free run"
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Leave blank to start a timer and stop when done
                      </p>
                    </div>
                  )}
                  
                  {/* Intervals Mode */}
                  {(editingExercise.exercise as any).cardioType === 'intervals' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Intervals</Label>
                        <Input
                          type="number"
                          value={(editingExercise.exercise as any).intervals || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, intervals: parseInt(e.target.value) || 0 } as any
                          })}
                          placeholder="e.g., 8"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Work (distance or time)</Label>
                        <Input
                          value={(editingExercise.exercise as any).intervalWork || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, intervalWork: e.target.value } as any
                          })}
                          placeholder="e.g., 400m or 1min"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-gray-400 mb-1 block">Rest Between Intervals</Label>
                        <Input
                          value={(editingExercise.exercise as any).intervalRest || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, intervalRest: e.target.value } as any
                          })}
                          placeholder="e.g., 90s or 2min"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Notes for cardio */}
                  <div>
                    <Label className="text-xs text-gray-400 mb-1 block">Notes (optional)</Label>
                    <Input
                      value={editingExercise.exercise.notes || ''}
                      onChange={(e) => setEditingExercise({
                        ...editingExercise,
                        exercise: { ...editingExercise.exercise, notes: e.target.value }
                      })}
                      placeholder="e.g., incline 5%, zone 2 pace..."
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              ) : (
                /* STRENGTH EXERCISE UI */
                <>
                  {/* Measurement Type Toggle (Reps vs Time) */}
                  <div>
                    <Label className="text-xs text-gray-400 mb-2 block">Measurement Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={editingExercise.exercise.repType === 'reps' ? 'default' : 'outline'}
                        size="sm"
                        className={editingExercise.exercise.repType === 'reps' ? 'bg-sky-500 hover:bg-sky-600' : ''}
                        onClick={() => setEditingExercise({
                          ...editingExercise,
                          exercise: { 
                            ...editingExercise.exercise, 
                            repType: 'reps',
                            reps: editingExercise.exercise.repType === 'time' ? '10' : editingExercise.exercise.reps 
                          }
                        })}
                      >
                        Reps
                      </Button>
                      <Button
                        type="button"
                        variant={editingExercise.exercise.repType === 'time' ? 'default' : 'outline'}
                        size="sm"
                        className={editingExercise.exercise.repType === 'time' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        onClick={() => setEditingExercise({
                          ...editingExercise,
                          exercise: { 
                            ...editingExercise.exercise, 
                            repType: 'time',
                            reps: editingExercise.exercise.repType === 'reps' ? '30s' : editingExercise.exercise.reps
                          }
                        })}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Time
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {editingExercise.exercise.repType === 'time' 
                        ? 'Use for cardio, holds, stretches (e.g., 30s, 1min, 5min)'
                        : 'Standard repetition counting'
                      }
                    </p>
                  </div>

                  {/* Set Style Selection with auto-config */}
                  <div>
                    <Label className="text-xs text-gray-400 mb-2 block">Set Style</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SET_STYLES.map(style => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => {
                            let newSets = editingExercise.exercise.sets;
                            let newReps = editingExercise.exercise.reps;
                            
                            // Auto-configure based on set style (suggestions only - user can edit)
                            if (style.id === '5x5') {
                              newSets = 5;
                              newReps = '5';
                            } else if (style.id === 'pyramid') {
                              newSets = 4;
                              newReps = '12→10→8→6';
                            } else if (style.id === 'reverse-pyramid') {
                              newSets = 4;
                              newReps = '6→8→10→12';
                            } else if (style.id === 'drop-set') {
                              newSets = 3;
                              newReps = '10→10→10';
                            } else if (style.id === 'amrap') {
                              newReps = 'AMRAP';
                            }
                            // Fixed keeps current values
                            
                            setEditingExercise({
                              ...editingExercise,
                              exercise: { 
                                ...editingExercise.exercise, 
                                setStyle: style.id as any,
                                sets: newSets,
                                reps: newReps,
                              }
                            });
                          }}
                          className={`px-2 py-1.5 rounded border text-[11px] transition-colors ${
                            editingExercise.exercise.setStyle === style.id
                              ? 'bg-sky-500 border-sky-500 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          <div className="font-semibold">{style.icon} {style.name}</div>
                          <div className="text-[10px] opacity-70">{style.description}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      💡 These are suggestions - edit sets/reps below to record actual performance
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">Sets</Label>
                      <Input
                        type="number"
                        value={String(editingExercise.exercise.sets)}
                        onChange={e => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, sets: parseInt(e.target.value) || 1 }
                        })}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">
                        {editingExercise.exercise.repType === 'time' ? 'Duration' : 'Reps'}
                        {editingExercise.exercise.setStyle !== 'fixed' && ' (per set)'}
                      </Label>
                      <Input
                        value={editingExercise.exercise.reps}
                        onChange={e => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, reps: e.target.value }
                        })}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder={editingExercise.exercise.repType === 'time' ? '30s' : (editingExercise.exercise.setStyle === 'pyramid' ? '12→10→8→6' : '8-12')}
                      />
                      {editingExercise.exercise.setStyle === 'pyramid' && (
                        <p className="text-xs text-gray-400 mt-1">Use → to separate reps per set</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-400 mb-1 block">Rest</Label>
                    <Select
                      value={editingExercise.exercise.rest}
                      onValueChange={v => setEditingExercise({
                        ...editingExercise,
                        exercise: { ...editingExercise.exercise, rest: v }
                      })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REST_PRESETS.map((p: any) => (
                          <SelectItem key={p.label} value={String(p.value) + 's'}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-400 mb-1 block">Tempo (optional)</Label>
                    <Select
                      value={editingExercise.exercise.tempo || '__none__'}
                      onValueChange={v => setEditingExercise({
                        ...editingExercise,
                        exercise: { ...editingExercise.exercise, tempo: v === '__none__' ? undefined : v }
                      })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="No tempo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No tempo</SelectItem>
                        {Object.entries(TEMPO_PRESETS).map(([key, p]: [string, any]) => (
                          <SelectItem key={key} value={p.label}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-400 mb-1 block">Coaching Notes (optional)</Label>
                    <Input
                      value={editingExercise.exercise.notes || ''}
                      onChange={(e) => setEditingExercise({
                        ...editingExercise,
                        exercise: { ...editingExercise.exercise, notes: e.target.value }
                      })}
                      placeholder="Any coaching cues for this exercise..."
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300"
                  onClick={() => { setEditingExercise(null); setShowSwapPanel(false); }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-sky-500 hover:bg-sky-600"
                  onClick={saveExerciseEdit}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
          
          {showSwapPanel && editingExercise && (
            <div className="space-y-3">
              {/* v14-D15a: 3-tab swap panel with filters */}
              <Tabs defaultValue="similar" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-3 bg-gray-800">
                  <TabsTrigger value="similar" className="text-xs data-[state=active]:bg-sky-600">
                    <Dumbbell className="h-3 w-3 mr-1" />
                    Similar
                  </TabsTrigger>
                  <TabsTrigger value="muscle" className="text-xs data-[state=active]:bg-sky-600">
                    <Target className="h-3 w-3 mr-1" />
                    Same Pattern
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs data-[state=active]:bg-sky-600">
                    <Search className="h-3 w-3 mr-1" />
                    All Exercises
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="similar" className="mt-2">
                  <ScrollArea className="h-80">
                    <div className="space-y-1">
                      {getDirectSwaps(editingExercise.exercise.exerciseId).length > 0 ? (
                        getDirectSwaps(editingExercise.exercise.exerciseId).map(ex => (
                          <button
                            key={ex.id}
                            onClick={() => handleSwap(ex.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                          >
                            <ExerciseImage exerciseId={ex.id} size="sm" className="flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                              <p className="text-xs text-gray-400">{ex.equipment}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-8">
                          No direct swaps available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="muscle" className="mt-2">
                  <ScrollArea className="h-80">
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
                            <button
                              key={ex.id}
                              onClick={() => handleSwap(ex.id)}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                            >
                              <ExerciseImage exerciseId={ex.id} size="sm" className="flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                                <p className="text-xs text-gray-400 capitalize">
                                  {lib?.primaryMuscles?.join(', ') || ex.pattern}
                                </p>
                              </div>
                            </button>
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
                      className="pl-9 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {['push', 'pull', 'legs', 'core'].map(mg => (
                      <button
                        key={mg}
                        onClick={() => setExerciseFilters(f => ({
                          ...f,
                          muscleGroup: f.muscleGroup.includes(mg) 
                            ? f.muscleGroup.filter(m => m !== mg)
                            : [...f.muscleGroup, mg]
                        }))}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                          exerciseFilters.muscleGroup.includes(mg)
                            ? 'bg-sky-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {mg}
                      </button>
                    ))}
                    {['barbell', 'dumbbell', 'bodyweight', 'machine', 'cable'].map(eq => (
                      <button
                        key={eq}
                        onClick={() => setExerciseFilters(f => ({
                          ...f,
                          equipment: f.equipment.includes(eq)
                            ? f.equipment.filter(e => e !== eq)
                            : [...f.equipment, eq]
                        }))}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                          exerciseFilters.equipment.includes(eq)
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                  <ScrollArea className="h-64">
                    <div className="space-y-1">
                      {searchExercises(swapSearch, { limit: 50 })
                      .filter(ex => ex.id !== editingExercise.exercise.exerciseId)
                      .filter(ex => {
                        // Muscle group filter (push/pull/legs/core)
                        if (exerciseFilters.muscleGroup.length > 0) {
                          const pushMuscles = ['chest', 'shoulders', 'triceps'];
                          const pullMuscles = ['back', 'lats', 'biceps', 'traps'];
                          const legsMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
                          const coreMuscles = ['abs', 'obliques'];
                          
                          const hasPush = exerciseFilters.muscleGroup.includes('push') && ex.primaryMuscles.some(m => pushMuscles.includes(m));
                          const hasPull = exerciseFilters.muscleGroup.includes('pull') && ex.primaryMuscles.some(m => pullMuscles.includes(m));
                          const hasLegs = exerciseFilters.muscleGroup.includes('legs') && ex.primaryMuscles.some(m => legsMuscles.includes(m));
                          const hasCore = exerciseFilters.muscleGroup.includes('core') && ex.primaryMuscles.some(m => coreMuscles.includes(m));
                          
                          if (!hasPush && !hasPull && !hasLegs && !hasCore) return false;
                        }
                        
                        // Equipment filter
                        if (exerciseFilters.equipment.length > 0) {
                          if (!exerciseFilters.equipment.includes(ex.equipment)) return false;
                        }
                        
                        return true;
                      })
                      .map(ex => {
                        const libEntry = exerciseLibraryMap.get(ex.id);
                        return (
                          <button
                            key={ex.id}
                            onClick={() => {
                              handleSwap(ex.id);
                              setSwapSearch('');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                          >
                            <ExerciseImage exerciseId={ex.id} size="sm" className="flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                              <p className="text-xs text-gray-400 capitalize">
                                {libEntry?.equipment || ex.category}
                                {libEntry?.primaryMuscles?.length ? ` · ${libEntry.primaryMuscles.join(', ')}` : ''}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
              
              <Button
                variant="outline"
                className="w-full border-gray-700 text-gray-300"
                onClick={() => setShowSwapPanel(false)}
              >
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* v14-D6: Superset Picker Dialog */}
      <Dialog open={!!supersetSource} onOpenChange={(open) => !open && setSupersetSource(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Pair with another exercise</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select an exercise in the same block to superset with. They&apos;ll render as A1/A2 paired during workouts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {supersetSource && (() => {
              const block = blocks.find(b => b.id === supersetSource.blockId);
              const sourceId = supersetSource.exerciseId;
              const candidates = (block?.exercises ?? []).filter(e => e.id !== sourceId && !e.groupId);
              if (candidates.length === 0) {
                return <p className="text-sm text-gray-500 text-center py-4">No other available exercises in this block. Add another exercise or remove an existing superset first.</p>;
              }
              return candidates.map(c => (
                <Button key={c.id} variant="outline" className="w-full justify-start border-gray-700 text-white hover:bg-gray-800"
                        onClick={() => handlePairSuperset(c.id)}>
                  <ArrowLeftRight className="w-4 h-4 mr-2 text-amber-400" />
                  {c.exerciseName}
                </Button>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* v14-D23: Block Library dialogs (Save / Replace / Browse / Delete /
          New Folder) — all gated by enableBlockLibrary so callers that opt out
          render zero of this surface. Ported verbatim from /workout/builder. */}
      {enableBlockLibrary && (
        <>
          {/* Save Block Dialog */}
          <Dialog open={showSaveBlockDialog} onOpenChange={setShowSaveBlockDialog}>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle>💾 Save Block to Library</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Block Name</Label>
                  <Input
                    value={blockLibraryName}
                    onChange={(e) => setBlockLibraryName(e.target.value)}
                    placeholder="e.g., Upper Body Strength, Leg Day Warmup"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Folder <span className="text-gray-500 font-normal">(optional)</span></Label>
                  <Input
                    value={blockLibraryFolder}
                    onChange={(e) => setBlockLibraryFolder(e.target.value)}
                    placeholder="e.g., Jason's workouts, Push Day"
                    className="mt-2"
                    list="folder-suggestions"
                  />
                  <datalist id="folder-suggestions">
                    {[...new Set(savedBlocks.map((b: any) => b.folder).filter(Boolean))].map((f) => (
                      <option key={f as string} value={f as string} />
                    ))}
                  </datalist>
                </div>
                <p className="text-sm text-muted-foreground">
                  Save this block to reuse it in future workouts. Client performance will be tracked.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSaveBlockDialog(false);
                      setActiveBlockId(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSaveBlock()}
                    className="flex-1 bg-purple-500 hover:bg-purple-600"
                  >
                    <Save className="h-4 w-4 mr-2" /> Save Block
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Replace Block Confirmation Dialog */}
          <Dialog open={showReplaceBlockDialog} onOpenChange={setShowReplaceBlockDialog}>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle>⚠️ Block Already Exists</DialogTitle>
                <DialogDescription>
                  A block named &quot;{blockLibraryName}&quot; already exists in your library. Would you like to replace it with this new version?
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handleCancelReplace} className="flex-1">
                  Keep Both (Cancel)
                </Button>
                <Button
                  onClick={handleReplaceBlock}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  Replace Existing
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Block Library Dialog */}
          <Dialog
            open={showBlockLibraryDialog}
            onOpenChange={(open) => {
              setShowBlockLibraryDialog(open);
              if (!open) {
                setBlockLibraryFilter('all');
                setBlockFolderFilter('all');
                setBlockLibrarySearch('');
              }
            }}
          >
            <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>📚 Block Library</DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncBlockLibrary}
                    disabled={isSyncingBlocks}
                    className="gap-1"
                  >
                    {isSyncingBlocks ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync
                  </Button>
                </div>
              </DialogHeader>
              {/* Folder filter */}
              {(() => {
                const folders = [...new Set(savedBlocks.map((b: any) => b.folder).filter(Boolean))] as string[];
                return (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-300">Folders</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => { setMoveTargetBlockId(null); setShowCreateFolderDialog(true); }}
                      >
                        <FolderPlus className="w-3.5 h-3.5" /> New folder
                      </Button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Button
                        variant={blockFolderFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setBlockFolderFilter('all')}
                        className="h-7 text-xs"
                      >
                        All Folders
                      </Button>
                      <Button
                        variant={blockFolderFilter === '' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setBlockFolderFilter('')}
                        className="h-7 text-xs"
                      >
                        Unfiled
                      </Button>
                      {folders.map((f) => (
                        <Button
                          key={f}
                          variant={blockFolderFilter === f ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBlockFolderFilter(f)}
                          className="h-7 text-xs gap-1"
                        >
                          📁 {f}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Type filter */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  variant={blockLibraryFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBlockLibraryFilter('all')}
                >
                  All
                </Button>
                {BLOCK_TYPES.map((bt) => (
                  <Button
                    key={bt.value}
                    variant={blockLibraryFilter === bt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBlockLibraryFilter(bt.value)}
                    className="gap-1"
                  >
                    {bt.icon}
                    {bt.label}
                  </Button>
                ))}
              </div>
              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={blockLibrarySearch}
                  onChange={(e) => setBlockLibrarySearch(e.target.value)}
                  placeholder="Search blocks or exercises..."
                  className="bg-gray-800 border-gray-700 text-white pl-10 text-sm"
                />
              </div>
              <ScrollArea className="h-[400px] pr-4">
                {savedBlocks.filter((b: any) =>
                  (blockLibraryFilter === 'all' || b.type === blockLibraryFilter) &&
                  (blockFolderFilter === 'all' || (blockFolderFilter === '' ? !b.folder : b.folder === blockFolderFilter)) &&
                  (!blockLibrarySearch.trim() || b.name.toLowerCase().includes(blockLibrarySearch.toLowerCase()) || b.exercises.some((e: any) => (e.exerciseName || '').toLowerCase().includes(blockLibrarySearch.toLowerCase())))
                ).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No saved blocks yet.</p>
                    <p className="text-sm mt-2">Save blocks from your workouts to reuse them!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedBlocks
                      .filter((b: any) =>
                        (blockLibraryFilter === 'all' || b.type === blockLibraryFilter) &&
                        (blockFolderFilter === 'all' || (blockFolderFilter === '' ? !b.folder : b.folder === blockFolderFilter)) &&
                        (!blockLibrarySearch.trim() || b.name.toLowerCase().includes(blockLibrarySearch.toLowerCase()) || b.exercises.some((e: any) => (e.exerciseName || '').toLowerCase().includes(blockLibrarySearch.toLowerCase())))
                      )
                      .map((block: any) => {
                        const blockStyle = getBlockStyles(block.type);
                        // Per-client performance history (only when targetUserId is set).
                        const clientPerfs = targetUserId
                          ? blockPerformances.filter((p: any) => p.blockId === block.id && p.clientId === targetUserId)
                          : [];
                        const bestPerf = targetUserId ? getBestBlockPerformance(block.id, targetUserId) : undefined;
                        const lastPerf = clientPerfs.length > 0
                          ? clientPerfs.sort((a: any, b: any) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0]
                          : undefined;
                        return (
                          <Card
                            key={block.id}
                            className={`${blockStyle.bg} ${blockStyle.border} cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => handleLoadBlock(block)}
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {BLOCK_TYPES.find((t) => t.value === block.type)?.icon}
                                    <h4 className="font-semibold text-white">{block.name}</h4>
                                    {block.folder && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">📁 {block.folder}</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {block.exercises?.length || 0} exercises
                                    {block.circuitStyle && ` • ${block.circuitStyle}`}
                                    {block.circuitRounds && ` • ${block.circuitRounds} rounds`}
                                  </p>
                                  {targetUserId && block.type === 'circuit' && (lastPerf || bestPerf) && (
                                    <div className="flex gap-3 mt-2 text-xs">
                                      {lastPerf?.completionTime && (
                                        <span className="text-gray-400">
                                          Last: <span className="text-sky-400 font-medium">{Math.floor(lastPerf.completionTime / 60)}:{String(lastPerf.completionTime % 60).padStart(2, '0')}</span>
                                        </span>
                                      )}
                                      {bestPerf?.completionTime && (
                                        <span className="text-gray-400">
                                          Best: <span className="text-green-400 font-medium">{Math.floor(bestPerf.completionTime / 60)}:{String(bestPerf.completionTime % 60).padStart(2, '0')}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={blockStyle.badge}>
                                    {block.type}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewBlockId(previewBlockId === block.id ? null : block.id);
                                    }}
                                  >
                                    {previewBlockId === block.id ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuItem onClick={() => { setMoveTargetBlockId(block.id); setShowCreateFolderDialog(true); }}>
                                        <FolderPlus className="w-4 h-4 mr-2" /> New folder…
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); setBlockToDelete(block); }}
                                        className="text-red-400 focus:text-red-300"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete block
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                              {/* Exercise Preview */}
                              {previewBlockId === block.id && block.exercises && block.exercises.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                                  {block.exercises.map((ex: any, idx: number) => (
                                    <div key={ex.id} className="flex items-center justify-between text-xs py-1 px-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-500 w-4">{idx + 1}.</span>
                                        <span className="text-slate-300">{ex.exerciseName}</span>
                                      </div>
                                      <span className="text-slate-500">
                                        {ex.sets} × {ex.reps}{ex.repType === 'time' ? '' : ' reps'} • {ex.rest}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Block Delete Confirmation */}
          <ConfirmDialog
            open={!!blockToDelete}
            onOpenChange={(open) => { if (!open) setBlockToDelete(null); }}
            title="Delete Block"
            description={`Delete "${blockToDelete?.name}" from your library?`}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={() => {
              if (blockToDelete) {
                deleteBlock(blockToDelete.id);
                toast.success('Block deleted from library');
                setBlockToDelete(null);
              }
            }}
            icon={<Trash2 className="w-5 h-5 text-red-400" />}
          />

          {/* Create Folder Dialog */}
          <CreateFolderDialog
            open={showCreateFolderDialog}
            onOpenChange={(open) => {
              setShowCreateFolderDialog(open);
              if (!open) setMoveTargetBlockId(null);
            }}
            existingFolders={[...new Set(savedBlocks.map((b: any) => b.folder).filter(Boolean))] as string[]}
            moveTargetBlockId={moveTargetBlockId}
            onCreated={(name) => setBlockFolderFilter(name)}
          />
        </>
      )}

    </div>
  );
}