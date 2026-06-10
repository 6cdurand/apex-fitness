/**
 * Safe localStorage wrapper that catches QuotaExceededError.
 * Drop-in replacement for localStorage in Zustand createJSONStorage().
 * When write fails (quota), logs a warning but doesn't crash the app.
 */

// Auth/session keys that must NEVER be evicted. Losing these silently drops
// the Supabase session => the app falls back to the `anon` role => every
// authenticated write fails with RLS 42501 (BUG: "Supabase rejected the save").
// The Supabase session token is `sb-<ref>-auth-token`; the app auth store is
// `apex-auth`.
const PROTECTED_PREFIXES = ['apex-auth', 'sb-'];

function isProtectedKey(key: string): boolean {
  return PROTECTED_PREFIXES.some((p) => key === p || key.startsWith(p));
}

/**
 * Free localStorage space by evicting bulky, re-fetchable caches (everything
 * that is NOT an auth/session key and not the key we're trying to write).
 * Largest entries first, so we reclaim the most room with the fewest deletes.
 * Auth keys are never touched. Returns the number of keys removed.
 */
function evictNonAuthCaches(targetKey: string): number {
  const candidates: Array<{ key: string; size: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k === targetKey || isProtectedKey(k)) continue;
    const v = localStorage.getItem(k);
    candidates.push({ key: k, size: v ? v.length : 0 });
  }
  candidates.sort((a, b) => b.size - a.size);
  let removed = 0;
  for (const { key } of candidates) {
    try {
      localStorage.removeItem(key);
      removed++;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

export const safeLocalStorage: Storage = {
  get length() {
    return localStorage.length;
  },
  clear() {
    localStorage.clear();
  },
  key(index: number) {
    return localStorage.key(index);
  },
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] getItem failed for "${key}":`, e);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
      return;
    } catch (e: any) {
      const isQuota = e?.name === 'QuotaExceededError' || e?.code === 22;
      if (!isQuota) {
        console.warn(`[SafeStorage] setItem failed for "${key}":`, e?.name || e);
        return;
      }
      console.warn(`[SafeStorage] quota hit writing "${key}" (${(value.length / 1024).toFixed(0)}KB) — evicting non-auth caches`);
      // Quota exceeded. Evict bulky, re-fetchable caches (NEVER auth/session
      // keys) and retry. This guarantees the Supabase session token can always
      // persist, even when per-user workout caches have filled the quota —
      // otherwise the session is silently dropped and the app falls back to the
      // `anon` role, breaking every authenticated write with RLS 42501.
      const removed = evictNonAuthCaches(key);
      try {
        localStorage.setItem(key, value);
        console.log(`[SafeStorage] ✅ Recovered after evicting ${removed} cache key(s) for "${key}"`);
        return;
      } catch {
        // Still no room. If this IS an auth key, sacrifice EVERYTHING non-auth
        // (already done) — the failure now means the auth blob alone exceeds
        // quota, which shouldn't happen. For non-auth bulky writes, give up
        // silently: the data is a cache and will be re-fetched from Supabase.
        if (isProtectedKey(key)) {
          console.error(`[SafeStorage] ❌ Could not persist AUTH key "${key}" even after full cache eviction`);
        }
      }
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] removeItem failed for "${key}":`, e);
    }
  },
};
