'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useTrainerStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Zap,
  Target,
  Flame,
  History,
  Users,
  Calendar,
  Edit,
  Check,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import { ProfileCard } from '@/components/ProfileCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';

export default function WorkoutPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { activeWorkout, workoutHistory, startWorkout, startFromTemplate, templates } = useWorkoutStore();
  const { clients, calendarEvents, getEventsForDate, getScheduledSessionsForUser, confirmSession, updateCalendarEvent, getActiveProgram, sessionWorkouts, getSessionWorkout, sessions, toggleSessionPaid, getPackagesForClient, addPayment } = useTrainerStore();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);

  // Get today's sessions for trainer mode
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaysSessions = getEventsForDate(today).filter(e => e.type === 'session' && e.status === 'scheduled');
  
  // Get scheduled sessions for client mode (sessions booked by trainer)
  const clientScheduledSessions = user?.id ? getScheduledSessionsForUser(user.id) : [];
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [showEmptyWorkoutOptions, setShowEmptyWorkoutOptions] = useState(false);
  const [selectedBlockType, setSelectedBlockType] = useState<string | null>(null);
  
  // Reschedule session state
  const [rescheduleSession, setRescheduleSession] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  
  // Session start dialog state
  const [startSessionDialog, setStartSessionDialog] = useState<{
    clientId: string;
    clientName: string;
    sessionTitle?: string;
    workoutId?: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // Load users from localStorage (sessionWorkouts now from trainer store)
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored);
  }, []);

  useEffect(() => {
    if (activeWorkout) {
      router.push('/workout/active');
    }
  }, [activeWorkout, router]);

  const allTemplates = [...defaultTemplates, ...templates];

  const handleStartEmpty = () => {
    startWorkout('Quick Workout');
    router.push('/workout/active');
  };

  const handleStartFromTemplate = (template: WorkoutTemplate) => {
    startFromTemplate(template);
    router.push('/workout/active');
  };

  // Start workout from session workout (created in builder) or client's program
  const handleStartClientSession = (clientId: string, clientName: string, sessionTitle?: string, workoutId?: string) => {
    // First check if there's a session workout created in builder
    if (workoutId) {
      const sessionWorkout = sessionWorkouts.find(w => w.id === workoutId);
      if (sessionWorkout && sessionWorkout.blocks) {
        // Convert session workout blocks to template format
        const exercises = sessionWorkout.blocks.flatMap((block: any) => 
          block.exercises?.map((ex: any) => ({
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            exerciseId: ex.exerciseId || ex.id,
            exercise: {
              id: ex.exerciseId || ex.id,
              name: ex.exerciseName || ex.name || 'Exercise',
              category: 'strength',
              muscleGroups: [],
              primaryMuscles: ex.primaryMuscles || [],
              secondaryMuscles: ex.secondaryMuscles || [],
              equipment: ex.equipment || 'other',
            },
            sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
              id: `set-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
              setNumber: i + 1,
              targetReps: typeof ex.reps === 'string' ? parseInt(ex.reps) || 10 : ex.reps || 10,
              reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || 10 : ex.reps || 10,
              weight: 0,
              completed: false,
            })),
            restTimerSeconds: parseInt(ex.rest) || 90,
            notes: ex.notes || '',
            blockId: block.id, // Track which block this exercise belongs to
            blockName: block.name,
            blockType: block.type,
            setStyle: ex.setStyle || 'fixed',
            repType: ex.repType || 'reps',
            circuitRounds: block.type === 'circuit' ? block.rounds : undefined,
            roundDuration: block.type === 'circuit' ? block.roundDuration : undefined,
            restBetweenRounds: block.type === 'circuit' ? block.restBetweenRounds : undefined,
          })) || []
        ) || [];

        // Create template even if exercises is empty - we'll handle blocks in active page
        const template: WorkoutTemplate = {
          id: `session-${Date.now()}`,
          name: sessionWorkout.name || `Session - ${clientName}`,
          description: `${sessionWorkout.blocks.length} blocks`,
          exercises: exercises,
          category: 'strength',
          estimatedDuration: 60,
          createdAt: new Date().toISOString(),
          createdBy: user?.id || '',
          isPublic: false,
          updatedAt: new Date().toISOString(),
          blocks: sessionWorkout.blocks, // Pass blocks for active workout display
        };
        
        startFromTemplate(template, clientId);
        router.push('/workout/active');
        return;
      }
    }
    
    const program = getActiveProgram(clientId);
    
    if (program?.weeklyPlan && program.weeklyPlan.length > 0) {
      // Find matching workout day from session title or use first available
      let workoutDay = program.weeklyPlan[0];
      
      if (sessionTitle) {
        const matchingDay = program.weeklyPlan.find((day: any) => 
          sessionTitle.toLowerCase().includes(day.dayLabel?.toLowerCase()) ||
          day.dayLabel?.toLowerCase().includes(sessionTitle.toLowerCase())
        );
        if (matchingDay) workoutDay = matchingDay;
      }
      
      // Convert program workout to template format
      const exercises = workoutDay.blocks?.flatMap((block: any) => 
        block.exercises?.map((ex: any) => ({
          id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          exerciseId: ex.exerciseId || ex.id,
          exercise: {
            id: ex.exerciseId || ex.id,
            name: ex.exerciseName || ex.name || 'Exercise',
            category: 'strength',
            muscleGroups: [],
          },
          sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
            id: `set-${Date.now()}-${i}`,
            setNumber: i + 1,
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
        const template: WorkoutTemplate = {
          id: `session-${Date.now()}`,
          name: `${workoutDay.dayLabel || 'Training'} - ${clientName}`,
          description: `Session from ${program.templateName || 'assigned program'}`,
          exercises: exercises,
          category: 'strength',
          estimatedDuration: 60,
          createdAt: new Date().toISOString(),
          createdBy: user?.id || '',
          isPublic: false,
          updatedAt: new Date().toISOString(),
        };
        
        startFromTemplate(template, clientId);
        router.push('/workout/active');
        return;
      }
    }
    
    // Fallback to empty workout if no program found
    startWorkout(`Session with ${clientName}`, undefined, clientId);
    router.push('/workout/active');
  };

  const recentWorkouts = workoutHistory
    .filter(w => w.userId === user?.id)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 5);

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'strength': return <Dumbbell className="w-4 h-4" />;
      case 'core': return <Target className="w-4 h-4" />;
      case 'cardio': return <Flame className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'strength': return 'bg-blue-500/20 text-blue-400';
      case 'core': return 'bg-purple-500/20 text-purple-400';
      case 'cardio': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-emerald-500/20 text-emerald-400';
    }
  };

  const handleReschedule = (sessionId: string) => {
    if (!newDate) return;
    updateCalendarEvent(sessionId, {
      date: newDate,
      startTime: newTime,
      endTime: `${parseInt(newTime.split(':')[0]) + 1}:${newTime.split(':')[1]}`,
      clientConfirmed: false, // Reset confirmation when rescheduled
    });
    setRescheduleSession(null);
    setNewDate('');
    setNewTime('09:00');
  };

  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <PageHeader 
        title="Workout" 
        subtitle={`Ready to train, ${user?.displayName?.split(' ')[0] || 'Champion'}?`}
      />

      <div className="px-4 py-6 space-y-6">
        {/* Build Workout Button - Trainer Mode */}
        {user?.mode === 'trainer' && (
          <section className="mb-6">
            <Card 
              className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border-emerald-500/30 cursor-pointer hover:border-emerald-500/50 transition-all"
              onClick={() => router.push('/workout/builder?mode=create')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Build Workout</h3>
                    <p className="text-sm text-gray-400">Create & assign workouts to clients</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
          </section>
        )}

        {/* Today's Client Sessions - Trainer Mode */}
        {user?.mode === 'trainer' && todaysSessions.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Today's Sessions
              </h2>
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                {todaysSessions.length} scheduled
              </Badge>
            </div>
            <div className="space-y-3">
              {todaysSessions.map((session) => {
                const clientUser = allUsers.find(u => u.id === session.clientId);
                const linkedTemplate = session.workoutId ? defaultTemplates.find(t => t.id === session.workoutId) : null;
                const linkedSessionWorkout = session.workoutId ? sessionWorkouts.find(w => w.id === session.workoutId) : null;
                const clientProgram = session.clientId ? getActiveProgram(session.clientId) : null;
                
                // Check if this session's workout has been completed today
                const sessionCompleted = workoutHistory.some(w => 
                  w.userId === session.clientId && 
                  format(new Date(w.startTime), 'yyyy-MM-dd') === today
                );
                
                // Find matching session record to check paid status
                const matchingSessionRecord = sessions.find(s => 
                  s.clientId === session.clientId && 
                  s.date === today && 
                  s.status === 'completed'
                );
                const isPaid = matchingSessionRecord?.paid || false;
                
                // Get client's package for price info
                const clientPackages = session.clientId ? getPackagesForClient(session.clientId) : [];
                const activePackage = clientPackages.find(p => p.status === 'active');
                const pricePerSession = activePackage?.pricePerSession || 0;
                
                return (
                  <Card
                    key={session.id}
                    className={`bg-gray-900 border-gray-800 transition-colors ${sessionCompleted ? 'border-emerald-500/50 bg-emerald-500/5' : 'hover:border-emerald-500/50'}`}
                  >
                    <CardContent className="p-4">
                      {/* Workout Complete Banner */}
                      {sessionCompleted && (
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-emerald-500/20">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-emerald-400 font-medium text-sm">Workout Complete</span>
                          </div>
                          {/* Payment Status & Toggle */}
                          {matchingSessionRecord && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 text-xs ${isPaid ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'}`}
                              onClick={() => {
                                if (matchingSessionRecord) {
                                  toggleSessionPaid(matchingSessionRecord.id);
                                }
                              }}
                            >
                              {isPaid ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Paid {pricePerSession > 0 && `$${pricePerSession}`}
                                </>
                              ) : (
                                <>
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  Mark Paid {pricePerSession > 0 && `$${pricePerSession}`}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Clickable Avatar for Profile Card */}
                          <button
                            onClick={() => {
                              setSelectedProfileUser(clientUser);
                              setShowProfileCard(true);
                            }}
                            className="focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full"
                          >
                            <Avatar className="w-10 h-10 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all">
                              <AvatarImage src={clientUser?.profilePhoto} />
                              <AvatarFallback className="bg-gray-800 text-white">
                                {clientUser?.displayName?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                          <div>
                            {/* Clickable Client Name */}
                            <button
                              onClick={() => router.push(`/clients/${session.clientId}`)}
                              className="font-semibold text-white hover:text-emerald-400 transition-colors text-left"
                            >
                              {clientUser?.displayName || 'Client'}
                            </button>
                            <p className="text-sm text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {session.startTime} - {session.endTime}
                              {session.duration && ` (${session.duration} min)`}
                            </p>
                          </div>
                        </div>
                        {sessionCompleted ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <Check className="w-3 h-3 mr-1" />
                            Done
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600"
                            onClick={() => {
                              setStartSessionDialog({
                                clientId: session.clientId!,
                                clientName: clientUser?.displayName || 'Client',
                                sessionTitle: session.title || session.notes,
                                workoutId: session.workoutId,
                              });
                            }}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Start
                          </Button>
                        )}
                      </div>
                      
                      {/* Show linked workout details */}
                      {linkedSessionWorkout ? (
                        <div className="mt-3 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Dumbbell className="w-4 h-4" />
                              <span className="text-sm font-medium">{linkedSessionWorkout.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-400 hover:text-white"
                              onClick={() => router.push(`/workout/builder?eventId=${session.id}&clientId=${session.clientId}&workoutId=${linkedSessionWorkout.id}`)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {linkedSessionWorkout.blocks?.reduce((acc: number, b: any) => acc + (b.exercises?.length || 0), 0) || 0} exercises • {linkedSessionWorkout.blocks?.length || 0} blocks
                          </p>
                        </div>
                      ) : linkedTemplate ? (
                        <div className="mt-3 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Dumbbell className="w-4 h-4" />
                              <span className="text-sm font-medium">{linkedTemplate.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-400 hover:text-white"
                              onClick={() => router.push(`/workout/builder?eventId=${session.id}&clientId=${session.clientId}&templateId=${session.workoutId}`)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {linkedTemplate.exercises.length} exercises
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 p-2 bg-gray-800 rounded-lg border border-gray-700">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Dumbbell className="w-3 h-3" />
                              No workout assigned
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-blue-500 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => router.push(`/workout/builder?eventId=${session.id}&clientId=${session.clientId}`)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Create Workout
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {session.notes && (
                        <p className="text-xs text-gray-500 mt-2">
                          Note: {session.notes}
                        </p>
                      )}
                      
                      {/* Payment Toggle - Always visible */}
                      <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Payment Status</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs ${isPaid ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (matchingSessionRecord) {
                              toggleSessionPaid(matchingSessionRecord.id);
                            } else {
                              // Create a session record and mark as paid
                              const newPayment = {
                                clientId: session.clientId!,
                                trainerId: user?.id || '',
                                amount: pricePerSession,
                                currency: 'NZD',
                                type: 'single_session' as const,
                                status: 'paid' as const,
                                method: 'cash' as const,
                                description: `PT Session - ${session.title || 'Session'}`,
                                paidAt: new Date().toISOString(),
                              };
                              addPayment(newPayment);
                            }
                          }}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Paid {pricePerSession > 0 && `$${pricePerSession}`}
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-3 h-3 mr-1" />
                              Mark Paid {pricePerSession > 0 && `$${pricePerSession}`}
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* No sessions today message for trainers */}
        {user?.mode === 'trainer' && todaysSessions.length === 0 && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardContent className="py-6 text-center">
              <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400">No client sessions scheduled for today</p>
              <Button
                variant="link"
                className="text-emerald-400 mt-2"
                onClick={() => router.push('/clients')}
              >
                Book a session
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Sessions for Clients */}
        {user?.mode !== 'trainer' && clientScheduledSessions.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-400" />
                Your Scheduled Sessions
              </h2>
              <Badge variant="secondary" className="bg-rose-500/20 text-rose-400">
                {clientScheduledSessions.length} upcoming
              </Badge>
            </div>
            <div className="space-y-3">
              {clientScheduledSessions
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((session) => {
                  const trainerUser = allUsers.find(u => u.id === session.trainerId);
                  const isToday = session.date === today;
                  return (
                    <Card
                      key={session.id}
                      className={`bg-gray-900 border-gray-800 ${isToday ? 'border-rose-500/50' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={trainerUser?.profilePhoto} />
                              <AvatarFallback className="bg-rose-500 text-white">
                                {trainerUser?.displayName?.[0] || 'T'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-white">
                                {session.title || 'Training Session'}
                              </h3>
                              <p className="text-sm text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(session.date), 'EEE, MMM d')} • {session.startTime}
                                {isToday && <Badge className="ml-2 bg-rose-500/20 text-rose-400 text-xs">Today</Badge>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {rescheduleSession === session.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={newDate}
                                  onChange={(e) => setNewDate(e.target.value)}
                                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                  min={today}
                                />
                                <input
                                  type="time"
                                  value={newTime}
                                  onChange={(e) => setNewTime(e.target.value)}
                                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                />
                                <Button
                                  size="sm"
                                  className="bg-emerald-500 hover:bg-emerald-600"
                                  onClick={() => handleReschedule(session.id)}
                                  disabled={!newDate}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRescheduleSession(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-400 hover:text-white"
                                  onClick={() => {
                                    setRescheduleSession(session.id);
                                    setNewDate(session.date);
                                    setNewTime(session.startTime || '09:00');
                                  }}
                                >
                                  Reschedule
                                </Button>
                                {session.clientConfirmed ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400">
                                    Confirmed
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={() => confirmSession(session.id)}
                                  >
                                    Confirm
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {session.notes && (
                          <p className="text-xs text-gray-500 mt-2 pl-13">
                            Note: {session.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        )}

        {/* Quick Actions - Only show in user mode, trainers use client sessions */}
        {user?.mode !== 'trainer' && (
          <div className="grid grid-cols-2 gap-4">
            <Dialog open={showEmptyWorkoutOptions} onOpenChange={setShowEmptyWorkoutOptions}>
              <DialogTrigger asChild>
                <Button
                  className="h-auto py-6 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 flex flex-col items-center gap-2 rounded-2xl shadow-lg shadow-emerald-500/20"
                >
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="font-semibold">Start Workout</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">Start New Workout</DialogTitle>
                  <DialogDescription>Choose how to start your workout</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Quick Start */}
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 border-gray-700 hover:bg-gray-800 justify-start"
                    onClick={() => {
                      handleStartEmpty();
                      setShowEmptyWorkoutOptions(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-white">Quick Start</p>
                        <p className="text-xs text-gray-500">Empty workout, add exercises as you go</p>
                      </div>
                    </div>
                  </Button>

                  <div className="border-t border-gray-800 pt-4">
                    <p className="text-sm text-gray-400 mb-3">Or start with a structured block:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-auto py-3 border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 flex flex-col items-center gap-1"
                        onClick={() => {
                          startWorkout('Warm-up Session');
                          setShowEmptyWorkoutOptions(false);
                          router.push('/workout/active');
                        }}
                      >
                        <Flame className="w-5 h-5 text-orange-400" />
                        <span className="text-sm text-orange-400">Warm-up</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-3 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 flex flex-col items-center gap-1"
                        onClick={() => {
                          startWorkout('Strength Training');
                          setShowEmptyWorkoutOptions(false);
                          router.push('/workout/active');
                        }}
                      >
                        <Dumbbell className="w-5 h-5 text-blue-400" />
                        <span className="text-sm text-blue-400">Strength</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-3 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 flex flex-col items-center gap-1"
                        onClick={() => {
                          startWorkout('Circuit Training');
                          setShowEmptyWorkoutOptions(false);
                          router.push('/workout/active');
                        }}
                      >
                        <Target className="w-5 h-5 text-purple-400" />
                        <span className="text-sm text-purple-400">Circuit</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-3 border-red-500/30 bg-red-500/10 hover:bg-red-500/20 flex flex-col items-center gap-1"
                        onClick={() => {
                          startWorkout('Cardio Session');
                          setShowEmptyWorkoutOptions(false);
                          router.push('/workout/active');
                        }}
                      >
                        <Flame className="w-5 h-5 text-red-400" />
                        <span className="text-sm text-red-400">Cardio</span>
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    <Button
                      variant="outline"
                      className="w-full border-gray-700 hover:bg-gray-800"
                      onClick={() => {
                        setShowEmptyWorkoutOptions(false);
                        setShowTemplates(true);
                      }}
                    >
                      <Dumbbell className="w-4 h-4 mr-2 text-emerald-400" />
                      Choose from Templates
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto py-6 bg-gray-800 border-gray-700 hover:bg-gray-700 flex flex-col items-center gap-2 rounded-2xl"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                    <Dumbbell className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="font-semibold text-white">Use Template</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="text-white">Workout Templates</DialogTitle>
                <DialogDescription>Choose a template to start your workout</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-3">
                  {allTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white">{template.name}</h3>
                              <Badge className={getCategoryColor(template.category)}>
                                {getCategoryIcon(template.category)}
                                <span className="ml-1 capitalize">{template.category || 'General'}</span>
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">{template.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Dumbbell className="w-3 h-3" />
                                {template.exercises.length} exercises
                              </span>
                              {template.estimatedDuration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  ~{template.estimatedDuration} min
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          </div>
        )}

        {/* Template Preview Dialog - also only for user mode */}
        {user?.mode !== 'trainer' && (
        <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-white">{selectedTemplate?.name}</DialogTitle>
              <DialogDescription>{selectedTemplate?.description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
              <div className="space-y-3">
                {selectedTemplate?.exercises.map((ex, idx) => (
                  <div key={ex.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{ex.exercise.name}</p>
                      <p className="text-sm text-gray-400">{ex.sets.length} sets</p>
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
              className="w-full bg-emerald-500 hover:bg-emerald-600 mt-4"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Workout
            </Button>
          </DialogContent>
        </Dialog>
        )}

        {/* Session Start Dialog - Select program day or empty workout */}
        <Dialog open={!!startSessionDialog} onOpenChange={(open) => !open && setStartSessionDialog(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Start Session with {startSessionDialog?.clientName}</DialogTitle>
              <DialogDescription>Choose which workout to start</DialogDescription>
            </DialogHeader>
            {startSessionDialog && (() => {
              const program = getActiveProgram(startSessionDialog.clientId);
              const weeklyPlan = program?.weeklyPlan || [];
              const linkedWorkout = startSessionDialog.workoutId 
                ? sessionWorkouts.find(w => w.id === startSessionDialog.workoutId)
                : null;
              
              return (
                <div className="space-y-3">
                  {/* Linked Session Workout (from builder) */}
                  {linkedWorkout && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Assigned Workout:</p>
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20"
                        onClick={() => {
                          handleStartClientSession(
                            startSessionDialog.clientId,
                            startSessionDialog.clientName,
                            startSessionDialog.sessionTitle,
                            startSessionDialog.workoutId
                          );
                          setStartSessionDialog(null);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                            <Dumbbell className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-emerald-400">{linkedWorkout.name}</p>
                            <p className="text-xs text-gray-400">
                              {linkedWorkout.blocks?.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0) || 0} exercises • {linkedWorkout.blocks?.length || 0} blocks
                            </p>
                          </div>
                        </div>
                      </Button>
                    </div>
                  )}

                  {/* Program Days */}
                  {weeklyPlan.length > 0 && !linkedWorkout && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">From {program?.templateName || 'Program'}:</p>
                      <div className="space-y-2">
                        {weeklyPlan.map((day: any, idx: number) => (
                          <Button
                            key={day.id || idx}
                            variant="outline"
                            className="w-full justify-start h-auto py-3 border-gray-700 hover:bg-gray-800"
                            onClick={() => {
                              handleStartClientSession(
                                startSessionDialog.clientId,
                                startSessionDialog.clientName,
                                day.dayLabel
                              );
                              setStartSessionDialog(null);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-sm">
                                {idx + 1}
                              </div>
                              <div className="text-left">
                                <p className="font-medium text-white">{day.dayLabel || `Day ${idx + 1}`}</p>
                                <p className="text-xs text-gray-500">
                                  {day.blocks?.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0) || 0} exercises
                                </p>
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {weeklyPlan.length === 0 && !linkedWorkout && (
                    <p className="text-sm text-gray-500 text-center py-2">No program assigned to this client</p>
                  )}
                  
                  {/* Empty Workout Option */}
                  <div className="pt-2 border-t border-gray-800">
                    <Button
                      variant="outline"
                      className="w-full justify-start h-auto py-3 border-gray-700 hover:bg-gray-800"
                      onClick={() => {
                        startWorkout(`Session with ${startSessionDialog.clientName}`, undefined, startSessionDialog.clientId);
                        router.push('/workout/active');
                        setStartSessionDialog(null);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-white">Empty Workout</p>
                          <p className="text-xs text-gray-500">Start fresh and add exercises</p>
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Recent Workouts */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              Recent Workouts
            </h2>
            {workoutHistory.length > 5 && (
              <Button variant="ghost" size="sm" className="text-emerald-400" onClick={() => router.push('/workout/history')}>
                See All
              </Button>
            )}
          </div>
          
          {recentWorkouts.length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <Dumbbell className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-400 mb-2">No workouts yet</h3>
                <p className="text-sm text-gray-500">Start your first workout to see it here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentWorkouts.map((workout) => (
                <Card
                  key={workout.id}
                  className="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-850 transition-colors"
                  onClick={() => router.push(`/workout/${workout.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{workout.name}</h3>
                        <p className="text-sm text-gray-400">
                          {format(new Date(workout.startTime), 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-medium">
                          {workout.exercises.length} exercises
                        </p>
                        {workout.duration && (
                          <p className="text-sm text-gray-500">
                            {Math.floor(workout.duration / 60)} min
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Show workout notes if present */}
                    {workout.notes && (
                      <div className="mt-2 pt-2 border-t border-gray-800">
                        <p className="text-sm text-gray-400 line-clamp-2">
                          📝 {workout.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Quick Stats */}
        {workoutHistory.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">This Week</h2>
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {workoutHistory.filter(w => {
                      const workoutDate = new Date(w.startTime);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return workoutDate >= weekAgo;
                    }).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Workouts</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {Math.round(workoutHistory
                      .filter(w => {
                        const workoutDate = new Date(w.startTime);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return workoutDate >= weekAgo;
                      })
                      .reduce((sum, w) => sum + (w.totalVolume || 0), 0) / 1000
                    )}k
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Volume (kg)</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-purple-400">
                    {Math.round(workoutHistory
                      .filter(w => {
                        const workoutDate = new Date(w.startTime);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return workoutDate >= weekAgo;
                      })
                      .reduce((sum, w) => sum + (w.duration || 0), 0) / 60
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Minutes</p>
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </div>

      {/* Profile Card Dialog */}
      <Dialog open={showProfileCard} onOpenChange={setShowProfileCard}>
        <DialogContent className="bg-transparent border-none shadow-none max-w-sm">
          {selectedProfileUser && (
            <ProfileCard
              user={selectedProfileUser}
              medals={[]}
              strengthRating={null}
              personalBests={[]}
              stats={{
                totalWorkouts: workoutHistory.filter(w => w.userId === selectedProfileUser.id).length,
                totalVolume: workoutHistory.filter(w => w.userId === selectedProfileUser.id).reduce((sum, w) => sum + (w.totalVolume || 0), 0),
                followers: 0,
                following: 0,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
