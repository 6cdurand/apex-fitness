import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { safeLocalStorage } from './safeStorage';

/**
 * v19-D1: Native-backed persistence bridge.
 *
 * WHY: iOS WKWebView evicts localStorage for the REMOTE origin we load
 * (https://catalift.net via Capacitor server.url) on force-quit / under
 * ITP. Auth lives only in localStorage (`apex-auth` + `sb-*-auth-token`),
 * so eviction logs the user out. We mirror ONLY the auth keys to
 * Capacitor Preferences (iOS UserDefaults — survives eviction) and read
 * them back at boot.
 *
 * SAFE EVERYWHERE: every native path is gated on
 * `Capacitor.isPluginAvailable('Preferences')`. On web/PWA and on an iOS
 * build WITHOUT the native plugin, this is false => pure localStorage,
 * identical to pre-v19 behaviour. So this file is inert until the
 * v19-fix-02 iOS build ships the plugin.
 */

// Keys whose loss logs the user out. We deliberately mirror ONLY these —
// NOT bulky per-user caches (apex-workout-*, etc.), which belong in
// Supabase and would bloat UserDefaults.
const MIRRORED_PREFIXES = ['apex-auth', 'sb-'];

function isMirroredKey(key: string): boolean {
  return MIRRORED_PREFIXES.some((p) => key === p || key.startsWith(p));
}

let _pluginAvailable: boolean | null = null;

/** True only inside a native Capacitor app WITH the Preferences plugin. */
export function isNativePersistenceActive(): boolean {
  if (_pluginAvailable !== null) return _pluginAvailable;
  try {
    _pluginAvailable =
      typeof window !== 'undefined' &&
      Capacitor?.isNativePlatform?.() === true &&
      Capacitor?.isPluginAvailable?.('Preferences') === true;
  } catch {
    _pluginAvailable = false;
  }
  return _pluginAvailable;
}

function mirrorSet(key: string, value: string): void {
  if (!isNativePersistenceActive() || !isMirroredKey(key)) return;
  void Preferences.set({ key, value }).catch((e) =>
    console.warn('[CapStorage] Preferences.set failed (non-fatal):', key, e),
  );
}

function mirrorRemove(key: string): void {
  if (!isNativePersistenceActive() || !isMirroredKey(key)) return;
  void Preferences.remove({ key }).catch((e) =>
    console.warn('[CapStorage] Preferences.remove failed (non-fatal):', key, e),
  );
}

/**
 * SYNC Storage for Zustand persist (`apex-auth`). Reads/writes localStorage
 * synchronously (so the synchronous `localStorage.getItem('apex-auth')` in
 * app/page.tsx still works) and write-through-mirrors mirrored keys to
 * Preferences. Boot restore (`restoreNativeAuthKeys`) repopulates
 * localStorage from Preferences before any route mounts.
 */
export const nativeMirroredStorage: Storage = {
  get length() {
    return safeLocalStorage.length;
  },
  clear() {
    // Intentionally does NOT mass-clear Preferences — auth removal flows
    // through removeItem (logout / deleteAccount), which mirrors precisely.
    safeLocalStorage.clear();
  },
  key(index: number) {
    return safeLocalStorage.key(index);
  },
  getItem(key: string): string | null {
    return safeLocalStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    safeLocalStorage.setItem(key, value);
    mirrorSet(key, value);
  },
  removeItem(key: string): void {
    safeLocalStorage.removeItem(key);
    mirrorRemove(key);
  },
};

/**
 * ASYNC storage adapter for the Supabase auth client. On native it reads
 * the source of truth (Preferences) DIRECTLY, so the client's own
 * session recovery reads the real token regardless of boot timing — no
 * restore race. On web it falls back to localStorage.
 */
export const capacitorAsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isNativePersistenceActive()) {
      try {
        const { value } = await Preferences.get({ key });
        return value ?? null;
      } catch (e) {
        console.warn('[CapStorage] async getItem fell back to localStorage:', key, e);
      }
    }
    return typeof window !== 'undefined' ? safeLocalStorage.getItem(key) : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isNativePersistenceActive()) {
      try {
        await Preferences.set({ key, value });
        return;
      } catch (e) {
        console.warn('[CapStorage] async setItem fell back to localStorage:', key, e);
      }
    }
    if (typeof window !== 'undefined') safeLocalStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (isNativePersistenceActive()) {
      try {
        await Preferences.remove({ key });
      } catch (e) {
        console.warn('[CapStorage] async removeItem Preferences failed:', key, e);
      }
    }
    if (typeof window !== 'undefined') safeLocalStorage.removeItem(key);
  },
};

let _restorePromise: Promise<void> | null = null;

/**
 * Boot restore for the SYNC-read key(s): copy mirrored keys from
 * Preferences back into localStorage BEFORE any route reads auth. Only
 * fills keys that localStorage is missing (never clobbers a fresher
 * in-session value). Idempotent; memoized so concurrent callers share one
 * pass. No-op (resolves immediately) when native persistence is inactive.
 */
export function restoreNativeAuthKeys(): Promise<void> {
  if (_restorePromise) return _restorePromise;
  _restorePromise = (async () => {
    if (!isNativePersistenceActive() || typeof window === 'undefined') return;
    try {
      const { keys } = await Preferences.keys();
      for (const key of keys) {
        if (!isMirroredKey(key)) continue;
        if (safeLocalStorage.getItem(key) != null) continue; // keep fresher value
        const { value } = await Preferences.get({ key });
        if (value != null) safeLocalStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('[CapStorage] restoreNativeAuthKeys failed (non-fatal):', e);
    }
  })();
  return _restorePromise;
}
