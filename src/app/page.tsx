'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // One-time migration: catalift-* → apex-* localStorage keys
    const oldUsers = localStorage.getItem('catalift-users');
    const oldWorkout = localStorage.getItem('catalift-workout');
    if (oldUsers && !localStorage.getItem('apex-users')) {
      localStorage.setItem('apex-users', oldUsers);
    }
    if (oldWorkout && !localStorage.getItem('apex-workout')) {
      localStorage.setItem('apex-workout', oldWorkout);
    }
    // Clean up old keys after migration
    localStorage.removeItem('catalift-users');
    localStorage.removeItem('catalift-workout');
    localStorage.removeItem('catalift-workout-storage');

    // Check and set seed version (seed data is disabled)
    const seedVersion = localStorage.getItem('apex-seed-version');
    
    if (seedVersion !== 'v7') {
      // Clear old data and set new version
      // v19-D1: 'apex-auth' removed — auth must never be cleared by a seed-version bump.
      ['apex-seeded', 'apex-seed-version', 'apex-users', 'apex-workout', 'apex-medals', 'apex-social', 'apex-trainer', 'apex-messages'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('apex-seed-version', 'v7');
    }
    
    // Small delay to ensure stores are hydrated
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 200);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    
    // Check auth state directly from localStorage
    try {
      const authData = localStorage.getItem('apex-auth');
      const auth = authData ? JSON.parse(authData) : null;
      const isAuthenticated = auth?.state?.isAuthenticated || false;
      
      console.log('[Home] Auth check:', { isAuthenticated, hasAuth: !!auth });
      
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/today');
        } else {
          router.replace('/auth');
        }
      }, 100);
      
      return () => clearTimeout(timer);
    } catch (e) {
      console.error('[Home] Auth check error:', e);
      router.replace('/auth');
    }
  }, [isReady, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">Loading Apex...</p>
      </div>
    </div>
  );
}
