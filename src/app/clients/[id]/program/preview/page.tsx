'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTrainerStore } from '@/lib/store';
import { programTemplates } from '@/lib/programTemplates';
import { ClientProgram, ClientWorkoutDay, ClientWorkoutBlock, TrainingPhase, TrainingGoal } from '@/types';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Check, 
  Edit2, 
  Calendar,
  Dumbbell,
  ChevronRight,
  Play,
  Flame,
  Clock,
  RotateCcw,
  Users,
  User,
  ArrowUp,
  ArrowDown,
  Info
} from 'lucide-react';

// Exercise progressions/regressions mapping
const EXERCISE_PROGRESSIONS: Record<string, { progressions: string[]; regressions: string[] }> = {
  // Squat patterns
  'leg-press': { progressions: ['Goblet Squat', 'Barbell Back Squat', 'Front Squat'], regressions: ['Wall Sit', 'Bodyweight Squat to Box'] },
  'goblet-squat': { progressions: ['Barbell Back Squat', 'Front Squat'], regressions: ['Leg Press', 'Box Squat'] },
  'barbell-squat': { progressions: ['Front Squat', 'Pause Squat', 'Tempo Squat'], regressions: ['Goblet Squat', 'Leg Press'] },
  'front-squat': { progressions: ['Overhead Squat', 'Pause Front Squat'], regressions: ['Goblet Squat', 'Back Squat'] },
  'leg-extension': { progressions: ['Single Leg Extension', 'Sissy Squat'], regressions: ['Bodyweight Leg Extension'] },
  // Hinge patterns
  'leg-curl-machine': { progressions: ['Nordic Curl Eccentric', 'Glute Ham Raise'], regressions: ['Stability Ball Curl'] },
  'rdl-dumbbell': { progressions: ['Barbell RDL', 'Single Leg RDL'], regressions: ['Good Morning', 'Hip Hinge with Dowel'] },
  'romanian-deadlift': { progressions: ['Single Leg RDL', 'Deficit RDL'], regressions: ['Dumbbell RDL', 'Good Morning'] },
  'deadlift': { progressions: ['Deficit Deadlift', 'Pause Deadlift'], regressions: ['Trap Bar Deadlift', 'Block Pull'] },
  'glute-bridge': { progressions: ['Hip Thrust', 'Single Leg Bridge'], regressions: ['Bodyweight Bridge Hold'] },
  'hip-thrust': { progressions: ['Single Leg Hip Thrust', 'Banded Hip Thrust'], regressions: ['Glute Bridge'] },
  'back-extension': { progressions: ['Weighted Back Extension', 'Reverse Hyper'], regressions: ['Prone Back Extension'] },
  // Push patterns
  'chest-press-machine': { progressions: ['Dumbbell Bench Press', 'Barbell Bench Press'], regressions: ['Push-ups (Incline)', 'Wall Push-ups'] },
  'barbell-bench-press': { progressions: ['Pause Bench Press', 'Close Grip Bench'], regressions: ['Dumbbell Bench Press', 'Machine Chest Press'] },
  'incline-dumbbell-press': { progressions: ['Incline Barbell Press', 'Pause Incline Press'], regressions: ['Incline Machine Press', 'Push-ups'] },
  'incline-chest-press': { progressions: ['Incline Barbell Press', 'Pause Incline Press'], regressions: ['Incline Machine Press', 'Push-ups'] },
  'shoulder-press-machine': { progressions: ['Dumbbell Shoulder Press', 'Barbell OHP'], regressions: ['Seated DB Press (Light)', 'Landmine Press'] },
  'overhead-press': { progressions: ['Push Press', 'Strict Press (Heavier)'], regressions: ['Dumbbell Shoulder Press', 'Landmine Press'] },
  'push-up': { progressions: ['Diamond Push-ups', 'Weighted Push-ups'], regressions: ['Incline Push-ups', 'Wall Push-ups'] },
  'tricep-pushdown': { progressions: ['Skull Crushers', 'Close Grip Bench'], regressions: ['Band Pushdowns'] },
  'db-lateral-raise': { progressions: ['Cable Lateral Raise', 'Heavy Partials'], regressions: ['Light DB Raises', 'Band Lateral Raise'] },
  'cable-chest-fly': { progressions: ['Dumbbell Flyes', 'Weighted Flyes'], regressions: ['Pec Deck Machine'] },
  // Pull patterns
  'lat-pulldown': { progressions: ['Assisted Pull-ups', 'Pull-ups'], regressions: ['Straight Arm Pulldown', 'Band Pulldown'] },
  'seated-row-machine': { progressions: ['Cable Row', 'Barbell Row'], regressions: ['Band Rows', 'TRX Rows'] },
  'barbell-row': { progressions: ['Pendlay Row', 'Weighted Row'], regressions: ['Cable Row', 'Dumbbell Row'] },
  'pull-up': { progressions: ['Weighted Pull-ups', 'L-sit Pull-ups'], regressions: ['Assisted Pull-ups', 'Lat Pulldown'] },
  'face-pull': { progressions: ['High Pull', 'Band Pull-Aparts'], regressions: ['Light Band Face Pull'] },
  'cable-row': { progressions: ['Barbell Row', 'Single Arm Row'], regressions: ['Seated Row Machine', 'Band Rows'] },
  'bicep-curl-machine': { progressions: ['Barbell Curl', 'Preacher Curl'], regressions: ['Band Curls'] },
  'band-pull-apart': { progressions: ['Face Pulls', 'Rear Delt Fly'], regressions: ['Light Band Pull-Apart'] },
  // Core
  'plank': { progressions: ['Weighted Plank', 'Plank with Shoulder Tap'], regressions: ['Incline Plank', 'Dead Bug'] },
  'dead-bug': { progressions: ['Weighted Dead Bug', 'Pallof Press'], regressions: ['Supine March'] },
  'bird-dog': { progressions: ['Weighted Bird Dog', 'Band Bird Dog'], regressions: ['Quadruped Hold'] },
  'bicycle-crunch': { progressions: ['Weighted Crunch', 'Hanging Knee Raise'], regressions: ['Basic Crunch'] },
  'mountain-climber': { progressions: ['Weighted Mountain Climber', 'Plyo Mountain Climber'], regressions: ['Slow Mountain Climber'] },
  // Lunge patterns
  'reverse-lunge': { progressions: ['Walking Lunge', 'Bulgarian Split Squat'], regressions: ['Split Squat', 'Step-ups'] },
  'walking-lunge': { progressions: ['Weighted Lunge', 'Deficit Lunge'], regressions: ['Stationary Lunge', 'Split Squat'] },
  'bulgarian-split-squat': { progressions: ['Weighted Bulgarian', 'Deficit Bulgarian'], regressions: ['Split Squat', 'Reverse Lunge'] },
  'step-up': { progressions: ['Weighted Step-up', 'Box Jump'], regressions: ['Low Step-up', 'Assisted Step-up'] },
  // Hip abductor/adductor
  'hip-abductor': { progressions: ['Banded Side Steps', 'Cable Hip Abduction'], regressions: ['Clamshells'] },
  'hip-adductor': { progressions: ['Copenhagen Plank', 'Cable Hip Adduction'], regressions: ['Lying Adduction'] },
  // Calf
  'calf-raise-machine': { progressions: ['Single Leg Calf Raise', 'Deficit Calf Raise'], regressions: ['Seated Calf Raise'] },
};

const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
] as const;

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export default function WeeklyPlanPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.id as string;
  const templateId = searchParams.get('templateId');
  
  const { clients, addClientProgram, addCalendarEvent } = useTrainerStore();
  const client = clients.find(c => c.clientId === clientId);
  const template = programTemplates.find(t => t.id === templateId);
  
  const [selectedFrequency, setSelectedFrequency] = useState<number>(
    template?.frequencyOptions[0] || 3
  );
  // For fixed days mode: which days of the week are training days
  const [selectedTrainingDays, setSelectedTrainingDays] = useState<typeof DAYS_OF_WEEK[number][]>([]);
  // For fixed days mode: which workout is assigned to each training day
  const [workoutAssignments, setWorkoutAssignments] = useState<Partial<Record<typeof DAYS_OF_WEEK[number], number>>>({});
  const [activeDay, setActiveDay] = useState<string>('0');
  const [useCyclingMode, setUseCyclingMode] = useState<boolean>(false);
  const [sessionType, setSessionType] = useState<'pt' | 'solo' | 'mixed'>('pt');
  const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string } | null>(null);

  // Helper to sort blocks: warmup first, work in middle, cooldown last
  const sortBlocks = (blocksToSort: { type: string }[]) => {
    const order: Record<string, number> = { warmup: 0, work: 1, cooldown: 2 };
    return [...blocksToSort].sort((a, b) => (order[a.type] ?? 1) - (order[b.type] ?? 1));
  };

  // Create workout days based on template and frequency
  const workoutDays = useMemo(() => {
    if (!template) return [];
    
    // Take the first N days based on frequency
    const daysToUse = template.days.slice(0, selectedFrequency);
    
    return daysToUse.map((day, index) => {
      const mappedBlocks = day.blocks.map(block => ({
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
      
      return {
        id: `day-${index}`,
        dayLabel: day.dayLabel,
        scheduledDay: undefined, // Will be set based on selectedTrainingDays
        blocks: sortBlocks(mappedBlocks),
      };
    }) as ClientWorkoutDay[];
  }, [template, selectedFrequency]);

  // Toggle a day as a training day
  const handleToggleTrainingDay = (day: typeof DAYS_OF_WEEK[number]) => {
    setSelectedTrainingDays(prev => {
      if (prev.includes(day)) {
        // Remove day and its workout assignment
        setWorkoutAssignments(wa => {
          const newWa = { ...wa };
          delete newWa[day];
          return newWa;
        });
        return prev.filter(d => d !== day);
      } else if (prev.length < selectedFrequency) {
        // Add day with default workout assignment (cycling through available workouts)
        const nextWorkoutIndex = prev.length % workoutDays.length;
        setWorkoutAssignments(wa => ({ ...wa, [day]: nextWorkoutIndex }));
        return [...prev, day];
      }
      return prev;
    });
  };

  // Change which workout is assigned to a specific training day
  const handleChangeWorkoutForDay = (day: typeof DAYS_OF_WEEK[number]) => {
    setWorkoutAssignments(prev => {
      const currentIndex = prev[day] ?? 0;
      const nextIndex = (currentIndex + 1) % workoutDays.length;
      return { ...prev, [day]: nextIndex };
    });
  };

  const handleCreateProgram = () => {
    if (!template || !client) return;

    const program: ClientProgram = {
      id: `program-${Date.now()}`,
      clientId,
      trainerId: client.trainerId,
      templateId: template.id,
      templateName: template.name,
      phase: template.phases[0] as TrainingPhase,
      goal: (client.goals?.[0] || template.goals[0]) as TrainingGoal,
      weeklyPlan: workoutDays,
      startDate: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addClientProgram(program);
    
    // Auto-schedule sessions based on selected training days
    if (selectedTrainingDays.length > 0) {
      const dayToNumber: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
      };
      
      const today = new Date();
      const currentDayOfWeek = today.getDay();
      
      // Schedule sessions for next 4 weeks
      for (let week = 0; week < 4; week++) {
        selectedTrainingDays.forEach((dayName, idx) => {
          const targetDayNum = dayToNumber[dayName];
          let daysUntil = targetDayNum - currentDayOfWeek;
          if (daysUntil <= 0 && week === 0) daysUntil += 7;
          
          const sessionDate = new Date(today);
          sessionDate.setDate(today.getDate() + daysUntil + (week * 7));
          
          const workoutIndex = workoutAssignments[dayName] ?? idx % workoutDays.length;
          const workout = workoutDays[workoutIndex];
          
          addCalendarEvent({
            title: workout?.dayLabel || `Training Day ${idx + 1}`,
            type: 'session',
            date: sessionDate.toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '10:00',
            duration: 60,
            clientId,
            trainerId: client.trainerId,
            status: 'scheduled',
            notes: `Week ${week + 1} - ${template.name}`,
          });
        });
      }
    }
    
    router.push(`/clients/${clientId}`);
  };

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'warmup': return <Flame className="h-4 w-4 text-orange-500" />;
      case 'cooldown': return <RotateCcw className="h-4 w-4 text-blue-500" />;
      default: return <Dumbbell className="h-4 w-4 text-primary" />;
    }
  };

  if (!template) {
    return (
      <div className="container mx-auto p-6">
        <p>Template not found</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold">Weekly Plan Preview</h1>
        <p className="text-muted-foreground">{template.name}</p>
      </div>

      {/* Template Summary */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
              <div className="flex flex-wrap gap-1">
                {template.phases.map(phase => (
                  <Badge key={phase} variant="outline">{phase}</Badge>
                ))}
                {template.goals.slice(0, 3).map(goal => (
                  <Badge key={goal} variant="secondary">{goal.replace('_', ' ')}</Badge>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <Edit2 className="h-4 w-4 mr-1" /> Change
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session Type Selection */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-4 w-4" /> Session Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={sessionType === 'pt' ? 'default' : 'outline'}
              className={`flex flex-col h-auto py-3 ${sessionType === 'pt' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              onClick={() => setSessionType('pt')}
            >
              <Users className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">PT Sessions</span>
              <span className="text-xs opacity-70">All with trainer</span>
            </Button>
            <Button
              variant={sessionType === 'solo' ? 'default' : 'outline'}
              className={`flex flex-col h-auto py-3 ${sessionType === 'solo' ? 'bg-gray-600 hover:bg-gray-700' : ''}`}
              onClick={() => setSessionType('solo')}
            >
              <User className="h-5 w-5 mb-1" />
              <span className="text-sm font-medium">Solo Sessions</span>
              <span className="text-xs opacity-70">Client trains alone</span>
            </Button>
            <Button
              variant={sessionType === 'mixed' ? 'default' : 'outline'}
              className={`flex flex-col h-auto py-3 ${sessionType === 'mixed' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
              onClick={() => setSessionType('mixed')}
            >
              <div className="flex gap-0.5 mb-1">
                <Users className="h-4 w-4" />
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Mixed</span>
              <span className="text-xs opacity-70">Combination</span>
            </Button>
          </div>
          {sessionType === 'mixed' && (
            <p className="text-xs text-muted-foreground mt-3">
              You can set PT or Solo for each day in the schedule below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Frequency Selection */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Training Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {template.frequencyOptions.map(freq => (
              <Button
                key={freq}
                variant={selectedFrequency === freq ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedFrequency(freq);
                  setSelectedTrainingDays([]);
                  setWorkoutAssignments({});
                }}
              >
                {freq}x per week
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduling Mode */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Scheduling Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <Label htmlFor="cycling-mode" className="text-sm font-medium">
                {useCyclingMode ? 'Cycling Mode' : 'Fixed Days'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {useCyclingMode 
                  ? 'Client cycles through Day 1, 2, 3... whenever they train' 
                  : 'Assign workouts to specific days of the week'
                }
              </p>
            </div>
            <Switch
              id="cycling-mode"
              checked={useCyclingMode}
              onCheckedChange={(checked) => {
                setUseCyclingMode(checked);
                if (checked) {
                  setSelectedTrainingDays([]);
                  setWorkoutAssignments({});
                }
              }}
            />
          </div>

          {useCyclingMode ? (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Workout Rotation:</p>
              <div className="flex flex-wrap gap-2">
                {workoutDays.map((day, index) => (
                  <Badge key={day.id} variant="secondary" className="text-sm">
                    Day {index + 1}: {day.dayLabel}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Client completes workouts in order, regardless of which day they come in.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 1: Select training days */}
              <div>
                <p className="text-sm font-medium mb-2">
                  Select {selectedFrequency} training days ({selectedTrainingDays.length}/{selectedFrequency} selected)
                </p>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map(weekday => {
                    const isSelected = selectedTrainingDays.includes(weekday);
                    const canSelect = isSelected || selectedTrainingDays.length < selectedFrequency;
                    return (
                      <Button
                        key={weekday}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className={`w-12 h-9 ${!canSelect ? 'opacity-50' : ''}`}
                        onClick={() => handleToggleTrainingDay(weekday)}
                        disabled={!canSelect}
                      >
                        {DAY_LABELS[weekday]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Show workout assignments for selected days */}
              {selectedTrainingDays.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Workout Schedule (tap to change)</p>
                  <div className="space-y-2">
                    {DAYS_OF_WEEK.filter(d => selectedTrainingDays.includes(d)).map(weekday => {
                      const workoutIndex = workoutAssignments[weekday] ?? 0;
                      const workout = workoutDays[workoutIndex];
                      return (
                        <div 
                          key={weekday} 
                          className="flex items-center justify-between bg-muted/50 rounded-lg p-3 cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={() => handleChangeWorkoutForDay(weekday)}
                        >
                          <span className="font-medium">{DAY_LABELS[weekday]}</span>
                          <Badge variant="secondary" className="text-sm">
                            {workout?.dayLabel || `Workout ${workoutIndex + 1}`}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tap a day to cycle through different workouts
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workout Details */}
      <Card className="mb-20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Dumbbell className="h-4 w-4" /> Workout Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeDay} onValueChange={setActiveDay}>
            <TabsList className="mb-4">
              {workoutDays.map((day, index) => (
                <TabsTrigger key={day.id} value={String(index)}>
                  {day.dayLabel}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {workoutDays.map((day, index) => (
              <TabsContent key={day.id} value={String(index)}>
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-4">
                    {day.blocks.map(block => (
                      <div key={block.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          {getBlockIcon(block.type)}
                          <h4 className="font-medium">{block.name}</h4>
                          <Badge variant="outline" className="text-xs capitalize">
                            {block.type}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          {block.exercises.map((exercise, exIndex) => (
                            <div 
                              key={exercise.id}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={() => setSelectedExercise({ id: exercise.exerciseId, name: exercise.exerciseName })}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-5">
                                  {exIndex + 1}.
                                </span>
                                <div>
                                  <p className="font-medium text-sm flex items-center gap-1">
                                    {exercise.exerciseName}
                                    {EXERCISE_PROGRESSIONS[exercise.exerciseId] && (
                                      <Info className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {exercise.movementPattern}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-sm">
                                <p>{exercise.sets} × {exercise.reps}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {exercise.rest}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="mt-4 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push(
                      `/clients/${clientId}/program/builder?templateId=${templateId}&day=${index}`
                    )}
                  >
                    <Edit2 className="h-4 w-4 mr-2" /> Customize This Day
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {selectedFrequency} workouts per week
              {useCyclingMode && ' • Cycling mode'}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {sessionType === 'pt' && <><Users className="h-3 w-3" /> PT Sessions</>}
              {sessionType === 'solo' && <><User className="h-3 w-3" /> Solo Sessions</>}
              {sessionType === 'mixed' && <><Users className="h-3 w-3" /><User className="h-3 w-3" /> Mixed Sessions</>}
            </p>
          </div>
          <Button onClick={handleCreateProgram} size="lg">
            <Check className="h-4 w-4 mr-2" /> Assign Program
          </Button>
        </div>
      </div>

      {/* Exercise Progressions/Regressions Dialog */}
      <Dialog open={!!selectedExercise} onOpenChange={(open) => !open && setSelectedExercise(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              {selectedExercise?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedExercise && (() => {
            const exerciseData = EXERCISE_PROGRESSIONS[selectedExercise.id];
            
            if (!exerciseData) {
              return (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No progressions/regressions data available for this exercise.</p>
                </div>
              );
            }
            
            return (
              <div className="space-y-4">
                {/* Progressions (harder) */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUp className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-sm">Progressions</span>
                    <span className="text-xs text-muted-foreground">(harder)</span>
                  </div>
                  <div className="space-y-1">
                    {exerciseData.progressions.map((prog, idx) => (
                      <div 
                        key={idx} 
                        className="p-2 bg-green-500/10 border border-green-500/20 rounded text-sm"
                      >
                        {prog}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Regressions (easier) */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDown className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">Regressions</span>
                    <span className="text-xs text-muted-foreground">(easier)</span>
                  </div>
                  <div className="space-y-1">
                    {exerciseData.regressions.map((reg, idx) => (
                      <div 
                        key={idx} 
                        className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm"
                      >
                        {reg}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
