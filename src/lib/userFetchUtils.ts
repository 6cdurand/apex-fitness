import { supabase } from './supabase';

// ============================================================
// Chunked user fetch + display name resolution utilities
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate that a string looks like a valid UUID v4 */
export function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}

export interface UserProfile {
  id: string;
  displayName?: string;
  username?: string;
  profilePhoto?: string;
}

export interface ChunkedFetchResult {
  usersById: Record<string, UserProfile>;
  failedIds: string[];
}

/**
 * Fetch user profiles by IDs in batches to avoid exceeding Supabase URL length limits.
 * - Deduplicates IDs
 * - Skips invalid UUIDs
 * - Retries failed chunks independently (partial success)
 * - Returns merged results + list of failed IDs
 */
export async function fetchUsersByIdsChunked(
  ids: string[],
  batchSize = 25
): Promise<ChunkedFetchResult> {
  const usersById: Record<string, UserProfile> = {};
  const failedIds: string[] = [];

  // Deduplicate and filter invalid UUIDs
  const uniqueIds = [...new Set(ids)].filter(id => {
    if (!isValidUUID(id)) {
      console.warn('[UserFetch] Skipping invalid UUID:', id?.slice(0, 8));
      return false;
    }
    return true;
  });

  if (uniqueIds.length === 0) return { usersById, failedIds };

  // Split into chunks
  const chunks = chunkArray(uniqueIds, batchSize);
  console.log(`[UserFetch] Fetching ${uniqueIds.length} users in ${chunks.length} chunks (batch=${batchSize})`);

  // Fetch each chunk independently
  const results = await Promise.allSettled(
    chunks.map(async (chunk, i) => {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, username, profile_photo')
        .in('id', chunk);

      if (error) {
        console.error(`[UserFetch] Chunk ${i + 1}/${chunks.length} failed (${chunk.length} ids):`, error.message);
        throw { chunk, error };
      }

      return data || [];
    })
  );

  // Merge successful results
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      result.value.forEach((u: any) => {
        usersById[u.id] = {
          id: u.id,
          displayName: u.display_name || undefined,
          username: u.username || undefined,
          profilePhoto: u.profile_photo || undefined,
        };
      });
    } else {
      // Collect failed IDs from rejected chunks
      const reason = result.reason as { chunk: string[] };
      if (reason?.chunk) {
        failedIds.push(...reason.chunk);
      }
    }
  });

  console.log(`[UserFetch] Resolved ${Object.keys(usersById).length}/${uniqueIds.length} users, ${failedIds.length} failed`);
  return { usersById, failedIds };
}

/**
 * Split an array into chunks of a given size.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================
// Display name resolution with fallback chain
// ============================================================

export interface NameResolutionContext {
  /** User profile from Supabase (may be partial) */
  userProfile?: UserProfile;
  /** Calendar event contact_name field */
  contactName?: string;
  /** Calendar event title field */
  eventTitle?: string;
  /** Client record from trainer store */
  trainerClientName?: string;
}

/**
 * Resolve a display name for a client using a waterfall of sources.
 * NEVER returns a raw UUID.
 *
 * Priority:
 * 1. users.display_name
 * 2. users.username
 * 3. trainerClient.displayName / .name (from onboarding)
 * 4. calendar_events.contact_name
 * 5. Parse from event title if pattern "Session with X"
 * 6. "Unknown Client"
 */
export function resolveClientDisplayName(ctx: NameResolutionContext): string {
  // 1. Supabase user display_name
  if (ctx.userProfile?.displayName && ctx.userProfile.displayName.trim()) {
    return ctx.userProfile.displayName.trim();
  }

  // 2. Supabase username
  if (ctx.userProfile?.username && ctx.userProfile.username.trim()) {
    return ctx.userProfile.username.trim();
  }

  // 3. Trainer client record name (from onboarding / local store)
  if (ctx.trainerClientName && ctx.trainerClientName.trim()) {
    return ctx.trainerClientName.trim();
  }

  // 4. Calendar event contact name
  if (ctx.contactName && ctx.contactName.trim() && !isValidUUID(ctx.contactName.trim())) {
    return ctx.contactName.trim();
  }

  // 5. Parse from event title "Session with X" / "Session - X"
  if (ctx.eventTitle) {
    const match = ctx.eventTitle.match(/(?:Session|session)\s*(?:with|[-–—])\s*(.+)/i);
    if (match && match[1] && match[1].trim().length > 1 && !isValidUUID(match[1].trim())) {
      return match[1].trim();
    }
  }

  // 6. Never show UUID
  return 'Unknown Client';
}

// ============================================================
// User profile cache with TTL invalidation
// ============================================================

const CACHE_KEY = 'apex-user-profile-cache';
const CACHE_VERSION_KEY = 'apex-user-profile-cache-version';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: Record<string, UserProfile>;
  timestamp: number;
}

/** Read the profile cache (returns empty if stale or missing) */
export function readProfileCache(): Record<string, UserProfile> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      console.log('[ProfileCache] Cache expired, invalidating');
      localStorage.removeItem(CACHE_KEY);
      return {};
    }
    return entry.data;
  } catch {
    return {};
  }
}

/** Write profiles into the cache (merges with existing) */
export function writeProfileCache(profiles: Record<string, UserProfile>): void {
  try {
    const existing = readProfileCache();
    const merged = { ...existing, ...profiles };
    const entry: CacheEntry = { data: merged, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

/** Force-invalidate the profile cache */
export function invalidateProfileCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[ProfileCache] Cache invalidated');
  } catch {}
}

/**
 * Force-refresh all client profiles from Supabase for a list of IDs.
 * Updates the local cache.
 */
export async function forceRefreshClientProfiles(ids: string[]): Promise<ChunkedFetchResult> {
  invalidateProfileCache();
  const result = await fetchUsersByIdsChunked(ids);
  writeProfileCache(result.usersById);
  return result;
}
