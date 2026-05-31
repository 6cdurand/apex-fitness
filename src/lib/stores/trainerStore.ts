import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scopedStorage } from './scopedStorage';
import { v4 as uuidv4 } from 'uuid';

/**
 * v14-D10: resolve the effective auto-count flag for a (trainer, client) pair.
 * Per-client override (boolean) wins; otherwise falls through to the trainer's account default;
 * if neither is set, defaults to TRUE (the v13-D1 behavior).
 *
 * UI uses this for rendering: the +1 button shows when effectiveAuto === false; the per-client
 * `<Select>` defaults to "Use account default" when autoCountSessions == null/undefined.
 */
export function getEffectiveAutoCount(
  perClient: boolean | null | undefined,
  trainerDefault: boolean | undefined
): boolean {
  if (perClient !== null && perClient !== undefined) return perClient;
  if (trainerDefault !== undefined) return trainerDefault;
  return true;
}

/**
 * v16-D3: compute the displayed lifetime session count for a (trainer, client) pair.
 *
 * Formula:  historicalOffsetSessions  +  COUNT(trainer_sessions WHERE status='completed')
 *
 * - `historicalOffsetSessions` (new v16-D3 column) is the *only* writable source for
 *   manual edits and the +1 button. Toggling auto-count never mutates it.
 * - The auto-count toggle controls whether `endWorkout` writes a new `trainer_sessions`
 *   row on PT-workout completion. It does NOT mutate any stored count.
 * - Legacy fallback order: historicalOffsetSessions → historicalSessionsOffset →
 *   totalSessions (pre-v16-D3 trigger-derived value). Required so installs without
 *   the migration still surface a sensible number.
 */
export function getDisplayedSessionCount(
  client: { clientId?: string; trainerId?: string; historicalOffsetSessions?: number; historicalSessionsOffset?: number; totalSessions?: number } | null | undefined,
  allSessions: Array<{ clientId?: string; trainerId?: string; status?: string }>
): number {
  if (!client) return 0;
  // v16-D3 source of truth. Falls back to the legacy column when the row predates
  // the migration, then to the pre-v16 trigger-derived total as last resort.
  const hasNewOffset = typeof client.historicalOffsetSessions === 'number';
  const hasLegacyOffset = typeof client.historicalSessionsOffset === 'number';
  if (!hasNewOffset && !hasLegacyOffset) {
    // No offset metadata at all — trust the legacy stored count as best-effort.
    return Math.max(0, client.totalSessions ?? 0);
  }
  const offset = hasNewOffset
    ? (client.historicalOffsetSessions || 0)
    : (client.historicalSessionsOffset || 0);
  const completed = allSessions.filter(s =>
    s.clientId === client.clientId &&
    s.trainerId === client.trainerId &&
    s.status === 'completed'
  ).length;
  return Math.max(0, offset + completed);
}
import {
  TrainerClient, ClientGroup, CalendarEvent, ClientSession, ClientPayment,
  SessionPackage, BookingRequest, ClientProgram, ClientProgrammingProfile,
  SavedBlock, BlockPerformance, BlockType,
} from '@/types';
import { useAuthStore } from './authStore';
import {
  syncCalendarEventToSupabase, fetchCalendarEventsFromSupabase, deleteCalendarEventFromSupabase,
  syncSessionWorkoutToSupabase, fetchSessionWorkoutsFromSupabase, deleteSessionWorkoutFromSupabase,
  syncWorkoutLibraryToSupabase, fetchWorkoutLibraryFromSupabase, deleteWorkoutLibraryFromSupabase,
  fetchCircuitLibraryFromSupabase,
  syncPaymentToSupabase, fetchPaymentsFromSupabase, deletePaymentFromSupabase,
  syncClientProgramToSupabase, fetchClientProgramsFromSupabase, deleteClientProgramFromSupabase,
  linkClientToTrainer,
  syncBookingRequestToSupabase, fetchBookingRequestsFromSupabase,
  deleteTrainerClientFromSupabase, deleteClientFromSupabase,
  fetchSavedBlocksFromSupabase, fetchBlockPerformancesFromSupabase,
  syncSavedBlockToSupabase, deleteSavedBlockFromSupabase,
  syncClientProfileToSupabase, fetchClientProfilesFromSupabase,
  syncTrainerSessionToSupabase, syncSessionPackageToSupabase,
  fetchTrainerSessionsFromSupabase, fetchSessionsForUserFromSupabase, fetchSessionPackagesFromSupabase,
  syncTrainerClientToSupabase, fetchTrainerClientsFromSupabase,
  fetchCalendarEventsForUser,
  fetchNotificationsFromSupabase,
} from '../supabaseSync';

import { Workout, PersonalBest, WorkoutExercise, User } from '@/types';
import { calculate1RM } from '../exercises';
import { hashPassword } from './authStore';
import { syncWorkoutTemplateToSupabase, fetchWorkoutTemplatesFromSupabase } from '../supabaseSync';
import { readProfileCache } from '../userFetchUtils';

// v16-D4: shape of the per-day lock explanation surfaced to consumer pages so
// /today + /program + the swap dialog can render "Booked with [trainer]" UI
// instead of a silent unstartable day. Keyed by program day index.
export interface ProgramDayLockReason {
  type: 'pt_session';
  trainerId: string;
  trainerName: string;
  eventId: string;
  eventDate: string;        // ISO YYYY-MM-DD
  eventStartTime: string;   // HH:mm (may be empty)
  eventEndTime: string;     // HH:mm (may be empty)
}

// v16-D4: best-effort trainer-name lookup for the locked-day badge. Walks
// the profile cache, the local apex-users mirror, and finally falls back to
// the literal string "your trainer" so the UI never crashes / shows a UUID.
function resolveTrainerNameForLock(trainerId: string | undefined | null): string {
  if (!trainerId) return 'your trainer';
  // 1. profile cache (chunked Supabase user fetch result)
  try {
    const cache = readProfileCache();
    const cached = cache[trainerId];
    if (cached?.displayName && cached.displayName.trim()) return cached.displayName.trim();
    if (cached?.username && cached.username.trim()) return cached.username.trim();
  } catch {}
  // 2. legacy apex-users localStorage mirror
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('apex-users');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find((u: any) => u && u.id === trainerId);
          if (match?.displayName && String(match.displayName).trim()) return String(match.displayName).trim();
          if (match?.username && String(match.username).trim()) return String(match.username).trim();
        }
      }
    }
  } catch {}
  return 'your trainer';
}

// Cross-store references (resolved at runtime via .getState() — no circular issues)
import { useSocialStore } from './socialStore';
import { useWorkoutStore } from './workoutStore';
import { useMedalStore } from './medalStore';
import { __buildProgramAssignedNotification } from '../programAssignedNotification';
import {
  computeProgramProgress,
  wasEndCycleNotified,
  markEndCycleNotified,
} from '../programProgress';
const getSocialStore = () => useSocialStore;
const getWorkoutStore = () => useWorkoutStore;
const getMedalStore = () => useMedalStore;

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
  savedPrograms: any[]; // v14-D3: Trainer-saved programs as reusable templates
  // v14-D32: last failure reason from syncSavedProgramToSupabase so dialogs
  // can surface a precise toast (RLS vs FK vs NOT-NULL vs table-missing)
  // rather than the canned "apply migrations" message. Cleared on success.
  lastSavedProgramError: { ok: false; reason: 'table_missing' | 'rls_denied' | 'fk_violation' | 'not_null_violation' | 'invalid_uuid' | 'unknown'; message: string } | null;
  
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
  /**
   * v18-D3: scan all of the current trainer's active client programs and
   * fire one in-app `program_ending_soon` notification for each program
   * whose end date is <=3 days away. Idempotent per (programId, endDate)
   * via localStorage guard (see src/lib/programProgress.ts). Flexible /
   * undated programs are skipped — they have no computable end date.
   *
   * Pragmatic on-load check: no global interval, no nightly cron. Hook
   * it onto the trainer dashboard / clients list mount effect.
   */
  checkProgramsEndingSoon: () => void;
  getNextProgramWorkout: (userId: string) => { program: ClientProgram; dayIndex: number; day: any; remainingThisWeek: number; sessionType: 'pt' | 'personal'; completedDayIndices: number[]; lockedDayIndices: number[]; lockReasons: Record<number, ProgramDayLockReason>; isScheduledToday: boolean; nextScheduledDay: string | null; weekSlots: number; slotDayIndices: number[]; slotScheduledDays: string[]; completedSlotCount: number; nextSlotIndex: number } | null;
  rotateProgramDay: (clientId: string, dayIndex: number) => void;
  
  // Client Profiles (onboarding data)
  saveClientProfile: (profile: ClientProgrammingProfile) => void;
  getClientProfile: (clientId: string) => ClientProgrammingProfile | undefined;
  
  // Set initial stats for onboarding existing clients
  setInitialClientStats: (clientId: string, sessionsDone: number, sessionsLeft: number, totalPaid: number) => void;
  
  // P01: Identity normalization heal sweep
  healClientIdReferences: (staleId: string, canonicalId: string) => void;
  healTrainerIdReferences: (staleId: string, canonicalId: string) => void;
  
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
  /**
   * v17-D3: Canonical block-folder creation. Both the Folders-panel
   * "+ New folder" button and the per-block "New folder…" dialog must
   * route through this action so the two paths can't diverge again.
   *
   * Folders are stored as free-text on saved_blocks.folder; an empty folder
   * (no blocks moved in yet) is recorded by appending its name to
   * user.blockFolderOrder, which already persists via the existing
   * block_folder_order column. The folderList memo on the builder page
   * unions both sources so the chip appears immediately.
   */
  createBlockFolder: (name: string) => Promise<{ ok: boolean; name: string | null; reason?: 'invalid' | 'duplicate' | 'persist-failed' }>;
  renameBlockFolder: (oldName: string, newName: string) => Promise<{ ok: boolean; count: number }>;
  deleteBlockFolder: (folderName: string, targetFolder: string | null) => Promise<{ ok: boolean; count: number }>;
  
  // v14-D3: Saved Programs
  saveProgramAsTemplate: (program: any) => Promise<any | null>;
  clearSavedProgramError: () => void; // v14-D32
  updateSavedProgram: (id: string, updates: any) => Promise<void>;
  deleteSavedProgram: (id: string) => Promise<void>;
  assignSavedProgramToClient: (programId: string, clientId: string) => Promise<void>;
  
  // Block Performance Tracking
  recordBlockPerformance: (performance: Omit<BlockPerformance, 'id' | 'performedAt'>) => BlockPerformance;
  getBlockPerformances: (blockId: string, clientId?: string) => BlockPerformance[];
  getBestBlockPerformance: (blockId: string, clientId: string) => BlockPerformance | undefined;
  
  // Supabase sync
  loadFromSupabase: (trainerId: string) => Promise<void>;
  refetchTrainerClientsFromSupabase: (trainerId: string) => Promise<void>;
  /**
   * v18-D2: targeted refetch for the Block Library dialog Sync button.
   * Re-pulls saved_blocks for the current trainer from Supabase and
   * re-reads block_folder_order on the user row, so blocks/folders
   * authored on another device or tab appear without a full reload.
   * Throws on Supabase failure so the caller can surface an error toast.
   */
  refreshBlockLibrary: () => Promise<void>;
  /**
   * v16-D1: refetch sessions + calendar events from Supabase for the
   * given userId, REPLACING the trainer-or-client-scoped slices of the
   * local cache. Called from the auth-login happy paths so a user (in
   * either role) sees PT sessions + bookings written from another
   * device. The trainer-scoped {@link loadFromSupabase} remains the
   * canonical full-sync entry point for trainer dashboards; this lighter
   * action targets just the slices needed for client visibility (no
   * client-list / packages / programs fetch).
   *
   * Replaces (not merges) the slices. Failures are non-fatal — local
   * cache is preserved.
   */
  hydrateForUser: (userId: string) => Promise<void>;
  
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

/**
 * v18-D10 (BUG-L) — durable session writes.
 *
 * Wrap every `syncTrainerSessionToSupabase` call with one retry + loud failure
 * log. Previously these calls were fire-and-forget (no `await`, no retry),
 * which combined with the destructive `loadFromSupabase` hydrate to drop
 * freshly-created sessions on page refresh: the optimistic local row was
 * blown away by `sessions: supabaseSessions` before the unawaited write
 * landed in Supabase.
 *
 * This helper:
 *   1) awaits the initial sync,
 *   2) on failure, waits ~400ms and retries once (handles transient network
 *      drops + the schema-cache PGRST 5xx burst we sometimes get post-deploy),
 *   3) on second failure, logs LOUDLY with the session id so the operator
 *      can see the row in the local store that didn't make it to Supabase.
 *      The F2 hydrate-merge will keep that row around and re-attempt
 *      sync via this same helper.
 *
 * Returns a Promise<boolean> but every caller uses `void syncSessionWithRetry(...)`
 * so the UI stays snappy (the optimistic `set(...)` has already updated state).
 */
async function syncSessionWithRetry(session: ClientSession): Promise<boolean> {
  try {
    const ok = await syncTrainerSessionToSupabase(session);
    if (ok) return true;
  } catch (err) {
    console.warn('[TrainerStore] session sync threw on first attempt:', session.id, err);
  }
  // Single retry after a short backoff. Don't loop — keeps failure-mode latency
  // bounded (~400ms) and lets F2 hydrate-merge handle anything that still drops.
  await new Promise(resolve => setTimeout(resolve, 400));
  try {
    const ok = await syncTrainerSessionToSupabase(session);
    if (ok) return true;
    console.error(
      '[TrainerStore] session sync FAILED after retry — row kept locally for next hydrate re-push:',
      { sessionId: session.id, clientId: session.clientId, trainerId: session.trainerId, status: session.status, date: session.date },
    );
    return false;
  } catch (err) {
    console.error(
      '[TrainerStore] session sync THREW after retry — row kept locally for next hydrate re-push:',
      { sessionId: session.id, clientId: session.clientId, error: err },
    );
    return false;
  }
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
      savedPrograms: [], // v14-D3
      lastSavedProgramError: null, // v14-D32

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
          const { earnMedal, hasMedal } = getMedalStore().getState();
          
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
        
        // Link client → trainer in users table so client can see the trainer
        linkClientToTrainer(clientId, trainerId).then(success => {
          if (success) {
            console.log('[Trainer Store] ✅ Client linked to trainer in users table:', clientId);
          } else {
            console.error('[Trainer Store] ❌ Failed to link client to trainer:', clientId);
          }
        });
        
        // Notify client that they have been connected to a trainer
        const trainerName = useAuthStore.getState().user?.displayName || 'Your trainer';
        getSocialStore().getState().addNotification({
          userId: clientId,
          type: 'session_booked' as any,
          title: 'Trainer Connected',
          message: `${trainerName} has added you as a client. You can now view your programs and sessions.`,
          link: '/trainer',
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
          import('../supabaseSync').then(({ syncTrainerClientToSupabase }) => {
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
              historicalSessionsOffset: updatedClient.historicalSessionsOffset,
              // v16-D3: dedicated manual offset column (preferred source of truth
              // for displayed totals). Legacy column kept above for back-compat.
              historicalOffsetSessions: (updatedClient as any).historicalOffsetSessions,
              totalSessionsOffset: updatedClient.totalSessionsOffset,
              totalPaidOffset: updatedClient.totalPaidOffset,
              autoCountSessions: updatedClient.autoCountSessions,
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
        getSocialStore().setState({ posts: [], notifications: [] });
        // Clear workout data (workouts, PBs, medals)
        getWorkoutStore().setState({ workoutHistory: [], personalBests: [], templates: [] });
        getMedalStore().setState({ medals: [], evolvingMedalProgress: {}, strengthRating: null });
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
          const email = `${client.displayName.toLowerCase().replace(/\s+/g, '.')}@placeholder.local`;
          
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
            password: hashPassword((() => { const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; let p = ''; for (let i = 0; i < 8; i++) p += c.charAt(Math.floor(Math.random() * c.length)); return p; })()),
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
              getWorkoutStore().setState((state: any) => ({
                workoutHistory: [...state.workoutHistory, workoutRecord],
              }));
            });
            
            // Add all personal bests to store
            const personalBests = Object.values(personalBestsMap);
            getWorkoutStore().setState((state: any) => ({
              personalBests: [...state.personalBests, ...personalBests],
            }));
            
            // Check and award medals for each personal best (per client)
            const { earnMedal, hasMedal } = getMedalStore().getState();
            
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
        // Auto-set scoping fields if not already provided
        const scope: CalendarEvent['eventScope'] = event.eventScope || (
          event.type === 'workout' && event.clientId ? 'client_assigned' :
          !event.clientId ? 'trainer_personal' :
          'shared_session'
        );
        const owner = event.ownerUserId || (
          scope === 'client_assigned' ? event.clientId :
          scope === 'trainer_personal' ? event.trainerId :
          event.trainerId // shared_session: trainer owns it
        );
        
        const newEvent: CalendarEvent = {
          id: uuidv4(),
          ...event,
          ownerUserId: owner,
          eventScope: scope,
        };

        set(state => ({
          calendarEvents: [...state.calendarEvents, newEvent],
        }));
        // Sync to Supabase immediately
        syncCalendarEventToSupabase(newEvent);

        // Notify client about booked session
        if (newEvent.clientId && newEvent.type === 'session') {
          const trainerName = useAuthStore.getState().user?.displayName || 'Your trainer';
          getSocialStore().getState().addNotification({
            userId: newEvent.clientId,
            type: 'session_booked',
            title: 'Session Booked',
            message: `${trainerName} booked a session for ${newEvent.date ? new Date(newEvent.date).toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' }) : 'you'}${newEvent.startTime ? ` at ${newEvent.startTime}` : ''}`,
            link: '/today',
          });
        }
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
        // v16-D3 (BUG-6.a / F4): idempotency guard. The off-by-4 was a combination
        // of React StrictMode double-fires + endWorkout writers being indirectly
        // re-invoked by upstream effects. Even after F3 gates the call site, this
        // dedupe is defence-in-depth so duplicate calls within a short window
        // collapse to a single row. Match criteria, in priority order:
        //   1) Same calendarEventId, if provided.
        //   2) Same {clientId, date, startTime, status} created within 5s.
        const now = Date.now();
        const dedupeWindowMs = 5000;
        const incoming: any = session;
        const existing = get().sessions.find((s: any) => {
          if (incoming.calendarEventId && s.calendarEventId && s.calendarEventId === incoming.calendarEventId) return true;
          if (s.clientId !== incoming.clientId) return false;
          if (s.trainerId !== incoming.trainerId) return false;
          if (s.date !== incoming.date) return false;
          if ((s.startTime || '') !== (incoming.startTime || '')) return false;
          if ((s.status || '') !== (incoming.status || '')) return false;
          if (!s.createdAt) return false;
          return now - new Date(s.createdAt).getTime() < dedupeWindowMs;
        });
        if (existing) {
          console.log('[TrainerStore] v16-D3 addSession dedupe — collapsing duplicate within window:', existing.id);
          return;
        }
        const newSession: ClientSession = {
          id: uuidv4(),
          ...session,
          // Stamp createdAt so the dedupe window check above has a reference
          // for future duplicates within the same render commit.
          createdAt: (session as any).createdAt || new Date().toISOString(),
        } as any;
        set(state => ({
          sessions: [...state.sessions, newSession],
        }));
        // v18-D10: durable write. Optimistic local insert above keeps the UI
        // snappy; the helper awaits the Supabase upsert internally with one
        // retry. We `void` so we don't block the calling tick. Failures are
        // logged loudly and the row stays in local state, where F2
        // (loadFromSupabase merge) will keep it on reload and re-attempt.
        void syncSessionWithRetry(newSession);
        // v16-D3: displayed total is derived live via getDisplayedSessionCount
        // (offset + count of completed sessions). No manual increment needed.
      },

      updateSession: (sessionId, updates) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, ...updates } : s
          ),
        }));
        // v18-D10: durable write (see syncSessionWithRetry rationale).
        const updated = get().sessions.find(s => s.id === sessionId);
        if (updated) void syncSessionWithRetry(updated);
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
          // v18-D10: durable write (see syncSessionWithRetry rationale).
          void syncSessionWithRetry(session);
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
              const { earnMedal, medals } = getMedalStore().getState();
              
              // Build Set of earned medal IDs for O(1) lookup instead of repeated array scans
              const earned = new Set(
                medals.filter((m: any) => m.earned && m.userId === trainerId).map((m: any) => m.definitionId)
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
        // v18-D10: durable write (see syncSessionWithRetry rationale).
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) void syncSessionWithRetry(session);
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
          // v18-D10: durable write (see syncSessionWithRetry rationale).
          void syncSessionWithRetry(session);
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
        // v18-D10: durable write (see syncSessionWithRetry rationale).
        const updatedSession = get().sessions.find(s => s.id === sessionId);
        if (updatedSession) void syncSessionWithRetry(updatedSession);
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
              const { earnMedal, hasMedal } = getMedalStore().getState();
              
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
        getSocialStore().getState().addNotification({
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
        getSocialStore().getState().addNotification({
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
        getSocialStore().getState().addNotification({
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
        
        // Notify client about new program assignment.
        //
        // D12 (Part A) — this store action is now the SINGLE writer for
        // `program_assigned` notifications. The program builder used to
        // also call addNotification(...) directly after addClientProgram,
        // which produced 2x "New Program Assigned" rows per trainer save.
        // That duplicate writer has been removed; all assignment paths
        // (main builder, client/[id]/program/preview, client/[id]/program/
        // builder) now flow through this single writer.
        //
        // Gating: skip the notification when the program was self-created
        // (client authoring their own program — same user on both sides of
        // the relationship). The main builder used `isTrainerMode &&
        // targetClientId !== user.id` for this; the equivalent invariant
        // on the program itself is `trainerId !== clientId`.
        if (program.trainerId && program.clientId && program.trainerId !== program.clientId) {
          const authUser = useAuthStore.getState().user;
          const trainerName = authUser?.displayName || 'Your trainer';
          const senderId = authUser?.id || program.trainerId;

          // Derive the richer "N workouts, F×/week for W weeks" message
          // fields from the ClientProgram itself so we don't have to widen
          // addClientProgram's signature (which would touch 3 call sites).
          // Fallback-safe: alternate assignment paths (preview +
          // clients/[id]/program/builder) omit endDate / trainingDaysPerWeek,
          // and the helper falls back to the shorter message in that case.
          const workoutCount = Array.isArray(program.weeklyPlan)
            ? program.weeklyPlan.length
            : undefined;
          const daysPerWeek = program.trainingDaysPerWeek;
          let actualWeeks: number | undefined;
          if (program.startDate && program.endDate) {
            const startMs = new Date(program.startDate).getTime();
            const endMs = new Date(program.endDate).getTime();
            if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
              actualWeeks = Math.max(1, Math.round((endMs - startMs) / (7 * 86400000)));
            }
          }

          const payload = __buildProgramAssignedNotification({
            program: {
              id: program.id,
              clientId: program.clientId,
              templateName: program.templateName,
            },
            trainerName,
            senderId,
            workoutCount,
            daysPerWeek,
            actualWeeks,
          });
          getSocialStore().getState().addNotification(payload);
        }
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
        // Find the program before deleting so we can clean up calendar events
        const program = get().clientPrograms.find(p => p.id === programId);

        // v14-D26: notify the client BEFORE removing the program from the
        // store so program.clientId / program.templateName are still
        // readable. Mirrors the addClientProgram → program_assigned
        // notification path; the deletion path was previously silent which
        // caused clients to lose access with no warning.
        if (program?.clientId) {
          const trainerName = useAuthStore.getState().user?.displayName || 'Your trainer';
          const senderId = useAuthStore.getState().user?.id;
          getSocialStore().getState().addNotification({
            userId: program.clientId,
            type: 'program_removed',
            title: 'Program Removed',
            message: `${trainerName} removed "${program.templateName || 'your program'}" from your plan. Reach out if you have questions.`,
            link: '/program',
            programId: program.id,
            senderId,
          });
        }

        set(state => ({
          clientPrograms: state.clientPrograms.filter(p => p.id !== programId),
        }));
        // Delete from Supabase
        deleteClientProgramFromSupabase(programId);
        
        // Cascade: delete related calendar events
        if (program) {
          const recurrenceKey = `program-${programId}`;
          const relatedEvents = get().calendarEvents.filter(e => {
            // Match by programId field (new events)
            if ((e as any).programId === programId) return true;
            // Match by recurrenceGroup (builder-created events)
            if ((e as any).recurrenceGroup === recurrenceKey) return true;
            // Fallback: match by client + trainer + workout type + scheduled status + title
            if (e.clientId === program.clientId && e.trainerId === program.trainerId && e.type === 'workout' && e.status === 'scheduled') {
              const dayLabels = program.weeklyPlan?.map((d: any) => d.dayLabel) || [];
              return dayLabels.some((label: string) => e.title?.includes(label));
            }
            return false;
          });
          relatedEvents.forEach(e => get().deleteCalendarEvent(e.id));
          if (relatedEvents.length > 0) {
            console.log(`[Trainer Store] 🗑️ Cascade deleted ${relatedEvents.length} calendar events for program ${programId}`);
          }
        }
      },

      getClientPrograms: (clientId) => {
        return get().clientPrograms.filter(p => p.clientId === clientId);
      },

      getActiveProgram: (clientId) => {
        const candidates = get().clientPrograms.filter(
          p => p.clientId === clientId && p.status === 'active'
        );
        if (candidates.length === 0) return undefined;
        if (candidates.length === 1) return candidates[0];
        // P05: Deterministic tie-break on multiple active programs
        return candidates.reduce((best, p) => {
          const bUpd = best.updatedAt || best.createdAt || '';
          const pUpd = p.updatedAt || p.createdAt || '';
          if (pUpd > bUpd) return p;
          if (pUpd < bUpd) return best;
          return p.id < best.id ? p : best;
        });
      },

      // v18-D3: trainer-side 3-day end-of-cycle heads-up.
      // Pragmatic on-load check, no nightly cron. Scoped to the current
      // trainer's active client programs. Skips flexible / undated
      // programs (no computable end). Deduped per (programId, endDate)
      // via localStorage guard so re-loading the dashboard the same day
      // doesn't spam; if the trainer extends the program the end-date
      // key changes and the notification may fire once more for the new
      // end — desired per brief §1.
      checkProgramsEndingSoon: () => {
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return;
        const now = new Date();
        const programs = get().clientPrograms.filter(
          p => p.trainerId === trainerId && p.status === 'active'
        );
        const clients = get().clients;
        programs.forEach(p => {
          const prog = computeProgramProgress(p, now);
          if (!prog) return; // flexible / undated — SKIP per brief §1
          if (prog.daysRemaining > 3 || prog.daysRemaining < 0) return;
          if (wasEndCycleNotified(p.id, prog.endDate)) return;

          const client = clients.find(c => c.id === p.clientId);
          const clientName =
            (client as any)?.displayName ||
            (client as any)?.name ||
            'A client';
          const dayWord = prog.daysRemaining === 1 ? 'day' : 'days';

          getSocialStore().getState().addNotification({
            userId: trainerId,
            type: 'program_ending_soon',
            title: 'Program ending soon',
            message: `${clientName}'s "${p.templateName || 'program'}" ends in ${prog.daysRemaining} ${dayWord}. Plan the next block.`,
            // v16-D7 deep-link pattern: route the trainer straight to the
            // client's program tab so they can extend / assign next.
            deepLinkPath: `/trainer/clients/${p.clientId}?tab=program`,
            programId: p.id,
            senderId: trainerId,
          });
          markEndCycleNotified(p.id, prog.endDate);
        });
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
        
        const { workoutHistory } = getWorkoutStore().getState();
        
        // Helper: does this workout belong to THIS program? (v10-D1 dual detection)
        const matchesProgram = (w: any): boolean => {
          if (w.userId !== userId || w.status !== 'completed' || w.deletedAt) return false;
          // D17 fast path
          if (w.sourceProgramId === program.id) return true;
          // Legacy prefix path
          return !!w.templateId?.startsWith(programPrefix);
        };

        // Helper: extract the day index this workout represents
        const extractDayIndex = (w: any): number => {
          if (typeof w.sourceDayIndex === 'number') return w.sourceDayIndex;
          const suffix = w.templateId?.replace(programPrefix, '') || '';
          return parseInt(suffix) || 0;
        };

        const programWorkoutsThisWeek = workoutHistory.filter((w: any) => {
          if (!matchesProgram(w)) return false;
          const d = new Date(w.startTime);
          return d >= weekStart && d < weekEnd;
        });
        const completedThisWeek = programWorkoutsThisWeek.length;
        
        const completedDayIndices = programWorkoutsThisWeek.map(extractDayIndex);
        
        const remainingThisWeek = Math.max(0, freq - completedThisWeek);
        
        // Compute cycle position from total lifetime program-specific completions
        const programStart = program.startDate ? new Date(program.startDate) : new Date(program.createdAt);
        const totalCompleted = workoutHistory.filter((w: any) => {
          if (!matchesProgram(w)) return false;
          const d = new Date(w.startTime);
          return d >= programStart;
        }).length;

        // v15-D4: a program day is "locked" if the trainer has a future-or-current
        // PT session booked for it this week and that session has not yet been
        // completed. Past bookings with no completion auto-free (ghost protection).
        // Cancelled bookings never lock.
        // v16-D4: alongside lockedDayIndices we also build lockReasons keyed
        // by day index so consumer UI can render "Booked with [trainer] on
        // [date]" instead of a silent unstartable card. If multiple events
        // collide on the same dayIndex (shouldn't happen but defence in depth)
        // the earliest one wins.
        const lockReasons: Record<number, ProgramDayLockReason> = {};
        const lockedEvents = (get().calendarEvents || []).filter((e: any) => {
          if (e.clientId !== userId) return false;
          if (e.type !== 'session') return false;
          if (e.status === 'cancelled') return false;
          // v15-D8: completed PT releases the lock regardless of whether
          // the workout-side completion propagation worked. Defence in
          // depth — even if the matchesProgram() path regresses, a
          // status='completed' booking will never wrongfully lock a day.
          if (e.status === 'completed') return false;
          if (e.programId !== program.id) return false;
          if (typeof e.programDayIndex !== 'number') return false;
          // Skip if the trainer already completed it — completedDayIndices
          // already covers "done this week"; layering a lock on top would
          // double-state the pill (lock + done). Done wins.
          if (completedDayIndices.includes(e.programDayIndex)) return false;
          const eventDate = new Date(e.date);
          if (eventDate < weekStart || eventDate >= weekEnd) return false;
          // Future / in-progress booking → locked. Past booking with no
          // completion → auto-free (do NOT lock; the day is back up for grabs).
          const eventEndDate = new Date(`${e.date}T${e.endTime || '23:59:00'}`);
          if (eventEndDate < now) return false;
          return true;
        });
        lockedEvents
          .slice()
          .sort((a: any, b: any) => {
            // Earliest date / start time wins so the badge shows the soonest booking.
            const ka = `${a.date || ''}T${a.startTime || '23:59'}`;
            const kb = `${b.date || ''}T${b.startTime || '23:59'}`;
            return ka.localeCompare(kb);
          })
          .forEach((e: any) => {
            const idx = e.programDayIndex as number;
            if (lockReasons[idx]) return; // earliest wins
            lockReasons[idx] = {
              type: 'pt_session',
              trainerId: e.trainerId || '',
              trainerName: resolveTrainerNameForLock(e.trainerId),
              eventId: e.id || '',
              eventDate: e.date || '',
              eventStartTime: e.startTime || '',
              eventEndTime: e.endTime || '',
            };
          });
        const lockedDayIndices: number[] = lockedEvents.map((e: any) => e.programDayIndex as number);

        // v15-D4: pick the next-up suggestion by walking forward from the
        // cycle position, skipping done and locked days. If every day is
        // either done or locked, fall back to the cycle position so the
        // caller can render an appropriate empty state.
        const baseDayIndex = totalCompleted % program.weeklyPlan.length;
        let nextDayIndex = baseDayIndex;
        for (let i = 0; i < program.weeklyPlan.length; i++) {
          const candidate = (baseDayIndex + i) % program.weeklyPlan.length;
          if (completedDayIndices.includes(candidate)) continue;
          if (lockedDayIndices.includes(candidate)) continue;
          nextDayIndex = candidate;
          break;
        }
        const dayIndex = nextDayIndex;
        // v16-D5 BUG-16: defensive modulo so a stale dayIndex never reaches
        // outside weeklyPlan (the loop above already clamps via `% length`
        // but this keeps every consumer safe if `nextDayIndex` is ever set
        // by another path).
        const day = program.weeklyPlan[dayIndex % program.weeklyPlan.length];

        // v16-D5 BUG-16: build the week-slot expansion so consumers can
        // render N pills / N day-cards when N > weeklyPlan.length
        // (e.g. Push/Pull on Mon/Wed/Fri → 3 slots → [Push, Pull, Push]).
        // For fixed-schedule programs the slot list is anchored to
        // selectedDays (ordered by weekday); for flexible programs it's
        // just freq generic slots.
        const WEEKDAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
        const weekSlots = (program.scheduleMode === 'fixed' && program.selectedDays?.length)
          ? program.selectedDays.length
          : freq;
        const slotScheduledDays: string[] = (program.scheduleMode === 'fixed' && program.selectedDays?.length)
          ? [...program.selectedDays].sort((a, b) => WEEKDAY_ORDER.indexOf(a as any) - WEEKDAY_ORDER.indexOf(b as any))
          : [];
        const slotDayIndices: number[] = Array.from({ length: weekSlots }, (_, i) =>
          program.weeklyPlan.length > 0 ? i % program.weeklyPlan.length : 0
        );
        // Left-anchored progress: completedSlotCount = number of sessions
        // done this week, clamped to weekSlots so the strip never
        // overflows even if the client logged extras.
        const completedSlotCount = Math.min(completedThisWeek, weekSlots);
        // nextSlotIndex: walk slots forward from completedSlotCount,
        // skipping any that map to a locked weeklyPlan idx. Falls back to
        // completedSlotCount if every remaining slot is locked.
        let nextSlotIndex = Math.min(completedSlotCount, Math.max(0, weekSlots - 1));
        for (let s = completedSlotCount; s < weekSlots; s++) {
          if (lockedDayIndices.includes(slotDayIndices[s])) continue;
          nextSlotIndex = s;
          break;
        }

        // Determine session type from PT map
        const slotInWeek = completedThisWeek % freq;
        const sessionType = program.sessionPTMap?.[slotInWeek] === 'pt' ? 'pt' : 'personal';
        
        // Schedule awareness: check if today is a scheduled day for fixed programs
        const todayDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayDayName = todayDayNames[now.getDay()];
        let isScheduledToday = true;
        let nextScheduledDay: string | null = null;
        
        if (program.scheduleMode === 'fixed' && program.selectedDays?.length) {
          isScheduledToday = program.selectedDays.includes(todayDayName as any);
          if (!isScheduledToday) {
            // Find the next scheduled day from today
            for (let offset = 1; offset <= 7; offset++) {
              const checkIdx = (now.getDay() + offset) % 7;
              const checkName = todayDayNames[checkIdx];
              if (program.selectedDays.includes(checkName as any)) {
                nextScheduledDay = checkName;
                break;
              }
            }
          }
        }
        // Flexible programs: always available (user picks which workout)
        
        return { program, dayIndex, day, remainingThisWeek, sessionType, completedDayIndices, lockedDayIndices, lockReasons, isScheduledToday, nextScheduledDay, weekSlots, slotDayIndices, slotScheduledDays, completedSlotCount, nextSlotIndex };
      },

      rotateProgramDay: (clientId, dayIndex) => {
        const program = get().clientPrograms.find(p => p.clientId === clientId && p.status === 'active');
        if (!program || !program.weeklyPlan?.length) return;
        const plan = [...program.weeklyPlan];
        const [pulled] = plan.splice(dayIndex, 1);
        plan.push(pulled);
        get().updateClientProgram(program.id, { weeklyPlan: plan });
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

      // P01: Identity normalization heal sweep
      healClientIdReferences: (staleId, canonicalId) => {
        const state = get();
        const updated = {
          clientPrograms: state.clientPrograms.map(p =>
            p.clientId === staleId ? { ...p, clientId: canonicalId } : p
          ),
          clients: state.clients.map(c =>
            c.clientId === staleId ? { ...c, clientId: canonicalId } : c
          ),
          calendarEvents: state.calendarEvents.map(e =>
            e.clientId === staleId ? { ...e, clientId: canonicalId } : e
          ),
          sessions: state.sessions.map(s =>
            s.clientId === staleId ? { ...s, clientId: canonicalId } : s
          ),
          payments: state.payments.map(p =>
            p.clientId === staleId ? { ...p, clientId: canonicalId } : p
          ),
          blockPerformances: state.blockPerformances.map(b =>
            b.clientId === staleId ? { ...b, clientId: canonicalId } : b
          ),
        };
        set(updated);
        
        // Re-sync updated rows to Supabase
        updated.clientPrograms.forEach(p => {
          if (p.clientId === canonicalId) {
            syncClientProgramToSupabase(p).catch(e => 
              console.error('[healClientId] Failed to sync program:', e)
            );
          }
        });
        updated.calendarEvents.forEach(e => {
          if (e.clientId === canonicalId) {
            syncCalendarEventToSupabase(e).catch(err => 
              console.error('[healClientId] Failed to sync calendar event:', err)
            );
          }
        });
        updated.sessions.forEach(s => {
          if (s.clientId === canonicalId) {
            syncTrainerSessionToSupabase(s).catch(err => 
              console.error('[healClientId] Failed to sync session:', err)
            );
          }
        });
        updated.payments.forEach(p => {
          if (p.clientId === canonicalId) {
            syncPaymentToSupabase(p).catch(err => 
              console.error('[healClientId] Failed to sync payment:', err)
            );
          }
        });
      },

      healTrainerIdReferences: (staleId, canonicalId) => {
        const state = get();
        const updated = {
          clientPrograms: state.clientPrograms.map(p =>
            p.trainerId === staleId ? { ...p, trainerId: canonicalId } : p
          ),
          clients: state.clients.map(c =>
            c.trainerId === staleId ? { ...c, trainerId: canonicalId } : c
          ),
          sessions: state.sessions.map(s =>
            s.trainerId === staleId ? { ...s, trainerId: canonicalId } : s
          ),
        };
        set(updated);
        
        // Re-sync updated rows
        updated.clientPrograms.forEach(p => {
          if (p.trainerId === canonicalId) {
            syncClientProgramToSupabase(p).catch(e => 
              console.error('[healTrainerId] Failed to sync program:', e)
            );
          }
        });
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
            import('../supabaseSync').then(m => m.fetchClientProgramsForUser(clientId)),
            import('../supabaseSync').then(m => m.fetchCalendarEventsForUser(clientId)),
            import('../supabaseSync').then(m => m.fetchNotificationsFromSupabase(clientId)),
          ]);
          
          const currentPrograms = get().clientPrograms;
          const currentEvents = get().calendarEvents;
          
          // Supabase is source of truth for this client's programs:
          // Keep programs for OTHER clients, replace this client's with Supabase data
          const otherClientPrograms = currentPrograms.filter(cp => cp.clientId !== clientId);
          
          // Supabase is source of truth for this client's events:
          // Keep events for OTHER clients, replace this client's with Supabase data
          const otherClientEvents = currentEvents.filter(ce => ce.clientId !== clientId);
          
          set({
            clientPrograms: [...otherClientPrograms, ...programs],
            calendarEvents: [...otherClientEvents, ...events],
          });
          
          // Load notifications into social store for this client
          if (notifications.length > 0) {
            const currentNotifications = getSocialStore().getState().notifications;
            const newNotifications = notifications.filter(
              (sn: any) => !currentNotifications.find((ln: any) => ln.id === sn.id)
            );
            // Update existing with Supabase data
            const updatedNotifications = currentNotifications.map((ln: any) => {
              const fresh = notifications.find((sn: any) => sn.id === ln.id);
              return fresh ? { ...ln, ...fresh } : ln;
            });
            getSocialStore().setState({
              notifications: [...updatedNotifications, ...newNotifications],
            });
            console.log(`[Trainer Store] ✅ Client notifications loaded: ${notifications.length} from Supabase`);
          }
          
          console.log(`[Trainer Store] ✅ Client data loaded: ${programs.length} programs, ${events.length} events`);

          // Fire-and-forget: record a program receipt per program for this client.
          // Helps diagnose cross-device visibility issues (who received what, when).
          if (programs.length > 0) {
            import('../supabaseSync').then(m => {
              programs.forEach((p: any) => {
                if (p?.id) m.markProgramReceived(p.id, clientId);
              });
            }).catch(() => {});
          }
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
        // Sync confirmation to Supabase
        const confirmed = get().calendarEvents.find(e => e.id === eventId);
        if (confirmed) syncCalendarEventToSupabase(confirmed);
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

        // Notify client that a workout has been assigned
        if (workoutWithTrainer.clientId) {
          const trainerName = useAuthStore.getState().user?.displayName || 'Your trainer';
          getSocialStore().getState().addNotification({
            userId: workoutWithTrainer.clientId,
            type: 'workout_assigned',
            title: 'Workout Ready',
            message: `${trainerName} prepared "${workoutWithTrainer.name || 'a workout'}" for your session`,
            link: '/today',
          });
        }
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

      // Circuit Library — now delegates to savedBlocks with type='circuit'
      saveCircuitTemplate: (circuit) => {
        const savedBlock = get().saveBlock({
          name: circuit.name,
          type: 'circuit',
          exercises: (circuit.exercises || []).map((ex: any, i: number) => ({
            id: ex.id || `ex-${i}`,
            exerciseId: ex.exerciseId || ex.id || `ex-${i}`,
            exerciseName: ex.exerciseName || ex.name || 'Exercise',
            sets: ex.sets || 1,
            reps: String(ex.reps || 10),
            rest: ex.rest || '30s',
          })),
          circuitStyle: circuit.circuitStyle,
          circuitRounds: circuit.rounds,
          circuitDuration: circuit.duration,
          circuitRestBetween: circuit.restBetweenRounds ? parseInt(circuit.restBetweenRounds) : undefined,
        });
        // Return as CircuitTemplate shape for backward compatibility
        return {
          id: savedBlock.id,
          name: savedBlock.name,
          trainerId: savedBlock.trainerId,
          exercises: circuit.exercises,
          circuitStyle: circuit.circuitStyle,
          rounds: circuit.rounds,
          duration: circuit.duration,
          restBetweenRounds: circuit.restBetweenRounds,
          createdAt: savedBlock.createdAt,
        } as CircuitTemplate;
      },

      updateCircuitTemplate: (circuitId, updates) => {
        get().updateBlock(circuitId, {
          ...(updates.name && { name: updates.name }),
          ...(updates.exercises && { exercises: updates.exercises.map((ex: any, i: number) => ({
            id: ex.id || `ex-${i}`,
            exerciseId: ex.exerciseId || ex.id || `ex-${i}`,
            exerciseName: ex.exerciseName || ex.name || 'Exercise',
            sets: ex.sets || 1,
            reps: String(ex.reps || 10),
            rest: ex.rest || '30s',
          })) }),
          ...(updates.circuitStyle && { circuitStyle: updates.circuitStyle }),
          ...(updates.rounds != null && { circuitRounds: updates.rounds }),
          ...(updates.duration != null && { circuitDuration: updates.duration }),
        });
      },

      deleteCircuitTemplate: (circuitId) => {
        get().deleteBlock(circuitId);
      },

      getCircuitTemplate: (circuitId) => {
        // Check savedBlocks first, then fall back to legacy circuitLibrary
        const block = get().savedBlocks.find(b => b.id === circuitId && b.type === 'circuit');
        if (block) {
          return {
            id: block.id,
            name: block.name,
            trainerId: block.trainerId,
            exercises: block.exercises,
            circuitStyle: block.circuitStyle || 'rounds',
            rounds: block.circuitRounds,
            duration: block.circuitDuration,
            restBetweenRounds: block.circuitRestBetween ? String(block.circuitRestBetween) : undefined,
            createdAt: block.createdAt,
          } as CircuitTemplate;
        }
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
        syncSavedBlockToSupabase(newBlock).then(success => {
          if (!success) console.error('[Store] ❌ Block sync FAILED for:', newBlock.id, newBlock.name);
          else console.log('[Store] ✅ Block synced:', newBlock.id, newBlock.name);
        }).catch(err => console.error('[Store] ❌ Block sync exception:', err));
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
          syncSavedBlockToSupabase(updated).then(success => {
            if (!success) console.error('[Store] ❌ Block update sync FAILED for:', blockId);
            else console.log('[Store] ✅ Block updated:', blockId);
          }).catch(err => console.error('[Store] ❌ Block update sync exception:', err));
        }
      },

      deleteBlock: (blockId) => {
        set(state => ({
          savedBlocks: state.savedBlocks.filter(b => b.id !== blockId),
        }));
        // Delete from Supabase
        deleteSavedBlockFromSupabase(blockId).catch(err => {
          console.error('[Store] Error deleting block from Supabase:', err);
        });
      },

      getBlock: (blockId) => {
        return get().savedBlocks.find(b => b.id === blockId);
      },

      getBlocksByType: (type) => {
        const trainerId = useAuthStore.getState().user?.id;
        return get().savedBlocks.filter(b => b.type === type && b.trainerId === trainerId);
      },

      // v17-D3: single source of truth for folder creation. See the
      // interface comment above for why this lives here instead of
      // alongside the dialog or as a one-off in the page component.
      createBlockFolder: async (name: string) => {
        const trimmed = (name ?? '').trim();
        if (!trimmed) return { ok: false, name: null, reason: 'invalid' as const };
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return { ok: false, name: null, reason: 'invalid' as const };

        // Compute the set of folder names already considered to "exist"
        // from BOTH the persisted order array and the derived-from-blocks
        // set, so we never produce a duplicate chip.
        const currentOrder = useAuthStore.getState().user?.blockFolderOrder ?? [];
        const derived = (get().savedBlocks.map(b => b.folder).filter(Boolean) as string[]);
        const lowerSet = new Set([...currentOrder, ...derived].map(f => f.toLowerCase()));
        if (lowerSet.has(trimmed.toLowerCase())) {
          return { ok: false, name: null, reason: 'duplicate' as const };
        }

        // Persist by appending to user.blockFolderOrder. updateBlockFolderOrder
        // is optimistic-with-rollback against public.users.block_folder_order,
        // so a network failure leaves the order array unchanged and we can
        // detect that by re-reading state immediately after.
        const nextOrder = [...currentOrder, trimmed];
        await useAuthStore.getState().updateBlockFolderOrder(nextOrder);
        const after = useAuthStore.getState().user?.blockFolderOrder ?? [];
        if (!after.includes(trimmed)) {
          return { ok: false, name: null, reason: 'persist-failed' as const };
        }
        return { ok: true, name: trimmed };
      },

      renameBlockFolder: async (oldName: string, newName: string) => {
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return { ok: false, count: 0 };
        // Optimistic local
        set(state => ({
          savedBlocks: state.savedBlocks.map(b =>
            b.folder === oldName ? { ...b, folder: newName } : b
          ),
        }));
        const { renameBlockFolderInSupabase } = await import('../supabaseSync');
        return await renameBlockFolderInSupabase(trainerId, oldName, newName);
      },

      deleteBlockFolder: async (folderName: string, targetFolder: string | null) => {
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return { ok: false, count: 0 };
        // Optimistic local
        set(state => ({
          savedBlocks: state.savedBlocks.map(b =>
            b.folder === folderName ? { ...b, folder: targetFolder ?? undefined } : b
          ),
        }));
        const { deleteBlockFolderInSupabase } = await import('../supabaseSync');
        return await deleteBlockFolderInSupabase(trainerId, folderName, targetFolder);
      },

      // v18-D2: targeted refetch for the Block Library Sync button.
      // Re-pulls saved_blocks for the current trainer + re-reads
      // block_folder_order on the users row so blocks/folders authored
      // on another device/tab appear without a full loadFromSupabase().
      refreshBlockLibrary: async () => {
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) {
          throw new Error('refreshBlockLibrary: no authenticated trainer');
        }

        const { supabase } = await import('../supabase');
        const [supabaseSavedBlocks, userFolderRow] = await Promise.all([
          fetchSavedBlocksFromSupabase(trainerId),
          (async () => {
            try {
              const { data, error } = await supabase
                .from('users')
                .select('block_folder_order')
                .eq('id', trainerId)
                .maybeSingle();
              if (error) {
                // block_folder_order column may be absent on legacy schemas
                // (v14-D11 migration 20260521). In that case fall back to
                // the locally cached folder order rather than failing the
                // whole sync.
                if (error.message?.includes('block_folder_order')) {
                  console.warn('[v18-D2] block_folder_order column not present; retaining local folder order.');
                  return null;
                }
                throw error;
              }
              return data;
            } catch (e) {
              throw e;
            }
          })(),
        ]);

        // Map Supabase rows to local SavedBlock shape (matches the
        // mapping in loadFromSupabase below).
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

        // Preserve local-only blocks not yet synced to Supabase so a
        // mid-flight save isn't wiped by a sync that races it.
        const currentSavedBlocks = get().savedBlocks;
        const localOnlyBlocks = currentSavedBlocks.filter(
          localBlock => !savedBlocks.find(sbBlock => sbBlock.id === localBlock.id)
        );

        set({ savedBlocks: [...savedBlocks, ...localOnlyBlocks] });

        // Refresh folder list on the auth user so empty folders (which
        // only live in block_folder_order, not on any saved_blocks row)
        // reflect remote state too.
        if (userFolderRow && Array.isArray((userFolderRow as any).block_folder_order)) {
          const remoteOrder = (userFolderRow as any).block_folder_order as string[];
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            useAuthStore.setState({
              user: { ...currentUser, blockFolderOrder: remoteOrder },
            });
          }
        }
      },

      // v14-D3: Saved Programs
      saveProgramAsTemplate: async (program) => {
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return null;
        const now = new Date().toISOString();
        const newProgram = {
          id: uuidv4(),
          trainerId,
          ...program,
          timesAssigned: 0,
          createdAt: now,
          updatedAt: now,
        };
        // Optimistic local insert so the UI updates immediately.
        set(state => ({
          savedPrograms: [...state.savedPrograms, newProgram],
        }));
        const { syncSavedProgramToSupabase } = await import('../supabaseSync');
        // v14-D28: capture the sync result so callers can surface a clear
        // error if the saved_programs table isn't applied yet (or RLS is
        // blocking the trainer). Without rollback, the local Zustand state
        // shows the row until the next reload, then it silently disappears
        // because `partialize: () => ({})` means nothing persists locally
        // and `fetchSavedProgramsFromSupabase` returns [] for the
        // table-missing path. Roll back the optimistic insert + return
        // null so SaveProgramDialog's try/catch fires the failure toast.
        // v14-D32: stash the rich failure reason on the store so the
        // calling dialog can render a precise toast (RLS vs FK vs
        // NOT-NULL vs table-missing) rather than the canned message.
        const result = await syncSavedProgramToSupabase(newProgram);
        if (!result.ok) {
          set(state => ({
            savedPrograms: state.savedPrograms.filter(p => p.id !== newProgram.id),
            lastSavedProgramError: result,
          }));
          return null;
        }
        set({ lastSavedProgramError: null });
        return newProgram;
      },

      // v14-D32: explicit reset so dialogs can clear a stale error before
      // re-attempting a save (otherwise the previous reason would persist
      // and a successful save followed by a failed unrelated one would
      // briefly render the wrong toast on race).
      clearSavedProgramError: () => set({ lastSavedProgramError: null }),

      updateSavedProgram: async (id, updates) => {
        const now = new Date().toISOString();
        set(state => ({
          savedPrograms: state.savedPrograms.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: now } : p
          ),
        }));
        const updated = get().savedPrograms.find(p => p.id === id);
        if (updated) {
          const { syncSavedProgramToSupabase } = await import('../supabaseSync');
          await syncSavedProgramToSupabase(updated);
        }
      },

      deleteSavedProgram: async (id) => {
        set(state => ({
          savedPrograms: state.savedPrograms.filter(p => p.id !== id),
        }));
        const { deleteSavedProgramFromSupabase } = await import('../supabaseSync');
        await deleteSavedProgramFromSupabase(id);
      },

      assignSavedProgramToClient: async (programId, clientId) => {
        const savedProgram = get().savedPrograms.find(p => p.id === programId);
        if (!savedProgram) return;
        const trainerId = useAuthStore.getState().user?.id;
        if (!trainerId) return;
        const now = new Date().toISOString();
        // Clone the program into a ClientProgram
        const clientProgram: ClientProgram = {
          id: uuidv4(),
          clientId,
          trainerId,
          templateId: savedProgram.id,
          templateName: savedProgram.name,
          phase: (savedProgram.phase as any) || 'none',
          goal: (savedProgram.goals?.[0] as any) || 'general_fitness',
          weeklyPlan: savedProgram.days,
          // v14-D26: preserve the schedule mode the trainer chose when
          // saving. Prefer the raw `scheduleMode` field (newly persisted
          // by saveProgramAsTemplate as of D26); fall back to mapping
          // `structure` ("Fixed days" / "Flexible") for older saved
          // programs that pre-date the raw field. Hardcoded 'fixed' was
          // silently breaking flexible programs flowing through the
          // template/save → assign path opened up by D25.
          scheduleMode: (savedProgram.scheduleMode as any) ||
            (savedProgram.structure === 'Flexible' ? 'flexible' : 'fixed'),
          trainingDaysPerWeek: savedProgram.daysPerWeek,
          startDate: now,
          status: 'active',
          autoRepeat: savedProgram.autoRepeat ?? false,
          createdAt: now,
          updatedAt: now,
        };
        get().addClientProgram(clientProgram);
        // Increment times_assigned
        await get().updateSavedProgram(programId, {
          timesAssigned: savedProgram.timesAssigned + 1,
          lastAssignedAt: now,
        });
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
        import('../supabaseSync').then(async ({ syncBlockPerformanceToSupabase }) => {
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
          supabaseSavedPrograms, // v14-D3
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
          (async () => { const { fetchSavedProgramsFromSupabase } = await import('../supabaseSync'); return await fetchSavedProgramsFromSupabase(trainerId); })(), // v14-D3
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
            // v14-D1 legacy offset (kept for back-compat reads)
            historicalSessionsOffset: sb.historicalSessionsOffset ?? localClient?.historicalSessionsOffset,
            // v16-D3 dedicated manual offset column
            historicalOffsetSessions: sb.historicalOffsetSessions ?? localClient?.historicalOffsetSessions,
            totalSessionsOffset: sb.totalSessionsOffset,
            totalPaidOffset: sb.totalPaidOffset,
            // v14-D10 per-client auto-count override
            autoCountSessions: sb.autoCountSessions ?? localClient?.autoCountSessions ?? null,
            // Nested client user info for name resolution
            client: sb.client || localClient?.client,
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
        
        // Supabase is source of truth — do NOT re-upload local-only events
        // (they were likely deleted on another device)
        
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
          syncSavedBlockToSupabase(block);
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
        
        // v18-D10 (BUG-L) — non-destructive sessions merge.
        //
        // Old behaviour: `sessions: supabaseSessions` blew away any locally-
        // created ClientSession whose `addSession` write hadn't landed in
        // Supabase yet. Combined with the fire-and-forget write, this dropped
        // freshly-created PT sessions on page refresh and reset the displayed
        // count back to offset-only.
        //
        // New behaviour: server rows are authoritative for ids the server
        // knows about, and any local-only row keyed by id NOT present on the
        // server is preserved AND re-synced (using the same helper as the
        // create path, so it gets one retry and a loud failure log).
        //
        // Scope: sessions only. Other slices keep their existing merge logic
        // (clients: existing preserve-local-counter; calendarEvents: existing
        // workoutId preserve; etc.). Per brief, D10 does not touch the
        // counting model — the displayed total is still derived by
        // getDisplayedSessionCount over this merged sessions slice.
        const currentSessions = get().sessions;
        const serverSessionIds = new Set(supabaseSessions.map(s => s.id));
        const localOnlySessions = currentSessions.filter(local => {
          if (serverSessionIds.has(local.id)) return false;
          // Only keep rows that look like a real local write for THIS trainer.
          // Avoids re-attaching stale sessions left over from a previous
          // trainer login (scoped clears already run; this is belt-and-braces).
          if (local.trainerId !== trainerId) return false;
          return true;
        });
        if (localOnlySessions.length > 0) {
          console.warn(
            '[Trainer Store] v18-D10 preserving',
            localOnlySessions.length,
            'local-only session row(s) not present on Supabase; re-attempting sync.',
            localOnlySessions.map(s => s.id),
          );
          // Re-attempt sync for each local-only row. Fire-and-forget at this
          // level is fine — syncSessionWithRetry handles await+retry+log
          // internally, and the row is already retained in the merged set
          // below regardless of whether this round succeeds.
          for (const s of localOnlySessions) {
            void syncSessionWithRetry(s);
          }
        }
        const mergedSessions: ClientSession[] = [...supabaseSessions, ...localOnlySessions];

        // REPLACE localStorage with merged Supabase data
        set({
          clients: [...clients, ...localOnlyClients],
          sessions: mergedSessions,
          sessionPackages: supabasePackages,
          calendarEvents: mergedCalendarEvents,
          payments: supabasePayments,
          clientPrograms: (() => {
            const currentPrograms = get().clientPrograms;
            // Supabase is source of truth — do NOT re-upload local-only programs
            // (they were likely deleted on another device)
            const merged = supabasePrograms.map((sbProg: any) => {
              const localProg = currentPrograms.find((lp: any) => lp.id === sbProg.id);
              // If Supabase lost trainingDaysPerWeek but local has it, preserve & re-sync
              if (localProg && localProg.trainingDaysPerWeek && !sbProg.trainingDaysPerWeek) {
                const restored = { ...sbProg, trainingDaysPerWeek: localProg.trainingDaysPerWeek, scheduleMode: localProg.scheduleMode, selectedDays: localProg.selectedDays, cycleAcrossWeeks: localProg.cycleAcrossWeeks, sessionPTMap: localProg.sessionPTMap, nextWorkoutIndex: localProg.nextWorkoutIndex, autoRepeat: localProg.autoRepeat, sessionType: localProg.sessionType };
                syncClientProgramToSupabase(restored);
                return restored;
              }
              return sbProg;
            });
            return merged;
          })(),
          bookingRequests: supabaseBookings,
          sessionWorkouts: [...supabaseSessionWorkouts, ...localOnlyWorkouts],
          workoutLibrary: supabaseWorkoutLibrary,
          circuitLibrary: supabaseCircuitLibrary,
          savedBlocks: [...savedBlocks, ...localOnlyBlocks],
          blockPerformances,
          clientProfiles: [...supabaseClientProfiles, ...localOnlyProfiles],
          savedPrograms: supabaseSavedPrograms || [], // v14-D3
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
          savedPrograms: (supabaseSavedPrograms || []).length, // v14-D3
        });
        
        // Also load workout history for all clients
        await getWorkoutStore().getState().loadWorkoutHistoryFromSupabase(trainerId, true);
        
        // Load user-created workout templates from Supabase
        const supabaseTemplates = await fetchWorkoutTemplatesFromSupabase(trainerId);
        if (supabaseTemplates.length > 0) {
          const currentTemplates = getWorkoutStore().getState().templates;
          const localOnlyTemplates = currentTemplates.filter(
            (lt: any) => !supabaseTemplates.find((st: any) => st.id === lt.id)
          );
          localOnlyTemplates.forEach((t: any) => syncWorkoutTemplateToSupabase(t));
          getWorkoutStore().setState({ templates: [...supabaseTemplates, ...localOnlyTemplates] });
          console.log(`[Trainer Store] ✅ Templates loaded: ${supabaseTemplates.length} from Supabase, ${localOnlyTemplates.length} local-only`);
        }
        
        // Load notifications from Supabase into social store
        const supabaseNotifications = await fetchNotificationsFromSupabase(trainerId);
        if (supabaseNotifications.length > 0) {
          const currentNotifications = getSocialStore().getState().notifications;
          // Merge: Supabase as source of truth, keep local-only notifications
          const localOnlyNotifications = currentNotifications.filter(
            (ln: any) => !supabaseNotifications.find((sn: any) => sn.id === ln.id)
          );
          // Sync local-only to Supabase
          localOnlyNotifications.forEach((n: any) => {
            import('../supabaseSync').then(({ syncNotificationToSupabase }) => {
              syncNotificationToSupabase(n);
            });
          });
          getSocialStore().setState({ 
            notifications: [...supabaseNotifications, ...localOnlyNotifications] 
          });
          console.log(`[Trainer Store] ✅ Notifications loaded: ${supabaseNotifications.length} from Supabase, ${localOnlyNotifications.length} local-only`);
        }
      },

      /**
       * v16-D1 (F3): authoritative replace-on-login hydrate for the
       * sessions + calendar slices that drive the user-facing surfaces:
       *
       * - Trainer profile "Recent Client Sessions" → reads `sessions` filtered
       *   by `trainerId === user.id`. Pre-fix: empty after a fresh login
       *   because the local array never refetched the trainer's PT sessions.
       * - Client profile "Workout History" + /today PT-session card → reads
       *   `sessions` filtered by `clientId === user.id`. Pre-fix: empty.
       * - Client calendar bookings → reads `calendarEvents` filtered by
       *   `clientId === user.id`. Pre-fix: empty.
       *
       * Both halves come from the new sibling fetcher
       * {@link fetchSessionsForUserFromSupabase} which OR's
       * `trainer_id = userId, client_id = userId`. Calendar events are
       * pulled from BOTH the trainer-scoped and client-scoped readers so
       * a hybrid user (trainer who is also someone else's client) sees
       * their full schedule.
       *
       * Slices touched: `sessions`, `calendarEvents`. `clients` /
       * `sessionPackages` / `payments` / `clientPrograms` are NOT
       * refetched here — those are trainer-only and remain the
       * responsibility of {@link loadFromSupabase}, which is invoked
       * separately by the trainer dashboard mount.
       */
      hydrateForUser: async (userId: string) => {
        if (!userId) return;
        console.log('[TrainerStore] hydrateForUser:', userId);
        try {
          // Fetch in parallel; each fetcher catches internally and returns []
          // on error so a single failure doesn't blank the whole hydrate.
          const [sessions, trainerCalendar, clientCalendar] = await Promise.all([
            fetchSessionsForUserFromSupabase(userId),
            fetchCalendarEventsFromSupabase(userId).catch(() => []),
            fetchCalendarEventsForUser(userId).catch(() => []),
          ]);

          // De-dupe calendar events on id; client-scoped takes precedence
          // over trainer-scoped for shared rows so the client perspective
          // (e.g. their confirmation flag) wins.
          const calendarById = new Map<string, any>();
          (Array.isArray(trainerCalendar) ? trainerCalendar : []).forEach(e => {
            if (e?.id) calendarById.set(e.id, e);
          });
          (Array.isArray(clientCalendar) ? clientCalendar : []).forEach(e => {
            if (e?.id) calendarById.set(e.id, e);
          });

          // Preserve calendar events for OTHER users that may already be
          // in the local cache (e.g. a trainer's other clients' rows). We
          // only replace the slice that pertains to this user.
          const existingCalendar = get().calendarEvents;
          const otherUserCalendar = existingCalendar.filter(e =>
            e.trainerId !== userId && e.clientId !== userId
          );
          const mergedCalendar = [...calendarById.values(), ...otherUserCalendar];

          // Same logic for sessions: keep rows that don't belong to this user.
          const existingSessions = get().sessions;
          const otherUserSessions = existingSessions.filter(s =>
            s.trainerId !== userId && s.clientId !== userId
          );
          const mergedSessions = [
            ...(Array.isArray(sessions) ? sessions : []),
            ...otherUserSessions,
          ];

          set({
            sessions: mergedSessions,
            calendarEvents: mergedCalendar,
          });

          console.log('[TrainerStore] ✅ hydrateForUser done', {
            sessions: Array.isArray(sessions) ? sessions.length : 0,
            calendarEvents: calendarById.size,
            preservedOtherUserSessions: otherUserSessions.length,
            preservedOtherUserCalendar: otherUserCalendar.length,
          });
        } catch (e) {
          console.warn('[TrainerStore] hydrateForUser failed (non-fatal — local cache preserved):', e);
        }
      },

      // v14-D16: Public refetch method called from workoutStore.endWorkout
      // to surface trigger-updated total_sessions immediately (instead of
      // waiting for next page load).
      refetchTrainerClientsFromSupabase: async (trainerId: string) => {
        try {
          const fresh = await fetchTrainerClientsFromSupabase(trainerId);
          if (fresh && Array.isArray(fresh)) {
            const currentClients = get().clients;
            const clients: TrainerClient[] = fresh.map((sb: any) => {
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
                totalSessions: sb.totalSessions ?? localClient?.totalSessions ?? 0, // ← legacy trigger value, used only as fallback by getDisplayedSessionCount
                totalPaid: sb.totalPaid ?? localClient?.totalPaid ?? 0,
                // v14-D1 legacy offset (kept for back-compat reads)
                historicalSessionsOffset: sb.historicalSessionsOffset ?? localClient?.historicalSessionsOffset,
                // v16-D3 dedicated manual offset column (source of truth post-v16)
                historicalOffsetSessions: sb.historicalOffsetSessions ?? localClient?.historicalOffsetSessions,
                totalSessionsOffset: sb.totalSessionsOffset,
                totalPaidOffset: sb.totalPaidOffset,
                // v14-D10 per-client auto-count override
                autoCountSessions: sb.autoCountSessions ?? localClient?.autoCountSessions ?? null,
                // Nested client user info for name resolution
                client: sb.client || localClient?.client,
              };
            });
            set({ clients });
          }
        } catch (err) {
          console.warn('[v14-D16] refetchTrainerClientsFromSupabase error:', err);
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
        const { earnMedal, hasMedal } = getMedalStore().getState();
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
      // v16-D2: per-user scoped key. Even though `partialize` returns
      // {} (D13: trainer data is authoritative in Supabase, not
      // persisted to localStorage), Zustand still reads/writes a tiny
      // envelope at this key on hydrate. Scoping it per-user keeps the
      // envelope from leaking across accounts and matches the pattern
      // used by every other user-scoped store.
      storage: createJSONStorage(() => scopedStorage('apex-trainer')),
      // D13: do not persist trainer data to localStorage — all 15 state arrays
      // (clients, clientPrograms, sessionWorkouts, etc.) are authoritative in
      // Supabase and re-fetched on login via loadAllDataFromSupabase. Persisting
      // here duplicates data and silently fails once the browser quota is hit,
      // which can block Supabase writes from completing reliably (observed in
      // prod: trainer at 894KB apex-trainer blob, QuotaExceededError storm,
      // assigned programs not propagating to client devices).
      partialize: () => ({}),
    }
  )
);
