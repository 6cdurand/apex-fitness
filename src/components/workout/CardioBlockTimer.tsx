'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Timer,
  Flame,
  Heart,
  Zap,
} from 'lucide-react';
import type {
  CardioBlock,
  CardioTimerState,
  CardioMode,
} from '@/types';
import { cn } from '@/lib/utils';

interface CardioBlockTimerProps {
  block: CardioBlock;
  onUpdate: (updates: Partial<CardioBlock>) => void;
  onComplete: () => void;
}

export function CardioBlockTimer({ block, onUpdate, onComplete }: CardioBlockTimerProps) {
  const [timerState, setTimerState] = useState<CardioTimerState>(block.timerState);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play beep sound
  const playBeep = useCallback(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio('/sounds/beep.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  }, []);

  // Get total duration for the block
  const getTotalDuration = useCallback((): number => {
    switch (block.mode) {
      case 'steady':
        return block.steadyConfig?.duration || 0;
      case 'intervals':
        if (!block.intervalConfig) return 0;
        const { workSeconds, restSeconds, rounds, warmupSeconds = 0, cooldownSeconds = 0 } = block.intervalConfig;
        return warmupSeconds + (workSeconds + restSeconds) * rounds + cooldownSeconds;
      case 'emom':
        return (block.emomConfig?.totalMinutes || 0) * 60;
      case 'amrap':
        return (block.amrapConfig?.totalMinutes || 0) * 60;
      case 'for_time':
        return block.forTimeConfig?.timeCap || 0;
      case 'circuit':
        if (!block.circuitConfig) return 0;
        const { exercises, restBetweenStations, restBetweenRounds, rounds: circuitRounds } = block.circuitConfig;
        const stationTime = exercises.reduce((sum, ex) => sum + (ex.duration || 30), 0);
        const stationRest = restBetweenStations * (exercises.length - 1);
        return (stationTime + stationRest + restBetweenRounds) * circuitRounds;
      default:
        return 0;
    }
  }, [block]);

  // Handle interval logic
  const handleIntervalTick = useCallback(() => {
    if (!block.intervalConfig) return;
    
    const { workSeconds, restSeconds, rounds, warmupSeconds = 0, cooldownSeconds = 0 } = block.intervalConfig;
    const elapsed = timerState.elapsedSeconds + 1;
    
    // During warmup
    if (elapsed <= warmupSeconds) {
      setTimerState(prev => ({
        ...prev,
        elapsedSeconds: elapsed,
        currentRound: 0,
        workPhase: false,
      }));
      return;
    }
    
    // After warmup
    const afterWarmup = elapsed - warmupSeconds;
    const cycleLength = workSeconds + restSeconds;
    const totalWorkRest = cycleLength * rounds;
    
    // During work/rest cycles
    if (afterWarmup <= totalWorkRest) {
      const currentCycle = Math.floor((afterWarmup - 1) / cycleLength);
      const positionInCycle = (afterWarmup - 1) % cycleLength;
      const isWork = positionInCycle < workSeconds;
      
      // Beep on phase change
      if (positionInCycle === 0 || positionInCycle === workSeconds) {
        playBeep();
      }
      
      setTimerState(prev => ({
        ...prev,
        elapsedSeconds: elapsed,
        currentRound: currentCycle + 1,
        workPhase: isWork,
      }));
      return;
    }
    
    // During cooldown
    const afterCycles = afterWarmup - totalWorkRest;
    if (afterCycles <= cooldownSeconds) {
      setTimerState(prev => ({
        ...prev,
        elapsedSeconds: elapsed,
        currentRound: rounds,
        workPhase: false,
      }));
      return;
    }
    
    // Completed
    handleComplete();
  }, [block.intervalConfig, timerState.elapsedSeconds, playBeep]);

  // Handle circuit logic
  const handleCircuitTick = useCallback(() => {
    if (!block.circuitConfig) return;
    
    const { exercises, restBetweenStations, restBetweenRounds, rounds } = block.circuitConfig;
    const elapsed = timerState.elapsedSeconds + 1;
    
    // Calculate position
    const stationDurations = exercises.map(ex => ex.duration || 30);
    const roundDuration = stationDurations.reduce((sum, d) => sum + d, 0) + 
                          restBetweenStations * (exercises.length - 1) + 
                          restBetweenRounds;
    
    const currentRound = Math.floor(elapsed / roundDuration) + 1;
    const positionInRound = elapsed % roundDuration;
    
    // Find current station
    let cumulativeTime = 0;
    let currentStation = 0;
    for (let i = 0; i < exercises.length; i++) {
      cumulativeTime += stationDurations[i];
      if (positionInRound < cumulativeTime) {
        currentStation = i;
        break;
      }
      cumulativeTime += restBetweenStations;
    }
    
    // Check if complete
    if (currentRound > rounds) {
      handleComplete();
      return;
    }
    
    // Beep on station change
    if (positionInRound === 0 || stationDurations.slice(0, currentStation + 1).reduce((a, b) => a + b, 0) === positionInRound) {
      playBeep();
    }
    
    setTimerState(prev => ({
      ...prev,
      elapsedSeconds: elapsed,
      currentRound,
      currentStation,
    }));
  }, [block.circuitConfig, timerState.elapsedSeconds, playBeep]);

  // Main timer tick
  const tick = useCallback(() => {
    const elapsed = timerState.elapsedSeconds + 1;
    const total = getTotalDuration();
    
    if (block.mode === 'intervals') {
      handleIntervalTick();
    } else if (block.mode === 'circuit') {
      handleCircuitTick();
    } else {
      // Simple countdown for steady, emom, amrap, for_time
      if (total > 0 && elapsed >= total) {
        handleComplete();
      } else {
        setTimerState(prev => ({
          ...prev,
          elapsedSeconds: elapsed,
        }));
      }
    }
  }, [timerState.elapsedSeconds, getTotalDuration, block.mode, handleIntervalTick, handleCircuitTick]);

  // Start timer
  const handleStart = () => {
    setTimerState(prev => ({ ...prev, status: 'running' }));
  };

  // Pause timer
  const handlePause = () => {
    setTimerState(prev => ({ ...prev, status: 'paused' }));
  };

  // Reset timer
  const handleReset = () => {
    setTimerState({
      status: 'idle',
      elapsedSeconds: 0,
      currentRound: undefined,
      currentStation: undefined,
      workPhase: undefined,
    });
  };

  // Complete block
  const handleComplete = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setTimerState(prev => ({ ...prev, status: 'completed' }));
    onUpdate({
      timerState: { ...timerState, status: 'completed' },
      completedAt: new Date().toISOString(),
      actualDuration: timerState.elapsedSeconds,
      completedRounds: timerState.currentRound,
    });
    playBeep();
    playBeep();
    onComplete();
  }, [timerState, onUpdate, onComplete, playBeep]);

  // Timer interval effect
  useEffect(() => {
    if (timerState.status === 'running') {
      intervalRef.current = setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.status, tick]);

  // Update parent on timer state change
  useEffect(() => {
    onUpdate({ timerState });
  }, [timerState, onUpdate]);

  // Get display info based on mode
  const getDisplayInfo = () => {
    const total = getTotalDuration();
    const remaining = Math.max(0, total - timerState.elapsedSeconds);
    const progress = total > 0 ? (timerState.elapsedSeconds / total) * 100 : 0;
    
    switch (block.mode) {
      case 'intervals':
        return {
          title: timerState.workPhase ? 'WORK' : 'REST',
          subtitle: timerState.currentRound ? `Round ${timerState.currentRound} of ${block.intervalConfig?.rounds}` : 'Get Ready',
          color: timerState.workPhase ? 'text-red-500' : 'text-green-500',
          bgColor: timerState.workPhase ? 'bg-red-500/20' : 'bg-green-500/20',
          progress,
          remaining,
        };
      case 'circuit':
        const exercise = block.circuitConfig?.exercises[timerState.currentStation || 0];
        return {
          title: exercise?.exerciseName || 'Get Ready',
          subtitle: `Round ${timerState.currentRound || 1} of ${block.circuitConfig?.rounds}`,
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/20',
          progress,
          remaining,
        };
      case 'emom':
        return {
          title: 'EMOM',
          subtitle: `Minute ${Math.floor(timerState.elapsedSeconds / 60) + 1} of ${block.emomConfig?.totalMinutes}`,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/20',
          progress,
          remaining,
        };
      case 'amrap':
        return {
          title: 'AMRAP',
          subtitle: `${formatTime(remaining)} remaining`,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/20',
          progress,
          remaining,
        };
      case 'for_time':
        return {
          title: 'For Time',
          subtitle: block.forTimeConfig?.timeCap ? `Cap: ${formatTime(block.forTimeConfig.timeCap)}` : 'No time cap',
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/20',
          progress,
          remaining,
        };
      default:
        return {
          title: block.steadyConfig?.activityType?.toUpperCase() || 'STEADY',
          subtitle: block.steadyConfig?.intensity || '',
          color: 'text-green-500',
          bgColor: 'bg-green-500/20',
          progress,
          remaining,
        };
    }
  };

  const displayInfo = getDisplayInfo();

  return (
    <Card className={cn('border-2', displayInfo.bgColor)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Timer className={cn('h-5 w-5', displayInfo.color)} />
            {block.name}
          </CardTitle>
          <Badge variant="outline" className={displayInfo.color}>
            {block.mode.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main display */}
        <div className="text-center py-6">
          <p className={cn('text-sm font-medium mb-1', displayInfo.color)}>
            {displayInfo.title}
          </p>
          <p className="text-6xl font-mono font-bold">
            {formatTime(timerState.elapsedSeconds)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {displayInfo.subtitle}
          </p>
        </div>

        {/* Progress bar */}
        {getTotalDuration() > 0 && (
          <Progress value={displayInfo.progress} className="h-2" />
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {timerState.status === 'idle' || timerState.status === 'paused' ? (
            <Button onClick={handleStart} size="lg" className="gap-2">
              <Play className="h-5 w-5" />
              {timerState.status === 'paused' ? 'Resume' : 'Start'}
            </Button>
          ) : timerState.status === 'running' ? (
            <Button onClick={handlePause} size="lg" variant="secondary" className="gap-2">
              <Pause className="h-5 w-5" />
              Pause
            </Button>
          ) : null}
          
          {timerState.status !== 'idle' && timerState.status !== 'completed' && (
            <Button onClick={handleReset} size="lg" variant="outline" className="gap-2">
              <RotateCcw className="h-5 w-5" />
              Reset
            </Button>
          )}
          
          {timerState.status === 'running' && (
            <Button onClick={handleComplete} size="lg" variant="destructive" className="gap-2">
              <Square className="h-5 w-5" />
              End
            </Button>
          )}
          
          {timerState.status === 'completed' && (
            <Badge variant="default" className="text-lg py-2 px-4 bg-green-600">
              ✓ Completed
            </Badge>
          )}
        </div>

        {/* Circuit exercise list */}
        {block.mode === 'circuit' && block.circuitConfig && (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Stations:</p>
            {block.circuitConfig.exercises.map((ex, idx) => (
              <div
                key={ex.id}
                className={cn(
                  'flex items-center justify-between py-1 px-2 rounded text-sm',
                  timerState.currentStation === idx && timerState.status === 'running'
                    ? 'bg-purple-500/20 font-medium'
                    : ''
                )}
              >
                <span>{ex.exerciseName}</span>
                <span className="text-muted-foreground">
                  {ex.duration ? `${ex.duration}s` : `${ex.reps} reps`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Interval info */}
        {block.mode === 'intervals' && block.intervalConfig && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="p-2 rounded bg-muted">
              <p className="text-muted-foreground">Work</p>
              <p className="font-bold text-red-500">{block.intervalConfig.workSeconds}s</p>
            </div>
            <div className="p-2 rounded bg-muted">
              <p className="text-muted-foreground">Rest</p>
              <p className="font-bold text-green-500">{block.intervalConfig.restSeconds}s</p>
            </div>
            <div className="p-2 rounded bg-muted">
              <p className="text-muted-foreground">Rounds</p>
              <p className="font-bold">{block.intervalConfig.rounds}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
