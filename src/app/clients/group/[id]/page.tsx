'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft,
  UsersRound,
  Users,
  Calendar,
  DollarSign,
  Settings,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Edit,
  MessageCircle,
  Search,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { fetchAllUsersFromSupabase } from '@/lib/supabaseSync';
import type { GroupScheduleSlot } from '@/types';

// v18-D4: weekday labels for display (0=Sun … 6=Sat, matches JS Date.getDay()).
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LABELS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// v18-D4: compute the next `count` recurring occurrences across all slots, sorted ascending.
function nextOccurrences(
  slots: GroupScheduleSlot[],
  count = 6,
  now: Date = new Date()
): { date: Date; slot: GroupScheduleSlot }[] {
  if (!slots || slots.length === 0) return [];
  const out: { date: Date; slot: GroupScheduleSlot }[] = [];
  for (let dayOffset = 0; dayOffset < 28 && out.length < count * slots.length; dayOffset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + dayOffset);
    slots
      .filter((s) => s.weekday === d.getDay())
      .forEach((slot) => {
        const [h, m] = slot.startTime.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return;
        const occ = new Date(d);
        occ.setHours(h, m, 0, 0);
        if (occ.getTime() >= now.getTime()) out.push({ date: occ, slot });
      });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, count);
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  
  const { user, isAuthenticated } = useAuthStore();
  const { 
    clientGroups, 
    clients,
    payments,
    getClientGroup, 
    updateClientGroup, 
    deleteClientGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    getPackagesForClient,
    updateGroupSchedule,
  } = useTrainerStore();

  // v18-D4: new-slot form state for the Schedule tab.
  const [newSlotWeekday, setNewSlotWeekday] = useState<string>('1'); // default Monday
  const [newSlotTime, setNewSlotTime] = useState<string>('');
  const [newSlotDuration, setNewSlotDuration] = useState<string>('60');
  const [newSlotLabel, setNewSlotLabel] = useState<string>('');
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('members');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editColor, setEditColor] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
      setAllUsers(stored);
      
      try {
        const supabaseUsers = await fetchAllUsersFromSupabase();
        if (supabaseUsers && supabaseUsers.length > 0) {
          const supabaseIds = new Set(supabaseUsers.map((u: any) => u.id));
          const localOnly = stored.filter((u: any) => !supabaseIds.has(u.id));
          setAllUsers([...supabaseUsers, ...localOnly]);
        }
      } catch (e) {
        console.error('Error loading users:', e);
      }
    };
    loadUsers();
  }, []);

  const group = clientGroups.find(g => g.id === groupId);
  const trainerClients = clients.filter(c => c.trainerId === user?.id);

  const getClientUser = (clientId: string) => {
    return allUsers.find(u => u.id === clientId);
  };

  // Get members data with payment info
  const membersData = useMemo(() => {
    if (!group) return [];
    
    return group.memberIds.map(clientId => {
      const clientUser = getClientUser(clientId);
      const clientPayments = payments.filter(p => p.clientId === clientId && p.trainerId === user?.id);
      const packages = getPackagesForClient(clientId);
      const activePackage = packages.find(p => p.status === 'active');
      
      const totalPaid = clientPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const sessionsCompleted = activePackage?.usedSessions || 0;
      const sessionsPaid = activePackage?.paidSessions || 0;
      const outstanding = Math.max(0, sessionsCompleted - sessionsPaid) * (group.pricePerSession || 0);
      
      return {
        clientId,
        user: clientUser,
        totalPaid,
        sessionsCompleted,
        sessionsPaid,
        outstanding,
        hasOutstanding: outstanding > 0,
      };
    });
  }, [group, payments, user?.id, allUsers, getPackagesForClient]);

  // Calculate group totals
  const groupStats = useMemo(() => {
    const totalMembers = membersData.length;
    const totalOutstanding = membersData.reduce((sum, m) => sum + m.outstanding, 0);
    const totalPaid = membersData.reduce((sum, m) => sum + m.totalPaid, 0);
    const membersWithOutstanding = membersData.filter(m => m.hasOutstanding).length;
    
    return { totalMembers, totalOutstanding, totalPaid, membersWithOutstanding };
  }, [membersData]);

  // Available clients (not already in group)
  const availableClients = trainerClients.filter(
    c => !group?.memberIds.includes(c.clientId)
  );

  const filteredAvailableClients = memberSearchQuery
    ? availableClients.filter(c => {
        const clientUser = getClientUser(c.clientId);
        return clientUser?.displayName?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
               clientUser?.username?.toLowerCase().includes(memberSearchQuery.toLowerCase());
      })
    : availableClients;

  const openEditDialog = () => {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description || '');
    setEditPrice(group.pricePerSession?.toString() || '');
    setEditColor(group.color || '#3b82f6');
    setShowEditGroup(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      toast.error('Group name is required');
      return;
    }
    
    updateClientGroup(groupId, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      pricePerSession: editPrice ? parseFloat(editPrice) : undefined,
      color: editColor,
    });
    
    toast.success('Group updated');
    setShowEditGroup(false);
  };

  const handleAddMember = (clientId: string) => {
    addMemberToGroup(groupId, clientId);
    toast.success('Member added to group');
  };

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);

  const memberToRemoveUser = memberToRemove ? getClientUser(memberToRemove) : null;

  const handleRemoveMember = (clientId: string) => {
    setMemberToRemove(clientId);
  };

  const handleDeleteGroup = () => {
    setShowDeleteGroupConfirm(true);
  };

  if (!group) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <UsersRound className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-400">Group not found</p>
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
          <Button variant="ghost" size="icon" onClick={() => router.push('/clients')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: group.color || '#3b82f6' }}
          >
            <UsersRound className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">{group.name}</h1>
            <p className="text-sm text-gray-400">{group.memberIds.length} members</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={openEditDialog}
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid grid-cols-3 mx-4 mt-4 bg-gray-900">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <div className="px-4 pb-24">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{groupStats.totalMembers}</p>
                <p className="text-xs text-gray-400">Members</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-sky-400">${groupStats.totalPaid}</p>
                <p className="text-xs text-gray-400">Total Paid</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${groupStats.totalOutstanding > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                  ${groupStats.totalOutstanding}
                </p>
                <p className="text-xs text-gray-400">Outstanding</p>
              </CardContent>
            </Card>
          </div>

          <TabsContent value="members" className="mt-0">
            {/* Add Member Button */}
            <Button 
              className="w-full mb-4 bg-blue-500 hover:bg-blue-600"
              onClick={() => setShowAddMember(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </Button>

            {/* Members List */}
            <div className="space-y-3">
              {membersData.map((member) => (
                <Card 
                  key={member.clientId}
                  className={`bg-gray-900 border-gray-800 ${member.hasOutstanding ? 'border-l-4 border-l-amber-500' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => router.push(`/clients/${member.clientId}`)}
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={member.user?.profilePhoto} />
                          <AvatarFallback className="bg-gray-800 text-white">
                            {member.user?.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white">
                            {member.user?.displayName || member.user?.username || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{member.sessionsCompleted} sessions</span>
                            {member.hasOutstanding && (
                              <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                                ${member.outstanding} due
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-400"
                          onClick={() => handleRemoveMember(member.clientId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {membersData.length === 0 && (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="py-8 text-center">
                    <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">No members yet</p>
                    <p className="text-sm text-gray-500">Add members to this group</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-0">
            {/* Payment Summary */}
            {groupStats.membersWithOutstanding > 0 && (
              <Card className="bg-amber-500/10 border-amber-500/50 mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-amber-400 font-medium">
                        {groupStats.membersWithOutstanding} member{groupStats.membersWithOutstanding > 1 ? 's' : ''} with outstanding payments
                      </p>
                      <p className="text-sm text-gray-400">
                        Total outstanding: ${groupStats.totalOutstanding}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Members Payment Status */}
            <div className="space-y-3">
              {membersData.map((member) => (
                <Card 
                  key={member.clientId}
                  className={`bg-gray-900 border-gray-800 ${member.hasOutstanding ? 'border-l-4 border-l-amber-500' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.user?.profilePhoto} />
                          <AvatarFallback className="bg-gray-800 text-white text-xs">
                            {member.user?.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-white">
                          {member.user?.displayName || 'Unknown'}
                        </p>
                      </div>
                      {member.hasOutstanding ? (
                        <Badge className="bg-amber-500/20 text-amber-400">
                          ${member.outstanding} due
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-500/20 text-sky-400">
                          Paid up
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="bg-gray-800 rounded p-2">
                        <p className="text-gray-400 text-xs">Sessions</p>
                        <p className="text-white font-bold">{member.sessionsCompleted}</p>
                      </div>
                      <div className="bg-gray-800 rounded p-2">
                        <p className="text-gray-400 text-xs">Paid</p>
                        <p className="text-sky-400 font-bold">{member.sessionsPaid}</p>
                      </div>
                      <div className="bg-gray-800 rounded p-2">
                        <p className="text-gray-400 text-xs">Total Paid</p>
                        <p className="text-blue-400 font-bold">${member.totalPaid}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            {(() => {
              const slots: GroupScheduleSlot[] = group.schedule || [];
              const upcoming = nextOccurrences(slots, 6);
              const canAdd = newSlotTime.trim().length > 0 && parseInt(newSlotDuration, 10) > 0;

              const handleAddSlot = () => {
                if (!canAdd) {
                  toast.error('Pick a start time first');
                  return;
                }
                const slot: GroupScheduleSlot = {
                  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  weekday: parseInt(newSlotWeekday, 10),
                  startTime: newSlotTime,
                  durationMin: parseInt(newSlotDuration, 10),
                  label: newSlotLabel.trim() || undefined,
                };
                updateGroupSchedule(groupId, [...slots, slot]);
                setNewSlotTime('');
                setNewSlotLabel('');
                toast.success('Class time added');
              };

              const handleDeleteSlot = (slotId: string) => {
                updateGroupSchedule(groupId, slots.filter((s) => s.id !== slotId));
                toast.success('Class time removed');
              };

              return (
                <div className="space-y-4">
                  {/* Recurring slots list */}
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        Recurring class times
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {slots.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-gray-400">No recurring classes yet</p>
                          <p className="text-sm text-gray-500">
                            Add a weekday + time below to schedule this group.
                          </p>
                        </div>
                      ) : (
                        slots
                          .slice()
                          .sort((a, b) =>
                            a.weekday !== b.weekday
                              ? a.weekday - b.weekday
                              : a.startTime.localeCompare(b.startTime)
                          )
                          .map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between bg-gray-800 rounded p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Badge className="bg-blue-500/20 text-blue-300">
                                  {WEEKDAY_LABELS_LONG[slot.weekday] || '?'}
                                </Badge>
                                <div>
                                  <p className="text-white text-sm font-medium">
                                    {slot.startTime} · {slot.durationMin} min
                                  </p>
                                  {slot.label && (
                                    <p className="text-xs text-gray-400">{slot.label}</p>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-400"
                                onClick={() => handleDeleteSlot(slot.id)}
                                aria-label="Delete class time"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Add slot form */}
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base">Add class time</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-gray-300 text-xs">Weekday</Label>
                          <Select value={newSlotWeekday} onValueChange={setNewSlotWeekday}>
                            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-700 text-white">
                              {WEEKDAY_LABELS_LONG.map((label, idx) => (
                                <SelectItem key={idx} value={String(idx)}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-gray-300 text-xs">Start time</Label>
                          <Input
                            type="time"
                            value={newSlotTime}
                            onChange={(e) => setNewSlotTime(e.target.value)}
                            className="bg-gray-800 border-gray-700 text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-gray-300 text-xs">Duration</Label>
                          <Select value={newSlotDuration} onValueChange={setNewSlotDuration}>
                            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-700 text-white">
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="45">45 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                              <SelectItem value="90">90 min</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-gray-300 text-xs">Label (optional)</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Evening HIIT"
                            value={newSlotLabel}
                            onChange={(e) => setNewSlotLabel(e.target.value)}
                            className="bg-gray-800 border-gray-700 text-white"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleAddSlot}
                        disabled={!canAdd}
                        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add class time
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Upcoming sessions preview */}
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sky-400" />
                        Upcoming sessions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {upcoming.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-2">
                          Add a recurring class time to see upcoming sessions.
                        </p>
                      ) : (
                        upcoming.map(({ date, slot }, idx) => (
                          <div
                            key={`${slot.id}-${idx}`}
                            className="flex items-center justify-between bg-gray-800 rounded p-3"
                          >
                            <div>
                              <p className="text-white text-sm font-medium">
                                {format(date, 'EEE, MMM d')} · {slot.startTime}
                              </p>
                              <p className="text-xs text-gray-400">
                                {slot.label ? `${slot.label} · ` : ''}{slot.durationMin} min
                              </p>
                            </div>
                            <Badge className="bg-gray-700 text-gray-300 text-xs">
                              {WEEKDAY_LABELS[date.getDay()]}
                            </Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </TabsContent>
        </div>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Add Member</DialogTitle>
            <DialogDescription>
              Select a client to add to {group.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search clients..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredAvailableClients.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    {availableClients.length === 0 
                      ? 'All clients are already in this group'
                      : 'No clients match your search'}
                  </p>
                ) : (
                  filteredAvailableClients.map((client) => {
                    const clientUser = getClientUser(client.clientId);
                    return (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          handleAddMember(client.clientId);
                          setShowAddMember(false);
                          setMemberSearchQuery('');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={clientUser?.profilePhoto} />
                            <AvatarFallback className="bg-gray-700 text-white">
                              {clientUser?.displayName?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white">
                            {clientUser?.displayName || clientUser?.username || 'Unknown'}
                          </span>
                        </div>
                        <Plus className="w-5 h-5 text-blue-400" />
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={showEditGroup} onOpenChange={setShowEditGroup}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Group</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Group Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-300">Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Price per Session ($)</Label>
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Color</Label>
                <Input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="bg-gray-800 border-gray-700 h-10 cursor-pointer"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-gray-700"
                onClick={() => setShowEditGroup(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-500 hover:bg-blue-600"
                onClick={handleSaveEdit}
              >
                Save Changes
              </Button>
            </div>
            
            <Button
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={handleDeleteGroup}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => { if (!open) setMemberToRemove(null); }}
        title="Remove Member"
        description={`Remove ${memberToRemoveUser?.displayName || 'this member'} from the group?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (memberToRemove) {
            removeMemberFromGroup(groupId, memberToRemove);
            toast.success('Member removed from group');
            setMemberToRemove(null);
          }
        }}
        icon={<Trash2 className="w-5 h-5 text-red-400" />}
      />

      <ConfirmDialog
        open={showDeleteGroupConfirm}
        onOpenChange={setShowDeleteGroupConfirm}
        title="Delete Group"
        description={`Delete group "${group?.name}"? This cannot be undone.`}
        confirmLabel="Delete Group"
        variant="destructive"
        onConfirm={() => {
          deleteClientGroup(groupId);
          toast.success('Group deleted');
          router.push('/clients');
        }}
        icon={<Trash2 className="w-5 h-5 text-red-400" />}
      />
    </MainLayout>
  );
}
