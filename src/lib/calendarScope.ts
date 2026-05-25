/**
 * Calendar scope filtering (v15-D5).
 *
 * Single source of truth for "which calendar events should this viewer see?"
 * Pure function — no React, no store, no Supabase. Safe to call from any
 * surface (the main /calendar page, future booking surfaces, mini-calendars,
 * summary widgets, server-side renders).
 *
 * Christo's intent (CONTEXT.md §5 Q4):
 *   • Client view  = personal workouts + PT sessions booked WITH the client.
 *   • Trainer view = the trainer's own PT sessions + the trainer's own
 *                    personal workouts. NOT other clients' program workouts.
 *
 * The `CalendarEvent.eventScope` field (populated by `addCalendarEvent`)
 * is the primary primitive, but legacy events predating v15 lack it. For
 * those, fall back to the original `clientId === viewer.id ||
 * trainerId === viewer.id` predicate so nothing disappears off
 * pre-existing calendars.
 *
 * The future booking-system surface ("client viewing trainer X's
 * availability") will compose this with `TrainerAvailabilitySlot` data —
 * see `<UnifiedCalendar availabilitySlots={...} />` for the rendering
 * extension point.
 */

import type { CalendarEvent } from '@/types';

export type CalendarViewer = {
  userId: string;
  mode: 'trainer' | 'user';
};

export interface GetVisibleCalendarEventsOptions {
  /** Default: true. Set to false to include cancelled events (e.g. audit views). */
  hideCancelled?: boolean;
}

/**
 * Filters a CalendarEvent list down to what `viewer` should see on their
 * own /calendar page.
 *
 * Behaviour:
 *   • Cancelled events excluded unless `options.hideCancelled === false`.
 *   • Trainer mode:
 *       - Must have `trainerId === viewer.userId`.
 *       - Workouts assigned to OTHER clients (`type === 'workout' && clientId
 *         && clientId !== viewer.userId`) are hidden — those belong on the
 *         client's calendar, not the trainer's.
 *   • Client / user mode:
 *       - Sees events where `clientId === viewer.userId` (PT sessions booked
 *         with them, workouts assigned to them).
 *       - Sees events where `ownerUserId === viewer.userId` (their own
 *         personal events; covers the rare self-coaching case where mode
 *         is `user` but the user authored their own event).
 *   • Legacy fallback (event has neither `eventScope` nor `ownerUserId` —
 *     pre-v15 row): falls back to the original symmetric predicate
 *     `clientId === viewer.userId || trainerId === viewer.userId` so
 *     no historic data disappears.
 */
export function getVisibleCalendarEvents(
  events: CalendarEvent[],
  viewer: CalendarViewer,
  options?: GetVisibleCalendarEventsOptions,
): CalendarEvent[] {
  const hideCancelled = options?.hideCancelled !== false;
  const out: CalendarEvent[] = [];

  for (const e of events) {
    if (hideCancelled && e.status === 'cancelled') continue;

    if (viewer.mode === 'trainer') {
      if (e.trainerId !== viewer.userId) continue;
      if (e.type === 'workout' && e.clientId && e.clientId !== viewer.userId) continue;
      out.push(e);
      continue;
    }

    // viewer.mode === 'user'
    if (e.clientId === viewer.userId) {
      out.push(e);
      continue;
    }
    if (e.ownerUserId === viewer.userId) {
      out.push(e);
      continue;
    }

    // Legacy fallback for events missing both new fields.
    if (!e.eventScope && !e.ownerUserId) {
      if (e.clientId === viewer.userId || e.trainerId === viewer.userId) {
        out.push(e);
      }
    }
  }

  return out;
}
