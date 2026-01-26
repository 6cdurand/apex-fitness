import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { 
  syncWorkoutToSupabase, 
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
  syncPaymentToSupabase,
  fetchPaymentsFromSupabase,
  syncClientProgramToSupabase,
  fetchClientProgramsFromSupabase,
  syncBookingRequestToSupabase,
  fetchBookingRequestsFromSupabase,
  deleteTrainerClientFromSupabase,
  deleteClientFromSupabase,
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
} from '@/types';
import { calculate1RM, exerciseLibrary } from './exercises';

// ============ AUTH STORE ============
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
  logout: () => void;
  deleteAccount: () => void;
  updateUser: (updates: Partial<User>) => void;
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
        
        const localUser = storedUsers.find((u: User & { password: string }) => 
          u.email?.toLowerCase() === email.toLowerCase() && u.password === password
        );
        
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
          storedUsers.push({ ...supabaseUser, password });
          localStorage.setItem('apex-users', JSON.stringify(storedUsers));
          set({ user: supabaseUser, isAuthenticated: true, isLoading: false });
          return true;
        }
        
        console.log('[Auth] ❌ Login failed - user not found in localStorage or Supabase');
        set({ isLoading: false });
        return false;
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
          id: uuidv4(),
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
          createdAt: new Date().toISOString(),
          followers: [],
          following: [],
        };

        // Save to localStorage
        storedUsers.push({ ...newUser, password: userData.password });
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
        localStorage.removeItem('apex-workouts');
        localStorage.removeItem('apex-medals');
        localStorage.removeItem('apex-trainer');
        localStorage.removeItem('apex-social');
        localStorage.removeItem('apex-messages');
        
        set({ user: null, isAuthenticated: false });
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
          set({ user: { ...currentUser, mode } });
        }
      },
    }),
    {
      name: 'apex-auth',
      storage: createJSONStorage(() => localStorage),
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
  endWorkout: () => Workout | null;
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
  
  // Recalculate PBs from workout history
  recalculatePBsForUser: (userId: string) => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      workoutHistory: [],
      templates: [],
      personalBests: [],
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
        
        // Clone template exercises with previous data
        const exercises: WorkoutExercise[] = (template.exercises || []).map(ex => {
          const pb = pbs.find(p => p.exerciseId === ex.exerciseId);
          return {
            ...ex,
            id: uuidv4(),
            sets: (ex.sets || []).map((s, idx) => ({
              ...s,
              id: uuidv4(),
              completed: false,
              previousWeight: pb?.bestWeight,
              previousReps: pb?.bestReps,
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
          // Mark as PT session if training a client
          assignedBy: clientId ? loggedInUserId : undefined,
          // Store blocks data for session workouts
          blocks: (template as any).blocks || undefined,
        };
        set({ 
          activeWorkout: workout,
          workoutTimer: { isRunning: true, seconds: 0, type: 'workout', startTimestamp: Date.now(), accumulatedSeconds: 0 },
          currentClientId: clientId || null,
        });
      },

      endWorkout: () => {
        const { activeWorkout, workoutTimer } = get();
        if (!activeWorkout) return null;

        // Calculate total volume
        let totalVolume = 0;
        activeWorkout.exercises.forEach(ex => {
          ex.sets.forEach(s => {
            if (s.completed && s.weight && s.reps) {
              totalVolume += s.weight * s.reps;
            }
          });
        });

        const completedWorkout: Workout = {
          ...activeWorkout,
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

        // Trigger medal checks and strength rating update after workout
        // Use the completed workout's userId for proper attribution
        const workoutUserId = completedWorkout.userId;
        
        setTimeout(() => {
          const { earnMedal, hasMedal, calculateStrengthRating, calculateStrengthRatingForUser } = useMedalStore.getState();
          
          // Filter workouts by the user who did this workout
          const userWorkouts = get().workoutHistory.filter(w => w.userId === workoutUserId);
          const workoutCount = userWorkouts.length;
          
          // Check workout count medals for this specific user (cascade - earn all lower tiers)
          if (workoutCount >= 100) {
            if (!hasMedal('centurion', workoutUserId)) earnMedal('centurion', workoutUserId);
            if (!hasMedal('committed', workoutUserId)) earnMedal('committed', workoutUserId);
            if (!hasMedal('dedicated', workoutUserId)) earnMedal('dedicated', workoutUserId);
            if (!hasMedal('getting-started', workoutUserId)) earnMedal('getting-started', workoutUserId);
            if (!hasMedal('first-blood', workoutUserId)) earnMedal('first-blood', workoutUserId);
          } else if (workoutCount >= 50) {
            if (!hasMedal('committed', workoutUserId)) earnMedal('committed', workoutUserId);
            if (!hasMedal('dedicated', workoutUserId)) earnMedal('dedicated', workoutUserId);
            if (!hasMedal('getting-started', workoutUserId)) earnMedal('getting-started', workoutUserId);
            if (!hasMedal('first-blood', workoutUserId)) earnMedal('first-blood', workoutUserId);
          } else if (workoutCount >= 25) {
            if (!hasMedal('dedicated', workoutUserId)) earnMedal('dedicated', workoutUserId);
            if (!hasMedal('getting-started', workoutUserId)) earnMedal('getting-started', workoutUserId);
            if (!hasMedal('first-blood', workoutUserId)) earnMedal('first-blood', workoutUserId);
          } else if (workoutCount >= 5) {
            if (!hasMedal('getting-started', workoutUserId)) earnMedal('getting-started', workoutUserId);
            if (!hasMedal('first-blood', workoutUserId)) earnMedal('first-blood', workoutUserId);
          } else if (workoutCount >= 1) {
            if (!hasMedal('first-blood', workoutUserId)) earnMedal('first-blood', workoutUserId);
          }
          
          // Check volume medals for this specific user (cascade)
          const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
          if (totalVolume >= 100000) {
            if (!hasMedal('volume-100k', workoutUserId)) earnMedal('volume-100k', workoutUserId);
            if (!hasMedal('volume-50k', workoutUserId)) earnMedal('volume-50k', workoutUserId);
            if (!hasMedal('volume-10k', workoutUserId)) earnMedal('volume-10k', workoutUserId);
          } else if (totalVolume >= 50000) {
            if (!hasMedal('volume-50k', workoutUserId)) earnMedal('volume-50k', workoutUserId);
            if (!hasMedal('volume-10k', workoutUserId)) earnMedal('volume-10k', workoutUserId);
          } else if (totalVolume >= 10000) {
            if (!hasMedal('volume-10k', workoutUserId)) earnMedal('volume-10k', workoutUserId);
          }
          
          // Recalculate strength rating for the workout's user
          if (calculateStrengthRatingForUser) {
            calculateStrengthRatingForUser(workoutUserId);
          } else {
            calculateStrengthRating();
          }
        }, 100);

        return completedWorkout;
      },

      cancelWorkout: () => {
        set({
          activeWorkout: null,
          workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
          restTimer: { isRunning: false, seconds: 0, type: 'rest' },
          currentClientId: null,
        });
      },

      addExercise: (exercise) => {
        const { activeWorkout, personalBests, getActiveUserId } = get();
        if (!activeWorkout) return;

        const targetUserId = getActiveUserId();
        const pb = personalBests.find(p => p.exerciseId === exercise.id && p.userId === targetUserId);
        
        // Extract block metadata if present
        const { blockId, blockName, blockType, ...exerciseData } = exercise as any;
        
        const workoutExercise: WorkoutExercise = {
          id: uuidv4(),
          exerciseId: exercise.id,
          exercise: exerciseData.name ? exerciseData : exercise,
          sets: [{
            id: uuidv4(),
            setNumber: 1,
            type: 'normal',
            completed: false,
            previousWeight: pb?.bestWeight,
            previousReps: pb?.bestReps,
          }],
          restTimerSeconds: 90,
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
        const { activeWorkout, personalBests, getActiveUserId } = get();
        if (!activeWorkout) return;

        const exercise = activeWorkout.exercises.find(e => e.id === exerciseId);
        if (!exercise) return;

        const targetUserId = getActiveUserId();
        const pb = personalBests.find(p => p.exerciseId === exercise.exerciseId && p.userId === targetUserId);
        const lastSet = exercise.sets[exercise.sets.length - 1];

        const newSet: WorkoutSet = {
          id: uuidv4(),
          setNumber: exercise.sets.length + 1,
          type: 'normal',
          weight: lastSet?.weight,
          reps: lastSet?.reps,
          completed: false,
          previousWeight: pb?.bestWeight,
          previousReps: pb?.bestReps,
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
      },

      deleteTemplate: (templateId) => {
        set(state => ({
          templates: state.templates.filter(t => t.id !== templateId),
        }));
      },

      checkAndUpdatePB: (exerciseId, weight, reps, workoutId) => {
        const { personalBests, getActiveUserId } = get();
        const targetUserId = getActiveUserId();
        const existingPB = personalBests.find(p => p.exerciseId === exerciseId && p.userId === targetUserId);
        
        // calculate1RM returns null if reps > 20 (doesn't count toward strength rating)
        const calculatedRM = calculate1RM(weight, reps);
        const volume = weight * reps;

        // Skip PB update if reps > 20 (null 1RM)
        if (calculatedRM === null) {
          return existingPB || null;
        }

        if (!existingPB || calculatedRM > existingPB.oneRepMax) {
          const newPB: PersonalBest = {
            id: existingPB?.id || uuidv4(),
            exerciseId,
            userId: targetUserId,
            oneRepMax: calculatedRM,
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
            
            // BENCH PRESS milestones (using actual weight)
            if (exerciseId === 'bench-press' || exerciseId === 'dumbbell-bench-press') {
              if (actualWeight >= 160 && !hasMedal('bench-legendary', targetUserId)) earnMedal('bench-legendary', targetUserId);
              if (actualWeight >= 130 && !hasMedal('bench-epic', targetUserId)) earnMedal('bench-epic', targetUserId);
              if (actualWeight >= 100 && !hasMedal('bench-rare', targetUserId)) earnMedal('bench-rare', targetUserId);
              if (actualWeight >= 70 && !hasMedal('bench-uncommon', targetUserId)) earnMedal('bench-uncommon', targetUserId);
              if (actualWeight >= 50 && !hasMedal('bench-common', targetUserId)) earnMedal('bench-common', targetUserId);
            }
            
            // SQUAT milestones
            if (exerciseId === 'squat' || exerciseId === 'back-squat') {
              if (actualWeight >= 219 && !hasMedal('squat-legendary', targetUserId)) earnMedal('squat-legendary', targetUserId);
              if (actualWeight >= 173 && !hasMedal('squat-epic', targetUserId)) earnMedal('squat-epic', targetUserId);
              if (actualWeight >= 130 && !hasMedal('squat-rare', targetUserId)) earnMedal('squat-rare', targetUserId);
              if (actualWeight >= 93 && !hasMedal('squat-uncommon', targetUserId)) earnMedal('squat-uncommon', targetUserId);
              if (actualWeight >= 64 && !hasMedal('squat-common', targetUserId)) earnMedal('squat-common', targetUserId);
            }
            
            // DEADLIFT/RDL milestones
            if (exerciseId === 'deadlift' || exerciseId === 'romanian-deadlift' || exerciseId === 'rdl') {
              if (actualWeight >= 211 && !hasMedal('deadlift-legendary', targetUserId)) earnMedal('deadlift-legendary', targetUserId);
              if (actualWeight >= 164 && !hasMedal('deadlift-epic', targetUserId)) earnMedal('deadlift-epic', targetUserId);
              if (actualWeight >= 120 && !hasMedal('deadlift-rare', targetUserId)) earnMedal('deadlift-rare', targetUserId);
              if (actualWeight >= 84 && !hasMedal('deadlift-uncommon', targetUserId)) earnMedal('deadlift-uncommon', targetUserId);
              if (actualWeight >= 55 && !hasMedal('deadlift-common', targetUserId)) earnMedal('deadlift-common', targetUserId);
            }
            
            // LAT PULLDOWN milestones
            if (exerciseId === 'lat-pulldown' || exerciseId === 'rope-pulldown') {
              if (actualWeight >= 141 && !hasMedal('lat-legendary', targetUserId)) earnMedal('lat-legendary', targetUserId);
              if (actualWeight >= 110 && !hasMedal('lat-epic', targetUserId)) earnMedal('lat-epic', targetUserId);
              if (actualWeight >= 82 && !hasMedal('lat-rare', targetUserId)) earnMedal('lat-rare', targetUserId);
              if (actualWeight >= 58 && !hasMedal('lat-uncommon', targetUserId)) earnMedal('lat-uncommon', targetUserId);
              if (actualWeight >= 38 && !hasMedal('lat-common', targetUserId)) earnMedal('lat-common', targetUserId);
            }
            
            // ROW milestones
            if (exerciseId === 'barbell-row' || exerciseId === 'bent-over-row' || exerciseId === 'seated-row' || exerciseId === 'cable-row' || exerciseId === 'seated-cable-row' || exerciseId === 'machine-back-row' || exerciseId === 'row-machine') {
              if (actualWeight >= 147 && !hasMedal('row-legendary', targetUserId)) earnMedal('row-legendary', targetUserId);
              if (actualWeight >= 115 && !hasMedal('row-epic', targetUserId)) earnMedal('row-epic', targetUserId);
              if (actualWeight >= 86 && !hasMedal('row-rare', targetUserId)) earnMedal('row-rare', targetUserId);
              if (actualWeight >= 61 && !hasMedal('row-uncommon', targetUserId)) earnMedal('row-uncommon', targetUserId);
              if (actualWeight >= 41 && !hasMedal('row-common', targetUserId)) earnMedal('row-common', targetUserId);
            }
            
            // OHP/SHOULDER PRESS milestones
            if (exerciseId === 'overhead-press' || exerciseId === 'military-press' || exerciseId === 'dumbbell-shoulder-press' || exerciseId === 'machine-shoulder-press') {
              if (actualWeight >= 112 && !hasMedal('ohp-legendary', targetUserId)) earnMedal('ohp-legendary', targetUserId);
              if (actualWeight >= 87 && !hasMedal('ohp-epic', targetUserId)) earnMedal('ohp-epic', targetUserId);
              if (actualWeight >= 64 && !hasMedal('ohp-rare', targetUserId)) earnMedal('ohp-rare', targetUserId);
              if (actualWeight >= 45 && !hasMedal('ohp-uncommon', targetUserId)) earnMedal('ohp-uncommon', targetUserId);
              if (actualWeight >= 30 && !hasMedal('ohp-common', targetUserId)) earnMedal('ohp-common', targetUserId);
            }
            
            // LEG PRESS milestones
            if (exerciseId === 'leg-press' || exerciseId === 'leg-press-machine' || exerciseId === 'leg-press-single-leg') {
              if (actualWeight >= 432 && !hasMedal('legpress-legendary', targetUserId)) earnMedal('legpress-legendary', targetUserId);
              if (actualWeight >= 324 && !hasMedal('legpress-epic', targetUserId)) earnMedal('legpress-epic', targetUserId);
              if (actualWeight >= 226 && !hasMedal('legpress-rare', targetUserId)) earnMedal('legpress-rare', targetUserId);
              if (actualWeight >= 147 && !hasMedal('legpress-uncommon', targetUserId)) earnMedal('legpress-uncommon', targetUserId);
              if (actualWeight >= 86 && !hasMedal('legpress-common', targetUserId)) earnMedal('legpress-common', targetUserId);
            }
            
            // LEG EXTENSION milestones
            if (exerciseId === 'leg-extension') {
              if (actualWeight >= 120 && !hasMedal('legext-legendary', targetUserId)) earnMedal('legext-legendary', targetUserId);
              if (actualWeight >= 90 && !hasMedal('legext-epic', targetUserId)) earnMedal('legext-epic', targetUserId);
              if (actualWeight >= 60 && !hasMedal('legext-rare', targetUserId)) earnMedal('legext-rare', targetUserId);
              if (actualWeight >= 40 && !hasMedal('legext-uncommon', targetUserId)) earnMedal('legext-uncommon', targetUserId);
              if (actualWeight >= 20 && !hasMedal('legext-common', targetUserId)) earnMedal('legext-common', targetUserId);
            }
            
            // LEG CURL milestones
            if (exerciseId === 'leg-curl' || exerciseId === 'lying-leg-curl') {
              if (actualWeight >= 100 && !hasMedal('legcurl-legendary', targetUserId)) earnMedal('legcurl-legendary', targetUserId);
              if (actualWeight >= 75 && !hasMedal('legcurl-epic', targetUserId)) earnMedal('legcurl-epic', targetUserId);
              if (actualWeight >= 50 && !hasMedal('legcurl-rare', targetUserId)) earnMedal('legcurl-rare', targetUserId);
              if (actualWeight >= 35 && !hasMedal('legcurl-uncommon', targetUserId)) earnMedal('legcurl-uncommon', targetUserId);
              if (actualWeight >= 20 && !hasMedal('legcurl-common', targetUserId)) earnMedal('legcurl-common', targetUserId);
            }
            
            // CHEST PRESS milestones (machine)
            if (exerciseId === 'machine-chest-press' || exerciseId === 'chest-press') {
              if (actualWeight >= 100 && !hasMedal('chestpress-legendary', targetUserId)) earnMedal('chestpress-legendary', targetUserId);
              if (actualWeight >= 75 && !hasMedal('chestpress-epic', targetUserId)) earnMedal('chestpress-epic', targetUserId);
              if (actualWeight >= 50 && !hasMedal('chestpress-rare', targetUserId)) earnMedal('chestpress-rare', targetUserId);
              if (actualWeight >= 35 && !hasMedal('chestpress-uncommon', targetUserId)) earnMedal('chestpress-uncommon', targetUserId);
              if (actualWeight >= 20 && !hasMedal('chestpress-common', targetUserId)) earnMedal('chestpress-common', targetUserId);
            }
            
            // Recalculate strength rating for the specific user
            calculateStrengthRatingForUser(targetUserId);
          }, 50);

          return newPB;
        }

        // Update best volume if higher
        if (volume > (existingPB?.bestVolume || 0)) {
          const updatedPB = { ...existingPB, bestVolume: volume };
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
        
        set(state => ({
          workoutHistory: state.workoutHistory.filter(w => w.id !== workoutId),
        }));
        
        // Recalculate PBs for the user after workout deletion
        if (userId) {
          get().recalculatePBsForUser(userId);
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
          
          // Recalculate PBs for the user after workout edit
          get().recalculatePBsForUser(updatedWorkout.userId);
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
          get().recalculatePBsForUser(workout.userId);
        }
      },

      recalculatePBsForUser: (userId: string) => {
        const workouts = get().workoutHistory.filter(w => w.userId === userId);
        const newPBs: Record<string, PersonalBest> = {};
        
        // Go through all workouts and find best lifts for each exercise
        workouts.forEach(workout => {
          workout.exercises.forEach(ex => {
            if (!ex.exerciseId) return;
            
            ex.sets.filter(s => s.completed && s.weight && s.reps).forEach(set => {
              const oneRepMax = calculate1RM(set.weight!, set.reps!);
              if (oneRepMax === null) return; // Skip if reps > 20
              
              const existing = newPBs[ex.exerciseId];
              if (!existing || oneRepMax > existing.oneRepMax) {
                newPBs[ex.exerciseId] = {
                  id: existing?.id || uuidv4(),
                  exerciseId: ex.exerciseId,
                  userId,
                  bestWeight: set.weight!,
                  bestReps: set.reps!,
                  oneRepMax,
                  bestVolume: existing?.bestVolume || 0,
                  achievedAt: workout.endTime || workout.startTime,
                  workoutId: workout.id,
                };
              }
            });
          });
        });
        
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
    }),
    {
      name: 'apex-workout',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workoutHistory: state.workoutHistory,
        templates: state.templates,
        personalBests: state.personalBests,
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
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        const newNotification: Notification = {
          id: uuidv4(),
          ...notification,
          userId,
          read: false,
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          notifications: [newNotification, ...state.notifications],
        }));
      },

      markNotificationRead: (notificationId) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        }));
      },

      markAllNotificationsRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
        }));
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

interface TrainerState {
  clients: TrainerClient[];
  assignedWorkouts: Workout[];
  calendarEvents: CalendarEvent[];
  sessions: ClientSession[];
  payments: ClientPayment[];
  sessionPackages: SessionPackage[];
  bookingRequests: BookingRequest[];
  clientPrograms: ClientProgram[];
  clientProfiles: ClientProgrammingProfile[];
  sessionWorkouts: SessionWorkout[]; // Workouts created in builder
  
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
  getClientPrograms: (clientId: string) => ClientProgram[];
  getActiveProgram: (clientId: string) => ClientProgram | undefined;
  
  // Client Profiles (onboarding data)
  saveClientProfile: (profile: ClientProgrammingProfile) => void;
  getClientProfile: (clientId: string) => ClientProgrammingProfile | undefined;
  
  // Set initial stats for onboarding existing clients
  setInitialClientStats: (clientId: string, sessionsDone: number, sessionsLeft: number, totalPaid: number) => void;
  
  // Client-facing session functions
  getScheduledSessionsForUser: (userId: string) => CalendarEvent[];
  confirmSession: (eventId: string) => void;
  
  // Session workouts (created in builder)
  addSessionWorkout: (workout: SessionWorkout) => void;
  getSessionWorkout: (workoutId: string) => SessionWorkout | undefined;
  getSessionWorkoutsForClient: (clientId: string) => SessionWorkout[];
  deleteSessionWorkout: (workoutId: string) => void;
  
  // Supabase sync
  loadFromSupabase: (trainerId: string) => Promise<void>;
  
  // Update package (for editing)
  updateSessionPackage: (packageId: string, updates: Partial<SessionPackage>) => void;
}

export const useTrainerStore = create<TrainerState>()(
  persist(
    (set, get) => ({
      clients: [],
      assignedWorkouts: [],
      calendarEvents: [],
      sessions: [],
      payments: [],
      bookingRequests: [],
      sessionPackages: [],
      clientPrograms: [],
      clientProfiles: [],
      sessionWorkouts: [],

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
          localStorage.setItem('apex-users', JSON.stringify([{ ...currentUser, password: 'trainer123' }]));
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
          
          const newUser: User & { password: string } = {
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
            password: 'client123',
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
          // Decrement from active package if exists (only for PT sessions)
          if (session.type === 'pt_session') {
            const activePackage = get().sessionPackages.find(
              p => p.clientId === session.clientId && p.status === 'active' && p.remainingSessions > 0
            );
            if (activePackage) {
              get().useSessionFromPackage(activePackage.id);
            }
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
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId 
              ? { ...s, status: 'no_show' as const } 
              : s
          ),
        }));
        // Sync to Supabase and still decrement from active package (no-show still uses a session)
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          syncTrainerSessionToSupabase(session);
          if (session.type === 'pt_session') {
            const activePackage = get().sessionPackages.find(
              p => p.clientId === session.clientId && p.status === 'active' && p.remainingSessions > 0
            );
            if (activePackage) {
              get().useSessionFromPackage(activePackage.id);
            }
          }
        }
      },

      toggleSessionPaid: (sessionId) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, paid: !s.paid } : s
          ),
        }));
        // Sync to Supabase
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) syncTrainerSessionToSupabase(session);
      },

      // Payments
      addPayment: (payment) => {
        const newPayment: ClientPayment = {
          id: uuidv4(),
          ...payment,
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
          sessionPackages: state.sessionPackages.map(p =>
            p.id === packageId && p.remainingSessions > 0
              ? { 
                  ...p, 
                  usedSessions: p.usedSessions + 1, 
                  remainingSessions: p.remainingSessions - 1,
                  status: p.remainingSessions - 1 === 0 ? 'completed' as const : p.status,
                }
              : p
          ),
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

        // Create session record
        get().addSession({
          trainerId: request.trainerId,
          clientId: request.clientId,
          date: request.date,
          startTime: request.startTime,
          endTime: request.endTime,
          duration: 60,
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

      getClientPrograms: (clientId) => {
        return get().clientPrograms.filter(p => p.clientId === clientId);
      },

      getActiveProgram: (clientId) => {
        return get().clientPrograms.find(p => p.clientId === clientId && p.status === 'active');
      },

      // Client Profiles
      saveClientProfile: (profile) => {
        set(state => ({
          clientProfiles: [
            ...state.clientProfiles.filter(p => p.clientId !== profile.clientId),
            profile,
          ],
        }));
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
        ] = await Promise.all([
          fetchTrainerClientsFromSupabase(trainerId),
          fetchTrainerSessionsFromSupabase(trainerId),
          fetchSessionPackagesFromSupabase(trainerId),
          fetchCalendarEventsFromSupabase(trainerId),
          fetchPaymentsFromSupabase(trainerId),
          fetchClientProgramsFromSupabase(trainerId),
          fetchBookingRequestsFromSupabase(trainerId),
          fetchSessionWorkoutsFromSupabase(trainerId),
        ]);
        
        // SUPABASE IS THE ONLY SOURCE OF TRUTH
        // Map Supabase data to local format
        const clients: TrainerClient[] = supabaseClients.map((sb: any) => ({
          id: sb.id,
          trainerId: sb.trainerId,
          clientId: sb.clientId,
          status: sb.status || 'active',
          startDate: sb.startDate,
          onboardingComplete: sb.onboardingComplete,
          notes: sb.notes,
          goals: sb.goals,
        }));
        
        // REPLACE localStorage with Supabase data (no merging old data)
        set({
          clients,
          sessions: supabaseSessions,
          sessionPackages: supabasePackages,
          calendarEvents: supabaseCalendarEvents,
          payments: supabasePayments,
          clientPrograms: supabasePrograms,
          bookingRequests: supabaseBookings,
          sessionWorkouts: supabaseSessionWorkouts,
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
        });
      },

      // Update session package (for editing total, price, etc.)
      updateSessionPackage: (packageId: string, updates: Partial<SessionPackage>) => {
        set(state => ({
          sessionPackages: state.sessionPackages.map(p =>
            p.id === packageId ? { ...p, ...updates } : p
          ),
        }));
        // Sync to Supabase
        const updated = get().sessionPackages.find(p => p.id === packageId);
        if (updated) syncSessionPackageToSupabase(updated);
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
        if (existingMedal?.earned) return;

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
        };

        set(state => ({
          medals: existingMedal 
            ? state.medals.map(m => m.definitionId === definitionId ? newMedal : m)
            : [...state.medals, newMedal],
        }));

        // Sync medal to Supabase
        syncMedalToSupabase(newMedal);

        // Add notification
        useSocialStore.getState().addNotification({
          userId,
          type: 'achievement',
          title: 'Achievement Unlocked!',
          message: `You earned the "${definition.name}" medal!`,
        });
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
          return null;
        }

        // Default to male for clients (could be enhanced to look up client gender)
        const isMale = true;
        
        const { calculateFullStrengthRating } = require('./strengthRating');
        return calculateFullStrengthRating(userPBs, isMale);
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
            const exercise = exerciseLibrary.find(e => e.id === ex.exerciseId);
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
