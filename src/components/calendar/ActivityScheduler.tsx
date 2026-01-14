'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  CalendarIcon,
  Clock,
  Activity,
  Bike,
  Footprints,
  Waves,
  Sparkles,
  Timer,
} from 'lucide-react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type {
  CalendarActivity,
  CardioBlock,
  CardioActivityType,
  IntensityLevel,
} from '@/types';
import { cn } from '@/lib/utils';

interface ActivitySchedulerProps {
  onSave: (activity: CalendarActivity) => void;
  onCancel: () => void;
  userId: string;
  trainerId?: string;
  initialActivity?: CalendarActivity;
}

const ACTIVITY_OPTIONS: { value: CardioActivityType; label: string; icon: React.ReactNode }[] = [
  { value: 'walk', label: 'Walk', icon: <Footprints className="h-4 w-4" /> },
  { value: 'run', label: 'Run', icon: <Activity className="h-4 w-4" /> },
  { value: 'bike', label: 'Bike', icon: <Bike className="h-4 w-4" /> },
  { value: 'swim', label: 'Swim', icon: <Waves className="h-4 w-4" /> },
  { value: 'yoga', label: 'Yoga', icon: <Sparkles className="h-4 w-4" /> },
  { value: 'stretching', label: 'Stretching', icon: <Sparkles className="h-4 w-4" /> },
  { value: 'row', label: 'Row', icon: <Activity className="h-4 w-4" /> },
  { value: 'other', label: 'Other', icon: <Timer className="h-4 w-4" /> },
];

const INTENSITY_OPTIONS: { value: IntensityLevel; label: string; color: string }[] = [
  { value: 'easy', label: 'Easy', color: 'bg-green-500' },
  { value: 'moderate', label: 'Moderate', color: 'bg-yellow-500' },
  { value: 'hard', label: 'Hard', color: 'bg-red-500' },
];

export function ActivityScheduler({
  onSave,
  onCancel,
  userId,
  trainerId,
  initialActivity,
}: ActivitySchedulerProps) {
  const [activityType, setActivityType] = useState<CardioActivityType>(
    initialActivity?.activityType || 'walk'
  );
  const [date, setDate] = useState<Date | undefined>(
    initialActivity?.scheduledDate ? new Date(initialActivity.scheduledDate) : new Date()
  );
  const [time, setTime] = useState(initialActivity?.scheduledTime || '09:00');
  const [duration, setDuration] = useState(
    initialActivity?.cardioBlock.steadyConfig?.duration 
      ? Math.floor(initialActivity.cardioBlock.steadyConfig.duration / 60) 
      : 30
  );
  const [intensity, setIntensity] = useState<IntensityLevel>(
    initialActivity?.cardioBlock.steadyConfig?.intensity || 'moderate'
  );
  const [notes, setNotes] = useState(initialActivity?.notes || '');
  const [distance, setDistance] = useState<number | undefined>(
    initialActivity?.cardioBlock.steadyConfig?.distance
  );

  const handleSave = () => {
    if (!date) return;

    const cardioBlock: CardioBlock = {
      id: initialActivity?.cardioBlock.id || uuidv4(),
      mode: 'steady',
      name: `${ACTIVITY_OPTIONS.find(a => a.value === activityType)?.label || activityType} - ${format(date, 'MMM d')}`,
      steadyConfig: {
        activityType,
        duration: duration * 60,
        distance,
        distanceUnit: 'km',
        intensity,
        notes,
      },
      timerState: { status: 'idle', elapsedSeconds: 0 },
    };

    const activity: CalendarActivity = {
      id: initialActivity?.id || uuidv4(),
      userId,
      trainerId,
      activityType,
      scheduledDate: date.toISOString().split('T')[0],
      scheduledTime: time,
      cardioBlock,
      status: initialActivity?.status || 'scheduled',
      notes,
    };

    onSave(activity);
  };

  const getActivityIcon = (type: CardioActivityType) => {
    return ACTIVITY_OPTIONS.find(a => a.value === type)?.icon;
  };

  return (
    <Card className="border-green-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          {initialActivity ? 'Edit Activity' : 'Schedule Activity'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Activity Type Selection */}
        <div className="space-y-2">
          <Label>Activity Type</Label>
          <div className="grid grid-cols-4 gap-2">
            {ACTIVITY_OPTIONS.map(option => (
              <Button
                key={option.value}
                variant={activityType === option.value ? 'default' : 'outline'}
                className={cn(
                  'h-auto py-3 flex flex-col items-center gap-1',
                  activityType === option.value && 'bg-green-600 hover:bg-green-700'
                )}
                onClick={() => setActivityType(option.value)}
              >
                {option.icon}
                <span className="text-xs">{option.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Duration & Distance */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 0)}
              min={5}
              max={300}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Distance (km, optional)</Label>
            <Input
              type="number"
              step="0.1"
              value={distance || ''}
              onChange={e => setDistance(parseFloat(e.target.value) || undefined)}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* Intensity */}
        <div className="space-y-2">
          <Label>Intensity</Label>
          <div className="flex gap-2">
            {INTENSITY_OPTIONS.map(option => (
              <Button
                key={option.value}
                variant={intensity === option.value ? 'default' : 'outline'}
                className={cn(
                  'flex-1',
                  intensity === option.value && option.color
                )}
                onClick={() => setIntensity(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional notes for this activity..."
            rows={3}
          />
        </div>

        {/* Preview */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-3 rounded-lg',
              intensity === 'easy' ? 'bg-green-500/20' :
              intensity === 'moderate' ? 'bg-yellow-500/20' : 'bg-red-500/20'
            )}>
              {getActivityIcon(activityType)}
            </div>
            <div>
              <p className="font-medium">
                {ACTIVITY_OPTIONS.find(a => a.value === activityType)?.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {date && format(date, 'EEEE, MMMM d')} at {time}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{duration} min</Badge>
                {distance && <Badge variant="outline">{distance} km</Badge>}
                <Badge className={cn(
                  intensity === 'easy' ? 'bg-green-500' :
                  intensity === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                )}>
                  {intensity}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            {initialActivity ? 'Save Changes' : 'Schedule Activity'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
