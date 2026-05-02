/**
 * Pure gate for client-scoped data fetches (D14).
 *
 * The /program and /today pages load client-scoped data (client_programs,
 * assigned calendar events, session workouts) via
 * `useTrainerStore.loadClientDataFromSupabase(userId)`. Before this helper
 * existed, both pages gated that fetch on `user.isTrainer` — a PERMANENT
 * role flag that never flips. Dual-mode accounts (users with
 * `isTrainer=true` who are also a client of another trainer and have
 * flipped to Athlete mode via `switchMode('user')`) were therefore blocked
 * from seeing their assigned programs because the gate evaluated as
 * "always trainer → always skip" regardless of the live `user.mode`
 * toggle.
 *
 * The correct predicate is the LIVE MODE, not the permanent role. When
 * the user is in `'trainer'` mode they are consuming the trainer surface
 * (/clients, /schedule) and don't need client-scoped fetches on these two
 * pages; in `'user'` (Athlete) mode they do, even if `isTrainer` is true.
 *
 * Legacy note: `user.mode` may be undefined on older localStorage rows
 * rehydrated from before the mode column was added. We treat undefined as
 * Athlete mode (`fetch = true`) because that is the non-regressing
 * default — pure clients have always been the majority of users.
 *
 * Unit-tested in `src/lib/__tests__/modeAwareFetchGate.test.ts`.
 */
export function __shouldSkipClientFetch(
  user: { id?: string; mode?: 'user' | 'trainer' } | null | undefined,
): boolean {
  if (!user?.id) return true; // not signed in → skip
  if (user.mode === 'trainer') return true; // trainer mode → skip client fetch
  return false; // user mode (or undefined mode) → fetch
}
