'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, useTrainerStore, hashPassword } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, User, Scale, Ruler, Calendar, Mail, Heart, Smartphone, CreditCard, Link2, Check } from 'lucide-react';
import { CataliftLogo } from '@/components/CataliftLogo';
import { Gender } from '@/types';
import { supabase } from '@/lib/supabase';
import { acceptInvitation, checkInvitationByToken, updatePasswordInSupabase, updateUserInSupabase } from '@/lib/supabaseSync';
import { Loader2 } from 'lucide-react';

type Step = 'credentials' | 'profile' | 'goals' | 'connections';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const modeParam = searchParams.get('mode');
  
  const { login, signInWithPassword, register, isLoading, user, updatePassword, resetPassword } = useAuthStore();

  // Local loading state for OAuth (Supabase's signInWithOAuth returns
  // after initiating the redirect; the button would otherwise look
  // inactive while the browser navigates to Google).
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { loadFromSupabase } = useTrainerStore();
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(modeParam === 'login' ? 'login' : 'login');
  const [step, setStep] = useState<Step>('credentials');
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteClientId, setInviteClientId] = useState<string | null>(null);
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [setupNewPassword, setSetupNewPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  
  // Check invite token and pre-fill email
  const emailParam = searchParams.get('email');
  useEffect(() => {
    if (inviteToken) {
      // Try Supabase lookup first
      checkInvitationByToken(inviteToken).then((result) => {
        if (result.valid && result.email) {
          setInviteEmail(result.email);
          setLoginEmail(result.email);
          if (result.clientId) setInviteClientId(result.clientId);
          setShowSetupPassword(true);
        } else if (emailParam) {
          // Fallback: use email from URL param (always works, even without Supabase table)
          const decodedEmail = decodeURIComponent(emailParam);
          setInviteEmail(decodedEmail);
          setLoginEmail(decodedEmail);
          setShowSetupPassword(true);
        }
      }).catch(() => {
        // If Supabase check fails entirely, use email param
        if (emailParam) {
          const decodedEmail = decodeURIComponent(emailParam);
          setInviteEmail(decodedEmail);
          setLoginEmail(decodedEmail);
          setShowSetupPassword(true);
        }
      });
    } else if (emailParam) {
      // No invite token but email param present — still show setup
      const decodedEmail = decodeURIComponent(emailParam);
      setInviteEmail(decodedEmail);
      setLoginEmail(decodedEmail);
      setShowSetupPassword(true);
    }
  }, [inviteToken, emailParam]);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [isTrainer, setIsTrainer] = useState(false);
  
  // Connections (onboarding step 4)
  const [onboardConnections, setOnboardConnections] = useState<Record<string, boolean>>({
    appleHealth: false,
    googleHealth: false,
    calendar: false,
    stripe: false,
  });

  // Handle client password setup from invite link
  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    if (setupNewPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (setupNewPassword !== setupConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setIsSettingUp(true);
    
    // Step 1: Check if a placeholder account exists locally — force-set password and login
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const placeholderIdx = storedUsers.findIndex((u: any) =>
      u.email?.toLowerCase() === inviteEmail.toLowerCase() &&
      (u.accountStatus === 'placeholder' || u.email?.endsWith('@placeholder.local'))
    );
    
    if (placeholderIdx !== -1) {
      // Force-set the password to the new one (placeholder passwords are random/unknown)
      storedUsers[placeholderIdx].password = hashPassword(setupNewPassword);
      storedUsers[placeholderIdx].accountStatus = 'active';
      localStorage.setItem('apex-users', JSON.stringify(storedUsers));
      await updatePasswordInSupabase(inviteEmail, setupNewPassword);
    }
    
    // Step 2: Try login with the chosen password
    const loginSuccess = await login(inviteEmail, setupNewPassword);
    
    if (loginSuccess) {
      // Upgrade placeholder → active
      const lu1 = useAuthStore.getState().user;
      if (lu1) {
        await updateUserInSupabase(lu1.id, { accountStatus: 'active' } as any);
        useAuthStore.getState().updateUser({ accountStatus: 'active' });
      }
      if (inviteToken && lu1) {
        await acceptInvitation(inviteToken, lu1.id);
      }
      toast.success('Password set! Welcome to Catalift!');
      router.push(lu1 && !lu1.height && !lu1.weight ? '/onboarding/client' : '/today');
      setIsSettingUp(false);
      return;
    }
    
    // Step 3: Account doesn't exist at all — register as new user
    const registered = await register({
      id: inviteClientId || undefined,
      email: inviteEmail,
      password: setupNewPassword,
      username: inviteEmail.split('@')[0],
      displayName: inviteEmail.split('@')[0],
    } as any);
    
    if (registered) {
      const lu2 = useAuthStore.getState().user;
      if (lu2) {
        await updateUserInSupabase(lu2.id, { accountStatus: 'active' } as any);
        useAuthStore.getState().updateUser({ accountStatus: 'active' });
      }
      if (inviteToken && lu2) {
        await acceptInvitation(inviteToken, lu2.id);
      }
      toast.success('Account created! Welcome to Catalift!');
      router.push('/onboarding/client');
      setIsSettingUp(false);
      return;
    }
    
    // All else failed — show login form
    setShowSetupPassword(false);
    toast.info('Please sign in or create an account');
    setIsSettingUp(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmail.trim();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    const ok = await resetPassword(email);
    if (ok) {
      // Don't leak account existence: always show the same success state.
      setForgotSent(true);
      toast.success('If that email is registered, a reset link is on its way');
    } else {
      // Network / config failure only — still show the generic message.
      setForgotSent(true);
      toast.success('If that email is registered, a reset link is on its way');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use signInWithPassword directly so we can show a specific error
    // reason (the back-compat `login` shim only returns a boolean).
    const result = await signInWithPassword(loginEmail, loginPassword);
    if (!result.ok) {
      // profile_missing: credentials are fine but no public.users row
      // can be loaded. Route to /auth/recovery so the user has a
      // concrete path forward instead of bouncing on a toast.
      if (result.reason === 'profile_missing') {
        toast.error('Profile needs attention — redirecting…');
        router.push('/auth/recovery');
        return;
      }
      const msg =
        result.reason === 'invalid_credentials' ? 'Invalid email or password'
        : result.reason === 'email_not_confirmed' ? 'Please confirm your email first. Check your inbox for a verification link.'
        : result.message || 'Sign-in failed. Please try again.';
      toast.error(msg);
      return;
    }

    toast.success('Welcome back!');

    // Load data from Supabase for cross-device sync
    const loggedInUser = useAuthStore.getState().user;
    if (loggedInUser?.mode === 'trainer' || loggedInUser?.isTrainer) {
      console.log('[Auth] Loading trainer data from Supabase...');
      loadFromSupabase(loggedInUser.id);
    }

    // Handle invite token if present
    if (inviteToken && loggedInUser) {
      console.log('[Auth] Accepting invitation...');
      const accepted = await acceptInvitation(inviteToken, loggedInUser.id);
      if (accepted) {
        toast.success('Invitation accepted! You are now connected with your trainer.');
      }
    }

    router.push('/workout');
  };

  const handleNextStep = () => {
    if (step === 'credentials') {
      if (!email || !username || !password) {
        toast.error('Please fill in all fields');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      setStep('profile');
    } else if (step === 'profile') {
      setStep('goals');
    } else if (step === 'goals') {
      setStep('connections');
    }
  };

  const handlePrevStep = () => {
    if (step === 'profile') setStep('credentials');
    else if (step === 'goals') setStep('profile');
    else if (step === 'connections') setStep('goals');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build health connections from onboarding selections
    const healthConnections: Record<string, any> = {};
    if (onboardConnections.appleHealth) healthConnections.appleHealth = { connected: true, lastSync: new Date().toISOString() };
    if (onboardConnections.googleHealth) healthConnections.googleHealth = { connected: true, lastSync: new Date().toISOString() };
    if (onboardConnections.calendar) healthConnections.calendar = { connected: true };
    if (onboardConnections.stripe) healthConnections.stripe = { connected: true };
    
    const success = await register({
      email,
      username,
      password,
      displayName: displayName || username,
      gender,
      dateOfBirth,
      height: height ? parseFloat(height) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      isTrainer,
      healthConnections: Object.keys(healthConnections).length > 0 ? healthConnections : undefined,
    });

    if (success) {
      toast.success('Account created successfully!');
      router.push('/workout');
    } else {
      toast.error('Email already exists');
    }
  };

  // Google Sign-In with Supabase Auth
  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[Auth] Google sign-in error:', error);
        toast.error(`Google sign-in failed: ${error.message}`);
        setIsGoogleLoading(false);
        return;
      }

      // signInWithOAuth triggers a full-page navigation to Google; keep
      // the loading state until the redirect actually happens. If for
      // any reason we're still on this page after 8s, unstick the UI.
      setTimeout(() => setIsGoogleLoading(false), 8000);
    } catch (e: any) {
      console.error('[Auth] Google sign-in exception:', e);
      toast.error(`Google sign-in failed: ${e?.message ?? 'unknown error'}`);
      setIsGoogleLoading(false);
    }
  };

  // Quick login for testing - auto-create a demo user
  const handleDemoLogin = async () => {
    const demoEmail = 'demo@apex.fitness';
    const demoPassword = 'demo123';
    
    // Try to login first
    let success = await login(demoEmail, demoPassword);
    
    if (!success) {
      // Create demo account if doesn't exist
      await register({
        email: demoEmail,
        username: 'demo_user',
        password: demoPassword,
        displayName: 'Demo User',
        gender: 'male',
        height: 175,
        weight: 75,
        isTrainer: true,
      });
      success = true;
    }
    
    if (success) {
      toast.success('Welcome to Catalift!');
      router.push('/workout');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-auto">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-sky-600 via-sky-500 to-orange-400 px-6 pt-16 pb-12 flex-shrink-0 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white_1px,transparent_1px)] bg-[length:32px_32px]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-md mx-auto text-center">
          <div className="flex justify-center mb-2">
            <CataliftLogo size="lg" />
          </div>
        </div>
      </div>

      {/* Auth Card */}
      <div className="flex-1 px-5 py-8 -mt-6">
        <Card className="max-w-md mx-auto bg-slate-900/95 border-slate-800/50 shadow-2xl shadow-black/50 backdrop-blur-sm rounded-2xl">
          {/* Password Setup Flow — shown when client follows invite link */}
          {showSetupPassword && inviteEmail ? (
            <>
              <CardHeader>
                <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                  <p className="text-sky-400 text-sm font-medium">🎉 Welcome to Catalift!</p>
                  <p className="text-gray-400 text-xs mt-1">Your trainer has invited you. Set up your password to get started.</p>
                </div>
                <CardTitle className="text-white">Set Up Your Account</CardTitle>
                <CardDescription>Create a password to access your training</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSetupPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Email</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      disabled
                      className="bg-gray-50 border-gray-200 text-gray-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Create Password</Label>
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={setupNewPassword}
                      onChange={(e) => setSetupNewPassword(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Confirm Password</Label>
                    <Input
                      type="password"
                      placeholder="Re-enter your password"
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                    disabled={isSettingUp}
                  >
                    {isSettingUp ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up...</>
                    ) : (
                      'Create Account & Sign In'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-gray-500 hover:text-gray-300 text-xs"
                    onClick={() => setShowSetupPassword(false)}
                  >
                    Already have a password? Sign in instead
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'login' | 'register'); setStep('credentials'); }}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 rounded-xl p-1">
              <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20 transition-all duration-200">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20 transition-all duration-200">
                Create Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <CardHeader>
                {inviteEmail && (
                  <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                    <p className="text-sky-400 text-sm font-medium">🎉 You&apos;ve been invited!</p>
                    <p className="text-gray-400 text-xs mt-1">Sign in with your credentials to connect with your trainer.</p>
                  </div>
                )}
                <CardTitle className="text-white">Welcome Back</CardTitle>
                <CardDescription>Sign in to continue your fitness journey</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-gray-300">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-gray-300">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setForgotEmail(loginEmail); }}
                    className="w-full text-center text-xs text-gray-500 hover:text-sky-400 transition-colors mt-1"
                  >
                    Forgot password?
                  </button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-gray-500">or continue with</span>
                    </div>
                  </div>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                    className="w-full border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                  >
                    {isGoogleLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Redirecting to Google…</>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleDemoLogin}
                    className="w-full border-sky-500/50 text-sky-400 hover:bg-sky-500/10 mt-2"
                  >
                    Continue as Demo User
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      // Full-fresh-start: clear Supabase session first
                      // (otherwise a stale auth cookie re-hydrates on
                      // reload and the app never reaches the logged-out
                      // state), then wipe localStorage, then reload.
                      try {
                        await supabase.auth.signOut();
                      } catch (err) {
                        console.error('[Auth] signOut during reset:', err);
                      }
                      try {
                        localStorage.clear();
                      } catch {
                        /* ignore */
                      }
                      toast.success('Data cleared! Reloading...');
                      setTimeout(() => window.location.reload(), 500);
                    }}
                    className="w-full text-gray-500 hover:text-gray-300 text-xs mt-2"
                  >
                    Having issues? Reset app data
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="register" className="mt-0">
              <CardHeader>
                <CardTitle className="text-white">
                  {step === 'credentials' && 'Create Account'}
                  {step === 'profile' && 'About You'}
                  {step === 'goals' && 'Your Path'}
                  {step === 'connections' && 'Connect Your Data'}
                </CardTitle>
                <CardDescription>
                  {step === 'credentials' && 'Start your fitness journey today'}
                  {step === 'profile' && 'Help us personalize your experience'}
                  {step === 'goals' && 'Choose your path'}
                  {step === 'connections' && 'Optional — connect health & services'}
                </CardDescription>
                {/* Progress indicator */}
                <div className="flex gap-2 mt-4">
                  {['credentials', 'profile', 'goals', 'connections'].map((s, i) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        ['credentials', 'profile', 'goals', 'connections'].indexOf(step) >= i
                          ? 'bg-sky-500'
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={step === 'connections' ? handleRegister : (e) => { e.preventDefault(); handleNextStep(); }}>
                  {step === 'credentials' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-300">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-gray-300">Username</Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="fitnessfan123"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-gray-300">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-gray-300">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {step === 'profile' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-gray-300">Display Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input
                            id="displayName"
                            type="text"
                            placeholder="John Doe"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-300">Gender</Label>
                        <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                          <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-200">
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dob" className="text-gray-300">Date of Birth</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input
                            id="dob"
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className="bg-gray-50 border-gray-200 text-gray-900 pl-10"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="height" className="text-gray-300">Height (cm)</Label>
                          <div className="relative">
                            <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                              id="height"
                              type="number"
                              placeholder="175"
                              value={height}
                              onChange={(e) => setHeight(e.target.value)}
                              className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 pl-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="weight" className="text-gray-300">Weight (kg)</Label>
                          <div className="relative">
                            <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                              id="weight"
                              type="number"
                              placeholder="70"
                              value={weight}
                              onChange={(e) => setWeight(e.target.value)}
                              className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 pl-10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 'goals' && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-white">Are you a Personal Trainer?</h3>
                            <p className="text-sm text-gray-400 mt-1">
                              Access trainer tools to manage clients
                            </p>
                          </div>
                          <Switch
                            checked={isTrainer}
                            onCheckedChange={setIsTrainer}
                            className="data-[state=checked]:bg-sky-500"
                          />
                        </div>
                      </div>

                      {isTrainer && (
                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                          <p className="text-rose-400 text-sm">
                            <strong>Trainer Mode</strong> unlocks client management, workout assignment, 
                            calendar scheduling, and progress tracking features.
                          </p>
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        <h4 className="font-semibold text-sky-400 mb-2">What you&apos;ll get:</h4>
                        <ul className="space-y-2 text-sm text-gray-300">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            Advanced workout logging & tracking
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            Strength ratings & medals system
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            Social features & community
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            Weekly progress reports
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {step === 'connections' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 mb-2">
                        Connect now or skip — you can always change this in Settings later.
                      </p>

                      {/* Apple Health */}
                      <button
                        type="button"
                        onClick={() => setOnboardConnections(c => ({ ...c, appleHealth: !c.appleHealth }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          onboardConnections.appleHealth
                            ? 'bg-red-500/10 border-red-500/40'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <Heart className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-white text-sm">Apple Health</p>
                          <p className="text-[11px] text-gray-500">Steps, calories, heart rate, sleep</p>
                        </div>
                        {onboardConnections.appleHealth && <Check className="w-5 h-5 text-red-400" />}
                      </button>

                      {/* Google/Samsung Health */}
                      <button
                        type="button"
                        onClick={() => setOnboardConnections(c => ({ ...c, googleHealth: !c.googleHealth }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          onboardConnections.googleHealth
                            ? 'bg-green-500/10 border-green-500/40'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <Smartphone className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-white text-sm">Google / Samsung Health</p>
                          <p className="text-[11px] text-gray-500">Steps, calories, heart rate</p>
                        </div>
                        {onboardConnections.googleHealth && <Check className="w-5 h-5 text-green-400" />}
                      </button>

                      {/* Calendar */}
                      <button
                        type="button"
                        onClick={() => setOnboardConnections(c => ({ ...c, calendar: !c.calendar }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          onboardConnections.calendar
                            ? 'bg-blue-500/10 border-blue-500/40'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-white text-sm">Calendar</p>
                          <p className="text-[11px] text-gray-500">Sync workouts to your phone calendar</p>
                        </div>
                        {onboardConnections.calendar && <Check className="w-5 h-5 text-blue-400" />}
                      </button>

                      {/* Stripe — only show if trainer selected */}
                      {isTrainer && (
                        <button
                          type="button"
                          onClick={() => setOnboardConnections(c => ({ ...c, stripe: !c.stripe }))}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            onboardConnections.stripe
                              ? 'bg-purple-500/10 border-purple-500/40'
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-white text-sm">Stripe</p>
                            <p className="text-[11px] text-gray-500">Accept payments from clients</p>
                          </div>
                          {onboardConnections.stripe && <Check className="w-5 h-5 text-purple-400" />}
                        </button>
                      )}

                      <p className="text-[11px] text-gray-600 text-center pt-1">
                        Real-time sync available when the native app is installed
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    {step !== 'credentials' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrevStep}
                        className="flex-1 border-gray-200 text-gray-500 hover:bg-gray-50"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
                      disabled={isLoading}
                    >
                      {step === 'connections' ? (isLoading ? 'Creating...' : 'Create Account') : 'Continue'}
                      {step !== 'connections' && <ChevronRight className="w-4 h-4 ml-1" />}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
          )}
        </Card>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl rounded-2xl">
            <CardHeader>
              <CardTitle className="text-white">Reset Password</CardTitle>
              <CardDescription>
                {forgotSent
                  ? 'Check your inbox for a reset link'
                  : 'Enter your email and we’ll send you a reset link'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {!forgotSent && (
                  <div className="space-y-2">
                    <Label className="text-gray-300">Email</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                )}
                {forgotSent ? (
                  <div className="text-sm text-gray-400 space-y-2">
                    <p>We’ve sent a reset link to <span className="text-sky-400">{forgotEmail}</span>.</p>
                    <p>Open the email on this device and click the link to choose a new password.</p>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                  >
                    Send reset link
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-500 hover:text-gray-300 text-sm"
                  onClick={() => { setShowForgotPassword(false); setForgotEmail(''); setForgotSent(false); }}
                >
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
