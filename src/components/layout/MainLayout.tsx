'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  Dumbbell,
  Newspaper,
  Users,
  UserCircle,
  Calendar,
  GraduationCap,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const userNavItems: NavItem[] = [
  { icon: Dumbbell, label: 'Train', href: '/workout' },
  { icon: Newspaper, label: 'Feed', href: '/feed' },
  { icon: Users, label: 'Friends', href: '/friends' },
  { icon: GraduationCap, label: 'Trainer', href: '/trainer' },
  { icon: UserCircle, label: 'Profile', href: '/profile' },
];

const trainerNavItems: NavItem[] = [
  { icon: Dumbbell, label: 'Log', href: '/workout' },
  { icon: Newspaper, label: 'Feed', href: '/feed' },
  { icon: Users, label: 'Clients', href: '/clients' },
  { icon: Calendar, label: 'Calendar', href: '/calendar' },
  { icon: UserCircle, label: 'Profile', href: '/profile' },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const isTrainerMode = user?.mode === 'trainer';
  const navItems = isTrainerMode ? trainerNavItems : userNavItems;

  // Theme colors based on mode
  const themeColor = isTrainerMode ? 'rose' : 'emerald';
  const primaryColor = isTrainerMode ? 'bg-rose-500' : 'bg-emerald-500';
  const primaryColorLight = isTrainerMode ? 'bg-rose-500/10' : 'bg-emerald-500/10';
  const textColor = isTrainerMode ? 'text-rose-500' : 'text-emerald-500';

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-20 overflow-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-gray-900/95 backdrop-blur-lg border-t border-gray-800",
        "safe-area-inset-bottom"
      )}>
        <div className="max-w-lg mx-auto px-2">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    "px-3 py-2 rounded-xl transition-all duration-200",
                    "min-w-[64px]",
                    isActive ? primaryColorLight : "hover:bg-gray-800"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-6 w-6 mb-1 transition-colors",
                      isActive ? textColor : "text-gray-400"
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
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
  const gradientFrom = isTrainerMode ? 'from-rose-500' : 'from-emerald-500';
  const gradientTo = isTrainerMode ? 'to-rose-600' : 'to-emerald-600';

  return (
    <header className={cn(
      "sticky top-0 z-40",
      "bg-gradient-to-r",
      gradientFrom,
      gradientTo,
      "px-4 pt-12 pb-6"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-white/70 text-sm mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}
