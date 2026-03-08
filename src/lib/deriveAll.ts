/**
 * deriveAll Pipeline — Single Source of Truth
 * 
 * Centralized recomputation of all derived data after workout save/edit/delete:
 * - Personal Bests (PBs)
 * - Medals (workout count, volume, cardio, circuit, stretch)
 * - Strength Ratings
 * - Volume Rollups (per-session, per-exercise, lifetime, by muscle group)
 * 
 * Called from: completeWorkout, editWorkout, deleteWorkout
 */

import { Workout, PersonalBest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { isAssistedExercise } from './exercises';

// ============ TYPES ============

export interface VolumeRollup {
  userId: string;
  totalLifetime: number;
  byMuscleGroup: Record<string, number>;
  weeklyVolume: { weekStart: string; volume: number }[];
  monthlyVolume: { month: string; volume: number }[];
  perExercise: Record<string, number>;
  lastUpdated: string;
}

export interface DeriveResult {
  personalBests: PersonalBest[];
  medalsAwarded: string[];
  volumeRollup: VolumeRollup;
  strengthRatingUpdated: boolean;
}

// ============ 1RM CALCULATION ============

function calculate1RM(weight: number, reps: number): number | null {
  if (reps <= 0 || weight <= 0) return null;
  if (reps > 20) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// ============ PB RECOMPUTATION ============

export function recomputePBs(
  workouts: Workout[],
  userId: string,
  normalizeExerciseId: (id: string) => string
): PersonalBest[] {
  const pbMap: Record<string, PersonalBest> = {};

  workouts
    .filter(w => w.userId === userId && w.status === 'completed' && !w.deletedAt)
    .forEach(workout => {
      workout.exercises?.forEach(ex => {
        const rawId = ex.exerciseId || (ex.exercise as any)?.name || '';
        const exerciseId = normalizeExerciseId(rawId);
        if (!exerciseId) return;

        const isAssisted = isAssistedExercise(exerciseId, ex.exercise?.name);

        // Best set by 1RM (or lowest weight for assisted exercises)
        ex.sets?.filter(s => s.completed && s.weight && s.reps).forEach(set => {
          const oneRepMax = calculate1RM(set.weight!, set.reps!);
          if (oneRepMax === null) return;

          const existing = pbMap[exerciseId];
          
          // For assisted: lower weight = better (less assistance needed)
          // For normal: higher 1RM = better
          const isBetter = isAssisted
            ? (!existing || set.weight! < existing.bestWeight)
            : (!existing || oneRepMax > existing.oneRepMax);

          if (isBetter) {
            pbMap[exerciseId] = {
              id: existing?.id || uuidv4(),
              exerciseId,
              userId,
              bestWeight: set.weight!,
              bestReps: set.reps!,
              oneRepMax: isAssisted ? set.weight! : oneRepMax,
              bestVolume: 0,
              achievedAt: workout.endTime || workout.startTime || new Date().toISOString(),
              workoutId: workout.id,
            };
          }
        });

        // Best single-exercise volume (skip for assisted — counterbalance isn't work)
        if (!isAssisted) {
          const exerciseVolume = (ex.sets || [])
            .filter(s => s.completed && s.weight && s.reps)
            .reduce((sum, s) => sum + (s.weight! * s.reps!), 0);

          if (exerciseVolume > 0 && pbMap[exerciseId]) {
            if (exerciseVolume > pbMap[exerciseId].bestVolume) {
              pbMap[exerciseId].bestVolume = exerciseVolume;
            }
          }
        }
      });
    });

  return Object.values(pbMap);
}

// ============ VOLUME ROLLUPS ============

export function computeVolumeRollup(
  workouts: Workout[],
  userId: string
): VolumeRollup {
  const userWorkouts = workouts.filter(w => w.userId === userId && w.status === 'completed' && !w.deletedAt);

  let totalLifetime = 0;
  const byMuscleGroup: Record<string, number> = {};
  const perExercise: Record<string, number> = {};
  const weeklyMap: Record<string, number> = {};
  const monthlyMap: Record<string, number> = {};

  userWorkouts.forEach(workout => {
    const sessionVolume = workout.totalVolume || 0;
    totalLifetime += sessionVolume;

    // Weekly rollup
    const d = new Date(workout.startTime);
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday start
    const weekStart = new Date(d.setDate(diff)).toISOString().slice(0, 10);
    weeklyMap[weekStart] = (weeklyMap[weekStart] || 0) + sessionVolume;

    // Monthly rollup
    const month = new Date(workout.startTime).toISOString().slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + sessionVolume;

    // Per-exercise and per-muscle-group volume
    workout.exercises?.forEach(ex => {
      const exId = ex.exerciseId || '';
      const vol = (ex.sets || [])
        .filter(s => s.completed && s.weight && s.reps)
        .reduce((sum, s) => sum + (s.weight! * s.reps!), 0);

      if (vol > 0) {
        perExercise[exId] = (perExercise[exId] || 0) + vol;

        // Muscle group attribution
        const muscles = (ex.exercise as any)?.primaryMuscles || [];
        muscles.forEach((mg: string) => {
          byMuscleGroup[mg] = (byMuscleGroup[mg] || 0) + vol;
        });
      }
    });
  });

  const weeklyVolume = Object.entries(weeklyMap)
    .map(([weekStart, volume]) => ({ weekStart, volume }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, 52); // Last 52 weeks

  const monthlyVolume = Object.entries(monthlyMap)
    .map(([month, volume]) => ({ month, volume }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12); // Last 12 months

  return {
    userId,
    totalLifetime,
    byMuscleGroup,
    weeklyVolume,
    monthlyVolume,
    perExercise,
    lastUpdated: new Date().toISOString(),
  };
}

// ============ MEDAL CHECKS ============

export interface MedalCheckerDeps {
  hasMedal: (id: string, userId: string) => boolean;
  earnMedal: (id: string, userId: string) => void;
  revokeMedalsForUser?: (userId: string) => void;
  normalizeExerciseId?: (id: string) => string;
}

export function checkAllMedals(
  workouts: Workout[],
  userId: string,
  completedWorkout: Workout | null,
  deps: MedalCheckerDeps
): string[] {
  const awarded: string[] = [];
  const { hasMedal, earnMedal, revokeMedalsForUser, normalizeExerciseId } = deps;

  // On deletion/edit recompute (no completedWorkout), revoke all medals first
  // then re-earn only what the current data supports
  if (!completedWorkout && revokeMedalsForUser) {
    revokeMedalsForUser(userId);
  }

  const userWorkouts = workouts.filter(w => w.userId === userId && w.status === 'completed' && !w.deletedAt);
  const workoutCount = userWorkouts.length;

  const award = (id: string) => {
    if (!hasMedal(id, userId)) {
      earnMedal(id, userId);
      awarded.push(id);
    }
  };

  // --- Workout count medals (cascade) ---
  if (workoutCount >= 100) { award('centurion'); award('committed'); award('dedicated'); award('getting-started'); award('first-blood'); }
  else if (workoutCount >= 50) { award('committed'); award('dedicated'); award('getting-started'); award('first-blood'); }
  else if (workoutCount >= 25) { award('dedicated'); award('getting-started'); award('first-blood'); }
  else if (workoutCount >= 5) { award('getting-started'); award('first-blood'); }
  else if (workoutCount >= 1) { award('first-blood'); }

  // --- Volume medals (cascade) ---
  const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  if (totalVolume >= 100000) { award('volume-100k'); award('volume-50k'); award('volume-10k'); }
  else if (totalVolume >= 50000) { award('volume-50k'); award('volume-10k'); }
  else if (totalVolume >= 10000) { award('volume-10k'); }

  // --- Cardio medals ---
  let totalCardioBlocks = 0;
  userWorkouts.forEach(w => {
    const blocks = (w as any).blocks || [];
    const exTypes = (w.exercises || []).map((ex: any) => ex.blockType).filter(Boolean);
    if (blocks.some((b: any) => b.type === 'cardio') || exTypes.includes('cardio')) totalCardioBlocks++;
  });
  if (totalCardioBlocks >= 100) { award('cardio-100'); award('cardio-50'); award('cardio-10'); award('cardio-first'); }
  else if (totalCardioBlocks >= 50) { award('cardio-50'); award('cardio-10'); award('cardio-first'); }
  else if (totalCardioBlocks >= 10) { award('cardio-10'); award('cardio-first'); }
  else if (totalCardioBlocks >= 1) { award('cardio-first'); }

  // Cardio duration medals (from latest workout)
  if (completedWorkout) {
    const durationMinutes = (completedWorkout.duration || 0) / 60;
    const hasCardio = ((completedWorkout as any).blocks || []).some((b: any) => b.type === 'cardio') ||
      completedWorkout.exercises.some((ex: any) => ex.blockType === 'cardio');
    if (hasCardio) {
      if (durationMinutes >= 60) award('cardio-60min');
      if (durationMinutes >= 30) award('cardio-30min');
    }
  }

  // --- Stretch medals ---
  let totalStretchBlocks = 0;
  userWorkouts.forEach(w => {
    const blocks = (w as any).blocks || [];
    const exTypes = (w.exercises || []).map((ex: any) => ex.blockType).filter(Boolean);
    const hasStretch = blocks.some((b: any) => b.type === 'cooldown') || exTypes.includes('cooldown') ||
      (w.exercises || []).some((ex: any) => (ex.exercise as any)?.category === 'stretching');
    if (hasStretch) totalStretchBlocks++;
  });
  if (totalStretchBlocks >= 50) award('stretch-50');
  if (totalStretchBlocks >= 10) award('stretch-10');
  if (totalStretchBlocks >= 1) award('stretch-first');

  // --- Circuit medals ---
  let totalCircuitBlocks = 0;
  let totalAmraps = 0;
  let totalEmoms = 0;
  userWorkouts.forEach(w => {
    const blocks = (w as any).blocks || [];
    blocks.forEach((b: any) => {
      if (b.type === 'circuit') {
        totalCircuitBlocks++;
        if (b.circuitStyle === 'amrap') totalAmraps++;
        if (b.circuitStyle === 'emom') totalEmoms++;
      }
    });
    const exTypes = (w.exercises || []).map((ex: any) => ex.blockType).filter(Boolean);
    if (exTypes.includes('circuit') && !blocks.some((b: any) => b.type === 'circuit')) totalCircuitBlocks++;
  });
  if (totalCircuitBlocks >= 50) award('circuit-50');
  if (totalCircuitBlocks >= 10) award('circuit-10');
  if (totalCircuitBlocks >= 1) award('circuit-first');
  if (totalAmraps >= 10) award('amrap-10');
  if (totalAmraps >= 1) award('amrap-first');
  if (totalEmoms >= 10) award('emom-10');
  if (totalEmoms >= 1) award('emom-first');

  // --- Powerlifting club medals (scan ALL workouts) ---
  userWorkouts.forEach(w => {
    w.exercises?.forEach(ex => {
      ex.sets?.filter(s => s.completed && s.weight).forEach(set => {
        const wt = set.weight || 0;
        if (wt >= 1000 / 2.205) award('1000lb-club');
        if (wt >= 600 / 2.205) award('600-club');
        if (wt >= 500 / 2.205) award('500-club');
        if (wt >= 400 / 2.205) award('400-club');
        if (wt >= 300 / 2.205) award('300-club');
      });
    });
  });

  // --- Exercise-specific weight milestone medals (scan ALL workouts) ---
  if (normalizeExerciseId) {
    // Build max weight per normalized exercise ID across all workout history
    const maxWeights: Record<string, number> = {};
    userWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        const nid = normalizeExerciseId(ex.exerciseId || '');
        ex.sets?.filter(s => s.completed && s.weight).forEach(s => {
          maxWeights[nid] = Math.max(maxWeights[nid] || 0, s.weight || 0);
        });
      });
    });

    const checkWeight = (ids: string[], thresholds: [number, string][]) => {
      const maxW = Math.max(...ids.map(id => maxWeights[id] || 0));
      thresholds.forEach(([threshold, medalId]) => {
        if (maxW >= threshold) award(medalId);
      });
    };

    // Bench press
    checkWeight(['bench-press', 'dumbbell-bench-press'], [
      [160, 'bench-legendary'], [130, 'bench-epic'], [100, 'bench-rare'], [70, 'bench-uncommon'], [50, 'bench-common']
    ]);
    // Squat
    checkWeight(['squat', 'back-squat', 'barbell-back-squat'], [
      [219, 'squat-legendary'], [173, 'squat-epic'], [130, 'squat-rare'], [93, 'squat-uncommon'], [64, 'squat-common']
    ]);
    // Deadlift
    checkWeight(['deadlift', 'romanian-deadlift', 'rdl'], [
      [211, 'deadlift-legendary'], [164, 'deadlift-epic'], [120, 'deadlift-rare'], [84, 'deadlift-uncommon'], [55, 'deadlift-common']
    ]);
    // Lat pulldown
    checkWeight(['lat-pulldown', 'rope-pulldown'], [
      [141, 'lat-legendary'], [110, 'lat-epic'], [82, 'lat-rare'], [58, 'lat-uncommon'], [38, 'lat-common']
    ]);
    // Row
    checkWeight(['barbell-row', 'bent-over-row', 'seated-row', 'cable-row', 'seated-cable-row', 'machine-back-row', 'row-machine'], [
      [147, 'row-legendary'], [115, 'row-epic'], [86, 'row-rare'], [61, 'row-uncommon'], [41, 'row-common']
    ]);
    // OHP
    checkWeight(['overhead-press', 'military-press', 'dumbbell-shoulder-press', 'machine-shoulder-press'], [
      [112, 'ohp-legendary'], [87, 'ohp-epic'], [64, 'ohp-rare'], [45, 'ohp-uncommon'], [30, 'ohp-common']
    ]);
    // Leg press
    checkWeight(['leg-press', 'leg-press-machine', 'leg-press-single-leg'], [
      [432, 'legpress-legendary'], [324, 'legpress-epic'], [226, 'legpress-rare'], [147, 'legpress-uncommon'], [86, 'legpress-common']
    ]);
    // Leg extension
    checkWeight(['leg-extension'], [
      [120, 'legext-legendary'], [90, 'legext-epic'], [60, 'legext-rare'], [40, 'legext-uncommon'], [20, 'legext-common']
    ]);
    // Leg curl
    checkWeight(['leg-curl', 'lying-leg-curl'], [
      [100, 'legcurl-legendary'], [75, 'legcurl-epic'], [50, 'legcurl-rare'], [35, 'legcurl-uncommon'], [20, 'legcurl-common']
    ]);
    // Chest press (machine)
    checkWeight(['machine-chest-press', 'chest-press'], [
      [100, 'chestpress-legendary'], [75, 'chestpress-epic'], [50, 'chestpress-rare'], [35, 'chestpress-uncommon'], [20, 'chestpress-common']
    ]);
    // Pull-up
    checkWeight(['pull-up', 'pull-ups', 'weighted-pull-up'], [
      [40, 'pullup-40'], [25, 'pullup-25'], [10, 'pullup-10'], [0, 'pullup-bw']
    ]);
    // T-bar row
    checkWeight(['t-bar-row', 'tbar-row', 'landmine-row'], [
      [130, 'tbar-130'], [102, 'tbar-102'], [75, 'tbar-75'], [54, 'tbar-54'], [35, 'tbar-35']
    ]);
    // DB bench
    checkWeight(['dumbbell-bench-press', 'db-bench-press', 'dumbbell-flat-bench'], [
      [44, 'dbbench-44'], [32, 'dbbench-32'], [23, 'dbbench-23'], [15, 'dbbench-15']
    ]);
    // DB shoulder press
    checkWeight(['dumbbell-shoulder-press', 'db-shoulder-press', 'seated-dumbbell-press'], [
      [38, 'dbohp-38'], [28, 'dbohp-28'], [20, 'dbohp-20'], [13, 'dbohp-13']
    ]);
    // Hip thrust
    checkWeight(['hip-thrust', 'barbell-hip-thrust', 'hip-thruster'], [
      [196, 'hipthrust-196'], [129, 'hipthrust-129'], [76, 'hipthrust-76'], [38, 'hipthrust-38']
    ]);
    // Bulgarian split squat
    checkWeight(['bulgarian-split-squat', 'split-squat', 'rear-foot-elevated-split-squat'], [
      [44, 'bss-44'], [30, 'bss-30'], [18, 'bss-18'], [10, 'bss-10']
    ]);
  }

  return awarded;
}

// ============ MAIN PIPELINE ============

export interface DeriveAllDeps {
  workouts: Workout[];
  userId: string;
  completedWorkout: Workout | null;
  normalizeExerciseId: (id: string) => string;
  medalDeps: MedalCheckerDeps;
  calculateStrengthRatingForUser: (userId: string) => void;
}

/**
 * Run the full derive pipeline for a user.
 * Call this after any workout save, edit, or delete.
 */
export function deriveAll(deps: DeriveAllDeps): DeriveResult {
  const { workouts, userId, completedWorkout, normalizeExerciseId, medalDeps, calculateStrengthRatingForUser } = deps;

  // 1. Recompute PBs
  const personalBests = recomputePBs(workouts, userId, normalizeExerciseId);

  // 2. Check medals
  const medalsAwarded = checkAllMedals(workouts, userId, completedWorkout, medalDeps);

  // 3. Volume rollups
  const volumeRollup = computeVolumeRollup(workouts, userId);

  // 4. Strength rating
  calculateStrengthRatingForUser(userId);

  console.log(`[deriveAll] userId=${userId}: ${personalBests.length} PBs, ${medalsAwarded.length} new medals, lifetime vol=${volumeRollup.totalLifetime}`);

  return {
    personalBests,
    medalsAwarded,
    volumeRollup,
    strengthRatingUpdated: true,
  };
}
