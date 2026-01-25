'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ArrowLeftRight,
  Zap,
  Heart,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSwapSuggestions, getDirectSwaps } from '@/lib/exerciseRelations';

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
  setStyle: 'fixed' | 'pyramid' | 'reverse-pyramid' | '5x5' | 'drop-set' | 'amrap';
  setDetails?: string[]; // For pyramid/custom rep schemes per set
}

// Training phases with suggested rep/set configurations
const TRAINING_PHASES = [
  { id: 'none', name: 'No Phase', sets: 3, reps: '8-12', rest: '60s', description: 'Custom configuration' },
  { id: 'strength', name: 'Strength', sets: 5, reps: '3-5', rest: '180s', description: 'Heavy weight, low reps, long rest' },
  { id: 'hypertrophy', name: 'Hypertrophy', sets: 4, reps: '8-12', rest: '90s', description: 'Moderate weight, muscle growth focus' },
  { id: 'power', name: 'Power', sets: 5, reps: '1-3', rest: '180s', description: 'Explosive movements, very heavy' },
  { id: 'endurance', name: 'Endurance', sets: 3, reps: '15-20', rest: '45s', description: 'Light weight, high reps, short rest' },
  { id: 'deload', name: 'Deload', sets: 2, reps: '10-12', rest: '60s', description: 'Recovery week, reduced volume' },
];

// Set style options
const SET_STYLES = [
  { id: 'fixed', name: 'Fixed', description: 'Same reps each set', icon: '⬜' },
  { id: 'pyramid', name: 'Pyramid', description: '12→10→8→6', icon: '🔺' },
  { id: 'reverse-pyramid', name: 'Rev Pyramid', description: '6→8→10→12', icon: '🔻' },
  { id: '5x5', name: '5×5', description: '5 sets of 5', icon: '5️⃣' },
  { id: 'drop-set', name: 'Drop Set', description: 'No rest between', icon: '⬇️' },
  { id: 'amrap', name: 'AMRAP', description: 'Max reps', icon: '♾️' },
];

// Assignment frequency options
const ASSIGNMENT_OPTIONS = [
  { id: 'once', name: 'One-time', description: 'Assign to a single session' },
  { id: 'weekly', name: 'Weekly', description: 'Repeat every week for selected duration' },
  { id: 'program', name: 'Add to Program', description: 'Add as part of client\'s training program' },
];

interface WorkoutBlock {
  id: string;
  type: BlockType;
  name: string;
  exercises: WorkoutExercise[];
}

const COMMON_EXERCISES = [
  // Squat patterns
  { id: 'barbell-back-squat', name: 'Barbell Back Squat', pattern: 'squat', aliases: ['back squat', 'bb squat'] },
  { id: 'goblet-squat', name: 'Goblet Squat', pattern: 'squat', aliases: ['kb squat', 'kettlebell squat'] },
  { id: 'front-squat', name: 'Front Squat', pattern: 'squat', aliases: [] },
  { id: 'leg-press', name: 'Leg Press', pattern: 'squat', aliases: ['seated leg press', 'machine leg press'] },
  { id: 'smith-squat', name: 'Smith Machine Squat', pattern: 'squat', aliases: ['smith squat'] },
  { id: 'hack-squat', name: 'Hack Squat', pattern: 'squat', aliases: ['hack squat machine'] },
  // Hinge patterns
  { id: 'deadlift', name: 'Deadlift', pattern: 'hinge', aliases: ['conventional deadlift', 'dl'] },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', pattern: 'hinge', aliases: ['rdl', 'stiff leg deadlift'] },
  { id: 'hip-thrust', name: 'Hip Thrust', pattern: 'hinge', aliases: ['barbell hip thrust', 'glute thrust'] },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', pattern: 'hinge', aliases: ['kb swing', 'russian swing'] },
  { id: 'smith-rdl', name: 'Smith Machine RDL', pattern: 'hinge', aliases: ['smith romanian deadlift'] },
  { id: 'good-morning', name: 'Good Morning', pattern: 'hinge', aliases: ['barbell good morning'] },
  // Push patterns
  { id: 'bench-press', name: 'Bench Press', pattern: 'push', aliases: ['flat bench', 'barbell bench', 'bb bench'] },
  { id: 'db-bench-press', name: 'DB Bench Press', pattern: 'push', aliases: ['dumbbell bench press', 'dumbbell bench'] },
  { id: 'incline-bench-press', name: 'Incline Bench Press', pattern: 'push', aliases: ['incline press', 'incline barbell'] },
  { id: 'smith-bench-press', name: 'Smith Machine Bench Press', pattern: 'push', aliases: ['smith bench', 'smith flat bench'] },
  { id: 'smith-incline-press', name: 'Smith Machine Incline Press', pattern: 'push', aliases: ['smith incline', 'smith incline bench'] },
  { id: 'overhead-press', name: 'Overhead Press', pattern: 'push', aliases: ['ohp', 'military press', 'shoulder press', 'standing press'] },
  { id: 'db-shoulder-press', name: 'DB Shoulder Press', pattern: 'push', aliases: ['dumbbell shoulder press', 'seated shoulder press', 'dumbbell ohp'] },
  { id: 'smith-shoulder-press', name: 'Smith Machine Shoulder Press', pattern: 'push', aliases: ['smith ohp', 'smith military press', 'smith press'] },
  { id: 'push-up', name: 'Push-up', pattern: 'push', aliases: ['pushup', 'press up'] },
  { id: 'dips', name: 'Dips', pattern: 'push', aliases: ['tricep dips', 'chest dips', 'parallel bar dips'] },
  { id: 'cable-fly', name: 'Cable Fly', pattern: 'push', aliases: ['cable crossover', 'cable chest fly', 'cable flyes'] },
  { id: 'pec-deck', name: 'Pec Deck', pattern: 'push', aliases: ['chest fly', 'machine fly', 'pec fly', 'butterfly', 'chest fly machine'] },
  // Pull patterns
  { id: 'barbell-row', name: 'Barbell Row', pattern: 'pull', aliases: ['bent over row', 'bb row', 'pendlay row'] },
  { id: 'cable-row', name: 'Cable Row', pattern: 'pull', aliases: ['low row', 'seated row'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', pattern: 'pull', aliases: ['pulldown', 'wide grip pulldown', 'cable pulldown'] },
  { id: 'weighted-pull-up', name: 'Weighted Pull-up', pattern: 'pull', aliases: ['pull up', 'pullup', 'chin up'] },
  { id: 'face-pull', name: 'Face Pull', pattern: 'pull', aliases: ['cable face pull', 'rear delt pull'] },
  { id: 'smith-row', name: 'Smith Machine Row', pattern: 'pull', aliases: ['smith bent over row'] },
  { id: 't-bar-row', name: 'T-Bar Row', pattern: 'pull', aliases: ['t bar row', 'landmine row'] },
  { id: 'db-row', name: 'Dumbbell Row', pattern: 'pull', aliases: ['single arm row', 'one arm row', 'db row'] },
  { id: 'seated-row', name: 'Seated Cable Row', pattern: 'pull', aliases: ['seated row', 'cable seated row', 'machine row'] },
  { id: 'shrug', name: 'Barbell Shrug', pattern: 'pull', aliases: ['bb shrug', 'trap shrug'] },
  { id: 'smith-shrug', name: 'Smith Machine Shrug', pattern: 'pull', aliases: ['smith trap shrug'] },
  // Core patterns
  { id: 'plank', name: 'Plank', pattern: 'core', aliases: ['front plank', 'forearm plank'] },
  { id: 'dead-bug', name: 'Dead Bug', pattern: 'core', aliases: [] },
  { id: 'pallof-press', name: 'Pallof Press', pattern: 'core', aliases: ['anti rotation press', 'cable pallof'] },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', pattern: 'core', aliases: ['leg raise', 'hanging knee raise'] },
  { id: 'cable-crunch', name: 'Cable Crunch', pattern: 'core', aliases: ['kneeling cable crunch', 'rope crunch'] },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', pattern: 'core', aliases: ['ab roller', 'wheel rollout'] },
  // Lunge patterns
  { id: 'split-squat', name: 'Split Squat', pattern: 'lunge', aliases: ['static lunge'] },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', pattern: 'lunge', aliases: ['bss', 'rear foot elevated split squat'] },
  { id: 'walking-lunge', name: 'Walking Lunge', pattern: 'lunge', aliases: ['forward lunge', 'lunges'] },
  { id: 'smith-lunge', name: 'Smith Machine Lunge', pattern: 'lunge', aliases: ['smith split squat'] },
  { id: 'reverse-lunge', name: 'Reverse Lunge', pattern: 'lunge', aliases: ['backward lunge', 'step back lunge'] },
  // Accessory
  { id: 'glute-bridge', name: 'Glute Bridge', pattern: 'hinge', aliases: ['bridge', 'hip bridge'] },
  { id: 'band-pull-apart', name: 'Band Pull Apart', pattern: 'pull', aliases: ['banded pull apart'] },
  { id: 'hip-circles', name: 'Hip Circles', pattern: 'squat', aliases: ['leg circles'] },
  { id: 'cat-cow', name: 'Cat-Cow', pattern: 'hinge', aliases: ['cat camel', 'cat cow stretch'] },
  { id: 'bird-dog', name: 'Bird Dog', pattern: 'core', aliases: ['quadruped'] },
  { id: 'leg-curl', name: 'Leg Curl', pattern: 'hinge', aliases: ['hamstring curl', 'lying leg curl', 'seated leg curl'] },
  { id: 'leg-extension', name: 'Leg Extension', pattern: 'squat', aliases: ['quad extension', 'knee extension'] },
  { id: 'calf-raise', name: 'Calf Raise', pattern: 'squat', aliases: ['standing calf raise', 'calf press'] },
  { id: 'smith-calf-raise', name: 'Smith Machine Calf Raise', pattern: 'squat', aliases: ['smith calf'] },
  // Arms
  { id: 'bicep-curl', name: 'Bicep Curl', pattern: 'pull', aliases: ['barbell curl', 'dumbbell curl', 'arm curl', 'curl'] },
  { id: 'hammer-curl', name: 'Hammer Curl', pattern: 'pull', aliases: ['neutral grip curl'] },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', pattern: 'push', aliases: ['cable pushdown', 'rope pushdown', 'tricep extension'] },
  { id: 'skull-crusher', name: 'Skull Crusher', pattern: 'push', aliases: ['lying tricep extension', 'french press', 'nose breaker'] },
  { id: 'lateral-raise', name: 'Lateral Raise', pattern: 'push', aliases: ['side raise', 'dumbbell lateral raise', 'side lateral'] },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', pattern: 'pull', aliases: ['reverse fly', 'rear delt raise', 'bent over fly'] },
  // Warmup & Mobility
  { id: 'foam-roll-quads', name: 'Foam Roll Quads', pattern: 'warmup', aliases: ['massage quads', 'roll quads'] },
  { id: 'foam-roll-hamstrings', name: 'Foam Roll Hamstrings', pattern: 'warmup', aliases: ['massage hamstrings', 'roll hamstrings'] },
  { id: 'foam-roll-glutes', name: 'Foam Roll Glutes', pattern: 'warmup', aliases: ['massage glutes', 'roll glutes'] },
  { id: 'foam-roll-adductors', name: 'Foam Roll Adductors', pattern: 'warmup', aliases: ['massage adductors', 'roll groin', 'foam roll groin'] },
  { id: 'foam-roll-it-band', name: 'Foam Roll IT Band', pattern: 'warmup', aliases: ['roll it band', 'massage it band'] },
  { id: 'foam-roll-lats', name: 'Foam Roll Lats', pattern: 'warmup', aliases: ['massage lats', 'roll lats'] },
  { id: 'lacrosse-ball-glutes', name: 'Lacrosse Ball Glutes', pattern: 'warmup', aliases: ['massage ball glutes', 'trigger point glutes'] },
  { id: 'lacrosse-ball-hip-flexor', name: 'Lacrosse Ball Hip Flexor', pattern: 'warmup', aliases: ['massage hip flexor', 'psoas release'] },
  { id: 'hip-flexor-stretch', name: 'Hip Flexor Stretch', pattern: 'warmup', aliases: ['kneeling hip flexor', 'lunge stretch'] },
  { id: 'pigeon-stretch', name: 'Pigeon Stretch', pattern: 'warmup', aliases: ['pigeon pose', 'hip opener'] },
  { id: 'adductor-stretch', name: 'Adductor Stretch', pattern: 'warmup', aliases: ['groin stretch', 'butterfly stretch', 'frog stretch'] },
  { id: 'figure-four-stretch', name: 'Figure Four Stretch', pattern: 'warmup', aliases: ['glute stretch', 'piriformis stretch'] },
  { id: 'world-greatest-stretch', name: 'World\'s Greatest Stretch', pattern: 'warmup', aliases: ['wgs', 'lunge with rotation'] },
  { id: '90-90-stretch', name: '90/90 Hip Stretch', pattern: 'warmup', aliases: ['90 90 stretch', 'hip mobility'] },
  { id: 'couch-stretch', name: 'Couch Stretch', pattern: 'warmup', aliases: ['quad hip flexor stretch'] },
  { id: 'banded-hip-distraction', name: 'Banded Hip Distraction', pattern: 'warmup', aliases: ['hip mobilization', 'band hip stretch'] },
  { id: 'glute-activation', name: 'Glute Activation', pattern: 'warmup', aliases: ['glute bridge hold', 'activate glutes'] },
  { id: 'clamshell', name: 'Clamshell', pattern: 'warmup', aliases: ['banded clamshell', 'hip abduction'] },
  { id: 'fire-hydrant', name: 'Fire Hydrant', pattern: 'warmup', aliases: ['hip abduction', 'glute med activation'] },
  { id: 'banded-monster-walk', name: 'Banded Monster Walk', pattern: 'warmup', aliases: ['lateral band walk', 'side walk'] },
  { id: 'banded-glute-bridge', name: 'Banded Glute Bridge', pattern: 'warmup', aliases: ['activate glutes', 'bridge with band'] },
  { id: 'adductor-activation', name: 'Adductor Squeeze', pattern: 'warmup', aliases: ['groin activation', 'ball squeeze'] },
  { id: 'copenhagen-plank', name: 'Copenhagen Plank', pattern: 'warmup', aliases: ['adductor plank', 'groin strengthening'] },
  // Cardio & Circuit
  { id: 'treadmill-walk', name: 'Treadmill Walk', pattern: 'cardio', aliases: ['walking', 'incline walk'] },
  { id: 'treadmill-run', name: 'Treadmill Run', pattern: 'cardio', aliases: ['running', 'jogging'] },
  { id: 'stairmaster', name: 'Stairmaster', pattern: 'cardio', aliases: ['stair climber', 'step mill'] },
  { id: 'rowing-machine', name: 'Rowing Machine', pattern: 'cardio', aliases: ['rower', 'erg', 'row machine'] },
  { id: 'assault-bike', name: 'Assault Bike', pattern: 'cardio', aliases: ['air bike', 'fan bike', 'airdyne'] },
  { id: 'ski-erg', name: 'Ski Erg', pattern: 'cardio', aliases: ['ski machine', 'skier'] },
  { id: 'bike-erg', name: 'Bike Erg', pattern: 'cardio', aliases: ['stationary bike', 'cycle'] },
  { id: 'elliptical', name: 'Elliptical', pattern: 'cardio', aliases: ['cross trainer'] },
  { id: 'jump-rope', name: 'Jump Rope', pattern: 'cardio', aliases: ['skipping', 'skip rope'] },
  { id: 'box-jump', name: 'Box Jump', pattern: 'cardio', aliases: ['plyo box', 'plyometric jump'] },
  { id: 'kb-swing', name: 'Kettlebell Swing', pattern: 'cardio', aliases: ['kb swing', 'russian swing', 'american swing'] },
  { id: 'kb-goblet-squat', name: 'KB Goblet Squat', pattern: 'cardio', aliases: ['kettlebell squat', 'goblet squat'] },
  { id: 'kb-clean', name: 'Kettlebell Clean', pattern: 'cardio', aliases: ['kb clean', 'kettlebell clean'] },
  { id: 'kb-snatch', name: 'Kettlebell Snatch', pattern: 'cardio', aliases: ['kb snatch'] },
  { id: 'kb-thruster', name: 'Kettlebell Thruster', pattern: 'cardio', aliases: ['kb thruster', 'squat to press'] },
  { id: 'kb-lunge', name: 'Kettlebell Lunge', pattern: 'cardio', aliases: ['kb walking lunge', 'kettlebell lunge'] },
  { id: 'kb-reverse-lunge', name: 'KB Reverse Lunge', pattern: 'cardio', aliases: ['kettlebell reverse lunge', 'kb step back lunge'] },
  { id: 'kb-deadlift', name: 'Kettlebell Deadlift', pattern: 'cardio', aliases: ['kb dl', 'kb rdl'] },
  { id: 'kb-row', name: 'Kettlebell Row', pattern: 'cardio', aliases: ['kb bent over row', 'single arm kb row'] },
  { id: 'burpee', name: 'Burpee', pattern: 'cardio', aliases: ['burpees'] },
  { id: 'mountain-climber', name: 'Mountain Climber', pattern: 'cardio', aliases: ['mountain climbers'] },
  { id: 'battle-ropes', name: 'Battle Ropes', pattern: 'cardio', aliases: ['rope waves', 'battling ropes'] },
  { id: 'sled-push', name: 'Sled Push', pattern: 'cardio', aliases: ['prowler push', 'sled work'] },
  { id: 'sled-pull', name: 'Sled Pull', pattern: 'cardio', aliases: ['prowler pull', 'rope sled pull'] },
  { id: 'farmers-carry', name: 'Farmers Carry', pattern: 'cardio', aliases: ['farmers walk', 'loaded carry'] },
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

// Loading fallback component
function BuilderLoading() {
  return (
    <div className="container mx-auto p-4 max-w-4xl flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-emerald-500" />
        <p className="text-muted-foreground">Loading workout builder...</p>
      </div>
    </div>
  );
}

// Main page wrapper with Suspense
export default function SessionWorkoutBuilderPage() {
  return (
    <Suspense fallback={<BuilderLoading />}>
      <WorkoutBuilderContent />
    </Suspense>
  );
}

// Actual content component that uses useSearchParams
function WorkoutBuilderContent() {
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
          setStyle: 'fixed' as const,
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
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  
  // New state for enhanced builder
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('none');
  const [previousPhaseConfig, setPreviousPhaseConfig] = useState<{ sets: number; reps: string; rest: string } | null>(null);
  const [assignmentType, setAssignmentType] = useState<'once' | 'weekly' | 'program'>('once');
  const [assignmentWeeks, setAssignmentWeeks] = useState<number>(4);
  const [assignmentDate, setAssignmentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const selectedPhase = TRAINING_PHASES.find(p => p.id === selectedPhaseId);
  const selectedClient = clients.find(c => c.clientId === selectedClientId);
  const selectedClientUser = allUsers.find(u => u.id === selectedClientId);
  
  // Apply phase configuration to all exercises
  const applyPhaseToExercises = (phaseId: string) => {
    const phase = TRAINING_PHASES.find(p => p.id === phaseId);
    if (!phase || phaseId === 'none') return;
    
    // Save current config before changing
    if (blocks.length > 0 && blocks[0].exercises.length > 0) {
      const firstEx = blocks[0].exercises[0];
      setPreviousPhaseConfig({ sets: firstEx.sets, reps: firstEx.reps, rest: firstEx.rest });
    }
    
    // Apply phase config to all exercises
    setBlocks(blocks.map(block => ({
      ...block,
      exercises: block.exercises.map(ex => ({
        ...ex,
        sets: phase.sets,
        reps: phase.reps,
        rest: phase.rest,
      })),
    })));
  };
  
  // Restore previous config when going back to no phase
  const restorePreviousConfig = () => {
    if (!previousPhaseConfig) return;
    setBlocks(blocks.map(block => ({
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
  
  // Handle phase change
  const handlePhaseChange = (newPhaseId: string) => {
    if (newPhaseId === 'none' && selectedPhaseId !== 'none') {
      restorePreviousConfig();
    } else if (newPhaseId !== 'none') {
      applyPhaseToExercises(newPhaseId);
    }
    setSelectedPhaseId(newPhaseId);
  };

  // Estimate workout duration
  const estimatedDuration = useMemo(() => {
    let totalSeconds = 0;
    
    blocks.forEach(block => {
      block.exercises.forEach(exercise => {
        // Time per set (approx 30-45 seconds for the actual lift)
        const timePerSet = block.type === 'warmup' ? 20 : block.type === 'cardio' || block.type === 'circuit' ? 45 : 35;
        totalSeconds += exercise.sets * timePerSet;
        
        // Rest time between sets (parse the rest string like "60s" or "90s")
        const restMatch = exercise.rest.match(/(\d+)/);
        const restSeconds = restMatch ? parseInt(restMatch[1]) : 60;
        // Rest is taken between sets, so (sets - 1) rest periods per exercise
        totalSeconds += (exercise.sets - 1) * restSeconds;
        
        // Transition time between exercises
        totalSeconds += 30;
      });
    });
    
    const minutes = Math.round(totalSeconds / 60);
    return minutes;
  }, [blocks]);

  const filteredExercises = COMMON_EXERCISES.filter(ex => {
    const search = exerciseSearch.toLowerCase();
    // Search by name or any alias
    return ex.name.toLowerCase().includes(search) ||
      ex.aliases?.some(alias => alias.toLowerCase().includes(search));
  });

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
      sets: selectedPhase?.sets || 3,
      reps: selectedPhase?.reps || '8-12',
      rest: selectedPhase?.rest || '60s',
      setStyle: 'fixed',
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
        <h1 className="text-2xl font-bold">Workout Builder</h1>
        <p className="text-muted-foreground">Create and assign workouts to clients</p>
      </div>

      {/* Client Selection */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label className="mb-2 block">Assign to Client</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {clients.map((c) => {
              const cUser = allUsers.find(u => u.id === c.clientId);
              return (
                <Button
                  key={c.clientId}
                  variant={selectedClientId === c.clientId ? "default" : "outline"}
                  className={`h-auto py-2 px-3 justify-start ${selectedClientId === c.clientId ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                  onClick={() => setSelectedClientId(c.clientId)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  <span className="truncate">{cUser?.displayName || c.clientId}</span>
                </Button>
              );
            })}
            {clients.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">No clients found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workout Name & Phase Selection */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label>Workout Name</Label>
              <Input 
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="Enter workout name..."
                className="mt-2"
              />
            </div>
            {blocks.length > 0 && (
              <div className="text-right">
                <Label className="text-muted-foreground">Est. Duration</Label>
                <div className="mt-2 flex items-center justify-end gap-1.5 text-emerald-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-lg font-semibold">{estimatedDuration}</span>
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Training Phase Selection */}
          <div>
            <Label className="mb-2 block">Training Phase</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecting a phase will auto-configure sets, reps, and rest for all exercises
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRAINING_PHASES.map((phase) => (
                <Button
                  key={phase.id}
                  variant={selectedPhaseId === phase.id ? "default" : "outline"}
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
              <p className="text-xs text-emerald-400 mt-2">
                ✓ {selectedPhase?.description}
              </p>
            )}
          </div>

          {/* Assignment Options */}
          <div>
            <Label className="mb-2 block">Assignment Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {ASSIGNMENT_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant={assignmentType === option.id ? "default" : "outline"}
                  className={`h-auto py-2 px-3 flex-col items-start ${assignmentType === option.id ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                  onClick={() => setAssignmentType(option.id as any)}
                >
                  <span className="font-medium text-sm">{option.name}</span>
                  <span className="text-xs opacity-70">{option.description}</span>
                </Button>
              ))}
            </div>
            
            {assignmentType === 'once' && (
              <div className="mt-3">
                <Label className="text-sm">Session Date</Label>
                <Input
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            
            {assignmentType === 'weekly' && (
              <div className="mt-3 flex items-center gap-2">
                <Label className="text-sm">Repeat for</Label>
                <Input
                  type="number"
                  value={assignmentWeeks}
                  onChange={(e) => setAssignmentWeeks(parseInt(e.target.value) || 1)}
                  className="w-20"
                  min={1}
                  max={52}
                />
                <span className="text-sm text-muted-foreground">weeks</span>
              </div>
            )}
          </div>
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
                          setStyle: 'fixed' as const,
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
                  <Badge variant="outline" className="text-xs capitalize mt-1">
                    {editingExercise.exercise.movementPattern}
                  </Badge>
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
                  <Tabs defaultValue="similar" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-3">
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
                                className="w-full justify-start text-left h-auto py-2"
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
                                  <p className="text-xs text-muted-foreground">{ex.equipment}</p>
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
                          {COMMON_EXERCISES.filter(ex => 
                            ex.pattern === editingExercise.exercise.movementPattern &&
                            ex.id !== editingExercise.exercise.exerciseId
                          ).map(ex => (
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
                                  }
                                });
                                setShowSwapPanel(false);
                              }}
                            >
                              <div>
                                <p className="font-medium text-sm">{ex.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{ex.pattern}</p>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="all" className="mt-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={exerciseSearch}
                          onChange={(e) => setExerciseSearch(e.target.value)}
                          placeholder="Search all exercises..."
                          className="pl-9"
                        />
                      </div>
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {filteredExercises.filter(ex => ex.id !== editingExercise.exercise.exerciseId).map(ex => (
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
                                    movementPattern: ex.pattern as MovementPattern,
                                  }
                                });
                                setShowSwapPanel(false);
                                setExerciseSearch('');
                              }}
                            >
                              <div>
                                <p className="font-medium text-sm">{ex.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{ex.pattern}</p>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Set Style Selection */}
              <div>
                <Label className="mb-2 block">Set Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {SET_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={`h-auto py-2 px-2 flex flex-col items-center justify-center text-center rounded-md border overflow-hidden transition-colors ${
                        editingExercise.exercise.setStyle === style.id 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800'
                      }`}
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
                    >
                      <span className="font-medium text-sm whitespace-nowrap">
                        {style.icon} {style.name}
                      </span>
                      <span className="text-xs opacity-70 truncate w-full">{style.description}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 These are suggestions - edit sets/reps below to record actual performance
                </p>
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
                  <Label>Reps {editingExercise.exercise.setStyle !== 'fixed' && '(per set)'}</Label>
                  <Input
                    value={editingExercise.exercise.reps}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, reps: e.target.value }
                    })}
                    placeholder={editingExercise.exercise.setStyle === 'pyramid' ? '12→10→8→6' : '8-12'}
                  />
                  {editingExercise.exercise.setStyle === 'pyramid' && (
                    <p className="text-xs text-muted-foreground mt-1">Use → to separate reps per set</p>
                  )}
                </div>
                <div>
                  <Label>Rest</Label>
                  <Input
                    value={editingExercise.exercise.rest}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, rest: e.target.value }
                    })}
                    placeholder={editingExercise.exercise.setStyle === 'drop-set' ? 'No rest' : '60s'}
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
                  placeholder="3010 (eccentric-pause-concentric-pause)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: eccentric-bottom pause-concentric-top pause (e.g., 3010)
                </p>
              </div>

              <div>
                <Label>Coaching Notes (optional)</Label>
                <Input
                  value={editingExercise.exercise.notes || ''}
                  onChange={(e) => setEditingExercise({
                    ...editingExercise,
                    exercise: { ...editingExercise.exercise, notes: e.target.value }
                  })}
                  placeholder="Any coaching cues for this exercise..."
                />
              </div>

              <Button onClick={saveExerciseEdit} className="w-full bg-emerald-500 hover:bg-emerald-600">
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
