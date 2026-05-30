/**
 * Helpers for resolving the "previous set" / "previous workout" values
 * shown on each exercise card during an active workout.
 *
 * Replaces three buggy sites (v12-D4):
 *   - workoutStore.ts:addExercise (lines 474-485)
 *   - workoutStore.ts:addSet (lines 588-599)
 *   - app/workout/active/page.tsx (lines 3395-3400)
 *
 * The original code did `for (workout of history) ... break` without sorting
 * by date, so an old workout could surface as "previous". Three independent
 * bugs:
 *   1. No sort by completion date (workouts iterated in array order)
 *   2. No filter on status === 'completed' (drafts could match)
 *   3. No filter on !deletedAt (soft-deleted workouts scanned)
 *
 * Type fields used here:
 *   - Workout.endTime (set when workout finishes) — preferred sort key
 *   - Workout.startTime (always set on creation) — fallback sort key
 *   - Workout.status === 'completed'
 *   - Workout.deletedAt undefined or null means "active"
 */

import type { Workout } from '@/types';
import { normalizeExerciseId } from './exerciseStats';
import { calculate1RM } from './exercises';

export interface LastSetData {
  weight?: number;
  reps?: number;
  duration?: number;
  workoutId: string;
  workoutDate: string;
}

/**
 * Sort a workout-history array by recency (most recent first).
 *
 * Filters to completed and non-deleted workouts for the given user.
 * Sort key: endTime (preferred) → startTime (fallback) → '' (empty string).
 * Stable sort: ISO timestamp string comparison via localeCompare.
 */
function getRecentCompletedWorkouts(
  workoutHistory: Workout[],
  userId: string,
): Workout[] {
  return workoutHistory
    .filter(w =>
      w.userId === userId &&
      w.status === 'completed' &&
      !w.deletedAt
    )
    .sort((a, b) => {
      const aDate = a.endTime || a.startTime || '';
      const bDate = b.endTime || b.startTime || '';
      return bDate.localeCompare(aDate); // DESC — most recent first
    });
}

/**
 * Find the most-recent completed set for an exercise in a user's workout
 * history. Used when adding a fresh exercise to an active workout so the
 * "previous" values shown on each set match the LAST workout, not an
 * arbitrary older one.
 *
 * Returns undefined if no matching completed set exists.
 */
export function getLastSetForExercise(
  workoutHistory: Workout[],
  exerciseId: string,
  userId: string,
): LastSetData | undefined {
  const normalizedId = normalizeExerciseId(exerciseId || '');
  const candidates = getRecentCompletedWorkouts(workoutHistory, userId);

  for (const workout of candidates) {
    const matchingEx = workout.exercises?.find(e =>
      normalizeExerciseId(e.exerciseId || '') === normalizedId
    );
    if (!matchingEx?.sets?.length) continue;
    const completedSet = matchingEx.sets.find(s =>
      s.completed && (s.weight || s.duration)
    );
    if (completedSet) {
      return {
        weight: completedSet.weight,
        reps: completedSet.reps,
        duration: completedSet.duration,
        workoutId: workout.id,
        workoutDate: workout.endTime || workout.startTime || '',
      };
    }
  }
  return undefined;
}

export interface MostRecentExerciseData {
  /**
   * All COMPLETED sets from the most-recent workout that contains this
   * exercise, in the same order they were performed. Each `setIndex` is
   * the source position inside the original workout's `sets[]` array,
   * so callers can map a historical set to its current counterpart 1:1.
   */
  sets: Array<{
    weight?: number;
    reps?: number;
    duration?: number;
    isAssisted?: boolean;
    completed: true;
    setIndex: number;
  }>;
  workoutId: string;
  workoutDate: string;
}

/**
 * v15-D2 — single source of truth for both the "Last: ..." header strip
 * AND the per-set "PREVIOUS" column on the active-workout page.
 *
 * Returns ALL completed sets from the most-recent completed workout that
 * contains this exercise. If no historical workout matches, returns
 * undefined.
 *
 * Filters: status='completed', !deletedAt, userId match.
 * Sort: endTime DESC (falls back to startTime).
 *
 * Replaces the legacy `getLastSetForExerciseAtIndex` which fell through to
 * older workouts when the requested setIndex >= most-recent length. That
 * fallthrough caused reproduction R2 (Ab Crunch: 5 PREVIOUS rows shown for
 * a Mar 17 workout that only had 2 sets — sets 3-5 were pulling from
 * older workouts also dated Mar 17) and R3 (Leg Press: header strip and
 * per-set column disagreeing on what May 11 looked like).
 */
export function getMostRecentExerciseData(
  workoutHistory: Workout[],
  exerciseId: string,
  userId: string,
): MostRecentExerciseData | undefined {
  const normalizedId = normalizeExerciseId(exerciseId || '');
  const candidates = getRecentCompletedWorkouts(workoutHistory, userId);

  for (const workout of candidates) {
    const matchingEx = workout.exercises?.find(e =>
      normalizeExerciseId(e.exerciseId || '') === normalizedId
    );
    if (!matchingEx?.sets?.length) continue;
    const completedSets = matchingEx.sets
      .map((s: any, i: number) => ({ s, i }))
      .filter(({ s }) => s.completed && (s.weight || s.duration))
      .map(({ s, i }) => ({
        weight: s.weight,
        reps: s.reps,
        duration: s.duration,
        isAssisted: s.isAssisted,
        completed: true as const,
        setIndex: i,
      }));
    if (completedSets.length === 0) continue;
    return {
      sets: completedSets,
      workoutId: workout.id,
      workoutDate: workout.endTime || workout.startTime || '',
    };
  }
  return undefined;
}

/**
 * @deprecated v15-D2 — use `getMostRecentExerciseData` and index into
 * `.sets[]`. This wrapper preserves the call-site signature but NO LONGER
 * falls through to older workouts when the requested index is past the
 * most-recent workout's set count — that was the H1 bug behind R2/R3.
 *
 * Returns undefined when:
 *   - no historical workout contains the exercise, OR
 *   - the most-recent workout's completed-set count <= setIndex.
 */
export function getLastSetForExerciseAtIndex(
  workoutHistory: Workout[],
  exerciseId: string,
  userId: string,
  setIndex: number,
): LastSetData | undefined {
  const mostRecent = getMostRecentExerciseData(workoutHistory, exerciseId, userId);
  if (!mostRecent || setIndex >= mostRecent.sets.length) return undefined;
  const s = mostRecent.sets[setIndex];
  if (!s.weight || !s.reps) return undefined;
  return {
    weight: s.weight,
    reps: s.reps,
    workoutId: mostRecent.workoutId,
    workoutDate: mostRecent.workoutDate,
  };
}

/**
 * Find the most-recent completed WORKOUT (not just set) where the user
 * performed an exercise. Returns the full workout so the caller can compute
 * volume comparisons, see the date, etc.
 *
 * Replaces the buggy .find() at app/workout/active/page.tsx:3395-3400.
 */
export function getLastWorkoutWithExercise(
  workoutHistory: Workout[],
  exerciseId: string,
  userId: string,
): Workout | undefined {
  const normalizedId = normalizeExerciseId(exerciseId || '');
  const candidates = getRecentCompletedWorkouts(workoutHistory, userId);

  return candidates.find(w =>
    w.exercises?.some(e => normalizeExerciseId(e.exerciseId || '') === normalizedId)
  );
}

/**
 * v15-D7 — all-time-best single-set record across the user's workout history
 * for a given exercise. Used as a fallback for the Trophy "PB:" badge on
 * the active-workout exercise card when the dedicated `personal_bests`
 * lookup returns undefined.
 *
 * v16-D6: PB rule locked globally to estimated 1RM (Brzycki ≤6 reps, Epley
 * 7-20 reps, ignored for >20). Previously this fallback used raw `weight` as
 * the comparison key (with reps as tiebreaker), which would incorrectly
 * prefer 100×5 over 110×3 in some edge cases and disagreed with
 * `personal_bests` (which IS e1RM-based via workoutStore.checkAndUpdatePB).
 * Now the fallback uses `calculate1RM(weight, reps)` as the comparison key,
 * matching the authoritative store. `duration` sets are still skipped.
 *
 * Returns undefined when no completed workout contains this exercise with a
 * weight-bearing set.
 */
export function getBestExerciseRecord(
  workoutHistory: Workout[],
  exerciseId: string,
  userId: string,
): { bestWeight: number; bestReps: number; workoutId: string; workoutDate: string } | undefined {
  const normalizedId = normalizeExerciseId(exerciseId || '');
  const candidates = getRecentCompletedWorkouts(workoutHistory, userId);

  let best: { bestWeight: number; bestReps: number; workoutId: string; workoutDate: string; oneRepMax: number } | undefined;
  for (const workout of candidates) {
    const matchingEx = workout.exercises?.find(e =>
      normalizeExerciseId(e.exerciseId || '') === normalizedId,
    );
    if (!matchingEx?.sets?.length) continue;
    for (const s of matchingEx.sets) {
      if (!s.completed) continue;
      if (!s.weight || !s.reps) continue; // skip duration-only / empty
      // v16-D6: skip >20-rep sets — they don't count toward PB (parity with
      // strengthRating.calculate1RM null-clamp and personal_bests storage).
      if (s.reps > 20) continue;
      const rm = calculate1RM(s.weight, s.reps);
      if (
        !best ||
        rm > best.oneRepMax ||
        (rm === best.oneRepMax && s.weight > best.bestWeight)
      ) {
        best = {
          bestWeight: s.weight,
          bestReps: s.reps,
          workoutId: workout.id,
          workoutDate: workout.endTime || workout.startTime || '',
          oneRepMax: rm,
        };
      }
    }
  }
  if (!best) return undefined;
  // Strip oneRepMax from the return shape to preserve the public API.
  const { oneRepMax: _omit, ...publicShape } = best;
  return publicShape;
}

/**
 * v15-D7 — all-time-best workout-level volume for this exercise across the
 * user's workout history. Per-workout volume = sum(weight × reps) over all
 * completed weight-bearing sets of the exercise in that workout. Returns the
 * MAX across all matching workouts.
 *
 * Used to label the volume comparison bar as `Best: <max>kg` instead of the
 * pre-D7 `Last: <most-recent>kg` which leaked the wrong number.
 *
 * Returns 0 when no completed workout contains the exercise.
 */
export function getBestVolumeForExercise(
  workoutHistory: Workout[],
  exerciseId: string,
  userId: string,
): number {
  const normalizedId = normalizeExerciseId(exerciseId || '');
  const candidates = getRecentCompletedWorkouts(workoutHistory, userId);

  let maxVolume = 0;
  for (const workout of candidates) {
    const matchingEx = workout.exercises?.find(e =>
      normalizeExerciseId(e.exerciseId || '') === normalizedId,
    );
    if (!matchingEx?.sets?.length) continue;
    const volume = matchingEx.sets.reduce((sum: number, s: any) => {
      if (!s.completed || !s.weight || !s.reps) return sum;
      return sum + s.weight * s.reps;
    }, 0);
    if (volume > maxVolume) maxVolume = volume;
  }
  return maxVolume;
}
