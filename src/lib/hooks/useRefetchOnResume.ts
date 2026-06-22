'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * BUG-007 — refetch-on-resume (shared mechanism).
 *
 * A warm WebView shows whatever it loaded at cold start until force-quit:
 * there was no native `resume` listener (Capacitor `App`) and the web
 * `visibilitychange`/`focus` refetch was scattered per-screen. This is the
 * single shared hook that re-pulls Supabase data when the app comes back to
 * the foreground, fixing "must fully restart to see updates" (e.g. a
 * newly-booked session) and "notifications not syncing", and backstopping the
 * cold-start name race (a resume refetch re-resolves any name that lost the
 * boot race → BUG-008).
 *
 * Platform split (mirrors {@link NativeAuthLifecycle}):
 *  - Native (Capacitor WKWebView): `App.addListener('appStateChange')` →
 *    fire on `isActive`. `visibilitychange` is unreliable in the suspended
 *    WebView, which is exactly why the staleness bug only showed on device.
 *  - Web / PWA: `document` `visibilitychange` → `visible`, plus `window`
 *    `focus`. This is a harmless refetch — web already restored its session
 *    synchronously, so behaviour is unchanged beyond an extra read.
 *
 * Debounced (`debounceMs`) so a quick background→foreground flicker (or a
 * focus + visibilitychange firing back-to-back on web) doesn't double-fetch.
 * The latest `onResume` is always invoked via a ref so callers can pass an
 * inline closure without re-registering listeners every render.
 */
/**
 * Pure debounce gate — returns true if a resume firing `now` is far enough
 * past `lastFiredAt` to fire again. Extracted as a `__`-prefixed test seam so
 * the debounce contract is unit-testable without React / device lifecycle
 * (see `resumeStaleness.test.ts`).
 */
export function __shouldFireResume(lastFiredAt: number, now: number, debounceMs: number): boolean {
  return now - lastFiredAt >= debounceMs;
}

export function useRefetchOnResume(
  onResume: () => void,
  opts?: { debounceMs?: number; enabled?: boolean },
): void {
  const debounceMs = opts?.debounceMs ?? 800;
  const enabled = opts?.enabled ?? true;

  const onResumeRef = useRef(onResume);
  const lastFiredRef = useRef(0);

  // Keep the latest callback without re-registering listeners every render.
  // (Updating a ref in an effect, not during render — React Compiler safe.)
  useEffect(() => {
    onResumeRef.current = onResume;
  }, [onResume]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const fire = () => {
      const now = Date.now();
      if (!__shouldFireResume(lastFiredRef.current, now, debounceMs)) return;
      lastFiredRef.current = now;
      try {
        onResumeRef.current();
      } catch (e) {
        console.warn('[useRefetchOnResume] handler failed (non-fatal):', e);
      }
    };

    if (Capacitor.isNativePlatform()) {
      (async () => {
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) fire();
        });
        if (cancelled) {
          handle.remove();
          return;
        }
        cleanup = () => handle.remove();
      })();
    } else {
      const onVisible = () => {
        if (document.visibilityState === 'visible') fire();
      };
      window.addEventListener('focus', onVisible);
      document.addEventListener('visibilitychange', onVisible);
      cleanup = () => {
        window.removeEventListener('focus', onVisible);
        document.removeEventListener('visibilitychange', onVisible);
      };
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [debounceMs, enabled]);
}
