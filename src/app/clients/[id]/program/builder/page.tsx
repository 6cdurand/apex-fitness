'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTrainerStore, useWorkoutStore } from '@/lib/store';
import { filterExercisesBySearch, getExerciseUsageCounts } from '@/lib/exercises';
import { toast } from 'sonner';
import { programTemplates } from '@/lib/programTemplates';
import { BlockType, MovementPattern } from '@/types';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  GripVertical,
  Edit2,
  Save,
  Flame,
  Dumbbell,
  RotateCcw,
  Search,
  Clock,
  X,
  ArrowLeftRight,
  Target,
  Wrench,
} from 'lucide-react';
import { getSwapSuggestions, getDirectSwaps, EXERCISE_RELATIONS } from '@/lib/exerciseRelations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  movementPattern: MovementPattern;
  sets: number;
  reps: string;
  rest: string;
  tempo?: string;
  notes?: string;
  trainerNotes?: string;
}

interface WorkoutBlock {
  id: string;
  type: BlockType;
  name: string;
  exercises: WorkoutExercise[];
}

const COMMON_EXERCISES = [
  { id: 'barbell-back-squat', name: 'Barbell Back Squat', pattern: 'squat' },
  { id: 'goblet-squat', name: 'Goblet Squat', pattern: 'squat' },
  { id: 'front-squat', name: 'Front Squat', pattern: 'squat' },
  { id: 'leg-press', name: 'Leg Press', pattern: 'squat' },
  { id: 'deadlift', name: 'Deadlift', pattern: 'hinge' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', pattern: 'hinge' },
  { id: 'hip-thrust', name: 'Hip Thrust', pattern: 'hinge' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', pattern: 'hinge' },
  { id: 'bench-press', name: 'Bench Press', pattern: 'push' },
  { id: 'db-bench-press', name: 'DB Bench Press', pattern: 'push' },
  { id: 'incline-bench-press', name: 'Incline Bench Press', pattern: 'push' },
  { id: 'overhead-press', name: 'Overhead Press', pattern: 'push' },
  { id: 'db-shoulder-press', name: 'DB Shoulder Press', pattern: 'push' },
  { id: 'push-up', name: 'Push-up', pattern: 'push' },
  { id: 'barbell-row', name: 'Barbell Row', pattern: 'pull' },
  { id: 'cable-row', name: 'Cable Row', pattern: 'pull' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', pattern: 'pull' },
  { id: 'weighted-pull-up', name: 'Weighted Pull-up', pattern: 'pull' },
  { id: 'face-pull', name: 'Face Pull', pattern: 'pull' },
  { id: 'plank', name: 'Plank', pattern: 'core' },
  { id: 'dead-bug', name: 'Dead Bug', pattern: 'core' },
  { id: 'pallof-press', name: 'Pallof Press', pattern: 'core' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', pattern: 'core' },
  { id: 'split-squat', name: 'Split Squat', pattern: 'lunge' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', pattern: 'lunge' },
  { id: 'walking-lunge', name: 'Walking Lunge', pattern: 'lunge' },
  { id: 'glute-bridge', name: 'Glute Bridge', pattern: 'hinge' },
  { id: 'clamshell', name: 'Clamshell', pattern: 'hinge' },
  { id: 'band-pull-apart', name: 'Band Pull Apart', pattern: 'pull' },
  { id: 'hip-circles', name: 'Hip Circles', pattern: 'squat' },
  { id: 'cat-cow', name: 'Cat-Cow', pattern: 'hinge' },
  { id: 'bird-dog', name: 'Bird Dog', pattern: 'core' },
];

const BLOCK_TYPES: { value: BlockType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'warmup', label: 'Warm-up', icon: <Flame className="h-4 w-4 text-yellow-500" />, color: 'yellow' },
  { value: 'work', label: 'Strength', icon: <Dumbbell className="h-4 w-4 text-blue-400" />, color: 'blue' },
  { value: 'circuit', label: 'Circuit', icon: <Target className="h-4 w-4 text-orange-400" />, color: 'orange' },
  { value: 'cooldown', label: 'Cool-down', icon: <RotateCcw className="h-4 w-4 text-purple-500" />, color: 'purple' },
];

// Block color styles
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

export default function WorkoutBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.id as string;
  const templateId = searchParams.get('templateId');
  const dayIndex = parseInt(searchParams.get('day') || '0');
  const eventId = searchParams.get('eventId');
  
  const { clients, addCalendarEvent, updateCalendarEvent, addClientProgram, calendarEvents } = useTrainerStore();
  const client = clients.find(c => c.clientId === clientId);
  const template = templateId ? programTemplates.find(t => t.id === templateId) : null;
  const { workoutHistory } = useWorkoutStore();
  
  // Standalone builder state
  const [workoutName, setWorkoutName] = useState(template?.days[dayIndex]?.dayLabel || 'Custom Workout');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [programName, setProgramName] = useState('');
  const [assignToCalendar, setAssignToCalendar] = useState(!eventId); // Don't show calendar assign if linking to existing event
  // Pre-fill date/time from existing calendar event if eventId is provided
  const linkedEvent = eventId ? calendarEvents.find(e => e.id === eventId) : null;
  const [assignDate, setAssignDate] = useState(linkedEvent?.date || new Date().toISOString().split('T')[0]);
  const [assignTime, setAssignTime] = useState(linkedEvent?.startTime || '09:00');
  
  
  // Initialize blocks from template day
  const initialBlocks = useMemo(() => {
    if (!template?.days[dayIndex]) return [];
    return template.days[dayIndex].blocks.map(block => ({
      id: block.id,
      type: block.type,
      name: block.name,
      exercises: block.exercises.map(ex => ({
        id: ex.id,
        exerciseId: ex.defaultExerciseId,
        exerciseName: ex.defaultExerciseName,
        movementPattern: ex.movementPattern,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        tempo: ex.tempo,
        notes: ex.notes,
      })),
    }));
  }, [template, dayIndex]);

  // Sort initial blocks on load
  const sortBlocksByType = (blocksToSort: WorkoutBlock[]): WorkoutBlock[] => {
    const order: Record<BlockType, number> = { warmup: 0, work: 1, cardio: 2, circuit: 3, cooldown: 4 };
    return [...blocksToSort].sort((a, b) => order[a.type] - order[b.type]);
  };
  
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(sortBlocksByType(initialBlocks));
  const [editingExercise, setEditingExercise] = useState<{ blockId: string; exercise: WorkoutExercise } | null>(null);
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showSwapPanel, setShowSwapPanel] = useState(false);

  const filteredExercises = useMemo(() => {
    const blockType = showAddExercise ? blocks.find(b => b.id === showAddExercise)?.type : null;
    return filterExercisesBySearch(COMMON_EXERCISES, exerciseSearch, blockType || null);
  }, [exerciseSearch, showAddExercise, blocks]);
  
  const exerciseUsageCounts = useMemo(() => {
    return getExerciseUsageCounts(workoutHistory, clientId);
  }, [workoutHistory, clientId]);

  // Helper to sort blocks: warmup first, work in middle, cooldown last
  const sortBlocks = (blocksToSort: WorkoutBlock[]): WorkoutBlock[] => {
    const order: Record<BlockType, number> = { warmup: 0, work: 1, cardio: 2, circuit: 3, cooldown: 4 };
    return [...blocksToSort].sort((a, b) => order[a.type] - order[b.type]);
  };

  const addBlock = (type: BlockType) => {
    const newBlock: WorkoutBlock = {
      id: `block-${Date.now()}`,
      type,
      name: type === 'warmup' ? 'Warm-up' : type === 'cooldown' ? 'Cool-down' : 'Main Work',
      exercises: [],
    };
    setBlocks(sortBlocks([...blocks, newBlock]));
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
  };

  const updateBlockName = (blockId: string, name: string) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, name } : b));
  };

  const addExercise = (blockId: string, exercise: typeof COMMON_EXERCISES[0]) => {
    const newExercise: WorkoutExercise = {
      id: `ex-${Date.now()}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      movementPattern: exercise.pattern as MovementPattern,
      sets: 3,
      reps: '10',
      rest: '60s',
    };
    
    setBlocks(blocks.map(b => 
      b.id === blockId 
        ? { ...b, exercises: [...b.exercises, newExercise] }
        : b
    ));
    setShowAddExercise(null);
    setExerciseSearch('');
  };

  const removeExercise = (blockId: string, exerciseId: string) => {
    setBlocks(blocks.map(b => 
      b.id === blockId 
        ? { ...b, exercises: b.exercises.filter(e => e.id !== exerciseId) }
        : b
    ));
  };

  const updateExercise = (blockId: string, exerciseId: string, updates: Partial<WorkoutExercise>) => {
    setBlocks(blocks.map(b => 
      b.id === blockId 
        ? { 
            ...b, 
            exercises: b.exercises.map(e => 
              e.id === exerciseId ? { ...e, ...updates } : e
            ) 
          }
        : b
    ));
  };

  const saveExerciseEdit = () => {
    if (!editingExercise) return;
    updateExercise(editingExercise.blockId, editingExercise.exercise.id, editingExercise.exercise);
    setEditingExercise(null);
  };

  const handleSave = () => {
    const { updateClientProgram, getActiveProgram } = useTrainerStore.getState();
    const activeProgram = getActiveProgram(clientId);
    
    if (activeProgram && activeProgram.weeklyPlan) {
      // P07: Guard against out-of-range dayIndex from stale URL params
      if (dayIndex < 0 || dayIndex >= activeProgram.weeklyPlan.length) {
        toast.error('That program day no longer exists. Reopen the program from the client view.');
        return;
      }
      
      // Update the specific day in the weekly plan with the edited blocks
      const updatedWeeklyPlan = [...activeProgram.weeklyPlan];
      if (updatedWeeklyPlan[dayIndex]) {
        updatedWeeklyPlan[dayIndex] = {
          ...updatedWeeklyPlan[dayIndex],
          blocks: blocks.map(block => ({
            id: block.id,
            type: block.type,
            name: block.name,
            exercises: block.exercises.map(ex => ({
              id: ex.id,
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              movementPattern: ex.movementPattern,
              sets: ex.sets,
              reps: ex.reps,
              rest: ex.rest,
              tempo: ex.tempo,
              notes: ex.notes,
              trainerNotes: ex.trainerNotes,
            })),
          })),
        };
        
        updateClientProgram(activeProgram.id, {
          weeklyPlan: updatedWeeklyPlan,
        });
      }
    }
    
    router.back();
  };

  const handleSaveStandalone = () => {
    if (blocks.length === 0) return;
    const totalEx = blocks.reduce((s, b) => s + b.exercises.length, 0);
    const name = workoutName || 'Custom Workout';

    // Create as active program for the client
    const weeklyPlan = [{
      dayLabel: name,
      blocks: blocks.map(block => ({
        id: block.id,
        type: block.type,
        name: block.name,
        exercises: block.exercises.map(ex => ({
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          movementPattern: ex.movementPattern,
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest,
          tempo: ex.tempo,
          notes: ex.notes,
          trainerNotes: ex.trainerNotes,
        })),
      })),
    }];

    const trainerId = client?.trainerId || '';
    addClientProgram({
      id: `program-${Date.now()}`,
      clientId,
      trainerId,
      templateId: 'custom',
      templateName: programName || name,
      phase: 'foundation',
      goal: 'general',
      weeklyPlan: weeklyPlan.map((day, i) => ({
        id: `day-${Date.now()}-${i}`,
        ...day,
        blocks: day.blocks.map(b => ({
          ...b,
          exercises: b.exercises.map(ex => ({
            ...ex,
            movementPattern: ex.movementPattern || ('push' as any),
          })),
        })),
      })),
      startDate: assignDate || new Date().toISOString().split('T')[0],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Link to existing calendar event or create new one
    if (eventId && linkedEvent) {
      // Update existing calendar event with workout details
      updateCalendarEvent(eventId, {
        title: name,
        notes: `${totalEx} exercises • ${programName || name}`,
      });
    } else if (assignToCalendar && assignDate) {
      addCalendarEvent({
        title: name,
        type: 'session',
        date: assignDate,
        startTime: assignTime,
        endTime: (() => {
          const [h, m] = assignTime.split(':').map(Number);
          const endH = h + 1;
          return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        })(),
        clientId,
        trainerId: useTrainerStore.getState().clients.find(c => c.clientId === clientId)?.trainerId || '',
        status: 'scheduled',
        notes: `${totalEx} exercises • ${programName || name}`,
      });
    }

    setShowSaveDialog(false);
    router.back();
  };

  const getBlockIcon = (type: BlockType) => {
    const blockType = BLOCK_TYPES.find(b => b.value === type);
    return blockType?.icon || <Dumbbell className="h-4 w-4" />;
  };

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <p>Client not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Workout Builder</h1>
        <Input
          value={workoutName}
          onChange={(e) => setWorkoutName(e.target.value)}
          placeholder="Workout name..."
          className="mt-1 text-lg font-medium border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-muted-foreground"
        />
      </div>

      {/* Blocks */}
      <div className="space-y-4 mb-20">
        {blocks.map((block, blockIndex) => {
          const blockStyles = getBlockStyles(block.type);
          return (
          <Card key={block.id} className={`${blockStyles.bg} ${blockStyles.border} border-2`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getBlockIcon(block.type)}
                  <Input
                    value={block.name}
                    onChange={(e) => updateBlockName(block.id, e.target.value)}
                    className="font-semibold border-none p-0 h-auto text-lg focus-visible:ring-0 bg-transparent"
                  />
                  <Badge className={`text-xs capitalize ${blockStyles.badge}`}>
                    {block.type === 'work' ? 'strength' : block.type}
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => removeBlock(block.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {block.exercises.map((exercise, exIndex) => (
                  <div 
                    key={exercise.id}
                    className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg group"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <span className="text-xs text-muted-foreground w-5">{exIndex + 1}.</span>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{exercise.exerciseName}</p>
                      <p className="text-xs text-muted-foreground">
                        {exercise.sets} × {exercise.reps} • Rest: {exercise.rest}
                        {exercise.tempo && ` • Tempo: ${exercise.tempo}`}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingExercise({ blockId: block.id, exercise: { ...exercise } })}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExercise(block.id, exercise.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add Exercise Button */}
                <Dialog open={showAddExercise === block.id} onOpenChange={(open) => {
                  setShowAddExercise(open ? block.id : null);
                  if (!open) setExerciseSearch('');
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <Plus className="h-4 w-4 mr-2" /> Add Exercise
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Exercise</DialogTitle>
                    </DialogHeader>
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search exercises..."
                        value={exerciseSearch}
                        onChange={(e) => setExerciseSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-1">
                        {filteredExercises.map(ex => {
                          const count = exerciseUsageCounts[ex.id] || 0;
                          return (
                            <Button
                              key={ex.id}
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => addExercise(block.id, { ...ex, pattern: ex.pattern || 'compound' } as typeof COMMON_EXERCISES[0])}
                            >
                              <span className="flex-1 text-left">{ex.name}</span>
                              {count > 0 && (
                                <Badge variant="secondary" className="text-xs bg-sky-500/20 text-sky-400 mr-1">
                                  {count}×
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">
                                {ex.pattern}
                              </Badge>
                            </Button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        );
        })}

        {/* Add Block */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center mb-3">Add a block</p>
            <div className="flex gap-2 justify-center">
              {BLOCK_TYPES.map(bt => (
                <Button
                  key={bt.value}
                  variant="outline"
                  size="sm"
                  onClick={() => addBlock(bt.value)}
                >
                  {bt.icon}
                  <span className="ml-2">{bt.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Exercise Dialog */}
      <Dialog open={!!editingExercise} onOpenChange={(open) => {
        if (!open) {
          setEditingExercise(null);
          setShowSwapPanel(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
          </DialogHeader>
          {editingExercise && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exercise</Label>
                  <p className="font-medium">{editingExercise.exercise.exerciseName}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowSwapPanel(!showSwapPanel)}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  {showSwapPanel ? 'Hide Swaps' : 'Swap Exercise'}
                </Button>
              </div>

              {/* Swap Suggestions Panel */}
              {showSwapPanel && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <Tabs defaultValue="direct" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-3">
                      <TabsTrigger value="direct" className="text-xs">
                        <Dumbbell className="h-3 w-3 mr-1" />
                        Similar
                      </TabsTrigger>
                      <TabsTrigger value="muscle" className="text-xs">
                        <Target className="h-3 w-3 mr-1" />
                        Same Muscle
                      </TabsTrigger>
                      <TabsTrigger value="equipment" className="text-xs">
                        <Wrench className="h-3 w-3 mr-1" />
                        Equipment
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="direct" className="mt-2">
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {getDirectSwaps(editingExercise.exercise.exerciseId).length > 0 ? (
                            getDirectSwaps(editingExercise.exercise.exerciseId).map(ex => (
                              <Button
                                key={ex.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-left h-auto py-2"
                                onClick={() => {
                                  setEditingExercise({
                                    ...editingExercise,
                                    exercise: {
                                      ...editingExercise.exercise,
                                      exerciseId: ex.id,
                                      exerciseName: ex.name,
                                      movementPattern: ex.movementPattern as MovementPattern,
                                    }
                                  });
                                  setShowSwapPanel(false);
                                }}
                              >
                                <div>
                                  <p className="font-medium text-sm">{ex.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {ex.equipment} • {ex.primaryMuscles.join(', ')}
                                  </p>
                                </div>
                              </Button>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No direct swaps available
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="muscle" className="mt-2">
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {getSwapSuggestions(editingExercise.exercise.exerciseId).sameMuscle.length > 0 ? (
                            getSwapSuggestions(editingExercise.exercise.exerciseId).sameMuscle.map(ex => (
                              <Button
                                key={ex.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-left h-auto py-2"
                                onClick={() => {
                                  setEditingExercise({
                                    ...editingExercise,
                                    exercise: {
                                      ...editingExercise.exercise,
                                      exerciseId: ex.id,
                                      exerciseName: ex.name,
                                      movementPattern: ex.movementPattern as MovementPattern,
                                    }
                                  });
                                  setShowSwapPanel(false);
                                }}
                              >
                                <div>
                                  <p className="font-medium text-sm">{ex.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {ex.equipment} • {ex.primaryMuscles.join(', ')}
                                  </p>
                                </div>
                              </Button>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No muscle-based alternatives
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="equipment" className="mt-2">
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {getSwapSuggestions(editingExercise.exercise.exerciseId).equipmentAlternatives.length > 0 ? (
                            getSwapSuggestions(editingExercise.exercise.exerciseId).equipmentAlternatives.map(ex => (
                              <Button
                                key={ex.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-left h-auto py-2"
                                onClick={() => {
                                  setEditingExercise({
                                    ...editingExercise,
                                    exercise: {
                                      ...editingExercise.exercise,
                                      exerciseId: ex.id,
                                      exerciseName: ex.name,
                                      movementPattern: ex.movementPattern as MovementPattern,
                                    }
                                  });
                                  setShowSwapPanel(false);
                                }}
                              >
                                <div>
                                  <p className="font-medium text-sm">{ex.name}</p>
                                  <Badge variant="outline" className="text-xs ml-2">
                                    {ex.equipment}
                                  </Badge>
                                </div>
                              </Button>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No equipment alternatives
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Sets</Label>
                  <Input
                    type="number"
                    value={editingExercise.exercise.sets}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, sets: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div>
                  <Label>Reps</Label>
                  <Input
                    value={editingExercise.exercise.reps}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, reps: e.target.value }
                    })}
                    placeholder="8-12"
                  />
                </div>
                <div>
                  <Label>Rest</Label>
                  <Input
                    value={editingExercise.exercise.rest}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, rest: e.target.value }
                    })}
                    placeholder="60s"
                  />
                </div>
              </div>

              <div>
                <Label>Tempo (optional)</Label>
                <Input
                  value={editingExercise.exercise.tempo || ''}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    exercise: { ...editingExercise.exercise, tempo: e.target.value }
                  })}
                  placeholder="3010"
                />
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={editingExercise.exercise.notes || ''}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    exercise: { ...editingExercise.exercise, notes: e.target.value }
                  })}
                  placeholder="Any coaching cues..."
                />
              </div>

              <Button onClick={saveExerciseEdit} className="w-full">
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save & Assign Dialog (standalone mode) */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-sky-500" />
              Save Program
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Program Name</Label>
              <Input
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder={workoutName || 'e.g. Foundation Phase A'}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <input
                type="checkbox"
                checked={assignToCalendar}
                onChange={(e) => setAssignToCalendar(e.target.checked)}
                className="rounded"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Assign to calendar</p>
                <p className="text-xs text-muted-foreground">Schedule the first session</p>
              </div>
            </div>
            {assignToCalendar && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Select value={assignTime} onValueChange={setAssignTime}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
                        '10:00','10:30','11:00','11:30','12:00','13:00','14:00','15:00',
                        '16:00','16:30','17:00','17:30','18:00','18:30','19:00','20:00'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <Button onClick={handleSaveStandalone} className="w-full" disabled={blocks.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              {assignToCalendar ? 'Save & Schedule' : 'Save Program'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {blocks.length} block{blocks.length !== 1 ? 's' : ''} • {' '}
              {blocks.reduce((acc, b) => acc + b.exercises.length, 0)} exercises
            </p>
          </div>
          <Button onClick={template ? handleSave : () => setShowSaveDialog(true)} size="lg">
            <Save className="h-4 w-4 mr-2" /> {template ? 'Save Workout' : 'Save & Assign'}
          </Button>
        </div>
      </div>
    </div>
  );
}
