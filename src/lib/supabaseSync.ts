import { supabase, db } from './supabase';
import type { Workout, PersonalBest, Medal, User } from '@/types';

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
