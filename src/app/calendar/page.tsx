'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
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
  List
} from 'lucide-react';
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

export default function CalendarPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { calendarEvents, clients, clientPrograms, getActiveProgram, updateCalendarEvent, addCalendarEvent } = useTrainerStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
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

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (user?.mode !== 'trainer') {
      router.replace('/workout');
    }
  }, [isAuthenticated, user?.mode, router]);

  if (!isAuthenticated || user?.mode !== 'trainer') return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const allUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
  
  // Only show explicitly booked sessions (not auto-generated from programs)
  const getEventsForDay = (date: Date) => {
    // Filter to only show trainer's own calendar events (not client programs)
    return calendarEvents.filter(event => 
      event.trainerId === user?.id &&
      event.status !== 'cancelled' &&
      isSameDay(new Date(event.date), date)
    );
  };

  const selectedDateEvents = getEventsForDay(selectedDate);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'workout': return 'bg-emerald-500';
      case 'consultation': return 'bg-blue-500';
      case 'assessment': return 'bg-purple-500';
      case 'rest': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Unknown';
    const client = allUsers.find((u: any) => u.id === clientId);
    return client?.displayName || client?.username || 'Unknown';
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

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    updateCalendarEvent(editingEvent.id, { status: 'cancelled' });
    setEditingEvent(null);
  };

  const handleAddEvent = () => {
    if (!newEventDate || !newEventClient) return;
    
    const clientUser = allUsers.find((u: any) => u.id === newEventClient);
    const title = newEventTitle || `Session with ${clientUser?.displayName || 'Client'}`;
    
    // Create the base event
    const createEvent = (date: string) => {
      addCalendarEvent({
        title,
        type: newEventType,
        date,
        startTime: newEventStartTime,
        endTime: newEventEndTime,
        clientId: newEventClient,
        trainerId: user?.id,
        status: 'scheduled',
        notes: newEventRecurrence !== 'none' ? `Recurring: ${newEventRecurrence}` : '',
      });
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
          <Button size="sm" className="bg-rose-500 hover:bg-rose-600" onClick={openAddEvent}>
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
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
                          {dayEvents.slice(0, 3).map((event, i) => (
                            <div
                              key={i}
                              className={cn("w-1.5 h-1.5 rounded-full", getEventColor(event.type))}
                            />
                          ))}
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
                              {dayEvents.map((event, i) => (
                                <div
                                  key={event.id}
                                  className={cn(
                                    "absolute inset-x-0.5 top-0.5 bottom-0.5 rounded text-xs p-1 truncate",
                                    getEventColor(event.type), "text-white"
                                  )}
                                  onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                                >
                                  {getClientName(event.clientId)}
                                </div>
                              ))}
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
                          {hourEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                              className={cn(
                                "rounded-lg p-2 cursor-pointer",
                                getEventColor(event.type)
                              )}
                            >
                              <p className="font-medium text-white text-sm">{event.title}</p>
                              <p className="text-xs text-white/80">
                                {event.startTime} - {event.endTime} • {getClientName(event.clientId)}
                              </p>
                            </div>
                          ))}
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
                            {(event as any).recurrence && (
                              <Badge className="text-xs bg-blue-500/20 text-blue-400">
                                {(event as any).recurrence}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {event.clientId && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {getClientName(event.clientId)}
                              </span>
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
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-emerald-400" />
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
                  Client: {getClientName(editingEvent.clientId)}
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
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">End Time</Label>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={handleSaveEdit}
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/10"
                onClick={handleDeleteEvent}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
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
              <Label className="text-gray-400">Client</Label>
              <select
                value={newEventClient}
                onChange={(e) => setNewEventClient(e.target.value)}
                className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              >
                <option value="">Select a client...</option>
                {clients.filter(c => c.trainerId === user?.id).map((client) => {
                  const clientUser = allUsers.find((u: any) => u.id === client.clientId);
                  return (
                    <option key={client.clientId} value={client.clientId}>
                      {clientUser?.displayName || clientUser?.username || 'Unknown'}
                    </option>
                  );
                })}
              </select>
            </div>

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
                <Input
                  type="time"
                  value={newEventStartTime}
                  onChange={(e) => setNewEventStartTime(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">End Time</Label>
                <Input
                  type="time"
                  value={newEventEndTime}
                  onChange={(e) => setNewEventEndTime(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
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
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              onClick={handleAddEvent}
              disabled={!newEventClient || !newEventDate}
            >
              {newEventRecurrence !== 'none' ? 'Create Recurring Sessions' : 'Book Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
