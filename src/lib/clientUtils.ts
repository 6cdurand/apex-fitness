import { useTrainerStore } from './store';
import { resolveClientDisplayName, readProfileCache, isValidUUID } from './userFetchUtils';

export interface ClientDisplayInfo {
  displayName: string;
  profilePhoto?: string;
  username?: string;
}

/**
 * Centralized client/user name resolution.
 * Uses a waterfall: trainer store → profile cache → calendar events → localStorage.
 * NEVER returns a raw UUID or truncated UUID.
 */
export function getClientDisplayInfo(clientId: string | undefined | null): ClientDisplayInfo {
  if (!clientId) {
    return { displayName: 'Unknown' };
  }

  // 1. Check trainer store clients (synced from Supabase — most reliable)
  const { clients, calendarEvents } = useTrainerStore.getState();
  const trainerClient = clients.find(c => c.clientId === clientId);
  
  let trainerClientName: string | undefined;
  let profilePhoto: string | undefined;
  let username: string | undefined;

  if (trainerClient) {
    // Nested client object (from Supabase sync / chunked fetch)
    if (trainerClient.client?.displayName) {
      return {
        displayName: trainerClient.client.displayName,
        profilePhoto: trainerClient.client.profilePhoto,
        username: trainerClient.client.username,
      };
    }
    // Direct displayName (from onboarding)
    trainerClientName = (trainerClient as any).displayName || (trainerClient as any).name;
    profilePhoto = (trainerClient as any).profilePhoto;
    username = (trainerClient as any).username;
    if (trainerClientName) {
      return { displayName: trainerClientName, profilePhoto, username };
    }
  }

  // 2. Check profile cache (populated by chunked user fetch)
  try {
    const cache = readProfileCache();
    const cached = cache[clientId];
    if (cached) {
      const name = cached.displayName || cached.username;
      if (name) {
        return {
          displayName: name,
          profilePhoto: cached.profilePhoto,
          username: cached.username,
        };
      }
    }
  } catch {
    // localStorage not available (SSR)
  }

  // 3. Check calendar events for this client's name
  const clientEvent = calendarEvents.find((e: any) => e.clientId === clientId && (e.contactName));
  let contactName: string | undefined;
  let eventTitle: string | undefined;
  if (clientEvent) {
    contactName = (clientEvent as any).contactName;
    eventTitle = clientEvent.title;
  }
  // Also check for title pattern in any event for this client
  if (!contactName) {
    const anyEvent = calendarEvents.find((e: any) => e.clientId === clientId && e.title);
    if (anyEvent) eventTitle = anyEvent.title;
  }

  // 4. Check localStorage apex-users (legacy local cache)
  try {
    const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
    const localUser = storedUsers.find((u: any) => u.id === clientId);
    if (localUser) {
      const name = localUser.displayName || localUser.username;
      if (name && !isValidUUID(name)) {
        return {
          displayName: name,
          profilePhoto: localUser.profilePhoto || profilePhoto,
          username: localUser.username || username,
        };
      }
    }
  } catch {
    // localStorage not available (SSR)
  }

  // 5. Use fallback resolver (never returns UUID)
  const displayName = resolveClientDisplayName({
    trainerClientName,
    contactName,
    eventTitle,
  });

  return { displayName, profilePhoto, username };
}

/**
 * Get just the display name string. Convenience wrapper.
 */
export function getClientName(clientId: string | undefined | null): string {
  return getClientDisplayInfo(clientId).displayName;
}
