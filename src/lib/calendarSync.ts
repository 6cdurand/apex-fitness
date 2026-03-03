// Client-side helper to sync in-app calendar events to Google Calendar

export async function syncEventToGoogleCalendar(
  userId: string,
  event: {
    title: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    notes?: string;
    recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly';
  }
): Promise<{ success: boolean; googleEventId?: string; error?: string }> {
  try {
    const startDateTime = `${event.date}T${event.startTime}:00`;
    const endDateTime = `${event.date}T${event.endTime}:00`;

    // Build recurrence rule if applicable
    let recurrence: string[] | undefined;
    if (event.recurrence && event.recurrence !== 'none') {
      const ruleMap: Record<string, string> = {
        weekly: 'RRULE:FREQ=WEEKLY;COUNT=13',
        biweekly: 'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=7',
        monthly: 'RRULE:FREQ=MONTHLY;COUNT=3',
      };
      recurrence = [ruleMap[event.recurrence]];
    }

    const res = await fetch('/api/google-calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        summary: event.title,
        description: event.notes || 'Created from Apex Fitness',
        startDateTime,
        endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recurrence,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      if (res.status === 401) {
        // Not connected — silently skip
        return { success: false, error: 'not_connected' };
      }
      return { success: false, error: data.error || 'Failed to sync' };
    }

    const data = await res.json();
    return { success: true, googleEventId: data.event?.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteEventFromGoogleCalendar(
  userId: string,
  googleEventId: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/google-calendar/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventId: googleEventId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
