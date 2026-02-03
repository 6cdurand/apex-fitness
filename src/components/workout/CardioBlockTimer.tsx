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
  Undo2,
  ChevronRight,
  Clock,
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
  onComplete: (data?: { roundTimes?: number[]; difficultyRating?: 'easy' | 'moderate' | 'hard' | null }) => void;
  previousBestTime?: number; // Previous best total time for this circuit + client
  clientId?: string;
}

export function CardioBlockTimer({ block, onUpdate, onComplete, previousBestTime, clientId }: CardioBlockTimerProps) {
  const [timerState, setTimerState] = useState<CardioTimerState>(block.timerState);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Per-round time tracking
  const [roundTimes, setRoundTimes] = useState<number[]>([]);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [lastRound, setLastRound] = useState<number>(0);
  
  // Round transition animation
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [transitionRound, setTransitionRound] = useState(1);
  
  // Undo state - can undo within 5 seconds of round change
  const [canUndo, setCanUndo] = useState(false);
  const [undoTimeoutId, setUndoTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [savedStateForUndo, setSavedStateForUndo] = useState<{ round: number; elapsed: number; roundTimes: number[] } | null>(null);
  
  // Difficulty rating (shown after completion)
  const [difficultyRating, setDifficultyRating] = useState<'easy' | 'moderate' | 'hard' | null>(null);

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
    
    // Track round changes for per-round timing
    if (currentRound !== lastRound && currentRound > 1 && lastRound > 0) {
      // Record time for completed round
      const roundTime = elapsed - roundStartTime;
      setRoundTimes(prev => [...prev, roundTime]);
      setRoundStartTime(elapsed);
      
      // Save state for potential undo
      setSavedStateForUndo({
        round: lastRound,
        elapsed: timerState.elapsedSeconds,
        roundTimes: [...roundTimes],
      });
      setCanUndo(true);
      
      // Clear undo after 5 seconds
      if (undoTimeoutId) clearTimeout(undoTimeoutId);
      const timeoutId = setTimeout(() => {
        setCanUndo(false);
        setSavedStateForUndo(null);
      }, 5000);
      setUndoTimeoutId(timeoutId);
      
      // Show round transition animation
      setTransitionRound(currentRound);
      setShowRoundTransition(true);
      setTimeout(() => setShowRoundTransition(false), 1500);
    }
    setLastRound(currentRound);
    
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
      // Record final round time
      const finalRoundTime = elapsed - roundStartTime;
      const allRoundTimes = [...roundTimes, finalRoundTime];
      setRoundTimes(allRoundTimes);
      handleCompleteWithData(allRoundTimes);
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
  }, [block.circuitConfig, timerState.elapsedSeconds, playBeep, lastRound, roundStartTime, roundTimes, undoTimeoutId]);
  
  // Undo last round transition
  const handleUndo = useCallback(() => {
    if (!savedStateForUndo || !canUndo) return;
    
    setTimerState(prev => ({
      ...prev,
      elapsedSeconds: savedStateForUndo.elapsed,
      currentRound: savedStateForUndo.round,
    }));
    setRoundTimes(savedStateForUndo.roundTimes);
    setLastRound(savedStateForUndo.round);
    setCanUndo(false);
    setSavedStateForUndo(null);
    if (undoTimeoutId) clearTimeout(undoTimeoutId);
  }, [savedStateForUndo, canUndo, undoTimeoutId]);

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
    setRoundTimes([]);
    setRoundStartTime(0);
    setLastRound(0);
    setCanUndo(false);
    setSavedStateForUndo(null);
    setDifficultyRating(null);
  };
  
  // Initialize round start time when starting
  const handleStart = () => {
    if (timerState.elapsedSeconds === 0) {
      setRoundStartTime(0);
      setLastRound(1);
    }
    setTimerState(prev => ({ ...prev, status: 'running' }));
  };

  // Complete block with round times data
  const handleCompleteWithData = useCallback((finalRoundTimes: number[]) => {
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
    // Don't call onComplete yet - wait for difficulty rating
  }, [timerState, onUpdate, playBeep]);
  
  // Complete block (manual end or non-circuit)
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
    // For non-circuit modes, complete immediately
    if (block.mode !== 'circuit') {
      onComplete();
    }
  }, [timerState, onUpdate, onComplete, playBeep, block.mode]);
  
  // Finish and submit with difficulty rating
  const handleFinishWithRating = useCallback(() => {
    onComplete({
      roundTimes: roundTimes.length > 0 ? roundTimes : undefined,
      difficultyRating,
    });
  }, [onComplete, roundTimes, difficultyRating]);

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
        {/* Previous best time indicator */}
        {previousBestTime && previousBestTime > 0 && block.mode === 'circuit' && timerState.status !== 'completed' && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg py-2">
            <Clock className="h-4 w-4" />
            <span>Previous best: <span className="font-bold text-sky-400">{formatTime(previousBestTime)}</span></span>
          </div>
        )}
        
        {/* Round transition animation overlay */}
        {showRoundTransition && (
          <div className="absolute inset-0 flex items-center justify-center bg-purple-500/90 rounded-lg z-10 animate-pulse">
            <div className="text-center text-white">
              <p className="text-2xl font-bold">Round {transitionRound}</p>
              <p className="text-sm opacity-80">Starting...</p>
            </div>
          </div>
        )}
        
        {/* Main display */}
        <div className="text-center py-6 relative">
          {/* Round indicator for circuits */}
          {block.mode === 'circuit' && timerState.currentRound && timerState.status === 'running' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
              <Badge className="bg-purple-600 text-white text-lg px-4 py-1 animate-pulse">
                Round {timerState.currentRound} of {block.circuitConfig?.rounds}
              </Badge>
            </div>
          )}
          
          <p className={cn('text-sm font-medium mb-1 mt-4', displayInfo.color)}>
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
          
          {timerState.status === 'completed' && block.mode !== 'circuit' && (
            <Badge variant="default" className="text-lg py-2 px-4 bg-green-600">
              ✓ Completed
            </Badge>
          )}
          
          {/* Undo button for circuits */}
          {canUndo && block.mode === 'circuit' && timerState.status === 'running' && (
            <Button onClick={handleUndo} size="lg" variant="outline" className="gap-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500/10">
              <Undo2 className="h-5 w-5" />
              Undo Round
            </Button>
          )}
        </div>
        
        {/* Circuit completion with difficulty rating */}
        {timerState.status === 'completed' && block.mode === 'circuit' && (
          <div className="space-y-4 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <div className="text-center">
              <Badge variant="default" className="text-lg py-2 px-4 bg-green-600 mb-2">
                ✓ Circuit Completed!
              </Badge>
              <p className="text-2xl font-bold text-green-400">{formatTime(timerState.elapsedSeconds)}</p>
              {previousBestTime && timerState.elapsedSeconds < previousBestTime && (
                <p className="text-sm text-green-400 mt-1">🎉 New personal best!</p>
              )}
            </div>
            
            {/* Per-round times summary */}
            {roundTimes.length > 0 && (
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Round times:</p>
                <div className="flex flex-wrap gap-2">
                  {roundTimes.map((time, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      R{idx + 1}: {formatTime(time)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Difficulty rating */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">How did that feel? (optional)</p>
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  variant={difficultyRating === 'easy' ? 'default' : 'outline'}
                  className={cn(
                    difficultyRating === 'easy' ? 'bg-green-600 hover:bg-green-700' : 'border-green-500 text-green-500 hover:bg-green-500/10'
                  )}
                  onClick={() => setDifficultyRating('easy')}
                >
                  😊 Easy
                </Button>
                <Button
                  size="sm"
                  variant={difficultyRating === 'moderate' ? 'default' : 'outline'}
                  className={cn(
                    difficultyRating === 'moderate' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-500 text-yellow-500 hover:bg-yellow-500/10'
                  )}
                  onClick={() => setDifficultyRating('moderate')}
                >
                  😅 Moderate
                </Button>
                <Button
                  size="sm"
                  variant={difficultyRating === 'hard' ? 'default' : 'outline'}
                  className={cn(
                    difficultyRating === 'hard' ? 'bg-red-600 hover:bg-red-700' : 'border-red-500 text-red-500 hover:bg-red-500/10'
                  )}
                  onClick={() => setDifficultyRating('hard')}
                >
                  🥵 Hard
                </Button>
              </div>
            </div>
            
            {/* Finish button */}
            <Button onClick={handleFinishWithRating} className="w-full bg-sky-500 hover:bg-sky-600 gap-2">
              <ChevronRight className="h-5 w-5" />
              Continue
            </Button>
          </div>
        )}

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
