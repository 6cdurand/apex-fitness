'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore, useWorkoutStore, useMedalStore, useTrainerStore } from '@/lib/store';
import {
  useMessageStore,
  mergeMessagesPreferRead,
  type Message,
  type Conversation,
} from '@/lib/messageStore';
import { supabase } from '@/lib/supabase';
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

// ============================================================================
// M1 + M2: REALTIME APPLY HELPERS
// ============================================================================
//
// Pure helpers that translate a Supabase Postgres Realtime payload row into
// the local store shape and merge it into useMessageStore. Extracted from
// the component's useEffect so they can be driven directly by a unit test
// (see src/lib/__tests__/messagingRealtime.test.ts) without having to mock
// the realtime channel wiring.
//
// The `__` prefix marks them as test seams — the component is the only
// non-test caller. These helpers are intentionally idempotent:
//   - Re-applying the same INSERT is a no-op (mergeMessagesPreferRead keys
//     on id; conversation patch is gated on createdAt being >= existing).
//   - The self-echo of an optimistically-inserted message dedupes naturally
//     because the local row and the realtime row share the same id (D7).
// ============================================================================

/**
 * Apply a single messages-table realtime row to the local store.
 *
 * Behaviour:
 *  - Maps the DB row (snake_case columns) to the local Message shape.
 *  - Merges into `messages` via `mergeMessagesPreferRead` so a freshly-
 *    flipped local `read=true` cannot be regressed by a stale remote
 *    `read=false` (D2 semantics preserved).
 *  - For M2, also patches the owning conversation's `lastMessage` and
 *    `updatedAt` IF the incoming message is newer than what the
 *    conversation currently shows. This fixes the empty preview line in
 *    the /messages conversation list without any /messages-page change.
 *
 * A malformed row (missing id) is silently ignored — we never want a
 *   realtime hiccup to break the whole subscription callback.
 */
export function __applyMessageRealtimeEvent(row: any): void {
  if (!row || typeof row !== 'object' || !row.id) return;

  const msg: Message = {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content ?? '',
    createdAt: row.created_at,
    read: !!row.read,
  };

  const state = useMessageStore.getState();
  const mergedMessages = mergeMessagesPreferRead(state.messages, [msg]);

  const nextTs = new Date(msg.createdAt).getTime();
  const mergedConversations = state.conversations.map(c => {
    if (c.id !== msg.conversationId) return c;
    const prevTs = c.lastMessage ? new Date(c.lastMessage.createdAt).getTime() : 0;
    // Only advance lastMessage on a strictly newer (or equal-timestamp
    // different-id) message. An UPDATE event echoing an older row must
    // not regress the preview to stale content.
    if (Number.isFinite(nextTs) && nextTs < prevTs) return c;
    const nextUpdatedAt =
      msg.createdAt && msg.createdAt > (c.updatedAt || '') ? msg.createdAt : c.updatedAt;
    return { ...c, lastMessage: msg, updatedAt: nextUpdatedAt };
  });

  useMessageStore.setState({
    messages: mergedMessages,
    conversations: mergedConversations,
  });
}

/**
 * Apply a single conversations-table realtime row to the local store.
 *
 * Behaviour:
 *  - Maps the DB row (participant_1, participant_2, updated_at) to the
 *    local Conversation shape.
 *  - Field-level merges into any existing local row — CRITICALLY preserves
 *    the local `lastMessage` preview. We intentionally DO NOT use the
 *    generic `mergeData` here: `mergeData` replaces same-id rows wholesale,
 *    which would drop `lastMessage` (the DB `conversations` table does
 *    not store it, so the realtime row arrives without it).
 */
export function __applyConversationRealtimeEvent(row: any): void {
  if (!row || typeof row !== 'object' || !row.id || !row.participant_1 || !row.participant_2) {
    return;
  }

  const incoming: Pick<Conversation, 'id' | 'participants' | 'updatedAt'> = {
    id: row.id,
    participants: [row.participant_1, row.participant_2],
    updatedAt: row.updated_at,
  };

  const state = useMessageStore.getState();
  const existing = state.conversations.find(c => c.id === incoming.id);

  const merged: Conversation = existing
    ? {
        ...existing,
        participants: incoming.participants,
        updatedAt:
          incoming.updatedAt && incoming.updatedAt > (existing.updatedAt || '')
            ? incoming.updatedAt
            : existing.updatedAt,
      }
    : { id: incoming.id, participants: incoming.participants, updatedAt: incoming.updatedAt };

  const others = state.conversations.filter(c => c.id !== incoming.id);
  useMessageStore.setState({
    conversations: existing ? [...others, merged] : [...state.conversations, merged],
  });
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

  // ==========================================================================
  // M1 + M2: REALTIME MESSAGES + CONVERSATIONS SUBSCRIPTION
  // ==========================================================================
  //
  // Prior behaviour (see AUDIT_messaging_2026-04-28.md §4b): this component
  // fetched messages ONCE on mount. New inbound messages only showed up
  // after a full reload — the user-reported "you have to refresh / log back
  // in to receive a message" Sev-1. Additionally, the /messages conversation
  // list preview line was empty on the receiver side because the stored
  // `lastMessage` was never patched for incoming messages (M2).
  //
  // This effect opens two Supabase Postgres Realtime channels:
  //   - apex:messages:<uid>       — two bindings (receiver_id=uid,
  //     sender_id=uid), events INSERT + UPDATE
  //   - apex:conversations:<uid>  — two bindings (participant_1=uid,
  //     participant_2=uid), events INSERT + UPDATE
  //
  // We use two `postgres_changes` bindings per channel because the realtime
  // filter grammar does not support `or=(...)` across columns — a single
  // filter like `receiver_id=eq.X,sender_id=eq.X` would be ANDed server-
  // side and miss most rows.
  //
  // Reconnection: supabase-js auto-reconnects the websocket; we log every
  // status change at info level so it's visible in devtools without adding
  // custom retry logic.
  //
  // Cleanup: removeChannel() on both channels when user.id changes or the
  // component unmounts, so we never leak subscriptions on sign-out / swap.
  // ==========================================================================
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (!isSupabaseConfigured()) return;

    const uid = user.id;

    const onMessageRow = (payload: any) => {
      try {
        __applyMessageRealtimeEvent(payload?.new);
      } catch (e) {
        console.error('[SupabaseSync:realtime:messages] apply error:', e);
      }
    };
    const onConversationRow = (payload: any) => {
      try {
        __applyConversationRealtimeEvent(payload?.new);
      } catch (e) {
        console.error('[SupabaseSync:realtime:conversations] apply error:', e);
      }
    };

    const messagesChannel = supabase
      .channel(`apex:messages:${uid}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${uid}` },
        onMessageRow,
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${uid}` },
        onMessageRow,
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${uid}` },
        onMessageRow,
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${uid}` },
        onMessageRow,
      )
      .subscribe((status: string, err?: Error) => {
        console.info('[SupabaseSync:realtime:messages]', status, err ?? '');
      });

    const conversationsChannel = supabase
      .channel(`apex:conversations:${uid}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `participant_1=eq.${uid}` },
        onConversationRow,
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `participant_1=eq.${uid}` },
        onConversationRow,
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `participant_2=eq.${uid}` },
        onConversationRow,
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `participant_2=eq.${uid}` },
        onConversationRow,
      )
      .subscribe((status: string, err?: Error) => {
        console.info('[SupabaseSync:realtime:conversations]', status, err ?? '');
      });

    return () => {
      try {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(conversationsChannel);
      } catch (e) {
        console.warn('[SupabaseSync:realtime] removeChannel error:', e);
      }
    };
  }, [isAuthenticated, user?.id]);

  return null;
}
