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
import { withTimeout } from './asyncUtils';

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

// ============ GET OR CREATE SESSION WORKOUT FOR EVENT ============

export interface SessionWorkoutResult {
  id: string;
  name: string;
  clientId: string;
  eventId: string;
  trainerId: string;
  blocks: any[];
  createdAt: string;
  source: 'existing' | 'created';
}

// In-flight request guard keyed by eventId — prevents duplicate creates on rapid tap
const _inflightResolves = new Map<string, Promise<SessionWorkoutResult | null>>();

/**
 * Canonical resolver: get or create a session_workout for a calendar event.
 * 
 * 1. Fetch calendar_events by id, validate type='session'.
 * 2. If event.workout_id set → try session_workouts.id = workout_id.
 *    - If found and event_id matches → return it.
 *    - If found but event_id mismatch → log, ignore.
 * 3. Fallback: also check session_workouts by event_id (local-first created rows).
 * 4. If not found → create new session_workouts row:
 *    - Reconstruct blocks from program if event has programId + programDayIndex.
 *    - PATCH calendar_events.workout_id to new row's id.
 * 5. Return the session workout.
 * 
 * Concurrency: de-duplicates in-flight requests per eventId.
 */
export async function getOrCreateSessionWorkoutForEvent(
  eventId: string,
  trainerId: string,
  clientId: string,
  programData?: { weeklyPlan?: any[]; programId?: string; programDayIndex?: number },
): Promise<SessionWorkoutResult | null> {
  // Idempotency: if already resolving this event, return same promise
  const inflight = _inflightResolves.get(eventId);
  if (inflight) {
    console.debug('[SessionResolver] start_session_deduplicated', { eventId });
    return inflight;
  }

  // Hard outer timeout on the whole resolve flow. The resolver makes
  // up to ~6 sequential supabase-js calls and prior to this guard a
  // single hung call would leave the UI "Start" button stuck on
  // "Starting…" forever. 12s is well above typical P99 for this chain
  // (~500ms) and below the user's patience threshold.
  const promise = withTimeout(
    _resolveSessionWorkout(eventId, trainerId, clientId, programData),
    12000,
    `getOrCreateSessionWorkoutForEvent(${eventId})`,
  );
  _inflightResolves.set(eventId, promise);

  try {
    return await promise;
  } catch (e: any) {
    console.error('[SessionResolver] resolve_failed_or_timed_out', {
      eventId,
      error: e?.message ?? String(e),
    });
    return null;
  } finally {
    _inflightResolves.delete(eventId);
  }
}

async function _resolveSessionWorkout(
  eventId: string,
  trainerId: string,
  clientId: string,
  programData?: { weeklyPlan?: any[]; programId?: string; programDayIndex?: number },
): Promise<SessionWorkoutResult | null> {
  console.debug('[SessionResolver] start_session_requested', { eventId });

  // 1. Fetch calendar event
  let event: any;
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (error || !data) {
      console.debug('[SessionResolver] event_not_found', { eventId });
      return null;
    }
    event = data;
  } catch (e) {
    console.debug('[SessionResolver] event_fetch_exception', { eventId });
    return null;
  }

  // 2. Validate type
  if (event.type !== 'session') {
    console.debug('[SessionResolver] event_not_session', { eventId, type: event.type });
    return null;
  }

  const workoutId = event.workout_id;

  // 3. Try resolving by workout_id on the event
  if (workoutId) {
    try {
      const { data: sw } = await supabase
        .from('session_workouts')
        .select('*')
        .eq('id', workoutId)
        .maybeSingle();

      if (sw) {
        if (sw.event_id === eventId) {
          // If existing workout has empty blocks but we have program data, backfill
          const existingBlocks = typeof sw.blocks === 'string' ? JSON.parse(sw.blocks) : (sw.blocks || []);
          const hasExercises = existingBlocks.some((b: any) => (b.exercises || []).length > 0);
          if (!hasExercises && programData?.weeklyPlan) {
            const rebuilt = _reconstructBlocks(event, programData);
            const rebuiltHasExercises = rebuilt.some((b: any) => (b.exercises || []).length > 0);
            if (rebuiltHasExercises) {
              await supabase
                .from('session_workouts')
                .update({ blocks: JSON.stringify(rebuilt) })
                .eq('id', sw.id);
              sw.blocks = JSON.stringify(rebuilt);
              console.debug('[SessionResolver] session_workout_blocks_backfilled', { eventId, workoutId: sw.id });
            }
          }
          const result = _mapSessionWorkout(sw, 'existing');
          console.debug('[SessionResolver] session_workout_resolved', {
            eventId, workoutId: sw.id, source: 'existing',
          });
          return result;
        } else {
          console.debug('[SessionResolver] workout_event_mismatch', {
            eventId, workoutId: sw.id, actualEventId: sw.event_id,
          });
          // Fall through — this workout belongs to a different event
        }
      } else {
        console.debug('[SessionResolver] session_workout_missing_link', {
          eventId, workoutId,
        });
      }
    } catch (e) {
      console.debug('[SessionResolver] session_workout_fetch_exception', { eventId, workoutId });
    }
  }

  // 4. Fallback: check session_workouts by event_id (handles locally-created rows)
  try {
    const { data: byEvent } = await supabase
      .from('session_workouts')
      .select('*')
      .eq('event_id', eventId)
      .limit(1)
      .maybeSingle();

    if (byEvent) {
      // Also patch the event's workout_id if it was stale/missing
      if (event.workout_id !== byEvent.id) {
        await supabase
          .from('calendar_events')
          .update({ workout_id: byEvent.id })
          .eq('id', eventId);
      }
      // Backfill empty blocks if program data is now available
      const existingBlocks = typeof byEvent.blocks === 'string' ? JSON.parse(byEvent.blocks) : (byEvent.blocks || []);
      const hasExercises = existingBlocks.some((b: any) => (b.exercises || []).length > 0);
      if (!hasExercises && programData?.weeklyPlan) {
        const rebuilt = _reconstructBlocks(event, programData);
        const rebuiltHasExercises = rebuilt.some((b: any) => (b.exercises || []).length > 0);
        if (rebuiltHasExercises) {
          await supabase
            .from('session_workouts')
            .update({ blocks: JSON.stringify(rebuilt) })
            .eq('id', byEvent.id);
          byEvent.blocks = JSON.stringify(rebuilt);
          console.debug('[SessionResolver] session_workout_blocks_backfilled', { eventId, workoutId: byEvent.id });
        }
      }
      const result = _mapSessionWorkout(byEvent, 'existing');
      console.debug('[SessionResolver] session_workout_resolved', {
        eventId, workoutId: byEvent.id, source: 'existing',
      });
      return result;
    }
  } catch (e) {
    // Non-fatal, continue to create
  }

  // 5. Re-read event before insert (concurrency guard)
  try {
    const { data: freshEvent } = await supabase
      .from('calendar_events')
      .select('workout_id')
      .eq('id', eventId)
      .maybeSingle();

    if (freshEvent?.workout_id && freshEvent.workout_id !== workoutId) {
      // Another request created a workout between our reads — try to use it
      const { data: lateSw } = await supabase
        .from('session_workouts')
        .select('*')
        .eq('id', freshEvent.workout_id)
        .maybeSingle();

      if (lateSw) {
        console.debug('[SessionResolver] session_workout_resolved', {
          eventId, workoutId: lateSw.id, source: 'existing',
        });
        return _mapSessionWorkout(lateSw, 'existing');
      }
    }
  } catch (e) {
    // Non-fatal
  }

  // 6. Create new session_workout
  const shortRandom = Math.random().toString(36).substr(2, 6);
  const newId = `session-workout-${Date.now()}-${shortRandom}`;
  const eventTitle = event.title || 'Session Workout';
  const blocks = _reconstructBlocks(event, programData);

  try {
    const dbRow = {
      id: newId,
      event_id: eventId,
      client_id: clientId,
      trainer_id: trainerId,
      name: eventTitle,
      blocks: JSON.stringify(blocks),
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('session_workouts')
      .insert(dbRow);

    if (error) {
      console.error('[SessionResolver] create_session_workout_failed', { eventId, error: error.message });
      return null;
    }

    // 7. PATCH calendar_events.workout_id
    await supabase
      .from('calendar_events')
      .update({ workout_id: newId })
      .eq('id', eventId);

    const result: SessionWorkoutResult = {
      id: newId,
      name: eventTitle,
      clientId,
      eventId,
      trainerId,
      blocks,
      createdAt: dbRow.created_at,
      source: 'created',
    };

    console.debug('[SessionResolver] session_workout_resolved', {
      eventId, workoutId: newId, source: 'created',
    });

    return result;
  } catch (e) {
    console.error('[SessionResolver] create_session_workout_exception', { eventId });
    return null;
  }
}

function _mapSessionWorkout(row: any, source: 'existing' | 'created'): SessionWorkoutResult {
  const blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : (row.blocks || []);
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    eventId: row.event_id,
    trainerId: row.trainer_id,
    blocks,
    createdAt: row.created_at,
    source,
  };
}

/**
 * Reconstruct blocks from the program day matching this event's programId + programDayIndex.
 * Returns empty scaffold if no program data available.
 */
function _reconstructBlocks(
  event: any,
  programData?: { weeklyPlan?: any[]; programId?: string; programDayIndex?: number },
): any[] {
  const programId = event.program_id;
  // Use programData.programDayIndex (from local CalendarEvent) since DB column doesn't exist
  const dayIndex = programData?.programDayIndex;

  // If programData provides an exact day index, use it
  if (dayIndex != null && programData?.weeklyPlan) {
    const day = programData.weeklyPlan[dayIndex];
    if (day && day.blocks && day.blocks.some((b: any) => (b.exercises || []).length > 0)) {
      console.debug('[SessionResolver] blocks_from_program_day_index', { dayIndex });
      return day.blocks;
    }
  }

  // Try matching by event title against program day labels
  if (programData?.weeklyPlan?.length) {
    const titleLower = (event.title || '').toLowerCase().trim();
    if (titleLower) {
      // Exact match on dayLabel
      const matchByLabel = programData.weeklyPlan.find(
        (d: any) => (d.dayLabel || '').toLowerCase().trim() === titleLower
      );
      if (matchByLabel?.blocks?.some((b: any) => (b.exercises || []).length > 0)) {
        console.debug('[SessionResolver] blocks_from_title_exact_match');
        return matchByLabel.blocks;
      }
      // Substring match: event title contains dayLabel or vice versa
      const matchBySubstring = programData.weeklyPlan.find(
        (d: any) => {
          const label = (d.dayLabel || '').toLowerCase().trim();
          return label && (titleLower.includes(label) || label.includes(titleLower));
        }
      );
      if (matchBySubstring?.blocks?.some((b: any) => (b.exercises || []).length > 0)) {
        console.debug('[SessionResolver] blocks_from_title_substring_match');
        return matchBySubstring.blocks;
      }
    }
    // Do NOT fall back to first/last day — return empty scaffold instead
  }

  // Empty scaffold: single empty strength block
  return [{
    id: `block-${Date.now()}`,
    type: 'strength',
    name: event.title || 'Session',
    exercises: [],
  }];
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
