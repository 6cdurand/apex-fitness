'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Timer,
  Zap,
  RefreshCw,
  Target,
  Clock,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type {
  CardioBlock,
  CardioMode,
  CardioActivityType,
  IntensityLevel,
  CircuitExercise,
  SteadyCardioConfig,
  IntervalConfig,
  CircuitConfig,
  EMOMConfig,
  AMRAPConfig,
  ForTimeConfig,
} from '@/types';

interface CardioBlockBuilderProps {
  onSave: (block: CardioBlock) => void;
  onCancel: () => void;
  initialBlock?: CardioBlock;
}

const CARDIO_MODES: { value: CardioMode; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'steady', label: 'Steady State', icon: <Clock className="h-4 w-4" />, description: 'Walk, Run, Yoga, Row, Bike' },
  { value: 'intervals', label: 'Intervals', icon: <Zap className="h-4 w-4" />, description: 'Work/Rest × Rounds' },
  { value: 'circuit', label: 'Circuit', icon: <RefreshCw className="h-4 w-4" />, description: 'Station-based training' },
  { value: 'emom', label: 'EMOM', icon: <Timer className="h-4 w-4" />, description: 'Every Minute On the Minute' },
  { value: 'amrap', label: 'AMRAP', icon: <Target className="h-4 w-4" />, description: 'As Many Reps As Possible' },
  { value: 'for_time', label: 'For Time', icon: <Timer className="h-4 w-4" />, description: 'Complete as fast as possible' },
];

const ACTIVITY_TYPES: CardioActivityType[] = ['walk', 'run', 'bike', 'row', 'swim', 'yoga', 'stretching', 'other'];
const INTENSITY_LEVELS: IntensityLevel[] = ['easy', 'moderate', 'hard'];

export function CardioBlockBuilder({ onSave, onCancel, initialBlock }: CardioBlockBuilderProps) {
  const [mode, setMode] = useState<CardioMode>(initialBlock?.mode || 'steady');
  const [name, setName] = useState(initialBlock?.name || '');
  
  // Steady config
  const [steadyConfig, setSteadyConfig] = useState<SteadyCardioConfig>(
    initialBlock?.steadyConfig || {
      activityType: 'run',
      duration: 1800, // 30 min
      intensity: 'moderate',
    }
  );
  
  // Interval config
  const [intervalConfig, setIntervalConfig] = useState<IntervalConfig>(
    initialBlock?.intervalConfig || {
      workSeconds: 30,
      restSeconds: 30,
      rounds: 10,
      warmupSeconds: 60,
      cooldownSeconds: 60,
    }
  );
  
  // Circuit config
  const [circuitConfig, setCircuitConfig] = useState<CircuitConfig>(
    initialBlock?.circuitConfig || {
      rounds: 3,
      exercises: [],
      restBetweenStations: 15,
      restBetweenRounds: 60,
    }
  );
  
  // EMOM config
  const [emomConfig, setEmomConfig] = useState<EMOMConfig>(
    initialBlock?.emomConfig || {
      totalMinutes: 10,
      exercises: [],
    }
  );
  
  // AMRAP config
  const [amrapConfig, setAmrapConfig] = useState<AMRAPConfig>(
    initialBlock?.amrapConfig || {
      totalMinutes: 15,
      exercises: [],
    }
  );
  
  // For Time config
  const [forTimeConfig, setForTimeConfig] = useState<ForTimeConfig>(
    initialBlock?.forTimeConfig || {
      exercises: [],
      timeCap: 1200, // 20 min
    }
  );

  // Add circuit exercise
  const addCircuitExercise = (configType: 'circuit' | 'emom' | 'amrap' | 'for_time') => {
    const newExercise: CircuitExercise = {
      id: uuidv4(),
      exerciseName: '',
      duration: 30,
    };
    
    if (configType === 'circuit') {
      setCircuitConfig(prev => ({
        ...prev,
        exercises: [...prev.exercises, newExercise],
      }));
    } else if (configType === 'emom') {
      setEmomConfig(prev => ({
        ...prev,
        exercises: [...prev.exercises, newExercise],
      }));
    } else if (configType === 'amrap') {
      setAmrapConfig(prev => ({
        ...prev,
        exercises: [...prev.exercises, { ...newExercise, reps: 10 }],
      }));
    } else {
      setForTimeConfig(prev => ({
        ...prev,
        exercises: [...prev.exercises, { ...newExercise, reps: 10 }],
      }));
    }
  };

  // Remove circuit exercise
  const removeCircuitExercise = (id: string, configType: 'circuit' | 'emom' | 'amrap' | 'for_time') => {
    if (configType === 'circuit') {
      setCircuitConfig(prev => ({
        ...prev,
        exercises: prev.exercises.filter(e => e.id !== id),
      }));
    } else if (configType === 'emom') {
      setEmomConfig(prev => ({
        ...prev,
        exercises: prev.exercises.filter(e => e.id !== id),
      }));
    } else if (configType === 'amrap') {
      setAmrapConfig(prev => ({
        ...prev,
        exercises: prev.exercises.filter(e => e.id !== id),
      }));
    } else {
      setForTimeConfig(prev => ({
        ...prev,
        exercises: prev.exercises.filter(e => e.id !== id),
      }));
    }
  };

  // Update circuit exercise
  const updateCircuitExercise = (
    id: string,
    updates: Partial<CircuitExercise>,
    configType: 'circuit' | 'emom' | 'amrap' | 'for_time'
  ) => {
    const updateFn = (exercises: CircuitExercise[]) =>
      exercises.map(e => (e.id === id ? { ...e, ...updates } : e));
    
    if (configType === 'circuit') {
      setCircuitConfig(prev => ({ ...prev, exercises: updateFn(prev.exercises) }));
    } else if (configType === 'emom') {
      setEmomConfig(prev => ({ ...prev, exercises: updateFn(prev.exercises) }));
    } else if (configType === 'amrap') {
      setAmrapConfig(prev => ({ ...prev, exercises: updateFn(prev.exercises) }));
    } else {
      setForTimeConfig(prev => ({ ...prev, exercises: updateFn(prev.exercises) }));
    }
  };

  // Handle save
  const handleSave = () => {
    const block: CardioBlock = {
      id: initialBlock?.id || uuidv4(),
      mode,
      name: name || getModeLabel(mode),
      timerState: { status: 'idle', elapsedSeconds: 0 },
    };
    
    switch (mode) {
      case 'steady':
        block.steadyConfig = steadyConfig;
        break;
      case 'intervals':
        block.intervalConfig = intervalConfig;
        break;
      case 'circuit':
        block.circuitConfig = circuitConfig;
        break;
      case 'emom':
        block.emomConfig = emomConfig;
        break;
      case 'amrap':
        block.amrapConfig = amrapConfig;
        break;
      case 'for_time':
        block.forTimeConfig = forTimeConfig;
        break;
    }
    
    onSave(block);
  };

  const getModeLabel = (m: CardioMode) => CARDIO_MODES.find(cm => cm.value === m)?.label || m;

  return (
    <Card className="border-green-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-green-500" />
          {initialBlock ? 'Edit Cardio Block' : 'Add Cardio Block'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Block Name */}
        <div className="space-y-2">
          <Label>Block Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Morning Run, HIIT Circuit"
          />
        </div>

        {/* Mode Selection */}
        <div className="space-y-2">
          <Label>Cardio Type</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {CARDIO_MODES.map(m => (
              <Button
                key={m.value}
                variant={mode === m.value ? 'default' : 'outline'}
                className="h-auto py-3 flex flex-col items-center gap-1"
                onClick={() => setMode(m.value)}
              >
                {m.icon}
                <span className="text-sm font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.description}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Mode-specific config */}
        <div className="space-y-4 pt-4 border-t">
          {/* Steady State */}
          {mode === 'steady' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Activity</Label>
                  <Select
                    value={steadyConfig.activityType}
                    onValueChange={v => setSteadyConfig(prev => ({ ...prev, activityType: v as CardioActivityType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map(a => (
                        <SelectItem key={a} value={a}>
                          {a.charAt(0).toUpperCase() + a.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Intensity</Label>
                  <Select
                    value={steadyConfig.intensity}
                    onValueChange={v => setSteadyConfig(prev => ({ ...prev, intensity: v as IntensityLevel }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTENSITY_LEVELS.map(i => (
                        <SelectItem key={i} value={i}>
                          {i.charAt(0).toUpperCase() + i.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={Math.floor((steadyConfig.duration || 0) / 60)}
                    onChange={e => setSteadyConfig(prev => ({ ...prev, duration: parseInt(e.target.value) * 60 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Distance (optional)</Label>
                  <Input
                    type="number"
                    value={steadyConfig.distance || ''}
                    onChange={e => setSteadyConfig(prev => ({ ...prev, distance: parseFloat(e.target.value) || undefined }))}
                    placeholder="km"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>HR Zone (optional)</Label>
                <Select
                  value={steadyConfig.hrZone?.toString() || ''}
                  onValueChange={v => setSteadyConfig(prev => ({ ...prev, hrZone: v ? parseInt(v) as 1|2|3|4|5 : undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select HR Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Zone 1 - Recovery</SelectItem>
                    <SelectItem value="2">Zone 2 - Aerobic</SelectItem>
                    <SelectItem value="3">Zone 3 - Tempo</SelectItem>
                    <SelectItem value="4">Zone 4 - Threshold</SelectItem>
                    <SelectItem value="5">Zone 5 - Max</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Intervals */}
          {mode === 'intervals' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Work (sec)</Label>
                  <Input
                    type="number"
                    value={intervalConfig.workSeconds}
                    onChange={e => setIntervalConfig(prev => ({ ...prev, workSeconds: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rest (sec)</Label>
                  <Input
                    type="number"
                    value={intervalConfig.restSeconds}
                    onChange={e => setIntervalConfig(prev => ({ ...prev, restSeconds: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rounds</Label>
                  <Input
                    type="number"
                    value={intervalConfig.rounds}
                    onChange={e => setIntervalConfig(prev => ({ ...prev, rounds: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Warmup (sec)</Label>
                  <Input
                    type="number"
                    value={intervalConfig.warmupSeconds || 0}
                    onChange={e => setIntervalConfig(prev => ({ ...prev, warmupSeconds: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cooldown (sec)</Label>
                  <Input
                    type="number"
                    value={intervalConfig.cooldownSeconds || 0}
                    onChange={e => setIntervalConfig(prev => ({ ...prev, cooldownSeconds: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Total time: {Math.floor(((intervalConfig.warmupSeconds || 0) + 
                    (intervalConfig.workSeconds + intervalConfig.restSeconds) * intervalConfig.rounds + 
                    (intervalConfig.cooldownSeconds || 0)) / 60)} min
                </p>
              </div>
            </div>
          )}

          {/* Circuit */}
          {mode === 'circuit' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Rounds</Label>
                  <Input
                    type="number"
                    value={circuitConfig.rounds}
                    onChange={e => setCircuitConfig(prev => ({ ...prev, rounds: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rest Between Stations (sec)</Label>
                  <Input
                    type="number"
                    value={circuitConfig.restBetweenStations}
                    onChange={e => setCircuitConfig(prev => ({ ...prev, restBetweenStations: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rest Between Rounds (sec)</Label>
                  <Input
                    type="number"
                    value={circuitConfig.restBetweenRounds}
                    onChange={e => setCircuitConfig(prev => ({ ...prev, restBetweenRounds: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Stations</Label>
                  <Button size="sm" variant="outline" onClick={() => addCircuitExercise('circuit')}>
                    <Plus className="h-4 w-4 mr-1" /> Add Station
                  </Button>
                </div>
                {circuitConfig.exercises.map((ex, idx) => (
                  <div key={ex.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm font-medium w-6">{idx + 1}.</span>
                    <Input
                      placeholder="Exercise name"
                      value={ex.exerciseName}
                      onChange={e => updateCircuitExercise(ex.id, { exerciseName: e.target.value }, 'circuit')}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Sec"
                      value={ex.duration || ''}
                      onChange={e => updateCircuitExercise(ex.id, { duration: parseInt(e.target.value) }, 'circuit')}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">sec</span>
                    <Button size="icon" variant="ghost" onClick={() => removeCircuitExercise(ex.id, 'circuit')}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMOM */}
          {mode === 'emom' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Total Minutes</Label>
                <Input
                  type="number"
                  value={emomConfig.totalMinutes}
                  onChange={e => setEmomConfig(prev => ({ ...prev, totalMinutes: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Exercises (rotate each minute)</Label>
                  <Button size="sm" variant="outline" onClick={() => addCircuitExercise('emom')}>
                    <Plus className="h-4 w-4 mr-1" /> Add Exercise
                  </Button>
                </div>
                {emomConfig.exercises.map((ex, idx) => (
                  <div key={ex.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm font-medium w-6">{idx + 1}.</span>
                    <Input
                      placeholder="Exercise name"
                      value={ex.exerciseName}
                      onChange={e => updateCircuitExercise(ex.id, { exerciseName: e.target.value }, 'emom')}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Reps"
                      value={ex.reps || ''}
                      onChange={e => updateCircuitExercise(ex.id, { reps: parseInt(e.target.value) }, 'emom')}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">reps</span>
                    <Button size="icon" variant="ghost" onClick={() => removeCircuitExercise(ex.id, 'emom')}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AMRAP */}
          {mode === 'amrap' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Time Cap (minutes)</Label>
                <Input
                  type="number"
                  value={amrapConfig.totalMinutes}
                  onChange={e => setAmrapConfig(prev => ({ ...prev, totalMinutes: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Exercises</Label>
                  <Button size="sm" variant="outline" onClick={() => addCircuitExercise('amrap')}>
                    <Plus className="h-4 w-4 mr-1" /> Add Exercise
                  </Button>
                </div>
                {amrapConfig.exercises.map((ex, idx) => (
                  <div key={ex.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm font-medium w-6">{idx + 1}.</span>
                    <Input
                      placeholder="Exercise name"
                      value={ex.exerciseName}
                      onChange={e => updateCircuitExercise(ex.id, { exerciseName: e.target.value }, 'amrap')}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Reps"
                      value={ex.reps || ''}
                      onChange={e => updateCircuitExercise(ex.id, { reps: parseInt(e.target.value) }, 'amrap')}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">reps</span>
                    <Button size="icon" variant="ghost" onClick={() => removeCircuitExercise(ex.id, 'amrap')}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* For Time */}
          {mode === 'for_time' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Time Cap (minutes, optional)</Label>
                <Input
                  type="number"
                  value={forTimeConfig.timeCap ? forTimeConfig.timeCap / 60 : ''}
                  onChange={e => setForTimeConfig(prev => ({ 
                    ...prev, 
                    timeCap: e.target.value ? parseInt(e.target.value) * 60 : undefined 
                  }))}
                  placeholder="No cap"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Exercises</Label>
                  <Button size="sm" variant="outline" onClick={() => addCircuitExercise('for_time')}>
                    <Plus className="h-4 w-4 mr-1" /> Add Exercise
                  </Button>
                </div>
                {forTimeConfig.exercises.map((ex, idx) => (
                  <div key={ex.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm font-medium w-6">{idx + 1}.</span>
                    <Input
                      placeholder="Exercise name"
                      value={ex.exerciseName}
                      onChange={e => updateCircuitExercise(ex.id, { exerciseName: e.target.value }, 'for_time')}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Reps"
                      value={ex.reps || ''}
                      onChange={e => updateCircuitExercise(ex.id, { reps: parseInt(e.target.value) }, 'for_time')}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">reps</span>
                    <Button size="icon" variant="ghost" onClick={() => removeCircuitExercise(ex.id, 'for_time')}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            {initialBlock ? 'Save Changes' : 'Add Block'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
