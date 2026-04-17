import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../safeStorage';
import { v4 as uuidv4 } from 'uuid';
import { User, UserMode } from '@/types';
import { registerUserToSupabase, loginFromSupabase, updateUserInSupabase } from '../supabaseSync';

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
        
        // Check if a placeholder account with this email exists — reuse its ID instead of creating a duplicate
        const existingPlaceholder = storedUsers.find((u: any) => 
          u.email?.toLowerCase() === userData.email?.toLowerCase() &&
          (u.accountStatus === 'placeholder' || u.email?.endsWith('@placeholder.local') || u.email?.endsWith('@client.apex'))
        );
        
        // Check if a real (non-placeholder) account with this email exists — block duplicate
        const existingActive = storedUsers.find((u: any) => 
          u.email?.toLowerCase() === userData.email?.toLowerCase() &&
          u.accountStatus !== 'placeholder' && !u.email?.endsWith('@placeholder.local') && !u.email?.endsWith('@client.apex')
        );
        if (existingActive) {
          set({ isLoading: false });
          return false;
        }

        const newUser: User = {
          id: userData.id || existingPlaceholder?.id || uuidv4(),
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

        // If upgrading a placeholder, replace it; otherwise add new
        const filteredUsers = existingPlaceholder
          ? storedUsers.filter((u: any) => u.id !== existingPlaceholder.id)
          : storedUsers;
        filteredUsers.push({ ...newUser, password: hashPassword(userData.password) });
        localStorage.setItem('apex-users', JSON.stringify(filteredUsers));
        
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
      storage: createJSONStorage(() => safeLocalStorage),
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
