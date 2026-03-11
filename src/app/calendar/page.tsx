'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore, useWorkoutStore, useSocialStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Dumbbell,
  Users,
  Clock,
  Calendar as CalendarIcon,
  Edit,
  Trash2,
  LayoutGrid,
  List,
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react';
import { defaultTemplates } from '@/lib/templates';
import { getClientDisplayInfo, getClientName as getClientNameUtil } from '@/lib/clientUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  isToday,
  addDays,
  setHours,
  setMinutes,
  getHours
} from 'date-fns';
import { cn } from '@/lib/utils';
import { syncEventToGoogleCalendar } from '@/lib/calendarSync';

export default function CalendarPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { calendarEvents, clients, clientPrograms, getActiveProgram, updateCalendarEvent, deleteCalendarEvent, addCalendarEvent, sessionWorkouts } = useTrainerStore();
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

  if (!isAuthenticated || !user) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Show events for the day — trainers see their bookings, users see their own events
  const getEventsForDay = (date: Date) => {
    return calendarEvents.filter(event => {
      if (event.status === 'cancelled') return false;
      if (!isSameDay(new Date(event.date), date)) return false;
      if (isTrainer) return event.trainerId === user?.id;
      return event.clientId === user?.id || event.trainerId === user?.id;
    });
  };

  const selectedDateEvents = getEventsForDay(selectedDate);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'session': return 'bg-rose-500';
      case 'workout': return 'bg-orange-500';
      case 'consultation': return 'bg-emerald-500';
      case 'assessment': return 'bg-purple-500';
      case 'rest': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

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

  const handleDeleteEvent = (mode: 'single' | 'future' | 'all') => {
    if (!editingEvent) return;
    if (mode === 'all' && editingEvent.recurrenceGroup) {
      // Delete all events in this recurrence group
      const group = editingEvent.recurrenceGroup;
      const toDelete = calendarEvents.filter(e => e.recurrenceGroup === group);
      toDelete.forEach(e => deleteCalendarEvent(e.id));
    } else if (mode === 'future' && editingEvent.recurrenceGroup) {
      // Delete this event and all future events in this recurrence group
      const group = editingEvent.recurrenceGroup;
      const eventDate = editingEvent.date;
      const toDelete = calendarEvents.filter(e => e.recurrenceGroup === group && e.date >= eventDate);
      toDelete.forEach(e => deleteCalendarEvent(e.id));
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
    const title = newEventTitle || (clientName 
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
        notes: newEventRecurrence !== 'none' ? `Recurring: ${newEventRecurrence}` : '',
        recurrenceGroup,
        contactName: contactName || undefined,
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
              className="border-gray-700"
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
        {/* View Toggle & Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              onClick={() => setViewMode('month')}
              className={cn("h-8 px-3", viewMode === 'month' ? 'bg-rose-500' : 'text-gray-400')}
            >
              Month
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              onClick={() => setViewMode('week')}
              className={cn("h-8 px-3", viewMode === 'week' ? 'bg-rose-500' : 'text-gray-400')}
            >
              Week
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              onClick={() => setViewMode('day')}
              className={cn("h-8 px-3", viewMode === 'day' ? 'bg-rose-500' : 'text-gray-400')}
            >
              Day
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (viewMode === 'month') setCurrentMonth(subMonths(currentMonth, 1));
                else if (viewMode === 'week') setSelectedDate(subWeeks(selectedDate, 1));
                else setSelectedDate(addDays(selectedDate, -1));
              }}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold text-white min-w-[140px] text-center">
              {viewMode === 'month' && format(currentMonth, 'MMMM yyyy')}
              {viewMode === 'week' && `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d')}`}
              {viewMode === 'day' && format(selectedDate, 'EEE, MMM d')}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (viewMode === 'month') setCurrentMonth(addMonths(currentMonth, 1));
                else if (viewMode === 'week') setSelectedDate(addWeeks(selectedDate, 1));
                else setSelectedDate(addDays(selectedDate, 1));
              }}
              className="text-gray-400 hover:text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Month View */}
        {viewMode === 'month' && (
          <Card className="bg-gray-900 border-gray-800 overflow-hidden">
            <CardContent className="p-0">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-3 text-center text-xs font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayEvents = getEventsForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isDayToday = isToday(day);

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "relative h-14 p-1 border-b border-r border-gray-800 transition-colors",
                        "hover:bg-gray-800",
                        isSelected && "bg-rose-500/20",
                        !isCurrentMonth && "opacity-40"
                      )}
                    >
                      <span className={cn(
                        "absolute top-1 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center rounded-full text-sm",
                        isDayToday && "bg-rose-500 text-white font-semibold",
                        isSelected && !isDayToday && "bg-gray-700 text-white",
                        !isDayToday && !isSelected && "text-gray-300"
                      )}>
                        {format(day, 'd')}
                      </span>
                      
                      {/* Event Indicators */}
                      {dayEvents.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayEvents.slice(0, 3).map((event, i) => {
                            const hasWorkout = event.workoutId || sessionWorkouts.find(w => w.eventId === event.id);
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full", 
                                  hasWorkout ? "bg-sky-400 ring-1 ring-sky-400/50" : getEventColor(event.type)
                                )}
                              />
                            );
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <Card className="bg-gray-900 border-gray-800 overflow-hidden">
            <CardContent className="p-0">
              {/* Week Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-800">
                {eachDayOfInterval({ start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) }).map((day) => (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "py-3 text-center transition-colors hover:bg-gray-800",
                      isSameDay(day, selectedDate) && "bg-rose-500/20"
                    )}
                  >
                    <p className="text-xs text-gray-500">{format(day, 'EEE')}</p>
                    <p className={cn(
                      "text-lg font-semibold",
                      isToday(day) ? "text-rose-500" : "text-white"
                    )}>
                      {format(day, 'd')}
                    </p>
                  </button>
                ))}
              </div>

              {/* Time slots */}
              <ScrollArea className="h-[400px]">
                <div className="relative">
                  {/* Hour lines */}
                  {Array.from({ length: 14 }, (_, i) => i + 6).map((hour) => (
                    <div key={hour} className="flex border-b border-gray-800/50 h-12">
                      <div className="w-12 text-xs text-gray-500 py-1 px-2 border-r border-gray-800">
                        {hour}:00
                      </div>
                      <div className="flex-1 grid grid-cols-7">
                        {eachDayOfInterval({ start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) }).map((day) => {
                          const dayEvents = getEventsForDay(day).filter(e => {
                            const eventHour = parseInt(e.startTime?.split(':')[0] || '0');
                            return eventHour === hour;
                          });
                          return (
                            <button
                              key={`${day.toISOString()}-${hour}`}
                              onClick={() => {
                                setSelectedDate(day);
                                setNewEventDate(format(day, 'yyyy-MM-dd'));
                                setNewEventStartTime(`${hour.toString().padStart(2, '0')}:00`);
                                setNewEventEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
                                setShowAddEvent(true);
                              }}
                              className="border-r border-gray-800/30 hover:bg-gray-800/50 relative"
                            >
                              {dayEvents.map((event, i) => {
                                const hasWorkout = event.workoutId || sessionWorkouts.find(w => w.eventId === event.id);
                                // Calculate position and height based on time
                                const startMin = parseInt(event.startTime?.split(':')[1] || '0');
                                const endHour = parseInt(event.endTime?.split(':')[0] || String(hour + 1));
                                const endMin = parseInt(event.endTime?.split(':')[1] || '0');
                                const durationMins = (endHour - hour) * 60 + endMin - startMin;
                                const topPercent = (startMin / 60) * 100;
                                // Allow height to extend beyond current hour (overflow into next hours)
                                const heightPercent = (durationMins / 60) * 100;
                                return (
                                <div
                                  key={event.id}
                                  className={cn(
                                    "absolute inset-x-0.5 rounded text-xs p-0.5 truncate flex items-center gap-1 z-10 overflow-hidden",
                                    getEventColor(event.type), "text-white"
                                  )}
                                  style={{
                                    top: `${topPercent}%`,
                                    height: `${Math.max(heightPercent, 25)}%`,
                                    minHeight: '12px'
                                  }}
                                  onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                                >
                                  {hasWorkout && <Dumbbell className="w-3 h-3 flex-shrink-0" />}
                                  <span className="truncate">{getClientName(event.clientId)}</span>
                                </div>
                              );})}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <Card className="bg-gray-900 border-gray-800 overflow-hidden">
            <CardContent className="p-0">
              <ScrollArea className="h-[450px]">
                <div className="relative">
                  {/* Hour slots */}
                  {Array.from({ length: 14 }, (_, i) => i + 6).map((hour) => {
                    const hourEvents = selectedDateEvents.filter(e => {
                      const eventHour = parseInt(e.startTime?.split(':')[0] || '0');
                      return eventHour === hour;
                    });
                    return (
                      <button
                        key={hour}
                        onClick={() => {
                          setNewEventDate(format(selectedDate, 'yyyy-MM-dd'));
                          setNewEventStartTime(`${hour.toString().padStart(2, '0')}:00`);
                          setNewEventEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
                          setShowAddEvent(true);
                        }}
                        className="flex w-full border-b border-gray-800/50 min-h-[60px] hover:bg-gray-800/30 transition-colors"
                      >
                        <div className="w-16 text-sm text-gray-500 py-2 px-3 border-r border-gray-800 flex-shrink-0">
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div className="flex-1 p-1 space-y-1">
                          {hourEvents.map((event) => {
                            const hasWorkout = event.workoutId || sessionWorkouts.find(w => w.eventId === event.id);
                            return (
                            <div
                              key={event.id}
                              onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                              className={cn(
                                "rounded-lg p-2 cursor-pointer",
                                getEventColor(event.type)
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white text-sm">{event.title}</p>
                                {hasWorkout && (
                                  <Badge className="text-xs bg-sky-500/20 text-sky-400 px-1 py-0">
                                    <Dumbbell className="w-3 h-3" />
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-white/80">
                                {event.startTime} - {event.endTime} • {getClientName(event.clientId)}
                              </p>
                            </div>
                          );})}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Selected Day Events */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>

          {selectedDateEvents.length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-8 text-center">
                <CalendarIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">No events scheduled</p>
                <p className="text-sm text-gray-500">
                  Click the + button to add an event
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {selectedDateEvents.map((event) => (
                  <Card key={event.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-1 h-full rounded-full self-stretch min-h-[40px]",
                          getEventColor(event.type)
                        )} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">{event.title}</h4>
                            <Badge variant="outline" className="text-xs border-gray-700 text-gray-400 capitalize">
                              {event.type}
                            </Badge>
                            {event.workoutId || sessionWorkouts.find(w => w.eventId === event.id) ? (
                              <Badge className="text-xs bg-sky-500/20 text-sky-400">
                                <Dumbbell className="w-3 h-3 mr-1" />
                                Planned
                              </Badge>
                            ) : event.type === 'session' && (
                              <Badge className="text-xs bg-amber-500/20 text-amber-400">
                                No Workout
                              </Badge>
                            )}
                            {(event as any).recurrence && (
                              <Badge className="text-xs bg-blue-500/20 text-blue-400">
                                {(event as any).recurrence}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {event.clientId && (
                              <button 
                                className="flex items-center gap-1 hover:text-sky-400 transition-colors"
                                onClick={(e) => { e.stopPropagation(); router.push(`/clients/${event.clientId}`); }}
                              >
                                <Users className="w-3 h-3" />
                                {getClientName(event.clientId)}
                              </button>
                            )}
                            {event.startTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {event.startTime} - {event.endTime || ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-white"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {calendarEvents.filter(e => e.type === 'workout').length}
                  </p>
                  <p className="text-xs text-gray-400">Workouts This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {clients.filter(c => c.status === 'active').length}
                  </p>
                  <p className="text-xs text-gray-400">Active Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Session Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-2">
                {editingEvent?.title}
              </p>
              {editingEvent?.clientId && (
                <p className="text-sm text-gray-500">
                  Client: <button className="text-sky-400 hover:underline" onClick={() => { setEditingEvent(null); router.push(`/clients/${editingEvent.clientId}`); }}>{getClientName(editingEvent.clientId)}</button>
                </p>
              )}
            </div>
            
            <div>
              <Label className="text-gray-400">Date</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Start Time</Label>
                <select
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
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
                <Label className="text-gray-400">End Time</Label>
                <select
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
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
              <div className="border-t border-gray-700 pt-4">
                <Label className="text-gray-400 mb-2 block">Session Workout</Label>
                {editingEvent?.workoutId ? (
                  <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sky-400">
                      <Dumbbell className="w-4 h-4" />
                      <span className="text-sm font-medium">Workout assigned</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full border-gray-600"
                      onClick={() => setShowWorkoutPicker(true)}
                    >
                      <Edit className="w-3 h-3 mr-2" />
                      Change Workout
                    </Button>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm text-gray-400 mb-3">No workout assigned yet</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-600"
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
                <p className="text-xs text-gray-400">This cannot be undone.</p>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDeleteEvent('single')}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete This Event Only
                  </Button>
                  {editingEvent?.recurrenceGroup && (
                    <>
                      <Button
                        size="sm"
                        className="w-full bg-red-700 hover:bg-red-800 text-white"
                        onClick={() => handleDeleteEvent('future')}
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete This &amp; All Future ({calendarEvents.filter(e => e.recurrenceGroup === editingEvent.recurrenceGroup && e.date >= editingEvent.date).length})
                      </Button>
                      <Button
                        size="sm"
                        className="w-full bg-red-800 hover:bg-red-900 text-white"
                        onClick={() => handleDeleteEvent('all')}
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete Entire Series ({calendarEvents.filter(e => e.recurrenceGroup === editingEvent.recurrenceGroup).length} events)
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-gray-600"
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
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Select Workout Template</DialogTitle>
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
                      : "border-gray-700 hover:border-gray-600"
                  )}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <h4 className="font-medium text-white">{template.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">
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
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Book Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Session Type</Label>
              <select
                value={newEventType}
                onChange={(e) => setNewEventType(e.target.value as any)}
                className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              >
                <option value="session">Training Session</option>
                <option value="consultation">Consultation</option>
                <option value="assessment">Assessment</option>
              </select>
            </div>

            <div>
              <Label className="text-gray-400">
                Client {newEventType === 'consultation' && <span className="text-gray-500">(optional)</span>}
              </Label>
              <select
                value={newEventClient}
                onChange={(e) => setNewEventClient(e.target.value)}
                className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
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

            {/* Consultation name field when no client selected */}
            {newEventType === 'consultation' && !newEventClient && (
              <div>
                <Label className="text-gray-400">Contact Name</Label>
                <Input
                  placeholder="e.g., John Smith"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            )}

            <div>
              <Label className="text-gray-400">Date</Label>
              <Input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Start Time</Label>
                <select
                  value={newEventStartTime}
                  onChange={(e) => setNewEventStartTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
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
                <Label className="text-gray-400">End Time</Label>
                <select
                  value={newEventEndTime}
                  onChange={(e) => setNewEventEndTime(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
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
              <Label className="text-gray-400">Repeat</Label>
              <select
                value={newEventRecurrence}
                onChange={(e) => setNewEventRecurrence(e.target.value as any)}
                className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
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
              <Label className="text-gray-400">Title (optional)</Label>
              <Input
                placeholder="Session with [Client Name]"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
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
