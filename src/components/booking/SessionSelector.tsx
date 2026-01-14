'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  CalendarIcon,
  Clock,
  Dumbbell,
  Repeat,
  Plus,
  Check,
} from 'lucide-react';
import { format, addDays, addWeeks, setHours, setMinutes } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { ClientProgram, ClientWorkoutDay } from '@/types';
import { cn } from '@/lib/utils';

interface SessionSelectorProps {
  clientId: string;
  clientName: string;
  program?: ClientProgram;
  onBook: (booking: BookingData) => void;
  onCancel: () => void;
}

export interface BookingData {
  id: string;
  clientId: string;
  date: string;
  time: string;
  duration: number;
  sessionType: 'plan' | 'extra';
  planSessionId?: string;
  weekNumber?: number;
  dayNumber?: number;
  sessionName?: string;
  recurring?: {
    frequency: 'weekly' | 'biweekly' | 'none';
    endDate?: string;
  };
  notes?: string;
}

// Time slot options
const TIME_SLOTS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 75, label: '75 min' },
  { value: 90, label: '90 min' },
];

export function SessionSelector({
  clientId,
  clientName,
  program,
  onBook,
  onCancel,
}: SessionSelectorProps) {
  const [sessionType, setSessionType] = useState<'plan' | 'extra'>('plan');
  const [selectedPlanSession, setSelectedPlanSession] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [recurring, setRecurring] = useState<'none' | 'weekly' | 'biweekly'>('none');
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');

  // Build list of plan sessions
  const planSessions = useMemo(() => {
    if (!program) return [];
    
    const sessions: Array<{
      id: string;
      label: string;
      weekNumber: number;
      dayNumber: number;
      dayLabel: string;
    }> = [];

    // Get workout days from the program
    const workoutDays = program.weeklyPlan || [];

    // For each week (show first 4 weeks), list the sessions
    for (let week = 1; week <= 4; week++) {
      workoutDays.forEach((day: ClientWorkoutDay, idx: number) => {
        sessions.push({
          id: `w${week}-d${idx + 1}`,
          label: `Week ${week} - ${day.dayLabel}`,
          weekNumber: week,
          dayNumber: idx + 1,
          dayLabel: day.dayLabel,
        });
      });
    }

    return sessions;
  }, [program]);

  // Get selected session details
  const selectedSession = planSessions.find(s => s.id === selectedPlanSession);

  const handleBook = () => {
    if (!date) return;

    const booking: BookingData = {
      id: uuidv4(),
      clientId,
      date: date.toISOString().split('T')[0],
      time,
      duration,
      sessionType,
      notes: notes || undefined,
    };

    if (sessionType === 'plan' && selectedSession) {
      booking.planSessionId = selectedSession.id;
      booking.weekNumber = selectedSession.weekNumber;
      booking.dayNumber = selectedSession.dayNumber;
      booking.sessionName = selectedSession.dayLabel;
    } else {
      booking.sessionName = 'Extra Session';
    }

    if (recurring !== 'none') {
      booking.recurring = {
        frequency: recurring,
        endDate: recurringEndDate?.toISOString().split('T')[0],
      };
    }

    onBook(booking);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Book Session for {clientName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Type Selection */}
        <div className="space-y-3">
          <Label>Session Type</Label>
          <RadioGroup
            value={sessionType}
            onValueChange={(v) => setSessionType(v as 'plan' | 'extra')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="plan" id="plan" />
              <Label htmlFor="plan" className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4" />
                  Attach to Plan Session
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="extra" id="extra" />
              <Label htmlFor="extra" className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Extra Session
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Plan Session Selection */}
        {sessionType === 'plan' && (
          <div className="space-y-2">
            <Label>Select Plan Session</Label>
            {program && planSessions.length > 0 ? (
              <Select
                value={selectedPlanSession}
                onValueChange={setSelectedPlanSession}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a session from the plan" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {planSessions.map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                No program assigned. Select "Extra Session" or assign a program first.
              </p>
            )}
          </div>
        )}

        <Separator />

        {/* Date & Time Selection */}
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
                  {date ? format(date, 'EEE, MMM d') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Time</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {TIME_SLOTS.map(slot => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <Label>Duration</Label>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={duration === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDuration(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Recurring Options */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Recurring
          </Label>
          <RadioGroup
            value={recurring}
            onValueChange={(v) => setRecurring(v as 'none' | 'weekly' | 'biweekly')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="none" />
              <Label htmlFor="none" className="cursor-pointer">One-time</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekly" id="weekly" />
              <Label htmlFor="weekly" className="cursor-pointer">Weekly</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="biweekly" id="biweekly" />
              <Label htmlFor="biweekly" className="cursor-pointer">Bi-weekly</Label>
            </div>
          </RadioGroup>

          {recurring !== 'none' && (
            <div className="pl-4 pt-2 space-y-2">
              <Label className="text-sm">End recurring on</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'w-48 justify-start text-left font-normal',
                      !recurringEndDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recurringEndDate ? format(recurringEndDate, 'MMM d, yyyy') : 'No end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={recurringEndDate}
                    onSelect={setRecurringEndDate}
                    disabled={(d) => d <= (date || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes for this booking..."
          />
        </div>

        {/* Preview */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-medium">Booking Preview</p>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/20 rounded">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {sessionType === 'plan' && selectedSession
                  ? selectedSession.label
                  : 'Extra Session'}
              </p>
              <p className="text-sm text-muted-foreground">
                {date && format(date, 'EEEE, MMMM d, yyyy')} at {time}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{duration} min</Badge>
                {recurring !== 'none' && (
                  <Badge variant="secondary">
                    <Repeat className="h-3 w-3 mr-1" />
                    {recurring === 'weekly' ? 'Weekly' : 'Bi-weekly'}
                  </Badge>
                )}
                <Badge className={sessionType === 'plan' ? 'bg-primary' : 'bg-orange-500'}>
                  {sessionType === 'plan' ? 'Plan Session' : 'Extra'}
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
          <Button
            onClick={handleBook}
            disabled={sessionType === 'plan' && !selectedPlanSession && planSessions.length > 0}
          >
            <Check className="h-4 w-4 mr-2" />
            Book Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
