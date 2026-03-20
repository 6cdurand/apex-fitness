'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ExerciseImage } from '@/components/ExerciseImage';
import { getExerciseById, getMuscleDisplayName } from '@/lib/exercises';
import { normalizeExerciseId, calculateExerciseStats } from '@/lib/exerciseStats';
import { maleTierRanges, femaleTierRanges, getTierFor1RM, getProgressInTier, getTierBgColor, getTierColor } from '@/lib/strengthRating';
import { useWorkoutStore, useAuthStore } from '@/lib/store';
import { getExerciseVideoUrl } from '@/lib/exerciseVideos';
import { getExerciseAnimationUrl } from '@/lib/exerciseAnimations';
import { Info, Dumbbell, Target, AlertTriangle, Trophy, TrendingUp, Calendar, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ExerciseHowToProps {
  exerciseId: string;
  exerciseName?: string;
  /** 'icon' = small icon-only button, 'badge' = labeled mini badge */
  variant?: 'icon' | 'badge';
  className?: string;
}

export function ExerciseHowTo({
  exerciseId,
  exerciseName,
  variant = 'icon',
  className = '',
}: ExerciseHowToProps) {
  const [open, setOpen] = useState(false);
  const [aiCues, setAiCues] = useState<{ setup: string; execution: string[]; commonMistakes: string[]; tips: string[] } | null>(null);
  const [loadingCues, setLoadingCues] = useState(false);

  const exercise = getExerciseById(exerciseId);
  const normalizedId = normalizeExerciseId(exerciseId);
  const { personalBests, workoutHistory } = useWorkoutStore();
  const { user } = useAuthStore();
  const isMale = user?.gender !== 'female';

  const name =
    exerciseName ||
    exercise?.name ||
    exerciseId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  // Animation GIF and video URL for this exercise
  const animationUrl = getExerciseAnimationUrl(normalizedId) || getExerciseAnimationUrl(exerciseId);
  const videoUrl = getExerciseVideoUrl(normalizedId);

  // Exercise stats (only computed when dialog is open)
  const stats = useMemo(() => {
    if (!open || !user?.id) return null;
    return calculateExerciseStats(normalizedId, workoutHistory, user.id, isMale);
  }, [open, normalizedId, workoutHistory, user?.id, isMale]);

  // Personal best
  const pb = useMemo(() => {
    if (!open || !user?.id) return null;
    return personalBests.find(p => p.exerciseId === normalizedId && p.userId === user.id) || null;
  }, [open, normalizedId, personalBests, user?.id]);

  // Strength rating (only for exercises with tier ranges)
  const tierRanges = isMale ? maleTierRanges : femaleTierRanges;
  const hasRating = !!tierRanges[normalizedId];
  const oneRM = stats?.allTimeBest1RM || pb?.oneRepMax || 0;
  const tierInfo = useMemo(() => {
    if (!open || !hasRating || oneRM <= 0) return null;
    const tier = getTierFor1RM(oneRM, normalizedId, isMale);
    const { progress } = getProgressInTier(oneRM, normalizedId, isMale);
    return { tier, progress };
  }, [open, hasRating, oneRM, normalizedId, isMale]);

  // Load cached AI cues from localStorage when dialog opens
  useEffect(() => {
    if (!open) return;
    const cached = localStorage.getItem(`apex-form-cues-${normalizedId}`);
    if (cached) {
      try { setAiCues(JSON.parse(cached)); } catch {}
    }
  }, [open, normalizedId]);

  // Generate AI form cues on demand
  const handleGenerateCues = async () => {
    setLoadingCues(true);
    try {
      const res = await fetch('/api/exercise-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId: normalizedId, exerciseName: name }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiCues(data);
        localStorage.setItem(`apex-form-cues-${normalizedId}`, JSON.stringify(data));
      }
    } catch {}
    setLoadingCues(false);
  };

  // Effective form cues — AI-generated or from exercise data
  const formCues = aiCues || exercise?.formCues;

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className={cn(
            'inline-flex items-center justify-center w-6 h-6 rounded-full',
            'bg-sky-500/15 text-sky-400 hover:bg-sky-500/30 transition-colors',
            'flex-shrink-0',
            className,
          )}
          aria-label={`How to perform ${name}`}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      ) : (
        <Badge
          variant="outline"
          className={cn(
            'cursor-pointer text-[10px] border-sky-500/40 text-sky-400 hover:bg-sky-500/20 transition-colors gap-1 px-1.5 py-0',
            className,
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Info className="w-3 h-3" />
          How To
        </Badge>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-white">{name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pb-2">
            {/* Animation GIF, Video Clip, or Image */}
            {animationUrl ? (
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <img
                  src={animationUrl}
                  alt={`${name} animation`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : videoUrl ? (
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <img
                  src={videoUrl}
                  alt={`${name} technique`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex justify-center">
                <ExerciseImage exerciseId={exerciseId} size="lg" showGenerateButton className="max-w-[200px]" />
              </div>
            )}

            {/* Equipment */}
            {exercise?.equipment && (
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-slate-400" />
                <Badge variant="outline" className="capitalize text-xs border-slate-700 text-slate-300">
                  {exercise.equipment}
                </Badge>
                <Badge variant="outline" className="capitalize text-xs border-slate-700 text-slate-300">
                  {exercise.category}
                </Badge>
              </div>
            )}

            {/* Instructions — split into steps for clarity */}
            {exercise?.instructions && (
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-sky-400" />
                  How To Perform
                </h4>
                {(() => {
                  // Split instructions into steps on commas/periods for a numbered list
                  const steps = exercise.instructions
                    .split(/[.,]/)
                    .map(s => s.trim())
                    .filter(s => s.length > 3);
                  return steps.length > 1 ? (
                    <ol className="list-decimal list-inside space-y-1.5">
                      {steps.map((step, i) => (
                        <li key={i} className="text-sm text-slate-400 leading-relaxed">{step}.</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-400 leading-relaxed">{exercise.instructions}</p>
                  );
                })()}
              </div>
            )}

            {/* Equipment & Movement Details */}
            {exercise && (
              <div className="grid grid-cols-2 gap-2">
                {exercise.equipment && exercise.equipment !== 'bodyweight' && (
                  <div className="p-2.5 rounded-lg bg-slate-800/50">
                    <p className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">Equipment</p>
                    <p className="text-xs text-slate-300 capitalize">{exercise.equipment}</p>
                  </div>
                )}
                <div className="p-2.5 rounded-lg bg-slate-800/50">
                  <p className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">Type</p>
                  <p className="text-xs text-slate-300 capitalize">{exercise.category}</p>
                </div>
                {exercise.primaryMuscles?.[0] && (
                  <div className="p-2.5 rounded-lg bg-slate-800/50">
                    <p className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">Target</p>
                    <p className="text-xs text-slate-300 capitalize">{getMuscleDisplayName(exercise.primaryMuscles[0])}</p>
                  </div>
                )}
                {exercise.secondaryMuscles?.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-800/50">
                    <p className="text-[10px] text-slate-500 uppercase font-medium mb-0.5">Also Works</p>
                    <p className="text-xs text-slate-300 capitalize">{exercise.secondaryMuscles.map(m => getMuscleDisplayName(m)).join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Form Cues (AI-generated or from data) */}
            {formCues && (
              <div className="space-y-3">
                {formCues.setup && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Setup</h4>
                    <p className="text-sm text-slate-400">{formCues.setup}</p>
                  </div>
                )}
                {formCues.execution && formCues.execution.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Step by Step</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      {formCues.execution.map((step, i) => (
                        <li key={i} className="text-sm text-slate-400">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {formCues.commonMistakes && formCues.commonMistakes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Common Mistakes
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {formCues.commonMistakes.map((mistake, i) => (
                        <li key={i} className="text-sm text-slate-400">{mistake}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {'tips' in formCues && (formCues as any).tips?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Pro Tips
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {((formCues as any).tips as string[]).map((tip, i) => (
                        <li key={i} className="text-sm text-slate-400">{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Muscles Worked */}
            {exercise && (exercise.primaryMuscles.length > 0 || exercise.secondaryMuscles.length > 0) && (
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Muscles Worked</h4>
                <div className="flex flex-wrap gap-1.5">
                  {exercise.primaryMuscles.map((m) => (
                    <Badge key={m} className="bg-sky-500/20 text-sky-300 border-0 text-xs">
                      {getMuscleDisplayName(m)}
                    </Badge>
                  ))}
                  {exercise.secondaryMuscles.map((m) => (
                    <Badge key={m} variant="outline" className="text-slate-500 border-slate-700 text-xs">
                      {getMuscleDisplayName(m)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Your Stats Section */}
            {user?.id && (pb || (stats && stats.totalSessions > 0)) && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Your Stats
                </h4>

                {/* Personal Best */}
                {pb && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-slate-300">Personal Best</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-400">{Math.round(pb.oneRepMax)}kg <span className="text-xs font-normal text-slate-500">1RM</span></p>
                      <p className="text-[10px] text-slate-500">{pb.bestWeight}kg × {pb.bestReps} • {format(new Date(pb.achievedAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}

                {/* Strength Rating */}
                {hasRating && tierInfo && oneRM > 0 && (
                  <div className="p-3 rounded-xl bg-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">Strength Rating</span>
                      <Badge className={`${getTierBgColor(tierInfo.tier)} ${getTierColor(tierInfo.tier)} border-0 text-[10px]`}>
                        {tierInfo.tier.charAt(0).toUpperCase() + tierInfo.tier.slice(1)}
                      </Badge>
                    </div>
                    <Progress value={tierInfo.progress} className="h-2" />
                  </div>
                )}

                {/* Recent Sessions */}
                {stats && stats.sessions && stats.sessions.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">{stats.totalSessions} sessions • {stats.totalSets} sets total</p>
                    <div className="space-y-1.5">
                      {stats.sessions.slice(-3).reverse().map((session, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${session.isPR ? 'bg-amber-500/10' : 'bg-slate-800/50'}`}>
                          <div className="flex items-center gap-1.5">
                            {session.isPR && <Trophy className="w-3 h-3 text-amber-400" />}
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-400">{format(new Date(session.date), 'MMM d')}</span>
                          </div>
                          <span className="text-slate-300">{session.topSet.weight}kg × {session.topSet.reps} • {session.totalSets} sets</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fallback when no data */}
            {!exercise && (
              <p className="text-sm text-slate-500 text-center py-4">
                No exercise information available for this exercise.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
