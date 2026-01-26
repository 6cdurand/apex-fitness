'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useMedalStore, useSocialStore, useTrainerStore } from '@/lib/store';
import { sortMedalsByPriority, getMedalDefinition } from '@/lib/medals';
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
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ProfileCard } from '@/components/ProfileCard';
import { WorkoutStatsCharts } from '@/components/WorkoutStatsCharts';
import { TrainerStatsCharts } from '@/components/TrainerStatsCharts';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, switchMode, updateUser } = useAuthStore();
  const { workoutHistory, personalBests } = useWorkoutStore();
  const { medals, strengthRating, calculateStrengthRating } = useMedalStore();
  const { posts } = useSocialStore();
  const { clients, removeClient, clearAllData, sessions, sessionPackages, payments } = useTrainerStore();
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    calculateStrengthRating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalBests]);

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

  const handleLogout = () => {
    router.replace('/auth');
    // Delay logout to allow redirect to complete first
    setTimeout(() => logout(), 100);
  };

  const handleSwitchMode = () => {
    const newMode = user?.mode === 'trainer' ? 'user' : 'trainer';
    switchMode(newMode);
  };

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
  const sortedMedals = useMemo(() => {
    if (!user?.id) return [];
    const earnedMedals = medals.filter((m: any) => m.earned && m.userId === user.id);
    // Get definitions for sorting
    const medalsWithDefs = earnedMedals.map((m: any) => {
      const def = getMedalDefinition(m.definitionId || m.id);
      return { ...m, ...def };
    }).filter((m: any) => m.category); // Only include medals with valid definitions
    
    return sortMedalsByPriority(medalsWithDefs);
  }, [medals, user?.id]);

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
  const trainerConductedWorkouts = workoutHistory.filter(w => w.assignedBy === user.id);
  const userOwnWorkouts = workoutHistory.filter(w => w.userId === user.id && !w.assignedBy);
  
  // Total workouts: trainer sees sessions conducted, user sees own workouts
  const userWorkouts = isTrainerMode ? trainerConductedWorkouts : userOwnWorkouts;
  const totalWorkouts = userWorkouts.length;
  const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
  const userPosts = posts.filter(p => p.userId === user.id);
  
  // Filter personal bests for current user only
  const userPBs = personalBests.filter(pb => pb.userId === user.id);
  
  // Filter medals for current user only - must be earned AND belong to user
  const userMedals = medals.filter((m: any) => m.userId === user.id && m.earned === true);
  
  // Trainer stats calculation - uses actual payment data from packages
  const trainerStats = useMemo(() => {
    if (!user?.id || user.mode !== 'trainer') return null;
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Filter sessions for this trainer
    const trainerSessions = sessions.filter(s => s.trainerId === user.id);
    const completedSessions = trainerSessions.filter(s => s.status === 'completed');
    const weekSessions = completedSessions.filter(s => new Date(s.date) >= oneWeekAgo);
    const monthSessions = completedSessions.filter(s => new Date(s.date) >= oneMonthAgo);
    
    // Get all trainer packages
    const trainerPackages = sessionPackages.filter(p => p.trainerId === user.id);
    
    // Calculate ACTUAL earnings from paidSessions in packages
    const totalPaidSessions = trainerPackages.reduce((sum, p) => sum + (p.paidSessions || 0), 0);
    const totalEarnings = trainerPackages.reduce((sum, p) => 
      sum + ((p.paidSessions || 0) * (p.pricePerSession || 0)), 0);
    
    // Calculate total used sessions (completed)
    const totalUsedSessions = trainerPackages.reduce((sum, p) => sum + (p.usedSessions || 0), 0);
    
    // Outstanding amount (sessions done but not paid)
    const outstandingAmount = trainerPackages.reduce((sum, p) => {
      const unpaid = Math.max(0, (p.usedSessions || 0) - (p.paidSessions || 0));
      return sum + (unpaid * (p.pricePerSession || 0));
    }, 0);
    
    // Get average price per session from packages
    const avgPricePerSession = trainerPackages.length > 0
      ? trainerPackages.reduce((sum, p) => sum + (p.pricePerSession || 0), 0) / trainerPackages.length
      : 0;
    
    // Week/month earnings estimate based on sessions
    const weekEarnings = weekSessions.length * avgPricePerSession;
    const monthEarnings = monthSessions.length * avgPricePerSession;
    
    // Calculate averages
    const activeClients = clients.filter(c => c.trainerId === user.id && c.status === 'active').length;
    const avgSessionsPerWeek = monthSessions.length / 4; // Average over 4 weeks
    const avgPerSession = totalPaidSessions > 0 
      ? totalEarnings / totalPaidSessions 
      : avgPricePerSession;
    
    return {
      totalSessions: totalUsedSessions || completedSessions.length,
      weekSessions: weekSessions.length,
      monthSessions: monthSessions.length,
      totalEarnings,
      weekEarnings,
      monthEarnings,
      activeClients,
      avgSessionsPerWeek: avgSessionsPerWeek.toFixed(1),
      avgPerSession: avgPerSession.toFixed(0),
      outstandingAmount,
      totalPaidSessions,
      totalUnpaidSessions: Math.max(0, totalUsedSessions - totalPaidSessions),
    };
  }, [user, sessions, sessionPackages, clients]);
  

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'elite': return 'text-amber-400';
      case 'advanced': return 'text-purple-400';
      case 'intermediate': return 'text-blue-400';
      case 'novice': return 'text-emerald-400';
      default: return 'text-gray-400';
    }
  };

  const getTierBg = (tier?: string) => {
    switch (tier) {
      case 'elite': return 'bg-amber-500/20';
      case 'advanced': return 'bg-purple-500/20';
      case 'intermediate': return 'bg-blue-500/20';
      case 'novice': return 'bg-emerald-500/20';
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
      <div className="bg-gradient-to-b from-emerald-500 to-gray-950 pt-12 pb-20 px-4">
        {/* Profile Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowProfileCard(true)} className="relative group">
              <Avatar className="w-20 h-20 border-4 border-white/20 group-hover:border-emerald-400 transition-colors">
                <AvatarImage src={user.profilePhoto} />
                <AvatarFallback className="text-2xl bg-gray-800 text-white">
                  {user.displayName?.[0]?.toUpperCase() || user.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">View Card</span>
              </div>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{user.displayName || user.username}</h1>
                {user.isVerifiedTrainer && (
                  <BadgeCheck className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-white/70">@{user.username}</p>
                {user.gender && user.gender !== 'other' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">
                    {user.gender}
                  </span>
                )}
              </div>
              {user.bio && (
                <p className="text-white/60 text-sm mt-1">{user.bio}</p>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => router.push('/settings')}
            className="text-white hover:bg-white/10"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{totalWorkouts}</p>
            <p className="text-xs text-white/60">Workouts</p>
          </div>
          <div 
            className="text-center cursor-pointer hover:bg-white/10 rounded-lg p-2 -m-2 transition-colors"
            onClick={() => setShowFollowersModal(true)}
          >
            <p className="text-2xl font-bold text-white">{actualFollowers.length}</p>
            <p className="text-xs text-white/60">Followers</p>
          </div>
          <div 
            className="text-center cursor-pointer hover:bg-white/10 rounded-lg p-2 -m-2 transition-colors"
            onClick={() => setShowFollowingModal(true)}
          >
            <p className="text-2xl font-bold text-white">{actualFollowing.length}</p>
            <p className="text-xs text-white/60">Following</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{userMedals.length}</p>
            <p className="text-xs text-white/60">Medals</p>
          </div>
        </div>

        {/* Trainer Connection - shown for clients */}
        {trainerInfo && !user.isTrainer && (
          <Card className="bg-white/10 border-white/20 mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={trainerInfo.profilePhoto} />
                  <AvatarFallback className="bg-rose-500 text-white">
                    {trainerInfo.displayName?.[0] || 'T'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-white/60 text-xs">Your Trainer</p>
                  <p className="text-white font-medium">{trainerInfo.displayName || trainerInfo.username}</p>
                </div>
                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">
                  Connected
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mode Switch */}
        {user.isTrainer && (
          <Button
            onClick={handleSwitchMode}
            variant="outline"
            className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 mb-4"
          >
            {isTrainerMode ? (
              <>
                <Dumbbell className="w-4 h-4 mr-2" />
                Switch to User Mode
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Switch to Trainer Mode
              </>
            )}
          </Button>
        )}

        {/* Trainer Stats - shown in trainer mode */}
        {isTrainerMode && trainerStats && (
          <Card className="bg-white/10 border-white/20">
            <CardContent className="p-4">
              {/* Earnings Row */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">${Math.round(trainerStats.weekEarnings)}</p>
                  <p className="text-xs text-white/60">This Week</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">${Math.round(trainerStats.monthEarnings)}</p>
                  <p className="text-xs text-white/60">This Month</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">${Math.round(trainerStats.totalEarnings)}</p>
                  <p className="text-xs text-white/60">Total Paid</p>
                </div>
              </div>
              
              {/* Outstanding Warning */}
              {trainerStats.outstandingAmount > 0 && (
                <div className="mb-3 p-2 bg-amber-500/20 rounded-lg flex justify-between items-center">
                  <span className="text-xs text-amber-300">
                    {trainerStats.totalUnpaidSessions} unpaid session{trainerStats.totalUnpaidSessions !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    ${Math.round(trainerStats.outstandingAmount)} outstanding
                  </span>
                </div>
              )}
              
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/10">
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{trainerStats.totalSessions}</p>
                  <p className="text-[10px] text-white/50">Sessions</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{trainerStats.activeClients}</p>
                  <p className="text-[10px] text-white/50">Clients</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{trainerStats.avgSessionsPerWeek}</p>
                  <p className="text-[10px] text-white/50">Avg/wk</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">${trainerStats.avgPerSession}</p>
                  <p className="text-[10px] text-white/50">Avg/session</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="px-4 -mt-16 pb-6 space-y-4">
        {/* Strength Rating Card */}
        <Card className="bg-gray-900 border-gray-800 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Strength Rating
              </CardTitle>
              {strengthRating && (
                <Badge className={`${getTierBg(strengthRating.tier)} ${getTierColor(strengthRating.tier)}`}>
                  {strengthRating.tier.charAt(0).toUpperCase() + strengthRating.tier.slice(1)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {strengthRating ? (
              <div className="space-y-4">
                {/* Overall Score */}
                <div className="text-center py-4">
                  <p className={`text-5xl font-bold ${getTierColor(strengthRating.tier)}`}>
                    {strengthRating.overall}%
                  </p>
                  <p className="text-gray-500 text-sm mt-1">Overall Score</p>
                </div>

                {/* Category Cards - Clickable for Enhanced View */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'chest', name: 'Chest', icon: '💪', score: strengthRating.categories?.chest?.totalPoints || strengthRating.push, tier: strengthRating.categories?.chest?.tier || strengthRating.tier },
                    { id: 'back', name: 'Back', icon: '🔙', score: strengthRating.categories?.back?.totalPoints || strengthRating.pull, tier: strengthRating.categories?.back?.tier || strengthRating.tier },
                    { id: 'shoulders', name: 'Shoulders', icon: '🎯', score: strengthRating.categories?.shoulders?.totalPoints || 0, tier: strengthRating.categories?.shoulders?.tier || 'beginner' },
                    { id: 'legs', name: 'Legs', icon: '🦵', score: strengthRating.categories?.legs?.totalPoints || strengthRating.legs, tier: strengthRating.categories?.legs?.tier || strengthRating.tier },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => router.push(`/profile/strength/${cat.id}`)}
                      className="p-3 bg-gray-800 rounded-xl text-left hover:bg-gray-750 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl">{cat.icon}</span>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <p className="text-sm text-gray-400">{cat.name}</p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold ${getTierColor(cat.tier)}`}>
                          {typeof cat.score === 'number' ? cat.score.toFixed(1) : '0'}%
                        </span>
                        <span className={`text-xs ${getTierColor(cat.tier)}`}>
                          {cat.tier?.charAt(0).toUpperCase() + cat.tier?.slice(1)}
                        </span>
                      </div>
                      <Progress value={Math.min(cat.score || 0, 100)} className="h-1.5 mt-2" />
                    </button>
                  ))}
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Tap a category for enhanced view • Updated: {format(new Date(strengthRating.lastUpdated), 'MMM d')}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">No strength data yet</p>
                <p className="text-sm text-gray-500">Complete workouts with key lifts to build your rating</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medals Card */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-400" />
                Medals & Achievements
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => router.push('/medals')}>
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
                      <div className="absolute top-1 right-1">
                        <BadgeCheck className="w-3 h-3 text-white/80" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">No medals yet</p>
                <p className="text-sm text-gray-500">Complete workouts to earn medals</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal Bests */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
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
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white capitalize">
                        {pb.exerciseId.replace(/-/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(pb.achievedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-400">{Math.round(pb.oneRepMax)}kg</p>
                      <p className="text-xs text-gray-500">1RM</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">No personal bests yet</p>
                <p className="text-sm text-gray-500">Start logging workouts to track your PRs</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Workouts */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
                Recent Workouts
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => router.push('/workout')}>
                See All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {userWorkouts.length > 0 ? (
              <div className="space-y-2">
                {userWorkouts
                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                  .slice(0, 5)
                  .map((workout) => (
                    <div
                      key={workout.id}
                      className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors"
                      onClick={() => router.push(`/workout/${workout.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{workout.name}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(workout.startTime), 'MMM d')} • {workout.exercises.length} exercises
                          {workout.notes && ' • Has notes'}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-emerald-400 font-medium text-sm">
                          {Math.round(workout.totalVolume).toLocaleString()} kg
                        </p>
                        <p className="text-xs text-gray-500">
                          {workout.duration ? `${Math.floor(workout.duration / 60)}m` : '--'}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Dumbbell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-1">No workouts yet</p>
                <p className="text-sm text-gray-500">Start your first workout to see it here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trainer Stats & Graphs - shown in trainer mode */}
        {isTrainerMode && (
          <TrainerStatsCharts 
            sessionPackages={sessionPackages.filter(p => p.trainerId === user.id)}
            sessions={sessions.filter(s => s.trainerId === user.id)}
            clients={clients.filter(c => c.trainerId === user.id)}
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
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-4 text-gray-300 hover:bg-gray-800 rounded-none border-b border-gray-800"
              onClick={() => router.push('/settings')}
            >
              <Edit className="w-5 h-5 mr-3 text-gray-500" />
              Edit Profile
              <ChevronRight className="w-5 h-5 ml-auto text-gray-500" />
            </Button>
            {!user.isTrainer && (
              <Button
                variant="ghost"
                className="w-full justify-start h-14 px-4 text-gray-300 hover:bg-gray-800 rounded-none border-b border-gray-800"
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
          <ProfileCard
            user={user}
            medals={userMedals}
            strengthRating={strengthRating}
            personalBests={userPBs}
            stats={{
              totalWorkouts,
              totalVolume,
              followers: actualFollowers.length,
              following: actualFollowing.length,
            }}
            isOwnProfile={true}
            isFriend={false}
            onShare={() => {
              navigator.clipboard?.writeText(window.location.href);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Followers Modal */}
      <Dialog open={showFollowersModal} onOpenChange={setShowFollowersModal}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Followers</h2>
            {actualFollowers.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No followers yet</p>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {actualFollowers.map((followerId: string) => {
                    const followerUser = allUsers.find((u: any) => u.id === followerId);
                    const client = clients.find(c => c.clientId === followerId);
                    return (
                      <div key={followerId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={followerUser?.profilePhoto} />
                          <AvatarFallback className="bg-emerald-500 text-white">
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
                              className="border-emerald-500 text-emerald-400"
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
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Following</h2>
            {actualFollowing.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Not following anyone</p>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3">
                  {actualFollowing.map((followingId: string) => {
                    const followingUser = allUsers.find((u: any) => u.id === followingId);
                    return (
                      <div key={followingId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800">
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
    </MainLayout>
  );
}
