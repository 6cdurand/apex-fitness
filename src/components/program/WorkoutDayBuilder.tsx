'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BlockType } from '@/types';
import { filterExercisesBySearch, getExerciseUsageCounts, exerciseLibraryMap } from '@/lib/exercises';
import { searchExercises } from '@/lib/exerciseSearch';
import { getSwapSuggestions, getDirectSwaps } from '@/lib/exerciseRelations';
import { useWorkoutStore } from '@/lib/store';
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
  embedded?: boolean;
  dayLabel?: string;
  enableBlockLibrary?: boolean;
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
  embedded = false,
  dayLabel,
  enableBlockLibrary = true,
  targetUserId,
  emptyStateSlot,
}: WorkoutDayBuilderProps) {
  const { workoutHistory } = useWorkoutStore();
  
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
                className="h-5 w-5 text-gray-500 hover:text-gray-200 disabled:opacity-30"
                title="Move up"
                disabled={isFirstExerciseInBlock(ex, block)}
                onClick={() => handleMoveExercise(block.id, ex.id, 'up')}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-gray-500 hover:text-gray-200 disabled:opacity-30"
                title="Move down"
                disabled={isLastExerciseInBlock(ex, block)}
                onClick={() => handleMoveExercise(block.id, ex.id, 'down')}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-amber-400"
                        title="Link to another exercise">
                  <Link className="w-3 h-3" />
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
              className="h-6 w-6 text-gray-500 hover:text-sky-400"
              onClick={() => {
                setEditingExercise({ blockId: block.id, exercise: { ...ex } });
                setShowSwapPanel(false);
              }}
            >
              <Edit2 className="w-3 h-3" />
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
    setShowSwapPanel(false);
    setSwapSearch('');
    toast.success(`Swapped to ${newExercise.name}`);
  };
  
  const swapFilteredExercises = useMemo(() => {
    if (swapSearch.trim()) {
      return searchExercises(swapSearch, {}).map(ex => ({ id: ex.id, name: ex.name, pattern: ex.category }));
    }
    return [];
  }, [swapSearch]);
  
  return (
    <div className="space-y-4">
      {dayLabel && (
        <div className="text-sm text-gray-400 font-medium">{dayLabel}</div>
      )}
      
      {/* Add Block row */}
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
      
    </div>
  );
}