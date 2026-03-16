import { useTrainerStore } from './store';

export interface ClientDisplayInfo {
  displayName: string;
  profilePhoto?: string;
  username?: string;
}

/**
 * Centralized client/user name resolution.
 * Checks trainer store clients → localStorage apex-users.
 * NEVER returns bare 'Client' — returns actual name or 'Loading...' if data isn't ready.
 */
export function getClientDisplayInfo(clientId: string | undefined | null): ClientDisplayInfo {
  if (!clientId) {
    return { displayName: 'Unknown' };
  }

  // 1. Check trainer store clients (synced from Supabase — most reliable)
  const { clients } = useTrainerStore.getState();
  const trainerClient = clients.find(c => c.clientId === clientId);
  
  if (trainerClient) {
    // Nested client object (from Supabase sync)
    if (trainerClient.client?.displayName) {
      return {
        displayName: trainerClient.client.displayName,
        profilePhoto: trainerClient.client.profilePhoto,
        username: trainerClient.client.username,
      };
    }
    // Direct displayName (from onboarding)
    const storedName = (trainerClient as any).displayName || (trainerClient as any).name;
    if (storedName) {
      return {
        displayName: storedName,
        profilePhoto: (trainerClient as any).profilePhoto,
        username: (trainerClient as any).username,
      };
    }
  }

  // 1b. Check calendar events for this client's name (only use contactName, not title)
  const { calendarEvents } = useTrainerStore.getState();
  const clientEvent = calendarEvents.find((e: any) => e.clientId === clientId && (e.contactName));
  if (clientEvent) {
    const eventName = (clientEvent as any).contactName;
    if (eventName && eventName !== clientId && eventName.length > 2) {
      return { displayName: eventName };
    }
  }

  // 2. Check localStorage apex-users (local cache of all known users)
  try {
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const localUser = storedUsers.find((u: any) => u.id === clientId);
    if (localUser) {
      return {
        displayName: localUser.displayName || localUser.username || clientId.slice(0, 8),
        profilePhoto: localUser.profilePhoto,
        username: localUser.username,
      };
    }
  } catch {
    // localStorage not available (SSR)
  }

  // 3. Last resort — show truncated ID so it's obvious data hasn't loaded
  return { displayName: clientId.slice(0, 8) + '...' };
}

/**
 * Get just the display name string. Convenience wrapper.
 */
export function getClientName(clientId: string | undefined | null): string {
  return getClientDisplayInfo(clientId).displayName;
}
