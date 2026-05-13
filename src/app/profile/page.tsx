'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useMedalStore, useSocialStore, useTrainerStore } from '@/lib/store';
import { getClientName as getClientNameUtil } from '@/lib/clientUtils';
import { sortMedalsByPriority, getMedalDefinition, milestoneMedals } from '@/lib/medals';
import { fetchAllUsersFromSupabase } from '@/lib/supabaseSync';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings, 
  Trophy, 
  Dumbbell, 
  TrendingUp,
  Users,
  Calendar,
  Medal,
  ChevronRight,
  Edit,
  LogOut,
  Zap,
  Target,
  Award,
  BadgeCheck,
  Trash2,
  DollarSign,
  Crown,
  Search,
  Plus,
  X
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ProfileCardV2 } from '@/components/ProfileCardV2';
import { WeeklyReportPreviewCard } from '@/components/WeeklyReportPreviewCard';
import { WorkoutStatsCharts } from '@/components/WorkoutStatsCharts';
import { TrainerStatsCharts } from '@/components/TrainerStatsCharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, updateUser, switchMode } = useAuthStore();
  const { workoutHistory, personalBests } = useWorkoutStore();
  const { medals, strengthRating, calculateStrengthRating } = useMedalStore();
  const { posts } = useSocialStore();
  const { clients, removeClient, clearAllData, sessions, sessionPackages, payments } = useTrainerStore();
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showTrainerStatModal, setShowTrainerStatModal] = useState<'clients' | 'sessions' | 'revenue' | null>(null);
  const [showGymPicker, setShowGymPicker] = useState(false);
  const [gymSearchText, setGymSearchText] = useState('');
  const [gyms, setGyms] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // Run deriveAll pipeline when profile loads for full consistency
  useEffect(() => {
    if (user?.id) {
      const { runDeriveAll } = useWorkoutStore.getState();
      runDeriveAll(user.id);
      console.log('[Profile] Triggered deriveAll for user:', user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      calculateStrengthRating();
      // Check and award trainer medals retroactively
      if (user.mode === 'trainer' || user.isTrainer) {
        const { checkAndAwardTrainerMedals } = useTrainerStore.getState();
        checkAndAwardTrainerMedals(user.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalBests, user?.id, user?.mode]);

  // Load gyms list
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-gyms') || '[]');
    setGyms(stored);
  }, []);

  const handleAddGym = (name: string) => {
    if (!name.trim() || !user) return;
    const newGym = { id: `gym-${Date.now()}`, name: name.trim(), createdBy: user.id, createdAt: new Date().toISOString() };
    const updated = [...gyms, newGym];
    setGyms(updated);
    localStorage.setItem('apex-gyms', JSON.stringify(updated));
    updateUser({ gymName: name.trim() });
    setGymSearchText('');
    setShowGymPicker(false);
    toast.success(`Gym set to "${name.trim()}"`);
  };

  const handleSelectGym = (name: string) => {
    updateUser({ gymName: name });
    setGymSearchText('');
    setShowGymPicker(false);
    toast.success(`Gym set to "${name}"`);
  };

  const handleRemoveGym = () => {
    updateUser({ gymName: undefined });
    setShowGymPicker(false);
    toast.success('Gym removed');
  };

  useEffect(() => {
    const loadAllUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
      setAllUsers(stored);
      
      // Also fetch from Supabase for cross-device sync
      try {
        const supabaseUsers = await fetchAllUsersFromSupabase();
        if (supabaseUsers && supabaseUsers.length > 0) {
          // Merge: Supabase is source of truth, add local-only users
          const supabaseIds = new Set(supabaseUsers.map((u: any) => u.id));
          const localOnlyUsers = stored.filter((u: any) => !supabaseIds.has(u.id));
          setAllUsers([...supabaseUsers, ...localOnlyUsers]);
        }
      } catch (e) {
        console.error('[Profile] Error loading users from Supabase:', e);
      }
    };
    loadAllUsers();
  }, []);

  const handleLogout = async () => {
    try {
      // Clear state first to prevent re-render issues
      logout();
      // Small delay before redirect to allow state to clear
      await new Promise(resolve => setTimeout(resolve, 50));
      router.replace('/auth');
    } catch (error) {
      console.error('[Profile] Logout error:', error);
      // Force redirect even on error
      window.location.href = '/auth';
    }
  };

  // Mode switch moved to Today page

  // Get trainer info if user has a trainer
  const [trainerInfo, setTrainerInfo] = useState<any>(null);
  useEffect(() => {
    if (user?.trainerId) {
      const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
      const trainer = storedUsers.find((u: any) => u.id === user.trainerId);
      setTrainerInfo(trainer);
    }
  }, [user?.trainerId]);

  // Sort medals by priority (milestone/strength first, then streak, then others)
  // In trainer mode, only show trainer-related medals (clients, revenue, sessions)
  const sortedMedals = useMemo(() => {
    if (!user?.id) return [];
    const isTrainer = user.mode === 'trainer';
    const earnedMedals = medals.filter((m: any) => m.earned && m.userId === user.id);
    // Get definitions for sorting
    const medalsWithDefs = earnedMedals.map((m: any) => {
      const def = getMedalDefinition(m.definitionId || m.id);
      return { ...m, ...def };
    }).filter((m: any) => m.category); // Only include medals with valid definitions
    
    // Filter by category based on mode
    const filteredMedals = isTrainer 
      ? medalsWithDefs.filter((m: any) => m.category === 'trainer')
      : medalsWithDefs.filter((m: any) => m.category !== 'trainer');
    
    return sortMedalsByPriority(filteredMedals);
  }, [medals, user?.id, user?.mode]);

  // Calculate actual followers/following based on real data only
  // For trainers: followers = ONLY their own clients (filter by trainerId)
  // For users: followers = empty unless explicitly followed
  const actualFollowers = useMemo(() => {
    if (!user) return [];
    if (user.isTrainer || user.mode === 'trainer') {
      // For trainers, only show their own clients (filter by trainerId)
      return clients.filter(c => c.trainerId === user.id).map(c => c.clientId);
    }
    // For regular users, no followers unless explicitly set
    return [];
  }, [user, clients]);
  
  const actualFollowing = useMemo(() => {
    if (!user) return [];
    if (user.isTrainer || user.mode === 'trainer') {
      // Trainers follow no one by default
      return [];
    }
    // Clients follow their trainer
    if (user.trainerId) {
      return [user.trainerId];
    }
    return [];
  }, [user]);

  if (!isAuthenticated || !user) return null;

  const isTrainerMode = user.mode === 'trainer';
  
  // For trainers: count sessions they've conducted (where assignedBy === their id)
  // For regular users: count their own workouts (userId === their id, no assignedBy)
  const trainerConductedWorkouts = workoutHistory.filter(w => w.assignedBy === user.id && !w.deletedAt);
  const userOwnWorkouts = workoutHistory.filter(w => w.userId === user.id && !w.deletedAt);
  
  // Total workouts: trainer sees sessions conducted, user sees own workouts
  const userWorkouts = isTrainerMode ? trainerConductedWorkouts : userOwnWorkouts;
  const totalWorkouts = userWorkouts.length;
  const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const userPosts = posts.filter(p => p.userId === user.id);
  
  // Filter personal bests for current user only
  const userPBs = personalBests.filter(pb => pb.userId === user.id);
  
  // Filter medals for current user only - must be earned AND belong to user
  // Also filter by mode: trainer sees trainer medals, user sees workout/strength medals
  const userMedals = useMemo(() => {
    const allUserMedals = medals.filter((m: any) => m.userId === user.id && m.earned === true);
    // Get definitions to check category
    return allUserMedals.map((m: any) => {
      const def = getMedalDefinition(m.definitionId || m.id);
      return { ...m, category: def?.category };
    }).filter((m: any) => {
      if (isTrainerMode) {
        return m.category === 'trainer';
      }
      return m.category !== 'trainer';
    });
  }, [medals, user.id, isTrainerMode]);
  
  // Trainer stats calculation - uses payments array and sessionPackages for accurate data
  const trainerStats = useMemo(() => {
    if (!user?.id || user.mode !== 'trainer') return null;
    
    const now = new Date();
    // Use actual calendar week boundaries (Monday to Sunday)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    // Use actual calendar month boundaries
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    // Get all trainer packages - this is the source of truth for session/payment counts
    const trainerPackages = sessionPackages.filter(p => p.trainerId === user.id);
    
    // Get all payments for this trainer
    const trainerPayments = payments.filter(p => p.trainerId === user.id);
    
    // Calculate total sessions and paid sessions from packages
    let totalUsedSessions = 0;
    let totalPaidSessionsFromPackages = 0;
    let outstandingAmount = 0;
    
    trainerPackages.forEach(pkg => {
      const used = pkg.usedSessions || 0;
      const paid = pkg.paidSessions || 0;
      totalUsedSessions += used;
      
      // Check if this is an upfront payment (all sessions paid at purchase)
      const isUpfrontPayment = pkg.paymentFrequency === 'upfront' ||
        (paid >= pkg.totalSessions && pkg.totalSessions > 0);
      
      if (isUpfrontPayment) {
        totalPaidSessionsFromPackages += pkg.totalSessions;
        // Only outstanding if exceeded package
        const exceededSessions = Math.max(0, used - pkg.totalSessions);
        outstandingAmount += exceededSessions * (pkg.pricePerSession || 0);
      } else {
        totalPaidSessionsFromPackages += paid;
        // Outstanding = sessions done but not paid
        const unpaid = Math.max(0, used - paid);
        outstandingAmount += unpaid * (pkg.pricePerSession || 0);
      }
    });
    
    // Calculate earnings from actual payment records using calendar week/month boundaries
    const weekPayments = trainerPayments.filter(p => {
      const paidDate = p.paidAt ? new Date(p.paidAt) : null;
      return paidDate && paidDate >= weekStart && paidDate <= weekEnd;
    });
    const monthPayments = trainerPayments.filter(p => {
      const paidDate = p.paidAt ? new Date(p.paidAt) : null;
      return paidDate && paidDate >= monthStart && paidDate <= monthEnd;
    });
    
    const weekEarnings = weekPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const monthEarnings = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalEarnings = trainerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Get average price per session from packages
    const packagesWithPrice = trainerPackages.filter(p => p.pricePerSession > 0);
    const avgPricePerSession = packagesWithPrice.length > 0
      ? packagesWithPrice.reduce((sum, p) => sum + p.pricePerSession, 0) / packagesWithPrice.length
      : 0;
    
    // Calculate averages
    const activeClients = clients.filter(c => c.trainerId === user.id && c.status === 'active').length;
    
    // Sessions per week: total sessions / weeks since start of month (or 4 if no data)
    const weeksActive = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const avgSessionsPerWeek = totalUsedSessions > 0 ? totalUsedSessions / weeksActive : 0;
    
    // Avg per session: from actual payments or package prices
    const avgPerSession = trainerPayments.length > 0 
      ? totalEarnings / trainerPayments.length 
      : avgPricePerSession;
    
    // Payment collection rate
    const collectionRate = totalUsedSessions > 0 
      ? Math.round((totalPaidSessionsFromPackages / totalUsedSessions) * 100) 
      : 100;
    
    // Best client by revenue
    let bestClient = { name: '—', revenue: 0, sessions: 0 };
    trainerPackages.forEach(pkg => {
      const revenue = (pkg.paidSessions || 0) * (pkg.pricePerSession || 0);
      if (revenue > bestClient.revenue) {
        const client = clients.find(c => c.clientId === pkg.clientId);
        bestClient = {
          name: client?.client?.displayName || client?.client?.username || 'Client',
          revenue,
          sessions: pkg.usedSessions || 0,
        };
      }
    });
    
    // Busiest day of week from sessions
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    sessions.filter(s => s.trainerId === user.id && s.status === 'completed').forEach(s => {
      const day = dayNames[new Date(s.date).getDay()];
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const busiestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
    
    // Monthly growth: compare this month earnings vs previous month
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart.getTime() - 1);
    const prevMonthPayments = trainerPayments.filter(p => {
      const paidDate = p.paidAt ? new Date(p.paidAt) : null;
      return paidDate && paidDate >= prevMonthStart && paidDate <= prevMonthEnd;
    });
    const prevMonthEarnings = prevMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const monthlyGrowth = prevMonthEarnings > 0 
      ? Math.round(((monthEarnings - prevMonthEarnings) / prevMonthEarnings) * 100) 
      : monthEarnings > 0 ? 100 : 0;
    
    // Total clients ever
    const totalClientsEver = clients.filter(c => c.trainerId === user.id).length;
    
    // Revenue per client
    const revenuePerClient = activeClients > 0 ? Math.round(totalEarnings / activeClients) : 0;
    
    return {
      totalSessions: totalUsedSessions,
      weekSessions: weekPayments.length,
      monthSessions: monthPayments.length,
      totalEarnings,
      weekEarnings,
      monthEarnings,
      activeClients,
      avgSessionsPerWeek: avgSessionsPerWeek.toFixed(1),
      avgPerSession: avgPerSession.toFixed(0),
      outstandingAmount,
      totalPaidSessions: totalPaidSessionsFromPackages,
      totalUnpaidSessions: Math.max(0, totalUsedSessions - totalPaidSessionsFromPackages),
      collectionRate,
      bestClient,
      busiestDay: busiestDay ? { day: busiestDay[0], count: busiestDay[1] } : null,
      monthlyGrowth,
      totalClientsEver,
      revenuePerClient,
    };
  }, [user, sessions, sessionPackages, clients, payments]);
  

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'elite': return 'text-amber-400';
      case 'advanced': return 'text-purple-400';
      case 'intermediate': return 'text-blue-400';
      case 'novice': return 'text-sky-400';
      default: return 'text-gray-400';
    }
  };

  const getTierBg = (tier?: string) => {
    switch (tier) {
      case 'elite': return 'bg-amber-500/20';
      case 'advanced': return 'bg-purple-500/20';
      case 'intermediate': return 'bg-blue-500/20';
      case 'novice': return 'bg-sky-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  const getMedalTierGradient = (tier?: string) => {
    switch (tier) {
      case 'diamond': return 'from-purple-500/30 to-blue-600/30';
      case 'platinum': return 'from-cyan-400/30 to-cyan-600/30';
      case 'gold': return 'from-yellow-500/30 to-amber-600/30';
      case 'silver': return 'from-gray-300/30 to-gray-500/30';
      case 'bronze': return 'from-amber-700/30 to-amber-900/30';
      default: return 'from-gray-700 to-gray-800';
    }
  };

  return (
    <MainLayout>
      <div className="pt-14 pb-12 px-5 relative overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${isTrainerMode ? 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=400&fit=crop&crop=center' : 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=400&fit=crop&crop=center'})` }}
        />
        {/* Gradient overlay */}
        <div className={`absolute inset-0 ${isTrainerMode ? 'bg-gradient-to-b from-rose-600/85 via-rose-500/80 to-rose-700/90' : 'bg-gradient-to-b from-sky-600/85 via-sky-500/80 to-sky-700/90'}`} />
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_20%,white_1px,transparent_1px)] bg-[length:32px_32px] pointer-events-none" />
        
        {/* Profile Header */}
        <div className="relative flex items-start justify-between mb-8">
          <div className="flex items-center gap-5">
            <button onClick={() => setShowProfileCard(true)} className="relative group">
              <Avatar className="w-24 h-24 border-4 border-white/20 group-hover:border-white/40 transition-all duration-300 shadow-xl shadow-black/30">
                <AvatarImage src={user.profilePhoto} />
                <AvatarFallback className="text-2xl bg-slate-800 text-white font-bold">
                  {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white text-xs font-semibold">View Card</span>
              </div>
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">{user.displayName || user.username}</h1>
                {user.isVerifiedTrainer && (
                  <BadgeCheck className="w-5 h-5 text-sky-300" />
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-white/70 text-sm">@{user.username}</p>
                {user.gender && user.gender !== 'other' && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-white/70 capitalize font-medium">
                    {user.gender}
                  </span>
                )}
              </div>
              {user.bio && (
                <p className="text-white/60 text-sm max-w-[200px] line-clamp-2">{user.bio}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => router.push('/membership')}
              className="text-white/80 hover:text-white hover:bg-white/15 rounded-xl"
            >
              <Crown className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => router.push('/settings')}
              className="text-white/80 hover:text-white hover:bg-white/15 rounded-xl"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Stats Row - Glass card style */}
        <div className="relative grid grid-cols-4 gap-2 mb-6 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{totalWorkouts}</p>
            <p className="text-[11px] text-white/60 font-medium">Workouts</p>
          </div>
          <div 
            className="text-center cursor-pointer hover:bg-white/10 rounded-xl p-2 -m-2 transition-all duration-200"
            onClick={() => setShowFollowersModal(true)}
          >
            <p className="text-2xl font-bold text-white">{actualFollowers.length}</p>
            <p className="text-[11px] text-white/60 font-medium">{isTrainerMode ? 'Clients' : 'Followers'}</p>
          </div>
          <div 
            className="text-center cursor-pointer hover:bg-white/10 rounded-xl p-2 -m-2 transition-all duration-200"
            onClick={() => setShowFollowingModal(true)}
          >
            <p className="text-2xl font-bold text-white">{actualFollowing.length}</p>
            <p className="text-[11px] text-white/60 font-medium">{isTrainerMode ? 'Athletes' : 'Following'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{userMedals.length}</p>
            <p className="text-[11px] text-white/60 font-medium">Medals</p>
          </div>
        </div>
      </div>

      {/* Add Your Gym - Bible app style */}
      <div className="px-5 -mt-3 relative z-10 mb-3">
        {user.gymName ? (
          <button
            onClick={() => setShowGymPicker(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Dumbbell className="w-4 h-4 text-sky-500" />
            <span className="text-sm text-gray-700 font-medium">{user.gymName}</span>
          </button>
        ) : (
          <button
            onClick={() => setShowGymPicker(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-gray-200 border-dashed rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Add your gym</span>
          </button>
        )}
      </div>

      {/* Content below gradient - white background */}
      <div className="px-5 pt-4 pb-2 space-y-4 relative z-10">
        {/* Trainer Connection - shown for clients */}
        {trainerInfo && !user.isTrainer && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={trainerInfo.profilePhoto} />
                  <AvatarFallback className="bg-rose-500 text-white">
                    {trainerInfo.displayName?.[0] || 'T'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-gray-500 text-xs">Your Trainer</p>
                  <p className="text-gray-900 font-medium">{trainerInfo.displayName || trainerInfo.username}</p>
                </div>
                <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/30">
                  Connected
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User/Trainer Mode Toggle — only shown for trainers */}
        {user.isTrainer && (
          <div className="flex items-center justify-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200">
            <button
              onClick={() => switchMode('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                user.mode !== 'trainer'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              Athlete
            </button>
            <button
              onClick={() => switchMode('trainer')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                user.mode === 'trainer'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Trainer
            </button>
          </div>
        )}

        {/* Membership Badge */}
        <div className="flex items-center gap-2">
          <Badge className={
            (user.membershipTier || 'pro') === 'pro' || (user.membershipTier || 'pro') === 'trainer'
              ? 'bg-sky-500/10 text-sky-600 border-sky-500/30'
              : 'bg-gray-100 text-gray-500 border-gray-200'
          }>
            <Crown className="w-3 h-3 mr-1" />
            {(user.membershipTier || 'pro') === 'trainer' ? 'Trainer Pro' : (user.membershipTier || 'pro') === 'pro' ? 'Pro Member' : 'Free'}
          </Badge>
        </div>

        {/* Trainer Stats - shown in trainer mode */}
        {isTrainerMode && trainerStats && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              {/* Earnings Row */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">${Math.round(trainerStats.weekEarnings)}</p>
                  <p className="text-xs text-gray-500">This Week</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">${Math.round(trainerStats.monthEarnings)}</p>
                  <p className="text-xs text-gray-500">This Month</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-rose-500">${Math.round(trainerStats.totalEarnings)}</p>
                  <p className="text-xs text-gray-500">Total Paid</p>
                </div>
              </div>
              
              {/* Outstanding Warning */}
              {trainerStats.outstandingAmount > 0 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
                  <span className="text-xs text-amber-600">
                    {trainerStats.totalUnpaidSessions} unpaid session{trainerStats.totalUnpaidSessions !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-bold text-amber-600">
                    ${Math.round(trainerStats.outstandingAmount)} outstanding
                  </span>
                </div>
              )}
              
              {/* Stats Grid - Clickable for medal progress */}
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-100">
                <button 
                  onClick={() => setShowTrainerStatModal('sessions')}
                  className="text-center p-2 -m-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="text-lg font-semibold text-gray-900">{trainerStats.totalSessions}</p>
                  <p className="text-[10px] text-gray-500">Sessions</p>
                </button>
                <button 
                  onClick={() => setShowTrainerStatModal('clients')}
                  className="text-center p-2 -m-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="text-lg font-semibold text-gray-900">{trainerStats.activeClients}</p>
                  <p className="text-[10px] text-gray-500">Clients</p>
                </button>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{trainerStats.avgSessionsPerWeek}</p>
                  <p className="text-[10px] text-gray-500">Avg/wk</p>
                </div>
                <button 
                  onClick={() => setShowTrainerStatModal('revenue')}
                  className="text-center p-2 -m-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="text-lg font-semibold text-gray-900">${trainerStats.avgPerSession}</p>
                  <p className="text-[10px] text-gray-500">Avg/session</p>
                </button>
              </div>
              
              {/* Enhanced Insights */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 mt-3">
                <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900">{trainerStats.collectionRate}%</p>
                  <p className="text-[9px] text-gray-500">Collection Rate</p>
                </div>
                <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900">${trainerStats.revenuePerClient}</p>
                  <p className="text-[9px] text-gray-500">Rev/Client</p>
                </div>
                <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                  <p className={`text-sm font-semibold ${trainerStats.monthlyGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {trainerStats.monthlyGrowth > 0 ? '+' : ''}{trainerStats.monthlyGrowth}%
                  </p>
                  <p className="text-[9px] text-gray-500">Monthly Growth</p>
                </div>
              </div>
              {(trainerStats.bestClient.revenue > 0 || trainerStats.busiestDay) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {trainerStats.bestClient.revenue > 0 && (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">Top Client</p>
                      <p className="text-xs font-semibold text-gray-900 truncate">{trainerStats.bestClient.name}</p>
                      <p className="text-[10px] text-rose-500">${trainerStats.bestClient.revenue} • {trainerStats.bestClient.sessions} sessions</p>
                    </div>
                  )}
                  {trainerStats.busiestDay && (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">Busiest Day</p>
                      <p className="text-xs font-semibold text-gray-900">{trainerStats.busiestDay.day}</p>
                      <p className="text-[10px] text-rose-500">{trainerStats.busiestDay.count} sessions total</p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment History Link */}
              <Button 
                variant="outline" 
                className="w-full mt-3 border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => router.push('/payments')}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                View Payment History
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="px-5 pb-6 space-y-5">
        {/* Achievements Card — shown ABOVE strength rating */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 flex items-center gap-2.5 text-lg">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${isTrainerMode ? 'from-emerald-500 to-teal-600 shadow-emerald-500/20' : 'from-purple-500 to-pink-600 shadow-purple-500/20'} flex items-center justify-center shadow-lg`}>
                  {isTrainerMode ? <Crown className="w-4 h-4 text-white" /> : <Medal className="w-4 h-4 text-white" />}
                </div>
                {isTrainerMode ? 'Trainer Achievements' : 'Achievements'}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-sky-500" onClick={() => router.push('/medals')}>
                See All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {userMedals.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {(sortedMedals.length > 0 ? sortedMedals : userMedals).slice(0, 8).map((medal: any) => {
                  const tierGradient = getMedalTierGradient(medal.tier);
                  const timesEarned = medal.timesEarned || 1;
                  // Color evolution based on times earned
                  const progressColor = timesEarned >= 10 ? 'bg-cyan-400' : 
                                        timesEarned >= 5 ? 'bg-amber-400' : 
                                        timesEarned >= 3 ? 'bg-gray-300' : 
                                        'bg-amber-700';
                  const progressGlow = timesEarned >= 10 ? 'shadow-cyan-400/50' : 
                                       timesEarned >= 5 ? 'shadow-amber-400/50' : 
                                       timesEarned >= 3 ? 'shadow-gray-300/50' : 
                                       'shadow-amber-700/50';
                  return (
                    <div
                      key={medal.id}
                      className={`flex flex-col items-center p-3 rounded-xl relative overflow-hidden transition-all bg-gradient-to-br ${tierGradient}`}
                    >
                      <span className="text-2xl mb-1">
                        {medal.icon}
                      </span>
                      <p className="text-xs text-center line-clamp-1 text-white">
                        {medal.name}
                      </p>
                      {/* Times earned badge */}
                      <div className={`absolute top-1 right-1 w-4 h-4 rounded-full ${progressColor} ${progressGlow} shadow-lg flex items-center justify-center`}>
                        <span className="text-[8px] font-bold text-gray-900">{timesEarned > 99 ? '99+' : timesEarned}</span>
                      </div>
                      {/* Progress bar at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                        <div 
                          className={`h-full ${progressColor} transition-all`}
                          style={{ width: `${Math.min((timesEarned / 10) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">No {isTrainerMode ? 'trainer' : ''} medals yet</p>
                <p className="text-sm text-gray-500">
                  {isTrainerMode 
                    ? 'Grow your client base, conduct sessions, and earn revenue to unlock trainer medals'
                    : 'Complete workouts to earn medals'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pure Strength Rating Card - Circular Progress (hidden in trainer mode) */}
        {!isTrainerMode && (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 flex items-center gap-2.5 text-lg">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                Pure Strength Rating
              </CardTitle>
              {strengthRating && (
                <Badge className={`${getTierBg(strengthRating.tier)} ${getTierColor(strengthRating.tier)} font-semibold px-3`}>
                  {strengthRating.tier.charAt(0).toUpperCase() + strengthRating.tier.slice(1)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Measures your free-weight strength across all major body parts. Each category averages your best barbell, dumbbell, and bodyweight lifts to give a balanced rating.</p>
          </CardHeader>
          <CardContent>
            {strengthRating ? (
              <div className="space-y-5">
                {/* Overall Score - Circular Ring */}
                <div className="flex justify-center py-4">
                  <div className="relative w-32 h-32">
                    <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke={strengthRating.tier === 'elite' ? '#f59e0b' : strengthRating.tier === 'advanced' ? '#a855f7' : strengthRating.tier === 'intermediate' ? '#3b82f6' : strengthRating.tier === 'novice' ? '#0ea5e9' : '#22c55e'} strokeWidth="2.5" opacity="0.2" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none"
                        stroke={strengthRating.tier === 'elite' ? '#f59e0b' : strengthRating.tier === 'advanced' ? '#a855f7' : strengthRating.tier === 'intermediate' ? '#3b82f6' : strengthRating.tier === 'novice' ? '#0ea5e9' : '#22c55e'}
                        strokeWidth="2.5"
                        strokeDasharray={`${(strengthRating.overall / 100) * 97.4} 97.4`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-bold ${getTierColor(strengthRating.tier)}`}>{strengthRating.overall}%</span>
                      <span className="text-[10px] text-slate-500 font-medium">Overall</span>
                    </div>
                  </div>
                </div>

                {/* Category Cards - Circular Progress */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'chest', name: 'Chest', score: strengthRating.categories?.chest?.totalPoints || strengthRating.push, tier: strengthRating.categories?.chest?.tier || strengthRating.tier },
                    { id: 'back', name: 'Back', score: strengthRating.categories?.back?.totalPoints || strengthRating.pull, tier: strengthRating.categories?.back?.tier || strengthRating.tier },
                    { id: 'shoulders', name: 'Shoulders', score: strengthRating.categories?.shoulders?.totalPoints || 0, tier: strengthRating.categories?.shoulders?.tier || 'beginner' },
                    { id: 'legs', name: 'Legs', score: strengthRating.categories?.legs?.totalPoints || strengthRating.legs, tier: strengthRating.categories?.legs?.tier || strengthRating.tier },
                  ].map((cat) => {
                    const strokeColor = cat.tier === 'elite' ? '#f59e0b' : cat.tier === 'advanced' ? '#a855f7' : cat.tier === 'intermediate' ? '#3b82f6' : cat.tier === 'novice' ? '#0ea5e9' : '#22c55e';
                    const scoreVal = typeof cat.score === 'number' ? cat.score : 0;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => router.push(`/profile/strength/${cat.id}`)}
                        className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-200 group border border-gray-200 hover:border-gray-300 flex flex-col items-center"
                      >
                        <div className="relative w-20 h-20 mb-2">
                          <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke={strokeColor} strokeWidth="2.5" opacity="0.15" />
                            <circle
                              cx="18" cy="18" r="15.5" fill="none"
                              stroke={strokeColor}
                              strokeWidth="2.5"
                              strokeDasharray={`${(Math.min(scoreVal, 100) / 100) * 97.4} 97.4`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-lg font-bold ${getTierColor(cat.tier)}`}>{scoreVal.toFixed(0)}%</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 font-medium">{cat.name}</p>
                        <span className={`text-[10px] font-medium ${getTierColor(cat.tier)}`}>
                          {cat.tier?.charAt(0).toUpperCase() + cat.tier?.slice(1)}
                        </span>
                        <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-sky-500 mt-1 transition-colors" />
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-medium">
                    Updated {format(new Date(strengthRating.lastUpdated), 'MMM d')}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-400 hover:text-sky-500 -mr-2"
                    onClick={() => router.push('/exercises')}
                  >
                    <Search className="w-4 h-4 mr-1" />
                    All Exercises
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-700 font-medium mb-1">No strength data yet</p>
                <p className="text-sm text-gray-500">Complete workouts with key lifts to build your rating</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* v10-D5: Weekly Report Preview Card (athlete mode only) */}
        {!isTrainerMode && <WeeklyReportPreviewCard userId={user.id} />}

        {/* Personal Bests - hidden in trainer mode */}
        {!isTrainerMode && (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Personal Bests
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-gray-400">
                See All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {userPBs.length > 0 ? (
              <div className="space-y-3">
                {userPBs.slice(0, 5).map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {pb.exerciseId.replace(/-/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(pb.achievedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-500">{Math.round(pb.oneRepMax)}kg</p>
                      <p className="text-xs text-gray-500">1RM</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-700 mb-1">No personal bests yet</p>
                <p className="text-sm text-gray-500">Start logging workouts to track your PRs</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Recent Workouts - Personal workouts in user mode, Client sessions in trainer mode */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-sky-400" />
                {isTrainerMode ? 'Recent Client Sessions' : 'Recent Workouts'}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-sky-500" onClick={() => router.push(isTrainerMode ? '/clients' : '/workout/history')}>
                See All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isTrainerMode ? (
              // Trainer mode: show recent completed sessions with clients
              sessions.filter(s => s.trainerId === user.id && s.status === 'completed').length > 0 ? (
                <div className="space-y-2">
                  {sessions
                    .filter(s => s.trainerId === user.id && s.status === 'completed')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 5)
                    .map((session) => {
                      const clientName = getClientNameUtil(session.clientId);
                      return (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100"
                          onClick={() => router.push(`/clients/${session.clientId}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{(session as any).title || 'PT Session'}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(session.date), 'MMM d')} • {clientName}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-emerald-500 font-medium text-sm">Completed</p>
                            <p className="text-xs text-gray-500">
                              {session.duration ? `${session.duration}m` : '--'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-700 mb-1">No client sessions yet</p>
                  <p className="text-sm text-gray-500">Complete sessions with clients to see them here</p>
                </div>
              )
            ) : (
              // User mode: show personal workouts (both solo and trainer-led)
              userWorkouts.length > 0 ? (
                <div className="space-y-2">
                  {userWorkouts
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                    .slice(0, 5)
                    .map((workout) => {
                      const isTrainerWorkout = !!workout.assignedBy;
                      return (
                        <div
                          key={workout.id}
                          className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100 border-l-2 ${
                            isTrainerWorkout ? 'border-l-rose-500' : 'border-l-sky-500'
                          }`}
                          onClick={() => router.push(`/workout/${workout.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 text-sm truncate">{workout.name}</p>
                              {isTrainerWorkout ? (
                                <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] px-1.5 py-0">
                                  Trainer
                                </Badge>
                              ) : (
                                <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] px-1.5 py-0">
                                  Solo
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {format(new Date(workout.startTime), 'MMM d')} • {workout.exercises.length} exercises
                              {workout.notes && ' • Has notes'}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className={`${isTrainerWorkout ? 'text-rose-400' : 'text-sky-400'} font-medium text-sm`}>
                              {Math.round(workout.totalVolume).toLocaleString()} kg
                            </p>
                            <p className="text-xs text-gray-500">
                              {workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Dumbbell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-1">No workouts yet</p>
                  <p className="text-sm text-gray-500">Start your first workout to see it here</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Trainer Stats & Graphs - shown in trainer mode */}
        {isTrainerMode && (
          <TrainerStatsCharts 
            sessionPackages={sessionPackages.filter(p => p.trainerId === user.id)}
            sessions={sessions.filter(s => s.trainerId === user.id)}
            clients={clients.filter(c => c.trainerId === user.id)}
            payments={payments.filter(p => p.trainerId === user.id)}
          />
        )}

        {/* Workout Stats & Graphs - shown in athlete mode */}
        {!isTrainerMode && (
          <WorkoutStatsCharts 
            workoutHistory={userWorkouts} 
            personalBests={userPBs} 
          />
        )}

        {/* Account Actions */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-gray-600 hover:bg-gray-50 rounded-none border-b border-gray-200"
              onClick={() => router.push('/settings')}
            >
              <Edit className="w-5 h-5 mr-3 text-gray-500" />
              Edit Profile
              <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-gray-600 hover:bg-gray-50 rounded-none border-b border-gray-200"
              onClick={() => router.push('/workout/history')}
            >
              <Dumbbell className="w-5 h-5 mr-3 text-gray-500" />
              Workout History
              <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
            </Button>
            {user.isTrainer && (
              <Button
                variant="ghost"
                className="w-full justify-start h-14 px-4 text-gray-600 hover:bg-gray-50 rounded-none border-b border-gray-200"
                onClick={() => router.push('/payments')}
              >
                <DollarSign className="w-5 h-5 mr-3 text-gray-500" />
                Payments
                <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
              </Button>
            )}
            {!user.isTrainer && (
              <Button
                variant="ghost"
                className="w-full justify-start h-14 px-4 text-gray-600 hover:bg-gray-50 rounded-none border-b border-gray-200"
                onClick={() => {
                  updateUser({ isTrainer: true, mode: 'trainer' });
                  toast.success('Upgraded to trainer! Redirecting...');
                  setTimeout(() => {
                    window.location.href = '/clients';
                  }, 500);
                }}
              >
                <Users className="w-5 h-5 mr-3 text-gray-500" />
                Upgrade to Trainer
                <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-red-400 hover:bg-red-500/10 rounded-none"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Profile Card Popup */}
      <Dialog open={showProfileCard} onOpenChange={setShowProfileCard}>
        <DialogContent className="bg-transparent border-none shadow-none max-w-md p-0">
          <ProfileCardV2
            user={user}
            medals={userMedals}
            strengthRating={strengthRating}
            stats={{
              totalWorkouts,
              totalVolume,
              followers: actualFollowers.length,
              following: actualFollowing.length,
            }}
            isOwnProfile={true}
            isFriend={false}
            onClose={() => setShowProfileCard(false)}
            onShare={() => {
              navigator.clipboard?.writeText(window.location.href);
            }}
            onUpdateUser={updateUser}
          />
        </DialogContent>
      </Dialog>

      {/* Followers Modal */}
      <Dialog open={showFollowersModal} onOpenChange={setShowFollowersModal}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Followers</h2>
            {actualFollowers.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No followers yet</p>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {actualFollowers.map((followerId: string) => {
                    const followerUser = allUsers.find((u: any) => u.id === followerId);
                    const client = clients.find(c => c.clientId === followerId);
                    return (
                      <div key={followerId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={followerUser?.profilePhoto} />
                          <AvatarFallback className="bg-sky-500 text-white">
                            {followerUser?.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-white">{followerUser?.displayName || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">
                            {client ? 'Client' : 'Follower'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {client && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-sky-500 text-sky-400"
                              onClick={() => {
                                setShowFollowersModal(false);
                                router.push(`/clients/${followerId}`);
                              }}
                            >
                              View
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-red-500 text-red-400 hover:bg-red-500/20"
                            onClick={() => {
                              removeClient(followerId);
                              // Also refresh allUsers
                              const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
                              setAllUsers(stored);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Following Modal */}
      <Dialog open={showFollowingModal} onOpenChange={setShowFollowingModal}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Following</h2>
            {actualFollowing.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Not following anyone</p>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {actualFollowing.map((followingId: string) => {
                    const followingUser = allUsers.find((u: any) => u.id === followingId);
                    return (
                      <div key={followingId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={followingUser?.profilePhoto} />
                          <AvatarFallback className="bg-rose-500 text-white">
                            {followingUser?.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-white">{followingUser?.displayName || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">
                            {followingUser?.isTrainer ? 'Trainer' : 'User'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Trainer Stats Medal Progress Modal */}
      <Dialog open={showTrainerStatModal !== null} onOpenChange={(open) => !open && setShowTrainerStatModal(null)}>
        <DialogContent className="bg-white border-gray-200 shadow-sm max-w-md">
          <div className="space-y-4">
            {showTrainerStatModal === 'clients' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Client Milestones</h2>
                    <p className="text-sm text-gray-400">{trainerStats?.activeClients || 0} total clients</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { id: 'trainer-first-client', target: 1, name: 'First Client', icon: '👤' },
                    { id: 'trainer-5-clients', target: 5, name: 'Growing Roster', icon: '👥' },
                    { id: 'trainer-10-clients', target: 10, name: 'Popular Trainer', icon: '🌟' },
                    { id: 'trainer-25-clients', target: 25, name: 'Client Magnet', icon: '💫' },
                    { id: 'trainer-50-clients', target: 50, name: 'Training Empire', icon: '👑' },
                  ].map((milestone) => {
                    const current = trainerStats?.activeClients || 0;
                    const earned = current >= milestone.target;
                    const progress = Math.min((current / milestone.target) * 100, 100);
                    return (
                      <div key={milestone.id} className={`p-3 rounded-lg ${earned ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{milestone.icon}</span>
                            <span className={`font-medium ${earned ? 'text-emerald-400' : 'text-white'}`}>{milestone.name}</span>
                          </div>
                          <span className={`text-sm ${earned ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {current}/{milestone.target}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {showTrainerStatModal === 'sessions' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Session Milestones</h2>
                    <p className="text-sm text-gray-400">{trainerStats?.totalSessions || 0} total sessions</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { id: 'trainer-first-session', target: 1, name: 'Session One', icon: '🎯' },
                    { id: 'trainer-25-sessions', target: 25, name: 'Session Pro', icon: '📋' },
                    { id: 'trainer-100-sessions', target: 100, name: 'Session Master', icon: '🏆' },
                    { id: 'trainer-500-sessions', target: 500, name: 'Session Legend', icon: '⭐' },
                    { id: 'trainer-1000-sessions', target: 1000, name: 'Session God', icon: '💎' },
                  ].map((milestone) => {
                    const current = trainerStats?.totalSessions || 0;
                    const earned = current >= milestone.target;
                    const progress = Math.min((current / milestone.target) * 100, 100);
                    return (
                      <div key={milestone.id} className={`p-3 rounded-lg ${earned ? 'bg-sky-500/20 border border-sky-500/30' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{milestone.icon}</span>
                            <span className={`font-medium ${earned ? 'text-sky-400' : 'text-white'}`}>{milestone.name}</span>
                          </div>
                          <span className={`text-sm ${earned ? 'text-sky-400' : 'text-gray-400'}`}>
                            {current}/{milestone.target}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {showTrainerStatModal === 'revenue' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Revenue Milestones</h2>
                    <p className="text-sm text-gray-400">${Math.round(trainerStats?.totalEarnings || 0)} total earned</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { id: 'trainer-first-payment', target: 1, name: 'First Dollar', icon: '💵' },
                    { id: 'trainer-500-revenue', target: 500, name: 'Side Hustle', icon: '💰' },
                    { id: 'trainer-2500-revenue', target: 2500, name: 'Part Timer', icon: '💳' },
                    { id: 'trainer-10000-revenue', target: 10000, name: 'Full Timer', icon: '🤑' },
                    { id: 'trainer-50000-revenue', target: 50000, name: 'Fitness Mogul', icon: '💎' },
                  ].map((milestone) => {
                    const current = trainerStats?.totalEarnings || 0;
                    const earned = current >= milestone.target;
                    const progress = Math.min((current / milestone.target) * 100, 100);
                    return (
                      <div key={milestone.id} className={`p-3 rounded-lg ${earned ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{milestone.icon}</span>
                            <span className={`font-medium ${earned ? 'text-amber-400' : 'text-white'}`}>{milestone.name}</span>
                          </div>
                          <span className={`text-sm ${earned ? 'text-amber-400' : 'text-gray-400'}`}>
                            ${Math.round(current)}/${milestone.target}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <Button 
              variant="outline" 
              className="w-full border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => {
                setShowTrainerStatModal(null);
                router.push('/medals');
              }}
            >
              <Medal className="w-4 h-4 mr-2" />
              View All Medals
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Gym Picker Dialog */}
      <Dialog open={showGymPicker} onOpenChange={setShowGymPicker}>
        <DialogContent className="bg-white border-gray-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-sky-500" />
              {user.gymName ? 'Change Gym' : 'Add Your Gym'}
            </DialogTitle>
            <DialogDescription>Search for your gym or add a new one</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <Input
              value={gymSearchText}
              onChange={(e) => setGymSearchText(e.target.value)}
              placeholder="Search or type gym name..."
              className="bg-gray-50 border-gray-200 text-gray-900"
              autoFocus
            />
            
            {gymSearchText.trim() && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {gyms
                  .filter((g: any) => g.name.toLowerCase().includes(gymSearchText.toLowerCase()))
                  .slice(0, 5)
                  .map((g: any) => (
                    <button
                      key={g.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-900 flex items-center gap-2 border border-gray-100"
                      onClick={() => handleSelectGym(g.name)}
                    >
                      <Dumbbell className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      <span>{g.name}</span>
                    </button>
                  ))}
                {!gyms.some((g: any) => g.name.toLowerCase() === gymSearchText.toLowerCase()) && gymSearchText.trim() && (
                  <button
                    className="w-full text-left px-3 py-2.5 hover:bg-sky-50 rounded-lg text-sm text-sky-600 flex items-center gap-2 border border-sky-100 bg-sky-50/50"
                    onClick={() => handleAddGym(gymSearchText)}
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span>Add &quot;{gymSearchText.trim()}&quot;</span>
                  </button>
                )}
              </div>
            )}

            {user.gymName && (
              <Button
                variant="outline"
                className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                onClick={handleRemoveGym}
              >
                <X className="w-4 h-4 mr-2" />
                Remove Gym
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
