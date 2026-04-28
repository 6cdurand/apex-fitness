'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore, useWorkoutStore, useMedalStore, useTrainerStore } from '@/lib/store';
import { useMessageStore, mergeMessagesPreferRead } from '@/lib/messageStore';
import { 
  fetchAllUserDataFromSupabase, 
  isSupabaseConfigured, 
  mergeData,
  debugSupabase,
  ensureUserExistsInSupabase,
  cleanupDeletedClients,
  fetchWorkoutTemplatesFromSupabase,
  syncWorkoutTemplateToSupabase,
  type MessageData,
  type ConversationData,
} from '@/lib/supabaseSync';

// Expose debug function globally for browser console
if (typeof window !== 'undefined') {
  (window as any).debugSupabase = debugSupabase;
}

/**
 * SupabaseSync Component
 * Syncs ALL user data from Supabase on login for cross-device access
 * Now syncs on EVERY page load for trainers to ensure cross-device consistency
 */
export function SupabaseSync() {
  const { user, isAuthenticated, updateUser } = useAuthStore();

  // Sync user data (workouts, PBs, medals, etc.) - on EVERY page load for cross-device sync
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (!isSupabaseConfigured()) {
      console.log('[SupabaseSync] Supabase not configured, using localStorage only');
      return;
    }

    const syncFromSupabase = async () => {
      console.log('[SupabaseSync] Fetching ALL data from Supabase for user:', user.id);
      
      const remoteData = await fetchAllUserDataFromSupabase(user.id);
      if (!remoteData) {
        console.log('[SupabaseSync] No remote data found or fetch failed');
        return;
      }

      // Get current local data
      const localWorkouts = useWorkoutStore.getState().workoutHistory;
      const localPBs = useWorkoutStore.getState().personalBests;
      const localMedals = useMedalStore.getState().medals;
      const localMessages = useMessageStore.getState().messages;
      const localConversations = useMessageStore.getState().conversations;

      // Merge remote with local (remote takes precedence for same IDs)
      const mergedWorkouts = mergeData(localWorkouts, remoteData.workouts);
      const mergedPBs = mergeData(localPBs, remoteData.personalBests);
      const mergedMedals = mergeData(localMedals, remoteData.medals);
      
      // Merge messages with read-prefer semantics (D2): a fresh local
      // `read=true` must never be regressed by a stale remote `read=false`.
      // See mergeMessagesPreferRead in @/lib/messageStore.ts.
      const mergedMessages = mergeMessagesPreferRead(localMessages, remoteData.messages.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content,
        createdAt: m.createdAt,
        read: m.read,
      })));
      
      const mergedConversations = mergeData(localConversations, remoteData.conversations.map(c => ({
        id: c.id,
        participants: c.participants,
        updatedAt: c.updatedAt,
      })));

      // Update stores with merged data
      useWorkoutStore.setState({
        workoutHistory: mergedWorkouts,
        personalBests: mergedPBs,
      });

      useMedalStore.setState({
        medals: mergedMedals,
      });
      
      useMessageStore.setState({
        messages: mergedMessages,
        conversations: mergedConversations,
      });

      // ALWAYS update user's followers/following from Supabase (source of truth)
      // This ensures stale local data is replaced with accurate remote data
      updateUser({
        followers: remoteData.followers,
        following: remoteData.following,
      });

      // Load user-created workout templates from Supabase
      const supabaseTemplates = await fetchWorkoutTemplatesFromSupabase(user.id);
      if (supabaseTemplates.length > 0) {
        const localTemplates = useWorkoutStore.getState().templates;
        const localOnly = localTemplates.filter(
          lt => !supabaseTemplates.find((st: any) => st.id === lt.id)
        );
        localOnly.forEach(t => syncWorkoutTemplateToSupabase(t));
        useWorkoutStore.setState({ templates: [...supabaseTemplates, ...localOnly] });
      } else {
        // Push any local-only templates to Supabase
        const localTemplates = useWorkoutStore.getState().templates;
        localTemplates.forEach(t => syncWorkoutTemplateToSupabase(t));
      }

      // Recalculate strength rating from synced PBs (it's derived from personal bests)
      setTimeout(() => {
        useMedalStore.getState().calculateStrengthRating();
      }, 100);

      console.log(`[SupabaseSync] ✅ Synced user data from Supabase:
        - ${remoteData.workouts.length} workouts
        - ${remoteData.personalBests.length} personal bests
        - ${remoteData.medals.length} medals
        - ${remoteData.messages.length} messages
        - ${remoteData.conversations.length} conversations
        - ${remoteData.followers.length} followers
        - ${remoteData.following.length} following`);
    };

    syncFromSupabase();
  }, [isAuthenticated, user?.id, updateUser]);

  // SEPARATE effect for trainer data - syncs on EVERY mount for ALL authenticated users
  // This ensures cross-device consistency regardless of localStorage state
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (!isSupabaseConfigured()) return;

    const syncTrainerData = async () => {
      console.log('[SupabaseSync] 🔄 Syncing trainer data from Supabase...');
      console.log('[SupabaseSync] User ID:', user.id);
      console.log('[SupabaseSync] User mode:', user.mode);
      console.log('[SupabaseSync] Is trainer:', user.isTrainer);
      
      try {
        // Invalidate stale profile cache on each auth session (24h TTL handled inside)
        const { readProfileCache } = await import('@/lib/userFetchUtils');
        readProfileCache(); // triggers TTL check and auto-invalidation
        
        // IMPORTANT: Ensure this user exists in Supabase users table first
        // This is required for foreign key relationships (trainer_clients, etc.)
        await ensureUserExistsInSupabase(user);
        
        await useTrainerStore.getState().loadFromSupabase(user.id);
        
        // Check what we got
        const clients = useTrainerStore.getState().clients;
        console.log('[SupabaseSync] ✅ Trainer data synced - Clients:', clients.length);
        if (clients.length > 0) {
          console.log('[SupabaseSync] Client names:', clients.map(c => c.clientId));
        }
        
        // Clean up clients whose Supabase accounts have been deleted
        const removedCount = await cleanupDeletedClients(
          clients,
          useTrainerStore.getState().removeClient
        );
        if (removedCount > 0) {
          console.log(`[SupabaseSync] 🧹 Cleaned up ${removedCount} deleted clients`);
        }
      } catch (error) {
        console.error('[SupabaseSync] ❌ Error syncing trainer data:', error);
      }
    };

    // Small delay to ensure auth is fully loaded
    const timer = setTimeout(syncTrainerData, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.id]);

  return null;
}
