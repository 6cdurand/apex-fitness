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
  addedCount: number;
  removedCount: number;
  /** Convenience: `addedCount > 0 || removedCount > 0`. */
  hasChanges: boolean;
}

type CompletedExerciseShape = {
  exerciseId: string;
  exercise?: { name?: string };
};

type ProgramExerciseShape = {
  exerciseId: string;
  exerciseName?: string;
  name?: string;
};

type ProgramDayShape = {
  blocks?: Array<{ exercises?: ProgramExerciseShape[] }>;
};

const EMPTY_DIFF: ProgramDayDiff = {
  added: [],
  removed: [],
  addedCount: 0,
  removedCount: 0,
  hasChanges: false,
};

export function computeProgramDayDiff(
  completedWorkout: { exercises: CompletedExerciseShape[] },
  programDay: ProgramDayShape | null | undefined,
): ProgramDayDiff {
  if (!programDay) return { ...EMPTY_DIFF };

  // Collect original (program template) exercise ids + names.
  const originalIds = new Set<string>();
  const originalNames = new Map<string, string>();
  for (const block of programDay.blocks || []) {
    for (const ex of block.exercises || []) {
      if (!ex.exerciseId) continue;
      originalIds.add(ex.exerciseId);
      if (!originalNames.has(ex.exerciseId)) {
        originalNames.set(
          ex.exerciseId,
          ex.exerciseName || ex.name || 'Exercise',
        );
      }
    }
  }

  // Collect current (completed) exercise ids + names. Duplicates collapse
  // via the Set, so an exercise that appears twice in the workout is
  // counted once (matches the historical behaviour).
  const currentIds = new Set<string>();
  const currentNames = new Map<string, string>();
  for (const ex of completedWorkout.exercises || []) {
    if (!ex.exerciseId) continue;
    currentIds.add(ex.exerciseId);
    if (!currentNames.has(ex.exerciseId)) {
      currentNames.set(ex.exerciseId, ex.exercise?.name || 'Exercise');
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

  return {
    added,
    removed,
    addedCount: added.length,
    removedCount: removed.length,
    hasChanges: added.length > 0 || removed.length > 0,
  };
}
