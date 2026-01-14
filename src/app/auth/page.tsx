'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Dumbbell, ChevronRight, ChevronLeft, User, Scale, Ruler, Calendar } from 'lucide-react';
import { Gender } from '@/types';

type Step = 'credentials' | 'profile' | 'goals';

export default function AuthPage() {
  const router = useRouter();
  const { login, register, isLoading } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<Step>('credentials');
  
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(loginEmail, loginPassword);
    if (success) {
      toast.success('Welcome back!');
      router.push('/workout');
    } else {
      toast.error('Invalid email or password');
    }
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
    }
  };

  const handlePrevStep = () => {
    if (step === 'profile') setStep('credentials');
    else if (step === 'goals') setStep('profile');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    });

    if (success) {
      toast.success('Account created successfully!');
      router.push('/workout');
    } else {
      toast.error('Email already exists');
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
      toast.success('Welcome to APEX Fitness!');
      router.push('/workout');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col overflow-auto">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-6 pt-12 pb-8 flex-shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 max-w-md mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
            <Dumbbell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">APEX FITNESS</h1>
          <p className="text-emerald-100">Train Smarter. Get Stronger.</p>
        </div>
      </div>

      {/* Auth Card */}
      <div className="flex-1 px-4 py-6">
        <Card className="max-w-md mx-auto bg-gray-900 border-gray-800 shadow-2xl">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'login' | 'register'); setStep('credentials'); }}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="login" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                Create Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <CardHeader>
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
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
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
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-gray-900 px-2 text-gray-500">or</span>
                    </div>
                  </div>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleDemoLogin}
                    className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    Continue as Demo User
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      // Clear all localStorage and reload to reinitialize
                      localStorage.clear();
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
                  {step === 'goals' && 'Final Step'}
                </CardTitle>
                <CardDescription>
                  {step === 'credentials' && 'Start your fitness journey today'}
                  {step === 'profile' && 'Help us personalize your experience'}
                  {step === 'goals' && 'Choose your path'}
                </CardDescription>
                {/* Progress indicator */}
                <div className="flex gap-2 mt-4">
                  {['credentials', 'profile', 'goals'].map((s, i) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        ['credentials', 'profile', 'goals'].indexOf(step) >= i
                          ? 'bg-emerald-500'
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={step === 'goals' ? handleRegister : (e) => { e.preventDefault(); handleNextStep(); }}>
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
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
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
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
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
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
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
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
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
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-300">Gender</Label>
                        <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
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
                            className="bg-gray-800 border-gray-700 text-white pl-10"
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
                              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pl-10"
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
                              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pl-10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 'goals' && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-gray-800 border border-gray-700">
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
                            className="data-[state=checked]:bg-emerald-500"
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

                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <h4 className="font-semibold text-emerald-400 mb-2">What you&apos;ll get:</h4>
                        <ul className="space-y-2 text-sm text-gray-300">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Advanced workout logging & tracking
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Strength ratings & medals system
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Social features & community
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Weekly progress reports
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    {step !== 'credentials' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrevStep}
                        className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                      disabled={isLoading}
                    >
                      {step === 'goals' ? (isLoading ? 'Creating...' : 'Create Account') : 'Continue'}
                      {step !== 'goals' && <ChevronRight className="w-4 h-4 ml-1" />}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
