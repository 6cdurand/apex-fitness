'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight,
  Timer,
  Zap,
  Coffee,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CircuitTimerProps {
  circuitName: string;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  exercises?: string[];
  restBetweenRounds?: number;
  onComplete?: () => void;
  onClose?: () => void;
}

type TimerPhase = 'work' | 'rest' | 'round_rest' | 'complete';

export function CircuitTimer({
  circuitName,
  workSeconds,
  restSeconds,
  rounds,
  exercises = [],
  restBetweenRounds = 60,
  onComplete,
  onClose,
}: CircuitTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [phase, setPhase] = useState<TimerPhase>('work');
  const [timeRemaining, setTimeRemaining] = useState(workSeconds);
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Calculate total time for progress
  const getTotalPhaseTime = useCallback(() => {
    switch (phase) {
      case 'work':
        return workSeconds;
      case 'rest':
        return restSeconds;
      case 'round_rest':
        return restBetweenRounds;
      default:
        return 0;
    }
  }, [phase, workSeconds, restSeconds, restBetweenRounds]);

  // Play beep sound
  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2EgYN8doSNlJiRinx0gIOLkJGMh395dn2GjpSUjoF1bnZ/iZKWlI2DenN1foeRl5WNg3p0dXyGj5aVjoN6dHV7hY+VlI6DenR1e4WPlZSOg3p0dXuFj5WUjoN6dHV7hY+VlI6DenR1e4WPlZSOg3p0dXuFj5WUjoN6dHV7hY+VlI6DenR1e4WPlZSOg3p0dXuFj5WUjoN6dHV7hY+VlI6DenR1e4WPlZSOg3p0dA==');
      }
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  // Advance to next phase/round/exercise
  const advancePhase = useCallback(() => {
    playBeep();

    if (phase === 'work') {
      // After work, check if there are more exercises in this round
      if (exercises.length > 0 && currentExerciseIndex < exercises.length - 1) {
        // Move to rest, then next exercise
        setPhase('rest');
        setTimeRemaining(restSeconds);
      } else if (exercises.length === 0 || currentExerciseIndex >= exercises.length - 1) {
        // End of round
        if (currentRound < rounds) {
          setPhase('round_rest');
          setTimeRemaining(restBetweenRounds);
        } else {
          setPhase('complete');
          setIsRunning(false);
          onComplete?.();
        }
      }
    } else if (phase === 'rest') {
      // Move to next exercise
      if (currentExerciseIndex < exercises.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setPhase('work');
        setTimeRemaining(workSeconds);
      } else {
        // No more exercises, end of round
        if (currentRound < rounds) {
          setPhase('round_rest');
          setTimeRemaining(restBetweenRounds);
        } else {
          setPhase('complete');
          setIsRunning(false);
          onComplete?.();
        }
      }
    } else if (phase === 'round_rest') {
      // Start next round
      setCurrentRound(prev => prev + 1);
      setCurrentExerciseIndex(0);
      setPhase('work');
      setTimeRemaining(workSeconds);
    }

    setStartTimestamp(Date.now());
    setAccumulatedTime(0);
  }, [phase, currentRound, currentExerciseIndex, exercises.length, rounds, workSeconds, restSeconds, restBetweenRounds, playBeep, onComplete]);

  // Timer tick using timestamps for background persistence
  useEffect(() => {
    if (!isRunning || phase === 'complete') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!startTimestamp) return;

      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000) + accumulatedTime;
      const totalTime = getTotalPhaseTime();
      const remaining = Math.max(0, totalTime - elapsed);

      setTimeRemaining(remaining);

      if (remaining <= 0) {
        advancePhase();
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, phase, startTimestamp, accumulatedTime, getTotalPhaseTime, advancePhase]);

  const toggleTimer = () => {
    if (isRunning) {
      // Pausing - save accumulated time
      if (startTimestamp) {
        const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
        setAccumulatedTime(prev => prev + elapsed);
      }
      setStartTimestamp(null);
    } else {
      // Starting/resuming
      setStartTimestamp(Date.now());
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setCurrentRound(1);
    setCurrentExerciseIndex(0);
    setPhase('work');
    setTimeRemaining(workSeconds);
    setStartTimestamp(null);
    setAccumulatedTime(0);
  };

  const skipPhase = () => {
    advancePhase();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'work':
        return 'bg-orange-500';
      case 'rest':
        return 'bg-blue-500';
      case 'round_rest':
        return 'bg-purple-500';
      case 'complete':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case 'work':
        return 'WORK';
      case 'rest':
        return 'REST';
      case 'round_rest':
        return 'ROUND REST';
      case 'complete':
        return 'COMPLETE!';
      default:
        return '';
    }
  };

  const progress = ((getTotalPhaseTime() - timeRemaining) / getTotalPhaseTime()) * 100;

  if (phase === 'complete') {
    return (
      <Card className="bg-emerald-500/20 border-emerald-500/50">
        <CardContent className="p-6 text-center">
          <Zap className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-emerald-400 mb-2">Circuit Complete!</h3>
          <p className="text-gray-300 mb-4">
            {rounds} rounds of {circuitName}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={resetTimer} className="border-gray-700">
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </Button>
            {onClose && (
              <Button onClick={onClose} className="bg-emerald-500 hover:bg-emerald-600">
                Done
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-2 transition-colors', getPhaseColor().replace('bg-', 'border-').replace('500', '500/50'))}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-orange-400" />
            {circuitName}
          </CardTitle>
          <Badge variant="outline" className="text-gray-300">
            Round {currentRound}/{rounds}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase indicator */}
        <div className={cn('rounded-lg p-4 text-center', getPhaseColor().replace('500', '500/20'))}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {phase === 'work' && <Zap className="w-5 h-5 text-orange-400" />}
            {phase === 'rest' && <Coffee className="w-5 h-5 text-blue-400" />}
            {phase === 'round_rest' && <Coffee className="w-5 h-5 text-purple-400" />}
            <span className={cn('text-sm font-bold', 
              phase === 'work' ? 'text-orange-400' : 
              phase === 'rest' ? 'text-blue-400' : 
              'text-purple-400'
            )}>
              {getPhaseLabel()}
            </span>
          </div>
          <div className="text-5xl font-mono font-bold text-white mb-2">
            {formatTime(timeRemaining)}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Current exercise */}
        {exercises.length > 0 && phase === 'work' && (
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Current Exercise</p>
            <p className="text-white font-medium">{exercises[currentExerciseIndex]}</p>
            {exercises.length > 1 && (
              <p className="text-gray-500 text-xs mt-1">
                {currentExerciseIndex + 1} of {exercises.length}
              </p>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={resetTimer}
            className="border-gray-700 hover:bg-gray-800"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          <Button
            size="lg"
            onClick={toggleTimer}
            className={cn(
              'px-8',
              isRunning 
                ? 'bg-gray-600 hover:bg-gray-700' 
                : 'bg-emerald-500 hover:bg-emerald-600'
            )}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={skipPhase}
            className="border-gray-700 hover:bg-gray-800"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
