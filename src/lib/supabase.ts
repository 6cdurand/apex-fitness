import { createClient } from '@supabase/supabase-js';

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
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
);

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
