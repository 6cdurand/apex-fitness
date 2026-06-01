'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore, useSocialStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Dumbbell,
  Users,
  Trash2,
  FileText,
  Sparkles,
  Loader2,
  Edit,
} from 'lucide-react';
import { defaultTemplates } from '@/lib/templates';
import { toast } from 'sonner';
import { getClientName as getClientNameUtil } from '@/lib/clientUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { syncEventToGoogleCalendar } from '@/lib/calendarSync';
import { UnifiedCalendar } from '@/components/calendar/UnifiedCalendar';
import { getVisibleCalendarEvents, type CalendarViewer } from '@/lib/calendarScope';
import type { CalendarEvent } from '@/types';

export default function CalendarPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { calendarEvents, clients, clientPrograms, getActiveProgram, getNextProgramWorkout, updateCalendarEvent, deleteCalendarEvent, addCalendarEvent, sessionWorkouts } = useTrainerStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [editTime, setEditTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('10:00');
  const [editDate, setEditDate] = useState('');
  
  // Add Event state
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventClient, setNewEventClient] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [newEventRecurrence, setNewEventRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [newEventType, setNewEventType] = useState<'session' | 'consultation' | 'assessment'>('session');
  
  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // Workout customization state
  const [showWorkoutPicker, setShowWorkoutPicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedProgramDay, setSelectedProgramDay] = useState<number>(-1); // -1 = no program day selected

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // Auto-sync on mount
  useEffect(() => {
    if (user?.id) {
      setIsSyncing(true);
      useTrainerStore.getState().loadFromSupabase(user.id)
        .finally(() => setIsSyncing(false));
    }
  }, [user?.id]);

  const isTrainer = user?.mode === 'trainer';

  // v15-D5: scope filtering centralised in `src/lib/calendarScope.ts`.
  // Single source of truth — same fn powers the future booking surface.
  const viewer: CalendarViewer = { userId: user?.id ?? '', mode: isTrainer ? 'trainer' : 'user' };
  const visibleEvents = useMemo<CalendarEvent[]>(
    () => getVisibleCalendarEvents(calendarEvents, viewer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendarEvents, user?.id, isTrainer],
  );

  // v19-fix-01 hotfix (React #310): the auth early-return MUST sit below the
  // useMemo above. It previously sat above; a trainer-store rehydrate
  // (v19-fix-01 persisted sessions/clientGroups) re-renders this whole-store
  // subscriber, and the render that took the early return had one fewer hook
  // than the full render -> "rendered more hooks than during the previous
  // render". `viewer` is null-safe so it doesn't throw before this guard runs.
  if (!isAuthenticated || !user) return null;

  // Centralized client name resolution
  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Unknown';
    return getClientNameUtil(clientId);
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setEditTime(event.startTime || '09:00');
    setEditEndTime(event.endTime || '10:00');
    setEditDate(event.date || format(selectedDate, 'yyyy-MM-dd'));
  };

  // Empty-slot click in <UnifiedCalendar> week/day view — prefill Add Event.
  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedDate(date);
    setNewEventDate(format(date, 'yyyy-MM-dd'));
    setNewEventStartTime(`${hour.toString().padStart(2, '0')}:00`);
    setNewEventEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
    setShowAddEvent(true);
  };

  // Client-name chip in selected-day list → navigate to client detail.
  const handleClientClick = (clientId: string) => {
    router.push(`/clients/${clientId}`);
  };

  const handleSaveEdit = () => {
    if (!editingEvent) return;
    
    // Update existing event
    updateCalendarEvent(editingEvent.id, {
      date: editDate,
      startTime: editTime,
      endTime: editEndTime,
    });
    setEditingEvent(null);
  };

  // Auto-detect recurring siblings: events sharing title + clientId + trainerId + startTime
  const getRecurringSiblings = (event: any) => {
    if (event.recurrenceGroup) {
      return calendarEvents.filter(e => e.recurrenceGroup === event.recurrenceGroup);
    }
    // Fallback: detect by matching pattern (same title, client, trainer, start time)
    return calendarEvents.filter(e =>
      e.id !== event.id &&
      e.title === event.title &&
      e.clientId === event.clientId &&
      e.trainerId === event.trainerId &&
      e.startTime === event.startTime &&
      e.type === event.type
    );
  };

  const handleDeleteEvent = (mode: 'single' | 'future' | 'all') => {
    if (!editingEvent) return;
    const siblings = getRecurringSiblings(editingEvent);
    const hasSiblings = editingEvent.recurrenceGroup ? siblings.length > 0 : siblings.length > 0;

    if (mode === 'all' && hasSiblings) {
      // Delete all events in this series (including the current one)
      const allInSeries = editingEvent.recurrenceGroup
        ? siblings
        : [editingEvent, ...siblings];
      allInSeries.forEach((e: any) => deleteCalendarEvent(e.id));
    } else if (mode === 'future' && hasSiblings) {
      // Delete this event and all future events in the series
      const eventDate = editingEvent.date;
      const allInSeries = editingEvent.recurrenceGroup
        ? siblings
        : [editingEvent, ...siblings];
      const toDelete = allInSeries.filter((e: any) => e.date >= eventDate);
      toDelete.forEach((e: any) => deleteCalendarEvent(e.id));
    } else {
      deleteCalendarEvent(editingEvent.id);
    }
    setEditingEvent(null);
    setConfirmDelete(false);
  };

  const handleAddEvent = () => {
    // Consultations don't require a client
    if (!newEventDate || (!newEventClient && newEventType !== 'consultation')) return;
    
    const clientName = newEventClient ? getClientNameUtil(newEventClient) : null;
    const contactName = (!newEventClient && newEventType === 'consultation') ? newEventTitle : undefined;
    
    // If borrowing from program, use the program day label as the title
    const activeProgram = newEventClient ? getActiveProgram(newEventClient) : undefined;
    const programDay = activeProgram && selectedProgramDay >= 0 ? activeProgram.weeklyPlan?.[selectedProgramDay] : null;
    const programTitle = programDay ? `${programDay.dayLabel} - ${activeProgram!.templateName}` : null;
    
    const title = newEventTitle || programTitle || (clientName 
      ? `${newEventType === 'consultation' ? 'Consultation' : 'Session'} with ${clientName}`
      : contactName ? `Consultation — ${contactName}` : 'Consultation');
    
    const recurrenceGroup = newEventRecurrence !== 'none' ? `rg-${Date.now()}` : undefined;
    
    // Create the base event
    const createEvent = (date: string) => {
      addCalendarEvent({
        title,
        type: newEventType,
        date,
        startTime: newEventStartTime,
        endTime: newEventEndTime,
        clientId: newEventClient || undefined,
        trainerId: user?.id,
        status: 'scheduled',
        notes: newEventRecurrence !== 'none' ? `Recurring: ${newEventRecurrence}` : (programDay ? `From program: ${activeProgram!.templateName}` : ''),
        recurrenceGroup,
        contactName: contactName || undefined,
        programId: activeProgram && selectedProgramDay >= 0 ? activeProgram.id : undefined,
        programDayIndex: selectedProgramDay >= 0 ? selectedProgramDay : undefined,
      } as any);
    };
    
    // Create events based on recurrence
    if (newEventRecurrence === 'none') {
      createEvent(newEventDate);
    } else {
      // Create recurring events for the next 3 months
      const startDate = new Date(newEventDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3);
      
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        createEvent(currentDate.toISOString().split('T')[0]);
        
        if (newEventRecurrence === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (newEventRecurrence === 'biweekly') {
          currentDate.setDate(currentDate.getDate() + 14);
        } else if (newEventRecurrence === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    }
    
    // Sync to Google Calendar if connected
    if (user?.healthConnections?.calendar?.connected && user.id) {
      syncEventToGoogleCalendar(user.id, {
        title,
        date: newEventDate,
        startTime: newEventStartTime,
        endTime: newEventEndTime,
        notes: newEventRecurrence !== 'none' ? `Recurring: ${newEventRecurrence}` : '',
        recurrence: newEventRecurrence,
      }).then(result => {
        if (result.success) {
          console.log('[Calendar] Synced to Google Calendar:', result.googleEventId);
        }
      });
    }

    // Notify client about the booked session
    if (newEventClient && (newEventType === 'session' || newEventType === 'assessment')) {
      const trainerName = user?.displayName || 'Your trainer';
      const eventDate = new Date(newEventDate);
      const dateLabel = format(eventDate, 'EEEE, MMM d');
      useSocialStore.getState().addNotification({
        userId: newEventClient,
        type: 'workout_assigned',
        title: 'Session Booked',
        message: `${trainerName} booked a ${newEventType === 'assessment' ? 'assessment' : 'training session'} for ${dateLabel} at ${newEventStartTime}`,
        actionUrl: '/today',
      });
    }

    // Reset form
    setShowAddEvent(false);
    setNewEventTitle('');
    setNewEventClient('');
    setNewEventDate('');
    setNewEventStartTime('09:00');
    setNewEventEndTime('10:00');
    setNewEventRecurrence('none');
    setNewEventType('session');
    setSelectedProgramDay(-1);
  };

  const openAddEvent = () => {
    setNewEventDate(format(selectedDate, 'yyyy-MM-dd'));
    setShowAddEvent(true);
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Calendar" 
        subtitle={format(currentMonth, 'MMMM yyyy')}
        action={
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="border-gray-200"
              disabled={isSyncing}
              onClick={async () => {
                if (!user?.id) return;
                setIsSyncing(true);
                await useTrainerStore.getState().loadFromSupabase(user.id);
                setIsSyncing(false);
              }}
            >
              <Loader2 className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            {isTrainer && (
              <Button size="sm" className="bg-rose-500 hover:bg-rose-600" onClick={openAddEvent}>
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            )}
          </div>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <UnifiedCalendar
          events={visibleEvents}
          viewer={viewer}
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          viewMode={viewMode}
          onSelectDate={setSelectedDate}
          onEventClick={handleEditEvent}
          onChangeMonth={setCurrentMonth}
          onChangeWeek={setSelectedDate}
          onChangeViewMode={setViewMode}
          onSlotClick={handleSlotClick}
          onClientClick={handleClientClick}
          sessionWorkouts={sessionWorkouts}
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {calendarEvents.filter(e => e.type === 'workout').length}
                  </p>
                  <p className="text-xs text-gray-500">Workouts This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {clients.filter(c => c.status === 'active').length}
                  </p>
                  <p className="text-xs text-gray-500">Active Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Session Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">
                {editingEvent?.title}
              </p>
              {editingEvent?.clientId && (
                <p className="text-sm text-gray-500">
                  Client: <button className="text-sky-400 hover:underline" onClick={() => { setEditingEvent(null); router.push(`/clients/${editingEvent.clientId}`); }}>{getClientName(editingEvent.clientId)}</button>
                </p>
              )}
            </div>
            
            <div>
              <Label className="text-gray-600">Date</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-600">Start Time</Label>
                <select
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900"
                >
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const hour = Math.floor(i / 4) ;
                    const minute = (i % 4) * 15;
                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const label = `${hour > 12 ? hour - 12 : hour || 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
                    return <option key={time} value={time}>{label}</option>;
                  })}
                </select>
              </div>
              <div>
                <Label className="text-gray-600">End Time</Label>
                <select
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900"
                >
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const hour = Math.floor(i / 4);
                    const minute = (i % 4) * 15;
                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const label = `${hour > 12 ? hour - 12 : hour || 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
                    return <option key={time} value={time}>{label}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Workout Customization - only for session type events */}
            {editingEvent?.type === 'session' && (
              <div className="border-t border-gray-200 pt-4">
                <Label className="text-gray-600 mb-2 block">Session Workout</Label>
                {editingEvent?.workoutId ? (
                  <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sky-400">
                      <Dumbbell className="w-4 h-4" />
                      <span className="text-sm font-medium">Workout assigned</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full border-gray-200"
                      onClick={() => setShowWorkoutPicker(true)}
                    >
                      <Edit className="w-3 h-3 mr-2" />
                      Change Workout
                    </Button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-500 mb-3">No workout assigned yet</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-200"
                        onClick={() => setShowWorkoutPicker(true)}
                      >
                        <FileText className="w-3 h-3 mr-2" />
                        From Template
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-400"
                        onClick={() => {
                          router.push(`/workout/builder?eventId=${editingEvent.id}&clientId=${editingEvent.clientId}`);
                        }}
                      >
                        <Sparkles className="w-3 h-3 mr-2" />
                        Create New
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1 bg-sky-500 hover:bg-sky-600"
                onClick={handleSaveEdit}
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Delete Confirmation */}
            {confirmDelete && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
                <p className="text-sm text-red-400 font-medium">Delete this event?</p>
                <p className="text-xs text-gray-500">This cannot be undone.</p>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDeleteEvent('single')}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete This Event Only
                  </Button>
                  {editingEvent && (() => {
                    const siblings = getRecurringSiblings(editingEvent);
                    const allInSeries = editingEvent.recurrenceGroup ? siblings : [editingEvent, ...siblings];
                    if (siblings.length === 0) return null;
                    return (
                      <>
                        <Button
                          size="sm"
                          className="w-full bg-red-700 hover:bg-red-800 text-white"
                          onClick={() => handleDeleteEvent('future')}
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Delete This &amp; All Future ({allInSeries.filter((e: any) => e.date >= editingEvent.date).length})
                        </Button>
                        <Button
                          size="sm"
                          className="w-full bg-red-800 hover:bg-red-900 text-white"
                          onClick={() => handleDeleteEvent('all')}
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Delete Entire Series ({allInSeries.length} events)
                        </Button>
                      </>
                    );
                  })()}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-gray-200"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Workout Picker Dialog */}
      <Dialog open={showWorkoutPicker} onOpenChange={setShowWorkoutPicker}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Select Workout Template</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {defaultTemplates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-colors",
                    selectedTemplateId === template.id
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {template.exercises.length} exercises
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowWorkoutPicker(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-sky-500 hover:bg-sky-600"
              disabled={!selectedTemplateId}
              onClick={() => {
                if (editingEvent && selectedTemplateId) {
                  updateCalendarEvent(editingEvent.id, { workoutId: selectedTemplateId });
                  setEditingEvent({ ...editingEvent, workoutId: selectedTemplateId });
                  setShowWorkoutPicker(false);
                  setSelectedTemplateId('');
                }
              }}
            >
              Assign Workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent className="bg-white border-gray-200 shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Book Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600">Session Type</Label>
              <select
                value={newEventType}
                onChange={(e) => setNewEventType(e.target.value as any)}
                className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900"
              >
                <option value="session">Training Session</option>
                <option value="consultation">Consultation</option>
                <option value="assessment">Assessment</option>
              </select>
            </div>

            <div>
              <Label className="text-gray-600">
                Client {newEventType === 'consultation' && <span className="text-gray-500">(optional)</span>}
              </Label>
              <select
                value={newEventClient}
                onChange={(e) => setNewEventClient(e.target.value)}
                className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900"
              >
                <option value="">{newEventType === 'consultation' ? 'No client (new lead)' : 'Select a client...'}</option>
                {clients.filter(c => c.trainerId === user?.id).map((client) => {
                  return (
                    <option key={client.clientId} value={client.clientId}>
                      {getClientName(client.clientId)}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Borrow from Program — shown when client has an active program and type is session */}
            {newEventType === 'session' && newEventClient && (() => {
              const prog = getActiveProgram(newEventClient);
              if (!prog || !prog.weeklyPlan?.length) return null;
              // v15-D4: surface the client's current weekly state for each day:
              //   • · Done   — client already did this day this week (warn-on-pick)
              //   • · Booked <Day> — trainer (or anyone) already booked this day
              //     this week (block-on-pick)
              // Read from getNextProgramWorkout to reuse the same week-boundary
              // calculation the client side uses.
              const nextForClient = getNextProgramWorkout(newEventClient);
              const completedDayIndicesForClient = nextForClient?.completedDayIndices || [];
              // Compute Mon-Sun week window for booking-conflict scan.
              const _nowCal = new Date();
              const _dowCal = _nowCal.getDay();
              const _monOffCal = _dowCal === 0 ? -6 : 1 - _dowCal;
              const _weekStartCal = new Date(_nowCal);
              _weekStartCal.setHours(0, 0, 0, 0);
              _weekStartCal.setDate(_weekStartCal.getDate() + _monOffCal);
              const _weekEndCal = new Date(_weekStartCal);
              _weekEndCal.setDate(_weekEndCal.getDate() + 7);
              const bookedDayIndexToDate = new Map<number, string>();
              calendarEvents.forEach((e: any) => {
                if (e.clientId !== newEventClient) return;
                if (e.type !== 'session') return;
                if (e.status === 'cancelled') return;
                if (e.programId !== prog.id) return;
                if (typeof e.programDayIndex !== 'number') return;
                const ed = new Date(e.date);
                if (ed < _weekStartCal || ed >= _weekEndCal) return;
                // Don't double-block the option that this dialog is currently
                // editing (if any) — but addEvent is always create, so no
                // edit-id check needed here.
                if (!bookedDayIndexToDate.has(e.programDayIndex)) {
                  bookedDayIndexToDate.set(e.programDayIndex, e.date);
                }
              });
              return (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sky-700 font-medium text-xs">Borrow from Program</Label>
                    <Badge className="bg-sky-100 text-sky-600 border-0 text-[10px]">{prog.templateName}</Badge>
                  </div>
                  <select
                    value={selectedProgramDay}
                    onChange={(e) => {
                      const newIdx = parseInt(e.target.value);
                      if (newIdx >= 0) {
                        // Block already-booked days entirely.
                        if (bookedDayIndexToDate.has(newIdx)) {
                          const dayLabel = prog.weeklyPlan[newIdx]?.dayLabel || `Day ${newIdx + 1}`;
                          const whenIso = bookedDayIndexToDate.get(newIdx)!;
                          const whenLabel = new Date(whenIso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                          toast.error(`${dayLabel} is already booked with this client (${whenLabel}). Cancel that booking first or pick a different day.`);
                          return; // keep prior selectedProgramDay value
                        }
                        // Warn (but allow) for days the client already did this week.
                        if (completedDayIndicesForClient.includes(newIdx)) {
                          const dayLabel = prog.weeklyPlan[newIdx]?.dayLabel || `Day ${newIdx + 1}`;
                          toast.warning(`${dayLabel} — client already completed this day this week. Booking anyway counts as extra volume.`);
                        }
                      }
                      setSelectedProgramDay(newIdx);
                    }}
                    className="w-full p-2 bg-white border border-sky-200 rounded-md text-gray-900 text-sm"
                  >
                    <option value={-1}>Custom session (no program)</option>
                    {prog.weeklyPlan.map((day: any, idx: number) => {
                      const exCount = day.blocks?.reduce((s: number, b: any) => s + (b.exercises?.length || 0), 0) || 0;
                      const isDoneThisWeek = completedDayIndicesForClient.includes(idx);
                      const bookedIso = bookedDayIndexToDate.get(idx);
                      let suffix = '';
                      if (bookedIso) {
                        const wd = new Date(bookedIso).toLocaleDateString(undefined, { weekday: 'short' });
                        suffix = ` · Booked ${wd}`;
                      } else if (isDoneThisWeek) {
                        suffix = ' · Done';
                      }
                      return (
                        <option
                          key={idx}
                          value={idx}
                          disabled={!!bookedIso}
                        >
                          {day.dayLabel} — {exCount} exercises{suffix}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-gray-500">Select a workout day to use for this PT session. This counts toward the client's package. Days already booked this week are disabled; days the client already completed are warned.</p>
                </div>
              );
            })()}

            {/* Consultation name field when no client selected */}
            {newEventType === 'consultation' && !newEventClient && (
              <div>
                <Label className="text-gray-600">Contact Name</Label>
                <Input
                  placeholder="e.g., John Smith"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>
            )}

            <div>
              <Label className="text-gray-600">Date</Label>
              <Input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-600">Start Time</Label>
                <select
                  value={newEventStartTime}
                  onChange={(e) => setNewEventStartTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900"
                >
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const hour = Math.floor(i / 4);
                    const minute = (i % 4) * 15;
                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const label = `${hour > 12 ? hour - 12 : hour || 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
                    return <option key={time} value={time}>{label}</option>;
                  })}
                </select>
              </div>
              <div>
                <Label className="text-gray-600">End Time</Label>
                <select
                  value={newEventEndTime}
                  onChange={(e) => setNewEventEndTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900"
                >
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const hour = Math.floor(i / 4);
                    const minute = (i % 4) * 15;
                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const label = `${hour > 12 ? hour - 12 : hour || 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
                    return <option key={time} value={time}>{label}</option>;
                  })}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-gray-600">Repeat</Label>
              <select
                value={newEventRecurrence}
                onChange={(e) => setNewEventRecurrence(e.target.value as any)}
                className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900"
              >
                <option value="none">Does not repeat</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
              {newEventRecurrence !== 'none' && (
                <p className="text-xs text-gray-500 mt-1">
                  Sessions will be created for the next 3 months
                </p>
              )}
            </div>

            <div>
              <Label className="text-gray-600">Title (optional)</Label>
              <Input
                placeholder="Session with [Client Name]"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>

            <Button
              className="w-full bg-sky-500 hover:bg-sky-600"
              onClick={handleAddEvent}
              disabled={(!newEventClient && newEventType !== 'consultation') || !newEventDate}
            >
              {newEventRecurrence !== 'none' ? 'Create Recurring Sessions' : newEventType === 'consultation' ? 'Book Consultation' : 'Book Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
