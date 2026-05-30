import { safeLocalStorage } from '../safeStorage';
import { useAuthStore } from './authStore';

/**
 * v16-D2: a per-user scoped localStorage adapter for Zustand `persist`.
 *
 * Background — bug being closed
 * -----------------------------
 * Pre-D2, every user-scoped Zustand store wrote to a fixed key
 * (`apex-workout`, `apex-trainer`, `apex-medals`, `apex-social`,
 * `apex-messages`, `apex-reports`). On a shared browser, when User A
 * logged out and User B logged in, the new store hydrate read User A's
 * data straight back from those globally-keyed blobs — leaking saved
 * blocks, client rosters, active workouts, message threads across
 * accounts.
 *
 * Fix
 * ---
 * `scopedStorage(name)` wraps `safeLocalStorage` with a per-user prefix.
 * Every read/write rebases the key from `apex-<store>` to
 * `apex-<store>-<userId>` so each account has its own keyspace. The
 * Zustand `persist` config keeps `name: 'apex-<store>'` (used as the
 * JSON envelope identifier) but the actual localStorage key becomes
 * scoped via this adapter.
 *
 * Pre-login behaviour
 * -------------------
 * When no user is logged in, `getCurrentUserId()` returns null. Reads
 * return null (so stores hydrate to default state) and writes are
 * no-ops (so we don't pollute the device with anonymous-user state
 * that would later be picked up incorrectly).
 *
 * Why this resolves user.id via authStore in-memory first, then
 * localStorage fallback
 * --------------------------------------------------------------
 * - In-memory authStore is per-tab. If two tabs hold different users
 *   (rare but possible), each tab scopes its writes to its own user.
 * - localStorage `apex-auth` is shared across tabs; using it alone
 *   would scope both tabs to whichever user was last written.
 * - Pre-hydrate (very early app boot, before authStore's persist
 *   hydration tick has fired), in-memory `user` may still be null
 *   even though `apex-auth` has the previous session. Falling back
 *   to the raw envelope avoids accidentally clobbering that session.
 *
 * Circular import safety
 * ----------------------
 * `authStore` imports `clearAllScopedKeysForUser` from this module;
 * this module imports `useAuthStore` from authStore. ES modules use
 * live bindings, and `useAuthStore` is only dereferenced inside
 * `getCurrentUserId()` (called lazily at storage read/write time, by
 * which point both modules have finished loading). Both directions
 * of the cycle resolve before any read/write actually happens.
 *
 * Notes
 * -----
 * - `apex-auth` itself is intentionally NOT scoped — it has to be
 *   readable before we know who the user is.
 * - Quota errors are still handled by the underlying `safeLocalStorage`
 *   (it removes non-critical caches and retries the write once).
 */

function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  // 1. Try the in-memory authStore first (per-tab, authoritative for
  //    multi-tab scenarios where each tab may hold a different user).
  try {
    const inMemoryId = useAuthStore.getState().user?.id;
    if (inMemoryId) return inMemoryId;
  } catch {
    // authStore module may not have finished evaluating yet during
    // very-early hydration. Fall through to localStorage parse.
  }
  // 2. Fallback: parse the persisted envelope directly. Covers the
  //    pre-hydrate window between page load and the authStore's
  //    initial rehydrate-from-localStorage tick.
  try {
    const raw = localStorage.getItem('apex-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Returns a `Storage`-compatible adapter that prefixes every key with
 * the current user's id. Pass into `createJSONStorage()` in the
 * Zustand `persist` config.
 *
 * @param storeName Reserved for future debugging (e.g. logging which
 *   store hit a quota error). Currently unused at runtime — the adapter
 *   reads the key name passed in by Zustand at each call site.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const scopedStorage = (storeName: string): Storage => ({
  get length() {
    return safeLocalStorage.length;
  },
  clear() {
    // Intentional no-op: a Zustand-driven `clear()` would otherwise
    // wipe ALL of localStorage (including other users' scoped keys
    // and `apex-auth`). Per-user cleanup is done explicitly via
    // `clearAllScopedKeysForUser`.
  },
  key(index: number) {
    return safeLocalStorage.key(index);
  },
  getItem(name: string): string | null {
    const userId = getCurrentUserId();
    if (!userId) return null;
    return safeLocalStorage.getItem(`${name}-${userId}`);
  },
  setItem(name: string, value: string): void {
    const userId = getCurrentUserId();
    if (!userId) return; // don't write anonymous-user data
    safeLocalStorage.setItem(`${name}-${userId}`, value);
  },
  removeItem(name: string): void {
    const userId = getCurrentUserId();
    if (!userId) return;
    safeLocalStorage.removeItem(`${name}-${userId}`);
  },
});

/**
 * Master list of every Zustand persist `name` that uses
 * {@link scopedStorage}. authStore (`apex-auth`) is intentionally
 * excluded — it stays globally keyed.
 *
 * Add new persisted stores here as they're introduced so the logout
 * cleanup in {@link clearAllScopedKeysForUser} covers them.
 */
export const USER_SCOPED_STORE_NAMES: readonly string[] = [
  'apex-workout',
  'apex-trainer',
  'apex-medals',
  'apex-social',
  'apex-messages',
  'apex-reports',
] as const;

/**
 * Removes every per-user scoped key for the given user. Called from
 * authStore.logout() (and deleteAccount) before the in-memory state
 * is reset, so the next login on this browser starts with a clean
 * localStorage for those store names.
 *
 * Also clears raw-localStorage keys that we scope per-user outside of
 * Zustand (gym list, custom exercises, payment settings) so the same
 * cross-account leakage doesn't happen via those paths.
 */
export function clearAllScopedKeysForUser(
  userId: string,
  storeNames: readonly string[] = USER_SCOPED_STORE_NAMES,
): void {
  if (typeof window === 'undefined') return;
  if (!userId) return;

  for (const name of storeNames) {
    try {
      localStorage.removeItem(`${name}-${userId}`);
    } catch (e) {
      console.warn(`[ScopedStorage] failed to remove ${name}-${userId}:`, e);
    }
  }

  // v16-D2: also clear raw per-user keys we scope outside of Zustand.
  // Keep this list in sync with the F3 raw-localStorage scoping in
  // app/profile/page.tsx, app/settings/page.tsx, app/workout/builder/page.tsx,
  // and app/payments/page.tsx.
  const rawScopedKeys = [
    `apex-gyms-${userId}`,
    `apex-custom-exercises-${userId}`,
    `apex-payment-settings-${userId}`,
  ];
  for (const key of rawScopedKeys) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[ScopedStorage] failed to remove ${key}:`, e);
    }
  }
}
