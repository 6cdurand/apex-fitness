import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../safeStorage';
import { v4 as uuidv4 } from 'uuid';
import { FeedPost, Notification } from '@/types';
import { useAuthStore } from './authStore';

interface SocialState {
  posts: FeedPost[];
  notifications: Notification[];
  
  createPost: (type: FeedPost['type'], content: string, mediaUrls?: string[], workoutId?: string, medalId?: string) => void;
  deletePost: (postId: string) => void;
  likePost: (postId: string) => void;
  unlikePost: (postId: string) => void;
  commentOnPost: (postId: string, content: string) => void;
  
  followUser: (userId: string) => void;
  unfollowUser: (userId: string) => void;
  
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearAllNotifications: () => void;
  getUnreadCount: () => number;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      posts: [],
      notifications: [],

      createPost: (type, content, mediaUrls, workoutId, medalId) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const post: FeedPost = {
          id: uuidv4(),
          userId: user.id,
          user,
          type,
          content,
          mediaUrls,
          workoutId,
          medalId,
          likes: [],
          comments: [],
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          posts: [post, ...state.posts],
        }));
      },

      deletePost: (postId) => {
        set(state => ({
          posts: state.posts.filter(p => p.id !== postId),
        }));
      },

      likePost: (postId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        set(state => ({
          posts: state.posts.map(p =>
            p.id === postId && !p.likes.includes(userId)
              ? { ...p, likes: [...p.likes, userId] }
              : p
          ),
        }));
      },

      unlikePost: (postId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        set(state => ({
          posts: state.posts.map(p =>
            p.id === postId
              ? { ...p, likes: p.likes.filter(id => id !== userId) }
              : p
          ),
        }));
      },

      commentOnPost: (postId, content) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const comment = {
          id: uuidv4(),
          userId: user.id,
          user,
          content,
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          posts: state.posts.map(p =>
            p.id === postId
              ? { ...p, comments: [...p.comments, comment] }
              : p
          ),
        }));
      },

      followUser: async (userId) => {
        const { updateUser, user } = useAuthStore.getState();
        if (!user) return;

        // Prevent following placeholder (client-file) accounts
        try {
          const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
          const target = storedUsers.find((u: any) => u.id === userId);
          if (target && (target.accountStatus === 'placeholder' || target.email?.endsWith('@placeholder.local'))) {
            return;
          }
        } catch { /* ignore */ }

        updateUser({
          following: [...user.following, userId],
        });
        
        // Notify the followed user
        get().addNotification({
          userId: userId,
          type: 'friend_request',
          title: 'New Follower',
          message: `${user.displayName || user.username || 'Someone'} started following you`,
          actionUrl: `/profile/${user.id}`,
        });
        
        // Sync to Supabase
        const { syncFollowToSupabase } = await import('../supabaseSync');
        await syncFollowToSupabase(user.id, userId);
      },

      unfollowUser: async (userId) => {
        const { updateUser, user } = useAuthStore.getState();
        if (!user) return;

        updateUser({
          following: user.following.filter(id => id !== userId),
        });
        
        // Sync to Supabase
        const { removeFollowFromSupabase } = await import('../supabaseSync');
        await removeFollowFromSupabase(user.id, userId);
      },

      addNotification: (notification) => {
        const currentUserId = useAuthStore.getState().user?.id;
        const targetUserId = notification.userId || currentUserId;
        if (!targetUserId) return;

        const newNotification: Notification = {
          id: uuidv4(),
          ...notification,
          userId: targetUserId,
          read: false,
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          notifications: [newNotification, ...state.notifications],
        }));

        // Sync to Supabase
        import('../supabaseSync').then(({ syncNotificationToSupabase }) => {
          syncNotificationToSupabase(newNotification);
        });
      },

      markNotificationRead: (notificationId) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        }));

        // Sync to Supabase
        import('../supabaseSync').then(({ markNotificationReadInSupabase }) => {
          markNotificationReadInSupabase(notificationId);
        });
      },

      markAllNotificationsRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
        }));
      },

      clearAllNotifications: () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;
        set(state => ({
          notifications: state.notifications.filter(n => n.userId !== userId),
        }));

        // Delete from Supabase
        import('../supabaseSync').then(({ deleteNotificationsFromSupabase }) => {
          deleteNotificationsFromSupabase(userId);
        });
      },

      getUnreadCount: () => {
        const userId = useAuthStore.getState().user?.id;
        return get().notifications.filter(n => n.userId === userId && !n.read).length;
      },
    }),
    {
      name: 'apex-social',
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
);
