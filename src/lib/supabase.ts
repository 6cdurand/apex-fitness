import { createClient } from '@supabase/supabase-js';
import { capacitorAsyncStorage } from './capacitorStorage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Debug logging for Supabase initialization
console.log('[Supabase Init] Configuration check:', {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 40)}...` : '(empty)',
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : '(empty)',
  keyIsJWT: supabaseAnonKey.startsWith('eyJ'),
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase Init] Credentials not configured. Using localStorage fallback.');
}

if (supabaseAnonKey && !supabaseAnonKey.startsWith('eyJ')) {
  console.warn('[Supabase Init] WARNING: Anon key does not look like a valid JWT. Supabase keys typically start with "eyJ"');
}

// Use placeholder values if not configured — the app falls back to localStorage anyway
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      // v19-D1: Preferences-backed on native so the Supabase session
      // survives WKWebView localStorage eviction. Falls back to
      // localStorage on web/PWA (identical to pre-v19 behaviour).
      storage: capacitorAsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

/**
 * BUG-008 (native cold-start auth race) — session-ready gate.
 *
 * On native (Capacitor) the Supabase client restores its auth session from
 * Preferences ASYNCHRONOUSLY (see `capacitorAsyncStorage`). Authenticated
 * reads fired on mount — `user_directory()`, the `users` self-read, chunked
 * client-name lookups — can outrun that restore and go out with NO JWT,
 * which PostgREST answers with `401`. The clients page then caches every
 * name as "unknown" and never refetches. On web the session restores
 * synchronously from localStorage, so the same calls were already
 * authenticated — which is why only native showed the bug.
 *
 * `getSession()` blocks on GoTrue's initialize/recovery promise, so awaiting
 * it guarantees the in-memory session (and its `Authorization` header) is
 * attached before the caller issues its PostgREST request. It is a cheap
 * in-memory read once recovery has completed, so calling this at the top of
 * each identity/name loader is effectively free after the first cold call.
 *
 * BUG-008 hardening (iPadOS 18 regression). PR #49 awaited `getSession()`,
 * which RESOLVES IMMEDIATELY with `session: null` if the async Preferences
 * restore hasn't landed yet — so on iPadOS 18's slower restore the read still
 * fired with no JWT and raced to a 401 ("unknown" names). We now treat a null
 * session as "not ready yet" and wait for the FIRST session-bearing auth event
 * (`INITIAL_SESSION` / `SIGNED_IN` / `TOKEN_REFRESHED`) from
 * `onAuthStateChange`, bounded by a timeout so an unauthenticated app never
 * blocks. supabase-js emits the current auth state on subscribe, so a session
 * that attaches between the `getSession()` probe and the subscribe is not
 * missed. On web (and warm native) `getSession()` returns a session
 * synchronously and we return on the fast path — behaviour is unchanged.
 */
export async function ensureSupabaseSession(timeoutMs = 3000): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    // Fast path: web restores synchronously; warm native is already attached.
    if (data?.session) return;

    // Native cold start: the session may still be restoring asynchronously.
    // Wait for the first auth event that actually carries a session, bounded
    // by `timeoutMs` so an unauthenticated user never hangs the read.
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          sub.subscription.unsubscribe();
        } catch {
          // ignore — already torn down.
        }
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      const sub = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) finish();
      }).data;
    });
  } catch {
    // Never block (or fail) a read on a session-probe error — the read will
    // simply behave as it does today (401 → local-cache fallback).
  }
}

/**
 * BUG-008 — race-safe authenticated read.
 *
 * (A) awaits a session-ready signal BEFORE the read (removes the cold-start
 * race at its root), and (B) — belt-and-braces, since the name path fires
 * from many entry points — retries with a small bounded backoff, re-confirming
 * the session before each retry, if the read still reports an error (e.g. a
 * token that attaches a few ticks late on iPadOS 18). A single retry was not
 * enough on the slower iPad restore, so the default is up to 2 retries (3
 * attempts total) with linear backoff. Generic + dependency-injected (incl. an
 * injectable `sleep`) so the ordering / bounded-retry contract is unit-testable
 * without a live Supabase client or real timers (see `userFetchUtils.test.ts`).
 */
export async function readWithSessionGate<T>(
  ensureSession: () => Promise<void>,
  read: () => PromiseLike<{ data: T; error: unknown }>,
  opts?: { retries?: number; backoffMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<{ data: T; error: unknown }> {
  const retries = opts?.retries ?? 2;
  const backoffMs = opts?.backoffMs ?? 150;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  await ensureSession();
  let result = await read();
  let attempt = 0;
  // Self-healing retries: a late-attaching token (iPadOS 18) makes the early
  // read 401; re-confirm the session and retry, bounded so a genuine error
  // surfaces instead of looping forever.
  while (result.error && attempt < retries) {
    attempt++;
    await sleep(backoffMs * attempt);
    await ensureSession();
    result = await read();
  }
  return result;
}

// Database types
export interface DbUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  profile_photo?: string;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  preferred_unit: 'kg' | 'lbs';
  is_trainer: boolean;
  trainer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorkout {
  id: string;
  user_id: string;
  name: string;
  exercises: any; // JSON
  start_time: string;
  end_time?: string;
  duration?: number;
  total_volume: number;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
}

// W3: must mirror public.personal_bests exactly. Verified against prod
// (SQL 2026-05-01): id uuid, user_id uuid, exercise_id text, exercise_name
// text, weight numeric, reps integer, one_rm numeric, date timestamptz,
// created_at timestamptz. There is NO `workout_id` column and NO FK to
// workouts — the historical rename was from one_rep_max/achieved_at to
// one_rm/date and the app mapping was never updated, so every PB upsert
// has been failing with 42703 for the lifetime of the rename.
export interface DbPersonalBest {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_name?: string;
  weight: number;
  reps: number;
  one_rm: number;
  date: string;
}

export interface DbMedal {
  id: string;
  user_id: string;
  definition_id: string;
  name: string;
  description?: string;
  icon: string;
  tier: string;
  category: string;
  earned: boolean;
  earned_at?: string;
  progress: number;
  target: number;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface DbConversation {
  id: string;
  participant_1: string;
  participant_2: string;
  updated_at: string;
}

export interface DbFriendship {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface DbStrengthRating {
  id: string;
  user_id: string;
  overall_score: number;
  level: string;
  tier: string;
  push_score: number;
  pull_score: number;
  legs_score: number;
  updated_at: string;
}

// Helper functions for Supabase operations
export const db = {
  // Users
  async getUser(userId: string): Promise<DbUser | null> {
    const { data, error } = await supabase
      .from('users')
      // F0-A (PII hardening): explicit column list excludes password_hash.
      // Columns = the DbUser contract (the sole consumer of db.getUser).
      .select(
        'id, email, username, display_name, profile_photo, gender, height, weight, preferred_unit, is_trainer, trainer_id, created_at, updated_at',
      )
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  async upsertUser(user: Partial<DbUser> & { id: string }): Promise<DbUser | null> {
    // F0-B: explicit DbUser columns (never password_hash) so the STAGE 2 column
    // GRANT does not break this RETURNING. (No callers today — kept for parity.)
    const { data, error } = await supabase
      .from('users')
      .upsert(user)
      .select(
        'id, email, username, display_name, profile_photo, gender, height, weight, preferred_unit, is_trainer, trainer_id, created_at, updated_at',
      )
      .single();
    if (error) {
      console.error('Error upserting user:', error);
      return null;
    }
    return data;
  },

  // Workouts
  async getWorkoutsForUser(userId: string): Promise<DbWorkout[]> {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });
    if (error) return [];
    return data || [];
  },

  async addWorkout(workout: Omit<DbWorkout, 'created_at'>): Promise<DbWorkout | null> {
    const { data, error } = await supabase
      .from('workouts')
      .insert({ ...workout, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) {
      console.error('Error adding workout:', error);
      return null;
    }
    return data;
  },

  async updateWorkout(workoutId: string, updates: Partial<DbWorkout>): Promise<DbWorkout | null> {
    const { data, error } = await supabase
      .from('workouts')
      .update(updates)
      .eq('id', workoutId)
      .select()
      .single();
    if (error) return null;
    return data;
  },

  // Personal Bests
  async getPersonalBestsForUser(userId: string): Promise<DbPersonalBest[]> {
    const { data, error } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('user_id', userId);
    if (error) return [];
    return data || [];
  },

  async upsertPersonalBest(pb: DbPersonalBest): Promise<DbPersonalBest | null> {
    const { data, error } = await supabase
      .from('personal_bests')
      .upsert(pb, { onConflict: 'user_id,exercise_id' })
      .select()
      .single();
    if (error) {
      console.error('Error upserting PB:', error);
      return null;
    }
    return data;
  },

  // Medals
  async getMedalsForUser(userId: string): Promise<DbMedal[]> {
    const { data, error } = await supabase
      .from('medals')
      .select('*')
      .eq('user_id', userId);
    if (error) return [];
    return data || [];
  },

  async upsertMedal(medal: DbMedal): Promise<DbMedal | null> {
    const { data, error } = await supabase
      .from('medals')
      .upsert(medal, { onConflict: 'user_id,definition_id' })
      .select()
      .single();
    if (error) {
      console.error('Error upserting medal:', error);
      return null;
    }
    return data;
  },

  // Clear all data for a user
  async clearUserData(userId: string): Promise<void> {
    await Promise.all([
      supabase.from('workouts').delete().eq('user_id', userId),
      supabase.from('personal_bests').delete().eq('user_id', userId),
      supabase.from('medals').delete().eq('user_id', userId),
    ]);
  },

  // Check if Supabase is configured
  isConfigured(): boolean {
    return Boolean(supabaseUrl && supabaseAnonKey);
  },
};
