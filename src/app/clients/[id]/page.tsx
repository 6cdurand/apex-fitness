'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuthStore, useTrainerStore, useWorkoutStore, useMedalStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { getDisplayedSessionCount } from '@/lib/stores/trainerStore';
import { getClientName as getClientNameUtil } from '@/lib/clientUtils';
import { convertProgramDayToTemplate } from '@/lib/programStartUtils';
import { useMessageStore } from '@/lib/messageStore';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EditHistoricalOffsetModal } from '@/components/clients/EditHistoricalOffsetModal';
import { 
  ArrowLeft,
  MessageCircle, 
  Calendar,
  Dumbbell,
  CreditCard,
  ClipboardList,
  Send,
  Plus,
  Check,
  X,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  User,
  Target,
  TrendingUp,
  MoreVertical,
  Trash2,
  Edit,
  Package,
  Settings,
  RotateCcw,
  Save,
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isFuture, isPast, startOfWeek, endOfWeek, isWithinInterval, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType, ClientSession, ClientPayment, SessionPackage } from '@/types';
import { WorkoutStatsCharts } from '@/components/WorkoutStatsCharts';
import { calculateCompliance, getAdherenceColor, getAdherenceBgColor, getAdherenceLabel } from '@/lib/compliance';
import { calculateFullStrengthRating } from '@/lib/strengthRating';
import { registerUserToSupabase, deleteUserFromSupabase, fetchAllUsersFromSupabase, fetchUserDataFromSupabase, isSupabaseConfigured, syncClientWorkoutsToSupabase, sendClientInvitation } from '@/lib/supabaseSync';
import { Workout, PersonalBest } from '@/types';
import { isAssistedExercise, getSetVolume, getUserBodyweight } from '@/lib/exercises';

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  
  const { user, isAuthenticated } = useAuthStore();
  const { 
    clients, 
    getClientById, 
    getSessionsForClient, 
    getPaymentsForClient, 
    getPackagesForClient,
    getEventsForClient,
    getActiveProgram,
    getClientPrograms,
    deleteClientProgram,
    markSessionComplete,
    markSessionNoShow,
    toggleSessionPaid,
    markPaymentPaid,
    addSession,
    addPayment,
    updatePayment,
    addSessionPackage,
    removeClient,
    setInitialClientStats,
    updateSessionPackage,
    updateClient,
    blockPerformances,
    getClientProfile,
    addCalendarEvent,
    deleteCalendarEvent,
    clientPrograms: storeClientPrograms,
    payments: allPayments,
    // BACKLOG #10 / BUG-007: subscribe to the raw collections so the memos
    // below recompute (and the component re-renders) when a refetch-on-resume
    // mutates them — without a remount. Mirrors PR #45's `allPayments` fix.
    sessions: storeSessions,
    sessionPackages: storeSessionPackages,
    calendarEvents: storeCalendarEvents,
  } = useTrainerStore();
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  
  // Load users from both localStorage AND Supabase for cross-device sync
  useEffect(() => {
    const loadAllUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
      setAllUsers(stored);
      
      try {
        const supabaseUsersList = await fetchAllUsersFromSupabase();
        if (supabaseUsersList && supabaseUsersList.length > 0) {
          const supabaseIds = new Set(supabaseUsersList.map((u: any) => u.id));
          const localOnlyUsers = stored.filter((u: any) => !supabaseIds.has(u.id));
          const mergedUsers = [...supabaseUsersList, ...localOnlyUsers];
          setAllUsers(mergedUsers);
        }
      } catch (e) {
        console.error('[ClientDetail] Error loading users from Supabase:', e);
      }
    };
    loadAllUsers();
  }, []);
  const { getOrCreateConversation, sendMessage, getMessages, markAsRead } = useMessageStore();
  const { workoutHistory, personalBests } = useWorkoutStore();
  
  // State for client workout data fetched from Supabase
  const [clientWorkouts, setClientWorkouts] = useState<Workout[]>([]);
  const [clientPBs, setClientPBs] = useState<PersonalBest[]>([]);
  
  // Fetch client's workout data from Supabase for cross-device sync
  useEffect(() => {
    const fetchClientWorkoutData = async () => {
      if (!clientId || !isSupabaseConfigured()) return;
      
      try {
        console.log('[ClientDetail] Fetching workout data for client:', clientId);
        const remoteData = await fetchUserDataFromSupabase(clientId);
        if (remoteData) {
          console.log('[ClientDetail] Got client workouts:', remoteData.workouts.length);
          setClientWorkouts(remoteData.workouts);
          setClientPBs(remoteData.personalBests);
          
          // Also update the global workout store with this client's data
          useWorkoutStore.setState(state => {
            const existingIds = new Set(state.workoutHistory.map(w => w.id));
            const newWorkouts = remoteData.workouts.filter(w => !existingIds.has(w.id));
            const existingPBIds = new Set(state.personalBests.map(pb => pb.id));
            const newPBs = remoteData.personalBests.filter(pb => !existingPBIds.has(pb.id));
            
            return {
              workoutHistory: [...state.workoutHistory, ...newWorkouts],
              personalBests: [...state.personalBests, ...newPBs],
            };
          });
        }
      } catch (e) {
        console.error('[ClientDetail] Error fetching client workout data:', e);
      }
    };
    
    fetchClientWorkoutData();
  }, [clientId]);
  
  // Get client-specific workout data - merge local and remote
  const clientWorkoutHistory = useMemo(() => {
    const localWorkouts = workoutHistory.filter(w => w.userId === clientId && !w.deletedAt);
    // Merge with fetched client workouts, deduplicating by ID
    const allWorkouts = [...localWorkouts];
    clientWorkouts.forEach(w => {
      if (!w.deletedAt && !allWorkouts.find(existing => existing.id === w.id)) {
        allWorkouts.push(w);
      }
    });
    return allWorkouts;
  }, [workoutHistory, clientId, clientWorkouts]);
  
  const clientPersonalBests = useMemo(() => {
    const localPBs = personalBests.filter(pb => pb.userId === clientId);
    const allPBs = [...localPBs];
    clientPBs.forEach(pb => {
      if (!allPBs.find(existing => existing.id === pb.id)) {
        allPBs.push(pb);
      }
    });
    return allPBs;
  }, [personalBests, clientId, clientPBs]);
  
  const [messageInput, setMessageInput] = useState('');
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditStats, setShowEditStats] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [sessionsCovered, setSessionsCovered] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Edit stats state for onboarding existing clients
  const [editSessionsDone, setEditSessionsDone] = useState('');
  const [editSessionsLeft, setEditSessionsLeft] = useState('');
  const [editTotalPaid, setEditTotalPaid] = useState('');
  
  // Edit/Create package state
  const [showEditPackage, setShowEditPackage] = useState(false);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [editPackageTotal, setEditPackageTotal] = useState('');
  const [editPackageUsed, setEditPackageUsed] = useState('');
  const [editPackagePaid, setEditPackagePaid] = useState('');
  const [editPackagePrice, setEditPackagePrice] = useState('');
  const [editPackageIsContinuous, setEditPackageIsContinuous] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  
  // Edit payment state
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  
  // Edit goals/notes state
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newPackageTotal, setNewPackageTotal] = useState('');
  const [newPackagePrice, setNewPackagePrice] = useState('');
  const [isContinuousPackage, setIsContinuousPackage] = useState(false);
  const [isSyncingWorkouts, setIsSyncingWorkouts] = useState(false);
  
  // PT/Personal toggle per workout day when scheduling
  const [daySessionTypes, setDaySessionTypes] = useState<Record<number, 'pt' | 'personal'>>({});
  
  // Workout editing state
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [editedWorkoutExercises, setEditedWorkoutExercises] = useState<Workout['exercises'] | null>(null);
  
  // Email editing and invitation state
  const [showEditEmail, setShowEditEmail] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  
  // Calculate per-session cost
  const perSessionCost = paymentAmount && sessionsCovered && parseInt(sessionsCovered) > 0
    ? (parseFloat(paymentAmount) / parseInt(sessionsCovered)).toFixed(2)
    : null;

  const { hydrated } = useRequireAuth();

  useEffect(() => {
    if (hydrated && isAuthenticated && user?.mode !== 'trainer') {
      router.replace('/workout');
    }
  }, [hydrated, isAuthenticated, user?.mode, router]);

  // Get client data
  const clientRelation = useMemo(() => getClientById(clientId), [clientId, clients]);
  const clientUserRaw = useMemo(() => 
    allUsers.find((u: UserType) => u.id === clientId), 
    [allUsers, clientId]
  );
  // For placeholder clients (no user record), build a fallback from trainer_clients data
  const isPlaceholder = !!clientRelation && !clientUserRaw;
  const clientUser = useMemo(() => {
    if (clientUserRaw) return clientUserRaw;
    if (!clientRelation) return undefined;
    // Construct minimal synthetic user from clientRelation + display info waterfall
    const info = getClientNameUtil(clientId);
    return {
      id: clientId,
      displayName: (clientRelation as any).displayName || (clientRelation.client?.displayName) || info || 'Client',
      username: (clientRelation as any).username || clientRelation.client?.username || '',
      email: (clientRelation as any).email || clientRelation.client?.email || '',
      profilePhoto: (clientRelation as any).profilePhoto || clientRelation.client?.profilePhoto || '',
      gender: (clientRelation as any).gender || clientRelation.client?.gender || 'other',
      mode: 'user' as const,
      preferredUnit: 'kg' as const,
      createdAt: clientRelation.startDate || new Date().toISOString(),
      height: (clientRelation as any).height,
      weight: (clientRelation as any).weight,
    } as UserType;
  }, [clientUserRaw, clientRelation, clientId]);
  
  // BACKLOG #10: key each memo on its underlying store collection (not just
  // clientId) so a refetch-on-resume that replaces the collection re-renders
  // the screen without a remount. Mirrors PR #45's payments fix.
  const sessions = useMemo(() => getSessionsForClient(clientId), [clientId, storeSessions]);
  const payments = useMemo(() => getPaymentsForClient(clientId), [clientId, allPayments]);
  const packages = useMemo(() => getPackagesForClient(clientId), [clientId, storeSessionPackages]);
  const calendarEvents = useMemo(() => getEventsForClient(clientId), [clientId, storeCalendarEvents]);
  const activeProgram = useMemo(() => getActiveProgram(clientId), [clientId, storeClientPrograms]);
  const allClientPrograms = useMemo(() => getClientPrograms(clientId), [clientId, storeClientPrograms]);
  
  // Messages
  const conversation = useMemo(() => {
    if (!user?.id || !clientId) return null;
    return getOrCreateConversation(user.id, clientId);
  }, [user?.id, clientId]);
  
  const messages = useMemo(() => {
    if (!conversation) return [];
    return getMessages(conversation.id);
  }, [conversation]);

  // D4: mark inbound messages as read whenever the trainer opens / is on the
  // Messages tab for this client. Mirrors @/app/messages/page.tsx:61-65.
  // Without this, reads from the trainer side never flipped read=true.
  useEffect(() => {
    if (activeTab === 'messages' && conversation && user) {
      markAsRead(conversation.id, user.id);
    }
  }, [activeTab, conversation, user, markAsRead]);

  // Stats - count ACTUAL completed workouts (from workout store) for training stats
  // AND count PT sessions (from trainer store) for billing purposes
  const ptSessions = sessions.filter(s => s.type === 'pt_session');
  const scheduledPTSessions = ptSessions.filter(s => s.status === 'scheduled').length;
  const unpaidSessions = ptSessions.filter(s => s.status === 'completed' && !s.paid).length;
  const noShowSessions = ptSessions.filter(s => s.status === 'no_show').length;
  const activePackage = packages.find(p => p.status === 'active') || packages.find(p => p.status === 'completed');
  const isPackageCompleted = activePackage?.status === 'completed';
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  
  // Actual completed workouts (from workout store) - this is the real training data
  const completedWorkouts = clientWorkoutHistory.length;
  // Upcoming sessions from calendar events + scheduled PT sessions
  const upcomingSessions = scheduledPTSessions + calendarEvents.filter(e => 
    new Date(e.date) >= new Date() && e.type === 'session'
  ).length;

  // NOTE: Auto-sync of package.usedSessions removed — client.totalSessions is now the
  // source of truth for lifetime session counts (decoupled from packages).
  // Package counters are only incremented when markSessionComplete/addSession runs.

  // Program compliance
  const compliance = useMemo(() => 
    calculateCompliance(clientId, clientWorkoutHistory, calendarEvents),
    [clientId, clientWorkoutHistory, calendarEvents]
  );

  const handleSendMessage = () => {
    if (!messageInput.trim() || !conversation || !user) return;
    sendMessage(conversation.id, user.id, clientId, messageInput.trim());
    setMessageInput('');
    toast.success('Message sent');
  };

  const handleMarkSessionComplete = (sessionId: string) => {
    markSessionComplete(sessionId);
    toast.success('Session marked as complete');
  };

  const handleMarkSessionNoShow = (sessionId: string) => {
    markSessionNoShow(sessionId);
    toast.success('Session marked as no-show (session deducted)');
  };

  const handleTogglePaid = (sessionId: string, currentlyPaid: boolean) => {
    toggleSessionPaid(sessionId);
    toast.success(currentlyPaid ? 'Session marked as unpaid' : 'Session marked as paid');
  };

  const handleMarkPaymentPaid = (paymentId: string) => {
    markPaymentPaid(paymentId, 'cash');
    toast.success('Payment marked as paid');
  };

  const [showRemoveClientConfirm, setShowRemoveClientConfirm] = useState(false);
  // v12-D3: historical-offset edit modal state
  const [showHistoricalOffsetModal, setShowHistoricalOffsetModal] = useState(false);

  const handleDeleteClient = () => {
    // Only remove from trainer's client list - do NOT delete from Supabase
    // Supabase account deletion should only happen from the user's own Settings page
    removeClient(clientId);
    toast.success('Client removed from your list');
    router.push('/clients');
  };

  const handleSyncToSupabase = async () => {
    if (!clientUser) {
      toast.error('Client user data not found');
      return;
    }
    
    try {
      const synced = await registerUserToSupabase({
        id: clientUser.id,
        email: clientUser.email,
        username: clientUser.username,
        displayName: clientUser.displayName,
        gender: clientUser.gender,
        mode: 'user',
        isTrainer: false,
        isVerifiedTrainer: false,
        preferredUnit: clientUser.preferredUnit || 'kg',
        createdAt: clientUser.createdAt,
        followers: [],
        following: [],
        trainerId: user?.id,
      });

      if (synced) {
        toast.success(`${clientUser.displayName} synced to cloud! Send them an invitation to set up their password.`);
      } else {
        toast.error('Sync failed - Supabase may not be configured or account may already exist');
      }
    } catch (e) {
      console.error('Sync error:', e);
      toast.error('Failed to sync client account');
    }
  };

  // Send email invitation to client
  const handleSendInvitation = async (emailToUse?: string) => {
    const targetEmail = emailToUse || clientUser?.email;
    if (!targetEmail) {
      toast.error('No email address provided');
      return;
    }
    
    setIsSendingInvite(true);
    try {
      const result = await sendClientInvitation(
        user?.id || '',
        clientId,
        targetEmail,
        user?.displayName || 'Your Trainer',
        getClientNameUtil(clientId),
        (clientUser as any)?.password || 'client123'
      );
      
      if (result.success) {
        toast.success(`Invitation sent to ${targetEmail}!`);
        setShowEditEmail(false);
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    } catch (e) {
      console.error('Invitation error:', e);
      toast.error('Failed to send invitation');
    }
    setIsSendingInvite(false);
  };

  // Update client email and send invitation
  const handleUpdateEmailAndInvite = async () => {
    if (!editEmail || !editEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    // Update client email in localStorage
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const updatedUsers = storedUsers.map((u: UserType) => 
      u.id === clientId ? { ...u, email: editEmail } : u
    );
    localStorage.setItem('apex-users', JSON.stringify(updatedUsers));
    
    // Update local state
    setAllUsers(updatedUsers);
    
    // Also persist to Supabase
    try {
      const { updateUserInSupabase } = await import('@/lib/supabaseSync');
      await updateUserInSupabase(clientId, { email: editEmail } as any);
    } catch (e) {
      console.error('[ClientDetail] Failed to update email in Supabase:', e);
    }
    
    // Send invitation to new email
    await handleSendInvitation(editEmail);
  };

  const handleAddPayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const sessionsCount = sessionsCovered ? parseInt(sessionsCovered) : 0;
    const amount = parseFloat(paymentAmount);
    
    // Add payment record with the specified date
    addPayment({
      clientId,
      trainerId: user?.id || '',
      amount,
      description: paymentDescription || (sessionsCount > 0 ? `${sessionsCount} Session Package` : 'Payment'),
      method: paymentMethod,
      status: 'paid',
      type: sessionsCount > 0 ? 'session_pack' : 'single_session',
      currency: 'USD',
      sessionsIncluded: sessionsCount > 0 ? sessionsCount : undefined,
      paidAt: new Date(paymentDate).toISOString(),
    });
    
    // Create session package if sessions are covered
    if (sessionsCount > 0) {
      addSessionPackage({
        clientId,
        trainerId: user?.id || '',
        name: `${sessionsCount} Session Package`,
        totalSessions: sessionsCount,
        paidSessions: sessionsCount, // All sessions paid upfront
        priceTotal: amount,
        pricePerSession: amount / sessionsCount,
        purchaseDate: new Date().toISOString(),
        paymentId: '', // Will be linked by timestamp proximity
        status: 'active',
      });
      toast.success(`Payment of $${paymentAmount} recorded for ${sessionsCount} sessions ($${(amount / sessionsCount).toFixed(2)}/session)`);
    } else {
      toast.success(`Payment of $${paymentAmount} recorded`);
    }
    
    setShowAddPayment(false);
    setPaymentAmount('');
    setPaymentDescription('');
    setPaymentMethod('cash');
    setSessionsCovered('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleSaveInitialStats = () => {
    const sessionsDone = parseInt(editSessionsDone) || 0;
    const sessionsLeft = parseInt(editSessionsLeft) || 0;
    const totalPaid = parseFloat(editTotalPaid) || 0;
    
    if (sessionsDone === 0 && sessionsLeft === 0 && totalPaid === 0) {
      toast.error('Please enter at least one value');
      return;
    }
    
    setInitialClientStats(clientId, sessionsDone, sessionsLeft, totalPaid);
    toast.success('Client history imported successfully');
    setShowEditStats(false);
    setEditSessionsDone('');
    setEditSessionsLeft('');
    setEditTotalPaid('');
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setEditPaymentMethod(payment.method || 'cash');
    setEditPaymentDate(payment.paidAt ? new Date(payment.paidAt).toISOString().split('T')[0] : new Date(payment.createdAt).toISOString().split('T')[0]);
    setEditPaymentAmount(payment.amount?.toString() || '');
    setShowEditPayment(true);
  };

  const handleSavePaymentEdit = () => {
    if (!editingPayment) return;
    
    updatePayment(editingPayment.id, {
      method: editPaymentMethod,
      paidAt: new Date(editPaymentDate).toISOString(),
      amount: parseFloat(editPaymentAmount) || editingPayment.amount,
      status: 'paid',
    });
    
    toast.success('Payment updated');
    setShowEditPayment(false);
    setEditingPayment(null);
  };

  // Workout editing handlers
  const handleUpdateWorkoutSet = (exerciseId: string, setId: string, field: 'weight' | 'reps', value: number) => {
    if (!editedWorkoutExercises) return;
    
    setEditedWorkoutExercises(editedWorkoutExercises.map(ex => 
      ex.id === exerciseId
        ? {
            ...ex,
            sets: ex.sets.map(s => 
              s.id === setId ? { ...s, [field]: value } : s
            ),
          }
        : ex
    ));
  };

  const handleSaveWorkoutEdit = () => {
    if (!editingWorkout || !editedWorkoutExercises) return;
    
    // Recalculate total volume — bodyweight-based for assisted exercises
    const clientBW = getUserBodyweight(editingWorkout.userId);
    const newTotalVolume = editedWorkoutExercises.reduce((sum, ex) => {
      const exAssisted = isAssistedExercise(ex.exerciseId, ex.exercise?.name);
      return sum + ex.sets.filter(s => s.completed).reduce((setSum, set) => {
        return setSum + getSetVolume(set.weight, set.reps || 0, set.isAssisted || exAssisted, clientBW);
      }, 0);
    }, 0);
    
    // Update workout in store (this will also recalculate PBs and sync to Supabase)
    const { updateCompletedWorkout } = useWorkoutStore.getState();
    updateCompletedWorkout(editingWorkout.id, {
      exercises: editedWorkoutExercises,
      totalVolume: newTotalVolume,
    });
    
    toast.success('Workout updated - PBs and stats recalculated');
    setEditingWorkout(null);
    setEditedWorkoutExercises(null);
  };

  if (!clientUser || !clientRelation) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <User className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-400">Client not found</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header - Rose/Red Trainer Theme */}
      <div className="sticky top-0 z-50">
        <div className="bg-gradient-to-r from-rose-600 to-red-500 px-4 pt-12 pb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <button onClick={() => setShowProfileCard(true)}>
              <Avatar className="w-12 h-12 cursor-pointer hover:ring-2 hover:ring-white/50 transition-all border-2 border-white/20">
                <AvatarImage src={clientUser.profilePhoto} />
                <AvatarFallback className="bg-rose-700 text-white">{clientUser.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white">{clientUser.displayName}</h1>
              <p className="text-sm text-rose-100">@{clientUser.username}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:text-white hover:bg-white/10"
              onClick={() => router.push(`/messages?with=${clientUser.id}`)}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
            <div className="flex items-center gap-1">
              {isPlaceholder && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-200 border-amber-400/30 text-[10px]">
                  Pending Signup
                </Badge>
              )}
              <Badge 
                variant={clientRelation.status === 'active' ? 'default' : 'secondary'}
                className={`cursor-pointer hover:opacity-80 transition-opacity ${
                  clientRelation.status === 'active' ? 'bg-white/20 text-white border-white/30' : 'bg-rose-800 text-rose-200'
                }`}
                onClick={() => {
                  const newStatus = clientRelation.status === 'active' ? 'paused' : 'active';
                  updateClient(clientId, { status: newStatus });
                  toast.success(`Client ${newStatus === 'active' ? 'activated' : 'paused'}`);
                }}
              >
                {clientRelation.status === 'active' ? 'Active' : clientRelation.status === 'paused' ? 'Paused' : clientRelation.status}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowRemoveClientConfirm(true)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
      }} className="flex-1">
        <TabsList className="grid grid-cols-5 mx-4 mt-4 bg-gray-100">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="program" className="text-xs data-[state=active]:bg-rose-500">Program</TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">Progress</TabsTrigger>
          <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 pb-24">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Session Package Summary - Editable or Create New */}
            {activePackage ? (
              <Card className={`border ${isPackageCompleted ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30' : activePackage.isContinuous ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30' : 'bg-gradient-to-r from-sky-500/20 to-blue-500/20 border-sky-500/30'}`}>
                <CardContent className="p-4">
                  {/* Package Completed Banner */}
                  {isPackageCompleted && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <span className="font-semibold text-green-400">Package Complete!</span>
                      </div>
                      <p className="text-xs text-green-300/70 mb-3">
                        All {activePackage.totalSessions} sessions have been used. Your session and payment history is preserved below.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
                          onClick={() => {
                            // Reset: reactivate with same settings, reset counters
                            updateSessionPackage(activePackage.id, {
                              usedSessions: 0,
                              remainingSessions: activePackage.totalSessions,
                              paidSessions: 0,
                              status: 'active',
                            });
                            toast.success('Package reset — counters back to 0');
                          }}
                        >
                          Reset Package
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() => setShowCreatePackage(true)}
                        >
                          New Package
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Package className={`w-5 h-5 ${isPackageCompleted ? 'text-green-400' : activePackage.isContinuous ? 'text-blue-400' : 'text-sky-400'}`} />
                      {isPackageCompleted ? 'Completed Package' : activePackage.isContinuous ? 'Continuous Training' : 'Session Package'}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-900"
                      onClick={() => {
                        setEditPackageTotal(activePackage.totalSessions.toString());
                        setEditPackageUsed((activePackage.usedSessions || 0).toString());
                        setEditPackagePaid((activePackage.paidSessions || 0).toString());
                        setEditPackagePrice(activePackage.pricePerSession.toString());
                        setEditPackageIsContinuous(!!activePackage.isContinuous);
                        setShowEditPackage(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {activePackage.isContinuous ? (
                    /* Continuous package display */
                    <>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-blue-400">{activePackage.usedSessions || 0}</p>
                          <p className="text-xs text-gray-400">Sessions Done</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-sky-400">{activePackage.paidSessions || 0}</p>
                          <p className="text-xs text-gray-400">Sessions Paid</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-gray-900">${activePackage.pricePerSession.toFixed(0)}</p>
                          <p className="text-xs text-gray-400">Per Session</p>
                        </div>
                      </div>
                      
                      {/* Payment status */}
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-center">
                          <p className="text-lg font-bold text-sky-400">${((activePackage.paidSessions || 0) * activePackage.pricePerSession).toFixed(0)}</p>
                          <p className="text-xs text-gray-400">Total Paid</p>
                        </div>
                        <div className={`p-2 rounded-lg text-center ${(activePackage.usedSessions || 0) > (activePackage.paidSessions || 0) ? 'bg-amber-500/10' : 'bg-gray-50'}`}>
                          <p className={`text-lg font-bold ${(activePackage.usedSessions || 0) > (activePackage.paidSessions || 0) ? 'text-amber-400' : 'text-gray-400'}`}>
                            ${(Math.max(0, (activePackage.usedSessions || 0) - (activePackage.paidSessions || 0)) * activePackage.pricePerSession).toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-400">Outstanding</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Fixed package display */
                    <>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-sky-400">{activePackage.usedSessions || 0}/{activePackage.totalSessions}</p>
                          <p className="text-xs text-gray-400">Sessions Used</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-gray-900">${activePackage.pricePerSession.toFixed(0)}</p>
                          <p className="text-xs text-gray-400">Per Session</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-blue-400">${((activePackage.paidSessions || 0) * activePackage.pricePerSession).toFixed(0)}</p>
                          <p className="text-xs text-gray-400">Total Paid</p>
                        </div>
                      </div>
                      
                      {/* Progress bar - only for fixed packages */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{activePackage.usedSessions || 0} completed</span>
                          {(activePackage.usedSessions || 0) > activePackage.totalSessions ? (
                            <span className="text-emerald-400">+{(activePackage.usedSessions || 0) - activePackage.totalSessions} extra sessions</span>
                          ) : (
                            <span>{activePackage.remainingSessions || 0} remaining</span>
                          )}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${(activePackage.usedSessions || 0) > activePackage.totalSessions ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-sky-500 to-blue-500'}`}
                            style={{ width: `${Math.min(100, ((activePackage.usedSessions || 0) / Math.max(activePackage.totalSessions, activePackage.usedSessions || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Outstanding payment warning */}
                      {(activePackage.usedSessions || 0) > (activePackage.paidSessions || 0) && (
                        <div className="mt-2 p-2 bg-amber-500/10 rounded-lg flex justify-between items-center">
                          <span className="text-xs text-amber-400">
                            {(activePackage.usedSessions || 0) - (activePackage.paidSessions || 0)} unpaid sessions
                          </span>
                          <span className="text-sm font-bold text-amber-400">
                            ${((activePackage.usedSessions || 0) - (activePackage.paidSessions || 0)) * activePackage.pricePerSession}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* No active package - compact hint */
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">No session package</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                  onClick={() => {
                    setNewPackageTotal('');
                    setNewPackagePrice('');
                    setShowCreatePackage(true);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Package
                </Button>
              </div>
            )}

            {/* Create Package Dialog */}
            <Dialog open={showCreatePackage} onOpenChange={(open) => {
              setShowCreatePackage(open);
              if (!open) {
                setIsContinuousPackage(false);
                setNewPackageTotal('');
                setNewPackagePrice('');
              }
            }}>
              <DialogContent className="bg-white border-gray-200 shadow-sm">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">Create Session Package</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Package Type Toggle */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={!isContinuousPackage ? "default" : "outline"}
                      className={!isContinuousPackage ? "flex-1 bg-sky-500 hover:bg-sky-600" : "flex-1 border-gray-200 text-gray-500"}
                      onClick={() => setIsContinuousPackage(false)}
                    >
                      Fixed Sessions
                    </Button>
                    <Button
                      type="button"
                      variant={isContinuousPackage ? "default" : "outline"}
                      className={isContinuousPackage ? "flex-1 bg-blue-500 hover:bg-blue-600" : "flex-1 border-gray-200 text-gray-500"}
                      onClick={() => setIsContinuousPackage(true)}
                    >
                      Continuous
                    </Button>
                  </div>
                  
                  {!isContinuousPackage && (
                    <div>
                      <Label className="text-gray-600">Total Sessions</Label>
                      <Input
                        type="number"
                        value={newPackageTotal}
                        onChange={(e) => setNewPackageTotal(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                        placeholder="e.g., 10"
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-gray-600">Price Per Session ($)</Label>
                    <Input
                      type="number"
                      value={newPackagePrice}
                      onChange={(e) => setNewPackagePrice(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                      placeholder="e.g., 50"
                    />
                  </div>
                  
                  {isContinuousPackage ? (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-400 text-sm">
                        <strong>Continuous Package:</strong> Sessions are tracked without a limit. 
                        Ideal for ongoing clients who pay per session or monthly.
                      </p>
                    </div>
                  ) : newPackageTotal && newPackagePrice && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Package Total:</span>
                        <span className="text-sky-500 font-bold">
                          ${(parseInt(newPackageTotal) * parseFloat(newPackagePrice)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <Button
                    className={`w-full ${isContinuousPackage ? 'bg-blue-500 hover:bg-blue-600' : 'bg-sky-500 hover:bg-sky-600'}`}
                    onClick={() => {
                      if (isContinuousPackage && newPackagePrice) {
                        const price = parseFloat(newPackagePrice);
                        addSessionPackage({
                          clientId,
                          trainerId: user?.id || '',
                          name: 'Continuous Training',
                          totalSessions: -1,
                          paidSessions: 0,
                          priceTotal: 0,
                          pricePerSession: price,
                          purchaseDate: new Date().toISOString(),
                          paymentId: '',
                          status: 'active',
                          isContinuous: true,
                        });
                        setShowCreatePackage(false);
                        setIsContinuousPackage(false);
                        toast.success(`Continuous package created at $${price}/session`);
                      } else if (newPackageTotal && newPackagePrice) {
                        const total = parseInt(newPackageTotal);
                        const price = parseFloat(newPackagePrice);
                        
                        addSessionPackage({
                          clientId,
                          trainerId: user?.id || '',
                          name: `${total} Session Package`,
                          totalSessions: total,
                          paidSessions: 0,
                          priceTotal: total * price,
                          pricePerSession: price,
                          purchaseDate: new Date().toISOString(),
                          paymentId: '',
                          status: 'active',
                          isContinuous: false,
                        });
                        setShowCreatePackage(false);
                        toast.success(`Package created: ${total} sessions at $${price}/session`);
                      }
                    }}
                    disabled={isContinuousPackage ? !newPackagePrice : (!newPackageTotal || !newPackagePrice)}
                  >
                    Create Package
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Package Dialog */}
            <Dialog open={showEditPackage} onOpenChange={setShowEditPackage}>
              <DialogContent className="bg-white border-gray-200 shadow-sm">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">
                    {editPackageIsContinuous ? 'Edit Continuous Training' : 'Edit Session Package'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Package Type Toggle */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={!editPackageIsContinuous ? 'default' : 'outline'}
                      className={!editPackageIsContinuous ? 'flex-1 bg-sky-500 hover:bg-sky-600' : 'flex-1 border-gray-200 text-gray-500'}
                      onClick={() => setEditPackageIsContinuous(false)}
                    >
                      Fixed Sessions
                    </Button>
                    <Button
                      type="button"
                      variant={editPackageIsContinuous ? 'default' : 'outline'}
                      className={editPackageIsContinuous ? 'flex-1 bg-blue-500 hover:bg-blue-600' : 'flex-1 border-gray-200 text-gray-500'}
                      onClick={() => setEditPackageIsContinuous(true)}
                    >
                      Continuous
                    </Button>
                  </div>
                  
                  {/* For fixed packages: show total sessions */}
                  {!editPackageIsContinuous && (
                    <div>
                      <Label className="text-gray-600">Total Sessions in Package</Label>
                      <Input
                        type="number"
                        value={editPackageTotal}
                        onChange={(e) => setEditPackageTotal(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                        placeholder="e.g., 10"
                      />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Sessions Completed</Label>
                      <Input
                        type="number"
                        value={editPackageUsed}
                        onChange={(e) => setEditPackageUsed(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                        placeholder="e.g., 5"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-600">Sessions Paid</Label>
                      <Input
                        type="number"
                        value={editPackagePaid}
                        onChange={(e) => setEditPackagePaid(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                        placeholder="e.g., 5"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-gray-600">Price Per Session ($)</Label>
                    <Input
                      type="number"
                      value={editPackagePrice}
                      onChange={(e) => setEditPackagePrice(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                      placeholder="e.g., 50"
                    />
                  </div>
                  
                  {/* Summary */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Earned:</span>
                      <span className="text-sky-500 font-bold">
                        ${((parseInt(editPackageUsed || '0')) * parseFloat(editPackagePrice || '0')).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Paid:</span>
                      <span className="text-blue-400 font-bold">
                        ${((parseInt(editPackagePaid || '0')) * parseFloat(editPackagePrice || '0')).toFixed(2)}
                      </span>
                    </div>
                    {parseInt(editPackageUsed || '0') > parseInt(editPackagePaid || '0') && (
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-400">Outstanding:</span>
                        <span className="text-amber-400 font-bold">
                          ${((parseInt(editPackageUsed || '0') - parseInt(editPackagePaid || '0')) * parseFloat(editPackagePrice || '0')).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {!editPackageIsContinuous && (
                      <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                        <span className="text-gray-400">Sessions Remaining:</span>
                        <span className="text-gray-900 font-bold">
                          {Math.max(0, parseInt(editPackageTotal || '0') - parseInt(editPackageUsed || '0'))}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    className="w-full bg-sky-500 hover:bg-sky-600"
                    onClick={() => {
                      if (activePackage && editPackagePrice) {
                        const newTotal = editPackageIsContinuous ? -1 : parseInt(editPackageTotal || '0');
                        const newUsed = parseInt(editPackageUsed || '0');
                        const newPaid = parseInt(editPackagePaid || '0');
                        const newPrice = parseFloat(editPackagePrice);
                        const newRemaining = editPackageIsContinuous ? -1 : Math.max(0, newTotal - newUsed);
                        
                        updateSessionPackage(activePackage.id, {
                          totalSessions: newTotal,
                          usedSessions: newUsed,
                          paidSessions: newPaid,
                          pricePerSession: newPrice,
                          priceTotal: editPackageIsContinuous ? 0 : newTotal * newPrice,
                          remainingSessions: newRemaining,
                          isContinuous: editPackageIsContinuous,
                          name: editPackageIsContinuous ? 'Continuous Training' : `${newTotal} Session Package`,
                          status: editPackageIsContinuous ? 'active' : (newRemaining > 0 ? 'active' : 'completed'),
                        });
                        setShowEditPackage(false);
                        toast.success(editPackageIsContinuous ? 'Switched to continuous training' : 'Package updated');
                      }
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Import History Button */}
            <Button
              variant="outline"
              className="w-full border-dashed border-gray-300 text-gray-500 hover:text-gray-900 hover:border-sky-500"
              onClick={() => setShowEditStats(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Import Client History (for existing clients)
            </Button>
            
            {/* v12-D3: Session Tracking — three counters surfaced separately
                so the trainer sees lifetime vs. package-usage vs. calendar
                completions at a glance. Lifetime is editable via the modal
                so historical (pre-Catalift) sessions can be recorded. */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Session tracking
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {/* Lifetime sessions — v16-D3: derived from offset + count(completed sessions). */}
                  {(() => {
                    const allTrainerSessions = useTrainerStore.getState().sessions;
                    const displayed = getDisplayedSessionCount(clientRelation, allTrainerSessions);
                    const offsetVal = (clientRelation as any)?.historicalOffsetSessions
                      ?? clientRelation?.historicalSessionsOffset
                      ?? 0;
                    const loggedCount = allTrainerSessions.filter((s: any) =>
                      s.clientId === clientRelation?.clientId &&
                      s.trainerId === clientRelation?.trainerId &&
                      s.status === 'completed'
                    ).length;
                    return (
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {displayed}
                    </p>
                    <p className="text-xs text-gray-500">Lifetime</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {offsetVal} pre-Catalift
                      {' + '}
                      {loggedCount} logged
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowHistoricalOffsetModal(true)}
                      className="text-[11px] text-sky-500 hover:text-sky-600 hover:underline mt-1"
                    >
                      Edit historical
                    </button>
                  </div>
                    );
                  })()}

                  {/* Active package usage */}
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {activePackage ? `${activePackage.usedSessions || 0}/${activePackage.totalSessions === -1 ? '∞' : activePackage.totalSessions}` : '—'}
                    </p>
                    <p className="text-xs text-gray-500">Package usage</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {activePackage ? (activePackage.status === 'completed' ? 'Completed' : 'Active') : 'No active package'}
                    </p>
                  </div>

                  {/* Calendar completions */}
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {completedWorkouts}
                    </p>
                    <p className="text-xs text-gray-500">Workouts logged</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      In Catalift
                    </p>
                    {/* v13-D2: Drill into this client's full workout history. */}
                    <button
                      type="button"
                      onClick={() => router.push(`/workout/history?clientId=${clientId}`)}
                      className="text-[11px] text-sky-500 hover:text-sky-600 hover:underline mt-1"
                    >
                      View history →
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-500/20 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{completedWorkouts}</p>
                      <p className="text-xs text-gray-400">Workouts Done</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{upcomingSessions}</p>
                      <p className="text-xs text-gray-400">Upcoming</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <CreditCard className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{activePackage?.remainingSessions || 0}</p>
                      <p className="text-xs text-gray-400">Sessions Left</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={`border ${unpaidSessions > 0 ? 'bg-red-950/30 border-red-500/50' : 'bg-white border-gray-200 shadow-sm'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${unpaidSessions > 0 ? 'bg-red-500/20' : 'bg-purple-500/20'}`}>
                      <DollarSign className={`w-5 h-5 ${unpaidSessions > 0 ? 'text-red-400' : 'text-purple-400'}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${unpaidSessions > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {unpaidSessions > 0 ? unpaidSessions : `$${totalPaid}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {unpaidSessions > 0 ? 'Unpaid Sessions' : 'Total Paid'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Program Compliance */}
            {compliance.totalAssigned > 0 && (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Target className="w-4 h-4 text-sky-400" />
                      Program Adherence
                    </h3>
                    <Badge className={`${getAdherenceBgColor(compliance.adherencePercent)}/20 ${getAdherenceColor(compliance.adherencePercent)}`}>
                      {getAdherenceLabel(compliance.adherencePercent)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-gray-200"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${compliance.adherencePercent}, 100`}
                          className={getAdherenceColor(compliance.adherencePercent)}
                        />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${getAdherenceColor(compliance.adherencePercent)}`}>
                        {compliance.adherencePercent}%
                      </span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Assigned</span>
                        <span className="text-gray-900">{compliance.totalAssigned}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Completed</span>
                        <span className="text-green-400">{compliance.completedAssigned}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Personal</span>
                        <span className="text-sky-400">{compliance.personalWorkouts}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unpaid Sessions Alert */}
            {unpaidSessions > 0 && (
              <Card className="bg-red-950/30 border-red-500/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <div className="flex-1">
                      <p className="text-red-400 font-medium">{unpaidSessions} unpaid session{unpaidSessions > 1 ? 's' : ''}</p>
                      <p className="text-gray-400 text-sm">Client has completed sessions that haven't been paid for</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-500 text-red-400 hover:bg-red-500/20"
                      onClick={() => setActiveTab('payments')}
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Client Info */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-sky-400" />
                  Client Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Member since</span>
                  <span className="text-gray-900">{format(new Date(clientRelation.startDate), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Gender</span>
                  <span className="text-gray-900 capitalize">{clientUser.gender}</span>
                </div>
                {clientUser.height && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Height</span>
                    <span className="text-gray-900">{clientUser.height}cm</span>
                  </div>
                )}
                {clientUser.weight && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Weight</span>
                    <span className="text-gray-900">{clientUser.weight}kg</span>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-200 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Email</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 text-xs truncate max-w-[140px]">{clientUser.email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setEditEmail(clientUser.email || '');
                          setShowEditEmail(true);
                        }}
                      >
                        <Edit className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-sky-500/50 text-sky-400 hover:bg-sky-500/10"
                    onClick={() => handleSendInvitation()}
                    disabled={isSendingInvite}
                  >
                    <Send className="w-3 h-3 mr-2" />
                    {isSendingInvite ? 'Sending...' : 'Send App Invitation'}
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    Sends email with link to download app
                  </p>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleSyncToSupabase}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-2" />
                    Sync Account to Cloud
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Onboarding & Program */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-sky-400" />
                  Onboarding & Program
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!clientRelation.onboardingComplete ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Onboarding not complete</span>
                    </div>
                    <Button 
                      onClick={() => router.push(`/clients/${clientId}/onboarding`)}
                      className="w-full bg-sky-500 hover:bg-sky-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start Onboarding
                    </Button>
                  </div>
                ) : activeProgram ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sky-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">Active Program</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 text-xs"
                        onClick={() => {
                          if (confirm(`Delete program "${activeProgram.templateName}"? This cannot be undone.`)) {
                            deleteClientProgram(activeProgram.id);
                            toast.success('Program deleted');
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{activeProgram.templateName}</span>
                        <Badge variant="secondary" className="bg-sky-500/20 text-sky-400">
                          {activeProgram.phase}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        {activeProgram.weeklyPlan.length} workouts per week
                      </p>
                      {/* Quick Start Workout Buttons */}
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">Quick Start Session:</p>
                        {activeProgram.weeklyPlan.map((day: any, i: number) => (
                          <Button 
                            key={i}
                            variant="outline"
                            size="sm"
                            className="w-full justify-between text-left"
                            onClick={() => {
                              // Use shared util to preserve pyramid / custom per-set reps
                              const template = convertProgramDayToTemplate(day, {
                                programId: activeProgram.id,
                                dayIndex: i,
                                programName: activeProgram.templateName || 'Program',
                                userId: user?.id || '',
                              });
                              if (template.exercises.length > 0) {
                                // Create calendar event so completion syncs to Today page
                                const eventId = crypto.randomUUID();
                                const todayStr = format(new Date(), 'yyyy-MM-dd');
                                const sessionName = `${day.dayLabel} - ${clientUser.displayName}`;
                                addCalendarEvent({
                                  id: eventId,
                                  title: sessionName,
                                  type: 'session',
                                  date: todayStr,
                                  clientId,
                                  trainerId: user?.id,
                                  status: 'scheduled',
                                  programId: activeProgram.id,
                                  // v15-D8: was missing, broke D4 lock filter for
                                  // this entry path. Without programDayIndex the
                                  // lock can never engage for this booking.
                                  programDayIndex: i,
                                  notes: `Session from ${activeProgram.templateName}`,
                                } as any);

                                const { startFromTemplate } = useWorkoutStore.getState();
                                startFromTemplate({
                                  ...(template as any),
                                  id: `session-${eventId}`,
                                  name: sessionName,
                                } as any, clientId, {
                                  // v15-D8: tag the workout with source. Without
                                  // this, matchesProgram misses and
                                  // completedDayIndices never includes this day,
                                  // so the program page won't reflect the
                                  // just-finished PT session.
                                  programId: activeProgram.id,
                                  dayIndex: i,
                                });
                                router.push('/workout/active');
                              }
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <Dumbbell className="w-4 h-4 text-sky-400" />
                              {day.dayLabel}
                            </span>
                            <span className="text-xs text-gray-500">
                              {day.blocks?.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0) || 0} exercises
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/program/builder?clientId=${clientId}`)}
                        className="w-full"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/clients/${clientId}/program/select`)}
                        className="w-full"
                      >
                        <Dumbbell className="w-4 h-4 mr-1" />
                        Change
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/clients/${clientId}/program/preview`)}
                        className="w-full"
                      >
                        <ClipboardList className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>
                    {/* Past Programs */}
                    {allClientPrograms.filter(p => p.id !== activeProgram.id).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Past Programs</p>
                        <div className="space-y-1.5">
                          {allClientPrograms.filter(p => p.id !== activeProgram.id).map(prog => (
                            <div key={prog.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                              <div>
                                <p className="text-sm text-gray-600">{prog.templateName}</p>
                                <p className="text-[10px] text-gray-600">{prog.status} • {prog.weeklyPlan?.length || 0} days/week</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 w-6 p-0"
                                onClick={() => {
                                  if (confirm(`Delete past program "${prog.templateName}"?`)) {
                                    deleteClientProgram(prog.id);
                                    toast.success('Program deleted');
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sky-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">Onboarding complete</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={() => router.push(`/clients/${clientId}/program/select`)}
                        className="bg-sky-500 hover:bg-sky-600"
                      >
                        <ClipboardList className="w-4 h-4 mr-1" />
                        Select
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/program/builder?clientId=${clientId}`)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Create
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Goals - Always show with edit option */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-sky-400" />
                    Goals
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditGoals(clientRelation.goals || []);
                      setShowEditGoals(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {clientRelation.goals && clientRelation.goals.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {clientRelation.goals.map((goal, i) => (
                      <Badge key={i} variant="secondary" className="bg-gray-100 text-gray-700">
                        {goal}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No goals set yet. Click edit to add goals.</p>
                )}
              </CardContent>
            </Card>

            {/* Edit Goals Dialog */}
            <Dialog open={showEditGoals} onOpenChange={setShowEditGoals}>
              <DialogContent className="bg-white border-gray-200 shadow-sm">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">Edit Goals</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      placeholder="Add a goal..."
                      className="bg-gray-50 border-gray-200 text-gray-900"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newGoal.trim()) {
                          setEditGoals([...editGoals, newGoal.trim()]);
                          setNewGoal('');
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        if (newGoal.trim()) {
                          setEditGoals([...editGoals, newGoal.trim()]);
                          setNewGoal('');
                        }
                      }}
                      className="bg-sky-500 hover:bg-sky-600"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[60px]">
                    {editGoals.map((goal, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary" 
                        className="bg-gray-100 text-gray-700 cursor-pointer hover:bg-red-100 group"
                        onClick={() => setEditGoals(editGoals.filter((_, idx) => idx !== i))}
                      >
                        {goal}
                        <X className="w-3 h-3 ml-1 opacity-50 group-hover:opacity-100" />
                      </Badge>
                    ))}
                    {editGoals.length === 0 && (
                      <p className="text-gray-500 text-sm">No goals yet</p>
                    )}
                  </div>
                  <Button
                    className="w-full bg-sky-500 hover:bg-sky-600"
                    onClick={() => {
                      updateClient(clientId, { goals: editGoals });
                      setShowEditGoals(false);
                      toast.success('Goals updated');
                    }}
                  >
                    Save Goals
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Client Profile — onboarding answers */}
            {(() => {
              const profile = getClientProfile(clientId);
              if (!profile) return null;
              const expLabels: Record<string, string> = { new: 'Brand New', some: 'Some Experience', confident: 'Confident', advanced: 'Advanced' };
              const prefLabels: Record<string, string> = { '1:1': '1:1 PT', group: 'Group', solo: 'Solo', mixed: 'Mixed' };
              const aloneLabels: Record<string, string> = { yes: 'Yes', maybe: 'Maybe', no: 'No' };
              const injuryLabels: Record<string, string> = { shoulder: 'Shoulder', knee: 'Knee', back: 'Lower Back', hip: 'Hip', ankle: 'Ankle', wrist: 'Wrist', neck: 'Neck', none: 'None' };
              return (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-sky-400" />
                      Client Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider">Experience</p>
                        <p className="text-sm text-gray-900">{expLabels[profile.experienceLevel] || profile.experienceLevel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider">Training Pref</p>
                        <p className="text-sm text-gray-900">{prefLabels[profile.trainingPreference] || profile.trainingPreference}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider">Sessions/Week</p>
                        <p className="text-sm text-gray-900">{profile.daysPerWeek}× • {profile.sessionLength} min</p>
                      </div>
                    </div>

                    {/* Available Days */}
                    {profile.availableDays && profile.availableDays.length > 0 && (
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Available Days</p>
                        <div className="flex flex-wrap gap-1.5">
                          {profile.availableDays.map((day, i) => (
                            <Badge key={i} className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                              {day.slice(0, 3)}
                            </Badge>
                          ))}
                        </div>
                        {profile.scheduleNotes && (
                          <p className="text-xs text-gray-400 mt-1.5 italic">{profile.scheduleNotes}</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider">Trains Alone</p>
                        <p className="text-sm text-gray-900">{aloneLabels[profile.trainAloneOutsidePT] || profile.trainAloneOutsidePT}</p>
                      </div>
                    </div>

                    {/* Injuries */}
                    {profile.injuryFlags && profile.injuryFlags.length > 0 && !profile.injuryFlags.every(f => f === 'none') && (
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Injuries / Flags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {profile.injuryFlags.filter(f => f !== 'none').map((flag, i) => (
                            <Badge key={i} className="bg-amber-500/20 text-amber-400 border-0 text-xs">
                              {injuryLabels[flag] || flag}
                            </Badge>
                          ))}
                        </div>
                        {profile.injuryNotes && <p className="text-xs text-gray-400 mt-1">{profile.injuryNotes}</p>}
                      </div>
                    )}

                    {/* Movement Confidence */}
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Movement Confidence</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {Object.entries(profile.movementConfidence).map(([movement, score]) => (
                          <div key={movement} className="text-center p-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs text-gray-400 capitalize">{movement}</p>
                            <p className={`text-sm font-bold ${(score as number) >= 4 ? 'text-emerald-400' : (score as number) >= 3 ? 'text-sky-400' : 'text-amber-400'}`}>{score as number}/5</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Phase */}
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider">Current Phase</p>
                      <Badge variant="outline" className="border-sky-500/30 text-sky-400 capitalize text-xs">{profile.currentPhase}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Notes - Always show with edit option */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-sky-400" />
                    Notes
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditNotes(clientRelation.notes || '');
                      setShowEditNotes(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {clientRelation.notes ? (
                  <p className="text-gray-700 text-sm leading-relaxed">{clientRelation.notes}</p>
                ) : (
                  <p className="text-gray-500 text-sm">No notes yet. Click edit to add notes.</p>
                )}
              </CardContent>
            </Card>

            {/* Edit Notes Dialog */}
            <Dialog open={showEditNotes} onOpenChange={setShowEditNotes}>
              <DialogContent className="bg-white border-gray-200 shadow-sm">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">Edit Notes</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this client..."
                    className="bg-gray-50 border-gray-200 text-gray-900 min-h-[150px]"
                  />
                  <Button
                    className="w-full bg-sky-500 hover:bg-sky-600"
                    onClick={() => {
                      updateClient(clientId, { notes: editNotes });
                      setShowEditNotes(false);
                      toast.success('Notes updated');
                    }}
                  >
                    Save Notes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Pending Payments Alert */}
            {pendingPayments.length > 0 && (
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-amber-400 font-medium">
                        {pendingPayments.length} Pending Payment{pendingPayments.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-amber-400/70 text-sm">
                        ${pendingPayments.reduce((sum, p) => sum + p.amount, 0)} outstanding
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Workouts */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-sky-400" />
                    Recent Workouts
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {clientWorkoutHistory.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSyncingWorkouts}
                        onClick={async () => {
                          setIsSyncingWorkouts(true);
                          try {
                            const result = await syncClientWorkoutsToSupabase(clientId, workoutHistory);
                            if (result.success > 0) {
                              toast.success(`Synced ${result.success} workout${result.success > 1 ? 's' : ''} to cloud`);
                            } else if (result.failed > 0) {
                              toast.error(`Failed to sync ${result.failed} workout(s)`);
                            } else {
                              toast.info('No workouts to sync');
                            }
                          } catch (e) {
                            toast.error('Sync failed');
                          }
                          setIsSyncingWorkouts(false);
                        }}
                        className="text-blue-400 text-xs"
                      >
                        {isSyncingWorkouts ? 'Syncing...' : 'Sync to Cloud'}
                      </Button>
                    )}
                    {clientWorkoutHistory.length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('progress')}
                        className="text-sky-400 text-xs"
                      >
                        View All
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {clientWorkoutHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No workouts recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {clientWorkoutHistory
                      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                      .slice(0, 3)
                      .map(workout => {
                        // Get block performances for this workout
                        const workoutBlockPerfs = blockPerformances.filter(bp => bp.workoutId === workout.id);
                        return (
                        <div
                          key={workout.id}
                          className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => router.push(`/workout/${workout.id}`)}
                            >
                              <p className="font-medium text-gray-900 text-sm truncate">{workout.name}</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(workout.startTime), 'MMM d')} • {workout.exercises.length} exercises
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="text-sky-400 font-medium text-sm">
                                  {Math.round(workout.totalVolume).toLocaleString()} kg
                                </p>
                                <p className="text-xs text-gray-500">
                                  {workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/20"
                                title="Repeat Workout"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const { startFromTemplate } = useWorkoutStore.getState();
                                  startFromTemplate({
                                    id: `repeat-${workout.id}-${Date.now()}`,
                                    name: workout.name,
                                    description: `Repeat of ${format(new Date(workout.startTime), 'MMM d')} session`,
                                    exercises: JSON.parse(JSON.stringify(workout.exercises)),
                                    blocks: workout.blocks ? JSON.parse(JSON.stringify(workout.blocks)) : undefined,
                                    category: 'strength',
                                    estimatedDuration: workout.duration ? Math.floor(workout.duration / 60) : 60,
                                  } as any, clientId);
                                  router.push('/workout/active');
                                }}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                                title="Save as Template"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const { saveCompletedWorkoutAsTemplate } = useWorkoutStore.getState();
                                  saveCompletedWorkoutAsTemplate(workout);
                                  toast.success(`Saved "${workout.name}" as template`);
                                }}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-gray-900"
                                title="Edit Workout"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingWorkout(workout);
                                  setEditedWorkoutExercises(JSON.parse(JSON.stringify(workout.exercises)));
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {/* Show blocks performed with type-specific templates */}
                          {(workout.blocks && workout.blocks.length > 0) || workoutBlockPerfs.length > 0 ? (
                            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                              {workoutBlockPerfs.length > 0 ? (
                                workoutBlockPerfs.map((bp) => {
                                  const blockTypeStyles: Record<string, string> = {
                                    circuit: 'bg-green-500/20 text-green-300 border-green-500/30',
                                    warmup: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                                    cooldown: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                                    cardio: 'bg-red-500/20 text-red-300 border-red-500/30',
                                    work: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                                  };
                                  const style = blockTypeStyles[bp.blockType] || 'bg-gray-100 text-gray-600 border-gray-200';
                                  return (
                                    <div 
                                      key={bp.id}
                                      className={`px-2 py-1 rounded text-xs border ${style}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{bp.blockName}</span>
                                        <div className="flex items-center gap-2">
                                          {bp.blockType === 'circuit' && bp.completionTime && (
                                            <span className="text-green-400 font-medium">
                                              ⏱ {Math.floor(bp.completionTime / 60)}:{String(bp.completionTime % 60).padStart(2, '0')}
                                            </span>
                                          )}
                                          {bp.totalVolume && bp.totalVolume > 0 && (
                                            <span className="text-sky-400 font-medium">
                                              💪 {Math.round(bp.totalVolume).toLocaleString()} kg
                                            </span>
                                          )}
                                          {bp.roundsCompleted && (
                                            <span className="text-yellow-400">
                                              🔄 {bp.roundsCompleted} rounds
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                workout.blocks?.map((block: any) => {
                                  const blockTypeStyles: Record<string, string> = {
                                    circuit: 'bg-green-500/20 text-green-300 border-green-500/30',
                                    warmup: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                                    cooldown: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                                    cardio: 'bg-red-500/20 text-red-300 border-red-500/30',
                                    work: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                                  };
                                  const style = blockTypeStyles[block.type] || 'bg-gray-100 text-gray-600 border-gray-200';
                                  return (
                                    <div 
                                      key={block.id}
                                      className={`px-2 py-1 rounded text-xs border ${style}`}
                                    >
                                      <span className="font-medium">{block.name}</span>
                                      <span className="ml-2 opacity-70">{block.exercises?.length || 0} exercises</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          ) : null}
                          {/* Show top exercises with weights */}
                          {workout.exercises.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="text-xs text-gray-400 space-y-0.5">
                                {workout.exercises.slice(0, 3).map((ex) => {
                                  const bestSet = ex.sets?.reduce((best, set) => 
                                    (set.weight || 0) > (best?.weight || 0) ? set : best, ex.sets[0]);
                                  return (
                                    <div key={ex.id} className="flex justify-between">
                                      <span className="truncate flex-1">{ex.exercise?.name || 'Exercise'}</span>
                                      {bestSet && (bestSet.weight || bestSet.reps) && (
                                        <span className="text-sky-400 ml-2">
                                          {bestSet.weight ? `${bestSet.weight}kg` : ''}{bestSet.weight && bestSet.reps ? ' × ' : ''}{bestSet.reps ? `${bestSet.reps}` : ''}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                                {workout.exercises.length > 3 && (
                                  <span className="text-gray-500">+{workout.exercises.length - 3} more</span>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Trainer's private notes — only visible in client file (trainer view) */}
                          {workout.trainerNotes && (
                            <div className="mt-2 pt-2 border-t border-amber-500/20">
                              <p className="text-xs text-amber-400 line-clamp-2">
                                🔒 {workout.trainerNotes}
                              </p>
                            </div>
                          )}
                          {/* Client's own notes (from personal workouts) */}
                          {workout.notes && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-400 line-clamp-2">
                                📝 {workout.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )})}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="mt-4 space-y-4">
            {/* Workout Categories Summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-500/20 rounded-lg">
                      <Dumbbell className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {clientWorkoutHistory.filter(w => !w.assignedBy).length}
                      </p>
                      <p className="text-xs text-gray-400">Solo Training</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {clientWorkoutHistory.filter(w => w.assignedBy).length}
                      </p>
                      <p className="text-xs text-gray-400">PT Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Full Workout History */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-sky-400" />
                  All Workouts ({clientWorkoutHistory.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientWorkoutHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No workouts recorded yet</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {clientWorkoutHistory
                      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                      .map(workout => (
                        <div
                          key={workout.id}
                          className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => router.push(`/workout/${workout.id}`)}
                          >
                            <p className="font-medium text-gray-900 text-sm truncate">{workout.name}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(workout.startTime), 'MMM d, yyyy')} • {workout.exercises.length} exercises
                              {workout.assignedBy && <span className="text-blue-400 ml-1">• PT Session</span>}
                              {workout.notes && ' • Has notes'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-sky-400 font-medium text-sm">
                                {Math.round(workout.totalVolume).toLocaleString()} kg
                              </p>
                              <p className="text-xs text-gray-500">
                                {workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/20"
                              title="Repeat Workout"
                              onClick={(e) => {
                                e.stopPropagation();
                                const { startFromTemplate } = useWorkoutStore.getState();
                                startFromTemplate({
                                  id: `repeat-${workout.id}-${Date.now()}`,
                                  name: workout.name,
                                  description: `Repeat of ${format(new Date(workout.startTime), 'MMM d')} session`,
                                  exercises: JSON.parse(JSON.stringify(workout.exercises)),
                                  blocks: workout.blocks ? JSON.parse(JSON.stringify(workout.blocks)) : undefined,
                                  category: 'strength',
                                  estimatedDuration: workout.duration ? Math.floor(workout.duration / 60) : 60,
                                } as any, clientId);
                                router.push('/workout/active');
                              }}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                              title="Save as Template"
                              onClick={(e) => {
                                e.stopPropagation();
                                const { saveCompletedWorkoutAsTemplate } = useWorkoutStore.getState();
                                saveCompletedWorkoutAsTemplate(workout);
                                toast.success(`Saved "${workout.name}" as template`);
                              }}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-900"
                              title="Edit Workout"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWorkout(workout);
                                setEditedWorkoutExercises(JSON.parse(JSON.stringify(workout.exercises)));
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                          {/* Trainer's private notes in progress tab */}
                          {workout.trainerNotes && (
                            <div className="col-span-2 mt-1">
                              <p className="text-xs text-amber-400 line-clamp-1">
                                🔒 {workout.trainerNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Circuit Performance History */}
            {(() => {
              const clientCircuitPerformances = blockPerformances
                .filter(p => p.clientId === clientId)
                .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
              
              if (clientCircuitPerformances.length === 0) return null;
              
              const formatTime = (seconds: number) => {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              };
              
              const getDifficultyBadge = (rating: string | null | undefined) => {
                switch (rating) {
                  case 'easy': return <Badge className="bg-green-600 text-xs">😊 Easy</Badge>;
                  case 'moderate': return <Badge className="bg-yellow-600 text-xs">😅 Moderate</Badge>;
                  case 'hard': return <Badge className="bg-red-600 text-xs">🥵 Hard</Badge>;
                  default: return <Badge variant="outline" className="text-xs text-gray-500">N/A</Badge>;
                }
              };
              
              return (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-400" />
                      Circuit History ({clientCircuitPerformances.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {clientCircuitPerformances.map(perf => (
                        <div key={perf.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{perf.blockName}</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(perf.performedAt), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getDifficultyBadge(perf.difficultyRating)}
                              <span className="text-lg font-bold text-purple-400">
                                {perf.completionTime ? formatTime(perf.completionTime) : '--'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Per-round breakdown */}
                          {perf.roundTimes && perf.roundTimes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {perf.roundTimes.map((time, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-gray-100">
                                  R{idx + 1}: {formatTime(time)}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Rounds completed */}
                          {perf.roundsCompleted && (
                            <p className="text-xs text-gray-500 mt-1">
                              {perf.roundsCompleted} rounds completed
                              {perf.totalVolume && ` • ${Math.round(perf.totalVolume).toLocaleString()} kg total`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
            
            <WorkoutStatsCharts 
              workoutHistory={clientWorkoutHistory} 
              personalBests={clientPersonalBests} 
            />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-4">
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-0">
                {/* Messages List */}
                <div className="h-[400px] overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Start a conversation</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            msg.senderId === user?.id
                              ? 'bg-sky-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${
                            msg.senderId === user?.id ? 'text-sky-100' : 'text-gray-500'
                          }`}>
                            {format(new Date(msg.createdAt), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Message Input */}
                <div className="border-t border-gray-200 p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="bg-gray-50 border-gray-200 text-gray-900"
                    />
                    <Button onClick={handleSendMessage} className="bg-sky-500 hover:bg-sky-600">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Program Tab — Combines program management + client calendar */}
          <TabsContent value="program" className="mt-4 space-y-4">
            {/* Active Program */}
            {activeProgram ? (
              <>
                <Card className="bg-gradient-to-r from-rose-500/10 to-red-500/10 border-rose-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-rose-500/20 rounded-lg">
                          <ClipboardList className="w-5 h-5 text-rose-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{activeProgram.templateName}</h3>
                          <p className="text-xs text-gray-500">{activeProgram.trainingDaysPerWeek || activeProgram.weeklyPlan.length}×/week • {activeProgram.weeklyPlan.length} workouts{activeProgram.scheduleMode === 'flexible' ? ' • Flexible' : activeProgram.selectedDays?.length ? ' • Fixed' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className="bg-rose-500/20 text-rose-600 border-rose-500/30">{activeProgram.phase}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                          onClick={() => {
                            if (confirm(`Delete program "${activeProgram.templateName}"? This cannot be undone.`)) {
                              deleteClientProgram(activeProgram.id);
                              toast.success('Program deleted');
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Quick Start Session Buttons */}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Quick Start Session:</p>
                      {activeProgram.weeklyPlan.map((day: any, i: number) => (
                        <Button 
                          key={i}
                          variant="outline"
                          size="sm"
                          className="w-full justify-between text-left border-rose-200 hover:bg-rose-50"
                          onClick={() => {
                            // Use shared util to preserve pyramid / custom per-set reps
                            const template = convertProgramDayToTemplate(day, {
                              programId: activeProgram.id,
                              dayIndex: i,
                              programName: activeProgram.templateName || 'Program',
                              userId: user?.id || '',
                            });
                            if (template.exercises.length > 0) {
                              const { startFromTemplate } = useWorkoutStore.getState();
                              // D17: tag with source program + day. The templateId
                              // gets rewritten to session-<ts> below so
                              // prefix-based detection would silently miss
                              // this; explicit tags are the reliable signal.
                              startFromTemplate({
                                ...(template as any),
                                id: `session-${Date.now()}`,
                                name: `${day.dayLabel} - ${clientUser.displayName}`,
                              } as any, clientId, {
                                programId: activeProgram.id,
                                dayIndex: i,
                              });
                              router.push('/workout/active');
                            }
                          }}
                        >
                          <span className="flex items-center gap-2 flex-wrap">
                            <Dumbbell className="w-4 h-4 text-rose-500" />
                            {day.dayLabel}
                            {day.lastEditedBy === 'client' && day.lastEditedAt && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] px-1.5 py-0 h-4">
                                Client edited {formatDistanceToNow(new Date(day.lastEditedAt), { addSuffix: true })}
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            {day.blocks?.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0) || 0} exercises
                          </span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Program Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => router.push(`/program/builder?clientId=${clientId}`)}
                    className="w-full border-gray-200"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => router.push(`/clients/${clientId}/program/select`)}
                    className="w-full border-gray-200"
                  >
                    <Dumbbell className="w-4 h-4 mr-1" />
                    Change
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => router.push(`/clients/${clientId}/program/preview`)}
                    className="w-full border-gray-200"
                  >
                    <ClipboardList className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </div>

                {/* Program Schedule Info */}
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                      <Calendar className="w-5 h-5 text-rose-500" />
                      Schedule
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Badge className="bg-sky-500/20 text-sky-600 border-0 text-xs">{activeProgram.trainingDaysPerWeek || activeProgram.weeklyPlan.length}×/wk</Badge>
                        <span>{activeProgram.scheduleMode === 'flexible' ? 'Flexible — cycling' : 'Fixed days'}</span>
                      </div>
                      {activeProgram.selectedDays && activeProgram.selectedDays.length > 0 && (
                        <p className="text-xs text-gray-500">
                          Days: {activeProgram.selectedDays.map((d: string) => d.slice(0, 3)).join(', ')}
                        </p>
                      )}
                      {activeProgram.sessionPTMap && Object.values(activeProgram.sessionPTMap).some(v => v === 'pt') && (
                        <p className="text-xs text-gray-500">
                          {Object.values(activeProgram.sessionPTMap).filter(v => v === 'pt').length} PT sessions / {Object.values(activeProgram.sessionPTMap).filter(v => v === 'personal').length} Personal per week
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">Sessions are auto-scheduled from the program builder. Edit the program to change scheduling.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Past Programs */}
                {allClientPrograms.filter(p => p.id !== activeProgram.id).length > 0 && (
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-gray-900 text-sm">Past Programs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {allClientPrograms.filter(p => p.id !== activeProgram.id).map(prog => (
                          <div key={prog.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm text-gray-700">{prog.templateName}</p>
                              <p className="text-[10px] text-gray-500">{prog.status} • {prog.weeklyPlan?.length || 0} days/week</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 w-6 p-0"
                              onClick={() => {
                                if (confirm(`Delete past program "${prog.templateName}"?`)) {
                                  deleteClientProgram(prog.id);
                                  toast.success('Program deleted');
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              /* No Active Program */
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-rose-500/10 rounded-full">
                      <ClipboardList className="w-10 h-10 text-rose-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">No Program Assigned</h3>
                    <p className="text-sm text-gray-500">Create or assign a training program for {clientUser.displayName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => router.push(`/clients/${clientId}/program/select`)}
                      className="bg-rose-500 hover:bg-rose-600"
                    >
                      <ClipboardList className="w-4 h-4 mr-1" />
                      Select Template
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => router.push(`/program/builder?clientId=${clientId}`)}
                      className="border-gray-200"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Build Custom
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Client's Calendar Overview — mini calendar + upcoming */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-900 flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-rose-500" />
                    {clientUser.displayName}&apos;s Schedule
                  </CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-gray-200" onClick={() => router.push(`/clients/${clientId}/book`)}>
                    <Plus className="w-3 h-3 mr-1" />
                    Book PT
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mini Calendar */}
                {(() => {
                  const now = new Date();
                  const monthStart = startOfMonth(now);
                  const monthEnd = endOfMonth(now);
                  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                  const monthSessions = sessions.filter(s => {
                    const sessionDate = new Date(s.date);
                    return isWithinInterval(sessionDate, { start: monthStart, end: monthEnd });
                  });
                  const monthEvents = calendarEvents.filter(e => {
                    const eventDate = new Date(e.date);
                    return isWithinInterval(eventDate, { start: monthStart, end: monthEnd });
                  });

                  return (
                    <>
                      <p className="text-xs text-gray-500 mb-2 font-medium">{format(now, 'MMMM yyyy')}</p>
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {['M','T','W','T','F','S','S'].map((d, i) => (
                          <div key={i} className="text-center text-[10px] text-gray-400 py-0.5">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1 mb-3">
                        {calendarDays.map((day, i) => {
                          const isCurrentMonth = day.getMonth() === now.getMonth();
                          const daySessions = monthSessions.filter(s => isSameDay(new Date(s.date), day));
                          const dayEvents = monthEvents.filter(e => isSameDay(new Date(e.date), day));
                          const hasPTSession = daySessions.some(s => s.type === 'pt_session') || dayEvents.some(e => e.type === 'session');
                          const hasWorkout = dayEvents.some(e => e.type === 'workout') || clientWorkoutHistory.some(w => isSameDay(new Date(w.startTime), day));

                          return (
                            <div
                              key={i}
                              className={`relative aspect-square flex items-center justify-center rounded text-xs
                                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-600'}
                                ${isToday(day) ? 'bg-rose-500/20 ring-1 ring-rose-500 font-bold text-rose-600' : ''}
                              `}
                            >
                              {format(day, 'd')}
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
                                {hasPTSession && <div className="w-1 h-1 rounded-full bg-rose-500" />}
                                {hasWorkout && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Legend */}
                      <div className="flex gap-3 text-[10px] mb-3">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-gray-400">PT Session</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-gray-400">Workout</span></div>
                      </div>
                    </>
                  );
                })()}

                {/* Upcoming Sessions */}
                <p className="text-xs text-gray-500 font-medium mb-2">Upcoming</p>
                {(() => {
                  const completedWorkoutDates = clientWorkoutHistory
                    .filter(w => w.status === 'completed')
                    .map(w => {
                      const date = new Date(w.endTime || w.startTime);
                      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    });
                  const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
                  const allUpcoming = [...scheduledSessions, ...calendarEvents]
                    .filter(e => {
                      const eventDate = new Date('date' in e ? e.date : '');
                      const dateKey = `${eventDate.getFullYear()}-${eventDate.getMonth()}-${eventDate.getDate()}`;
                      if (completedWorkoutDates.includes(dateKey)) return false;
                      return isFuture(eventDate) || isToday(eventDate);
                    })
                    .sort((a, b) => new Date('date' in a ? a.date : '').getTime() - new Date('date' in b ? b.date : '').getTime())
                    .slice(0, 5);

                  if (allUpcoming.length === 0) {
                    return <p className="text-gray-400 text-xs text-center py-3">No upcoming sessions</p>;
                  }

                  return (
                    <div className="space-y-1.5">
                      {allUpcoming.map((event: any, i) => {
                        const isPT = event.type === 'pt_session' || event.type === 'session';
                        const eventDate = new Date(event.date);
                        return (
                          <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isPT ? 'bg-rose-50 border border-rose-200' : 'bg-blue-50 border border-blue-200'}`}>
                            <div className={`p-1.5 rounded ${isPT ? 'bg-rose-500/20' : 'bg-blue-500/20'}`}>
                              {isPT ? <User className="w-3 h-3 text-rose-500" /> : <Dumbbell className="w-3 h-3 text-blue-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{event.title || 'PT Session'}</p>
                              <p className="text-gray-500">{format(eventDate, 'EEE, MMM d')} {event.startTime && `• ${event.startTime}`}</p>
                            </div>
                            {isToday(eventDate) && <Badge className="bg-rose-500 text-[10px] h-5">Today</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4 space-y-4">
            {/* Session Balance Card */}
            {packages.length > 0 && (
              <Card className="bg-gradient-to-r from-sky-900/30 to-blue-900/30 border-sky-500/30">
                <CardContent className="p-4">
                  <h3 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-sky-400" />
                    Session Balance
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {packages.reduce((sum, p) => sum + p.totalSessions, 0)}
                      </p>
                      <p className="text-xs text-gray-400">Covered</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-400">
                        {packages.reduce((sum, p) => sum + p.usedSessions, 0)}
                      </p>
                      <p className="text-xs text-gray-400">Used</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-sky-400">
                        {packages.reduce((sum, p) => sum + p.remainingSessions, 0)}
                      </p>
                      <p className="text-xs text-gray-400">Remaining</p>
                    </div>
                  </div>
                  {/* Per Session Cost */}
                  {packages.length > 0 && packages[0].pricePerSession > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Avg. Per Session</span>
                        <span className="text-gray-900 font-medium">
                          ${(packages.reduce((sum, p) => sum + p.priceTotal, 0) / 
                             packages.reduce((sum, p) => sum + p.totalSessions, 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment Summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-sky-400">${totalPaid}</p>
                  <p className="text-xs text-gray-400">Total Paid</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">
                    ${pendingPayments.reduce((sum, p) => sum + p.amount, 0)}
                  </p>
                  <p className="text-xs text-gray-400">Outstanding</p>
                </CardContent>
              </Card>
            </div>

            {/* Add Payment Button */}
            <Button className="w-full" variant="outline" onClick={() => setShowAddPayment(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>

            {/* Payments List */}
            <div className="space-y-2">
              <h3 className="text-gray-900 font-medium">Payment History</h3>
              
              {payments.length === 0 ? (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">No payments recorded</p>
                  </CardContent>
                </Card>
              ) : (
                payments
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((payment) => (
                    <Card key={payment.id} className="bg-white border-gray-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              payment.status === 'paid' ? 'bg-sky-500/20' :
                              payment.status === 'pending' ? 'bg-amber-500/20' :
                              'bg-red-500/20'
                            }`}>
                              {payment.status === 'paid' ? (
                                <CheckCircle2 className="w-5 h-5 text-sky-400" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-gray-900 font-medium">{payment.description}</p>
                              <p className="text-gray-400 text-sm">
                                {format(new Date(payment.paidAt || payment.createdAt), 'MMM d, yyyy')}
                                {payment.method && ` • ${payment.method.replace('_', ' ')}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-gray-900 font-bold">${payment.amount}</p>
                              {payment.status === 'pending' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-sky-400 text-xs h-6 px-2"
                                  onClick={() => handleMarkPaymentPaid(payment.id)}
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-gray-400 hover:text-gray-900"
                              onClick={() => handleEditPayment(payment)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Quick Actions */}
      <div className="fixed bottom-20 left-0 right-0 px-4">
        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-sky-500 hover:bg-sky-600"
            onClick={() => setActiveTab('messages')}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Message
          </Button>
          <Button 
            className="flex-1 bg-blue-500 hover:bg-blue-600"
            onClick={() => {
              // Create calendar event so completion syncs to Today page
              const eventId = crypto.randomUUID();
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const sessionName = `Session - ${getClientNameUtil(clientId)}`;
              addCalendarEvent({
                id: eventId,
                title: sessionName,
                type: 'session',
                date: todayStr,
                clientId,
                trainerId: user?.id,
                status: 'scheduled',
              } as any);

              const { startWorkout } = useWorkoutStore.getState();
              startWorkout(sessionName, `session-${eventId}`, clientId);
              router.push('/workout/active');
            }}
          >
            <Dumbbell className="w-4 h-4 mr-2" />
            Start Workout
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => router.push(`/clients/${clientId}/book`)}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Book
          </Button>
        </div>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Amount ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Payment Date</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Sessions Covered (optional)</label>
              <Input
                type="number"
                placeholder="0"
                value={sessionsCovered}
                onChange={(e) => setSessionsCovered(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            {/* Per Session Cost Display */}
            {perSessionCost && (
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Per Session Cost</span>
                  <span className="text-sky-400 font-bold text-lg">${perSessionCost}</span>
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description</label>
              <Input
                placeholder="e.g., PT Session, Package Payment"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Payment Method</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('cash')}
                  className={paymentMethod === 'cash' ? 'bg-sky-500' : ''}
                >
                  Cash
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('card')}
                  className={paymentMethod === 'card' ? 'bg-sky-500' : ''}
                >
                  Card
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'bank_transfer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={paymentMethod === 'bank_transfer' ? 'bg-sky-500' : ''}
                >
                  Transfer
                </Button>
              </div>
            </div>
            
            <Button 
              className="w-full bg-sky-500 hover:bg-sky-600"
              onClick={handleAddPayment}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={showEditPayment} onOpenChange={setShowEditPayment}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Amount ($)</label>
              <Input
                type="number"
                value={editPaymentAmount}
                onChange={(e) => setEditPaymentAmount(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Payment Date</label>
              <Input
                type="date"
                value={editPaymentDate}
                onChange={(e) => setEditPaymentDate(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Payment Method</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editPaymentMethod === 'cash' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditPaymentMethod('cash')}
                  className={editPaymentMethod === 'cash' ? 'bg-sky-500' : ''}
                >
                  Cash
                </Button>
                <Button
                  type="button"
                  variant={editPaymentMethod === 'card' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditPaymentMethod('card')}
                  className={editPaymentMethod === 'card' ? 'bg-sky-500' : ''}
                >
                  Card
                </Button>
                <Button
                  type="button"
                  variant={editPaymentMethod === 'bank_transfer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditPaymentMethod('bank_transfer')}
                  className={editPaymentMethod === 'bank_transfer' ? 'bg-sky-500' : ''}
                >
                  Transfer
                </Button>
              </div>
            </div>
            
            <Button 
              className="w-full bg-sky-500 hover:bg-sky-600"
              onClick={handleSavePaymentEdit}
            >
              <Check className="w-4 h-4 mr-2" />
              Save Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stats Modal for importing existing client history */}
      <Dialog open={showEditStats} onOpenChange={setShowEditStats}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Import Client History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-gray-400 text-sm">
              Use this to import historical data for clients you've been training before using the app.
            </p>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Sessions Already Completed</label>
              <Input
                type="number"
                placeholder="e.g., 10"
                value={editSessionsDone}
                onChange={(e) => setEditSessionsDone(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Sessions Remaining (Prepaid)</label>
              <Input
                type="number"
                placeholder="e.g., 5"
                value={editSessionsLeft}
                onChange={(e) => setEditSessionsLeft(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Total Amount Paid ($)</label>
              <Input
                type="number"
                placeholder="e.g., 500"
                value={editTotalPaid}
                onChange={(e) => setEditTotalPaid(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <Button 
              className="w-full bg-sky-500 hover:bg-sky-600"
              onClick={handleSaveInitialStats}
            >
              <Check className="w-4 h-4 mr-2" />
              Import History
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Workout Dialog */}
      <Dialog open={!!editingWorkout} onOpenChange={(open) => !open && setEditingWorkout(null)}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Workout</DialogTitle>
          </DialogHeader>
          {editingWorkout && editedWorkoutExercises && (
            <div className="space-y-4 pt-4">
              <div className="text-sm text-gray-400">
                <p><strong>{editingWorkout.name}</strong></p>
                <p>{format(new Date(editingWorkout.startTime), 'MMM d, yyyy')}</p>
              </div>
              
              {editedWorkoutExercises.map(ex => (
                <div key={ex.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 mb-2">{ex.exercise?.name || 'Exercise'}</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-xs text-gray-500 px-1">
                      <div>SET</div>
                      <div className="text-center">WEIGHT</div>
                      <div className="text-center">REPS</div>
                      <div className="text-right">VOL</div>
                    </div>
                    {ex.sets.filter(s => s.completed).map(set => (
                      <div key={set.id} className="grid grid-cols-4 gap-2 items-center">
                        <div className="text-gray-400 text-sm">{set.setNumber}</div>
                        <input
                          type="number"
                          value={set.weight || 0}
                          onChange={(e) => handleUpdateWorkoutSet(ex.id, set.id, 'weight', parseFloat(e.target.value) || 0)}
                          className="w-full text-center bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm"
                        />
                        <input
                          type="number"
                          value={set.reps || 0}
                          onChange={(e) => handleUpdateWorkoutSet(ex.id, set.id, 'reps', parseInt(e.target.value) || 0)}
                          className="w-full text-center bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm"
                        />
                        <div className="text-right text-gray-400 text-sm">
                          {((set.weight || 0) * (set.reps || 0)).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-200"
                  onClick={() => {
                    setEditingWorkout(null);
                    setEditedWorkoutExercises(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-sky-500 hover:bg-sky-600"
                  onClick={handleSaveWorkoutEdit}
                >
                  Save Changes
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 text-center">
                Saving will recalculate PBs and strength rating, then sync to cloud
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={showEditEmail} onOpenChange={setShowEditEmail}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Update Client Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-600">Email Address</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="client@gmail.com"
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <p className="text-xs text-gray-500">
                Enter the client&apos;s Google email to link their account
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-gray-200"
                onClick={() => setShowEditEmail(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-sky-500 hover:bg-sky-600"
                onClick={handleUpdateEmailAndInvite}
                disabled={isSendingInvite || !editEmail}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSendingInvite ? 'Sending...' : 'Update & Send Invite'}
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              This will update the email and send an invitation to the new address
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showRemoveClientConfirm}
        onOpenChange={setShowRemoveClientConfirm}
        title="Remove Client"
        description={`Are you sure you want to remove ${clientUser?.displayName || 'this client'} from your client list? Their account will NOT be deleted — they can still log in.`}
        confirmLabel="Remove Client"
        variant="destructive"
        onConfirm={handleDeleteClient}
        icon={<Trash2 className="w-5 h-5 text-red-400" />}
      />

      {/* v12-D3: Edit historical-sessions offset modal */}
      <EditHistoricalOffsetModal
        open={showHistoricalOffsetModal}
        onOpenChange={setShowHistoricalOffsetModal}
        currentOffset={
          ((clientRelation as any)?.historicalOffsetSessions
            ?? clientRelation?.historicalSessionsOffset
            ?? 0) as number
        }
        loggedSessions={
          useTrainerStore.getState().sessions.filter((s: any) =>
            s.clientId === clientRelation?.clientId &&
            s.trainerId === clientRelation?.trainerId &&
            s.status === 'completed'
          ).length
        }
        clientName={clientUser?.displayName || getClientNameUtil(clientId)}
        onSave={async (newOffset) => {
          // v16-D3 (F2 / AC7): persist the manual offset to the dedicated
          // `historical_offset_sessions` column. Mirror to the legacy
          // `historical_sessions_offset` for back-compat reads. The displayed
          // lifetime stat is recomputed live via getDisplayedSessionCount.
          const loggedNow = useTrainerStore.getState().sessions.filter((s: any) =>
            s.clientId === clientRelation?.clientId &&
            s.trainerId === clientRelation?.trainerId &&
            s.status === 'completed'
          ).length;
          updateClient(clientId, {
            historicalOffsetSessions: newOffset,
            historicalSessionsOffset: newOffset,
            // Keep legacy column in sync so any unmigrated reader still shows
            // the same number. The auto-count toggle never mutates this.
            totalSessions: newOffset + loggedNow,
          });
          toast.success('Historical sessions updated');
        }}
      />

      {/* Client Profile Card Popup */}
      <Dialog open={showProfileCard} onOpenChange={setShowProfileCard}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-sm">
          {(() => {
            const { personalBests } = useWorkoutStore.getState();
            const clientPBs = personalBests.filter(pb => pb.userId === clientId);
            const { medals } = useMedalStore.getState();
            const clientMedals = medals.filter(m => m.userId === clientId && m.earned);
            const isMale = clientUser?.gender === 'male';
            let rating = null;
            try { rating = clientPBs.length > 0 ? calculateFullStrengthRating(clientPBs, isMale) : null; } catch {}
            const clientWorkouts = workoutHistory.filter(w => w.userId === clientId && w.status === 'completed' && !w.deletedAt);
            const completedSessions = sessions.filter(s => s.status === 'completed').length;
            
            return (
              <>
                <DialogHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-16 h-16 border-2 border-rose-500">
                      <AvatarImage src={clientUser?.profilePhoto} />
                      <AvatarFallback className="bg-gray-100 text-gray-900 text-xl">
                        {clientUser?.displayName?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-gray-900">{clientUser?.displayName}</DialogTitle>
                      <p className="text-sm text-gray-500">@{clientUser?.username}</p>
                      {clientUser?.gymName && <p className="text-xs text-sky-400 mt-0.5">{clientUser.gymName}</p>}
                    </div>
                  </div>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{clientWorkouts.length}</p>
                    <p className="text-xs text-gray-500">Workouts</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{clientMedals.length}</p>
                    <p className="text-xs text-gray-500">Medals</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-sky-500">{clientPBs.length}</p>
                    <p className="text-xs text-gray-500">PBs</p>
                  </div>
                </div>
                {rating && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Strength Rating</span>
                      <span className="text-lg font-bold text-gray-900">{rating.overall?.toFixed(0) || '—'}</span>
                    </div>
                  </div>
                )}
                {clientUser?.bio && (
                  <p className="text-sm text-gray-600 mt-2">{clientUser.bio}</p>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
