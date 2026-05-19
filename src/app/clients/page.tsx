'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, useTrainerStore, useWorkoutStore, useMedalStore, useSocialStore } from '@/lib/store';
import { getClientName as getClientNameUtil } from '@/lib/clientUtils';
import { useMessageStore } from '@/lib/messageStore';
import { calculateFullStrengthRating } from '@/lib/strengthRating';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { defaultTemplates } from '@/lib/templates';
import { 
  UserPlus, 
  Search, 
  MoreVertical,
  Calendar,
  Dumbbell,
  MessageCircle,
  TrendingUp,
  ChevronRight,
  Users,
  ClipboardList,
  CheckCircle2,
  Clock,
  Target,
  Trophy,
  Award,
  X,
  Link2,
  ArrowLeft,
  Loader2,
  DollarSign,
  UsersRound,
  Plus,
  Trash2,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { evolvingMedals } from '@/lib/medals';
import { registerUserToSupabase, fetchAllUsersFromSupabase, linkClientToTrainer } from '@/lib/supabaseSync';
import { hashPassword } from '@/lib/store';
import { ClientNameLink } from '@/components/ClientNameLink';
import Link from 'next/link';

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsPageContent />
    </Suspense>
  );
}

function ClientsPageContent() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { clients, clientGroups, addClient, updateClient, assignWorkout, getAssignedWorkouts, getSessionsForClient, getPackagesForClient, addCalendarEvent, addClientGroup, updateClientGroup, deleteClientGroup } = useTrainerStore();
  const { workoutHistory } = useWorkoutStore();
  const { getOrCreateConversation } = useMessageStore();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAssignWorkout, setShowAssignWorkout] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [profileClientId, setProfileClientId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // New client form
  const [clientMode, setClientMode] = useState<'create' | 'link' | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientGender, setNewClientGender] = useState<'male' | 'female' | 'other'>('other');
  const [newClientPassword, setNewClientPassword] = useState('');
  
  // Link existing account state
  const [supabaseUsers, setSupabaseUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [selectedLinkUser, setSelectedLinkUser] = useState<any>(null);

  // Assign workout form
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [showNotesProminently, setShowNotesProminently] = useState(false);
  const [showProgramWorkoutCount, setShowProgramWorkoutCount] = useState(false);

  // Booking form
  const [showBooking, setShowBooking] = useState(false);
  const [bookingClientId, setBookingClientId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [bookingDuration, setBookingDuration] = useState('60');
  const [bookingNotes, setBookingNotes] = useState('');
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  
  // View mode (clients or groups)
  const [viewMode, setViewMode] = useState<'clients' | 'groups'>('clients');

  // Auto-open Add Client dialog when ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowAddClient(true);
    }
  }, [searchParams]);
  
  // Group management state
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupPrice, setNewGroupPrice] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (user?.mode !== 'trainer') {
      router.replace('/workout');
    }
  }, [isAuthenticated, user?.mode, router]);

  // Track loading state - set to false once initial data is available
  useEffect(() => {
    if (clients.length > 0 || allUsers.length > 0) {
      setIsLoadingClients(false);
    }
  }, [clients.length, allUsers.length]);

  // Load users from both localStorage AND Supabase for cross-device sync
  useEffect(() => {
    const loadAllUsers = async () => {
      // Start with localStorage for quick load
      const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
      setAllUsers(stored);
      
      // Then fetch from Supabase and merge (Supabase is source of truth)
      try {
        const supabaseUsersList = await fetchAllUsersFromSupabase();
        if (supabaseUsersList && supabaseUsersList.length > 0) {
          console.log('[Clients] Loaded', supabaseUsersList.length, 'users from Supabase');
          
          // Merge: Supabase data takes precedence BUT preserve local passwords
          const localPasswordMap = new Map(stored.map((u: any) => [u.id, u.password]));
          const supabaseIds = new Set(supabaseUsersList.map((u: any) => u.id));
          const localOnlyUsers = stored.filter((u: any) => !supabaseIds.has(u.id));
          const mergedUsers = [
            ...supabaseUsersList.map((u: any) => ({
              ...u,
              password: u.password || localPasswordMap.get(u.id) || undefined,
            })),
            ...localOnlyUsers,
          ];
          
          setAllUsers(mergedUsers);
          
          // Update localStorage with merged data
          localStorage.setItem('apex-users', JSON.stringify(mergedUsers));
        }
      } catch (e) {
        console.error('[Clients] Error loading users from Supabase:', e);
      }
    };
    
    loadAllUsers();
  }, []);

  // Fetch Supabase users when link mode is selected
  useEffect(() => {
    if (clientMode === 'link' && supabaseUsers.length === 0) {
      setIsLoadingUsers(true);
      fetchAllUsersFromSupabase()
        .then(users => {
          setSupabaseUsers(users);
          console.log('[Clients] Loaded', users.length, 'users from Supabase for linking');
        })
        .finally(() => setIsLoadingUsers(false));
    }
  }, [clientMode, supabaseUsers.length]);

  // Filter Supabase users by search
  const filteredLinkUsers = linkSearchQuery.trim()
    ? supabaseUsers.filter((u: any) => 
        u.displayName?.toLowerCase().includes(linkSearchQuery.toLowerCase()) || 
        u.username?.toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(linkSearchQuery.toLowerCase())
      )
    : supabaseUsers;

  // Generate a random client password (8 chars, alphanumeric)
  const generateClientPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    return pwd;
  };

  // Generate a proper UUID for Supabase
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Link existing Supabase account as client
  const handleLinkExistingAccount = async () => {
    if (!selectedLinkUser) {
      toast.error('Please select a user to link');
      return;
    }
    
    // Check if already a client (prevent duplicates)
    const existingClient = clients.find(c => c.clientId === selectedLinkUser.id);
    if (existingClient) {
      toast.error('This user is already in your client list');
      return;
    }
    
    // Add to trainer's client list
    addClient(selectedLinkUser.id, {
      goals: [],
      onboardingComplete: false,
      status: 'active',
    });
    
    // Update the client's trainerId in Supabase so they can see the connection
    if (user?.id) {
      await linkClientToTrainer(selectedLinkUser.id, user.id);
    }
    
    // Save to localStorage for local login
    const existingLocalUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    if (!existingLocalUsers.find((u: any) => u.id === selectedLinkUser.id)) {
      const updatedUser = { ...selectedLinkUser, trainerId: user?.id };
      localStorage.setItem('apex-users', JSON.stringify([...existingLocalUsers, updatedUser]));
      setAllUsers([...existingLocalUsers, updatedUser]);
    }
    
    toast.success(`Linked ${selectedLinkUser.displayName || selectedLinkUser.email} as your client`);
    
    // Reset and close
    setShowAddClient(false);
    setClientMode(null);
    setSelectedLinkUser(null);
    setLinkSearchQuery('');
    
    return selectedLinkUser.id;
  };

  const handleLinkAndOnboard = async () => {
    const clientId = await handleLinkExistingAccount();
    if (clientId) {
      router.push(`/clients/${clientId}/onboarding`);
    }
  };

  const handleLinkSkipOnboarding = async () => {
    const clientId = await handleLinkExistingAccount();
    if (clientId) {
      updateClient(clientId, { onboardingComplete: true });
      router.push(`/clients/${clientId}`);
    }
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }
    // Check for duplicate email if one was provided
    if (newClientEmail.trim()) {
      const currentUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
      const emailExists = currentUsers.some((u: any) => u.email?.toLowerCase() === newClientEmail.toLowerCase().trim());
      if (emailExists) {
        toast.error('A user with this email already exists. Use "Link Existing" instead.');
        return;
      }
    }

    // Generate proper UUID and random password for this client
    const newClientId = generateUUID();
    const clientPassword = newClientPassword || generateClientPassword();
    
    // Use provided email or generate placeholder
    const clientEmail = newClientEmail.trim() 
      ? newClientEmail.toLowerCase().trim() 
      : `${newClientName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}@placeholder.local`;
    
    // Create a user entry for the client
    const newClientUser = {
      id: newClientId,
      email: clientEmail,
      username: newClientName.toLowerCase().replace(/\s+/g, '_'),
      displayName: newClientName,
      phone: newClientPhone || '',
      gender: newClientGender,
      mode: 'user' as const,
      isTrainer: false,
      isVerifiedTrainer: false,
      preferredUnit: 'kg' as const,
      createdAt: new Date().toISOString(),
      followers: [],
      following: [],
      trainerId: user?.id, // Link client to their trainer
      accountStatus: 'placeholder' as const,
      password: hashPassword(clientPassword), // Hash password for login matching
    };
    
    // Add to local storage users (for local login)
    const existingUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    localStorage.setItem('apex-users', JSON.stringify([...existingUsers, newClientUser]));
    setAllUsers([...existingUsers, newClientUser]);
    
    // Sync to Supabase so client can log in from any device
    try {
      const synced = await registerUserToSupabase(newClientUser as any, clientPassword, 'placeholder');
      if (synced) {
        console.log('Client account synced to Supabase:', clientEmail);
      } else {
        console.log('Client saved locally only (Supabase sync failed or not configured)');
      }
    } catch (e) {
      console.error('Error syncing client to Supabase:', e);
    }
    
    // Add as trainer's client relationship
    addClient(newClientId, {
      goals: [],
      onboardingComplete: false,
      status: 'active',
    });
    
    setShowAddClient(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientGender('other');
    setNewClientPassword('');
    // Create notification to set up session package
    useSocialStore.getState().addNotification({
      userId: user?.id || '',
      type: 'system',
      title: 'Set up session package',
      message: `Set up a session package for ${newClientName}`,
      actionUrl: `/clients/${newClientId}`,
    });
    
    toast.success(newClientEmail.trim() 
      ? `Added ${newClientName} — invite them to set up their account`
      : `Added ${newClientName} as a client (no email — add later)`);
    
    return newClientId;
  };

  const handleAddClientAndOnboard = async () => {
    const clientId = await handleAddClient();
    if (clientId) {
      router.push(`/clients/${clientId}/onboarding`);
    }
  };

  const handleAddClientSkipOnboarding = async () => {
    const clientId = await handleAddClient();
    if (clientId) {
      // Mark onboarding as complete and go to client page
      updateClient(clientId, { onboardingComplete: true });
      router.push(`/clients/${clientId}`);
    }
  };

  const handleAssignWorkout = () => {
    if (!selectedClientId || !selectedTemplateId) return;
    
    const template = defaultTemplates.find(t => t.id === selectedTemplateId);
    if (template) {
      assignWorkout(selectedClientId, {
        id: '',
        name: template.name,
        exercises: template.exercises,
        startTime: new Date().toISOString(),
        totalVolume: 0,
        userId: selectedClientId,
        status: 'active',
        showNotesProminently,
        showProgramWorkoutCount,
      }, scheduledDate || new Date().toISOString());
      
      setShowAssignWorkout(false);
      setSelectedTemplateId('');
      setScheduledDate('');
      setShowNotesProminently(false);
      setShowProgramWorkoutCount(false);
      toast.success('Workout assigned successfully');
    }
  };

  // Handle create group
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedGroupMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }
    
    addClientGroup({
      trainerId: user?.id || '',
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || undefined,
      memberIds: selectedGroupMembers,
      color: newGroupColor,
      pricePerSession: newGroupPrice ? parseFloat(newGroupPrice) : undefined,
      status: 'active',
    });
    
    toast.success(`Group "${newGroupName}" created with ${selectedGroupMembers.length} members`);
    
    // Reset form
    setShowAddGroup(false);
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupPrice('');
    setNewGroupColor('#3b82f6');
    setSelectedGroupMembers([]);
    setGroupSearchQuery('');
  };

  // Toggle member selection for group
  const toggleGroupMember = (clientId: string) => {
    setSelectedGroupMembers(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  if (!isAuthenticated || user?.mode !== 'trainer') return null;

  const trainerClients = clients.filter(c => c.trainerId === user?.id);
  const trainerGroups = clientGroups.filter(g => g.trainerId === user?.id);
  const activeClients = trainerClients.filter(c => c.status === 'active');
  const pendingClients = trainerClients.filter(c => c.status === 'pending');

  const getClientUser = (clientId: string) => {
    // Primary: check allUsers (localStorage + Supabase users merge)
    const fromUsers = allUsers.find(u => u.id === clientId);
    if (fromUsers) return fromUsers;
    // Fallback: use nested client data attached by fetchTrainerClientsFromSupabase
    const tc = trainerClients.find(c => c.clientId === clientId);
    const attached = (tc as any)?.client;
    if (attached) {
      return { id: clientId, displayName: attached.displayName, username: attached.username, profilePhoto: attached.profilePhoto };
    }
    console.warn(`[Clients] No user data found for client ${clientId.slice(0, 8)}...`);
    return undefined;
  };

  const filteredClients = searchQuery
    ? trainerClients.filter(c => {
        const clientUser = getClientUser(c.clientId);
        const name = clientUser?.displayName || clientUser?.username || '';
        const email = clientUser?.email || '';
        const q = searchQuery.toLowerCase();
        return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
      })
    : trainerClients;

  return (
    <MainLayout>
      <PageHeader 
        title="Clients" 
        subtitle={`${activeClients.length} active clients`}
        action={
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="border-gray-200"
              disabled={isSyncing}
              onClick={async () => {
                if (!user?.id) return;
                setIsSyncing(true);
                try {
                  await useTrainerStore.getState().loadFromSupabase(user.id);
                  toast.success('Data synced from cloud');
                } catch (e) {
                  toast.error('Sync failed');
                } finally {
                  setIsSyncing(false);
                }
              }}
            >
              <Loader2 className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-rose-500 hover:bg-rose-600">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-white border-gray-200 max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Add Client</DialogTitle>
                <DialogDescription>
                  {clientMode === null ? 'Does this client already have an account?' : 
                   clientMode === 'create' ? 'Create a new account for your client' :
                   'Link an existing account from Supabase'}
                </DialogDescription>
              </DialogHeader>
              
              {/* Step 1: Choose Create or Link */}
              {clientMode === null && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <Card 
                    className="cursor-pointer hover:border-sky-500 transition-colors bg-gray-50 border-gray-200"
                    onClick={() => setClientMode('create')}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="w-12 h-12 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto">
                        <UserPlus className="h-6 w-6 text-sky-500" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Create New</h3>
                      <p className="text-xs text-gray-500">New client, no account yet</p>
                    </CardContent>
                  </Card>
                  <Card 
                    className="cursor-pointer hover:border-blue-500 transition-colors bg-gray-50 border-gray-200"
                    onClick={() => setClientMode('link')}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                        <Link2 className="h-6 w-6 text-blue-500" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Link Existing</h3>
                      <p className="text-xs text-gray-500">Has account from another device</p>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Create New Account Form */}
              {clientMode === 'create' && (
                <div className="space-y-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setClientMode(null)}
                    className="text-gray-500"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-700">Client Name *</Label>
                    <Input
                      type="text"
                      placeholder="John Smith"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Email <span className="text-gray-400">(optional)</span></Label>
                    <Input
                      type="email"
                      placeholder="client@example.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Phone (optional)</Label>
                    <Input
                      type="tel"
                      placeholder="021 123 4567"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Gender *</Label>
                    <Select value={newClientGender} onValueChange={(v) => setNewClientGender(v as 'male' | 'female' | 'other')}>
                      <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other / Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Login Password</Label>
                    <Input
                      type="text"
                      placeholder="client123"
                      value={newClientPassword}
                      onChange={(e) => setNewClientPassword(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900"
                    />
                    <p className="text-xs text-gray-400">Password for client to log into their account</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAddClientAndOnboard}
                      className="flex-1 bg-rose-500 hover:bg-rose-600"
                      disabled={!newClientName.trim()}
                    >
                      Add & Onboard
                    </Button>
                    <Button 
                      onClick={handleAddClientSkipOnboarding}
                      variant="outline"
                      className="flex-1"
                      disabled={!newClientName.trim()}
                    >
                      Skip Onboarding
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Link Existing Account */}
              {clientMode === 'link' && (
                <div className="space-y-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setClientMode(null);
                      setSelectedLinkUser(null);
                      setLinkSearchQuery('');
                    }}
                    className="text-gray-500"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-700">Search Supabase accounts</Label>
                    <Input
                      type="text"
                      placeholder="Search by name or email..."
                      value={linkSearchQuery}
                      onChange={(e) => {
                        setLinkSearchQuery(e.target.value);
                        setSelectedLinkUser(null);
                      }}
                      className="bg-gray-50 border-gray-200 text-gray-900"
                    />
                  </div>
                  
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-400">Loading accounts...</span>
                    </div>
                  ) : filteredLinkUsers.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">
                      {supabaseUsers.length === 0 ? 'No accounts found in Supabase' : 'No matching accounts'}
                    </p>
                  ) : (
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {filteredLinkUsers.map((u: any) => (
                          <div
                            key={u.id}
                            onClick={() => setSelectedLinkUser(u)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedLinkUser?.id === u.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                            }`}
                          >
                            <p className="font-medium text-gray-900">{u.displayName || u.username}</p>
                            <p className="text-sm text-gray-500">{u.email}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleLinkAndOnboard}
                      className="flex-1 bg-blue-500 hover:bg-blue-600"
                      disabled={!selectedLinkUser}
                    >
                      Link & Onboard
                    </Button>
                    <Button 
                      onClick={handleLinkSkipOnboarding}
                      variant="outline"
                      className="flex-1"
                      disabled={!selectedLinkUser}
                    >
                      Skip Onboarding
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="px-4 py-4 pb-24">
        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === 'clients' ? 'default' : 'outline'}
            className={viewMode === 'clients' ? 'bg-rose-500 hover:bg-rose-600' : 'border-gray-200'}
            onClick={() => setViewMode('clients')}
          >
            <Users className="w-4 h-4 mr-2" />
            Clients ({trainerClients.length})
          </Button>
          <Button
            variant={viewMode === 'groups' ? 'default' : 'outline'}
            className={viewMode === 'groups' ? 'bg-blue-500 hover:bg-blue-600' : 'border-gray-200'}
            onClick={() => setViewMode('groups')}
          >
            <UsersRound className="w-4 h-4 mr-2" />
            Groups ({trainerGroups.length})
          </Button>
        </div>

        {viewMode === 'clients' ? (
          <>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-rose-500">{activeClients.length}</p>
              <p className="text-xs text-gray-500">Active</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{pendingClients.length}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-sky-500">{trainerClients.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Clients List */}
        <div>
          {isLoadingClients ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Card key={i} className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3" />
                        <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200">
                      <div className="h-8 bg-gray-200 animate-pulse rounded" />
                      <div className="h-8 bg-gray-200 animate-pulse rounded" />
                      <div className="h-8 bg-gray-200 animate-pulse rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Users className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-500 mb-2">No clients found</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Add your first client to get started
                </p>
                <Button 
                  className="bg-rose-500 hover:bg-rose-600"
                  onClick={() => setShowAddClient(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client) => {
                const clientUser = getClientUser(client.clientId);
                const assignedWorkouts = getAssignedWorkouts(client.clientId);
                const sessions = getSessionsForClient(client.clientId);
                const packages = getPackagesForClient(client.clientId);
                const activePackage = packages.find(p => p.status === 'active');
                // Use workoutHistory for actual workout count (matches client detail page)
                const clientWorkouts = workoutHistory.filter(w => w.userId === client.clientId);
                const workoutsDone = clientWorkouts.length;
                const paidSessions = sessions.filter(s => s.paid).length;
                const unpaidSessions = workoutsDone - paidSessions;
                const lastWorkout = clientWorkouts
                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
                // Calculate total paid from packages
                const totalPaid = packages.reduce((sum, p) => sum + (p.priceTotal || 0), 0);
                
                return (
                  <Card 
                    key={client.id} 
                    className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
                    onClick={() => router.push(`/clients/${client.clientId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <button onClick={(e) => { e.stopPropagation(); setProfileClientId(client.clientId); setShowProfileCard(true); }}>
                          <Avatar 
                            className="w-12 h-12 cursor-pointer hover:ring-2 hover:ring-rose-500 transition-all"
                          >
                            <AvatarImage src={clientUser?.profilePhoto} />
                            <AvatarFallback className="bg-gray-100 text-gray-600">
                              {clientUser?.displayName?.[0] || clientUser?.username?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/clients/${client.clientId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-gray-900 truncate hover:text-sky-500 hover:underline transition-colors"
                            >
                              {clientUser?.displayName || clientUser?.username || 'Unknown'}
                            </Link>
                            {clientUser?.gender && clientUser.gender !== 'other' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">
                                {clientUser.gender === 'female' ? '♀' : '♂'}
                              </span>
                            )}
                            <Badge 
                              className={`cursor-pointer transition-colors ${client.status === 'active' 
                                ? 'bg-sky-500/10 text-sky-500 hover:bg-red-500/10 hover:text-red-500' 
                                : 'bg-amber-500/10 text-amber-500 hover:bg-sky-500/10 hover:text-sky-500'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newStatus = client.status === 'active' ? 'paused' : 'active';
                                updateClient(client.clientId, { status: newStatus });
                                toast.success(`${clientUser?.displayName || 'Client'} marked as ${newStatus === 'active' ? 'Active' : 'Non-Active'}`);
                              }}
                            >
                              {client.status === 'active' ? 'Active' : 'Non-Active'}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                            <span className="flex items-center gap-1 text-gray-500">
                              <CheckCircle2 className="w-3 h-3" />
                              {workoutsDone} sessions
                            </span>
                            {activePackage && (
                              <span className="flex items-center gap-1 text-sky-500">
                                <Target className="w-3 h-3" />
                                {activePackage.remainingSessions} left
                              </span>
                            )}
                            {totalPaid > 0 && (
                              <span className="flex items-center gap-1 text-blue-500">
                                <DollarSign className="w-3 h-3" />
                                ${totalPaid}
                              </span>
                            )}
                          </div>
                          {lastWorkout && (
                            <p className="text-xs text-gray-600 mt-1">
                              Last: {format(new Date(lastWorkout.startTime), 'MMM d')}
                            </p>
                          )}

                          {client.goals && client.goals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {client.goals.slice(0, 2).map((goal, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs border-gray-200 text-gray-500">
                                  {goal}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </div>

                      {/* Quick Actions */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-900 min-h-[44px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!user?.id) return;
                            getOrCreateConversation(user.id, client.clientId);
                            router.push('/messages');
                          }}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-900 min-h-[44px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClientId(client.clientId);
                            setShowAssignWorkout(true);
                          }}
                        >
                          <Dumbbell className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-900 min-h-[44px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookingClientId(client.clientId);
                            setBookingDate(format(new Date(), 'yyyy-MM-dd'));
                            setShowBooking(true);
                          }}
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Book
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
          </>
        ) : (
          /* Groups View */
          <div className="space-y-4">
            {/* Add Group Button */}
            <Button 
              className="w-full bg-blue-500 hover:bg-blue-600"
              onClick={() => setShowAddGroup(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Group
            </Button>

            {/* Groups List */}
            {trainerGroups.length === 0 ? (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="py-16 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <UsersRound className="w-10 h-10 text-gray-600" />
                  </div>
                  <h3 className="font-semibold text-gray-400 mb-2">No groups yet</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Create groups for your group fitness classes
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {trainerGroups.map((group) => {
                  const memberCount = group.memberIds.length;
                  const memberPreviews = group.memberIds.slice(0, 4).map(id => getClientUser(id));
                  
                  return (
                    <Card 
                      key={group.id}
                      className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => router.push(`/clients/group/${group.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: group.color || '#3b82f6' }}
                            >
                              <UsersRound className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{group.name}</h3>
                              <p className="text-sm text-gray-400">
                                {memberCount} member{memberCount !== 1 ? 's' : ''}
                                {group.pricePerSession && ` • $${group.pricePerSession}/session`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGroupToDelete(group);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                          </div>
                        </div>
                        
                        {/* Member Avatars */}
                        <div className="flex items-center gap-1">
                          <div className="flex -space-x-2">
                            {memberPreviews.map((member, i) => (
                              <Avatar key={i} className="w-8 h-8 border-2 border-gray-900">
                                <AvatarImage src={member?.profilePhoto} />
                                <AvatarFallback className="bg-gray-100 text-gray-900 text-xs">
                                  {member?.displayName?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          {memberCount > 4 && (
                            <span className="text-xs text-gray-500 ml-2">
                              +{memberCount - 4} more
                            </span>
                          )}
                        </div>
                        
                        {group.description && (
                          <p className="text-sm text-gray-500 mt-2 truncate">{group.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Group Dialog */}
      <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Create Group</DialogTitle>
            <DialogDescription>
              Create a group for group fitness classes
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Group Name *</Label>
              <Input
                placeholder="e.g., Morning Bootcamp"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="e.g., High intensity group training"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Price per Session ($)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 25"
                  value={newGroupPrice}
                  onChange={(e) => setNewGroupPrice(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={newGroupColor}
                  onChange={(e) => setNewGroupColor(e.target.value)}
                  className="bg-gray-50 border-gray-200 h-10 cursor-pointer"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-300">Select Members ({selectedGroupMembers.length} selected)</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search clients..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
              <ScrollArea className="h-48 border border-gray-200 rounded-lg">
                <div className="p-2 space-y-1">
                  {trainerClients
                    .filter(c => {
                      if (!groupSearchQuery) return true;
                      const clientUser = getClientUser(c.clientId);
                      return clientUser?.displayName?.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                             clientUser?.username?.toLowerCase().includes(groupSearchQuery.toLowerCase());
                    })
                    .map((client) => {
                      const clientUser = getClientUser(client.clientId);
                      const isSelected = selectedGroupMembers.includes(client.clientId);
                      return (
                        <div
                          key={client.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-500/20 border border-blue-500' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => toggleGroupMember(client.clientId)}
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={clientUser?.profilePhoto} />
                            <AvatarFallback className="bg-gray-100 text-gray-900 text-xs">
                              {clientUser?.displayName?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-gray-900 text-sm">
                            {clientUser?.displayName || clientUser?.username || 'Unknown'}
                          </span>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
            
            <Button 
              className="w-full bg-blue-500 hover:bg-blue-600"
              onClick={handleCreateGroup}
            >
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Book Session</DialogTitle>
            <DialogDescription>
              Schedule a training session with {allUsers.find(u => u.id === bookingClientId)?.displayName || 'this client'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Date</Label>
              <Input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-600">Time</Label>
              <Select value={bookingTime} onValueChange={setBookingTime}>
                <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 max-h-60">
                  {Array.from({ length: 28 }, (_, i) => {
                    const hour = Math.floor(i / 2) + 6;
                    const minute = i % 2 === 0 ? '00' : '30';
                    const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                    const label = `${hour > 12 ? hour - 12 : hour}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
                    return (
                      <SelectItem key={time} value={time}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-600">Duration</Label>
              <Select value={bookingDuration} onValueChange={setBookingDuration}>
                <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="75">1 hour 15 min</SelectItem>
                  <SelectItem value="90">1 hour 30 min</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-600">Notes (optional)</Label>
              <Input
                type="text"
                placeholder="e.g., Focus on upper body"
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>

            <Button 
              onClick={() => {
                if (!bookingClientId || !bookingDate || !bookingTime) return;
                
                const startDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
                const endDateTime = new Date(startDateTime.getTime() + parseInt(bookingDuration) * 60 * 1000);
                
                addCalendarEvent({
                  trainerId: user?.id || '',
                  clientId: bookingClientId,
                  title: `Session with ${getClientNameUtil(bookingClientId)}`,
                  type: 'session',
                  date: bookingDate,
                  startTime: bookingTime,
                  endTime: format(endDateTime, 'HH:mm'),
                  duration: parseInt(bookingDuration),
                  status: 'scheduled',
                  notes: bookingNotes || undefined,
                });
                
                setShowBooking(false);
                setBookingClientId(null);
                setBookingDate('');
                setBookingTime('09:00');
                setBookingDuration('60');
                setBookingNotes('');
                toast.success(`Session booked for ${format(startDateTime, 'MMM d')} at ${format(startDateTime, 'h:mm a')}`);
              }}
              className="w-full bg-sky-500 hover:bg-sky-600"
              disabled={!bookingDate || !bookingTime}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Workout Dialog */}
      <Dialog open={showAssignWorkout} onOpenChange={setShowAssignWorkout}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Assign Workout</DialogTitle>
            <DialogDescription>
              Choose a template and schedule date for this client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-600">Workout Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {defaultTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-600">Scheduled Date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-600">Display Options</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox 
                    checked={showNotesProminently} 
                    onCheckedChange={(v) => setShowNotesProminently(!!v)} 
                  />
                  <span className="text-sm text-gray-700">Show important notes on each exercise</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox 
                    checked={showProgramWorkoutCount} 
                    onCheckedChange={(v) => setShowProgramWorkoutCount(!!v)} 
                  />
                  <span className="text-sm text-gray-700">Show total workout count (Workout N of M)</span>
                </label>
              </div>
            </div>

            <Button 
              onClick={handleAssignWorkout}
              className="w-full bg-rose-500 hover:bg-rose-600"
              disabled={!selectedTemplateId}
            >
              Assign Workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Profile Card Popup */}
      <Dialog open={showProfileCard} onOpenChange={setShowProfileCard}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-sm">
          {profileClientId && (() => {
            try {
            const clientUser = allUsers.find(u => u.id === profileClientId);
            const client = clients.find(c => c.clientId === profileClientId);
            const sessions = getSessionsForClient(profileClientId);
            const completedSessions = sessions.filter(s => s.status === 'completed').length;
            
            // Get REAL personal bests for this client from workout store
            const { personalBests } = useWorkoutStore.getState();
            const clientPBs = personalBests.filter(pb => pb.userId === profileClientId);
            
            // Get REAL medals for this client from medal store
            const { medals } = useMedalStore.getState();
            const clientMedals = medals.filter(m => m.userId === profileClientId && m.earned);
            
            // Calculate REAL strength rating from client's actual PBs
            const isMale = clientUser?.gender === 'male';
            let realStrengthRating = null;
            try {
              realStrengthRating = clientPBs.length > 0 
                ? calculateFullStrengthRating(clientPBs, isMale)
                : null;
            } catch (e) {
              console.error('Error calculating strength rating:', e);
            }
            
            // Get actual lift scores or show 0 if no data
            const benchPB = clientPBs.find(pb => 
              pb.exerciseId.includes('bench') || pb.exerciseId.includes('chest-press')
            );
            const squatPB = clientPBs.find(pb => 
              pb.exerciseId.includes('squat') || pb.exerciseId.includes('leg-press')
            );
            const deadliftPB = clientPBs.find(pb => 
              pb.exerciseId.includes('deadlift') || pb.exerciseId.includes('rdl')
            );
            const shoulderPB = clientPBs.find(pb => 
              pb.exerciseId.includes('shoulder') || pb.exerciseId.includes('ohp') || pb.exerciseId.includes('overhead')
            );
            
            // Get top 3 medals by tier (diamond > platinum > gold > silver > bronze)
            const tierOrder = { diamond: 5, platinum: 4, gold: 3, silver: 2, bronze: 1 };
            const topMedals = clientMedals
              .sort((a, b) => (tierOrder[b.tier as keyof typeof tierOrder] || 0) - (tierOrder[a.tier as keyof typeof tierOrder] || 0))
              .slice(0, 3);
            
            return (
              <div>
                <DialogHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-16 h-16 border-2 border-rose-500">
                      <AvatarImage src={clientUser?.profilePhoto} />
                      <AvatarFallback className="bg-gray-100 text-gray-900 text-xl">
                        {clientUser?.displayName?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-gray-900 text-lg">
                        {clientUser?.displayName || 'Unknown'}
                      </DialogTitle>
                      <p className="text-sm text-gray-500">{completedSessions} sessions completed</p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Strength Rating */}
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-gray-900">Strength Rating</span>
                    <Badge className="ml-auto bg-amber-500/20 text-amber-400">
                      {realStrengthRating?.overall || 0}
                    </Badge>
                  </div>
                  {clientPBs.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">No workout data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {benchPB && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Bench/Chest</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{Math.round(benchPB.oneRepMax)}kg 1RM</span>
                          </div>
                        </div>
                      )}
                      {shoulderPB && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Shoulders</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{Math.round(shoulderPB.oneRepMax)}kg 1RM</span>
                          </div>
                        </div>
                      )}
                      {squatPB && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Squat/Legs</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{Math.round(squatPB.oneRepMax)}kg 1RM</span>
                          </div>
                        </div>
                      )}
                      {deadliftPB && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Deadlift</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{Math.round(deadliftPB.oneRepMax)}kg 1RM</span>
                          </div>
                        </div>
                      )}
                      {!benchPB && !shoulderPB && !squatPB && !deadliftPB && clientPBs.length > 0 && (
                        <p className="text-xs text-gray-400">
                          {clientPBs.length} exercise PB{clientPBs.length > 1 ? 's' : ''} recorded
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Top Medals */}
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-gray-900">Top Medals</span>
                  </div>
                  {topMedals.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">No medals earned yet</p>
                  ) : (
                    <div className="flex gap-2">
                      {topMedals.map((medal, idx) => (
                        <div 
                          key={idx} 
                          className={`flex-1 text-center p-2 rounded-lg ${
                            medal.tier === 'diamond' ? 'bg-cyan-500/20 border border-cyan-500/30' :
                            medal.tier === 'platinum' ? 'bg-slate-300/20 border border-slate-300/30' :
                            medal.tier === 'gold' ? 'bg-amber-500/20 border border-amber-500/30' :
                            medal.tier === 'silver' ? 'bg-gray-400/20 border border-gray-400/30' :
                            'bg-orange-700/20 border border-orange-700/30'
                          }`}
                        >
                          <span className="text-2xl">{medal.icon}</span>
                          <p className="text-xs text-gray-500 mt-1 truncate">{medal.name}</p>
                          <Badge className={`text-xs mt-1 ${
                            medal.tier === 'diamond' ? 'bg-cyan-500' :
                            medal.tier === 'platinum' ? 'bg-slate-300 text-gray-800' :
                            medal.tier === 'gold' ? 'bg-amber-500' :
                            medal.tier === 'silver' ? 'bg-gray-400' :
                            'bg-orange-700'
                          }`}>
                            {medal.tier}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Goals */}
                {client?.goals && client.goals.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">Goals</p>
                    <div className="flex flex-wrap gap-1">
                      {client.goals.map((goal, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-gray-200 text-gray-500">
                          {goal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full mt-4 bg-rose-500 hover:bg-rose-600"
                  onClick={() => {
                    setShowProfileCard(false);
                    router.push(`/clients/${profileClientId}`);
                  }}
                >
                  View Full Profile
                </Button>
              </div>
            );
            } catch (err) {
              console.error('Error rendering profile card:', err);
              return (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">Unable to load profile</p>
                  <Button 
                    className="mt-3 bg-rose-500 hover:bg-rose-600"
                    onClick={() => {
                      setShowProfileCard(false);
                      router.push(`/clients/${profileClientId}`);
                    }}
                  >
                    View Full Profile
                  </Button>
                </div>
              );
            }
          })()}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!groupToDelete}
        onOpenChange={(open) => { if (!open) setGroupToDelete(null); }}
        title="Delete Group"
        description={`Delete group "${groupToDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete Group"
        variant="destructive"
        onConfirm={() => {
          if (groupToDelete) {
            deleteClientGroup(groupToDelete.id);
            toast.success('Group deleted');
            setGroupToDelete(null);
          }
        }}
        icon={<Trash2 className="w-5 h-5 text-red-400" />}
      />
    </MainLayout>
  );
}
