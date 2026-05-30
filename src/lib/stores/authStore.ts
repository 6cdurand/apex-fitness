import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../safeStorage';
import { clearAllScopedKeysForUser } from './scopedStorage';
import { v4 as uuidv4 } from 'uuid';
import { User, UserMode } from '@/types';
import { registerUserToSupabase, updateUserInSupabase, resolveCanonicalUserByEmail } from '../supabaseSync';
import { supabase } from '../supabase';

/**
 * v16-D1 (F4): post-login hydrate helper.
 *
 * Dispatched on a deferred microtask from every login / register happy
 * path so the per-user Supabase row sets (workouts, PBs, sessions,
 * calendar) replace the local cache that may have been seeded by a
 * different account on the same device. Uses dynamic imports to avoid
 * the circular module graph (`workoutStore` imports `authStore`).
 *
 * Failures here are non-fatal — both stores' `hydrateForUser` actions
 * already swallow errors and preserve local cache. We only catch the
 * import / scheduling errors at this layer.
 */
function schedulePostLoginHydrate(userId: string) {
  if (!userId) return;
  // Defer to the next microtask so that the `set({ user, isAuthenticated: true })`
  // write has settled and downstream `useAuthStore.getState().user?.id` reads
  // (used inside the hydrate fns' cross-store calls) see the new user id.
  Promise.resolve().then(async () => {
    try {
      const [{ useWorkoutStore }, { useTrainerStore }] = await Promise.all([
        import('./workoutStore'),
        import('./trainerStore'),
      ]);
      await Promise.all([
        useWorkoutStore.getState().hydrateForUser(userId),
        useTrainerStore.getState().hydrateForUser(userId),
      ]);
    } catch (e) {
      console.warn('[AuthStore] post-login hydrate scheduling failed:', e);
    }
  });
}

// Simple password hash (pre-Supabase Auth — Phase 1 replaces this entirely)
export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

/**
 * Outcome surfaced to the auth UI after a failed `login()`.
 *
 * Lets `/auth` show an actionable error instead of the generic
 * "Invalid email or password" toast — most importantly, when the
 * account exists but has no password_hash (`oauth_only`), so the
 * user knows to click "Continue with Google" instead of retrying
 * their password.
 */
export type LoginErrorReason = 'no_user' | 'wrong_password' | 'oauth_only' | 'network' | null;

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Reason for the most recent failed login attempt. Cleared to null
   * on successful login. Read by `/auth` page to show specific toasts.
   */
  loginError: LoginErrorReason;
  /**
   * True once SupabaseSync has finished the heal-on-mount canonical id
   * reconciliation (either applied the heal, confirmed no heal was needed,
   * or failed open). Client-scoped data fetches should gate on this flag
   * so they don't issue a first query against a stale `user.id` right
   * before it gets rewritten to the canonical `public.users.id`.
   *
   * SupabaseSync is the only writer of this flag via
   * {@link setIdentityNormalized}. The flag is NOT persisted — every new
   * session starts with `identityNormalized: false` and SupabaseSync flips
   * it to `true` once on mount.
   */
  identityNormalized: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithSupabaseUser: (supabaseUser: { id: string; email: string; displayName: string; profilePhoto?: string }) => Promise<boolean>;
  register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
  logout: () => void;
  deleteAccount: () => void;
  updateUser: (updates: Partial<User>) => void;
  updatePassword: (email: string, oldPassword: string, newPassword: string) => Promise<boolean>;
  resetPassword: (email: string, newPassword: string) => boolean;
  switchMode: (mode: UserMode) => void;
  /**
   * v14-D10: flip the trainer's auto_count_sessions_default. Optimistic local update +
   * Supabase sync. The server-side AFTER trigger on users bulk-rebuckets every "follow default"
   * trainer_clients row to preserve visible total_sessions across the flip.
   */
  updateAutoCountDefault: (newDefault: boolean) => Promise<void>;
  /**
   * v14-D11: persist the trainer's block-library folder chip ordering.
   */
  updateBlockFolderOrder: (order: string[]) => Promise<void>;
  /**
   * Heal-on-mount identity normalization.
   *
   * Rewrites the in-memory user.id AND the corresponding `apex-users`
   * localStorage row so both point at the canonical `public.users.id`. Used
   * by SupabaseSync to fix the 40 users persisted with a stale
   * `user.id = auth.users.id` before the canonical-resolve code shipped.
   *
   * This action is CLIENT-SIDE ONLY and MUST NOT call updateUserInSupabase:
   * the public.users row already has the canonical id; we are only healing
   * the client cache. Running an UPDATE on public.users.id would touch the
   * primary key and may violate foreign-key references (programs, PBs,
   * workouts, conversations, etc. all key to public.users.id).
   *
   * Idempotent: no-op when no user is loaded or when current id already
   * equals the canonical id. De-dupes `apex-users` rows when the store
   * already contains both the stale-id row and the canonical-id row.
   */
  normalizeUserIdToCanonical: (canonicalId: string) => void;
  /**
   * Publish the current value of {@link identityNormalized}. Intended only
   * for SupabaseSync — consumers should read the flag, never write it.
   */
  setIdentityNormalized: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      identityNormalized: false,
      loginError: null,

      setIdentityNormalized: (value) => set({ identityNormalized: !!value }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, loginError: null });

        console.log('[Auth] Login attempt for:', email, '| method: password');

        // localStorage fast-path (offline / demo / cached). We KEEP the legacy
        // hashPassword comparison here ONLY for cached local logins;
        // localStorage never leaves the device, so the weak hash is not a
        // network concern. v15-D6: Supabase Auth is the source of truth for
        // new logins; localStorage cache is best-effort secondary.
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        const hashed = hashPassword(password);
        const localUser = storedUsers.find((u: User & { password?: string }) => {
          if (u.email?.toLowerCase() !== email.toLowerCase()) return false;
          if (!u.password) return false; // OAuth-cached rows have no password
          return u.password === hashed || u.password === password;
        });
        if (localUser) {
          console.log('[Auth] ✅ localStorage fast-path matched');
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password: _pw, ...userData } = localUser as any;
          set({ user: userData, isAuthenticated: true, isLoading: false, loginError: null });
          // v16-D1: hydrate per-user Supabase data so trainer-logged workouts
          // and PT sessions are visible immediately after login.
          schedulePostLoginHydrate(userData.id);
          return true;
        }

        console.log('[Auth] localStorage miss, trying Supabase Auth...');

        // v16-D8 BUG-11 mitigation: clear any stale Supabase session before
        // attempting a fresh email/password login. Chrome was observed to
        // hold onto a prior account's PKCE/IndexedDB state across logout +
        // re-login on a different account, causing signInWithPassword to
        // fail for credentials that worked fine on Safari. This signOut is
        // a no-op on a clean browser (no active session) and surgical for
        // the stale-state case. v16-D2's scopedStorage handles the Zustand
        // side; this handles the Supabase Auth side.
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn('[Auth] pre-login signOut failed (non-fatal):', e);
        }

        // v15-D6: replace legacy public.users.password_hash REST query with
        // Supabase Auth's signInWithPassword. auth.users.encrypted_password
        // is now the credential source of truth.
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          const msg = (error.message || '').toLowerCase();
          let reason: LoginErrorReason = 'wrong_password';
          if (msg.includes('invalid login credentials')) {
            reason = 'wrong_password';
          } else if (msg.includes('email not confirmed')) {
            reason = 'wrong_password';
          } else if (msg.includes('rate limit') || msg.includes('too many')) {
            reason = 'network';
          } else if (msg.includes('user not found')) {
            reason = 'no_user';
          }
          console.log('[Auth] ❌ Supabase Auth error:', error.message, '| reason:', reason);
          set({ isLoading: false, loginError: reason });
          return false;
        }

        if (!data?.user) {
          console.log('[Auth] ❌ Supabase Auth returned no user');
          set({ isLoading: false, loginError: 'no_user' });
          return false;
        }

        console.log('[Auth] ✅ Supabase Auth success | auth.users.id:', data.user.id);

        // Resolve canonical public.users.id (may differ from auth.users.id
        // for accounts created via trainer placeholder before client signup
        // — same posture as loginWithSupabaseUser).
        const canonical = await resolveCanonicalUserByEmail(email);
        const canonicalId = canonical?.id || data.user.id;

        const c = canonical as any;
        const user: User = {
          id: canonicalId,
          email: data.user.email!,
          username: c?.username || data.user.email!.split('@')[0],
          displayName:
            c?.display_name ||
            (data.user.user_metadata?.full_name as string | undefined) ||
            data.user.email!.split('@')[0],
          profilePhoto:
            c?.profile_photo ||
            (data.user.user_metadata?.picture as string | undefined),
          gender: (c?.gender as any) || 'other',
          dateOfBirth: c?.date_of_birth || undefined,
          height: c?.height ?? undefined,
          weight: c?.weight ?? undefined,
          preferredUnit: (c?.preferred_unit as 'kg' | 'lb') || 'kg',
          isTrainer: c?.is_trainer ?? false,
          isVerifiedTrainer: c?.is_verified_trainer ?? false,
          mode: (c?.mode as UserMode) || 'user',
          membershipTier: 'pro',
          accountStatus: (c?.account_status as any) || 'active',
          createdAt: c?.created_at || new Date().toISOString(),
          followers: [],
          following: [],
          trainerId: c?.trainer_id || undefined,
          autoCountSessionsDefault: c?.auto_count_sessions_default ?? true,
          blockFolderOrder: c?.block_folder_order ?? undefined,
        };

        // Cache in localStorage so next launch can use the fast-path.
        const filtered = storedUsers.filter(
          (u: User) =>
            u.id !== canonicalId &&
            u.email?.toLowerCase() !== email.toLowerCase()
        );
        filtered.push({ ...user, password: hashPassword(password) });
        localStorage.setItem('apex-users', JSON.stringify(filtered));

        set({ user, isAuthenticated: true, isLoading: false, loginError: null });
        // v16-D1: hydrate per-user Supabase data so trainer-logged workouts
        // and PT sessions are visible immediately after login.
        schedulePostLoginHydrate(user.id);
        return true;
      },

      // Login with Supabase Auth user (from Google OAuth, etc.)
      loginWithSupabaseUser: async (supabaseUser) => {
        set({ isLoading: true });

        console.log('[Auth] loginWithSupabaseUser:', supabaseUser.email, 'auth.id=', supabaseUser.id);

        // STEP 1: resolve canonical public.users.id by email.
        // auth.users.id and public.users.id are different; programs reference
        // public.users.id. If a trainer created a placeholder for this email,
        // we MUST reuse that canonical id or the client won't see their program.
        const canonical = await resolveCanonicalUserByEmail(supabaseUser.email);
        const canonicalId = canonical?.id || supabaseUser.id;
        if (canonical) {
          console.log('[Auth] ✅ Canonical public.users.id:', canonical.id, '(differs from auth id:', canonical.id !== supabaseUser.id, ')');
        } else {
          console.log('[Auth] No canonical public.users row yet; will create one with auth.id');
        }

        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');

        // Check if user already exists locally (by canonical id, auth id, or email)
        let existingUser = storedUsers.find((u: User) =>
          u.id === canonicalId || u.id === supabaseUser.id || u.email?.toLowerCase() === supabaseUser.email.toLowerCase()
        );

        if (existingUser) {
          console.log('[Auth] ✅ Found existing local user, normalizing to canonical id');
          // Update with latest info from Supabase AND reconcile to canonical id
          const previousId = existingUser.id;
          existingUser = {
            ...existingUser,
            id: canonicalId, // Use CANONICAL public.users.id, not auth.users.id
            email: supabaseUser.email,
            profilePhoto: supabaseUser.profilePhoto || existingUser.profilePhoto,
            displayName: supabaseUser.displayName || existingUser.displayName,
            membershipTier: existingUser.membershipTier || 'pro',
            // Respect the trainer flag from public.users (source of truth)
            isTrainer: canonical?.is_trainer ?? existingUser.isTrainer ?? false,
            trainerId: canonical?.trainer_id ?? existingUser.trainerId,
          };

          // If the local id was different, drop the old row (avoid duplicates)
          const cleanedUsers = storedUsers.filter((u: User) => u.id !== previousId || u.id === canonicalId);
          const updatedUsers = cleanedUsers.filter((u: User) => u.id !== canonicalId);
          updatedUsers.push(existingUser);
          localStorage.setItem('apex-users', JSON.stringify(updatedUsers));

          set({ user: existingUser, isAuthenticated: true, isLoading: false });
          // v16-D1: hydrate per-user Supabase data so PT sessions and
          // trainer-logged workouts are visible immediately after OAuth login.
          schedulePostLoginHydrate(existingUser.id);
          return true;
        }

        // No local user; create one using canonical id (from public.users if it exists)
        console.log('[Auth] Creating local user from Supabase auth with id:', canonicalId);
        const newUser: User = {
          id: canonicalId,
          email: supabaseUser.email,
          username: supabaseUser.email.split('@')[0],
          displayName: supabaseUser.displayName || canonical?.display_name || supabaseUser.email.split('@')[0],
          profilePhoto: supabaseUser.profilePhoto,
          gender: 'other',
          mode: (canonical?.mode as UserMode) || 'user',
          isTrainer: canonical?.is_trainer || false,
          isVerifiedTrainer: false,
          preferredUnit: 'kg',
          membershipTier: 'pro',
          trainerId: canonical?.trainer_id || undefined,
          createdAt: new Date().toISOString(),
          followers: [],
          following: [],
        };

        // Save to localStorage (no password needed for OAuth users)
        storedUsers.push({ ...newUser, password: hashPassword(`oauth_${supabaseUser.id}`) });
        localStorage.setItem('apex-users', JSON.stringify(storedUsers));

        // Only register to Supabase if there's no canonical row yet — don't overwrite
        if (!canonical) {
          try {
            await registerUserToSupabase(newUser);
          } catch (e) {
            console.error('[Auth] Supabase sync error:', e);
          }
        }

        set({ user: newUser, isAuthenticated: true, isLoading: false });
        // v16-D1: hydrate per-user Supabase data so trainer-linked rows
        // (e.g. PT sessions logged before this account first signed in via
        // OAuth, when a trainer placeholder existed) are visible immediately.
        schedulePostLoginHydrate(newUser.id);
        return true;
      },

      register: async (userData) => {
        set({ isLoading: true });
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');

        console.log('[Auth] Register attempt for:', userData.email, '| isTrainer:', userData.isTrainer);

        // Placeholder reuse (preserved from legacy): trainer creates a
        // placeholder for a client email; client later registers and
        // inherits the placeholder's id so program FKs continue resolving.
        const existingPlaceholder = storedUsers.find((u: any) =>
          u.email?.toLowerCase() === userData.email?.toLowerCase() &&
          (u.accountStatus === 'placeholder' || u.email?.endsWith('@placeholder.local') || u.email?.endsWith('@client.apex'))
        );
        const existingActive = storedUsers.find((u: any) =>
          u.email?.toLowerCase() === userData.email?.toLowerCase() &&
          u.accountStatus !== 'placeholder' && !u.email?.endsWith('@placeholder.local') && !u.email?.endsWith('@client.apex')
        );
        if (existingActive) {
          console.log('[Auth] ❌ Email already registered (active local user)');
          set({ isLoading: false });
          return false;
        }

        // v15-D6: register with Supabase Auth FIRST. This sets
        // auth.users.encrypted_password so future signInWithPassword calls
        // succeed. The handle_new_auth_user trigger creates a public.users
        // row from auth metadata.
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userData.email!,
          password: userData.password,
          options: {
            data: {
              username: userData.username,
              full_name: userData.displayName || userData.username,
            },
          },
        });

        if (authError) {
          const msg = (authError.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('user already exists')) {
            console.log('[Auth] ❌ Supabase Auth says email already registered');
          } else {
            console.error('[Auth] ❌ Supabase Auth signUp error:', authError.message);
          }
          set({ isLoading: false });
          return false;
        }

        if (!authData?.user) {
          console.error('[Auth] ❌ Supabase Auth signUp returned no user');
          set({ isLoading: false });
          return false;
        }

        console.log('[Auth] ✅ Supabase Auth signUp succeeded | auth.users.id:', authData.user.id);

        const newUser: User = {
          id: userData.id || existingPlaceholder?.id || authData.user.id,
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
          accountStatus: 'active',
          createdAt: existingPlaceholder?.createdAt || new Date().toISOString(),
          followers: [],
          following: [],
          trainerId: existingPlaceholder?.trainerId || undefined,
        };

        const filteredUsers = existingPlaceholder
          ? storedUsers.filter((u: any) => u.id !== existingPlaceholder.id)
          : storedUsers;
        filteredUsers.push({ ...newUser, password: hashPassword(userData.password) });
        localStorage.setItem('apex-users', JSON.stringify(filteredUsers));

        // Sync extended profile fields to public.users. The trigger only
        // sets the basic fields; this UPDATE populates the rest.
        // registerUserToSupabase no longer writes password_hash.
        try {
          const synced = await registerUserToSupabase(newUser);
          console.log('[Auth] Supabase profile sync result:', synced);
        } catch (e) {
          console.error('[Auth] Supabase profile sync exception:', e);
          // Non-fatal — auth row exists, user can log in.
        }

        set({ user: newUser, isAuthenticated: true, isLoading: false });
        // v16-D1: hydrate per-user Supabase data. For a brand-new account
        // this typically returns empty arrays (which is fine — REPLACE
        // semantics will wipe any leaked cache from a prior local user).
        schedulePostLoginHydrate(newUser.id);
        return true;
      },

      /**
       * v16-D2: drop the previous user's scoped localStorage AND reset
       * the in-memory state of every user-scoped Zustand store before
       * flipping `user` to null. Pre-D2, logout only cleared `user`
       * from authStore — the persisted blobs at `apex-workout`,
       * `apex-trainer`, `apex-medals`, `apex-social`, `apex-messages`,
       * `apex-reports` survived and rehydrated when the next account
       * logged in on the same browser, leaking saved blocks, client
       * rosters, active workouts, and message threads across accounts.
       *
       * Order of operations
       * -------------------
       * 1. Capture `previousUserId` while it's still in memory.
       * 2. Flip auth to logged-out — this also writes `user:null` into
       *    the unscoped `apex-auth` blob, so `scopedStorage.getCurrentUserId()`
       *    immediately starts returning null and any subsequent persist
       *    writes from the resets below are no-ops (they don't pollute
       *    localStorage with empty blobs under the previous user's key).
       * 3. Reset in-memory state of every user-scoped store (dynamic
       *    imports avoid the circular deps that direct imports would
       *    cause — workoutStore et al. import from this module).
       * 4. Explicitly remove the previous user's scoped localStorage
       *    keys so a subsequent login as the same user starts clean
       *    and re-hydrates from Supabase via D1's hydrateForUser path.
       */
      logout: () => {
        const previousUserId = get().user?.id || null;

        // Step 2 — flip auth state. This persists apex-auth synchronously
        // so getCurrentUserId() returns null from here on.
        set({ user: null, isAuthenticated: false });

        // Step 3 — reset in-memory state across user-scoped stores.
        // Dynamic imports avoid circular deps with this file.
        // Persist writes triggered by these setState calls are
        // no-ops via scopedStorage (user is already null).
        // Each block is fault-isolated so a single failure doesn't
        // leave the rest of the stores stuck on the previous user's data.
        void (async () => {
          try {
            const { useWorkoutStore } = await import('./workoutStore');
            useWorkoutStore.setState({
              activeWorkout: null,
              workoutHistory: [],
              templates: [],
              personalBests: [],
              exerciseNotes: {},
              volumeRollups: {},
              lastDeriveResult: null,
              currentClientId: null,
              initialBlockType: null,
              workoutTimer: { isRunning: false, seconds: 0, type: 'workout' },
              restTimer: { isRunning: false, seconds: 0, type: 'rest' },
            } as Partial<ReturnType<typeof useWorkoutStore.getState>>);
          } catch (e) {
            console.warn('[Auth] logout reset workoutStore failed:', e);
          }
          try {
            const { useTrainerStore } = await import('./trainerStore');
            useTrainerStore.setState({
              clients: [],
              clientGroups: [],
              assignedWorkouts: [],
              calendarEvents: [],
              sessions: [],
              payments: [],
              sessionPackages: [],
              bookingRequests: [],
              clientPrograms: [],
              clientProfiles: [],
              sessionWorkouts: [],
              workoutLibrary: [],
              circuitLibrary: [],
              savedBlocks: [],
              blockPerformances: [],
              savedPrograms: [],
              lastSavedProgramError: null,
            } as Partial<ReturnType<typeof useTrainerStore.getState>>);
          } catch (e) {
            console.warn('[Auth] logout reset trainerStore failed:', e);
          }
          try {
            const { useMedalStore } = await import('./medalStore');
            useMedalStore.setState({
              medals: [],
              evolvingMedalProgress: {},
              strengthRating: null,
            } as Partial<ReturnType<typeof useMedalStore.getState>>);
          } catch (e) {
            console.warn('[Auth] logout reset medalStore failed:', e);
          }
          try {
            const { useSocialStore } = await import('./socialStore');
            useSocialStore.setState({
              posts: [],
              notifications: [],
            } as Partial<ReturnType<typeof useSocialStore.getState>>);
          } catch (e) {
            console.warn('[Auth] logout reset socialStore failed:', e);
          }
          try {
            const { useReportStore } = await import('./reportStore');
            useReportStore.setState({
              weeklyReports: [],
            } as Partial<ReturnType<typeof useReportStore.getState>>);
          } catch (e) {
            console.warn('[Auth] logout reset reportStore failed:', e);
          }
          try {
            const { useMessageStore } = await import('../messageStore');
            useMessageStore.setState({
              conversations: [],
              messages: [],
            } as Partial<ReturnType<typeof useMessageStore.getState>>);
          } catch (e) {
            console.warn('[Auth] logout reset messageStore failed:', e);
          }

          // Step 4 — explicit per-user scoped key cleanup.
          if (previousUserId) {
            clearAllScopedKeysForUser(previousUserId);
          }
        })();
      },

      deleteAccount: () => {
        const currentUser = get().user;
        if (!currentUser) return;

        // Remove from localStorage `apex-users` directory (master user list,
        // shared across accounts on this device — kept globally keyed by design).
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
        const filtered = storedUsers.filter((u: User) => u.id !== currentUser.id);
        localStorage.setItem('apex-users', JSON.stringify(filtered));

        // v16-D2: clear every per-user scoped key for this account.
        // Replaces the legacy fixed-key removeItem calls (which targeted
        // pre-D2 unscoped keys that no longer exist post-deploy).
        clearAllScopedKeysForUser(currentUser.id);

        // Drop the unscoped auth envelope so this device forgets the user.
        localStorage.removeItem('apex-auth');

        set({ user: null, isAuthenticated: false });
      },

      updatePassword: async (email, oldPassword, newPassword) => {
        console.log('[Auth] updatePassword called for:', email);

        // Re-auth check via Supabase Auth so we know the old password matches.
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email,
          password: oldPassword,
        });
        if (verifyError) {
          console.log('[Auth] ❌ updatePassword: old password verification failed');
          return false;
        }

        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) {
          console.error('[Auth] ❌ updatePassword: Supabase update failed:', updateError.message);
          return false;
        }

        console.log('[Auth] ✅ updatePassword succeeded for:', email);

        // Update localStorage cached password so the local-fast-path continues
        // to work on this device. Other devices keep their own cache.
        try {
          const storedUsers: Array<User & { password?: string }> = JSON.parse(
            localStorage.getItem('apex-users') || '[]'
          );
          const idx = storedUsers.findIndex((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (idx !== -1) {
            storedUsers[idx].password = hashPassword(newPassword);
            localStorage.setItem('apex-users', JSON.stringify(storedUsers));
          }
        } catch (e) {
          console.error('[Auth] localStorage password cache update failed:', e);
        }

        return true;
      },

      /**
       * @deprecated v15-D6: in-store password reset removed. Password reset
       *   now flows through Supabase Auth's built-in recovery email + the
       *   /auth/update-password landing page. Kept as a no-op for binary
       *   compatibility with any cached store state — DO NOT call.
       */
      resetPassword: () => false,

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

      /**
       * v14-D10: flip the trainer's auto_count_sessions_default. Optimistic local update +
       * Supabase sync. The server-side AFTER trigger on users bulk-rebuckets every "follow default"
       * trainer_clients row to preserve visible total_sessions across the flip.
       */
      updateAutoCountDefault: async (newDefault: boolean) => {
        const currentUser = get().user;
        if (!currentUser) return;
        // Optimistic local
        set({ user: { ...currentUser, autoCountSessionsDefault: newDefault } });
        // Sync
        const { syncAutoCountDefaultToSupabase } = await import('../supabaseSync');
        const ok = await syncAutoCountDefaultToSupabase(currentUser.id, newDefault);
        if (!ok) {
          // Revert optimistic
          set({ user: { ...currentUser } });
          console.error('[v14-D10] Failed to persist auto_count_sessions_default; reverted local state.');
        }
      },

      updateBlockFolderOrder: async (order: string[]) => {
        const currentUser = get().user;
        if (!currentUser) return;
        set({ user: { ...currentUser, blockFolderOrder: order } });
        const { syncBlockFolderOrderToSupabase } = await import('../supabaseSync');
        const ok = await syncBlockFolderOrderToSupabase(currentUser.id, order);
        if (!ok) {
          set({ user: { ...currentUser } });
          console.error('[v14-D11] Failed to persist block_folder_order.');
        }
      },

      normalizeUserIdToCanonical: (canonicalId: string) => {
        const currentUser = get().user;
        if (!currentUser) return;
        if (currentUser.id === canonicalId) return; // idempotent

        console.log(
          '[Auth] Normalizing user.id',
          currentUser.id,
          '→ canonical',
          canonicalId,
        );

        // 1. Update in-memory state
        const updatedUser = { ...currentUser, id: canonicalId };
        set({ user: updatedUser });

        // 2. Update localStorage `apex-users` array — rewrite the row's id, de-dupe.
        //    If a row already exists at the canonical id (e.g. populated by a
        //    previous OAuth login on the same device) drop it first, then
        //    re-key the stale-id row onto the canonical id preserving the
        //    password hash and any other locally stored fields.
        try {
          const storedUsers: Array<User & { password?: string }> = JSON.parse(
            localStorage.getItem('apex-users') || '[]'
          );
          const filtered = storedUsers.filter((u) => u.id !== canonicalId);
          const idx = filtered.findIndex((u) => u.id === currentUser.id);
          if (idx !== -1) {
            filtered[idx] = { ...filtered[idx], id: canonicalId };
          } else {
            filtered.push({ ...updatedUser });
          }
          localStorage.setItem('apex-users', JSON.stringify(filtered));
        } catch (e) {
          console.error('[Auth] Failed to normalize localStorage apex-users:', e);
        }

        // 3. DO NOT call updateUserInSupabase — that would UPDATE
        //    public.users.id (primary key, referenced by FKs on programs /
        //    workouts / PBs / conversations). The DB row already has the
        //    canonical id; we're only healing the client-side cache.
      },
    }),
    {
      name: 'apex-auth',
      storage: createJSONStorage(() => safeLocalStorage),
      onRehydrateStorage: () => (state) => {
        // identityNormalized is a transient per-session signal — if a
        // previous session persisted it as true, reset it so SupabaseSync
        // gets a chance to re-confirm the heal on this mount before any
        // downstream data fetch gates on it.
        if (state) state.identityNormalized = false;
        // Repair: if user is in trainer mode but isTrainer was incorrectly set to false, restore it
        if (state?.user && state.user.mode === 'trainer' && !state.user.isTrainer) {
          console.log('[Auth] Repairing isTrainer flag (was false while mode=trainer)');
          state.updateUser({ isTrainer: true });
        }
      },
    }
  )
);
