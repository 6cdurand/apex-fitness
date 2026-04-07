/**
 * Session Workout Resolver
 * 
 * Provides robust workout resolution for calendar events.
 * Handles legacy non-UUID workout_id values (e.g. "session-workout-1774766788794")
 * gracefully, never hard-failing the Start flow.
 */

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent } from '@/types';

// ============ UTILITIES ============

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4 (or v1-5).
 * Returns false for legacy tokens like "session-workout-1774766788794".
 */
export function isUuid(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
}

// ============ RESOLVE WORKOUT FOR SESSION ============

export interface ResolvedWorkout {
  id: string;
  name: string;
  status: string;
  userId: string;
  exercises: any[];
  startTime?: string;
  assignedBy?: string;
}

/**
 * Resolve a workout row from `public.workouts` for a calendar event.
 * 
 * 1. If event.workoutId exists AND is a valid UUID, try fetching `workouts.id = event.workoutId`.
 * 2. If missing, non-UUID, or fetch returns empty → return null (no throw).
 * 
 * Logs once at debug level for unresolved references.
 */
export async function resolveWorkoutForSession(
  event: CalendarEvent
): Promise<ResolvedWorkout | null> {
  const workoutId = event.workoutId;

  if (!workoutId) {
    return null;
  }

  const isValidUuid = isUuid(workoutId);

  if (!isValidUuid) {
    console.debug('[SessionResolver] unresolved_workout_ref', {
      eventId: event.id,
      isUuid: false,
      // No PII — just IDs
    });
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, name, status, user_id, exercises, start_time, assigned_by')
      .eq('id', workoutId)
      .maybeSingle();

    if (error || !data) {
      console.debug('[SessionResolver] unresolved_workout_ref', {
        eventId: event.id,
        isUuid: true,
        reason: error ? 'fetch_error' : 'not_found',
      });
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      status: data.status,
      userId: data.user_id,
      exercises: data.exercises || [],
      startTime: data.start_time,
      assignedBy: data.assigned_by,
    };
  } catch (e) {
    console.debug('[SessionResolver] unresolved_workout_ref', {
      eventId: event.id,
      isUuid: true,
      reason: 'exception',
    });
    return null;
  }
}

// ============ CREATE WORKOUT FOR SESSION ============

/**
 * Create a new `workouts` row for a session event.
 * Returns the new workout ID, or null on failure.
 * Optionally patches the calendar event's workout_id to the new UUID.
 */
export async function createWorkoutForSession(opts: {
  clientId: string;
  trainerId: string;
  eventId: string;
  title?: string;
  patchCalendarEvent?: boolean;
}): Promise<string | null> {
  const workoutId = uuidv4();
  const now = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('workouts')
      .insert({
        id: workoutId,
        user_id: opts.clientId,
        assigned_by: opts.trainerId,
        name: opts.title || 'Session Workout',
        status: 'in_progress',
        start_time: now,
        exercises: [],
        total_volume: 0,
      });

    if (error) {
      console.error('[SessionResolver] Failed to create workout:', error.message);
      return null;
    }

    // Backward compat: patch the calendar event's workout_id to the real UUID
    if (opts.patchCalendarEvent) {
      await supabase
        .from('calendar_events')
        .update({ workout_id: workoutId })
        .eq('id', opts.eventId);
    }

    console.log('[SessionResolver] Created workout for session', {
      workoutId,
      eventId: opts.eventId,
    });

    return workoutId;
  } catch (e) {
    console.error('[SessionResolver] Exception creating workout:', e);
    return null;
  }
}

// ============ EVENT-SCOPED STATUS ============

/**
 * Determine if a specific calendar event should be shown as "completed".
 * 
 * Primary: event.status === 'completed'
 * Secondary: if event has a valid UUID workoutId, check that workout's status.
 * Never falls back to "latest workout for client on date".
 */
export function isEventCompleted(event: CalendarEvent): boolean {
  return event.status === 'completed';
}

/**
 * Async version that also checks the linked workout status (if UUID).
 * Use when you need to verify against the DB.
 */
export async function isEventCompletedAsync(event: CalendarEvent): Promise<boolean> {
  // Primary: event's own status
  if (event.status === 'completed') return true;

  // Secondary: check linked workout only if valid UUID
  if (isUuid(event.workoutId)) {
    const resolved = await resolveWorkoutForSession(event);
    if (resolved && resolved.status === 'completed') return true;
  }

  return false;
}
