'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore, useWorkoutStore, useMedalStore, useTrainerStore } from '@/lib/store';
import { useMessageStore } from '@/lib/messageStore';
import { 
  fetchAllUserDataFromSupabase, 
  isSupabaseConfigured, 
  mergeData,
  type MessageData,
  type ConversationData,
} from '@/lib/supabaseSync';

/**
 * SupabaseSync Component
 * Syncs ALL user data from Supabase on login for cross-device access
 */
export function SupabaseSync() {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || hasSynced.current) return;
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
      
      // Merge messages and conversations
      const mergedMessages = mergeData(localMessages, remoteData.messages.map(m => ({
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

      // Recalculate strength rating from synced PBs (it's derived from personal bests)
      setTimeout(() => {
        useMedalStore.getState().calculateStrengthRating();
      }, 100);

      // Sync trainer data if user is a trainer
      if (user.mode === 'trainer' || user.isTrainer) {
        console.log('[SupabaseSync] User is a trainer, loading trainer data...');
        await useTrainerStore.getState().loadFromSupabase(user.id);
      }

      console.log(`[SupabaseSync] ✅ Synced from Supabase:
        - ${remoteData.workouts.length} workouts
        - ${remoteData.personalBests.length} personal bests
        - ${remoteData.medals.length} medals
        - ${remoteData.messages.length} messages
        - ${remoteData.conversations.length} conversations
        - ${remoteData.followers.length} followers
        - ${remoteData.following.length} following`);
      
      hasSynced.current = true;
    };

    syncFromSupabase();
  }, [isAuthenticated, user?.id, updateUser]);

  return null;
}
