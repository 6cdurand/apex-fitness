'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ExerciseImage } from '@/components/ExerciseImage';
import { getExerciseById, getMuscleDisplayName } from '@/lib/exercises';
import { normalizeExerciseId, calculateExerciseStats } from '@/lib/exerciseStats';
import { maleTierRanges, femaleTierRanges, getTierFor1RM, getProgressInTier, getTierBgColor, getTierColor } from '@/lib/strengthRating';
import { useWorkoutStore, useAuthStore, useTrainerStore } from '@/lib/store';
import { getExerciseVideoUrl } from '@/lib/exerciseVideos';
import { getExerciseAnimationUrl } from '@/lib/exerciseAnimations';
import { Info, Dumbbell, Target, AlertTriangle, Trophy, TrendingUp, Calendar, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// A1 (PLAN_exercise_history.md §A1 + W9 Hendrik repro)
//
// The popup previously keyed history and PB lookups off `useAuthStore.user.id`.
// In a PT session that's the TRAINER's id, not the client's — so the trainer
// sees their own stats regardless of which client's exercise they're
// inspecting. Hendrik's 32 workouts + 28 client_exercise_history rows never
// surfaced because the lookup was scoped to the wrong user.
//
// Fix shape: two pure helpers exported from this module, consumed by the
// component (and directly unit-tested in ExerciseHowTo.test.tsx). Keeping
// them pure means the test can't drift from the render behaviour.
// ---------------------------------------------------------------------------

/**
 * Resolve the id the popup should scope its history / PB lookups to.
 *
 *  - During an active workout, `useWorkoutStore.getActiveUserId()` returns
 *    the ID of whoever the trainer is training (client during PT sessions,
 *    self otherwise). That's the correct id.
 *  - Outside an active workout (e.g. the popup is opened from a program
 *    builder or the exercise search in a non-workout surface), fall back
 *    to the logged-in user's id.
 *  - Empty string counts as "no active id" — the workout store returns ''
 *    as a defensive fallback when both `currentClientId` and auth are
 *    missing; treating it as a real id would look up history at `userId = ''`
 *    and match nothing.
 */
export function resolveScopedUserId(
  activeUserId: string | null | undefined,
  authUserId: string | null | undefined,
): string | undefined {
  if (activeUserId && activeUserId.length > 0) return activeUserId;
  if (authUserId && authUserId.length > 0) return authUserId;
  return undefined;
}

/**
 * Strength-rating tier ranges are split by male/female. Previously this was
 * derived from `user.gender !== 'female'` which, during a PT session, read
 * the TRAINER's gender. For an accurate tier against the client's 1RM we
 * need the CLIENT's gender.
 *
 * Behaviour:
 *  - If `scopedUserId === authUser.id` → self case, use the auth gender.
 *  - Otherwise → PT session, look the client up in `useTrainerStore.clients`
 *    and read `.client.gender`.
 *  - Default `true` (same as the legacy `gender !== 'female'` fallback) so
 *    unknown / placeholder / missing-gender rows don't flip the tier.
 */
export function isMaleForUser(
  scopedUserId: string | null | undefined,
  authUser: { id?: string; gender?: 'male' | 'female' | 'other' } | null | undefined,
  trainerClients: Array<{ clientId: string; client?: { gender?: 'male' | 'female' | 'other' } }>,
): boolean {
  if (!scopedUserId) return true;
  if (authUser?.id && scopedUserId === authUser.id) {
    return authUser.gender !== 'female';
  }
  const row = trainerClients.find((c) => c.clientId === scopedUserId);
  const clientGender = row?.client?.gender;
  if (!clientGender) return true;
  return clientGender !== 'female';
}

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
  
  // v11-D3: Suggest a video modal
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestUrl, setSuggestUrl] = useState('');
  const [suggestNote, setSuggestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const exercise = getExerciseById(exerciseId);
  const normalizedId = normalizeExerciseId(exerciseId);
  const { personalBests, workoutHistory } = useWorkoutStore();
  const activeUserId = useWorkoutStore((s) => s.getActiveUserId());
  const { user } = useAuthStore();
  const trainerClients = useTrainerStore((s) => s.clients);

  // A1: during a PT session, lookups must scope to the active client, not
  // the logged-in trainer. `resolveScopedUserId` falls back to `user.id`
  // when there's no active workout (popup viewed outside a session).
  const scopedUserId = resolveScopedUserId(activeUserId, user?.id);
  const isMale = isMaleForUser(scopedUserId, user, trainerClients);

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
    if (!open || !scopedUserId) return null;
    return calculateExerciseStats(normalizedId, workoutHistory, scopedUserId, isMale);
  }, [open, normalizedId, workoutHistory, scopedUserId, isMale]);

  // Personal best
  const pb = useMemo(() => {
    if (!open || !scopedUserId) return null;
    return personalBests.find(p => p.exerciseId === normalizedId && p.userId === scopedUserId) || null;
  }, [open, normalizedId, personalBests, scopedUserId]);

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
                <ExerciseImage 
                  exerciseId={exerciseId} 
                  size="lg" 
                  showGenerateButton 
                  className="max-w-[200px]" 
                  onSuggestVideo={() => setShowSuggestModal(true)}
                />
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
            {scopedUserId && (pb || (stats && stats.totalSessions > 0)) && (
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

      {/* v11-D3: Suggest a video modal */}
      <Dialog open={showSuggestModal} onOpenChange={setShowSuggestModal}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle>Suggest a video for {name}</DialogTitle>
            <DialogDescription className="text-gray-500">
              Help us improve the exercise library. Paste a YouTube URL or describe a good demo video.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="https://youtube.com/watch?v=…"
              value={suggestUrl}
              onChange={(e) => setSuggestUrl(e.target.value)}
            />
            <textarea
              className="w-full h-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none"
              placeholder="Optional note (e.g., 'this athlete demo has the cleanest form')"
              value={suggestNote}
              onChange={(e) => setSuggestNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowSuggestModal(false)}>Cancel</Button>
              <Button
                className="bg-sky-500 hover:bg-sky-600 text-white"
                disabled={!suggestUrl.trim() || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await fetch('/api/exercise-suggestion', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        exerciseId: normalizedId,
                        exerciseName: name,
                        url: suggestUrl,
                        note: suggestNote,
                        submittedBy: scopedUserId,
                      }),
                    });
                    toast.success('Suggestion sent! Thanks.');
                    setShowSuggestModal(false);
                    setSuggestUrl('');
                    setSuggestNote('');
                  } catch {
                    toast.error('Failed to send. Try again.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? 'Sending…' : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
