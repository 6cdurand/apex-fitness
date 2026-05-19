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
} from 'lucide-react';
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
}: WorkoutDayBuilderProps) {
  const { workoutHistory } = useWorkoutStore();
  
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [editingExercise, setEditingExercise] = useState<{ blockId: string; exercise: WorkoutExercise } | null>(null);
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  
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
        <Card className="bg-gray-900/50 border-gray-800 border-dashed">
          <CardContent className="p-8 text-center">
            <Dumbbell className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-300">Add a block to start building this {dayLabel || 'workout'}</p>
          </CardContent>
        </Card>
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
                {/* Exercise list */}
                <div className="divide-y divide-white/5">
                  {block.exercises.map((ex, exIdx) => (
                    <div key={ex.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors">
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
                  ))}
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
                  <Label className="text-xs text-gray-400 mb-1 block">Reps</Label>
                  <Input
                    value={editingExercise.exercise.reps}
                    onChange={e => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, reps: e.target.value }
                    })}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="8-12 or 30s"
                  />
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
                  value={editingExercise.exercise.tempo || ''}
                  onValueChange={v => setEditingExercise({
                    ...editingExercise,
                    exercise: { ...editingExercise.exercise, tempo: v || undefined }
                  })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="No tempo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No tempo</SelectItem>
                    {Object.entries(TEMPO_PRESETS).map(([key, p]: [string, any]) => (
                      <SelectItem key={key} value={p.label}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Set Style</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SET_STYLES.map(style => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setEditingExercise({
                        ...editingExercise,
                        exercise: { ...editingExercise.exercise, setStyle: style.id as any }
                      })}
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
              </div>
              
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={swapSearch}
                  onChange={e => setSwapSearch(e.target.value)}
                  placeholder="Search exercises..."
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  autoFocus
                />
              </div>
              
              {!swapSearch.trim() && Array.isArray(swapSuggestions.samePattern) && swapSuggestions.samePattern.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-2">Direct Swaps (Same Pattern)</p>
                  <div className="space-y-1">
                    {swapSuggestions.samePattern.map((exId: string) => {
                      const ex = exerciseLibraryMap.get(exId);
                      if (!ex) return null;
                      return (
                        <button
                          key={exId}
                          onClick={() => handleSwap(exId)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                        >
                          <ExerciseImage exerciseId={exId} size="sm" className="flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{ex.category}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {!swapSearch.trim() && Array.isArray(swapSuggestions.similarPattern) && swapSuggestions.similarPattern.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-2">Similar Exercises</p>
                  <div className="space-y-1">
                    {swapSuggestions.similarPattern.slice(0, 5).map((exId: string) => {
                      const ex = exerciseLibraryMap.get(exId);
                      if (!ex) return null;
                      return (
                        <button
                          key={exId}
                          onClick={() => handleSwap(exId)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                        >
                          <ExerciseImage exerciseId={exId} size="sm" className="flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{ex.category}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {swapSearch.trim() && (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {swapFilteredExercises.map(ex => (
                      <button
                        key={ex.id}
                        onClick={() => handleSwap(ex.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                      >
                        <ExerciseImage exerciseId={ex.id} size="sm" className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{ex.pattern}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
              
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
      
    </div>
  );
}