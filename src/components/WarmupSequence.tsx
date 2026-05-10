'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExerciseImage } from '@/components/ExerciseImage';
import type { WorkoutExercise } from '@/types';

interface WarmupSequenceProps {
  exercises: WorkoutExercise[];
  onComplete: () => void;
  onExerciseComplete: (exerciseId: string, duration: number) => void;
}

export default function WarmupSequence({
  exercises,
  onComplete,
  onExerciseComplete,
}: WarmupSequenceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(
    exercises[0]?.sequenceDuration || 30
  );
  const [isPaused, setIsPaused] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [editValue, setEditValue] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentExercise = exercises[currentIndex];

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

  // Timer logic
  useEffect(() => {
    if (isPaused || isEditingDuration) return;

    intervalRef.current = setInterval(() => {
      setCurrentSeconds((prev) => {
        if (prev <= 1) {
          // Time's up - advance to next exercise
          playBeep();
          onExerciseComplete(currentExercise.exerciseId, currentExercise.sequenceDuration || 30);
          
          if (currentIndex < exercises.length - 1) {
            const nextExercise = exercises[currentIndex + 1];
            setCurrentIndex(currentIndex + 1);
            return nextExercise.sequenceDuration || 30;
          } else {
            // Last exercise complete
            onComplete();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex, isPaused, isEditingDuration, exercises, onComplete, onExerciseComplete, currentExercise]);

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => console.warn('Audio play failed:', e));
    }
  };

  const handlePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleSkipBack = () => {
    if (currentIndex > 0) {
      const prevExercise = exercises[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      setCurrentSeconds(prevExercise.sequenceDuration || 30);
    }
  };

  const handleSkipForward = () => {
    if (currentIndex < exercises.length - 1) {
      onExerciseComplete(currentExercise.exerciseId, currentExercise.sequenceDuration || 30);
      const nextExercise = exercises[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      setCurrentSeconds(nextExercise.sequenceDuration || 30);
    } else {
      onComplete();
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
      <Card className="p-8 text-center">
        <p className="text-xl font-semibold text-green-600">Warm-up complete!</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      {/* Exercise image */}
      <div className="flex justify-center">
        <ExerciseImage
          exerciseId={currentExercise.exerciseId}
          size="lg"
          className="rounded-lg"
        />
      </div>

      {/* Exercise info */}
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold">{currentExercise.exercise.name}</h3>
        <p className="text-sm text-muted-foreground">
          {currentExercise.exercise.primaryMuscles?.join(', ')}
        </p>
        <p className="text-sm text-muted-foreground">
          Exercise {currentIndex + 1} of {exercises.length}
        </p>
      </div>

      {/* Timer */}
      <div className="text-center">
        {isEditingDuration ? (
          <div className="flex items-center justify-center gap-2">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-24 text-center text-2xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDurationSave();
                if (e.key === 'Escape') handleDurationCancel();
              }}
            />
            <Button size="sm" onClick={handleDurationSave}>Save</Button>
            <Button size="sm" variant="outline" onClick={handleDurationCancel}>Cancel</Button>
          </div>
        ) : (
          <div
            className="text-6xl font-bold cursor-pointer hover:text-primary transition-colors"
            onClick={handleTimerClick}
            title="Click to edit duration"
          >
            {formatTime(currentSeconds)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          size="lg"
          variant="outline"
          onClick={handleSkipBack}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <Button
          size="lg"
          onClick={handlePlayPause}
        >
          {isPaused ? (
            <Play className="h-8 w-8" />
          ) : (
            <Pause className="h-8 w-8" />
          )}
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={handleSkipForward}
          disabled={currentIndex === exercises.length - 1}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </Card>
  );
}
