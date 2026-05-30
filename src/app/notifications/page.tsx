'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useSocialStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  Trophy, 
  Dumbbell, 
  Users, 
  Heart, 
  MessageCircle,
  Calendar,
  CheckCheck,
  Trash2,
  Pencil,
  Plus,
  Minus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Notification } from '@/types';
import {
  resolveNotificationTarget,
  type LatestActiveProgramLookup,
} from '@/lib/notificationResolver';
import { fetchClientProgramsForUser } from '@/lib/supabaseSync';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    markAllNotificationsSeen,
    clearAllNotifications,
  } = useSocialStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // v17-D2: clear the bell-badge by stamping `seen_at` on all currently
  // unseen notifications for this user. Optimistic local update fires
  // inside the store action so the badge clears within this render tick;
  // the Supabase sync rides along in the background. Idempotent —
  // re-mounting is a cheap no-op once everything is already seen.
  useEffect(() => {
    if (!user?.id) return;
    markAllNotificationsSeen();
  }, [user?.id, markAllNotificationsSeen]);

  if (!isAuthenticated) return null;

  const userNotifications = notifications
    .filter(n => n.userId === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Lookup helper for legacy program_assigned rows that don't carry a
  // programId. Returns the most-recent active program for the current
  // client or null. Kept local so the pure resolver stays I/O-free.
  const lookupLatestActiveProgram: LatestActiveProgramLookup = async (clientId) => {
    try {
      const programs = await fetchClientProgramsForUser(clientId);
      if (!Array.isArray(programs) || programs.length === 0) return null;
      const active = programs
        .filter((p: any) => p?.status === 'active')
        .sort((a: any, b: any) => {
          const ta = new Date(a?.createdAt || a?.created_at || 0).getTime();
          const tb = new Date(b?.createdAt || b?.created_at || 0).getTime();
          return tb - ta;
        });
      const top = active[0];
      return top?.id ? { id: top.id } : null;
    } catch (e) {
      console.error('[Notifications] lookupLatestActiveProgram failed:', e);
      return null;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    markNotificationRead(notification.id);
    const target = await resolveNotificationTarget(
      notification,
      user?.id,
      lookupLatestActiveProgram,
    );
    if (target.kind === 'navigate') {
      router.push(target.url);
    } else if (target.kind === 'empty') {
      toast.info(target.message);
    }
    // 'noop' — intentionally do nothing (no actionUrl, no type handler).
  };

  const unreadCount = userNotifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'weekly_report': return <Calendar className="w-5 h-5 text-blue-400" />;
      case 'workout_assigned': return <Dumbbell className="w-5 h-5 text-sky-400" />;
      case 'friend_request': return <Users className="w-5 h-5 text-purple-400" />;
      case 'trainer_request': return <Users className="w-5 h-5 text-rose-400" />;
      case 'achievement': return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'pb_achieved': return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-blue-400" />;
      case 'like': return <Heart className="w-5 h-5 text-red-400" />;
      case 'program_assigned': return <Dumbbell className="w-5 h-5 text-emerald-400" />;
      case 'program_edited': return <Pencil className="w-5 h-5 text-orange-400" />;
      default: return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'weekly_report': return 'bg-blue-500/20';
      case 'workout_assigned': return 'bg-sky-500/20';
      case 'friend_request': return 'bg-purple-500/20';
      case 'trainer_request': return 'bg-rose-500/20';
      case 'achievement': return 'bg-amber-500/20';
      case 'pb_achieved': return 'bg-amber-500/20';
      case 'comment': return 'bg-blue-500/20';
      case 'like': return 'bg-red-500/20';
      case 'program_assigned': return 'bg-emerald-500/20';
      case 'program_edited': return 'bg-orange-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Notifications" 
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
        showBack
        action={
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={markAllNotificationsRead}
                className="text-sky-400"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Read all
              </Button>
            )}
            {userNotifications.length > 0 && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={clearAllNotifications}
                className="text-gray-400 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        }
      />

      <ScrollArea className="flex-1">
        <div className="px-4 py-4">
          {userNotifications.length === 0 ? (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bell className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-500 mb-2">No notifications</h3>
                <p className="text-sm text-gray-500">
                  You&apos;re all caught up! Check back later.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {userNotifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={cn(
                    "bg-white border-gray-200 shadow-sm cursor-pointer transition-colors",
                    // v17-D2: visual cue tracks unseen ("new since last
                    // panel open"), not unread ("haven't clicked yet").
                    // The mount-time markAllNotificationsSeen stamps these
                    // shortly after first paint, so the cue naturally
                    // fades on the next render — matches the badge.
                    !notification.seenAt && "bg-sky-50 border-l-2 border-l-sky-500"
                  )}
                  onClick={() => { void handleNotificationClick(notification); }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        getNotificationBg(notification.type)
                      )}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium",
                          notification.read ? "text-gray-500" : "text-gray-900"
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {notification.message}
                        </p>
                        {/* v14-D12: tap-to-expand diff detail for program_edited notifications */}
                        {notification.type === 'program_edited' && notification.programEditDetail && (
                          <details className="mt-2 cursor-pointer">
                            <summary className="text-xs text-orange-300 hover:text-orange-200">
                              {notification.programEditDetail.added.length + notification.programEditDetail.removed.length} change{(notification.programEditDetail.added.length + notification.programEditDetail.removed.length) === 1 ? '' : 's'} — tap to view
                            </summary>
                            <div className="mt-2 space-y-1 pl-2 border-l-2 border-orange-500/30">
                              {notification.programEditDetail.added.map(ex => (
                                <div key={`a-${ex.exerciseId}`} className="flex items-center gap-2 text-xs text-green-400">
                                  <Plus className="w-3 h-3 flex-shrink-0" />
                                  <span>{ex.exerciseName}</span>
                                  {ex.blockName && <span className="text-gray-500 text-[10px]">in {ex.blockName}</span>}
                                </div>
                              ))}
                              {notification.programEditDetail.removed.map(ex => (
                                <div key={`r-${ex.exerciseId}`} className="flex items-center gap-2 text-xs text-red-400">
                                  <Minus className="w-3 h-3 flex-shrink-0" />
                                  <span className="line-through">{ex.exerciseName}</span>
                                  {ex.blockName && <span className="text-gray-500 text-[10px]">in {ex.blockName}</span>}
                                </div>
                              ))}
                              {(notification.programEditDetail.setsAdded ?? 0) > 0 && (
                                <p className="text-xs text-green-400">+ {notification.programEditDetail.setsAdded} set{notification.programEditDetail.setsAdded === 1 ? '' : 's'}</p>
                              )}
                              {(notification.programEditDetail.setsRemoved ?? 0) > 0 && (
                                <p className="text-xs text-red-400">− {notification.programEditDetail.setsRemoved} set{notification.programEditDetail.setsRemoved === 1 ? '' : 's'}</p>
                              )}
                            </div>
                          </details>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </MainLayout>
  );
}
