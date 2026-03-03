'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useTrainerStore, useMedalStore, checkAllMedalsRetroactive } from '@/lib/store';
import { milestoneMedals, evolvingMedals, isCloseToEvolving, getEvolutionGlowClass, getEvolutionFrameClass, getNextEvolutionThreshold, isTrainerMedal } from '@/lib/medals';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { defaultTemplates } from '@/lib/templates';
import { WorkoutTemplate } from '@/types';
import { 
  Plus, 
  Play, 
  Clock, 
  Dumbbell, 
  ChevronRight,
  ChevronLeft,
  Zap,
  Target,
  Flame,
  History,
  Calendar,
  Trophy,
  Sparkles,
  Footprints,
  TrendingUp,
  Users,
  DollarSign,
  Check,
  AlertCircle,
  CalendarRange,
  Edit
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getClientDisplayInfo } from '@/lib/clientUtils';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday as isDateToday } from 'date-fns';
import Link from 'next/link';

export default function TodayPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { activeWorkout, workoutHistory, startWorkout, startFromTemplate, templates, personalBests, volumeRollups } = useWorkoutStore();
  const { medals } = useMedalStore();
  const { calendarEvents, getScheduledSessionsForUser, getEventsForDate, clients, sessions, payments, sessionWorkouts, clientPrograms } = useTrainerStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [showStartOptions, setShowStartOptions] = useState(false);
  const [dailySteps, setDailySteps] = useState<number>(0);
  const [stepsGoal] = useState(10000);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // No longer auto-redirect to active workout — bottom bar handles re-entry

  // deriveAll consistency check — runs once per day on login
  useEffect(() => {
    if (!user?.id) return;
    const checkKey = `apex-derive-check-${user.id}`;
    const lastCheck = localStorage.getItem(checkKey);
    const now = Date.now();
    if (lastCheck && now - parseInt(lastCheck) < 86400000) return;
    const timer = setTimeout(() => {
      // Run full pipeline to ensure PBs/medals/ratings/volume are consistent
      const { runDeriveAll } = useWorkoutStore.getState();
      runDeriveAll(user.id);
      // Also run legacy retroactive check for any edge cases
      const awarded = checkAllMedalsRetroactive(user.id);
      if (awarded > 0) console.log(`[TodayPage] Retroactive medal check awarded ${awarded} medals`);
      localStorage.setItem(checkKey, String(now));
    }, 2000);
    return () => clearTimeout(timer);
  }, [user?.id]);

  // Load steps from localStorage (manual entry for MVP)
  useEffect(() => {
    const todayKey = `apex-steps-${format(new Date(), 'yyyy-MM-dd')}`;
    const saved = localStorage.getItem(todayKey);
    if (saved) setDailySteps(parseInt(saved));
  }, []);

  if (!isAuthenticated || !user) return null;

  const today = format(new Date(), 'yyyy-MM-dd');
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isToday = today === selectedDateStr;

  // Calendar strip — current week
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // User workouts
  const userWorkouts = workoutHistory.filter(w => w.userId === user.id && w.status === 'completed' && !w.deletedAt);
  const todayWorkouts = userWorkouts.filter(w => format(new Date(w.startTime), 'yyyy-MM-dd') === selectedDateStr);
  
  // Weekly stats (calendar week Mon–Sun, resets each Monday)
  const weekWorkouts = userWorkouts.filter(w => {
    const d = new Date(w.startTime);
    return d >= weekStart && d <= weekEnd;
  });
  const weekVolume = weekWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const weekMinutes = Math.round(weekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / 60);

  // Streak calculation (weekly)
  const calculateStreak = () => {
    if (userWorkouts.length === 0) return 0;
    let streak = 0;
    const now = new Date();
    let checkDate = startOfWeek(now, { weekStartsOn: 1 });
    
    // Check current week first
    const currentWeekWorkouts = userWorkouts.filter(w => {
      const d = new Date(w.startTime);
      return d >= checkDate && d <= endOfWeek(checkDate, { weekStartsOn: 1 });
    });
    if (currentWeekWorkouts.length > 0) streak++;
    
    // Check previous weeks
    for (let i = 1; i < 100; i++) {
      const weekCheckStart = new Date(checkDate);
      weekCheckStart.setDate(weekCheckStart.getDate() - 7 * i);
      const weekCheckEnd = endOfWeek(weekCheckStart, { weekStartsOn: 1 });
      const hasWorkout = userWorkouts.some(w => {
        const d = new Date(w.startTime);
        return d >= weekCheckStart && d <= weekCheckEnd;
      });
      if (hasWorkout) streak++;
      else break;
    }
    return streak;
  };
  const currentStreak = calculateStreak();

  // Scheduled sessions for clients
  const clientScheduledSessions = getScheduledSessionsForUser(user.id);

  // Medal progress — only show if user has actual earned medals
  const userMedals = medals.filter(m => m.userId === user.id && m.earned && !isTrainerMedal(m.definitionId));
  const almostEvolved = userMedals
    .filter(m => {
      const evo = isCloseToEvolving(m.timesEarned || 1, m.definitionId);
      return evo.close;
    })
    .slice(0, 5);

  // Smart medal progress — calculate actual % toward each unearned medal
  const earnedIds = new Set(userMedals.map(m => m.definitionId));
  const userPBs = personalBests.filter(pb => pb.userId === user.id);
  const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const pbCount = userPBs.length;

  const closestUnearned = userWorkouts.length > 0
    ? milestoneMedals
        .filter(def => !earnedIds.has(def.id) && !isTrainerMedal(def.id))
        .map(def => {
          let current = 0;
          const target = def.target || 1;
          // Calculate current progress based on medal category/id
          if (def.id.startsWith('first-blood') || def.id === 'getting-started' || def.id === 'dedicated' || def.id === 'committed' || def.id === 'centurion') {
            current = userWorkouts.length;
          } else if (def.id.startsWith('volume-')) {
            current = Math.round(totalVolume);
          } else if (def.id.startsWith('streak-')) {
            current = currentStreak;
          } else if (def.id === 'first-pr' || def.id === 'pr-hunter' || def.id === 'pr-collector') {
            current = pbCount;
          } else if (def.id.startsWith('bench-')) {
            const benchPB = userPBs.find(p => p.exerciseId?.includes('bench') && !p.exerciseId?.includes('incline'));
            current = benchPB?.oneRepMax || benchPB?.bestWeight || 0;
          } else if (def.id.startsWith('squat-')) {
            const squatPB = userPBs.find(p => p.exerciseId?.includes('squat') && !p.exerciseId?.includes('split'));
            current = squatPB?.oneRepMax || squatPB?.bestWeight || 0;
          } else if (def.id.startsWith('deadlift-')) {
            const dlPB = userPBs.find(p => p.exerciseId?.includes('deadlift') || p.exerciseId?.includes('rdl'));
            current = dlPB?.oneRepMax || dlPB?.bestWeight || 0;
          } else if (def.id === 'variety-king') {
            const uniqueExercises = new Set(userWorkouts.flatMap(w => w.exercises?.map(e => e.exerciseId) || []));
            current = uniqueExercises.size;
          } else if (def.id === 'weekly-warrior') {
            current = weekWorkouts.length;
          } else {
            current = 0; // Can't calculate — skip in sorting
          }
          const pct = Math.min(Math.round((current / target) * 100), 99);
          const remaining = Math.max(target - current, 0);
          return { ...def, current, pct, remaining };
        })
        .filter(m => m.pct > 0 && m.pct < 100) // Only show medals with some progress
        .sort((a, b) => b.pct - a.pct) // Closest to completion first
        .slice(0, 5)
    : [];

  const allTemplates = [...defaultTemplates, ...templates];

  const handleStartEmpty = () => {
    startWorkout('Quick Workout');
    router.push('/workout/active');
  };

  const handleStartFromTemplate = (template: WorkoutTemplate) => {
    startFromTemplate(template);
    router.push('/workout/active');
  };

  const updateSteps = (steps: number) => {
    setDailySteps(steps);
    const todayKey = `apex-steps-${format(new Date(), 'yyyy-MM-dd')}`;
    localStorage.setItem(todayKey, String(steps));
  };

  const recentWorkouts = userWorkouts
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 3);

  // Check if day had workouts (for calendar dots)
  const dayHasWorkout = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return userWorkouts.some(w => format(new Date(w.startTime), 'yyyy-MM-dd') === dateStr);
  };

  return (
    <MainLayout>
      <PageHeader 
        title={isToday ? 'Today' : format(selectedDate, 'EEEE')}
        subtitle={format(selectedDate, 'MMMM d, yyyy')}
      />

      <div className="px-4 py-4 space-y-5">
        {/* Calendar Day Strip */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white flex-shrink-0"
            onClick={() => setSelectedDate(subDays(selectedDate, 7))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-1 justify-between">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isDateToday(day);
              const hasWorkout = dayHasWorkout(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2 px-2.5 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-sky-500 text-white'
                      : isTodayDate
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <span className="text-[10px] font-medium uppercase">{format(day, 'EEE')}</span>
                  <span className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-white' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {hasWorkout && !isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1" />
                  )}
                  {hasWorkout && isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white mt-1" />
                  )}
                  {!hasWorkout && <div className="w-1.5 h-1.5 mt-1" />}
                </button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white flex-shrink-0"
            onClick={() => setSelectedDate(addDays(selectedDate, 7))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 flex-shrink-0 ml-1"
            onClick={() => router.push('/calendar')}
          >
            <CalendarRange className="w-4 h-4" />
          </Button>
        </div>

        {/* Today's Stats Row — user mode only */}
        {user.mode !== 'trainer' && (
        <div className="grid grid-cols-4 gap-2">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{currentStreak}</p>
              <p className="text-[10px] text-gray-500">Week Streak</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <Dumbbell className="w-4 h-4 text-sky-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{weekWorkouts.length}</p>
              <p className="text-[10px] text-gray-500">This Week</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <Clock className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{weekMinutes}</p>
              <p className="text-[10px] text-gray-500">Minutes</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{weekVolume > 1000 ? `${(weekVolume / 1000).toFixed(0)}k` : weekVolume}</p>
              <p className="text-[10px] text-gray-500">Volume</p>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Steps Section — user mode only */}
        {user.mode !== 'trainer' && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Footprints className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-white">Today&apos;s Steps</span>
              </div>
              <div className="flex items-center gap-2">
                {(user.healthConnections?.appleHealth?.connected || user.healthConnections?.googleHealth?.connected) && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {user.healthConnections?.appleHealth?.connected ? 'Apple Health' : 'Google Health'}
                  </span>
                )}
                <span className="text-sm text-gray-400">{stepsGoal.toLocaleString()} goal</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((dailySteps / stepsGoal) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={dailySteps || ''}
                  onChange={(e) => updateSteps(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20 text-right text-lg font-bold text-emerald-400 bg-transparent border-none outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {dailySteps >= stepsGoal 
                ? 'Goal reached! Great job!' 
                : (user.healthConnections?.appleHealth?.connected || user.healthConnections?.googleHealth?.connected)
                  ? `${(stepsGoal - dailySteps).toLocaleString()} steps to go • auto-synced`
                  : `${(stepsGoal - dailySteps).toLocaleString()} steps to go`}
            </p>
          </CardContent>
        </Card>
        )}

        {/* Today's Workouts — user mode only (trainer sees client workouts below) */}
        {user.mode !== 'trainer' && todayWorkouts.length > 0 && isToday && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Completed Today
            </h2>
            <div className="space-y-2">
              {todayWorkouts.map((workout) => (
                <Card
                  key={workout.id}
                  className="bg-gray-900 border-green-500/30 cursor-pointer hover:bg-gray-850"
                  onClick={() => router.push(`/workout/${workout.id}`)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Dumbbell className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{workout.name}</p>
                        <p className="text-xs text-gray-500">
                          {workout.exercises.length} exercises • {workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 text-xs">Done</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Medals Earned Today */}
        {user.mode !== 'trainer' && isToday && (() => {
          const todayMedals = medals.filter(m => 
            m.userId === user.id && m.earned && m.earnedAt && 
            format(new Date(m.earnedAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
          );
          if (todayMedals.length === 0) return null;
          return (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Earned Today
              </h2>
              <div className="flex flex-wrap gap-2">
                {todayMedals.map(medal => (
                  <Badge 
                    key={medal.id} 
                    className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs cursor-pointer"
                    onClick={() => router.push('/medals')}
                  >
                    {medal.icon} {medal.name}
                  </Badge>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Quick Start */}
        {user.mode !== 'trainer' && (
          <div className="grid grid-cols-2 gap-3">
            <Dialog open={showStartOptions} onOpenChange={setShowStartOptions}>
              <DialogTrigger asChild>
                <Button
                  className="h-auto py-6 bg-gradient-to-br from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 flex flex-col items-center gap-2 rounded-2xl shadow-lg shadow-sky-500/20"
                >
                  <Plus className="w-6 h-6" />
                  <span className="font-bold text-sm">Start Workout</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">Start Workout</DialogTitle>
                  <DialogDescription className="text-gray-400">Choose how to begin</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 border-gray-700 hover:bg-gray-800 justify-start"
                    onClick={() => { handleStartEmpty(); setShowStartOptions(false); }}
                  >
                    <Zap className="w-5 h-5 text-sky-400 mr-3" />
                    <div className="text-left">
                      <p className="font-medium text-white">Quick Start</p>
                      <p className="text-xs text-gray-400">Empty workout, add exercises as you go</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 border-gray-700 hover:bg-gray-800 justify-start"
                    onClick={() => { setShowStartOptions(false); setShowTemplates(true); }}
                  >
                    <Dumbbell className="w-5 h-5 text-blue-400 mr-3" />
                    <div className="text-left">
                      <p className="font-medium text-white">From Template</p>
                      <p className="text-xs text-gray-400">Choose a pre-built workout</p>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="h-auto py-6 bg-gray-800 border-gray-700 hover:bg-gray-700 flex flex-col items-center gap-2 rounded-2xl"
              onClick={() => router.push('/workout/history')}
            >
              <History className="w-6 h-6 text-gray-400" />
              <span className="font-semibold text-sm text-white">History</span>
            </Button>
          </div>
        )}

        {/* Scheduled Sessions (Client Mode) — positioned below Start Workout */}
        {user.mode !== 'trainer' && clientScheduledSessions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Sessions
            </h2>
            <div className="space-y-2">
              {clientScheduledSessions.slice(0, 3).map((session) => (
                <Card key={session.id} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white text-sm">{session.title || 'Training Session'}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(session.date), 'EEE, MMM d')} • {session.startTime}
                      </p>
                    </div>
                    {session.date === today && (
                      <Badge className="bg-rose-500/20 text-rose-400 text-xs">Today</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Trainer Mode: Unified Timeline — all events sorted by time */}
        {user.mode === 'trainer' && (() => {
          const trainerEvents = getEventsForDate(selectedDateStr).filter(e => 
            e.trainerId === user.id && e.status !== 'cancelled'
          );
          
          // Merge all events into one list sorted by startTime
          const allEvents = trainerEvents
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
          
          // Outstanding unpaid sessions
          const unpaidSessions = sessions.filter(s => 
            s.trainerId === user.id && s.status === 'completed' && !s.paid
          );
          
          // Recent client completions
          const recentClientWorkouts = workoutHistory
            .filter(w => w.assignedBy === user.id && w.status === 'completed')
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
            .slice(0, 3);

          // Color config per event type
          // 'session' = client PT session (blue), 'consultation' = consultation (emerald), 'workout' = solo/personal (orange)
          const typeConfig: Record<string, { label: string; border: string; badge: string; badgeText: string; avatarBg: string; avatarText: string; accent: string }> = {
            session: { label: 'Client Session', border: 'border-sky-500/30', badge: 'bg-sky-500/20', badgeText: 'text-sky-400', avatarBg: 'bg-sky-900', avatarText: 'text-sky-300', accent: 'sky' },
            consultation: { label: 'Consultation', border: 'border-emerald-500/30', badge: 'bg-emerald-500/20', badgeText: 'text-emerald-400', avatarBg: 'bg-emerald-900', avatarText: 'text-emerald-300', accent: 'emerald' },
            workout: { label: 'Solo Training', border: 'border-orange-500/30', badge: 'bg-orange-500/20', badgeText: 'text-orange-400', avatarBg: 'bg-orange-900', avatarText: 'text-orange-300', accent: 'orange' },
            assessment: { label: 'Assessment', border: 'border-purple-500/30', badge: 'bg-purple-500/20', badgeText: 'text-purple-400', avatarBg: 'bg-purple-900', avatarText: 'text-purple-300', accent: 'purple' },
            rest: { label: 'Rest Day', border: 'border-gray-500/30', badge: 'bg-gray-500/20', badgeText: 'text-gray-400', avatarBg: 'bg-gray-900', avatarText: 'text-gray-300', accent: 'gray' },
          };
          
          return (
            <>
              {/* Unpaid Sessions Alert */}
              {unpaidSessions.length > 0 && (
                <section className="mb-4">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-amber-400">
                          {unpaidSessions.length} unpaid session{unpaidSessions.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-xs text-amber-400/70">
                        ${unpaidSessions.reduce((sum, s) => {
                          const pkg = payments.find(p => p.clientId === s.clientId && p.status === 'pending');
                          return sum + (pkg?.amount || 0);
                        }, 0)} outstanding
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {unpaidSessions.slice(0, 3).map(s => {
                        const clientInfo = s.clientId ? getClientDisplayInfo(s.clientId) : null;
                        return (
                          <div key={s.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-300">{clientInfo?.displayName || 'Client'} — {s.date}</span>
                            <button 
                              onClick={() => router.push(`/clients/${s.clientId}`)}
                              className="text-sky-400 hover:text-sky-300"
                            >
                              View
                            </button>
                          </div>
                        );
                      })}
                      {unpaidSessions.length > 3 && (
                        <p className="text-[10px] text-gray-500">+{unpaidSessions.length - 3} more</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Unified Session Timeline */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {isToday ? "Today's Schedule" : `Schedule — ${format(selectedDate, 'MMM d')}`}
                  </h2>
                  <Badge variant="secondary" className="bg-sky-500/20 text-sky-400 text-xs">
                    {allEvents.length}
                  </Badge>
                </div>
                
                {allEvents.length > 0 ? (
                  <div className="space-y-3">
                    {allEvents.map((event) => {
                      const eventType = event.type || 'session';
                      const config = typeConfig[eventType] || typeConfig.session;
                      const clientInfo = event.clientId ? getClientDisplayInfo(event.clientId) : null;
                      const displayName = clientInfo?.displayName || (event as any).contactName || event.title || 'New Client';
                      const initial = displayName[0] || '?';
                      const sessionDone = eventType === 'session' && workoutHistory.some(w => 
                        w.userId === event.clientId && 
                        format(new Date(w.startTime), 'yyyy-MM-dd') === selectedDateStr
                      );
                      // Check if a workout has been assigned/created for this session
                      const matchedWorkout = eventType === 'session' ? sessionWorkouts.find(
                        (sw: any) => sw.eventId === event.id
                      ) : null;
                      const hasWorkout = !!matchedWorkout;
                      // Calculate duration in minutes
                      const durationMins = (() => {
                        if (!event.startTime || !event.endTime) return null;
                        const [sh, sm] = event.startTime.split(':').map(Number);
                        const [eh, em] = event.endTime.split(':').map(Number);
                        return (eh * 60 + em) - (sh * 60 + sm);
                      })();

                      return (
                        <Card
                          key={event.id}
                          className={`bg-gray-900 ${sessionDone ? 'border-green-500/30' : config.border} overflow-hidden transition-all`}
                        >
                          {/* Left color accent bar */}
                          <div className={`flex`}>
                            <div className={`w-1 ${
                              eventType === 'session' ? 'bg-sky-500' : 
                              eventType === 'consultation' ? 'bg-emerald-500' :
                              eventType === 'workout' ? 'bg-orange-500' :
                              eventType === 'assessment' ? 'bg-purple-500' : 'bg-gray-500'
                            }`} />
                            <div className="flex-1">
                              <CardContent className="p-3">
                                {/* Top row: avatar, name, time, Start button */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Link href={event.clientId ? `/profile/${event.clientId}` : '#'} onClick={(e) => e.stopPropagation()}>
                                      <Avatar className="w-9 h-9 cursor-pointer hover:ring-2 hover:ring-sky-500/50 transition-all">
                                        <AvatarImage src={clientInfo?.profilePhoto} />
                                        <AvatarFallback className={`${config.avatarBg} ${config.avatarText} text-sm`}>
                                          {initial}
                                        </AvatarFallback>
                                      </Avatar>
                                    </Link>
                                    <div>
                                      {event.clientId ? (
                                        <Link
                                          href={user?.mode === 'trainer' ? `/clients/${event.clientId}` : `/profile/${event.clientId}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="font-medium text-white text-sm hover:text-sky-400 hover:underline transition-colors"
                                        >
                                          {displayName}
                                        </Link>
                                      ) : (
                                        <p className="font-medium text-white text-sm">{displayName}</p>
                                      )}
                                      <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {event.startTime} - {event.endTime}
                                        {durationMins && ` (${durationMins} min)`}
                                        {' • '}{config.label}
                                      </p>
                                    </div>
                                  </div>
                                  {sessionDone ? (
                                    <Badge className="bg-green-500/20 text-green-400 text-xs">
                                      <Check className="w-3 h-3 mr-1" /> Done
                                    </Badge>
                                  ) : eventType === 'consultation' ? (
                                    <Button 
                                      size="sm" 
                                      className="bg-emerald-500 hover:bg-emerald-600 h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (event.clientId) {
                                          router.push(`/clients/${event.clientId}/onboarding`);
                                        } else {
                                          router.push('/clients?new=true');
                                        }
                                      }}
                                    >
                                      <Play className="w-3 h-3 mr-1" /> Start
                                    </Button>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      className={`h-7 text-xs ${
                                        eventType === 'workout' 
                                          ? 'bg-orange-500 hover:bg-orange-600' 
                                          : 'bg-sky-500 hover:bg-sky-600'
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Try to start from assigned workout or program
                                        const sw = sessionWorkouts.find((w: any) => w.eventId === event.id);
                                        const program = event.clientId 
                                          ? clientPrograms.find(p => p.clientId === event.clientId && p.status === 'active')
                                          : null;
                                        
                                        if (sw && sw.blocks) {
                                          // Start from session workout
                                          const exercises = sw.blocks.flatMap((block: any) =>
                                            (block.exercises || []).map((ex: any) => ({
                                              ...ex,
                                              id: ex.id || `ex-${Date.now()}-${Math.random()}`,
                                              sets: (ex.sets || [{ id: `s1`, setNumber: 1, type: 'normal', weight: 0, reps: 0, completed: false }]),
                                            }))
                                          );
                                          startFromTemplate({
                                            id: `session-${event.id}`,
                                            name: sw.name || `Session - ${displayName}`,
                                            description: `PT Session`,
                                            exercises,
                                            category: 'strength',
                                            estimatedDuration: 60,
                                            isClientSession: true,
                                            clientId: event.clientId,
                                            trainerId: user?.id,
                                          } as any, event.clientId || undefined);
                                          router.push('/workout/active');
                                        } else if (program && program.weeklyPlan?.length > 0) {
                                          // Start from the next program day
                                          const dayIdx = 0; // Default to first day
                                          const day = program.weeklyPlan[dayIdx];
                                          const exercises = (day.blocks || []).flatMap((block: any) =>
                                            (block.exercises || []).map((ex: any) => ({
                                              ...ex,
                                              id: ex.id || `ex-${Date.now()}-${Math.random()}`,
                                              sets: (ex.sets || [{ id: `s1`, setNumber: 1, type: 'normal', weight: 0, reps: 0, completed: false }]),
                                            }))
                                          );
                                          startFromTemplate({
                                            id: `program-${program.id}-${dayIdx}`,
                                            name: `${day.dayLabel || 'Workout'} - ${displayName}`,
                                            description: `From ${program.templateName}`,
                                            exercises,
                                            category: 'strength',
                                            estimatedDuration: 60,
                                            isClientSession: true,
                                            clientId: event.clientId,
                                            trainerId: user?.id,
                                          } as any, event.clientId || undefined);
                                          router.push('/workout/active');
                                        } else if (eventType === 'workout') {
                                          // Solo workout — start empty
                                          startWorkout('Solo Training');
                                          router.push('/workout/active');
                                        } else {
                                          // Session with no workout — start empty session for client
                                          startWorkout(`Session - ${displayName}`, undefined, event.clientId || undefined);
                                          router.push('/workout/active');
                                        }
                                      }}
                                    >
                                      <Play className="w-3 h-3 mr-1" /> Start
                                    </Button>
                                  )}
                                </div>
                                {/* Bottom row for sessions: workout status + create workout */}
                                {eventType === 'session' && !sessionDone && (
                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                      <Dumbbell className="w-3 h-3" />
                                      {hasWorkout ? 'Workout assigned' : 'No workout assigned'}
                                    </p>
                                    {hasWorkout ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[11px] border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/workout/builder?workoutId=${matchedWorkout?.id}&eventId=${event.id}&clientId=${event.clientId}`);
                                        }}
                                      >
                                        <Edit className="w-3 h-3 mr-1" /> Edit Workout
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[11px] border-gray-700 text-gray-400 hover:text-white hover:border-sky-500/50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (event.clientId) {
                                            router.push(`/workout/builder?eventId=${event.id}&clientId=${event.clientId}`);
                                          }
                                        }}
                                      >
                                        <Plus className="w-3 h-3 mr-1" /> Create Workout
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {/* Consultation: link to onboarding */}
                                {eventType === 'consultation' && (
                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                                    <p className="text-xs text-emerald-400/70 flex items-center gap-1">
                                      <CalendarRange className="w-3 h-3" />
                                      New client consultation
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[11px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (event.clientId) {
                                          router.push(`/clients/${event.clientId}/onboarding`);
                                        } else {
                                          router.push('/clients?new=true');
                                        }
                                      }}
                                    >
                                      Open Onboarding
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="py-6 text-center">
                      <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        No sessions {isToday ? 'today' : `on ${format(selectedDate, 'MMM d')}`}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>

              {/* Outstanding Payments */}
              {unpaidSessions.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    Outstanding Payments
                    <Badge className="bg-amber-500/20 text-amber-400 text-xs">{unpaidSessions.length}</Badge>
                  </h2>
                  <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-amber-300">{unpaidSessions.length} unpaid session{unpaidSessions.length !== 1 ? 's' : ''}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          onClick={() => router.push('/payments')}
                        >
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-auto py-5 bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 flex flex-col items-center gap-2 rounded-2xl shadow-lg shadow-rose-500/20"
                  onClick={() => router.push('/clients')}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-bold text-sm">Clients</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-5 bg-gray-800 border-gray-700 hover:bg-gray-700 flex flex-col items-center gap-2 rounded-2xl"
                  onClick={() => router.push('/calendar')}
                >
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="font-semibold text-sm text-white">Calendar</span>
                </Button>
              </div>
              
              {/* Recent Client Completions */}
              {recentClientWorkouts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    Recent Client Completions
                  </h2>
                  <div className="space-y-2">
                    {recentClientWorkouts.map((workout) => {
                      const clientInfo = getClientDisplayInfo(workout.userId);
                      return (
                        <Card key={workout.id} className="bg-gray-900 border-gray-800">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={clientInfo?.profilePhoto} />
                                <AvatarFallback className="bg-gray-800 text-white text-xs">
                                  {clientInfo?.displayName?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm text-white">{clientInfo?.displayName || 'Client'}</p>
                                <p className="text-xs text-gray-500">
                                  {workout.name} • {format(new Date(workout.startTime), 'MMM d')}
                                </p>
                              </div>
                            </div>
                            <Badge className="bg-green-500/20 text-green-400 text-xs">✓</Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          );
        })()}

        {/* Medal Progress — user mode only, only if there's real progress */}
        {user.mode !== 'trainer' && (almostEvolved.length > 0 || closestUnearned.length > 0) && (
          <section>
            {almostEvolved.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Almost Evolved
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {almostEvolved.map((medal) => {
                    const evoCheck = isCloseToEvolving(medal.timesEarned || 1, medal.definitionId);
                    const glowClass = getEvolutionGlowClass(medal.evolutionTier || 'base');
                    const frameClass = getEvolutionFrameClass(medal.evolutionTier || 'base');
                    const nextThreshold = getNextEvolutionThreshold(medal.timesEarned || 1);
                    const nextLabel = nextThreshold === 5 ? 'Gold' : nextThreshold === 20 ? 'Diamond' : nextThreshold === 50 ? 'Pink Diamond' : '';
                    return (
                      <div key={medal.id} className="flex-shrink-0 w-20 text-center cursor-pointer" onClick={() => router.push('/medals')}>
                        <div className={`relative w-14 h-14 mx-auto rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 ${glowClass} ${frameClass}`}>
                          <span className="text-xl">{medal.icon}</span>
                          <span className="absolute -top-1 -right-1 text-[9px] bg-gray-800 border border-gray-700 rounded-full px-1">{medal.timesEarned || 1}x</span>
                        </div>
                        <p className="text-[10px] text-white mt-1 font-medium truncate">{medal.name}</p>
                        <p className="text-[9px] text-gray-500">{evoCheck.remaining} to {nextLabel}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {closestUnearned.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  Closest Medals
                </h3>
                <div className="space-y-2">
                  {closestUnearned.map((def) => (
                    <div key={def.id} className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => router.push('/medals')}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 flex-shrink-0">
                        <span className="text-lg">{def.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-white font-medium truncate">{def.name}</p>
                          <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{def.pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${def.pct >= 75 ? 'bg-emerald-500' : def.pct >= 50 ? 'bg-sky-500' : 'bg-gray-500'}`}
                            style={{ width: `${def.pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {def.remaining <= 0 ? 'Almost there!' : `${def.remaining.toLocaleString()} ${def.id.startsWith('volume-') ? 'kg' : ''} to go`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Recent Workouts — user mode only */}
        {user.mode !== 'trainer' && recentWorkouts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                Recent Workouts
              </h2>
              <Button variant="ghost" size="sm" className="text-sky-400 text-xs h-7" onClick={() => router.push('/workout/history')}>
                See All
              </Button>
            </div>
            <div className="space-y-2">
              {recentWorkouts.map((workout) => (
                <Card
                  key={workout.id}
                  className="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-850 transition-colors"
                  onClick={() => router.push(`/workout/${workout.id}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white text-sm">{workout.name}</h3>
                        <p className="text-xs text-gray-500">
                          {format(new Date(workout.startTime), 'MMM d • h:mm a')} • {workout.exercises.length} exercises
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white">Workout Templates</DialogTitle>
            <DialogDescription>Choose a template to start</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-2">
              {allTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-750"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-3">
                    <h3 className="font-medium text-white text-sm">{template.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {template.exercises.length} exercises
                      {template.estimatedDuration ? ` • ~${template.estimatedDuration} min` : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Template Preview */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white">{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-2">
              {selectedTemplate?.exercises.map((ex, idx) => (
                <div key={ex.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-semibold text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{ex.exercise.name}</p>
                    <p className="text-xs text-gray-400">{ex.sets.length} sets</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Button
            onClick={() => {
              if (selectedTemplate) {
                handleStartFromTemplate(selectedTemplate);
                setSelectedTemplate(null);
                setShowTemplates(false);
              }
            }}
            className="w-full bg-sky-500 hover:bg-sky-600 mt-2"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Workout
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
