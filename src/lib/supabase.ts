import { createClient } from '@supabase/supabase-js';

// Fail-fast: no URL/key fallbacks. A missing or placeholder URL silently
// routed every auth request (sign-in, password recovery) to a dead host,
// which is why recovery emails never sent. Throwing here makes the
// misconfiguration obvious in the browser console / SSR logs instead of
// letting the app issue requests against `placeholder.supabase.co`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseUrl.includes('.supabase.co')) {
  throw new Error(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL is missing or invalid. ' +
      'It must be set at build time and contain ".supabase.co". ' +
      `Received: ${supabaseUrl ? JSON.stringify(supabaseUrl) : '(empty)'}`,
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
      'It must be set at build time for the browser client to authenticate.',
  );
}

if (!supabaseAnonKey.startsWith('eyJ')) {
  // Not fatal (keys could in theory differ), but loud — a non-JWT value
  // almost always means the env var was populated with the wrong secret.
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a JWT (expected to start with "eyJ").',
  );
}

console.log('[Supabase Init] Using project URL:', supabaseUrl);

// Disable navigator.locks for GoTrue. The default `LockAcquireTimeoutError`
// recovery path can deadlock in this app when multiple components call
// `auth.getSession()` / `signInWithPassword()` concurrently during bootstrap
// (symptom: every awaited auth call hangs until its own timeout wrapper
// fires, while `onAuthStateChange` still reports SIGNED_IN in the
// background). A pass-through lock eliminates the deadlock; it is safe
// here because the session is never shared across tabs in a way that
// requires cross-tab serialisation for this app — each tab operates on
// its own localStorage snapshot and reconciles via `onAuthStateChange`.
const passThroughLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: passThroughLock,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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

export interface DbPersonalBest {
  id: string;
  user_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  one_rep_max: number;
  achieved_at: string;
  workout_id?: string;
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
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  async upsertUser(user: Partial<DbUser> & { id: string }): Promise<DbUser | null> {
    const { data, error } = await supabase
      .from('users')
      .upsert(user)
      .select()
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
