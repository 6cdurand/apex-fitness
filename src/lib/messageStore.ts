'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { syncMessageToSupabase, syncConversationToSupabase } from './supabaseSync';

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

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: [],

      getConversation: (otherUserId) => {
        return get().conversations.find(c => c.participants.includes(otherUserId));
      },

      getOrCreateConversation: (currentUserId, otherUserId) => {
        const existing = get().conversations.find(c => 
          c.participants.includes(currentUserId) && c.participants.includes(otherUserId)
        );
        
        if (existing) return existing;

        const newConversation: Conversation = {
          id: uuidv4(),
          participants: [currentUserId, otherUserId],
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

        set(state => ({
          messages: [...state.messages, message],
          conversations: state.conversations.map(c =>
            c.id === conversationId
              ? { ...c, lastMessage: message, updatedAt: message.createdAt }
              : c
          ),
        }));

        // Sync message to Supabase for cross-device access
        syncMessageToSupabase({
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content,
          read: message.read,
          createdAt: message.createdAt,
        });

        return message;
      },

      markAsRead: (conversationId, userId) => {
        set(state => ({
          messages: state.messages.map(m =>
            m.conversationId === conversationId && m.receiverId === userId && !m.read
              ? { ...m, read: true }
              : m
          ),
        }));
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
      storage: createJSONStorage(() => localStorage),
    }
  )
);
