/**
 * Compute the structural diff between a completed workout and the program
 * day it was launched from (D17 Part 4).
 *
 * The D15 "Save changes to program?" modal used to fire for every program
 * workout, including ones where the client did NOT edit the exercises.
 * That produced "phantom" prompts and trained users to dismiss the modal
 * reflexively. This helper lets the finish flow decide whether the
 * prompt is worth showing AT ALL by surfacing an explicit hasChanges
 * signal before any dialog is rendered.
 *
 * The diff body (added + removed exercise names) is also rendered inside
 * the modal so the user sees exactly what they're confirming instead of
 * a generic "you modified this workout" sentence.
 *
 * Keyed on exerciseId. A set/rep edit on the same exercise is NOT a
 * structural change — only ADD / REMOVE count. Matches the historic
 * diff computed inline in handleCloseSummary (see the `programEditDiff`
 * block in workout/active/page.tsx) which this helper supersedes.
 *
 * Pure — no React, no zustand, no Supabase. Unit-tested in
 * `src/lib/__tests__/programDiff.test.ts`.
 */

export interface ProgramDayDiff {
  /** Exercise names present in the completed workout but not the program template. */
  added: string[];
  /** Exercise names present in the program template but not the completed workout. */
  removed: string[];
  /** Exercise names where sets/reps/weight differ from template (D17B). */
  changed: string[];
  addedCount: number;
  removedCount: number;
  changedCount: number;
  /** Convenience: `addedCount > 0 || removedCount > 0 || changedCount > 0`. */
  hasChanges: boolean;
  /**
   * v19-fix-11b: convenience — STRUCTURAL change only (`addedCount > 0 ||
   * removedCount > 0`). A set/rep/weight edit on the SAME exercise is NOT
   * structural (it lands in `changed`, not here). The finish-flow
   * "Save changes to program?" modal gates on THIS, not `hasChanges`, so
   * set/rep-only edits go straight to the summary (fix-11 acceptance #3).
   */
  hasStructuralChanges: boolean;
}

type CompletedExerciseShape = {
  exerciseId: string;
  exercise?: { name?: string };
  sets?: Array<{ weight?: number; reps?: number; completed?: boolean }>;
};

type ProgramExerciseShape = {
  exerciseId: string;
  exerciseName?: string;
  name?: string;
  sets?: Array<{ weight?: number; reps?: number }>;
};

type ProgramDayShape = {
  blocks?: Array<{ exercises?: ProgramExerciseShape[] }>;
};

const EMPTY_DIFF: ProgramDayDiff = {
  added: [],
  removed: [],
  changed: [],
  addedCount: 0,
  removedCount: 0,
  changedCount: 0,
  hasChanges: false,
  hasStructuralChanges: false,
};

export function computeProgramDayDiff(
  completedWorkout: { exercises: CompletedExerciseShape[] },
  programDay: ProgramDayShape | null | undefined,
): ProgramDayDiff {
  if (!programDay) return { ...EMPTY_DIFF };

  // Collect original (program template) exercise ids + names + sets.
  const originalIds = new Set<string>();
  const originalNames = new Map<string, string>();
  const originalSets = new Map<string, Array<{ weight?: number; reps?: number }>>();
  for (const block of programDay.blocks || []) {
    for (const ex of block.exercises || []) {
      if (!ex.exerciseId) continue;
      originalIds.add(ex.exerciseId);
      if (!originalNames.has(ex.exerciseId)) {
        originalNames.set(
          ex.exerciseId,
          ex.exerciseName || ex.name || 'Exercise',
        );
        originalSets.set(ex.exerciseId, ex.sets || []);
      }
    }
  }

  // Collect current (completed) exercise ids + names + completed sets. Duplicates collapse
  // via the Set, so an exercise that appears twice in the workout is
  // counted once (matches the historical behaviour).
  const currentIds = new Set<string>();
  const currentNames = new Map<string, string>();
  const currentSets = new Map<string, Array<{ weight?: number; reps?: number }>>(); 
  for (const ex of completedWorkout.exercises || []) {
    if (!ex.exerciseId) continue;
    currentIds.add(ex.exerciseId);
    if (!currentNames.has(ex.exerciseId)) {
      currentNames.set(ex.exerciseId, ex.exercise?.name || 'Exercise');
      // Only store completed sets for diff
      currentSets.set(ex.exerciseId, (ex.sets || []).filter(s => s.completed));
    }
  }

  const added: string[] = [];
  for (const id of currentIds) {
    if (!originalIds.has(id)) added.push(currentNames.get(id) || 'Exercise');
  }

  const removed: string[] = [];
  for (const id of originalIds) {
    if (!currentIds.has(id)) removed.push(originalNames.get(id) || 'Exercise');
  }

  // Detect changed exercises (present in both but with different set data)
  const changed: string[] = [];
  for (const id of currentIds) {
    if (!originalIds.has(id)) continue; // Already counted in 'added'
    
    const origSets = originalSets.get(id) || [];
    const currSets = currentSets.get(id) || [];
    
    // Compare set count
    if (origSets.length !== currSets.length) {
      changed.push(currentNames.get(id) || 'Exercise');
      continue;
    }
    
    // Compare weight/reps for each set (treat undefined/null as 0)
    let setsChanged = false;
    for (let i = 0; i < origSets.length; i++) {
      const origWeight = origSets[i]?.weight ?? 0;
      const origReps = origSets[i]?.reps ?? 0;
      const currWeight = currSets[i]?.weight ?? 0;
      const currReps = currSets[i]?.reps ?? 0;
      
      if (origWeight !== currWeight || origReps !== currReps) {
        setsChanged = true;
        break;
      }
    }
    
    if (setsChanged) {
      changed.push(currentNames.get(id) || 'Exercise');
    }
  }

  return {
    added,
    removed,
    changed,
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
    hasStructuralChanges: added.length > 0 || removed.length > 0,
  };
}
