'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';

/**
 * OAuth callback — identity v2.
 *
 * Supabase Auth is canonical, so this page is a thin wrapper: wait for the
 * session to appear (Supabase exchanges the code automatically in detectSession
 * mode), then bootstrap the profile from public.users via the authStore.
 *
 * The on_auth_user_created trigger ensures a public.users row exists for
 * every auth.users row, so no per-device id-reconciliation logic is needed.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const { loadFromSupabase } = useTrainerStore();
  const [status, setStatus] = useState('Finishing sign-in…');

  useEffect(() => {
    const run = async () => {
      try {
        // Supabase JS auto-detects the session from the URL in the current
        // tab's localStorage — but for defensive coverage, also try the
        // explicit code-for-session exchange.
        const { data: first } = await supabase.auth.getSession();
        if (!first.session) {
          try {
            await supabase.auth.exchangeCodeForSession(window.location.href);
          } catch {
            // fall through; second getSession call below is authoritative.
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user) {
          console.error('[AuthCallback] no session after OAuth:', error?.message);
          setStatus('Sign-in failed. Redirecting…');
          setTimeout(() => router.replace('/auth'), 1200);
          return;
        }

        setStatus('Loading your profile…');
        await bootstrap();

        const user = useAuthStore.getState().user;
        if (!user) {
          console.error('[AuthCallback] bootstrap returned no user');
          setStatus('Profile not found. Redirecting…');
          setTimeout(() => router.replace('/auth'), 1200);
          return;
        }

        if (user.isTrainer || user.mode === 'trainer') {
          setStatus('Loading trainer data…');
          await loadFromSupabase(user.id);
        }

        setStatus('Welcome!');
        router.replace('/today');
      } catch (e) {
        console.error('[AuthCallback] exception:', e);
        setStatus('Something went wrong. Redirecting…');
        setTimeout(() => router.replace('/auth'), 1500);
      }
    };
    run();
  }, [router, bootstrap, loadFromSupabase]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">{status}</p>
      </div>
    </div>
  );
}
