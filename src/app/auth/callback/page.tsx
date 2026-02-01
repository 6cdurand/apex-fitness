'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { loginWithSupabaseUser } = useAuthStore();
  const { loadFromSupabase } = useTrainerStore();
  const [status, setStatus] = useState('Processing sign-in...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from URL hash (Supabase OAuth returns tokens in URL)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthCallback] Error getting session:', error);
          setStatus('Sign-in failed. Redirecting...');
          setTimeout(() => router.push('/auth'), 2000);
          return;
        }

        if (!session?.user) {
          console.log('[AuthCallback] No session found, checking URL hash...');
          
          // Try to exchange code for session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          
          if (exchangeError || !data.session) {
            console.error('[AuthCallback] Exchange error:', exchangeError);
            setStatus('Sign-in failed. Redirecting...');
            setTimeout(() => router.push('/auth'), 2000);
            return;
          }
        }

        // Get fresh session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          const supabaseUser = currentSession.user;
          console.log('[AuthCallback] Got Supabase user:', supabaseUser.email);
          
          setStatus('Setting up your account...');
          
          // Login or register with our auth store
          const success = await loginWithSupabaseUser({
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            displayName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
            profilePhoto: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
          });

          if (success) {
            // Check if user has trainer data to load
            const user = useAuthStore.getState().user;
            if (user?.isTrainer || user?.mode === 'trainer') {
              setStatus('Loading trainer data...');
              await loadFromSupabase(user.id);
            }
            
            setStatus('Welcome! Redirecting...');
            router.push('/workout');
          } else {
            setStatus('Account setup failed. Redirecting...');
            setTimeout(() => router.push('/auth'), 2000);
          }
        } else {
          setStatus('No session found. Redirecting...');
          setTimeout(() => router.push('/auth'), 2000);
        }
      } catch (e) {
        console.error('[AuthCallback] Exception:', e);
        setStatus('An error occurred. Redirecting...');
        setTimeout(() => router.push('/auth'), 2000);
      }
    };

    handleCallback();
  }, [router, loginWithSupabaseUser, loadFromSupabase]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">{status}</p>
      </div>
    </div>
  );
}
