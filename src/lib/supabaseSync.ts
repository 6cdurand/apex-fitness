import { supabase, db } from './supabase';
import type { Workout, PersonalBest, Medal, User, ClientSession, SessionPackage } from '@/types';

/**
 * Supabase Sync Service
 * Syncs local data to Supabase for cross-device access
 */

// Simple hash function for password (for demo - use bcrypt in production)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(36) + '_' + str.length;
}

// Ensure user exists in Supabase users table (for foreign key relationships)
export async function ensureUserExistsInSupabase(user: User): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    // Check if user already exists
    const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).single();
    
    if (existing) {
      console.log('[Supabase] User already exists in DB:', user.id);
      return true;
    }
    
    // User doesn't exist - create them
    console.log('[Supabase] Creating user in DB:', user.id, user.email);
    const { error } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      username: user.username || user.displayName,
      display_name: user.displayName || user.username,
      gender: user.gender,
      date_of_birth: user.dateOfBirth,
      height: user.height,
      weight: user.weight,
      preferred_unit: user.preferredUnit || 'kg',
      is_trainer: user.isTrainer || false,
      is_verified_trainer: user.isVerifiedTrainer || false,
      mode: user.mode || 'user',
      password_hash: 'migrated_user', // Placeholder for migrated users
    });
    
    if (error) {
      console.error('[Supabase] Error creating user:', error.message);
      return false;
    }
    
    console.log('[Supabase] ✅ User created in DB:', user.email);
    return true;
  } catch (e) {
    console.error('[Supabase] Exception ensuring user exists:', e);
    return false;
  }
}

// Register user to Supabase for cross-device login
export async function registerUserToSupabase(user: User, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('[Supabase Register] === Starting User Registration ===' );
  console.log('[Supabase Register] Config check:', { 
    hasUrl: !!url, 
    hasKey: !!key,
    urlPrefix: url?.substring(0, 30),
    keyPrefix: key?.substring(0, 20) + '...',
  });
  
  if (!isSupabaseConfigured()) {
    console.log('[Supabase Register] ❌ Supabase not configured, using localStorage only');
    return false;
  }
  
  const userData = {
    id: user.id,
    email: user.email,
    username: user.username,
    password_hash: simpleHash(password),
    display_name: user.displayName || user.username,
    gender: user.gender,
    date_of_birth: user.dateOfBirth,
    height: user.height,
    weight: user.weight,
    preferred_unit: user.preferredUnit || 'kg',
    is_trainer: user.isTrainer || false,
    is_verified_trainer: user.isVerifiedTrainer || false,
    mode: user.mode || 'user',
    trainer_id: (user as any).trainerId || null,
  };
  
  console.log('[Supabase Register] User data:', JSON.stringify(userData, null, 2));
  
  try {
    // First check if user already exists
    const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).single();
    
    if (existing) {
      console.log('[Supabase Register] User already exists, updating...');
      const { error: updateError } = await supabase.from('users').update(userData).eq('id', user.id);
      if (updateError) {
        console.error('[Supabase Register] Update error:', updateError.message, updateError.code, updateError.hint);
        return false;
      }
      console.log('[Supabase Register] ✅ User updated:', user.email);
      return true;
    }
    
    // Insert new user
    console.log('[Supabase Register] Inserting new user...');
    const { data, error, status } = await supabase.from('users').insert(userData).select();
    
    console.log('[Supabase Register] Insert response - status:', status);
    
    if (error) {
      console.error('[Supabase Register] ❌ Insert error:', error.message, '| Code:', error.code, '| Hint:', error.hint);
      // Log RLS hint
      if (error.code === '42501' || error.message.includes('policy')) {
        console.error('[Supabase Register] 🔒 This looks like a Row Level Security (RLS) issue. Check Supabase table policies.');
      }
      return false;
    }
    
    console.log('[Supabase Register] ✅ User registered:', user.email);
    return true;
  } catch (e: any) {
    console.error('[Supabase Register] ❌ Exception:', e?.message || e);
    return false;
  }
}

// Login user from Supabase (cross-device)
export async function loginFromSupabase(email: string, password: string): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password_hash', simpleHash(password))
      .single();
    
    if (error || !data) {
      console.log('Supabase login failed:', error?.message);
      return null;
    }
    
    // Convert DB user to local User type
    const user: User = {
      id: data.id,
      email: data.email,
      username: data.username,
      displayName: data.display_name,
      gender: data.gender,
      dateOfBirth: data.date_of_birth,
      height: data.height,
      weight: data.weight,
      preferredUnit: data.preferred_unit || 'kg',
      isTrainer: data.is_trainer,
      isVerifiedTrainer: data.is_verified_trainer,
      mode: data.mode || 'user',
      createdAt: data.created_at,
      followers: [],
      following: [],
      trainerId: data.trainer_id || undefined, // Link to trainer if this is a client
    };
    
    console.log('User logged in from Supabase:', email);
    return user;
  } catch (e) {
    console.error('Login from Supabase failed:', e);
    return null;
  }
}

// Fetch all non-trainer users from Supabase for linking
export async function fetchAllUsersFromSupabase(): Promise<any[]> {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase] Not configured, returning empty array');
    return [];
  }
  
  try {
    console.log('[Supabase] Fetching all users for linking...');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_trainer', false);
    
    if (error) {
      console.error('[Supabase] Error fetching users:', error.message);
      return [];
    }
    
    // Convert to app format
    const users = (data || []).map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.display_name,
      gender: u.gender,
      dateOfBirth: u.date_of_birth,
      height: u.height,
      weight: u.weight,
      preferredUnit: u.preferred_unit,
      isTrainer: u.is_trainer,
      isVerifiedTrainer: u.is_verified_trainer,
      mode: u.mode,
      trainerId: u.trainer_id,
    }));
    
    console.log(`[Supabase] Found ${users.length} users for linking`);
    return users;
  } catch (e) {
    console.error('[Supabase] Exception fetching users:', e);
    return [];
  }
}

// Check if email exists in Supabase
export async function checkEmailExistsInSupabase(email: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    return !!data;
  } catch {
    return false;
  }
}

// Update user in Supabase
export async function updateUserInSupabase(userId: string, updates: Partial<User>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbUpdates: any = {};
    if (updates.displayName) dbUpdates.display_name = updates.displayName;
    if (updates.bio) dbUpdates.bio = updates.bio;
    if (updates.height) dbUpdates.height = updates.height;
    if (updates.weight) dbUpdates.weight = updates.weight;
    if (updates.isTrainer !== undefined) dbUpdates.is_trainer = updates.isTrainer;
    if (updates.mode) dbUpdates.mode = updates.mode;
    if (updates.preferredUnit) dbUpdates.preferred_unit = updates.preferredUnit;
    if ((updates as any).trainerId !== undefined) dbUpdates.trainer_id = (updates as any).trainerId;
    
    const { error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId);
    
    if (error) {
      console.error('Supabase update error:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Update user in Supabase failed:', e);
    return false;
  }
}

// Link a client to a trainer in Supabase (update client's trainer_id)
export async function linkClientToTrainer(clientId: string, trainerId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase] Not configured, skipping trainer link');
    return false;
  }
  
  try {
    console.log(`[Supabase] Linking client ${clientId} to trainer ${trainerId}`);
    const { error } = await supabase
      .from('users')
      .update({ trainer_id: trainerId })
      .eq('id', clientId);
    
    if (error) {
      console.error('[Supabase] Error linking client to trainer:', error.message);
      return false;
    }
    
    console.log('[Supabase] ✅ Client linked to trainer successfully');
    return true;
  } catch (e) {
    console.error('[Supabase] Exception linking client:', e);
    return false;
  }
}

// Fetch all trainer accounts from Supabase (for client to search trainers)
export async function fetchAllTrainersFromSupabase(): Promise<any[]> {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase] Not configured, returning empty array');
    return [];
  }

  try {
    console.log('[Supabase] Fetching all trainers...');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_trainer', true);

    if (error) {
      console.error('[Supabase] Error fetching trainers:', error.message);
      return [];
    }

    const trainers = (data || []).map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.display_name,
      gender: u.gender,
      isTrainer: u.is_trainer,
      isVerifiedTrainer: u.is_verified_trainer,
      mode: u.mode,
      bio: u.bio,
    }));

    console.log(`[Supabase] Found ${trainers.length} trainers`);
    return trainers;
  } catch (e) {
    console.error('[Supabase] Exception fetching trainers:', e);
    return [];
  }
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.includes('supabase.co'));
}

// Convert local workout format to Supabase format
function toDbWorkout(workout: Workout): any {
  return {
    id: workout.id,
    user_id: workout.userId,
    name: workout.name,
    exercises: workout.exercises,
    start_time: workout.startTime,
    end_time: workout.endTime,
    duration: workout.duration,
    total_volume: workout.totalVolume,
    notes: workout.notes || '',
    status: workout.status,
  };
}

// Convert Supabase workout format to local format
function fromDbWorkout(dbWorkout: any): Workout {
  return {
    id: dbWorkout.id,
    userId: dbWorkout.user_id,
    name: dbWorkout.name,
    exercises: dbWorkout.exercises || [],
    startTime: dbWorkout.start_time,
    endTime: dbWorkout.end_time,
    duration: dbWorkout.duration,
    totalVolume: dbWorkout.total_volume || 0,
    notes: dbWorkout.notes,
    status: dbWorkout.status,
  };
}

// Convert local PB format to Supabase format
function toDbPersonalBest(pb: PersonalBest): any {
  return {
    id: pb.id,
    user_id: pb.userId,
    exercise_id: pb.exerciseId,
    weight: pb.bestWeight,
    reps: pb.bestReps,
    one_rep_max: pb.oneRepMax,
    achieved_at: pb.achievedAt,
    workout_id: pb.workoutId,
  };
}

// Convert Supabase PB format to local format
function fromDbPersonalBest(dbPb: any): PersonalBest {
  return {
    id: dbPb.id,
    userId: dbPb.user_id,
    exerciseId: dbPb.exercise_id,
    bestWeight: dbPb.weight,
    bestReps: dbPb.reps,
    oneRepMax: dbPb.one_rep_max,
    bestVolume: dbPb.weight * dbPb.reps,
    achievedAt: dbPb.achieved_at,
    workoutId: dbPb.workout_id,
  };
}

// Convert local medal format to Supabase format
function toDbMedal(medal: Medal): any {
  return {
    id: medal.id,
    user_id: medal.userId,
    definition_id: medal.definitionId,
    name: medal.name,
    description: medal.description,
    icon: medal.icon,
    tier: medal.tier,
    category: medal.category,
    earned: medal.earned,
    earned_at: medal.earnedAt,
    progress: medal.progress || 0,
    target: medal.target || 1,
  };
}

// Convert Supabase medal format to local format
function fromDbMedal(dbMedal: any): Medal {
  return {
    id: dbMedal.id,
    userId: dbMedal.user_id,
    definitionId: dbMedal.definition_id,
    name: dbMedal.name,
    description: dbMedal.description,
    icon: dbMedal.icon,
    tier: dbMedal.tier,
    category: dbMedal.category,
    rarity: dbMedal.tier, // Use tier as rarity fallback
    earned: dbMedal.earned,
    earnedAt: dbMedal.earned_at,
    progress: dbMedal.progress,
    target: dbMedal.target,
  };
}

// Sync a completed workout to Supabase
export async function syncWorkoutToSupabase(workout: Workout): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase
      .from('workouts')
      .upsert(toDbWorkout(workout));
    
    if (error) {
      console.error('Error syncing workout:', error);
      return false;
    }
    console.log('Workout synced to Supabase:', workout.id);
    return true;
  } catch (e) {
    console.error('Sync error:', e);
    return false;
  }
}

// Sync a personal best to Supabase
export async function syncPBToSupabase(pb: PersonalBest): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase
      .from('personal_bests')
      .upsert(toDbPersonalBest(pb), { onConflict: 'user_id,exercise_id' });
    
    if (error) {
      console.error('Error syncing PB:', error);
      return false;
    }
    console.log('PB synced to Supabase:', pb.exerciseId);
    return true;
  } catch (e) {
    console.error('Sync error:', e);
    return false;
  }
}

// Sync a medal to Supabase
export async function syncMedalToSupabase(medal: Medal): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase
      .from('medals')
      .upsert(toDbMedal(medal), { onConflict: 'user_id,definition_id' });
    
    if (error) {
      console.error('Error syncing medal:', error);
      return false;
    }
    console.log('Medal synced to Supabase:', medal.definitionId);
    return true;
  } catch (e) {
    console.error('Sync error:', e);
    return false;
  }
}

// Fetch all data for a user from Supabase
export async function fetchUserDataFromSupabase(userId: string): Promise<{
  workouts: Workout[];
  personalBests: PersonalBest[];
  medals: Medal[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  
  try {
    const [workoutsRes, pbsRes, medalsRes] = await Promise.all([
      supabase.from('workouts').select('*').eq('user_id', userId).order('start_time', { ascending: false }),
      supabase.from('personal_bests').select('*').eq('user_id', userId),
      supabase.from('medals').select('*').eq('user_id', userId),
    ]);
    
    return {
      workouts: (workoutsRes.data || []).map(fromDbWorkout),
      personalBests: (pbsRes.data || []).map(fromDbPersonalBest),
      medals: (medalsRes.data || []).map(fromDbMedal),
    };
  } catch (e) {
    console.error('Fetch error:', e);
    return null;
  }
}

// Merge remote data with local data (remote takes precedence for same IDs)
export function mergeData<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const remoteMap = new Map(remote.map(item => [item.id, item]));
  const merged = [...remote];
  
  // Add local items that don't exist in remote
  for (const localItem of local) {
    if (!remoteMap.has(localItem.id)) {
      merged.push(localItem);
    }
  }
  
  return merged;
}

// Full sync: push local data to Supabase
export async function pushAllDataToSupabase(
  userId: string,
  workouts: Workout[],
  personalBests: PersonalBest[],
  medals: Medal[]
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const userWorkouts = workouts.filter(w => w.userId === userId);
    const userPBs = personalBests.filter(pb => pb.userId === userId);
    const userMedals = medals.filter(m => m.userId === userId);
    
    // Batch upsert
    const promises = [
      ...userWorkouts.map(w => syncWorkoutToSupabase(w)),
      ...userPBs.map(pb => syncPBToSupabase(pb)),
      ...userMedals.map(m => syncMedalToSupabase(m)),
    ];
    
    await Promise.all(promises);
    console.log(`Synced ${userWorkouts.length} workouts, ${userPBs.length} PBs, ${userMedals.length} medals to Supabase`);
    return true;
  } catch (e) {
    console.error('Full sync error:', e);
    return false;
  }
}

// ============ MESSAGES & CONVERSATIONS SYNC ============

export interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface ConversationData {
  id: string;
  participants: string[];
  updatedAt: string;
}

// Sync a message to Supabase
export async function syncMessageToSupabase(message: MessageData): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('messages').upsert({
      id: message.id,
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      receiver_id: message.receiverId,
      content: message.content,
      read: message.read,
      created_at: message.createdAt,
    });
    
    if (error) {
      console.error('[Supabase] Error syncing message:', error);
      return false;
    }
    console.log('[Supabase] Message synced:', message.id);
    return true;
  } catch (e) {
    console.error('[Supabase] Message sync error:', e);
    return false;
  }
}

// Sync a conversation to Supabase
export async function syncConversationToSupabase(conv: ConversationData): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('conversations').upsert({
      id: conv.id,
      participant_1: conv.participants[0],
      participant_2: conv.participants[1],
      updated_at: conv.updatedAt,
    });
    
    if (error) {
      console.error('[Supabase] Error syncing conversation:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Conversation sync error:', e);
    return false;
  }
}

// Fetch messages for a user from Supabase
export async function fetchMessagesFromSupabase(userId: string): Promise<{
  messages: MessageData[];
  conversations: ConversationData[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  
  try {
    const [messagesRes, convsRes] = await Promise.all([
      supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true }),
      supabase.from('conversations')
        .select('*')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`),
    ]);
    
    const messages = (messagesRes.data || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      read: m.read,
      createdAt: m.created_at,
    }));
    
    const conversations = (convsRes.data || []).map((c: any) => ({
      id: c.id,
      participants: [c.participant_1, c.participant_2],
      updatedAt: c.updated_at,
    }));
    
    return { messages, conversations };
  } catch (e) {
    console.error('[Supabase] Fetch messages error:', e);
    return null;
  }
}

// ============ FRIENDSHIPS SYNC ============

// Sync a follow relationship to Supabase
export async function syncFollowToSupabase(followerId: string, followingId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('friendships').upsert({
      follower_id: followerId,
      following_id: followingId,
      created_at: new Date().toISOString(),
    }, { onConflict: 'follower_id,following_id' });
    
    if (error) {
      console.error('[Supabase] Error syncing follow:', error);
      return false;
    }
    console.log('[Supabase] Follow synced:', followerId, '->', followingId);
    return true;
  } catch (e) {
    console.error('[Supabase] Follow sync error:', e);
    return false;
  }
}

// Remove a follow relationship from Supabase
export async function removeFollowFromSupabase(followerId: string, followingId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('friendships')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    
    if (error) {
      console.error('[Supabase] Error removing follow:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Unfollow error:', e);
    return false;
  }
}

// Fetch friendships for a user from Supabase
export async function fetchFriendshipsFromSupabase(userId: string): Promise<{
  followers: string[];
  following: string[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  
  try {
    const [followersRes, followingRes] = await Promise.all([
      supabase.from('friendships').select('follower_id').eq('following_id', userId),
      supabase.from('friendships').select('following_id').eq('follower_id', userId),
    ]);
    
    return {
      followers: (followersRes.data || []).map((f: any) => f.follower_id),
      following: (followingRes.data || []).map((f: any) => f.following_id),
    };
  } catch (e) {
    console.error('[Supabase] Fetch friendships error:', e);
    return null;
  }
}

// ============ STRENGTH RATING SYNC ============

export interface StrengthRatingData {
  overallScore: number;
  level: string;
  tier: string;
  pushScore: number;
  pullScore: number;
  legsScore: number;
}

// Sync strength rating to Supabase
export async function syncStrengthRatingToSupabase(userId: string, rating: StrengthRatingData): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('strength_ratings').upsert({
      user_id: userId,
      overall_score: rating.overallScore,
      level: rating.level,
      tier: rating.tier,
      push_score: rating.pushScore,
      pull_score: rating.pullScore,
      legs_score: rating.legsScore,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('[Supabase] Error syncing strength rating:', error);
      return false;
    }
    console.log('[Supabase] Strength rating synced for user:', userId);
    return true;
  } catch (e) {
    console.error('[Supabase] Strength rating sync error:', e);
    return false;
  }
}

// Fetch strength rating from Supabase
export async function fetchStrengthRatingFromSupabase(userId: string): Promise<StrengthRatingData | null> {
  if (!isSupabaseConfigured()) return null;
  
  try {
    const { data, error } = await supabase
      .from('strength_ratings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) return null;
    
    return {
      overallScore: data.overall_score,
      level: data.level,
      tier: data.tier,
      pushScore: data.push_score,
      pullScore: data.pull_score,
      legsScore: data.legs_score,
    };
  } catch (e) {
    return null;
  }
}

// ============ COMPREHENSIVE FETCH ON LOGIN ============

export async function fetchAllUserDataFromSupabase(userId: string): Promise<{
  workouts: Workout[];
  personalBests: PersonalBest[];
  medals: Medal[];
  messages: MessageData[];
  conversations: ConversationData[];
  followers: string[];
  following: string[];
  strengthRating: StrengthRatingData | null;
} | null> {
  if (!isSupabaseConfigured()) return null;
  
  console.log('[Supabase] Fetching all data for user:', userId);
  
  try {
    const [coreData, messageData, friendshipData, strengthRating] = await Promise.all([
      fetchUserDataFromSupabase(userId),
      fetchMessagesFromSupabase(userId),
      fetchFriendshipsFromSupabase(userId),
      fetchStrengthRatingFromSupabase(userId),
    ]);
    
    return {
      workouts: coreData?.workouts || [],
      personalBests: coreData?.personalBests || [],
      medals: coreData?.medals || [],
      messages: messageData?.messages || [],
      conversations: messageData?.conversations || [],
      followers: friendshipData?.followers || [],
      following: friendshipData?.following || [],
      strengthRating,
    };
  } catch (e) {
    console.error('[Supabase] Fetch all data error:', e);
    return null;
  }
}

// Delete a single user from Supabase
export async function deleteUserFromSupabase(userId: string): Promise<boolean> {
  console.log('[Supabase Delete] === Deleting User ===', userId);
  
  if (!isSupabaseConfigured()) {
    console.log('[Supabase Delete] ❌ Supabase not configured');
    return false;
  }
  
  try {
    // Delete related data first (foreign key constraints)
    console.log('[Supabase Delete] Deleting related workouts...');
    const { error: workoutErr } = await supabase.from('workouts').delete().eq('user_id', userId);
    if (workoutErr) console.log('[Supabase Delete] Workouts:', workoutErr.message);
    
    console.log('[Supabase Delete] Deleting related PBs...');
    const { error: pbErr } = await supabase.from('personal_bests').delete().eq('user_id', userId);
    if (pbErr) console.log('[Supabase Delete] PBs:', pbErr.message);
    
    console.log('[Supabase Delete] Deleting related medals...');
    const { error: medalErr } = await supabase.from('medals').delete().eq('user_id', userId);
    if (medalErr) console.log('[Supabase Delete] Medals:', medalErr.message);
    
    console.log('[Supabase Delete] Deleting strength ratings...');
    const { error: ratingErr } = await supabase.from('strength_ratings').delete().eq('user_id', userId);
    if (ratingErr) console.log('[Supabase Delete] Ratings:', ratingErr.message);
    
    // Delete the user
    console.log('[Supabase Delete] Deleting user record...');
    const { error, status } = await supabase.from('users').delete().eq('id', userId);
    
    console.log('[Supabase Delete] Delete response status:', status);
    
    if (error) {
      console.error('[Supabase Delete] ❌ Error:', error.message, '| Code:', error.code);
      if (error.code === '42501' || error.message.includes('policy')) {
        console.error('[Supabase Delete] 🔒 RLS policy is blocking deletion. Check Supabase table policies.');
      }
      return false;
    }
    
    console.log('[Supabase Delete] ✅ User deleted from Supabase:', userId);
    return true;
  } catch (e: any) {
    console.error('[Supabase Delete] ❌ Exception:', e?.message || e);
    return false;
  }
}

// Delete ALL users from Supabase (for fresh start)
export async function deleteAllUsersFromSupabase(): Promise<boolean> {
  console.log('[Supabase Cleanup] === Deleting All Users ===');
  
  if (!isSupabaseConfigured()) {
    console.log('[Supabase Cleanup] ❌ Supabase not configured');
    return false;
  }
  
  try {
    // Delete all related data first (foreign key constraints)
    console.log('[Supabase Cleanup] Deleting workouts...');
    const { error: workoutsError } = await supabase.from('workouts').delete().neq('id', '');
    if (workoutsError) console.error('[Supabase Cleanup] Workouts error:', workoutsError.message);
    
    console.log('[Supabase Cleanup] Deleting personal_bests...');
    const { error: pbError } = await supabase.from('personal_bests').delete().neq('id', '');
    if (pbError) console.error('[Supabase Cleanup] PBs error:', pbError.message);
    
    console.log('[Supabase Cleanup] Deleting medals...');
    const { error: medalsError } = await supabase.from('medals').delete().neq('id', '');
    if (medalsError) console.error('[Supabase Cleanup] Medals error:', medalsError.message);
    
    console.log('[Supabase Cleanup] Deleting users...');
    const { error: usersError } = await supabase.from('users').delete().neq('id', '');
    
    if (usersError) {
      console.error('[Supabase Cleanup] ❌ Users error:', usersError.message);
      return false;
    }
    
    console.log('[Supabase Cleanup] ✅ All users deleted from Supabase');
    return true;
  } catch (e) {
    console.error('[Supabase Cleanup] ❌ Exception:', e);
    return false;
  }
}

// ============ TRAINER SESSION SYNC ============

// Sync a trainer session to Supabase
export async function syncTrainerSessionToSupabase(session: ClientSession): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbSession = {
      id: session.id,
      trainer_id: session.trainerId,
      client_id: session.clientId,
      date: session.date,
      start_time: session.startTime,
      end_time: session.endTime,
      duration: session.duration,
      type: session.type,
      status: session.status,
      workout_id: session.workoutId || null,
      notes: session.notes || null,
      rating: session.rating || null,
      feedback: session.feedback || null,
      paid: session.paid,
      payment_id: session.paymentId || null,
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('trainer_sessions')
      .upsert(dbSession, { onConflict: 'id' });
    
    if (error) {
      console.error('[Session Sync] Error:', error.message);
      return false;
    }
    
    console.log('[Session Sync] ✅ Session synced:', session.id);
    return true;
  } catch (e) {
    console.error('[Session Sync] Exception:', e);
    return false;
  }
}

// Fetch all sessions for a trainer from Supabase
export async function fetchTrainerSessionsFromSupabase(trainerId: string): Promise<ClientSession[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('trainer_sessions')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('date', { ascending: false });
    
    if (error) {
      console.error('[Session Fetch] Error:', error.message);
      return [];
    }
    
    const sessions: ClientSession[] = (data || []).map(s => ({
      id: s.id,
      trainerId: s.trainer_id,
      clientId: s.client_id,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      duration: s.duration,
      type: s.type,
      status: s.status,
      workoutId: s.workout_id,
      notes: s.notes,
      rating: s.rating,
      feedback: s.feedback,
      paid: s.paid,
      paymentId: s.payment_id,
    }));
    
    console.log(`[Session Fetch] Found ${sessions.length} sessions for trainer`);
    return sessions;
  } catch (e) {
    console.error('[Session Fetch] Exception:', e);
    return [];
  }
}

// Sync a session package to Supabase
export async function syncSessionPackageToSupabase(pkg: SessionPackage): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbPackage = {
      id: pkg.id,
      trainer_id: pkg.trainerId,
      client_id: pkg.clientId,
      name: pkg.name,
      total_sessions: pkg.totalSessions,
      used_sessions: pkg.usedSessions,
      remaining_sessions: pkg.remainingSessions,
      price_total: pkg.priceTotal,
      price_per_session: pkg.pricePerSession,
      purchase_date: pkg.purchaseDate,
      expiry_date: pkg.expiryDate || null,
      payment_id: pkg.paymentId || null,
      status: pkg.status,
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('session_packages')
      .upsert(dbPackage, { onConflict: 'id' });
    
    if (error) {
      console.error('[Package Sync] Error:', error.message);
      return false;
    }
    
    console.log('[Package Sync] ✅ Package synced:', pkg.id);
    return true;
  } catch (e) {
    console.error('[Package Sync] Exception:', e);
    return false;
  }
}

// Fetch all session packages for a trainer from Supabase
export async function fetchSessionPackagesFromSupabase(trainerId: string): Promise<SessionPackage[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('session_packages')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Package Fetch] Error:', error.message);
      return [];
    }
    
    const packages: SessionPackage[] = (data || []).map(p => ({
      id: p.id,
      trainerId: p.trainer_id,
      clientId: p.client_id,
      name: p.name,
      totalSessions: p.total_sessions,
      usedSessions: p.used_sessions,
      remainingSessions: p.remaining_sessions,
      priceTotal: p.price_total,
      pricePerSession: p.price_per_session,
      purchaseDate: p.purchase_date,
      expiryDate: p.expiry_date,
      paymentId: p.payment_id,
      status: p.status,
    }));
    
    console.log(`[Package Fetch] Found ${packages.length} packages for trainer`);
    return packages;
  } catch (e) {
    console.error('[Package Fetch] Exception:', e);
    return [];
  }
}

// Sync trainer client relationship to Supabase
export async function syncTrainerClientToSupabase(client: {
  id: string;
  trainerId: string;
  clientId: string;
  status?: string;
  startDate?: string;
  onboardingComplete?: boolean;
  notes?: string;
  goals?: string[];
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbClient = {
      id: client.id,
      trainer_id: client.trainerId,
      client_id: client.clientId,
      status: client.status || 'active',
      start_date: client.startDate || new Date().toISOString(),
      onboarding_complete: client.onboardingComplete || false,
      notes: client.notes || null,
      goals: client.goals || null,
    };
    
    const { error } = await supabase
      .from('trainer_clients')
      .upsert(dbClient, { onConflict: 'id' });
    
    if (error) {
      console.error('[Client Sync] Error:', error.message);
      return false;
    }
    
    console.log('[Client Sync] ✅ Client synced:', client.clientId);
    return true;
  } catch (e) {
    console.error('[Client Sync] Exception:', e);
    return false;
  }
}

// Fetch trainer's clients from Supabase
export async function fetchTrainerClientsFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('trainer_clients')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Client Fetch] Error:', error.message);
      return [];
    }
    
    const clients = (data || []).map(c => ({
      id: c.id,
      trainerId: c.trainer_id,
      clientId: c.client_id,
      status: c.status,
      startDate: c.start_date,
      onboardingComplete: c.onboarding_complete,
      notes: c.notes,
      goals: c.goals,
    }));
    
    console.log(`[Client Fetch] Found ${clients.length} clients for trainer`);
    return clients;
  } catch (e) {
    console.error('[Client Fetch] Exception:', e);
    return [];
  }
}

// Clear all local storage data for Apex
export function clearAllLocalData(): void {
  console.log('[Local Cleanup] Clearing localStorage...');
  localStorage.removeItem('apex-users');
  localStorage.removeItem('apex-auth-storage');
  localStorage.removeItem('apex-workout-storage');
  localStorage.removeItem('apex-medal-storage');
  console.log('[Local Cleanup] ✅ All local data cleared');
}

// Full cleanup - both Supabase and localStorage
export async function fullCleanup(): Promise<void> {
  console.log('[Full Cleanup] === Starting Full Cleanup ===');
  await deleteAllUsersFromSupabase();
  clearAllLocalData();
  console.log('[Full Cleanup] ✅ Complete! Refresh the page to start fresh.');
}

// ============ CALENDAR EVENTS SYNC ============

export async function syncCalendarEventToSupabase(event: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbEvent = {
      id: event.id,
      title: event.title,
      type: event.type,
      date: event.date,
      start_time: event.startTime || null,
      end_time: event.endTime || null,
      duration: event.duration || null,
      client_id: event.clientId || null,
      trainer_id: event.trainerId || null,
      workout_id: event.workoutId || null,
      notes: event.notes || null,
      status: event.status || 'scheduled',
      color: event.color || null,
      client_confirmed: event.clientConfirmed || false,
      client_confirmed_at: event.clientConfirmedAt || null,
    };
    
    const { error } = await supabase.from('calendar_events').upsert(dbEvent, { onConflict: 'id' });
    if (error) {
      console.error('[Calendar Sync] Error:', error.message);
      return false;
    }
    console.log('[Calendar Sync] ✅ Event synced:', event.id);
    return true;
  } catch (e) {
    console.error('[Calendar Sync] Exception:', e);
    return false;
  }
}

export async function fetchCalendarEventsFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Calendar Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(e => ({
      id: e.id,
      title: e.title,
      type: e.type,
      date: e.date,
      startTime: e.start_time,
      endTime: e.end_time,
      duration: e.duration,
      clientId: e.client_id,
      trainerId: e.trainer_id,
      workoutId: e.workout_id,
      notes: e.notes,
      status: e.status,
      color: e.color,
      clientConfirmed: e.client_confirmed,
      clientConfirmedAt: e.client_confirmed_at,
    }));
  } catch (e) {
    console.error('[Calendar Fetch] Exception:', e);
    return [];
  }
}

export async function deleteCalendarEventFromSupabase(eventId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
    if (error) {
      console.error('[Calendar Delete] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============ PAYMENTS SYNC ============

export async function syncPaymentToSupabase(payment: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbPayment = {
      id: payment.id,
      trainer_id: payment.trainerId,
      client_id: payment.clientId,
      amount: payment.amount,
      currency: payment.currency || 'NZD',
      type: payment.type,
      sessions_included: payment.sessionsIncluded || null,
      description: payment.description,
      status: payment.status,
      due_date: payment.dueDate || null,
      paid_at: payment.paidAt || null,
      method: payment.method || null,
      invoice_number: payment.invoiceNumber || null,
      created_at: payment.createdAt,
    };
    
    const { error } = await supabase.from('client_payments').upsert(dbPayment, { onConflict: 'id' });
    if (error) {
      console.error('[Payment Sync] Error:', error.message);
      return false;
    }
    console.log('[Payment Sync] ✅ Payment synced:', payment.id);
    return true;
  } catch (e) {
    console.error('[Payment Sync] Exception:', e);
    return false;
  }
}

export async function fetchPaymentsFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('client_payments')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Payment Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(p => ({
      id: p.id,
      trainerId: p.trainer_id,
      clientId: p.client_id,
      amount: p.amount,
      currency: p.currency,
      type: p.type,
      sessionsIncluded: p.sessions_included,
      description: p.description,
      status: p.status,
      dueDate: p.due_date,
      paidAt: p.paid_at,
      method: p.method,
      invoiceNumber: p.invoice_number,
      createdAt: p.created_at,
    }));
  } catch (e) {
    console.error('[Payment Fetch] Exception:', e);
    return [];
  }
}

// ============ CLIENT PROGRAMS SYNC ============

export async function syncClientProgramToSupabase(program: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbProgram = {
      id: program.id,
      client_id: program.clientId,
      trainer_id: program.trainerId,
      template_id: program.templateId || null,
      template_name: program.templateName || null,
      phase: program.phase || null,
      goal: program.goal || null,
      weekly_plan: program.weeklyPlan || null,
      training_days: program.trainingDays || null,
      start_date: program.startDate || null,
      end_date: program.endDate || null,
      status: program.status || 'active',
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from('client_programs').upsert(dbProgram, { onConflict: 'id' });
    if (error) {
      console.error('[Program Sync] Error:', error.message);
      return false;
    }
    console.log('[Program Sync] ✅ Program synced:', program.id);
    return true;
  } catch (e) {
    console.error('[Program Sync] Exception:', e);
    return false;
  }
}

export async function fetchClientProgramsFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('client_programs')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Program Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(p => ({
      id: p.id,
      clientId: p.client_id,
      trainerId: p.trainer_id,
      templateId: p.template_id,
      templateName: p.template_name,
      phase: p.phase,
      goal: p.goal,
      weeklyPlan: p.weekly_plan,
      trainingDays: p.training_days,
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  } catch (e) {
    console.error('[Program Fetch] Exception:', e);
    return [];
  }
}

// ============ BOOKING REQUESTS SYNC ============

export async function syncBookingRequestToSupabase(request: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbRequest = {
      id: request.id,
      trainer_id: request.trainerId,
      client_id: request.clientId,
      date: request.date,
      start_time: request.startTime,
      end_time: request.endTime,
      type: request.type,
      status: request.status,
      requested_by: request.requestedBy,
      confirmed_by: request.confirmedBy || null,
      notes: request.notes || null,
      location: request.location || null,
      created_at: request.createdAt,
      responded_at: request.respondedAt || null,
      calendar_event_id: request.calendarEventId || null,
    };
    
    const { error } = await supabase.from('booking_requests').upsert(dbRequest, { onConflict: 'id' });
    if (error) {
      console.error('[Booking Sync] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Booking Sync] Exception:', e);
    return false;
  }
}

export async function fetchBookingRequestsFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Booking Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(r => ({
      id: r.id,
      trainerId: r.trainer_id,
      clientId: r.client_id,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      type: r.type,
      status: r.status,
      requestedBy: r.requested_by,
      confirmedBy: r.confirmed_by,
      notes: r.notes,
      location: r.location,
      createdAt: r.created_at,
      respondedAt: r.responded_at,
      calendarEventId: r.calendar_event_id,
    }));
  } catch (e) {
    console.error('[Booking Fetch] Exception:', e);
    return [];
  }
}

// ============ DELETE FUNCTIONS ============

export async function deleteTrainerSessionFromSupabase(sessionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('trainer_sessions').delete().eq('id', sessionId);
    return !error;
  } catch (e) {
    return false;
  }
}

export async function deleteTrainerClientFromSupabase(clientId: string, trainerId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('trainer_clients').delete().eq('client_id', clientId).eq('trainer_id', trainerId);
    return !error;
  } catch (e) {
    return false;
  }
}

// DEBUG: Check what's actually in Supabase - call from browser console
export async function debugSupabase(trainerId?: string): Promise<void> {
  console.log('=== SUPABASE DEBUG ===');
  console.log('Configured:', isSupabaseConfigured());
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase NOT configured - check env vars');
    return;
  }
  
  try {
    // Test connection by fetching users count
    const { data: users, error: usersError } = await supabase.from('users').select('id, email, display_name');
    console.log('Users table:', usersError ? `ERROR: ${usersError.message}` : `${users?.length || 0} users`);
    if (users) console.table(users);
    
    // Check trainer_clients table
    const { data: clients, error: clientsError } = await supabase.from('trainer_clients').select('*');
    console.log('Trainer_clients table:', clientsError ? `ERROR: ${clientsError.message}` : `${clients?.length || 0} records`);
    if (clients) console.table(clients);
    
    // Check trainer_sessions table
    const { data: sessions, error: sessionsError } = await supabase.from('trainer_sessions').select('*');
    console.log('Trainer_sessions table:', sessionsError ? `ERROR: ${sessionsError.message}` : `${sessions?.length || 0} records`);
    
    // Check session_packages table
    const { data: packages, error: packagesError } = await supabase.from('session_packages').select('*');
    console.log('Session_packages table:', packagesError ? `ERROR: ${packagesError.message}` : `${packages?.length || 0} records`);
    
    // If trainerId provided, fetch specifically for that trainer
    if (trainerId) {
      console.log('\n--- Data for trainer:', trainerId, '---');
      const trainerClients = await fetchTrainerClientsFromSupabase(trainerId);
      console.log('Clients for this trainer:', trainerClients.length);
      console.table(trainerClients);
      
      const trainerSessions = await fetchTrainerSessionsFromSupabase(trainerId);
      console.log('Sessions for this trainer:', trainerSessions.length);
    }
    
  } catch (e) {
    console.error('Debug error:', e);
  }
}
