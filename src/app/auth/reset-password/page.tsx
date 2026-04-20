'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Password-reset landing page.
 *
 * Supabase Auth can deliver the recovery link in any of three shapes,
 * depending on which email template the project uses:
 *
 *   1. Implicit (hash) flow
 *      → URL ends with `#access_token=...&refresh_token=...&type=recovery`
 *      The JS SDK consumes the hash automatically (`detectSessionInUrl`)
 *      and fires a `PASSWORD_RECOVERY` event.
 *
 *   2. PKCE (code) flow
 *      → URL ends with `?code=<PKCE-code>`
 *      We must call `supabase.auth.exchangeCodeForSession(url)` to trade
 *      the code for a session.
 *
 *   3. Token-hash / OTP flow (newer default in many projects)
 *      → URL ends with `?token_hash=<HASH>&type=recovery`
 *      We must call `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`.
 *
 * In all three cases the page lands with a recovery session, and we can
 * then set a new password via `supabase.auth.updateUser({ password })`.
 *
 * If none of the above produces a session, the link has expired or was
 * never allowlisted in Supabase → show an actionable error, not a
 * mysterious "Link expired" screen.
 */
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [phase, setPhase] = useState<'exchanging' | 'ready' | 'error'>('exchanging');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const consumedRef = useRef(false);

  // Surface Supabase-returned errors (e.g. ?error=access_denied) immediately.
  const errorParam = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    let cancelled = false;

    // Short-circuit if Supabase already told us something went wrong.
    if (errorParam) {
      console.error('[reset-password] Supabase returned error params:', {
        errorParam, errorCode, errorDescription,
      });
      setErrorDetail(errorDescription?.replace(/\+/g, ' ') || errorParam);
      setPhase('error');
      return;
    }

    // Subscribe early — the SDK may fire PASSWORD_RECOVERY before we even
    // finish exchangeCodeForSession in the PKCE branch.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      console.log('[reset-password] onAuthStateChange:', event, 'hasSession=', !!session);
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setPhase('ready');
      }
    });

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const type = url.searchParams.get('type');
        const hash = window.location.hash || '';

        console.log('[reset-password] diagnosing URL:', {
          hasCode: !!code,
          hasTokenHash: !!tokenHash,
          type,
          hashStartsWithAccessToken: hash.startsWith('#access_token='),
          hashHasTypeRecovery: /type=recovery/.test(hash),
        });

        // (1) PKCE / code-grant flow
        if (code) {
          console.log('[reset-password] Exchanging PKCE code for session…');
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw new Error(`exchangeCodeForSession: ${error.message}`);
          if (!cancelled) setPhase('ready');
          return;
        }

        // (2) token_hash / OTP flow
        if (tokenHash && (type === 'recovery' || type === 'email_change' || type === 'magiclink' || !type)) {
          console.log('[reset-password] Verifying token_hash (recovery)…');
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (error) throw new Error(`verifyOtp: ${error.message}`);
          if (!cancelled) setPhase('ready');
          return;
        }

        // (3) Implicit hash flow — SDK auto-consumes the hash on load.
        //     Wait briefly for PASSWORD_RECOVERY / SIGNED_IN, or check getSession.
        if (hash.includes('access_token') || hash.includes('type=recovery')) {
          console.log('[reset-password] Waiting for SDK to consume hash…');
          // Give the SDK up to ~3s to process the hash.
          for (let i = 0; i < 30; i++) {
            if (cancelled) return;
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              if (!cancelled) setPhase('ready');
              return;
            }
            await new Promise((r) => setTimeout(r, 100));
          }
          throw new Error('SDK did not produce a session from the recovery hash in time');
        }

        // (4) Already signed in with a recovery session (e.g. hard refresh on this page)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          console.log('[reset-password] Pre-existing session detected.');
          if (!cancelled) setPhase('ready');
          return;
        }

        // Nothing to exchange → link is invalid or the allowlist rejected it.
        throw new Error('missing_recovery_token');
      } catch (e: any) {
        console.error('[reset-password] failed:', e?.message ?? e);
        if (cancelled) return;
        setErrorDetail(e?.message === 'missing_recovery_token'
          ? 'This page was opened without a valid recovery token. Make sure you opened the link from your email in this browser.'
          : (e?.message ?? String(e)));
        setPhase('error');
      }
    };

    run();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [errorParam, errorCode, errorDescription]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      console.error('[reset-password] updateUser failed:', error);
      toast.error(error.message || 'Could not update password');
      return;
    }
    toast.success('Password updated');
    await bootstrap();
    // Clean up the URL so a refresh doesn't reattempt the recovery flow.
    window.history.replaceState({}, '', '/today');
    router.replace('/today');
  };

  if (phase === 'exchanging') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Verifying your reset link…</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-5">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Reset link not accepted</CardTitle>
            <CardDescription className="text-gray-400">
              {errorDetail || 'The reset link is no longer valid.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Reset links expire after an hour and can only be used once. Request a new one and open it on this device.
            </p>
            <Button className="w-full bg-sky-500 hover:bg-sky-600" onClick={() => router.replace('/auth')}>
              Request a new link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-5">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white">Choose a new password</CardTitle>
          <CardDescription>You’re signed in with a recovery link. Set a new password to finish.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">New password</Label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
                minLength={8}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Confirm</Label>
              <Input
                type="password"
                placeholder="Re-enter new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white" disabled={submitting}>
              {submitting ? 'Saving…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
