'use client';

/**
 * Privacy & Security settings page (Sev-1, 2026-05-06).
 *
 * Wires the previously non-functional "Privacy & Security" button on
 * `/settings` to a real page that satisfies:
 *
 *  - App Store Guideline 5.1.1 (all visible settings controls must work).
 *  - NZ Privacy Act 2020 Principle 3 (transparency) and Principle 6
 *    (right to access personal information).
 *  - GDPR Article 15 (right of access by the data subject).
 *
 * Scope (explicitly narrow — see PR description + command-center ticket):
 *
 *  1. Change Password    → invokes the Phase 0.5 magic-link Edge Function
 *                          (`password-recovery` action=request). Mirrors
 *                          the `handleForgotPassword` flow in
 *                          `src/app/auth/page.tsx` so users can self-serve
 *                          a reset without going back to the auth screen.
 *
 *  2. Your Data          → static transparency copy. Enumerates the
 *                          categories the app collects (account profile,
 *                          workouts + sets, PBs, messages, trainer-client
 *                          links, Stripe customer id, session timestamps).
 *
 *  3. Request a Copy     → `mailto:` to the ops inbox. JSON export is
 *                          Phase 1; until then a human in ops fulfils
 *                          requests within the NZ Privacy Act's 20 working
 *                          day window. `DATA_EXPORT_EMAIL` is pending MX
 *                          provisioning (tracked in command-center BACKLOG);
 *                          links will bounce until the mailbox is live.
 *
 *  4. Legal              → placeholder links to `/legal/privacy` and
 *                          `/legal/terms`. Those routes don't exist yet —
 *                          tracked as separate tickets.
 *
 * OUT OF SCOPE for this PR (DO NOT add here, see separate Sev-1 tickets):
 *
 *  - Account deletion UI. `deleteAccount()` in authStore.ts only clears
 *    localStorage today; it does NOT delete the row in `public.users` or
 *    any of the child tables (workouts, messages, trainer-client links,
 *    Stripe customer, etc.). Shipping a "Delete my account" button here
 *    would create a false impression of compliance. Tracked separately.
 *
 *  - Real JSON data export. Mailto is the stop-gap.
 *
 *  - Notification preference writes. Reads still live on `/settings`;
 *    rewiring them has its own ticket.
 */

import React, { Suspense, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Key, Database, Download, FileText, ChevronLeft, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import {
  CHANGE_PASSWORD_COOLDOWN_MS,
  buildDataExportMailto,
  buildPasswordRecoveryRequestBody,
} from './helpers';

// ---------------------------------------------------------------------------
// Test-seam helpers live in a sibling module so unit tests can import them
// without dragging in React, Zustand persist, or the Supabase client at
// module-load time. Re-exported here so external callers (e.g., settings/
// page.tsx) can keep importing from `./privacy/page` — the import
// statement `import { PRIVACY_SETTINGS_ROUTE } from './privacy/page'`
// continues to resolve through this barrel.
// ---------------------------------------------------------------------------

export {
  PRIVACY_SETTINGS_ROUTE,
  DATA_EXPORT_EMAIL,
  CHANGE_PASSWORD_COOLDOWN_MS,
  buildPasswordRecoveryRequestBody,
  buildDataExportMailto,
} from './helpers';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PrivacySettingsPage() {
  return (
    <Suspense fallback={null}>
      <PrivacySettingsContent />
    </Suspense>
  );
}

function PrivacySettingsContent() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  // Cooldown guard — mirrors the auth page's `isSubmittingForgot` plus a
  // short post-success lockout. We use a ref-backed state flag so the
  // render is cheap and the re-enable timer can be cancelled on unmount.
  const [isSending, setIsSending] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);

  // Auth gate: mirror `/settings` — null-guard + soft redirect. Avoids
  // flashing the page content to unauthenticated visitors.
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    return () => {
      if (cooldownTimerRef.current !== null) {
        window.clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  if (!isAuthenticated || !user) return null;

  const handleSendRecoveryLink = async () => {
    if (isSending) return;
    const email = (user.email || '').trim();
    if (!email) {
      toast.error('Your account has no email on file. Contact support.');
      return;
    }

    setIsSending(true);
    try {
      // Same enumeration-safe path as auth/page.tsx handleForgotPassword:
      // the Edge Function returns neutral 200 JSON for known / unknown /
      // rate-limited / Resend-failed outcomes; we only distinguish
      // "reached the function" (show success toast) from "network error"
      // (show retryable error).
      const { error } = await supabase.functions.invoke('password-recovery', {
        body: buildPasswordRecoveryRequestBody(email),
      });
      if (error) {
        console.error('[settings/privacy] password-recovery request failed:', error);
        toast.error('Something went wrong. Try again later.');
        setIsSending(false);
        return;
      }
      toast.success(`Recovery link sent to ${email}. Check your inbox.`);
      // Hold the cooldown so a jumpy double-click doesn't fire a second
      // request before the first toast lands. The Edge Function's own
      // 3-in-15min rate limit is the real defence.
      cooldownTimerRef.current = window.setTimeout(() => {
        setIsSending(false);
        cooldownTimerRef.current = null;
      }, CHANGE_PASSWORD_COOLDOWN_MS);
    } catch (err) {
      console.error('[settings/privacy] password-recovery threw:', err);
      toast.error('Something went wrong. Try again later.');
      setIsSending(false);
    }
  };

  const handleEmailMyData = () => {
    window.location.href = buildDataExportMailto(user.email || '');
  };

  // Back button: pop history when there is any (the in-app
  // /menu → /settings → /settings/privacy path, which is the 99% case),
  // fall back to /settings only on a deep-link / fresh-tab landing
  // (e.g. shared URL). Using router.push('/settings') unconditionally
  // pushes a duplicate history entry so the browser's own back button
  // returns to /settings/privacy. Reported by Christo, 2026-05-05.
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/settings');
    }
  };

  return (
    <MainLayout>
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-black min-h-screen">
        {/* Header — back button + title. Mirrors the settings subpage style
            used elsewhere in the app; we don't reuse the main-settings
            PageHeader because it renders the avatar card which doesn't fit
            a subpage context. */}
        <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-5 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="text-gray-300 hover:text-white hover:bg-slate-800"
            aria-label="Back to Settings"
            data-testid="privacy-back-button"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-white">Privacy &amp; Security</h1>
            <p className="text-xs text-gray-400">Manage your account security and data rights</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 space-y-4 pb-24">
          {/* Card 1 — Change Password */}
          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-change-password">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Key className="w-5 h-5 text-sky-500" />
                Change Password
              </CardTitle>
              <CardDescription className="text-gray-500">
                We&apos;ll email you a secure link to set a new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                onClick={handleSendRecoveryLink}
                disabled={isSending}
                data-testid="send-recovery-button"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send password recovery link
                  </>
                )}
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                For security, we&apos;ll send the link to the email on your account
                ({user.email || 'no email on file'}).
              </p>
            </CardContent>
          </Card>

          {/* Card 2 — Your Data */}
          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-your-data">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Database className="w-5 h-5 text-sky-500" />
                Your Data
              </CardTitle>
              <CardDescription className="text-gray-500">What we collect</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                <li>Account info (email, display name, gender, DOB, height, weight)</li>
                <li>Workouts and sets/reps/weights</li>
                <li>Personal bests</li>
                <li>Messages and conversations</li>
                <li>Trainer-client relationships (if applicable)</li>
                <li>Stripe customer id (if payments are active)</li>
                <li>Device and session timestamps</li>
              </ul>
              <p className="mt-4 text-xs text-gray-500">
                All data is stored in Supabase (EU region) and encrypted in transit.
                See the Privacy Policy for retention and sharing details.
              </p>
            </CardContent>
          </Card>

          {/* Card 3 — Request a Copy */}
          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-data-export">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Download className="w-5 h-5 text-sky-500" />
                Request a Copy of Your Data
              </CardTitle>
              <CardDescription className="text-gray-500">
                Under the NZ Privacy Act 2020 and GDPR Article 15, you can request a
                full copy of your Catalift data at any time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-sky-500 text-sky-600 hover:bg-sky-50"
                onClick={handleEmailMyData}
                data-testid="email-my-data-button"
              >
                <Mail className="w-4 h-4 mr-2" />
                Email me my data
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                We&apos;ll respond within 20 working days.
              </p>
            </CardContent>
          </Card>

          {/* Card 4 — Legal */}
          {/* NOTE: /legal/privacy and /legal/terms routes don't exist yet.
              Tracked as separate tickets; these links will 404 until those
              pages ship. Intentional — surfacing the link at all is still
              more compliant than hiding it entirely. */}
          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-legal">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <FileText className="w-5 h-5 text-sky-500" />
                Legal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/legal/privacy"
                className="block text-sm text-sky-600 hover:text-sky-700 underline"
                data-testid="link-privacy-policy"
              >
                Privacy Policy
              </Link>
              <Link
                href="/legal/terms"
                className="block text-sm text-sky-600 hover:text-sky-700 underline"
                data-testid="link-terms-of-service"
              >
                Terms of Service
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    </MainLayout>
  );
}
