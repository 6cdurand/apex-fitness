'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useMedalStore } from '@/lib/store';
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

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
      return;
    }

    const found = workoutHistory.find(w => w.id === params.id && !w.deletedAt);
    if (found) {
      // Privacy: only allow viewing if user owns the workout or is the trainer who ran it
      if (user && found.userId !== user.id && found.assignedBy !== user.id) {
        router.replace('/workout/history');
        return;
      }
      setWorkout(found);
      setNotes(found.privateNotes || found.notes || '');
      setSharedNotesText(found.sharedNotes || '');
      setTrainerNotesText(found.trainerNotes || '');
    } else {
      router.replace('/workout');
    }
  }, [isAuthenticated, params.id, workoutHistory, router, user]);

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

          {/* Exercises */}
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
