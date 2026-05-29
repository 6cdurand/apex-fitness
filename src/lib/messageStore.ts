'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scopedStorage } from './stores/scopedStorage';
import { v4 as uuidv4 } from 'uuid';
import {
  syncMessageToSupabase,
  syncConversationToSupabase,
  markMessagesReadInSupabase,
} from './supabaseSync';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read: boolean;
  status?: 'pending' | 'sent' | 'failed';
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  updatedAt: string;
}

interface MessageState {
  conversations: Conversation[];
  messages: Message[];
  
  getConversation: (otherUserId: string) => Conversation | undefined;
  getOrCreateConversation: (currentUserId: string, otherUserId: string) => Conversation;
  getMessages: (conversationId: string) => Message[];
  sendMessage: (conversationId: string, senderId: string, receiverId: string, content: string) => Message;
  retryMessage: (messageId: string) => void;
  markAsRead: (conversationId: string, userId: string) => void;
  getUnreadCount: (userId: string) => number;
  getUnreadCountForConversation: (conversationId: string, userId: string) => number;
  getConversationsForUser: (userId: string) => Conversation[];
}

/**
 * Pure helper: given the full messages list, a conversation ID and the current
 * user ID, return the IDs of inbound-only, currently-unread messages in that
 * conversation. "Inbound-only" means the user is the receiver, not the sender
 * — we never flip read=true on a message the user themselves sent.
 *
 * Exposed for unit tests (see __tests__/messaging.test.ts) so the D1 acceptance
 * criterion "don't write read=true on messages where the user is the sender"
 * can be verified without mocking Supabase.
 */
export function computeMessageIdsToMarkRead(
  messages: Message[],
  conversationId: string,
  userId: string,
): string[] {
  return messages
    .filter(m => m.conversationId === conversationId && m.receiverId === userId && !m.read)
    .map(m => m.id);
}

/**
 * Pure helper: merge local + remote messages with a "read=true on either side
 * wins" precedence rule. Fixes the D2 regression where a stale remote row
 * (read=false) would overwrite a freshly-flipped local row (read=true) on
 * every SupabaseSync mount.
 *
 * Semantics:
 *  - Union by id.
 *  - When both sides have the same id, all non-read fields come from remote
 *    (remote is authoritative for content), but `read` is `local.read || remote.read`.
 *  - Rows only in one side are passed through unchanged.
 *
 * Exposed for unit tests and for the call site at
 * @/components/SupabaseSync.tsx. The generic `mergeData` in supabaseSync.ts
 * is intentionally not modified — it is used by every other entity merge.
 */
export function mergeMessagesPreferRead(local: Message[], remote: Message[]): Message[] {
  const localMap = new Map(local.map(m => [m.id, m]));
  const seen = new Set<string>();
  const merged: Message[] = [];

  for (const r of remote) {
    const l = localMap.get(r.id);
    if (l) {
      merged.push({ ...r, read: l.read || r.read });
    } else {
      merged.push(r);
    }
    seen.add(r.id);
  }
  for (const l of local) {
    if (!seen.has(l.id)) merged.push(l);
  }
  return merged;
}

/**
 * Pure helper: collapse multiple Conversation rows that share the same
 * participant pair down to a single canonical row, and rewrite any
 * messages whose `conversationId` referenced a dropped row to point at
 * the kept row.
 *
 * Why this exists:
 *   The conversations list can grow duplicates when the same pair of
 *   users ends up with two rows under different ids — the symptom Christo
 *   reported in /messages: "two message blocks with hendrik where there
 *   should only be one". Three known root causes have produced this:
 *     1. Conversation persisted before the canonical-id heal landed,
 *        then a new row created post-heal under the canonical ids.
 *     2. SupabaseSync `mergeData` deduping by `id` only — two rows for
 *        the same participant pair created on different devices both
 *        survive the merge.
 *     3. Race in `getOrCreateConversation` if two CTAs fire close enough
 *        that the dedupe `find()` runs before the first conversation
 *        commits to the store.
 *
 * Semantics:
 *  - Group conversations by sorted participant pair (`[a,b].sort().join('|')`)
 *    so order-insensitive and canonical-id-insensitive within a pair.
 *  - In each group with >1 row, keep the row with the most recent
 *    `updatedAt`; tie-break by smallest `id` so the result is deterministic
 *    and stable across clients (same input → same kept id).
 *  - Rewrite every message whose `conversationId` matches a dropped row
 *    so messages stay attached to the kept conversation. Without this
 *    step, the surviving conversation would have an empty thread because
 *    half the messages reference the deleted row.
 *
 * Exposed for unit tests AND for the SupabaseSync mount path so the heal
 * runs every time we pull from Supabase. Pure / no zustand reads.
 */
export function dedupeConversationsByParticipants(
  conversations: Conversation[],
  messages: Message[],
): { conversations: Conversation[]; messages: Message[] } {
  if (conversations.length < 2) {
    return { conversations, messages };
  }

  const groups = new Map<string, Conversation[]>();
  for (const c of conversations) {
    if (!c.participants || c.participants.length !== 2) {
      // Defensive: skip malformed rows so they aren't grouped under
      // an empty key. They pass through unchanged in the kept list.
      const key = `__malformed__${c.id}`;
      groups.set(key, [c]);
      continue;
    }
    const key = [...c.participants].sort().join('|');
    const list = groups.get(key);
    if (list) {
      list.push(c);
    } else {
      groups.set(key, [c]);
    }
  }

  const idRemap = new Map<string, string>(); // droppedId → keptId
  const kept: Conversation[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    // Pick the row with the most recent updatedAt; on tie, the smallest id.
    const sorted = [...group].sort((a, b) => {
      const aTs = a.updatedAt || '';
      const bTs = b.updatedAt || '';
      if (aTs !== bTs) return bTs.localeCompare(aTs); // newer first
      return a.id.localeCompare(b.id);
    });
    const winner = sorted[0];
    kept.push(winner);
    for (const dropped of sorted.slice(1)) {
      idRemap.set(dropped.id, winner.id);
    }
  }

  if (idRemap.size === 0) {
    return { conversations: kept, messages };
  }

  const remappedMessages = messages.map(m =>
    idRemap.has(m.conversationId)
      ? { ...m, conversationId: idRemap.get(m.conversationId)! }
      : m,
  );

  return { conversations: kept, messages: remappedMessages };
}

/**
 * Pure helper: project each conversation's `lastMessage` from the messages
 * array.
 *
 * Why this exists:
 *   The `conversations` table in Supabase has no `last_message_*` columns
 *   (schema is just id / participant_1 / participant_2 / updated_at), so
 *   `fetchMessagesFromSupabase` returns conversations stripped of any
 *   `lastMessage` field. The SupabaseSync mount path then merges those
 *   "remote shape" conversations over the local store — under the
 *   id-keyed `mergeData` precedence rule, every conversation that
 *   already existed in Supabase is replaced wholesale by the remote
 *   row, dropping the locally-cached `lastMessage`.
 *
 *   The visible symptom Christo reported: opening /messages on a fresh
 *   device (or even the same device after a sync) shows an empty list /
 *   conversation rows with no preview snippet. This helper closes the
 *   gap by treating `lastMessage` + `updatedAt` as a deterministic
 *   projection of `messages` — derive on read, not stored as a separate
 *   piece of remote state.
 *
 * Semantics:
 *  - For each conversation, find the most recent message (by `createdAt`)
 *    whose `conversationId` matches; tie-break by smallest message id so
 *    the result is stable across clients.
 *  - Set `lastMessage` to that message; bump `updatedAt` to the message's
 *    `createdAt` IF it's newer than the existing conversation timestamp
 *    (we never regress `updatedAt` — a conversation row's own update may
 *    have happened post-message, e.g. a participant change).
 *  - Conversations with no matching messages are returned with
 *    `lastMessage: undefined` and unchanged `updatedAt` so empty threads
 *    still render in the list (avatar + name only, no preview line).
 *  - Pure: input arrays are not mutated.
 *
 * Exposed for unit tests AND for the SupabaseSync mount path so the
 * projection runs every time we pull from Supabase. Mirrors the M2
 * patch already done in the realtime path (see SupabaseSync.tsx
 * applyMessageRow), just for the initial-load case.
 */
export function attachLastMessagesToConversations(
  conversations: Conversation[],
  messages: Message[],
): Conversation[] {
  if (conversations.length === 0) return conversations;

  // Bucket messages by conversationId so the per-conversation lookup is
  // O(1) instead of O(n*m). One pass over messages.
  const byConv = new Map<string, Message[]>();
  for (const m of messages) {
    const list = byConv.get(m.conversationId);
    if (list) {
      list.push(m);
    } else {
      byConv.set(m.conversationId, [m]);
    }
  }

  return conversations.map(c => {
    const convMessages = byConv.get(c.id);
    if (!convMessages || convMessages.length === 0) {
      // No messages for this conversation — leave lastMessage cleared so
      // the UI renders the row without a preview line. Keep updatedAt as
      // received from the conversations row (Supabase or local).
      return c.lastMessage ? { ...c, lastMessage: undefined } : c;
    }

    // Newest first; deterministic tie-break by smallest id.
    let latest = convMessages[0];
    for (let i = 1; i < convMessages.length; i++) {
      const m = convMessages[i];
      const cmp = (m.createdAt || '').localeCompare(latest.createdAt || '');
      if (cmp > 0 || (cmp === 0 && m.id < latest.id)) {
        latest = m;
      }
    }

    // Bump updatedAt only if the message is newer than the conversation's
    // current timestamp. This prevents regressing a future-dated update
    // that the conversations table itself may carry (e.g. a participant
    // metadata change synced after the last message).
    const nextUpdatedAt =
      (c.updatedAt || '').localeCompare(latest.createdAt || '') < 0
        ? latest.createdAt
        : c.updatedAt;

    return {
      ...c,
      lastMessage: latest,
      updatedAt: nextUpdatedAt,
    };
  });
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: [],

      getConversation: (otherUserId) => {
        return get().conversations.find(c => c.participants.includes(otherUserId));
      },

      getOrCreateConversation: (currentUserId, otherUserId) => {
        // D8: Canonicalize participants so `participant_1 < participant_2`
        // when the row is written to Supabase. The live conversations table
        // has a CHECK constraint `conversations_participant_order_check`
        // enforcing that direction (name + LEAST/GREATEST pattern in
        // supabase-migration-prompt.sql:12-17 confirm the canonical
        // direction). String comparison of UUID text agrees with Postgres
        // UUID byte ordering, so a simple `<` suffices.
        //
        // The `.includes(...)` lookup below is order-insensitive, so any
        // legacy locally-persisted row in non-canonical order still matches
        // and is returned as-is (no local data repair needed).
        const [p1, p2] = currentUserId < otherUserId
          ? [currentUserId, otherUserId]
          : [otherUserId, currentUserId];

        const existing = get().conversations.find(c => 
          c.participants.includes(currentUserId) && c.participants.includes(otherUserId)
        );
        
        if (existing) return existing;

        const newConversation: Conversation = {
          id: uuidv4(),
          participants: [p1, p2],
          updatedAt: new Date().toISOString(),
        };

        set(state => ({
          conversations: [...state.conversations, newConversation],
        }));

        // Sync new conversation to Supabase
        syncConversationToSupabase({
          id: newConversation.id,
          participants: newConversation.participants,
          updatedAt: newConversation.updatedAt,
        });

        return newConversation;
      },

      getMessages: (conversationId) => {
        return get().messages
          .filter(m => m.conversationId === conversationId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      },

      sendMessage: (conversationId, senderId, receiverId, content) => {
        const message: Message = {
          id: uuidv4(),
          conversationId,
          senderId,
          receiverId,
          content,
          createdAt: new Date().toISOString(),
          read: false,
          status: 'pending',
        };

        // Snapshot the conversation BEFORE the local set so we can hand its
        // current shape to syncMessageToSupabase. The sync layer will upsert
        // this conversation (awaited) before the message upsert — this is
        // the D7 FK-race fix. Two upserts on first send (here + the one
        // getOrCreateConversation already fired) is acceptable: both are
        // idempotent on (id) PRIMARY KEY.
        const conversation = get().conversations.find(c => c.id === conversationId);

        set(state => ({
          messages: [...state.messages, message],
          conversations: state.conversations.map(c =>
            c.id === conversationId
              ? { ...c, lastMessage: message, updatedAt: message.createdAt }
              : c
          ),
        }));

        // Sync message to Supabase for cross-device access. Passing the
        // conversation forces the sync layer to ensure the conversations row
        // exists before inserting the messages row (closes FK race).
        syncMessageToSupabase(
          {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            receiverId: message.receiverId,
            content: message.content,
            read: message.read,
            createdAt: message.createdAt,
          },
          conversation
            ? {
                id: conversation.id,
                participants: conversation.participants,
                // The just-set updatedAt above hasn't propagated to the local
                // snapshot we captured, but the upsert is keyed on id and the
                // updatedAt we send here is monotonic with the prior value.
                updatedAt: message.createdAt,
              }
            : undefined,
        ).then(() => {
          // Mark as sent on success
          set(state => ({
            messages: state.messages.map(m =>
              m.id === message.id ? { ...m, status: 'sent' as const } : m
            ),
          }));
        }).catch(() => {
          // Mark as failed on error
          set(state => ({
            messages: state.messages.map(m =>
              m.id === message.id ? { ...m, status: 'failed' as const } : m
            ),
          }));
        });

        return message;
      },

      retryMessage: (messageId) => {
        const message = get().messages.find(m => m.id === messageId);
        if (!message || message.status !== 'failed') return;

        // Reset to pending
        set(state => ({
          messages: state.messages.map(m =>
            m.id === messageId ? { ...m, status: 'pending' as const } : m
          ),
        }));

        // Find conversation for sync context
        const conversation = get().conversations.find(c => c.id === message.conversationId);

        // Retry sync
        syncMessageToSupabase(
          {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            receiverId: message.receiverId,
            content: message.content,
            read: message.read,
            createdAt: message.createdAt,
          },
          conversation
            ? {
                id: conversation.id,
                participants: conversation.participants,
                updatedAt: conversation.updatedAt,
              }
            : undefined,
        ).then(() => {
          set(state => ({
            messages: state.messages.map(m =>
              m.id === messageId ? { ...m, status: 'sent' as const } : m
            ),
          }));
        }).catch(() => {
          set(state => ({
            messages: state.messages.map(m =>
              m.id === messageId ? { ...m, status: 'failed' as const } : m
            ),
          }));
        });
      },

      markAsRead: (conversationId, userId) => {
        // Capture the inbound-only IDs BEFORE the local flip so we only push
        // newly-flipped rows to Supabase (no-op on already-read / outbound).
        const toMark = computeMessageIdsToMarkRead(
          get().messages,
          conversationId,
          userId,
        );

        if (toMark.length === 0) return;

        const toMarkSet = new Set(toMark);
        set(state => ({
          messages: state.messages.map(m =>
            toMarkSet.has(m.id) ? { ...m, read: true } : m
          ),
        }));

        // Fire-and-forget cross-device sync, mirroring sendMessage's pattern.
        markMessagesReadInSupabase(toMark);
      },

      getUnreadCount: (userId) => {
        return get().messages.filter(m => m.receiverId === userId && !m.read).length;
      },

      getUnreadCountForConversation: (conversationId, userId) => {
        return get().messages.filter(
          m => m.conversationId === conversationId && m.receiverId === userId && !m.read
        ).length;
      },

      getConversationsForUser: (userId) => {
        return get().conversations
          .filter(c => c.participants.includes(userId))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      },
    }),
    {
      name: 'apex-messages',
      // v16-D2: per-user scoped key. Closes the messenger leak where
      // TrainerB's logged-in browser was inheriting TrainerA's full
      // conversation list + clients-roster cache from `apex-messages`.
      storage: createJSONStorage(() => scopedStorage('apex-messages')),
    }
  )
);
