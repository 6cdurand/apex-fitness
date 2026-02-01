'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrainerStore, useAuthStore, useSocialStore } from '@/lib/store';
import { registerUserToSupabase, fetchAllUsersFromSupabase, syncSessionPackageToSupabase } from '@/lib/supabaseSync';
import { toast } from 'sonner';
import { 
  TrainingGoal, 
  InjuryFlag, 
  ExperienceLevel, 
  TrainingPhase,
  ClientProgrammingProfile 
} from '@/types';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Target, 
  Activity, 
  AlertTriangle, 
  Calendar, 
  Dumbbell,
  Heart,
  Zap,
  User,
  Mail,
  Lock,
  CheckCircle2,
  Package,
  DollarSign,
  Bell,
  Loader2,
  Ruler
} from 'lucide-react';

const GOALS: { value: TrainingGoal; label: string; description: string }[] = [
  { value: 'fat_loss', label: 'Fat Loss', description: 'Lose body fat, get leaner' },
  { value: 'hypertrophy', label: 'Build Muscle', description: 'Increase muscle size' },
  { value: 'strength', label: 'Get Stronger', description: 'Increase lifting numbers' },
  { value: 'conditioning', label: 'Conditioning', description: 'Improve cardio/endurance' },
  { value: 'mobility', label: 'Mobility', description: 'Move better, reduce stiffness' },
  { value: 'general', label: 'General Fitness', description: 'Overall health and fitness' },
  { value: 'pain_reduction', label: 'Pain Reduction', description: 'Reduce chronic pain' },
  { value: 'athletic_performance', label: 'Athletic Performance', description: 'Sport-specific training' },
];

const INJURIES: { value: InjuryFlag; label: string }[] = [
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'knee', label: 'Knee' },
  { value: 'back', label: 'Lower Back' },
  { value: 'hip', label: 'Hip' },
  { value: 'ankle', label: 'Ankle' },
  { value: 'wrist', label: 'Wrist' },
  { value: 'neck', label: 'Neck' },
  { value: 'none', label: 'None' },
];

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'new', label: 'Brand New', description: 'Never trained before' },
  { value: 'some', label: 'Some Experience', description: 'Trained inconsistently or casually' },
  { value: 'confident', label: 'Confident', description: 'Regular training, knows basics' },
  { value: 'advanced', label: 'Advanced', description: 'Years of consistent training' },
];

const PHASES: { value: TrainingPhase; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'return', label: 'Return to Training', description: 'Rebuilding after injury or long break', icon: <Heart className="h-5 w-5" /> },
  { value: 'foundation', label: 'Foundation', description: 'Building movement quality and base fitness', icon: <Activity className="h-5 w-5" /> },
  { value: 'strength', label: 'Strength', description: 'Building strength and muscle', icon: <Dumbbell className="h-5 w-5" /> },
  { value: 'performance', label: 'Performance', description: 'Power, speed, and athletic performance', icon: <Zap className="h-5 w-5" /> },
];

const PAYMENT_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'per_session', label: 'Per Session' },
];

interface OnboardingData {
  primaryGoal: TrainingGoal | '';
  secondaryGoal: TrainingGoal | '';
  customGoalText: string;
  trainingPreference: '1:1' | 'group' | 'solo' | 'mixed' | '';
  experienceLevel: ExperienceLevel | '';
  injuryFlags: InjuryFlag[];
  injuryNotes: string;
  ptSessionsPerWeek: number;
  personalSessionsPerWeek: number;
  preferredPTDays: string[];
  sessionLength: number;
  trainAloneOutsidePT: 'yes' | 'maybe' | 'no' | '';
  movementConfidence: { squat: number; hinge: number; push: number; pull: number; core: number };
  sleepQuality: number;
  stressLevel: number;
  jobActivity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '';
  currentPhase: TrainingPhase | '';
  height: string;
  weight: string;
  packageName: string;
  packageSessions: number;
  packagePrice: number;
  paymentFrequency: 'weekly' | 'fortnightly' | 'monthly' | 'per_session' | '';
  firstSessionDate: string;
  firstSessionTime: string;
}

const TOTAL_STEPS = 8;

export default function ClientOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const { user } = useAuthStore();
  const { clients, updateClient, saveClientProfile, addCalendarEvent, addSession, addSessionPackage } = useTrainerStore();
  const { addNotification } = useSocialStore();
  const client = clients.find(c => c.clientId === clientId);
  
  // Account creation state
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('client123');
  const [accountGender, setAccountGender] = useState<'male' | 'female' | 'other'>('other');
  const [accountCreated, setAccountCreated] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [linkedExistingAccount, setLinkedExistingAccount] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(1);
  
  // Auto-skip Step 1 if client already has an account (created from Add Client page)
  useEffect(() => {
    // Check if the client already exists (was created from the Add Client modal)
    const allUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const existingUser = allUsers.find((u: any) => u.id === clientId);
    
    if (existingUser) {
      // Client account already exists - skip step 1
      setAccountName(existingUser.displayName || existingUser.username || '');
      setAccountEmail(existingUser.email || '');
      setAccountUsername(existingUser.username || '');
      setAccountGender(existingUser.gender || 'other');
      setAccountCreated(true);
      setCreatedClientId(clientId);
      setCurrentStep(2); // Skip to goals
    }
  }, [clientId]);
  
  const [data, setData] = useState<OnboardingData>({
    primaryGoal: '',
    secondaryGoal: '',
    customGoalText: '',
    trainingPreference: '',
    experienceLevel: '',
    injuryFlags: [],
    injuryNotes: '',
    ptSessionsPerWeek: 2,
    personalSessionsPerWeek: 0,
    preferredPTDays: [],
    sessionLength: 60,
    trainAloneOutsidePT: '',
    movementConfidence: { squat: 3, hinge: 3, push: 3, pull: 3, core: 3 },
    sleepQuality: 3,
    stressLevel: 3,
    jobActivity: '',
    currentPhase: '',
    height: '',
    weight: '',
    packageName: '',
    packageSessions: 10,
    packagePrice: 0,
    paymentFrequency: '',
    firstSessionDate: '',
    firstSessionTime: '09:00',
  });

  const progress = (currentStep / TOTAL_STEPS) * 100;
  const isSkippableStep = currentStep >= 6;

  const canProceed = () => {
    switch (currentStep) {
      case 1: return accountCreated;
      case 2: return data.primaryGoal !== '';
      case 3: return data.experienceLevel !== '' && data.trainingPreference !== '';
      case 4: return data.injuryFlags.length > 0;
      case 5: return data.ptSessionsPerWeek > 0 && data.trainAloneOutsidePT !== '';
      default: return true; // Steps 6-8 are skippable
    }
  };
  
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Auto-link: Check if email exists when creating account
  const handleCreateAccount = async () => {
    if (!accountName.trim() || !accountEmail.trim()) {
      toast.error('Please enter name and email');
      return;
    }
    
    setIsCreatingAccount(true);
    
    // Check if email already exists - auto-link if so
    try {
      const existingUsers = await fetchAllUsersFromSupabase();
      const existingUser = existingUsers.find((u: any) => 
        u.email?.toLowerCase() === accountEmail.toLowerCase().trim()
      );
      
      if (existingUser) {
        // Auto-link existing account
        console.log('[Onboarding] Auto-linking existing account:', existingUser.email);
        const { addClient } = useTrainerStore.getState();
        addClient(existingUser.id, {
          goals: [],
          onboardingComplete: false,
          status: 'active',
        });
        
        setCreatedClientId(existingUser.id);
        setAccountName(existingUser.displayName || accountName);
        setAccountUsername(existingUser.username || '');
        setLinkedExistingAccount(true);
        setAccountCreated(true);
        setIsCreatingAccount(false);
        toast.success(`Linked to existing account: ${existingUser.email}`);
        return;
      }
    } catch (e) {
      console.log('[Onboarding] Could not check for existing users, creating new');
    }
    
    // Create new account
    const newClientId = generateUUID();
    const username = accountUsername.trim() || accountName.toLowerCase().replace(/\s+/g, '_');
    
    const newClientUser = {
      id: newClientId,
      email: accountEmail.toLowerCase().trim(),
      username: username,
      displayName: accountName,
      phone: '',
      gender: accountGender,
      mode: 'user' as const,
      isTrainer: false,
      isVerifiedTrainer: false,
      preferredUnit: 'kg' as const,
      createdAt: new Date().toISOString(),
      followers: [],
      following: [],
      trainerId: user?.id,
      password: accountPassword,
      height: data.height || undefined,
      weight: data.weight || undefined,
    };
    
    // Save to localStorage
    const existingLocalUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    localStorage.setItem('apex-users', JSON.stringify([...existingLocalUsers.filter((u: any) => u.id !== newClientId), newClientUser]));
    
    // Sync to Supabase
    try {
      await registerUserToSupabase(newClientUser as any, accountPassword);
      toast.success(`Account created! Login: ${newClientUser.email}`);
    } catch (e) {
      toast.success(`Account saved locally`);
    }
    
    // Add to trainer's client list
    const { addClient } = useTrainerStore.getState();
    addClient(newClientId, {
      goals: [],
      onboardingComplete: false,
      status: 'active',
    });
    
    setCreatedClientId(newClientId);
    setAccountUsername(username);
    setAccountCreated(true);
    setIsCreatingAccount(false);
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleInjury = (injury: InjuryFlag) => {
    if (injury === 'none') {
      setData({ ...data, injuryFlags: ['none'] });
    } else {
      const newFlags = data.injuryFlags.filter(i => i !== 'none');
      if (newFlags.includes(injury)) {
        setData({ ...data, injuryFlags: newFlags.filter(i => i !== injury) });
      } else {
        setData({ ...data, injuryFlags: [...newFlags, injury] });
      }
    }
  };

  const handleComplete = () => {
    const actualClientId = createdClientId || clientId;
    const trainerId = user?.id || '';
    
    if (!accountCreated) {
      toast.error('Please create an account first');
      return;
    }
    
    // Save programming profile
    const profile: ClientProgrammingProfile = {
      id: `profile-${actualClientId}`,
      clientId: actualClientId,
      trainerId,
      primaryGoal: data.primaryGoal as TrainingGoal,
      secondaryGoal: data.secondaryGoal as TrainingGoal || undefined,
      customGoalText: data.customGoalText || undefined,
      trainingPreference: data.trainingPreference as '1:1' | 'group' | 'solo' | 'mixed',
      experienceLevel: data.experienceLevel as ExperienceLevel,
      injuryFlags: data.injuryFlags,
      injuryNotes: data.injuryNotes || undefined,
      daysPerWeek: data.ptSessionsPerWeek + (data.trainAloneOutsidePT === 'yes' ? data.personalSessionsPerWeek : 0),
      sessionLength: data.sessionLength,
      trainAloneOutsidePT: data.trainAloneOutsidePT as 'yes' | 'maybe' | 'no',
      movementConfidence: data.movementConfidence,
      wantsClasses: 'maybe',
      classReady: data.experienceLevel === 'confident' || data.experienceLevel === 'advanced',
      sleepQuality: data.sleepQuality as 1 | 2 | 3 | 4 | 5,
      stressLevel: data.stressLevel as 1 | 2 | 3 | 4 | 5,
      jobActivity: data.jobActivity as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
      currentPhase: data.currentPhase as TrainingPhase || 'foundation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveClientProfile(profile);

    // Update client record
    updateClient(actualClientId, {
      goals: data.primaryGoal ? [data.primaryGoal, data.secondaryGoal].filter(Boolean) as string[] : [],
      injuryHistory: data.injuryFlags.filter(i => i !== 'none').join(', ') + (data.injuryNotes ? ` - ${data.injuryNotes}` : ''),
      notes: data.customGoalText,
      onboardingComplete: true,
    });

    // Create package if filled out
    if (data.packageName && data.packagePrice > 0) {
      const newPackage = {
        trainerId,
        clientId: actualClientId,
        name: data.packageName,
        totalSessions: data.packageSessions,
        paidSessions: data.packageSessions,
        priceTotal: data.packagePrice,
        pricePerSession: data.packagePrice / data.packageSessions,
        purchaseDate: new Date().toISOString(),
        paymentId: `pay-${generateUUID()}`,
        status: 'active' as const,
        paymentFrequency: data.paymentFrequency || undefined,
        nextPaymentDue: data.paymentFrequency && data.paymentFrequency !== 'per_session' 
          ? calculateNextPaymentDate(data.paymentFrequency) 
          : undefined,
      };
      addSessionPackage(newPackage);
    }

    // Book first session if date selected
    if (data.firstSessionDate) {
      const sessionDate = new Date(data.firstSessionDate);
      const [hours, minutes] = data.firstSessionTime.split(':').map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);
      
      const endHour = hours + Math.floor((minutes + data.sessionLength) / 60);
      const endMin = (minutes + data.sessionLength) % 60;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
      
      // Add calendar event
      addCalendarEvent({
        title: 'PT Session',
        type: 'session',
        date: sessionDate.toISOString(),
        startTime: data.firstSessionTime,
        endTime,
        clientId: actualClientId,
        trainerId,
        status: 'scheduled',
      });
      
      // Add session record
      addSession({
        trainerId,
        clientId: actualClientId,
        date: sessionDate.toISOString(),
        startTime: data.firstSessionTime,
        endTime,
        duration: data.sessionLength,
        type: 'pt_session',
        status: 'scheduled',
        paid: false,
      });
      
      // Send in-app notification to client
      addNotification({
        userId: actualClientId,
        type: 'workout_assigned',
        title: 'Session Booked',
        message: `Your first PT session is booked for ${sessionDate.toLocaleDateString('en-NZ', { weekday: 'long', month: 'short', day: 'numeric' })} at ${data.firstSessionTime}`,
      });
      
      toast.success(`Onboarding complete! First session booked.`);
    } else {
      toast.success('Onboarding complete!');
    }
    
    // Navigate to client file
    router.push(`/clients/${actualClientId}`);
  };
  
  const calculateNextPaymentDate = (frequency: string): string => {
    const now = new Date();
    switch (frequency) {
      case 'weekly': now.setDate(now.getDate() + 7); break;
      case 'fortnightly': now.setDate(now.getDate() + 14); break;
      case 'monthly': now.setMonth(now.getMonth() + 1); break;
      default: break;
    }
    return now.toISOString();
  };

  const handleSkipToFinish = () => {
    handleComplete();
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {accountCreated && (
            <Button variant="outline" size="sm" onClick={handleSkipToFinish}>
              Finish & Save
            </Button>
          )}
        </div>
        <h1 className="text-2xl font-bold">Client Onboarding</h1>
        <p className="text-muted-foreground">{accountName || 'New Client'}</p>
        <Progress value={progress} className="mt-4" />
        <p className="text-sm text-muted-foreground mt-2">
          Step {currentStep} of {TOTAL_STEPS}
          {isSkippableStep && <span className="text-sky-400 ml-2">(Optional)</span>}
        </p>
      </div>

      {/* Step 1: Account Creation */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Client Account
            </CardTitle>
            <CardDescription>
              Create account for your client (auto-links if email exists)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!accountCreated ? (
              <>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Client Name *
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g. John Smith"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If this email exists, we'll link to their account automatically
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="username">Username (optional)</Label>
                    <Input
                      id="username"
                      placeholder="Auto-generated if blank"
                      value={accountUsername}
                      onChange={(e) => setAccountUsername(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" /> Password
                      </Label>
                      <Input
                        id="password"
                        type="text"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <Select value={accountGender} onValueChange={(v) => setAccountGender(v as any)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Optional Height/Weight */}
                  <div className="pt-4 border-t">
                    <Label className="flex items-center gap-2 text-muted-foreground">
                      <Ruler className="h-4 w-4" /> Height & Weight (optional)
                    </Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Input
                          placeholder="Height (cm)"
                          value={data.height}
                          onChange={(e) => setData({ ...data, height: e.target.value })}
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Weight (kg)"
                          value={data.weight}
                          onChange={(e) => setData({ ...data, weight: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Client can update these later in their profile
                    </p>
                  </div>
                </div>
                
                <Button 
                  onClick={handleCreateAccount} 
                  className="w-full bg-sky-500 hover:bg-sky-600"
                  disabled={isCreatingAccount}
                >
                  {isCreatingAccount ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="h-16 w-16 text-sky-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-sky-400 mb-2">
                  {linkedExistingAccount ? 'Account Linked!' : 'Account Created!'}
                </h3>
                <div className="p-4 bg-muted rounded-lg text-left space-y-2">
                  <p className="text-sm"><strong>Name:</strong> {accountName}</p>
                  <p className="text-sm"><strong>Email:</strong> {accountEmail}</p>
                  {!linkedExistingAccount && (
                    <p className="text-sm"><strong>Password:</strong> {accountPassword}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Goals */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" /> Goals
            </CardTitle>
            <CardDescription>What does {accountName.split(' ')[0] || 'this client'} want to achieve?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Primary Goal *</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {GOALS.map(goal => (
                  <div
                    key={goal.value}
                    onClick={() => setData({ ...data, primaryGoal: goal.value })}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      data.primaryGoal === goal.value 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{goal.label}</p>
                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Secondary Goal (Optional)</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {GOALS.filter(g => g.value !== data.primaryGoal).map(goal => (
                  <div
                    key={goal.value}
                    onClick={() => setData({ 
                      ...data, 
                      secondaryGoal: data.secondaryGoal === goal.value ? '' : goal.value 
                    })}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      data.secondaryGoal === goal.value 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{goal.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Additional Notes</Label>
              <Textarea
                placeholder="Any specific goals or context..."
                value={data.customGoalText}
                onChange={(e) => setData({ ...data, customGoalText: e.target.value })}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Experience & Preferences */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Experience & Preferences
            </CardTitle>
            <CardDescription>Understanding their training background</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Training Experience *</Label>
              <div className="space-y-3 mt-3">
                {EXPERIENCE_LEVELS.map(level => (
                  <div
                    key={level.value}
                    onClick={() => setData({ ...data, experienceLevel: level.value })}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      data.experienceLevel === level.value 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{level.label}</p>
                    <p className="text-sm text-muted-foreground">{level.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Training Preference *</Label>
              <RadioGroup
                value={data.trainingPreference}
                onValueChange={(v) => setData({ ...data, trainingPreference: v as any })}
                className="mt-3 space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="1:1" id="pref-1" className="mt-0.5" />
                  <div>
                    <Label htmlFor="pref-1" className="font-medium cursor-pointer">1 on 1 Personal Training</Label>
                    <p className="text-sm text-muted-foreground">In-person sessions with you</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="group" id="pref-2" className="mt-0.5" />
                  <div>
                    <Label htmlFor="pref-2" className="font-medium cursor-pointer">Group Training</Label>
                    <p className="text-sm text-muted-foreground">Classes or group sessions</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="mixed" id="pref-3" className="mt-0.5" />
                  <div>
                    <Label htmlFor="pref-3" className="font-medium cursor-pointer">Mix of Options</Label>
                    <p className="text-sm text-muted-foreground">PT + classes and/or independent</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Injuries */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Injuries & Limitations
            </CardTitle>
            <CardDescription>Any areas we need to be careful with?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Current Pain or Injury Areas *</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {INJURIES.map(injury => (
                  <div
                    key={injury.value}
                    onClick={() => toggleInjury(injury.value)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-2 ${
                      data.injuryFlags.includes(injury.value)
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox checked={data.injuryFlags.includes(injury.value)} />
                    <span>{injury.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {data.injuryFlags.length > 0 && !data.injuryFlags.includes('none') && (
              <div>
                <Label>Injury Details</Label>
                <Textarea
                  placeholder="Any additional details..."
                  value={data.injuryNotes}
                  onChange={(e) => setData({ ...data, injuryNotes: e.target.value })}
                  className="mt-2"
                />
              </div>
            )}

            <div>
              <Label className="text-base font-medium">Movement Confidence</Label>
              <p className="text-sm text-muted-foreground mb-4">Rate confidence in each pattern (1-5)</p>
              {(['squat', 'hinge', 'push', 'pull', 'core'] as const).map(pattern => (
                <div key={pattern} className="mb-4">
                  <div className="flex justify-between mb-2">
                    <Label className="capitalize">{pattern}</Label>
                    <span className="text-sm text-muted-foreground">{data.movementConfidence[pattern]}</span>
                  </div>
                  <Slider
                    value={[data.movementConfidence[pattern]]}
                    onValueChange={([v]) => setData({
                      ...data,
                      movementConfidence: { ...data.movementConfidence, [pattern]: v }
                    })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Schedule */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Schedule
            </CardTitle>
            <CardDescription>PT sessions and training schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-lg space-y-4">
              <div>
                <Label className="text-base font-medium text-sky-400">PT Sessions Per Week *</Label>
                <div className="flex gap-2 mt-3">
                  {[1, 2, 3, 4, 5].map(days => (
                    <Button
                      key={days}
                      variant={data.ptSessionsPerWeek === days ? 'default' : 'outline'}
                      onClick={() => setData({ ...data, ptSessionsPerWeek: days })}
                      className="flex-1"
                    >
                      {days}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-sm">Preferred Days</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <Button
                      key={day}
                      size="sm"
                      variant={data.preferredPTDays.includes(day) ? 'default' : 'outline'}
                      onClick={() => {
                        const newDays = data.preferredPTDays.includes(day)
                          ? data.preferredPTDays.filter(d => d !== day)
                          : [...data.preferredPTDays, day];
                        setData({ ...data, preferredPTDays: newDays });
                      }}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Will they train alone outside PT? *</Label>
              <RadioGroup
                value={data.trainAloneOutsidePT}
                onValueChange={(v) => setData({ ...data, trainAloneOutsidePT: v as any })}
                className="mt-3 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="alone-1" />
                  <Label htmlFor="alone-1">Yes, homework workouts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="maybe" id="alone-2" />
                  <Label htmlFor="alone-2">Maybe, let's see</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="alone-3" />
                  <Label htmlFor="alone-3">No, PT sessions only</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-base font-medium">Session Length (minutes)</Label>
              <div className="flex gap-2 mt-3">
                {[30, 45, 60, 75, 90].map(mins => (
                  <Button
                    key={mins}
                    variant={data.sessionLength === mins ? 'default' : 'outline'}
                    onClick={() => setData({ ...data, sessionLength: mins })}
                    className="flex-1"
                  >
                    {mins}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Lifestyle (Skippable) */}
      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" /> Lifestyle Factors
              <Badge variant="secondary" className="ml-2">Optional</Badge>
            </CardTitle>
            <CardDescription>Understanding recovery capacity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Job Activity Level</Label>
              <RadioGroup
                value={data.jobActivity}
                onValueChange={(v) => setData({ ...data, jobActivity: v as any })}
                className="mt-3 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sedentary" id="job-1" />
                  <Label htmlFor="job-1">Sedentary (desk job)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" id="job-2" />
                  <Label htmlFor="job-2">Light (some walking)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="job-3" />
                  <Label htmlFor="job-3">Moderate (regular movement)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="active" id="job-4" />
                  <Label htmlFor="job-4">Active (physical job)</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label>Sleep Quality</Label>
                <span className="text-sm text-muted-foreground">
                  {['Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][data.sleepQuality - 1]}
                </span>
              </div>
              <Slider
                value={[data.sleepQuality]}
                onValueChange={([v]) => setData({ ...data, sleepQuality: v })}
                min={1}
                max={5}
                step={1}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label>Stress Level</Label>
                <span className="text-sm text-muted-foreground">
                  {['Very Low', 'Low', 'Moderate', 'High', 'Very High'][data.stressLevel - 1]}
                </span>
              </div>
              <Slider
                value={[data.stressLevel]}
                onValueChange={([v]) => setData({ ...data, stressLevel: v })}
                min={1}
                max={5}
                step={1}
              />
            </div>

            <div>
              <Label className="text-base font-medium">Training Phase</Label>
              <div className="space-y-3 mt-3">
                {PHASES.map(phase => (
                  <div
                    key={phase.value}
                    onClick={() => setData({ ...data, currentPhase: phase.value })}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      data.currentPhase === phase.value 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        data.currentPhase === phase.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {phase.icon}
                      </div>
                      <div>
                        <p className="font-medium">{phase.label}</p>
                        <p className="text-sm text-muted-foreground">{phase.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7: Package Creation (Skippable) */}
      {currentStep === 7 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Session Package
              <Badge variant="secondary" className="ml-2">Optional</Badge>
            </CardTitle>
            <CardDescription>Create a session package with payment plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">
                You can also create packages later from the client file or skip this step entirely.
              </p>
            </div>

            <div>
              <Label>Package Name</Label>
              <Input
                placeholder="e.g. 10 Session Bundle"
                value={data.packageName}
                onChange={(e) => setData({ ...data, packageName: e.target.value })}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Number of Sessions</Label>
                <Select 
                  value={String(data.packageSessions)} 
                  onValueChange={(v) => setData({ ...data, packageSessions: parseInt(v) })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 25, 30, 40, 50].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} sessions</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total Price ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={data.packagePrice || ''}
                  onChange={(e) => setData({ ...data, packagePrice: parseFloat(e.target.value) || 0 })}
                  className="mt-2"
                />
              </div>
            </div>

            {data.packagePrice > 0 && data.packageSessions > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Price per session:</strong> ${(data.packagePrice / data.packageSessions).toFixed(2)}
                </p>
              </div>
            )}

            <div>
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Payment Frequency
              </Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {PAYMENT_FREQUENCIES.map(freq => (
                  <div
                    key={freq.value}
                    onClick={() => setData({ ...data, paymentFrequency: freq.value as any })}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                      data.paymentFrequency === freq.value 
                        ? 'border-sky-500 bg-sky-500/10' 
                        : 'border-border hover:border-sky-500/50'
                    }`}
                  >
                    <p className="font-medium">{freq.label}</p>
                  </div>
                ))}
              </div>
              {data.paymentFrequency && data.paymentFrequency !== 'per_session' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Next payment will be tracked automatically
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 8: Book First Session (Skippable) */}
      {currentStep === 8 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Book First Session
              <Badge variant="secondary" className="ml-2">Optional</Badge>
            </CardTitle>
            <CardDescription>Schedule their first PT session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-sm text-purple-400 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Client will receive an in-app notification when you book
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={data.firstSessionDate}
                  onChange={(e) => setData({ ...data, firstSessionDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Time</Label>
                <Select
                  value={data.firstSessionTime}
                  onValueChange={(v) => setData({ ...data, firstSessionTime: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', 
                      '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
                      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
                      '18:00', '18:30', '19:00', '19:30', '20:00'].map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {data.firstSessionDate && (
              <div className="p-3 bg-purple-500/20 rounded-lg text-sm text-purple-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {new Date(data.firstSessionDate).toLocaleDateString('en-NZ', { weekday: 'long', month: 'short', day: 'numeric' })} at {data.firstSessionTime}
              </div>
            )}

            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="font-medium mb-3">Onboarding Summary</p>
              <p className="text-sm"><strong>Goal:</strong> {GOALS.find(g => g.value === data.primaryGoal)?.label || 'Not set'}</p>
              <p className="text-sm"><strong>Experience:</strong> {EXPERIENCE_LEVELS.find(e => e.value === data.experienceLevel)?.label || 'Not set'}</p>
              <p className="text-sm"><strong>PT Sessions:</strong> {data.ptSessionsPerWeek}/week</p>
              {data.packageName && (
                <p className="text-sm"><strong>Package:</strong> {data.packageName} (${data.packagePrice})</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex gap-2">
          {isSkippableStep && currentStep < TOTAL_STEPS && (
            <Button
              variant="ghost"
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              Skip
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {currentStep === TOTAL_STEPS ? (
              <>Complete <Check className="h-4 w-4 ml-2" /></>
            ) : (
              <>Next <ArrowRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
