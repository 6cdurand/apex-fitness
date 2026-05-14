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

/**
 * Like getLastSetForExercise but returns the historical set at a SPECIFIC
 * set INDEX from the most-recent completed workout. Used when the user
 * presses "Add set" mid-workout so the new set carries forward the
 * previous workout's values at that same set position.
 */
export function getLastSetForExerciseAtIndex(
  workoutHistory: Workout[],
  exerciseId: string,
  userId: string,
  setIndex: number,
): LastSetData | undefined {
  const normalizedId = normalizeExerciseId(exerciseId || '');
  const candidates = getRecentCompletedWorkouts(workoutHistory, userId);

  for (const workout of candidates) {
    const matchingEx = workout.exercises?.find(e =>
      normalizeExerciseId(e.exerciseId || '') === normalizedId
    );
    if (!matchingEx?.sets?.length || matchingEx.sets.length <= setIndex) continue;
    const historicalSet = matchingEx.sets[setIndex];
    if (historicalSet?.completed && historicalSet.weight && historicalSet.reps) {
      return {
        weight: historicalSet.weight,
        reps: historicalSet.reps,
        workoutId: workout.id,
        workoutDate: workout.endTime || workout.startTime || '',
      };
    }
  }
  return undefined;
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
