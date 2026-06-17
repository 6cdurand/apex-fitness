'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

/**
 * Shared auth gate that waits for zustand-persist rehydration before
 * deciding to redirect (BUG-005b).
 *
 * WHY: `useAuthStore` initialises `isAuthenticated: false` and restores the
 * persisted session asynchronously — the `apex-auth` store writes through
 * `createJSONStorage(() => nativeMirroredStorage)`, which on a native build
 * is repopulated from Capacitor Preferences at boot. The legacy inline guard
 * `useEffect(() => { if (!isAuthenticated) router.replace('/auth'); }, ...)`
 * ran on the raw `isAuthenticated`, so on a hard load / direct link it fired
 * before rehydration landed and bounced an already-logged-in user to /auth.
 * Soft (in-app) navigation was fine because the store was already hydrated
 * in memory.
 *
 * The fix gates the redirect on a `hydrated` flag driven by Zustand's persist
 * hydration API (`hasHydrated()` / `onFinishHydration`), NOT on a synchronous
 * localStorage assumption — `nativeMirroredStorage` may rehydrate
 * asynchronously.
 *
 * `hydrated` initialises `false` on both the server and the client's first
 * paint (SSR-safe — avoids a hydration mismatch and matches the existing
 * convention in profile/reports) and flips true once persist finishes.
 * Consumers gate BOTH the redirect (handled here) and their own render on the
 * returned flags so the authed UI never flashes during the hydration window:
 *
 *   const { hydrated, isAuthenticated } = useRequireAuth();
 *   if (!hydrated || !isAuthenticated) return null; // or the page's loader
 */
export function useRequireAuth(): { hydrated: boolean; isAuthenticated: boolean } {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    const markHydrated = () => {
      if (active) setHydrated(true);
    };
    // Fires once persist finishes rehydrating (may be async on native, where
    // nativeMirroredStorage is repopulated from Capacitor Preferences).
    const unsubscribe = useAuthStore.persist.onFinishHydration(markHydrated);
    // Web path: persist rehydrated synchronously before this effect ran (it
    // wraps localStorage), so onFinishHydration won't fire again. Flip the
    // flag on a microtask rather than synchronously inside the effect body.
    if (useAuthStore.persist.hasHydrated()) queueMicrotask(markHydrated);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/auth');
    }
  }, [hydrated, isAuthenticated, router]);

  return { hydrated, isAuthenticated };
}
