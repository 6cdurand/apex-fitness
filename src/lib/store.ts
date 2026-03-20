import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { 
  syncWorkoutToSupabase, 
  fetchWorkoutHistoryFromSupabase,
  fetchClientWorkoutsFromSupabase,
  syncPBToSupabase, 
  syncMedalToSupabase, 
  registerUserToSupabase, 
  loginFromSupabase, 
  updateUserInSupabase, 
  syncTrainerSessionToSupabase, 
  syncSessionPackageToSupabase, 
  fetchTrainerSessionsFromSupabase, 
  fetchSessionPackagesFromSupabase, 
  syncTrainerClientToSupabase, 
  fetchTrainerClientsFromSupabase,
  // New sync functions for all data types
  syncCalendarEventToSupabase,
  fetchCalendarEventsFromSupabase,
  deleteCalendarEventFromSupabase,
  syncSessionWorkoutToSupabase,
  fetchSessionWorkoutsFromSupabase,
  deleteSessionWorkoutFromSupabase,
  syncWorkoutLibraryToSupabase,
  fetchWorkoutLibraryFromSupabase,
  deleteWorkoutLibraryFromSupabase,
  syncCircuitLibraryToSupabase,
  fetchCircuitLibraryFromSupabase,
  deleteCircuitLibraryFromSupabase,
  syncPaymentToSupabase,
  fetchPaymentsFromSupabase,
  deletePaymentFromSupabase,
  syncClientProgramToSupabase,
  fetchClientProgramsFromSupabase,
  syncBookingRequestToSupabase,
  fetchBookingRequestsFromSupabase,
  deleteTrainerClientFromSupabase,
  deleteClientFromSupabase,
  fetchSavedBlocksFromSupabase,
  fetchBlockPerformancesFromSupabase,
  syncClientProfileToSupabase,
  fetchClientProfilesFromSupabase,
  syncWorkoutTemplateToSupabase,
  deleteWorkoutTemplateFromSupabase,
  fetchWorkoutTemplatesFromSupabase,
  fetchNotificationsFromSupabase,
} from './supabaseSync';
import {
  User,
  UserMode,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
  PersonalBest,
  StrengthRating,
  Medal,
  FeedPost,
  TrainerClient,
  ClientGroup,
  CalendarEvent,
  WeeklyReport,
  Notification,
  TimerState,
  Exercise,
  MuscleGroup,
  ClientSession,
  ClientPayment,
  SessionPackage,
  BookingRequest,
  ClientProgram,
  ClientProgrammingProfile,
  SavedBlock,
  BlockPerformance,
  BlockType,
} from '@/types';
import { calculate1RM, exerciseLibrary, exerciseLibraryMap, getSetVolume, getUserBodyweight } from './exercises';
import { deriveAll, computeVolumeRollup, VolumeRollup } from './deriveAll';

// Simple password hash (pre-Supabase Auth — Phase 1 replaces this entirely)
export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

// ============ AUTH STORE ============
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithSupabaseUser: (supabaseUser: { id: string; email: string; displayName: string; profilePhoto?: string }) => Promise<boolean>;
  register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
  logout: () => void;
  deleteAccount: () => void;
  updateUser: (updates: Partial<User>) => void;
  updatePassword: (email: string, oldPassword: string, newPassword: string) => boolean;
  resetPassword: (email: string, newPassword: string) => boolean;
  switchMode: (mode: UserMode) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        
        console.log('[Auth] Login attempt for:', email);
        
        // First try localStorage (for quick local login)
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        console.log('[Auth] Found', storedUsers.length, 'users in localStorage');
        
        const hashed = hashPassword(password);
        // Repair: fix users with missing/undefined passwords (from Supabase merge stripping them)
        storedUsers.forEach((u: any) => {
          if (!u.password && u.email && !u.isTrainer) {
            u.password = hashPassword('client123');
          }
        });
        localStorage.setItem('apex-users', JSON.stringify(storedUsers));
        
        const localUser = storedUsers.find((u: User & { password: string }) => {
          if (u.email?.toLowerCase() !== email.toLowerCase()) return false;
          // Match hashed or legacy plaintext passwords
          return u.password === hashed || u.password === password;
        });
        // Migrate legacy plaintext password to hash
        if (localUser && localUser.password === password) {
          localUser.password = hashed;
          localStorage.setItem('apex-users', JSON.stringify(storedUsers));
        }
        
        if (localUser) {
          console.log('[Auth] ✅ Found user in localStorage');
          const { password: _, ...userData } = localUser;
          set({ user: userData, isAuthenticated: true, isLoading: false });
          return true;
        }
        
        console.log('[Auth] User not in localStorage, trying Supabase...');
        
        // Try Supabase for cross-device login
        const supabaseUser = await loginFromSupabase(email, password);
        if (supabaseUser) {
          console.log('[Auth] ✅ Found user in Supabase:', supabaseUser.email);
          // Save to localStorage for future local logins
          storedUsers.push({ ...supabaseUser, password: hashPassword(password) });
          localStorage.setItem('apex-users', JSON.stringify(storedUsers));
          set({ user: supabaseUser, isAuthenticated: true, isLoading: false });
          return true;
        }
        
        console.log('[Auth] ❌ Login failed - user not found in localStorage or Supabase');
        set({ isLoading: false });
        return false;
      },

      // Login with Supabase Auth user (from Google OAuth, etc.)
      loginWithSupabaseUser: async (supabaseUser) => {
        set({ isLoading: true });
        
        console.log('[Auth] loginWithSupabaseUser:', supabaseUser.email);
        
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        
        // Check if user already exists locally (by email or id)
        let existingUser = storedUsers.find((u: User) => 
          u.id === supabaseUser.id || u.email?.toLowerCase() === supabaseUser.email.toLowerCase()
        );
        
        if (existingUser) {
          console.log('[Auth] ✅ Found existing user, logging in');
          // Update with latest info from Supabase
          existingUser = {
            ...existingUser,
            id: supabaseUser.id, // Use Supabase ID
            profilePhoto: supabaseUser.profilePhoto || existingUser.profilePhoto,
            displayName: supabaseUser.displayName || existingUser.displayName,
            membershipTier: existingUser.membershipTier || 'pro', // Ensure existing users get Pro
          };
          
          // Update in localStorage
          const updatedUsers = storedUsers.map((u: User) => 
            u.email?.toLowerCase() === supabaseUser.email.toLowerCase() ? existingUser : u
          );
          localStorage.setItem('apex-users', JSON.stringify(updatedUsers));
          
          set({ user: existingUser, isAuthenticated: true, isLoading: false });
          return true;
        }
        
        // Create new user from Supabase auth
        console.log('[Auth] Creating new user from Supabase auth');
        const newUser: User = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          username: supabaseUser.email.split('@')[0],
          displayName: supabaseUser.displayName,
          profilePhoto: supabaseUser.profilePhoto,
          gender: 'other',
          mode: 'user',
          isTrainer: false,
          isVerifiedTrainer: false,
          preferredUnit: 'kg',
          membershipTier: 'pro',
          createdAt: new Date().toISOString(),
          followers: [],
          following: [],
        };
        
        // Save to localStorage (no password needed for OAuth users)
        storedUsers.push({ ...newUser, password: hashPassword(`oauth_${supabaseUser.id}`) });
        localStorage.setItem('apex-users', JSON.stringify(storedUsers));
        
        // Sync to Supabase users table
        try {
          await registerUserToSupabase(newUser, `oauth_${supabaseUser.id}`);
        } catch (e) {
          console.error('[Auth] Supabase sync error:', e);
        }
        
        set({ user: newUser, isAuthenticated: true, isLoading: false });
        return true;
      },

      register: async (userData) => {
        set({ isLoading: true });
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        
        // Check if email exists locally
        if (storedUsers.some((u: User) => u.email === userData.email)) {
          set({ isLoading: false });
          return false;
        }

        const newUser: User = {
          id: userData.id || uuidv4(),
          email: userData.email || '',
          username: userData.username || '',
          displayName: userData.displayName || userData.username || '',
          gender: userData.gender || 'other',
          dateOfBirth: userData.dateOfBirth,
          height: userData.height,
          weight: userData.weight,
          mode: 'user',
          isTrainer: userData.isTrainer || false,
          isVerifiedTrainer: false,
          preferredUnit: userData.preferredUnit || 'kg',
          membershipTier: 'pro',
          createdAt: new Date().toISOString(),
          followers: [],
          following: [],
        };

        // Save to localStorage (hashed password)
        storedUsers.push({ ...newUser, password: hashPassword(userData.password) });
        localStorage.setItem('apex-users', JSON.stringify(storedUsers));
        
        // Sync to Supabase for cross-device login
        try {
          const synced = await registerUserToSupabase(newUser, userData.password);
          console.log('Supabase sync result:', synced);
        } catch (e) {
          console.error('Supabase sync error:', e);
        }
        
        set({ user: newUser, isAuthenticated: true, isLoading: false });
        return true;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      deleteAccount: () => {
        const currentUser = get().user;
        if (!currentUser) return;
        
        // Remove from localStorage
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        const filtered = storedUsers.filter((u: User) => u.id !== currentUser.id);
        localStorage.setItem('apex-users', JSON.stringify(filtered));
        
        // Clear all user data
        localStorage.removeItem('apex-auth');
        localStorage.removeItem('apex-workout');
        localStorage.removeItem('apex-medals');
        localStorage.removeItem('apex-trainer');
        localStorage.removeItem('apex-social');
        localStorage.removeItem('apex-messages');
        
        set({ user: null, isAuthenticated: false });
      },

      updatePassword: (email, oldPassword, newPassword) => {
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        const hashedOld = hashPassword(oldPassword);
        const userIdx = storedUsers.findIndex((u: any) => 
          u.email?.toLowerCase() === email.toLowerCase() && 
          (u.password === hashedOld || u.password === oldPassword)
        );
        if (userIdx === -1) return false;
        storedUsers[userIdx].password = hashPassword(newPassword);
        localStorage.setItem('apex-users', JSON.stringify(storedUsers));
        return true;
      },

      resetPassword: (email, newPassword) => {
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        const userIdx = storedUsers.findIndex((u: any) => 
          u.email?.toLowerCase() === email.toLowerCase()
        );
        if (userIdx === -1) return false;
        storedUsers[userIdx].password = hashPassword(newPassword);
        localStorage.setItem('apex-users', JSON.stringify(storedUsers));
        return true;
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...updates };
          set({ user: updatedUser });
          
          // Update in localStorage
          const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
          const index = storedUsers.findIndex((u: User) => u.id === currentUser.id);
          if (index !== -1) {
            storedUsers[index] = { ...storedUsers[index], ...updates };
            localStorage.setItem('apex-users', JSON.stringify(storedUsers));
          }
          
          // Sync to Supabase
          updateUserInSupabase(currentUser.id, updates);
        }
      },

      switchMode: (mode) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, mode };
          set({ user: updatedUser });
          
          // Persist mode to localStorage users array (isTrainer is a permanent account flag, never change it here)
          const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
          const index = storedUsers.findIndex((u: User) => u.id === currentUser.id);
          if (index !== -1) {
            storedUsers[index] = { ...storedUsers[index], mode };
            localStorage.setItem('apex-users', JSON.stringify(storedUsers));
          }
          
          // Sync mode to Supabase
          updateUserInSupabase(currentUser.id, { mode });
        }
      },
    }),
    {
      name: 'apex-auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Repair: if user is in trainer mode but isTrainer was incorrectly set to false, restore it
        if (state?.user && state.user.mode === 'trainer' && !state.user.isTrainer) {
          console.log('[Auth] Repairing isTrainer flag (was false while mode=trainer)');
          state.updateUser({ isTrainer: true });
        }
      },
    }
  )
);

// ============ WORKOUT STORE ============
interface WorkoutState {
  activeWorkout: Workout | null;
  workoutHistory: Workout[];
  templates: WorkoutTemplate[];
  personalBests: PersonalBest[];
  workoutTimer: TimerState;
  restTimer: TimerState;
  currentClientId: string | null; // Track which client we're training (null = training self)

  // Workout actions
  startWorkout: (name: string, templateId?: string, clientId?: string) => void;
  startWorkoutForClient: (name: string, clientId: string, templateId?: string) => void;
  startFromTemplate: (template: WorkoutTemplate, clientId?: string) => void;
  clearCurrentClient: () => void;
  getActiveUserId: () => string; // Get the ID of who we're currently training
  endWorkout: (notes?: string) => Workout | null;
  updateActiveWorkoutNotes: (notes: string) => void;
  cancelWorkout: () => void;
  
  // Exercise actions
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise: (exerciseId: string, updates: Partial<WorkoutExercise>) => void;
  
  // Set actions
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => void;
  completeSet: (exerciseId: string, setId: string) => void;
  uncompleteSet: (exerciseId: string, setId: string) => void;
  
  // Timer actions
  startWorkoutTimer: () => void;
  pauseWorkoutTimer: () => void;
  resetWorkoutTimer: () => void;
  tickWorkoutTimer: () => void;
  startRestTimer: (seconds: number, exerciseId?: string) => void;
  pauseRestTimer: () => void;
  resetRestTimer: () => void;
  tickRestTimer: () => void;
  adjustRestTimer: (delta: number) => void;

  // Template actions
  saveAsTemplate: (name: string, description?: string) => void;
  saveCompletedWorkoutAsTemplate: (workout: Workout, name?: string) => void;
  deleteTemplate: (templateId: string) => void;
  
  // PB actions
  checkAndUpdatePB: (exerciseId: string, weight: number, reps: number, workoutId: string) => PersonalBest | null;
  getPBForExercise: (exerciseId: string) => PersonalBest | undefined;
  
  // History
  getWorkoutHistory: () => Workout[];
  getWorkoutHistoryForUser: (userId: string) => Workout[];
  getPersonalBestsForUser: (userId: string) => PersonalBest[];
  deleteWorkout: (workoutId: string) => void;
  clearDataForUser: (userId: string) => void;
  
  // Notes
  updateWorkoutNotes: (workoutId: string, notes: string) => void;
  getWorkoutById: (workoutId: string) => Workout | undefined;
  
  // Edit completed workouts
  updateCompletedWorkout: (workoutId: string, updates: Partial<Workout>) => void;
  removeExerciseFromCompletedWorkout: (workoutId: string, exerciseId: string) => void;
  removeSetFromCompletedWorkout: (workoutId: string, exerciseId: string, setId: string) => void;
  
  // Recalculate PBs from workout history
  recalculatePBsForUser: (userId: string) => void;
  
  // deriveAll pipeline — run after workout save/edit/delete
  runDeriveAll: (userId: string, completedWorkout?: Workout | null) => void;
  
  // Last derive result (for post-workout summary)
  lastDeriveResult: { medalsAwarded: string[]; volumeRollup: VolumeRollup | null } | null;
  
  // Volume rollups
  volumeRollups: Record<string, VolumeRollup>;
  
  // Exercise notes (persistent across workouts)
  exerciseNotes: Record<string, string>;  // "userId:exerciseId" -> notes
  getExerciseNotes: (exerciseId: string) => string;
  setExerciseNotes: (exerciseId: string, notes: string) => void;
  
  // Supabase sync for workout history
  loadWorkoutHistoryFromSupabase: (userId: string, isTrainer?: boolean) => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      workoutHistory: [],
      templates: [],
      personalBests: [],
      exerciseNotes: {},
      volumeRollups: {},
      lastDeriveResult: null,
      workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
      restTimer: { isRunning: false, seconds: 0, type: 'rest' },
      currentClientId: null,

      getActiveUserId: () => {
        // Returns the ID of who we're training: client ID if training a client, otherwise logged-in user
        const { currentClientId } = get();
        if (currentClientId) return currentClientId;
        return useAuthStore.getState().user?.id || '';
      },

      startWorkout: (name, templateId, clientId) => {
        // Use clientId if provided (training a client), otherwise use logged-in user's ID
        const loggedInUserId = useAuthStore.getState().user?.id || '';
        const targetUserId = clientId || loggedInUserId;
        
        const workout: Workout = {
          id: uuidv4(),
          templateId,
          name,
          exercises: [],
          startTime: new Date().toISOString(),
          totalVolume: 0,
          userId: targetUserId,
          status: 'active',
          // Mark as PT session if training a client (assignedBy = trainer's ID)
          assignedBy: clientId ? loggedInUserId : undefined,
        };
        set({ 
          activeWorkout: workout,
          workoutTimer: { isRunning: true, seconds: 0, type: 'workout', startTimestamp: Date.now(), accumulatedSeconds: 0 },
          currentClientId: clientId || null,
        });
      },

      startWorkoutForClient: (name, clientId, templateId) => {
        get().startWorkout(name, templateId, clientId);
      },

      clearCurrentClient: () => {
        set({ currentClientId: null });
      },

      startFromTemplate: (template, clientId) => {
        // Use clientId if provided, otherwise use logged-in user's ID
        const loggedInUserId = useAuthStore.getState().user?.id || '';
        const targetUserId = clientId || loggedInUserId;
        const pbs = get().personalBests.filter(p => p.userId === targetUserId);
        const userWorkoutHistory = get().workoutHistory.filter(w => w.userId === targetUserId);

        // Use template blocks if present, otherwise auto-generate a single Strength block
        let blocks = (template as any).blocks;
        if (!blocks || blocks.length === 0) {
          const autoBlockId = `block-${Date.now()}`;
          blocks = [{
            id: autoBlockId,
            type: 'work',
            name: 'Strength',
            exercises: (template.exercises || []).map((ex: any) => ({
              id: ex.id || uuidv4(),
              exerciseId: ex.exerciseId,
              exerciseName: ex.exercise?.name || 'Exercise',
              sets: ex.sets?.length || 3,
              reps: ex.sets?.[0]?.reps?.toString() || '10',
              rest: `${ex.restTimerSeconds || 90}s`,
              repType: 'reps' as const,
              setStyle: 'fixed' as const,
            })),
          }];
        }

        // Build a lookup: exerciseId → block metadata (for tagging exercises with blockId)
        const exerciseBlockMap = new Map<string, { blockId: string; blockName: string; blockType: string }>();
        for (const block of blocks) {
          for (const bex of (block.exercises || [])) {
            exerciseBlockMap.set(bex.exerciseId, {
              blockId: block.id,
              blockName: block.name,
              blockType: block.type === 'work' ? 'strength' : block.type,
            });
          }
        }
        
        // Clone template exercises with previous data and block assignment
        const exercises: WorkoutExercise[] = (template.exercises || []).map((ex: any, exIdx: number) => {
          const pb = pbs.find(p => p.exerciseId === ex.exerciseId);
          
          // Find the most recent workout that contains this exercise
          let lastExerciseData: { weight?: number; reps?: number }[] = [];
          for (const workout of userWorkoutHistory) {
            const matchingEx = workout.exercises?.find((e: any) => e.exerciseId === ex.exerciseId);
            if (matchingEx && matchingEx.sets?.length > 0) {
              lastExerciseData = matchingEx.sets
                .filter((s: any) => s.completed && s.weight && s.reps)
                .map((s: any) => ({ weight: s.weight, reps: s.reps }));
              break;
            }
          }

          // Find which block this exercise belongs to
          const blockMeta = exerciseBlockMap.get(ex.exerciseId) || {
            blockId: blocks[0]?.id || `block-fallback`,
            blockName: blocks[0]?.name || 'Strength',
            blockType: 'strength',
          };
          
          return {
            ...ex,
            id: uuidv4(),
            blockId: blockMeta.blockId,
            blockName: blockMeta.blockName,
            blockType: blockMeta.blockType,
            sets: (ex.sets || []).map((s: any, idx: number) => ({
              ...s,
              id: uuidv4(),
              completed: false,
              previousWeight: lastExerciseData[idx]?.weight || pb?.bestWeight,
              previousReps: lastExerciseData[idx]?.reps || pb?.bestReps,
            })),
          };
        });

        const workout: Workout = {
          id: uuidv4(),
          templateId: template.id,
          name: template.name,
          exercises,
          startTime: new Date().toISOString(),
          totalVolume: 0,
          userId: targetUserId,
          status: 'active',
          assignedBy: clientId ? loggedInUserId : undefined,
          blocks,
        };
        set({ 
          activeWorkout: workout,
          workoutTimer: { isRunning: true, seconds: 0, type: 'workout', startTimestamp: Date.now(), accumulatedSeconds: 0 },
          currentClientId: clientId || null,
        });
      },

      updateActiveWorkoutNotes: (notes: string) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;
        set({ activeWorkout: { ...activeWorkout, notes } });
      },

      endWorkout: (notes?: string) => {
        const { activeWorkout, workoutTimer } = get();
        if (!activeWorkout) return null;

        // Calculate total volume using bodyweight-based formula for assisted exercises
        const targetBW = getUserBodyweight(activeWorkout.userId);
        let totalVolume = 0;
        activeWorkout.exercises.forEach(ex => {
          const { isAssistedExercise } = require('./exercises');
          const exAssisted = isAssistedExercise(ex.exerciseId, ex.exercise?.name);
          ex.sets.forEach(s => {
            if (s.completed && s.reps) {
              totalVolume += getSetVolume(s.weight, s.reps, s.isAssisted || exAssisted, targetBW);
            }
          });
        });

        const completedWorkout: Workout = {
          ...activeWorkout,
          notes: notes || activeWorkout.notes || '',
          endTime: new Date().toISOString(),
          duration: workoutTimer.seconds,
          totalVolume,
          status: 'completed',
        };

        set(state => ({
          activeWorkout: null,
          workoutHistory: [completedWorkout, ...state.workoutHistory],
          workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
          restTimer: { isRunning: false, seconds: 0, type: 'rest' },
          currentClientId: null,
        }));

        // Sync workout to Supabase for cross-device access
        syncWorkoutToSupabase(completedWorkout);

        // Auto-create calendar event + session record for PT workouts
        if (completedWorkout.assignedBy && completedWorkout.userId !== completedWorkout.assignedBy) {
          const trainerId = completedWorkout.assignedBy;
          const clientId = completedWorkout.userId;
          const todayStr = new Date().toISOString().split('T')[0];
          const trainerStore = useTrainerStore.getState();
          
          // Check if a session already exists for this client today to avoid duplicates
          const existingSession = trainerStore.sessions.find(
            s => s.clientId === clientId && s.date === todayStr && s.status !== 'cancelled'
          );
          
          if (!existingSession) {
            // Create a new completed session record
            trainerStore.addSession({
              clientId,
              trainerId,
              date: todayStr,
              startTime: new Date(completedWorkout.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
              endTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
              duration: Math.round((workoutTimer.seconds || 0) / 60),
              type: 'pt_session',
              status: 'completed',
              notes: completedWorkout.name,
              workoutId: completedWorkout.id,
              paid: false,
            });
            
            // Also create a calendar event for the day
            trainerStore.addCalendarEvent({
              title: completedWorkout.name,
              type: 'session',
              date: todayStr,
              clientId,
              status: 'completed',
              notes: `Completed PT session`,
            });
          } else {
            // Mark the existing session as completed
            trainerStore.markSessionComplete(existingSession.id, completedWorkout.name);
          }
        }

        // deriveAll pipeline: recompute PBs, medals, ratings, volume rollups
        const workoutUserId = completedWorkout.userId;
        setTimeout(() => {
          get().runDeriveAll(workoutUserId, completedWorkout);
        }, 100);

        return completedWorkout;
      },

      cancelWorkout: () => {
        set({
          activeWorkout: null,
          workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
          restTimer: { isRunning: false, seconds: 0, type: 'rest' },
          currentClientId: null,
          lastDeriveResult: null,
        });
      },

      addExercise: (exercise) => {
        const { activeWorkout, personalBests, workoutHistory, getActiveUserId } = get();
        if (!activeWorkout) return;

        const targetUserId = getActiveUserId();
        const pb = personalBests.find(p => p.exerciseId === exercise.id && p.userId === targetUserId);
        
        // Find last workout data for this exercise
        const userWorkoutHistory = workoutHistory.filter(w => w.userId === targetUserId);
        let lastSetData: { weight?: number; reps?: number; duration?: number } | undefined;
        for (const workout of userWorkoutHistory) {
          const matchingEx = workout.exercises?.find(e => e.exerciseId === exercise.id);
          if (matchingEx && matchingEx.sets?.length > 0) {
            const completedSet = matchingEx.sets.find(s => s.completed && (s.weight || s.duration));
            if (completedSet) {
              lastSetData = { weight: completedSet.weight, reps: completedSet.reps, duration: completedSet.duration };
              break;
            }
          }
        }
        
        // Extract block metadata if present
        const { blockId, blockName, blockType, ...exerciseData } = exercise as any;
        
        // Auto-detect assisted exercises by name
        const { isAssistedExercise } = require('./exercises');
        const exerciseName = exercise.name || (exerciseData as any)?.name || '';
        const autoAssisted = isAssistedExercise(exercise.id, exerciseName);
        
        // Check if this is a stretching exercise - default to timed with 2 rounds
        const isStretching = exercise.category === 'stretching';
        const defaultDuration = 30; // 30 seconds per stretch
        
        const sets = isStretching 
          ? [
              { id: uuidv4(), setNumber: 1, type: 'normal' as const, completed: false, duration: lastSetData?.duration || defaultDuration, isTimed: true },
              { id: uuidv4(), setNumber: 2, type: 'normal' as const, completed: false, duration: lastSetData?.duration || defaultDuration, isTimed: true },
            ]
          : [{
              id: uuidv4(),
              setNumber: 1,
              type: 'normal' as const,
              completed: false,
              previousWeight: lastSetData?.weight || pb?.bestWeight,
              previousReps: lastSetData?.reps || pb?.bestReps,
              ...(autoAssisted && { isAssisted: true }),
            }];
        
        const workoutExercise: WorkoutExercise = {
          id: uuidv4(),
          exerciseId: exercise.id,
          exercise: exerciseData.name ? exerciseData : exercise,
          sets,
          restTimerSeconds: isStretching ? 10 : 90, // Short rest for stretches
          // Preserve block metadata
          ...(blockId && { blockId }),
          ...(blockName && { blockName }),
          ...(blockType && { blockType }),
        } as any;

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: [...activeWorkout.exercises, workoutExercise],
          },
        });
      },

      removeExercise: (exerciseId) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: activeWorkout.exercises.filter(e => e.id !== exerciseId),
          },
        });
      },

      updateExercise: (exerciseId, updates) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: activeWorkout.exercises.map(e =>
              e.id === exerciseId ? { ...e, ...updates } : e
            ),
          },
        });
      },

      addSet: (exerciseId) => {
        const { activeWorkout, personalBests, workoutHistory, getActiveUserId } = get();
        if (!activeWorkout) return;

        const exercise = activeWorkout.exercises.find(e => e.id === exerciseId);
        if (!exercise) return;

        const targetUserId = getActiveUserId();
        const pb = personalBests.find(p => p.exerciseId === exercise.exerciseId && p.userId === targetUserId);
        const lastSet = exercise.sets[exercise.sets.length - 1];
        const newSetIndex = exercise.sets.length;
        
        // Find last workout data for this exercise at this set index
        const userWorkoutHistory = workoutHistory.filter(w => w.userId === targetUserId);
        let lastSetData: { weight?: number; reps?: number } | undefined;
        for (const workout of userWorkoutHistory) {
          const matchingEx = workout.exercises?.find(e => e.exerciseId === exercise.exerciseId);
          if (matchingEx && matchingEx.sets?.length > newSetIndex) {
            const historicalSet = matchingEx.sets[newSetIndex];
            if (historicalSet?.completed && historicalSet.weight && historicalSet.reps) {
              lastSetData = { weight: historicalSet.weight, reps: historicalSet.reps };
              break;
            }
          }
        }

        // Auto-detect assisted exercises by name
        const { isAssistedExercise } = require('./exercises');
        const exerciseName = exercise.exercise?.name || '';
        const autoAssisted = isAssistedExercise(exercise.exerciseId, exerciseName) || lastSet?.isAssisted;

        const newSet: WorkoutSet = {
          id: uuidv4(),
          setNumber: exercise.sets.length + 1,
          type: 'normal',
          weight: lastSet?.weight,
          reps: lastSet?.reps,
          completed: false,
          previousWeight: lastSetData?.weight || pb?.bestWeight,
          previousReps: lastSetData?.reps || pb?.bestReps,
          ...(autoAssisted && { isAssisted: true }),
        };

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: activeWorkout.exercises.map(e =>
              e.id === exerciseId
                ? { ...e, sets: [...e.sets, newSet] }
                : e
            ),
          },
        });
      },

      removeSet: (exerciseId, setId) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: activeWorkout.exercises.map(e =>
              e.id === exerciseId
                ? {
                    ...e,
                    sets: e.sets
                      .filter(s => s.id !== setId)
                      .map((s, idx) => ({ ...s, setNumber: idx + 1 })),
                  }
                : e
            ),
          },
        });
      },

      updateSet: (exerciseId, setId, updates) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: activeWorkout.exercises.map(e =>
              e.id === exerciseId
                ? {
                    ...e,
                    sets: e.sets.map(s =>
                      s.id === setId ? { ...s, ...updates } : s
                    ),
                  }
                : e
            ),
          },
        });
      },

      completeSet: (exerciseId, setId) => {
        const { activeWorkout, checkAndUpdatePB } = get();
        if (!activeWorkout) return;

        const exercise = activeWorkout.exercises.find(e => e.id === exerciseId);
        const setData = exercise?.sets.find(s => s.id === setId);
        
        if (setData?.weight && setData?.reps) {
          checkAndUpdatePB(exercise!.exerciseId, setData.weight, setData.reps, activeWorkout.id);
        }

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: activeWorkout.exercises.map(e =>
              e.id === exerciseId
                ? {
                    ...e,
                    sets: e.sets.map(s =>
                      s.id === setId ? { ...s, completed: true } : s
                    ),
                  }
                : e
            ),
          },
        });

        // Rest timer is started by the UI component based on user settings
      },

      uncompleteSet: (exerciseId, setId) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        set({
          activeWorkout: {
            ...activeWorkout,
            exercises: activeWorkout.exercises.map(e =>
              e.id === exerciseId
                ? {
                    ...e,
                    sets: e.sets.map(s =>
                      s.id === setId ? { ...s, completed: false } : s
                    ),
                  }
                : e
            ),
          },
        });
      },

      startWorkoutTimer: () => {
        set(state => ({
          workoutTimer: { 
            ...state.workoutTimer, 
            isRunning: true,
            startTimestamp: Date.now(),
            accumulatedSeconds: state.workoutTimer.seconds,
          },
        }));
      },

      pauseWorkoutTimer: () => {
        // When pausing, calculate current elapsed time and store it
        const state = get();
        const elapsed = state.workoutTimer.startTimestamp 
          ? Math.floor((Date.now() - state.workoutTimer.startTimestamp) / 1000)
          : 0;
        const totalSeconds = (state.workoutTimer.accumulatedSeconds || 0) + elapsed;
        
        set({
          workoutTimer: { 
            ...state.workoutTimer, 
            isRunning: false,
            seconds: totalSeconds,
            startTimestamp: undefined,
            accumulatedSeconds: totalSeconds,
          },
        });
      },

      resetWorkoutTimer: () => {
        set({
          workoutTimer: { isRunning: false, seconds: 0, type: 'workout', startTimestamp: undefined, accumulatedSeconds: 0 },
        });
      },

      tickWorkoutTimer: () => {
        // Calculate elapsed time from timestamp (handles background/sleep correctly)
        const state = get();
        if (!state.workoutTimer.isRunning || !state.workoutTimer.startTimestamp) {
          return;
        }
        
        const elapsed = Math.floor((Date.now() - state.workoutTimer.startTimestamp) / 1000);
        const totalSeconds = (state.workoutTimer.accumulatedSeconds || 0) + elapsed;
        
        set({
          workoutTimer: {
            ...state.workoutTimer,
            seconds: totalSeconds,
          },
        });
      },

      startRestTimer: (seconds, exerciseId) => {
        set({
          restTimer: { isRunning: true, seconds, type: 'rest', exerciseId },
        });
      },

      pauseRestTimer: () => {
        set(state => ({
          restTimer: { ...state.restTimer, isRunning: false },
        }));
      },

      resetRestTimer: () => {
        set({
          restTimer: { isRunning: false, seconds: 0, type: 'rest' },
        });
      },

      adjustRestTimer: (delta: number) => {
        const { restTimer } = get();
        const newSeconds = Math.max(0, restTimer.seconds + delta);
        if (newSeconds === 0) {
          set({
            restTimer: { isRunning: false, seconds: 0, type: 'rest' },
          });
        } else {
          set({
            restTimer: { ...restTimer, seconds: newSeconds },
          });
        }
      },

      tickRestTimer: () => {
        const { restTimer } = get();
        if (restTimer.seconds <= 1) {
          set({
            restTimer: { isRunning: false, seconds: 0, type: 'rest' },
          });
        } else {
          set({
            restTimer: { ...restTimer, seconds: restTimer.seconds - 1 },
          });
        }
      },

      saveAsTemplate: (name, description) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        const userId = useAuthStore.getState().user?.id || '';
        
        const template: WorkoutTemplate = {
          id: uuidv4(),
          name,
          description,
          exercises: activeWorkout.exercises,
          createdBy: userId,
          isPublic: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set(state => ({
          templates: [...state.templates, template],
        }));
        syncWorkoutTemplateToSupabase(template);
      },

      saveCompletedWorkoutAsTemplate: (workout, name) => {
        const userId = useAuthStore.getState().user?.id || '';
        const template: WorkoutTemplate = {
          id: uuidv4(),
          name: name || workout.name,
          description: `Saved from ${new Date(workout.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} session`,
          exercises: JSON.parse(JSON.stringify(workout.exercises)),
          createdBy: userId,
          isPublic: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(state => ({
          templates: [...state.templates, template],
        }));
        syncWorkoutTemplateToSupabase(template);
      },

      deleteTemplate: (templateId) => {
        set(state => ({
          templates: state.templates.filter(t => t.id !== templateId),
        }));
        deleteWorkoutTemplateFromSupabase(templateId);
      },

      checkAndUpdatePB: (exerciseId, weight, reps, workoutId) => {
        const { personalBests, getActiveUserId } = get();
        const targetUserId = getActiveUserId();
        
        // Normalize exercise ID for consistent matching
        const { normalizeExerciseId } = require('./exerciseStats');
        const normalizedId = normalizeExerciseId(exerciseId);
        
        // Check if this is an assisted exercise (lower weight = better)
        const { isAssistedExercise } = require('./exercises');
        const isAssisted = isAssistedExercise(normalizedId, exerciseId);
        
        const existingPB = personalBests.find(p => p.exerciseId === normalizedId && p.userId === targetUserId);
        
        // calculate1RM returns null if reps > 20 (doesn't count toward strength rating)
        const calculatedRM = calculate1RM(weight, reps);
        // Assisted: (bodyweight - assistedWeight) × reps, fallback reps×1
        const userBW = getUserBodyweight(targetUserId);
        const volume = getSetVolume(weight, reps, isAssisted, userBW);

        // Skip PB update if reps > 20 (null 1RM)
        if (calculatedRM === null) {
          return existingPB || null;
        }

        // For assisted exercises: lower weight = better (less assistance needed)
        // For normal exercises: higher 1RM = better
        const isBetter = isAssisted
          ? (!existingPB || weight < existingPB.bestWeight)
          : (!existingPB || calculatedRM > existingPB.oneRepMax);

        if (isBetter) {
          const newPB: PersonalBest = {
            id: existingPB?.id || uuidv4(),
            exerciseId: normalizedId, // Use normalized ID
            userId: targetUserId,
            oneRepMax: isAssisted ? weight : calculatedRM, // For assisted, store weight directly (not 1RM)
            bestWeight: weight,
            bestReps: reps,
            bestVolume: Math.max(volume, existingPB?.bestVolume || 0),
            achievedAt: new Date().toISOString(),
            workoutId,
          };

          set(state => ({
            personalBests: existingPB
              ? state.personalBests.map(p => p.id === existingPB.id ? newPB : p)
              : [...state.personalBests, newPB],
          }));

          // Sync PB to Supabase
          syncPBToSupabase(newPB);

          // Check PB medals and update strength rating (cascade)
          // Use targetUserId to attribute medals to correct user (client vs trainer)
          setTimeout(() => {
            const userPBs = get().personalBests.filter(pb => pb.userId === targetUserId);
            const pbCount = userPBs.length;
            const { earnMedal, hasMedal, calculateStrengthRatingForUser } = useMedalStore.getState();
            
            if (pbCount >= 25) {
              if (!hasMedal('pr-collector', targetUserId)) earnMedal('pr-collector', targetUserId);
              if (!hasMedal('pr-hunter', targetUserId)) earnMedal('pr-hunter', targetUserId);
              if (!hasMedal('first-pr', targetUserId)) earnMedal('first-pr', targetUserId);
            } else if (pbCount >= 10) {
              if (!hasMedal('pr-hunter', targetUserId)) earnMedal('pr-hunter', targetUserId);
              if (!hasMedal('first-pr', targetUserId)) earnMedal('first-pr', targetUserId);
            } else if (pbCount >= 1) {
              if (!hasMedal('first-pr', targetUserId)) earnMedal('first-pr', targetUserId);
            }
            
            // Check exercise-specific milestone medals based on ACTUAL weight lifted (not 1RM)
            const actualWeight = weight; // Use the actual weight lifted, not calculated 1RM
            
            // BENCH PRESS milestones (using actual weight) - use normalizedId for matching
            if (normalizedId === 'bench-press' || normalizedId === 'dumbbell-bench-press') {
              if (actualWeight >= 160 && !hasMedal('bench-legendary', targetUserId)) earnMedal('bench-legendary', targetUserId);
              if (actualWeight >= 130 && !hasMedal('bench-epic', targetUserId)) earnMedal('bench-epic', targetUserId);
              if (actualWeight >= 100 && !hasMedal('bench-rare', targetUserId)) earnMedal('bench-rare', targetUserId);
              if (actualWeight >= 70 && !hasMedal('bench-uncommon', targetUserId)) earnMedal('bench-uncommon', targetUserId);
              if (actualWeight >= 50 && !hasMedal('bench-common', targetUserId)) earnMedal('bench-common', targetUserId);
            }
            
            // SQUAT milestones
            if (normalizedId === 'squat' || normalizedId === 'back-squat') {
              if (actualWeight >= 219 && !hasMedal('squat-legendary', targetUserId)) earnMedal('squat-legendary', targetUserId);
              if (actualWeight >= 173 && !hasMedal('squat-epic', targetUserId)) earnMedal('squat-epic', targetUserId);
              if (actualWeight >= 130 && !hasMedal('squat-rare', targetUserId)) earnMedal('squat-rare', targetUserId);
              if (actualWeight >= 93 && !hasMedal('squat-uncommon', targetUserId)) earnMedal('squat-uncommon', targetUserId);
              if (actualWeight >= 64 && !hasMedal('squat-common', targetUserId)) earnMedal('squat-common', targetUserId);
            }
            
            // DEADLIFT/RDL milestones
            if (normalizedId === 'deadlift' || normalizedId === 'romanian-deadlift' || normalizedId === 'rdl') {
              if (actualWeight >= 211 && !hasMedal('deadlift-legendary', targetUserId)) earnMedal('deadlift-legendary', targetUserId);
              if (actualWeight >= 164 && !hasMedal('deadlift-epic', targetUserId)) earnMedal('deadlift-epic', targetUserId);
              if (actualWeight >= 120 && !hasMedal('deadlift-rare', targetUserId)) earnMedal('deadlift-rare', targetUserId);
              if (actualWeight >= 84 && !hasMedal('deadlift-uncommon', targetUserId)) earnMedal('deadlift-uncommon', targetUserId);
              if (actualWeight >= 55 && !hasMedal('deadlift-common', targetUserId)) earnMedal('deadlift-common', targetUserId);
            }
            
            // LAT PULLDOWN milestones
            if (normalizedId === 'lat-pulldown' || normalizedId === 'rope-pulldown') {
              if (actualWeight >= 141 && !hasMedal('lat-legendary', targetUserId)) earnMedal('lat-legendary', targetUserId);
              if (actualWeight >= 110 && !hasMedal('lat-epic', targetUserId)) earnMedal('lat-epic', targetUserId);
              if (actualWeight >= 82 && !hasMedal('lat-rare', targetUserId)) earnMedal('lat-rare', targetUserId);
              if (actualWeight >= 58 && !hasMedal('lat-uncommon', targetUserId)) earnMedal('lat-uncommon', targetUserId);
              if (actualWeight >= 38 && !hasMedal('lat-common', targetUserId)) earnMedal('lat-common', targetUserId);
            }
            
            // ROW milestones
            if (normalizedId === 'barbell-row' || normalizedId === 'bent-over-row' || normalizedId === 'seated-row' || normalizedId === 'cable-row' || normalizedId === 'seated-cable-row' || normalizedId === 'machine-back-row' || normalizedId === 'row-machine') {
              if (actualWeight >= 147 && !hasMedal('row-legendary', targetUserId)) earnMedal('row-legendary', targetUserId);
              if (actualWeight >= 115 && !hasMedal('row-epic', targetUserId)) earnMedal('row-epic', targetUserId);
              if (actualWeight >= 86 && !hasMedal('row-rare', targetUserId)) earnMedal('row-rare', targetUserId);
              if (actualWeight >= 61 && !hasMedal('row-uncommon', targetUserId)) earnMedal('row-uncommon', targetUserId);
              if (actualWeight >= 41 && !hasMedal('row-common', targetUserId)) earnMedal('row-common', targetUserId);
            }
            
            // OHP/SHOULDER PRESS milestones
            if (normalizedId === 'overhead-press' || normalizedId === 'military-press' || normalizedId === 'dumbbell-shoulder-press' || normalizedId === 'machine-shoulder-press') {
              if (actualWeight >= 112 && !hasMedal('ohp-legendary', targetUserId)) earnMedal('ohp-legendary', targetUserId);
              if (actualWeight >= 87 && !hasMedal('ohp-epic', targetUserId)) earnMedal('ohp-epic', targetUserId);
              if (actualWeight >= 64 && !hasMedal('ohp-rare', targetUserId)) earnMedal('ohp-rare', targetUserId);
              if (actualWeight >= 45 && !hasMedal('ohp-uncommon', targetUserId)) earnMedal('ohp-uncommon', targetUserId);
              if (actualWeight >= 30 && !hasMedal('ohp-common', targetUserId)) earnMedal('ohp-common', targetUserId);
            }
            
            // LEG PRESS milestones
            if (normalizedId === 'leg-press' || normalizedId === 'leg-press-machine' || normalizedId === 'leg-press-single-leg') {
              if (actualWeight >= 432 && !hasMedal('legpress-legendary', targetUserId)) earnMedal('legpress-legendary', targetUserId);
              if (actualWeight >= 324 && !hasMedal('legpress-epic', targetUserId)) earnMedal('legpress-epic', targetUserId);
              if (actualWeight >= 226 && !hasMedal('legpress-rare', targetUserId)) earnMedal('legpress-rare', targetUserId);
              if (actualWeight >= 147 && !hasMedal('legpress-uncommon', targetUserId)) earnMedal('legpress-uncommon', targetUserId);
              if (actualWeight >= 86 && !hasMedal('legpress-common', targetUserId)) earnMedal('legpress-common', targetUserId);
            }
            
            // LEG EXTENSION milestones
            if (normalizedId === 'leg-extension') {
              if (actualWeight >= 120 && !hasMedal('legext-legendary', targetUserId)) earnMedal('legext-legendary', targetUserId);
              if (actualWeight >= 90 && !hasMedal('legext-epic', targetUserId)) earnMedal('legext-epic', targetUserId);
              if (actualWeight >= 60 && !hasMedal('legext-rare', targetUserId)) earnMedal('legext-rare', targetUserId);
              if (actualWeight >= 40 && !hasMedal('legext-uncommon', targetUserId)) earnMedal('legext-uncommon', targetUserId);
              if (actualWeight >= 20 && !hasMedal('legext-common', targetUserId)) earnMedal('legext-common', targetUserId);
            }
            
            // LEG CURL milestones
            if (normalizedId === 'leg-curl' || normalizedId === 'lying-leg-curl') {
              if (actualWeight >= 100 && !hasMedal('legcurl-legendary', targetUserId)) earnMedal('legcurl-legendary', targetUserId);
              if (actualWeight >= 75 && !hasMedal('legcurl-epic', targetUserId)) earnMedal('legcurl-epic', targetUserId);
              if (actualWeight >= 50 && !hasMedal('legcurl-rare', targetUserId)) earnMedal('legcurl-rare', targetUserId);
              if (actualWeight >= 35 && !hasMedal('legcurl-uncommon', targetUserId)) earnMedal('legcurl-uncommon', targetUserId);
              if (actualWeight >= 20 && !hasMedal('legcurl-common', targetUserId)) earnMedal('legcurl-common', targetUserId);
            }
            
            // CHEST PRESS milestones (machine)
            if (normalizedId === 'machine-chest-press' || normalizedId === 'chest-press') {
              if (actualWeight >= 100 && !hasMedal('chestpress-legendary', targetUserId)) earnMedal('chestpress-legendary', targetUserId);
              if (actualWeight >= 75 && !hasMedal('chestpress-epic', targetUserId)) earnMedal('chestpress-epic', targetUserId);
              if (actualWeight >= 50 && !hasMedal('chestpress-rare', targetUserId)) earnMedal('chestpress-rare', targetUserId);
              if (actualWeight >= 35 && !hasMedal('chestpress-uncommon', targetUserId)) earnMedal('chestpress-uncommon', targetUserId);
              if (actualWeight >= 20 && !hasMedal('chestpress-common', targetUserId)) earnMedal('chestpress-common', targetUserId);
            }
            
            // PULL-UP milestones (weighted)
            if (normalizedId === 'pull-up' || normalizedId === 'pull-ups' || normalizedId === 'weighted-pull-up') {
              if (actualWeight >= 40 && !hasMedal('pullup-40', targetUserId)) earnMedal('pullup-40', targetUserId);
              if (actualWeight >= 25 && !hasMedal('pullup-25', targetUserId)) earnMedal('pullup-25', targetUserId);
              if (actualWeight >= 10 && !hasMedal('pullup-10', targetUserId)) earnMedal('pullup-10', targetUserId);
              if (!hasMedal('pullup-bw', targetUserId)) earnMedal('pullup-bw', targetUserId);
            }
            
            // T-BAR ROW milestones
            if (normalizedId === 't-bar-row' || normalizedId === 'tbar-row' || normalizedId === 'landmine-row') {
              if (actualWeight >= 130 && !hasMedal('tbar-130', targetUserId)) earnMedal('tbar-130', targetUserId);
              if (actualWeight >= 102 && !hasMedal('tbar-102', targetUserId)) earnMedal('tbar-102', targetUserId);
              if (actualWeight >= 75 && !hasMedal('tbar-75', targetUserId)) earnMedal('tbar-75', targetUserId);
              if (actualWeight >= 54 && !hasMedal('tbar-54', targetUserId)) earnMedal('tbar-54', targetUserId);
              if (actualWeight >= 35 && !hasMedal('tbar-35', targetUserId)) earnMedal('tbar-35', targetUserId);
            }
            
            // DUMBBELL BENCH PRESS milestones (per dumbbell weight)
            if (normalizedId === 'dumbbell-bench-press' || normalizedId === 'db-bench-press' || normalizedId === 'dumbbell-flat-bench') {
              if (actualWeight >= 44 && !hasMedal('dbbench-44', targetUserId)) earnMedal('dbbench-44', targetUserId);
              if (actualWeight >= 32 && !hasMedal('dbbench-32', targetUserId)) earnMedal('dbbench-32', targetUserId);
              if (actualWeight >= 23 && !hasMedal('dbbench-23', targetUserId)) earnMedal('dbbench-23', targetUserId);
              if (actualWeight >= 15 && !hasMedal('dbbench-15', targetUserId)) earnMedal('dbbench-15', targetUserId);
            }
            
            // DUMBBELL SHOULDER PRESS milestones (per dumbbell weight)
            if (normalizedId === 'dumbbell-shoulder-press' || normalizedId === 'db-shoulder-press' || normalizedId === 'seated-dumbbell-press') {
              if (actualWeight >= 38 && !hasMedal('dbohp-38', targetUserId)) earnMedal('dbohp-38', targetUserId);
              if (actualWeight >= 28 && !hasMedal('dbohp-28', targetUserId)) earnMedal('dbohp-28', targetUserId);
              if (actualWeight >= 20 && !hasMedal('dbohp-20', targetUserId)) earnMedal('dbohp-20', targetUserId);
              if (actualWeight >= 13 && !hasMedal('dbohp-13', targetUserId)) earnMedal('dbohp-13', targetUserId);
            }
            
            // HIP THRUST milestones
            if (normalizedId === 'hip-thrust' || normalizedId === 'barbell-hip-thrust' || normalizedId === 'hip-thruster') {
              if (actualWeight >= 196 && !hasMedal('hipthrust-196', targetUserId)) earnMedal('hipthrust-196', targetUserId);
              if (actualWeight >= 129 && !hasMedal('hipthrust-129', targetUserId)) earnMedal('hipthrust-129', targetUserId);
              if (actualWeight >= 76 && !hasMedal('hipthrust-76', targetUserId)) earnMedal('hipthrust-76', targetUserId);
              if (actualWeight >= 38 && !hasMedal('hipthrust-38', targetUserId)) earnMedal('hipthrust-38', targetUserId);
            }
            
            // BULGARIAN SPLIT SQUAT milestones (per dumbbell weight)
            if (normalizedId === 'bulgarian-split-squat' || normalizedId === 'split-squat' || normalizedId === 'rear-foot-elevated-split-squat') {
              if (actualWeight >= 44 && !hasMedal('bss-44', targetUserId)) earnMedal('bss-44', targetUserId);
              if (actualWeight >= 30 && !hasMedal('bss-30', targetUserId)) earnMedal('bss-30', targetUserId);
              if (actualWeight >= 18 && !hasMedal('bss-18', targetUserId)) earnMedal('bss-18', targetUserId);
              if (actualWeight >= 10 && !hasMedal('bss-10', targetUserId)) earnMedal('bss-10', targetUserId);
            }
            
            // Recalculate strength rating for the specific user
            calculateStrengthRatingForUser(targetUserId);
          }, 50);

          return newPB;
        }

        // Update best volume if higher (skip for assisted exercises)
        if (!isAssisted && existingPB && volume > (existingPB.bestVolume || 0)) {
          const updatedPB: PersonalBest = { ...existingPB, bestVolume: volume };
          set(state => ({
            personalBests: state.personalBests.map(p => 
              p.id === existingPB.id ? updatedPB : p
            ),
          }));
        }

        return null;
      },

      getPBForExercise: (exerciseId) => {
        const targetUserId = get().getActiveUserId();
        return get().personalBests.find(p => p.exerciseId === exerciseId && p.userId === targetUserId);
      },

      getWorkoutHistory: () => {
        const targetUserId = get().getActiveUserId();
        return get().workoutHistory.filter(w => w.userId === targetUserId);
      },

      getWorkoutHistoryForUser: (userId: string) => {
        return get().workoutHistory.filter(w => w.userId === userId);
      },

      getPersonalBestsForUser: (userId: string) => {
        return get().personalBests.filter(pb => pb.userId === userId);
      },

      deleteWorkout: (workoutId) => {
        const { workoutHistory } = get();
        const workoutToDelete = workoutHistory.find(w => w.id === workoutId);
        const userId = workoutToDelete?.userId;
        const assignedBy = workoutToDelete?.assignedBy;
        
        // Soft delete: mark with deletedAt timestamp instead of removing
        set(state => ({
          workoutHistory: state.workoutHistory.map(w => 
            w.id === workoutId 
              ? { ...w, deletedAt: new Date().toISOString() } 
              : w
          ),
        }));
        
        // If this was a trainer-assigned workout, decrement counters
        if (userId && assignedBy) {
          const trainerStore = useTrainerStore.getState();
          
          // Decrement totalSessions stored counter on client record
          const clientRecord = trainerStore.clients.find(c => c.clientId === userId);
          if (clientRecord && (clientRecord.totalSessions ?? 0) > 0) {
            trainerStore.updateClient(userId, { totalSessions: Math.max(0, (clientRecord.totalSessions ?? 0) - 1) });
          }
          
          // Decrement package usedSessions
          const activePackage = trainerStore.sessionPackages.find(
            p => p.clientId === userId && p.trainerId === assignedBy && p.status === 'active'
          );
          if (activePackage && activePackage.usedSessions > 0) {
            const isContinuous = activePackage.remainingSessions === -1 || activePackage.totalSessions === -1;
            const newUsed = Math.max(0, (activePackage.usedSessions || 0) - 1);
            const newRemaining = isContinuous ? -1 : Math.min(activePackage.totalSessions, (activePackage.remainingSessions || 0) + 1);
            useTrainerStore.setState(state => ({
              sessionPackages: state.sessionPackages.map(p =>
                p.id === activePackage.id
                  ? { ...p, usedSessions: newUsed, remainingSessions: newRemaining }
                  : p
              ),
            }));
            const updated = useTrainerStore.getState().sessionPackages.find(p => p.id === activePackage.id);
            if (updated) syncSessionPackageToSupabase(updated);
          }
          
          // Also mark corresponding session record as cancelled
          const matchingSession = trainerStore.sessions.find(
            s => s.clientId === userId && s.trainerId === assignedBy && s.status === 'completed' &&
            workoutToDelete?.startTime && s.date === workoutToDelete.startTime.split('T')[0]
          );
          if (matchingSession) {
            useTrainerStore.setState(state => ({
              sessions: state.sessions.map(s =>
                s.id === matchingSession.id ? { ...s, status: 'cancelled' as any } : s
              ),
            }));
          }
        }
        
        // Sync soft delete to Supabase
        const deletedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (deletedWorkout) {
          syncWorkoutToSupabase(deletedWorkout);
        }
        
        // Silently remove associated feed post
        const { posts } = useSocialStore.getState();
        const linkedPost = posts.find(p => p.workoutId === workoutId);
        if (linkedPost) {
          useSocialStore.setState({
            posts: posts.filter(p => p.workoutId !== workoutId),
          });
        }
        
        // deriveAll: recompute PBs, medals, ratings, volume after deletion
        if (userId) {
          get().runDeriveAll(userId);
        }
      },

      clearDataForUser: (userId: string) => {
        set(state => ({
          workoutHistory: state.workoutHistory.filter(w => w.userId !== userId),
          personalBests: state.personalBests.filter(pb => pb.userId !== userId),
        }));
        // Also clear medals for this user
        useMedalStore.getState().clearMedalsForUser(userId);
      },

      updateWorkoutNotes: (workoutId: string, notes: string) => {
        set(state => ({
          workoutHistory: state.workoutHistory.map(w =>
            w.id === workoutId ? { ...w, notes } : w
          ),
        }));
        
        // Sync updated workout to Supabase
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          syncWorkoutToSupabase(updatedWorkout);
        }
      },

      getWorkoutById: (workoutId: string) => {
        return get().workoutHistory.find(w => w.id === workoutId);
      },

      updateCompletedWorkout: (workoutId: string, updates: Partial<Workout>) => {
        set(state => ({
          workoutHistory: state.workoutHistory.map(w =>
            w.id === workoutId ? { ...w, ...updates } : w
          ),
        }));
        
        // Sync to Supabase
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          syncWorkoutToSupabase(updatedWorkout);
          
          // deriveAll: recompute PBs, medals, ratings, volume after edit
          get().runDeriveAll(updatedWorkout.userId);
        }
      },

      removeExerciseFromCompletedWorkout: (workoutId: string, exerciseId: string) => {
        const workout = get().workoutHistory.find(w => w.id === workoutId);
        if (!workout) return;
        
        const updatedExercises = workout.exercises.filter(e => e.id !== exerciseId);
        
        set(state => ({
          workoutHistory: state.workoutHistory.map(w =>
            w.id === workoutId ? { ...w, exercises: updatedExercises } : w
          ),
        }));
        
        // Sync to Supabase and recalculate PBs
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          syncWorkoutToSupabase(updatedWorkout);
          get().runDeriveAll(workout.userId);
        }
      },

      removeSetFromCompletedWorkout: (workoutId: string, exerciseId: string, setId: string) => {
        const workout = get().workoutHistory.find(w => w.id === workoutId);
        if (!workout) return;
        
        const updatedExercises = workout.exercises.map(ex => {
          if (ex.id === exerciseId) {
            return {
              ...ex,
              sets: ex.sets
                .filter(s => s.id !== setId)
                .map((s, idx) => ({ ...s, setNumber: idx + 1 })),
            };
          }
          return ex;
        });
        
        set(state => ({
          workoutHistory: state.workoutHistory.map(w =>
            w.id === workoutId ? { ...w, exercises: updatedExercises } : w
          ),
        }));
        
        // Sync to Supabase and recalculate PBs (this handles PB reversion)
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          syncWorkoutToSupabase(updatedWorkout);
          get().runDeriveAll(workout.userId);
        }
      },

      // Exercise notes - persist across workouts
      // PT sessions: keyed by trainerId:clientId:exerciseId (private to trainer per client)
      // Personal workouts: keyed by userId:exerciseId
      getExerciseNotes: (exerciseId: string) => {
        const authUser = useAuthStore.getState().user;
        const userId = authUser?.id || '';
        const clientId = get().currentClientId;
        // PT session: trainer is logged in, working with a client
        if (clientId && clientId !== userId) {
          const trainerKey = `${userId}:${clientId}:${exerciseId}`;
          return get().exerciseNotes[trainerKey] || '';
        }
        // Personal workout or client's own session
        const personalKey = `${clientId || userId}:${exerciseId}`;
        // Check new keyed format first, fall back to legacy key
        return get().exerciseNotes[personalKey] || get().exerciseNotes[exerciseId] || '';
      },

      setExerciseNotes: (exerciseId: string, notes: string) => {
        const authUser = useAuthStore.getState().user;
        const userId = authUser?.id || '';
        const clientId = get().currentClientId;
        // PT session: trainer is logged in, working with a client
        let key: string;
        if (clientId && clientId !== userId) {
          key = `${userId}:${clientId}:${exerciseId}`;
        } else {
          key = `${clientId || userId}:${exerciseId}`;
        }
        set(state => ({
          exerciseNotes: {
            ...state.exerciseNotes,
            [key]: notes,
          },
        }));
      },

      recalculatePBsForUser: (userId: string) => {
        const workouts = get().workoutHistory.filter(w => w.userId === userId && !w.deletedAt);
        const newPBs: Record<string, PersonalBest> = {};
        
        // Import normalizeExerciseId for consistent exercise ID matching
        const { normalizeExerciseId } = require('./exerciseStats');
        const { isAssistedExercise } = require('./exercises');
        
        // Go through all workouts and find best lifts for each exercise
        workouts.forEach(workout => {
          workout.exercises?.forEach(ex => {
            // Normalize exercise ID to match tier range keys
            const rawId = ex.exerciseId || ex.exercise?.name || '';
            const exerciseId = normalizeExerciseId(rawId);
            if (!exerciseId) return;
            
            const isAssisted = isAssistedExercise(exerciseId, ex.exercise?.name);
            
            const userBW = getUserBodyweight(userId);
            ex.sets?.filter(s => s.completed && s.weight && s.reps).forEach(set => {
              const oneRepMax = calculate1RM(set.weight!, set.reps!);
              if (oneRepMax === null) return; // Skip if reps > 20
              
              // Assisted: (bodyweight - assistedWeight) × reps, fallback reps×1
              const setVolume = getSetVolume(set.weight, set.reps!, isAssisted, userBW);
              
              const existing = newPBs[exerciseId];
              // For assisted: lower weight = better. For normal: higher 1RM = better.
              const isBetter = isAssisted
                ? (!existing || set.weight! < existing.bestWeight)
                : (!existing || oneRepMax > existing.oneRepMax);
              
              if (isBetter) {
                newPBs[exerciseId] = {
                  id: existing?.id || uuidv4(),
                  exerciseId: exerciseId, // Use normalized ID
                  userId,
                  bestWeight: set.weight!,
                  bestReps: set.reps!,
                  oneRepMax: isAssisted ? set.weight! : oneRepMax,
                  bestVolume: Math.max(setVolume, existing?.bestVolume || 0),
                  achievedAt: workout.endTime || workout.startTime || new Date().toISOString(),
                  workoutId: workout.id,
                };
              }
            });
          });
        });
        
        console.log(`[Store] Recalculated ${Object.keys(newPBs).length} PBs for user ${userId}:`, Object.keys(newPBs));
        
        // Update state: remove old PBs for this user, add recalculated ones
        set(state => ({
          personalBests: [
            ...state.personalBests.filter(pb => pb.userId !== userId),
            ...Object.values(newPBs),
          ],
        }));
        
        // Recalculate strength rating
        useMedalStore.getState().calculateStrengthRatingForUser(userId);
      },

      runDeriveAll: (userId: string, completedWorkout: Workout | null = null) => {
        const { normalizeExerciseId } = require('./exerciseStats');
        const { earnMedal, hasMedal, revokeMedalsForUser, calculateStrengthRatingForUser } = useMedalStore.getState();

        const result = deriveAll({
          workouts: get().workoutHistory,
          userId,
          completedWorkout,
          normalizeExerciseId,
          medalDeps: { hasMedal, earnMedal, revokeMedalsForUser, normalizeExerciseId },
          calculateStrengthRatingForUser,
        });

        // Update PBs, volume, and store last result for summary screen
        set(state => ({
          personalBests: [
            ...state.personalBests.filter(pb => pb.userId !== userId),
            ...result.personalBests,
          ],
          volumeRollups: {
            ...state.volumeRollups,
            [userId]: result.volumeRollup,
          },
          lastDeriveResult: {
            medalsAwarded: result.medalsAwarded,
            volumeRollup: result.volumeRollup,
          },
        }));
      },

      loadWorkoutHistoryFromSupabase: async (userId: string, isTrainer: boolean = false) => {
        console.log('[WorkoutStore] Loading workout history from Supabase for:', userId, isTrainer ? '(trainer)' : '');
        
        let workouts: Workout[] = [];
        
        if (isTrainer) {
          // For trainers, fetch all client workouts
          workouts = await fetchClientWorkoutsFromSupabase(userId);
        } else {
          // For regular users, fetch their own workouts
          workouts = await fetchWorkoutHistoryFromSupabase(userId, false);
        }
        
        if (workouts.length > 0) {
          // Merge with existing workouts (avoid duplicates by ID)
          const existingIds = new Set(get().workoutHistory.map(w => w.id));
          const newWorkouts = workouts.filter(w => !existingIds.has(w.id));
          
          set(state => ({
            workoutHistory: [...state.workoutHistory, ...newWorkouts],
          }));
          
          console.log(`[WorkoutStore] ✅ Loaded ${newWorkouts.length} new workouts from Supabase (${workouts.length} total fetched)`);
        } else {
          console.log('[WorkoutStore] No workouts found in Supabase');
        }
      },
    }),
    {
      name: 'apex-workout',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workoutHistory: state.workoutHistory,
        templates: state.templates,
        personalBests: state.personalBests,
        exerciseNotes: state.exerciseNotes,
        volumeRollups: state.volumeRollups,
      }),
    }
  )
);

// ============ SOCIAL STORE ============
interface SocialState {
  posts: FeedPost[];
  notifications: Notification[];
  
  createPost: (type: FeedPost['type'], content: string, mediaUrls?: string[], workoutId?: string, medalId?: string) => void;
  deletePost: (postId: string) => void;
  likePost: (postId: string) => void;
  unlikePost: (postId: string) => void;
  commentOnPost: (postId: string, content: string) => void;
  
  followUser: (userId: string) => void;
  unfollowUser: (userId: string) => void;
  
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearAllNotifications: () => void;
  getUnreadCount: () => number;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      posts: [],
      notifications: [],

      createPost: (type, content, mediaUrls, workoutId, medalId) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const post: FeedPost = {
          id: uuidv4(),
          userId: user.id,
          user,
          type,
          content,
          mediaUrls,
          workoutId,
          medalId,
          likes: [],
          comments: [],
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          posts: [post, ...state.posts],
        }));
      },

      deletePost: (postId) => {
        set(state => ({
          posts: state.posts.filter(p => p.id !== postId),
        }));
      },

      likePost: (postId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        set(state => ({
          posts: state.posts.map(p =>
            p.id === postId && !p.likes.includes(userId)
              ? { ...p, likes: [...p.likes, userId] }
              : p
          ),
        }));
      },

      unlikePost: (postId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        set(state => ({
          posts: state.posts.map(p =>
            p.id === postId
              ? { ...p, likes: p.likes.filter(id => id !== userId) }
              : p
          ),
        }));
      },

      commentOnPost: (postId, content) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const comment = {
          id: uuidv4(),
          userId: user.id,
          user,
          content,
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          posts: state.posts.map(p =>
            p.id === postId
              ? { ...p, comments: [...p.comments, comment] }
              : p
          ),
        }));
      },

      followUser: async (userId) => {
        const { updateUser, user } = useAuthStore.getState();
        if (!user) return;

        updateUser({
          following: [...user.following, userId],
        });
        
        // Notify the followed user
        get().addNotification({
          userId: userId,
          type: 'friend_request',
          title: 'New Follower',
          message: `${user.displayName || user.username || 'Someone'} started following you`,
          actionUrl: `/profile/${user.id}`,
        });
        
        // Sync to Supabase
        const { syncFollowToSupabase } = await import('./supabaseSync');
        await syncFollowToSupabase(user.id, userId);
      },

      unfollowUser: async (userId) => {
        const { updateUser, user } = useAuthStore.getState();
        if (!user) return;

        updateUser({
          following: user.following.filter(id => id !== userId),
        });
        
        // Sync to Supabase
        const { removeFollowFromSupabase } = await import('./supabaseSync');
        await removeFollowFromSupabase(user.id, userId);
      },

      addNotification: (notification) => {
        const currentUserId = useAuthStore.getState().user?.id;
        const targetUserId = notification.userId || currentUserId;
        if (!targetUserId) return;

        const newNotification: Notification = {
          id: uuidv4(),
          ...notification,
          userId: targetUserId,
          read: false,
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          notifications: [newNotification, ...state.notifications],
        }));

        // Sync to Supabase
        import('./supabaseSync').then(({ syncNotificationToSupabase }) => {
          syncNotificationToSupabase(newNotification);
        });
      },

      markNotificationRead: (notificationId) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        }));

        // Sync to Supabase
        import('./supabaseSync').then(({ markNotificationReadInSupabase }) => {
          markNotificationReadInSupabase(notificationId);
        });
      },

      markAllNotificationsRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
        }));
      },

      clearAllNotifications: () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;
        set(state => ({
          notifications: state.notifications.filter(n => n.userId !== userId),
        }));

        // Delete from Supabase
        import('./supabaseSync').then(({ deleteNotificationsFromSupabase }) => {
          deleteNotificationsFromSupabase(userId);
        });
      },

      getUnreadCount: () => {
        const userId = useAuthStore.getState().user?.id;
        return get().notifications.filter(n => n.userId === userId && !n.read).length;
      },
    }),
    {
      name: 'apex-social',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ============ TRAINER STORE ============
// Session workout created in builder
interface SessionWorkout {
  id: string;
  name: string;
  clientId: string;
  eventId?: string;
  trainerId?: string;
  blocks: any[]; // WorkoutBlock[]
  createdAt: string;
}

// Saved workout for library
interface SavedWorkout {
  id: string;
  name: string;
  description?: string;
  trainerId: string;
  blocks: any[]; // WorkoutBlock[]
  tags?: string[]; // e.g., 'upper', 'lower', 'full body', 'beginner'
  estimatedMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

// Saved circuit template
interface CircuitTemplate {
  id: string;
  name: string;
  description?: string;
  trainerId: string;
  exercises: any[]; // Circuit exercises
  circuitStyle: 'rounds' | 'amrap' | 'emom' | 'forTime' | 'tabata';
  rounds?: number;
  duration?: number; // seconds
  restBetweenRounds?: string;
  tags?: string[];
  createdAt: string;
}

interface TrainerState {
  clients: TrainerClient[];
  clientGroups: ClientGroup[];
  assignedWorkouts: Workout[];
  calendarEvents: CalendarEvent[];
  sessions: ClientSession[];
  payments: ClientPayment[];
  sessionPackages: SessionPackage[];
  bookingRequests: BookingRequest[];
  clientPrograms: ClientProgram[];
  clientProfiles: ClientProgrammingProfile[];
  sessionWorkouts: SessionWorkout[]; // Workouts created in builder
  workoutLibrary: SavedWorkout[]; // Saved workout templates
  circuitLibrary: CircuitTemplate[]; // Saved circuit templates
  savedBlocks: SavedBlock[]; // Block library
  blockPerformances: BlockPerformance[]; // Client performance records on blocks
  
  // Client management
  addClient: (clientId: string, onboardingData?: Partial<TrainerClient>) => void;
  removeClient: (clientId: string) => void;
  updateClient: (clientId: string, updates: Partial<TrainerClient>) => void;
  clearAllData: () => void;
  bulkImportClients: (clients: Array<{ 
    displayName: string; 
    gender?: 'male' | 'female' | 'other';
    sessionInfo?: string;
    totalPaid?: number;
    sessionsCovered?: number;
    sessionsUsed?: number;
    sessionsRemaining?: number;
    workoutHistory?: Array<{
      date: string;
      name: string;
      exercises: Array<{
        name: string;
        sets: Array<{ weight: number; reps: number }>;
      }>;
      totalVolume: number;
    }>;
  }>) => void;
  getClientById: (clientId: string) => TrainerClient | undefined;
  
  // Workout assignment
  assignWorkout: (clientId: string, workout: Workout, scheduledDate: string) => void;
  getAssignedWorkouts: (clientId: string) => Workout[];
  
  // Calendar
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateCalendarEvent: (eventId: string, updates: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (eventId: string) => void;
  getEventsForDate: (date: string) => CalendarEvent[];
  getEventsForClient: (clientId: string) => CalendarEvent[];
  
  // Sessions
  addSession: (session: Omit<ClientSession, 'id'>) => void;
  updateSession: (sessionId: string, updates: Partial<ClientSession>) => void;
  getSessionsForClient: (clientId: string) => ClientSession[];
  markSessionComplete: (sessionId: string, notes?: string) => void;
  markSessionPaid: (sessionId: string, paymentId?: string) => void;
  markSessionNoShow: (sessionId: string) => void;
  toggleSessionPaid: (sessionId: string) => void;
  
  // Payments
  addPayment: (payment: Omit<ClientPayment, 'id' | 'createdAt'>) => void;
  updatePayment: (paymentId: string, updates: Partial<ClientPayment>) => void;
  deletePayment: (paymentId: string) => void;
  getPaymentsForClient: (clientId: string) => ClientPayment[];
  markPaymentPaid: (paymentId: string, method?: string) => void;
  
  // Session packages
  addSessionPackage: (pkg: Omit<SessionPackage, 'id' | 'usedSessions' | 'remainingSessions'>) => void;
  useSessionFromPackage: (packageId: string) => void;
  getPackagesForClient: (clientId: string) => SessionPackage[];
  
  // Booking requests
  createBookingRequest: (request: Omit<BookingRequest, 'id' | 'createdAt' | 'status'>) => BookingRequest;
  confirmBooking: (requestId: string, confirmedBy: 'trainer' | 'client' | 'auto') => void;
  declineBooking: (requestId: string) => void;
  cancelBooking: (requestId: string) => void;
  getBookingRequestsForClient: (clientId: string) => BookingRequest[];
  getPendingBookingRequests: () => BookingRequest[];
  
  // Client Programs
  addClientProgram: (program: ClientProgram) => void;
  updateClientProgram: (programId: string, updates: Partial<ClientProgram>) => void;
  deleteClientProgram: (programId: string) => void;
  getClientPrograms: (clientId: string) => ClientProgram[];
  getActiveProgram: (clientId: string) => ClientProgram | undefined;
  getNextProgramWorkout: (userId: string) => { program: ClientProgram; dayIndex: number; day: any; remainingThisWeek: number; sessionType: 'pt' | 'personal'; completedDayIndices: number[] } | null;
  
  // Client Profiles (onboarding data)
  saveClientProfile: (profile: ClientProgrammingProfile) => void;
  getClientProfile: (clientId: string) => ClientProgrammingProfile | undefined;
  
  // Set initial stats for onboarding existing clients
  setInitialClientStats: (clientId: string, sessionsDone: number, sessionsLeft: number, totalPaid: number) => void;
  
  // Client-facing session functions
  loadClientDataFromSupabase: (clientId: string) => Promise<void>;
  getScheduledSessionsForUser: (userId: string) => CalendarEvent[];
  confirmSession: (eventId: string) => void;
  
  // Session workouts (created in builder)
  addSessionWorkout: (workout: SessionWorkout) => void;
  getSessionWorkout: (workoutId: string) => SessionWorkout | undefined;
  getSessionWorkoutsForClient: (clientId: string) => SessionWorkout[];
  deleteSessionWorkout: (workoutId: string) => void;
  updateSessionWorkout: (workoutId: string, updates: Partial<SessionWorkout>) => void;
  
  // Workout Library
  saveToWorkoutLibrary: (workout: Omit<SavedWorkout, 'id' | 'trainerId' | 'createdAt' | 'updatedAt'>) => SavedWorkout;
  updateWorkoutInLibrary: (workoutId: string, updates: Partial<SavedWorkout>) => void;
  deleteFromWorkoutLibrary: (workoutId: string) => void;
  getWorkoutFromLibrary: (workoutId: string) => SavedWorkout | undefined;
  
  // Circuit Library
  saveCircuitTemplate: (circuit: Omit<CircuitTemplate, 'id' | 'trainerId' | 'createdAt'>) => CircuitTemplate;
  updateCircuitTemplate: (circuitId: string, updates: Partial<CircuitTemplate>) => void;
  deleteCircuitTemplate: (circuitId: string) => void;
  getCircuitTemplate: (circuitId: string) => CircuitTemplate | undefined;
  
  // Block Library
  saveBlock: (block: Omit<SavedBlock, 'id' | 'trainerId' | 'createdAt' | 'updatedAt'>) => SavedBlock;
  updateBlock: (blockId: string, updates: Partial<SavedBlock>) => void;
  deleteBlock: (blockId: string) => void;
  getBlock: (blockId: string) => SavedBlock | undefined;
  getBlocksByType: (type: BlockType) => SavedBlock[];
  
  // Block Performance Tracking
  recordBlockPerformance: (performance: Omit<BlockPerformance, 'id' | 'performedAt'>) => BlockPerformance;
  getBlockPerformances: (blockId: string, clientId?: string) => BlockPerformance[];
  getBestBlockPerformance: (blockId: string, clientId: string) => BlockPerformance | undefined;
  
  // Supabase sync
  loadFromSupabase: (trainerId: string) => Promise<void>;
  
  // Update package (for editing)
  updateSessionPackage: (packageId: string, updates: Partial<SessionPackage>) => void;
  
  // Client Groups
  addClientGroup: (group: Omit<ClientGroup, 'id' | 'createdAt'>) => ClientGroup;
  updateClientGroup: (groupId: string, updates: Partial<ClientGroup>) => void;
  deleteClientGroup: (groupId: string) => void;
  getClientGroup: (groupId: string) => ClientGroup | undefined;
  addMemberToGroup: (groupId: string, clientId: string) => void;
  removeMemberFromGroup: (groupId: string, clientId: string) => void;
  
  // Retroactive medal check
  checkAndAwardTrainerMedals: (trainerId: string) => void;
}

export const useTrainerStore = create<TrainerState>()(
  persist(
    (set, get) => ({
      clients: [],
      clientGroups: [],
      assignedWorkouts: [],
      calendarEvents: [],
      sessions: [],
      payments: [],
      bookingRequests: [],
      sessionPackages: [],
      clientPrograms: [],
      clientProfiles: [],
      sessionWorkouts: [],
      workoutLibrary: [],
      circuitLibrary: [],
      savedBlocks: [],
      blockPerformances: [],

      addClient: (clientId, onboardingData) => {
        const trainerId = useAuthStore.getState().user?.id;
        
        console.log('[Trainer Store] addClient called:', { clientId, trainerId, hasTrainerId: !!trainerId });
        
        if (!trainerId) {
          console.error('[Trainer Store] ❌ Cannot add client - no trainer ID! User not logged in?');
          return;
        }

        // CHECK FOR DUPLICATE - don't add if client already exists
        const existingClient = get().clients.find(c => c.clientId === clientId);
        if (existingClient) {
          console.log('[Trainer Store] Client already exists, skipping duplicate add:', clientId);
          return;
        }

        const newClient: TrainerClient = {
          id: uuidv4(),
          trainerId,
          clientId,
          status: 'pending',
          startDate: new Date().toISOString(),
          onboardingComplete: false,
          ...onboardingData,
        };

        console.log('[Trainer Store] Creating new client relationship:', newClient);

        set(state => ({
          clients: [...state.clients, newClient],
        }));
        
        // Check trainer client count medals
        setTimeout(() => {
          const trainerClients = get().clients.filter(c => c.trainerId === trainerId);
          const clientCount = trainerClients.length;
          const { earnMedal, hasMedal } = useMedalStore.getState();
          
          // Cascade medal earning for client count milestones
          if (clientCount >= 50) {
            if (!hasMedal('trainer-50-clients', trainerId)) earnMedal('trainer-50-clients', trainerId);
            if (!hasMedal('trainer-25-clients', trainerId)) earnMedal('trainer-25-clients', trainerId);
            if (!hasMedal('trainer-10-clients', trainerId)) earnMedal('trainer-10-clients', trainerId);
            if (!hasMedal('trainer-5-clients', trainerId)) earnMedal('trainer-5-clients', trainerId);
            if (!hasMedal('trainer-first-client', trainerId)) earnMedal('trainer-first-client', trainerId);
          } else if (clientCount >= 25) {
            if (!hasMedal('trainer-25-clients', trainerId)) earnMedal('trainer-25-clients', trainerId);
            if (!hasMedal('trainer-10-clients', trainerId)) earnMedal('trainer-10-clients', trainerId);
            if (!hasMedal('trainer-5-clients', trainerId)) earnMedal('trainer-5-clients', trainerId);
            if (!hasMedal('trainer-first-client', trainerId)) earnMedal('trainer-first-client', trainerId);
          } else if (clientCount >= 10) {
            if (!hasMedal('trainer-10-clients', trainerId)) earnMedal('trainer-10-clients', trainerId);
            if (!hasMedal('trainer-5-clients', trainerId)) earnMedal('trainer-5-clients', trainerId);
            if (!hasMedal('trainer-first-client', trainerId)) earnMedal('trainer-first-client', trainerId);
          } else if (clientCount >= 5) {
            if (!hasMedal('trainer-5-clients', trainerId)) earnMedal('trainer-5-clients', trainerId);
            if (!hasMedal('trainer-first-client', trainerId)) earnMedal('trainer-first-client', trainerId);
          } else if (clientCount >= 1) {
            if (!hasMedal('trainer-first-client', trainerId)) earnMedal('trainer-first-client', trainerId);
          }
          console.log(`[Trainer Store] Checked client medals: ${clientCount} clients for trainer ${trainerId}`);
        }, 50);
        
        // Sync to Supabase for cross-device backup (async but we log result)
        syncTrainerClientToSupabase(newClient).then(success => {
          if (success) {
            console.log('[Trainer Store] ✅ Client synced to Supabase:', clientId);
          } else {
            console.error('[Trainer Store] ❌ Failed to sync client to Supabase:', clientId);
          }
        }).catch(err => {
          console.error('[Trainer Store] ❌ Exception syncing client:', err);
        });
      },

      removeClient: (clientId) => {
        // Remove from trainer's clients list and all associated data
        // NOTE: This does NOT delete the user's account - they can still log in
        
        // Get trainer ID before removing
        const client = get().clients.find(c => c.clientId === clientId);
        const trainerId = client?.trainerId;
        
        set(state => ({
          clients: state.clients.filter(c => c.clientId !== clientId),
          sessions: state.sessions.filter(s => s.clientId !== clientId),
          payments: state.payments.filter(p => p.clientId !== clientId),
          sessionPackages: state.sessionPackages.filter(p => p.clientId !== clientId),
          calendarEvents: state.calendarEvents.filter(e => e.clientId !== clientId),
          clientPrograms: state.clientPrograms.filter(p => p.clientId !== clientId),
        }));
        
        // Sync deletion to Supabase for cross-device consistency
        if (trainerId) {
          deleteClientFromSupabase(trainerId, clientId);
        }
      },

      updateClient: (clientId, updates) => {
        set(state => ({
          clients: state.clients.map(c =>
            c.clientId === clientId ? { ...c, ...updates } : c
          ),
        }));
        
        // Sync to Supabase
        const updatedClient = get().clients.find(c => c.clientId === clientId);
        if (updatedClient) {
          import('./supabaseSync').then(({ syncTrainerClientToSupabase }) => {
            syncTrainerClientToSupabase({
              id: updatedClient.id,
              trainerId: updatedClient.trainerId,
              clientId: updatedClient.clientId,
              status: updatedClient.status,
              startDate: updatedClient.startDate,
              onboardingComplete: updatedClient.onboardingComplete,
              notes: updatedClient.notes,
              goals: updatedClient.goals,
              totalSessions: updatedClient.totalSessions,
              totalPaid: updatedClient.totalPaid,
              totalSessionsOffset: updatedClient.totalSessionsOffset,
              totalPaidOffset: updatedClient.totalPaidOffset,
            });
          });
        }
      },

      getClientById: (clientId) => {
        return get().clients.find(c => c.clientId === clientId);
      },

      clearAllData: () => {
        // Clear all trainer data
        set({
          clients: [],
          assignedWorkouts: [],
          calendarEvents: [],
          sessions: [],
          payments: [],
          bookingRequests: [],
          sessionPackages: [],
          clientPrograms: [],
          clientProfiles: [],
        });
        // Clear social data
        useSocialStore.setState({ posts: [], notifications: [] });
        // Clear workout data (workouts, PBs, medals)
        useWorkoutStore.setState({ workoutHistory: [], personalBests: [], templates: [] });
        useMedalStore.setState({ medals: [], evolvingMedalProgress: {}, strengthRating: null });
        // Clear all users except current trainer from localStorage
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          localStorage.setItem('apex-users', JSON.stringify([{ ...currentUser, password: hashPassword(currentUser.id) }]));
        }
      },

      bulkImportClients: (clients) => {
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return;

        // Get existing users from localStorage
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        
        const newClients: TrainerClient[] = [];
        const newPayments: ClientPayment[] = [];
        const newPackages: SessionPackage[] = [];
        const newSessions: ClientSession[] = [];
        
        clients.forEach(client => {
          // Create user account for the client
          const clientId = uuidv4();
          const email = `${client.displayName.toLowerCase().replace(/\s+/g, '.')}@client.apex`;
          
          const newUser: User & { password: string; accountStatus?: string } = {
            id: clientId,
            email,
            username: client.displayName.toLowerCase().replace(/\s+/g, '_'),
            displayName: client.displayName,
            gender: client.gender || 'other',
            mode: 'user',
            isTrainer: false,
            isVerifiedTrainer: false,
            preferredUnit: 'kg',
            createdAt: new Date().toISOString(),
            followers: [],
            following: [],
            trainerId,
            password: hashPassword('client123'),
            accountStatus: 'placeholder',
          };
          
          storedUsers.push(newUser);
          
          // Create trainer-client relationship
          const trainerClient: TrainerClient = {
            id: uuidv4(),
            trainerId,
            clientId,
            status: 'active',
            startDate: new Date().toISOString(),
            onboardingComplete: true,
            notes: client.sessionInfo || '',
          };
          
          newClients.push(trainerClient);
          
          // Create payment record if there's payment data
          const paymentId = uuidv4();
          if (client.totalPaid && client.totalPaid > 0) {
            const payment: ClientPayment = {
              id: paymentId,
              clientId,
              trainerId,
              amount: client.totalPaid,
              currency: 'NZD',
              type: 'session_pack',
              sessionsIncluded: client.sessionsCovered || 0,
              description: `Historical payments - ${client.sessionsCovered || 0} sessions`,
              status: 'paid',
              paidAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            newPayments.push(payment);
          }
          
          // Create session package if there are sessions
          if (client.sessionsCovered && client.sessionsCovered > 0) {
            const sessionsUsed = client.sessionsUsed || 0;
            const pkg: SessionPackage = {
              id: uuidv4(),
              clientId,
              trainerId,
              name: `${client.sessionsCovered} Session Package`,
              totalSessions: client.sessionsCovered,
              usedSessions: sessionsUsed,
              paidSessions: client.sessionsCovered, // Assume all sessions paid
              remainingSessions: client.sessionsRemaining || 0,
              priceTotal: client.totalPaid || 0,
              pricePerSession: client.totalPaid ? Math.round(client.totalPaid / client.sessionsCovered) : 50,
              purchaseDate: new Date().toISOString(),
              paymentId: paymentId,
              status: (client.sessionsRemaining || 0) > 0 ? 'active' : 'completed',
            };
            newPackages.push(pkg);
            
            // Create completed session records
            for (let i = 0; i < sessionsUsed; i++) {
              // Spread sessions over past months
              const daysAgo = Math.floor((sessionsUsed - i) * 7); // roughly weekly
              const sessionDate = new Date();
              sessionDate.setDate(sessionDate.getDate() - daysAgo);
              
              const session: ClientSession = {
                id: uuidv4(),
                clientId,
                trainerId,
                date: sessionDate.toISOString(),
                startTime: '09:00',
                endTime: '10:00',
                status: 'completed',
                type: 'pt_session',
                duration: 60,
                paid: true,
              };
              newSessions.push(session);
            }
          }
          // Create workout history records and personal bests if provided
          if (client.workoutHistory && client.workoutHistory.length > 0) {
            const personalBestsMap: Record<string, PersonalBest> = {};
            
            client.workoutHistory.forEach(workout => {
              const workoutId = uuidv4();
              const workoutExercises: WorkoutExercise[] = workout.exercises.map(ex => {
                const exerciseId = ex.name.toLowerCase().replace(/\s+/g, '-');
                
                // Calculate best set and volume for this exercise
                let bestWeight = 0;
                let bestReps = 0;
                let exerciseVolume = 0;
                ex.sets.forEach(s => {
                  exerciseVolume += s.weight * s.reps;
                  if (s.weight > bestWeight) {
                    bestWeight = s.weight;
                    bestReps = s.reps;
                  }
                });
                
                // Calculate estimated 1RM using proper formula (Brzycki for <=6 reps, Epley for 7-20)
                // Returns null if reps > 20 (doesn't count toward strength rating)
                const oneRepMax = calculate1RM(bestWeight, bestReps);
                
                // Update personal best if this is better (skip if null/reps > 20)
                if (oneRepMax !== null && (!personalBestsMap[exerciseId] || oneRepMax > personalBestsMap[exerciseId].oneRepMax)) {
                  personalBestsMap[exerciseId] = {
                    id: uuidv4(),
                    exerciseId,
                    userId: clientId,
                    oneRepMax,
                    bestWeight,
                    bestReps,
                    bestVolume: exerciseVolume,
                    achievedAt: workout.date,
                    workoutId,
                  };
                }
                
                return {
                  id: uuidv4(),
                  exerciseId,
                  exercise: {
                    id: exerciseId,
                    name: ex.name,
                    primaryMuscles: [],
                    secondaryMuscles: [],
                    category: 'compound' as const,
                    equipment: 'machine' as const,
                  },
                  sets: ex.sets.map((s, idx) => ({
                    id: uuidv4(),
                    setNumber: idx + 1,
                    type: 'normal' as const,
                    weight: s.weight,
                    reps: s.reps,
                    completed: true,
                  })),
                  restTimerSeconds: 90,
                };
              });

              const workoutRecord: Workout = {
                id: workoutId,
                name: workout.name,
                exercises: workoutExercises,
                startTime: workout.date,
                endTime: workout.date,
                duration: 3600,
                totalVolume: workout.totalVolume,
                userId: clientId,
                status: 'completed',
              };

              // Add to workout store
              useWorkoutStore.setState(state => ({
                workoutHistory: [...state.workoutHistory, workoutRecord],
              }));
            });
            
            // Add all personal bests to store
            const personalBests = Object.values(personalBestsMap);
            useWorkoutStore.setState(state => ({
              personalBests: [...state.personalBests, ...personalBests],
            }));
            
            // Check and award medals for each personal best (per client)
            const { earnMedal, hasMedal } = useMedalStore.getState();
            
            // Award PR count medals for this client
            const pbCount = personalBests.length;
            if (pbCount >= 1 && !hasMedal('first-pr', clientId)) earnMedal('first-pr', clientId);
            if (pbCount >= 10 && !hasMedal('pr-hunter', clientId)) earnMedal('pr-hunter', clientId);
            if (pbCount >= 25 && !hasMedal('pr-collector', clientId)) earnMedal('pr-collector', clientId);
            
            // Award workout count medals
            const workoutCount = client.workoutHistory?.length || 0;
            if (workoutCount >= 1 && !hasMedal('first-blood', clientId)) earnMedal('first-blood', clientId);
            if (workoutCount >= 5 && !hasMedal('getting-started', clientId)) earnMedal('getting-started', clientId);
            
            // Award volume medals
            const totalVolume = client.workoutHistory?.reduce((sum, w) => sum + (w.totalVolume || 0), 0) || 0;
            if (totalVolume >= 10000 && !hasMedal('volume-10k', clientId)) earnMedal('volume-10k', clientId);
            if (totalVolume >= 50000 && !hasMedal('volume-50k', clientId)) earnMedal('volume-50k', clientId);
            
            personalBests.forEach(pb => {
              const weight = pb.bestWeight;
              const exerciseId = pb.exerciseId;
              
              // Leg Extension medals
              if (exerciseId === 'leg-extension') {
                if (weight >= 20 && !hasMedal('legext-common', clientId)) earnMedal('legext-common', clientId);
                if (weight >= 40 && !hasMedal('legext-uncommon', clientId)) earnMedal('legext-uncommon', clientId);
              }
              // Leg Curl medals
              if (exerciseId === 'leg-curl' || exerciseId === 'lying-leg-curl') {
                if (weight >= 20 && !hasMedal('legcurl-common', clientId)) earnMedal('legcurl-common', clientId);
                if (weight >= 35 && !hasMedal('legcurl-uncommon', clientId)) earnMedal('legcurl-uncommon', clientId);
              }
              // Leg Press medals
              if (exerciseId === 'leg-press' || exerciseId === 'leg-press-machine') {
                if (weight >= 86 && !hasMedal('legpress-common', clientId)) earnMedal('legpress-common', clientId);
              }
              // Lat Pulldown medals
              if (exerciseId === 'lat-pulldown') {
                if (weight >= 38 && !hasMedal('lat-common', clientId)) earnMedal('lat-common', clientId);
              }
              // Row medals
              if (exerciseId === 'seated-cable-row' || exerciseId === 'cable-row' || exerciseId === 'row-machine') {
                if (weight >= 41 && !hasMedal('row-common', clientId)) earnMedal('row-common', clientId);
              }
              // Chest Press medals
              if (exerciseId === 'machine-chest-press') {
                if (weight >= 20 && !hasMedal('chestpress-common', clientId)) earnMedal('chestpress-common', clientId);
                if (weight >= 35 && !hasMedal('chestpress-uncommon', clientId)) earnMedal('chestpress-uncommon', clientId);
              }
              // Shoulder Press medals
              if (exerciseId === 'machine-shoulder-press') {
                if (weight >= 30 && !hasMedal('ohp-common', clientId)) earnMedal('ohp-common', clientId);
              }
            });
          }
        });
        
        // Save users to localStorage
        localStorage.setItem('apex-users', JSON.stringify(storedUsers));
        
        // Add all data to trainer store
        set(state => ({
          clients: [...state.clients, ...newClients],
          payments: [...state.payments, ...newPayments],
          sessionPackages: [...state.sessionPackages, ...newPackages],
          sessions: [...state.sessions, ...newSessions],
        }));
      },

      assignWorkout: (clientId, workout, scheduledDate) => {
        const trainerId = useAuthStore.getState().user?.id;
        
        const assignedWorkout: Workout = {
          ...workout,
          id: uuidv4(),
          userId: clientId,
          assignedBy: trainerId,
          scheduledDate,
          status: 'active',
        };

        set(state => ({
          assignedWorkouts: [...state.assignedWorkouts, assignedWorkout],
        }));

        // Add calendar event
        get().addCalendarEvent({
          title: workout.name,
          type: 'workout',
          date: scheduledDate,
          clientId,
          trainerId,
          workoutId: assignedWorkout.id,
          status: 'scheduled',
        });
      },

      getAssignedWorkouts: (clientId) => {
        return get().assignedWorkouts.filter(w => w.userId === clientId);
      },

      addCalendarEvent: (event) => {
        const newEvent: CalendarEvent = {
          id: uuidv4(),
          ...event,
        };

        set(state => ({
          calendarEvents: [...state.calendarEvents, newEvent],
        }));
        // Sync to Supabase immediately
        syncCalendarEventToSupabase(newEvent);
      },

      updateCalendarEvent: (eventId, updates) => {
        set(state => ({
          calendarEvents: state.calendarEvents.map(e =>
            e.id === eventId ? { ...e, ...updates } : e
          ),
        }));
        // Sync to Supabase
        const updated = get().calendarEvents.find(e => e.id === eventId);
        if (updated) syncCalendarEventToSupabase(updated);
      },

      deleteCalendarEvent: (eventId) => {
        set(state => ({
          calendarEvents: state.calendarEvents.filter(e => e.id !== eventId),
        }));
        // Delete from Supabase
        deleteCalendarEventFromSupabase(eventId);
      },

      getEventsForDate: (date) => {
        return get().calendarEvents.filter(e => e.date.startsWith(date.substring(0, 10)));
      },

      getEventsForClient: (clientId) => {
        return get().calendarEvents.filter(e => e.clientId === clientId);
      },

      // Sessions
      addSession: (session) => {
        const newSession: ClientSession = {
          id: uuidv4(),
          ...session,
        };
        set(state => ({
          sessions: [...state.sessions, newSession],
        }));
        // Sync to Supabase for cross-device access
        syncTrainerSessionToSupabase(newSession);
        // totalSessions is now DERIVED from session records — no manual increment needed
      },

      updateSession: (sessionId, updates) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, ...updates } : s
          ),
        }));
        // Sync updated session to Supabase
        const updated = get().sessions.find(s => s.id === sessionId);
        if (updated) syncTrainerSessionToSupabase(updated);
      },

      getSessionsForClient: (clientId) => {
        return get().sessions.filter(s => s.clientId === clientId);
      },

      markSessionComplete: (sessionId, notes) => {
        // Check previous status BEFORE updating — only increment counter if transitioning to completed
        const prevSession = get().sessions.find(s => s.id === sessionId);
        const wasAlreadyCompleted = prevSession?.status === 'completed';
        
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId 
              ? { ...s, status: 'completed' as const, notes: notes || s.notes } 
              : s
          ),
        }));
        // Sync to Supabase
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          syncTrainerSessionToSupabase(session);
          // totalSessions is now DERIVED from session records — no manual increment needed
          // Still update package internal counter if one exists (informational only)
          if (session.type === 'pt_session' && !wasAlreadyCompleted) {
            const activePackage = get().sessionPackages.find(
              p => p.clientId === session.clientId && p.status === 'active'
            );
            if (activePackage) {
              get().useSessionFromPackage(activePackage.id);
            }
          }
          
          // Check trainer session count medals
          const trainerId = session.trainerId;
          if (trainerId) {
            setTimeout(() => {
              const sessionCount = get().sessions.filter(
                s => s.trainerId === trainerId && s.status === 'completed'
              ).length;
              const { earnMedal, medals } = useMedalStore.getState();
              
              // Build Set of earned medal IDs for O(1) lookup instead of repeated array scans
              const earned = new Set(
                medals.filter(m => m.earned && m.userId === trainerId).map(m => m.definitionId)
              );
              
              // Cascade medal earning for session count milestones
              const milestones: [number, string][] = [
                [1, 'trainer-first-session'],
                [25, 'trainer-25-sessions'],
                [100, 'trainer-100-sessions'],
                [500, 'trainer-500-sessions'],
                [1000, 'trainer-1000-sessions'],
              ];
              for (const [threshold, medalId] of milestones) {
                if (sessionCount >= threshold && !earned.has(medalId)) {
                  earnMedal(medalId, trainerId);
                }
              }
              console.log(`[Trainer Store] Checked session medals: ${sessionCount} sessions for trainer ${trainerId}`);
            }, 50);
          }
        }
      },

      markSessionPaid: (sessionId, paymentId) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, paid: true, paymentId } : s
          ),
        }));
        // Sync to Supabase
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) syncTrainerSessionToSupabase(session);
      },

      markSessionNoShow: (sessionId) => {
        // Check previous status BEFORE updating — only increment counter if transitioning
        const prevSession = get().sessions.find(s => s.id === sessionId);
        const wasAlreadyCounted = prevSession?.status === 'no_show' || prevSession?.status === 'completed';
        
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId 
              ? { ...s, status: 'no_show' as const } 
              : s
          ),
        }));
        // Sync to Supabase and still count no-show (no-show still uses a session)
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          syncTrainerSessionToSupabase(session);
          // totalSessions is now DERIVED from session records — no manual increment needed
          // Still update package internal counter if one exists (informational only)
          if (session.type === 'pt_session' && !wasAlreadyCounted) {
            const activePackage = get().sessionPackages.find(
              p => p.clientId === session.clientId && p.status === 'active'
            );
            if (activePackage) {
              get().useSessionFromPackage(activePackage.id);
            }
          }
        }
      },

      toggleSessionPaid: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const newPaidStatus = !session.paid;
        
        // Update session paid status
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, paid: newPaidStatus } : s
          ),
        }));
        
        // Update paidSessions count in the active package for this client
        const packages = get().sessionPackages.filter(p => p.clientId === session.clientId && p.status === 'active');
        const activePackage = packages[0];
        if (activePackage) {
          const currentPaid = activePackage.paidSessions || 0;
          const newPaidCount = newPaidStatus ? currentPaid + 1 : Math.max(0, currentPaid - 1);
          
          set(state => ({
            sessionPackages: state.sessionPackages.map(p =>
              p.id === activePackage.id ? { ...p, paidSessions: newPaidCount } : p
            ),
          }));
          
          // Sync package to Supabase
          const updatedPackage = get().sessionPackages.find(p => p.id === activePackage.id);
          if (updatedPackage) syncSessionPackageToSupabase(updatedPackage);
        }
        
        // Sync session to Supabase
        const updatedSession = get().sessions.find(s => s.id === sessionId);
        if (updatedSession) syncTrainerSessionToSupabase(updatedSession);
      },

      // Payments
      addPayment: (payment) => {
        const newPayment: ClientPayment = {
          id: uuidv4(),
          ...payment,
          // Ensure paidAt is set when status is 'paid'
          paidAt: payment.paidAt || (payment.status === 'paid' ? new Date().toISOString() : undefined),
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          payments: [...state.payments, newPayment],
        }));
        // Sync to Supabase immediately
        syncPaymentToSupabase(newPayment);
      },

      updatePayment: (paymentId, updates) => {
        set(state => ({
          payments: state.payments.map(p =>
            p.id === paymentId ? { ...p, ...updates } : p
          ),
        }));
        // Sync to Supabase
        const updated = get().payments.find(p => p.id === paymentId);
        if (updated) syncPaymentToSupabase(updated);
      },

      deletePayment: (paymentId) => {
        set(state => ({
          payments: state.payments.filter(p => p.id !== paymentId),
        }));
        // Sync delete to Supabase
        deletePaymentFromSupabase(paymentId);
      },

      getPaymentsForClient: (clientId) => {
        return get().payments.filter(p => p.clientId === clientId);
      },

      markPaymentPaid: (paymentId, method) => {
        set(state => ({
          payments: state.payments.map(p =>
            p.id === paymentId 
              ? { ...p, status: 'paid' as const, paidAt: new Date().toISOString(), method: method as any } 
              : p
          ),
        }));
        // Sync to Supabase
        const updated = get().payments.find(p => p.id === paymentId);
        if (updated) syncPaymentToSupabase(updated);
        
        // Check trainer revenue medals
        const payment = get().payments.find(p => p.id === paymentId);
        if (payment) {
          const trainerId = payment.trainerId;
          if (trainerId) {
            setTimeout(() => {
              const paidPayments = get().payments.filter(
                p => p.trainerId === trainerId && p.status === 'paid'
              );
              const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
              const { earnMedal, hasMedal } = useMedalStore.getState();
              
              // Cascade medal earning for revenue milestones
              if (totalRevenue >= 50000) {
                if (!hasMedal('trainer-50000-revenue', trainerId)) earnMedal('trainer-50000-revenue', trainerId);
                if (!hasMedal('trainer-10000-revenue', trainerId)) earnMedal('trainer-10000-revenue', trainerId);
                if (!hasMedal('trainer-2500-revenue', trainerId)) earnMedal('trainer-2500-revenue', trainerId);
                if (!hasMedal('trainer-500-revenue', trainerId)) earnMedal('trainer-500-revenue', trainerId);
                if (!hasMedal('trainer-first-payment', trainerId)) earnMedal('trainer-first-payment', trainerId);
              } else if (totalRevenue >= 10000) {
                if (!hasMedal('trainer-10000-revenue', trainerId)) earnMedal('trainer-10000-revenue', trainerId);
                if (!hasMedal('trainer-2500-revenue', trainerId)) earnMedal('trainer-2500-revenue', trainerId);
                if (!hasMedal('trainer-500-revenue', trainerId)) earnMedal('trainer-500-revenue', trainerId);
                if (!hasMedal('trainer-first-payment', trainerId)) earnMedal('trainer-first-payment', trainerId);
              } else if (totalRevenue >= 2500) {
                if (!hasMedal('trainer-2500-revenue', trainerId)) earnMedal('trainer-2500-revenue', trainerId);
                if (!hasMedal('trainer-500-revenue', trainerId)) earnMedal('trainer-500-revenue', trainerId);
                if (!hasMedal('trainer-first-payment', trainerId)) earnMedal('trainer-first-payment', trainerId);
              } else if (totalRevenue >= 500) {
                if (!hasMedal('trainer-500-revenue', trainerId)) earnMedal('trainer-500-revenue', trainerId);
                if (!hasMedal('trainer-first-payment', trainerId)) earnMedal('trainer-first-payment', trainerId);
              } else if (paidPayments.length >= 1) {
                if (!hasMedal('trainer-first-payment', trainerId)) earnMedal('trainer-first-payment', trainerId);
              }
              console.log(`[Trainer Store] Checked revenue medals: $${totalRevenue} total for trainer ${trainerId}`);
            }, 50);
          }
        }
      },

      // Session packages
      addSessionPackage: (pkg) => {
        const newPackage: SessionPackage = {
          id: uuidv4(),
          ...pkg,
          usedSessions: 0,
          remainingSessions: pkg.totalSessions,
        };
        set(state => ({
          sessionPackages: [...state.sessionPackages, newPackage],
        }));
        // Sync to Supabase
        syncSessionPackageToSupabase(newPackage);
      },

      useSessionFromPackage: (packageId) => {
        set(state => ({
          sessionPackages: state.sessionPackages.map(p => {
            if (p.id !== packageId) return p;
            
            // Handle continuous packages (remainingSessions === -1) or regular packages
            const isContinuous = p.remainingSessions === -1 || p.totalSessions === -1;
            if (isContinuous) {
              // Continuous package: just increment usedSessions, don't touch remainingSessions
              return { 
                ...p, 
                usedSessions: (p.usedSessions || 0) + 1,
              };
            } else {
              // Regular package: keep counting past 0 remaining (continuous tracking)
              // Don't mark as 'completed' — let sessions keep accumulating
              const newRemaining = Math.max(0, p.remainingSessions - 1);
              return { 
                ...p, 
                usedSessions: (p.usedSessions || 0) + 1, 
                remainingSessions: newRemaining,
              };
            }
          }),
        }));
        // Sync updated package to Supabase
        const updated = get().sessionPackages.find(p => p.id === packageId);
        if (updated) syncSessionPackageToSupabase(updated);
      },

      getPackagesForClient: (clientId) => {
        return get().sessionPackages.filter(p => p.clientId === clientId);
      },

      // Booking requests
      createBookingRequest: (request) => {
        const newRequest: BookingRequest = {
          id: uuidv4(),
          ...request,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          bookingRequests: [...state.bookingRequests, newRequest],
        }));
        // Sync to Supabase immediately
        syncBookingRequestToSupabase(newRequest);
        
        // Send notification to client
        useSocialStore.getState().addNotification({
          userId: request.clientId,
          type: 'workout_assigned',
          title: 'New Booking Request',
          message: `You have a new session request for ${request.date} at ${request.startTime}`,
          actionUrl: '/bookings',
        });
        
        return newRequest;
      },

      confirmBooking: (requestId, confirmedBy) => {
        const request = get().bookingRequests.find(r => r.id === requestId);
        if (!request) return;

        // Create calendar event with proper type mapping
        const eventId = uuidv4();
        const eventType = request.type === 'pt_session' ? 'session' : request.type;
        const eventTitle = request.type === 'pt_session' ? 'PT Session' 
          : request.type === 'consultation' ? 'Consultation'
          : 'Assessment';
        
        const newEvent: CalendarEvent = {
          id: eventId,
          title: eventTitle,
          type: eventType as any,
          date: request.date,
          startTime: request.startTime,
          endTime: request.endTime,
          clientId: request.clientId,
          trainerId: request.trainerId,
          notes: request.notes,
          status: 'scheduled',
        };

        set(state => ({
          bookingRequests: state.bookingRequests.map(r =>
            r.id === requestId
              ? { ...r, status: 'confirmed' as const, confirmedBy, respondedAt: new Date().toISOString(), calendarEventId: eventId }
              : r
          ),
          calendarEvents: [...state.calendarEvents, newEvent],
        }));
        
        // Sync to Supabase
        syncCalendarEventToSupabase(newEvent);
        const updatedRequest = get().bookingRequests.find(r => r.id === requestId);
        if (updatedRequest) syncBookingRequestToSupabase(updatedRequest);

        // Create session record — calculate actual duration from start/end times
        const calcDuration = (() => {
          const [sh, sm] = request.startTime.split(':').map(Number);
          const [eh, em] = request.endTime.split(':').map(Number);
          return (eh * 60 + em) - (sh * 60 + sm);
        })();
        get().addSession({
          trainerId: request.trainerId,
          clientId: request.clientId,
          date: request.date,
          startTime: request.startTime,
          endTime: request.endTime,
          duration: calcDuration > 0 ? calcDuration : 60,
          type: request.type,
          status: 'scheduled',
          paid: false,
        });

        // Notify the other party
        const notifyUserId = confirmedBy === 'trainer' ? request.clientId : request.trainerId;
        useSocialStore.getState().addNotification({
          userId: notifyUserId,
          type: 'workout_assigned',
          title: 'Booking Confirmed',
          message: `Your session on ${request.date} at ${request.startTime} has been confirmed`,
          actionUrl: '/calendar',
        });
      },

      declineBooking: (requestId) => {
        const request = get().bookingRequests.find(r => r.id === requestId);
        if (!request) return;

        set(state => ({
          bookingRequests: state.bookingRequests.map(r =>
            r.id === requestId
              ? { ...r, status: 'declined' as const, respondedAt: new Date().toISOString() }
              : r
          ),
        }));
        // Sync to Supabase
        const updated = get().bookingRequests.find(r => r.id === requestId);
        if (updated) syncBookingRequestToSupabase(updated);

        // Notify trainer
        useSocialStore.getState().addNotification({
          userId: request.trainerId,
          type: 'workout_assigned',
          title: 'Booking Declined',
          message: `Booking request for ${request.date} was declined`,
        });
      },

      cancelBooking: (requestId) => {
        set(state => ({
          bookingRequests: state.bookingRequests.map(r =>
            r.id === requestId
              ? { ...r, status: 'cancelled' as const, respondedAt: new Date().toISOString() }
              : r
          ),
        }));
        // Sync to Supabase
        const updated = get().bookingRequests.find(r => r.id === requestId);
        if (updated) syncBookingRequestToSupabase(updated);
      },

      getBookingRequestsForClient: (clientId) => {
        return get().bookingRequests.filter(r => r.clientId === clientId);
      },

      getPendingBookingRequests: () => {
        return get().bookingRequests.filter(r => r.status === 'pending');
      },

      // Client Programs
      addClientProgram: (program) => {
        // Deactivate any existing active programs for this client
        set(state => ({
          clientPrograms: [
            ...state.clientPrograms.map(p => 
              p.clientId === program.clientId && p.status === 'active'
                ? { ...p, status: 'completed' as const, endDate: new Date().toISOString() }
                : p
            ),
            program,
          ],
        }));
        // Sync to Supabase
        syncClientProgramToSupabase(program);
        // Also sync any deactivated programs
        get().clientPrograms
          .filter(p => p.clientId === program.clientId && p.status === 'completed')
          .forEach(p => syncClientProgramToSupabase(p));
      },

      updateClientProgram: (programId, updates) => {
        set(state => ({
          clientPrograms: state.clientPrograms.map(p =>
            p.id === programId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
        // Sync to Supabase
        const updated = get().clientPrograms.find(p => p.id === programId);
        if (updated) syncClientProgramToSupabase(updated);
      },

      deleteClientProgram: (programId) => {
        set(state => ({
          clientPrograms: state.clientPrograms.filter(p => p.id !== programId),
        }));
      },

      getClientPrograms: (clientId) => {
        return get().clientPrograms.filter(p => p.clientId === clientId);
      },

      getActiveProgram: (clientId) => {
        return get().clientPrograms.find(p => p.clientId === clientId && p.status === 'active');
      },

      getNextProgramWorkout: (userId) => {
        const program = get().clientPrograms.find(p => p.clientId === userId && p.status === 'active');
        if (!program || !program.weeklyPlan?.length) return null;
        
        const freq = program.trainingDaysPerWeek || program.weeklyPlan.length;
        const programPrefix = `program-${program.id}-`;
        
        // Count completed program workouts this week (Mon-Sun)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() + mondayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        const { workoutHistory } = useWorkoutStore.getState();
        
        // Only count workouts that belong to THIS program
        const programWorkoutsThisWeek = workoutHistory.filter(w => {
          if (w.userId !== userId || w.status !== 'completed' || w.deletedAt) return false;
          if (!w.templateId?.startsWith(programPrefix)) return false;
          const d = new Date(w.startTime);
          return d >= weekStart && d < weekEnd;
        });
        const completedThisWeek = programWorkoutsThisWeek.length;
        
        // Track which day indices were completed this week
        const completedDayIndices = programWorkoutsThisWeek.map(w => {
          const suffix = w.templateId?.replace(programPrefix, '') || '';
          return parseInt(suffix) || 0;
        });
        
        const remainingThisWeek = Math.max(0, freq - completedThisWeek);
        
        // Compute cycle position from total lifetime program-specific completions
        const programStart = program.startDate ? new Date(program.startDate) : new Date(program.createdAt);
        const totalCompleted = workoutHistory.filter(w => {
          if (w.userId !== userId || w.status !== 'completed' || w.deletedAt) return false;
          if (!w.templateId?.startsWith(programPrefix)) return false;
          const d = new Date(w.startTime);
          return d >= programStart;
        }).length;
        
        const dayIndex = totalCompleted % program.weeklyPlan.length;
        const day = program.weeklyPlan[dayIndex];
        
        // Determine session type from PT map
        const slotInWeek = completedThisWeek % freq;
        const sessionType = program.sessionPTMap?.[slotInWeek] === 'pt' ? 'pt' : 'personal';
        
        return { program, dayIndex, day, remainingThisWeek, sessionType, completedDayIndices };
      },

      // Client Profiles
      saveClientProfile: (profile) => {
        set(state => ({
          clientProfiles: [
            ...state.clientProfiles.filter(p => p.clientId !== profile.clientId),
            profile,
          ],
        }));
        syncClientProfileToSupabase(profile);
      },

      getClientProfile: (clientId) => {
        return get().clientProfiles.find(p => p.clientId === clientId);
      },

      // Set initial stats for onboarding existing clients
      setInitialClientStats: (clientId, sessionsDone, sessionsLeft, totalPaid) => {
        const trainerId = useAuthStore.getState().user?.id || '';
        
        // Create completed sessions records
        for (let i = 0; i < sessionsDone; i++) {
          const session: ClientSession = {
            id: uuidv4(),
            clientId,
            trainerId,
            date: new Date().toISOString(),
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 60,
            type: 'pt_session',
            status: 'completed',
            paid: true,
            notes: 'Historical session (pre-app)',
          };
          set(state => ({
            sessions: [...state.sessions, session],
          }));
        }
        
        // Create session package for remaining sessions
        if (sessionsLeft > 0) {
          const pkg: SessionPackage = {
            id: uuidv4(),
            clientId,
            trainerId,
            name: 'Imported Package',
            totalSessions: sessionsLeft,
            usedSessions: 0,
            paidSessions: sessionsLeft, // Assume all sessions paid
            remainingSessions: sessionsLeft,
            priceTotal: totalPaid > 0 ? totalPaid : 0,
            pricePerSession: totalPaid > 0 && sessionsLeft > 0 ? totalPaid / sessionsLeft : 0,
            purchaseDate: new Date().toISOString(),
            paymentId: '',
            status: 'active',
          };
          set(state => ({
            sessionPackages: [...state.sessionPackages, pkg],
          }));
        }
        
        // Set stored counters directly on client record
        get().updateClient(clientId, {
          totalSessions: sessionsDone,
          totalPaid: sessionsLeft > 0 ? sessionsLeft : 0, // sessionsLeft assumed already paid
        });
        
        // Create payment record for total paid
        if (totalPaid > 0) {
          const payment: ClientPayment = {
            id: uuidv4(),
            clientId,
            trainerId,
            amount: totalPaid,
            description: 'Historical payments (pre-app)',
            type: 'session_pack',
            status: 'paid',
            method: 'cash',
            paidAt: new Date().toISOString(),
            currency: 'USD',
            createdAt: new Date().toISOString(),
          };
          set(state => ({
            payments: [...state.payments, payment],
          }));
        }
      },

      // Client-facing session functions
      loadClientDataFromSupabase: async (clientId) => {
        console.log('[Trainer Store] 🔄 Loading client data from Supabase for:', clientId);
        try {
          const [programs, events, notifications] = await Promise.all([
            import('./supabaseSync').then(m => m.fetchClientProgramsForUser(clientId)),
            import('./supabaseSync').then(m => m.fetchCalendarEventsForUser(clientId)),
            import('./supabaseSync').then(m => m.fetchNotificationsFromSupabase(clientId)),
          ]);
          
          const currentPrograms = get().clientPrograms;
          const currentEvents = get().calendarEvents;
          
          // Merge: add programs not already in local store
          const newPrograms = programs.filter(
            (p: any) => !currentPrograms.find(cp => cp.id === p.id)
          );
          // Update existing programs with fresh Supabase data
          const updatedPrograms = currentPrograms.map(cp => {
            const fresh = programs.find((p: any) => p.id === cp.id);
            return fresh ? { ...cp, ...fresh } : cp;
          });
          
          // Merge events: add new, update existing
          const newEvents = events.filter(
            (e: any) => !currentEvents.find(ce => ce.id === e.id)
          );
          const updatedEvents = currentEvents.map(ce => {
            const fresh = events.find((e: any) => e.id === ce.id);
            return fresh ? { ...ce, ...fresh } : ce;
          });
          
          set({
            clientPrograms: [...updatedPrograms, ...newPrograms],
            calendarEvents: [...updatedEvents, ...newEvents],
          });
          
          // Load notifications into social store for this client
          if (notifications.length > 0) {
            const currentNotifications = useSocialStore.getState().notifications;
            const newNotifications = notifications.filter(
              (sn: any) => !currentNotifications.find(ln => ln.id === sn.id)
            );
            // Update existing with Supabase data
            const updatedNotifications = currentNotifications.map(ln => {
              const fresh = notifications.find((sn: any) => sn.id === ln.id);
              return fresh ? { ...ln, ...fresh } : ln;
            });
            useSocialStore.setState({
              notifications: [...updatedNotifications, ...newNotifications],
            });
            console.log(`[Trainer Store] ✅ Client notifications loaded: ${notifications.length} from Supabase`);
          }
          
          console.log(`[Trainer Store] ✅ Client data loaded: ${programs.length} programs, ${events.length} events`);
        } catch (e) {
          console.error('[Trainer Store] Error loading client data:', e);
        }
      },

      getScheduledSessionsForUser: (userId) => {
        // Get calendar events where this user is the client
        return get().calendarEvents.filter(e => 
          e.clientId === userId && 
          e.status === 'scheduled'
        );
      },

      confirmSession: (eventId) => {
        set(state => ({
          calendarEvents: state.calendarEvents.map(e =>
            e.id === eventId
              ? { ...e, clientConfirmed: true, clientConfirmedAt: new Date().toISOString() }
              : e
          ),
        }));
      },

      // Session workouts (created in builder)
      addSessionWorkout: (workout) => {
        // Add trainerId if not present
        const trainerId = useAuthStore.getState().user?.id;
        const workoutWithTrainer = { ...workout, trainerId: workout.trainerId || trainerId };
        
        set(state => ({
          sessionWorkouts: [...state.sessionWorkouts, workoutWithTrainer],
        }));
        
        // Sync to Supabase immediately
        syncSessionWorkoutToSupabase(workoutWithTrainer);
      },

      getSessionWorkout: (workoutId) => {
        return get().sessionWorkouts.find(w => w.id === workoutId);
      },

      getSessionWorkoutsForClient: (clientId) => {
        return get().sessionWorkouts.filter(w => w.clientId === clientId);
      },

      deleteSessionWorkout: (workoutId) => {
        set(state => ({
          sessionWorkouts: state.sessionWorkouts.filter(w => w.id !== workoutId),
        }));
        // Delete from Supabase
        deleteSessionWorkoutFromSupabase(workoutId);
      },

      updateSessionWorkout: (workoutId, updates) => {
        set(state => ({
          sessionWorkouts: state.sessionWorkouts.map(w => 
            w.id === workoutId ? { ...w, ...updates } : w
          ),
        }));
        // Sync updated workout to Supabase
        const updated = get().sessionWorkouts.find(w => w.id === workoutId);
        if (updated) syncSessionWorkoutToSupabase(updated);
      },

      // Workout Library
      saveToWorkoutLibrary: (workout) => {
        const trainerId = useAuthStore.getState().user?.id || '';
        const newWorkout: SavedWorkout = {
          ...workout,
          id: uuidv4(),
          trainerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(state => ({
          workoutLibrary: [...state.workoutLibrary, newWorkout],
        }));
        // Sync to Supabase
        syncWorkoutLibraryToSupabase(newWorkout);
        return newWorkout;
      },

      updateWorkoutInLibrary: (workoutId, updates) => {
        set(state => ({
          workoutLibrary: state.workoutLibrary.map(w => 
            w.id === workoutId ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
          ),
        }));
        // Sync to Supabase
        const updated = get().workoutLibrary.find(w => w.id === workoutId);
        if (updated) syncWorkoutLibraryToSupabase(updated);
      },

      deleteFromWorkoutLibrary: (workoutId) => {
        set(state => ({
          workoutLibrary: state.workoutLibrary.filter(w => w.id !== workoutId),
        }));
        // Delete from Supabase
        deleteWorkoutLibraryFromSupabase(workoutId);
      },

      getWorkoutFromLibrary: (workoutId) => {
        return get().workoutLibrary.find(w => w.id === workoutId);
      },

      // Circuit Library
      saveCircuitTemplate: (circuit) => {
        const trainerId = useAuthStore.getState().user?.id || '';
        const newCircuit: CircuitTemplate = {
          ...circuit,
          id: uuidv4(),
          trainerId,
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          circuitLibrary: [...state.circuitLibrary, newCircuit],
        }));
        // Sync to Supabase
        syncCircuitLibraryToSupabase(newCircuit);
        return newCircuit;
      },

      updateCircuitTemplate: (circuitId, updates) => {
        set(state => ({
          circuitLibrary: state.circuitLibrary.map(c => 
            c.id === circuitId ? { ...c, ...updates } : c
          ),
        }));
        // Sync to Supabase
        const updated = get().circuitLibrary.find(c => c.id === circuitId);
        if (updated) syncCircuitLibraryToSupabase(updated);
      },

      deleteCircuitTemplate: (circuitId) => {
        set(state => ({
          circuitLibrary: state.circuitLibrary.filter(c => c.id !== circuitId),
        }));
        // Delete from Supabase
        deleteCircuitLibraryFromSupabase(circuitId);
      },

      getCircuitTemplate: (circuitId) => {
        return get().circuitLibrary.find(c => c.id === circuitId);
      },

      // Block Library
      saveBlock: (block) => {
        const trainerId = useAuthStore.getState().user?.id || '';
        const newBlock: SavedBlock = {
          ...block,
          id: uuidv4(),
          trainerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(state => ({
          savedBlocks: [...state.savedBlocks, newBlock],
        }));
        // Sync to Supabase for cross-device access
        import('./supabaseSync').then(async ({ syncSavedBlockToSupabase }) => {
          console.log('[Store] Syncing new block to Supabase:', newBlock.id, newBlock.name);
          const success = await syncSavedBlockToSupabase({
            id: newBlock.id,
            name: newBlock.name,
            type: newBlock.type,
            trainerId: newBlock.trainerId,
            exercises: newBlock.exercises,
            circuitStyle: newBlock.circuitStyle,
            circuitRounds: newBlock.circuitRounds,
            circuitDuration: newBlock.circuitDuration,
            circuitRestBetween: newBlock.circuitRestBetween,
            createdAt: newBlock.createdAt,
            updatedAt: newBlock.updatedAt,
          });
          console.log('[Store] Block sync result:', success);
        }).catch(err => console.error('[Store] Error importing supabaseSync:', err));
        return newBlock;
      },

      updateBlock: (blockId, updates) => {
        set(state => ({
          savedBlocks: state.savedBlocks.map(b =>
            b.id === blockId ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
          ),
        }));
        // Sync updated block to Supabase
        const updated = get().savedBlocks.find(b => b.id === blockId);
        if (updated) {
          import('./supabaseSync').then(async ({ syncSavedBlockToSupabase }) => {
            console.log('[Store] Syncing updated block to Supabase:', updated.id, updated.name);
            const success = await syncSavedBlockToSupabase({
              id: updated.id,
              name: updated.name,
              type: updated.type,
              trainerId: updated.trainerId,
              exercises: updated.exercises,
              circuitStyle: updated.circuitStyle,
              circuitRounds: updated.circuitRounds,
              circuitDuration: updated.circuitDuration,
              circuitRestBetween: updated.circuitRestBetween,
              createdAt: updated.createdAt,
              updatedAt: updated.updatedAt,
            });
            console.log('[Store] Block update sync result:', success);
          }).catch(err => console.error('[Store] Error syncing updated block:', err));
        }
      },

      deleteBlock: (blockId) => {
        set(state => ({
          savedBlocks: state.savedBlocks.filter(b => b.id !== blockId),
        }));
        // Delete from Supabase
        import('./supabaseSync').then(({ deleteSavedBlockFromSupabase }) => {
          deleteSavedBlockFromSupabase(blockId);
        });
      },

      getBlock: (blockId) => {
        return get().savedBlocks.find(b => b.id === blockId);
      },

      getBlocksByType: (type) => {
        const trainerId = useAuthStore.getState().user?.id;
        return get().savedBlocks.filter(b => b.type === type && b.trainerId === trainerId);
      },

      // Block Performance Tracking
      recordBlockPerformance: (performance) => {
        const newPerformance: BlockPerformance = {
          ...performance,
          id: uuidv4(),
          performedAt: new Date().toISOString(),
        };
        set(state => ({
          blockPerformances: [...state.blockPerformances, newPerformance],
        }));
        // Sync to Supabase
        import('./supabaseSync').then(async ({ syncBlockPerformanceToSupabase }) => {
          console.log('[Store] Syncing block performance to Supabase:', newPerformance.id, newPerformance.blockName);
          await syncBlockPerformanceToSupabase({
            id: newPerformance.id,
            blockId: newPerformance.blockId,
            blockName: newPerformance.blockName,
            blockType: newPerformance.blockType,
            clientId: newPerformance.clientId,
            trainerId: newPerformance.trainerId,
            workoutId: newPerformance.workoutId,
            completionTime: newPerformance.completionTime,
            roundsCompleted: newPerformance.roundsCompleted,
            roundTimes: newPerformance.roundTimes,
            totalVolume: newPerformance.totalVolume,
            exerciseStats: newPerformance.exerciseStats,
            performedAt: newPerformance.performedAt,
            notes: newPerformance.notes,
          });
        }).catch(err => console.error('[Store] Error syncing block performance:', err));
        return newPerformance;
      },

      getBlockPerformances: (blockId, clientId) => {
        const performances = get().blockPerformances.filter(p => p.blockId === blockId);
        if (clientId) {
          return performances.filter(p => p.clientId === clientId);
        }
        return performances;
      },

      getBestBlockPerformance: (blockId, clientId) => {
        const performances = get().blockPerformances.filter(
          p => p.blockId === blockId && p.clientId === clientId
        );
        if (performances.length === 0) return undefined;
        
        // For timed circuits, best is lowest time
        // For rounds, best is highest rounds
        // For strength, best is highest volume
        return performances.reduce((best, current) => {
          if (current.completionTime && best.completionTime) {
            return current.completionTime < best.completionTime ? current : best;
          }
          if (current.roundsCompleted && best.roundsCompleted) {
            return current.roundsCompleted > best.roundsCompleted ? current : best;
          }
          if (current.totalVolume && best.totalVolume) {
            return current.totalVolume > best.totalVolume ? current : best;
          }
          return best;
        });
      },

      // Load trainer data from Supabase for cross-device sync
      // OPTION 2: SUPABASE IS THE PRIMARY SOURCE OF TRUTH
      // This REPLACES localStorage data with Supabase data (no merge of old localStorage)
      loadFromSupabase: async (trainerId: string) => {
        console.log('[Trainer Store] 🔄 Loading ALL data from Supabase (REPLACING localStorage):', trainerId);
        
        // Fetch ALL data from Supabase in parallel
        const [
          supabaseClients,
          supabaseSessions,
          supabasePackages,
          supabaseCalendarEvents,
          supabasePayments,
          supabasePrograms,
          supabaseBookings,
          supabaseSessionWorkouts,
          supabaseWorkoutLibrary,
          supabaseCircuitLibrary,
          supabaseSavedBlocks,
          supabaseBlockPerformances,
          supabaseClientProfiles,
        ] = await Promise.all([
          fetchTrainerClientsFromSupabase(trainerId),
          fetchTrainerSessionsFromSupabase(trainerId),
          fetchSessionPackagesFromSupabase(trainerId),
          fetchCalendarEventsFromSupabase(trainerId),
          fetchPaymentsFromSupabase(trainerId),
          fetchClientProgramsFromSupabase(trainerId),
          fetchBookingRequestsFromSupabase(trainerId),
          fetchSessionWorkoutsFromSupabase(trainerId),
          fetchWorkoutLibraryFromSupabase(trainerId),
          fetchCircuitLibraryFromSupabase(trainerId),
          fetchSavedBlocksFromSupabase(trainerId),
          fetchBlockPerformancesFromSupabase(trainerId),
          fetchClientProfilesFromSupabase(trainerId),
        ]);
        
        // SUPABASE IS THE ONLY SOURCE OF TRUTH
        // Map Supabase data to local format, preserving local counters if Supabase has null
        const currentClients = get().clients;
        const clients: TrainerClient[] = supabaseClients.map((sb: any) => {
          const localClient = currentClients.find(c => c.clientId === sb.clientId);
          return {
            id: sb.id,
            trainerId: sb.trainerId,
            clientId: sb.clientId,
            status: sb.status || 'active',
            startDate: sb.startDate,
            onboardingComplete: sb.onboardingComplete,
            notes: sb.notes,
            goals: sb.goals,
            // Stored counters: use Supabase value if it exists, otherwise preserve local value
            totalSessions: sb.totalSessions ?? localClient?.totalSessions ?? 0,
            totalPaid: sb.totalPaid ?? localClient?.totalPaid ?? 0,
            totalSessionsOffset: sb.totalSessionsOffset,
            totalPaidOffset: sb.totalPaidOffset,
          };
        });
        const localOnlyClients = currentClients.filter(
          localClient => !clients.find(sbClient => sbClient.clientId === localClient.clientId)
        );
        // Re-sync local-only clients to Supabase
        localOnlyClients.forEach(client => {
          syncTrainerClientToSupabase(client);
        });
        
        // Merge calendar events: preserve workoutId from local if Supabase doesn't have it
        // This prevents losing workout links during sync race conditions
        const currentCalendarEvents = get().calendarEvents;
        const mergedCalendarEvents = supabaseCalendarEvents.map((sbEvent: any) => {
          const localEvent = currentCalendarEvents.find(e => e.id === sbEvent.id);
          // If local has workoutId but Supabase doesn't, preserve local workoutId
          if (localEvent?.workoutId && !sbEvent.workoutId) {
            // Also re-sync to Supabase to fix the data
            const merged = { ...sbEvent, workoutId: localEvent.workoutId };
            syncCalendarEventToSupabase(merged);
            return merged;
          }
          return sbEvent;
        });
        
        // Also include local events that don't exist in Supabase yet (newly created)
        const localOnlyEvents = currentCalendarEvents.filter(
          localEvent => !supabaseCalendarEvents.find((sbEvent: any) => sbEvent.id === localEvent.id)
        );
        // Sync these to Supabase
        localOnlyEvents.forEach(event => syncCalendarEventToSupabase(event));
        
        // Same for session workouts - preserve local ones not yet synced
        const currentSessionWorkouts = get().sessionWorkouts;
        const localOnlyWorkouts = currentSessionWorkouts.filter(
          localWorkout => !supabaseSessionWorkouts.find((sbWorkout: any) => sbWorkout.id === localWorkout.id)
        );
        localOnlyWorkouts.forEach(workout => syncSessionWorkoutToSupabase(workout));
        
        // Map saved blocks from Supabase to local format
        // Note: fetchSavedBlocksFromSupabase returns 'type' not 'blockType'
        const savedBlocks: SavedBlock[] = (supabaseSavedBlocks || []).map((sb: any) => ({
          id: sb.id,
          trainerId: sb.trainerId,
          name: sb.name,
          type: (sb.type || sb.blockType || 'work') as BlockType,
          exercises: sb.exercises || [],
          circuitStyle: sb.circuitStyle,
          circuitRounds: sb.circuitRounds,
          circuitDuration: sb.circuitDuration,
          circuitRestBetween: sb.circuitRestBetween,
          folder: sb.folder,
          createdAt: sb.createdAt,
          updatedAt: sb.updatedAt,
        }));
        
        // Merge with local blocks not yet synced
        const currentSavedBlocks = get().savedBlocks;
        const localOnlyBlocks = currentSavedBlocks.filter(
          localBlock => !savedBlocks.find(sbBlock => sbBlock.id === localBlock.id)
        );
        // Sync local-only blocks to Supabase
        localOnlyBlocks.forEach(block => {
          import('./supabaseSync').then(({ syncSavedBlockToSupabase }) => {
            syncSavedBlockToSupabase(block);
          });
        });
        
        // Map block performances from Supabase
        const blockPerformances: BlockPerformance[] = (supabaseBlockPerformances || []).map((bp: any) => ({
          id: bp.id,
          blockId: bp.blockId,
          blockName: bp.blockName,
          blockType: bp.blockType || 'circuit',
          clientId: bp.clientId,
          trainerId: bp.trainerId,
          workoutId: bp.workoutId,
          completionTime: bp.completionTime,
          totalVolume: bp.totalVolume,
          exerciseStats: bp.exerciseStats,
          performedAt: bp.performedAt,
          notes: bp.notes,
        }));
        
        // Merge client profiles: preserve local-only
        const currentProfiles = get().clientProfiles;
        const localOnlyProfiles = currentProfiles.filter(
          lp => !supabaseClientProfiles.find((sp: any) => sp.clientId === lp.clientId)
        );
        localOnlyProfiles.forEach(p => syncClientProfileToSupabase(p));
        
        // REPLACE localStorage with merged Supabase data
        set({
          clients: [...clients, ...localOnlyClients],
          sessions: supabaseSessions,
          sessionPackages: supabasePackages,
          calendarEvents: [...mergedCalendarEvents, ...localOnlyEvents],
          payments: supabasePayments,
          clientPrograms: (() => {
            const currentPrograms = get().clientPrograms;
            // Merge: Supabase programs with local scheduling fields preserved
            const merged = supabasePrograms.map((sbProg: any) => {
              const localProg = currentPrograms.find((lp: any) => lp.id === sbProg.id);
              // If Supabase lost trainingDaysPerWeek but local has it, preserve local
              if (localProg && localProg.trainingDaysPerWeek && !sbProg.trainingDaysPerWeek) {
                const restored = { ...sbProg, trainingDaysPerWeek: localProg.trainingDaysPerWeek, scheduleMode: localProg.scheduleMode, selectedDays: localProg.selectedDays, cycleAcrossWeeks: localProg.cycleAcrossWeeks, sessionPTMap: localProg.sessionPTMap, nextWorkoutIndex: localProg.nextWorkoutIndex, autoRepeat: localProg.autoRepeat, sessionType: localProg.sessionType };
                syncClientProgramToSupabase(restored);
                return restored;
              }
              return sbProg;
            });
            // Also keep local-only programs not yet in Supabase
            const localOnly = currentPrograms.filter(
              (lp: any) => !supabasePrograms.find((sp: any) => sp.id === lp.id)
            );
            localOnly.forEach((p: any) => syncClientProgramToSupabase(p));
            return [...merged, ...localOnly];
          })(),
          bookingRequests: supabaseBookings,
          sessionWorkouts: [...supabaseSessionWorkouts, ...localOnlyWorkouts],
          workoutLibrary: supabaseWorkoutLibrary,
          circuitLibrary: supabaseCircuitLibrary,
          savedBlocks: [...savedBlocks, ...localOnlyBlocks],
          blockPerformances,
          clientProfiles: [...supabaseClientProfiles, ...localOnlyProfiles],
        });
        
        console.log(`[Trainer Store] ✅ REPLACED localStorage with Supabase data:`, {
          clients: clients.length,
          sessions: supabaseSessions.length,
          packages: supabasePackages.length,
          calendarEvents: supabaseCalendarEvents.length,
          payments: supabasePayments.length,
          programs: supabasePrograms.length,
          bookings: supabaseBookings.length,
          sessionWorkouts: supabaseSessionWorkouts.length,
          workoutLibrary: supabaseWorkoutLibrary.length,
          circuitLibrary: supabaseCircuitLibrary.length,
          savedBlocks: savedBlocks.length + localOnlyBlocks.length,
          clientProfiles: supabaseClientProfiles.length + localOnlyProfiles.length,
        });
        
        // Also load workout history for all clients
        await useWorkoutStore.getState().loadWorkoutHistoryFromSupabase(trainerId, true);
        
        // Load user-created workout templates from Supabase
        const supabaseTemplates = await fetchWorkoutTemplatesFromSupabase(trainerId);
        if (supabaseTemplates.length > 0) {
          const currentTemplates = useWorkoutStore.getState().templates;
          const localOnlyTemplates = currentTemplates.filter(
            lt => !supabaseTemplates.find((st: any) => st.id === lt.id)
          );
          localOnlyTemplates.forEach(t => syncWorkoutTemplateToSupabase(t));
          useWorkoutStore.setState({ templates: [...supabaseTemplates, ...localOnlyTemplates] });
          console.log(`[Trainer Store] ✅ Templates loaded: ${supabaseTemplates.length} from Supabase, ${localOnlyTemplates.length} local-only`);
        }
        
        // Load notifications from Supabase into social store
        const supabaseNotifications = await fetchNotificationsFromSupabase(trainerId);
        if (supabaseNotifications.length > 0) {
          const currentNotifications = useSocialStore.getState().notifications;
          // Merge: Supabase as source of truth, keep local-only notifications
          const localOnlyNotifications = currentNotifications.filter(
            ln => !supabaseNotifications.find((sn: any) => sn.id === ln.id)
          );
          // Sync local-only to Supabase
          localOnlyNotifications.forEach(n => {
            import('./supabaseSync').then(({ syncNotificationToSupabase }) => {
              syncNotificationToSupabase(n);
            });
          });
          useSocialStore.setState({ 
            notifications: [...supabaseNotifications, ...localOnlyNotifications] 
          });
          console.log(`[Trainer Store] ✅ Notifications loaded: ${supabaseNotifications.length} from Supabase, ${localOnlyNotifications.length} local-only`);
        }
      },

      // Update session package (for editing total, price, etc.)
      updateSessionPackage: (packageId: string, updates: Partial<SessionPackage>) => {
        // Find the existing package first
        const existingPackage = get().sessionPackages.find(p => p.id === packageId);
        if (!existingPackage) {
          console.error('[Store] Package not found:', packageId);
          return;
        }
        
        // Create the updated package
        const updatedPackage: SessionPackage = { ...existingPackage, ...updates };
        
        // Update state
        set(state => ({
          sessionPackages: state.sessionPackages.map(p =>
            p.id === packageId ? updatedPackage : p
          ),
        }));
        
        // Sync to Supabase immediately with the updated data
        console.log('[Store] Updating package:', packageId, updates);
        syncSessionPackageToSupabase(updatedPackage);
      },

      // Client Groups
      addClientGroup: (group) => {
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return {} as ClientGroup;
        
        const newGroup: ClientGroup = {
          id: uuidv4(),
          ...group,
          trainerId,
          createdAt: new Date().toISOString(),
        };
        
        set(state => ({
          clientGroups: [...state.clientGroups, newGroup],
        }));
        
        return newGroup;
      },

      updateClientGroup: (groupId, updates) => {
        set(state => ({
          clientGroups: state.clientGroups.map(g =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        }));
      },

      deleteClientGroup: (groupId) => {
        set(state => ({
          clientGroups: state.clientGroups.filter(g => g.id !== groupId),
        }));
      },

      getClientGroup: (groupId) => {
        return get().clientGroups.find(g => g.id === groupId);
      },

      addMemberToGroup: (groupId, clientId) => {
        set(state => ({
          clientGroups: state.clientGroups.map(g =>
            g.id === groupId && !g.memberIds.includes(clientId)
              ? { ...g, memberIds: [...g.memberIds, clientId] }
              : g
          ),
        }));
      },

      removeMemberFromGroup: (groupId, clientId) => {
        set(state => ({
          clientGroups: state.clientGroups.map(g =>
            g.id === groupId
              ? { ...g, memberIds: g.memberIds.filter(id => id !== clientId) }
              : g
          ),
        }));
      },

      checkAndAwardTrainerMedals: (trainerId: string) => {
        const { earnMedal, hasMedal } = useMedalStore.getState();
        const state = get();
        
        // Count clients
        const clientCount = state.clients.filter(c => c.trainerId === trainerId).length;
        
        // Count completed sessions
        const sessionCount = state.sessions.filter(s => s.trainerId === trainerId && s.status === 'completed').length;
        
        // Calculate total revenue from paid payments
        const totalRevenue = state.payments
          .filter(p => p.trainerId === trainerId && p.status === 'paid')
          .reduce((sum, p) => sum + p.amount, 0);
        
        console.log(`[Trainer Store] Checking medals for trainer ${trainerId}: ${clientCount} clients, ${sessionCount} sessions, $${totalRevenue} revenue`);
        
        // Award client medals
        if (clientCount >= 50 && !hasMedal('trainer-50-clients', trainerId)) earnMedal('trainer-50-clients', trainerId);
        if (clientCount >= 25 && !hasMedal('trainer-25-clients', trainerId)) earnMedal('trainer-25-clients', trainerId);
        if (clientCount >= 10 && !hasMedal('trainer-10-clients', trainerId)) earnMedal('trainer-10-clients', trainerId);
        if (clientCount >= 5 && !hasMedal('trainer-5-clients', trainerId)) earnMedal('trainer-5-clients', trainerId);
        if (clientCount >= 1 && !hasMedal('trainer-first-client', trainerId)) earnMedal('trainer-first-client', trainerId);
        
        // Award session medals
        if (sessionCount >= 1000 && !hasMedal('trainer-1000-sessions', trainerId)) earnMedal('trainer-1000-sessions', trainerId);
        if (sessionCount >= 500 && !hasMedal('trainer-500-sessions', trainerId)) earnMedal('trainer-500-sessions', trainerId);
        if (sessionCount >= 100 && !hasMedal('trainer-100-sessions', trainerId)) earnMedal('trainer-100-sessions', trainerId);
        if (sessionCount >= 25 && !hasMedal('trainer-25-sessions', trainerId)) earnMedal('trainer-25-sessions', trainerId);
        if (sessionCount >= 1 && !hasMedal('trainer-first-session', trainerId)) earnMedal('trainer-first-session', trainerId);
        
        // Award revenue medals
        if (totalRevenue >= 50000 && !hasMedal('trainer-50000-revenue', trainerId)) earnMedal('trainer-50000-revenue', trainerId);
        if (totalRevenue >= 10000 && !hasMedal('trainer-10000-revenue', trainerId)) earnMedal('trainer-10000-revenue', trainerId);
        if (totalRevenue >= 2500 && !hasMedal('trainer-2500-revenue', trainerId)) earnMedal('trainer-2500-revenue', trainerId);
        if (totalRevenue >= 500 && !hasMedal('trainer-500-revenue', trainerId)) earnMedal('trainer-500-revenue', trainerId);
        if (totalRevenue >= 1 && !hasMedal('trainer-first-payment', trainerId)) earnMedal('trainer-first-payment', trainerId);
        
        console.log(`[Trainer Store] ✅ Trainer medals check complete`);
      },
    }),
    {
      name: 'apex-trainer',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ============ MEDALS STORE ============
interface MedalState {
  medals: Medal[];
  evolvingMedalProgress: Record<string, number>; // medalId -> progress
  strengthRating: StrengthRating | null;
  
  // Medal actions
  earnMedal: (definitionId: string, forUserId?: string) => void;
  updateEvolvingMedalProgress: (medalId: string, progress: number) => void;
  getMedalsByCategory: (category: Medal['category']) => Medal[];
  getMedalsForUser: (userId: string) => Medal[];
  hasMedal: (definitionId: string, userId?: string) => boolean;
  revokeMedalsForUser: (userId: string) => void;
  clearMedalsForUser: (userId: string) => void;
  clearAllMedals: () => void;
  
  // Strength rating
  calculateStrengthRating: () => void;
  calculateStrengthRatingForUser: (userId: string) => StrengthRating | null;
  getStrengthRating: () => StrengthRating | null;
}

export const useMedalStore = create<MedalState>()(
  persist(
    (set, get) => ({
      medals: [],
      evolvingMedalProgress: {},
      strengthRating: null,

      earnMedal: (definitionId, forUserId?: string) => {
        const userId = forUserId || useAuthStore.getState().user?.id || '';
        const existingMedal = get().medals.find(m => m.definitionId === definitionId && m.userId === userId);
        
        // If already earned, increment timesEarned counter and update evolution
        if (existingMedal?.earned) {
          const { getEvolutionGlowTier, getEvolutionLabel } = require('./medals');
          const newTimesEarned = (existingMedal.timesEarned || 1) + 1;
          const oldEvolutionTier = existingMedal.evolutionTier || 'base';
          const newEvolutionTier = getEvolutionGlowTier(newTimesEarned, definitionId);
          const updatedMedal = {
            ...existingMedal,
            timesEarned: newTimesEarned,
            evolutionTier: newEvolutionTier,
          };
          set(state => ({
            medals: state.medals.map(m => 
              m.definitionId === definitionId && m.userId === userId ? updatedMedal : m
            ),
          }));
          syncMedalToSupabase(updatedMedal);
          return;
        }

        // Import medal definitions dynamically to avoid circular deps
        const { milestoneMedals } = require('./medals');
        const definition = milestoneMedals.find((m: any) => m.id === definitionId);
        if (!definition) return;
        
        const newMedal: Medal = {
          id: uuidv4(),
          userId,
          definitionId,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          tier: definition.tier,
          category: definition.category,
          rarity: definition.rarity,
          earned: true,
          earnedAt: new Date().toISOString(),
          progress: definition.target || 1,
          target: definition.target || 1,
          timesEarned: 1,
          evolutionTier: 'base',
        };

        set(state => ({
          medals: existingMedal 
            ? state.medals.map(m => m.definitionId === definitionId ? newMedal : m)
            : [...state.medals, newMedal],
        }));

        // Sync medal to Supabase
        syncMedalToSupabase(newMedal);
      },

      updateEvolvingMedalProgress: (medalId, progress) => {
        set(state => ({
          evolvingMedalProgress: {
            ...state.evolvingMedalProgress,
            [medalId]: progress,
          },
        }));
      },

      getMedalsByCategory: (category) => {
        return get().medals.filter(m => m.category === category);
      },

      getMedalsForUser: (userId: string) => {
        return get().medals.filter(m => m.userId === userId);
      },

      hasMedal: (definitionId, userId?: string) => {
        const targetUserId = userId || useAuthStore.getState().user?.id;
        return get().medals.some(m => m.definitionId === definitionId && m.earned && m.userId === targetUserId);
      },

      revokeMedalsForUser: (userId: string) => {
        // Silently clear all medals for user (used by deriveAll revoke-and-re-earn cycle)
        set(state => ({
          medals: state.medals.filter(m => m.userId !== userId),
        }));
      },

      clearMedalsForUser: (userId: string) => {
        set(state => ({
          medals: state.medals.filter(m => m.userId !== userId),
        }));
      },

      clearAllMedals: () => {
        set({ medals: [], evolvingMedalProgress: {} });
      },

      calculateStrengthRating: () => {
        const { personalBests } = useWorkoutStore.getState();
        const user = useAuthStore.getState().user;
        
        if (!user) {
          set({ strengthRating: null });
          return;
        }
        
        // Filter personal bests for the current user only
        const userPBs = personalBests.filter(pb => pb.userId === user.id);
        
        if (userPBs.length === 0) {
          set({ strengthRating: null });
          return;
        }

        const isMale = user.gender === 'male';
        
        // Use the new comprehensive strength rating calculation
        const { calculateFullStrengthRating } = require('./strengthRating');
        const rating = calculateFullStrengthRating(userPBs, isMale);

        set({ strengthRating: rating });
      },

      calculateStrengthRatingForUser: (userId: string) => {
        const { personalBests } = useWorkoutStore.getState();
        
        // Filter personal bests for the specified user
        const userPBs = personalBests.filter(pb => pb.userId === userId);
        
        if (userPBs.length === 0) {
          console.log(`[MedalStore] No PBs found for user ${userId}`);
          return null;
        }

        // Look up user gender - check current user first, then stored users
        const currentUser = useAuthStore.getState().user;
        let isMale = true; // Default
        
        if (currentUser?.id === userId) {
          isMale = currentUser.gender !== 'female';
        } else {
          // Check stored users (clients)
          try {
            const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
            const targetUser = storedUsers.find((u: any) => u.id === userId);
            if (targetUser?.gender === 'female') {
              isMale = false;
            }
          } catch (e) {
            console.error('[MedalStore] Error looking up user gender:', e);
          }
        }
        
        console.log(`[MedalStore] Calculating strength rating for ${userId} (${isMale ? 'male' : 'female'}), ${userPBs.length} PBs`);
        
        const { calculateFullStrengthRating } = require('./strengthRating');
        const rating = calculateFullStrengthRating(userPBs, isMale);
        
        // Store in state if this is the current user
        if (currentUser?.id === userId && rating) {
          set({ strengthRating: rating });
        }
        
        return rating;
      },

      getStrengthRating: () => {
        return get().strengthRating;
      },
    }),
    {
      name: 'apex-medals',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ============ RETROACTIVE MEDAL CHECK ============
// Runs on app load to award medals for existing stats (industry standard: Strava, Apple Fitness, Garmin all do this)
export function checkAllMedalsRetroactive(userId: string) {
  const { earnMedal, hasMedal } = useMedalStore.getState();
  const { workoutHistory, personalBests } = useWorkoutStore.getState();
  const userWorkouts = workoutHistory.filter(w => w.userId === userId && w.status === 'completed');
  const userPBs = personalBests.filter(pb => pb.userId === userId);
  let awarded = 0;

  // --- WORKOUT COUNT ---
  const workoutCount = userWorkouts.length;
  const wcMedals: [string, number][] = [
    ['first-blood', 1], ['getting-started', 5], ['dedicated', 25], ['committed', 50], ['centurion', 100],
  ];
  for (const [id, threshold] of wcMedals) {
    if (workoutCount >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
  }

  // --- VOLUME ---
  const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const volMedals: [string, number][] = [
    ['volume-10k', 10000], ['volume-50k', 50000], ['volume-100k', 100000],
  ];
  for (const [id, threshold] of volMedals) {
    if (totalVolume >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
  }

  // --- PR COUNT ---
  const pbCount = userPBs.length;
  const prMedals: [string, number][] = [
    ['first-pr', 1], ['pr-hunter', 10], ['pr-collector', 25],
  ];
  for (const [id, threshold] of prMedals) {
    if (pbCount >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
  }

  // --- STRENGTH MEDALS (from existing PBs) ---
  const { normalizeExerciseId } = require('./exerciseStats');
  
  // Map of exercise ID patterns → medal checks
  const strengthChecks: { match: string[]; medals: [string, number][] }[] = [
    { match: ['bench-press', 'dumbbell-bench-press'], medals: [['bench-common', 50], ['bench-uncommon', 70], ['bench-rare', 100], ['bench-epic', 130], ['bench-legendary', 160]] },
    { match: ['squat', 'back-squat'], medals: [['squat-common', 64], ['squat-uncommon', 93], ['squat-rare', 130], ['squat-epic', 173], ['squat-legendary', 219]] },
    { match: ['deadlift', 'romanian-deadlift', 'rdl'], medals: [['deadlift-common', 55], ['deadlift-uncommon', 84], ['deadlift-rare', 120], ['deadlift-epic', 164], ['deadlift-legendary', 211]] },
    { match: ['lat-pulldown', 'rope-pulldown'], medals: [['lat-common', 38], ['lat-uncommon', 58], ['lat-rare', 82], ['lat-epic', 110], ['lat-legendary', 141]] },
    { match: ['barbell-row', 'bent-over-row', 'seated-row', 'cable-row', 'seated-cable-row'], medals: [['row-common', 41], ['row-uncommon', 61], ['row-rare', 86], ['row-epic', 115], ['row-legendary', 147]] },
    { match: ['overhead-press', 'military-press', 'dumbbell-shoulder-press', 'machine-shoulder-press'], medals: [['ohp-common', 30], ['ohp-uncommon', 45], ['ohp-rare', 64], ['ohp-epic', 87], ['ohp-legendary', 112]] },
    { match: ['leg-press', 'leg-press-machine'], medals: [['legpress-common', 86], ['legpress-uncommon', 147], ['legpress-rare', 226], ['legpress-epic', 324], ['legpress-legendary', 432]] },
    { match: ['leg-extension'], medals: [['legext-common', 20], ['legext-uncommon', 40], ['legext-rare', 60], ['legext-epic', 90], ['legext-legendary', 120]] },
    { match: ['leg-curl', 'lying-leg-curl'], medals: [['legcurl-common', 20], ['legcurl-uncommon', 35], ['legcurl-rare', 50], ['legcurl-epic', 75], ['legcurl-legendary', 100]] },
    { match: ['machine-chest-press', 'chest-press'], medals: [['chestpress-common', 20], ['chestpress-uncommon', 35], ['chestpress-rare', 50], ['chestpress-epic', 75], ['chestpress-legendary', 100]] },
    { match: ['pull-up', 'pull-ups', 'weighted-pull-up'], medals: [['pullup-bw', 0], ['pullup-10', 10], ['pullup-25', 25], ['pullup-40', 40]] },
    { match: ['t-bar-row', 'tbar-row', 'landmine-row'], medals: [['tbar-35', 35], ['tbar-54', 54], ['tbar-75', 75], ['tbar-102', 102], ['tbar-130', 130]] },
    { match: ['dumbbell-bench-press', 'db-bench-press'], medals: [['dbbench-15', 15], ['dbbench-23', 23], ['dbbench-32', 32], ['dbbench-44', 44]] },
    { match: ['dumbbell-shoulder-press', 'db-shoulder-press'], medals: [['dbohp-13', 13], ['dbohp-20', 20], ['dbohp-28', 28], ['dbohp-38', 38]] },
    { match: ['hip-thrust', 'barbell-hip-thrust'], medals: [['hipthrust-38', 38], ['hipthrust-76', 76], ['hipthrust-129', 129], ['hipthrust-196', 196]] },
    { match: ['bulgarian-split-squat', 'split-squat'], medals: [['bss-10', 10], ['bss-18', 18], ['bss-30', 30], ['bss-44', 44]] },
  ];

  for (const pb of userPBs) {
    const normId = normalizeExerciseId(pb.exerciseId);
    for (const check of strengthChecks) {
      if (check.match.includes(normId)) {
        for (const [medalId, threshold] of check.medals) {
          if (pb.bestWeight >= threshold && !hasMedal(medalId, userId)) { earnMedal(medalId, userId); awarded++; }
        }
      }
    }
  }

  // --- POWERLIFTING TOTAL ---
  const benchPB = userPBs.find(p => ['bench-press', 'barbell-bench-press'].includes(normalizeExerciseId(p.exerciseId)));
  const squatPB = userPBs.find(p => ['squat', 'back-squat'].includes(normalizeExerciseId(p.exerciseId)));
  const deadliftPB = userPBs.find(p => ['deadlift'].includes(normalizeExerciseId(p.exerciseId)));
  if (benchPB && squatPB && deadliftPB) {
    const sbdTotal = (benchPB.oneRepMax || 0) + (squatPB.oneRepMax || 0) + (deadliftPB.oneRepMax || 0);
    const plMedals: [string, number][] = [
      ['300-club', 300], ['400-club', 400], ['1000lb-club', 454], ['500-club', 500], ['600-club', 600],
    ];
    for (const [id, threshold] of plMedals) {
      if (sbdTotal >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
    }
  }

  // --- CARDIO / STRETCH / CIRCUIT BLOCK COUNTS ---
  let totalCardioBlocks = 0;
  let totalStretchBlocks = 0;
  let totalCircuitBlocks = 0;
  let totalAmraps = 0;
  let totalEmoms = 0;

  userWorkouts.forEach(w => {
    const blocks = (w as any).blocks || [];
    const exTypes = (w.exercises || []).map((ex: any) => ex.blockType).filter(Boolean);
    if (blocks.some((b: any) => b.type === 'cardio') || exTypes.includes('cardio')) totalCardioBlocks++;
    if (blocks.some((b: any) => b.type === 'cooldown') || exTypes.includes('cooldown') ||
        (w.exercises || []).some((ex: any) => ex.exercise?.category === 'stretching')) totalStretchBlocks++;
    blocks.forEach((b: any) => {
      if (b.type === 'circuit') {
        totalCircuitBlocks++;
        if (b.circuitStyle === 'amrap') totalAmraps++;
        if (b.circuitStyle === 'emom') totalEmoms++;
      }
    });
    if (exTypes.includes('circuit') && !blocks.some((b: any) => b.type === 'circuit')) totalCircuitBlocks++;
  });

  // Cardio medals
  const cardioMedals: [string, number][] = [['cardio-first', 1], ['cardio-10', 10], ['cardio-50', 50], ['cardio-100', 100]];
  for (const [id, t] of cardioMedals) { if (totalCardioBlocks >= t && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; } }
  // Stretch medals
  const stretchMedals: [string, number][] = [['stretch-first', 1], ['stretch-10', 10], ['stretch-50', 50]];
  for (const [id, t] of stretchMedals) { if (totalStretchBlocks >= t && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; } }
  // Circuit medals
  const circuitMedals: [string, number][] = [['circuit-first', 1], ['circuit-10', 10], ['circuit-50', 50]];
  for (const [id, t] of circuitMedals) { if (totalCircuitBlocks >= t && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; } }
  if (totalAmraps >= 1 && !hasMedal('amrap-first', userId)) { earnMedal('amrap-first', userId); awarded++; }
  if (totalAmraps >= 10 && !hasMedal('amrap-10', userId)) { earnMedal('amrap-10', userId); awarded++; }
  if (totalEmoms >= 1 && !hasMedal('emom-first', userId)) { earnMedal('emom-first', userId); awarded++; }
  if (totalEmoms >= 10 && !hasMedal('emom-10', userId)) { earnMedal('emom-10', userId); awarded++; }

  // --- SPECIAL MEDALS ---
  // Variety king (20 different exercises used)
  const uniqueExercises = new Set<string>();
  userWorkouts.forEach(w => (w.exercises || []).forEach((ex: any) => uniqueExercises.add(ex.exerciseId)));
  if (uniqueExercises.size >= 20 && !hasMedal('variety-king', userId)) { earnMedal('variety-king', userId); awarded++; }

  // Early bird / Night owl (check workout start times)
  userWorkouts.forEach(w => {
    const hour = new Date(w.startTime).getHours();
    if (hour < 6 && !hasMedal('early-bird', userId)) { earnMedal('early-bird', userId); awarded++; }
    if (hour >= 22 && !hasMedal('night-owl', userId)) { earnMedal('night-owl', userId); awarded++; }
  });

  // Marathon session (2+ hours)
  if (userWorkouts.some(w => (w.duration || 0) >= 7200) && !hasMedal('marathon-session', userId)) {
    earnMedal('marathon-session', userId); awarded++;
  }

  console.log(`[RetroactiveMedals] Scanned ${userWorkouts.length} workouts, ${userPBs.length} PBs → awarded ${awarded} medals`);
  return awarded;
}

// ============ WEEKLY REPORT STORE ============
interface ReportState {
  weeklyReports: WeeklyReport[];
  
  generateWeeklyReport: () => WeeklyReport;
  getLatestReport: () => WeeklyReport | undefined;
  getReportForWeek: (startDate: string) => WeeklyReport | undefined;
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      weeklyReports: [],

      generateWeeklyReport: () => {
        const { workoutHistory, personalBests } = useWorkoutStore.getState();
        const userId = useAuthStore.getState().user?.id || '';
        
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Filter workouts from this week
        const thisWeekWorkouts = workoutHistory.filter(w => {
          const workoutDate = new Date(w.startTime);
          return workoutDate >= weekStart && workoutDate <= weekEnd;
        });

        // Calculate volume by muscle group
        const volumeByMuscle: Record<MuscleGroup, number> = {
          chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0,
          forearms: 0, abs: 0, obliques: 0, quads: 0, hamstrings: 0,
          glutes: 0, calves: 0, traps: 0, lats: 0, lower_back: 0,
        };

        thisWeekWorkouts.forEach(workout => {
          workout.exercises.forEach(ex => {
            const exercise = exerciseLibraryMap.get(ex.exerciseId);
            if (exercise) {
              let exerciseVolume = 0;
              ex.sets.forEach(s => {
                if (s.completed && s.weight && s.reps) {
                  exerciseVolume += s.weight * s.reps;
                }
              });

              exercise.primaryMuscles.forEach(muscle => {
                volumeByMuscle[muscle] += exerciseVolume;
              });
              exercise.secondaryMuscles.forEach(muscle => {
                volumeByMuscle[muscle] += exerciseVolume * 0.3;
              });
            }
          });
        });

        // Calculate total stats
        const totalVolume = Object.values(volumeByMuscle).reduce((a, b) => a + b, 0);
        const totalDuration = thisWeekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / 60;

        // Get new PBs from this week
        const newPBs = personalBests.filter(pb => {
          const pbDate = new Date(pb.achievedAt);
          return pbDate >= weekStart && pbDate <= weekEnd;
        });

        const report: WeeklyReport = {
          id: uuidv4(),
          userId,
          weekStartDate: weekStart.toISOString(),
          weekEndDate: weekEnd.toISOString(),
          totalWorkouts: thisWeekWorkouts.length,
          totalVolume: Math.round(totalVolume),
          totalDuration: Math.round(totalDuration),
          volumeByMuscleGroup: volumeByMuscle,
          volumeChangeFromLastWeek: volumeByMuscle, // Placeholder - would compare with last week
          newPBs,
          consistencyScore: Math.min(100, thisWeekWorkouts.length * 15),
          generatedAt: new Date().toISOString(),
        };

        set(state => ({
          weeklyReports: [report, ...state.weeklyReports],
        }));

        // Add notification
        useSocialStore.getState().addNotification({
          userId,
          type: 'weekly_report',
          title: 'Weekly Report Ready!',
          message: `Your weekly report is ready. You completed ${report.totalWorkouts} workouts!`,
        });

        return report;
      },

      getLatestReport: () => {
        return get().weeklyReports[0];
      },

      getReportForWeek: (startDate) => {
        return get().weeklyReports.find(r => r.weekStartDate.startsWith(startDate.substring(0, 10)));
      },
    }),
    {
      name: 'apex-reports',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
