// Exercise Stats Service
// Tracks all exercise data, calculates PBs, 1RM trends, volume, and rep-range bests

import { Workout, WorkoutExercise, WorkoutSet, PersonalBest } from '@/types';
import { calculate1RM, maleTierRanges, femaleTierRanges, getTierFor1RM } from './strengthRating';

// ============ TYPES ============

export interface RepRangeBest {
  reps: number;
  weight: number;
  oneRM: number;
  date: string;
  workoutId: string;
}

export interface ExerciseSession {
  date: string;
  workoutId: string;
  sets: {
    weight: number;
    reps: number;
    oneRM: number;
    volume: number;
  }[];
  topSet: { weight: number; reps: number; oneRM: number };
  totalVolume: number;
  totalSets: number;
  isPR: boolean;
}

export interface ExerciseStatsData {
  exerciseId: string;
  exerciseName: string;
  
  // All-time bests
  allTimeBestWeight: number;
  allTimeBest1RM: number;
  allTimeBestVolume: number;
  
  // Best by rep range (1RM, 3RM, 5RM, 8RM, 10RM, 12RM)
  bestByRepRange: Record<number, RepRangeBest>;
  
  // Session history (for graphs)
  sessions: ExerciseSession[];
  
  // Trends
  oneRMTrend: { date: string; oneRM: number }[];
  volumeTrend: { date: string; volume: number }[];
  
  // Current tier (if exercise has tier data)
  currentTier?: string;
  tierProgress?: number;
  
  // Totals
  totalSessions: number;
  totalSets: number;
  totalVolume: number;
  lastPerformed?: string;
}

// ============ EXERCISE ID NORMALIZATION ============

/**
 * Normalize exercise name/ID to match tier range keys
 * This handles various naming conventions
 */
export function normalizeExerciseId(name: string): string {
  if (!name) return '';
  
  // Convert to lowercase and replace spaces/underscores with hyphens
  let normalized = name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/[()]/g, '')
    .trim();
  
  // Common aliases mapping
  const aliases: Record<string, string> = {
    'flat-bench-press': 'bench-press',
    'barbell-bench': 'bench-press',
    'bb-bench-press': 'bench-press',
    'flat-barbell-bench-press': 'bench-press',
    'dumbbell-bench': 'dumbbell-bench-press',
    'db-bench-press': 'dumbbell-bench-press',
    'db-bench': 'dumbbell-bench-press',
    'incline-barbell-bench': 'incline-bench-press',
    'incline-bb-bench': 'incline-bench-press',
    'incline-db-press': 'incline-dumbbell-press',
    'incline-dumbbell-bench': 'incline-dumbbell-press',
    'overhead-press': 'overhead-press',
    'ohp': 'overhead-press',
    'shoulder-press': 'overhead-press',
    'standing-shoulder-press': 'overhead-press',
    'db-shoulder-press': 'dumbbell-shoulder-press',
    'seated-db-shoulder-press': 'dumbbell-shoulder-press',
    'lat-pull-down': 'lat-pulldown',
    'lat-pull': 'lat-pulldown',
    'pulldown': 'lat-pulldown',
    'pull-ups': 'pull-up',
    'pullups': 'pull-up',
    'chin-ups': 'chin-up',
    'chinups': 'chin-up',
    'bb-row': 'barbell-row',
    'barbell-bent-over-row': 'barbell-row',
    'db-row': 'dumbbell-row',
    'one-arm-row': 'single-arm-dumbbell-row',
    '1-arm-row': 'single-arm-dumbbell-row',
    'conventional-deadlift': 'deadlift',
    'bb-deadlift': 'deadlift',
    'rdl': 'romanian-deadlift',
    'stiff-leg-deadlift': 'romanian-deadlift',
    'back-squat': 'squat',
    'barbell-squat': 'squat',
    'bb-squat': 'squat',
    'leg-press-machine': 'leg-press',
    'seated-leg-press': 'leg-press',
    '45-degree-leg-press': 'leg-press',
    'leg-ext': 'leg-extension',
    'leg-extensions': 'leg-extension',
    'lying-leg-curl': 'leg-curl',
    'hamstring-curl': 'leg-curl',
    'ham-curl': 'leg-curl',
    'seated-ham-curl': 'seated-leg-curl',
    'chest-dip': 'chest-dips',
    'dip': 'dips',
    'tricep-dips': 'dips',
    'weighted-dip': 'dips',
    'weighted-dips': 'dips',
    'lateral-raises': 'lateral-raise',
    'side-lateral-raise': 'lateral-raise',
    'db-lateral-raise': 'dumbbell-lateral-raise',
    'cable-lateral': 'cable-lateral-raise',
    'face-pulls': 'face-pull',
    'rear-delt-flyes': 'rear-delt-fly',
    'reverse-flyes': 'reverse-fly',
    'reverse-pec-deck': 'rear-delt-fly',
    'pec-fly': 'chest-fly',
    'pec-deck': 'machine-chest-fly',
    'cable-fly': 'chest-fly',
    'machine-fly': 'machine-chest-fly',
    'cable-crossover': 'chest-fly',
    'hip-thrusts': 'hip-thrust',
    'barbell-hip-thrust': 'hip-thrust',
    'bb-hip-thrust': 'hip-thrust',
    'glute-bridge': 'hip-thrust',
    'bulgarian-squat': 'bulgarian-split-squat',
    'bss': 'bulgarian-split-squat',
    'split-squats': 'split-squat',
    'goblet-squats': 'goblet-squat',
    'hack-squats': 'hack-squat',
    'calf-raises': 'calf-raise',
    'standing-calf-raise': 'calf-raise',
    'seated-calf-raise': 'machine-calf-raise',
    't-bar-rows': 't-bar-row',
    'cable-rows': 'cable-row',
    'seated-cable-rows': 'seated-cable-row',
    'machine-row': 'machine-back-row',
  };
  
  return aliases[normalized] || normalized;
}

// ============ CALCULATION FUNCTIONS ============

/**
 * Calculate all stats for a specific exercise from workout history
 */
export function calculateExerciseStats(
  exerciseId: string,
  workoutHistory: Workout[],
  userId: string,
  isMale: boolean = true
): ExerciseStatsData | null {
  const normalizedId = normalizeExerciseId(exerciseId);
  
  // Find all sessions containing this exercise
  const sessions: ExerciseSession[] = [];
  let allTimeBestWeight = 0;
  let allTimeBest1RM = 0;
  let allTimeBestVolume = 0;
  let totalSets = 0;
  let totalVolume = 0;
  
  const bestByRepRange: Record<number, RepRangeBest> = {};
  const oneRMHistory: { date: string; oneRM: number }[] = [];
  
  // Filter workouts for this user
  const userWorkouts = workoutHistory.filter(w => w.userId === userId);
  
  // Process each workout
  userWorkouts
    .sort((a, b) => new Date(a.startTime || a.endTime || '').getTime() - new Date(b.startTime || b.endTime || '').getTime())
    .forEach(workout => {
      const matchingExercises = workout.exercises?.filter(ex => {
        // Check multiple possible locations for exercise ID/name
        const exIdFromProp = ex.exerciseId || '';
        const exNameFromObj = ex.exercise?.name || '';
        const exNameDirect = (ex as any).exerciseName || '';
        
        const normalizedFromProp = normalizeExerciseId(exIdFromProp);
        const normalizedFromName = normalizeExerciseId(exNameFromObj);
        const normalizedDirect = normalizeExerciseId(exNameDirect);
        
        return normalizedFromProp === normalizedId || 
               normalizedFromName === normalizedId ||
               normalizedDirect === normalizedId;
      }) || [];
      
      if (matchingExercises.length === 0) return;
      
      matchingExercises.forEach(ex => {
        const completedSets = ex.sets?.filter(s => s.completed && s.weight && s.reps) || [];
        if (completedSets.length === 0) return;
        
        let sessionTopSet = { weight: 0, reps: 0, oneRM: 0 };
        let sessionVolume = 0;
        let sessionBest1RM = 0;
        
        const sessionSets = completedSets.map(set => {
          const weight = set.weight || 0;
          const reps = set.reps || 0;
          const oneRM = calculate1RM(weight, reps) || 0;
          const volume = weight * reps;
          
          sessionVolume += volume;
          totalVolume += volume;
          totalSets++;
          
          // Track all-time bests
          if (weight > allTimeBestWeight) allTimeBestWeight = weight;
          if (oneRM > allTimeBest1RM) allTimeBest1RM = oneRM;
          if (oneRM > sessionBest1RM) sessionBest1RM = oneRM;
          
          // Track best by rep range
          if (reps >= 1 && reps <= 12) {
            const existing = bestByRepRange[reps];
            if (!existing || oneRM > existing.oneRM) {
              bestByRepRange[reps] = {
                reps,
                weight,
                oneRM,
                date: workout.startTime || workout.endTime || '',
                workoutId: workout.id,
              };
            }
          }
          
          // Track top set
          if (oneRM > sessionTopSet.oneRM) {
            sessionTopSet = { weight, reps, oneRM };
          }
          
          return { weight, reps, oneRM, volume };
        });
        
        const workoutDate = workout.startTime || workout.endTime || '';
        
        // Add to 1RM trend
        if (sessionBest1RM > 0) {
          oneRMHistory.push({ date: workoutDate, oneRM: sessionBest1RM });
        }
        
        // Track session volume best
        if (sessionVolume > allTimeBestVolume) {
          allTimeBestVolume = sessionVolume;
        }
        
        sessions.push({
          date: workoutDate,
          workoutId: workout.id,
          sets: sessionSets,
          topSet: sessionTopSet,
          totalVolume: sessionVolume,
          totalSets: sessionSets.length,
          isPR: sessionTopSet.oneRM === allTimeBest1RM,
        });
      });
    });
  
  if (sessions.length === 0) return null;
  
  // Get tier info if available
  const tierRanges = isMale ? maleTierRanges : femaleTierRanges;
  const ranges = tierRanges[normalizedId];
  let currentTier: string | undefined;
  let tierProgress: number | undefined;
  
  if (ranges && allTimeBest1RM > 0) {
    currentTier = getTierFor1RM(allTimeBest1RM, normalizedId, isMale);
    // Calculate progress within tier
    const tierBounds = ranges[currentTier as keyof typeof ranges];
    if (tierBounds) {
      const [min, max] = tierBounds;
      tierProgress = max > min ? Math.min(100, ((allTimeBest1RM - min) / (max - min)) * 100) : 100;
    }
  }
  
  // Format exercise name
  const exerciseName = normalizedId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return {
    exerciseId: normalizedId,
    exerciseName,
    allTimeBestWeight,
    allTimeBest1RM,
    allTimeBestVolume,
    bestByRepRange,
    sessions,
    oneRMTrend: oneRMHistory,
    volumeTrend: sessions.map(s => ({ date: s.date, volume: s.totalVolume })),
    currentTier,
    tierProgress,
    totalSessions: sessions.length,
    totalSets,
    totalVolume,
    lastPerformed: sessions[sessions.length - 1]?.date,
  };
}

/**
 * Recalculate all PBs from workout history for a user
 * This ensures PBs are accurate even after workout deletion/editing
 */
export function recalculateAllPBs(
  workoutHistory: Workout[],
  userId: string
): PersonalBest[] {
  const pbMap: Record<string, PersonalBest> = {};
  
  workoutHistory
    .filter(w => w.userId === userId)
    .forEach(workout => {
      workout.exercises?.forEach(ex => {
        const exerciseId = normalizeExerciseId(ex.exerciseId || ex.exercise?.name || '');
        if (!exerciseId) return;
        
        ex.sets?.filter(s => s.completed && s.weight && s.reps).forEach(set => {
          const oneRM = calculate1RM(set.weight!, set.reps!);
          if (oneRM === null) return; // Skip if reps > 20
          
          const existing = pbMap[exerciseId];
          if (!existing || oneRM > existing.oneRepMax) {
            pbMap[exerciseId] = {
              id: existing?.id || `pb-${exerciseId}-${userId}`,
              exerciseId,
              userId,
              bestWeight: set.weight!,
              bestReps: set.reps!,
              oneRepMax: oneRM,
              bestVolume: 0, // Will calculate below
              achievedAt: workout.endTime || workout.startTime || new Date().toISOString(),
              workoutId: workout.id,
            };
          }
        });
      });
    });
  
  return Object.values(pbMap);
}

/**
 * Get exercise history for a specific exercise (for graphs)
 */
export function getExerciseHistory(
  exerciseId: string,
  workoutHistory: Workout[],
  userId: string
): ExerciseSession[] {
  const stats = calculateExerciseStats(exerciseId, workoutHistory, userId);
  return stats?.sessions || [];
}

/**
 * Calculate smoothed 1RM trend (7-session moving average)
 */
export function getSmoothed1RMTrend(
  sessions: ExerciseSession[],
  windowSize: number = 3
): { date: string; oneRM: number; smoothed: number }[] {
  if (sessions.length === 0) return [];
  
  const dataPoints = sessions.map(s => ({
    date: s.date,
    oneRM: s.topSet.oneRM,
    smoothed: s.topSet.oneRM,
  }));
  
  // Calculate moving average
  for (let i = 0; i < dataPoints.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = dataPoints.slice(start, i + 1);
    const avg = window.reduce((sum, d) => sum + d.oneRM, 0) / window.length;
    dataPoints[i].smoothed = Math.round(avg * 10) / 10;
  }
  
  return dataPoints;
}

/**
 * Get all exercises a user has performed with stats summary
 */
export function getAllExercisesWithStats(
  workoutHistory: Workout[],
  userId: string,
  isMale: boolean = true
): ExerciseStatsData[] {
  // Collect all unique exercise IDs
  const exerciseIds = new Set<string>();
  
  workoutHistory
    .filter(w => w.userId === userId)
    .forEach(workout => {
      workout.exercises?.forEach(ex => {
        const id = normalizeExerciseId(ex.exerciseId || ex.exercise?.name || '');
        if (id) exerciseIds.add(id);
      });
    });
  
  // Calculate stats for each exercise
  const allStats: ExerciseStatsData[] = [];
  
  exerciseIds.forEach(id => {
    const stats = calculateExerciseStats(id, workoutHistory, userId, isMale);
    if (stats) allStats.push(stats);
  });
  
  // Sort by most recent first
  return allStats.sort((a, b) => {
    if (!a.lastPerformed) return 1;
    if (!b.lastPerformed) return -1;
    return new Date(b.lastPerformed).getTime() - new Date(a.lastPerformed).getTime();
  });
}
