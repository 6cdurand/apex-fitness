import { Workout, CalendarEvent } from '@/types';

export interface ComplianceResult {
  /** Total workouts assigned to this client (by any trainer) */
  totalAssigned: number;
  /** Assigned workouts the client actually completed */
  completedAssigned: number;
  /** Adherence percentage (0-100) */
  adherencePercent: number;
  /** Personal (non-assigned) workouts the client did on their own */
  personalWorkouts: number;
  /** Total workouts (assigned + personal) */
  totalWorkouts: number;
  /** Weekly breakdown for the last N weeks */
  weeklyBreakdown: WeekCompliance[];
}

export interface WeekCompliance {
  weekStart: string; // ISO date of Monday
  assigned: number;
  completed: number;
  personal: number;
  adherencePercent: number;
}

/**
 * Calculate program compliance for a client.
 * 
 * Trainerize model:
 * - Only assigned workouts count toward compliance
 * - Client must complete the assigned workout for it to count
 * - Personal (non-assigned) workouts are tracked but don't affect compliance %
 * - Adherence = completed assigned / total assigned × 100
 */
export function calculateCompliance(
  clientId: string,
  workoutHistory: Workout[],
  calendarEvents: CalendarEvent[],
  weeks: number = 12
): ComplianceResult {
  // Filter to this client's workouts (exclude soft-deleted)
  const clientWorkouts = workoutHistory.filter(
    w => w.userId === clientId && !w.deletedAt && w.status === 'completed'
  );

  // Assigned workouts = those with assignedBy set
  const assignedCompleted = clientWorkouts.filter(w => !!w.assignedBy);
  
  // Count total assigned: completed assigned workouts + scheduled but not yet completed
  // Use calendar events of type 'session' or 'workout' for this client that are in the past
  const now = new Date();
  const pastScheduledEvents = calendarEvents.filter(e => 
    e.clientId === clientId && 
    new Date(e.date) <= now &&
    (e.type === 'session' || e.type === 'workout')
  );

  // Total assigned = max of (past scheduled events, completed assigned workouts)
  // This accounts for sessions that were scheduled but client didn't show up
  const totalAssigned = Math.max(pastScheduledEvents.length, assignedCompleted.length);
  
  // Personal workouts = no assignedBy
  const personalWorkouts = clientWorkouts.filter(w => !w.assignedBy);

  const adherencePercent = totalAssigned > 0
    ? Math.round((assignedCompleted.length / totalAssigned) * 100)
    : 0;

  // Weekly breakdown
  const weeklyBreakdown: WeekCompliance[] = [];
  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    // Set to end of Sunday
    const dayOfWeek = weekEnd.getDay();
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    weekEnd.setDate(weekEnd.getDate() + daysToSunday);
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekAssignedCompleted = assignedCompleted.filter(w => {
      const d = new Date(w.endTime || w.startTime);
      return d >= weekStart && d <= weekEnd;
    });

    const weekScheduled = pastScheduledEvents.filter(e => {
      const d = new Date(e.date);
      return d >= weekStart && d <= weekEnd;
    });

    const weekPersonal = personalWorkouts.filter(w => {
      const d = new Date(w.endTime || w.startTime);
      return d >= weekStart && d <= weekEnd;
    });

    const weekTotalAssigned = Math.max(weekScheduled.length, weekAssignedCompleted.length);

    weeklyBreakdown.push({
      weekStart: weekStart.toISOString(),
      assigned: weekTotalAssigned,
      completed: weekAssignedCompleted.length,
      personal: weekPersonal.length,
      adherencePercent: weekTotalAssigned > 0
        ? Math.round((weekAssignedCompleted.length / weekTotalAssigned) * 100)
        : 0,
    });
  }

  return {
    totalAssigned,
    completedAssigned: assignedCompleted.length,
    adherencePercent,
    personalWorkouts: personalWorkouts.length,
    totalWorkouts: clientWorkouts.length,
    weeklyBreakdown: weeklyBreakdown.reverse(), // Oldest first for charts
  };
}

/**
 * Get a color class based on adherence percentage
 */
export function getAdherenceColor(percent: number): string {
  if (percent >= 90) return 'text-green-400';
  if (percent >= 70) return 'text-sky-400';
  if (percent >= 50) return 'text-amber-400';
  return 'text-red-400';
}

/**
 * Get a background color class based on adherence percentage
 */
export function getAdherenceBgColor(percent: number): string {
  if (percent >= 90) return 'bg-green-500';
  if (percent >= 70) return 'bg-sky-500';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

/**
 * Get a label for the adherence level
 */
export function getAdherenceLabel(percent: number): string {
  if (percent >= 90) return 'Excellent';
  if (percent >= 70) return 'Good';
  if (percent >= 50) return 'Fair';
  if (percent > 0) return 'Needs Improvement';
  return 'No Data';
}
