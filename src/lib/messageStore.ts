'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from './safeStorage';
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
  markAsRead: (conversationId: string, userId: string) => void;
  getUnreadCount: (userId: string) => number;
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
        );

        return message;
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

      getConversationsForUser: (userId) => {
        return get().conversations
          .filter(c => c.participants.includes(userId))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      },
    }),
    {
      name: 'apex-messages',
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
);
