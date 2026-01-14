'use client';

import { useEffect } from 'react';
import { deleteAllUsersFromSupabase, clearAllLocalData, fullCleanup } from '@/lib/supabaseSync';

declare global {
  interface Window {
    apexCleanup: {
      deleteAllUsers: typeof deleteAllUsersFromSupabase;
      clearLocal: typeof clearAllLocalData;
      fullCleanup: typeof fullCleanup;
    };
  }
}

export function DevTools() {
  useEffect(() => {
    // Expose cleanup functions to window for console access
    window.apexCleanup = {
      deleteAllUsers: deleteAllUsersFromSupabase,
      clearLocal: clearAllLocalData,
      fullCleanup: fullCleanup,
    };
    
    console.log('[DevTools] Cleanup functions available:');
    console.log('  - window.apexCleanup.fullCleanup() - Delete all data (Supabase + localStorage)');
    console.log('  - window.apexCleanup.deleteAllUsers() - Delete users from Supabase only');
    console.log('  - window.apexCleanup.clearLocal() - Clear localStorage only');
  }, []);

  return null;
}
