'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/lib/supabase';
import { restoreNativeAuthKeys } from '@/lib/capacitorStorage';

/**
 * v19-fix-08 — iOS ~1-hour logout fix.
 *
 * In the Capacitor WKWebView, backgrounding suspends the webview so
 * supabase-js's `autoRefreshToken` timer never fires, and on resume its
 * `visibilitychange`-based refresh doesn't trigger either. The ~1h-expired
 * access token is therefore never refreshed and the user gets logged out.
 *
 * We drive token refresh off the NATIVE app lifecycle instead:
 *  - cold boot (after auth keys are restored): `startAutoRefresh()`.
 *  - resume (`isActive`): `startAutoRefresh()` + `getSession()` — the latter
 *    forces a refresh if the access token expired while backgrounded, as long
 *    as the refresh token is still valid, re-arming the session.
 *  - background: `stopAutoRefresh()` (the timer can't run while suspended).
 *
 * Strictly gated on `Capacitor.isNativePlatform()` so web/PWA behaviour is
 * completely unchanged. Renders nothing. Logout / delete-account flows are
 * untouched — sign-out still clears the session normally.
 */
export function NativeAuthLifecycle() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let removeListener: (() => void) | undefined;

    (async () => {
      // Cold boot: make sure the restored session keys are in place before we
      // arm the refresher (idempotent + memoized; no-op on web).
      await restoreNativeAuthKeys();
      if (cancelled) return;
      try {
        await supabase.auth.startAutoRefresh();
      } catch (e) {
        console.warn('[NativeAuthLifecycle] startAutoRefresh at boot failed (non-fatal):', e);
      }

      const handle = await App.addListener('appStateChange', async ({ isActive }) => {
        try {
          if (isActive) {
            await supabase.auth.startAutoRefresh();
            // Refreshes the access token if it expired while backgrounded
            // (refresh token still valid). No-op if the token is still fresh.
            await supabase.auth.getSession();
          } else {
            await supabase.auth.stopAutoRefresh();
          }
        } catch (e) {
          console.warn('[NativeAuthLifecycle] appStateChange handler failed (non-fatal):', e);
        }
      });

      if (cancelled) {
        handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  return null;
}
