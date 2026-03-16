'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useSocialStore } from '@/lib/store';
import { useMessageStore } from '@/lib/messageStore';
import { cn } from '@/lib/utils';
import {
  Dumbbell,
  Newspaper,
  Users,
  UserCircle,
  CalendarDays,
  GraduationCap,
  Mail,
  Hammer,
  Play,
  Bell,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const userNavItems: NavItem[] = [
  { icon: CalendarDays, label: 'Today', href: '/today' },
  { icon: Newspaper, label: 'Feed', href: '/feed' },
  { icon: Users, label: 'Community', href: '/community' },
  { icon: GraduationCap, label: 'Program', href: '/program' },
  { icon: UserCircle, label: 'Profile', href: '/profile' },
];

const trainerNavItems: NavItem[] = [
  { icon: CalendarDays, label: 'Today', href: '/today' },
  { icon: Newspaper, label: 'Feed', href: '/feed' },
  { icon: Users, label: 'Clients', href: '/clients' },
  { icon: Hammer, label: 'Builder', href: '/builder' },
  { icon: UserCircle, label: 'Profile', href: '/profile' },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { activeWorkout } = useWorkoutStore();

  const isTrainerMode = user?.mode === 'trainer';
  const isOnActivePage = pathname === '/workout/active';
  const navItems = isTrainerMode ? trainerNavItems : userNavItems;

  // Theme colors based on mode
  const themeColor = isTrainerMode ? 'rose' : 'sky';
  const primaryColor = isTrainerMode ? 'bg-rose-500' : 'bg-sky-500';
  const primaryColorLight = isTrainerMode ? 'bg-rose-500/10' : 'bg-sky-500/10';
  const textColor = isTrainerMode ? 'text-rose-400' : 'text-sky-400';

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-24 overflow-auto">
        {children}
      </main>

      {/* Active Workout Bar — shown when workout is in progress and user navigated away */}
      {activeWorkout && !isOnActivePage && (
        <div
          className="fixed bottom-[72px] left-0 right-0 z-50 cursor-pointer"
          onClick={() => router.push('/workout/active')}
        >
          <div className="max-w-lg mx-auto px-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-green-500 to-emerald-500 rounded-t-2xl px-4 py-3 shadow-lg shadow-green-500/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                  <Dumbbell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{activeWorkout.name || 'Workout in Progress'}</p>
                  <p className="text-[11px] text-white/70">{activeWorkout.exercises?.length || 0} exercises • Tap to continue</p>
                </div>
              </div>
              <Play className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Refined, calmer */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-white/98 backdrop-blur-xl border-t border-gray-200",
        "safe-area-inset-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
      )}>
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    "px-4 py-2.5 rounded-2xl transition-all duration-300",
                    "min-w-[68px] relative",
                    isActive 
                      ? `${primaryColorLight} shadow-lg ${isTrainerMode ? 'shadow-rose-500/20' : 'shadow-sky-500/20'}` 
                      : "hover:bg-gray-100"
                  )}
                >
                  {isActive && (
                    <div className={cn(
                      "absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full",
                      isTrainerMode ? "bg-rose-400" : "bg-sky-400"
                    )} />
                  )}
                  <Icon
                    className={cn(
                      "h-5 w-5 mb-1 transition-all duration-300",
                      isActive ? `${textColor} scale-110` : "text-gray-400"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-medium transition-colors",
                      isActive ? textColor : "text-gray-400"
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  showBack = false,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showBack?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const isTrainerMode = user?.mode === 'trainer';

  const userBgImage = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=300&fit=crop&crop=center';
  const trainerBgImage = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=300&fit=crop&crop=center';

  return (
    <header className={cn(
      "sticky top-0 z-40 relative overflow-hidden",
      "px-5 pt-14 pb-8 shadow-lg",
      isTrainerMode ? "shadow-rose-500/10" : "shadow-sky-500/10"
    )}>
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${isTrainerMode ? trainerBgImage : userBgImage})` }}
      />
      {/* Gradient overlay for readability */}
      <div className={cn(
        "absolute inset-0",
        isTrainerMode
          ? "bg-gradient-to-b from-rose-600/85 via-rose-500/80 to-rose-600/90"
          : "bg-gradient-to-b from-sky-600/85 via-sky-500/80 to-sky-600/90"
      )} />
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white_1px,transparent_1px)] bg-[length:24px_24px]" />
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2.5 -ml-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-white/80 text-sm mt-1 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotifBellButton />
          <MessageButton />
          {action && <div>{action}</div>}
        </div>
      </div>
    </header>
  );
}

function NotifBellButton() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { getUnreadCount } = useSocialStore();
  const unread = user ? getUnreadCount() : 0;

  return (
    <button
      onClick={() => router.push('/notifications')}
      className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5 text-white" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function MessageButton() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { getUnreadCount } = useMessageStore();
  const unread = user ? getUnreadCount(user.id) : 0;

  return (
    <button
      onClick={() => router.push('/messages')}
      className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
      aria-label="Messages"
    >
      <Mail className="w-5 h-5 text-white" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
