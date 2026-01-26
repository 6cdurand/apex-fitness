'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { useMessageStore } from '@/lib/messageStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, MessageCircle, ArrowLeft, Dumbbell, TrendingUp, Clock, Target, History, DollarSign, Edit2, Package, Check, X } from 'lucide-react';
import { getClientExerciseHistory } from '@/lib/supabaseSync';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, differenceInWeeks } from 'date-fns';
import { VolumeChart, MuscleProgressChart } from '@/components/charts/VolumeChart';
import { toast } from 'sonner';

export default function TrainerClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const { user, isAuthenticated } = useAuthStore();
  const { 
    clients, 
    calendarEvents, 
    sessions, 
    payments, 
    sessionPackages,
    updateSession,
    updateSessionPackage,
    addPayment,
    addSession,
    addSessionPackage,
    getSessionsForClient,
    getPackagesForClient,
    markSessionComplete,
    markSessionNoShow,
    toggleSessionPaid,
  } = useTrainerStore();
  const { getOrCreateConversation } = useMessageStore();

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [clientUser, setClientUser] = useState<any>(null);
  const [clientWorkouts, setClientWorkouts] = useState<any[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  
  // Edit states
  const [showEditPackage, setShowEditPackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [packageForm, setPackageForm] = useState({
    totalSessions: 0,
    usedSessions: 0,
    priceTotal: 0,
    pricePerSession: 0,
  });
  
  // Import history states
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importForm, setImportForm] = useState({
    totalSessions: 10,
    usedSessions: 0,
    priceTotal: 500,
    startDate: new Date().toISOString().split('T')[0],
  });
  
  const handleImportHistory = () => {
    if (!user?.id) return;
    
    // Create package
    addSessionPackage({
      trainerId: user.id,
      clientId,
      name: 'Imported Package',
      totalSessions: importForm.totalSessions,
      paidSessions: importForm.totalSessions, // Assume all imported sessions are paid
      priceTotal: importForm.priceTotal,
      pricePerSession: importForm.priceTotal / importForm.totalSessions,
      purchaseDate: importForm.startDate,
      status: importForm.usedSessions >= importForm.totalSessions ? 'completed' : 'active',
      paymentId: '',
    });
    
    // Create completed sessions for used sessions
    for (let i = 0; i < importForm.usedSessions; i++) {
      const sessionDate = new Date(importForm.startDate);
      sessionDate.setDate(sessionDate.getDate() + (i * 7)); // Weekly sessions
      
      addSession({
        trainerId: user.id,
        clientId,
        date: sessionDate.toISOString(),
        startTime: sessionDate.toISOString(),
        endTime: new Date(sessionDate.getTime() + 60 * 60 * 1000).toISOString(),
        duration: 60,
        type: 'pt_session',
        status: 'completed',
        paid: true,
      });
    }
    
    setShowImportDialog(false);
    setImportForm({ totalSessions: 10, usedSessions: 0, priceTotal: 500, startDate: new Date().toISOString().split('T')[0] });
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
      return;
    }

    if (user?.mode !== 'trainer') {
      router.replace('/workout');
      return;
    }
  }, [isAuthenticated, router, user?.mode]);

  useEffect(() => {
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(storedUsers);
    setClientUser(storedUsers.find((u: any) => u.id === clientId) || null);

    const workoutData = JSON.parse(localStorage.getItem('apex-workout') || '{}');
    const workouts = workoutData?.state?.workoutHistory || [];

    const directClientWorkouts = workouts.filter((w: any) => w.userId === clientId);

    // Option B (demo): if client has no workouts, simulate by sampling existing workouts
    if (directClientWorkouts.length === 0 && workouts.length > 0) {
      const simulated = workouts
        .slice(0, 12)
        .map((w: any, idx: number) => ({
          ...w,
          id: `${w.id}-sim-${clientId}-${idx}`,
          userId: clientId,
          // Spread dates out a bit for nicer charts
          startTime: new Date(Date.now() - (idx + 1) * 3 * 24 * 60 * 60 * 1000).toISOString(),
        }));
      setClientWorkouts(simulated);
    } else {
      setClientWorkouts(directClientWorkouts);
    }
    
    // Fetch exercise history from Supabase
    getClientExerciseHistory(clientId).then(history => {
      setExerciseHistory(history);
    });
  }, [clientId]);

  const clientRecord = clients.find(c => c.clientId === clientId && c.trainerId === user?.id);
  const clientSessions = calendarEvents
    .filter(e => e.clientId === clientId && e.trainerId === user?.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get completed sessions for this client (includes imported sessions)
  const clientCompletedSessions = getSessionsForClient(clientId).filter(s => 
    s.status === 'completed' || s.status === 'no_show'
  );
  
  const stats = useMemo(() => {
    const totalVolume = clientWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

    const startDate = clientRecord?.startDate ? new Date(clientRecord.startDate) : null;
    const weeksWithTrainer = startDate ? Math.max(0, differenceInWeeks(new Date(), startDate)) : 0;

    const now = new Date();
    const upcomingSessions = clientSessions.filter(s => new Date(s.date) > now).length;

    // Total sessions = max of workout history or completed sessions (to include imports)
    const totalSessions = Math.max(clientWorkouts.length, clientCompletedSessions.length);

    return {
      totalWorkouts: totalSessions,
      totalVolume,
      weeksWithTrainer,
      upcomingSessions,
    };
  }, [clientRecord?.startDate, clientSessions, clientWorkouts, clientCompletedSessions]);

  if (!isAuthenticated || user?.mode !== 'trainer') return null;
  if (!clientUser) return null;

  return (
    <MainLayout>
      <ScrollArea className="flex-1">
        <div className="px-4 pt-4 pb-10 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              className="border-gray-700 text-gray-200"
              onClick={() => {
                if (!user?.id) return;
                getOrCreateConversation(user.id, clientId);
                router.push('/messages');
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
          </div>

          <Card className="bg-gray-900 border-gray-800 overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-rose-500/40 to-rose-600/20 p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-2 border-white/20">
                    <AvatarImage src={clientUser.profilePhoto} />
                    <AvatarFallback className="bg-gray-800 text-white text-xl">
                      {clientUser.displayName?.[0] || clientUser.username?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-bold text-white truncate">
                        {clientUser.displayName || clientUser.username}
                      </h1>
                      {clientRecord?.status && (
                        <Badge
                          className={
                            clientRecord.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }
                        >
                          {clientRecord.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 truncate">@{clientUser.username}</p>
                    {clientRecord?.startDate && (
                      <p className="text-xs text-gray-300/80 mt-1">
                        Client since {format(new Date(clientRecord.startDate), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 divide-x divide-gray-800">
                <div className="py-3 text-center">
                  <p className="text-white font-semibold">{stats.totalWorkouts}</p>
                  <p className="text-xs text-gray-500">Workouts</p>
                </div>
                <div className="py-3 text-center">
                  <p className="text-white font-semibold">{Math.round(stats.totalVolume / 1000)}k</p>
                  <p className="text-xs text-gray-500">Volume</p>
                </div>
                <div className="py-3 text-center">
                  <p className="text-white font-semibold">{stats.weeksWithTrainer}</p>
                  <p className="text-xs text-gray-500">Weeks</p>
                </div>
                <div className="py-3 text-center">
                  <p className="text-white font-semibold">{stats.upcomingSessions}</p>
                  <p className="text-xs text-gray-500">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {clientRecord?.goals?.length ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {clientRecord.goals.map((g: string) => (
                    <Badge key={g} variant="outline" className="border-gray-700 text-gray-300">
                      {g}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-4">
            <VolumeChart workouts={clientWorkouts} title="Volume Over Time" />
            <div className="grid grid-cols-2 gap-3">
              <MuscleProgressChart workouts={clientWorkouts} muscleGroup="chest" />
              <MuscleProgressChart workouts={clientWorkouts} muscleGroup="back" />
              <MuscleProgressChart workouts={clientWorkouts} muscleGroup="shoulders" />
              <MuscleProgressChart workouts={clientWorkouts} muscleGroup="legs" />
            </div>
          </div>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientSessions.length === 0 ? (
                <p className="text-sm text-gray-500">No sessions scheduled for this client.</p>
              ) : (
                <div className="space-y-2">
                  {clientSessions.slice(0, 8).map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-xl">
                      <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{s.title}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(s.date), 'EEE, MMM d · h:mm a')}
                        </p>
                      </div>
                      {s.status && (
                        <Badge
                          className={
                            s.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }
                        >
                          {s.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {exerciseHistory.length > 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-400" />
                  Exercise History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {exerciseHistory.slice(0, 10).map((ex: any) => (
                    <div key={ex.id} className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{ex.exercise_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{ex.times_used}x used</span>
                          {ex.block_type && (
                            <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                              {ex.block_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {ex.best_weight && (
                          <p className="text-sm text-emerald-400 font-medium">{ex.best_weight}kg</p>
                        )}
                        {ex.best_reps && (
                          <p className="text-xs text-gray-500">{ex.best_reps} reps</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Session Packages */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  Session Packages
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowImportDialog(true)}
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-8"
                >
                  <History className="w-3 h-3 mr-1" /> Import History
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {getPackagesForClient(clientId).length === 0 ? (
                <p className="text-sm text-gray-500">No session packages for this client.</p>
              ) : (
                <div className="space-y-3">
                  {getPackagesForClient(clientId).map((pkg: any) => (
                    <div key={pkg.id} className="p-3 bg-gray-800/60 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{pkg.name || 'Session Package'}</p>
                          <p className="text-xs text-gray-500">
                            {pkg.usedSessions}/{pkg.totalSessions} sessions used
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={pkg.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}>
                            {pkg.status}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingPackage(pkg);
                              setPackageForm({
                                totalSessions: pkg.totalSessions,
                                usedSessions: pkg.usedSessions,
                                priceTotal: pkg.priceTotal || 0,
                                pricePerSession: pkg.pricePerSession || 0,
                              });
                              setShowEditPackage(true);
                            }}
                            className="h-8 w-8 text-gray-400 hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gray-900 rounded-lg">
                          <p className="text-gray-500">Total Price</p>
                          <p className="text-white font-medium">${pkg.priceTotal || 0}</p>
                        </div>
                        <div className="p-2 bg-gray-900 rounded-lg">
                          <p className="text-gray-500">Per Session</p>
                          <p className="text-white font-medium">${pkg.pricePerSession || 0}</p>
                        </div>
                        <div className="p-2 bg-gray-900 rounded-lg">
                          <p className="text-gray-500">Remaining</p>
                          <p className="text-emerald-400 font-medium">{pkg.remainingSessions} sessions</p>
                        </div>
                        <div className="p-2 bg-gray-900 rounded-lg">
                          <p className="text-gray-500">Purchased</p>
                          <p className="text-white font-medium">{pkg.purchaseDate ? format(new Date(pkg.purchaseDate), 'MMM d, yyyy') : 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Sessions */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Sessions & Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getSessionsForClient(clientId).length === 0 ? (
                <p className="text-sm text-gray-500">No sessions recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {getSessionsForClient(clientId).slice(0, 10).map((session: any) => (
                    <div key={session.id} className="p-3 bg-gray-800/60 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{session.type === 'pt_session' ? 'PT Session' : session.type}</p>
                          <p className="text-xs text-gray-500">{format(new Date(session.date), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            session.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 
                            session.status === 'no_show' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }>
                            {session.status === 'no_show' ? 'No Show' : session.status}
                          </Badge>
                          <Badge 
                            className={session.paid ? 'bg-green-500/20 text-green-400 cursor-pointer' : 'bg-amber-500/20 text-amber-400 cursor-pointer'}
                            onClick={() => toggleSessionPaid(session.id)}
                          >
                            {session.paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </div>
                      </div>
                      {/* Session Actions */}
                      {session.status === 'scheduled' && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                          <Button
                            size="sm"
                            onClick={() => markSessionComplete(session.id)}
                            className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 h-8"
                          >
                            <Check className="w-3 h-3 mr-1" /> Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markSessionNoShow(session.id)}
                            className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 h-8"
                          >
                            <X className="w-3 h-3 mr-1" /> No Show
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
                Client Workouts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientWorkouts.length === 0 ? (
                <p className="text-sm text-gray-500">No workout history for this client yet.</p>
              ) : (
                <div className="space-y-2">
                  {clientWorkouts.slice(0, 8).map((w: any) => (
                    <div key={w.id} className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-xl">
                      <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{w.name}</p>
                        <p className="text-xs text-gray-500">{format(new Date(w.startTime), 'MMM d, yyyy')}</p>
                      </div>
                      <Badge variant="outline" className="border-gray-700 text-gray-300">
                        {Math.round((w.totalVolume || 0) / 1000)}k
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Edit Package Dialog */}
      <Dialog open={showEditPackage} onOpenChange={setShowEditPackage}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Session Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Total Sessions</label>
                <Input
                  type="number"
                  value={packageForm.totalSessions}
                  onChange={(e) => setPackageForm(prev => ({ 
                    ...prev, 
                    totalSessions: parseInt(e.target.value) || 0,
                    pricePerSession: prev.priceTotal / (parseInt(e.target.value) || 1)
                  }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Sessions Used</label>
                <Input
                  type="number"
                  value={packageForm.usedSessions}
                  onChange={(e) => setPackageForm(prev => ({ ...prev, usedSessions: parseInt(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Total Price ($)</label>
                <Input
                  type="number"
                  value={packageForm.priceTotal}
                  onChange={(e) => setPackageForm(prev => ({ 
                    ...prev, 
                    priceTotal: parseFloat(e.target.value) || 0,
                    pricePerSession: (parseFloat(e.target.value) || 0) / (prev.totalSessions || 1)
                  }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Per Session ($)</label>
                <Input
                  type="number"
                  value={packageForm.pricePerSession.toFixed(2)}
                  disabled
                  className="bg-gray-800 border-gray-700 text-gray-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEditPackage(false)}
                className="flex-1 border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingPackage) {
                    updateSessionPackage(editingPackage.id, {
                      totalSessions: packageForm.totalSessions,
                      usedSessions: packageForm.usedSessions,
                      remainingSessions: packageForm.totalSessions - packageForm.usedSessions,
                      priceTotal: packageForm.priceTotal,
                      pricePerSession: packageForm.pricePerSession,
                      status: packageForm.usedSessions >= packageForm.totalSessions ? 'completed' : 'active',
                    });
                    setShowEditPackage(false);
                    setEditingPackage(null);
                    toast.success('Package updated successfully');
                  }
                }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import History Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Import Historical Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Import previous session packages and completed sessions for this client.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Total Sessions in Package</label>
                <Input
                  type="number"
                  value={importForm.totalSessions}
                  onChange={(e) => setImportForm(prev => ({ ...prev, totalSessions: parseInt(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Sessions Already Completed</label>
                <Input
                  type="number"
                  value={importForm.usedSessions}
                  onChange={(e) => setImportForm(prev => ({ ...prev, usedSessions: parseInt(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Package Total ($)</label>
                <Input
                  type="number"
                  value={importForm.priceTotal}
                  onChange={(e) => setImportForm(prev => ({ ...prev, priceTotal: parseFloat(e.target.value) || 0 }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={importForm.startDate}
                  onChange={(e) => setImportForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg text-sm">
              <p className="text-gray-300">This will create:</p>
              <ul className="text-gray-400 mt-1 space-y-1">
                <li>• 1 session package ({importForm.totalSessions} sessions, ${importForm.priceTotal})</li>
                <li>• {importForm.usedSessions} completed session records</li>
                <li>• Price per session: ${(importForm.priceTotal / (importForm.totalSessions || 1)).toFixed(2)}</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(false)}
                className="flex-1 border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImportHistory}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Import History
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
