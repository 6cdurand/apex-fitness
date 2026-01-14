'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw, X, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RestTimerProps {
  defaultSeconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
  showInline?: boolean;
  onClose?: () => void;
}

export function RestTimer({ 
  defaultSeconds, 
  onComplete, 
  autoStart = false,
  showInline = false,
  onClose,
}: RestTimerProps) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format seconds to MM:SS
  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Play beep sound
  const playBeep = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 200);
      } catch (e) {
        // Fallback: no sound
      }
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            playBeep();
            playBeep();
            onComplete?.();
            return 0;
          }
          // Beep at 3, 2, 1
          if (prev <= 4) {
            playBeep();
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, seconds, onComplete, playBeep]);

  // Auto-start effect
  useEffect(() => {
    if (autoStart) {
      setIsRunning(true);
    }
  }, [autoStart]);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setSeconds(totalSeconds);
  };
  
  const adjustTime = (delta: number) => {
    const newTime = Math.max(5, seconds + delta);
    setSeconds(newTime);
    setTotalSeconds(newTime);
  };

  const progress = totalSeconds > 0 ? ((totalSeconds - seconds) / totalSeconds) * 100 : 0;
  const isLowTime = seconds <= 10 && seconds > 0;
  const isComplete = seconds === 0;

  // Inline compact version (for set rows)
  if (showInline) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
        isRunning && !isComplete ? 'bg-blue-500/20' : '',
        isLowTime ? 'bg-red-500/20' : '',
        isComplete ? 'bg-green-500/20' : ''
      )}>
        <span className={cn(
          'font-mono text-lg font-bold',
          isLowTime ? 'text-red-500 animate-pulse' : '',
          isComplete ? 'text-green-500' : ''
        )}>
          {formatTime(seconds)}
        </span>
        
        {!isComplete && (
          <>
            {!isRunning ? (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleStart}>
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handlePause}>
                <Pause className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </>
        )}
        
        {isComplete && (
          <Badge variant="outline" className="text-green-500 border-green-500">
            Done!
          </Badge>
        )}
        
        {onClose && (
          <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Full sticky footer version
  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 z-50 p-4 border-t shadow-lg transition-colors',
      'bg-background/95 backdrop-blur',
      isLowTime ? 'border-red-500' : 'border-blue-500'
    )}>
      <div className="max-w-md mx-auto space-y-3">
        {/* Progress bar */}
        <Progress 
          value={progress} 
          className={cn('h-2', isLowTime ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500')} 
        />
        
        <div className="flex items-center justify-between">
          {/* Time adjusters */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjustTime(-15)}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-8 text-center">15s</span>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjustTime(15)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Main timer display */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">REST</p>
            <p className={cn(
              'text-4xl font-mono font-bold',
              isLowTime ? 'text-red-500 animate-pulse' : '',
              isComplete ? 'text-green-500' : ''
            )}>
              {formatTime(seconds)}
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isComplete ? (
              <>
                {!isRunning ? (
                  <Button size="lg" onClick={handleStart} className="gap-2">
                    <Play className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" onClick={handlePause} className="gap-2">
                    <Pause className="h-5 w-5" />
                  </Button>
                )}
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <Badge variant="default" className="text-lg py-2 px-4 bg-green-600">
                Ready!
              </Badge>
            )}
            
            {onClose && (
              <Button size="icon" variant="ghost" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing rest timer state
export function useRestTimer(defaultSeconds: number = 60) {
  const [isActive, setIsActive] = useState(false);
  const [restSeconds, setRestSeconds] = useState(defaultSeconds);

  const startRest = (seconds?: number) => {
    setRestSeconds(seconds || defaultSeconds);
    setIsActive(true);
  };

  const stopRest = () => {
    setIsActive(false);
  };

  return {
    isActive,
    restSeconds,
    startRest,
    stopRest,
  };
}
