'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useMedalStore, useTrainerStore } from '@/lib/store';
import { detectIsProgramWorkout } from '@/lib/programWorkoutDetection';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Workout } from '@/types';
import { getMuscleDisplayName, calculate1RM } from '@/lib/exercises';
import { getExerciseAnimationUrl } from '@/lib/exerciseAnimations';
import { cn } from '@/lib/utils';
import BlockMemoryCard from '@/components/BlockMemoryCard';
import { 
  Clock, 
  Dumbbell, 
  Trophy, 
  TrendingUp,
  Calendar,
  Share2,
  Trash2,
  RotateCcw,
  Medal,
  Zap,
  FileText,
  Save,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

export default function WorkoutDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, user } = useAuthStore();
  const { workoutHistory, deleteWorkout, startFromTemplate, personalBests, updateWorkoutNotes, updateCompletedWorkout } = useWorkoutStore();
  const { medals } = useMedalStore();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [notes, setNotes] = useState('');
  const [sharedNotesText, setSharedNotesText] = useState('');
  const [trainerNotesText, setTrainerNotesText] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingSharedNotes, setIsEditingSharedNotes] = useState(false);
  const [isEditingTrainerNotes, setIsEditingTrainerNotes] = useState(false);
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  const [editedExercises, setEditedExercises] = useState<Workout['exercises'] | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // PT Review flow
  const [coachNoteDraft, setCoachNoteDraft] = useState('');
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
      return;
    }

    const found = workoutHistory.find(w => w.id === params.id && !w.deletedAt);
    if (found) {
      // Privacy: allow viewing if the user owns the workout, conducted it
      // as a PT trainer, OR is the program trainer for the workout owner.
      // D16 Part C: previously only the first two cases were allowed,
      // which blocked the trainer from clicking the "client completed
      // workout" notification (D16 Part B link change) and the "Recent
      // Workouts" entries in /clients/[id]. We widen the allow-list to
      // include both program-linked trainers (active client_programs row)
      // and roster-linked trainers (trainer_clients row).
      if (user && found.userId !== user.id && found.assignedBy !== user.id) {
        const trainerStore = useTrainerStore.getState();
        const isProgramTrainer = trainerStore.clientPrograms.some(
          (p: any) => p.clientId === found.userId && p.trainerId === user.id
        );
        const isLinkedTrainer = trainerStore.clients.some(
          (c: any) => c.clientId === found.userId && c.trainerId === user.id
        );
        if (!isProgramTrainer && !isLinkedTrainer) {
          router.replace('/workout/history');
          return;
        }
      }
      setWorkout(found);
      setNotes(found.privateNotes || found.notes || '');
      setSharedNotesText(found.sharedNotes || '');
      setTrainerNotesText(found.trainerNotes || '');
      setCoachNoteDraft(found.coachNote || '');
    } else {
      router.replace('/workout');
    }
  }, [isAuthenticated, params.id, workoutHistory, router, user]);

  const handleReleaseSummary = async () => {
    if (!workout || !user) return;
    setReleasing(true);
    try {
      const releasedAt = new Date().toISOString();
      updateCompletedWorkout(workout.id, {
        reviewStatus: 'released',
        coachNote: coachNoteDraft.trim() || undefined,
        releasedAt,
      });
      // Notify the client that their summary is ready
      try {
        const { useSocialStore } = await import('@/lib/store');
        useSocialStore.getState().addNotification({
          userId: workout.userId,
          type: 'workout_assigned' as any,
          title: 'Your session summary is ready',
          message: `Your coach released the summary for "${workout.name}" — tap to view PRs, medals, and coach note.`,
          link: `/workout/${workout.id}`,
        });
      } catch {}
      setWorkout({
        ...workout,
        reviewStatus: 'released',
        coachNote: coachNoteDraft.trim() || undefined,
        releasedAt,
      });
      toast.success('Summary sent to client');
    } finally {
      setReleasing(false);
    }
  };

  // Is the current user the trainer who conducted this PT session?
  const isSessionTrainer = workout?.assignedBy && workout.assignedBy === user?.id;

  const handleSaveNotes = () => {
    if (workout) {
      updateCompletedWorkout(workout.id, { privateNotes: notes, notes });
      setIsEditingNotes(false);
      toast.success('Private notes saved');
    }
  };

  const handleSaveSharedNotes = () => {
    if (workout) {
      updateCompletedWorkout(workout.id, { sharedNotes: sharedNotesText });
      setIsEditingSharedNotes(false);
      toast.success('Shared notes saved');
    }
  };

  const handleSaveTrainerNotes = () => {
    if (workout) {
      updateCompletedWorkout(workout.id, { trainerNotes: trainerNotesText });
      setIsEditingTrainerNotes(false);
      toast.success('Trainer notes saved');
    }
  };

  const handleDelete = () => {
    if (workout) {
      deleteWorkout(workout.id);
      toast.success('Workout deleted');
      setShowDeleteConfirm(false);
      router.push('/workout');
    }
  };

  const handleRepeat = () => {
    if (workout) {
      const template = {
        id: workout.id,
        name: workout.name,
        exercises: workout.exercises,
        createdBy: workout.userId,
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      startFromTemplate(template);
      router.push('/workout/active');
    }
  };

  const handleStartEdit = () => {
    if (workout) {
      setEditedExercises(JSON.parse(JSON.stringify(workout.exercises)));
      setIsEditingWorkout(true);
    }
  };

  const handleCancelEdit = () => {
    setEditedExercises(null);
    setIsEditingWorkout(false);
  };

  const handleSaveEdit = () => {
    if (workout && editedExercises) {
      // Recalculate total volume
      const newTotalVolume = editedExercises.reduce((sum, ex) => 
        sum + ex.sets.filter(s => s.completed).reduce((setSum, set) => 
          setSum + ((set.weight || 0) * (set.reps || 0)), 0
        ), 0
      );
      
      updateCompletedWorkout(workout.id, {
        exercises: editedExercises,
        totalVolume: newTotalVolume,
      });
      
      // Update local state
      setWorkout({
        ...workout,
        exercises: editedExercises,
        totalVolume: newTotalVolume,
      });
      
      setEditedExercises(null);
      setIsEditingWorkout(false);
      toast.success('Workout updated and synced');
    }
  };

  const handleUpdateSet = (exerciseId: string, setId: string, field: 'weight' | 'reps', value: number) => {
    if (!editedExercises) return;
    
    setEditedExercises(editedExercises.map(ex => 
      ex.id === exerciseId
        ? {
            ...ex,
            sets: ex.sets.map(s => 
              s.id === setId ? { ...s, [field]: value } : s
            ),
          }
        : ex
    ));
  };

  if (!isAuthenticated || !workout) return null;

  const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  const totalReps = workout.exercises.reduce((sum, ex) => 
    sum + ex.sets.filter(s => s.completed).reduce((s, set) => s + (set.reps || 0), 0), 0
  );

  // D16 Part D: compute the program-template diff for the trainer view.
  // Renders only when:
  //   - the viewer is NOT the workout owner (so they're a trainer/observer),
  //   - the workout is structurally a program workout (detect helper),
  //   - we can match a day in the active program by dayLabel,
  //   - there's at least one added or removed exercise.
  // Skipped for the session trainer with an existing coachNote — the
  // coach-note flow already covers feedback in that case.
  const trainerStore = useTrainerStore.getState();
  const viewerIsOwner = !!user && workout.userId === user.id;
  const programDiff = (() => {
    if (viewerIsOwner) return null;
    if (isSessionTrainer && workout.coachNote) return null;
    const isProgWorkout = detectIsProgramWorkout({
      sourceProgramId: workout.sourceProgramId,
      sourceDayIndex: workout.sourceDayIndex,
      templateId: workout.templateId,
      workoutName: workout.name,
      workoutUserId: workout.userId,
      clientPrograms: trainerStore.clientPrograms,
    });
    if (!isProgWorkout) return null;

    const activeProgram = trainerStore.clientPrograms.find(
      (p: any) => p.clientId === workout.userId && p.status === 'active',
    );
    if (!activeProgram?.weeklyPlan?.length) return null;

    const day = activeProgram.weeklyPlan.find(
      (d: any) => d.dayLabel === workout.name,
    );
    if (!day) return null;

    const originalIds = new Set<string>(
      (day.blocks || [])
        .flatMap((b: any) => b.exercises || [])
        .map((e: any) => e.exerciseId)
        .filter(Boolean),
    );
    const currentIds = new Set<string>(
      workout.exercises.map((e) => e.exerciseId).filter(Boolean),
    );
    const idToName = new Map<string, string>();
    for (const ex of workout.exercises) {
      if (ex.exerciseId) idToName.set(ex.exerciseId, ex.exercise?.name || ex.exerciseId);
    }
    for (const block of (day.blocks || [])) {
      for (const ex of (block.exercises || [])) {
        if (ex.exerciseId && !idToName.has(ex.exerciseId)) {
          idToName.set(ex.exerciseId, ex.exerciseName || ex.exerciseId);
        }
      }
    }

    const addedNames = Array.from(currentIds)
      .filter((id) => !originalIds.has(id))
      .map((id) => idToName.get(id) || id);
    const removedNames = Array.from(originalIds)
      .filter((id) => !currentIds.has(id))
      .map((id) => idToName.get(id) || id);

    if (addedNames.length === 0 && removedNames.length === 0) return null;
    return { addedNames, removedNames };
  })();

  // Find PBs achieved during this workout
  const workoutPBs = personalBests.filter(pb => pb.workoutId === workout.id);
  
  // Find medals earned around this workout time (within 5 minutes)
  const workoutTime = new Date(workout.endTime || workout.startTime).getTime();
  const workoutMedals = medals.filter(m => {
    if (!m.earned || !m.earnedAt) return false;
    const medalTime = new Date(m.earnedAt).getTime();
    return Math.abs(medalTime - workoutTime) < 5 * 60 * 1000; // Within 5 minutes
  });

  return (
    <MainLayout>
      <PageHeader 
        title={workout.name}
        subtitle={format(new Date(workout.startTime), 'EEEE, MMMM d, yyyy')}
        showBack
        action={
          <Button variant="ghost" size="icon" className="text-white">
            <Share2 className="w-5 h-5" />
          </Button>
        }
      />

      <ScrollArea className="flex-1">
        <div className="px-4 py-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {workout.duration ? formatDuration(workout.duration) : '--'}
                  </p>
                  <p className="text-xs text-gray-500">Duration</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {Math.round(workout.totalVolume).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Volume (kg)</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{totalSets}</p>
                  <p className="text-xs text-gray-500">Sets</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{totalReps}</p>
                  <p className="text-xs text-gray-500">Reps</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PT Review Flow — trainer release panel (only for the trainer when reviewStatus is pending) */}
          {workout.reviewStatus === 'pending' && isSessionTrainer && (
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900">Review & send summary to client</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Your client is waiting. Review the stats + AI feedback below, add a personal note if you'd like, then release the summary.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-amber-900 font-medium mb-1 block">Coach note (optional)</label>
                  <Textarea
                    value={coachNoteDraft}
                    onChange={(e) => setCoachNoteDraft(e.target.value)}
                    placeholder="Great effort today — focus on full depth on squats next session."
                    className="bg-white border-amber-200 text-gray-900 text-sm min-h-[72px]"
                  />
                </div>
                <Button
                  onClick={handleReleaseSummary}
                  disabled={releasing}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {releasing ? 'Sending...' : 'Send summary to client'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* PT Review Flow — pending state shown to the client (defensive fallback — normally hidden) */}
          {workout.reviewStatus === 'pending' && !isSessionTrainer && workout.userId === user?.id && (
            <Card className="bg-gradient-to-br from-sky-50 to-indigo-50 border-sky-200 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-sky-900">Waiting for coach review</p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    Your coach will release your session summary (PRs, medals, AI feedback) shortly. You'll get a notification when it's ready.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PT Review Flow — coach note (shown to both trainer + client once released) */}
          {workout.reviewStatus === 'released' && workout.coachNote && (
            <Card className="bg-gradient-to-br from-emerald-50 to-sky-50 border-emerald-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-800 mb-1">Coach's Note</p>
                    <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">
                      {workout.coachNote}
                    </p>
                    {workout.releasedAt && (
                      <p className="text-[10px] text-gray-500 mt-2">
                        Released {format(new Date(workout.releasedAt), 'MMM d, h:mm a')}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Coach Summary */}
          {workout.aiSummary && (
            <Card className="bg-gradient-to-br from-sky-50 to-purple-50 border-sky-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-sky-700 mb-1">AI Coach</p>
                    <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                      {workout.aiSummary}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PBs Achieved */}
          {workoutPBs.length > 0 && (
            <Card className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-amber-500/30">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Personal Bests ({workoutPBs.length})
                </h3>
                <div className="space-y-2">
                  {workoutPBs.map(pb => {
                    const exercise = workout.exercises.find(e => e.exerciseId === pb.exerciseId);
                    return (
                      <div key={pb.id} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
                        <span className="text-gray-900 text-sm">{exercise?.exercise?.name || 'Exercise'}</span>
                        <Badge className="bg-amber-500/30 text-amber-300">
                          {Math.round(pb.oneRepMax)}kg 1RM
                          <span className="text-amber-400/70 ml-1">({pb.bestWeight}×{pb.bestReps})</span>
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Medals Earned */}
          {workoutMedals.length > 0 && (
            <Card className="bg-gradient-to-r from-purple-500/20 to-purple-600/10 border-purple-500/30">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Medal className="w-4 h-4" />
                  Medals Earned ({workoutMedals.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {workoutMedals.map(medal => (
                    <Badge key={medal.id} className="bg-purple-500/30 text-purple-300">
                      {medal.icon} {medal.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trainer Notes — only visible to the trainer who conducted the PT session */}
          {isSessionTrainer && (
            <Card className="bg-amber-50 border-amber-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                    🔒 Trainer Notes
                    <span className="text-xs text-amber-400/60 font-normal">(private)</span>
                  </h3>
                  {!isEditingTrainerNotes ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingTrainerNotes(true)}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      {trainerNotesText ? 'Edit' : 'Add Notes'}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveTrainerNotes}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
                
                {isEditingTrainerNotes ? (
                  <Textarea
                    value={trainerNotesText}
                    onChange={(e) => setTrainerNotesText(e.target.value)}
                    placeholder="Session observations, form cues, programming adjustments..."
                    className="bg-white border-amber-200 text-gray-900 placeholder-gray-400 min-h-[100px]"
                  />
                ) : (
                  <p className={trainerNotesText ? "text-gray-700 text-sm whitespace-pre-wrap" : "text-gray-500 text-sm italic"}>
                    {trainerNotesText || 'No trainer notes for this session'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Private Notes — only visible to the workout creator */}
          {user && workout.userId === user.id && (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                    🔒 Private Notes
                    <span className="text-xs text-gray-400 font-normal">(only you)</span>
                  </h3>
                  {!isEditingNotes ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingNotes(true)}
                      className="text-gray-400 hover:text-gray-900"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      {notes ? 'Edit' : 'Add Notes'}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveNotes}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
                
                {isEditingNotes ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add private notes about this workout..."
                    className="bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 min-h-[100px]"
                  />
                ) : (
                  <p className={notes ? "text-gray-700 text-sm whitespace-pre-wrap" : "text-gray-500 text-sm italic"}>
                    {notes || 'No private notes'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shared Notes — visible to both trainer and client */}
          {workout.assignedBy && (
            <Card className="bg-sky-50 border-sky-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-sky-600 flex items-center gap-2">
                    💬 Shared Notes
                    <span className="text-xs text-sky-400 font-normal">(visible to {isSessionTrainer ? 'client' : 'trainer'})</span>
                  </h3>
                  {!isEditingSharedNotes ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingSharedNotes(true)}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      {sharedNotesText ? 'Edit' : 'Add'}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveSharedNotes}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
                
                {isEditingSharedNotes ? (
                  <Textarea
                    value={sharedNotesText}
                    onChange={(e) => setSharedNotesText(e.target.value)}
                    placeholder={isSessionTrainer ? "Feedback for your client..." : "Notes for your trainer..."}
                    className="bg-white border-sky-200 text-gray-900 placeholder-gray-400 min-h-[80px]"
                  />
                ) : (
                  <p className={sharedNotesText ? "text-gray-700 text-sm whitespace-pre-wrap" : "text-gray-500 text-sm italic"}>
                    {sharedNotesText || 'No shared notes'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* D16 Part D: Compared to program template — trainer-only diff
              card. Renders only when the viewer is the program trainer
              (privacy-check above already gates non-trainer viewers from
              reaching this page) AND the client added/removed exercises
              relative to the program template. See programDiff
              computation block earlier in this file for the conditions. */}
          {programDiff && (
            <Card className="bg-gray-50 border border-gray-200 border-l-4 border-l-sky-500 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-sky-700 mb-2">
                  Compared to program template
                </p>
                {programDiff.addedNames.length > 0 && (
                  <p className="text-sm text-gray-800">
                    <span className="font-medium text-emerald-700">Added:</span>{' '}
                    {programDiff.addedNames.join(', ')}
                  </p>
                )}
                {programDiff.removedNames.length > 0 && (
                  <p className="text-sm text-gray-800 mt-1">
                    <span className="font-medium text-rose-700">Removed:</span>{' '}
                    {programDiff.removedNames.join(', ')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Workout Memory - Block-level summary for cardio/circuit/warmup */}
          {workout.blocks && workout.blocks.length > 0 && (() => {
            const memoryBlocks = workout.blocks.filter(b => 
              b.type === 'cardio' || b.type === 'circuit' || b.type === 'warmup'
            );
            if (memoryBlocks.length === 0) return null;
            return (
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-sky-400" />
                  Workout Memory
                </h2>
                <div className="space-y-4">
                  {memoryBlocks.map(block => (
                    <BlockMemoryCard key={block.id} block={block} />
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Exercises */}
          {(() => {
            const hasMemoryBlocks = workout.blocks && workout.blocks.some(b => 
              b.type === 'cardio' || b.type === 'circuit' || b.type === 'warmup'
            );
            const hasExercises = workout.exercises && workout.exercises.length > 0;
            // Hide exercises section if no exercises and blocks are showing
            if (!hasExercises && hasMemoryBlocks) return null;
            return (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-sky-400" />
                Exercises ({workout.exercises.length})
              </h2>
              {!isEditingWorkout ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  className="text-gray-400 hover:text-gray-900"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit Workout
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-gray-400 hover:text-gray-900"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    className="bg-sky-500 hover:bg-sky-600"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {(isEditingWorkout && editedExercises ? editedExercises : workout.exercises).filter(ex => ex.exercise).map((ex) => {
                const completedSets = ex.sets.filter(s => s.completed);
                const bestSet = completedSets.reduce((best, set) => {
                  if (!set.weight || !set.reps) return best;
                  const rm = calculate1RM(set.weight, set.reps);
                  if (!best || rm > calculate1RM(best.weight || 0, best.reps || 0)) {
                    return set;
                  }
                  return best;
                }, null as typeof completedSets[0] | null);

                const exerciseVolume = completedSets.reduce((sum, s) => 
                  sum + (s.isAssisted ? 0 : ((s.weight || 0) * (s.reps || 0))), 0
                );

                return (
                  <Card key={ex.id} className="bg-white border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getExerciseAnimationUrl(ex.exerciseId) && (
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <img
                                src={getExerciseAnimationUrl(ex.exerciseId)}
                                alt={ex.exercise?.name || ''}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-gray-900">{ex.exercise?.name || 'Unknown Exercise'}</h3>
                            <p className="text-xs text-gray-500">
                              {ex.exercise?.primaryMuscles?.map(m => getMuscleDisplayName(m)).join(', ') || ''}
                            </p>
                          </div>
                        </div>
                        {bestSet && (
                          <Badge className="bg-amber-500/20 text-amber-400">
                            <Trophy className="w-3 h-3 mr-1" />
                            {Math.round(calculate1RM(bestSet.weight || 0, bestSet.reps || 0))}kg 1RM
                            <span className="text-amber-300/70 ml-1">({bestSet.weight}×{bestSet.reps})</span>
                          </Badge>
                        )}
                      </div>

                      {/* Sets Table */}
                      <div className="rounded-lg overflow-hidden border border-gray-200">
                        <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
                          <div>SET</div>
                          <div className="text-center">WEIGHT</div>
                          <div className="text-center">REPS</div>
                          <div className="text-right">VOLUME</div>
                        </div>
                        {completedSets.map((set) => (
                          <div key={set.id} className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-gray-200 items-center">
                            <div className="text-gray-500">{set.setNumber}</div>
                            {isEditingWorkout ? (
                              <>
                                <input
                                  type="number"
                                  value={set.weight || 0}
                                  onChange={(e) => handleUpdateSet(ex.id, set.id, 'weight', parseFloat(e.target.value) || 0)}
                                  className="w-full text-center bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm"
                                />
                                <input
                                  type="number"
                                  value={set.reps || 0}
                                  onChange={(e) => handleUpdateSet(ex.id, set.id, 'reps', parseInt(e.target.value) || 0)}
                                  className="w-full text-center bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-sm"
                                />
                              </>
                            ) : (
                              <>
                                <div className={cn("text-center", set.isAssisted ? "text-blue-500" : "text-gray-900")}>
                                  {set.isAssisted && <span className="text-xs mr-0.5">-</span>}
                                  {set.weight || 0} kg
                                </div>
                                <div className="text-center text-gray-900">{set.reps || 0}</div>
                              </>
                            )}
                            <div className="text-right text-gray-500">
                              {set.isAssisted ? (
                                <span className="text-blue-500/70">assisted</span>
                              ) : (
                                <>{((set.weight || 0) * (set.reps || 0)).toLocaleString()} kg</>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between mt-3 pt-3 border-t border-gray-200 text-sm">
                        <span className="text-gray-500">Total Volume</span>
                        <span className="text-gray-900 font-medium">{exerciseVolume.toLocaleString()} kg</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
            );
          })()}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              onClick={handleRepeat}
              className="bg-sky-500 hover:bg-sky-600"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Repeat
            </Button>
            <Button
              variant="outline"
              className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => {
                if (workout) {
                  const { saveCompletedWorkoutAsTemplate } = useWorkoutStore.getState();
                  saveCompletedWorkoutAsTemplate(workout);
                  toast.success(`Saved "${workout.name}" as template`);
                }
              }}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Workout
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to delete &ldquo;{workout?.name}&rdquo;? This will remove the workout from your history and recalculate your stats, PBs, and medals.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
