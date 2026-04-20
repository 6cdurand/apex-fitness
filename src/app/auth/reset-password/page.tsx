'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
 * Supabase Auth redirects the user here from the recovery email. The JS SDK
 * automatically consumes the `#access_token=...&type=recovery` hash and
 * creates a recovery session. While that recovery session is active, the
 * user can call `supabase.auth.updateUser({ password })` to set a new one.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // On mount: see whether Supabase handed us a recovery session.
    // PASSWORD_RECOVERY events fire when the hash contains type=recovery.
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') setHasRecoverySession(true);
    });
    // Also check the current session so a hard refresh works.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) setHasRecoverySession(true);
      else setHasRecoverySession(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
      toast.error(error.message || 'Could not update password');
      return;
    }
    toast.success('Password updated');
    await bootstrap();
    router.replace('/today');
  };

  if (hasRecoverySession === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-5">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Link expired</CardTitle>
            <CardDescription>This reset link is no longer valid. Request a new one from the sign-in page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-sky-500 hover:bg-sky-600" onClick={() => router.replace('/auth')}>
              Back to sign-in
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
