'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { getEffectiveAutoCount } from '@/lib/stores/trainerStore';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  Plus,
  Pencil,
  Search,
  History
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, parseISO, subMonths } from 'date-fns';
import { getClientDisplayInfo } from '@/lib/clientUtils';
import { toast } from 'sonner';

type PaymentFrequency = 'per_session' | 'weekly' | 'fortnightly' | 'monthly' | 'upfront';
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'other';

interface ClientPaymentSettings {
  clientId: string;
  method: PaymentMethod;
  frequency: PaymentFrequency;
  sessionsPerWeek: number;
  pricePerSession: number;
  totalAmount?: number;
  totalSessions?: number; // For upfront payments
}

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isAuthenticated, updateAutoCountDefault } = useAuthStore();
  const { sessions, payments, clients, sessionPackages, addPayment, deletePayment, updateSessionPackage, addSessionPackage, updateClient, getPackagesForClient, calendarEvents, getEventsForDate } = useTrainerStore();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('clients');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showConfirmPaymentDialog, setShowConfirmPaymentDialog] = useState(false);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState<Record<string, ClientPaymentSettings>>({});
  const [editingSettings, setEditingSettings] = useState<ClientPaymentSettings | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  // Inline edit state for Sessions/Paid boxes
  const [searchQuery, setSearchQuery] = useState('');
  const [editingField, setEditingField] = useState<{ clientId: string; field: 'sessions' | 'paid' } | null>(null);
  const [editValue, setEditValue] = useState('');
  // Confirm payment dialog inputs
  const [confirmPaymentPrice, setConfirmPaymentPrice] = useState('');
  const [confirmPaymentSessions, setConfirmPaymentSessions] = useState('1');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored);
  }, []);

  // Load payment settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('apex-payment-settings');
    if (stored) {
      setPaymentSettings(JSON.parse(stored));
    }
  }, []);

  // Save payment settings to localStorage
  const savePaymentSettings = (settings: Record<string, ClientPaymentSettings>) => {
    setPaymentSettings(settings);
    localStorage.setItem('apex-payment-settings', JSON.stringify(settings));
  };

  // Centralized client info helper
  const getClientInfo = (clientId: string) => {
    const info = getClientDisplayInfo(clientId);
    return { name: info.displayName, photo: info.profilePhoto };
  };


  // Get client payment data — uses stored counters only (no scanning history)
  const getClientPaymentData = (clientId: string) => {
    const settings = paymentSettings[clientId];
    const client = clients.find(c => c.clientId === clientId);
    // Get active package (optional — for display only, NOT source of truth for totals)
    const clientPackages = sessionPackages.filter(p => p.clientId === clientId && p.trainerId === user?.id);
    const activePackage = clientPackages.find(p => p.status === 'active') || clientPackages[0];
    
    // Price per session: user settings > package > default
    const pricePerSession = settings?.pricePerSession || activePackage?.pricePerSession || 0;
    
    // SESSIONS — stored counter. +1 on workout complete, or manual inline edit.
    const totalSessionsEver = client?.totalSessions ?? 0;
    
    // PAID — stored counter. Only changes on explicit user action.
    const totalPaidSessions = client?.totalPaid ?? 0;
    
    const outstandingSessions = Math.max(0, totalSessionsEver - totalPaidSessions);
    const outstandingAmount = outstandingSessions * pricePerSession;
    
    // Payment plan tracking
    const sessionsPerWeek = activePackage?.sessionsPerWeek || settings?.sessionsPerWeek || 1;
    const paymentFrequency = activePackage?.paymentFrequency || settings?.frequency || 'per_session';
    const sessionsPerCycle = activePackage?.sessionsPerPaymentCycle || 
      (paymentFrequency === 'per_session' ? 1 
        : paymentFrequency === 'weekly' ? sessionsPerWeek
        : paymentFrequency === 'fortnightly' ? sessionsPerWeek * 2
        : sessionsPerWeek * 4);
    
    const sessionsSinceLastPayment = outstandingSessions;
    const paymentDue = sessionsSinceLastPayment >= sessionsPerCycle;
    const sessionsUntilPaymentDue = Math.max(0, sessionsPerCycle - sessionsSinceLastPayment);
    const paymentCycleAmount = sessionsPerCycle * pricePerSession;
    
    // Package info for display only (optional — not controlling totals)
    const packageInfo = activePackage ? {
      name: activePackage.name,
      totalSessions: activePackage.totalSessions,
      remainingSessions: activePackage.remainingSessions,
      usedSessions: activePackage.usedSessions,
      priceTotal: activePackage.priceTotal,
      isContinuous: activePackage.isContinuous,
    } : null;
    
    return {
      settings,
      pricePerSession,
      totalSessionsEver,
      totalPaidSessions,
      outstandingSessions,
      outstandingAmount,
      hasOutstanding: outstandingSessions > 0,
      packageInfo,
      sessionsPerWeek,
      paymentFrequency,
      sessionsPerCycle,
      paymentDue,
      sessionsUntilPaymentDue,
      paymentCycleAmount,
      // v14-D1: surface the per-client auto-count toggle on the view-model so
      // the Switch in the JSX can read it without a separate store lookup.
      // The toggle's onCheckedChange handler still re-resolves the raw store
      // record (via `clients.find`) to read the canonical offset for rebucket.
      autoCountSessions: client?.autoCountSessions,
    };
  };

  // Handle confirm payment — fully decoupled from packages
  const handleConfirmPayment = () => {
    if (!selectedClient) return;
    const sessionsToConfirm = Math.max(1, parseInt(confirmPaymentSessions) || 1);
    const pricePerSession = Math.max(0, parseFloat(confirmPaymentPrice) || 0);
    const totalAmount = pricePerSession * sessionsToConfirm;
    
    addPayment({
      clientId: selectedClient,
      trainerId: user?.id || '',
      amount: totalAmount,
      currency: 'NZD',
      type: sessionsToConfirm > 1 ? 'session_pack' : 'single_session',
      sessionsIncluded: sessionsToConfirm,
      status: 'paid',
      method: paymentSettings[selectedClient]?.method || 'cash',
      description: `${sessionsToConfirm} PT Session${sessionsToConfirm > 1 ? 's' : ''} Payment`,
      paidAt: paymentDate + 'T12:00:00.000Z',
    });
    
    // Increment totalPaid directly on client record
    const client = clients.find(c => c.clientId === selectedClient);
    updateClient(selectedClient, { totalPaid: (client?.totalPaid ?? 0) + sessionsToConfirm });
    
    // Save the price per session to settings for next time
    const currentSettings = paymentSettings[selectedClient] || { clientId: selectedClient, method: 'cash' as PaymentMethod, frequency: 'per_session' as PaymentFrequency, sessionsPerWeek: 1, pricePerSession: 0 };
    savePaymentSettings({
      ...paymentSettings,
      [selectedClient]: { ...currentSettings, pricePerSession },
    });
    
    setShowConfirmPaymentDialog(false);
    setSelectedClient(null);
    setConfirmPaymentPrice('');
    setConfirmPaymentSessions('1');
  };

  // Handle log payment from settings dialog
  const handleLogPaymentFromSettings = () => {
    if (!editingSettings) return;
    
    // Save settings first
    const newSettings = {
      ...paymentSettings,
      [editingSettings.clientId]: editingSettings,
    };
    savePaymentSettings(newSettings);
    
    // Calculate total based on frequency
    let sessionsCount: number;
    let periodLabel: string;
    
    if (editingSettings.frequency === 'upfront') {
      // Upfront: pay for ALL sessions in the package at once
      sessionsCount = editingSettings.totalSessions || 10;
      periodLabel = 'upfront';
    } else {
      const frequencyMultiplier = editingSettings.frequency === 'weekly' ? 1 
        : editingSettings.frequency === 'fortnightly' ? 2 
        : editingSettings.frequency === 'monthly' ? 4 
        : 1;
      sessionsCount = (editingSettings.sessionsPerWeek || 1) * frequencyMultiplier;
      periodLabel = editingSettings.frequency === 'weekly' ? 'weekly' 
        : editingSettings.frequency === 'fortnightly' ? 'fortnightly' 
        : editingSettings.frequency === 'monthly' ? 'monthly' 
        : '';
    }
    const totalAmount = editingSettings.pricePerSession * sessionsCount;
    
    // Create payment record
    addPayment({
      clientId: editingSettings.clientId,
      trainerId: user?.id || '',
      amount: totalAmount,
      currency: 'NZD',
      type: sessionsCount > 1 ? 'session_pack' : 'single_session',
      description: `${sessionsCount} session${sessionsCount > 1 ? 's' : ''} ${periodLabel} payment (${editingSettings.method.replace('_', ' ')})`,
      status: 'paid',
      paidAt: new Date().toISOString(),
      method: editingSettings.method,
      sessionsIncluded: sessionsCount,
    });
    
    // Increment totalPaid directly on client record
    const client = clients.find(c => c.clientId === editingSettings.clientId);
    updateClient(editingSettings.clientId, { totalPaid: (client?.totalPaid ?? 0) + sessionsCount });
    
    // Also update package's own internal counter if one exists
    const clientPackages = sessionPackages.filter(p => p.clientId === editingSettings.clientId && p.trainerId === user?.id);
    const activePackage = clientPackages.find(p => p.status === 'active') || clientPackages[0];
    if (activePackage) {
      updateSessionPackage(activePackage.id, {
        paidSessions: (activePackage.paidSessions || 0) + sessionsCount,
      });
    }
    
    setShowSettingsDialog(false);
    setEditingSettings(null);
  };

  // Handle save settings
  const handleSaveSettings = () => {
    if (!editingSettings) return;
    
    const newSettings = {
      ...paymentSettings,
      [editingSettings.clientId]: editingSettings,
    };
    savePaymentSettings(newSettings);
    
    // Also update the session package with payment plan settings
    const clientPackages = sessionPackages.filter(p => p.clientId === editingSettings.clientId && p.trainerId === user?.id);
    const activePackage = clientPackages.find(p => p.status === 'active') || clientPackages[0];
    if (activePackage) {
      // Calculate sessions per payment cycle based on frequency
      const sessionsPerCycle = editingSettings.frequency === 'per_session' ? 1 
        : editingSettings.frequency === 'weekly' ? editingSettings.sessionsPerWeek
        : editingSettings.frequency === 'fortnightly' ? editingSettings.sessionsPerWeek * 2
        : editingSettings.sessionsPerWeek * 4; // monthly
      
      updateSessionPackage(activePackage.id, {
        pricePerSession: editingSettings.pricePerSession,
        sessionsPerWeek: editingSettings.sessionsPerWeek,
        paymentFrequency: editingSettings.frequency,
        sessionsPerPaymentCycle: sessionsPerCycle,
      });
    }
    
    setShowSettingsDialog(false);
    setEditingSettings(null);
  };

  // Handle inline edit save for Sessions/Paid boxes
  const handleInlineEditSave = () => {
    if (!editingField) return;
    const newValue = Math.max(0, parseInt(editValue) || 0);
    if (editingField.field === 'sessions') {
      // Sessions: direct stored value — set exactly what the user typed
      updateClient(editingField.clientId, { totalSessions: newValue });
    } else {
      // Paid: direct stored value — set exactly what the user typed
      updateClient(editingField.clientId, { totalPaid: newValue });
    }
    setEditingField(null);
    setEditValue('');
  };

  // Handle switching a client to continuous (remove active package)
  const handleSetContinuous = (clientId: string) => {
    const clientPackages = sessionPackages.filter(p => p.clientId === clientId && p.trainerId === user?.id && p.status === 'active');
    // Archive any active packages
    clientPackages.forEach(pkg => {
      updateSessionPackage(pkg.id, { status: 'completed' });
    });
    // Totals are now derived from session/payment records — no initialization needed
  };

  // Open settings dialog for a client
  const openSettingsDialog = (clientId: string) => {
    const existing = paymentSettings[clientId];
    const pkg = sessionPackages.find(p => p.clientId === clientId && p.status === 'active');
    
    setEditingSettings({
      clientId,
      method: existing?.method || 'bank_transfer',
      frequency: existing?.frequency || 'weekly',
      sessionsPerWeek: existing?.sessionsPerWeek || 1,
      pricePerSession: existing?.pricePerSession || pkg?.pricePerSession || 80,
      totalAmount: existing?.totalAmount,
      totalSessions: existing?.totalSessions || pkg?.totalSessions || 10,
    });
    setShowSettingsDialog(true);
  };

  // Get unique client IDs from sessions and clients list
  const trainerClients = useMemo(() => {
    const clientIds = new Set<string>();
    
    // Add from clients list
    clients.forEach(c => {
      if (c.trainerId === user?.id) {
        clientIds.add(c.clientId);
      }
    });
    
    // Add from sessions
    sessions.forEach(s => {
      if (s.trainerId === user?.id && s.clientId) {
        clientIds.add(s.clientId);
      }
    });
    
    return Array.from(clientIds);
  }, [clients, sessions, user?.id]);

  // Sort clients by outstanding balance
  const sortedClients = useMemo(() => {
    return trainerClients
      .map(clientId => ({
        clientId,
        ...getClientPaymentData(clientId),
        info: getClientInfo(clientId),
      }))
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerClients, paymentSettings, sessions, payments, sessionPackages, clients, allUsers]);

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return sortedClients;
    const q = searchQuery.toLowerCase();
    return sortedClients.filter(c => c.info.name.toLowerCase().includes(q));
  }, [sortedClients, searchQuery]);

  // Calculate totals
  const totalOutstanding = sortedClients.reduce((sum, c) => sum + c.outstandingAmount, 0);
  const totalThisMonth = 0; // Monthly stats removed — counters are stored values only
  const clientsWithOutstanding = sortedClients.filter(c => c.hasOutstanding).length;

  if (!isAuthenticated || !user) return null;

  return (
    <MainLayout>
      <PageHeader 
        title="Payments" 
        subtitle="Manage client payments and track earnings"
      />

      <div className="px-4 pb-24">
        {/* v14-D10: master auto-count toggle. Sets the trainer's default for all clients
            without a per-client override. Per-client tristate below each client card can
            force ON/OFF or follow this default. Server-side bulk rebucket via the AFTER
            trigger on users preserves visible total_sessions for every "follow default" row. */}
        <Card className="bg-white border-gray-200 shadow-sm mb-4">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-sky-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Auto-count sessions by default</p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.autoCountSessionsDefault !== false
                    ? 'Completed calendar sessions automatically tick each client’s total. Override per client below.'
                    : 'Calendar sessions do NOT auto-tick. Use the +1 button on each client card to count manually.'}
                </p>
              </div>
            </div>
            <Switch
              checked={user?.autoCountSessionsDefault !== false}
              onCheckedChange={async (checked) => {
                if (!user) return;
                // Trigger the bulk rebucket on the server. UI rebucket per row is unnecessary
                // because the server returns updated trainer_clients on the next fetch; the
                // master toggle's visible effect is "all 'follow default' cards' counters
                // stay where they were" — no per-row UI tweaking needed.
                await updateAutoCountDefault(checked);
                toast.success(
                  checked
                    ? 'Auto-count default ON. Calendar sessions will tick each client’s total (unless they have a per-client override).'
                    : 'Auto-count default OFF. Use the +1 button per client to count manually (unless they have a per-client override).',
                  { duration: 4000 }
                );
                // Refresh the trainer-clients fetch so the per-client tristates reflect the
                // server-rebucket state without a hard refresh.
                // Note: we'll use the existing client-reload pattern from the component
              }}
              aria-label="Auto-count sessions by default"
            />
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Outstanding</p>
              <p className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                ${totalOutstanding}
              </p>
              <p className="text-xs text-gray-500">{clientsWithOutstanding} clients</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">This Month</p>
              <p className="text-xl font-bold text-blue-400">${totalThisMonth}</p>
              <p className="text-xs text-gray-500">this month</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Clients</p>
              <p className="text-xl font-bold text-purple-400">{trainerClients.length}</p>
              <p className="text-xs text-gray-500">active</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 mb-4">
            <TabsTrigger value="clients" className="data-[state=active]:bg-sky-500">
              <Users className="w-4 h-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-sky-500">
              <Clock className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {filteredClients.length === 0 ? (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="py-8 text-center">
                  <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">{searchQuery ? 'No matching clients' : 'No clients yet'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredClients.map((client) => (
                  <Card 
                    key={client.clientId}
                    className={`bg-white border-gray-200 shadow-sm ${client.hasOutstanding ? 'border-l-4 border-l-amber-500' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={client.info.photo} />
                            <AvatarFallback className="bg-gray-100 text-gray-900">
                              {client.info.name[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <button className="font-medium text-gray-900 hover:text-sky-400 transition-colors text-left" onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.clientId}`); }}>{client.info.name}</button>
                            <p className="text-xs text-gray-500">
                              ${client.pricePerSession}/session • {client.settings?.frequency?.replace('_', ' ') || 'per session'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-gray-400 hover:text-emerald-400 gap-1 px-2"
                          onClick={() => openSettingsDialog(client.clientId)}
                        >
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs">Log Payment</span>
                        </Button>
                      </div>
                      
                      {/* Stats Row — editable Sessions & Paid */}
                      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        {/* Sessions — editable */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 relative group">
                          <p className="text-xs text-gray-500">Sessions</p>
                          {editingField?.clientId === client.clientId && editingField.field === 'sessions' ? (
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                              <input
                                type="number"
                                min={0}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleInlineEditSave(); if (e.key === 'Escape') setEditingField(null); }}
                                autoFocus
                                className="w-14 text-center font-bold text-gray-900 bg-white border border-sky-500 rounded px-1 py-0.5 text-sm"
                              />
                              <button onClick={handleInlineEditSave} className="text-sky-400 hover:text-sky-300"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingField(null)} className="text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <p className="font-bold text-gray-900">{client.totalSessionsEver}</p>
                              <button
                                onClick={() => { setEditingField({ clientId: client.clientId, field: 'sessions' }); setEditValue(String(client.totalSessionsEver)); }}
                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-sky-400 transition-opacity"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Paid — editable */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 relative group">
                          <p className="text-xs text-gray-500">Paid</p>
                          {editingField?.clientId === client.clientId && editingField.field === 'paid' ? (
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                              <input
                                type="number"
                                min={0}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleInlineEditSave(); if (e.key === 'Escape') setEditingField(null); }}
                                autoFocus
                                className="w-14 text-center font-bold text-sky-400 bg-gray-700 border border-sky-500 rounded px-1 py-0.5 text-sm"
                              />
                              <button onClick={handleInlineEditSave} className="text-sky-400 hover:text-sky-300"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingField(null)} className="text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <p className="font-bold text-sky-400">{client.totalPaidSessions}</p>
                              <button
                                onClick={() => { setEditingField({ clientId: client.clientId, field: 'paid' }); setEditValue(String(client.totalPaidSessions)); }}
                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-sky-400 transition-opacity"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Outstanding — derived, not editable */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                          <p className="text-xs text-gray-500">Outstanding</p>
                          <p className={`font-bold ${client.outstandingSessions > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                            {client.outstandingSessions}
                          </p>
                        </div>
                      </div>

                      {/* v14-D10: Per-client auto-count tristate (left) and workout-history
                          link (right). When effective auto is OFF, surface a manual "+1 session"
                          button between them — writes via historicalSessionsOffset so the
                          increment survives any future recompute. */}
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <Select
                          value={
                            client.autoCountSessions === true ? 'on' :
                            client.autoCountSessions === false ? 'off' :
                            'default'
                          }
                          onValueChange={(value) => {
                            const targetClient = clients.find(c => c.clientId === client.clientId);
                            if (!targetClient) return;
                            // Map the new selection to autoCountSessions value.
                            const newAutoCount: boolean | null =
                              value === 'on' ? true :
                              value === 'off' ? false :
                              null; // 'default'

                            // Compute effective old + new for visible-total preservation.
                            const trainerDefault = user?.autoCountSessionsDefault !== false;
                            const oldEffective = getEffectiveAutoCount(targetClient.autoCountSessions, trainerDefault);
                            const newEffective = getEffectiveAutoCount(newAutoCount, trainerDefault);

                            // Optimistic local rebucket (same math as v14-D1 + the server BEFORE trigger).
                            const oldOffset = targetClient.historicalSessionsOffset ?? 0;
                            const oldTotal = targetClient.totalSessions ?? 0;
                            const calendarCount = Math.max(0, oldTotal - oldOffset);
                            let newOffset = oldOffset;
                            if (oldEffective === true && newEffective === false) {
                              newOffset = oldOffset + calendarCount;
                            } else if (oldEffective === false && newEffective === true) {
                              newOffset = Math.max(0, oldOffset - calendarCount);
                            }
                            const newTotal = newEffective ? newOffset + calendarCount : newOffset;

                            updateClient(client.clientId, {
                              autoCountSessions: newAutoCount,
                              historicalSessionsOffset: newOffset,
                              totalSessions: newTotal,
                            });

                            const labelMap: Record<string, string> = {
                              on: `${client.info.name}: sessions will ALWAYS count.`,
                              off: `${client.info.name}: sessions will NEVER auto-count. Use the +1 button to count manually.`,
                              default: `${client.info.name} now follows the trainer default (currently ${trainerDefault ? 'ON' : 'OFF'}).`,
                            };
                            toast.success(labelMap[value], { duration: 3500 });
                          }}
                        >
                          <SelectTrigger className="w-auto h-8 bg-white border-gray-200 text-xs text-gray-700" aria-label="Auto-count override">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              Follow trainer default — currently {user?.autoCountSessionsDefault !== false ? 'ON' : 'OFF'}
                            </SelectItem>
                            <SelectItem value="on">Always count</SelectItem>
                            <SelectItem value="off">Never count</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1">
                          {(() => {
                            const trainerDefault = user?.autoCountSessionsDefault !== false;
                            const effective = getEffectiveAutoCount(client.autoCountSessions, trainerDefault);
                            return effective === false;
                          })() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const targetClient = clients.find(c => c.clientId === client.clientId);
                                if (!targetClient) return;
                                const newOffset = (targetClient.historicalSessionsOffset ?? 0) + 1;
                                const newTotal = (targetClient.totalSessions ?? 0) + 1;
                                updateClient(client.clientId, {
                                  historicalSessionsOffset: newOffset,
                                  totalSessions: newTotal,
                                });
                                toast.success(
                                  `+1 session counted for ${client.info.name} (lifetime: ${newTotal}).`,
                                  { duration: 3500 }
                                );
                              }}
                              className="h-8 text-gray-500 hover:text-sky-600 gap-1 px-2 text-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              +1 session
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/workout/history?clientId=${client.clientId}`)}
                            className="h-8 text-gray-500 hover:text-sky-600 gap-1 px-2 text-xs"
                          >
                            <History className="w-3.5 h-3.5" />
                            View workout history
                          </Button>
                        </div>
                      </div>

                      {/* Package info line (optional — display only) */}
                      {client.packageInfo && !client.packageInfo.isContinuous && client.packageInfo.totalSessions > 0 && (
                        <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 mb-3 text-xs">
                          <span className="text-gray-500">
                            Package: {client.packageInfo.usedSessions || 0}/{client.packageInfo.totalSessions} used
                            {client.packageInfo.remainingSessions > 0 && (
                              <span className="text-blue-400 ml-1">({client.packageInfo.remainingSessions} left)</span>
                            )}
                          </span>
                        </div>
                      )}
                      
                      {/* Payment Plan Status */}
                      {client.paymentFrequency !== 'per_session' && (
                        <div className={`flex items-center justify-between rounded-lg p-2 mb-2 ${
                          client.paymentDue ? 'bg-red-500/10' : 'bg-gray-50 border border-gray-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${client.paymentDue ? 'text-red-400' : 'text-gray-400'}`} />
                            <span className={`text-xs ${client.paymentDue ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                              {client.paymentDue 
                                ? `Payment due! (${client.sessionsPerCycle} sessions @ $${client.paymentCycleAmount})`
                                : `${client.sessionsUntilPaymentDue} session${client.sessionsUntilPaymentDue !== 1 ? 's' : ''} until payment due`
                              }
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {client.paymentFrequency === 'weekly' ? 'Weekly' : client.paymentFrequency === 'fortnightly' ? 'Fortnightly' : 'Monthly'}
                          </span>
                        </div>
                      )}
                      
                      {/* Outstanding Alert & Confirm Button */}
                      {client.paymentDue && (
                        <div className="flex items-center justify-between bg-amber-500/10 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-sm text-amber-400">
                              ${client.outstandingAmount} outstanding ({client.outstandingSessions} session{client.outstandingSessions > 1 ? 's' : ''})
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="bg-sky-500 hover:bg-sky-600 h-8"
                            onClick={() => {
                              const data = getClientPaymentData(client.clientId);
                              setSelectedClient(client.clientId);
                              setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
                              setConfirmPaymentPrice(String(data.pricePerSession || ''));
                              setConfirmPaymentSessions(String(data.outstandingSessions || 1));
                              setShowConfirmPaymentDialog(true);
                            }}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Confirm
                          </Button>
                        </div>
                      )}
                      
                      {!client.hasOutstanding && client.totalSessionsEver > 0 && (
                        <div className="flex items-center justify-center gap-2 bg-sky-500/10 rounded-lg p-3">
                          <CheckCircle2 className="w-4 h-4 text-sky-400" />
                          <span className="text-sm text-sky-400">All payments up to date</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {payments.filter(p => p.trainerId === user?.id).length === 0 ? (
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="py-8 text-center">
                  <DollarSign className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No payment history yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {payments
                  .filter(p => p.trainerId === user?.id)
                  .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
                  .slice(0, 50)
                  .map((payment) => {
                    const clientInfo = getClientInfo(payment.clientId);
                    return (
                      <Card key={payment.id} className="bg-white border-gray-200 shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={clientInfo.photo} />
                                <AvatarFallback className="bg-gray-100 text-gray-900 text-xs">
                                  {clientInfo.name[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <button className="font-medium text-gray-900 text-sm hover:text-sky-400 transition-colors text-left" onClick={() => router.push(`/clients/${payment.clientId}`)}>{clientInfo.name}</button>
                                <p className="text-xs text-gray-500">
                                  {(payment.paidAt || payment.createdAt) ? format(parseISO(payment.paidAt || payment.createdAt), 'MMM d, yyyy') : 'No date'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="font-bold text-sky-400">${payment.amount}</p>
                                <p className="text-xs text-gray-500">
                                  {payment.sessionsIncluded ? `${payment.sessionsIncluded} sessions` : payment.method?.replace('_', ' ')}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-sky-400 hover:bg-sky-500/10"
                                onClick={() => openSettingsDialog(payment.clientId)}
                                title="Edit package settings"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                onClick={() => setPaymentToDelete(payment)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Payment Settings</DialogTitle>
            <DialogDescription className="text-gray-500">
              Configure payment details for {editingSettings ? getClientInfo(editingSettings.clientId).name : 'client'}
            </DialogDescription>
          </DialogHeader>
          
          {editingSettings && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-gray-600">Payment Method</Label>
                <Select 
                  value={editingSettings.method} 
                  onValueChange={(v) => setEditingSettings({...editingSettings, method: v as PaymentMethod})}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-gray-600">Payment Frequency</Label>
                <Select 
                  value={editingSettings.frequency} 
                  onValueChange={(v) => setEditingSettings({...editingSettings, frequency: v as PaymentFrequency})}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="per_session">Per Session</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="upfront">Upfront (Full Package)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {editingSettings.frequency === 'upfront' ? (
                <div>
                  <Label className="text-gray-600">Total Sessions in Package</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editingSettings.totalSessions || 10}
                    onChange={(e) => setEditingSettings({...editingSettings, totalSessions: parseInt(e.target.value) || 1})}
                    className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-gray-600">Sessions Per Week</Label>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={editingSettings.sessionsPerWeek}
                    onChange={(e) => setEditingSettings({...editingSettings, sessionsPerWeek: parseInt(e.target.value) || 1})}
                    className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                  />
                </div>
              )}
              
              <div>
                <Label className="text-gray-600">Price Per Session ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingSettings.pricePerSession}
                  onChange={(e) => setEditingSettings({...editingSettings, pricePerSession: parseFloat(e.target.value) || 0})}
                  className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                />
              </div>
              
              {editingSettings.frequency !== 'per_session' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-500">
                    {editingSettings.frequency === 'upfront' 
                      ? 'Total package price:'
                      : `Total per ${editingSettings.frequency === 'weekly' ? 'week' : editingSettings.frequency === 'fortnightly' ? 'fortnight' : 'month'}:`
                    }
                  </p>
                  <p className="text-xl font-bold text-sky-400">
                    ${editingSettings.frequency === 'upfront'
                      ? editingSettings.pricePerSession * (editingSettings.totalSessions || 10)
                      : editingSettings.pricePerSession * editingSettings.sessionsPerWeek * 
                        (editingSettings.frequency === 'weekly' ? 1 : editingSettings.frequency === 'fortnightly' ? 2 : 4)
                    }
                  </p>
                </div>
              )}
              
              {/* Package actions */}
              {(() => {
                const hasActivePackage = sessionPackages.some(p => p.clientId === editingSettings.clientId && p.trainerId === user?.id && p.status === 'active');
                return (
                  <div className="space-y-2">
                    {/* Start New Package — always available */}
                    <button
                      onClick={() => {
                        // Archive any existing active packages first
                        sessionPackages
                          .filter(p => p.clientId === editingSettings.clientId && p.trainerId === user?.id && p.status === 'active')
                          .forEach(pkg => updateSessionPackage(pkg.id, { status: 'completed' }));
                        // Create new package with current settings
                        addSessionPackage({
                          trainerId: user!.id,
                          clientId: editingSettings.clientId,
                          name: `Package — ${editingSettings.totalSessions || 10} sessions`,
                          totalSessions: editingSettings.totalSessions || 10,
                          paidSessions: 0,
                          priceTotal: (editingSettings.pricePerSession || 80) * (editingSettings.totalSessions || 10),
                          pricePerSession: editingSettings.pricePerSession || 80,
                          purchaseDate: new Date().toISOString(),
                          paymentId: '',
                          status: 'active',
                          sessionsPerWeek: editingSettings.sessionsPerWeek || 1,
                          paymentFrequency: editingSettings.frequency || 'weekly',
                        });
                        toast.success('New package started');
                        setShowSettingsDialog(false);
                        setEditingSettings(null);
                      }}
                      className="w-full text-left p-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 transition-colors border border-sky-500/30"
                    >
                      <p className="text-sm text-sky-400 font-medium">{hasActivePackage ? 'Reset & Start New Package' : 'Start New Package'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {hasActivePackage 
                          ? 'Archive current package and start fresh with these settings'
                          : `Create a ${editingSettings.totalSessions || 10}-session package at $${editingSettings.pricePerSession || 80}/session`
                        }
                      </p>
                    </button>

                    {/* Switch to Continuous (only if package exists) */}
                    {hasActivePackage && (
                      <button
                        onClick={() => {
                          handleSetContinuous(editingSettings.clientId);
                          setShowSettingsDialog(false);
                          setEditingSettings(null);
                        }}
                        className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        <p className="text-sm text-gray-900 font-medium">Switch to Continuous</p>
                        <p className="text-xs text-gray-500 mt-0.5">Remove package limit — just track total sessions & payments</p>
                      </button>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full bg-sky-500 hover:bg-sky-600"
                  onClick={handleLogPaymentFromSettings}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  {editingSettings.frequency === 'upfront' 
                    ? `Log Payment ($${editingSettings.pricePerSession * (editingSettings.totalSessions || 10)} for ${editingSettings.totalSessions || 10} sessions)`
                    : `Log Payment ($${editingSettings.pricePerSession * (editingSettings.sessionsPerWeek || 1) * (editingSettings.frequency === 'weekly' ? 1 : editingSettings.frequency === 'fortnightly' ? 2 : 4)} for ${(editingSettings.sessionsPerWeek || 1) * (editingSettings.frequency === 'weekly' ? 1 : editingSettings.frequency === 'fortnightly' ? 2 : 4)} sessions)`
                  }
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-200 text-gray-500"
                    onClick={() => setShowSettingsDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-200 text-gray-500"
                    onClick={handleSaveSettings}
                  >
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={showConfirmPaymentDialog} onOpenChange={setShowConfirmPaymentDialog}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Confirm Payment</DialogTitle>
            <DialogDescription className="text-gray-500">
              Record payment for {selectedClient ? getClientInfo(selectedClient).name : 'client'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-4 mt-4">
              {(() => {
                const data = getClientPaymentData(selectedClient);
                const sessionsNum = Math.max(1, parseInt(confirmPaymentSessions) || 1);
                const priceNum = Math.max(0, parseFloat(confirmPaymentPrice) || 0);
                const totalAmount = sessionsNum * priceNum;
                return (
                  <>
                    {data.outstandingSessions > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-400">
                        {data.outstandingSessions} outstanding session{data.outstandingSessions > 1 ? 's' : ''}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-600">Price Per Session ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={confirmPaymentPrice}
                          onChange={(e) => setConfirmPaymentPrice(e.target.value)}
                          placeholder="0"
                          className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-600">Sessions Paid For</Label>
                        <Input
                          type="number"
                          min="1"
                          value={confirmPaymentSessions}
                          onChange={(e) => setConfirmPaymentSessions(e.target.value)}
                          placeholder="1"
                          className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-gray-600">Payment Date</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 mt-1"
                      />
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Payment</span>
                        <span className="font-bold text-gray-900 text-lg">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="ghost"
                        className="flex-1 text-gray-400"
                        onClick={() => setShowConfirmPaymentDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-sky-500 hover:bg-sky-600"
                        onClick={handleConfirmPayment}
                        disabled={priceNum <= 0}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Confirm ${totalAmount.toFixed(2)}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!paymentToDelete}
        onOpenChange={(open) => { if (!open) setPaymentToDelete(null); }}
        title="Delete Payment"
        description={`Delete this payment? (${paymentToDelete?.sessionsIncluded || 1} session${(paymentToDelete?.sessionsIncluded || 1) > 1 ? 's' : ''} will be removed from paid count)`}
        confirmLabel="Delete Payment"
        variant="destructive"
        onConfirm={() => {
          if (paymentToDelete) {
            const sessionsToRemove = paymentToDelete.sessionsIncluded || 1;
            // Decrement totalPaid stored counter on client record
            const client = clients.find(c => c.clientId === paymentToDelete.clientId);
            if (client) {
              updateClient(paymentToDelete.clientId, { totalPaid: Math.max(0, (client.totalPaid ?? 0) - sessionsToRemove) });
            }
            // Also update package's internal counter if exists
            const clientPackages = sessionPackages.filter(p => p.clientId === paymentToDelete.clientId && p.trainerId === user?.id);
            const activePackage = clientPackages.find(p => p.status === 'active') || clientPackages[0];
            if (activePackage && (activePackage.paidSessions || 0) > 0) {
              updateSessionPackage(activePackage.id, {
                paidSessions: Math.max(0, (activePackage.paidSessions || 0) - sessionsToRemove),
              });
            }
            deletePayment(paymentToDelete.id);
            setPaymentToDelete(null);
          }
        }}
        icon={<X className="w-5 h-5 text-red-400" />}
      />
    </MainLayout>
  );
}
