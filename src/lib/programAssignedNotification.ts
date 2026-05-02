/**
 * Pure builder for `program_assigned` notifications (D12).
 *
 * Before this helper existed, the builder page at
 * `src/app/program/builder/page.tsx` AND the `addClientProgram` store action
 * at `src/lib/stores/trainerStore.ts` both wrote notifications for the same
 * assignment, producing 2x "New Program Assigned" rows per trainer save.
 *
 * Part A of the D12 fix consolidates writers: the store action is now the
 * single source of truth, and it constructs its payload via this helper so
 * the logic can be unit-tested without mounting React / Zustand / Supabase.
 *
 * The helper is intentionally forgiving about missing counts — alternate
 * assignment paths (`src/app/clients/[id]/program/preview/page.tsx`,
 * `src/app/clients/[id]/program/builder/page.tsx`) don't carry frequency /
 * week counts on their `ClientProgram` construction, so the caller passes
 * whatever it has and we fall back to the shorter message format.
 */
import type { Notification } from '@/types';

/** Input for {@link __buildProgramAssignedNotification}. */
export interface BuildProgramAssignedNotificationInput {
  program: { id: string; clientId: string; templateName?: string };
  /** Display name of the assigning trainer (or a sensible fallback). */
  trainerName: string;
  /** Canonical public.users.id of the trainer — stored on the row. */
  senderId: string;
  /** Number of unique workout days in the program. */
  workoutCount?: number;
  /** Training sessions per week (frequency). */
  daysPerWeek?: number;
  /** Duration of the program in whole weeks. */
  actualWeeks?: number;
}

/** Shape of the payload accepted by `useSocialStore.addNotification`. */
export type ProgramAssignedNotificationPayload = Omit<
  Notification,
  'id' | 'createdAt' | 'read'
>;

/**
 * Build the payload for a `program_assigned` notification.
 *
 * Message format:
 *  - All three of workoutCount / daysPerWeek / actualWeeks present and
 *    positive → rich message including day count, frequency, duration.
 *  - Otherwise → the shorter "assigned you a new program: {name}" format.
 *
 * `link` and `actionUrl` are both set to the same deep-link so every
 * notification-click handler path (legacy + current) lands on the program.
 */
export function __buildProgramAssignedNotification(
  params: BuildProgramAssignedNotificationInput,
): ProgramAssignedNotificationPayload {
  const { program, trainerName, senderId, workoutCount, daysPerWeek, actualWeeks } = params;

  const trimmedName = (program.templateName ?? '').trim();
  const programName = trimmedName.length > 0 ? trimmedName : 'Training Program';

  const link = `/program?programId=${encodeURIComponent(program.id)}`;

  const hasAllCounts =
    typeof workoutCount === 'number' && workoutCount > 0 &&
    typeof daysPerWeek === 'number' && daysPerWeek > 0 &&
    typeof actualWeeks === 'number' && actualWeeks > 0;

  const message = hasAllCounts
    ? `${trainerName} assigned you "${programName}" — ${workoutCount} ${
        workoutCount === 1 ? 'workout' : 'workouts'
      }, ${daysPerWeek}×/week for ${actualWeeks} ${
        actualWeeks === 1 ? 'week' : 'weeks'
      }`
    : `${trainerName} assigned you a new program: ${programName}`;

  return {
    userId: program.clientId,
    type: 'program_assigned',
    title: 'New Program Assigned',
    message,
    link,
    actionUrl: link,
    programId: program.id,
    senderId,
  };
}
