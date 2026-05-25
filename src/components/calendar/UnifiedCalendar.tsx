'use client';

/**
 * <UnifiedCalendar> — shared calendar surface (v15-D5).
 *
 * One calendar grid + view-mode switcher + selected-day list, driven by
 * pre-filtered `events`. Mounted by `/calendar/page.tsx` today; future
 * booking surfaces (client viewing trainer availability) mount the same
 * component with `availabilitySlots` populated and `viewer.mode === 'user'`.
 *
 * Boundary:
 *   • This component owns visual layout, day cells, time-grid rendering,
 *     view-mode toggle, prev/next navigation, and the bottom "selected day
 *     events" list.
 *   • The host page owns event filtering (via `getVisibleCalendarEvents`),
 *     add/edit modals, recurrence logic, stats, and Google Calendar sync.
 *   • Slot clicks (empty cells in week/day view) bubble up via `onSlotClick`
 *     so the page can open its Add Event dialog with the slot prefilled.
 *   • Event clicks bubble up via `onEventClick` so the page can open Edit.
 *
 * The `availabilitySlots` prop is the booking-system extension hook. When
 * provided, slots render as a translucent overlay strip on the day they
 * fall on. Default: undefined (no overlay). Empty array is treated the
 * same as undefined.
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Users,
  Clock,
  Calendar as CalendarIcon,
  Edit,
} from 'lucide-react';
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
} from 'date-fns';
import { cn } from '@/lib/utils';
import { getClientName as getClientNameUtil } from '@/lib/clientUtils';
import type { CalendarEvent, TrainerAvailabilitySlot } from '@/types';
import type { CalendarViewer } from '@/lib/calendarScope';

type ViewMode = 'month' | 'week' | 'day';

export interface UnifiedCalendarProps {
  events: CalendarEvent[];
  viewer: CalendarViewer;
  selectedDate: Date;
  currentMonth: Date;
  viewMode: ViewMode;
  onSelectDate: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
  onChangeMonth: (d: Date) => void;
  onChangeWeek: (d: Date) => void;
  onChangeViewMode: (m: ViewMode) => void;
  /** Optional: empty time-slot click in week/day view (opens host's Add Event dialog with the slot prefilled). */
  onSlotClick?: (date: Date, hour: number) => void;
  /** Optional: click on a client's name chip in the selected-day list (e.g. router push). */
  onClientClick?: (clientId: string) => void;
  /**
   * Optional: session workouts list used to show a "has workout assigned" indicator
   * on event chips and badges. If omitted, the indicator is derived solely from
   * `event.workoutId`. The page owns the store; pass it through.
   */
  sessionWorkouts?: { eventId?: string }[];
  /**
   * v15-D5: extension hook for the future "client viewing trainer availability"
   * surface. When provided, an additional translucent overlay strip is rendered
   * for each unbooked open slot the trainer published. Default: undefined (no
   * overlay). Empty array is treated the same as undefined.
   */
  availabilitySlots?: TrainerAvailabilitySlot[];
}

function getEventColor(type: string): string {
  switch (type) {
    case 'session':
      return 'bg-rose-500';
    case 'workout':
      return 'bg-orange-500';
    case 'consultation':
      return 'bg-emerald-500';
    case 'assessment':
      return 'bg-purple-500';
    case 'rest':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

function getClientName(clientId?: string): string {
  if (!clientId) return 'Unknown';
  return getClientNameUtil(clientId);
}

export function UnifiedCalendar(props: UnifiedCalendarProps) {
  const {
    events,
    selectedDate,
    currentMonth,
    viewMode,
    onSelectDate,
    onEventClick,
    onChangeMonth,
    onChangeWeek,
    onChangeViewMode,
    onSlotClick,
    onClientClick,
    sessionWorkouts,
    availabilitySlots,
  } = props;

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) }),
    [selectedDate],
  );

  // Build a fast (date-iso → events[]) index so day cells don't re-scan the
  // entire events array. ISO key matches what `date.toDateString()` would
  // produce via isSameDay; we use the date portion as the key.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.date; // 'YYYY-MM-DD' canonical
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    // Match the legacy semantics: compare via isSameDay so that any
    // timezone drift in event.date strings doesn't drop matches.
    const list: CalendarEvent[] = [];
    for (const e of events) {
      if (isSameDay(new Date(e.date), date)) list.push(e);
    }
    return list;
  };
  // Note: `eventsByDay` retained for future O(1) lookups; current
  // implementation prioritises legacy parity over the map index.
  void eventsByDay;

  const eventHasWorkout = (event: CalendarEvent): boolean => {
    if (event.workoutId) return true;
    if (!sessionWorkouts || sessionWorkouts.length === 0) return false;
    return sessionWorkouts.some((w) => w.eventId === event.id);
  };

  const selectedDateEvents = useMemo(
    () => getEventsForDay(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, selectedDate],
  );

  const overlaySlots = availabilitySlots && availabilitySlots.length > 0 ? availabilitySlots : undefined;
  const overlaySlotsByDay = useMemo(() => {
    if (!overlaySlots) return null;
    const map = new Map<string, TrainerAvailabilitySlot[]>();
    for (const s of overlaySlots) {
      const list = map.get(s.date);
      if (list) list.push(s);
      else map.set(s.date, [s]);
    }
    return map;
  }, [overlaySlots]);

  return (
    <div className="space-y-4">
      {/* View Toggle & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            size="sm"
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            onClick={() => onChangeViewMode('month')}
            className={cn('h-8 px-3', viewMode === 'month' ? 'bg-rose-500' : 'text-gray-400')}
          >
            Month
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            onClick={() => onChangeViewMode('week')}
            className={cn('h-8 px-3', viewMode === 'week' ? 'bg-rose-500' : 'text-gray-400')}
          >
            Week
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            onClick={() => onChangeViewMode('day')}
            className={cn('h-8 px-3', viewMode === 'day' ? 'bg-rose-500' : 'text-gray-400')}
          >
            Day
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (viewMode === 'month') onChangeMonth(subMonths(currentMonth, 1));
              else if (viewMode === 'week') onChangeWeek(subWeeks(selectedDate, 1));
              else onSelectDate(addDays(selectedDate, -1));
            }}
            className="text-gray-400 hover:text-gray-900"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[140px] text-center">
            {viewMode === 'month' && format(currentMonth, 'MMMM yyyy')}
            {viewMode === 'week' &&
              `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d')}`}
            {viewMode === 'day' && format(selectedDate, 'EEE, MMM d')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (viewMode === 'month') onChangeMonth(addMonths(currentMonth, 1));
              else if (viewMode === 'week') onChangeWeek(addWeeks(selectedDate, 1));
              else onSelectDate(addDays(selectedDate, 1));
            }}
            className="text-gray-400 hover:text-gray-900"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
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
                    onClick={() => onSelectDate(day)}
                    className={cn(
                      'relative h-14 p-1 border-b border-r border-gray-200 transition-colors',
                      'hover:bg-gray-50',
                      isSelected && 'bg-rose-500/20',
                      !isCurrentMonth && 'opacity-40',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center rounded-full text-sm',
                        isDayToday && 'bg-rose-500 text-white font-semibold',
                        isSelected && !isDayToday && 'bg-gray-200 text-gray-900',
                        !isDayToday && !isSelected && 'text-gray-700',
                      )}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* Event Indicators */}
                    {dayEvents.length > 0 && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((event, i) => {
                          const hasWorkout = eventHasWorkout(event);
                          return (
                            <div
                              key={i}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                hasWorkout ? 'bg-sky-400 ring-1 ring-sky-400/50' : getEventColor(event.type),
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
        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDays.map((day) => (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'py-3 text-center transition-colors hover:bg-gray-50',
                    isSameDay(day, selectedDate) && 'bg-rose-500/20',
                  )}
                >
                  <p className="text-xs text-gray-500">{format(day, 'EEE')}</p>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      isToday(day) ? 'text-rose-500' : 'text-gray-900',
                    )}
                  >
                    {format(day, 'd')}
                  </p>
                </button>
              ))}
            </div>

            <ScrollArea className="h-[400px]">
              <div className="relative">
                {Array.from({ length: 14 }, (_, i) => i + 6).map((hour) => (
                  <div key={hour} className="flex border-b border-gray-200 h-12">
                    <div className="w-12 text-xs text-gray-500 py-1 px-2 border-r border-gray-200">
                      {hour}:00
                    </div>
                    <div className="flex-1 grid grid-cols-7">
                      {weekDays.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = getEventsForDay(day).filter((e) => {
                          const eventHour = parseInt(e.startTime?.split(':')[0] || '0');
                          return eventHour === hour;
                        });
                        const daySlots = overlaySlotsByDay?.get(dayKey)?.filter((s) => {
                          const sHour = parseInt(s.startTime?.split(':')[0] || '0');
                          return sHour === hour;
                        });
                        return (
                          <button
                            key={`${day.toISOString()}-${hour}`}
                            onClick={() => onSlotClick?.(day, hour)}
                            className="border-r border-gray-100 hover:bg-gray-50 relative"
                          >
                            {/* Availability slot overlay (v15-D5 booking foundation; renders only when prop supplied) */}
                            {daySlots?.map((slot) => (
                              <div
                                key={`slot-${slot.id}`}
                                className={cn(
                                  'absolute inset-x-0.5 rounded text-[10px] p-0.5 truncate z-0 border border-dashed',
                                  slot.status === 'open'
                                    ? 'bg-emerald-200/40 border-emerald-400/60 text-emerald-700'
                                    : slot.status === 'booked'
                                      ? 'bg-rose-200/40 border-rose-400/60 text-rose-700'
                                      : 'bg-gray-200/40 border-gray-400/60 text-gray-600',
                                )}
                                style={{ top: 0, height: '100%' }}
                              >
                                {slot.startTime}–{slot.endTime}
                              </div>
                            ))}
                            {dayEvents.map((event) => {
                              const hasWorkout = eventHasWorkout(event);
                              const startMin = parseInt(event.startTime?.split(':')[1] || '0');
                              const endHour = parseInt(event.endTime?.split(':')[0] || String(hour + 1));
                              const endMin = parseInt(event.endTime?.split(':')[1] || '0');
                              const durationMins = (endHour - hour) * 60 + endMin - startMin;
                              const topPercent = (startMin / 60) * 100;
                              const heightPercent = (durationMins / 60) * 100;
                              return (
                                <div
                                  key={event.id}
                                  className={cn(
                                    'absolute inset-x-0.5 rounded text-xs p-0.5 truncate flex items-center gap-1 z-10 overflow-hidden',
                                    getEventColor(event.type),
                                    'text-white',
                                  )}
                                  style={{
                                    top: `${topPercent}%`,
                                    height: `${Math.max(heightPercent, 25)}%`,
                                    minHeight: '12px',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEventClick(event);
                                  }}
                                >
                                  {hasWorkout && <Dumbbell className="w-3 h-3 flex-shrink-0" />}
                                  <span className="truncate">{getClientName(event.clientId)}</span>
                                </div>
                              );
                            })}
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
        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[450px]">
              <div className="relative">
                {Array.from({ length: 14 }, (_, i) => i + 6).map((hour) => {
                  const hourEvents = selectedDateEvents.filter((e) => {
                    const eventHour = parseInt(e.startTime?.split(':')[0] || '0');
                    return eventHour === hour;
                  });
                  const dayKey = format(selectedDate, 'yyyy-MM-dd');
                  const hourSlots = overlaySlotsByDay?.get(dayKey)?.filter((s) => {
                    const sHour = parseInt(s.startTime?.split(':')[0] || '0');
                    return sHour === hour;
                  });
                  return (
                    <button
                      key={hour}
                      onClick={() => onSlotClick?.(selectedDate, hour)}
                      className="flex w-full border-b border-gray-200 min-h-[60px] hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-16 text-sm text-gray-500 py-2 px-3 border-r border-gray-200 flex-shrink-0">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      <div className="flex-1 p-1 space-y-1">
                        {hourSlots?.map((slot) => (
                          <div
                            key={`slot-${slot.id}`}
                            className={cn(
                              'rounded-lg p-2 text-xs border border-dashed',
                              slot.status === 'open'
                                ? 'bg-emerald-100/60 border-emerald-400 text-emerald-700'
                                : slot.status === 'booked'
                                  ? 'bg-rose-100/60 border-rose-400 text-rose-700'
                                  : 'bg-gray-100/60 border-gray-400 text-gray-600',
                            )}
                          >
                            Availability: {slot.startTime}–{slot.endTime}
                          </div>
                        ))}
                        {hourEvents.map((event) => {
                          const hasWorkout = eventHasWorkout(event);
                          return (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick(event);
                              }}
                              className={cn(
                                'rounded-lg p-2 cursor-pointer',
                                getEventColor(event.type),
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 text-sm">{event.title}</p>
                                {hasWorkout && (
                                  <Badge className="text-xs bg-sky-500/20 text-sky-400 px-1 py-0">
                                    <Dumbbell className="w-3 h-3" />
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600">
                                {event.startTime} - {event.endTime} • {getClientName(event.clientId)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Selected Day Events List */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h3>

        {selectedDateEvents.length === 0 ? (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="py-8 text-center">
              <CalendarIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">No events scheduled</p>
              <p className="text-sm text-gray-500">Click the + button to add an event</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {selectedDateEvents.map((event) => (
                <Card
                  key={event.id}
                  className="bg-white border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-1 h-full rounded-full self-stretch min-h-[40px]',
                          getEventColor(event.type),
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{event.title}</h4>
                          <Badge
                            variant="outline"
                            className="text-xs border-gray-200 text-gray-500 capitalize"
                          >
                            {event.type}
                          </Badge>
                          {eventHasWorkout(event) ? (
                            <Badge className="text-xs bg-sky-500/20 text-sky-400">
                              <Dumbbell className="w-3 h-3 mr-1" />
                              Planned
                            </Badge>
                          ) : (
                            event.type === 'session' && (
                              <Badge className="text-xs bg-amber-500/20 text-amber-400">
                                No Workout
                              </Badge>
                            )
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
                              onClick={(e) => {
                                e.stopPropagation();
                                onClientClick?.(event.clientId!);
                              }}
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
                        className="text-gray-400 hover:text-gray-900"
                        onClick={() => onEventClick(event)}
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
    </div>
  );
}

export default UnifiedCalendar;
