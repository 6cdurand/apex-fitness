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
    // Check if user already exists (use maybeSingle to avoid 406 error when not found)
    const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
    
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
export async function registerUserToSupabase(user: User, password: string, accountStatus: 'active' | 'placeholder' = 'active'): Promise<boolean> {
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
    account_status: accountStatus,
  };
  
  console.log('[Supabase Register] User data:', JSON.stringify(userData, null, 2));
  
  try {
    // First check if user already exists (use maybeSingle to avoid 406 error)
    const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
    
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

// Update password hash in Supabase (for cross-device login after password change)
export async function updatePasswordInSupabase(email: string, newPassword: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  const emailLower = email.toLowerCase().trim();
  const newHash = simpleHash(newPassword);
  
  try {
    const { error } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('email', emailLower);
    
    if (error) {
      console.error('[Supabase] ❌ Password update failed:', error.message);
      return false;
    }
    
    console.log('[Supabase] ✅ Password updated for:', emailLower);
    return true;
  } catch (e: any) {
    console.error('[Supabase] ❌ Password update exception:', e?.message);
    return false;
  }
}

// Login user from Supabase (cross-device)
export async function loginFromSupabase(email: string, password: string): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase Login] Not configured');
    return null;
  }
  
  const emailLower = email.toLowerCase().trim();
  const passwordHash = simpleHash(password);
  
  console.log('[Supabase Login] Attempting login for:', emailLower);
  
  try {
    // First check if user exists by email only (to debug password issues)
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('email', emailLower)
      .maybeSingle();
    
    if (!userByEmail) {
      console.log('[Supabase Login] ❌ No user found with email:', emailLower);
      return null;
    }
    
    console.log('[Supabase Login] Found user, hashes match:', userByEmail.password_hash === passwordHash);
    
    if (userByEmail.password_hash !== passwordHash) {
      console.log('[Supabase Login] ❌ Password mismatch');
      return null;
    }
    
    // Now get full user data
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userByEmail.id)
      .maybeSingle();
    
    if (error || !data) {
      console.log('[Supabase Login] ❌ Error fetching user data:', error?.message);
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

// Fetch all real users from Supabase (excludes placeholder/client-file accounts)
export async function fetchAllUsersFromSupabase(): Promise<any[]> {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase] Not configured, returning empty array');
    return [];
  }
  
  try {
    console.log('[Supabase] Fetching all real users...');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .neq('account_status', 'placeholder');
    
    if (error) {
      // Fallback if account_status column doesn't exist yet — filter by email pattern
      if (error.message?.includes('account_status')) {
        console.log('[Supabase] account_status column not found, fetching with email filter');
        const fallback = await supabase.from('users').select('*');
        if (fallback.error) return [];
        const users = (fallback.data || [])
          .filter((u: any) => !u.email?.endsWith('@placeholder.local') && !u.email?.endsWith('@client.apex'))
          .map(mapUserFromSupabase);
        console.log(`[Supabase] Found ${users.length} users (email-filtered fallback)`);
        return users;
      }
      console.error('[Supabase] Error fetching users:', error.message);
      return [];
    }
    
    const users = (data || []).map(mapUserFromSupabase);
    console.log(`[Supabase] Found ${users.length} real users`);
    return users;
  } catch (e) {
    console.error('[Supabase] Exception fetching users:', e);
    return [];
  }
}

// Helper: map a Supabase user row to app format
function mapUserFromSupabase(u: any) {
  return {
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
    bio: u.bio,
    profilePhoto: u.avatar_url || u.profile_photo,
    trainerSpecializations: u.trainer_specializations,
    accountStatus: u.account_status || 'active',
  };
}

// Get all valid user IDs from Supabase (to detect deleted accounts)
export async function getValidUserIdsFromSupabase(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) {
    return new Set();
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id');
    
    if (error) {
      console.error('[Supabase] Error fetching user IDs:', error.message);
      return new Set();
    }
    
    const ids = new Set((data || []).map(u => u.id));
    console.log(`[Supabase] Found ${ids.size} valid user IDs`);
    return ids;
  } catch (e) {
    console.error('[Supabase] Exception fetching user IDs:', e);
    return new Set();
  }
}

// Clean up clients that no longer exist in Supabase
export async function cleanupDeletedClients(
  currentClients: Array<{ clientId: string }>,
  removeClient: (clientId: string) => void
): Promise<number> {
  const validIds = await getValidUserIdsFromSupabase();
  
  if (validIds.size === 0) {
    console.log('[Supabase] No valid IDs found, skipping cleanup');
    return 0;
  }

  // Also check trainer_clients table — placeholder clients exist there but not in users
  let trainerClientIds = new Set<string>();
  try {
    const trainerId = (await import('./store')).useAuthStore.getState().user?.id;
    if (trainerId) {
      const { data } = await supabase
        .from('trainer_clients')
        .select('client_id')
        .eq('trainer_id', trainerId);
      if (data) {
        trainerClientIds = new Set(data.map(r => r.client_id));
      }
    }
  } catch (e) {
    console.warn('[Supabase] Could not fetch trainer_clients for cleanup check:', e);
  }
  
  let removedCount = 0;
  for (const client of currentClients) {
    // Only remove if client is in NEITHER users table NOR trainer_clients table
    if (!validIds.has(client.clientId) && !trainerClientIds.has(client.clientId)) {
      console.log(`[Supabase] Removing deleted client: ${client.clientId}`);
      removeClient(client.clientId);
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    console.log(`[Supabase] Removed ${removedCount} deleted clients`);
  }
  
  return removedCount;
}

// Check if email exists in Supabase
export async function checkEmailExistsInSupabase(email: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
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
    if (updates.gender) dbUpdates.gender = updates.gender;
    if (updates.height) dbUpdates.height = updates.height;
    if (updates.weight) dbUpdates.weight = updates.weight;
    if (updates.isTrainer !== undefined) dbUpdates.is_trainer = updates.isTrainer;
    if (updates.mode) dbUpdates.mode = updates.mode;
    if (updates.preferredUnit) dbUpdates.preferred_unit = updates.preferredUnit;
    if ((updates as any).trainerId !== undefined) dbUpdates.trainer_id = (updates as any).trainerId;
    if ((updates as any).accountStatus) dbUpdates.account_status = (updates as any).accountStatus;
    
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

    const trainers = (data || []).map(mapUserFromSupabase);

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
  const dbWorkout: any = {
    id: workout.id,
    user_id: workout.userId,
    name: workout.name,
    exercises: workout.exercises,  // JSONB - stores full exercise/set data
    start_time: workout.startTime,
    end_time: workout.endTime,
    duration: workout.duration,
    total_volume: workout.totalVolume || 0,
    notes: workout.notes || '',
    status: workout.status || 'completed',
    assigned_by: workout.assignedBy || null,  // Trainer ID for PT sessions
    template_id: workout.templateId || null,
  };
  // Only include deleted_at when set — avoids upsert failure if column doesn't exist yet
  if (workout.deletedAt) {
    dbWorkout.deleted_at = workout.deletedAt;
  }
  // AI-generated summary (nullable — column added in 20260417 migration)
  if (workout.aiSummary !== undefined) {
    dbWorkout.ai_summary = workout.aiSummary || null;
  }
  // PT review flow (columns added in 20260417_add_pt_review_flow_to_workouts.sql)
  if (workout.reviewStatus !== undefined) {
    dbWorkout.review_status = workout.reviewStatus || null;
  }
  if (workout.coachNote !== undefined) {
    dbWorkout.coach_note = workout.coachNote || null;
  }
  if (workout.releasedAt !== undefined) {
    dbWorkout.released_at = workout.releasedAt || null;
  }
  return dbWorkout;
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
    status: dbWorkout.status || 'completed',
    assignedBy: dbWorkout.assigned_by,
    templateId: dbWorkout.template_id,
    deletedAt: dbWorkout.deleted_at || undefined,
    aiSummary: dbWorkout.ai_summary || undefined,
    reviewStatus: dbWorkout.review_status || undefined,
    coachNote: dbWorkout.coach_note || undefined,
    releasedAt: dbWorkout.released_at || undefined,
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
    rarity: medal.rarity,
    earned: medal.earned,
    earned_at: medal.earnedAt,
    progress: medal.progress || 0,
    target: medal.target || 1,
    times_earned: medal.timesEarned || 1,
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
    rarity: dbMedal.rarity || dbMedal.tier, // Use tier as rarity fallback
    earned: dbMedal.earned,
    earnedAt: dbMedal.earned_at,
    progress: dbMedal.progress,
    target: dbMedal.target,
    timesEarned: dbMedal.times_earned || 1,
    evolutionTier: dbMedal.evolution_tier || 'base',
  };
}

// Sync client exercise history to Supabase
export async function syncExerciseHistoryToSupabase(
  userId: string,
  exerciseId: string,
  exerciseName: string,
  blockType: string | null,
  weight?: number,
  reps?: number
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    // First check if record exists
    const { data: existing } = await supabase
      .from('client_exercise_history')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .eq('block_type', blockType || 'general')
      .single();
    
    if (existing) {
      // Update existing record
      const updates: any = {
        times_used: (existing.times_used || 0) + 1,
        last_used: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (weight) {
        updates.last_weight = weight;
        if (!existing.best_weight || weight > existing.best_weight) {
          updates.best_weight = weight;
        }
      }
      if (reps) {
        updates.last_reps = reps;
        if (!existing.best_reps || reps > existing.best_reps) {
          updates.best_reps = reps;
        }
      }
      
      const { error } = await supabase
        .from('client_exercise_history')
        .update(updates)
        .eq('id', existing.id);
      
      if (error) {
        console.error('[ExerciseHistory] Update error:', error);
        return false;
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('client_exercise_history')
        .insert({
          user_id: userId,
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          block_type: blockType || 'general',
          times_used: 1,
          last_used: new Date().toISOString(),
          last_weight: weight,
          last_reps: reps,
          best_weight: weight,
          best_reps: reps,
        });
      
      if (error) {
        console.error('[ExerciseHistory] Insert error:', error);
        return false;
      }
    }
    
    return true;
  } catch (e) {
    console.error('[ExerciseHistory] Exception:', e);
    return false;
  }
}

// Get client exercise history from Supabase
export async function getClientExerciseHistory(
  userId: string,
  blockType?: string
): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    let query = supabase
      .from('client_exercise_history')
      .select('*')
      .eq('user_id', userId)
      .order('times_used', { ascending: false });
    
    if (blockType) {
      query = query.eq('block_type', blockType);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('[ExerciseHistory] Fetch error:', error);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.error('[ExerciseHistory] Exception:', e);
    return [];
  }
}

// Fetch workout history from Supabase for a user (or trainer's clients)
export async function fetchWorkoutHistoryFromSupabase(userId: string, isTrainer: boolean = false): Promise<Workout[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    let query = supabase
      .from('workouts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (isTrainer) {
      // For trainers, fetch workouts where they are the assigned_by (trainer who ran the session)
      query = query.eq('assigned_by', userId);
    } else {
      // For regular users, fetch their own workouts
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[WorkoutHistory Fetch] Error:', error.message);
      return [];
    }
    
    // Map from DB format to app format
    return (data || []).map(w => ({
      id: w.id,
      name: w.name || 'Workout',
      exercises: typeof w.exercises === 'string' ? JSON.parse(w.exercises) : (w.exercises || []),
      startTime: w.start_time || w.created_at,
      endTime: w.end_time || w.created_at,
      duration: w.duration || 0,
      totalVolume: w.total_volume || 0,
      userId: w.user_id,
      assignedBy: w.assigned_by,
      status: w.status || 'completed',
      notes: w.notes,
      templateId: w.template_id,
    }));
  } catch (e) {
    console.error('[WorkoutHistory Fetch] Exception:', e);
    return [];
  }
}

// Fetch workout history for all trainer's clients
export async function fetchClientWorkoutsFromSupabase(trainerId: string): Promise<Workout[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    // First get all client IDs for this trainer
    const { data: clients, error: clientError } = await supabase
      .from('trainer_clients')
      .select('client_id')
      .eq('trainer_id', trainerId);
    
    if (clientError || !clients?.length) {
      console.log('[ClientWorkouts Fetch] No clients found or error:', clientError?.message);
      return [];
    }
    
    const clientIds = clients.map(c => c.client_id);
    
    // Fetch workouts for all clients in chunks to avoid URL length limits
    const { chunkArray } = await import('./userFetchUtils');
    const chunks = chunkArray(clientIds, 25);
    let allData: any[] = [];
    for (const chunk of chunks) {
      const { data: chunkData, error } = await supabase
        .from('workouts')
        .select('*')
        .in('user_id', chunk)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[ClientWorkouts Fetch] Chunk error:', error.message);
        continue; // partial success — skip failed chunk
      }
      if (chunkData) allData = allData.concat(chunkData);
    }
    const data = allData;
    
    // Map from DB format to app format
    return (data || []).map(w => ({
      id: w.id,
      name: w.name || 'Workout',
      exercises: typeof w.exercises === 'string' ? JSON.parse(w.exercises) : (w.exercises || []),
      startTime: w.start_time || w.created_at,
      endTime: w.end_time || w.created_at,
      duration: w.duration || 0,
      totalVolume: w.total_volume || 0,
      userId: w.user_id,
      assignedBy: w.assigned_by,
      status: w.status || 'completed',
      notes: w.notes,
      templateId: w.template_id,
    }));
  } catch (e) {
    console.error('[ClientWorkouts Fetch] Exception:', e);
    return [];
  }
}

// Sync a completed workout to Supabase
export async function syncWorkoutToSupabase(workout: Workout): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('[WorkoutSync] Supabase not configured, skipping sync');
    return false;
  }
  
  try {
    const dbWorkout = toDbWorkout(workout);
    console.log('[WorkoutSync] Syncing workout to Supabase:', {
      id: workout.id,
      userId: workout.userId,
      name: workout.name,
      exerciseCount: workout.exercises?.length || 0,
      duration: workout.duration,
      totalVolume: workout.totalVolume,
    });
    
    const { error, data } = await supabase
      .from('workouts')
      .upsert(dbWorkout)
      .select();
    
    if (error) {
      console.error('[WorkoutSync] ❌ Error syncing workout:', error.message, error.details, error.hint);
      console.error('[WorkoutSync] Workout data that failed:', JSON.stringify(dbWorkout, null, 2));
      return false;
    }
    
    console.log('[WorkoutSync] ✅ Workout synced successfully:', workout.id);
    return true;
  } catch (e) {
    console.error('[WorkoutSync] ❌ Exception:', e);
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

// ============ CLIENT DELETION SYNC ============

// Delete a client relationship from Supabase (removes all associated data)
export async function deleteClientFromSupabase(trainerId: string, clientId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    console.log('[ClientSync] Deleting client relationship:', clientId, 'for trainer:', trainerId);
    
    // Delete in order: packages, sessions, then client relationship
    const [packagesResult, sessionsResult, clientResult] = await Promise.all([
      supabase.from('session_packages').delete().eq('trainer_id', trainerId).eq('client_id', clientId),
      supabase.from('trainer_sessions').delete().eq('trainer_id', trainerId).eq('client_id', clientId),
      supabase.from('trainer_clients').delete().eq('trainer_id', trainerId).eq('client_id', clientId),
    ]);
    
    if (clientResult.error) {
      console.error('[ClientSync] ❌ Error deleting client:', clientResult.error.message);
      return false;
    }
    
    console.log('[ClientSync] ✅ Client and associated data deleted from Supabase');
    return true;
  } catch (e) {
    console.error('[ClientSync] ❌ Exception:', e);
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

// Sync all workouts for a specific client to Supabase
export async function syncClientWorkoutsToSupabase(clientId: string, workouts: Workout[]): Promise<{ success: number; failed: number }> {
  if (!isSupabaseConfigured()) {
    console.log('[SyncClientWorkouts] Supabase not configured');
    return { success: 0, failed: 0 };
  }
  
  const clientWorkouts = workouts.filter(w => w.userId === clientId);
  console.log(`[SyncClientWorkouts] Syncing ${clientWorkouts.length} workouts for client ${clientId}`);
  
  let success = 0;
  let failed = 0;
  
  for (const workout of clientWorkouts) {
    const result = await syncWorkoutToSupabase(workout);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }
  
  console.log(`[SyncClientWorkouts] Complete: ${success} synced, ${failed} failed`);
  return { success, failed };
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
      .maybeSingle();
    
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
      paid_sessions: pkg.paidSessions || 0,
      remaining_sessions: pkg.remainingSessions,
      price_total: pkg.priceTotal,
      price_per_session: pkg.pricePerSession,
      purchase_date: pkg.purchaseDate,
      expiry_date: pkg.expiryDate || null,
      payment_id: pkg.paymentId || null,
      status: pkg.status,
      is_continuous: pkg.isContinuous || false,
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
      paidSessions: p.paid_sessions || 0,
      remainingSessions: p.remaining_sessions,
      priceTotal: p.price_total,
      pricePerSession: p.price_per_session,
      purchaseDate: p.purchase_date,
      expiryDate: p.expiry_date,
      paymentId: p.payment_id,
      status: p.status,
      isContinuous: p.is_continuous || false,
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
  totalSessions?: number;
  totalPaid?: number;
  totalSessionsOffset?: number;
  totalPaidOffset?: number;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('[Client Sync] Supabase not configured');
    return false;
  }
  
  console.log('[Client Sync] 🔄 Syncing trainer-client relationship:', {
    id: client.id,
    trainerId: client.trainerId,
    clientId: client.clientId,
  });
  
  try {
    const dbClient: Record<string, unknown> = {
      id: client.id,
      trainer_id: client.trainerId,
      client_id: client.clientId,
      status: client.status || 'active',
      start_date: client.startDate || new Date().toISOString(),
      onboarding_complete: client.onboardingComplete || false,
      notes: client.notes || null,
      goals: client.goals || null,
    };
    // Include lifetime counters if provided
    if (client.totalSessions !== undefined) dbClient.total_sessions = client.totalSessions;
    if (client.totalPaid !== undefined) dbClient.total_paid = client.totalPaid;
    if (client.totalSessionsOffset !== undefined) dbClient.total_sessions_offset = client.totalSessionsOffset;
    if (client.totalPaidOffset !== undefined) dbClient.total_paid_offset = client.totalPaidOffset;
    
    console.log('[Client Sync] Inserting data:', JSON.stringify(dbClient));
    
    const { data, error, status } = await supabase
      .from('trainer_clients')
      .upsert(dbClient, { onConflict: 'id' })
      .select();
    
    console.log('[Client Sync] Response status:', status);
    
    if (error) {
      console.error('[Client Sync] ❌ Error:', error.message);
      console.error('[Client Sync] Error code:', error.code);
      console.error('[Client Sync] Error details:', error.details);
      console.error('[Client Sync] Error hint:', error.hint);
      return false;
    }
    
    console.log('[Client Sync] ✅ Client synced successfully:', client.clientId);
    console.log('[Client Sync] Returned data:', data);
    return true;
  } catch (e: any) {
    console.error('[Client Sync] ❌ Exception:', e?.message || e);
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
    
    // Fetch display names from users table for all client IDs (chunked to avoid URL length limits)
    const clientIds = (data || []).map(c => c.client_id).filter(Boolean);
    let userMap: Record<string, { displayName?: string; username?: string; profilePhoto?: string }> = {};
    if (clientIds.length > 0) {
      const { fetchUsersByIdsChunked, writeProfileCache } = await import('./userFetchUtils');
      const { usersById, failedIds } = await fetchUsersByIdsChunked(clientIds);
      Object.entries(usersById).forEach(([id, profile]) => {
        userMap[id] = {
          displayName: profile.displayName,
          username: profile.username,
          profilePhoto: profile.profilePhoto,
        };
      });
      // Cache successful results for offline / cross-page use
      writeProfileCache(usersById);
      if (failedIds.length > 0) {
        console.warn(`[Client Fetch] Failed to resolve ${failedIds.length} user profiles`);
      }
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
      totalSessions: c.total_sessions ?? undefined,
      totalPaid: c.total_paid ?? undefined,
      totalSessionsOffset: c.total_sessions_offset ?? undefined,
      totalPaidOffset: c.total_paid_offset ?? undefined,
      // Attach client user info so getClientDisplayInfo finds it
      client: userMap[c.client_id] || undefined,
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
  localStorage.removeItem('apex-workout');
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
    const dbEvent: Record<string, any> = {
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
      recurrence_group: event.recurrenceGroup || null,
      contact_name: event.contactName || null,
      program_id: event.programId || null,
      owner_user_id: event.ownerUserId || null,
      event_scope: event.eventScope || null,
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
      .eq('trainer_id', trainerId)
      .in('event_scope', ['trainer_personal', 'shared_session']);
    
    if (error) {
      // Fallback: if event_scope column filter fails, fetch all and filter in JS
      if (error.message?.includes('event_scope')) {
        console.warn('[Calendar Fetch] event_scope column not found, fetching all');
        const { data: allData } = await supabase.from('calendar_events').select('*').eq('trainer_id', trainerId);
        const filtered = (allData || []).filter(e => e.event_scope !== 'client_assigned');
        return filtered.map(mapCalendarEventFromDB);
      }
      console.error('[Calendar Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(mapCalendarEventFromDB);
  } catch (e) {
    console.error('[Calendar Fetch] Exception:', e);
    return [];
  }
}

function mapCalendarEventFromDB(e: any) {
  return {
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
    recurrenceGroup: e.recurrence_group || undefined,
    contactName: e.contact_name || undefined,
    programId: e.program_id || undefined,
    ownerUserId: e.owner_user_id || undefined,
    eventScope: e.event_scope || undefined,
  };
}

export async function fetchCalendarEventsForUser(clientId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('client_id', clientId);
    
    if (error) {
      console.error('[Calendar Fetch For User] Error:', error.message);
      return [];
    }
    
    return (data || []).map(mapCalendarEventFromDB);
  } catch (e) {
    console.error('[Calendar Fetch For User] Exception:', e);
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

export async function deletePaymentFromSupabase(paymentId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('client_payments').delete().eq('id', paymentId);
    if (error) {
      console.error('[Payment Delete] Error:', error.message);
      return false;
    }
    console.log('[Payment Delete] ✅ Payment deleted from Supabase:', paymentId);
    return true;
  } catch (e) {
    console.error('[Payment Delete] Exception:', e);
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
    // Pack ALL program data into a single JSONB column
    const programData = {
      weeklyPlan: program.weeklyPlan || [],
      templateId: program.templateId || null,
      templateName: program.templateName || null,
      phase: program.phase || null,
      goal: program.goal || null,
      scheduleMode: program.scheduleMode || null,
      trainingDaysPerWeek: program.trainingDaysPerWeek ?? null,
      selectedDays: program.selectedDays || null,
      cycleAcrossWeeks: program.cycleAcrossWeeks || false,
      sessionPTMap: program.sessionPTMap || null,
      nextWorkoutIndex: program.nextWorkoutIndex || 0,
      autoRepeat: program.autoRepeat || false,
      sessionType: program.sessionType || null,
    };
    
    const dbProgram = {
      id: program.id,
      trainer_id: program.trainerId,
      client_id: program.clientId,
      name: program.templateName || program.name || 'Program',
      status: program.status || 'active',
      start_date: program.startDate || null,
      end_date: program.endDate || null,
      program_data: programData,
      created_at: program.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('client_programs')
      .upsert(dbProgram, { onConflict: 'id' })
      .select();
    
    if (error) {
      console.error('[Program Sync] ❌ Error:', error.code, error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.error('[Program Sync] ❌ 0 rows — RLS may be blocking. Disable RLS on client_programs.');
      return false;
    }
    
    console.log('[Program Sync] ✅ Synced:', program.id);
    return true;
  } catch (e) {
    console.error('[Program Sync] ❌ Exception:', e);
    return false;
  }
}

export async function deleteClientProgramFromSupabase(programId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('client_programs').delete().eq('id', programId);
    if (error) {
      console.error('[Program Delete] Error:', error.message);
      return false;
    }
    console.log('[Program Delete] ✅ Deleted program:', programId);
    return true;
  } catch (e) {
    console.error('[Program Delete] Exception:', e);
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
    
    return (data || []).map(mapProgramFromSupabase);
  } catch (e) {
    console.error('[Program Fetch] Exception:', e);
    return [];
  }
}

function mapProgramFromSupabase(p: any) {
  // program_data JSONB holds all program details
  const pd = p.program_data || {};
  return {
    id: p.id,
    clientId: p.client_id,
    trainerId: p.trainer_id,
    templateId: pd.templateId || null,
    templateName: pd.templateName || p.name || null,
    phase: pd.phase || null,
    goal: pd.goal || null,
    weeklyPlan: pd.weeklyPlan || [],
    scheduleMode: pd.scheduleMode || undefined,
    trainingDaysPerWeek: pd.trainingDaysPerWeek ?? undefined,
    selectedDays: pd.selectedDays || undefined,
    cycleAcrossWeeks: pd.cycleAcrossWeeks ?? false,
    sessionPTMap: pd.sessionPTMap || undefined,
    nextWorkoutIndex: pd.nextWorkoutIndex ?? 0,
    autoRepeat: pd.autoRepeat ?? false,
    sessionType: pd.sessionType || undefined,
    startDate: p.start_date,
    endDate: p.end_date,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function fetchClientProgramsForUser(clientId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('client_programs')
      .select('*')
      .eq('client_id', clientId);
    
    if (error) {
      console.error('[Program Fetch For User] Error:', error.message);
      return [];
    }
    
    return (data || []).map(mapProgramFromSupabase);
  } catch (e) {
    console.error('[Program Fetch For User] Exception:', e);
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

// ============ SESSION WORKOUTS SYNC ============

export async function syncSessionWorkoutToSupabase(workout: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    console.log('[Supabase Sync] Syncing session workout blocks:', workout.blocks?.map((b: any) => ({ id: b.id, type: b.type, name: b.name })));
    const dbWorkout = {
      id: workout.id,
      name: workout.name,
      client_id: workout.clientId || null,
      event_id: workout.eventId || null,
      trainer_id: workout.trainerId || null,
      blocks: JSON.stringify(workout.blocks || []),
      created_at: workout.createdAt || new Date().toISOString(),
    };
    
    const { error } = await supabase.from('session_workouts').upsert(dbWorkout, { onConflict: 'id' });
    if (error) {
      console.error('[Session Workout Sync] Error:', error.message);
      return false;
    }
    console.log('[Session Workout Sync] ✅ Workout synced:', workout.id);
    return true;
  } catch (e) {
    console.error('[Session Workout Sync] Exception:', e);
    return false;
  }
}

export async function fetchSessionWorkoutsFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('session_workouts')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Session Workout Fetch] Error:', error.message);
      return [];
    }
    
    const result = (data || []).map(w => {
      const blocks = typeof w.blocks === 'string' ? JSON.parse(w.blocks) : (w.blocks || []);
      console.log('[Supabase Fetch] Session workout blocks loaded:', blocks.map((b: any) => ({ id: b.id, type: b.type, name: b.name })));
      return {
        id: w.id,
        name: w.name,
        clientId: w.client_id,
        eventId: w.event_id,
        trainerId: w.trainer_id,
        blocks,
        createdAt: w.created_at,
      };
    });
    return result;
  } catch (e) {
    console.error('[Session Workout Fetch] Exception:', e);
    return [];
  }
}

export async function deleteSessionWorkoutFromSupabase(workoutId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('session_workouts').delete().eq('id', workoutId);
    if (error) {
      console.error('[Session Workout Delete] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Session Workout Delete] Exception:', e);
    return false;
  }
}

// ============ WORKOUT LIBRARY SYNC ============

export async function syncWorkoutLibraryToSupabase(workout: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbWorkout = {
      id: workout.id,
      name: workout.name,
      description: workout.description || null,
      trainer_id: workout.trainerId || null,
      blocks: JSON.stringify(workout.blocks || []),
      tags: workout.tags || [],
      estimated_minutes: workout.estimatedMinutes || null,
      created_at: workout.createdAt || new Date().toISOString(),
      updated_at: workout.updatedAt || new Date().toISOString(),
    };
    
    const { error } = await supabase.from('workout_library').upsert(dbWorkout, { onConflict: 'id' });
    if (error) {
      console.error('[Workout Library Sync] Error:', error.message);
      return false;
    }
    console.log('[Workout Library Sync] ✅ Workout saved:', workout.id);
    return true;
  } catch (e) {
    console.error('[Workout Library Sync] Exception:', e);
    return false;
  }
}

export async function fetchWorkoutLibraryFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('workout_library')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Workout Library Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      trainerId: w.trainer_id,
      blocks: typeof w.blocks === 'string' ? JSON.parse(w.blocks) : (w.blocks || []),
      tags: w.tags || [],
      estimatedMinutes: w.estimated_minutes,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }));
  } catch (e) {
    console.error('[Workout Library Fetch] Exception:', e);
    return [];
  }
}

export async function deleteWorkoutLibraryFromSupabase(workoutId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('workout_library').delete().eq('id', workoutId);
    if (error) {
      console.error('[Workout Library Delete] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Workout Library Delete] Exception:', e);
    return false;
  }
}

// ============ CIRCUIT LIBRARY SYNC ============

export async function syncCircuitLibraryToSupabase(circuit: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbCircuit = {
      id: circuit.id,
      name: circuit.name,
      description: circuit.description || null,
      trainer_id: circuit.trainerId || null,
      exercises: JSON.stringify(circuit.exercises || []),
      circuit_style: circuit.circuitStyle || 'rounds',
      rounds: circuit.rounds || null,
      duration: circuit.duration || null,
      rest_between_rounds: circuit.restBetweenRounds || null,
      tags: circuit.tags || [],
      created_at: circuit.createdAt || new Date().toISOString(),
    };
    
    const { error } = await supabase.from('circuit_library').upsert(dbCircuit, { onConflict: 'id' });
    if (error) {
      console.error('[Circuit Library Sync] Error:', error.message);
      return false;
    }
    console.log('[Circuit Library Sync] ✅ Circuit saved:', circuit.id);
    return true;
  } catch (e) {
    console.error('[Circuit Library Sync] Exception:', e);
    return false;
  }
}

export async function fetchCircuitLibraryFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('circuit_library')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Circuit Library Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      trainerId: c.trainer_id,
      exercises: typeof c.exercises === 'string' ? JSON.parse(c.exercises) : (c.exercises || []),
      circuitStyle: c.circuit_style || 'rounds',
      rounds: c.rounds,
      duration: c.duration,
      restBetweenRounds: c.rest_between_rounds,
      tags: c.tags || [],
      createdAt: c.created_at,
    }));
  } catch (e) {
    console.error('[Circuit Library Fetch] Exception:', e);
    return [];
  }
}

export async function deleteCircuitLibraryFromSupabase(circuitId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('circuit_library').delete().eq('id', circuitId);
    if (error) {
      console.error('[Circuit Library Delete] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Circuit Library Delete] Exception:', e);
    return false;
  }
}

// ============ CLIENT INVITATIONS ============

// Generate a unique invite token
function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Send client invitation email via Supabase Edge Function
export async function sendClientInvitation(
  trainerId: string,
  clientId: string,
  clientEmail: string,
  trainerName: string,
  clientName: string,
  clientPassword?: string
): Promise<{ success: boolean; inviteToken?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const inviteToken = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Create invitation record in database
    const { error: dbError } = await supabase.from('client_invitations').upsert({
      trainer_id: trainerId,
      client_id: clientId,
      email: clientEmail,
      status: 'pending',
      invite_token: inviteToken,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'invite_token',
    });

    if (dbError) {
      console.error('[Client Invitation] DB Error:', dbError.message);
      return { success: false, error: dbError.message };
    }

    // Call Supabase Edge Function to send email
    const { data, error: fnError } = await supabase.functions.invoke('send-client-invite', {
      body: {
        to: clientEmail,
        clientName,
        trainerName,
        inviteToken,
        appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://catalift.app',
        password: clientPassword || 'client123',
      },
    });

    if (fnError) {
      console.error('[Client Invitation] Function Error:', fnError.message);
      // Update status to failed
      await supabase.from('client_invitations')
        .update({ status: 'failed' })
        .eq('invite_token', inviteToken);
      return { success: false, error: fnError.message };
    }

    // Update invitation status to sent
    await supabase.from('client_invitations')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('invite_token', inviteToken);

    console.log('[Client Invitation] ✅ Invitation sent to:', clientEmail);
    return { success: true, inviteToken };
  } catch (e) {
    console.error('[Client Invitation] Exception:', e);
    return { success: false, error: 'Failed to send invitation' };
  }
}

// Check invitation status by token
export async function checkInvitationByToken(token: string): Promise<{
  valid: boolean;
  trainerId?: string;
  clientId?: string;
  email?: string;
  expired?: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { valid: false };
  }

  try {
    const { data, error } = await supabase
      .from('client_invitations')
      .select('*')
      .eq('invite_token', token)
      .single();

    if (error || !data) {
      return { valid: false };
    }

    const isExpired = new Date(data.expires_at) < new Date();
    if (isExpired) {
      return { valid: false, expired: true };
    }

    return {
      valid: true,
      trainerId: data.trainer_id,
      clientId: data.client_id,
      email: data.email,
    };
  } catch (e) {
    return { valid: false };
  }
}

// Mark invitation as accepted
export async function acceptInvitation(token: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('client_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        client_id: userId,
      })
      .eq('invite_token', token);

    return !error;
  } catch (e) {
    return false;
  }
}

// Get pending invitations for a trainer
export async function getPendingInvitations(trainerId: string): Promise<Array<{
  id: string;
  email: string;
  status: string;
  sentAt?: string;
  clientId?: string;
}>> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('client_invitations')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(inv => ({
      id: inv.id,
      email: inv.email,
      status: inv.status,
      sentAt: inv.sent_at,
      clientId: inv.client_id,
    }));
  } catch (e) {
    return [];
  }
}

// ============================================
// SAVED BLOCKS (BLOCK LIBRARY) SYNC
// ============================================

interface SavedBlockData {
  id: string;
  name: string;
  type: string;
  trainerId: string;
  exercises: any[];
  circuitStyle?: string;
  circuitRounds?: number;
  circuitDuration?: number;
  circuitRestBetween?: number;
  folder?: string;
  createdAt: string;
  updatedAt: string;
}

// Sync a saved block to Supabase
export async function syncSavedBlockToSupabase(block: SavedBlockData): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase] Not configured, skipping saved block sync');
    return false;
  }

  console.log('[Supabase] Syncing saved block:', block.id, block.name);

  try {
    const dbBlock: Record<string, any> = {
      id: block.id,
      trainer_id: block.trainerId,
      name: block.name,
      block_type: block.type,
      exercises: block.exercises || [],
      circuit_style: block.circuitStyle || null,
      circuit_rounds: block.circuitRounds || null,
      circuit_duration: block.circuitDuration || null,
      circuit_rest_between: block.circuitRestBetween || null,
      folder: block.folder || null,
      created_at: block.createdAt || new Date().toISOString(),
      updated_at: block.updatedAt || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('saved_blocks')
      .upsert(dbBlock, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('[Supabase] Error syncing saved block:', error.message, error.details, error.hint);
      // Retry without optional 'folder' column in case it doesn't exist yet
      if (error.message?.includes('folder') || error.message?.includes('column')) {
        console.log('[Supabase] Retrying block sync without folder column...');
        const { folder, ...dbBlockNoFolder } = dbBlock;
        const { data: retryData, error: retryError } = await supabase
          .from('saved_blocks')
          .upsert(dbBlockNoFolder, { onConflict: 'id' })
          .select();
        if (retryError) {
          console.error('[Supabase] Retry also failed:', retryError.message);
          return false;
        }
        console.log('[Supabase] Block synced (without folder):', block.id, retryData);
        return true;
      }
      return false;
    }

    console.log('[Supabase] Saved block synced successfully:', block.id, data);
    return true;
  } catch (e) {
    console.error('[Supabase] Exception syncing saved block:', e);
    return false;
  }
}

// Fetch all saved blocks for a trainer from Supabase
export async function fetchSavedBlocksFromSupabase(trainerId: string): Promise<SavedBlockData[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('saved_blocks')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('[Supabase] Error fetching saved blocks:', error);
      return [];
    }

    console.log('[Supabase] Raw saved blocks from DB:', data.map((b: any) => ({ id: b.id, name: b.name, block_type: b.block_type })));
    return data.map(block => ({
      id: block.id,
      name: block.name,
      type: block.block_type || 'work',
      trainerId: block.trainer_id,
      exercises: block.exercises || [],
      circuitStyle: block.circuit_style,
      circuitRounds: block.circuit_rounds,
      circuitDuration: block.circuit_duration,
      circuitRestBetween: block.circuit_rest_between,
      folder: block.folder || undefined,
      createdAt: block.created_at,
      updatedAt: block.updated_at,
    }));
  } catch (e) {
    console.error('[Supabase] Error fetching saved blocks:', e);
    return [];
  }
}

// Delete a saved block from Supabase
export async function deleteSavedBlockFromSupabase(blockId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from('saved_blocks')
      .delete()
      .eq('id', blockId);

    if (error) {
      console.error('[Supabase] Error deleting saved block:', error);
      return false;
    }

    console.log('[Supabase] Saved block deleted:', blockId);
    return true;
  } catch (e) {
    console.error('[Supabase] Error deleting saved block:', e);
    return false;
  }
}

// ============================================
// BLOCK PERFORMANCE SYNC FUNCTIONS
// ============================================

export interface BlockPerformanceData {
  id: string;
  blockId: string;
  blockName: string;
  blockType: string;
  clientId: string;
  trainerId: string;
  workoutId: string;
  completionTime?: number;
  roundsCompleted?: number;
  roundTimes?: number[];
  intervalTimes?: number[];
  difficultyRating?: string | null;
  cardioMode?: string;
  cardioActivity?: string;
  distance?: number;
  avgPace?: number;
  caloriesBurned?: number;
  totalVolume?: number;
  exerciseStats?: any[];
  performedAt: string;
  notes?: string;
}

// Sync a block performance to Supabase
export async function syncBlockPerformanceToSupabase(performance: BlockPerformanceData): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase] Not configured, skipping block performance sync');
    return false;
  }

  console.log('[Supabase] Syncing block performance:', performance.id, performance.blockName);

  try {
    const dbPerformance = {
      id: performance.id,
      block_id: performance.blockId || null,
      block_name: performance.blockName,
      client_id: performance.clientId,
      trainer_id: performance.trainerId,
      workout_id: performance.workoutId || null,
      exercises: performance.exerciseStats || [],
      total_volume: performance.totalVolume || null,
      duration_seconds: performance.completionTime || null,
      notes: performance.notes || null,
      performed_at: performance.performedAt,
      created_at: performance.performedAt,
    };

    const { data, error } = await supabase
      .from('block_performances')
      .upsert(dbPerformance, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('[Supabase] Error syncing block performance:', error.message, error.details, error.hint);
      return false;
    }

    console.log('[Supabase] Block performance synced successfully:', performance.id, data);
    return true;
  } catch (e) {
    console.error('[Supabase] Exception syncing block performance:', e);
    return false;
  }
}

// Fetch all block performances for a trainer's clients
export async function fetchBlockPerformancesFromSupabase(trainerId: string): Promise<BlockPerformanceData[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('block_performances')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('performed_at', { ascending: false });

    if (error || !data) {
      console.error('[Supabase] Error fetching block performances:', error);
      return [];
    }

    return data.map(p => ({
      id: p.id,
      blockId: p.block_id,
      blockName: p.block_name,
      blockType: 'circuit', // Default, not stored in DB currently
      clientId: p.client_id,
      trainerId: p.trainer_id,
      workoutId: p.workout_id,
      completionTime: p.duration_seconds,
      totalVolume: p.total_volume,
      exerciseStats: p.exercises,
      performedAt: p.performed_at,
      notes: p.notes,
    }));
  } catch (e) {
    console.error('[Supabase] Error fetching block performances:', e);
    return [];
  }
}

// Fetch block performances for a specific client
export async function fetchClientBlockPerformances(clientId: string): Promise<BlockPerformanceData[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('block_performances')
      .select('*')
      .eq('client_id', clientId)
      .order('performed_at', { ascending: false });

    if (error || !data) {
      console.error('[Supabase] Error fetching client block performances:', error);
      return [];
    }

    return data.map(p => ({
      id: p.id,
      blockId: p.block_id,
      blockName: p.block_name,
      blockType: 'circuit',
      clientId: p.client_id,
      trainerId: p.trainer_id,
      workoutId: p.workout_id,
      completionTime: p.duration_seconds,
      totalVolume: p.total_volume,
      exerciseStats: p.exercises,
      performedAt: p.performed_at,
      notes: p.notes,
    }));
  } catch (e) {
    console.error('[Supabase] Error fetching client block performances:', e);
    return [];
  }
}

// ============ CLIENT PROGRAMMING PROFILES SYNC ============

export async function syncClientProfileToSupabase(profile: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbProfile = {
      id: profile.id,
      client_id: profile.clientId,
      trainer_id: profile.trainerId,
      primary_goal: profile.primaryGoal,
      secondary_goal: profile.secondaryGoal || null,
      custom_goal_text: profile.customGoalText || null,
      training_preference: profile.trainingPreference,
      experience_level: profile.experienceLevel,
      injury_flags: JSON.stringify(profile.injuryFlags || []),
      injury_notes: profile.injuryNotes || null,
      days_per_week: profile.daysPerWeek,
      available_days: JSON.stringify(profile.availableDays || []),
      schedule_notes: profile.scheduleNotes || null,
      session_length: profile.sessionLength,
      train_alone_outside_pt: profile.trainAloneOutsidePT,
      movement_confidence: JSON.stringify(profile.movementConfidence || {}),
      wants_classes: profile.wantsClasses,
      class_ready: profile.classReady,
      sleep_quality: profile.sleepQuality,
      stress_level: profile.stressLevel,
      job_activity: profile.jobActivity,
      current_phase: profile.currentPhase,
      progression_plan: profile.progressionPlan ? JSON.stringify(profile.progressionPlan) : null,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt || new Date().toISOString(),
    };
    
    const { error } = await supabase.from('client_profiles').upsert(dbProfile, { onConflict: 'id' });
    if (error) {
      console.error('[Profile Sync] Error:', error.message);
      return false;
    }
    console.log('[Profile Sync] ✅ Profile synced:', profile.clientId);
    return true;
  } catch (e) {
    console.error('[Profile Sync] Exception:', e);
    return false;
  }
}

export async function fetchClientProfilesFromSupabase(trainerId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('trainer_id', trainerId);
    
    if (error) {
      console.error('[Profile Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(p => ({
      id: p.id,
      clientId: p.client_id,
      trainerId: p.trainer_id,
      primaryGoal: p.primary_goal,
      secondaryGoal: p.secondary_goal,
      customGoalText: p.custom_goal_text,
      trainingPreference: p.training_preference,
      experienceLevel: p.experience_level,
      injuryFlags: typeof p.injury_flags === 'string' ? JSON.parse(p.injury_flags) : (p.injury_flags || []),
      injuryNotes: p.injury_notes,
      daysPerWeek: p.days_per_week,
      availableDays: typeof p.available_days === 'string' ? JSON.parse(p.available_days) : (p.available_days || []),
      scheduleNotes: p.schedule_notes,
      sessionLength: p.session_length,
      trainAloneOutsidePT: p.train_alone_outside_pt,
      movementConfidence: typeof p.movement_confidence === 'string' ? JSON.parse(p.movement_confidence) : (p.movement_confidence || {}),
      wantsClasses: p.wants_classes,
      classReady: p.class_ready,
      sleepQuality: p.sleep_quality,
      stressLevel: p.stress_level,
      jobActivity: p.job_activity,
      currentPhase: p.current_phase,
      progressionPlan: p.progression_plan ? (typeof p.progression_plan === 'string' ? JSON.parse(p.progression_plan) : p.progression_plan) : undefined,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  } catch (e) {
    console.error('[Profile Fetch] Exception:', e);
    return [];
  }
}

// ============ WORKOUT TEMPLATES SYNC ============

export async function syncWorkoutTemplateToSupabase(template: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const dbTemplate = {
      id: template.id,
      name: template.name,
      description: template.description || null,
      exercises: JSON.stringify(template.exercises || []),
      blocks: template.blocks ? JSON.stringify(template.blocks) : null,
      created_by: template.createdBy,
      is_public: template.isPublic || false,
      category: template.category || null,
      estimated_duration: template.estimatedDuration || null,
      created_at: template.createdAt,
      updated_at: template.updatedAt || new Date().toISOString(),
    };
    
    const { error } = await supabase.from('workout_templates').upsert(dbTemplate, { onConflict: 'id' });
    if (error) {
      console.error('[Template Sync] Error:', error.message);
      return false;
    }
    console.log('[Template Sync] ✅ Template synced:', template.name);
    return true;
  } catch (e) {
    console.error('[Template Sync] Exception:', e);
    return false;
  }
}

export async function deleteWorkoutTemplateFromSupabase(templateId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('workout_templates').delete().eq('id', templateId);
    if (error) {
      console.error('[Template Delete] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============ NOTIFICATIONS SYNC ============

export async function syncNotificationToSupabase(notification: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const url = notification.actionUrl || notification.link || null;
    const dbNotification: Record<string, any> = {
      id: notification.id,
      user_id: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message || null,
      read: notification.read || false,
      action_url: url,
      created_at: notification.createdAt,
    };
    // Try with link column (new migration); if fails, retry without
    dbNotification.link = url;
    
    let { error } = await supabase.from('notifications').upsert(dbNotification, { onConflict: 'id' });
    if (error && error.message?.includes('link')) {
      // link column doesn't exist yet — retry without it
      delete dbNotification.link;
      const retry = await supabase.from('notifications').upsert(dbNotification, { onConflict: 'id' });
      error = retry.error;
    }
    if (error) {
      console.error('[Notification Sync] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Notification Sync] Exception:', e);
    return false;
  }
}

export async function fetchNotificationsFromSupabase(userId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('[Notification Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(n => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      link: n.link || n.action_url,
      actionUrl: n.action_url || n.link,
      createdAt: n.created_at,
    }));
  } catch (e) {
    console.error('[Notification Fetch] Exception:', e);
    return [];
  }
}

export async function markNotificationReadInSupabase(notificationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    if (error) {
      console.error('[Notification Update] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteNotificationsFromSupabase(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
    if (error) {
      console.error('[Notification Delete] Error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function fetchWorkoutTemplatesFromSupabase(userId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('created_by', userId);
    
    if (error) {
      console.error('[Template Fetch] Error:', error.message);
      return [];
    }
    
    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      exercises: typeof t.exercises === 'string' ? JSON.parse(t.exercises) : (t.exercises || []),
      blocks: t.blocks ? (typeof t.blocks === 'string' ? JSON.parse(t.blocks) : t.blocks) : undefined,
      createdBy: t.created_by,
      isPublic: t.is_public,
      category: t.category,
      estimatedDuration: t.estimated_duration,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));
  } catch (e) {
    console.error('[Template Fetch] Exception:', e);
    return [];
  }
}
