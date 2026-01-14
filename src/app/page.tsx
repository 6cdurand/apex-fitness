'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { initializeSeedData } from '@/lib/seedData';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isSeeding, setIsSeeding] = useState(true);

  useEffect(() => {
    // Simple seed check - only seed once
    const seedVersion = localStorage.getItem('apex-seed-version');
    
    if (seedVersion !== 'v7') {
      // Clear ALL old data and re-seed with new version
      ['apex-seeded', 'apex-seed-version', 'apex-users', 'apex-workout', 'apex-medals', 'apex-auth', 'apex-social', 'apex-trainer', 'apex-messages'].forEach(k => localStorage.removeItem(k));
      initializeSeedData();
      localStorage.setItem('apex-seed-version', 'v7');
      // Small delay to let localStorage settle before reload
      setTimeout(() => window.location.reload(), 50);
      return;
    }
    
    setIsSeeding(false);
  }, []);

  useEffect(() => {
    if (isSeeding) return;
    
    // Route based on auth state
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/workout');
      } else {
        router.replace('/auth');
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, router, isSeeding]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">Loading APEX Fitness...</p>
      </div>
    </div>
  );
}
