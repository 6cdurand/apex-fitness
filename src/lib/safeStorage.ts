/**
 * Safe localStorage wrapper that catches QuotaExceededError.
 * Drop-in replacement for localStorage in Zustand createJSONStorage().
 * When write fails (quota), logs a warning but doesn't crash the app.
 */
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
    } catch (e: any) {
      console.warn(`[SafeStorage] setItem failed for "${key}" (${(value.length / 1024).toFixed(0)}KB):`, e?.name || e);
      // If quota exceeded, try to free space by removing non-critical cached data
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        try {
          // Remove backward-compat caches first (non-critical)
          localStorage.removeItem('apex-session-workouts');
          localStorage.removeItem('apex-profile-cache');
          // Retry the write once
          localStorage.setItem(key, value);
          console.log(`[SafeStorage] ✅ Recovered after clearing caches`);
        } catch {
          console.error(`[SafeStorage] ❌ Still over quota after cleanup for "${key}"`);
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
