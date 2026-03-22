'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTrainerStore, useAuthStore, useSocialStore, useWorkoutStore, hashPassword } from '@/lib/store';
import { registerUserToSupabase, fetchAllUsersFromSupabase } from '@/lib/supabaseSync';
import { exerciseLibrary, searchExercises, getExerciseUsageCounts, getExerciseById } from '@/lib/exercises';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  TrainingGoal, 
  InjuryFlag, 
  ExperienceLevel, 
  TrainingPhase,
  ClientProgrammingProfile,
  MuscleGroup,
} from '@/types';
import { 
  ArrowLeft, 
  Check, 
  Target, 
  Activity, 
  AlertTriangle, 
  Calendar, 
  Dumbbell,
  User,
  Mail,
  CheckCircle2,
  Loader2,
  Bell,
  Plus,
  Trash2,
  Search,
  Play,
  X,
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
  { value: 'some', label: 'Some Experience', description: 'Trained inconsistently' },
  { value: 'confident', label: 'Confident', description: 'Regular training, knows basics' },
  { value: 'advanced', label: 'Advanced', description: 'Years of consistent training' },
];

export default function ClientOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const { user } = useAuthStore();
  const { clients, updateClient, saveClientProfile, addCalendarEvent, addSession } = useTrainerStore();
  const { addNotification } = useSocialStore();
  const client = clients.find(c => c.clientId === clientId);
  
  // Phase 1: Quick info popup
  const [showQuickInfo, setShowQuickInfo] = useState(true);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountGender, setAccountGender] = useState<'male' | 'female' | 'other'>('other');
  const [accountCreated, setAccountCreated] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  
  // Phase 2: Assessment data
  const [primaryGoal, setPrimaryGoal] = useState<TrainingGoal | ''>('');
  const [secondaryGoal, setSecondaryGoal] = useState<TrainingGoal | ''>('');
  const [goalNotes, setGoalNotes] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>('');
  const [trainingPreference, setTrainingPreference] = useState<'1:1' | 'group' | 'solo' | 'mixed' | ''>('');
  const [injuryFlags, setInjuryFlags] = useState<InjuryFlag[]>([]);
  const [injuryNotes, setInjuryNotes] = useState('');
  const [movementConfidence, setMovementConfidence] = useState({ squat: 3, hinge: 3, push: 3, pull: 3, core: 3 });
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [sessionLength, setSessionLength] = useState(60);
  const [trainAloneOutsidePT, setTrainAloneOutsidePT] = useState<'yes' | 'maybe' | 'no' | ''>('');
  
  // Book first session (optional)
  const [firstSessionDate, setFirstSessionDate] = useState('');
  const [firstSessionTime, setFirstSessionTime] = useState('09:00');
  
  // Exercise demo during consultation
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [consultationExercises, setConsultationExercises] = useState<{
    id: string;
    exerciseId: string;
    name: string;
    sets: { id: string; weight?: number; reps?: number; completed: boolean }[];
    notes: string;
  }[]>([]);
  
  // Completion
  const [isComplete, setIsComplete] = useState(false);

  // Auto-skip popup if client already exists
  useEffect(() => {
    const allUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const existingUser = allUsers.find((u: any) => u.id === clientId);
    
    if (existingUser) {
      setAccountName(existingUser.displayName || existingUser.username || '');
      setAccountEmail(existingUser.email || '');
      setAccountGender(existingUser.gender || 'other');
      setAccountCreated(true);
      setCreatedClientId(clientId);
      setShowQuickInfo(false);
    }
  }, [clientId]);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleCreateClient = async () => {
    if (!accountName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    
    setIsCreatingAccount(true);
    
    // Check if email exists — auto-link
    if (accountEmail.trim()) {
      try {
        const existingUsers = await fetchAllUsersFromSupabase();
        const existingUser = existingUsers.find((u: any) => 
          u.email?.toLowerCase() === accountEmail.toLowerCase().trim()
        );
        
        if (existingUser) {
          const { addClient } = useTrainerStore.getState();
          addClient(existingUser.id, { goals: [], onboardingComplete: false, status: 'active' });
          setCreatedClientId(existingUser.id);
          setAccountName(existingUser.displayName || accountName);
          setAccountCreated(true);
          setIsCreatingAccount(false);
          setShowQuickInfo(false);
          toast.success(`Linked to existing account: ${existingUser.email}`);
          return;
        }
      } catch (e) {
        console.log('[Onboarding] Could not check for existing users');
      }
    }
    
    // Create new client
    const newClientId = generateUUID();
    const username = accountName.toLowerCase().replace(/\s+/g, '_');
    // Generate random password per client (never hardcoded)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    
    const newClientUser = {
      id: newClientId,
      email: accountEmail.toLowerCase().trim() || `${username}@placeholder.local`,
      username,
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
      accountStatus: 'placeholder' as const,
      password: hashPassword(password),
    };
    
    // Save to localStorage
    const existingLocalUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    localStorage.setItem('apex-users', JSON.stringify([...existingLocalUsers.filter((u: any) => u.id !== newClientId), newClientUser]));
    
    // Sync to Supabase
    try {
      await registerUserToSupabase(newClientUser as any, password, 'placeholder');
      if (accountEmail.trim()) {
        toast.success(`Account created! Invite link sent to ${accountEmail}`);
      } else {
        toast.success('Client added!');
      }
    } catch (e) {
      toast.success('Client saved locally');
    }
    
    // Add to trainer's client list
    const { addClient } = useTrainerStore.getState();
    addClient(newClientId, { goals: [], onboardingComplete: false, status: 'active' });
    
    setCreatedClientId(newClientId);
    setAccountCreated(true);
    setIsCreatingAccount(false);
    setShowQuickInfo(false);
  };

  const toggleInjury = (injury: InjuryFlag) => {
    if (injury === 'none') {
      setInjuryFlags(['none']);
    } else {
      const newFlags = injuryFlags.filter(i => i !== 'none');
      if (newFlags.includes(injury)) {
        setInjuryFlags(newFlags.filter(i => i !== injury));
      } else {
        setInjuryFlags([...newFlags, injury]);
      }
    }
  };

  const handleFinish = () => {
    const actualClientId = createdClientId || clientId;
    const trainerId = user?.id || '';
    
    if (!accountCreated) {
      toast.error('Please create a client first');
      return;
    }
    
    // Save programming profile
    const profile: ClientProgrammingProfile = {
      id: `profile-${actualClientId}`,
      clientId: actualClientId,
      trainerId,
      primaryGoal: (primaryGoal as TrainingGoal) || 'general',
      secondaryGoal: (secondaryGoal as TrainingGoal) || undefined,
      customGoalText: goalNotes || undefined,
      trainingPreference: (trainingPreference as '1:1' | 'group' | 'solo' | 'mixed') || '1:1',
      experienceLevel: (experienceLevel as ExperienceLevel) || 'some',
      injuryFlags: injuryFlags.length > 0 ? injuryFlags : ['none'],
      injuryNotes: injuryNotes || undefined,
      daysPerWeek: availableDays.length || 2,
      availableDays: availableDays.length > 0 ? availableDays : undefined,
      scheduleNotes: scheduleNotes || undefined,
      sessionLength,
      trainAloneOutsidePT: (trainAloneOutsidePT as 'yes' | 'maybe' | 'no') || 'maybe',
      movementConfidence,
      wantsClasses: 'maybe',
      classReady: experienceLevel === 'confident' || experienceLevel === 'advanced',
      sleepQuality: 3 as 1 | 2 | 3 | 4 | 5,
      stressLevel: 3 as 1 | 2 | 3 | 4 | 5,
      jobActivity: 'moderate',
      currentPhase: 'foundation' as TrainingPhase,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveClientProfile(profile);

    // Update client record
    updateClient(actualClientId, {
      goals: primaryGoal ? [primaryGoal, secondaryGoal].filter(Boolean) as string[] : [],
      injuryHistory: injuryFlags.filter(i => i !== 'none').join(', ') + (injuryNotes ? ` - ${injuryNotes}` : ''),
      notes: goalNotes,
      onboardingComplete: true,
    });

    // Book first session if date selected
    if (firstSessionDate) {
      const sessionDate = new Date(firstSessionDate);
      const [hours, minutes] = firstSessionTime.split(':').map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);
      
      const endHour = hours + Math.floor((minutes + sessionLength) / 60);
      const endMin = (minutes + sessionLength) % 60;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
      
      addCalendarEvent({
        title: 'PT Session',
        type: 'session',
        date: sessionDate.toISOString(),
        startTime: firstSessionTime,
        endTime,
        clientId: actualClientId,
        trainerId,
        status: 'scheduled',
      });
      
      addSession({
        trainerId,
        clientId: actualClientId,
        date: sessionDate.toISOString(),
        startTime: firstSessionTime,
        endTime,
        duration: sessionLength,
        type: 'pt_session',
        status: 'scheduled',
        paid: false,
      });
      
      addNotification({
        userId: actualClientId,
        type: 'workout_assigned',
        title: 'Session Booked',
        message: `Your first PT session is booked for ${sessionDate.toLocaleDateString('en-NZ', { weekday: 'long', month: 'short', day: 'numeric' })} at ${firstSessionTime}`,
      });
    }

    // Save consultation exercises as a workout in client's history
    if (consultationExercises.length > 0) {
      const { workoutHistory } = useWorkoutStore.getState();
      const consultWorkout = {
        id: `consult-workout-${Date.now()}`,
        name: 'Consultation Session',
        exercises: consultationExercises.map((ex, i) => ({
          id: ex.id,
          exerciseId: ex.exerciseId,
          exercise: getExerciseById(ex.exerciseId) || {
            id: ex.exerciseId, name: ex.name,
            primaryMuscles: [] as MuscleGroup[], secondaryMuscles: [] as MuscleGroup[],
            category: 'compound' as const, equipment: 'barbell' as const,
          },
          sets: ex.sets.map((s, si) => ({
            id: s.id, setNumber: si + 1, type: 'normal' as const,
            weight: s.weight || 0, reps: s.reps || 0, completed: true,
          })),
          restTimerSeconds: 90,
          notes: ex.notes || undefined,
        })),
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        totalVolume: consultationExercises.reduce((sum, ex) => 
          sum + ex.sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0), 0),
        userId: actualClientId,
        assignedBy: trainerId,
        status: 'completed' as const,
        notes: 'Exercises performed during consultation',
        trainerNotes: `Consultation onboarding session for ${accountName}`,
      };
      useWorkoutStore.setState({ workoutHistory: [...workoutHistory, consultWorkout] });
    }

    setIsComplete(true);
    toast.success(firstSessionDate ? 'Onboarding complete! First session booked.' : 'Onboarding complete!');
    
    // Navigate to client page after short delay
    setTimeout(() => {
      router.push(`/clients`);
    }, 1500);
  };

  // Completion screen
  if (isComplete) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircle2 className="h-20 w-20 text-emerald-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-2xl font-bold text-white mb-2">Onboarding Complete!</h1>
          <p className="text-gray-400">Redirecting to clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Quick Info Popup — Phase 1 */}
      <Dialog open={showQuickInfo} onOpenChange={(open) => { if (accountCreated) setShowQuickInfo(open); }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-sky-400" />
              New Client
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter basic info to get started
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-gray-300">Name *</Label>
              <Input
                placeholder="e.g. John Smith"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="mt-1.5 bg-gray-800 border-gray-700"
              />
            </div>
            
            <div>
              <Label className="text-gray-300">Gender</Label>
              <Select value={accountGender} onValueChange={(v) => setAccountGender(v as any)}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-gray-300">Email <span className="text-gray-500">(optional)</span></Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                className="mt-1.5 bg-gray-800 border-gray-700"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {accountEmail.trim() ? 'An invite link will be sent to create their account' : 'Skip to add email later'}
              </p>
            </div>
            
            <Button
              onClick={handleCreateClient}
              disabled={isCreatingAccount || !accountName.trim()}
              className="w-full bg-sky-500 hover:bg-sky-600"
            >
              {isCreatingAccount ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase 2: Single scrollable assessment page */}
      {accountCreated && !showQuickInfo && (
        <>
          {/* Header */}
          <header className="sticky top-0 z-40 bg-gradient-to-b from-sky-500 via-sky-600 to-orange-500 px-5 pt-14 pb-6 shadow-xl">
            <div className="relative flex items-center justify-between">
              <button onClick={() => router.back()} className="p-2.5 -ml-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="text-center flex-1">
                <h1 className="text-xl font-bold text-white">Onboarding</h1>
                <p className="text-white/80 text-sm">{accountName}</p>
              </div>
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={!primaryGoal}
                className="bg-white text-sky-600 hover:bg-gray-100 font-semibold"
              >
                <Check className="w-4 h-4 mr-1" /> Finish
              </Button>
            </div>
          </header>

          <div className="px-4 py-5 space-y-6 pb-32">
            {/* Goals */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Target className="h-5 w-5 text-sky-400" /> Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm">Primary Goal *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {GOALS.map(g => (
                      <div
                        key={g.value}
                        onClick={() => setPrimaryGoal(g.value)}
                        className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                          primaryGoal === g.value 
                            ? 'border-sky-500 bg-sky-500/20' 
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <p className={`text-sm font-medium ${primaryGoal === g.value ? 'text-sky-400' : 'text-white'}`}>{g.label}</p>
                        <p className="text-[11px] text-gray-500">{g.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Secondary Goal</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {GOALS.filter(g => g.value !== primaryGoal).map(g => (
                      <div
                        key={g.value}
                        onClick={() => setSecondaryGoal(secondaryGoal === g.value ? '' : g.value)}
                        className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                          secondaryGoal === g.value 
                            ? 'border-sky-500 bg-sky-500/20' 
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <p className={`text-sm ${secondaryGoal === g.value ? 'text-sky-400' : 'text-gray-300'}`}>{g.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Notes</Label>
                  <Textarea
                    placeholder="Any specific goals..."
                    value={goalNotes}
                    onChange={(e) => setGoalNotes(e.target.value)}
                    className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Experience */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-purple-400" /> Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm">Training Experience</Label>
                  <div className="space-y-2 mt-2">
                    {EXPERIENCE_LEVELS.map(level => (
                      <div
                        key={level.value}
                        onClick={() => setExperienceLevel(level.value)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          experienceLevel === level.value 
                            ? 'border-purple-500 bg-purple-500/20' 
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <p className={`font-medium text-sm ${experienceLevel === level.value ? 'text-purple-400' : 'text-white'}`}>{level.label}</p>
                        <p className="text-[11px] text-gray-500">{level.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Training Preference</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { value: '1:1', label: '1-on-1 PT' },
                      { value: 'group', label: 'Group' },
                      { value: 'mixed', label: 'Mixed' },
                      { value: 'solo', label: 'Solo + Guidance' },
                    ].map(p => (
                      <div
                        key={p.value}
                        onClick={() => setTrainingPreference(p.value as any)}
                        className={`p-2.5 rounded-lg border-2 cursor-pointer text-center transition-all ${
                          trainingPreference === p.value 
                            ? 'border-purple-500 bg-purple-500/20' 
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <p className={`text-sm font-medium ${trainingPreference === p.value ? 'text-purple-400' : 'text-gray-300'}`}>{p.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Injuries */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-400" /> Injuries & Limitations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {INJURIES.map(injury => (
                    <div
                      key={injury.value}
                      onClick={() => toggleInjury(injury.value)}
                      className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-2 ${
                        injuryFlags.includes(injury.value)
                          ? 'border-amber-500 bg-amber-500/10' 
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Checkbox checked={injuryFlags.includes(injury.value)} className="pointer-events-none" />
                      <span className="text-sm text-gray-300">{injury.label}</span>
                    </div>
                  ))}
                </div>

                {injuryFlags.length > 0 && !injuryFlags.includes('none') && (
                  <Textarea
                    placeholder="Injury details..."
                    value={injuryNotes}
                    onChange={(e) => setInjuryNotes(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    rows={2}
                  />
                )}

                <div>
                  <Label className="text-gray-300 text-sm mb-3 block">Movement Confidence (1-5)</Label>
                  {(['squat', 'hinge', 'push', 'pull', 'core'] as const).map(pattern => (
                    <div key={pattern} className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-400 capitalize">{pattern}</span>
                        <span className="text-xs text-gray-500">{movementConfidence[pattern]}</span>
                      </div>
                      <Slider
                        value={[movementConfidence[pattern]]}
                        onValueChange={([v]) => setMovementConfidence({ ...movementConfidence, [pattern]: v })}
                        min={1} max={5} step={1}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-emerald-400" /> Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm">Available Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <Button key={day} size="sm"
                        variant={availableDays.includes(day) ? 'default' : 'outline'}
                        onClick={() => setAvailableDays(prev => 
                          prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                        )}
                        className="text-xs px-3"
                      >{day.slice(0, 3)}</Button>
                    ))}
                  </div>
                  {availableDays.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{availableDays.length} day{availableDays.length !== 1 ? 's' : ''} selected</p>
                  )}
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Schedule Notes</Label>
                  <Textarea
                    value={scheduleNotes}
                    onChange={(e) => setScheduleNotes(e.target.value)}
                    placeholder="e.g. Afternoons only, Before 3pm on Wednesdays..."
                    className="bg-gray-800 border-gray-700 text-white mt-2 h-16 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Session Length</Label>
                  <div className="flex gap-2 mt-2">
                    {[30, 45, 60, 75, 90].map(m => (
                      <Button key={m} size="sm"
                        variant={sessionLength === m ? 'default' : 'outline'}
                        onClick={() => setSessionLength(m)}
                        className="flex-1"
                      >{m}m</Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Train alone outside PT?</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { value: 'yes', label: 'Yes' },
                      { value: 'maybe', label: 'Maybe' },
                      { value: 'no', label: 'No' },
                    ].map(o => (
                      <Button key={o.value} size="sm"
                        variant={trainAloneOutsidePT === o.value ? 'default' : 'outline'}
                        onClick={() => setTrainAloneOutsidePT(o.value as any)}
                      >{o.label}</Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consultation Exercises (Optional) — Full Width Active Workout Style */}
            <div className="-mx-4 bg-gray-950 border-t border-b border-sky-500/30">
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-sky-400" />
                    <h3 className="text-base font-semibold text-white">Consultation Exercises</h3>
                    <Badge className="bg-gray-800 text-gray-400 text-[10px]">Optional</Badge>
                  </div>
                  {consultationExercises.length > 0 && (
                    <span className="text-xs text-gray-500">{consultationExercises.length} exercise{consultationExercises.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mb-4">
                  Take the client through exercises during the consultation — saved to their file
                </p>
              </div>

              {consultationExercises.length > 0 && (
                <div className="space-y-0">
                  {consultationExercises.map((ex, exIdx) => (
                    <div key={ex.id} className="bg-gray-900 border-t border-gray-800 px-4 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 text-sm font-bold">
                            {exIdx + 1}
                          </div>
                          <span className="text-base font-medium text-white">{ex.name}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => setConsultationExercises(consultationExercises.filter(e => e.id !== ex.id))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Set Header */}
                      <div className="flex items-center gap-3 mb-2 px-1">
                        <span className="w-10 text-[11px] text-gray-500 font-medium text-center">SET</span>
                        <span className="flex-1 text-[11px] text-gray-500 font-medium text-center">KG</span>
                        <span className="flex-1 text-[11px] text-gray-500 font-medium text-center">REPS</span>
                        <span className="w-8"></span>
                      </div>

                      {/* Sets */}
                      <div className="space-y-2">
                        {ex.sets.map((set, si) => (
                          <div key={set.id} className="flex items-center gap-3">
                            <span className="w-10 text-center text-sm text-gray-400 font-semibold">{si + 1}</span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              placeholder="0"
                              value={set.weight || ''}
                              onChange={(e) => {
                                const updated = [...consultationExercises];
                                updated[exIdx].sets[si].weight = parseFloat(e.target.value) || undefined;
                                setConsultationExercises(updated);
                              }}
                              className="flex-1 h-10 text-base font-medium bg-gray-800 border-gray-700 text-center text-white"
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              placeholder="0"
                              value={set.reps || ''}
                              onChange={(e) => {
                                const updated = [...consultationExercises];
                                updated[exIdx].sets[si].reps = parseInt(e.target.value) || undefined;
                                setConsultationExercises(updated);
                              }}
                              className="flex-1 h-10 text-base font-medium bg-gray-800 border-gray-700 text-center text-white"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-gray-500 hover:text-red-400"
                              onClick={() => {
                                const updated = [...consultationExercises];
                                updated[exIdx].sets = updated[exIdx].sets.filter((_, i) => i !== si);
                                setConsultationExercises(updated);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 text-sky-400 hover:text-sky-300 text-sm"
                        onClick={() => {
                          const updated = [...consultationExercises];
                          updated[exIdx].sets.push({ id: `set-${Date.now()}`, completed: false });
                          setConsultationExercises(updated);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Set
                      </Button>

                      {/* Notes */}
                      <Input
                        placeholder="Notes for this exercise..."
                        value={ex.notes}
                        onChange={(e) => {
                          const updated = [...consultationExercises];
                          updated[exIdx].notes = e.target.value;
                          setConsultationExercises(updated);
                        }}
                        className="mt-3 h-9 text-sm bg-gray-800 border-gray-700"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-4">
                <Button
                  variant="outline"
                  className="w-full h-12 border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-sky-500/50 text-base"
                  onClick={() => { setExerciseSearch(''); setShowExercisePicker(true); }}
                >
                  <Plus className="w-5 h-5 mr-2" /> Add Exercise
                </Button>
              </div>
            </div>

            {/* Book First Session (Optional) */}
            <Card className="bg-gray-900 border-emerald-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Dumbbell className="h-5 w-5 text-emerald-400" /> Book First Session
                  <Badge className="bg-gray-800 text-gray-400 text-[10px]">Optional</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-400 flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5" />
                    Client will receive a notification when you book
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300 text-sm">Date</Label>
                    <Input
                      type="date"
                      value={firstSessionDate}
                      onChange={(e) => setFirstSessionDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Time</Label>
                    <Select value={firstSessionTime} onValueChange={setFirstSessionTime}>
                      <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
                          '10:00','10:30','11:00','11:30','12:00','13:00','14:00','15:00',
                          '16:00','16:30','17:00','17:30','18:00','18:30','19:00','20:00'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {firstSessionDate && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {new Date(firstSessionDate).toLocaleDateString('en-NZ', { weekday: 'long', month: 'short', day: 'numeric' })} at {firstSessionTime}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Finish Button */}
            <Button
              onClick={handleFinish}
              disabled={!primaryGoal}
              className="w-full py-6 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-bold text-base rounded-xl shadow-lg"
            >
              <Check className="w-5 h-5 mr-2" />
              {firstSessionDate ? 'Finish & Book Session' : 'Finish Onboarding'}
            </Button>
          </div>
        </>
      )}
      {/* Exercise Picker Dialog */}
      <Dialog open={showExercisePicker} onOpenChange={setShowExercisePicker}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-sky-400" />
              Add Exercise
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search exercises..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-[40vh]">
            <div className="space-y-1">
              {searchExercises(exerciseSearch || '')
                .filter(ex => ex.category !== 'warmup' && ex.category !== 'stretching')
                .slice(0, 30)
                .map(ex => {
                  const counts = getExerciseUsageCounts(useWorkoutStore.getState().workoutHistory, clientId);
                  const count = counts[ex.id] || 0;
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => {
                        setConsultationExercises([...consultationExercises, {
                          id: `consult-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          exerciseId: ex.id,
                          name: ex.name,
                          sets: [
                            { id: `set-1-${Date.now()}`, completed: false },
                            { id: `set-2-${Date.now()}`, completed: false },
                            { id: `set-3-${Date.now()}`, completed: false },
                          ],
                          notes: '',
                        }]);
                        setShowExercisePicker(false);
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-sm text-white">{ex.name}</p>
                        <p className="text-[10px] text-gray-500">
                          {ex.primaryMuscles.join(', ')} • {ex.equipment}
                        </p>
                      </div>
                      {count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium mr-2">{count}×</span>
                      )}
                      <Plus className="w-4 h-4 text-sky-400" />
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
