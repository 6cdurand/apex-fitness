'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  AlertTriangle,
  Settings,
  Check,
  X,
  Plus
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, parseISO, subMonths } from 'date-fns';

type PaymentFrequency = 'per_session' | 'weekly' | 'fortnightly' | 'monthly';
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'other';

interface ClientPaymentSettings {
  clientId: string;
  method: PaymentMethod;
  frequency: PaymentFrequency;
  sessionsPerWeek: number;
  pricePerSession: number;
  totalAmount?: number;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { sessions, payments, clients, sessionPackages, addPayment, getPackagesForClient, calendarEvents, getEventsForDate } = useTrainerStore();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('clients');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showConfirmPaymentDialog, setShowConfirmPaymentDialog] = useState(false);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState<Record<string, ClientPaymentSettings>>({});
  const [editingSettings, setEditingSettings] = useState<ClientPaymentSettings | null>(null);

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

  // Get client info helper
  const getClientInfo = (clientId: string) => {
    const clientUser = allUsers.find(u => u.id === clientId);
    return {
      name: clientUser?.displayName || clientUser?.username || 'Client',
      photo: clientUser?.profilePhoto,
    };
  };

  // Calculate sessions in date range
  const getSessionsInRange = (clientId: string, startDate: Date, endDate: Date) => {
    return sessions.filter(s => 
      s.clientId === clientId && 
      s.trainerId === user?.id &&
      s.status === 'completed' &&
      parseISO(s.date) >= startDate && 
      parseISO(s.date) <= endDate
    );
  };

  // Calculate payments in date range
  const getPaymentsInRange = (clientId: string, startDate: Date, endDate: Date) => {
    return payments.filter(p => 
      p.clientId === clientId && 
      p.trainerId === user?.id &&
      p.paidAt &&
      parseISO(p.paidAt) >= startDate && 
      parseISO(p.paidAt) <= endDate
    );
  };

  // Get client payment data with outstanding balance calculation
  const getClientPaymentData = (clientId: string) => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    
    const settings = paymentSettings[clientId];
    const pkg = sessionPackages.find(p => p.clientId === clientId);
    const pricePerSession = settings?.pricePerSession || pkg?.pricePerSession || 0;
    
    // Sessions this month
    const monthSessions = getSessionsInRange(clientId, monthStart, monthEnd);
    const totalSessionsThisMonth = monthSessions.length;
    
    // All completed sessions ever
    const allCompletedSessions = sessions.filter(s => 
      s.clientId === clientId && 
      s.trainerId === user?.id &&
      s.status === 'completed'
    );
    
    // All payments ever
    const allPayments = payments.filter(p => 
      p.clientId === clientId && 
      p.trainerId === user?.id
    );
    
    const totalSessionsEver = allCompletedSessions.length;
    const totalPaidSessions = allPayments.length;
    const outstandingSessions = totalSessionsEver - totalPaidSessions;
    const outstandingAmount = outstandingSessions * pricePerSession;
    
    return {
      settings,
      pricePerSession,
      totalSessionsThisMonth,
      totalSessionsEver,
      totalPaidSessions,
      outstandingSessions,
      outstandingAmount,
      hasOutstanding: outstandingSessions > 0,
    };
  };

  // Handle confirm payment
  const handleConfirmPayment = (clientId: string, sessionsToConfirm: number = 1) => {
    const data = getClientPaymentData(clientId);
    
    for (let i = 0; i < sessionsToConfirm; i++) {
      addPayment({
        clientId,
        trainerId: user?.id || '',
        amount: data.pricePerSession,
        currency: 'NZD',
        type: 'single_session',
        status: 'paid',
        method: data.settings?.method || 'cash',
        description: `PT Session Payment`,
        paidAt: paymentDate + 'T12:00:00.000Z',
      });
    }
    
    setShowConfirmPaymentDialog(false);
    setSelectedClient(null);
  };

  // Handle save settings
  const handleSaveSettings = () => {
    if (!editingSettings) return;
    
    const newSettings = {
      ...paymentSettings,
      [editingSettings.clientId]: editingSettings,
    };
    savePaymentSettings(newSettings);
    setShowSettingsDialog(false);
    setEditingSettings(null);
  };

  // Open settings dialog for a client
  const openSettingsDialog = (clientId: string) => {
    const existing = paymentSettings[clientId];
    const pkg = sessionPackages.find(p => p.clientId === clientId);
    
    setEditingSettings({
      clientId,
      method: existing?.method || 'bank_transfer',
      frequency: existing?.frequency || 'weekly',
      sessionsPerWeek: existing?.sessionsPerWeek || 1,
      pricePerSession: existing?.pricePerSession || pkg?.pricePerSession || 80,
      totalAmount: existing?.totalAmount,
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
  }, [trainerClients, paymentSettings, sessions, payments]);

  // Calculate totals
  const totalOutstanding = sortedClients.reduce((sum, c) => sum + c.outstandingAmount, 0);
  const totalThisMonth = sortedClients.reduce((sum, c) => sum + (c.totalSessionsThisMonth * c.pricePerSession), 0);
  const clientsWithOutstanding = sortedClients.filter(c => c.hasOutstanding).length;

  if (!isAuthenticated || !user) return null;

  return (
    <MainLayout>
      <PageHeader 
        title="Payments" 
        subtitle="Manage client payments and track earnings"
      />

      <div className="px-4 pb-24">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Outstanding</p>
              <p className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                ${totalOutstanding}
              </p>
              <p className="text-xs text-gray-500">{clientsWithOutstanding} clients</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">This Month</p>
              <p className="text-xl font-bold text-blue-400">${totalThisMonth}</p>
              <p className="text-xs text-gray-500">{sortedClients.reduce((sum, c) => sum + c.totalSessionsThisMonth, 0)} sessions</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Clients</p>
              <p className="text-xl font-bold text-purple-400">{trainerClients.length}</p>
              <p className="text-xs text-gray-500">active</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-900 mb-4">
            <TabsTrigger value="clients" className="data-[state=active]:bg-emerald-500">
              <Users className="w-4 h-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-emerald-500">
              <Clock className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients">
            {sortedClients.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-8 text-center">
                  <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400">No clients yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sortedClients.map((client) => (
                  <Card 
                    key={client.clientId}
                    className={`bg-gray-900 border-gray-800 ${client.hasOutstanding ? 'border-l-4 border-l-amber-500' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={client.info.photo} />
                            <AvatarFallback className="bg-gray-800 text-white">
                              {client.info.name[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-white">{client.info.name}</p>
                            <p className="text-xs text-gray-400">
                              ${client.pricePerSession}/session • {client.settings?.frequency?.replace('_', ' ') || 'per session'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() => openSettingsDialog(client.clientId)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div className="bg-gray-800 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Sessions</p>
                          <p className="font-bold text-white">{client.totalSessionsEver}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Paid</p>
                          <p className="font-bold text-emerald-400">{client.totalPaidSessions}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Outstanding</p>
                          <p className={`font-bold ${client.outstandingSessions > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                            {client.outstandingSessions}
                          </p>
                        </div>
                      </div>
                      
                      {/* Outstanding Alert & Confirm Button */}
                      {client.hasOutstanding && (
                        <div className="flex items-center justify-between bg-amber-500/10 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-sm text-amber-400">
                              ${client.outstandingAmount} outstanding ({client.outstandingSessions} session{client.outstandingSessions > 1 ? 's' : ''})
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 h-8"
                            onClick={() => {
                              setSelectedClient(client.clientId);
                              setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
                              setShowConfirmPaymentDialog(true);
                            }}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Confirm
                          </Button>
                        </div>
                      )}
                      
                      {!client.hasOutstanding && client.totalSessionsEver > 0 && (
                        <div className="flex items-center justify-center gap-2 bg-emerald-500/10 rounded-lg p-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400">All payments up to date</span>
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
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-8 text-center">
                  <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400">No payment history yet</p>
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
                      <Card key={payment.id} className="bg-gray-900 border-gray-800">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={clientInfo.photo} />
                                <AvatarFallback className="bg-gray-800 text-white text-xs">
                                  {clientInfo.name[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-white text-sm">{clientInfo.name}</p>
                                <p className="text-xs text-gray-400">
                                  {payment.paidAt ? format(parseISO(payment.paidAt), 'MMM d, yyyy') : 'No date'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-400">${payment.amount}</p>
                              <p className="text-xs text-gray-500 capitalize">{payment.method?.replace('_', ' ')}</p>
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
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Payment Settings</DialogTitle>
            <DialogDescription className="text-gray-400">
              Configure payment details for {editingSettings ? getClientInfo(editingSettings.clientId).name : 'client'}
            </DialogDescription>
          </DialogHeader>
          
          {editingSettings && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-gray-300">Payment Method</Label>
                <Select 
                  value={editingSettings.method} 
                  onValueChange={(v) => setEditingSettings({...editingSettings, method: v as PaymentMethod})}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-gray-300">Payment Frequency</Label>
                <Select 
                  value={editingSettings.frequency} 
                  onValueChange={(v) => setEditingSettings({...editingSettings, frequency: v as PaymentFrequency})}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="per_session">Per Session</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-gray-300">Sessions Per Week</Label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={editingSettings.sessionsPerWeek}
                  onChange={(e) => setEditingSettings({...editingSettings, sessionsPerWeek: parseInt(e.target.value) || 1})}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                />
              </div>
              
              <div>
                <Label className="text-gray-300">Price Per Session ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingSettings.pricePerSession}
                  onChange={(e) => setEditingSettings({...editingSettings, pricePerSession: parseFloat(e.target.value) || 0})}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                />
              </div>
              
              {editingSettings.frequency !== 'per_session' && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-sm text-gray-400">
                    Total per {editingSettings.frequency === 'weekly' ? 'week' : editingSettings.frequency === 'fortnightly' ? 'fortnight' : 'month'}:
                  </p>
                  <p className="text-xl font-bold text-emerald-400">
                    ${editingSettings.pricePerSession * editingSettings.sessionsPerWeek * 
                      (editingSettings.frequency === 'weekly' ? 1 : editingSettings.frequency === 'fortnightly' ? 2 : 4)}
                  </p>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300"
                  onClick={() => setShowSettingsDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                  onClick={handleSaveSettings}
                >
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={showConfirmPaymentDialog} onOpenChange={setShowConfirmPaymentDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription className="text-gray-400">
              Record payment for {selectedClient ? getClientInfo(selectedClient).name : 'client'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-4 mt-4">
              {(() => {
                const data = getClientPaymentData(selectedClient);
                return (
                  <>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-400">Outstanding Sessions</span>
                        <span className="font-bold text-amber-400">{data.outstandingSessions}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-400">Price Per Session</span>
                        <span className="font-bold text-white">${data.pricePerSession}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-700">
                        <span className="text-gray-400">Total Outstanding</span>
                        <span className="font-bold text-amber-400">${data.outstandingAmount}</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-gray-300">Payment Date</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white mt-1"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        className="w-full bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => handleConfirmPayment(selectedClient, 1)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Confirm 1 Session (${data.pricePerSession})
                      </Button>
                      
                      {data.outstandingSessions > 1 && (
                        <Button
                          variant="outline"
                          className="w-full border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => handleConfirmPayment(selectedClient, data.outstandingSessions)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Confirm All ({data.outstandingSessions} sessions - ${data.outstandingAmount})
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        className="w-full text-gray-400"
                        onClick={() => setShowConfirmPaymentDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
