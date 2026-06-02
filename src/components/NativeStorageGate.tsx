'use client';

import { useEffect, useState } from 'react';
import { restoreNativeAuthKeys, isNativePersistenceActive } from '@/lib/capacitorStorage';

/**
 * v19-D1: on native, block render until auth keys are restored from
 * Preferences into localStorage, so the home gate (app/page.tsx) reads a
 * populated `apex-auth` instead of redirecting to /auth after WKWebView
 * eviction. On web/PWA this renders children immediately (no flash, no
 * delay) because `isNativePersistenceActive()` is false.
 */
export function NativeStorageGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => !isNativePersistenceActive());

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    restoreNativeAuthKeys().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    // Matches the existing app loading spinner (app/page.tsx:68-74).
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
