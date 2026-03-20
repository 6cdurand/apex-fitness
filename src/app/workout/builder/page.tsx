'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { getClientDisplayInfo, getClientName as getClientNameUtil } from '@/lib/clientUtils';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ExerciseImage } from '@/components/ExerciseImage';
import { ExerciseHowTo } from '@/components/ExerciseHowTo';
import { useTrainerStore, useAuthStore, useWorkoutStore } from '@/lib/store';
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
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSwapSuggestions, getDirectSwaps } from '@/lib/exerciseRelations';
import { exerciseLibrary, exerciseLibraryMap, filterExercisesBySearch, getExerciseUsageCounts } from '@/lib/exercises';
import { 
  estimateWorkoutLengthSeconds, 
  formatDuration, 
  TEMPO_PRESETS, 
  REST_PRESETS,
  type EstimatorExercise,
  type Tempo,
  mapEquipmentToType 
} from '@/lib/workoutEstimator';

interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  movementPattern: MovementPattern;
  sets: number;
  reps: string;
  repType: 'reps' | 'time'; // 'time' for cardio, iso holds, etc.
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

type CircuitStyle = 'rounds' | 'amrap' | 'emom' | 'forTime' | 'tabata';

interface WorkoutBlock {
  id: string;
  type: BlockType;
  name: string;
  exercises: WorkoutExercise[];
  // Circuit-specific settings
  circuitStyle?: CircuitStyle; // Type of circuit
  rounds?: number; // Number of circuit rounds
  roundDuration?: string; // Duration per round (e.g., "5min")
  restBetweenRounds?: string; // Rest between rounds (e.g., "60s")
  targetTime?: string; // For "for time" circuits
  workInterval?: string; // For tabata/EMOM
  restInterval?: string; // For tabata
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
  { id: 'kb-clean', name: 'Kettlebell Clean', pattern: 'cardio', aliases: ['kb clean', 'kettlebell clean'] },
  { id: 'kb-snatch', name: 'Kettlebell Snatch', pattern: 'cardio', aliases: ['kb snatch'] },
  { id: 'kb-thruster', name: 'Kettlebell Thruster', pattern: 'cardio', aliases: ['kb thruster', 'squat to press'] },
  { id: 'burpee', name: 'Burpee', pattern: 'cardio', aliases: ['burpees'] },
  { id: 'mountain-climber', name: 'Mountain Climber', pattern: 'cardio', aliases: ['mountain climbers'] },
  { id: 'battle-ropes', name: 'Battle Ropes', pattern: 'cardio', aliases: ['rope waves', 'battling ropes'] },
  { id: 'sled-push', name: 'Sled Push', pattern: 'cardio', aliases: ['prowler push', 'sled work'] },
  { id: 'sled-pull', name: 'Sled Pull', pattern: 'cardio', aliases: ['prowler pull', 'rope sled pull'] },
  { id: 'farmers-carry', name: 'Farmers Carry', pattern: 'cardio', aliases: ['farmers walk', 'loaded carry'] },
  // Compound/Circuit Exercises
  { id: 'curl-to-press', name: 'Curl to Press', pattern: 'push', aliases: ['bicep curl to press', 'curl and press', 'db curl to press'] },
  { id: 'clean-and-press', name: 'Clean and Press', pattern: 'push', aliases: ['db clean and press', 'clean press'] },
  { id: 'squat-to-press', name: 'Squat to Press', pattern: 'squat', aliases: ['thruster', 'squat press'] },
  { id: 'lunge-to-curl', name: 'Lunge to Curl', pattern: 'lunge', aliases: ['walking lunge curl'] },
  { id: 'deadlift-to-row', name: 'Deadlift to Row', pattern: 'hinge', aliases: ['dl to row', 'rdl to row'] },
  { id: 'renegade-row', name: 'Renegade Row', pattern: 'pull', aliases: ['plank row', 'push up row'] },
  { id: 'man-maker', name: 'Man Maker', pattern: 'cardio', aliases: ['man makers', 'db man maker'] },
  { id: 'turkish-getup', name: 'Turkish Get-up', pattern: 'core', aliases: ['tgu', 'turkish getup'] },
  { id: 'devils-press', name: 'Devil\'s Press', pattern: 'cardio', aliases: ['devils press', 'db burpee snatch'] },
  { id: 'wall-ball', name: 'Wall Ball', pattern: 'squat', aliases: ['wall balls', 'med ball squat throw'] },
  { id: 'med-ball-slam', name: 'Med Ball Slam', pattern: 'hinge', aliases: ['ball slam', 'medicine ball slam'] },
  { id: 'sumo-deadlift-high-pull', name: 'Sumo Deadlift High Pull', pattern: 'hinge', aliases: ['sdhp', 'sumo high pull'] },
  { id: 'hang-clean', name: 'Hang Clean', pattern: 'hinge', aliases: ['db hang clean', 'barbell hang clean'] },
  { id: 'power-clean', name: 'Power Clean', pattern: 'hinge', aliases: ['barbell clean', 'clean'] },
  { id: 'power-snatch', name: 'Power Snatch', pattern: 'hinge', aliases: ['barbell snatch', 'snatch'] },
  { id: 'clean-and-jerk', name: 'Clean & Jerk', pattern: 'hinge', aliases: ['clean jerk', 'c&j', 'olympic clean and jerk'] },
  { id: 'hang-snatch', name: 'Hang Snatch', pattern: 'hinge', aliases: ['barbell hang snatch', 'hang power snatch'] },
  { id: 'squat-clean', name: 'Squat Clean', pattern: 'squat', aliases: ['full clean', 'clean to front squat'] },
  { id: 'push-press', name: 'Push Press', pattern: 'push', aliases: ['bb push press', 'db push press'] },
  { id: 'thrusters', name: 'Thrusters', pattern: 'squat', aliases: ['barbell thruster', 'db thruster'] },
  { id: 'step-ups', name: 'Step Ups', pattern: 'lunge', aliases: ['box step up', 'weighted step up'] },
  { id: 'squat-jump', name: 'Squat Jump', pattern: 'squat', aliases: ['jump squat', 'jumping squat'] },
  { id: 'lunge-jump', name: 'Lunge Jump', pattern: 'lunge', aliases: ['jumping lunge', 'split jump'] },
  { id: 'high-knees', name: 'High Knees', pattern: 'cardio', aliases: ['running in place', 'knee drives'] },
  { id: 'butt-kicks', name: 'Butt Kicks', pattern: 'cardio', aliases: ['heel flicks', 'hamstring kicks'] },
  { id: 'bear-crawl', name: 'Bear Crawl', pattern: 'core', aliases: ['bear crawls'] },
  { id: 'lateral-shuffle', name: 'Lateral Shuffle', pattern: 'cardio', aliases: ['side shuffle', 'lateral slides'] },
  { id: 'skater-jumps', name: 'Skater Jumps', pattern: 'cardio', aliases: ['ice skaters', 'lateral bounds'] },
  { id: 'tuck-jump', name: 'Tuck Jump', pattern: 'cardio', aliases: ['tuck jumps', 'knee tuck jump'] },
  { id: 'broad-jump', name: 'Broad Jump', pattern: 'cardio', aliases: ['standing long jump', 'horizontal jump'] },
  // Additional isolation exercises
  { id: 'preacher-curl', name: 'Preacher Curl', pattern: 'pull', aliases: ['ez bar preacher', 'machine preacher curl'] },
  { id: 'concentration-curl', name: 'Concentration Curl', pattern: 'pull', aliases: ['seated concentration curl'] },
  { id: 'cable-curl', name: 'Cable Curl', pattern: 'pull', aliases: ['straight bar cable curl'] },
  { id: 'overhead-tricep-extension', name: 'Overhead Tricep Extension', pattern: 'push', aliases: ['db overhead extension', 'french press'] },
  { id: 'kickback', name: 'Tricep Kickback', pattern: 'push', aliases: ['db kickback', 'cable kickback'] },
  { id: 'close-grip-bench', name: 'Close Grip Bench Press', pattern: 'push', aliases: ['cgbp', 'close grip press'] },
  { id: 'front-raise', name: 'Front Raise', pattern: 'push', aliases: ['db front raise', 'plate front raise'] },
  { id: 'upright-row', name: 'Upright Row', pattern: 'pull', aliases: ['bb upright row', 'cable upright row'] },
  { id: 'arnold-press', name: 'Arnold Press', pattern: 'push', aliases: ['arnold shoulder press'] },
  { id: 'hip-abduction', name: 'Hip Abduction Machine', pattern: 'squat', aliases: ['abductor machine', 'outer thigh'] },
  { id: 'hip-adduction', name: 'Hip Adduction Machine', pattern: 'squat', aliases: ['adductor machine', 'inner thigh'] },
  { id: 'glute-kickback', name: 'Glute Kickback', pattern: 'hinge', aliases: ['cable kickback', 'donkey kick'] },
  { id: 'hyperextension', name: 'Hyperextension', pattern: 'hinge', aliases: ['back extension', '45 degree extension'] },
  { id: 'reverse-hyper', name: 'Reverse Hyperextension', pattern: 'hinge', aliases: ['reverse hyper', 'reverse back extension'] },
  // Machine exercises
  { id: 'machine-chest-press', name: 'Machine Chest Press', pattern: 'push', aliases: ['chest press machine', 'seated chest press', 'plate loaded chest press'] },
  { id: 'machine-incline-press', name: 'Machine Incline Press', pattern: 'push', aliases: ['incline chest press machine', 'incline machine press'] },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', pattern: 'push', aliases: ['shoulder press machine', 'seated shoulder machine'] },
  { id: 'machine-lateral-raise', name: 'Machine Lateral Raise', pattern: 'push', aliases: ['lateral raise machine', 'side raise machine'] },
  { id: 'machine-row', name: 'Machine Row', pattern: 'pull', aliases: ['row machine', 'plate loaded row', 'iso row'] },
  { id: 'machine-high-row', name: 'Machine High Row', pattern: 'pull', aliases: ['high row machine', 'converging row'] },
  { id: 'machine-lat-pulldown', name: 'Machine Lat Pulldown', pattern: 'pull', aliases: ['pulldown machine', 'plate loaded pulldown'] },
  { id: 'machine-bicep-curl', name: 'Machine Bicep Curl', pattern: 'pull', aliases: ['bicep curl machine', 'preacher curl machine'] },
  { id: 'machine-tricep-extension', name: 'Machine Tricep Extension', pattern: 'push', aliases: ['tricep machine', 'tricep extension machine'] },
  { id: 'machine-chest-fly', name: 'Machine Chest Fly', pattern: 'push', aliases: ['chest fly machine', 'pec fly machine', 'butterfly machine'] },
  { id: 'machine-rear-delt', name: 'Machine Rear Delt Fly', pattern: 'pull', aliases: ['rear delt machine', 'reverse pec deck'] },
  { id: 'machine-leg-press', name: 'Machine Leg Press', pattern: 'squat', aliases: ['seated leg press', 'horizontal leg press', '45 degree leg press'] },
  { id: 'machine-leg-curl', name: 'Machine Leg Curl', pattern: 'hinge', aliases: ['lying leg curl machine', 'prone leg curl'] },
  { id: 'machine-seated-leg-curl', name: 'Machine Seated Leg Curl', pattern: 'hinge', aliases: ['seated hamstring curl', 'seated leg curl machine'] },
  { id: 'machine-calf-raise', name: 'Machine Calf Raise', pattern: 'squat', aliases: ['standing calf machine', 'calf raise machine'] },
  { id: 'machine-seated-calf', name: 'Machine Seated Calf Raise', pattern: 'squat', aliases: ['seated calf machine', 'soleus raise'] },
  { id: 'machine-glute', name: 'Machine Glute Kickback', pattern: 'hinge', aliases: ['glute machine', 'glute kickback machine'] },
  { id: 'machine-hip-thrust', name: 'Machine Hip Thrust', pattern: 'hinge', aliases: ['hip thrust machine', 'glute drive'] },
  { id: 'machine-ab-crunch', name: 'Machine Ab Crunch', pattern: 'core', aliases: ['ab machine', 'crunch machine', 'abdominal machine'] },
  { id: 'assisted-dip', name: 'Assisted Dip Machine', pattern: 'push', aliases: ['dip assist', 'gravitron dip'] },
  { id: 'assisted-pull-up', name: 'Assisted Pull-Up Machine', pattern: 'pull', aliases: ['pull up assist', 'gravitron pull up'] },
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

// Loading fallback component
function BuilderLoading() {
  return (
    <div className="container mx-auto p-4 max-w-4xl flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-sky-500" />
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
  const workoutId = searchParams.get('workoutId'); // For editing existing workout
  const libraryId = searchParams.get('libraryId'); // For loading from library
  
  const { user } = useAuthStore();
  const { workoutHistory } = useWorkoutStore();
  const { 
    clients, 
    calendarEvents, 
    updateCalendarEvent, 
    addSessionWorkout, 
    getSessionWorkout,
    updateSessionWorkout,
    deleteSessionWorkout,
    sessionWorkouts,
    workoutLibrary,
    circuitLibrary,
    saveToWorkoutLibrary,
    saveCircuitTemplate,
    savedBlocks,
    saveBlock,
    deleteBlock,
    getBlocksByType,
    loadFromSupabase,
    blockPerformances,
    getBlockPerformances,
    getBestBlockPerformance,
    getActiveProgram,
    clientPrograms,
  } = useTrainerStore();
  
  const client = clients.find(c => c.clientId === clientId);
  const event = calendarEvents.find(e => e.id === eventId);
  const template = defaultTemplates.find(t => t.id === templateId);
  
  // Get existing workout for edit mode
  const existingWorkout = workoutId ? getSessionWorkout(workoutId) : null;
  const libraryWorkout = libraryId ? workoutLibrary.find(w => w.id === libraryId) : null;
  
  // Track if we're in edit mode
  const isEditMode = !!workoutId && !!existingWorkout;
  
  const [workoutName, setWorkoutName] = useState(
    existingWorkout?.name || libraryWorkout?.name || template?.name || event?.title || 'Custom Workout'
  );
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [showSaveToLibraryDialog, setShowSaveToLibraryDialog] = useState(false);
  const [libraryWorkoutName, setLibraryWorkoutName] = useState('');
  const [libraryWorkoutTags, setLibraryWorkoutTags] = useState('');
  const [showEditOptionsDialog, setShowEditOptionsDialog] = useState(isEditMode);
  const [showCircuitLibraryDialog, setShowCircuitLibraryDialog] = useState(false);
  const [showSaveCircuitDialog, setShowSaveCircuitDialog] = useState(false);
  const [circuitTemplateName, setCircuitTemplateName] = useState('');
  const [activeCircuitBlockId, setActiveCircuitBlockId] = useState<string | null>(null);
  
  // Block Library state
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
  
  // Custom exercise state
  const [showCreateExerciseDialog, setShowCreateExerciseDialog] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [customExerciseType, setCustomExerciseType] = useState<'normal' | 'cardio' | 'stretch'>('normal');
  const [customExercises, setCustomExercises] = useState<Array<{ id: string; name: string; type: 'normal' | 'cardio' | 'stretch' }>>(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('apex-custom-exercises') || '[]');
    }
    return [];
  });
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);
  
  // Block type selection dialog state
  const [showBlockTypeDialog, setShowBlockTypeDialog] = useState(false);
  const [selectedBlockType, setSelectedBlockType] = useState<BlockType | null>(null);
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored);
  }, []);
  
  const clientUser = allUsers.find(u => u.id === clientId);
  const clientDisplayName = getClientNameUtil(clientId);
  
  // Initialize blocks from existing workout, library, template, or empty
  const initialBlocks = useMemo(() => {
    // Priority: existing workout > library workout > template > empty
    if (existingWorkout?.blocks) {
      return existingWorkout.blocks;
    }
    if (libraryWorkout?.blocks) {
      return libraryWorkout.blocks;
    }
    if (template?.exercises) {
      // Convert template exercises to blocks
      const workBlock: WorkoutBlock = {
        id: 'main-block',
        type: 'work',
        name: 'Strength',
        exercises: template.exercises.map((ex, idx) => ({
          id: `ex-${idx}`,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exercise?.name || 'Exercise',
          movementPattern: 'push' as MovementPattern,
          sets: ex.sets?.length || 3,
          reps: ex.sets?.[0]?.reps?.toString() || '8-12',
          repType: 'reps' as const,
          rest: `${ex.restTimerSeconds || 60}s`,
          setStyle: 'fixed' as const,
        })),
      };
      return [workBlock];
    }
    return [];
  }, [existingWorkout, libraryWorkout, template]);

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
  const selectedClientName = getClientNameUtil(selectedClientId);
  
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

  // Parse tempo string to Tempo array
  const parseTempo = (tempoStr?: string): Tempo | undefined => {
    if (!tempoStr) return undefined;
    const digits = tempoStr.replace(/[^0-9]/g, '');
    if (digits.length >= 4) {
      return [parseInt(digits[0]), parseInt(digits[1]), parseInt(digits[2]), parseInt(digits[3])];
    }
    return undefined;
  };

  // Estimate workout duration using new estimator
  const workoutEstimate = useMemo(() => {
    const exercises: EstimatorExercise[] = [];
    let cardioSeconds = 0;
    
    blocks.forEach(block => {
      if (block.type === 'circuit' && block.rounds && block.roundDuration) {
        // Circuit blocks: calculate total time
        const durationMatch = block.roundDuration.match(/(\d+)/);
        const roundMinutes = durationMatch ? parseInt(durationMatch[1]) : 5;
        const restMatch = block.restBetweenRounds?.match(/(\d+)/);
        const restSecs = restMatch ? parseInt(restMatch[1]) : 60;
        cardioSeconds += block.rounds * roundMinutes * 60 + (block.rounds - 1) * restSecs;
      } else {
        block.exercises.forEach(exercise => {
          // Parse reps - handle ranges like "8-12" by taking average
          let reps = 10;
          const repsMatch = exercise.reps.match(/(\d+)(?:-(\d+))?/);
          if (repsMatch) {
            if (repsMatch[2]) {
              reps = Math.round((parseInt(repsMatch[1]) + parseInt(repsMatch[2])) / 2);
            } else {
              reps = parseInt(repsMatch[1]);
            }
          }
          
          // Parse rest time
          const restMatch = exercise.rest.match(/(\d+)/);
          const restSecs = restMatch ? parseInt(restMatch[1]) : 90;
          
          // Infer equipment type from exercise name
          const name = exercise.exerciseName.toLowerCase();
          let equipmentType: 'barbell' | 'machine' | 'cable' | 'dumbbell' | 'bodyweight' | 'other' = 'other';
          if (name.includes('barbell') || name.includes('bb ') || name.includes('deadlift') || name.includes('bench press') || name.includes('squat')) {
            equipmentType = 'barbell';
          } else if (name.includes('dumbbell') || name.includes('db ')) {
            equipmentType = 'dumbbell';
          } else if (name.includes('cable') || name.includes('pulldown') || name.includes('face pull')) {
            equipmentType = 'cable';
          } else if (name.includes('machine') || name.includes('smith') || name.includes('leg press') || name.includes('pec deck') || name.includes('hack')) {
            equipmentType = 'machine';
          } else if (name.includes('push-up') || name.includes('pull-up') || name.includes('dip') || name.includes('plank')) {
            equipmentType = 'bodyweight';
          }
          
          exercises.push({
            name: exercise.exerciseName,
            sets: exercise.sets,
            reps: reps,
            restSeconds: restSecs,
            tempo: parseTempo(exercise.tempo),
            type: equipmentType,
          });
        });
      }
    });
    
    const estimate = estimateWorkoutLengthSeconds(exercises, [{ name: 'circuits', durationSeconds: cardioSeconds }]);
    return estimate;
  }, [blocks]);
  
  const estimatedDuration = Math.round(workoutEstimate.totalSeconds / 60);

  // Combine library exercises with custom exercises
  const allExercises = [
    ...COMMON_EXERCISES,
    ...customExercises.map(ce => ({
      id: ce.id,
      name: ce.name,
      pattern: ce.type === 'cardio' ? 'cardio' : 'compound',
      aliases: [],
      isCustom: true,
    })),
  ];
  
  // Get the current block type being edited for exercise filtering
  const currentBlockType = showAddExercise ? blocks.find(b => b.id === showAddExercise)?.type : null;
  
  const filteredExercises = useMemo(() => {
    return filterExercisesBySearch(allExercises, exerciseSearch, currentBlockType);
  }, [allExercises, exerciseSearch, currentBlockType]);
  
  // Exercise usage counts for the target user (self or client in trainer mode)
  const targetUserId = clientId || user?.id || '';
  const exerciseUsageCounts = useMemo(() => {
    if (!targetUserId) return {};
    return getExerciseUsageCounts(workoutHistory, targetUserId);
  }, [workoutHistory, targetUserId]);
  
  // Handler to save custom exercise
  const handleCreateCustomExercise = () => {
    if (!customExerciseName.trim()) {
      toast.error('Please enter an exercise name');
      return;
    }
    
    const newExercise = {
      id: `custom-${Date.now()}`,
      name: customExerciseName.trim(),
      type: customExerciseType,
    };
    
    const updated = [...customExercises, newExercise];
    setCustomExercises(updated);
    localStorage.setItem('apex-custom-exercises', JSON.stringify(updated));
    
    toast.success(`"${customExerciseName}" added to your exercises!`);
    
    // Add to the current block if we have a pending block
    if (pendingBlockId) {
      const exerciseToAdd = {
        id: newExercise.id,
        name: newExercise.name,
        pattern: newExercise.type === 'cardio' ? 'cardio' : newExercise.type === 'stretch' ? 'warmup' : 'compound',
        aliases: [],
      };
      addExercise(pendingBlockId, exerciseToAdd as typeof COMMON_EXERCISES[0]);
    }
    
    setShowCreateExerciseDialog(false);
    setCustomExerciseName('');
    setCustomExerciseType('normal');
    setPendingBlockId(null);
  };

  const sortBlocks = (blocksToSort: WorkoutBlock[]): WorkoutBlock[] => {
    const order: Record<BlockType, number> = { warmup: 0, work: 1, cardio: 2, circuit: 3, cooldown: 4 };
    return [...blocksToSort].sort((a, b) => order[a.type] - order[b.type]);
  };

  const addBlock = (type: BlockType) => {
    // Check if there are saved blocks of this type
    const savedBlocksOfType = savedBlocks.filter(b => b.type === type);
    if (savedBlocksOfType.length > 0) {
      // Show dialog to choose between empty or saved block
      setSelectedBlockType(type);
      setShowBlockTypeDialog(true);
      return;
    }
    // No saved blocks, add empty block directly
    addEmptyBlock(type);
  };
  
  const addEmptyBlock = (type: BlockType) => {
    const newBlock: WorkoutBlock = {
      id: `block-${Date.now()}`,
      type,
      name: type === 'warmup' ? 'Warm-up' : type === 'cooldown' ? 'Cool-down' : type === 'circuit' ? 'Circuit' : 'Strength',
      exercises: [],
      // Default circuit settings
      ...(type === 'circuit' && {
        rounds: 3,
        roundDuration: '5min',
        restBetweenRounds: '60s',
      }),
    };
    setBlocks(sortBlocks([...blocks, newBlock]));
    setShowBlockTypeDialog(false);
    setSelectedBlockType(null);
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
  };

  const addExercise = (blockId: string, exercise: typeof COMMON_EXERCISES[0]) => {
    // Determine if this is a time-based exercise (warmup, cardio patterns)
    const isTimeBased = exercise.pattern === 'warmup' || exercise.pattern === 'cardio';
    const block = blocks.find(b => b.id === blockId);
    const isCircuitBlock = block?.type === 'circuit';
    
    const newExercise: WorkoutExercise = {
      id: `ex-${Date.now()}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      movementPattern: exercise.pattern as MovementPattern,
      sets: isCircuitBlock ? 1 : (selectedPhase?.sets || 3),
      reps: isTimeBased ? '30s' : (selectedPhase?.reps || '8-12'),
      repType: isTimeBased ? 'time' : 'reps',
      rest: isCircuitBlock ? '0s' : (selectedPhase?.rest || '60s'),
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
    console.log('[Builder] Saving blocks:', blocks.map(b => ({ id: b.id, type: b.type, name: b.name })));
    if (isEditMode && existingWorkout) {
      // Update existing workout
      updateSessionWorkout(existingWorkout.id, {
        name: workoutName,
        blocks,
      });
      
      // Update calendar event if linked
      if (existingWorkout.eventId) {
        updateCalendarEvent(existingWorkout.eventId, { title: workoutName });
      }
      
      toast.success('Workout updated!');
      router.back();
      return;
    }
    
    // Create a workout ID for this session
    const newWorkoutId = `session-workout-${Date.now()}`;
    
    // Update the calendar event with the workout ID
    if (eventId) {
      updateCalendarEvent(eventId, { 
        workoutId: newWorkoutId,
        title: workoutName,
      });
    }
    
    // Store the workout blocks using trainer store (persisted via Zustand)
    const workoutData = {
      id: newWorkoutId,
      name: workoutName,
      clientId: clientId || selectedClientId || '',
      eventId: eventId || undefined,
      blocks,
      createdAt: new Date().toISOString(),
    };
    
    // Save to trainer store (automatically persisted)
    addSessionWorkout(workoutData);
    
    // Also save to localStorage for backward compatibility
    const existingWorkouts = JSON.parse(localStorage.getItem('apex-session-workouts') || '[]');
    localStorage.setItem('apex-session-workouts', JSON.stringify([...existingWorkouts, workoutData]));
    
    toast.success('Workout saved and linked to session!');
    router.back();
  };

  const handleSaveToLibrary = () => {
    if (!libraryWorkoutName.trim()) {
      toast.error('Please enter a workout name');
      return;
    }
    
    const tags = libraryWorkoutTags.split(',').map(t => t.trim()).filter(Boolean);
    
    saveToWorkoutLibrary({
      name: libraryWorkoutName,
      blocks,
      tags,
      estimatedMinutes: estimatedDuration,
    });
    
    toast.success('Workout saved to library!');
    setShowSaveToLibraryDialog(false);
    setLibraryWorkoutName('');
    setLibraryWorkoutTags('');
  };

  const handleDeleteAndRestart = () => {
    if (isEditMode && existingWorkout) {
      deleteSessionWorkout(existingWorkout.id);
      toast.success('Workout deleted');
    }
    setBlocks([]);
    setShowEditOptionsDialog(false);
  };

  const handleLoadFromLibrary = (libraryItem: typeof workoutLibrary[0]) => {
    setBlocks(libraryItem.blocks);
    setWorkoutName(libraryItem.name);
    setShowLibraryDialog(false);
    toast.success(`Loaded "${libraryItem.name}" from library`);
  };

  const handleSaveCircuitTemplate = () => {
    if (!circuitTemplateName.trim() || !activeCircuitBlockId) {
      toast.error('Please enter a circuit name');
      return;
    }
    
    const block = blocks.find(b => b.id === activeCircuitBlockId);
    if (!block) return;
    
    saveCircuitTemplate({
      name: circuitTemplateName,
      exercises: block.exercises,
      circuitStyle: block.circuitStyle || 'rounds',
      rounds: block.rounds,
      duration: block.roundDuration ? parseInt(block.roundDuration) * 60 : undefined,
      restBetweenRounds: block.restBetweenRounds,
    });
    
    toast.success('Circuit saved to library!');
    setShowSaveCircuitDialog(false);
    setCircuitTemplateName('');
    setActiveCircuitBlockId(null);
  };

  const handleLoadCircuitTemplate = (circuit: typeof circuitLibrary[0]) => {
    if (!activeCircuitBlockId) return;
    
    setBlocks(blocks.map(b => 
      b.id === activeCircuitBlockId 
        ? { 
            ...b, 
            name: circuit.name,
            exercises: circuit.exercises,
            circuitStyle: circuit.circuitStyle,
            rounds: circuit.rounds,
            restBetweenRounds: circuit.restBetweenRounds,
          } 
        : b
    ));
    
    setShowCircuitLibraryDialog(false);
    setActiveCircuitBlockId(null);
    toast.success(`Loaded "${circuit.name}" circuit`);
  };

  // Block Library handlers
  const handleSaveBlock = (forceReplace = false) => {
    if (!blockLibraryName.trim() || !activeBlockId) {
      toast.error('Please enter a block name');
      return;
    }
    
    const block = blocks.find(b => b.id === activeBlockId);
    if (!block) return;
    
    // Check for existing block with same name (case-insensitive)
    const existingBlock = savedBlocks.find(
      b => b.name.toLowerCase() === blockLibraryName.trim().toLowerCase()
    );
    
    if (existingBlock && !forceReplace) {
      // Show replace confirmation dialog
      setExistingBlockToReplace(existingBlock.id);
      setShowReplaceBlockDialog(true);
      return;
    }
    
    // If replacing, delete the old block first
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
    
    toast.success(forceReplace ? `"${blockLibraryName}" replaced in block library!` : `"${blockLibraryName}" saved to block library!`);
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
      
      // First sync all local blocks to Supabase
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
      
      // Reload all data from Supabase (updates savedBlocks in store)
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
    // Create a new block with the saved block's data
    const newBlock: WorkoutBlock = {
      id: `block-${Date.now()}`,
      type: savedBlock.type,
      name: savedBlock.name,
      exercises: savedBlock.exercises.map(ex => ({
        ...ex,
        id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        movementPattern: 'compound' as MovementPattern,
        repType: ex.repType || 'reps',
        setStyle: ex.setStyle || 'fixed',
      })),
      circuitStyle: savedBlock.circuitStyle,
      rounds: savedBlock.circuitRounds,
      roundDuration: savedBlock.circuitDuration ? `${Math.floor(savedBlock.circuitDuration / 60)}min` : undefined,
      restBetweenRounds: savedBlock.circuitRestBetween ? `${savedBlock.circuitRestBetween}s` : undefined,
    };
    
    setBlocks(sortBlocks([...blocks, newBlock]));
    // Keep dialog open so user can add multiple blocks
    toast.success(`Added "${savedBlock.name}" block`);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl pb-24">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex gap-2">
            {selectedClientId && getActiveProgram(selectedClientId) && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProgramDialog(true)}
                >
                  📋 From Program
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push(`/trainer/clients/${selectedClientId}?tab=program`)}
                >
                  ✏️ Edit Program
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowLibraryDialog(true)}
            >
              📚 Load from Library
            </Button>
            {blocks.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setLibraryWorkoutName(workoutName);
                  setShowSaveToLibraryDialog(true);
                }}
              >
                💾 Save to Library
              </Button>
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold">
          {isEditMode ? 'Edit Workout' : 'Workout Builder'}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode ? 'Modify the existing workout or start fresh' : 'Create and assign workouts to clients'}
        </p>
      </div>

      {/* Client Selection */}
      <Card className="mb-4 bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <Label className="mb-3 block text-white">Assign to Client</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {clients.map((c) => {
              const isSelected = selectedClientId === c.clientId;
              return (
                <button
                  key={c.clientId}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400 ring-2 ring-sky-500/50' 
                      : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-sky-500/50 hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedClientId(c.clientId)}
                >
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-sm font-medium">{getClientNameUtil(c.clientId)}</span>
                </button>
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
                className="mt-2 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
            {blocks.length > 0 && (
              <div className="text-right">
                <Label className="text-muted-foreground">Est. Duration</Label>
                <div className="mt-2 flex items-center justify-end gap-1.5 text-sky-400">
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
              <p className="text-xs text-sky-400 mt-2">
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
                  className={`h-auto py-2 px-2 sm:px-3 flex-col items-start overflow-hidden ${assignmentType === option.id ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
                  onClick={() => setAssignmentType(option.id as any)}
                >
                  <span className="font-medium text-xs sm:text-sm">{option.name}</span>
                  <span className="text-[10px] sm:text-xs opacity-70 line-clamp-2">{option.description}</span>
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
                  className="mt-1 bg-gray-800/50 border-gray-700 text-white"
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
                  className="w-20 bg-gray-800/50 border-gray-700 text-white"
                  min={1}
                  max={52}
                />
                <span className="text-sm text-muted-foreground">weeks</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Block Bar - Always visible */}
      <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400 mr-1">Add Block:</span>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBlockLibraryDialog(true)}
            className="gap-1 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
          >
            📚 Block Library {savedBlocks.length > 0 && `(${savedBlocks.length})`}
          </Button>
        </div>
      </div>

      {/* Template Selection - Only when no blocks */}
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
                          repType: 'reps' as const,
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
                    <div className="flex items-center gap-1">
                      {block.exercises.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                          onClick={() => {
                            setActiveBlockId(block.id);
                            setBlockLibraryName(block.name || 'My Block');
                            setShowSaveBlockDialog(true);
                          }}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => removeBlock(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Circuit Block Settings */}
                  {block.type === 'circuit' && (
                    <div className="mb-4 p-3 bg-background/30 rounded-lg border border-orange-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-400" />
                          <span className="text-sm font-medium text-orange-400">Circuit Style</span>
                        </div>
                        <div className="flex gap-1">
                          {circuitLibrary.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-orange-400 hover:bg-orange-500/10"
                              onClick={() => {
                                setActiveCircuitBlockId(block.id);
                                setShowCircuitLibraryDialog(true);
                              }}
                            >
                              📚 Load
                            </Button>
                          )}
                          {block.exercises.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-orange-400 hover:bg-orange-500/10"
                              onClick={() => {
                                setActiveCircuitBlockId(block.id);
                                setCircuitTemplateName(block.name || 'My Circuit');
                                setShowSaveCircuitDialog(true);
                              }}
                            >
                              💾 Save
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Circuit Style Toggle */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {[
                          { id: 'rounds', label: 'Rounds', icon: '🔄', desc: 'X rounds of exercises' },
                          { id: 'amrap', label: 'AMRAP', icon: '♾️', desc: 'As many rounds as possible' },
                          { id: 'emom', label: 'EMOM', icon: '⏱️', desc: 'Every minute on the minute' },
                          { id: 'forTime', label: 'For Time', icon: '🏁', desc: 'Complete as fast as possible' },
                          { id: 'tabata', label: 'Tabata', icon: '⚡', desc: '20s work / 10s rest' },
                        ].map((style) => (
                          <Button
                            key={style.id}
                            type="button"
                            variant={block.circuitStyle === style.id || (!block.circuitStyle && style.id === 'rounds') ? 'default' : 'outline'}
                            size="sm"
                            className={block.circuitStyle === style.id || (!block.circuitStyle && style.id === 'rounds') 
                              ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                              : 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10'}
                            onClick={() => setBlocks(blocks.map(b => 
                              b.id === block.id ? { ...b, circuitStyle: style.id as CircuitStyle } : b
                            ))}
                          >
                            <span className="mr-1">{style.icon}</span>
                            {style.label}
                          </Button>
                        ))}
                      </div>
                      
                      {/* Settings based on circuit style */}
                      {(block.circuitStyle === 'rounds' || !block.circuitStyle) && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Rounds</Label>
                            <Input
                              type="number"
                              value={block.rounds || 3}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, rounds: parseInt(e.target.value) || 1 } : b
                              ))}
                              className="h-8 mt-1"
                              min={1}
                              max={20}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Round Duration</Label>
                            <Input
                              value={block.roundDuration || '5min'}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, roundDuration: e.target.value } : b
                              ))}
                              className="h-8 mt-1"
                              placeholder="5min"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Rest Between</Label>
                            <Input
                              value={block.restBetweenRounds || '60s'}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, restBetweenRounds: e.target.value } : b
                              ))}
                              className="h-8 mt-1"
                              placeholder="60s"
                            />
                          </div>
                        </div>
                      )}
                      
                      {block.circuitStyle === 'amrap' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Time Cap</Label>
                            <Input
                              value={block.targetTime || '10min'}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, targetTime: e.target.value } : b
                              ))}
                              className="h-8 mt-1"
                              placeholder="10min"
                            />
                          </div>
                          <div className="flex items-end">
                            <p className="text-xs text-orange-400/70">Complete as many rounds as possible in the time cap</p>
                          </div>
                        </div>
                      )}
                      
                      {block.circuitStyle === 'emom' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Total Minutes</Label>
                            <Input
                              type="number"
                              value={block.rounds || 10}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, rounds: parseInt(e.target.value) || 1 } : b
                              ))}
                              className="h-8 mt-1"
                              min={1}
                              max={30}
                            />
                          </div>
                          <div className="flex items-end">
                            <p className="text-xs text-orange-400/70">Complete exercises at the start of each minute</p>
                          </div>
                        </div>
                      )}
                      
                      {block.circuitStyle === 'forTime' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Rounds</Label>
                            <Input
                              type="number"
                              value={block.rounds || 3}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, rounds: parseInt(e.target.value) || 1 } : b
                              ))}
                              className="h-8 mt-1"
                              min={1}
                              max={10}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Time Cap (optional)</Label>
                            <Input
                              value={block.targetTime || ''}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, targetTime: e.target.value } : b
                              ))}
                              className="h-8 mt-1"
                              placeholder="15min"
                            />
                          </div>
                        </div>
                      )}
                      
                      {block.circuitStyle === 'tabata' && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Rounds</Label>
                            <Input
                              type="number"
                              value={block.rounds || 8}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, rounds: parseInt(e.target.value) || 1 } : b
                              ))}
                              className="h-8 mt-1"
                              min={1}
                              max={20}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Work</Label>
                            <Input
                              value={block.workInterval || '20s'}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, workInterval: e.target.value } : b
                              ))}
                              className="h-8 mt-1"
                              placeholder="20s"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Rest</Label>
                            <Input
                              value={block.restInterval || '10s'}
                              onChange={(e) => setBlocks(blocks.map(b => 
                                b.id === block.id ? { ...b, restInterval: e.target.value } : b
                              ))}
                              className="h-8 mt-1"
                              placeholder="10s"
                            />
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-orange-500/10">
                        {block.circuitStyle === 'amrap' && `⏱️ ${block.targetTime || '10min'} AMRAP`}
                        {block.circuitStyle === 'emom' && `⏱️ ${block.rounds || 10} minute EMOM`}
                        {block.circuitStyle === 'forTime' && `🏁 ${block.rounds || 3} rounds for time${block.targetTime ? ` (${block.targetTime} cap)` : ''}`}
                        {block.circuitStyle === 'tabata' && `⚡ ${block.rounds || 8} rounds: ${block.workInterval || '20s'} work / ${block.restInterval || '10s'} rest`}
                        {(!block.circuitStyle || block.circuitStyle === 'rounds') && `🔄 ${block.rounds || 3} rounds × ${block.roundDuration || '5min'} = ~${((block.rounds || 3) * 5)} min`}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {block.exercises.map((exercise, idx) => (
                      <div
                        key={exercise.id}
                        className="flex items-center gap-2 p-3 bg-background/50 rounded-lg"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{exercise.exerciseName}</p>
                            <ExerciseHowTo exerciseId={exercise.exerciseId} exerciseName={exercise.exerciseName} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {block.type === 'circuit' 
                              ? `${exercise.reps}${exercise.repType === 'time' ? '' : ' reps'}`
                              : `${exercise.sets} × ${exercise.reps}${exercise.repType === 'time' ? '' : ' reps'} • ${exercise.rest} rest`
                            }
                            {exercise.repType === 'time' && <span className="ml-1 text-blue-400">(timed)</span>}
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
                            className="pl-9 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="h-40">
                          <div className="space-y-1">
                            {filteredExercises.length === 0 && exerciseSearch.trim() ? (
                              <div className="text-center py-4">
                                <p className="text-sm text-muted-foreground mb-2">No exercises found</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-sky-500/50 text-sky-400"
                                  onClick={() => {
                                    setPendingBlockId(block.id);
                                    setCustomExerciseName(exerciseSearch);
                                    setShowCreateExerciseDialog(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Create "{exerciseSearch}"
                                </Button>
                              </div>
                            ) : (
                              <>
                                {filteredExercises.map((ex) => {
                                  const count = exerciseUsageCounts[ex.id] || 0;
                                  return (
                                    <Button
                                      key={ex.id}
                                      variant="ghost"
                                      className="w-full justify-start h-auto py-2"
                                      onClick={() => addExercise(block.id, ex as typeof COMMON_EXERCISES[0])}
                                    >
                                      <ExerciseImage exerciseId={ex.id} size="sm" className="!w-8 !h-8 !rounded-md mr-2 flex-shrink-0" />
                                      <div className="text-left flex-1">
                                        <p className="font-medium text-sm">{ex.name} {(ex as any).isCustom && <span className="text-xs text-sky-400">(custom)</span>}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{ex.pattern}</p>
                                      </div>
                                      {count > 0 && (
                                        <Badge variant="secondary" className="text-xs bg-sky-500/20 text-sky-400 ml-1">{count}×</Badge>
                                      )}
                                    </Button>
                                  );
                                })}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-sky-400 hover:text-sky-300"
                                  onClick={() => {
                                    setPendingBlockId(block.id);
                                    setShowCreateExerciseDialog(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Create Custom Exercise
                                </Button>
                              </>
                            )}
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
                                    <p className="text-xs text-muted-foreground capitalize">
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={exerciseSearch}
                          onChange={(e) => setExerciseSearch(e.target.value)}
                          placeholder="Search all exercises..."
                          className="pl-9 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
                        />
                      </div>
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {filterExercisesBySearch(allExercises, exerciseSearch)
                          .filter(ex => ex.id !== editingExercise.exercise.exerciseId)
                          .map(ex => {
                            const libEntry = exerciseLibraryMap.get(ex.id);
                            return (
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
                                  <p className="text-xs text-muted-foreground capitalize">
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

              {/* Check if this is a cardio exercise - use pattern check */}
              {(editingExercise.exercise.movementPattern as string) === 'cardio' || (editingExercise.exercise as any).isCardio ? (
                /* CARDIO-SPECIFIC UI */
                <div className="space-y-4">
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-sm text-orange-400 font-medium">🏃 Cardio Exercise</p>
                    <p className="text-xs text-muted-foreground mt-1">Configure distance, time, or intervals for this cardio activity</p>
                  </div>
                  
                  {/* Cardio Type Selection */}
                  <div>
                    <Label className="mb-2 block">Cardio Mode</Label>
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
                        <Label>Distance</Label>
                        <Input
                          value={(editingExercise.exercise as any).distance || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, distance: e.target.value } as any
                          })}
                          placeholder="e.g., 5"
                        />
                      </div>
                      <div>
                        <Label>Unit</Label>
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
                        <Label>Target Time (optional)</Label>
                        <Input
                          value={(editingExercise.exercise as any).targetTime || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, targetTime: e.target.value } as any
                          })}
                          placeholder="e.g., 25:00 or leave blank to just time"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Time Only Mode */}
                  {(editingExercise.exercise as any).cardioType === 'time' && (
                    <div>
                      <Label>Duration</Label>
                      <Input
                        value={(editingExercise.exercise as any).targetTime || ''}
                        onChange={(e) => setEditingExercise({
                          ...editingExercise,
                          exercise: { ...editingExercise.exercise, targetTime: e.target.value } as any
                        })}
                        placeholder="e.g., 30:00, 1:00:00, or leave blank to free run"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave blank to start a timer and stop when done
                      </p>
                    </div>
                  )}
                  
                  {/* Intervals Mode */}
                  {(editingExercise.exercise as any).cardioType === 'intervals' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Intervals</Label>
                        <Input
                          type="number"
                          value={(editingExercise.exercise as any).intervals || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, intervals: parseInt(e.target.value) || 0 } as any
                          })}
                          placeholder="e.g., 8"
                        />
                      </div>
                      <div>
                        <Label>Work (distance or time)</Label>
                        <Input
                          value={(editingExercise.exercise as any).intervalWork || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, intervalWork: e.target.value } as any
                          })}
                          placeholder="e.g., 400m or 1min"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Rest Between Intervals</Label>
                        <Input
                          value={(editingExercise.exercise as any).intervalRest || ''}
                          onChange={(e) => setEditingExercise({
                            ...editingExercise,
                            exercise: { ...editingExercise.exercise, intervalRest: e.target.value } as any
                          })}
                          placeholder="e.g., 90s or 2min"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Notes for cardio */}
                  <div>
                    <Label>Notes (optional)</Label>
                    <Input
                      value={editingExercise.exercise.notes || ''}
                      onChange={(e) => setEditingExercise({
                        ...editingExercise,
                        exercise: { ...editingExercise.exercise, notes: e.target.value }
                      })}
                      placeholder="e.g., incline 5%, zone 2 pace..."
                    />
                  </div>
                </div>
              ) : (
              /* STRENGTH EXERCISE UI */
              <>
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
                          ? 'bg-sky-500 border-sky-500 text-white' 
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
              
              {/* Reps vs Time Toggle */}
              <div>
                <Label className="mb-2 block">Measurement Type</Label>
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
                <p className="text-xs text-muted-foreground mt-1">
                  {editingExercise.exercise.repType === 'time' 
                    ? 'Use for cardio, holds, stretches (e.g., 30s, 1min, 5min)'
                    : 'Standard repetition counting'
                  }
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
                  <Label>{editingExercise.exercise.repType === 'time' ? 'Duration' : 'Reps'} {editingExercise.exercise.setStyle !== 'fixed' && '(per set)'}</Label>
                  <Input
                    value={editingExercise.exercise.reps}
                    placeholder={editingExercise.exercise.repType === 'time' ? '30s' : (editingExercise.exercise.setStyle === 'pyramid' ? '12→10→8→6' : '8-12')}
                    onChange={(e) => setEditingExercise({
                      ...editingExercise,
                      exercise: { ...editingExercise.exercise, reps: e.target.value }
                    })}
                  />
                  {editingExercise.exercise.setStyle === 'pyramid' && (
                    <p className="text-xs text-muted-foreground mt-1">Use → to separate reps per set</p>
                  )}
                </div>
                <div>
                  <Label>Rest</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {REST_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        type="button"
                        variant={editingExercise.exercise.rest === `${preset.value}s` ? 'default' : 'outline'}
                        size="sm"
                        className={`text-xs h-6 px-2 ${editingExercise.exercise.rest === `${preset.value}s` ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
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

              <div>
                <Label className="mb-2 block">Tempo</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {Object.entries(TEMPO_PRESETS).map(([key, preset]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={editingExercise.exercise.tempo === preset.tempo.join('') ? 'default' : 'outline'}
                      size="sm"
                      className={`text-xs h-7 ${editingExercise.exercise.tempo === preset.tempo.join('') ? 'bg-sky-500 hover:bg-sky-600' : ''}`}
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
                    className={`text-xs h-7 ${!editingExercise.exercise.tempo ? 'bg-gray-600' : ''}`}
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
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editingExercise.exercise.tempo 
                    ? `${editingExercise.exercise.tempo[0] || 0}s down, ${editingExercise.exercise.tempo[1] || 0}s pause, ${editingExercise.exercise.tempo[2] || 0}s up, ${editingExercise.exercise.tempo[3] || 0}s top`
                    : 'Eccentric-pause-concentric-pause (affects time estimate)'}
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
              </>
              )}

              <Button onClick={saveExerciseEdit} className="w-full bg-sky-500 hover:bg-sky-600">
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {blocks.length} block{blocks.length !== 1 ? 's' : ''} • {' '}
                {blocks.reduce((acc, b) => acc + b.exercises.length, 0)} exercises
              </p>
            </div>
            {blocks.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 rounded-lg border border-sky-500/20">
                <Clock className="h-4 w-4 text-sky-400" />
                <div className="text-sm">
                  <span className="font-semibold text-sky-400">~{estimatedDuration} min</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({Math.round(workoutEstimate.workSeconds / 60)}m work, {Math.round(workoutEstimate.restSeconds / 60)}m rest)
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isEditMode && (
              <Button 
                variant="destructive"
                size="lg"
                onClick={handleDeleteAndRestart}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete & Restart
              </Button>
            )}
            <Button 
              onClick={handleSave} 
              size="lg"
              disabled={blocks.length === 0}
            >
              <Save className="h-4 w-4 mr-2" /> {isEditMode ? 'Update Workout' : 'Save & Link to Session'}
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Options Dialog - shown when entering edit mode */}
      <Dialog open={showEditOptionsDialog} onOpenChange={setShowEditOptionsDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>Edit Workout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-muted-foreground">
              You're editing an existing workout: <strong>{existingWorkout?.name}</strong>
            </p>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => setShowEditOptionsDialog(false)}
                className="w-full bg-sky-500 hover:bg-sky-600"
              >
                <Edit2 className="h-4 w-4 mr-2" /> Continue Editing
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteAndRestart}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete & Start Fresh
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.back()}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workout Library Dialog */}
      <Dialog open={showLibraryDialog} onOpenChange={setShowLibraryDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>📚 Workout Library</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {workoutLibrary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No saved workouts yet.</p>
                <p className="text-sm mt-2">Save workouts to your library to reuse them later!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workoutLibrary.map((workout) => (
                  <Card 
                    key={workout.id} 
                    className="bg-gray-800 border-gray-700 cursor-pointer hover:border-sky-500/50 transition-colors"
                    onClick={() => handleLoadFromLibrary(workout)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-white">{workout.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {workout.blocks?.length || 0} blocks • ~{workout.estimatedMinutes || '?'} min
                          </p>
                          {workout.tags && workout.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {workout.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="ghost">
                          Load
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Save to Library Dialog */}
      <Dialog open={showSaveToLibraryDialog} onOpenChange={setShowSaveToLibraryDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>💾 Save to Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Workout Name</Label>
              <Input
                value={libraryWorkoutName}
                onChange={(e) => setLibraryWorkoutName(e.target.value)}
                placeholder="e.g., Upper Body Push Day"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={libraryWorkoutTags}
                onChange={(e) => setLibraryWorkoutTags(e.target.value)}
                placeholder="e.g., upper, push, intermediate"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tags help you organize and find workouts later
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSaveToLibraryDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveToLibrary}
                className="flex-1 bg-sky-500 hover:bg-sky-600"
              >
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Circuit Template Dialog */}
      <Dialog open={showSaveCircuitDialog} onOpenChange={setShowSaveCircuitDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>💾 Save Circuit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Circuit Name</Label>
              <Input
                value={circuitTemplateName}
                onChange={(e) => setCircuitTemplateName(e.target.value)}
                placeholder="e.g., HIIT Finisher, Core Burner"
                className="mt-2"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Save this circuit to reuse it in future workouts
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowSaveCircuitDialog(false);
                  setActiveCircuitBlockId(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveCircuitTemplate}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                <Save className="h-4 w-4 mr-2" /> Save Circuit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Circuit Library Dialog */}
      <Dialog open={showCircuitLibraryDialog} onOpenChange={(open) => {
        setShowCircuitLibraryDialog(open);
        if (!open) setActiveCircuitBlockId(null);
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>📚 Circuit Library</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {circuitLibrary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No saved circuits yet.</p>
                <p className="text-sm mt-2">Save circuits to reuse them in future workouts!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {circuitLibrary.map((circuit) => (
                  <Card 
                    key={circuit.id} 
                    className="bg-gray-800 border-gray-700 cursor-pointer hover:border-orange-500/50 transition-colors"
                    onClick={() => handleLoadCircuitTemplate(circuit)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-white">{circuit.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {circuit.exercises?.length || 0} exercises • {circuit.circuitStyle} • {circuit.rounds || '?'} rounds
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-orange-400">
                          Load
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
                {[...new Set(savedBlocks.map(b => b.folder).filter(Boolean))].map(f => (
                  <option key={f} value={f} />
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
              A block named "{blockLibraryName}" already exists in your library. Would you like to replace it with this new version?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={handleCancelReplace}
              className="flex-1"
            >
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
      <Dialog open={showBlockLibraryDialog} onOpenChange={(open) => {
        setShowBlockLibraryDialog(open);
        if (!open) { setBlockLibraryFilter('all'); setBlockFolderFilter('all'); setBlockLibrarySearch(''); }
      }}>
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
            const folders = [...new Set(savedBlocks.map(b => b.folder).filter(Boolean))] as string[];
            return folders.length > 0 ? (
              <div className="flex gap-1.5 mb-2 flex-wrap">
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
                {folders.map(f => (
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
            ) : null;
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
              onChange={e => setBlockLibrarySearch(e.target.value)}
              placeholder="Search blocks or exercises..."
              className="bg-gray-800 border-gray-700 text-white pl-10 text-sm"
            />
          </div>
          <ScrollArea className="h-[400px] pr-4">
            {savedBlocks.filter(b => 
              (blockLibraryFilter === 'all' || b.type === blockLibraryFilter) &&
              (blockFolderFilter === 'all' || (blockFolderFilter === '' ? !b.folder : b.folder === blockFolderFilter)) &&
              (!blockLibrarySearch.trim() || b.name.toLowerCase().includes(blockLibrarySearch.toLowerCase()) || b.exercises.some(e => (e.exerciseName || '').toLowerCase().includes(blockLibrarySearch.toLowerCase())))
            ).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No saved blocks yet.</p>
                <p className="text-sm mt-2">Save blocks from your workouts to reuse them!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedBlocks
                  .filter(b => 
                    (blockLibraryFilter === 'all' || b.type === blockLibraryFilter) &&
                    (blockFolderFilter === 'all' || (blockFolderFilter === '' ? !b.folder : b.folder === blockFolderFilter)) &&
                    (!blockLibrarySearch.trim() || b.name.toLowerCase().includes(blockLibrarySearch.toLowerCase()) || b.exercises.some(e => (e.exerciseName || '').toLowerCase().includes(blockLibrarySearch.toLowerCase())))
                  )
                  .map((block) => {
                    const blockStyle = getBlockStyles(block.type);
                    // Get client's performance history for this block
                    const clientPerfs = clientId ? blockPerformances.filter(p => p.blockId === block.id && p.clientId === clientId) : [];
                    const bestPerf = clientId ? getBestBlockPerformance(block.id, clientId) : undefined;
                    const lastPerf = clientPerfs.length > 0 ? clientPerfs.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0] : undefined;
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
                                {BLOCK_TYPES.find(t => t.value === block.type)?.icon}
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
                              {/* Show client's previous and best times for circuits */}
                              {clientId && block.type === 'circuit' && (lastPerf || bestPerf) && (
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBlockToDelete(block);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {/* Exercise Preview */}
                          {previewBlockId === block.id && block.exercises && block.exercises.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                              {block.exercises.map((ex, idx) => (
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

      {/* Block Type Selection Dialog */}
      <Dialog open={showBlockTypeDialog} onOpenChange={(open) => {
        setShowBlockTypeDialog(open);
        if (!open) setSelectedBlockType(null);
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedBlockType && BLOCK_TYPES.find(t => t.value === selectedBlockType)?.icon}
              Add {selectedBlockType && BLOCK_TYPES.find(t => t.value === selectedBlockType)?.label} Block
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 border-gray-700"
              onClick={() => selectedBlockType && addEmptyBlock(selectedBlockType)}
            >
              <div className="flex items-center gap-3">
                <Plus className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="font-medium">Empty Block</p>
                  <p className="text-xs text-muted-foreground">Start fresh with no exercises</p>
                </div>
              </div>
            </Button>
            
            {selectedBlockType && savedBlocks.filter(b => b.type === selectedBlockType).length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-gray-900 px-2 text-muted-foreground">or choose from library</span>
                  </div>
                </div>
                
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {savedBlocks.filter(b => b.type === selectedBlockType).map((block) => {
                      const blockStyle = getBlockStyles(block.type);
                      // Get client's performance history for this block
                      const clientPerfs = clientId ? blockPerformances.filter(p => p.blockId === block.id && p.clientId === clientId) : [];
                      const bestPerf = clientId ? getBestBlockPerformance(block.id, clientId) : undefined;
                      const lastPerf = clientPerfs.length > 0 ? clientPerfs.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0] : undefined;
                      return (
                        <div key={block.id} className={`rounded-lg border ${blockStyle.border} overflow-hidden`}>
                          <Button
                            variant="outline"
                            className={`w-full justify-start h-auto py-3 border-0 hover:${blockStyle.bg}`}
                            onClick={() => {
                              handleLoadBlock(block);
                              setShowBlockTypeDialog(false);
                              setSelectedBlockType(null);
                            }}
                          >
                            <div className="flex items-center gap-3 w-full">
                              {BLOCK_TYPES.find(t => t.value === block.type)?.icon}
                              <div className="text-left flex-1">
                                <p className="font-medium">{block.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {block.exercises?.length || 0} exercises
                                  {block.circuitRounds && ` • ${block.circuitRounds} rounds`}
                                </p>
                                {/* Show client's previous and best times for circuits */}
                                {clientId && block.type === 'circuit' && (lastPerf || bestPerf) && (
                                  <div className="flex gap-3 mt-1">
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
                              <button
                                type="button"
                                className="p-1.5 rounded text-sky-400 hover:bg-sky-500/15 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setPreviewBlockId(previewBlockId === block.id ? null : block.id);
                                }}
                              >
                                {previewBlockId === block.id ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </Button>
                          {/* Exercise Preview */}
                          {previewBlockId === block.id && block.exercises && block.exercises.length > 0 && (
                            <div className="px-4 pb-3 pt-1 border-t border-slate-700/50 space-y-1.5">
                              {block.exercises.map((ex, idx) => (
                                <div key={ex.id} className="flex items-center justify-between text-xs py-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 w-4">{idx + 1}.</span>
                                    <span className="text-slate-300">{ex.exerciseName}</span>
                                  </div>
                                  <span className="text-slate-500">
                                    {ex.sets} × {ex.reps}{ex.repType === 'time' ? '' : ' reps'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Custom Exercise Dialog */}
      <Dialog open={showCreateExerciseDialog} onOpenChange={setShowCreateExerciseDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>✨ Create Custom Exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Exercise Name</Label>
              <Input
                value={customExerciseName}
                onChange={(e) => setCustomExerciseName(e.target.value)}
                placeholder="e.g., Band Pull-Aparts, Sled Push"
                className="mt-2"
                autoFocus
              />
            </div>
            <div>
              <Label>Exercise Type</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={customExerciseType === 'normal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCustomExerciseType('normal')}
                  className="flex-1"
                >
                  💪 Strength
                </Button>
                <Button
                  variant={customExerciseType === 'cardio' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCustomExerciseType('cardio')}
                  className="flex-1"
                >
                  🏃 Cardio
                </Button>
                <Button
                  variant={customExerciseType === 'stretch' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCustomExerciseType('stretch')}
                  className="flex-1"
                >
                  🧘 Stretch
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {customExerciseType === 'cardio' 
                  ? 'Cardio exercises default to time-based sets (e.g., 30s)'
                  : customExerciseType === 'stretch'
                  ? 'Stretch exercises default to timed holds with start/stop timer'
                  : 'Strength exercises default to rep-based sets (e.g., 8-12 reps)'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateExerciseDialog(false);
                  setCustomExerciseName('');
                  setPendingBlockId(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateCustomExercise}
                className="flex-1 bg-sky-500 hover:bg-sky-600"
              >
                <Plus className="h-4 w-4 mr-2" /> Create Exercise
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Select from Program Dialog */}
      <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Select from Program</DialogTitle>
            <DialogDescription className="text-gray-400">
              Load a workout day from {clientDisplayName || 'client'}&apos;s active program
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2">
              {(() => {
                const program = selectedClientId ? getActiveProgram(selectedClientId) : null;
                if (!program) return <p className="text-sm text-gray-500 text-center py-4">No active program</p>;
                return program.weeklyPlan.map((day: any, idx: number) => {
                  const exerciseCount = day.blocks?.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0) || 0;
                  return (
                    <button
                      key={idx}
                      className="w-full text-left p-3 rounded-lg border border-gray-700 hover:border-sky-500/50 hover:bg-gray-800 transition-colors"
                      onClick={() => {
                        if (!day.blocks || day.blocks.length === 0) {
                          toast.error('This day has no exercises');
                          return;
                        }
                        const programBlocks: WorkoutBlock[] = day.blocks.map((block: any) => ({
                          id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          type: block.type || 'work',
                          name: block.name || 'Main Lifts',
                          exercises: (block.exercises || []).map((ex: any) => ({
                            id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            exerciseId: ex.exerciseId,
                            exerciseName: ex.exerciseName,
                            movementPattern: ex.movementPattern || 'compound',
                            sets: ex.sets || 3,
                            reps: ex.reps || '8-12',
                            repType: ex.repType || 'reps',
                            rest: ex.rest || '60s',
                            setStyle: ex.setStyle || 'fixed',
                            tempo: ex.tempo,
                            notes: ex.notes,
                          })),
                        }));
                        setBlocks(programBlocks);
                        setWorkoutName(`${day.dayLabel} - ${program.templateName}`);
                        setShowProgramDialog(false);
                        toast.success(`Loaded "${day.dayLabel}" from program`);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{day.dayLabel}</p>
                          <p className="text-xs text-gray-400">{exerciseCount} exercises</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </div>
                      {day.blocks?.map((block: any, bIdx: number) => (
                        <div key={bIdx} className="mt-1.5">
                          {block.exercises?.slice(0, 3).map((ex: any, eIdx: number) => (
                            <p key={eIdx} className="text-[11px] text-gray-500 pl-2">
                              • {ex.exerciseName} — {ex.sets}×{ex.reps}
                            </p>
                          ))}
                          {(block.exercises?.length || 0) > 3 && (
                            <p className="text-[10px] text-gray-600 pl-2">+{block.exercises.length - 3} more</p>
                          )}
                        </div>
                      ))}
                    </button>
                  );
                });
              })()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
