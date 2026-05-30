/**
 * v17-D4: shared utility for user-created custom exercises.
 *
 * Source of truth is per-user scoped localStorage
 * (`apex-custom-exercises-<userId>`), matching the v16-D2 audit. Supabase
 * persistence to `public.custom_exercises` is best-effort and non-fatal —
 * if the write fails (offline, RLS, schema drift), the localStorage copy
 * keeps the exercise visible to the creating user.
 *
 * The localStorage row shape is intentionally a superset of the legacy
 * `{id, name, type}` records written by /workout/builder so that pre-v17
 * custom exercises continue to round-trip without migration.
 */
import { v4 as uuidv4 } from 'uuid';
import type { Exercise, ExerciseCategory } from '@/types';
import { supabase } from './supabase';

export type CustomExerciseCategory =
  | 'strength'
  | 'endurance'
  | 'warmup'
  | 'mobility'
  | 'cardio';

export const CUSTOM_EXERCISE_CATEGORIES: ReadonlyArray<{
  value: CustomExerciseCategory;
  label: string;
}> = [
  { value: 'strength', label: 'Strength' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'cardio', label: 'Cardio' },
];

/**
 * Persisted shape in localStorage. `type` is kept for backward compat with
 * /workout/builder's pre-v17 schema; `category` (the brief's user-facing
 * categorization) is the new v17-D4 field and takes precedence when set.
 */
export interface CustomExerciseRecord {
  id: string;
  name: string;
  type: 'normal' | 'cardio' | 'stretch';
  category?: CustomExerciseCategory;
  createdByUserId?: string;
  isCustom?: true;
}

function storageKey(userId: string): string {
  return `apex-custom-exercises-${userId}`;
}

/** Read this user's custom exercises from localStorage. SSR-safe. */
export function loadCustomExercises(userId: string | undefined | null): CustomExerciseRecord[] {
  if (!userId) return [];
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r: any) => r && typeof r.id === 'string' && typeof r.name === 'string');
  } catch (e) {
    console.warn('[customExercises] loadCustomExercises parse failed:', e);
    return [];
  }
}

function persistLocal(userId: string, records: CustomExerciseRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(records));
  } catch (e) {
    console.warn('[customExercises] persistLocal failed:', e);
  }
}

/**
 * Map the user-facing category to the legacy `type` enum so legacy
 * /workout/builder code paths that branch on `type` keep working.
 */
function categoryToLegacyType(category: CustomExerciseCategory): 'normal' | 'cardio' | 'stretch' {
  switch (category) {
    case 'cardio':
    case 'endurance':
      return 'cardio';
    case 'warmup':
    case 'mobility':
      return 'stretch';
    case 'strength':
    default:
      return 'normal';
  }
}

/**
 * Map the user-facing category to the internal `ExerciseCategory` so the
 * exercise lands in the right block-type filter when surfaced through
 * `searchExercises({ blockType })`.
 */
function categoryToExerciseCategory(category: CustomExerciseCategory | undefined, fallbackType: CustomExerciseRecord['type']): ExerciseCategory {
  if (category) {
    switch (category) {
      case 'strength': return 'compound';
      case 'endurance': return 'isolation';
      case 'warmup': return 'warmup';
      case 'mobility': return 'stretching';
      case 'cardio': return 'cardio';
    }
  }
  // Legacy rows: derive from `type`.
  if (fallbackType === 'cardio') return 'cardio';
  if (fallbackType === 'stretch') return 'stretching';
  return 'compound';
}

/**
 * Project a stored custom-exercise record into the full `Exercise` shape
 * used by the search/picker/library code paths.
 */
export function customExerciseToLibrary(record: CustomExerciseRecord): Exercise {
  return {
    id: record.id,
    name: record.name,
    primaryMuscles: [],
    secondaryMuscles: [],
    category: categoryToExerciseCategory(record.category, record.type),
    equipment: 'other',
    isCustom: true,
    createdBy: record.createdByUserId,
  };
}

/**
 * v17-D4: create a user-owned exercise. localStorage is authoritative;
 * the Supabase write is best-effort. Returns the projected `Exercise`
 * (auto-selectable) on success, or null on validation failure.
 */
export async function createCustomExercise(input: {
  name: string;
  category: CustomExerciseCategory;
  userId: string;
}): Promise<Exercise | null> {
  const name = (input.name || '').trim();
  if (!name) return null;
  if (!input.userId) return null;
  if (!input.category) return null;

  const record: CustomExerciseRecord = {
    id: `custom-${uuidv4()}`,
    name,
    type: categoryToLegacyType(input.category),
    category: input.category,
    createdByUserId: input.userId,
    isCustom: true,
  };

  // 1. localStorage — authoritative for custom exercises.
  try {
    const existing = loadCustomExercises(input.userId);
    persistLocal(input.userId, [...existing, record]);
  } catch (e) {
    console.warn('[customExercises] localStorage write failed:', e);
  }

  // 2. Supabase — best-effort. Schema (per supabase/schema.sql):
  //    custom_exercises(id text pk, trainer_id text, name text, type text,
  //                     category text, muscles text[], created_at).
  //    `trainer_id` is the legacy ownership column (it pre-dates the
  //    trainer/client split applying to custom exercises — for v17-D4 we
  //    just put the creator's user id here). Failures are non-fatal.
  try {
    const { error } = await supabase.from('custom_exercises').insert({
      id: record.id,
      trainer_id: input.userId,
      name: record.name,
      type: record.type,
      category: record.category,
      muscles: [],
    });
    if (error) {
      console.warn('[customExercises] Supabase write failed (non-fatal):', error.message);
    }
  } catch (e) {
    console.warn('[customExercises] Supabase exception (non-fatal):', e);
  }

  return customExerciseToLibrary(record);
}
