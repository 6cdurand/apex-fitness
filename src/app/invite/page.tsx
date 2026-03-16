'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { checkInvitationByToken, acceptInvitation } from '@/lib/supabaseSync';
import { useAuthStore } from '@/lib/store';
import { Loader2, CheckCircle, XCircle, Dumbbell } from 'lucide-react';

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated, user } = useAuthStore();
  
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'accepted'>('loading');
  const [inviteData, setInviteData] = useState<{ trainerId?: string; email?: string } | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }

      try {
        const result = await checkInvitationByToken(token);
        
        if (result.valid && result.email) {
          setInviteData({ trainerId: result.trainerId, email: result.email });
          setStatus('valid');
          return;
        }
      } catch (e) {
        console.error('[Invite] Token check failed:', e);
      }
      
      // If Supabase check failed or returned invalid, redirect to auth with token
      // The auth page will show the password setup flow if email param is present
      const emailFromUrl = searchParams.get('email');
      if (emailFromUrl) {
        router.replace(`/auth?invite=${token}&email=${encodeURIComponent(emailFromUrl)}`);
      } else {
        // No email available — redirect to auth anyway with just the token
        router.replace(`/auth?invite=${token}`);
      }
    };

    verifyToken();
  }, [token, router, searchParams]);

  const handleAcceptInvite = async () => {
    if (!token) return;

    if (isAuthenticated && user) {
      // User is logged in - accept invite and link account
      const success = await acceptInvitation(token, user.id);
      if (success) {
        setStatus('accepted');
        setTimeout(() => router.push('/today'), 2000);
      }
    } else {
      // User needs to sign up/login first - redirect to auth with invite token + email
      const emailParam = inviteData?.email ? `&email=${encodeURIComponent(inviteData.email)}` : '';
      router.push(`/auth?invite=${token}${emailParam}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-sky-600 via-sky-500 to-teal-500 px-6 pt-12 pb-8">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 max-w-md mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
            <Dumbbell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Catalift FITNESS</h1>
          <p className="text-sky-100">Train Smarter. Get Stronger.</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md bg-white border-gray-200 shadow-sm">
          <CardHeader className="text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
                <CardTitle className="text-white">Verifying Invitation</CardTitle>
                <CardDescription>Please wait while we verify your invitation...</CardDescription>
              </>
            )}

            {status === 'valid' && (
              <>
                <div className="w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-sky-500" />
                </div>
                <CardTitle className="text-white">You&apos;re Invited!</CardTitle>
                <CardDescription>
                  Your trainer has invited you to join Catalift to track your workouts and progress.
                </CardDescription>
              </>
            )}

            {status === 'invalid' && (
              <>
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <CardTitle className="text-white">Invalid Invitation</CardTitle>
                <CardDescription>
                  This invitation link is invalid or has already been used.
                </CardDescription>
              </>
            )}

            {status === 'expired' && (
              <>
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-amber-500" />
                </div>
                <CardTitle className="text-white">Invitation Expired</CardTitle>
                <CardDescription>
                  This invitation has expired. Please ask your trainer to send a new one.
                </CardDescription>
              </>
            )}

            {status === 'accepted' && (
              <>
                <div className="w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-sky-500" />
                </div>
                <CardTitle className="text-white">Welcome to Catalift!</CardTitle>
                <CardDescription>
                  Your account has been linked. Redirecting you to the app...
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {status === 'valid' && (
              <div className="space-y-4">
                {inviteData?.email && (
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500 mb-1">Invitation sent to</p>
                    <p className="text-gray-900 font-medium">{inviteData.email}</p>
                  </div>
                )}

                <Button
                  onClick={handleAcceptInvite}
                  className="w-full bg-sky-500 hover:bg-sky-600"
                >
                  {isAuthenticated ? 'Accept Invitation' : 'Sign Up & Accept'}
                </Button>

                {!isAuthenticated && (
                  <p className="text-xs text-gray-500 text-center">
                    Already have an account?{' '}
                    <button
                      onClick={() => router.push(`/auth?invite=${token}&mode=login`)}
                      className="text-sky-400 hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            )}

            {(status === 'invalid' || status === 'expired') && (
              <Button
                onClick={() => router.push('/auth')}
                variant="outline"
                className="w-full border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Go to Sign Up
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  );
}
