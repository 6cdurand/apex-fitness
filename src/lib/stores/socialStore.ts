import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { scopedStorage } from './scopedStorage';
import { v4 as uuidv4 } from 'uuid';
import { FeedPost, Notification } from '@/types';
import { useAuthStore } from './authStore';
import { syncFollowToSupabase, syncUnfollowFromSupabase, fetchFollowingFromSupabase, fetchFollowersFromSupabase } from '../supabaseSync';

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
  hydrateFollowsFromSupabase: (userId: string) => Promise<void>;
  getFollowersCount: (userId: string) => number;
  
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  /**
   * v17-D2: stamp `seenAt` on every currently-unseen notification for the
   * signed-in user. Distinct from `markAllNotificationsRead` (acted-on).
   * Fires optimistically against local state so the bell-badge clears
   * within the same render tick, then syncs to Supabase in the background.
   */
  markAllNotificationsSeen: () => void;
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
        
        // Sync to Supabase (fire-and-forget with debounce)
        setTimeout(() => {
          syncFollowToSupabase(user.id, userId).catch(() => {});
        }, 300);
      },

      unfollowUser: async (userId) => {
        const { updateUser, user } = useAuthStore.getState();
        if (!user) return;

        updateUser({
          following: user.following.filter(id => id !== userId),
        });
        
        // Sync to Supabase (fire-and-forget)
        setTimeout(() => {
          syncUnfollowFromSupabase(user.id, userId).catch(() => {});
        }, 300);
      },

      hydrateFollowsFromSupabase: async (userId: string) => {
        try {
          const [following, followers] = await Promise.all([
            fetchFollowingFromSupabase(userId),
            fetchFollowersFromSupabase(userId),
          ]);

          const { updateUser } = useAuthStore.getState();
          updateUser({
            following,
          });

          console.log(`[FollowSync] Hydrated ${following.length} following, ${followers.length} followers`);
        } catch (err) {
          console.error('[FollowSync] Exception during hydration:', err);
        }
      },

      getFollowersCount: (userId: string) => {
        // For now, scan users to get follower count
        // This will be replaced with followers[] state when we track it properly
        try {
          const users = JSON.parse(localStorage.getItem('apex-users') || '[]');
          return users.filter((u: any) => u.following?.includes(userId)).length;
        } catch {
          return 0;
        }
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

      markAllNotificationsSeen: () => {
        // v17-D2: optimistic local stamp + background Supabase sync.
        // Idempotent — already-seen rows are untouched. Scoped to the
        // current user so a logged-out / pre-hydration call is a no-op.
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;
        const seenAt = new Date().toISOString();
        const hadUnseen = get().notifications.some(
          n => n.userId === userId && !n.seenAt
        );
        if (!hadUnseen) return; // nothing to do — skip the round-trip
        set(state => ({
          notifications: state.notifications.map(n =>
            n.userId === userId && !n.seenAt ? { ...n, seenAt } : n
          ),
        }));
        // Fire-and-forget server sync. Server result is non-blocking; if
        // it fails the next mount will retry (WHERE seen_at IS NULL).
        import('../supabaseSync').then(({ markAllNotificationsSeenInSupabase }) => {
          markAllNotificationsSeenInSupabase(userId).catch(e =>
            console.warn('[v17-D2] markAllNotificationsSeen sync failed:', e)
          );
        });
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
        // v17-D2: badge reflects "new since last panel open" (seen_at IS
        // NULL), not "haven't clicked through" (read=false). The two are
        // intentionally distinct — see Notification.seenAt vs .read.
        const userId = useAuthStore.getState().user?.id;
        return get().notifications.filter(n => n.userId === userId && !n.seenAt).length;
      },
    }),
    {
      name: 'apex-social',
      // v16-D2: per-user scoped key. posts[] + notifications[] are
      // per-user data and must not leak across accounts.
      storage: createJSONStorage(() => scopedStorage('apex-social')),
    }
  )
);
