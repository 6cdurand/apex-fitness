'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Check,
  Send,
  User,
  Dumbbell,
  FileText,
  Zap,
} from 'lucide-react';
import { allTrainerTemplates, TrainerTemplate } from '@/lib/trainerTemplates';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { toast } from 'sonner';
import { User as UserType } from '@/types';
import { fetchAllUsersFromSupabase } from '@/lib/supabaseSync';

const timeSlots = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

const sessionDurations = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
];

const sessionTypes = [
  { value: 'pt_session', label: 'PT Session' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'assessment', label: 'Assessment' },
];

export default function BookClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  
  const { user, isAuthenticated } = useAuthStore();
  const { getClientById, createBookingRequest, confirmBooking, clients, getActiveProgram } = useTrainerStore();
  
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [sessionType, setSessionType] = useState<'pt_session' | 'consultation' | 'assessment'>('pt_session');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Workout type selection
  const [workoutType, setWorkoutType] = useState<'program' | 'empty' | 'template'>('program');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedProgramDay, setSelectedProgramDay] = useState<string>('');
  
  // Get client's active program
  const activeProgram = useMemo(() => getActiveProgram(clientId), [clientId]);
  
  // Generate day labels (A, B, C, etc.) based on program days
  const programDays = useMemo(() => {
    if (!activeProgram?.weeklyPlan) return [];
    const dayLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    return activeProgram.weeklyPlan.map((day: any, i: number) => ({
      id: day.id || `day-${i}`,
      label: `Day ${dayLabels[i] || i + 1}`,
      dayLabel: day.dayLabel,
      exerciseCount: day.blocks?.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0) || 0,
    }));
  }, [activeProgram]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (user?.mode !== 'trainer') {
      router.replace('/workout');
    }
  }, [isAuthenticated, user?.mode, router]);

  // Load users from both localStorage AND Supabase for cross-device sync
  useEffect(() => {
    const loadAllUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
      setAllUsers(stored);
      
      try {
        const supabaseUsersList = await fetchAllUsersFromSupabase();
        if (supabaseUsersList && supabaseUsersList.length > 0) {
          const supabaseIds = new Set(supabaseUsersList.map((u: any) => u.id));
          const localOnlyUsers = stored.filter((u: any) => !supabaseIds.has(u.id));
          const mergedUsers = [...supabaseUsersList, ...localOnlyUsers];
          setAllUsers(mergedUsers);
        }
      } catch (e) {
        console.error('[Book] Error loading users from Supabase:', e);
      }
    };
    loadAllUsers();
  }, []);

  const clientRelation = useMemo(() => getClientById(clientId), [clientId, clients]);
  const clientUser = useMemo(() => 
    allUsers.find((u: UserType) => u.id === clientId), 
    [allUsers, clientId]
  );

  const calculateEndTime = (start: string, durationMins: string) => {
    const [hours, mins] = start.split(':').map(Number);
    const totalMins = hours * 60 + mins + parseInt(durationMins);
    const endHours = Math.floor(totalMins / 60);
    const endMins = totalMins % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!user?.id || !clientId) return;
    
    setIsSubmitting(true);
    
    try {
      const endTime = calculateEndTime(selectedTime, duration);
      
      const request = createBookingRequest({
        trainerId: user.id,
        clientId,
        date: selectedDate,
        startTime: selectedTime,
        endTime,
        type: sessionType,
        requestedBy: 'trainer',
        notes: notes || undefined,
        location: location || undefined,
      });

      if (autoConfirm) {
        // Auto-confirm the booking (trainer confirms directly)
        confirmBooking(request.id, 'auto');
        toast.success('Session booked and confirmed!');
      } else {
        toast.success('Booking request sent to client');
      }

      router.push(`/clients/${clientId}`);
    } catch (error) {
      toast.error('Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate next 14 days for date selection
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEE, MMM d'),
    };
  });

  if (!clientUser || !clientRelation) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <User className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-400">Client not found</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800">
        <div className="flex items-center gap-4 px-4 pt-12 pb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">Book Session</h1>
            <p className="text-sm text-gray-400">with {clientUser.displayName}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 pb-32 space-y-6">
        {/* Client Info */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={clientUser.profilePhoto} />
                <AvatarFallback>{clientUser.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-white font-medium">{clientUser.displayName}</h3>
                <p className="text-sm text-gray-400">@{clientUser.username}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Selection */}
        <div className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            Select Date
          </Label>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {dateOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time Selection */}
        <div className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            Select Time
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((time) => (
              <Button
                key={time}
                size="sm"
                variant={selectedTime === time ? 'default' : 'outline'}
                className={selectedTime === time 
                  ? 'bg-sky-500 hover:bg-sky-600' 
                  : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
                onClick={() => setSelectedTime(time)}
              >
                {time}
              </Button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <Label className="text-gray-300">Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {sessionDurations.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Session Type */}
        <div className="space-y-2">
          <Label className="text-gray-300">Session Type</Label>
          <Select value={sessionType} onValueChange={(v: any) => setSessionType(v)}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {sessionTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Workout Type Selection */}
        {sessionType === 'pt_session' && (
          <div className="space-y-3">
            <Label className="text-gray-300 flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-sky-400" />
              Workout Plan
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={workoutType === 'program' ? 'default' : 'outline'}
                className={workoutType === 'program' 
                  ? 'bg-sky-500 hover:bg-sky-600 flex-col h-auto py-3' 
                  : 'border-gray-700 text-gray-300 hover:bg-gray-800 flex-col h-auto py-3'
                }
                onClick={() => setWorkoutType('program')}
              >
                <FileText className="w-5 h-5 mb-1" />
                <span className="text-xs">Follow Program</span>
              </Button>
              <Button
                variant={workoutType === 'template' ? 'default' : 'outline'}
                className={workoutType === 'template' 
                  ? 'bg-blue-500 hover:bg-blue-600 flex-col h-auto py-3' 
                  : 'border-gray-700 text-gray-300 hover:bg-gray-800 flex-col h-auto py-3'
                }
                onClick={() => setWorkoutType('template')}
              >
                <Zap className="w-5 h-5 mb-1" />
                <span className="text-xs">Template</span>
              </Button>
              <Button
                variant={workoutType === 'empty' ? 'default' : 'outline'}
                className={workoutType === 'empty' 
                  ? 'bg-gray-600 hover:bg-gray-700 flex-col h-auto py-3' 
                  : 'border-gray-700 text-gray-300 hover:bg-gray-800 flex-col h-auto py-3'
                }
                onClick={() => setWorkoutType('empty')}
              >
                <Dumbbell className="w-5 h-5 mb-1" />
                <span className="text-xs">Empty</span>
              </Button>
            </div>

            {/* Program Day Selection */}
            {workoutType === 'program' && (
              <div className="space-y-2 mt-3">
                {activeProgram ? (
                  <>
                    <Label className="text-gray-400 text-sm">
                      Select Workout Day ({activeProgram.templateName})
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {programDays.map((day) => (
                        <Button
                          key={day.id}
                          variant={selectedProgramDay === day.id ? 'default' : 'outline'}
                          className={selectedProgramDay === day.id 
                            ? 'bg-sky-500 hover:bg-sky-600 flex-col h-auto py-2' 
                            : 'border-gray-700 text-gray-300 hover:bg-gray-800 flex-col h-auto py-2'
                          }
                          onClick={() => setSelectedProgramDay(day.id)}
                        >
                          <span className="font-bold">{day.label}</span>
                          <span className="text-xs opacity-70">{day.exerciseCount} exercises</span>
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-amber-400 text-sm">
                      No program assigned. Select a template or assign a program first.
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 text-amber-400 border-amber-500/50"
                      onClick={() => router.push(`/clients/${clientId}/program/select`)}
                    >
                      Assign Program
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Template Selection */}
            {workoutType === 'template' && (
              <div className="space-y-2 mt-3">
                <Label className="text-gray-400 text-sm">Select Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Choose a workout template..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 max-h-[300px]">
                    {/* Strength Templates */}
                    <div className="px-2 py-1 text-xs text-gray-500 font-semibold">STRENGTH</div>
                    {allTrainerTemplates.filter(t => t.category !== 'circuit').map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                    {/* Circuit Templates */}
                    <div className="px-2 py-1 text-xs text-gray-500 font-semibold mt-2">CIRCUITS</div>
                    {allTrainerTemplates.filter(t => t.category === 'circuit').map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-400" />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplateId && (
                  <p className="text-xs text-gray-500">
                    {allTrainerTemplates.find(t => t.id === selectedTemplateId)?.description}
                  </p>
                )}
              </div>
            )}

            {/* Empty Workout Info */}
            {workoutType === 'empty' && (
              <div className="p-3 bg-gray-800 rounded-lg mt-3">
                <p className="text-gray-400 text-sm">
                  Start with a blank workout and add exercises during the session.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-400" />
            Location (optional)
          </Label>
          <Input
            placeholder="e.g., Catalift Hamilton"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-gray-300">Notes (optional)</Label>
          <Textarea
            placeholder="Add any notes for this session..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
          />
        </div>

        {/* Auto-confirm Toggle */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Auto-confirm booking</p>
                <p className="text-sm text-gray-400">
                  Skip client confirmation and book directly
                </p>
              </div>
              <Switch
                checked={autoConfirm}
                onCheckedChange={setAutoConfirm}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="bg-sky-500/10 border-sky-500/30">
          <CardContent className="p-4">
            <h4 className="text-sky-400 font-medium mb-2">Booking Summary</h4>
            <div className="space-y-1 text-sm">
              <p className="text-gray-300">
                <span className="text-gray-500">Date:</span>{' '}
                {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500">Time:</span>{' '}
                {selectedTime} - {calculateEndTime(selectedTime, duration)}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500">Type:</span>{' '}
                {sessionTypes.find(t => t.value === sessionType)?.label}
              </p>
              {location && (
                <p className="text-gray-300">
                  <span className="text-gray-500">Location:</span> {location}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-gray-950 via-gray-950">
        <Button
          className="w-full bg-sky-500 hover:bg-sky-600 h-12 text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            'Creating...'
          ) : autoConfirm ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Confirm Booking
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Send Booking Request
            </>
          )}
        </Button>
      </div>
    </MainLayout>
  );
}
