/**
 * Pure builder for `workout_completed_summary` notifications.
 *
 * When a trainer completes a workout for a client (PT mode), we surface an
 * in-app notification on the client's home page. This helper constructs the
 * payload following the same pattern as programAssignedNotification.ts.
 *
 * The notification includes workout name, volume, duration, and links to the
 * workout history detail page.
 */
import type { Notification } from '@/types';

/** Input for {@link __buildWorkoutCompletedNotification}. */
export interface BuildWorkoutCompletedNotificationInput {
  workout: {
    id: string;
    userId: string;
    name?: string;
    totalVolume?: number;
    duration?: number;
  };
  /** Display name of the trainer who completed the workout. */
  trainerName: string;
  /** Canonical public.users.id of the trainer — stored on the row. */
  trainerId: string;
}

/** Shape of the payload accepted by `useSocialStore.addNotification`. */
export type WorkoutCompletedNotificationPayload = Omit<
  Notification,
  'id' | 'createdAt' | 'read'
>;

/**
 * Build the payload for a `workout_completed_summary` notification.
 *
 * Message format:
 *  - Includes workout name, volume (if available), and duration (if available)
 *  - Links to the workout history detail page
 */
export function __buildWorkoutCompletedNotification(
  params: BuildWorkoutCompletedNotificationInput,
): WorkoutCompletedNotificationPayload {
  const { workout, trainerName, trainerId } = params;

  const workoutName = (workout.name ?? '').trim() || 'Workout';
  const link = `/workout/${encodeURIComponent(workout.id)}`;

  // Build summary string with available metrics
  const parts: string[] = [];
  
  if (typeof workout.totalVolume === 'number' && workout.totalVolume > 0) {
    parts.push(`${Math.round(workout.totalVolume)} kg volume`);
  }
  
  if (typeof workout.duration === 'number' && workout.duration > 0) {
    const minutes = Math.round(workout.duration / 60);
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  const summary = parts.length > 0 ? ` — ${parts.join(', ')}` : '';

  const message = `${trainerName} completed "${workoutName}" for you${summary}`;

  return {
    userId: workout.userId,
    type: 'workout_completed_summary',
    title: 'Workout Completed',
    message,
    link,
    actionUrl: link,
    // v16-D7: canonical deep-link path so the notifications page click
    // handler can route to the workout summary (existing detail page at
    // /workout/[id] doubles as the summary view in this codebase — there
    // is no separate /summary subroute, see fix/v16-7-notification-deep-links).
    deepLinkPath: link,
    workoutId: workout.id,
    senderId: trainerId,
  };
}
