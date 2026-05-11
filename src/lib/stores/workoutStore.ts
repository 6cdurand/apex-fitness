import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  Workout, WorkoutExercise, WorkoutSet, WorkoutTemplate,
  PersonalBest, TimerState, Exercise,
} from '@/types';
import { useAuthStore } from './authStore';
import { calculate1RM, exerciseLibraryMap, getSetVolume, getUserBodyweight, isAssistedExercise } from '../exercises';
import { normalizeExerciseId } from '../exerciseStats';
import { deriveAll, computeVolumeRollup, VolumeRollup } from '../deriveAll';
import { syncWorkoutToSupabase, fetchWorkoutHistoryFromSupabase, fetchClientWorkoutsFromSupabase, syncPBToSupabase, syncWorkoutTemplateToSupabase, deleteWorkoutTemplateFromSupabase, fetchWorkoutTemplatesFromSupabase, syncSessionPackageToSupabase } from '../supabaseSync';
import { supabase } from '../supabase';
import { safeLocalStorage } from '../safeStorage';
import { __buildWorkoutCompletedNotification } from '../workoutCompletedNotification';

// Cross-store references (resolved at runtime via .getState() — no circular issues)
import { useTrainerStore } from './trainerStore';
import { useMedalStore } from './medalStore';
import { useSocialStore } from './socialStore';
const getTrainerStore = () => useTrainerStore;
const getMedalStore = () => useMedalStore;
const getSocialStore = () => useSocialStore;

interface WorkoutState {
  activeWorkout: Workout | null;
  workoutHistory: Workout[];
  templates: WorkoutTemplate[];
  personalBests: PersonalBest[];
  workoutTimer: TimerState;
  restTimer: TimerState;
  currentClientId: string | null; // Track which client we're training (null = training self)
  initialBlockType: 'strength' | 'circuit' | 'cardio' | null; // Auto-create this block type on mount

  // Workout actions
  startWorkout: (name: string, templateId?: string, clientId?: string, initialBlockType?: 'strength' | 'circuit' | 'cardio') => void;
  startWorkoutForClient: (name: string, clientId: string, templateId?: string) => void;
  startFromTemplate: (
    template: WorkoutTemplate,
    clientId?: string,
    source?: { programId?: string; dayIndex?: number },
  ) => void;
  clearCurrentClient: () => void;
  getActiveUserId: () => string; // Get the ID of who we're currently training
  setBlockSnapshot: (blocks: any[]) => void;
  endWorkout: (privateNotes?: string, sharedNotes?: string) => Promise<Workout | null>;
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
  deleteWorkout: (workoutId: string) => Promise<void>;
  clearDataForUser: (userId: string) => void;
  
  // Notes
  updateWorkoutNotes: (workoutId: string, notes: string) => Promise<void>;
  getWorkoutById: (workoutId: string) => Workout | undefined;
  
  // Edit completed workouts
  updateCompletedWorkout: (workoutId: string, updates: Partial<Workout>) => Promise<void>;
  removeExerciseFromCompletedWorkout: (workoutId: string, exerciseId: string) => Promise<void>;
  removeSetFromCompletedWorkout: (workoutId: string, exerciseId: string, setId: string) => Promise<void>;
  
  // Recalculate PBs from workout history
  recalculatePBsForUser: (userId: string) => void;
  recalcActiveExercisePB: (exerciseId: string) => void;
  
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
      initialBlockType: null,

      getActiveUserId: () => {
        // Returns the ID of who we're training: client ID if training a client, otherwise logged-in user
        const { currentClientId } = get();
        if (currentClientId) return currentClientId;
        return useAuthStore.getState().user?.id || '';
      },

      startWorkout: (name, templateId, clientId, initialBlockType) => {
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
          initialBlockType: initialBlockType || null,
        });
      },

      startWorkoutForClient: (name, clientId, templateId) => {
        get().startWorkout(name, templateId, clientId);
      },

      clearCurrentClient: () => {
        set({ currentClientId: null });
      },

      startFromTemplate: (template, clientId, source) => {
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
          // D17: explicit program-source tags (only set when the caller
          // identifies this as a program-day start). endWorkout spreads
          // activeWorkout into the completed record so these survive into
          // workoutHistory untouched and drive detectIsProgramWorkout's
          // fast path at finish time.
          sourceProgramId: source?.programId,
          sourceDayIndex: source?.dayIndex,
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

      setBlockSnapshot: (blocks: any[]) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;
        set({ activeWorkout: { ...activeWorkout, blocks } });
      },

      endWorkout: async (notes?: string) => {
        const { activeWorkout, workoutTimer } = get();
        if (!activeWorkout) return null;

        // Calculate total volume using bodyweight-based formula for assisted exercises
        const targetBW = getUserBodyweight(activeWorkout.userId);
        let totalVolume = 0;
        activeWorkout.exercises.forEach(ex => {
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

        // W1 (tab-close data-loss fix): await the Supabase upsert BEFORE any
        // UI-facing state transition that implies success. If the request
        // fails, activeWorkout and the live timers stay intact so the user
        // can hit Finish again. The caller (handleFinishWorkout) surfaces
        // the failure via toast and leaves the finish dialog open.
        const synced = await syncWorkoutToSupabase(completedWorkout);
        if (!synced) {
          console.error(
            '[WorkoutStore] Workout sync failed; preserving activeWorkout for retry:',
            completedWorkout.id,
          );
          return null;
        }

        // Sync succeeded — now it is safe to commit the local state
        // transition (clear activeWorkout, push to workoutHistory).
        set(state => ({
          activeWorkout: null,
          workoutHistory: [completedWorkout, ...state.workoutHistory],
          workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
          restTimer: { isRunning: false, seconds: 0, type: 'rest' },
          currentClientId: null,
        }));

        // Patch source calendar event status to 'completed'
        // templateId is set to 'session-{eventId}' when started from a booked session
        const templateId = completedWorkout.templateId || '';
        if (templateId.startsWith('session-')) {
          const sourceEventId = templateId.replace('session-', '');
          if (sourceEventId) {
            console.debug('[WorkoutStore] completion_event_sync', { eventId: sourceEventId });
            // 1. Direct Supabase patch (works even if event not in local store)
            supabase
              .from('calendar_events')
              .update({ status: 'completed' })
              .eq('id', sourceEventId)
              .then(({ error }) => {
                if (error) {
                  console.error('[WorkoutStore] Failed to patch calendar_events.status:', error.message);
                } else {
                  console.debug('[WorkoutStore] ✅ calendar_events.status patched to completed', { eventId: sourceEventId });
                }
              });
            // 2. Also update local trainerStore for immediate UI reflection
            const trainerStore = getTrainerStore().getState();
            trainerStore.updateCalendarEvent(sourceEventId, { status: 'completed' });
          }
        }

        // Auto-create calendar event + session record for PT workouts
        if (completedWorkout.assignedBy && completedWorkout.userId !== completedWorkout.assignedBy) {
          const trainerId = completedWorkout.assignedBy;
          const clientId = completedWorkout.userId;
          const todayStr = new Date().toISOString().split('T')[0];
          const trainerStore = getTrainerStore().getState();
          
          // Check if a session already exists for this client today to avoid duplicates
          const existingSession = trainerStore.sessions.find(
            (s: any) => s.clientId === clientId && s.date === todayStr && s.status !== 'cancelled'
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

            // Create in-app notification for client
            const socialStore = getSocialStore().getState();
            const authUser = useAuthStore.getState().user;
            const trainerName = authUser?.displayName || 'Your trainer';

            const notificationPayload = __buildWorkoutCompletedNotification({
              workout: {
                id: completedWorkout.id,
                userId: clientId,
                name: completedWorkout.name,
                totalVolume: completedWorkout.totalVolume,
                duration: completedWorkout.duration,
              },
              trainerName,
              trainerId,
            });

            socialStore.addNotification(notificationPayload);
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
        const normalizedId = normalizeExerciseId(exercise.id);
        const pb = personalBests.find(p => p.exerciseId === normalizedId && p.userId === targetUserId);
        
        // Find last workout data for this exercise
        const userWorkoutHistory = workoutHistory.filter(w => w.userId === targetUserId);
        let lastSetData: { weight?: number; reps?: number; duration?: number } | undefined;
        for (const workout of userWorkoutHistory) {
          const matchingEx = workout.exercises?.find(e => normalizeExerciseId(e.exerciseId || '') === normalizedId);
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
        const exerciseName = exercise.name || (exerciseData as any)?.name || '';
        const autoAssisted = isAssistedExercise(exercise.id, exerciseName);
        
        // Check if this is a stretching exercise - default to timed with 2 rounds
        const isStretching = exercise.category === 'stretching';
        const defaultDuration = 30; // 30 seconds per stretch
        
        // For circuit blocks, create one set per round with roundIndex
        const isCircuit = blockType === 'circuit';
        const circuitRounds = (exercise as any).circuitRounds || 3; // Default to 3 rounds if not specified
        
        const sets = isCircuit
          ? Array.from({ length: circuitRounds }, (_, i) => ({
              id: uuidv4(),
              setNumber: i + 1,
              type: 'normal' as const,
              completed: false,
              previousWeight: lastSetData?.weight || pb?.bestWeight,
              previousReps: lastSetData?.reps || pb?.bestReps,
              roundIndex: i,
              ...(autoAssisted && { isAssisted: true }),
            }))
          : isStretching 
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
        const normalizedExId = normalizeExerciseId(exercise.exerciseId || '');
        const pb = personalBests.find(p => p.exerciseId === normalizedExId && p.userId === targetUserId);
        const lastSet = exercise.sets[exercise.sets.length - 1];
        const newSetIndex = exercise.sets.length;
        
        // Find last workout data for this exercise at this set index
        const userWorkoutHistory = workoutHistory.filter(w => w.userId === targetUserId);
        let lastSetData: { weight?: number; reps?: number } | undefined;
        for (const workout of userWorkoutHistory) {
          const matchingEx = workout.exercises?.find(e => normalizeExerciseId(e.exerciseId || '') === normalizedExId);
          if (matchingEx && matchingEx.sets?.length > newSetIndex) {
            const historicalSet = matchingEx.sets[newSetIndex];
            if (historicalSet?.completed && historicalSet.weight && historicalSet.reps) {
              lastSetData = { weight: historicalSet.weight, reps: historicalSet.reps };
              break;
            }
          }
        }

        // Auto-detect assisted exercises by name
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

        // Capture exercise info before removal for PB recalc
        const exercise = activeWorkout.exercises.find(e => e.id === exerciseId);
        const removedSet = exercise?.sets.find(s => s.id === setId);

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

        // Recalculate PB if the removed set was completed with data
        if (removedSet?.completed && removedSet.weight && removedSet.reps && exercise) {
          get().recalcActiveExercisePB(exercise.exerciseId);
        }
      },

      updateSet: (exerciseId, setId, updates) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        // Check if this edit touches weight/reps on a completed set (PB-relevant)
        const exercise = activeWorkout.exercises.find(e => e.id === exerciseId);
        const existingSet = exercise?.sets.find(s => s.id === setId);
        const needsPBRecalc = existingSet?.completed && 
          (updates.weight !== undefined || updates.reps !== undefined);

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

        // Recalculate PB if a completed set's weight/reps changed
        if (needsPBRecalc && exercise) {
          get().recalcActiveExercisePB(exercise.exerciseId);
        }
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

        const exercise = activeWorkout.exercises.find(e => e.id === exerciseId);

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

        // Recalculate PB since an active-workout set was uncompleted
        if (exercise) {
          get().recalcActiveExercisePB(exercise.exerciseId);
        }
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
        const normalizedId = normalizeExerciseId(exerciseId);
        
        // Check if this is an assisted exercise (lower weight = better)
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

          // PB is NOT synced to Supabase here — deferred to workout finish (runDeriveAll)

          // Check PB medals and update strength rating (cascade)
          // Use targetUserId to attribute medals to correct user (client vs trainer)
          setTimeout(() => {
            const userPBs = get().personalBests.filter(pb => pb.userId === targetUserId);
            const pbCount = userPBs.length;
            const { earnMedal, hasMedal, calculateStrengthRatingForUser } = getMedalStore().getState();
            
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
        // D15: normalize the lookup key — PBs are stored with
        // normalizeExerciseId(rawId) applied (see deriveAll.ts recomputePBs),
        // so strict equality on a raw template id (e.g. 'Bench Press') would
        // miss the stored PB whose exerciseId is 'bench-press'. Ad-hoc
        // library exercises only matched by coincidence because their
        // library id was already in canonical form.
        const normalizedId = normalizeExerciseId(exerciseId || '');
        return get().personalBests.find(p => p.exerciseId === normalizedId && p.userId === targetUserId);
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

      deleteWorkout: async (workoutId) => {
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
          const trainerStore = getTrainerStore().getState();
          
          // Decrement totalSessions stored counter on client record
          const clientRecord = trainerStore.clients.find((c: any) => c.clientId === userId);
          if (clientRecord && (clientRecord.totalSessions ?? 0) > 0) {
            trainerStore.updateClient(userId, { totalSessions: Math.max(0, (clientRecord.totalSessions ?? 0) - 1) });
          }
          
          // Decrement package usedSessions
          const activePackage = trainerStore.sessionPackages.find(
            (p: any) => p.clientId === userId && p.trainerId === assignedBy && p.status === 'active'
          );
          if (activePackage && activePackage.usedSessions > 0) {
            const isContinuous = activePackage.remainingSessions === -1 || activePackage.totalSessions === -1;
            const newUsed = Math.max(0, (activePackage.usedSessions || 0) - 1);
            const newRemaining = isContinuous ? -1 : Math.min(activePackage.totalSessions, (activePackage.remainingSessions || 0) + 1);
            getTrainerStore().setState((state: any) => ({
              sessionPackages: state.sessionPackages.map((p: any) =>
                p.id === activePackage.id
                  ? { ...p, usedSessions: newUsed, remainingSessions: newRemaining }
                  : p
              ),
            }));
            const updated = getTrainerStore().getState().sessionPackages.find((p: any) => p.id === activePackage.id);
            if (updated) syncSessionPackageToSupabase(updated);
          }
          
          // Also mark corresponding session record as cancelled
          const matchingSession = trainerStore.sessions.find(
            (s: any) => s.clientId === userId && s.trainerId === assignedBy && s.status === 'completed' &&
            workoutToDelete?.startTime && s.date === workoutToDelete.startTime.split('T')[0]
          );
          if (matchingSession) {
            getTrainerStore().setState((state: any) => ({
              sessions: state.sessions.map((s: any) =>
                s.id === matchingSession.id ? { ...s, status: 'cancelled' as any } : s
              ),
            }));
          }
        }
        
        // W1: await soft-delete sync. Error is logged but does not roll back
        // the local soft-delete — the next `runDeriveAll` / full-sync pass
        // will retry, and the UI has already filtered the row out.
        const deletedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (deletedWorkout) {
          const ok = await syncWorkoutToSupabase(deletedWorkout);
          if (!ok) {
            console.error('[WorkoutStore] Soft-delete sync failed; local state already updated:', workoutId);
          }
        }
        
        // Silently remove associated feed post
        const { posts } = getSocialStore().getState();
        const linkedPost = posts.find((p: any) => p.workoutId === workoutId);
        if (linkedPost) {
          getSocialStore().setState({
            posts: posts.filter((p: any) => p.workoutId !== workoutId),
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
        getMedalStore().getState().clearMedalsForUser(userId);
      },

      updateWorkoutNotes: async (workoutId: string, notes: string) => {
        set(state => ({
          workoutHistory: state.workoutHistory.map(w =>
            w.id === workoutId ? { ...w, notes } : w
          ),
        }));
        
        // W1: await sync so a tab-close mid-flight is surfaced in the logs;
        // local state is already updated so we don't roll back on failure.
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          const ok = await syncWorkoutToSupabase(updatedWorkout);
          if (!ok) {
            console.error('[WorkoutStore] Notes sync failed:', workoutId);
          }
        }
      },

      getWorkoutById: (workoutId: string) => {
        return get().workoutHistory.find(w => w.id === workoutId);
      },

      updateCompletedWorkout: async (workoutId: string, updates: Partial<Workout>) => {
        set(state => ({
          workoutHistory: state.workoutHistory.map(w =>
            w.id === workoutId ? { ...w, ...updates } : w
          ),
        }));
        
        // W1: await sync. On failure we still run runDeriveAll locally so the
        // UI reflects the edit; the next full-sync pass retries the workout.
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          const ok = await syncWorkoutToSupabase(updatedWorkout);
          if (!ok) {
            console.error('[WorkoutStore] Edit sync failed:', workoutId);
          }
          
          // deriveAll: recompute PBs, medals, ratings, volume after edit
          get().runDeriveAll(updatedWorkout.userId);
        }
      },

      removeExerciseFromCompletedWorkout: async (workoutId: string, exerciseId: string) => {
        const workout = get().workoutHistory.find(w => w.id === workoutId);
        if (!workout) return;
        
        const updatedExercises = workout.exercises.filter(e => e.id !== exerciseId);
        
        set(state => ({
          workoutHistory: state.workoutHistory.map(w =>
            w.id === workoutId ? { ...w, exercises: updatedExercises } : w
          ),
        }));
        
        // W1: await sync + recompute derived state. On failure we log and
        // still recompute locally.
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          const ok = await syncWorkoutToSupabase(updatedWorkout);
          if (!ok) {
            console.error('[WorkoutStore] removeExercise sync failed:', workoutId);
          }
          get().runDeriveAll(workout.userId);
        }
      },

      removeSetFromCompletedWorkout: async (workoutId: string, exerciseId: string, setId: string) => {
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
        
        // W1: await sync + recompute derived state. On failure we log and
        // still recompute locally (this handles PB reversion).
        const updatedWorkout = get().workoutHistory.find(w => w.id === workoutId);
        if (updatedWorkout) {
          const ok = await syncWorkoutToSupabase(updatedWorkout);
          if (!ok) {
            console.error('[WorkoutStore] removeSet sync failed:', workoutId);
          }
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
        const normId = normalizeExerciseId(exerciseId);
        // PT session: trainer is logged in, working with a client
        if (clientId && clientId !== userId) {
          const trainerKey = `${userId}:${clientId}:${normId}`;
          // Also check unnormalized key for backwards compat
          return get().exerciseNotes[trainerKey] || get().exerciseNotes[`${userId}:${clientId}:${exerciseId}`] || '';
        }
        // Personal workout or client's own session
        const personalKey = `${clientId || userId}:${normId}`;
        // Check normalized, then unnormalized, then legacy key
        return get().exerciseNotes[personalKey] || get().exerciseNotes[`${clientId || userId}:${exerciseId}`] || get().exerciseNotes[exerciseId] || '';
      },

      setExerciseNotes: (exerciseId: string, notes: string) => {
        const authUser = useAuthStore.getState().user;
        const userId = authUser?.id || '';
        const clientId = get().currentClientId;
        const normId = normalizeExerciseId(exerciseId);
        // PT session: trainer is logged in, working with a client
        let key: string;
        if (clientId && clientId !== userId) {
          key = `${userId}:${clientId}:${normId}`;
        } else {
          key = `${clientId || userId}:${normId}`;
        }
        set(state => ({
          exerciseNotes: {
            ...state.exerciseNotes,
            [key]: notes,
          },
        }));
      },

      recalcActiveExercisePB: (rawExerciseId: string) => {
        const { activeWorkout, workoutHistory, personalBests, getActiveUserId } = get();
        const userId = getActiveUserId();
        const exerciseId = normalizeExerciseId(rawExerciseId);
        const isAssisted = isAssistedExercise(exerciseId, rawExerciseId);
        const userBW = getUserBodyweight(userId);

        // Best from workout history
        let bestRM = 0;
        let bestWeight = 0;
        let bestReps = 0;
        let bestVolume = 0;
        let bestWorkoutId = '';
        let bestAt = '';

        workoutHistory
          .filter(w => w.userId === userId && !w.deletedAt)
          .forEach(w => {
            w.exercises?.forEach(ex => {
              if (normalizeExerciseId(ex.exerciseId) !== exerciseId) return;
              ex.sets?.filter(s => s.completed && s.weight && s.reps).forEach(s => {
                const rm = calculate1RM(s.weight!, s.reps!);
                if (rm === null) return;
                const vol = getSetVolume(s.weight, s.reps!, isAssisted, userBW);
                const better = isAssisted ? s.weight! < bestWeight || !bestWeight : rm > bestRM;
                if (better) {
                  bestRM = isAssisted ? s.weight! : rm;
                  bestWeight = s.weight!;
                  bestReps = s.reps!;
                  bestVolume = Math.max(vol, bestVolume);
                  bestWorkoutId = w.id;
                  bestAt = w.endTime || w.startTime || '';
                }
              });
            });
          });

        // Also check remaining completed sets in active workout
        if (activeWorkout) {
          activeWorkout.exercises.forEach(ex => {
            if (normalizeExerciseId(ex.exerciseId) !== exerciseId) return;
            ex.sets.filter(s => s.completed && s.weight && s.reps).forEach(s => {
              const rm = calculate1RM(s.weight!, s.reps!);
              if (rm === null) return;
              const vol = getSetVolume(s.weight, s.reps!, isAssisted, userBW);
              const better = isAssisted ? s.weight! < bestWeight || !bestWeight : rm > bestRM;
              if (better) {
                bestRM = isAssisted ? s.weight! : rm;
                bestWeight = s.weight!;
                bestReps = s.reps!;
                bestVolume = Math.max(vol, bestVolume);
                bestWorkoutId = activeWorkout.id;
                bestAt = new Date().toISOString();
              }
            });
          });
        }

        const existing = personalBests.find(p => p.exerciseId === exerciseId && p.userId === userId);

        if (bestWeight && bestReps) {
          const updatedPB: PersonalBest = {
            id: existing?.id || uuidv4(),
            exerciseId,
            userId,
            oneRepMax: bestRM,
            bestWeight,
            bestReps,
            bestVolume,
            achievedAt: bestAt,
            workoutId: bestWorkoutId,
          };
          set(state => ({
            personalBests: existing
              ? state.personalBests.map(p => p.id === existing.id ? updatedPB : p)
              : [...state.personalBests, updatedPB],
          }));
        } else if (existing) {
          // No valid sets remain — remove PB
          set(state => ({
            personalBests: state.personalBests.filter(p => p.id !== existing.id),
          }));
        }
      },

      recalculatePBsForUser: (userId: string) => {
        const workouts = get().workoutHistory.filter(w => w.userId === userId && !w.deletedAt);
        const newPBs: Record<string, PersonalBest> = {};
        
        
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
        getMedalStore().getState().calculateStrengthRatingForUser(userId);
      },

      runDeriveAll: (userId: string, completedWorkout: Workout | null = null) => {
        const { earnMedal, hasMedal, revokeMedalsForUser, calculateStrengthRatingForUser } = getMedalStore().getState();

        const result = deriveAll({
          workouts: get().workoutHistory,
          userId,
          completedWorkout,
          normalizeExerciseId,
          medalDeps: { hasMedal, earnMedal, revokeMedalsForUser, normalizeExerciseId, getStrengthRating: getMedalStore().getState().getStrengthRating },
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

        // Batch sync all PBs to Supabase now that workout is finalized
        result.personalBests.forEach(pb => syncPBToSupabase(pb));
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
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        activeWorkout: state.activeWorkout,
        workoutTimer: state.workoutTimer,
        currentClientId: state.currentClientId,
        workoutHistory: state.workoutHistory,
        templates: state.templates,
        personalBests: state.personalBests,
        exerciseNotes: state.exerciseNotes,
        volumeRollups: state.volumeRollups,
      }),
    }
  )
);
