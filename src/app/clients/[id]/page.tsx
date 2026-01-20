'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore, useTrainerStore, useWorkoutStore } from '@/lib/store';
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
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isFuture, isPast, startOfWeek, endOfWeek, isWithinInterval, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType, ClientSession, ClientPayment, SessionPackage } from '@/types';
import { WorkoutStatsCharts } from '@/components/WorkoutStatsCharts';
import { registerUserToSupabase, deleteUserFromSupabase, fetchAllUsersFromSupabase, fetchUserDataFromSupabase, isSupabaseConfigured, syncClientWorkoutsToSupabase } from '@/lib/supabaseSync';
import { Workout, PersonalBest } from '@/types';

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
    markSessionComplete,
    markSessionNoShow,
    toggleSessionPaid,
    markPaymentPaid,
    addSession,
    addPayment,
    addSessionPackage,
    removeClient,
    setInitialClientStats,
    updateSessionPackage,
    updateClient,
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
  const { getOrCreateConversation, sendMessage, getMessages } = useMessageStore();
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
    const localWorkouts = workoutHistory.filter(w => w.userId === clientId);
    // Merge with fetched client workouts, deduplicating by ID
    const allWorkouts = [...localWorkouts];
    clientWorkouts.forEach(w => {
      if (!allWorkouts.find(existing => existing.id === w.id)) {
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
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditStats, setShowEditStats] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [sessionsCovered, setSessionsCovered] = useState('');
  
  // Edit stats state for onboarding existing clients
  const [editSessionsDone, setEditSessionsDone] = useState('');
  const [editSessionsLeft, setEditSessionsLeft] = useState('');
  const [editTotalPaid, setEditTotalPaid] = useState('');
  
  // Edit/Create package state
  const [showEditPackage, setShowEditPackage] = useState(false);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [editPackageTotal, setEditPackageTotal] = useState('');
  const [editPackagePrice, setEditPackagePrice] = useState('');
  
  // Edit goals/notes state
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newPackageTotal, setNewPackageTotal] = useState('');
  const [newPackagePrice, setNewPackagePrice] = useState('');
  const [isSyncingWorkouts, setIsSyncingWorkouts] = useState(false);
  
  // Calculate per-session cost
  const perSessionCost = paymentAmount && sessionsCovered && parseInt(sessionsCovered) > 0
    ? (parseFloat(paymentAmount) / parseInt(sessionsCovered)).toFixed(2)
    : null;

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (user?.mode !== 'trainer') {
      router.replace('/workout');
    }
  }, [isAuthenticated, user?.mode, router]);

  // Get client data
  const clientRelation = useMemo(() => getClientById(clientId), [clientId, clients]);
  const clientUser = useMemo(() => 
    allUsers.find((u: UserType) => u.id === clientId), 
    [allUsers, clientId]
  );
  
  const sessions = useMemo(() => getSessionsForClient(clientId), [clientId]);
  const payments = useMemo(() => getPaymentsForClient(clientId), [clientId]);
  const packages = useMemo(() => getPackagesForClient(clientId), [clientId]);
  const calendarEvents = useMemo(() => getEventsForClient(clientId), [clientId]);
  const activeProgram = useMemo(() => getActiveProgram(clientId), [clientId]);
  
  // Messages
  const conversation = useMemo(() => {
    if (!user?.id || !clientId) return null;
    return getOrCreateConversation(user.id, clientId);
  }, [user?.id, clientId]);
  
  const messages = useMemo(() => {
    if (!conversation) return [];
    return getMessages(conversation.id);
  }, [conversation]);

  // Stats - count ACTUAL completed workouts (from workout store) for training stats
  // AND count PT sessions (from trainer store) for billing purposes
  const ptSessions = sessions.filter(s => s.type === 'pt_session');
  const scheduledPTSessions = ptSessions.filter(s => s.status === 'scheduled').length;
  const unpaidSessions = ptSessions.filter(s => s.status === 'completed' && !s.paid).length;
  const noShowSessions = ptSessions.filter(s => s.status === 'no_show').length;
  const activePackage = packages.find(p => p.status === 'active');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  
  // Actual completed workouts (from workout store) - this is the real training data
  const completedWorkouts = clientWorkoutHistory.length;
  // Upcoming sessions from calendar events + scheduled PT sessions
  const upcomingSessions = scheduledPTSessions + calendarEvents.filter(e => 
    new Date(e.date) >= new Date() && e.type === 'session'
  ).length;

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

  const handleDeleteClient = async () => {
    if (confirm(`Are you sure you want to remove ${clientUser?.displayName || 'this client'} from your client list? Their account will NOT be deleted - they can still log in.`)) {
      // Only remove from trainer's client list - do NOT delete from Supabase
      // Supabase account deletion should only happen from the user's own Settings page
      removeClient(clientId);
      toast.success('Client removed from your list');
      router.push('/clients');
    }
  };

  const handleSyncToSupabase = async () => {
    if (!clientUser) {
      toast.error('Client user data not found');
      return;
    }
    
    const password = (clientUser as any).password || 'client123';
    
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
      }, password);
      
      if (synced) {
        toast.success(`${clientUser.displayName} synced to cloud! They can now log in with: ${clientUser.email} / ${password}`);
      } else {
        toast.error('Sync failed - Supabase may not be configured or account may already exist');
      }
    } catch (e) {
      console.error('Sync error:', e);
      toast.error('Failed to sync client account');
    }
  };

  const handleAddPayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const sessionsCount = sessionsCovered ? parseInt(sessionsCovered) : 0;
    const amount = parseFloat(paymentAmount);
    
    // Add payment record
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
    });
    
    // Create session package if sessions are covered
    if (sessionsCount > 0) {
      addSessionPackage({
        clientId,
        trainerId: user?.id || '',
        name: `${sessionsCount} Session Package`,
        totalSessions: sessionsCount,
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
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800">
        <div className="flex items-center gap-4 px-4 pt-12 pb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="w-12 h-12">
            <AvatarImage src={clientUser.profilePhoto} />
            <AvatarFallback>{clientUser.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">{clientUser.displayName}</h1>
            <p className="text-sm text-gray-400">@{clientUser.username}</p>
          </div>
          <Badge variant={clientRelation.status === 'active' ? 'default' : 'secondary'}>
            {clientRelation.status}
          </Badge>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleDeleteClient}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid grid-cols-6 mx-4 mt-4 bg-gray-900">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">Progress</TabsTrigger>
          <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs">Sessions</TabsTrigger>
          <TabsTrigger value="calendar" className="text-xs">Calendar</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 pb-24">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Session Package Summary - Editable or Create New */}
            {activePackage ? (
              <Card className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border-emerald-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-400" />
                      Session Package
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                      onClick={() => {
                        setEditPackageTotal(activePackage.totalSessions.toString());
                        setEditPackagePrice(activePackage.pricePerSession.toString());
                        setShowEditPackage(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <p className="text-2xl font-bold text-emerald-400">{activePackage.totalSessions}</p>
                      <p className="text-xs text-gray-400">Total Sessions</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <p className="text-2xl font-bold text-white">${activePackage.pricePerSession.toFixed(0)}</p>
                      <p className="text-xs text-gray-400">Per Session</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2">
                      <p className="text-2xl font-bold text-blue-400">${(completedWorkouts * activePackage.pricePerSession).toFixed(0)}</p>
                      <p className="text-xs text-gray-400">Total Value</p>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{activePackage.usedSessions} used</span>
                      <span>{activePackage.remainingSessions} remaining</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                        style={{ width: `${(activePackage.usedSessions / activePackage.totalSessions) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* No active package - show alert and create button */
              <Card className="bg-amber-900/20 border-amber-500/50 border-2">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-amber-400 font-medium">No Session Package</p>
                      <p className="text-amber-400/70 text-sm">
                        Create a package to track sessions and payments. Completed workouts will be linked to the package once created.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black"
                    onClick={() => {
                      setNewPackageTotal('');
                      setNewPackagePrice('');
                      setShowCreatePackage(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Package
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Create Package Dialog */}
            <Dialog open={showCreatePackage} onOpenChange={setShowCreatePackage}>
              <DialogContent className="bg-gray-900 border-gray-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Create Session Package</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Total Sessions</Label>
                    <Input
                      type="number"
                      value={newPackageTotal}
                      onChange={(e) => setNewPackageTotal(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Price Per Session ($)</Label>
                    <Input
                      type="number"
                      value={newPackagePrice}
                      onChange={(e) => setNewPackagePrice(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                      placeholder="e.g., 50"
                    />
                  </div>
                  {newPackageTotal && newPackagePrice && (
                    <div className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Package Total:</span>
                        <span className="text-emerald-400 font-bold">
                          ${(parseInt(newPackageTotal) * parseFloat(newPackagePrice)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
                    onClick={() => {
                      if (newPackageTotal && newPackagePrice) {
                        const total = parseInt(newPackageTotal);
                        const price = parseFloat(newPackagePrice);
                        
                        addSessionPackage({
                          clientId,
                          trainerId: user?.id || '',
                          name: `${total} Session Package`,
                          totalSessions: total,
                          priceTotal: total * price,
                          pricePerSession: price,
                          purchaseDate: new Date().toISOString(),
                          paymentId: '',
                          status: 'active',
                        });
                        setShowCreatePackage(false);
                        toast.success(`Package created: ${total} sessions at $${price}/session`);
                      }
                    }}
                  >
                    Create Package
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Package Dialog */}
            <Dialog open={showEditPackage} onOpenChange={setShowEditPackage}>
              <DialogContent className="bg-gray-900 border-gray-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Edit Session Package</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Total Sessions in Package</Label>
                    <Input
                      type="number"
                      value={editPackageTotal}
                      onChange={(e) => setEditPackageTotal(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Price Per Session ($)</Label>
                    <Input
                      type="number"
                      value={editPackagePrice}
                      onChange={(e) => setEditPackagePrice(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                      placeholder="e.g., 50"
                    />
                  </div>
                  {editPackageTotal && editPackagePrice && (
                    <div className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Package Total:</span>
                        <span className="text-emerald-400 font-bold">
                          ${(parseInt(editPackageTotal) * parseFloat(editPackagePrice)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
                    onClick={() => {
                      if (activePackage && editPackageTotal && editPackagePrice) {
                        const newTotal = parseInt(editPackageTotal);
                        const newPrice = parseFloat(editPackagePrice);
                        const newRemaining = Math.max(0, newTotal - activePackage.usedSessions);
                        
                        updateSessionPackage(activePackage.id, {
                          totalSessions: newTotal,
                          pricePerSession: newPrice,
                          priceTotal: newTotal * newPrice,
                          remainingSessions: newRemaining,
                          status: newRemaining > 0 ? 'active' : 'completed',
                        });
                        setShowEditPackage(false);
                        toast.success('Package updated');
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
              className="w-full border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-emerald-500"
              onClick={() => setShowEditStats(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Import Client History (for existing clients)
            </Button>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{completedWorkouts}</p>
                      <p className="text-xs text-gray-400">Workouts Done</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{upcomingSessions}</p>
                      <p className="text-xs text-gray-400">Upcoming</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <CreditCard className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{activePackage?.remainingSessions || 0}</p>
                      <p className="text-xs text-gray-400">Sessions Left</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={`border ${unpaidSessions > 0 ? 'bg-red-950/30 border-red-500/50' : 'bg-gray-900 border-gray-800'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${unpaidSessions > 0 ? 'bg-red-500/20' : 'bg-purple-500/20'}`}>
                      <DollarSign className={`w-5 h-5 ${unpaidSessions > 0 ? 'text-red-400' : 'text-purple-400'}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${unpaidSessions > 0 ? 'text-red-400' : 'text-white'}`}>
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
                      onClick={() => setActiveTab('sessions')}
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Client Info */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  Client Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Member since</span>
                  <span className="text-white">{format(new Date(clientRelation.startDate), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Gender</span>
                  <span className="text-white capitalize">{clientUser.gender}</span>
                </div>
                {clientUser.height && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Height</span>
                    <span className="text-white">{clientUser.height}cm</span>
                  </div>
                )}
                {clientUser.weight && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Weight</span>
                    <span className="text-white">{clientUser.weight}kg</span>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-800">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Login Email</span>
                    <span className="text-white text-xs">{clientUser.email}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleSyncToSupabase}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-2" />
                    Sync Account to Cloud
                  </Button>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Enables login from any device
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Onboarding & Program */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-400" />
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
                      className="w-full bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start Onboarding
                    </Button>
                  </div>
                ) : activeProgram ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">Active Program</span>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{activeProgram.templateName}</span>
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
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
                              // Start workout with this day's exercises
                              const exercises = day.blocks?.flatMap((block: any) => 
                                block.exercises?.map((ex: any) => ({
                                  id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                  exerciseId: ex.exerciseId || ex.id,
                                  exercise: {
                                    id: ex.exerciseId || ex.id,
                                    name: ex.exerciseName || ex.name || 'Exercise',
                                    category: 'strength',
                                    muscleGroups: [],
                                  },
                                  sets: Array.from({ length: ex.sets || 3 }, (_, si) => ({
                                    id: `set-${Date.now()}-${si}`,
                                    setNumber: si + 1,
                                    targetReps: typeof ex.reps === 'string' ? parseInt(ex.reps) || 10 : ex.reps || 10,
                                    reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || 10 : ex.reps || 10,
                                    weight: 0,
                                    completed: false,
                                  })),
                                  restTimerSeconds: parseInt(ex.rest) || 90,
                                  notes: ex.notes || '',
                                })) || []
                              ) || [];
                              
                              if (exercises.length > 0) {
                                const { startFromTemplate } = useWorkoutStore.getState();
                                startFromTemplate({
                                  id: `session-${Date.now()}`,
                                  name: `${day.dayLabel} - ${clientUser.displayName}`,
                                  description: `Session from ${activeProgram.templateName}`,
                                  exercises,
                                  category: 'strength',
                                  estimatedDuration: 60,
                                  createdAt: new Date().toISOString(),
                                  createdBy: user?.id || '',
                                  isPublic: false,
                                  updatedAt: new Date().toISOString(),
                                }, clientId);
                                router.push('/workout/active');
                              }
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <Dumbbell className="w-4 h-4 text-emerald-400" />
                              {day.dayLabel}
                            </span>
                            <span className="text-xs text-gray-500">
                              {day.blocks?.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0) || 0} exercises
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => router.push(`/clients/${clientId}/program/select`)}
                      className="w-full"
                    >
                      <Dumbbell className="w-4 h-4 mr-2" />
                      Change Program
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">Onboarding complete</span>
                    </div>
                    <Button 
                      onClick={() => router.push(`/clients/${clientId}/program/select`)}
                      className="w-full bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Select Program
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Goals - Always show with edit option */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400" />
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
                      <Badge key={i} variant="secondary" className="bg-gray-800">
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
              <DialogContent className="bg-gray-900 border-gray-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Edit Goals</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      placeholder="Add a goal..."
                      className="bg-gray-800 border-gray-700 text-white"
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
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[60px]">
                    {editGoals.map((goal, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary" 
                        className="bg-gray-800 cursor-pointer hover:bg-red-900/50 group"
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
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
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

            {/* Notes - Always show with edit option */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-emerald-400" />
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
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{clientRelation.notes}</p>
                ) : (
                  <p className="text-gray-500 text-sm">No notes yet. Click edit to add notes.</p>
                )}
              </CardContent>
            </Card>

            {/* Edit Notes Dialog */}
            <Dialog open={showEditNotes} onOpenChange={setShowEditNotes}>
              <DialogContent className="bg-gray-900 border-gray-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Edit Notes</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this client..."
                    className="bg-gray-800 border-gray-700 text-white min-h-[150px]"
                  />
                  <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-emerald-400" />
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
                        className="text-emerald-400 text-xs"
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
                      .map(workout => (
                        <div
                          key={workout.id}
                          className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors"
                          onClick={() => router.push(`/workout/${workout.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm truncate">{workout.name}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(workout.startTime), 'MMM d')} • {workout.exercises.length} exercises
                              {workout.notes && ' • Has notes'}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-emerald-400 font-medium text-sm">
                              {Math.round(workout.totalVolume).toLocaleString()} kg
                            </p>
                            <p className="text-xs text-gray-500">
                              {workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="mt-4 space-y-4">
            {/* Workout Categories Summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <Dumbbell className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {clientWorkoutHistory.filter(w => !w.assignedBy).length}
                      </p>
                      <p className="text-xs text-gray-400">Solo Training</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {clientWorkoutHistory.filter(w => w.assignedBy).length}
                      </p>
                      <p className="text-xs text-gray-400">PT Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Full Workout History */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-emerald-400" />
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
                          className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors"
                          onClick={() => router.push(`/workout/${workout.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm truncate">{workout.name}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(workout.startTime), 'MMM d, yyyy')} • {workout.exercises.length} exercises
                              {workout.assignedBy && <span className="text-blue-400 ml-1">• PT Session</span>}
                              {workout.notes && ' • Has notes'}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-emerald-400 font-medium text-sm">
                              {Math.round(workout.totalVolume).toLocaleString()} kg
                            </p>
                            <p className="text-xs text-gray-500">
                              {workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <WorkoutStatsCharts 
              workoutHistory={clientWorkoutHistory} 
              personalBests={clientPersonalBests} 
            />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-4">
            <Card className="bg-gray-900 border-gray-800">
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
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-800 text-gray-100'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${
                            msg.senderId === user?.id ? 'text-emerald-100' : 'text-gray-500'
                          }`}>
                            {format(new Date(msg.createdAt), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Message Input */}
                <div className="border-t border-gray-800 p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="bg-gray-800 border-gray-700"
                    />
                    <Button onClick={handleSendMessage} className="bg-emerald-500 hover:bg-emerald-600">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-4 space-y-4">
            {/* Active Package */}
            {activePackage && (
              <Card className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border-emerald-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-400 font-medium">{activePackage.name}</p>
                      <p className="text-white text-2xl font-bold">
                        {activePackage.remainingSessions}/{activePackage.totalSessions} sessions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Expires</p>
                      <p className="text-white text-sm">
                        {activePackage.expiryDate ? format(new Date(activePackage.expiryDate), 'MMM d, yyyy') : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 bg-gray-900/50 rounded-full h-2">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${(activePackage.usedSessions / activePackage.totalSessions) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sessions List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Session History</h3>
                <Button size="sm" variant="outline" onClick={() => setShowAddSession(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Session
                </Button>
              </div>
              
              {sessions.length === 0 ? (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-8 text-center">
                    <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">No sessions recorded</p>
                  </CardContent>
                </Card>
              ) : (
                sessions
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((session) => (
                    <Card 
                      key={session.id} 
                      className={`border ${
                        session.status === 'completed' && !session.paid 
                          ? 'bg-red-950/30 border-red-500/50' 
                          : session.status === 'scheduled' && session.paid 
                            ? 'bg-amber-950/30 border-amber-500/50'
                            : 'bg-gray-900 border-gray-800'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              session.status === 'completed' ? 'bg-emerald-500/20' :
                              session.status === 'scheduled' ? 'bg-blue-500/20' :
                              session.status === 'no_show' ? 'bg-amber-500/20' :
                              session.status === 'cancelled' ? 'bg-red-500/20' :
                              'bg-gray-700'
                            }`}>
                              {session.status === 'completed' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : session.status === 'scheduled' ? (
                                <Clock className="w-5 h-5 text-blue-400" />
                              ) : session.status === 'no_show' ? (
                                <AlertCircle className="w-5 h-5 text-amber-400" />
                              ) : (
                                <X className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">
                                {format(new Date(session.date), 'EEE, MMM d')}
                              </p>
                              <p className="text-gray-400 text-sm">
                                {session.startTime} - {session.endTime}
                                {session.status === 'no_show' && (
                                  <span className="ml-2 text-amber-400">• No Show</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Paid/Unpaid Toggle Button */}
                            <Button
                              size="sm"
                              variant={session.paid ? 'default' : 'destructive'}
                              className={`text-xs h-7 ${
                                session.paid 
                                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                                  : 'bg-red-500 hover:bg-red-600'
                              }`}
                              onClick={() => handleTogglePaid(session.id, session.paid)}
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              {session.paid ? 'Paid' : 'Unpaid'}
                            </Button>
                            
                            {/* Action buttons for scheduled sessions */}
                            {session.status === 'scheduled' && (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                                  onClick={() => handleMarkSessionComplete(session.id)}
                                  title="Mark Complete"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="h-7 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                                  onClick={() => handleMarkSessionNoShow(session.id)}
                                  title="No Show"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Status indicators */}
                        {session.status === 'completed' && !session.paid && (
                          <p className="text-red-400 text-xs mt-2 pl-11 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Session completed but not paid
                          </p>
                        )}
                        {session.status === 'scheduled' && session.paid && (
                          <p className="text-amber-400 text-xs mt-2 pl-11 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Paid in advance - session pending
                          </p>
                        )}
                        
                        {session.notes && (
                          <p className="text-gray-400 text-sm mt-2 pl-11">{session.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-4 space-y-4">
            {(() => {
              const now = new Date();
              const monthStart = startOfMonth(now);
              const monthEnd = endOfMonth(now);
              const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
              
              // Get sessions for this month
              const monthSessions = sessions.filter(s => {
                const sessionDate = new Date(s.date);
                return isWithinInterval(sessionDate, { start: monthStart, end: monthEnd });
              });
              
              // Get events/calendar items
              const monthEvents = calendarEvents.filter(e => {
                const eventDate = new Date(e.date);
                return isWithinInterval(eventDate, { start: monthStart, end: monthEnd });
              });
              
              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">{format(now, 'MMMM yyyy')}</h3>
                    <Button size="sm" onClick={() => router.push(`/clients/${clientId}/book`)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Book Session
                    </Button>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-gray-400">PT Session</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-gray-400">Solo Workout</span>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-2">
                      {/* Day Headers */}
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <div key={day} className="text-center text-xs text-gray-500 py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar Days */}
                      <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day, i) => {
                          const isCurrentMonth = day.getMonth() === now.getMonth();
                          
                          // Find sessions/events on this day
                          const daySessions = monthSessions.filter(s => 
                            isSameDay(new Date(s.date), day)
                          );
                          const dayEvents = monthEvents.filter(e => 
                            isSameDay(new Date(e.date), day)
                          );
                          
                          const hasPTSession = daySessions.some(s => s.type === 'pt_session') || 
                                               dayEvents.some(e => e.type === 'session');
                          const hasSoloWorkout = clientWorkoutHistory.some(w => 
                            isSameDay(new Date(w.startTime), day) && !w.assignedBy
                          );
                          
                          return (
                            <div
                              key={i}
                              className={`
                                relative aspect-square p-1 rounded-lg text-center text-sm
                                ${!isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}
                                ${isToday(day) ? 'bg-emerald-500/20 ring-1 ring-emerald-500' : ''}
                              `}
                            >
                              <span className={`${isToday(day) ? 'text-emerald-400 font-bold' : ''}`}>
                                {format(day, 'd')}
                              </span>
                              
                              {/* Session indicators */}
                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                                {hasPTSession && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                )}
                                {hasSoloWorkout && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Upcoming Sessions List */}
                  <h3 className="text-white font-medium mt-4">Upcoming Sessions</h3>
                  {(() => {
                    // Get today's completed workouts to filter them out
                    const todayCompletedWorkouts = clientWorkoutHistory.filter(w => {
                      const workoutDate = new Date(w.endTime || w.startTime);
                      return isToday(workoutDate) && w.status === 'completed';
                    });
                    
                    const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
                    const allUpcoming = [...scheduledSessions, ...calendarEvents]
                      .filter(e => {
                        const eventDate = new Date('date' in e ? e.date : '');
                        // If it's today, check if there's already a completed workout
                        if (isToday(eventDate) && todayCompletedWorkouts.length > 0) {
                          // Filter out if we have a completed workout for today
                          return false;
                        }
                        return isFuture(eventDate) || isToday(eventDate);
                      })
                      .sort((a, b) => {
                        const dateA = new Date('date' in a ? a.date : '');
                        const dateB = new Date('date' in b ? b.date : '');
                        return dateA.getTime() - dateB.getTime();
                      })
                      .slice(0, 5);
                    
                    if (allUpcoming.length === 0) {
                      return (
                        <Card className="bg-gray-900 border-gray-800">
                          <CardContent className="p-6 text-center">
                            <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No upcoming sessions</p>
                            <Button 
                              size="sm" 
                              className="mt-3 bg-emerald-500 hover:bg-emerald-600"
                              onClick={() => router.push(`/clients/${clientId}/book`)}
                            >
                              Book First Session
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    }
                    
                    return (
                      <div className="space-y-2">
                        {allUpcoming.map((event: any, i) => {
                          const isPT = event.type === 'pt_session' || event.type === 'session';
                          const eventDate = new Date(event.date);
                          const title = event.title || `PT Session`;
                          const time = event.startTime || '';
                          
                          return (
                            <Card key={i} className={`border ${isPT ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isPT ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                                      {isPT ? (
                                        <User className={`w-4 h-4 text-emerald-400`} />
                                      ) : (
                                        <Dumbbell className={`w-4 h-4 text-blue-400`} />
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-white font-medium text-sm">{title}</p>
                                      <p className="text-gray-400 text-xs">
                                        {format(eventDate, 'EEE, MMM d')} {time && `• ${time}`}
                                      </p>
                                    </div>
                                  </div>
                                  {isToday(eventDate) && (
                                    <Badge className="bg-emerald-500 text-xs">Today</Badge>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4 space-y-4">
            {/* Session Balance Card */}
            {packages.length > 0 && (
              <Card className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border-emerald-500/30">
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-emerald-400" />
                    Session Balance
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">
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
                      <p className="text-2xl font-bold text-emerald-400">
                        {packages.reduce((sum, p) => sum + p.remainingSessions, 0)}
                      </p>
                      <p className="text-xs text-gray-400">Remaining</p>
                    </div>
                  </div>
                  {/* Per Session Cost */}
                  {packages.length > 0 && packages[0].pricePerSession > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Avg. Per Session</span>
                        <span className="text-white font-medium">
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
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">${totalPaid}</p>
                  <p className="text-xs text-gray-400">Total Paid</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
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
              <h3 className="text-white font-medium">Payment History</h3>
              
              {payments.length === 0 ? (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-8 text-center">
                    <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">No payments recorded</p>
                  </CardContent>
                </Card>
              ) : (
                payments
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((payment) => (
                    <Card key={payment.id} className="bg-gray-900 border-gray-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              payment.status === 'paid' ? 'bg-emerald-500/20' :
                              payment.status === 'pending' ? 'bg-amber-500/20' :
                              'bg-red-500/20'
                            }`}>
                              {payment.status === 'paid' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">{payment.description}</p>
                              <p className="text-gray-400 text-sm">
                                {format(new Date(payment.createdAt), 'MMM d, yyyy')}
                                {payment.invoiceNumber && ` • ${payment.invoiceNumber}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold">${payment.amount}</p>
                            {payment.status === 'pending' ? (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-emerald-400 text-xs h-6 px-2"
                                onClick={() => handleMarkPaymentPaid(payment.id)}
                              >
                                Mark Paid
                              </Button>
                            ) : (
                              <p className="text-emerald-400 text-xs capitalize">{payment.method}</p>
                            )}
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
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
            onClick={() => setActiveTab('messages')}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Message
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => router.push(`/clients/${clientId}/book`)}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Book Session
          </Button>
        </div>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Record Payment</DialogTitle>
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
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Sessions Covered</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={sessionsCovered}
                  onChange={(e) => setSessionsCovered(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            
            {/* Per Session Cost Display */}
            {perSessionCost && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Per Session Cost</span>
                  <span className="text-emerald-400 font-bold text-lg">${perSessionCost}</span>
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description</label>
              <Input
                placeholder="e.g., PT Session, Package Payment"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
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
                  className={paymentMethod === 'cash' ? 'bg-emerald-500' : ''}
                >
                  Cash
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('card')}
                  className={paymentMethod === 'card' ? 'bg-emerald-500' : ''}
                >
                  Card
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'bank_transfer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={paymentMethod === 'bank_transfer' ? 'bg-emerald-500' : ''}
                >
                  Transfer
                </Button>
              </div>
            </div>
            
            <Button 
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              onClick={handleAddPayment}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stats Modal for importing existing client history */}
      <Dialog open={showEditStats} onOpenChange={setShowEditStats}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Import Client History</DialogTitle>
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
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Sessions Remaining (Prepaid)</label>
              <Input
                type="number"
                placeholder="e.g., 5"
                value={editSessionsLeft}
                onChange={(e) => setEditSessionsLeft(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Total Amount Paid ($)</label>
              <Input
                type="number"
                placeholder="e.g., 500"
                value={editTotalPaid}
                onChange={(e) => setEditTotalPaid(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <Button 
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              onClick={handleSaveInitialStats}
            >
              <Check className="w-4 h-4 mr-2" />
              Import History
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
