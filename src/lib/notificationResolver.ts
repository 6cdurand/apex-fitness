/**
 * Notification target resolver.
 *
 * Extracted as a pure module so the open-notification flow can be unit-tested
 * without mounting React or mocking Supabase. The notifications page click
 * handler calls `resolveNotificationTarget` and then acts on the result.
 *
 * Scope: currently specializes `program_assigned` notifications. All other
 * types fall through to the pre-existing `actionUrl || link` behavior.
 *
 * Backward compatibility:
 *   - Old rows with `program_id = NULL` and no `action_url` are resolved by
 *     a caller-supplied `lookupLatestActiveProgram` function which queries
 *     the latest active client_program for the current user.
 *   - Rows predating the `link` column (only `actionUrl`) keep working.
 *   - No field is assumed to be present; every access is null-checked.
 */

import type { Notification } from '@/types';

/** Canonical program detail route. The app has a single `/program` route
 *  that shows the authenticated client's active program. If a future route
 *  becomes id-aware (e.g. /program/[id]) the query string below ensures
 *  we already carry the id through. */
export const PROGRAM_ROUTE = '/program';

export type ResolvedTarget =
  | { kind: 'navigate'; url: string }
  | { kind: 'empty'; message: string }
  | { kind: 'noop' };

/** Minimal shape a caller must supply when resolving a legacy program
 *  notification (no `program_id`). Return `null` when no active program
 *  exists for the user. */
export type LatestActiveProgramLookup = (
  clientId: string,
) => Promise<{ id: string } | null>;

/** Build the canonical URL for a program notification, preferring the
 *  explicit `programId` when we have it (forward-compat with a per-id
 *  detail page) and falling back to the bare `/program` route otherwise. */
export function buildProgramUrl(programId?: string | null): string {
  if (programId && typeof programId === 'string' && programId.length > 0) {
    return `${PROGRAM_ROUTE}?programId=${encodeURIComponent(programId)}`;
  }
  return PROGRAM_ROUTE;
}

/** Pure check: does this notification carry an explicit nav hint we can
 *  follow without any I/O?
 *
 *  v16-D7: `deepLinkPath` is the canonical post-D7 field for in-app deep
 *  linking (notifications.deep_link_path). It takes priority over the
 *  legacy `actionUrl` / `link` so newly-issued session-complete and
 *  share-with-trainer notifications route to the workout summary. Older
 *  rows fall back to `actionUrl` then `link` unchanged. */
export function getExplicitUrl(n: Partial<Notification> | null | undefined): string | null {
  if (!n) return null;
  const url = (n.deepLinkPath || n.actionUrl || n.link || '').toString().trim();
  return url.length > 0 ? url : null;
}

/** Is this a program_assigned notification? Defensive against bad input. */
export function isProgramAssigned(n: Partial<Notification> | null | undefined): boolean {
  return !!n && n.type === 'program_assigned';
}

/**
 * Resolve where a notification click should take the user.
 *
 * Rules (in order):
 *   1. If the notification is `program_assigned`:
 *      a. If it has `programId`, navigate to `/program?programId=<id>`.
 *      b. Else, call `lookupLatestActiveProgram(clientId)`; on hit, navigate
 *         to `/program` (id-less); on miss, return `{ kind: 'empty' }` so
 *         the caller can show a non-blocking message.
 *   2. Otherwise, honor any explicit `actionUrl` / `link` on the row.
 *   3. If nothing resolves, return `{ kind: 'noop' }`.
 */
export async function resolveNotificationTarget(
  notification: Partial<Notification> | null | undefined,
  clientId: string | null | undefined,
  lookupLatestActiveProgram: LatestActiveProgramLookup,
): Promise<ResolvedTarget> {
  if (!notification) return { kind: 'noop' };

  // Program notifications get the type-specific resolver first so an old
  // row with a stale `/programs` URL still lands on the canonical route.
  if (isProgramAssigned(notification)) {
    if (notification.programId) {
      return { kind: 'navigate', url: buildProgramUrl(notification.programId) };
    }
    if (!clientId) {
      // No user context to look up the active program. Send them to the
      // generic route — the page will render "no active program" itself,
      // which is strictly better than doing nothing.
      return { kind: 'navigate', url: PROGRAM_ROUTE };
    }
    try {
      const latest = await lookupLatestActiveProgram(clientId);
      if (latest?.id) {
        return { kind: 'navigate', url: buildProgramUrl(latest.id) };
      }
      return {
        kind: 'empty',
        message: 'No active program found yet.',
      };
    } catch {
      // Lookup failure must not crash the click handler. Degrade to the
      // generic route; the page's own refetch logic will eventually
      // surface the program once sync completes.
      return { kind: 'navigate', url: PROGRAM_ROUTE };
    }
  }

  // Non-program types: preserve the legacy behavior exactly.
  const explicit = getExplicitUrl(notification);
  if (explicit) {
    return { kind: 'navigate', url: explicit };
  }
  return { kind: 'noop' };
}
