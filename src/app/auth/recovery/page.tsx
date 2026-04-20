'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, RefreshCw, LogOut, Copy, Check } from 'lucide-react';

/**
 * Profile recovery page.
 *
 * Reached when Supabase Auth succeeds but the app can't load a
 * public.users row for the session (either genuinely missing, or an
 * identity-link conflict that PGRST116 surfaces). The callback page
 * and the password-signin handler both redirect here rather than
 * sitting on an infinite spinner.
 *
 * The page itself never mutates DB rows — reconciliation requires
 * service-role access and is done operator-side via
 * supabase/manual_followups.sql. What this page CAN do:
 *   1. Show the user their Supabase auth email + uid (so they can
 *      include it when contacting support).
 *   2. Offer a clean sign-out (clears both Supabase session and
 *      persisted Zustand state) so they can try again fresh.
 *   3. Offer a full local-data reset if step 2 doesn't help.
 */
export default function AuthRecoveryPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const [session, setSession] = useState<{ email: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          setSession({
            email: data.session.user.email ?? '(no email)',
            id: data.session.user.id,
          });
        }
      } catch (e) {
        console.error('[Auth Recovery] getSession error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopyId = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.id);
      setCopied(true);
      toast.success('Auth ID copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('[Auth Recovery] signOut error:', e);
    }
    router.replace('/auth');
  };

  const handleResetApp = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth Recovery] signOut during reset:', e);
    }
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    toast.success('Local data cleared. Reloading…');
    setTimeout(() => window.location.replace('/auth'), 500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-5 py-10">
      <Card className="max-w-md w-full bg-slate-900/95 border-slate-800/50 shadow-2xl shadow-black/50 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <CardTitle className="text-white">Profile needs attention</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            Sign-in succeeded, but your profile record couldn&apos;t be loaded.
            This is usually a one-time data issue. Try the steps below.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your session…
            </div>
          ) : session ? (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 text-sm space-y-2">
              <div>
                <div className="text-gray-400 text-xs">Signed in as</div>
                <div className="text-white font-medium break-all">{session.email}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Auth ID (include when emailing support)</div>
                <div className="flex items-start gap-2">
                  <code className="text-gray-300 text-xs font-mono break-all flex-1">
                    {session.id}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="shrink-0 p-1 rounded text-gray-400 hover:text-sky-400 hover:bg-slate-700/50 transition-colors"
                    aria-label="Copy auth id"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 text-sm text-gray-300">
              No active session. Try signing in again.
            </div>
          )}

          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-sm text-gray-300 space-y-1">
            <p className="font-medium text-sky-300">What to try</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-300">
              <li>Sign out and sign in again (most issues clear up here).</li>
              <li>
                If the problem persists, email{' '}
                <a
                  href="mailto:support@catalift.app"
                  className="text-sky-400 underline"
                >
                  support@catalift.app
                </a>{' '}
                with the Auth ID above.
              </li>
              <li>As a last resort, reset local data and try again.</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={handleSignOut}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out and try again
            </Button>
            <Button
              onClick={handleResetApp}
              variant="outline"
              className="w-full border-slate-700 text-gray-300 hover:bg-slate-800 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset local data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
