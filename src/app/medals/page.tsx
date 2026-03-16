'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useMedalStore, useWorkoutStore, useTrainerStore } from '@/lib/store';
import { evolvingMedals, getEvolutionGlowClass, getEvolutionFrameClass, getEvolutionLabel, isCloseToEvolving, getNextEvolutionThreshold, isTrainerMedal } from '@/lib/medals';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck, Lock, Trophy, Flame, Dumbbell, Users, Star, Sparkles } from 'lucide-react';

export default function MedalsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { medals, evolvingMedalProgress } = useMedalStore();
  const { workoutHistory, personalBests } = useWorkoutStore();
  const { clients, sessions, payments } = useTrainerStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Determine trainer mode from user
  const isTrainerMode = user?.mode === 'trainer';

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  // Calculate evolving medal progress - FILTERED BY CURRENT USER ID
  const evolvingMedalData = useMemo(() => {
    // Only count workouts and PBs belonging to the current user
    const userWorkouts = workoutHistory.filter(w => w.userId === user?.id);
    const userPBs = personalBests.filter(pb => pb.userId === user?.id);
    
    const totalWorkouts = userWorkouts.length;
    const totalVolume = userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const totalPRs = userPBs.length;
    const followers = user?.following?.length || 0;
    
    return evolvingMedals.map(medal => {
      let currentProgress = 0;
      
      switch (medal.id) {
        case 'workout-warrior':
          currentProgress = totalWorkouts;
          break;
        case 'iron-lifter':
          currentProgress = totalVolume;
          break;
        case 'pr-collector':
          currentProgress = totalPRs;
          break;
        case 'community-builder':
          currentProgress = followers;
          break;
        case 'streak-master':
          currentProgress = evolvingMedalProgress[medal.id] || 0;
          break;
        default:
          currentProgress = evolvingMedalProgress[medal.id] || 0;
      }
      
      // Find current tier and next tier
      let currentTier = null;
      let nextTier = null;
      let currentTierIndex = -1;
      
      for (let i = medal.evolutions.length - 1; i >= 0; i--) {
        if (currentProgress >= medal.evolutions[i].target) {
          currentTier = medal.evolutions[i];
          currentTierIndex = i;
          if (i < medal.evolutions.length - 1) {
            nextTier = medal.evolutions[i + 1];
          }
          break;
        }
      }
      
      if (!currentTier && medal.evolutions.length > 0) {
        nextTier = medal.evolutions[0];
      }
      
      const previousTarget = currentTier?.target || 0;
      const nextTarget = nextTier?.target || currentTier?.target || 1;
      const progressPercent = nextTier 
        ? ((currentProgress - previousTarget) / (nextTarget - previousTarget)) * 100
        : 100;
      
      return {
        ...medal,
        currentProgress,
        currentTier,
        currentTierIndex,
        nextTier,
        nextTarget: nextTier?.target || 0,
        progressPercent: Math.min(Math.max(progressPercent, 0), 100),
        isMaxed: !nextTier && currentTier !== null,
      };
    });
  }, [workoutHistory, personalBests, user, evolvingMedalProgress]);

  // Format large numbers
  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  if (!isAuthenticated || !user) return null;

  // Different categories for trainer vs athlete mode
  const trainerCategories = [
    { id: 'all', label: 'All', icon: Trophy },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'sessions', label: 'Sessions', icon: Dumbbell },
    { id: 'revenue', label: 'Revenue', icon: Star },
  ];

  const athleteCategories = [
    { id: 'all', label: 'All', icon: Trophy },
    { id: 'workout', label: 'Workout', icon: Dumbbell },
    { id: 'strength', label: 'Strength', icon: Flame },
    { id: 'cardio', label: 'Cardio', icon: Flame },
    { id: 'circuit', label: 'Circuit', icon: Sparkles },
    { id: 'stretch', label: 'Stretch', icon: Star },
    { id: 'consistency', label: 'Streak', icon: Sparkles },
    { id: 'milestone', label: 'Volume', icon: Star },
  ];

  const categories = isTrainerMode ? trainerCategories : athleteCategories;

  // Filter medals by user AND by mode (trainer medals vs athlete medals)
  const userMedals = medals.filter((m: any) => {
    if (m.userId !== user?.id) return false;
    // In trainer mode, only show trainer category medals
    if (isTrainerMode) return m.category === 'trainer';
    // In athlete mode, exclude trainer medals
    return m.category !== 'trainer';
  });
  
  const filteredMedals = selectedCategory === 'all' 
    ? userMedals 
    : userMedals.filter((m: any) => {
        // For trainer mode, map category to subcategory
        if (isTrainerMode) {
          if (selectedCategory === 'clients') return m.definitionId?.includes('client');
          if (selectedCategory === 'sessions') return m.definitionId?.includes('session');
          if (selectedCategory === 'revenue') return m.definitionId?.includes('revenue');
        }
        return m.category === selectedCategory;
      });

  const earnedCount = userMedals.filter((m: any) => m.earned).length;
  const totalCount = userMedals.length || 1; // Avoid division by zero

  const getTierGradient = (tier: string, earned: boolean) => {
    if (!earned) return 'from-gray-800 to-gray-900';
    switch (tier) {
      case 'diamond': return 'from-purple-600 to-blue-600';
      case 'platinum': return 'from-cyan-500 to-cyan-700';
      case 'gold': return 'from-yellow-500 to-amber-600';
      case 'silver': return 'from-gray-400 to-gray-600';
      case 'bronze': return 'from-amber-700 to-amber-900';
      default: return 'from-gray-700 to-gray-800';
    }
  };

  const getTierBorder = (tier: string, earned: boolean) => {
    if (!earned) return 'border-gray-200';
    switch (tier) {
      case 'diamond': return 'border-purple-500';
      case 'platinum': return 'border-cyan-400';
      case 'gold': return 'border-yellow-500';
      case 'silver': return 'border-gray-400';
      case 'bronze': return 'border-amber-700';
      default: return 'border-gray-600';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'diamond': return { text: 'DIAMOND', color: 'text-purple-400 bg-purple-500/20' };
      case 'platinum': return { text: 'PLATINUM', color: 'text-cyan-400 bg-cyan-500/20' };
      case 'gold': return { text: 'GOLD', color: 'text-yellow-500 bg-yellow-500/20' };
      case 'silver': return { text: 'SILVER', color: 'text-gray-400 bg-gray-500/20' };
      case 'bronze': return { text: 'BRONZE', color: 'text-amber-600 bg-amber-500/20' };
      default: return { text: '', color: '' };
    }
  };

  return (
    <MainLayout>
      <PageHeader title="Medals & Achievements" showBack />
      
      <div className="px-4 py-6 space-y-6">
        {/* Progress Summary */}
        <Card className="bg-gradient-to-br from-sky-600 to-sky-800 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{earnedCount} / {totalCount}</h2>
                <p className="text-sky-100">Medals Earned</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
            </div>
            <Progress value={(earnedCount / totalCount) * 100} className="h-3 bg-sky-900" />
            <p className="text-sm text-sky-200 mt-2">
              {Math.round((earnedCount / totalCount) * 100)}% complete
            </p>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  isActive 
                    ? 'bg-sky-500 text-white' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Evolving Medals - Only show in athlete mode */}
        {!isTrainerMode && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {evolvingMedalData
            .filter(m => selectedCategory === 'all' || m.category === selectedCategory)
            .map((medal) => {
            const currentTierName = medal.currentTier?.tier || 'none';
            const nextTierName = medal.nextTier?.tier;
            const nextTierColor = nextTierName === 'bronze' ? 'bg-amber-600' :
                                  nextTierName === 'silver' ? 'bg-gray-400' : 
                                  nextTierName === 'gold' ? 'bg-yellow-500' : 
                                  nextTierName === 'platinum' ? 'bg-cyan-400' : 
                                  nextTierName === 'diamond' ? 'bg-purple-500' : 'bg-sky-500';
            const tierLabel = getTierLabel(currentTierName);
            const hasEarned = medal.currentTier !== null;
            
            return (
              <Card 
                key={medal.id} 
                className={`overflow-hidden border-2 ${getTierBorder(currentTierName, hasEarned)}`}
              >
                <div className={`bg-gradient-to-br ${getTierGradient(currentTierName, hasEarned)} p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-3xl">{medal.icon}</span>
                    {hasEarned && <BadgeCheck className="w-5 h-5 text-sky-400" />}
                  </div>
                  
                  <h3 className="font-bold text-white text-sm mb-1">{medal.name}</h3>
                  
                  {tierLabel.text && (
                    <Badge className={`${tierLabel.color} text-[10px] mb-2`}>
                      {tierLabel.text}
                    </Badge>
                  )}
                  
                  {/* Evolution Progress Bar */}
                  <div className="mt-3 p-2 bg-black/40 rounded-lg">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white font-medium">
                        {medal.nextTier ? `→ ${nextTierName?.charAt(0).toUpperCase()}${nextTierName?.slice(1)}` : '✓ MAX'}
                      </span>
                      <span className="text-white font-bold">
                        {formatNumber(medal.currentProgress)} / {formatNumber(medal.nextTarget || medal.currentTier?.target || 0)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                      <div 
                        className={`h-full rounded-full transition-all ${medal.isMaxed ? 'bg-purple-500' : nextTierColor}`}
                        style={{ width: `${Math.max(medal.progressPercent, 5)}%` }}
                      />
                    </div>
                    {medal.nextTier && (
                      <p className="text-[10px] text-white/60 mt-1">{medal.nextTier.requirement}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        )}

        {/* Almost Evolved Section */}
        {(() => {
          const almostEvolvedMedals = filteredMedals.filter((m: any) => {
            if (!m.earned) return false;
            const evoCheck = isCloseToEvolving(m.timesEarned || 1, m.definitionId);
            return evoCheck.close;
          });
          if (almostEvolvedMedals.length === 0) return null;
          return (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Almost Evolved</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {almostEvolvedMedals.map((medal: any) => {
                  const evoCheck = isCloseToEvolving(medal.timesEarned || 1, medal.definitionId);
                  const glowClass = getEvolutionGlowClass(medal.evolutionTier || 'base');
                  const frameClass = getEvolutionFrameClass(medal.evolutionTier || 'base');
                  return (
                    <div key={medal.id} className="flex-shrink-0 w-24 text-center">
                      <div className={`relative w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-gradient-to-br ${getTierGradient(medal.tier, true)} ${glowClass} ${frameClass}`}>
                        <span className="text-2xl">{medal.icon}</span>
                        <span className="medal-counter">{medal.timesEarned || 1}x</span>
                      </div>
                      <p className="text-[10px] text-foreground mt-1.5 font-medium truncate">{medal.name}</p>
                      <p className="text-[10px] text-muted-foreground">{evoCheck.remaining} more to evolve</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Regular Medals Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredMedals.map((medal: any) => {
            const isEarned = medal.earned;
            const tierLabel = getTierLabel(medal.tier);
            const progress = medal.target ? (medal.progress / medal.target) * 100 : 0;
            const glowClass = isEarned ? getEvolutionGlowClass(medal.evolutionTier || 'base') : '';
            const frameClass = isEarned ? getEvolutionFrameClass(medal.evolutionTier || 'base') : '';
            const evoLabel = isEarned && medal.evolutionTier && medal.evolutionTier !== 'base' ? getEvolutionLabel(medal.evolutionTier) : '';
            
            return (
              <Card 
                key={medal.id} 
                className={`overflow-hidden border-2 ${getTierBorder(medal.tier, isEarned)} ${
                  isEarned ? '' : 'opacity-60'
                } ${frameClass}`}
              >
                <div className={`bg-gradient-to-br ${getTierGradient(medal.tier, isEarned)} p-4`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`relative ${glowClass} rounded-full p-1`}>
                      <span className={`text-4xl ${!isEarned ? 'grayscale' : ''}`}>
                        {medal.icon}
                      </span>
                      {/* Always show counter badge on earned medals */}
                      {isEarned && (medal.timesEarned || 1) > 0 && (
                        <span className="medal-counter">{medal.timesEarned || 1}x</span>
                      )}
                    </div>
                    {isEarned ? (
                      <BadgeCheck className="w-5 h-5 text-sky-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  
                  <h3 className={`font-bold mb-1 ${isEarned ? 'text-white' : 'text-gray-400'}`}>
                    {medal.name}
                  </h3>
                  <p className={`text-xs mb-3 line-clamp-2 ${isEarned ? 'text-white/70' : 'text-gray-500'}`}>
                    {medal.description}
                  </p>
                  
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {tierLabel.text && (
                      <Badge className={`${tierLabel.color} text-[10px]`}>
                        {tierLabel.text}
                      </Badge>
                    )}
                    {evoLabel && (
                      <Badge className="text-[10px] bg-white/20 text-white">
                        {evoLabel}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Evolution progress for earned medals */}
                  {isEarned && (() => {
                    const nextThreshold = getNextEvolutionThreshold(medal.timesEarned || 1);
                    if (!nextThreshold) return <p className="text-[10px] text-white/50">Max Evolution</p>;
                    const evoProgress = ((medal.timesEarned || 1) / nextThreshold) * 100;
                    return (
                      <div className="mt-1">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-white/60">Next evolution</span>
                          <span className="text-white/80 font-medium">{medal.timesEarned || 1}/{nextThreshold}</span>
                        </div>
                        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white/40 rounded-full transition-all"
                            style={{ width: `${Math.min(evoProgress, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Progress to earn medal */}
                  {!isEarned && medal.target && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-gray-400">{medal.progress}/{medal.target}</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gray-500 rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {isEarned && medal.earnedAt && (
                    <p className="text-[10px] text-white/50 mt-2">
                      Earned {new Date(medal.earnedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filteredMedals.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400">No medals in this category</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
