import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../safeStorage';
import { User, UserMode } from '@/types';
import {
  registerUserToSupabase,
  registerUserWithAuthLink,
  loginFromSupabase,
  updateUserInSupabase,
  resolveCanonicalUserByEmail,
} from '../supabaseSync';
import { supabase } from '../supabase';

// ---- Layer 2 test seam ----------------------------------------------------
// Allows the register.test.ts suite to substitute `registerUserWithAuthLink`
// without a full module-mock harness. Production always resolves to the
// real import below; only the test suite writes a non-null override via
// `__setRegisterUserWithAuthLinkForTests`. Mirrors the existing
// `__setMessagingSupabaseClientForTests` / `__setWorkoutSupabaseClientForTests`
// pattern elsewhere in this repo.
type RegisterUserWithAuthLinkFn = typeof registerUserWithAuthLink;
let __registerUserWithAuthLinkOverride: RegisterUserWithAuthLinkFn | null = null;
export function __setRegisterUserWithAuthLinkForTests(
  fn: RegisterUserWithAuthLinkFn | null,
): void {
  __registerUserWithAuthLinkOverride = fn;
}
function getRegisterUserWithAuthLink(): RegisterUserWithAuthLinkFn {
  return __registerUserWithAuthLinkOverride ?? registerUserWithAuthLink;
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

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  updatePassword: (email: string, oldPassword: string, newPassword: string) => boolean;
  resetPassword: (email: string, newPassword: string) => boolean;
  switchMode: (mode: UserMode) => void;
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

      setIdentityNormalized: (value) => set({ identityNormalized: !!value }),

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
            await registerUserToSupabase(newUser, `oauth_${supabaseUser.id}`);
          } catch (e) {
            console.error('[Auth] Supabase sync error:', e);
          }
        }

        set({ user: newUser, isAuthenticated: true, isLoading: false });
        return true;
      },

      register: async (userData) => {
        set({ isLoading: true });
        const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');

        // Check if a placeholder account with this email exists — reuse its ID instead of creating a duplicate.
        const existingPlaceholder = storedUsers.find((u: any) =>
          u.email?.toLowerCase() === userData.email?.toLowerCase() &&
          (u.accountStatus === 'placeholder' || u.email?.endsWith('@placeholder.local') || u.email?.endsWith('@client.apex'))
        );

        // Check if a real (non-placeholder) account with this email exists — block duplicate.
        const existingActive = storedUsers.find((u: any) =>
          u.email?.toLowerCase() === userData.email?.toLowerCase() &&
          u.accountStatus !== 'placeholder' && !u.email?.endsWith('@placeholder.local') && !u.email?.endsWith('@client.apex')
        );
        if (existingActive) {
          set({ isLoading: false });
          return false;
        }

        // LAYER 2: always create the Supabase Auth account FIRST.
        //
        // Historical behaviour (the bug this fix closes): register() minted
        // a uuidv4() for `public.users.id` with no corresponding `auth.users`
        // row. Users who later signed in via OAuth got a separate auth row
        // at an unrelated UUID and relied on the `on_auth_user_created`
        // trigger to link them via `auth_user_id` — a workaround that
        // leaves `public.id` and `auth.id` diverged forever. That's the
        // divergence factory this refactor closes.
        //
        // New behaviour: supabase.auth.signUp creates the auth.users row
        // up-front; its id is the canonical id for all new accounts. For
        // placeholder upgrades we keep the placeholder's public.users.id
        // (so trainer-side assignments remain intact) but still pass the
        // fresh authUserId through to registerUserWithAuthLink so
        // `public.users.auth_user_id` resolves cleanly via effective_uid().
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userData.email!,
          password: userData.password,
          options: {
            data: {
              display_name: userData.displayName || userData.username || '',
            },
          },
        });

        if (authError || !authData?.user) {
          console.error('[Auth:Register] supabase.auth.signUp failed:', authError?.message || 'no user returned');
          set({ isLoading: false });
          return false;
        }

        const authUserId = authData.user.id;

        // Canonical public.users.id:
        //  - placeholder upgrade → reuse placeholder id (trainer-assignment continuity).
        //  - genuine new signup → use the auth id (no divergence from day one).
        //  - explicit userData.id (rare, e.g. programmatic tests) → honoured.
        const canonicalId = userData.id || existingPlaceholder?.id || authUserId;

        const newUser: User = {
          id: canonicalId,
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

        // If upgrading a placeholder, replace it; otherwise add new.
        const filteredUsers = existingPlaceholder
          ? storedUsers.filter((u: any) => u.id !== existingPlaceholder.id)
          : storedUsers;
        filteredUsers.push({ ...newUser, password: hashPassword(userData.password) });
        localStorage.setItem('apex-users', JSON.stringify(filteredUsers));

        // Sync to Supabase, linking auth_user_id explicitly. Non-fatal on
        // throw: the auth.users row already exists, on_auth_user_created
        // may have repaired the link server-side, and the user can still
        // use the app (a later sync pass can reconcile).
        try {
          const linked = await getRegisterUserWithAuthLink()(
            newUser,
            userData.password,
            authUserId,
            'active',
          );
          console.log('[Auth:Register] registerUserWithAuthLink result:', linked);
        } catch (e) {
          console.error('[Auth:Register] registerUserWithAuthLink threw (non-fatal):', e);
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
