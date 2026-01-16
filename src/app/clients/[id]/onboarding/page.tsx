'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { useTrainerStore, useAuthStore } from '@/lib/store';
import { registerUserToSupabase } from '@/lib/supabaseSync';
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
  CheckCircle2
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

interface OnboardingData {
  primaryGoal: TrainingGoal | '';
  secondaryGoal: TrainingGoal | '';
  customGoalText: string;
  trainingPreference: '1:1' | 'group' | 'solo' | 'mixed' | '';
  experienceLevel: ExperienceLevel | '';
  injuryFlags: InjuryFlag[];
  injuryNotes: string;
  daysPerWeek: number;
  ptSessionsPerWeek: number;
  personalSessionsPerWeek: number;
  preferredPTDays: string[];
  preferredPersonalDays: string[];
  sessionLength: number;
  trainAloneOutsidePT: 'yes' | 'maybe' | 'no' | '';
  movementConfidence: {
    squat: number;
    hinge: number;
    push: number;
    pull: number;
    core: number;
  };
  wantsClasses: 'yes_asap' | 'later' | 'maybe' | 'no' | '';
  sleepQuality: number;
  stressLevel: number;
  jobActivity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '';
  currentPhase: TrainingPhase | '';
}

const TOTAL_STEPS = 7;

export default function ClientOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const { user } = useAuthStore();
  const { clients, updateClient, saveClientProfile } = useTrainerStore();
  const client = clients.find(c => c.clientId === clientId);
  
  // Account creation state
  const [accountMode, setAccountMode] = useState<'create' | 'link'>('create');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('client123');
  const [accountGender, setAccountGender] = useState<'male' | 'female' | 'other'>('other');
  const [accountCreated, setAccountCreated] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExistingUser, setSelectedExistingUser] = useState<any>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    primaryGoal: '',
    secondaryGoal: '',
    customGoalText: '',
    trainingPreference: '',
    experienceLevel: '',
    injuryFlags: [],
    injuryNotes: '',
    daysPerWeek: 3,
    ptSessionsPerWeek: 1,
    personalSessionsPerWeek: 2,
    preferredPTDays: [],
    preferredPersonalDays: [],
    sessionLength: 60,
    trainAloneOutsidePT: '',
    movementConfidence: { squat: 3, hinge: 3, push: 3, pull: 3, core: 3 },
    wantsClasses: '',
    sleepQuality: 3,
    stressLevel: 3,
    jobActivity: '',
    currentPhase: '',
  });

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1: return accountCreated; // Account must be created first
      case 2: return data.primaryGoal !== '';
      case 3: return data.experienceLevel !== '' && data.trainingPreference !== '';
      case 4: return data.injuryFlags.length > 0;
      case 5: return data.ptSessionsPerWeek > 0 && data.trainAloneOutsidePT !== '';
      case 6: return data.jobActivity !== '';
      case 7: return data.currentPhase !== '';
      default: return true;
    }
  };
  
  // Generate a proper UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Create account and sync to Supabase - SAME FLOW AS clients/page.tsx handleAddClient
  const handleCreateAccount = async () => {
    if (!accountName.trim()) {
      toast.error('Please enter client name');
      return;
    }
    if (!accountEmail.trim()) {
      toast.error('Please enter client email');
      return;
    }
    if (!accountUsername.trim()) {
      toast.error('Please enter a username');
      return;
    }
    
    setIsCreatingAccount(true);
    
    // Generate proper UUID for Supabase (not client-XXXX format)
    const newClientId = generateUUID();
    
    // Create user entry with proper UUID
    const newClientUser = {
      id: newClientId,
      email: accountEmail.toLowerCase().trim(),
      username: accountUsername.toLowerCase().replace(/\s+/g, '_'),
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
    };
    
    // Add to localStorage
    const existingUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const filteredUsers = existingUsers.filter((u: any) => u.id !== newClientId);
    localStorage.setItem('apex-users', JSON.stringify([...filteredUsers, newClientUser]));
    
    // Sync to Supabase
    try {
      console.log('[Onboarding] Syncing new client to Supabase:', newClientUser.email);
      const synced = await registerUserToSupabase(newClientUser as any, accountPassword);
      if (synced) {
        console.log('[Onboarding] ✅ Client synced to Supabase:', newClientUser.email);
        toast.success(`Account created! Login: ${newClientUser.email} / ${accountPassword}`);
      } else {
        console.log('[Onboarding] ⚠️ Client saved locally only (Supabase sync failed)');
        toast.success(`Account saved locally. Login: ${newClientUser.email} / ${accountPassword}`);
      }
    } catch (e) {
      console.error('[Onboarding] Error syncing to Supabase:', e);
      toast.success(`Account saved locally. Login: ${newClientUser.email} / ${accountPassword}`);
    }
    
    // Update the client relationship with the new user data and new ID
    updateClient(clientId, { clientId: newClientId, client: newClientUser as any });
    
    setAccountCreated(true);
    setIsCreatingAccount(false);
  };
  
  // Get existing users for search
  const existingUsers = useMemo(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    return stored.filter((u: any) => !u.isTrainer && u.id !== clientId);
  }, [clientId]);
  
  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return existingUsers.filter((u: any) => 
      u.displayName?.toLowerCase().includes(query) || 
      u.username?.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [searchQuery, existingUsers]);
  
  // Link existing user to this client slot
  const handleLinkExisting = () => {
    if (!selectedExistingUser) {
      toast.error('Please select a user to link');
      return;
    }
    
    // Update the client relationship to point to existing user
    updateClient(clientId, { 
      clientId: selectedExistingUser.id,
      client: selectedExistingUser 
    });
    
    toast.success(`Linked to ${selectedExistingUser.displayName}`);
    setAccountCreated(true);
    setAccountName(selectedExistingUser.displayName);
    setAccountUsername(selectedExistingUser.username);
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

  const handleComplete = () => {
    if (!client) return;
    
    const profile: ClientProgrammingProfile = {
      id: `profile-${clientId}`,
      clientId,
      trainerId: client.trainerId,
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
      wantsClasses: data.wantsClasses as 'yes_asap' | 'later' | 'maybe' | 'no',
      classReady: data.experienceLevel === 'confident' || data.experienceLevel === 'advanced',
      sleepQuality: data.sleepQuality as 1 | 2 | 3 | 4 | 5,
      stressLevel: data.stressLevel as 1 | 2 | 3 | 4 | 5,
      jobActivity: data.jobActivity as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
      currentPhase: data.currentPhase as TrainingPhase,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save full profile to store
    saveClientProfile(profile);

    // Update client with onboarding data
    updateClient(clientId, {
      goals: data.primaryGoal ? [data.primaryGoal, data.secondaryGoal].filter(Boolean) as string[] : [],
      injuryHistory: data.injuryFlags.filter(i => i !== 'none').join(', ') + (data.injuryNotes ? ` - ${data.injuryNotes}` : ''),
      notes: data.customGoalText,
      onboardingComplete: true,
    });

    // Navigate to template selection
    router.push(`/clients/${clientId}/program/select`);
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

  const handleSkipOnboarding = () => {
    updateClient(clientId, { onboardingComplete: true });
    router.push(`/clients/${clientId}`);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button variant="outline" size="sm" onClick={handleSkipOnboarding}>
            Skip Onboarding
          </Button>
        </div>
        <h1 className="text-2xl font-bold">Client Onboarding</h1>
        <p className="text-muted-foreground">{client?.client?.displayName || 'New Client'}</p>
        <Progress value={progress} className="mt-4" />
        <p className="text-sm text-muted-foreground mt-2">Step {currentStep} of {TOTAL_STEPS}</p>
      </div>

      {/* Step 1: Account Creation */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Client Account
            </CardTitle>
            <CardDescription>
              Create a new account or link an existing one
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!accountCreated ? (
              <>
                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={accountMode === 'create' ? 'default' : 'outline'}
                    onClick={() => setAccountMode('create')}
                    className="flex-1"
                  >
                    Create New Account
                  </Button>
                  <Button
                    variant={accountMode === 'link' ? 'default' : 'outline'}
                    onClick={() => setAccountMode('link')}
                    className="flex-1"
                  >
                    Link Existing
                  </Button>
                </div>
                
                {accountMode === 'create' ? (
                  <>
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <p className="text-sm text-emerald-400 font-medium mb-1">
                        Create a new login account for your client
                      </p>
                      <p className="text-xs text-muted-foreground">
                        They'll be able to log in and see their workouts, track progress, and communicate with you.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="flex items-center gap-2">
                          <User className="h-4 w-4" /> Client Name *
                        </Label>
                        <Input
                          id="name"
                          type="text"
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
                          This will be their login email
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="username" className="flex items-center gap-2">
                          <User className="h-4 w-4" /> Username *
                        </Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="e.g. john.smith"
                          value={accountUsername}
                          onChange={(e) => setAccountUsername(e.target.value)}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Display name in the app
                        </p>
                      </div>
                      
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
                        <Label className="flex items-center gap-2">
                          <User className="h-4 w-4" /> Gender
                        </Label>
                        <Select value={accountGender} onValueChange={(v) => setAccountGender(v as any)}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other / Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleCreateAccount} 
                      className="w-full bg-emerald-500 hover:bg-emerald-600"
                      disabled={isCreatingAccount}
                    >
                      {isCreatingAccount ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </>
                ) : (
                  /* Link Existing Account Mode */
                  <>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-400 font-medium mb-1">
                        Link an existing account
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Search for a client who already has an account in the system.
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="search" className="flex items-center gap-2">
                        <User className="h-4 w-4" /> Search by name or username
                      </Label>
                      <Input
                        id="search"
                        type="text"
                        placeholder="Start typing to search..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setSelectedExistingUser(null);
                        }}
                        className="mt-2"
                      />
                    </div>
                    
                    {filteredUsers.length > 0 && (
                      <div className="space-y-2">
                        <Label>Select a user:</Label>
                        {filteredUsers.map((u: any) => (
                          <div
                            key={u.id}
                            onClick={() => setSelectedExistingUser(u)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedExistingUser?.id === u.id
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-border hover:border-muted-foreground'
                            }`}
                          >
                            <p className="font-medium">{u.displayName}</p>
                            <p className="text-sm text-muted-foreground">@{u.username}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {searchQuery && filteredUsers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No users found matching "{searchQuery}"
                      </p>
                    )}
                    
                    <Button 
                      onClick={handleLinkExisting} 
                      className="w-full bg-blue-500 hover:bg-blue-600"
                      disabled={!selectedExistingUser}
                    >
                      Link Account
                    </Button>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">Account Created!</h3>
                <div className="p-4 bg-muted rounded-lg text-left space-y-2">
                  <p className="text-sm">
                    <strong>Name:</strong> {accountName}
                  </p>
                  <p className="text-sm">
                    <strong>Username:</strong> {accountUsername}
                  </p>
                  <p className="text-sm">
                    <strong>Password:</strong> {accountPassword}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Share these credentials with your client so they can log in.
                </p>
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
            <CardDescription>What does {(client?.client?.displayName || 'this client').split(' ')[0]} want to achieve?</CardDescription>
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
              <p className="text-sm text-muted-foreground mb-3">How does this client prefer to train?</p>
              <RadioGroup
                value={data.trainingPreference}
                onValueChange={(v) => setData({ ...data, trainingPreference: v as any })}
                className="mt-3 space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="1:1" id="pref-1" className="mt-0.5" />
                  <div>
                    <Label htmlFor="pref-1" className="font-medium cursor-pointer">1 on 1 Personal Training</Label>
                    <p className="text-sm text-muted-foreground">In-person sessions with you as their trainer</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="group" id="pref-2" className="mt-0.5" />
                  <div>
                    <Label htmlFor="pref-2" className="font-medium cursor-pointer">Group Training / Classes</Label>
                    <p className="text-sm text-muted-foreground">Group sessions, bootcamps, or fitness classes</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="solo" id="pref-3" className="mt-0.5" />
                  <div>
                    <Label htmlFor="pref-3" className="font-medium cursor-pointer">Training by Themselves</Label>
                    <p className="text-sm text-muted-foreground">Online programming, app-based training, trains independently</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="mixed" id="pref-4" className="mt-0.5" />
                  <div>
                    <Label htmlFor="pref-4" className="font-medium cursor-pointer">Mix of Options</Label>
                    <p className="text-sm text-muted-foreground">Combination of PT, classes, and/or independent training</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Injuries & Limitations */}
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
              <p className="text-sm text-muted-foreground mb-3">Select all that apply</p>
              <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-base font-medium">Injury Details</Label>
                <Textarea
                  placeholder="Any additional details about injuries or limitations..."
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
                    <span className="text-sm text-muted-foreground">
                      {data.movementConfidence[pattern]}
                    </span>
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

      {/* Step 5: Availability */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Availability
            </CardTitle>
            <CardDescription>PT sessions and personal training schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PT Sessions */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-4">
              <div>
                <Label className="text-base font-medium text-emerald-400">PT Sessions Per Week *</Label>
                <p className="text-sm text-muted-foreground mb-3">Sessions with you as their trainer</p>
                <div className="flex gap-2">
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
                <Label className="text-sm">Preferred PT Days</Label>
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

            {/* Personal Sessions */}
            <div>
              <Label className="text-base font-medium">Will they train alone outside PT sessions? *</Label>
              <RadioGroup
                value={data.trainAloneOutsidePT}
                onValueChange={(v) => setData({ ...data, trainAloneOutsidePT: v as any })}
                className="mt-3 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="alone-1" />
                  <Label htmlFor="alone-1">Yes, they want homework workouts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="maybe" id="alone-2" />
                  <Label htmlFor="alone-2">Maybe, let's see how it goes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="alone-3" />
                  <Label htmlFor="alone-3">No, PT sessions only</Label>
                </div>
              </RadioGroup>
            </div>

            {data.trainAloneOutsidePT === 'yes' && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-4">
                <div>
                  <Label className="text-base font-medium text-blue-400">Personal Sessions Per Week</Label>
                  <p className="text-sm text-muted-foreground mb-3">Solo gym sessions (homework)</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(days => (
                      <Button
                        key={days}
                        variant={data.personalSessionsPerWeek === days ? 'default' : 'outline'}
                        onClick={() => setData({ ...data, personalSessionsPerWeek: days })}
                        className="flex-1"
                      >
                        {days}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm">Preferred Personal Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <Button
                        key={day}
                        size="sm"
                        variant={data.preferredPersonalDays.includes(day) ? 'default' : 'outline'}
                        onClick={() => {
                          const newDays = data.preferredPersonalDays.includes(day)
                            ? data.preferredPersonalDays.filter(d => d !== day)
                            : [...data.preferredPersonalDays, day];
                          setData({ ...data, preferredPersonalDays: newDays });
                        }}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Total Summary */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Total Training Days:</strong> {data.ptSessionsPerWeek + (data.trainAloneOutsidePT === 'yes' ? data.personalSessionsPerWeek : 0)} days/week
                <span className="text-muted-foreground ml-2">
                  ({data.ptSessionsPerWeek} PT{data.trainAloneOutsidePT === 'yes' ? ` + ${data.personalSessionsPerWeek} personal` : ''})
                </span>
              </p>
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

      {/* Step 6: Lifestyle */}
      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" /> Lifestyle Factors
            </CardTitle>
            <CardDescription>Understanding recovery capacity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Job Activity Level *</Label>
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
                  <Label htmlFor="job-2">Light (some walking/standing)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="job-3" />
                  <Label htmlFor="job-3">Moderate (regular movement)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="active" id="job-4" />
                  <Label htmlFor="job-4">Active (physical job)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="very_active" id="job-5" />
                  <Label htmlFor="job-5">Very Active (labor intensive)</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-base font-medium">Sleep Quality</Label>
                <span className="text-sm text-muted-foreground">
                  {data.sleepQuality === 1 ? 'Poor' : 
                   data.sleepQuality === 2 ? 'Below Average' :
                   data.sleepQuality === 3 ? 'Average' :
                   data.sleepQuality === 4 ? 'Good' : 'Excellent'}
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
                <Label className="text-base font-medium">Stress Level</Label>
                <span className="text-sm text-muted-foreground">
                  {data.stressLevel === 1 ? 'Very Low' : 
                   data.stressLevel === 2 ? 'Low' :
                   data.stressLevel === 3 ? 'Moderate' :
                   data.stressLevel === 4 ? 'High' : 'Very High'}
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
          </CardContent>
        </Card>
      )}

      {/* Step 7: Phase Selection */}
      {currentStep === 7 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" /> Training Phase
            </CardTitle>
            <CardDescription>Select the appropriate starting phase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
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

            {data.currentPhase && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">Summary</p>
                <div className="space-y-1 text-sm">
                  <p><strong>Goal:</strong> {GOALS.find(g => g.value === data.primaryGoal)?.label}</p>
                  <p><strong>Experience:</strong> {EXPERIENCE_LEVELS.find(e => e.value === data.experienceLevel)?.label}</p>
                  <p><strong>PT Sessions:</strong> {data.ptSessionsPerWeek}/week {data.preferredPTDays.length > 0 && `(${data.preferredPTDays.join(', ')})`}</p>
                  {data.trainAloneOutsidePT === 'yes' && (
                    <p><strong>Personal Sessions:</strong> {data.personalSessionsPerWeek}/week {data.preferredPersonalDays.length > 0 && `(${data.preferredPersonalDays.join(', ')})`}</p>
                  )}
                  <p><strong>Phase:</strong> {PHASES.find(p => p.value === data.currentPhase)?.label}</p>
                  {data.injuryFlags.length > 0 && !data.injuryFlags.includes('none') && (
                    <p><strong>Considerations:</strong> {data.injuryFlags.join(', ')}</p>
                  )}
                </div>
              </div>
            )}
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
  );
}
