'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Play, Pause, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { ExerciseImage } from '@/components/ExerciseImage';
import type { WorkoutExercise } from '@/types';

interface WarmupSequenceProps {
  exercises: WorkoutExercise[];
  onComplete: () => void;
  onExerciseComplete: (exerciseId: string, duration: number) => void;
}

/**
 * Auto-advancing warmup/cooldown sequence player.
 *
 * 2026-05-11 rewrite (issue: timer "wont start"):
 *   Previous implementation's setInterval effect listed `exercises`,
 *   `onComplete`, `onExerciseComplete`, and `currentExercise` in its
 *   dependency array. The parent (active workout page) has its own
 *   workout-duration timer that re-renders the entire tree every 1
 *   second, which means those four references are NEW on every parent
 *   tick. The effect's cleanup fired on every parent render, clearing
 *   the 1000ms interval before it ever ticked — net result: timer
 *   stuck on the initial value indefinitely.
 *
 *   Fix: stable callback/data refs updated via separate useEffects.
 *   The timer effect now only depends on `[isPaused, isEditingDuration]`
 *   so it survives parent re-renders.
 *
 * Visual polish in the same pass: circular SVG progress ring, soft
 * yellow gradient backdrop, exercise pagination dots, and a "Up next"
 * preview chip when there are more exercises queued.
 */
export default function WarmupSequence({
  exercises,
  onComplete,
  onExerciseComplete,
}: WarmupSequenceProps) {
  const initialDuration = exercises[0]?.sequenceDuration || 30;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(initialDuration);
  const [isPaused, setIsPaused] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [editValue, setEditValue] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stable refs for everything the timer interval needs to read or call.
  // Updated on every render so the interval sees current values without
  // having to be torn down and rebuilt.
  const onCompleteRef = useRef(onComplete);
  const onExerciseCompleteRef = useRef(onExerciseComplete);
  const exercisesRef = useRef(exercises);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onExerciseCompleteRef.current = onExerciseComplete; }, [onExerciseComplete]);
  useEffect(() => { exercisesRef.current = exercises; }, [exercises]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const currentExercise = exercises[currentIndex];
  const exerciseDuration = currentExercise?.sequenceDuration || 30;
  const progressPct = exerciseDuration > 0
    ? Math.max(0, Math.min(100, (1 - currentSeconds / exerciseDuration) * 100))
    : 0;
  const nextExercise = exercises[currentIndex + 1];

  // Initialize audio (optional - beep on transition)
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/beep.mp3');
    } catch (e) {
      console.warn('Audio initialization failed:', e);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playBeep = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => console.warn('Audio play failed:', e));
    }
  }, []);

  // Timer logic. ONLY depends on pause/edit state so parent re-renders
  // don't restart the interval. Callbacks and exercise data are read
  // through refs that update silently.
  useEffect(() => {
    if (isPaused || isEditingDuration) return;
    const intv = setInterval(() => {
      setCurrentSeconds(prev => {
        if (prev > 1) return prev - 1;
        // Tick reaches zero — advance.
        playBeep();
        const idx = currentIndexRef.current;
        const exs = exercisesRef.current;
        const cur = exs[idx];
        if (cur) {
          onExerciseCompleteRef.current(cur.exerciseId, cur.sequenceDuration || 30);
        }
        if (idx < exs.length - 1) {
          const next = exs[idx + 1];
          setCurrentIndex(idx + 1);
          return next.sequenceDuration || 30;
        }
        // Last exercise — fire completion and freeze at 0.
        onCompleteRef.current();
        return 0;
      });
    }, 1000);
    return () => clearInterval(intv);
  }, [isPaused, isEditingDuration, playBeep]);

  const handlePlayPause = () => setIsPaused(p => !p);

  const handleSkipBack = () => {
    if (currentIndex > 0) {
      const prev = exercises[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      setCurrentSeconds(prev.sequenceDuration || 30);
    }
  };

  const handleSkipForward = () => {
    if (currentIndex < exercises.length - 1) {
      onExerciseCompleteRef.current(currentExercise.exerciseId, currentExercise.sequenceDuration || 30);
      const next = exercises[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      setCurrentSeconds(next.sequenceDuration || 30);
    } else {
      onExerciseCompleteRef.current(currentExercise.exerciseId, currentExercise.sequenceDuration || 30);
      onCompleteRef.current();
      setCurrentSeconds(0);
    }
  };

  const handleTimerClick = () => {
    setIsPaused(true);
    setIsEditingDuration(true);
    setEditValue(currentSeconds.toString());
  };

  const handleDurationSave = () => {
    const newDuration = parseInt(editValue, 10);
    if (!isNaN(newDuration) && newDuration > 0) {
      setCurrentSeconds(newDuration);
    }
    setIsEditingDuration(false);
    setIsPaused(false);
  };

  const handleDurationCancel = () => {
    setIsEditingDuration(false);
    setIsPaused(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentExercise) {
    return (
      <Card className="p-8 text-center bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-xl font-semibold text-green-700">Warm-up complete!</p>
        <p className="text-sm text-green-600 mt-1">All exercises finished</p>
      </Card>
    );
  }

  // SVG ring geometry — fixed radius keeps stroke math clean.
  const ringRadius = 88;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc * (1 - progressPct / 100);

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 border-yellow-200 shadow-sm">
      {/* Header row: pagination dots + counter */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {exercises.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'w-6 bg-yellow-500'
                  : i < currentIndex
                    ? 'w-1.5 bg-yellow-400'
                    : 'w-1.5 bg-yellow-200'
              }`}
              aria-label={`Exercise ${i + 1}${i === currentIndex ? ' (current)' : i < currentIndex ? ' (done)' : ''}`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-yellow-700">
          {currentIndex + 1} / {exercises.length}
        </span>
      </div>

      {/* Exercise image + name */}
      <div className="px-6 pt-2 pb-3 flex flex-col items-center">
        <div className="w-32 h-32 rounded-2xl bg-white border border-yellow-200 overflow-hidden flex items-center justify-center mb-3">
          <ExerciseImage
            exerciseId={currentExercise.exerciseId}
            size="lg"
            className="!w-full !h-full"
          />
        </div>
        <h3 className="text-xl font-bold text-gray-900 text-center">
          {currentExercise.exercise?.name || 'Exercise'}
        </h3>
        {currentExercise.exercise?.primaryMuscles && currentExercise.exercise.primaryMuscles.length > 0 && (
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {currentExercise.exercise.primaryMuscles.join(' · ')}
          </p>
        )}
      </div>

      {/* Circular progress ring + timer */}
      <div className="px-6 pb-3 flex justify-center">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r={ringRadius}
              fill="none"
              stroke="rgba(251, 191, 36, 0.2)"
              strokeWidth="10"
            />
            <circle
              cx="100"
              cy="100"
              r={ringRadius}
              fill="none"
              stroke="rgb(245, 158, 11)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={ringCirc}
              strokeDashoffset={ringOffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isEditingDuration ? (
              <div className="flex flex-col items-center gap-2">
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-24 text-center text-2xl bg-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDurationSave();
                    if (e.key === 'Escape') handleDurationCancel();
                  }}
                />
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleDurationSave} className="h-7 px-2 text-xs">Save</Button>
                  <Button size="sm" variant="outline" onClick={handleDurationCancel} className="h-7 px-2 text-xs">Cancel</Button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleTimerClick}
                className="flex flex-col items-center hover:opacity-80 transition-opacity"
                title="Tap to edit duration"
              >
                <span className="text-5xl font-bold text-gray-900 tabular-nums">
                  {formatTime(currentSeconds)}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">
                  {isPaused ? 'Paused · tap to start' : 'Auto-advancing'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 pb-3 flex items-center justify-center gap-3">
        <Button
          size="icon"
          variant="outline"
          onClick={handleSkipBack}
          disabled={currentIndex === 0}
          className="w-12 h-12 rounded-full border-yellow-300 hover:bg-yellow-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <Button
          size="icon"
          onClick={handlePlayPause}
          className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 shadow-md"
        >
          {isPaused ? (
            <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
          ) : (
            <Pause className="w-7 h-7 text-white" fill="white" />
          )}
        </Button>

        <Button
          size="icon"
          variant="outline"
          onClick={handleSkipForward}
          className="w-12 h-12 rounded-full border-yellow-300 hover:bg-yellow-100"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Up-next preview */}
      {nextExercise && (
        <div className="px-4 pb-4">
          <div className="bg-white/60 border border-yellow-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-yellow-700 font-semibold">Up next</span>
            <span className="text-sm text-gray-900 truncate">{nextExercise.exercise?.name || 'Exercise'}</span>
            <span className="ml-auto text-xs text-gray-500 tabular-nums">{formatTime(nextExercise.sequenceDuration || 30)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
