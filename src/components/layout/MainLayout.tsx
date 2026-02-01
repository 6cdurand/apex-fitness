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
  const themeColor = isTrainerMode ? 'rose' : 'sky';
  const primaryColor = isTrainerMode ? 'bg-rose-500' : 'bg-sky-500';
  const primaryColorLight = isTrainerMode ? 'bg-rose-500/10' : 'bg-sky-500/10';
  const textColor = isTrainerMode ? 'text-rose-400' : 'text-sky-400';

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-24 overflow-auto">
        {children}
      </main>

      {/* Bottom Navigation - Refined, calmer */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-slate-900/98 backdrop-blur-xl border-t border-slate-800/50",
        "safe-area-inset-bottom shadow-2xl shadow-black/50"
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
                      : "hover:bg-slate-800/50"
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
                      isActive ? `${textColor} scale-110` : "text-slate-500"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-medium transition-colors",
                      isActive ? textColor : "text-slate-500"
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

  return (
    <header className={cn(
      "sticky top-0 z-40",
      "bg-gradient-to-b",
      isTrainerMode ? "from-rose-500 via-rose-600 to-orange-500" : "from-sky-500 via-sky-600 to-orange-500",
      "px-5 pt-14 pb-8 shadow-xl",
      isTrainerMode ? "shadow-rose-500/10" : "shadow-sky-500/10"
    )}>
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
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}
