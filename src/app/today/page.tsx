'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useTrainerStore, useMedalStore, checkAllMedalsRetroactive } from '@/lib/store';
import { milestoneMedals, evolvingMedals, isCloseToEvolving, getEvolutionGlowClass, getEvolutionFrameClass, getNextEvolutionThreshold, isTrainerMedal } from '@/lib/medals';
import { calculateFullStrengthRating, getTierColor, getTierBgColor, getTierName } from '@/lib/strengthRating';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WeeklyReportPreviewCard } from '@/components/WeeklyReportPreviewCard';
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
  CalendarRange,
  Edit,
  Share2,
  MessageCircle,
  Trash2,
  FileText,
  Heart,
  ArrowLeftRight,
  Bell,
  Eye,
  Lock,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getClientDisplayInfo } from '@/lib/clientUtils';
import { convertProgramDayToTemplate, parseRepsPerSet } from '@/lib/programStartUtils';
import { __shouldSkipClientFetch } from '@/lib/modeAwareFetchGate';
import { isEventCompleted, getOrCreateSessionWorkoutForEvent, type SessionWorkoutResult } from '@/lib/sessionWorkoutResolver';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday as isDateToday } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';

export default function TodayPage() {
  const router = useRouter();
  const { user, isAuthenticated, switchMode } = useAuthStore();
  const { activeWorkout, workoutHistory, startWorkout, startFromTemplate, templates, personalBests, volumeRollups } = useWorkoutStore();
  const { medals } = useMedalStore();
  const { calendarEvents, getScheduledSessionsForUser, getEventsForDate, clients, sessions, payments, sessionWorkouts, clientPrograms, deleteCalendarEvent, getNextProgramWorkout, loadClientDataFromSupabase } = useTrainerStore();

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('today-selected-date');
      if (saved) {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return new Date();
  });

  // Persist selected date to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('today-selected-date', selectedDate.toISOString());
  }, [selectedDate]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [showStartOptions, setShowStartOptions] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [dailySteps, setDailySteps] = useState<number>(0);
  const [stepsGoal] = useState(10000);
  const [showDateConfirm, setShowDateConfirm] = useState(false);
  const [pendingStartEvent, setPendingStartEvent] = useState<any>(null);
  const [profileCardClientId, setProfileCardClientId] = useState<string | null>(null);
  const [showSwapWorkout, setShowSwapWorkout] = useState(false);
  const [repeatDayConfirm, setRepeatDayConfirm] = useState<{ idx: number; day: any } | null>(null);
  // v16-D5 BUG-20: confirm dialog for back-to-back workouts on flexible programs.
  // When the client has already hit their weekly target (or finished a workout
  // today) and wants to start another one anyway, this dialog explains the
  // tradeoff and lets them proceed instead of silently blocking.
  const [showSameDayConfirm, setShowSameDayConfirm] = useState<{ idx: number; day: any } | null>(null);
  // v14-D29: preview dialog for the Up Next card. Lets the client peek at
  // the day's exercises (block by block) before tapping Start, without
  // committing to the active workout timer.
  const [previewDay, setPreviewDay] = useState<{ day: any; programName: string } | null>(null);
  const { updateCalendarEvent } = useTrainerStore();
  const startingSessionRef = useRef<string | null>(null);
  const [startingEventId, setStartingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // No longer auto-redirect to active workout — bottom bar handles re-entry

  // Load client programs + calendar events from Supabase, and re-load
  // whenever the tab regains focus/visibility so a freshly-assigned
  // program shows up without requiring a full page reload.
  //
  // D14: gate is keyed on `user.mode` (live Athlete/Trainer toggle) via
  // __shouldSkipClientFetch — NOT the permanent `user.isTrainer` role
  // flag. Dual-mode accounts (trainers who are also clients of another
  // trainer) must see programs assigned to them after switching to
  // Athlete mode. Shared pure helper — see src/lib/modeAwareFetchGate.ts.
  useEffect(() => {
    if (__shouldSkipClientFetch(user)) return;
    const uid = user!.id!;
    console.log('[Today] fetch with uid:', uid);
    loadClientDataFromSupabase(uid);

    const refetch = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Today] 🔄 Foreground refetch for', uid);
        loadClientDataFromSupabase(uid);
      }
    };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', refetch);
    return () => {
      window.removeEventListener('focus', refetch);
      document.removeEventListener('visibilitychange', refetch);
    };
  }, [user?.id, user?.mode]);

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

  // Shared session start handler — uses canonical resolver, no dangerous fallbacks
  const handleStartSessionEvent = async (event: any, eventType: string, displayName: string) => {
    // Debounce + loading guard
    if (startingEventId) return;
    setStartingEventId(event.id);

    try {
      if (eventType === 'workout' && !event.clientId) {
        // Solo workout — start empty
        startWorkout('Solo Training');
        router.push('/workout/active');
        return;
      }

      if (eventType !== 'session') {
        // Non-session event type with no special handling — start empty for client
        startWorkout(`Session - ${displayName}`, undefined, event.clientId || undefined);
        router.push('/workout/active');
        return;
      }

      // Session event: use canonical resolver
      const program = event.clientId
        ? clientPrograms.find(p => p.clientId === event.clientId && p.status === 'active')
        : null;

      // v15-D8: derive the program-source tag from the calendar event so the
      // completed workout carries sourceProgramId/sourceDayIndex. Without
      // this, matchesProgram(w) misses and the day never lands in
      // completedDayIndices.
      const programSource = program && typeof event.programDayIndex === 'number'
        ? { programId: program.id, dayIndex: event.programDayIndex as number }
        : undefined;

      const sw = await getOrCreateSessionWorkoutForEvent(
        event.id,
        user?.id || '',
        event.clientId || '',
        program ? { weeklyPlan: program.weeklyPlan, programId: program.id, programDayIndex: event.programDayIndex } : undefined,
      );

      if (sw && sw.blocks && sw.blocks.length > 0) {
        // Convert builder block format to WorkoutExercise format
        const hasExercises = sw.blocks.some((b: any) => (b.exercises || []).length > 0);
        if (hasExercises) {
          const exercises = sw.blocks.flatMap((block: any) =>
            (block.exercises || []).map((ex: any) => {
              const setCount = typeof ex.sets === 'number' ? ex.sets : (Array.isArray(ex.sets) ? ex.sets.length : 3);
              const repsPerSet = parseRepsPerSet(ex.reps, setCount);
              const setsArray = Array.isArray(ex.sets) ? ex.sets : Array.from({ length: setCount }, (_, si) => ({
                id: `set-${Date.now()}-${si}-${Math.random().toString(36).substr(2, 5)}`,
                setNumber: si + 1,
                type: 'normal',
                targetReps: repsPerSet[si],
                reps: repsPerSet[si],
                weight: 0,
                completed: false,
              }));
              return {
                id: ex.id || `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                exerciseId: ex.exerciseId || ex.id,
                exercise: {
                  id: ex.exerciseId || ex.id,
                  name: ex.exerciseName || ex.name || 'Exercise',
                  category: 'strength',
                  muscleGroups: [],
                },
                sets: setsArray,
                restTimerSeconds: parseInt(ex.rest) || 90,
                notes: ex.notes || '',
              };
            })
          );
          startFromTemplate({
            id: `session-${event.id}`,
            name: sw.name || `Session - ${displayName}`,
            description: 'PT Session',
            exercises,
            blocks: sw.blocks,
            category: 'strength',
            estimatedDuration: 60,
            isClientSession: true,
            clientId: event.clientId,
            trainerId: user?.id,
          } as any, event.clientId || undefined, programSource);
          router.push('/workout/active');
          return;
        }
      }

      // Resolved but empty blocks — start empty session for client
      // v15-D8: when the event carries a program-day attachment, route the
      // empty-session fallback through startFromTemplate so the resulting
      // workout still gets tagged with sourceProgramId/sourceDayIndex.
      // startWorkout has no source param and we don't want to widen its
      // signature in this dispatch.
      if (programSource) {
        startFromTemplate({
          id: `session-${event.id}`,
          name: sw?.name || `Session - ${displayName}`,
          description: 'PT Session',
          exercises: [],
          blocks: sw?.blocks || [],
          category: 'strength',
          estimatedDuration: 60,
          isClientSession: true,
          clientId: event.clientId,
          trainerId: user?.id,
        } as any, event.clientId || undefined, programSource);
      } else {
        startWorkout(
          sw?.name || `Session - ${displayName}`,
          undefined,
          event.clientId || undefined,
        );
      }
      router.push('/workout/active');
    } finally {
      setStartingEventId(null);
    }
  };

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

  // Smart medal progress — show achievement/count based progress only (no weight-based)
  const earnedIds = new Set(userMedals.map(m => m.definitionId));
  const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const pbCount = personalBests.filter(pb => pb.userId === user.id).length;

  const closestUnearned = userWorkouts.length > 0
    ? milestoneMedals
        .filter(def => !earnedIds.has(def.id) && !isTrainerMedal(def.id))
        // Exclude weight-based medals (bench/squat/deadlift kg progress)
        .filter(def => !def.id.startsWith('bench-') && !def.id.startsWith('squat-') && !def.id.startsWith('deadlift-'))
        .map(def => {
          let current = 0;
          const target = def.target || 1;
          let progressLabel = '';
          if (def.id.startsWith('first-blood') || def.id === 'getting-started' || def.id === 'dedicated' || def.id === 'committed' || def.id === 'centurion') {
            current = userWorkouts.length;
            progressLabel = `${Math.max(target - current, 0)} more workout${target - current !== 1 ? 's' : ''} to go`;
          } else if (def.id.startsWith('volume-')) {
            current = Math.round(totalVolume);
            const remaining = Math.max(target - current, 0);
            progressLabel = `${remaining.toLocaleString()} kg volume to go`;
          } else if (def.id.startsWith('streak-')) {
            current = currentStreak;
            progressLabel = `${Math.max(target - current, 0)} more week${target - current !== 1 ? 's' : ''} streak needed`;
          } else if (def.id === 'first-pr' || def.id === 'pr-hunter' || def.id === 'pr-collector') {
            current = pbCount;
            progressLabel = `${Math.max(target - current, 0)} more PR${target - current !== 1 ? 's' : ''} to go`;
          } else if (def.id === 'variety-king') {
            const uniqueExercises = new Set(userWorkouts.flatMap(w => w.exercises?.map(e => e.exerciseId) || []));
            current = uniqueExercises.size;
            progressLabel = `${Math.max(target - current, 0)} more exercises to try`;
          } else if (def.id === 'weekly-warrior') {
            current = weekWorkouts.length;
            progressLabel = `${Math.max(target - current, 0)} more this week`;
          } else {
            current = 0;
            progressLabel = '';
          }
          const pct = Math.round((current / target) * 100);
          const remaining = Math.max(target - current, 0);
          return { ...def, current, pct, remaining, progressLabel };
        })
        .filter(m => m.pct > 0 && m.pct < 100)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 3)
    : [];

  // Strength rating — pure strength score from free weight PRs
  const strengthRating = personalBests.length > 0 ? calculateFullStrengthRating(personalBests) : null;

  const allTemplates = [...defaultTemplates, ...templates];

  const handleStartEmpty = () => {
    startWorkout('Quick Workout');
    router.push('/workout/active');
  };

  const handleStartWithType = (type: 'strength' | 'circuit' | 'cardio') => {
    const names = { strength: 'Strength', circuit: 'Circuit', cardio: 'Cardio' };
    startWorkout(names[type], undefined, undefined, type);
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

  // Check if day had workouts or trainer events (for calendar dots)
  const dayHasWorkout = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const hasPersonalWorkout = userWorkouts.some(w => format(new Date(w.startTime), 'yyyy-MM-dd') === dateStr);
    const hasTrainerEvent = user.isTrainer && getEventsForDate(dateStr).some(e => e.trainerId === user.id && e.status !== 'cancelled');
    return hasPersonalWorkout || hasTrainerEvent;
  };

  return (
    <MainLayout>
      <PageHeader 
        title={isToday ? 'Today' : format(selectedDate, 'EEEE')}
        subtitle={format(selectedDate, 'MMMM d, yyyy')}
      />

      <div className="px-4 py-4 space-y-5">
        {/* User/Trainer Mode Toggle — only shown for trainers */}
        {user.isTrainer && (
          <div className="flex items-center justify-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200">
            <button
              onClick={() => switchMode('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                user.mode !== 'trainer'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              Athlete
            </button>
            <button
              onClick={() => switchMode('trainer')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                user.mode === 'trainer'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Trainer
            </button>
          </div>
        )}
        {/* Quick Actions — trainer mode only */}
        {user.mode === 'trainer' && <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-auto py-5 bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 flex flex-col items-center gap-2 rounded-2xl shadow-lg shadow-rose-500/20"
                  onClick={() => router.push('/clients')}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-bold text-sm">Clients</span>
                </Button>
                <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-auto py-5 bg-gray-50 border-gray-200 hover:bg-gray-100 flex flex-col items-center gap-2 rounded-2xl"
                    >
                      <Calendar className="w-5 h-5 text-sky-500" />
                      <span className="font-semibold text-sm text-gray-700">Book</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-gray-200 max-w-xs">
                    <DialogHeader>
                      <DialogTitle className="text-gray-900">Book</DialogTitle>
                      <DialogDescription>Choose an option</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <Button
                        className="w-full justify-start gap-3 h-12 bg-sky-500 hover:bg-sky-600"
                        onClick={() => {
                          setShowBookDialog(false);
                          router.push('/calendar?action=book');
                        }}
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-semibold">Book Now</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-12 border-gray-200 hover:bg-gray-50"
                        onClick={() => {
                          setShowBookDialog(false);
                          router.push('/calendar');
                        }}
                      >
                        <Calendar className="w-5 h-5 text-gray-500" />
                        <span className="font-semibold text-gray-700">Access Calendar</span>
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>}

        {/* Calendar Day Strip */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-700 flex-shrink-0"
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
                      : 'text-gray-500 hover:bg-gray-100'
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
            className="h-8 w-8 text-gray-400 hover:text-gray-700 flex-shrink-0"
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

        {/* Next Workout — client mode, active program (today only).
            v14-D26: hoisted from below the weekly-report card so the Up
            Next + Swap UI is the FIRST client-mode section. Was buried
            below stats / completed / PT sessions / weekly report and
            users never saw it. The diagnostic console.log inside fires
            every render of /today so if the card still doesn't appear
            we can see which condition (userMode / isToday / next) is
            falsy. */}
        {user.mode !== 'trainer' && isToday && (() => {
          const next = getNextProgramWorkout(user.id);
          // v14-D26: diagnostic — remove after Christo confirms card renders
          console.log('[Today] Up Next card check:', {
            userId: user.id,
            userMode: user.mode,
            isToday,
            next: next ? {
              programId: next.program.id,
              scheduleMode: next.program.scheduleMode,
              weeklyPlanLength: next.program.weeklyPlan?.length,
              remainingThisWeek: next.remainingThisWeek,
              isScheduledToday: next.isScheduledToday,
            } : null,
          });
          if (!next) return null;
          const { program, dayIndex, day, remainingThisWeek, sessionType, completedDayIndices, lockedDayIndices, lockReasons, isScheduledToday, nextScheduledDay } = next;

          // v16-D4: build a "This week's locked sessions" list so /today always
          // surfaces an explicit explanation when the trainer has program days
          // booked — even when the Up Next card itself has skipped past them.
          // Sort by booking date so the soonest one renders at the top.
          const lockedSessions = Object.entries(lockReasons || {})
            .map(([idxStr, reason]) => ({
              idx: Number(idxStr),
              reason,
              dayLabel: program.weeklyPlan[Number(idxStr)]?.dayLabel || `Day ${String.fromCharCode(65 + Number(idxStr))}`,
            }))
            .filter(item => !!item.reason)
            .sort((a, b) => {
              const ka = `${a.reason.eventDate || ''}T${a.reason.eventStartTime || '23:59'}`;
              const kb = `${b.reason.eventDate || ''}T${b.reason.eventStartTime || '23:59'}`;
              return ka.localeCompare(kb);
            });
          const lockedSessionsCallout = lockedSessions.length > 0 ? (
            <Card key="v16d4-locked-callout" className="bg-purple-50 border-purple-200 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-purple-600" />
                  <p className="text-xs font-semibold text-purple-900">
                    This week’s booked PT sessions
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {lockedSessions.map(item => {
                    const whenLabel = item.reason.eventDate
                      ? format(new Date(item.reason.eventDate), 'EEE MMM d')
                      : 'this week';
                    const time = item.reason.eventStartTime
                      ? ` · ${item.reason.eventStartTime}`
                      : '';
                    return (
                      <li key={`locked-${item.idx}`} className="flex items-start gap-1.5 text-[11px] text-purple-800">
                        <Lock className="w-3 h-3 mt-0.5 flex-shrink-0 text-purple-500" />
                        <span>
                          <span className="font-medium">{item.dayLabel}</span>{' '}
                          booked with{' '}
                          <span className="font-medium">{item.reason.trainerName}</span>
                          {' — '}{whenLabel}{time}
                          {' · '}
                          <span className="text-purple-600">locked from self-start</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null;

          // v15-D4: helper used by swap-day buttons — when a client taps a
          // day that's locked because the trainer has it booked, surface a
          // toast explaining why and do NOT start the workout.
          const handleLockedDayTap = (lockedIdx: number, wd: any) => {
            const lockedEvent = useTrainerStore.getState().calendarEvents.find((e: any) =>
              e.clientId === user.id &&
              e.type === 'session' &&
              e.status !== 'cancelled' &&
              e.programId === program.id &&
              e.programDayIndex === lockedIdx,
            );
            const when = lockedEvent?.date
              ? format(new Date(lockedEvent.date), 'EEE MMM d')
              : 'this week';
            toast.info(`${wd?.dayLabel || 'This day'} is booked with your trainer (${when}). Pick another workout or log a standalone session.`);
          };

          const totalEx = day?.blocks?.reduce((s: number, b: any) => s + (b.exercises?.length || 0), 0) || 0;
          
          // Helper to start a specific program day
          const startDay = (idx: number, d: any) => {
            const template = convertProgramDayToTemplate(d, {
              programId: program.id,
              dayIndex: idx,
              programName: program.templateName,
              userId: user.id,
            });
            if (template.exercises.length > 0) {
              // D17: tag with source program + day so the finish-time
              // "Save changes to program?" flow fires reliably.
              startFromTemplate(template as any, undefined, {
                programId: program.id,
                dayIndex: idx,
              });
              router.push('/workout/active');
            }
          };
          
          // Badge label: only show "PT Session" if explicitly marked PT, otherwise "Program"
          const badgeLabel = sessionType === 'pt' ? 'PT Session' : 'Program';
          const badgeClass = sessionType === 'pt' ? 'bg-purple-500/20 text-purple-600' : 'bg-sky-500/20 text-sky-600';
          
          if (remainingThisWeek <= 0) {
            // v16-D5 BUG-20: on flexible programs, surface a "Do another
            // workout anyway?" affordance so the client isn't silently
            // blocked from doing extra work this week. Picks the next
            // workout in the cycle and routes through a confirm dialog
            // so the tradeoff (no weekly-goal credit) is explicit.
            const allowExtraOnFlex = program.scheduleMode === 'flexible';
            // Choose the next workout in the cycle for the extra session.
            // dayIndex is already cycle-aware via getNextProgramWorkout.
            const extraDay = day;
            const extraDayIdx = dayIndex;
            return (
              <>
                {lockedSessionsCallout}
                <Card className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30">
                  <CardContent className="p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                      <Check className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="font-semibold text-gray-900">All done this week! 🎉</p>
                    <p className="text-xs text-gray-500 mt-1">{program.trainingDaysPerWeek || program.weeklyPlan.length} sessions completed. Rest up for next week.</p>
                    {allowExtraOnFlex && extraDay && (
                      <div className="mt-3 flex flex-col gap-2 items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setShowSameDayConfirm({ idx: extraDayIdx, day: extraDay })}
                        >
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          Do another workout anyway
                        </Button>
                        <p className="text-[10px] text-gray-500">
                          Back-to-back is fine on flexible plans — just won't count toward your weekly goal.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* v16-D5 BUG-20: shared same-day confirm dialog. */}
                <Dialog open={!!showSameDayConfirm} onOpenChange={(open) => !open && setShowSameDayConfirm(null)}>
                  <DialogContent className="bg-white border-gray-200 max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-gray-900">Start another workout today?</DialogTitle>
                      <DialogDescription className="text-gray-500">
                        You've already hit your weekly target. Doing back-to-back days can work for some training plans, but make sure you're recovered enough. This extra session won't count toward your weekly goal.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowSameDayConfirm(null)}
                      >
                        Wait until tomorrow
                      </Button>
                      <Button
                        className="flex-1 bg-sky-500 hover:bg-sky-600"
                        onClick={() => {
                          if (showSameDayConfirm) {
                            const target = showSameDayConfirm;
                            setShowSameDayConfirm(null);
                            startDay(target.idx, target.day);
                          }
                        }}
                      >
                        Start anyway
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            );
          }
          
          // FLEXIBLE schedule — show only today's workout with swap option
          if (program.scheduleMode === 'flexible') {
            // Only offer swaps for days that actually have exercises, aren't the current day,
            // and aren't already completed this week
            const availableSwaps = program.weeklyPlan
              .map((wd: any, idx: number) => ({ ...wd, idx }))
              .filter((wd: any, idx: number) => {
                const count = wd?.blocks?.reduce((s: number, b: any) => s + (b.exercises?.length || 0), 0) || 0;
                return count > 0 && idx !== dayIndex;
              });
            
            // v15-D4: "all program days either done or booked this week" empty
            // state. Means there are sessions left in the weekly target but
            // every remaining day is taken by a trainer booking, so the
            // client shouldn't be nudged to start anything from the program.
            const allDaysBlocked = remainingThisWeek > 0
              && (completedDayIndices.length + lockedDayIndices.length) >= program.weeklyPlan.length;
            if (allDaysBlocked) {
              return (
                <>
                  {lockedSessionsCallout}
                  <Card className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-purple-500/30">
                    <CardContent className="p-4 text-center">
                      <Calendar className="w-5 h-5 text-purple-500 mx-auto mb-2" />
                      <p className="font-semibold text-gray-900 text-sm">All program days booked or done this week.</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Want extra work? Log a standalone workout from /workout.
                      </p>
                    </CardContent>
                  </Card>
                </>
              );
            }

            return (
              <>
                {lockedSessionsCallout}
                <Card className="bg-gradient-to-r from-sky-500/10 to-blue-500/10 border-sky-500/30 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                          <Dumbbell className="w-5 h-5 text-sky-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">{program.templateName}</p>
                          <h3 className="font-semibold text-gray-900">{day?.dayLabel || 'Workout'}</h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-[10px] border-0 ${badgeClass}`}>{badgeLabel}</Badge>
                        <p className="text-xs text-gray-500 mt-0.5">{remainingThisWeek} left this week</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{totalEx} exercises</p>
                    {/* v14-D29: Preview button beside Start so the client can
                        peek at the day's exercises before committing to the
                        active workout timer. Sits next to Swap when present. */}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
                        onClick={() => startDay(dayIndex, day)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start {day?.dayLabel || 'Workout'}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-gray-200 text-gray-600"
                        onClick={() => setPreviewDay({ day, programName: program.templateName })}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      {availableSwaps.length > 0 && (
                        <Button
                          variant="outline"
                          className="border-gray-200 text-gray-600"
                          onClick={() => setShowSwapWorkout(true)}
                        >
                          <ArrowLeftRight className="w-4 h-4 mr-1" />
                          Swap
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Swap Workout Dialog */}
                <Dialog open={showSwapWorkout} onOpenChange={setShowSwapWorkout}>
                  <DialogContent className="bg-white border-gray-200 max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-gray-900">Swap Workout</DialogTitle>
                      <DialogDescription className="text-gray-500">Pick a different workout for today</DialogDescription>
                      <div className="text-xs text-gray-500 px-1 pt-1">
                        You've done {completedDayIndices.length} of {program.trainingDaysPerWeek || program.weeklyPlan.length} workouts this week.
                        Pick the next one or repeat one you've already done.
                      </div>
                    </DialogHeader>
                    <div className="space-y-2 pt-1">
                      {program.weeklyPlan.map((wd: any, idx: number) => {
                        const wdEx = wd?.blocks?.reduce((s: number, b: any) => s + (b.exercises?.length || 0), 0) || 0;
                        const isDone = completedDayIndices.includes(idx);
                        // v15-D4: locked = trainer has booked PT for this day
                        // this week. Done beats locked in display precedence.
                        const isLocked = !isDone && lockedDayIndices.includes(idx);
                        const isCurrent = idx === dayIndex;
                        if (wdEx === 0) return null;
                        return (
                          <button
                            key={wd.id || idx}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                              isDone
                                ? 'border-gray-200 bg-gray-50 opacity-60'
                                : isLocked
                                ? 'border-purple-200 bg-purple-50 cursor-not-allowed'
                                : isCurrent
                                ? 'border-sky-300 bg-sky-50'
                                : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50/50'
                            }`}
                            onClick={() => {
                              if (isDone) {
                                setRepeatDayConfirm({ idx, day: wd });
                              } else if (isLocked) {
                                handleLockedDayTap(idx, wd);
                              } else {
                                setShowSwapWorkout(false);
                                startDay(idx, wd);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                isLocked ? 'bg-purple-500 text-white' :
                                isCurrent ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {isLocked ? <Lock className="w-3.5 h-3.5" /> : String.fromCharCode(65 + idx)}
                              </div>
                              <div>
                                <p className="font-medium text-sm text-gray-900">{wd.dayLabel}</p>
                                <p className="text-[10px] text-gray-500">{wdEx} exercises</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isDone && <Badge className="text-[9px] bg-gray-100 text-gray-500 border-0">Done this week</Badge>}
                              {isLocked && (() => {
                                // v16-D4: name the trainer in the swap-dialog badge.
                                const r = lockReasons?.[idx];
                                const whenLabel = r?.eventDate ? format(new Date(r.eventDate), 'EEE MMM d') : '';
                                return (
                                  <Badge
                                    className="text-[9px] bg-purple-100 text-purple-700 border-0"
                                    title={r ? `Booked with ${r.trainerName}${whenLabel ? ` — ${whenLabel}` : ''}${r.eventStartTime ? ` ${r.eventStartTime}` : ''}` : undefined}
                                  >
                                    Booked with {r?.trainerName || 'trainer'}
                                  </Badge>
                                );
                              })()}
                              {isCurrent && !isDone && !isLocked && <Badge className="text-[9px] bg-sky-500/20 text-sky-600 border-0">Suggested</Badge>}
                              <Play className="w-4 h-4 text-gray-400" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Repeat Day Confirmation Dialog */}
                <Dialog open={!!repeatDayConfirm} onOpenChange={(open) => !open && setRepeatDayConfirm(null)}>
                  <DialogContent className="bg-white border-gray-200 max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-gray-900">Repeat this workout?</DialogTitle>
                      <DialogDescription className="text-gray-500">
                        You've already done {repeatDayConfirm?.day?.dayLabel} this week.
                        Doing it again is fine — just note it won't count toward your weekly goal of {program.trainingDaysPerWeek || program.weeklyPlan.length} sessions.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setRepeatDayConfirm(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-sky-500 hover:bg-sky-600"
                        onClick={() => {
                          if (repeatDayConfirm) {
                            setRepeatDayConfirm(null);
                            setShowSwapWorkout(false);
                            startDay(repeatDayConfirm.idx, repeatDayConfirm.day);
                          }
                        }}
                      >
                        Repeat anyway
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            );
          }
          
          // FIXED schedule — only show start button on scheduled days
          if (!isScheduledToday && program.scheduleMode === 'fixed') {
            return (
              <>
                {lockedSessionsCallout}
                <Card className="bg-gray-50 border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium">{program.templateName}</p>
                        <h3 className="font-semibold text-gray-900">Rest Day</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Next workout: <span className="font-medium text-sky-600 capitalize">{nextScheduledDay || 'soon'}</span>
                          {' '}— {day?.dayLabel || 'Workout'} ({totalEx} exercises)
                        </p>
                        {/* v16-D4 (BUG-19): explicit "Scheduled for [day]" badge so the
                            client immediately understands the Up Next card is showing
                            a future-day workout, not today's. Defence in depth for any
                            program where the cycle surfaces an off-day workout. */}
                        {nextScheduledDay && (
                          <Badge variant="outline" className="mt-1.5 text-[10px] text-gray-500 border-gray-300 inline-flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />
                            <span className="capitalize">Scheduled for {nextScheduledDay}</span>
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge className={`text-[10px] border-0 ${badgeClass}`}>{badgeLabel}</Badge>
                        <p className="text-xs text-gray-500 mt-0.5">{remainingThisWeek} left</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
                        onClick={() => startDay(dayIndex, day)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Skip to {nextScheduledDay || 'next'} ({day?.dayLabel})
                      </Button>
                      {/* v14-D29: Preview button on rest-day branch lets the
                          client peek at the upcoming workout they'd be
                          skipping to. */}
                      <Button
                        variant="outline"
                        className="border-gray-200 text-gray-600"
                        onClick={() => setPreviewDay({ day, programName: program.templateName })}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        className="border-gray-200 text-gray-600"
                        onClick={() => setShowSwapWorkout(true)}
                      >
                        <ArrowLeftRight className="w-4 h-4 mr-1" />
                        Pick different
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Swap Workout Dialog - shared with flexible mode above */}
              </>
            );
          }
          
          // FIXED schedule — today IS a scheduled day, show start button.
          // v16-D5 BUG-18: also surface Swap (pick a different workout)
          // matching the flexible/rest-day branches — the client view was
          // previously the only branch missing it.
          const fixedTodayAvailableSwaps = program.weeklyPlan
            .map((wd: any, idx: number) => ({ ...wd, idx }))
            .filter((wd: any, idx: number) => {
              const count = wd?.blocks?.reduce((s: number, b: any) => s + (b.exercises?.length || 0), 0) || 0;
              return count > 0 && idx !== dayIndex;
            });
          return (
            <>
              {lockedSessionsCallout}
              <Card className="bg-gradient-to-r from-sky-500/10 to-blue-500/10 border-sky-500/30 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-sky-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Today's Workout</p>
                      <h3 className="font-semibold text-gray-900">{day?.dayLabel || 'Workout'}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={`text-[10px] border-0 ${badgeClass}`}>{badgeLabel}</Badge>
                    <p className="text-xs text-gray-500 mt-0.5">{remainingThisWeek} more this week</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs text-gray-500">{totalEx} exercises • {program.templateName}</p>
                </div>
                {/* v14-D29 + v16-D5 BUG-18: Start + Preview + Swap row.
                    Previously only had Start + Preview — added Swap so client
                    parity matches the flexible/rest-day branches and trainer view. */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
                    onClick={() => startDay(dayIndex, day)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start {day?.dayLabel || 'Workout'}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-200 text-gray-600"
                    onClick={() => setPreviewDay({ day, programName: program.templateName })}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  {fixedTodayAvailableSwaps.length > 0 && (
                    <Button
                      variant="outline"
                      className="border-gray-200 text-gray-600"
                      onClick={() => setShowSwapWorkout(true)}
                    >
                      <ArrowLeftRight className="w-4 h-4 mr-1" />
                      Swap
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* v16-D5 BUG-18: shared Swap Workout + Repeat dialogs so the
                fixed-scheduled-today branch's Swap button is wired to a real
                dialog. Mirrors the dialog markup in the flexible branch. */}
            <Dialog open={showSwapWorkout} onOpenChange={setShowSwapWorkout}>
              <DialogContent className="bg-white border-gray-200 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">Swap Workout</DialogTitle>
                  <DialogDescription className="text-gray-500">Pick a different workout for today</DialogDescription>
                  <div className="text-xs text-gray-500 px-1 pt-1">
                    You've done {completedDayIndices.length} of {program.trainingDaysPerWeek || program.weeklyPlan.length} workouts this week.
                    Pick the next one or repeat one you've already done.
                  </div>
                </DialogHeader>
                <div className="space-y-2 pt-1">
                  {program.weeklyPlan.map((wd: any, idx: number) => {
                    const wdEx = wd?.blocks?.reduce((s: number, b: any) => s + (b.exercises?.length || 0), 0) || 0;
                    const isDone = completedDayIndices.includes(idx);
                    const isLocked = !isDone && lockedDayIndices.includes(idx);
                    const isCurrent = idx === dayIndex;
                    if (wdEx === 0) return null;
                    return (
                      <button
                        key={wd.id || idx}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                          isDone
                            ? 'border-gray-200 bg-gray-50 opacity-60'
                            : isLocked
                            ? 'border-purple-200 bg-purple-50 cursor-not-allowed'
                            : isCurrent
                            ? 'border-sky-300 bg-sky-50'
                            : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50/50'
                        }`}
                        onClick={() => {
                          if (isDone) {
                            setRepeatDayConfirm({ idx, day: wd });
                          } else if (isLocked) {
                            handleLockedDayTap(idx, wd);
                          } else {
                            setShowSwapWorkout(false);
                            startDay(idx, wd);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isLocked ? 'bg-purple-500 text-white' :
                            isCurrent ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : String.fromCharCode(65 + idx)}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{wd.dayLabel}</p>
                            <p className="text-[10px] text-gray-500">{wdEx} exercises</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isDone && <Badge className="text-[9px] bg-gray-100 text-gray-500 border-0">Done this week</Badge>}
                          {isLocked && (() => {
                            const r = lockReasons?.[idx];
                            const whenLabel = r?.eventDate ? format(new Date(r.eventDate), 'EEE MMM d') : '';
                            return (
                              <Badge
                                className="text-[9px] bg-purple-100 text-purple-700 border-0"
                                title={r ? `Booked with ${r.trainerName}${whenLabel ? ` — ${whenLabel}` : ''}${r.eventStartTime ? ` ${r.eventStartTime}` : ''}` : undefined}
                              >
                                Booked with {r?.trainerName || 'trainer'}
                              </Badge>
                            );
                          })()}
                          {isCurrent && !isDone && !isLocked && <Badge className="text-[9px] bg-sky-500/20 text-sky-600 border-0">Suggested</Badge>}
                          <Play className="w-4 h-4 text-gray-400" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={!!repeatDayConfirm} onOpenChange={(open) => !open && setRepeatDayConfirm(null)}>
              <DialogContent className="bg-white border-gray-200 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">Repeat this workout?</DialogTitle>
                  <DialogDescription className="text-gray-500">
                    You've already done {repeatDayConfirm?.day?.dayLabel} this week.
                    Doing it again is fine — just note it won't count toward your weekly goal of {program.trainingDaysPerWeek || program.weeklyPlan.length} sessions.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setRepeatDayConfirm(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-sky-500 hover:bg-sky-600"
                    onClick={() => {
                      if (repeatDayConfirm) {
                        setRepeatDayConfirm(null);
                        setShowSwapWorkout(false);
                        startDay(repeatDayConfirm.idx, repeatDayConfirm.day);
                      }
                    }}
                  >
                    Repeat anyway
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </>
          );
        })()}

        {/* Today's Stats Row — user mode only */}
        {user.mode !== 'trainer' && (
        <div className="grid grid-cols-4 gap-2">
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3 text-center">
              <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{currentStreak}</p>
              <p className="text-[10px] text-gray-500">Week Streak</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3 text-center">
              <Dumbbell className="w-4 h-4 text-sky-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{weekWorkouts.length}</p>
              <p className="text-[10px] text-gray-500">This Week</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3 text-center">
              <Clock className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{weekMinutes}</p>
              <p className="text-[10px] text-gray-500">Minutes</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3 text-center">
              <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{weekVolume > 1000 ? `${(weekVolume / 1000).toFixed(0)}k` : weekVolume}</p>
              <p className="text-[10px] text-gray-500">Volume</p>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Steps Section — hidden until native app with health integrations */}

        {/* Today's Workouts — user mode only (trainer sees client workouts below) */}
        {user.mode !== 'trainer' && todayWorkouts.length > 0 && isToday && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Completed Today
            </h2>
            <div className="space-y-2">
              {todayWorkouts.map((workout) => {
                const isReleased = workout.reviewStatus === 'released';
                const isPending = workout.reviewStatus === 'pending';
                return (
                  <Card
                    key={workout.id}
                    className={`cursor-pointer hover:bg-gray-50 shadow-sm bg-white ${
                      isReleased
                        ? 'border-sky-400 ring-1 ring-sky-200'
                        : isPending
                          ? 'border-amber-300'
                          : 'border-green-500/30'
                    }`}
                    onClick={() => router.push(`/workout/${workout.id}`)}
                  >
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isReleased ? 'bg-sky-100' : isPending ? 'bg-amber-100' : 'bg-green-500/20'
                        }`}>
                          {isReleased ? (
                            <Bell className="w-4 h-4 text-sky-600" />
                          ) : isPending ? (
                            <Clock className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Dumbbell className="w-4 h-4 text-green-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{workout.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {isReleased
                              ? 'New summary from your coach'
                              : isPending
                                ? 'Awaiting coach review'
                                : `${workout.exercises.length} exercises • ${workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}`
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isReleased ? (
                          <Badge className="bg-sky-500 text-white text-[10px]">New</Badge>
                        ) : isPending ? (
                          <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px]">Pending</Badge>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-700 text-xs">Done</Badge>
                        )}
                        {/* v15-D3: explicit Summary button — parity with trainer post-workout
                            summary discoverability. The whole Card stays clickable too (kept
                            for muscle-memory) but this button is the visible affordance the
                            user expects. Stops propagation so the Card onClick doesn't
                            double-fire. Pending cards omit it — no summary to view yet. */}
                        {!isPending && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[11px] border-gray-200 text-gray-700 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/workout/${workout.id}`);
                            }}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Summary
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Medals Earned Today — removed per user request */}

        {/* Booked PT Sessions — client view (purple) — STRICTLY type==='session' only */}
        {user.mode !== 'trainer' && (() => {
          const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
          const todayPTSessions = clientScheduledSessions.filter(s => {
            if (!s.date) return false;
            if (format(new Date(s.date), 'yyyy-MM-dd') !== selectedDateStr) return false;
            // Only actual PT sessions (type=session) — NOT program workouts
            return s.type === 'session';
          });
          if (todayPTSessions.length === 0) return null;
          return (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Booked Sessions
              </h2>
              {todayPTSessions.map(session => (
                <Card key={session.id} className="border-purple-300 bg-gradient-to-r from-purple-500/10 to-violet-500/10 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{session.title || 'PT Session'}</h3>
                          <p className="text-xs text-gray-500">
                            {session.startTime && session.endTime
                              ? `${session.startTime} – ${session.endTime}`
                              : 'Time TBC'}
                            {session.duration ? ` • ${session.duration}min` : ''}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-purple-500/20 text-purple-600 border-0 text-[10px]">
                        PT Session
                      </Badge>
                    </div>
                    {session.notes && (
                      <p className="text-xs text-gray-500 mt-2 pl-[52px]">{session.notes}</p>
                    )}
                    {!session.clientConfirmed && (
                      <div className="mt-3 pl-[52px]">
                        <Button
                          size="sm"
                          className="bg-purple-500 hover:bg-purple-600 text-white text-xs h-7"
                          onClick={() => {
                            const { confirmSession } = useTrainerStore.getState();
                            confirmSession(session.id);
                            toast.success('Session confirmed!');
                          }}
                        >
                          <Check className="w-3 h-3 mr-1" /> Confirm
                        </Button>
                      </div>
                    )}
                    {session.clientConfirmed && (
                      <p className="text-[10px] text-purple-500 mt-2 pl-[52px]">✓ Confirmed</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>
          );
        })()}

        {/* v10-D5: Weekly Report Preview Card (athlete mode only) */}
        {user.mode !== 'trainer' && <WeeklyReportPreviewCard userId={user.id} />}

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
              <DialogContent className="bg-white border-gray-200 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">Start Workout</DialogTitle>
                  <DialogDescription className="text-gray-500">What are you training today?</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* Primary: 2×2 type grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { handleStartWithType('strength'); setShowStartOptions(false); }}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 hover:border-sky-400 hover:bg-sky-50 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-sky-100 group-hover:bg-sky-200 flex items-center justify-center transition-colors">
                        <Dumbbell className="w-6 h-6 text-sky-600" />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">Strength</span>
                      <span className="text-[10px] text-gray-400">Weights & sets</span>
                    </button>
                    <button
                      onClick={() => { handleStartWithType('circuit'); setShowStartOptions(false); }}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center transition-colors">
                        <Zap className="w-6 h-6 text-orange-600" />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">Circuit</span>
                      <span className="text-[10px] text-gray-400">Timer & rounds</span>
                    </button>
                    <button
                      onClick={() => { handleStartWithType('cardio'); setShowStartOptions(false); }}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 hover:border-rose-400 hover:bg-rose-50 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-rose-100 group-hover:bg-rose-200 flex items-center justify-center transition-colors">
                        <Heart className="w-6 h-6 text-rose-600" />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">Cardio</span>
                      <span className="text-[10px] text-gray-400">Run, bike, row</span>
                    </button>
                    <button
                      onClick={() => { handleStartEmpty(); setShowStartOptions(false); }}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                        <Plus className="w-6 h-6 text-purple-600" />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">Mixed</span>
                      <span className="text-[10px] text-gray-400">Build as you go</span>
                    </button>
                  </div>
                  {/* Secondary: From Template */}
                  <div className="border-t border-gray-100 pt-3">
                    <button
                      onClick={() => { setShowStartOptions(false); setShowTemplates(true); }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">From Template</p>
                        <p className="text-[10px] text-gray-400">Use a saved or pre-built workout</p>
                      </div>
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="h-auto py-6 bg-gray-50 border-gray-200 hover:bg-gray-100 flex flex-col items-center gap-2 rounded-2xl"
              onClick={() => router.push('/workout/history')}
            >
              <History className="w-6 h-6 text-gray-400" />
              <span className="font-semibold text-sm text-gray-700">History</span>
            </Button>
          </div>
        )}

        {/* Unified Timeline — shows in BOTH user and trainer mode for trainer users */}
        {user.isTrainer && (() => {
          // v16-D3 (BUG-4 / F1): each calendar event renders its own card,
          // regardless of sibling completion state for the same client/day.
          // The previous filter dropped events whose `trainerId` wasn't set
          // (e.g. synth events auto-created by workout completion) which
          // meant a manual booking made AFTER a completed session sometimes
          // failed to surface. Widen the match to also accept events owned
          // by this trainer via `ownerUserId` so no booking is hidden.
          const trainerEvents = getEventsForDate(selectedDateStr).filter(e => {
            const ownedByTrainer = (e.trainerId === user.id) || ((e as any).ownerUserId === user.id);
            return ownedByTrainer && e.status !== 'cancelled' && e.clientId !== user.id && e.type !== 'workout';
          });
          
          // Merge all events: upcoming first, completed below, each sub-sorted by time
          const allEvents = trainerEvents
            .sort((a, b) => {
              const aDone = workoutHistory.some(w => 
                w.userId === a.clientId && !w.deletedAt &&
                format(new Date(w.startTime), 'yyyy-MM-dd') === selectedDateStr
              );
              const bDone = workoutHistory.some(w => 
                w.userId === b.clientId && !w.deletedAt &&
                format(new Date(w.startTime), 'yyyy-MM-dd') === selectedDateStr
              );
              // Upcoming first, completed below
              if (aDone !== bDone) return aDone ? 1 : -1;
              // Within same group, sort by time
              return (a.startTime || '').localeCompare(b.startTime || '');
            });
          
          // Recent client completions
          const recentClientWorkouts = workoutHistory
            .filter(w => w.assignedBy === user.id && w.status === 'completed')
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
            .slice(0, 3);

          // Color config per event type
          // 'session' = client PT session (blue), 'consultation' = consultation (emerald), 'workout' = solo/personal (orange)
          const typeConfig: Record<string, { label: string; border: string; badge: string; badgeText: string; avatarBg: string; avatarText: string; accent: string }> = {
            session: { label: 'Client Session', border: 'border-sky-200', badge: 'bg-sky-500/10', badgeText: 'text-sky-500', avatarBg: 'bg-sky-100', avatarText: 'text-sky-600', accent: 'sky' },
            consultation: { label: 'Consultation', border: 'border-emerald-200', badge: 'bg-emerald-500/10', badgeText: 'text-emerald-500', avatarBg: 'bg-emerald-100', avatarText: 'text-emerald-600', accent: 'emerald' },
            workout: { label: 'Solo Training', border: 'border-orange-200', badge: 'bg-orange-500/10', badgeText: 'text-orange-500', avatarBg: 'bg-orange-100', avatarText: 'text-orange-600', accent: 'orange' },
            assessment: { label: 'Assessment', border: 'border-purple-200', badge: 'bg-purple-500/10', badgeText: 'text-purple-500', avatarBg: 'bg-purple-100', avatarText: 'text-purple-600', accent: 'purple' },
            rest: { label: 'Rest Day', border: 'border-gray-200', badge: 'bg-gray-500/10', badgeText: 'text-gray-500', avatarBg: 'bg-gray-100', avatarText: 'text-gray-600', accent: 'gray' },
          };
          
          return (
            <>
              {/* Unified Session Timeline */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {isToday ? "Today's Schedule" : `Schedule — ${format(selectedDate, 'MMM d')}`}
                  </h2>
                  <Badge variant="secondary" className="bg-sky-500/10 text-sky-500 text-xs">
                    {allEvents.length}
                  </Badge>
                </div>
                
                {allEvents.length > 0 ? (
                  <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                    {allEvents.map((event) => {
                      const eventType = event.type || 'session';
                      const config = typeConfig[eventType] || typeConfig.session;
                      const clientInfo = event.clientId ? getClientDisplayInfo(event.clientId) : null;
                      const displayName = clientInfo?.displayName || (event as any).contactName || event.title || 'New Client';
                      const initial = displayName[0] || '?';
                      const sessionDone = eventType === 'session' ? isEventCompleted(event) : false;
                      const completedWorkout = sessionDone ? workoutHistory.find(w => 
                        w.userId === event.clientId && 
                        !w.deletedAt &&
                        format(new Date(w.startTime), 'yyyy-MM-dd') === selectedDateStr
                      ) : null;
                      // Check if a workout has been assigned/created for this session.
                      // v15-D8: a session is "assigned" when either:
                      //   (a) a sessionWorkouts row exists (materialised by the start flow), OR
                      //   (b) the calendar event carries a program-day attachment, in
                      //       which case the workout will be reconstructed on Start.
                      // Recognise the program attachment immediately so the trainer's
                      // Today card doesn't show "No workout assigned" between booking
                      // and first Start.
                      const matchedWorkout = eventType === 'session' ? sessionWorkouts.find(
                        (sw: any) => sw.eventId === event.id
                      ) : null;
                      const hasProgramAttachment = eventType === 'session'
                        && !!(event as any).programId
                        && typeof (event as any).programDayIndex === 'number';
                      const hasWorkout = !!matchedWorkout || hasProgramAttachment;
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
                          className={`bg-white shadow-sm ${sessionDone ? 'border-green-200' : config.border} overflow-hidden transition-all`}
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
                                    <button onClick={(e) => { e.stopPropagation(); if (event.clientId) setProfileCardClientId(event.clientId); }}>
                                      <Avatar className="w-9 h-9 cursor-pointer hover:ring-2 hover:ring-sky-500/50 transition-all">
                                        <AvatarImage src={clientInfo?.profilePhoto} />
                                        <AvatarFallback className={`${config.avatarBg} ${config.avatarText} text-sm`}>
                                          {initial}
                                        </AvatarFallback>
                                      </Avatar>
                                    </button>
                                    <div>
                                      {event.clientId ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (user?.mode === 'trainer') {
                                              router.push(`/clients/${event.clientId}`);
                                            } else {
                                              setProfileCardClientId(event.clientId!);
                                            }
                                          }}
                                          className="font-medium text-gray-900 text-sm hover:text-sky-500 hover:underline transition-colors text-left"
                                        >
                                          {displayName}
                                        </button>
                                      ) : (
                                        <p className="font-medium text-gray-900 text-sm">{displayName}</p>
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
                                    <div className="flex items-center gap-1.5">
                                      <Badge 
                                        className="bg-green-500/20 text-green-400 text-xs cursor-pointer hover:bg-green-500/30 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (completedWorkout) {
                                            router.push(`/workout/${completedWorkout.id}`);
                                          }
                                        }}
                                      >
                                        <Check className="w-3 h-3 mr-1" /> Done
                                      </Badge>
                                      {completedWorkout && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-[10px] border-green-500/30 text-green-500 hover:bg-green-500/10"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/workout/${completedWorkout.id}`);
                                          }}
                                        >
                                          <FileText className="w-3 h-3 mr-1" /> Summary
                                        </Button>
                                      )}
                                    </div>
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
                                      disabled={startingEventId === event.id}
                                      className={`h-7 text-xs ${
                                        eventType === 'workout' 
                                          ? 'bg-orange-500 hover:bg-orange-600' 
                                          : 'bg-sky-500 hover:bg-sky-600'
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        
                                        // If not today, ask confirmation and update date
                                        if (!isDateToday(selectedDate)) {
                                          setPendingStartEvent({ event, eventType, displayName });
                                          setShowDateConfirm(true);
                                          return;
                                        }
                                        
                                        handleStartSessionEvent(event, eventType, displayName);
                                      }}
                                    >
                                      {startingEventId === event.id ? (
                                        <span className="animate-pulse">Starting...</span>
                                      ) : (
                                        <><Play className="w-3 h-3 mr-1" /> Start</>
                                      )}
                                    </Button>
                                  )}
                                </div>
                                {/* Delete button for any non-completed session */}
                                {!sessionDone && (
                                  <div className="flex justify-end mt-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[10px] text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteCalendarEvent(event.id);
                                        toast.success('Session removed');
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                                    </Button>
                                  </div>
                                )}
                                {/* Bottom row for sessions: workout status + create workout (trainer mode only) */}
                                {eventType === 'session' && !sessionDone && (
                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                      <Dumbbell className="w-3 h-3" />
                                      {matchedWorkout
                                        ? 'Workout assigned'
                                        : hasProgramAttachment
                                          ? 'Workout assigned (from program)'
                                          : 'No workout assigned'}
                                    </p>
                                    {matchedWorkout ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[11px] border-sky-500/30 text-sky-500 hover:bg-sky-500/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/workout/builder?workoutId=${matchedWorkout?.id}&eventId=${event.id}&clientId=${event.clientId}`);
                                        }}
                                      >
                                        <Edit className="w-3 h-3 mr-1" /> Edit Workout
                                      </Button>
                                    ) : hasProgramAttachment ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[11px] border-sky-500/30 text-sky-500 hover:bg-sky-500/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // v15-D8: there is no inline Edit Session dialog on this
                                          // surface yet; the brief's setEditingEvent reference was
                                          // aspirational. Route to the existing workout builder
                                          // with the event+client so the trainer can customise the
                                          // program-attached session workout there. The builder
                                          // materialises the session_workout row on save.
                                          if (event.clientId) {
                                            router.push(`/workout/builder?eventId=${event.id}&clientId=${event.clientId}`);
                                          }
                                        }}
                                      >
                                        <Edit className="w-3 h-3 mr-1" /> Customize
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[11px] border-gray-300 text-gray-500 hover:text-gray-900 hover:border-sky-500/50"
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
                                {/* Consultation: link to onboarding (trainer mode only) */}
                                {eventType === 'consultation' && (
                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                    <p className="text-xs text-emerald-500/70 flex items-center gap-1">
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
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="py-6 text-center">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        No sessions {isToday ? 'today' : `on ${format(selectedDate, 'MMM d')}`}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>

              {/* Recent Client Completions */}
              {recentClientWorkouts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Recent Client Completions
                  </h2>
                  <div className="space-y-2">
                    {recentClientWorkouts.map((workout) => {
                      const clientInfo = getClientDisplayInfo(workout.userId);
                      return (
                        <Card key={workout.id} className="bg-white border-gray-200 shadow-sm">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={clientInfo?.profilePhoto} />
                                <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                  {clientInfo?.displayName?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm text-gray-900">{clientInfo?.displayName || 'Client'}</p>
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
                <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
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
                        <div className={`relative w-14 h-14 mx-auto rounded-full flex items-center justify-center bg-gray-100 border border-gray-200 ${glowClass} ${frameClass}`}>
                          <span className="text-xl">{medal.icon}</span>
                          <span className="absolute -top-1 -right-1 text-[9px] bg-white border border-gray-200 rounded-full px-1 text-gray-600">{medal.timesEarned || 1}x</span>
                        </div>
                        <p className="text-[10px] text-gray-900 mt-1 font-medium truncate">{medal.name}</p>
                        <p className="text-[9px] text-gray-400">{evoCheck.remaining} to {nextLabel}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {closestUnearned.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  Closest Medals
                </h3>
                <div className="space-y-2">
                  {closestUnearned.map((def) => (
                    <div key={def.id} className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => router.push('/medals')}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 border border-gray-200 flex-shrink-0">
                        <span className="text-lg">{def.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-900 font-medium truncate">{def.name}</p>
                          <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">{def.pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${def.pct >= 75 ? 'bg-emerald-500' : def.pct >= 50 ? 'bg-sky-500' : 'bg-gray-400'}`}
                            style={{ width: `${def.pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {def.remaining <= 0 ? 'Almost there!' : (def.progressLabel || `${def.remaining} to go`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Pure Strength Rating removed — available on Profile page only */}

        {/* Recent Workouts — user mode only */}
        {user.mode !== 'trainer' && recentWorkouts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                <History className="w-4 h-4" />
                Recent Workouts
              </h2>
              <Button variant="ghost" size="sm" className="text-sky-500 text-xs h-7" onClick={() => router.push('/workout/history')}>
                See All
              </Button>
            </div>
            <div className="space-y-2">
              {recentWorkouts.map((workout) => {
                const isTrainerWorkout = !!workout.assignedBy;
                return (
                  <Card
                    key={workout.id}
                    className={`bg-white border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors border-l-2 ${
                      isTrainerWorkout ? 'border-l-rose-500' : 'border-l-sky-500'
                    }`}
                    onClick={() => router.push(`/workout/${workout.id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 text-sm">{workout.name}</h3>
                            <Badge className={`text-[10px] px-1.5 py-0 ${
                              isTrainerWorkout 
                                ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' 
                                : 'bg-sky-500/10 text-sky-500 border-sky-500/30'
                            }`}>
                              {isTrainerWorkout ? 'Trainer' : 'Solo'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            {format(new Date(workout.startTime), 'MMM d • h:mm a')} • {workout.exercises.length} exercises
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="bg-white border-gray-200 max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Workout Templates</DialogTitle>
            <DialogDescription>Choose a template to start</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-2">
              {allTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="bg-gray-50 border-gray-200 cursor-pointer hover:bg-gray-100"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-3">
                    <h3 className="font-medium text-gray-900 text-sm">{template.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
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
        <DialogContent className="bg-white border-gray-200 max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-2">
              {selectedTemplate?.exercises.map((ex, idx) => (
                <div key={ex.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500 font-semibold text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{ex.exercise.name}</p>
                    <p className="text-xs text-gray-500">{ex.sets.length} sets</p>
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
      {/* Date Confirmation Dialog — when starting a workout on a non-today date */}
      <Dialog open={showDateConfirm} onOpenChange={setShowDateConfirm}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Start Workout Today?</DialogTitle>
            <DialogDescription className="text-gray-500">
              This session is scheduled for {pendingStartEvent ? format(selectedDate, 'EEEE, MMM d') : ''}. 
              Start the workout now? The session date will be updated to today.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowDateConfirm(false);
                setPendingStartEvent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-sky-500 hover:bg-sky-600"
              onClick={() => {
                if (!pendingStartEvent) return;
                const { event, eventType, displayName } = pendingStartEvent;
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                
                // Update the calendar event date to today
                updateCalendarEvent(event.id, { date: todayStr });
                
                // Also move selectedDate to today
                setSelectedDate(new Date());
                
                // Now start the workout via canonical resolver
                handleStartSessionEvent(event, eventType, displayName);
                
                setShowDateConfirm(false);
                setPendingStartEvent(null);
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Start Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Client Profile Card Dialog */}
      <Dialog open={!!profileCardClientId} onOpenChange={(open) => { if (!open) setProfileCardClientId(null); }}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-sm mx-auto rounded-2xl p-0 overflow-hidden">
          {(() => {
            if (!profileCardClientId) return null;
            const pcInfo = getClientDisplayInfo(profileCardClientId);
            const pcWorkouts = workoutHistory.filter(w => w.userId === profileCardClientId && w.status === 'completed' && !w.deletedAt);
            const pcVolume = pcWorkouts.reduce((s, w) => s + (w.totalVolume || 0), 0);
            const pcMedals = medals.filter(m => m.userId === profileCardClientId && m.earned);
            const featuredMedals = pcMedals.slice(0, 3);
            const pcRating = personalBests.length > 0 ? calculateFullStrengthRating(personalBests.filter(pb => pb.userId === profileCardClientId)) : null;
            const tierName = pcRating ? getTierName(pcRating.tier) : null;
            const formatVol = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
            return (
              <div className="p-5 space-y-4">
                <DialogHeader>
                  <DialogTitle className="sr-only">Profile Card</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="w-14 h-14 ring-2 ring-gray-700">
                    <AvatarImage src={pcInfo.profilePhoto} />
                    <AvatarFallback className="bg-gray-800 text-white text-lg font-bold">
                      {pcInfo.displayName?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{pcInfo.displayName}</h3>
                    {pcInfo.username && <p className="text-sm text-gray-400">@{pcInfo.username}</p>}
                    {tierName && (
                      <Badge className="mt-1 text-[10px] bg-gray-800 text-gray-300 border-gray-700">{tierName}</Badge>
                    )}
                  </div>
                  <button
                    onClick={() => setProfileCardClientId(null)}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <span className="sr-only">Close</span>
                  </button>
                </div>

                {featuredMedals.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-500" />
                        Featured ({featuredMedals.length}) · {pcMedals.length} total
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {featuredMedals.map((m, i) => (
                        <div key={i} className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-amber-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 bg-gray-800/50 rounded-xl p-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{pcWorkouts.length}</p>
                    <p className="text-[10px] text-gray-400">Workouts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{formatVol(pcVolume)}</p>
                    <p className="text-[10px] text-gray-400">Volume</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">—</p>
                    <p className="text-[10px] text-gray-400">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{pcMedals.length}</p>
                    <p className="text-[10px] text-gray-400">Medals</p>
                  </div>
                </div>

                {pcRating && (
                  <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Show Strength Rating on card
                    </p>
                    <span className="text-xs text-sky-400 cursor-pointer hover:underline">Enable</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
                    onClick={() => { setProfileCardClientId(null); router.push(`/clients/${profileCardClientId}?tab=messages`); }}
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1" /> Message
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                    onClick={() => { setProfileCardClientId(null); router.push(`/program/builder?clientId=${profileCardClientId}`); }}
                  >
                    <Dumbbell className="w-3.5 h-3.5 mr-1" /> Program
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                    onClick={() => { setProfileCardClientId(null); router.push(`/clients/${profileCardClientId}/book`); }}
                  >
                    <Calendar className="w-3.5 h-3.5 mr-1" /> Book
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: pcInfo.displayName, url: `${window.location.origin}/profile/${profileCardClientId}` });
                    } else {
                      navigator.clipboard.writeText(`${window.location.origin}/profile/${profileCardClientId}`);
                      toast.success('Profile link copied!');
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* v14-D29: read-only preview dialog for the Up Next card. Triggered
          from any of the three Up Next branches (flexible, rest-day,
          scheduled-today) to let the client peek at the day's blocks +
          exercises before tapping Start. */}
      <Dialog open={!!previewDay} onOpenChange={(open) => !open && setPreviewDay(null)}>
        <DialogContent className="max-w-md max-h-[80vh] bg-white">
          <DialogHeader>
            <DialogTitle>{previewDay?.day?.dayLabel || 'Workout'}</DialogTitle>
            <DialogDescription className="text-gray-500">
              {previewDay?.programName}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-3">
              {(previewDay?.day?.blocks || []).map((block: any, bi: number) => (
                <div key={block.id || bi} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                    {block.name || block.type}
                  </p>
                  <div className="space-y-1">
                    {(block.exercises || []).map((ex: any, ei: number) => (
                      <div key={ex.id || ei} className="flex items-start justify-between py-1">
                        <p className="text-sm text-gray-900 flex-1">
                          {ei + 1}. {ex.exerciseName || ex.name}
                        </p>
                        <p className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                          {ex.sets}×{ex.reps} · {ex.rest}
                        </p>
                      </div>
                    ))}
                    {(!block.exercises || block.exercises.length === 0) && (
                      <p className="text-xs text-gray-500 italic">No exercises in this block.</p>
                    )}
                  </div>
                </div>
              ))}
              {(!previewDay?.day?.blocks || previewDay.day.blocks.length === 0) && (
                <p className="text-sm text-gray-500 italic text-center py-6">
                  No blocks configured for this day yet.
                </p>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewDay(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
