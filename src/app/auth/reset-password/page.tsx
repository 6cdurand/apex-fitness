'use client';

/**
 * @deprecated v15-D6 (2026-05-25): this page handles the legacy custom-token
 *   recovery flow (Edge Function `password-recovery`, Phase 0.5 from
 *   2026-05-06). New recovery emails route through Supabase Auth and land
 *   on `/auth/update-password`. This page is retained so emails sent BEFORE
 *   the v15-D6 merge still verify for ~24h. Delete in a follow-up sprint
 *   once all in-flight recovery emails have aged out.
 *
 * Magic-link password recovery — landing page for the Resend email's reset
 * link (Phase 0.5, 2026-05-06). Spec: PLAN_magic_link_recovery.md §Frontend.
 *
 * URL: /auth/reset-password?token=<64-char-hex>
 *
 * Flow:
 *  1. On mount, read `?token=` from the URL.
 *  2. Call the `password-recovery` Edge Function with `{ action: 'verify' }`.
 *  3. If the token is valid, strip the token from the URL via
 *     `router.replace()` so it does not leak via Referer headers, browser
 *     history, or screen-sharing; show the new-password form (with the
 *     associated account email displayed so the user can confirm).
 *  4. On submit, call the same function with `{ action: 'commit' }` to
 *     write the new `public.users.password_hash` via the server-side
 *     service-role path. On success, toast + redirect to `/auth`.
 *  5. Any verify/commit failure leaves the user on this page with an
 *     actionable error and a link back to `/auth`.
 *
 * The page itself never reads or writes any Supabase table directly —
 * everything routes through the Edge Function. That keeps the service-role
 * key server-side and keeps the UI enumeration-safe.
 */

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  | { kind: 'valid'; email: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'submitting'; email: string }
  | { kind: 'success'; email: string }
  | { kind: 'error'; email: string; message: string };

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Capture the token ONCE at first render and stash it on a ref. After
  // verify succeeds we call `router.replace('/auth/reset-password')` to
  // strip the plaintext token from the URL (security: no Referer leak, no
  // screen-sharing leak, no browser-history leak). If we kept reading
  // `searchParams.get('token')` on every render, the commit action would
  // fire with an empty token after the URL rewrite and fail.
  const tokenRef = useRef<string>(searchParams.get('token') || '');
  const token = tokenRef.current;

  const [phase, setPhase] = useState<Phase>({ kind: 'verifying' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Guard against React 19 strict-mode double-invoke: we only want one
  // verify round-trip per mount even though the effect body may fire twice.
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    if (!token) {
      // Missing token → bounce back to /auth with a neutral error. This is
      // the same outcome as an invalid token; attackers gain no information
      // by crafting a tokenless URL.
      setPhase({ kind: 'invalid', message: 'Missing recovery link. Please request a new one.' });
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('password-recovery', {
          body: { action: 'verify', token },
        });
        if (error) {
          setPhase({ kind: 'invalid', message: 'Invalid or expired link. Request a new one.' });
          return;
        }
        const payload = data as { success?: boolean; email?: string; error?: string };
        if (!payload?.success || !payload.email) {
          setPhase({
            kind: 'invalid',
            message: payload?.error || 'Invalid or expired link. Request a new one.',
          });
          return;
        }

        // Token validated — strip the plaintext token from the URL. We keep
        // the pathname the same so a user reload does not re-trigger verify
        // (the next verify would succeed until commit consumes the token,
        // which is harmless but wasteful).
        router.replace('/auth/reset-password');
        setPhase({ kind: 'valid', email: payload.email });
      } catch (e) {
        console.error('[reset-password] verify threw:', e);
        setPhase({
          kind: 'invalid',
          message: 'Could not verify recovery link. Please try again.',
        });
      }
    })();
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== 'valid') return;

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
    try {
      const { data, error } = await supabase.functions.invoke('password-recovery', {
        body: { action: 'commit', token, new_password: newPassword },
      });
      if (error) {
        setPhase({
          kind: 'error',
          email: phase.email,
          message: 'Could not update password. The link may have expired — please request a new one.',
        });
        return;
      }
      const payload = data as { success?: boolean; error?: string };
      if (!payload?.success) {
        setPhase({
          kind: 'error',
          email: phase.email,
          message: payload?.error || 'Could not update password. Please request a new link.',
        });
        return;
      }

      setPhase({ kind: 'success', email: phase.email });
      toast.success('Password updated. Please sign in.');
      // Small delay so the user sees the success state before the redirect.
      window.setTimeout(() => {
        router.replace('/auth');
      }, 1200);
    } catch (e) {
      console.error('[reset-password] commit threw:', e);
      setPhase({
        kind: 'error',
        email: phase.email,
        message: 'Network error. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl rounded-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <CataliftLogo className="h-10 w-auto" />
          </div>
          <CardTitle className="text-white">Reset Your Password</CardTitle>
          <CardDescription className="text-gray-400">
            {phase.kind === 'verifying' && 'Verifying your recovery link…'}
            {phase.kind === 'valid' && `Set a new password for ${phase.email}`}
            {phase.kind === 'submitting' && 'Updating your password…'}
            {phase.kind === 'success' && 'Password updated. Redirecting to sign in…'}
            {phase.kind === 'error' && phase.message}
            {phase.kind === 'invalid' && phase.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {phase.kind === 'verifying' && (
            <div className="flex justify-center py-6" data-testid="reset-verifying">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
          )}

          {phase.kind === 'invalid' && (
            <div className="space-y-4 text-center" data-testid="reset-invalid">
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

          {(phase.kind === 'valid' || phase.kind === 'submitting' || phase.kind === 'error') && (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="reset-form">
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
                <p className="text-xs text-gray-500">
                  At least {PASSWORD_MIN_LENGTH} characters.
                </p>
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
                <p className="text-sm text-red-400" data-testid="reset-error">
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
            <div className="flex flex-col items-center gap-4 py-6" data-testid="reset-success">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
              <p className="text-sm text-gray-300">Redirecting to sign in…</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
