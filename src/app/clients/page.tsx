'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore, useWorkoutStore, useMedalStore } from '@/lib/store';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { evolvingMedals } from '@/lib/medals';
import { registerUserToSupabase, fetchAllUsersFromSupabase, linkClientToTrainer } from '@/lib/supabaseSync';

export default function ClientsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { clients, addClient, updateClient, assignWorkout, getAssignedWorkouts, getSessionsForClient, getPackagesForClient, addCalendarEvent } = useTrainerStore();
  const { getOrCreateConversation } = useMessageStore();
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
  const [newClientPassword, setNewClientPassword] = useState('client123');
  
  // Link existing account state
  const [supabaseUsers, setSupabaseUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [selectedLinkUser, setSelectedLinkUser] = useState<any>(null);

  // Assign workout form
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  // Booking form
  const [showBooking, setShowBooking] = useState(false);
  const [bookingClientId, setBookingClientId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [bookingDuration, setBookingDuration] = useState('60');
  const [bookingNotes, setBookingNotes] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (user?.mode !== 'trainer') {
      router.replace('/workout');
    }
  }, [isAuthenticated, user?.mode, router]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored);
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
    if (!newClientEmail.trim()) {
      toast.error('Please enter client email for login');
      return;
    }
    
    // Check for duplicate email in existing users
    const currentUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const emailExists = currentUsers.some((u: any) => u.email?.toLowerCase() === newClientEmail.toLowerCase().trim());
    if (emailExists) {
      toast.error('A user with this email already exists. Use "Link Existing" instead.');
      return;
    }

    // Generate proper UUID for Supabase (not client-XXXX format)
    const newClientId = generateUUID();
    
    // Use provided email
    const clientEmail = newClientEmail.toLowerCase().trim();
    
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
      password: newClientPassword, // Custom or default password for client login
    };
    
    // Add to local storage users (for local login)
    const existingUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    localStorage.setItem('apex-users', JSON.stringify([...existingUsers, newClientUser]));
    setAllUsers([...existingUsers, newClientUser]);
    
    // Sync to Supabase so client can log in from any device
    try {
      const synced = await registerUserToSupabase(newClientUser as any, newClientPassword);
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
    setNewClientPassword('client123');
    toast.success(`Added ${newClientName} as a client. Login: ${clientEmail} / ${newClientPassword}`);
    
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
      }, scheduledDate || new Date().toISOString());
      
      setShowAssignWorkout(false);
      setSelectedTemplateId('');
      setScheduledDate('');
      toast.success('Workout assigned successfully');
    }
  };

  if (!isAuthenticated || user?.mode !== 'trainer') return null;

  const trainerClients = clients.filter(c => c.trainerId === user?.id);
  const activeClients = trainerClients.filter(c => c.status === 'active');
  const pendingClients = trainerClients.filter(c => c.status === 'pending');

  const getClientUser = (clientId: string) => {
    return allUsers.find(u => u.id === clientId);
  };

  const filteredClients = searchQuery
    ? trainerClients.filter(c => {
        const clientUser = getClientUser(c.clientId);
        return clientUser?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               clientUser?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : trainerClients;

  return (
    <MainLayout>
      <PageHeader 
        title="Clients" 
        subtitle={`${activeClients.length} active clients`}
        action={
          <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-rose-500 hover:bg-rose-600">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle className="text-white">Add Client</DialogTitle>
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
                    className="cursor-pointer hover:border-emerald-500 transition-colors bg-gray-800 border-gray-700"
                    onClick={() => setClientMode('create')}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                        <UserPlus className="h-6 w-6 text-emerald-400" />
                      </div>
                      <h3 className="font-semibold text-white">Create New</h3>
                      <p className="text-xs text-gray-400">New client, no account yet</p>
                    </CardContent>
                  </Card>
                  <Card 
                    className="cursor-pointer hover:border-blue-500 transition-colors bg-gray-800 border-gray-700"
                    onClick={() => setClientMode('link')}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                        <Link2 className="h-6 w-6 text-blue-400" />
                      </div>
                      <h3 className="font-semibold text-white">Link Existing</h3>
                      <p className="text-xs text-gray-400">Has account from another device</p>
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
                    className="text-gray-400"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-300">Client Name *</Label>
                    <Input
                      type="text"
                      placeholder="John Smith"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Email * (for login)</Label>
                    <Input
                      type="email"
                      placeholder="client@example.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Phone (optional)</Label>
                    <Input
                      type="tel"
                      placeholder="021 123 4567"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Gender *</Label>
                    <Select value={newClientGender} onValueChange={(v) => setNewClientGender(v as 'male' | 'female' | 'other')}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other / Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Login Password</Label>
                    <Input
                      type="text"
                      placeholder="client123"
                      value={newClientPassword}
                      onChange={(e) => setNewClientPassword(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <p className="text-xs text-gray-500">Password for client to log into their account</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAddClientAndOnboard}
                      className="flex-1 bg-rose-500 hover:bg-rose-600"
                      disabled={!newClientName.trim() || !newClientEmail.trim()}
                    >
                      Add & Onboard
                    </Button>
                    <Button 
                      onClick={handleAddClientSkipOnboarding}
                      variant="outline"
                      className="flex-1"
                      disabled={!newClientName.trim() || !newClientEmail.trim()}
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
                    className="text-gray-400"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-300">Search Supabase accounts</Label>
                    <Input
                      type="text"
                      placeholder="Search by name or email..."
                      value={linkSearchQuery}
                      onChange={(e) => {
                        setLinkSearchQuery(e.target.value);
                        setSelectedLinkUser(null);
                      }}
                      className="bg-gray-800 border-gray-700 text-white"
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
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                            }`}
                          >
                            <p className="font-medium text-white">{u.displayName || u.username}</p>
                            <p className="text-sm text-gray-400">{u.email}</p>
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
        }
      />

      <div className="px-4 py-4 pb-24">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-rose-400">{activeClients.length}</p>
              <p className="text-xs text-gray-400">Active</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{pendingClients.length}</p>
              <p className="text-xs text-gray-400">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{trainerClients.length}</p>
              <p className="text-xs text-gray-400">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Clients List */}
        <div>
          {filteredClients.length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <Users className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-400 mb-2">No clients found</h3>
                <p className="text-sm text-gray-500 mb-4">
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
                const completedSessions = sessions.filter(s => s.status === 'completed').length;
                
                return (
                  <Card 
                    key={client.id} 
                    className="bg-gray-900 border-gray-800 cursor-pointer hover:border-gray-700 transition-colors"
                    onClick={() => router.push(`/clients/${client.clientId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar 
                          className="w-12 h-12 cursor-pointer hover:ring-2 hover:ring-rose-500 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProfileClientId(client.clientId);
                            setShowProfileCard(true);
                          }}
                        >
                          <AvatarImage src={clientUser?.profilePhoto} />
                          <AvatarFallback className="bg-gray-800 text-white">
                            {clientUser?.displayName?.[0] || clientUser?.username?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white truncate">
                              {clientUser?.displayName || clientUser?.username || 'Unknown'}
                            </h3>
                            {clientUser?.gender && clientUser.gender !== 'other' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 capitalize">
                                {clientUser.gender === 'female' ? '♀' : '♂'}
                              </span>
                            )}
                            <Badge 
                              className={client.status === 'active' 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/20 text-amber-400'
                              }
                            >
                              {client.status}
                            </Badge>
                            {!client.onboardingComplete && (
                              <Badge className="bg-orange-500/20 text-orange-400">
                                Needs Onboarding
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {completedSessions} sessions
                            </span>
                            {activePackage && (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Target className="w-3 h-3" />
                                {activePackage.remainingSessions} left
                              </span>
                            )}
                          </div>

                          {client.goals && client.goals.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {client.goals.slice(0, 2).map((goal, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs border-gray-700 text-gray-400">
                                  {goal}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </div>

                      {/* Quick Actions */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white"
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
                          className="text-gray-400 hover:text-white"
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
                          className="text-gray-400 hover:text-white"
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
      </div>

      {/* Booking Dialog */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Book Session</DialogTitle>
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
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-300">Time</Label>
              <Select value={bookingTime} onValueChange={setBookingTime}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
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
              <Label className="text-gray-300">Duration</Label>
              <Select value={bookingDuration} onValueChange={setBookingDuration}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
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
              <Label className="text-gray-300">Notes (optional)</Label>
              <Input
                type="text"
                placeholder="e.g., Focus on upper body"
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <Button 
              onClick={() => {
                if (!bookingClientId || !bookingDate || !bookingTime) return;
                
                const clientUser = allUsers.find(u => u.id === bookingClientId);
                const startDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
                const endDateTime = new Date(startDateTime.getTime() + parseInt(bookingDuration) * 60 * 1000);
                
                addCalendarEvent({
                  trainerId: user?.id || '',
                  clientId: bookingClientId,
                  title: `Session with ${clientUser?.displayName || 'Client'}`,
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
              className="w-full bg-emerald-500 hover:bg-emerald-600"
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
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Assign Workout</DialogTitle>
            <DialogDescription>
              Choose a template and schedule date for this client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Workout Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {defaultTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-300">Scheduled Date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
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
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          {profileClientId && (() => {
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
            const realStrengthRating = clientPBs.length > 0 
              ? calculateFullStrengthRating(clientPBs, isMale)
              : null;
            
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
                      <AvatarFallback className="bg-gray-800 text-white text-xl">
                        {clientUser?.displayName?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-white text-lg">
                        {clientUser?.displayName || 'Unknown'}
                      </DialogTitle>
                      <p className="text-sm text-gray-400">{completedSessions} sessions completed</p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Strength Rating */}
                <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-white">Strength Rating</span>
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
                          <span className="text-gray-400">Bench/Chest</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{Math.round(benchPB.oneRepMax)}kg 1RM</span>
                          </div>
                        </div>
                      )}
                      {shoulderPB && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Shoulders</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{Math.round(shoulderPB.oneRepMax)}kg 1RM</span>
                          </div>
                        </div>
                      )}
                      {squatPB && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Squat/Legs</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{Math.round(squatPB.oneRepMax)}kg 1RM</span>
                          </div>
                        </div>
                      )}
                      {deadliftPB && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Deadlift</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{Math.round(deadliftPB.oneRepMax)}kg 1RM</span>
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
                <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-white">Top Medals</span>
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
                          <p className="text-xs text-gray-400 mt-1 truncate">{medal.name}</p>
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
                        <Badge key={idx} variant="outline" className="text-xs border-gray-700 text-gray-400">
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
          })()}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
