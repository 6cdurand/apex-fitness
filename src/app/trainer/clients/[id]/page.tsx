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
import { Calendar, MessageCircle, ArrowLeft, Dumbbell, TrendingUp, Clock, Target, History } from 'lucide-react';
import { getClientExerciseHistory } from '@/lib/supabaseSync';
import { format, differenceInWeeks } from 'date-fns';
import { VolumeChart, MuscleProgressChart } from '@/components/charts/VolumeChart';

export default function TrainerClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const { user, isAuthenticated } = useAuthStore();
  const { clients, calendarEvents } = useTrainerStore();
  const { getOrCreateConversation } = useMessageStore();

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [clientUser, setClientUser] = useState<any>(null);
  const [clientWorkouts, setClientWorkouts] = useState<any[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);

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

  const stats = useMemo(() => {
    const totalVolume = clientWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

    const startDate = clientRecord?.startDate ? new Date(clientRecord.startDate) : null;
    const weeksWithTrainer = startDate ? Math.max(0, differenceInWeeks(new Date(), startDate)) : 0;

    const now = new Date();
    const upcomingSessions = clientSessions.filter(s => new Date(s.date) > now).length;

    return {
      totalWorkouts: clientWorkouts.length,
      totalVolume,
      weeksWithTrainer,
      upcomingSessions,
    };
  }, [clientRecord?.startDate, clientSessions, clientWorkouts]);

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
    </MainLayout>
  );
}
