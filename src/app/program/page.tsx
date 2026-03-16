'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useTrainerStore } from '@/lib/store';
import { suggestedPrograms, SuggestedProgram } from '@/lib/suggestedPrograms';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Dumbbell, 
  ChevronRight,
  Sparkles,
  Calendar,
  Target,
  Play,
  Brain,
  ShieldAlert,
  Loader2,
  Clock,
  Zap,
  AlertTriangle,
  Heart,
  CalendarPlus,
  Check,
  Filter,
  BookOpen,
  ChevronDown,
  X,
  LayoutGrid,
  User
} from 'lucide-react';
import { MALE_SHAPES, FEMALE_SHAPES } from '@/components/BodyShapeSVGs';

interface AIBlock {
  name: string;
  type: string;
  exercises: {
    exerciseId: string;
    name: string;
    sets: number;
    reps: number;
    restSeconds: number;
    notes?: string;
  }[];
}

interface AIWorkout {
  name: string;
  description: string;
  estimatedMinutes: number;
  blocks: AIBlock[];
}

interface AIProgram {
  name: string;
  description: string;
  goal: string;
  expertise: string;
  daysPerWeek: number;
  blockLengthWeeks: number;
  deloadWeek: number;
  days: {
    dayNumber: number;
    dayLabel: string;
    scheduledDay: string;
    blocks: AIBlock[];
  }[];
  progressionNotes: string;
  deloadInstructions: string;
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

interface SavedProgram {
  id: string;
  name: string;
  description: string;
  source: 'ai' | 'template';
  templateId?: string;
  daysPerWeek: number;
  weeks: number;
  createdAt: string;
  goal?: string;
}

function loadSavedPrograms(userId: string): SavedProgram[] {
  try {
    const data = localStorage.getItem(`apex-programs-${userId}`);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveProgramsList(userId: string, programs: SavedProgram[]) {
  localStorage.setItem(`apex-programs-${userId}`, JSON.stringify(programs));
}

export default function ProgramPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { startFromTemplate } = useWorkoutStore();

  // AI Generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [genStep, setGenStep] = useState<'form' | 'injury_check' | 'injury_block' | 'generating' | 'result'>('form');
  const [bodyGender, setBodyGender] = useState<'male' | 'female'>((user?.gender === 'female') ? 'female' : 'male');
  const [bodyShape, setBodyShape] = useState('');
  const [goal, setGoal] = useState('');
  const [expertise, setExpertise] = useState('');
  const [equipment, setEquipment] = useState('');
  const [duration, setDuration] = useState('60');
  const [hasInjury, setHasInjury] = useState<string | null>(null);
  const [generatedWorkout, setGeneratedWorkout] = useState<AIWorkout | null>(null);
  const [generatedProgram, setGeneratedProgram] = useState<AIProgram | null>(null);
  const [programMode, setProgramMode] = useState(false);
  const [trainingDays, setTrainingDays] = useState(3);
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'wednesday', 'friday']);
  const [genError, setGenError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedToCalendar, setSavedToCalendar] = useState(false);

  // Suggested Programs state
  const [filterGoal, setFilterGoal] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<number>(0);
  const [selectedProgram, setSelectedProgram] = useState<SuggestedProgram | null>(null);
  const [programSaved, setProgramSaved] = useState(false);

  // New dialogs
  const [showCreateChoice, setShowCreateChoice] = useState(false);
  const [showBrowseTemplates, setShowBrowseTemplates] = useState(false);
  
  // Saved programs
  const [savedPrograms, setSavedPrograms] = useState<SavedProgram[]>([]);
  
  // Schedule configuration for program activation
  const [scheduleMode, setScheduleMode] = useState<'fixed' | 'cycle' | 'interval'>('fixed');
  const [scheduleFixedDays, setScheduleFixedDays] = useState<string[]>(['monday', 'wednesday', 'friday']);
  const [scheduleInterval, setScheduleInterval] = useState(2); // every Nth day
  const [showScheduleStep, setShowScheduleStep] = useState(false);
  
  const { addCalendarEvent } = useTrainerStore();
  
  // Load saved programs
  useEffect(() => {
    if (user?.id) {
      setSavedPrograms(loadSavedPrograms(user.id));
    }
  }, [user?.id]);

  const handleSaveToCalendar = () => {
    if (!generatedProgram || !user) return;
    
    // Map weekday name to next occurrence date
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    
    const today = new Date();
    const todayDow = today.getDay();
    
    // Create 4 weeks of events (1 block cycle)
    for (let week = 0; week < generatedProgram.blockLengthWeeks; week++) {
      generatedProgram.days.forEach((day) => {
        const targetDow = dayMap[day.scheduledDay?.toLowerCase() || 'monday'] ?? 1;
        let daysUntil = targetDow - todayDow;
        if (daysUntil <= 0) daysUntil += 7;
        
        const eventDate = new Date(today);
        eventDate.setDate(eventDate.getDate() + daysUntil + (week * 7));
        const dateStr = eventDate.toISOString().split('T')[0];
        
        const totalExInDay = day.blocks.reduce((s, b) => s + b.exercises.length, 0);
        const isDeload = week === generatedProgram.blockLengthWeeks - 1;
        
        addCalendarEvent({
          title: `${day.dayLabel}${isDeload ? ' (Deload)' : ''}`,
          type: 'workout',
          date: dateStr,
          startTime: '07:00',
          endTime: '08:00',
          clientId: user.id,
          trainerId: user.id,
          status: 'scheduled',
          notes: `${totalExInDay} exercises • AI Program: ${generatedProgram.name}${isDeload ? ' • Deload week: reduce volume' : ''}`,
        });
      });
    }
    
    // Also save to My Programs
    const newSaved: SavedProgram = {
      id: `ai-${Date.now()}`,
      name: generatedProgram.name,
      description: generatedProgram.description,
      source: 'ai',
      daysPerWeek: generatedProgram.daysPerWeek,
      weeks: generatedProgram.blockLengthWeeks,
      createdAt: new Date().toISOString(),
      goal: generatedProgram.goal,
    };
    const updated = [newSaved, ...savedPrograms];
    setSavedPrograms(updated);
    saveProgramsList(user.id, updated);
    
    setSavedToCalendar(true);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) return null;

  const isPro = (user.membershipTier || 'pro') !== 'free';

  const resetGenerator = () => {
    setGenStep('form');
    setBodyShape('');
    setGoal('');
    setExpertise('');
    setEquipment('');
    setDuration('60');
    setHasInjury(null);
    setGeneratedWorkout(null);
    setGeneratedProgram(null);
    setProgramMode(false);
    setTrainingDays(3);
    setSelectedDays(['monday', 'wednesday', 'friday']);
    setGenError('');
    setIsGenerating(false);
    setSavedToCalendar(false);
  };

  const handleFormSubmit = () => {
    if (!goal || !expertise || !equipment) return;
    setGenStep('injury_check');
  };

  const handleInjuryResponse = (injured: boolean) => {
    if (injured) {
      setHasInjury('yes');
      setGenStep('injury_block');
    } else {
      setHasInjury('no');
      generateWorkout();
    }
  };

  const generateWorkout = async () => {
    setGenStep('generating');
    setIsGenerating(true);
    setGenError('');

    try {
      const body: any = { goal, expertise, equipment, duration: parseInt(duration), bodyShape, bodyGender };
      if (programMode) {
        body.programMode = true;
        body.days = trainingDays;
        body.selectedDays = selectedDays.slice(0, trainingDays);
      }

      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenError(data.error || 'Failed to generate');
        setGenStep('form');
        setIsGenerating(false);
        return;
      }

      if (programMode && data.program) {
        setGeneratedProgram(data.program);
      } else {
        setGeneratedWorkout(data.workout);
      }
      setGenStep('result');
    } catch (err) {
      setGenError('Network error. Please try again.');
      setGenStep('form');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartGenerated = () => {
    if (!generatedWorkout || !user) return;

    // Build block metadata for active workout colored headers
    const blocks = generatedWorkout.blocks.map((block, bIdx) => {
      const blockId = `ai-block-${bIdx}-${Date.now()}`;
      return {
        id: blockId,
        type: block.type || 'strength',
        name: block.name || 'Block',
        exercises: block.exercises.map(ex => ({
          id: `gen-${ex.exerciseId}-${Math.random().toString(36).slice(2, 6)}`,
          exerciseId: ex.exerciseId,
          exerciseName: ex.name,
          sets: ex.sets,
          reps: String(ex.reps),
          rest: `${ex.restSeconds}s`,
          repType: 'reps' as const,
          setStyle: 'fixed' as const,
        })),
      };
    });

    // Convert AI workout into a WorkoutTemplate compatible format
    const exercises = generatedWorkout.blocks.flatMap(block =>
      block.exercises.map(ex => ({
        id: `gen-${ex.exerciseId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: ex.exerciseId,
        exercise: {
          id: ex.exerciseId,
          name: ex.name,
          primaryMuscles: [] as string[],
          secondaryMuscles: [] as string[],
          category: 'compound' as const,
          equipment: 'barbell' as const,
        },
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          id: `gen-set-${ex.exerciseId}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          setNumber: i + 1,
          targetReps: ex.reps,
          reps: undefined as number | undefined,
          weight: undefined as number | undefined,
          completed: false,
        })),
        restBetweenSets: ex.restSeconds,
        notes: ex.notes || '',
      }))
    );

    const template = {
      id: `ai-gen-${Date.now()}`,
      name: generatedWorkout.name,
      description: generatedWorkout.description,
      exercises,
      blocks,
      createdBy: user.id,
      isPublic: false,
      estimatedDuration: generatedWorkout.estimatedMinutes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    startFromTemplate(template as any);
    setShowGenerator(false);
    resetGenerator();
    router.push('/workout/active');
  };

  const totalExercises = generatedWorkout?.blocks.reduce((sum, b) => sum + b.exercises.length, 0) || 0;

  return (
    <MainLayout>
      <PageHeader title="Program" subtitle="Your training plans" />

      <div className="px-4 py-4 space-y-5">

        {/* My Programs */}
        {savedPrograms.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              My Programs
            </h2>
            <div className="space-y-2">
              {savedPrograms.map((prog) => (
                <Card key={prog.id} className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        prog.source === 'ai' ? 'bg-violet-500/20' : 'bg-emerald-500/20'
                      }`}>
                        {prog.source === 'ai' ? <Brain className="w-5 h-5 text-violet-400" /> : <LayoutGrid className="w-5 h-5 text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{prog.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className="text-[10px] bg-sky-500/20 text-sky-300 border-0">
                            {prog.daysPerWeek}×/wk • {prog.weeks} weeks
                          </Badge>
                          <span className="text-[10px] text-gray-500">
                            {new Date(prog.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => {
                          const updated = savedPrograms.filter(p => p.id !== prog.id);
                          setSavedPrograms(updated);
                          saveProgramsList(user.id, updated);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Create Options */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Create Your Own</h2>
          <div className="space-y-3">
            {/* AI Workout Generator — Hero Card */}
            <Card 
              className="bg-gradient-to-br from-violet-500/20 via-purple-500/15 to-fuchsia-500/20 border-violet-500/30 cursor-pointer hover:border-violet-500/50 transition-all hover:shadow-lg hover:shadow-violet-500/10"
              onClick={() => { resetGenerator(); setShowGenerator(true); }}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 relative">
                    <span className="text-2xl">🤖</span>
                    <Sparkles className="w-3 h-3 text-white absolute -top-0.5 -right-0.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">AI Workout Builder</h3>
                    <p className="text-xs text-gray-500">🤖 AI generates a single workout for you</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-violet-400" />
              </CardContent>
            </Card>

            <Card 
              className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-blue-500/50 transition-colors"
              onClick={() => setShowCreateChoice(true)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 flex items-center justify-center relative">
                    <span className="text-2xl">🤖</span>
                    <Calendar className="w-3 h-3 text-blue-400 absolute -bottom-0.5 -right-0.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">AI Program Builder</h3>
                    <p className="text-xs text-gray-500">🤖 AI-generated or pick from templates</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Find a Trainer */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Get Expert Help</h2>
          <Card 
            className="bg-gradient-to-r from-rose-500/20 to-pink-500/20 border-rose-500/30 cursor-pointer hover:border-rose-500/50 transition-colors"
            onClick={() => router.push('/friends')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-500/30 flex items-center justify-center">
                  <Target className="w-6 h-6 text-rose-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Find a Trainer</h3>
                    <p className="text-xs text-gray-500">Get a personalized program from a certified trainer</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Create Program Choice Dialog */}
      <Dialog open={showCreateChoice} onOpenChange={setShowCreateChoice}>
        <DialogContent className="bg-white border-gray-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Create Program
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Choose how you want to build your program
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Card 
              className="bg-gray-50 border-gray-200 cursor-pointer hover:border-violet-500/50 transition-colors"
              onClick={() => { setShowCreateChoice(false); resetGenerator(); setProgramMode(true); setShowGenerator(true); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">AI Generate</h3>
                  <p className="text-xs text-gray-500">Tell us your goals — AI creates a custom program</p>
                </div>
                <Sparkles className="w-5 h-5 text-violet-400" />
              </CardContent>
            </Card>

            <Card 
              className="bg-gray-50 border-gray-200 cursor-pointer hover:border-emerald-500/50 transition-colors"
              onClick={() => { setShowCreateChoice(false); setShowBrowseTemplates(true); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Browse Templates</h3>
                  <p className="text-xs text-gray-500">{suggestedPrograms.length} curated programs to choose from</p>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-400" />
              </CardContent>
            </Card>

            <Card 
              className="bg-gray-50 border-gray-200 cursor-pointer hover:border-sky-500/50 transition-colors"
              onClick={() => { setShowCreateChoice(false); router.push('/program/builder'); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center">
                  <Dumbbell className="w-6 h-6 text-sky-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Build Custom</h3>
                  <p className="text-xs text-gray-500">Create your own multi-day program from scratch</p>
                </div>
                <ChevronRight className="w-5 h-5 text-sky-400" />
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Browse Templates Dialog */}
      <Dialog open={showBrowseTemplates} onOpenChange={setShowBrowseTemplates}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Suggested Programs
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {suggestedPrograms.length} curated templates — tap to preview
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-1">
            <select value={filterGoal} onChange={(e) => setFilterGoal(e.target.value)}
              className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
              <option value="all">All Goals</option>
              <option value="strength">Strength</option>
              <option value="hypertrophy">Muscle Growth</option>
              <option value="fat_loss">Fat Loss</option>
              <option value="conditioning">Conditioning</option>
              <option value="mobility">Mobility</option>
              <option value="general">General</option>
            </select>
            <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
              className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select value={filterFrequency} onChange={(e) => setFilterFrequency(parseInt(e.target.value))}
              className="text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
              <option value={0}>Any Frequency</option>
              <option value={2}>2× / week</option>
              <option value={3}>3× / week</option>
              <option value={4}>4× / week</option>
              <option value={5}>5× / week</option>
              <option value={6}>6× / week</option>
            </select>
            {(filterGoal !== 'all' || filterDifficulty !== 'all' || filterFrequency !== 0) && (
              <button onClick={() => { setFilterGoal('all'); setFilterDifficulty('all'); setFilterFrequency(0); }}
                className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-900 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Program Cards */}
          <div className="space-y-2">
            {(() => {
              const filtered = suggestedPrograms.filter(p => {
                if (filterGoal !== 'all' && !p.goals.includes(filterGoal as any)) return false;
                if (filterDifficulty !== 'all' && p.difficulty !== filterDifficulty) return false;
                if (filterFrequency > 0 && !p.frequencyOptions.includes(filterFrequency)) return false;
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="py-6 text-center">
                      <Filter className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No programs match your filters</p>
                      <button className="text-xs text-violet-400 mt-1 hover:underline"
                        onClick={() => { setFilterGoal('all'); setFilterDifficulty('all'); setFilterFrequency(0); }}>
                        Clear filters
                      </button>
                    </CardContent>
                  </Card>
                );
              }

              return filtered.map((program) => {
                const diffColor = program.difficulty === 'beginner' ? 'text-green-400 bg-green-500/20'
                  : program.difficulty === 'intermediate' ? 'text-amber-400 bg-amber-500/20'
                  : 'text-red-400 bg-red-500/20';
                const totalExInProgram = program.days.reduce((s, d) => s + d.blocks.reduce((s2, b) => s2 + b.exercises.length, 0), 0);

                return (
                  <Card key={program.id}
                    className="bg-gray-50 border-gray-200 cursor-pointer hover:border-emerald-500/40 transition-colors"
                    onClick={() => { setShowBrowseTemplates(false); setSelectedProgram(program); setProgramSaved(false); }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <LayoutGrid className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{program.name}</h3>
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{program.description}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge className={`text-[10px] border-0 ${diffColor}`}>{program.difficulty}</Badge>
                            <Badge className="text-[10px] bg-sky-500/20 text-sky-300 border-0">
                              {program.days.length} days • {program.frequencyOptions.join('-')}×/wk
                            </Badge>
                            <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-0">{totalExInProgram} exercises</Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={(open) => { if (!open) { setShowGenerator(false); resetGenerator(); } }}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md max-h-[85vh] overflow-y-auto">
          
          {/* Step 1: Form */}
          {genStep === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-violet-400" />
                  AI Workout Generator
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Tell us about yourself and we&apos;ll create a personalized workout
                </DialogDescription>
              </DialogHeader>

              {genError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-300">{genError}</p>
                </div>
              )}

              <div className="space-y-5 pt-2">
                {/* Body Shape */}
                <div className="space-y-2">
                  <Label className="text-gray-900 font-medium">Your body type</Label>
                  <div className="flex items-center justify-center gap-1 p-1 bg-gray-100 rounded-lg mb-3">
                    <button
                      onClick={() => { setBodyGender('male'); setBodyShape(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                        bodyGender === 'male' ? 'bg-violet-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" /> Male
                    </button>
                    <button
                      onClick={() => { setBodyGender('female'); setBodyShape(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                        bodyGender === 'female' ? 'bg-violet-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" /> Female
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {(bodyGender === 'male' ? MALE_SHAPES : FEMALE_SHAPES).map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => setBodyShape(shape.id)}
                        className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                          bodyShape === shape.id
                            ? 'border-violet-500 bg-violet-500/10 shadow-md shadow-violet-500/10'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <shape.Component
                          className="w-10 h-16"
                          fill={bodyShape === shape.id ? '#8B5CF6' : '#9CA3AF'}
                        />
                        <p className="text-[10px] font-medium text-gray-900 mt-1 text-center">{shape.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goal */}
                <div className="space-y-2">
                  <Label className="text-gray-900 font-medium">What&apos;s your goal?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'strength', label: 'Strength', icon: '💪', desc: 'Get stronger' },
                      { value: 'hypertrophy', label: 'Muscle Growth', icon: '🏋️', desc: 'Build size' },
                      { value: 'weight_loss', label: 'Fat Loss', icon: '🔥', desc: 'Burn calories' },
                      { value: 'endurance', label: 'Endurance', icon: '🫀', desc: 'Build stamina' },
                    ].map((g) => (
                      <button
                        key={g.value}
                        onClick={() => setGoal(g.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          goal === g.value
                            ? 'border-violet-500 bg-violet-500/10 shadow-md shadow-violet-500/10'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-lg">{g.icon}</span>
                        <p className="text-sm font-medium text-gray-900 mt-1">{g.label}</p>
                        <p className="text-[10px] text-gray-500">{g.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div className="space-y-2">
                  <Label className="text-gray-900 font-medium">Experience level</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'beginner', label: 'Beginner', desc: '< 6 months' },
                      { value: 'intermediate', label: 'Intermediate', desc: '6mo - 2yr' },
                      { value: 'advanced', label: 'Advanced', desc: '2+ years' },
                    ].map((e) => (
                      <button
                        key={e.value}
                        onClick={() => setExpertise(e.value)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          expertise === e.value
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{e.label}</p>
                        <p className="text-[10px] text-gray-500">{e.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipment */}
                <div className="space-y-2">
                  <Label className="text-gray-900 font-medium">Available equipment</Label>
                  <Select value={equipment} onValueChange={setEquipment}>
                    <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                      <SelectValue placeholder="Select equipment access" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="full_gym">Full Gym (barbells, machines, cables)</SelectItem>
                      <SelectItem value="home_dumbbells">Home — Dumbbells + Bench</SelectItem>
                      <SelectItem value="minimal">Minimal — Dumbbells + Pull-up Bar</SelectItem>
                      <SelectItem value="bodyweight">Bodyweight Only</SelectItem>
                      <SelectItem value="resistance_bands">Resistance Bands</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label className="text-gray-900 font-medium">Session duration</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: '30', label: '30 min', desc: 'Quick' },
                      { value: '45', label: '45 min', desc: 'Standard' },
                      { value: '60', label: '60 min', desc: 'Full' },
                    ].map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setDuration(d.value)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          duration === d.value
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <Clock className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                        <p className="text-sm font-medium text-gray-900">{d.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Toggle */}
                <div className="space-y-2">
                  <Label className="text-gray-900 font-medium">What to generate</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setProgramMode(false)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        !programMode
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <Dumbbell className="w-4 h-4 mx-auto text-violet-400 mb-1" />
                      <p className="text-sm font-medium text-gray-900">Single Workout</p>
                    </button>
                    <button
                      onClick={() => setProgramMode(true)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        programMode
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <Calendar className="w-4 h-4 mx-auto text-violet-400 mb-1" />
                      <p className="text-sm font-medium text-gray-900">Weekly Program</p>
                    </button>
                  </div>
                </div>

                {/* Day Selection — only for program mode */}
                {programMode && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-gray-900 font-medium">Training days per week</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {[2, 3, 4, 5, 6].map(d => (
                          <button
                            key={d}
                            onClick={() => {
                              setTrainingDays(d);
                              // Auto-select days
                              const defaults: Record<number, string[]> = {
                                2: ['monday', 'thursday'],
                                3: ['monday', 'wednesday', 'friday'],
                                4: ['monday', 'tuesday', 'thursday', 'friday'],
                                5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                                6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
                              };
                              setSelectedDays(defaults[d] || defaults[3]);
                            }}
                            className={`p-2 rounded-lg border text-center transition-all ${
                              trainingDays === d
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-sm font-bold text-gray-900">{d}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-900 font-medium text-xs">Which days?</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map(day => (
                          <button
                            key={day}
                            onClick={() => {
                              if (selectedDays.includes(day)) {
                                if (selectedDays.length > 1) setSelectedDays(selectedDays.filter(d => d !== day));
                              } else if (selectedDays.length < trainingDays) {
                                setSelectedDays([...selectedDays, day].sort((a, b) => WEEKDAYS.indexOf(a as any) - WEEKDAYS.indexOf(b as any)));
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                              selectedDays.includes(day)
                                ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                                : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            {day.slice(0, 3).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleFormSubmit}
                  disabled={!goal || !expertise || !equipment}
                  className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold py-6 rounded-xl shadow-lg shadow-violet-500/20"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {programMode ? `Generate ${trainingDays}-Day Program` : 'Generate My Workout'}
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Injury Check */}
          {genStep === 'injury_check' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  Safety Check
                </DialogTitle>
                <DialogDescription className="text-gray-500">
                  Your safety is our top priority
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <Card className="bg-amber-500/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-amber-200 leading-relaxed">
                      Do you currently have any <strong>injuries, chronic pain, or physical limitations</strong> that might affect your ability to exercise safely?
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-auto py-5 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50 flex flex-col items-center gap-2"
                    onClick={() => handleInjuryResponse(false)}
                  >
                    <Zap className="w-5 h-5 text-green-400" />
                    <span className="font-semibold text-gray-900">No injuries</span>
                    <span className="text-[10px] text-gray-500">I&apos;m good to go</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-5 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 flex flex-col items-center gap-2"
                    onClick={() => handleInjuryResponse(true)}
                  >
                    <Heart className="w-5 h-5 text-amber-400" />
                    <span className="font-semibold text-gray-900">Yes, I do</span>
                    <span className="text-[10px] text-gray-500">I have limitations</span>
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step 2b: Injury Block — Redirect to Trainer */}
          {genStep === 'injury_block' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  Your Safety Comes First
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <Card className="bg-rose-500/5 border-rose-500/20">
                  <CardContent className="p-5 text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/20 flex items-center justify-center">
                      <ShieldAlert className="w-8 h-8 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">We recommend a personal trainer</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Working out with injuries requires professional guidance to avoid making things worse. 
                      A qualified trainer can design a safe, effective program tailored to your specific needs.
                    </p>
                    <p className="text-xs text-gray-500">
                      AI-generated workouts cannot account for individual injuries and may include exercises that aggravate your condition.
                    </p>
                  </CardContent>
                </Card>

                <Button
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-semibold py-5 rounded-xl"
                  onClick={() => { setShowGenerator(false); resetGenerator(); }}
                >
                  <Target className="w-4 h-4 mr-2" />
                  Find a Trainer
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-gray-500 hover:text-gray-400"
                  onClick={() => { setGenStep('form'); setHasInjury(null); }}
                >
                  Go back
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Generating */}
          {genStep === 'generating' && (
            <div className="py-12 text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <span className="text-4xl animate-bounce">🤖</span>
                </div>
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full border-2 border-violet-500/30 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">🤖 Building your workout...</h3>
                <p className="text-sm text-gray-500 mt-2">
                  AI is building a personalized {programMode ? `${trainingDays}-day program` : `${goal.replace('_', ' ')} workout`} for {expertise} level
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Brain className="w-3 h-3" />
                <span>Powered by Llama 3.3 on Groq</span>
              </div>
            </div>
          )}

          {/* Step 4: Result — Program */}
          {genStep === 'result' && programMode && generatedProgram && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  Your AI Program
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {generatedProgram.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-violet-500/20 text-violet-300 border-0">
                    {generatedProgram.daysPerWeek} days/week
                  </Badge>
                  <Badge className="bg-sky-500/20 text-sky-300 border-0">
                    {generatedProgram.blockLengthWeeks} week block
                  </Badge>
                  <Badge className="bg-amber-500/20 text-amber-300 border-0">
                    Deload wk {generatedProgram.deloadWeek}
                  </Badge>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {generatedProgram.days.map((day, di) => (
                    <Card key={di} className="bg-gray-50 border-gray-200">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-900">{day.dayLabel}</span>
                          <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500 capitalize">
                            {day.scheduledDay}
                          </Badge>
                        </div>
                        {day.blocks.map((block, bi) => (
                          <div key={bi} className="mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-[10px] border-0 ${
                                block.type === 'warmup' ? 'bg-amber-500/20 text-amber-400' :
                                block.type === 'cardio' ? 'bg-green-500/20 text-green-400' :
                                'bg-sky-500/20 text-sky-400'
                              }`}>
                                {block.type}
                              </Badge>
                              <span className="text-xs text-gray-400">{block.name}</span>
                            </div>
                            <div className="space-y-1">
                              {block.exercises.map((ex, ei) => (
                                <div key={ei} className="flex items-center justify-between py-1 px-2 rounded bg-gray-100">
                                  <span className="text-xs text-gray-900">{ex.name}</span>
                                  <span className="text-[10px] text-gray-500">{ex.sets}×{ex.reps} • {ex.restSeconds}s</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}

                  {/* Progression & Deload Notes */}
                  {generatedProgram.progressionNotes && (
                    <Card className="bg-emerald-500/5 border-emerald-500/20">
                      <CardContent className="p-3">
                        <p className="text-xs font-semibold text-emerald-400 mb-1">Progression</p>
                        <p className="text-xs text-gray-300">{generatedProgram.progressionNotes}</p>
                      </CardContent>
                    </Card>
                  )}
                  {generatedProgram.deloadInstructions && (
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="p-3">
                        <p className="text-xs font-semibold text-amber-400 mb-1">Deload Week</p>
                        <p className="text-xs text-gray-300">{generatedProgram.deloadInstructions}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={savedToCalendar ? () => { setShowGenerator(false); resetGenerator(); router.push('/calendar'); } : handleSaveToCalendar}
                    className={`w-full font-semibold py-5 rounded-xl shadow-lg ${
                      savedToCalendar
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20'
                        : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-violet-500/20'
                    }`}
                  >
                    {savedToCalendar ? (
                      <><Check className="w-4 h-4 mr-2" /> Saved! View Calendar</>
                    ) : (
                      <><CalendarPlus className="w-4 h-4 mr-2" /> Save to Calendar ({generatedProgram.blockLengthWeeks} weeks)</>
                    )}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="border-gray-200 text-gray-500 hover:bg-gray-50"
                      onClick={() => { resetGenerator(); setProgramMode(true); }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                    <Button
                      variant="outline"
                      className="border-gray-200 text-gray-500 hover:bg-gray-50"
                      onClick={() => { setShowGenerator(false); resetGenerator(); }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Result — Single Workout */}
          {genStep === 'result' && !programMode && generatedWorkout && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  Your AI Workout
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {generatedWorkout.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Summary */}
                <div className="flex items-center gap-3">
                  <Badge className="bg-violet-500/20 text-violet-300 border-0">
                    <Clock className="w-3 h-3 mr-1" />
                    ~{generatedWorkout.estimatedMinutes}min
                  </Badge>
                  <Badge className="bg-sky-500/20 text-sky-300 border-0">
                    <Dumbbell className="w-3 h-3 mr-1" />
                    {totalExercises} exercises
                  </Badge>
                  <Badge className="bg-green-500/20 text-green-300 border-0">
                    {generatedWorkout.blocks.length} blocks
                  </Badge>
                </div>

                {/* Blocks */}
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {generatedWorkout.blocks.map((block, bi) => (
                    <Card key={bi} className="bg-gray-50 border-gray-200">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`text-[10px] border-0 ${
                            block.type === 'warmup' ? 'bg-amber-500/20 text-amber-400' :
                            block.type === 'circuit' ? 'bg-purple-500/20 text-purple-400' :
                            block.type === 'cardio' ? 'bg-green-500/20 text-green-400' :
                            'bg-sky-500/20 text-sky-400'
                          }`}>
                            {block.type}
                          </Badge>
                          <span className="text-sm font-semibold text-gray-900">{block.name}</span>
                        </div>
                        <div className="space-y-1.5">
                          {block.exercises.map((ex, ei) => (
                            <div key={ei} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-4">{ei + 1}</span>
                                <div>
                                  <p className="text-sm text-gray-900">{ex.name}</p>
                                  {ex.notes && <p className="text-[10px] text-gray-500">{ex.notes}</p>}
                                </div>
                              </div>
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                {ex.sets}×{ex.reps} • {ex.restSeconds}s
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleStartGenerated}
                    className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold py-5 rounded-xl shadow-lg shadow-violet-500/20"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start This Workout
                  </Button>
                  <Button
                    variant="outline"
                    className={`w-full ${savedToCalendar ? 'border-green-500/50 text-green-400' : 'border-violet-500/50 text-violet-300 hover:bg-violet-500/10'}`}
                    onClick={() => {
                      if (savedToCalendar) {
                        setShowGenerator(false); resetGenerator(); router.push('/calendar');
                      } else if (generatedWorkout && user) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        addCalendarEvent({
                          title: generatedWorkout.name,
                          type: 'workout',
                          date: todayStr,
                          startTime: '07:00',
                          endTime: `${Math.floor(7 + generatedWorkout.estimatedMinutes / 60).toString().padStart(2, '0')}:${(generatedWorkout.estimatedMinutes % 60).toString().padStart(2, '0')}`,
                          clientId: user.id,
                          trainerId: user.id,
                          status: 'scheduled',
                          notes: `${totalExercises} exercises • ${generatedWorkout.blocks.length} blocks • AI Generated`,
                        });
                        setSavedToCalendar(true);
                      }
                    }}
                  >
                    {savedToCalendar ? (
                      <><Check className="w-4 h-4 mr-1" /> Saved! View Calendar</>
                    ) : (
                      <><CalendarPlus className="w-4 h-4 mr-1" /> Save to Calendar</>
                    )}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="border-gray-200 text-gray-500 hover:bg-gray-50"
                      onClick={() => { resetGenerator(); }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                    <Button
                      variant="outline"
                      className="border-gray-200 text-gray-500 hover:bg-gray-50"
                      onClick={() => { setShowGenerator(false); resetGenerator(); }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Suggested Program Detail Dialog */}
      <Dialog open={!!selectedProgram} onOpenChange={(open) => { if (!open) setSelectedProgram(null); }}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md max-h-[85vh] overflow-y-auto">
          {selectedProgram && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-emerald-400" />
                  {selectedProgram.name}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {selectedProgram.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                {/* Meta badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={`text-[10px] border-0 ${
                    selectedProgram.difficulty === 'beginner' ? 'text-green-400 bg-green-500/20'
                    : selectedProgram.difficulty === 'intermediate' ? 'text-amber-400 bg-amber-500/20'
                    : 'text-red-400 bg-red-500/20'
                  }`}>
                    {selectedProgram.difficulty}
                  </Badge>
                  <Badge className="text-[10px] bg-sky-500/20 text-sky-300 border-0">
                    {selectedProgram.frequencyOptions.join('-')}× per week
                  </Badge>
                  <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-0">
                    {selectedProgram.weeks} weeks
                  </Badge>
                  <Badge className="text-[10px] bg-gray-200 text-gray-600 border-0 capitalize">
                    {selectedProgram.structure.replace(/_/g, ' ')}
                  </Badge>
                  {selectedProgram.classSafe && (
                    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-0">
                      Class Safe
                    </Badge>
                  )}
                </div>

                {/* Days Preview */}
                <ScrollArea className="max-h-[40vh]">
                  <div className="space-y-3">
                    {selectedProgram.days.map((day, di) => (
                      <Card key={di} className="bg-gray-50 border-gray-200">
                        <CardContent className="p-3">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                            {day.dayLabel}
                          </h4>
                          {day.blocks.map((block, bi) => (
                            <div key={bi} className="mb-2 last:mb-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Badge variant="outline" className={`text-[9px] border-0 px-1.5 py-0 ${
                                  block.type === 'warmup' ? 'bg-amber-500/20 text-amber-400' :
                                  block.type === 'cooldown' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-sky-500/20 text-sky-400'
                                }`}>
                                  {block.type}
                                </Badge>
                                <span className="text-[11px] text-gray-400 font-medium">{block.name}</span>
                              </div>
                              <div className="space-y-0.5 pl-2">
                                {block.exercises.map((ex, ei) => (
                                  <div key={ei} className="flex items-center justify-between py-1 px-2 rounded bg-gray-100">
                                    <span className="text-xs text-gray-900">{ex.defaultExercise}</span>
                                    <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                                      {ex.sets}×{ex.reps} • {ex.rest}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                {/* Schedule Step or Activate Button */}
                {!showScheduleStep ? (
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => {
                        if (programSaved) {
                          setSelectedProgram(null);
                          router.push('/calendar');
                          return;
                        }
                        // Auto-set fixed days based on program day count
                        const numDays = selectedProgram.days.length;
                        const defaults: Record<number, string[]> = {
                          1: ['monday'],
                          2: ['monday', 'thursday'],
                          3: ['monday', 'wednesday', 'friday'],
                          4: ['monday', 'tuesday', 'thursday', 'friday'],
                          5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                          6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
                        };
                        setScheduleFixedDays(defaults[numDays] || defaults[3]);
                        setScheduleMode('fixed');
                        setShowScheduleStep(true);
                      }}
                      className={`w-full font-semibold py-5 rounded-xl shadow-lg ${
                        programSaved
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/20'
                      }`}
                    >
                      {programSaved ? (
                        <><Check className="w-4 h-4 mr-2" /> Saved! View Calendar</>
                      ) : (
                        <><CalendarPlus className="w-4 h-4 mr-2" /> Activate — Set Schedule</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-gray-200 text-gray-500 hover:bg-gray-50"
                      onClick={() => setSelectedProgram(null)}
                    >
                      Close
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Schedule — {selectedProgram.days.length} workouts / week for {selectedProgram.weeks} weeks
                    </h3>

                    {/* Schedule Mode */}
                    <div className="space-y-2">
                      <Label className="text-gray-600 text-xs font-medium">How to schedule</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'fixed' as const, label: 'Fixed Days', desc: 'Same days each week' },
                          { value: 'cycle' as const, label: 'Cycle', desc: 'Rotate through workouts' },
                          { value: 'interval' as const, label: 'Interval', desc: 'Every Nth day' },
                        ].map(m => (
                          <button
                            key={m.value}
                            onClick={() => setScheduleMode(m.value)}
                            className={`p-2 rounded-lg border text-center transition-all ${
                              scheduleMode === m.value
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-xs font-medium text-gray-900">{m.label}</p>
                            <p className="text-[10px] text-gray-500">{m.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fixed Days picker */}
                    {scheduleMode === 'fixed' && (
                      <div className="space-y-2">
                        <Label className="text-gray-600 text-xs font-medium">Select {selectedProgram.days.length} days</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEKDAYS.map(day => (
                            <button
                              key={day}
                              onClick={() => {
                                if (scheduleFixedDays.includes(day)) {
                                  if (scheduleFixedDays.length > 1) setScheduleFixedDays(scheduleFixedDays.filter(d => d !== day));
                                } else if (scheduleFixedDays.length < selectedProgram.days.length) {
                                  setScheduleFixedDays([...scheduleFixedDays, day].sort((a, b) => WEEKDAYS.indexOf(a as any) - WEEKDAYS.indexOf(b as any)));
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                scheduleFixedDays.includes(day)
                                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                  : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                              }`}
                            >
                              {day.slice(0, 3).toUpperCase()}
                            </button>
                          ))}
                        </div>
                        {scheduleFixedDays.length !== selectedProgram.days.length && (
                          <p className="text-[10px] text-amber-400">
                            Select exactly {selectedProgram.days.length} days to match program
                          </p>
                        )}
                      </div>
                    )}

                    {/* Cycle mode info */}
                    {scheduleMode === 'cycle' && (
                      <div className="space-y-2">
                        <Label className="text-gray-600 text-xs font-medium">Training days (cycle through workouts)</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEKDAYS.map(day => (
                            <button
                              key={day}
                              onClick={() => {
                                if (scheduleFixedDays.includes(day)) {
                                  if (scheduleFixedDays.length > 1) setScheduleFixedDays(scheduleFixedDays.filter(d => d !== day));
                                } else {
                                  setScheduleFixedDays([...scheduleFixedDays, day].sort((a, b) => WEEKDAYS.indexOf(a as any) - WEEKDAYS.indexOf(b as any)));
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                scheduleFixedDays.includes(day)
                                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                  : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                              }`}
                            >
                              {day.slice(0, 3).toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          Workouts cycle: {selectedProgram.days.map(d => d.dayLabel).join(' → ')} → repeat
                        </p>
                      </div>
                    )}

                    {/* Interval mode */}
                    {scheduleMode === 'interval' && (
                      <div className="space-y-2">
                        <Label className="text-gray-600 text-xs font-medium">Train every...</Label>
                        <div className="flex gap-2">
                          {[2, 3, 4].map(n => (
                            <button
                              key={n}
                              onClick={() => setScheduleInterval(n)}
                              className={`flex-1 p-2.5 rounded-lg border text-center transition-all ${
                                scheduleInterval === n
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <p className="text-sm font-bold text-gray-900">{n}</p>
                              <p className="text-[10px] text-gray-500">days</p>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          Workouts cycle through: {selectedProgram.days.map(d => d.dayLabel).join(' → ')}
                        </p>
                      </div>
                    )}

                    {/* Save to Calendar */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-gray-200 text-gray-500"
                        onClick={() => setShowScheduleStep(false)}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold"
                        disabled={scheduleMode === 'fixed' && scheduleFixedDays.length !== selectedProgram.days.length}
                        onClick={() => {
                          if (!user) return;

                          const dayMap: Record<string, number> = {
                            sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
                            thursday: 4, friday: 5, saturday: 6,
                          };

                          const today = new Date();
                          const todayDow = today.getDay();

                          if (scheduleMode === 'fixed') {
                            // Fixed days: each program day maps to a specific weekday
                            const sortedDays = [...scheduleFixedDays].sort((a, b) => WEEKDAYS.indexOf(a as any) - WEEKDAYS.indexOf(b as any));
                            for (let week = 0; week < selectedProgram.weeks; week++) {
                              selectedProgram.days.forEach((day, di) => {
                                const targetDow = dayMap[sortedDays[di]] ?? 1;
                                let daysUntil = targetDow - todayDow;
                                if (daysUntil <= 0) daysUntil += 7;

                                const eventDate = new Date(today);
                                eventDate.setDate(eventDate.getDate() + daysUntil + (week * 7));
                                const dateStr = eventDate.toISOString().split('T')[0];
                                const totalEx = day.blocks.reduce((s, b) => s + b.exercises.length, 0);

                                addCalendarEvent({
                                  title: day.dayLabel,
                                  type: 'workout',
                                  date: dateStr,
                                  startTime: '07:00',
                                  endTime: '08:00',
                                  clientId: user.id,
                                  trainerId: user.id,
                                  status: 'scheduled',
                                  notes: `${totalEx} exercises • ${selectedProgram.name} (Week ${week + 1}/${selectedProgram.weeks})`,
                                });
                              });
                            }
                          } else if (scheduleMode === 'cycle') {
                            // Cycle: selected training days, rotate through program workouts
                            const sortedTrainDays = [...scheduleFixedDays].sort((a, b) => WEEKDAYS.indexOf(a as any) - WEEKDAYS.indexOf(b as any));
                            let workoutIndex = 0;
                            for (let week = 0; week < selectedProgram.weeks; week++) {
                              sortedTrainDays.forEach(trainDay => {
                                const day = selectedProgram.days[workoutIndex % selectedProgram.days.length];
                                const targetDow = dayMap[trainDay] ?? 1;
                                let daysUntil = targetDow - todayDow;
                                if (daysUntil <= 0) daysUntil += 7;

                                const eventDate = new Date(today);
                                eventDate.setDate(eventDate.getDate() + daysUntil + (week * 7));
                                const dateStr = eventDate.toISOString().split('T')[0];
                                const totalEx = day.blocks.reduce((s, b) => s + b.exercises.length, 0);

                                addCalendarEvent({
                                  title: day.dayLabel,
                                  type: 'workout',
                                  date: dateStr,
                                  startTime: '07:00',
                                  endTime: '08:00',
                                  clientId: user.id,
                                  trainerId: user.id,
                                  status: 'scheduled',
                                  notes: `${totalEx} exercises • ${selectedProgram.name} (Cycle)`,
                                });
                                workoutIndex++;
                              });
                            }
                          } else if (scheduleMode === 'interval') {
                            // Interval: every Nth day, cycling through workouts
                            let workoutIndex = 0;
                            const totalWorkouts = selectedProgram.weeks * selectedProgram.days.length;
                            for (let i = 0; i < totalWorkouts; i++) {
                              const day = selectedProgram.days[workoutIndex % selectedProgram.days.length];
                              const eventDate = new Date(today);
                              eventDate.setDate(eventDate.getDate() + 1 + (i * scheduleInterval));
                              const dateStr = eventDate.toISOString().split('T')[0];
                              const totalEx = day.blocks.reduce((s, b) => s + b.exercises.length, 0);
                              const weekNum = Math.floor(i / selectedProgram.days.length) + 1;

                              addCalendarEvent({
                                title: day.dayLabel,
                                type: 'workout',
                                date: dateStr,
                                startTime: '07:00',
                                endTime: '08:00',
                                clientId: user.id,
                                trainerId: user.id,
                                status: 'scheduled',
                                notes: `${totalEx} exercises • ${selectedProgram.name} (Week ${weekNum})`,
                              });
                              workoutIndex++;
                            }
                          }

                          // Save to My Programs
                          const newSaved: SavedProgram = {
                            id: `tmpl-${selectedProgram.id}-${Date.now()}`,
                            name: selectedProgram.name,
                            description: selectedProgram.description,
                            source: 'template',
                            templateId: selectedProgram.id,
                            daysPerWeek: selectedProgram.days.length,
                            weeks: selectedProgram.weeks,
                            createdAt: new Date().toISOString(),
                            goal: selectedProgram.goals[0],
                          };
                          const updatedPrograms = [newSaved, ...savedPrograms];
                          setSavedPrograms(updatedPrograms);
                          saveProgramsList(user.id, updatedPrograms);

                          setProgramSaved(true);
                          setShowScheduleStep(false);
                        }}
                      >
                        <CalendarPlus className="w-4 h-4 mr-1" />
                        Save to Calendar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
