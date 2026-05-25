'use client';

/**
 * v15-D6 (2026-05-25): landing page for Supabase Auth's
 * `resetPasswordForEmail` redirect. Supabase places a recovery session in
 * the URL hash; this page reads it via `onAuthStateChange` (event ==
 * 'PASSWORD_RECOVERY'), accepts a new password, and calls
 * `supabase.auth.updateUser({ password })`. Replaces the legacy custom
 * Edge-Function recovery flow at /auth/reset-password (kept around so
 * pre-v15-D6 emails still verify until they age out).
 */

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CataliftLogo } from '@/components/CataliftLogo';
import { supabase } from '@/lib/supabase';
import { validatePasswordForRecovery, PASSWORD_MIN_LENGTH } from '@/lib/passwordRecovery';

type Phase =
  | { kind: 'verifying' }
  | { kind: 'ready'; email: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'submitting'; email: string }
  | { kind: 'success'; email: string }
  | { kind: 'error'; email: string; message: string };

function UpdatePasswordContent() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>({ kind: 'verifying' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Guard against React 19 strict-mode double-invoke.
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Supabase parses the URL hash on client init. If the hash contains a
    // recovery token, `getSession()` returns that session AND the
    // `onAuthStateChange` listener fires PASSWORD_RECOVERY. We listen for
    // either pathway so the page works on first paint and on hash-deferred
    // init.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[update-password] onAuthStateChange:', event);
      if (event === 'PASSWORD_RECOVERY' && session?.user?.email) {
        setPhase({ kind: 'ready', email: session.user.email });
      } else if (event === 'SIGNED_IN' && session?.user?.email) {
        // Hash-recovery sometimes surfaces as SIGNED_IN. Treat as ready
        // if we don't have a phase yet.
        setPhase((curr) =>
          curr.kind === 'verifying' ? { kind: 'ready', email: session.user.email! } : curr
        );
      }
    });

    // Fallback poll: if hash parse already happened before our listener
    // attached, getSession returns the recovery user directly.
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[update-password] getSession error:', error.message);
        setPhase({ kind: 'invalid', message: 'Recovery link is missing or expired. Please request a new one.' });
        return;
      }
      if (data?.session?.user?.email) {
        setPhase((curr) =>
          curr.kind === 'verifying' ? { kind: 'ready', email: data.session!.user.email! } : curr
        );
      } else {
        // No session = no valid recovery token in URL. Wait briefly for
        // the listener; if it never fires, treat as invalid.
        window.setTimeout(() => {
          setPhase((curr) =>
            curr.kind === 'verifying'
              ? { kind: 'invalid', message: 'Recovery link is missing or expired. Please request a new one.' }
              : curr
          );
        }, 1500);
      }
    })();

    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== 'ready') return;

    const validation = validatePasswordForRecovery(newPassword);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setPhase({ kind: 'submitting', email: phase.email });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error('[update-password] updateUser error:', error.message);
      setPhase({
        kind: 'error',
        email: phase.email,
        message: 'Could not update password. The link may have expired — please request a new one.',
      });
      return;
    }

    setPhase({ kind: 'success', email: phase.email });
    toast.success('Password updated. Please sign in.');
    // Sign the recovery session out so the user logs in fresh with the
    // new password.
    await supabase.auth.signOut();
    window.setTimeout(() => router.replace('/auth'), 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl rounded-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <CataliftLogo className="h-10 w-auto" />
          </div>
          <CardTitle className="text-white">Update Your Password</CardTitle>
          <CardDescription className="text-gray-400">
            {phase.kind === 'verifying' && 'Verifying your recovery link…'}
            {phase.kind === 'ready' && `Set a new password for ${phase.email}`}
            {phase.kind === 'submitting' && 'Updating your password…'}
            {phase.kind === 'success' && 'Password updated. Redirecting to sign in…'}
            {phase.kind === 'error' && phase.message}
            {phase.kind === 'invalid' && phase.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {phase.kind === 'verifying' && (
            <div className="flex justify-center py-6" data-testid="update-verifying">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
          )}

          {phase.kind === 'invalid' && (
            <div className="space-y-4 text-center" data-testid="update-invalid">
              <p className="text-sm text-gray-400">
                If your link has expired, return to the sign-in page and request a new recovery email.
              </p>
              <Button
                type="button"
                className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                onClick={() => router.replace('/auth')}
              >
                Back to Sign In
              </Button>
            </div>
          )}

          {(phase.kind === 'ready' || phase.kind === 'submitting' || phase.kind === 'error') && (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="update-form">
              <div className="space-y-2">
                <Label className="text-gray-300">New Password</Label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  disabled={phase.kind === 'submitting'}
                  autoFocus
                />
                <p className="text-xs text-gray-500">At least {PASSWORD_MIN_LENGTH} characters.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  disabled={phase.kind === 'submitting'}
                />
              </div>
              {phase.kind === 'error' && (
                <p className="text-sm text-red-400" data-testid="update-error">
                  {phase.message}
                </p>
              )}
              <Button
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                disabled={phase.kind === 'submitting'}
              >
                {phase.kind === 'submitting' ? 'Updating…' : 'Update Password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-500 hover:text-gray-300 text-sm"
                onClick={() => router.replace('/auth')}
                disabled={phase.kind === 'submitting'}
              >
                Cancel
              </Button>
            </form>
          )}

          {phase.kind === 'success' && (
            <div className="flex flex-col items-center gap-4 py-6" data-testid="update-success">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
              <p className="text-sm text-gray-300">Redirecting to sign in…</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
