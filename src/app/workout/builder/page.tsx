'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
} from '@/components/ui/dialog';
import { useTrainerStore, useAuthStore } from '@/lib/store';
import { defaultTemplates } from '@/lib/templates';
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
  Target,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function SessionWorkoutBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const clientId = searchParams.get('clientId');
  const templateId = searchParams.get('templateId');
  
  const { user } = useAuthStore();
  const { clients, calendarEvents, updateCalendarEvent } = useTrainerStore();
  
  const client = clients.find(c => c.clientId === clientId);
  const event = calendarEvents.find(e => e.id === eventId);
  const template = defaultTemplates.find(t => t.id === templateId);
  
  const [workoutName, setWorkoutName] = useState(template?.name || event?.title || 'Custom Workout');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored);
  }, []);
  
  const clientUser = allUsers.find(u => u.id === clientId);
  
  // Initialize blocks from template or empty
  const initialBlocks = useMemo(() => {
    if (template?.exercises) {
      // Convert template exercises to blocks
      const workBlock: WorkoutBlock = {
        id: 'main-block',
        type: 'work',
        name: 'Main Workout',
        exercises: template.exercises.map((ex, idx) => ({
          id: `ex-${idx}`,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exercise?.name || 'Exercise',
          movementPattern: 'push' as MovementPattern,
          sets: ex.sets?.length || 3,
          reps: ex.sets?.[0]?.reps?.toString() || '8-12',
          rest: `${ex.restTimerSeconds || 60}s`,
        })),
      };
      return [workBlock];
    }
    return [];
  }, [template]);

  const [blocks, setBlocks] = useState<WorkoutBlock[]>(initialBlocks);
  const [editingExercise, setEditingExercise] = useState<{ blockId: string; exercise: WorkoutExercise } | null>(null);
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const filteredExercises = COMMON_EXERCISES.filter(ex => 
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

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

  const addExercise = (blockId: string, exercise: typeof COMMON_EXERCISES[0]) => {
    const newExercise: WorkoutExercise = {
      id: `ex-${Date.now()}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      movementPattern: exercise.pattern as MovementPattern,
      sets: 3,
      reps: '8-12',
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

  const saveExerciseEdit = () => {
    if (!editingExercise) return;
    setBlocks(blocks.map(b => 
      b.id === editingExercise.blockId
        ? { ...b, exercises: b.exercises.map(e => e.id === editingExercise.exercise.id ? editingExercise.exercise : e) }
        : b
    ));
    setEditingExercise(null);
  };

  const handleSave = () => {
    // Create a workout ID for this session
    const workoutId = `session-workout-${Date.now()}`;
    
    // Update the calendar event with the workout ID
    if (eventId) {
      updateCalendarEvent(eventId, { 
        workoutId,
        title: workoutName,
      });
    }
    
    // Store the workout blocks (in a real app, this would go to database)
    const workoutData = {
      id: workoutId,
      name: workoutName,
      clientId,
      eventId,
      blocks,
      createdAt: new Date().toISOString(),
    };
    
    // Save to localStorage for now
    const existingWorkouts = JSON.parse(localStorage.getItem('apex-session-workouts') || '[]');
    localStorage.setItem('apex-session-workouts', JSON.stringify([...existingWorkouts, workoutData]));
    
    toast.success('Workout saved and linked to session!');
    router.back();
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-24">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Session Workout Builder</h1>
        {clientUser && (
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>For: {clientUser?.displayName || 'Client'}</span>
          </div>
        )}
        {event && (
          <p className="text-sm text-muted-foreground mt-1">
            <Clock className="h-3 w-3 inline mr-1" />
            {event.date} at {event.startTime}
          </p>
        )}
      </div>

      {/* Workout Name */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label>Workout Name</Label>
          <Input 
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="Enter workout name..."
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Template Selection */}
      {blocks.length === 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Start from Template</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {defaultTemplates.map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => {
                      setWorkoutName(t.name);
                      const workBlock: WorkoutBlock = {
                        id: 'main-block',
                        type: 'work',
                        name: 'Main Workout',
                        exercises: t.exercises.map((ex, idx) => ({
                          id: `ex-${idx}`,
                          exerciseId: ex.exerciseId,
                          exerciseName: ex.exercise?.name || 'Exercise',
                          movementPattern: 'push' as MovementPattern,
                          sets: ex.sets?.length || 3,
                          reps: ex.sets?.[0]?.reps?.toString() || '8-12',
                          rest: `${ex.restTimerSeconds || 60}s`,
                        })),
                      };
                      setBlocks([workBlock]);
                    }}
                  >
                    <div className="text-left">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.exercises.length} exercises • {t.category}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Or start from scratch:</p>
              <div className="flex gap-2 flex-wrap">
                {BLOCK_TYPES.map((blockType) => (
                  <Button
                    key={blockType.value}
                    variant="outline"
                    size="sm"
                    onClick={() => addBlock(blockType.value)}
                    className="gap-1"
                  >
                    {blockType.icon}
                    {blockType.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workout Blocks */}
      {blocks.length > 0 && (
        <div className="space-y-4 mb-4">
          {blocks.map((block) => {
            const styles = getBlockStyles(block.type);
            return (
              <Card key={block.id} className={`${styles.bg} ${styles.border} border`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {BLOCK_TYPES.find(t => t.value === block.type)?.icon}
                      <Input
                        value={block.name}
                        onChange={(e) => setBlocks(blocks.map(b => 
                          b.id === block.id ? { ...b, name: e.target.value } : b
                        ))}
                        className="h-8 w-40 bg-transparent border-none text-lg font-semibold"
                      />
                      <Badge variant="outline" className={styles.badge}>
                        {block.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => removeBlock(block.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {block.exercises.map((exercise, idx) => (
                      <div
                        key={exercise.id}
                        className="flex items-center gap-2 p-3 bg-background/50 rounded-lg"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{exercise.exerciseName}</p>
                          <p className="text-xs text-muted-foreground">
                            {exercise.sets} × {exercise.reps} • {exercise.rest} rest
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingExercise({ blockId: block.id, exercise })}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          onClick={() => removeExercise(block.id, exercise.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {showAddExercise === block.id ? (
                      <div className="p-3 bg-background rounded-lg border">
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={exerciseSearch}
                            onChange={(e) => setExerciseSearch(e.target.value)}
                            placeholder="Search exercises..."
                            className="pl-9"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="h-40">
                          <div className="space-y-1">
                            {filteredExercises.map((ex) => (
                              <Button
                                key={ex.id}
                                variant="ghost"
                                className="w-full justify-start h-auto py-2"
                                onClick={() => addExercise(block.id, ex)}
                              >
                                <div className="text-left">
                                  <p className="font-medium text-sm">{ex.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{ex.pattern}</p>
                                </div>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => {
                            setShowAddExercise(null);
                            setExerciseSearch('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowAddExercise(block.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Exercise
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add Block Buttons */}
          <div className="flex gap-2 flex-wrap">
            {BLOCK_TYPES.map((blockType) => (
              <Button
                key={blockType.value}
                variant="outline"
                size="sm"
                onClick={() => addBlock(blockType.value)}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                {blockType.icon}
                {blockType.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Exercise Dialog */}
      <Dialog open={!!editingExercise} onOpenChange={(open) => !open && setEditingExercise(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
          </DialogHeader>
          {editingExercise && (
            <div className="space-y-4">
              <div>
                <Label>Exercise</Label>
                <p className="font-medium">{editingExercise.exercise.exerciseName}</p>
              </div>
              
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

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {blocks.length} block{blocks.length !== 1 ? 's' : ''} • {' '}
              {blocks.reduce((acc, b) => acc + b.exercises.length, 0)} exercises
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            size="lg"
            disabled={blocks.length === 0}
          >
            <Save className="h-4 w-4 mr-2" /> Save & Link to Session
          </Button>
        </div>
      </div>
    </div>
  );
}
