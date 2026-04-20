import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../safeStorage';
import { User, UserMode } from '@/types';
import { supabase } from '../supabase';

/**
 * Deprecated: retained only for placeholder-client localStorage entries that
 * predate identity-v2. Real accounts authenticate via Supabase Auth and this
 * value is never compared against a login. Kept so existing callers that
 * populate `apex-users` entries don't break during the cutover.
 */
export function hashPassword(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return 'legacy_' + Math.abs(hash).toString(36);
}

/**
 * Identity v2 — Supabase Auth is canonical.
 *
 * auth.users.id == public.users.id (1:1), enforced by the
 * on_auth_user_created trigger + the backfill script.
 *
 * Zustand now stores only the hydrated profile (User); the actual session
 * lives in Supabase Auth (cookies + localStorage managed by supabase-js).
 * Callers use `bootstrap()` on app mount and on every auth state change.
 */

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid_credentials' | 'email_not_confirmed' | 'profile_missing' | 'unknown'; message?: string };

export type RegisterResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'email_taken' | 'weak_password' | 'invalid_email' | 'rate_limited' | 'profile_update_failed' | 'unknown'; message?: string };

/** Sentinel UUID for the local-only demo user. Real accounts never use
 *  this id; it has a valid v4 shape so any downstream Supabase call
 *  that does try to query with it fails safely (empty rows under RLS)
 *  rather than with a type error. */
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000000';

function buildDemoUser(): User {
  return {
    id: DEMO_USER_ID,
    email: 'demo@catalift.local',
    username: 'demo_user',
    displayName: 'Demo User',
    gender: 'male',
    mode: 'user',
    isTrainer: false,
    isVerifiedTrainer: false,
    preferredUnit: 'kg',
    createdAt: new Date().toISOString(),
    followers: [],
    following: [],
    membershipTier: 'pro',
    accountStatus: 'active',
    isDemo: true,
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapped: boolean;

  // Preferred API (explicit result envelopes).
  bootstrap: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<LoginResult>;
  signUpWithPassword: (args: { email: string; password: string; displayName?: string; username?: string }) => Promise<RegisterResult>;
  signInWithGoogle: () => Promise<void>;
  /** Enter pure-client demo mode. Sets a deterministic local User and
   *  marks the store as authenticated without creating any Supabase
   *  Auth session or public.users row. Never throws. */
  signInAsDemo: () => void;

  // Back-compat shims used throughout the app — same return shapes as v1.
  login: (email: string, password: string) => Promise<boolean>;
  loginWithSupabaseUser: (supabaseUser: { id: string; email: string; displayName: string; profilePhoto?: string }) => Promise<boolean>;
  register: (userData: Partial<User> & { password: string }) => Promise<boolean>;

  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updatePassword: (email: string, oldPassword: string, newPassword: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  switchMode: (mode: UserMode) => void;
}

/** Fetch the public.users row for the given auth id.
 *  Primary path: .or(id.eq.X, auth_user_id.eq.X) — supports both
 *  trigger-mirrored rows (id = auth.users.id) and pre-cutover rows
 *  linked via auth_user_id by handle_new_auth_user().
 *  Fallback path: .eq('id', X) — used automatically when the
 *  auth_user_id column does not exist yet (migration
 *  20260421_01_users_auth_user_id.sql not yet applied). Keeps
 *  sign-in working during the migration transition. */
async function loadProfile(userId: string): Promise<User | null> {
  let data: any = null;
  let error: any = null;

  // Primary lookup (per Supabase guidance).
  try {
    const r = await supabase
      .from('users')
      .select('*')
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .maybeSingle();
    data = r.data;
    error = r.error;
  } catch (e) {
    error = e;
  }

  // PGRST116 === identity-link conflict: multiple rows matched the
  // OR-clause (one with id = userId AND another with auth_user_id =
  // userId). Rather than locking the user out, prefer the row whose
  // id matches auth.uid() (the canonical one). Operator reconciles
  // via supabase/manual_followups.sql.
  const multiRow =
    !!error &&
    (error.code === 'PGRST116' ||
      (typeof error.message === 'string' && /multiple|more than one row/i.test(error.message)));
  if (multiRow) {
    console.warn(
      '[Auth v2] loadProfile: identity-link conflict (PGRST116) for user', userId,
      '— falling back to id-preferred lookup. Run supabase/manual_followups.sql to reconcile.'
    );
    const byId = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (byId.data) {
      data = byId.data;
      error = null;
    } else if (!byId.error) {
      const byAuth = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', userId)
        .limit(1)
        .maybeSingle();
      data = byAuth.data;
      error = byAuth.error;
    } else {
      error = byId.error;
    }
  }

  // Column missing: pre-migration state. PostgREST surfaces this as
  // code 42703 or a message referencing the missing column. Retry
  // with an id-only filter so profiles whose id already equals
  // auth.users.id resolve normally.
  const columnMissing =
    !!error &&
    (error.code === '42703' ||
      (typeof error.message === 'string' && /auth_user_id/i.test(error.message)));
  if (columnMissing) {
    console.warn(
      '[Auth v2] loadProfile: auth_user_id column not present; falling back to id-only lookup. Apply migration 20260421_01_users_auth_user_id.sql to enable full OR-clause resolution.'
    );
    const r = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    data = r.data;
    error = r.error;
  }

  if (error || !data) {
    if (error) console.error('[Auth v2] loadProfile failed:', error.message ?? error);
    return null;
  }
  return {
    id: data.id,
    email: data.email ?? '',
    username: data.username ?? (data.email ?? '').split('@')[0],
    displayName: data.display_name ?? data.username ?? '',
    gender: data.gender ?? 'other',
    dateOfBirth: data.date_of_birth ?? undefined,
    height: data.height ?? undefined,
    weight: data.weight ?? undefined,
    profilePhoto: data.avatar_url ?? data.profile_photo ?? undefined,
    bio: data.bio ?? undefined,
    mode: (data.mode as UserMode) ?? 'user',
    isTrainer: !!data.is_trainer,
    isVerifiedTrainer: !!data.is_verified_trainer,
    trainerSpecializations: data.trainer_specializations ?? undefined,
    preferredUnit: data.preferred_unit ?? 'kg',
    createdAt: data.created_at ?? new Date().toISOString(),
    followers: [],
    following: [],
    trainerId: data.trainer_id ?? undefined,
    membershipTier: data.membership_tier ?? 'pro',
    accountStatus: data.account_status ?? 'active',
  };
}

/** Poll for the trigger-created public.users row (retry a few times). */
async function waitForProfile(userId: string, attempts = 6): Promise<User | null> {
  for (let i = 0; i < attempts; i++) {
    const p = await loadProfile(userId);
    if (p) return p;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** Race a promise against a hard timeout. If `ms` elapses first, rejects
 *  with a descriptive error so the caller's try/finally runs and
 *  `isLoading` always clears. Without this, a hung supabase-js call
 *  (network stall, misconfigured URL, stale token refresh) would leave
 *  the UI stuck on 'Signing in…' forever. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[Auth v2] ${label} timed out after ${ms}ms`));
    }, ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isBootstrapped: false,

      /** Sync Zustand state with the current Supabase Auth session. Call on app mount.
       *
       *  Intentionally does NOT touch `isLoading`. `isLoading` is reserved
       *  for user-initiated actions (signIn / signUp) so that a hung
       *  bootstrap cannot disable the Sign In / Create Account buttons.
       *  Bootstrap's own progress is signalled by `isBootstrapped`. */
      bootstrap: async () => {
        if (get().isBootstrapped && get().user) return;
        // Demo user is a pure client session — no Supabase Auth session
        // exists. Short-circuit so we don't bounce it back to signed-out
        // on reload when getSession() returns null.
        const persisted = get().user;
        if (persisted?.isDemo) {
          console.log('[Auth v2] bootstrap: demo session preserved');
          set({ isAuthenticated: true, isBootstrapped: true, isLoading: false });
          return;
        }
        try {
          const { data: { session } } = await withTimeout(
            supabase.auth.getSession(),
            5000,
            'bootstrap: getSession',
          );
          if (!session?.user) {
            set({ user: null, isAuthenticated: false, isBootstrapped: true });
            return;
          }
          const profile = await withTimeout(
            loadProfile(session.user.id),
            5000,
            'bootstrap: loadProfile',
          );
          if (profile) {
            console.log('[Auth v2] bootstrap: session restored for', profile.email, 'id=', profile.id, 'isTrainer=', profile.isTrainer);
            set({ user: profile, isAuthenticated: true, isBootstrapped: true });
          } else {
            console.warn('[Auth v2] bootstrap: session present but public.users row missing for id=', session.user.id);
            set({ user: null, isAuthenticated: false, isBootstrapped: true });
          }
        } catch (e) {
          // Timeout OR genuine error. Either way we must mark
          // bootstrapped so the rest of the app stops waiting.
          console.error('[Auth v2] bootstrap error (marking bootstrapped so UI unblocks):', e);
          set({ isBootstrapped: true });
        } finally {
          // Safety net: if anyone else set isLoading=true before we ran,
          // clear it. Bootstrap itself never raises it.
          if (get().isLoading) set({ isLoading: false });
        }
      },

      signInWithPassword: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data, error } = await withTimeout(
            supabase.auth.signInWithPassword({
              email: email.toLowerCase().trim(),
              password,
            }),
            15000,
            'signInWithPassword',
          );
          if (error) {
            console.error('[Auth v2] signInWithPassword failed:', error.message, '| status:', (error as any)?.status);
            const reason = /invalid/i.test(error.message) ? 'invalid_credentials'
              : /confirm/i.test(error.message) ? 'email_not_confirmed'
              : 'unknown';
            return { ok: false, reason, message: error.message };
          }
          const profile = await withTimeout(
            loadProfile(data.user.id),
            5000,
            'signInWithPassword: loadProfile',
          );
          if (!profile) {
            return { ok: false, reason: 'profile_missing', message: 'public.users row missing' };
          }
          set({ user: profile, isAuthenticated: true, isBootstrapped: true });
          return { ok: true, user: profile };
        } catch (e: any) {
          console.error('[Auth v2] signInWithPassword threw:', e?.message ?? e);
          return { ok: false, reason: 'unknown', message: e?.message ?? String(e) };
        } finally {
          set({ isLoading: false });
        }
      },

      signUpWithPassword: async ({ email, password, displayName, username }) => {
        set({ isLoading: true });
        try {
          const emailLower = email.toLowerCase().trim();
          console.log('[Auth v2] signUpWithPassword: attempting signup for', emailLower);
          const { data, error } = await withTimeout(
            supabase.auth.signUp({
              email: emailLower,
              password,
              options: {
                data: {
                  display_name: displayName,
                  username: username,
                },
              },
            }),
            15000,
            'signUpWithPassword',
          );
          if (error) {
            // Log the raw Supabase error so we can diagnose reports like
            // "it says email already exists on a brand new email" — the
            // real error is almost always something else (weak password,
            // rate limit, invalid email, trigger/profile failure) that a
            // classifier would otherwise hide.
            const msg = error.message ?? '';
            console.error('[Auth v2] signUpWithPassword failed:', msg, '| status:', (error as any)?.status);
            type FailReason = Extract<RegisterResult, { ok: false }>['reason'];
            const reason: FailReason =
              /already.*register|user.*already.*exist|already.*exist/i.test(msg) ? 'email_taken'
              : /rate\s*limit|too\s*many|try.*again.*later/i.test(msg) ? 'rate_limited'
              : /invalid.*email|not.*valid.*email|email.*invalid/i.test(msg) ? 'invalid_email'
              : /password/i.test(msg) ? 'weak_password'
              : 'unknown';
            return { ok: false, reason, message: msg };
          }
          if (!data.user) {
            return { ok: false, reason: 'unknown', message: 'no user returned' };
          }

          // Trigger on_auth_user_created creates the public.users row with same id.
          // Poll briefly then update with the extra profile fields.
          const profile = await waitForProfile(data.user.id);
          if (!profile) {
            return { ok: false, reason: 'profile_update_failed', message: 'trigger did not create public.users row' };
          }

          // Apply extra fields (displayName, username) if provided.
          if (displayName || username) {
            const updates: any = {};
            if (displayName) updates.display_name = displayName;
            if (username) updates.username = username;
            updates.updated_at = new Date().toISOString();
            await supabase.from('users').update(updates).eq('id', data.user.id);
          }

          const fresh = (await loadProfile(data.user.id)) ?? profile;
          set({ user: fresh, isAuthenticated: true, isBootstrapped: true });
          return { ok: true, user: fresh };
        } catch (e: any) {
          console.error('[Auth v2] signUpWithPassword threw:', e?.message ?? e);
          return { ok: false, reason: 'unknown', message: e?.message ?? String(e) };
        } finally {
          set({ isLoading: false });
        }
      },

      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
          },
        });
        if (error) {
          console.error('[Auth v2] OAuth init error:', error.message);
          throw error;
        }
      },

      signInAsDemo: () => {
        // Pure client-side. Never calls supabase.auth.* — the persist
        // middleware keeps the demo user across reloads, and bootstrap()
        // + the onAuthStateChange listener both have matching guards so
        // "no Supabase session" does not wipe demo state.
        console.log('[Auth v2] signInAsDemo: entering demo mode');
        set({
          user: buildDemoUser(),
          isAuthenticated: true,
          isBootstrapped: true,
          isLoading: false,
        });
      },

      // ---- back-compat shims ----

      login: async (email, password) => {
        const r = await get().signInWithPassword(email, password);
        return r.ok;
      },

      loginWithSupabaseUser: async (supabaseUser) => {
        // With Supabase Auth canonical there is no separate local path:
        // if a session exists, bootstrap() loads the profile; otherwise
        // the caller can't manufacture a session. This shim still runs
        // bootstrap for any caller that expects the old contract.
        console.log('[Auth v2] loginWithSupabaseUser shim for', supabaseUser.email);
        await get().bootstrap();
        return get().isAuthenticated;
      },

      register: async (userData) => {
        if (!userData.email || !userData.password) return false;
        const r = await get().signUpWithPassword({
          email: userData.email,
          password: userData.password,
          displayName: userData.displayName,
          username: userData.username,
        });
        if (!r.ok) return false;
        // Apply remaining User fields best-effort (gender, dob, etc.).
        const extraUpdates: any = {};
        if (userData.gender) extraUpdates.gender = userData.gender;
        if (userData.dateOfBirth) extraUpdates.date_of_birth = userData.dateOfBirth;
        if (userData.height) extraUpdates.height = userData.height;
        if (userData.weight) extraUpdates.weight = userData.weight;
        if (userData.preferredUnit) extraUpdates.preferred_unit = userData.preferredUnit;
        if (userData.isTrainer !== undefined) extraUpdates.is_trainer = userData.isTrainer;
        if (Object.keys(extraUpdates).length > 0) {
          await supabase.from('users').update({ ...extraUpdates, updated_at: new Date().toISOString() }).eq('id', r.user.id);
          const fresh = await loadProfile(r.user.id);
          if (fresh) set({ user: fresh });
        }
        return true;
      },

      logout: async () => {
        const u = get().user;
        // Demo users have no Supabase session; calling signOut() would
        // be a no-op but we skip it for clarity (and to avoid the SDK's
        // own logging noise).
        if (!u?.isDemo) {
          await supabase.auth.signOut();
        }
        set({ user: null, isAuthenticated: false });
      },

      deleteAccount: async () => {
        const u = get().user;
        if (!u) return;
        // Delete public.users row (trainer can't do this via RLS for other
        // users, only self — allowed by users_update_self? No, update only.
        // We intentionally DON'T delete server-side; the /api/account/delete
        // route with service role does that. For now, mark as deleted.
        await supabase.from('users').update({ account_status: 'deleted', updated_at: new Date().toISOString() }).eq('id', u.id);
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false });
      },

      updateUser: async (updates) => {
        const u = get().user;
        if (!u) return;
        const dbUpdates: any = {};
        if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
        if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
        if (updates.gender) dbUpdates.gender = updates.gender;
        if (updates.height !== undefined) dbUpdates.height = updates.height;
        if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
        if (updates.profilePhoto !== undefined) dbUpdates.avatar_url = updates.profilePhoto;
        if (updates.isTrainer !== undefined) dbUpdates.is_trainer = updates.isTrainer;
        if (updates.mode) dbUpdates.mode = updates.mode;
        if (updates.preferredUnit) dbUpdates.preferred_unit = updates.preferredUnit;
        if (updates.username !== undefined) dbUpdates.username = updates.username;
        if ((updates as any).trainerId !== undefined) dbUpdates.trainer_id = (updates as any).trainerId;
        if ((updates as any).accountStatus) dbUpdates.account_status = (updates as any).accountStatus;
        if (Object.keys(dbUpdates).length > 0) {
          dbUpdates.updated_at = new Date().toISOString();
          await supabase.from('users').update(dbUpdates).eq('id', u.id);
        }
        set({ user: { ...u, ...updates } });
      },

      updatePassword: async (_email, _oldPassword, newPassword) => {
        // Supabase requires an active session; old password isn't used here
        // because signInWithPassword re-auth is the assumed precondition.
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          console.error('[Auth v2] updatePassword failed:', error.message);
          return false;
        }
        return true;
      },

      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined,
        });
        if (error) {
          console.error('[Auth v2] resetPassword failed:', error.message);
          return false;
        }
        return true;
      },

      switchMode: (mode) => {
        const u = get().user;
        if (!u) return;
        const updated = { ...u, mode };
        set({ user: updated });
        // is_trainer is permanent; mode is presentation-only.
        supabase.from('users').update({ mode, updated_at: new Date().toISOString() }).eq('id', u.id);
      },
    }),
    {
      name: 'apex-auth',
      storage: createJSONStorage(() => safeLocalStorage),
      // Only persist the minimal profile slice; Supabase Auth owns the session.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }) as any,
    },
  ),
);

/**
 * Subscribe to Supabase auth state changes and keep Zustand in sync.
 * Idempotent: only installs one listener per window.
 */
let _authListenerInstalled = false;
export function installAuthListener() {
  if (_authListenerInstalled) return;
  if (typeof window === 'undefined') return;
  _authListenerInstalled = true;

  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth v2] onAuthStateChange:', event, 'user=', session?.user?.email);
    const store = useAuthStore.getState();
    if (event === 'SIGNED_OUT' || !session?.user) {
      // In pure-client demo mode, Supabase "no session" events are
      // expected (there IS no session) and must NOT wipe the demo user.
      if (store.user?.isDemo) return;
      useAuthStore.setState({ user: null, isAuthenticated: false });
      return;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      // Only refresh profile if missing or id changed.
      if (!store.user || store.user.id !== session.user.id) {
        const profile = await loadProfile(session.user.id);
        if (profile) {
          useAuthStore.setState({ user: profile, isAuthenticated: true, isBootstrapped: true });
        }
      }
    }
  });
}
