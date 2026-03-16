'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, Medal, StrengthRating, StrengthCategory } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  BadgeCheck, 
  Trophy, 
  Zap, 
  Users, 
  Dumbbell,
  TrendingUp,
  ChevronRight,
  Share2,
  X,
  Pencil,
  Check
} from 'lucide-react';
import { format } from 'date-fns';

interface ProfileCardV2Props {
  user: User;
  medals: Medal[];
  strengthRating: StrengthRating | null;
  stats: {
    totalWorkouts: number;
    totalVolume: number;
    followers: number;
    following: number;
  };
  isOwnProfile?: boolean;
  isFriend?: boolean;
  onFollow?: () => void;
  onShare?: () => void;
  onClose?: () => void;
  onUpdateUser?: (updates: Partial<User>) => void;
}

export function ProfileCardV2({
  user,
  medals,
  strengthRating,
  stats,
  isOwnProfile = false,
  isFriend = false,
  onFollow,
  onShare,
  onClose,
  onUpdateUser,
}: ProfileCardV2Props) {
  const router = useRouter();
  const [selectedMedal, setSelectedMedal] = useState<Medal | null>(null);
  const [showMedalPicker, setShowMedalPicker] = useState(false);
  const [pendingFeatured, setPendingFeatured] = useState<string[]>([]);

  // Filter out trainer medals - only show fitness/lifting medals
  const fitnessmedals = medals.filter(m => m.earned && m.category !== 'trainer');

  // Tier rank for sorting: higher = better
  const tierRank: Record<string, number> = { diamond: 5, platinum: 4, gold: 3, silver: 2, bronze: 1 };

  // Auto-select top 3 by tier, or use user's chosen featured medals
  const featuredMedals = useMemo(() => {
    const ids = user.featuredMedalIds;
    if (ids && ids.length > 0) {
      // Use user's explicit picks (filter to still-earned medals)
      return ids
        .map(id => fitnessmedals.find(m => m.definitionId === id))
        .filter(Boolean) as Medal[];
    }
    // Auto-select: sort by tier rank descending, take top 3
    return [...fitnessmedals]
      .sort((a, b) => (tierRank[b.tier || ''] || 0) - (tierRank[a.tier || ''] || 0))
      .slice(0, 3);
  }, [fitnessmedals, user.featuredMedalIds]);

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'elite': return 'text-amber-400';
      case 'advanced': return 'text-purple-400';
      case 'intermediate': return 'text-blue-400';
      case 'novice': return 'text-sky-400';
      default: return 'text-gray-400';
    }
  };

  const getTierBgColor = (tier?: string) => {
    switch (tier) {
      case 'elite': return 'bg-amber-500';
      case 'advanced': return 'bg-purple-500';
      case 'intermediate': return 'bg-blue-500';
      case 'novice': return 'bg-sky-500';
      default: return 'bg-gray-500';
    }
  };

  const getTierGradient = (tier?: string) => {
    switch (tier) {
      case 'diamond': return 'from-purple-500 to-blue-500';
      case 'platinum': return 'from-cyan-400 to-cyan-600';
      case 'gold': return 'from-yellow-400 to-amber-500';
      case 'silver': return 'from-gray-300 to-gray-500';
      case 'bronze': return 'from-amber-600 to-amber-800';
      default: return 'from-gray-600 to-gray-800';
    }
  };

  const handleStrengthClick = () => {
    if (isOwnProfile) {
      onClose?.();
      router.push('/profile');
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    if (isOwnProfile) {
      onClose?.();
      router.push(`/profile/strength/${categoryId}`);
    }
  };

  const handleMedalsClick = () => {
    if (isOwnProfile) {
      onClose?.();
      router.push('/medals');
    }
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 border-gray-700 overflow-hidden">
        {/* Tier Banner */}
        <div className={`h-2 ${getTierBgColor(strengthRating?.tier)}`} />

        <CardContent className="p-5 space-y-5">
          {/* Header: Name & Avatar */}
          <div className="flex items-center gap-4">
            <div className={`relative p-1 rounded-full bg-gradient-to-br ${
              strengthRating?.tier === 'elite' ? 'from-amber-400 to-yellow-600' :
              strengthRating?.tier === 'advanced' ? 'from-purple-400 to-purple-600' :
              strengthRating?.tier === 'intermediate' ? 'from-blue-400 to-blue-600' :
              strengthRating?.tier === 'novice' ? 'from-sky-400 to-sky-600' :
              'from-gray-400 to-gray-600'
            }`}>
              <Avatar className="w-16 h-16 border-2 border-gray-900">
                <AvatarImage src={user.profilePhoto} />
                <AvatarFallback className="bg-gray-800 text-white text-xl">
                  {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{user.displayName || user.username}</h2>
                {user.isVerifiedTrainer && <BadgeCheck className="w-5 h-5 text-blue-400" />}
              </div>
              <p className="text-sm text-gray-500">@{user.username}</p>
              {strengthRating && (
                <Badge className={`mt-1 ${
                  strengthRating.tier === 'elite' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  strengthRating.tier === 'advanced' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                  strengthRating.tier === 'intermediate' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  strengthRating.tier === 'novice' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/30'
                } border text-xs`}>
                  {strengthRating.tier ? strengthRating.tier.charAt(0).toUpperCase() + strengthRating.tier.slice(1) : 'Unranked'} Tier
                </Badge>
              )}
            </div>

            {onClose && (
              <button onClick={onClose} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Strength Rating Section — only show if user opted in */}
          {strengthRating && user.showStrengthRating && (
            <button 
              onClick={handleStrengthClick}
              className="w-full text-left hover:bg-gray-800/50 rounded-xl transition-colors p-3 -m-3"
              disabled={!isOwnProfile}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Strength Rating
                  <span className="text-[9px] text-gray-500 font-normal ml-1">(Free Weights)</span>
                </h3>
                {isOwnProfile && <ChevronRight className="w-4 h-4 text-gray-500" />}
              </div>
              
              {/* Overall Score */}
              <div className="text-center py-3 mb-3 bg-gradient-to-b from-gray-800/50 to-transparent rounded-xl">
                <p className={`text-4xl font-bold ${getTierColor(strengthRating.tier)}`}>
                  {strengthRating.overall}%
                </p>
                <p className="text-gray-500 text-xs mt-1">Overall Score</p>
              </div>
              
              {/* Category Grid - Clickable */}
              <div className="grid grid-cols-2 gap-2">
                {strengthRating.categories && Object.entries(strengthRating.categories).map(([key, cat]) => {
                  const category = cat as StrengthCategory;
                  return (
                    <button
                      key={key}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategoryClick(key);
                      }}
                      disabled={!isOwnProfile}
                      className="p-2.5 bg-gray-800 rounded-lg text-left hover:bg-gray-750 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-400 capitalize flex items-center gap-1">
                          {category.icon} {category.name}
                        </span>
                        <span className={`text-sm font-bold ${getTierColor(category.tier)}`}>
                          {typeof category.totalPoints === 'number' ? category.totalPoints.toFixed(0) : '0'}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(category.totalPoints || 0, 100)} 
                        tier={category.tier}
                        className="h-1.5" 
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-[10px] ${getTierColor(category.tier)} capitalize`}>
                          {category.tier}
                        </p>
                        {isOwnProfile && (
                          <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </button>
          )}

          {/* Featured Medals — auto top 3 or user-chosen */}
          {fitnessmedals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={handleMedalsClick}
                  disabled={!isOwnProfile}
                  className="flex items-center gap-2 hover:opacity-80"
                >
                  <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Featured ({featuredMedals.length}) · {fitnessmedals.length} total
                  </h3>
                </button>
                <div className="flex items-center gap-1">
                  {isOwnProfile && (
                    <button
                      onClick={() => {
                        setPendingFeatured(
                          user.featuredMedalIds?.length
                            ? [...user.featuredMedalIds]
                            : featuredMedals.map(m => m.definitionId)
                        );
                        setShowMedalPicker(true);
                      }}
                      className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                      title="Edit featured medals"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOwnProfile && <ChevronRight className="w-4 h-4 text-gray-500 cursor-pointer" onClick={handleMedalsClick} />}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {featuredMedals.map((medal) => (
                  <button
                    key={medal.id}
                    onClick={() => setSelectedMedal(medal)}
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getTierGradient(medal.tier)} flex items-center justify-center text-xl hover:scale-110 transition-transform`}
                  >
                    {medal.icon}
                  </button>
                ))}
                {fitnessmedals.length > featuredMedals.length && (
                  <button
                    onClick={handleMedalsClick}
                    className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 text-sm font-medium hover:bg-gray-700"
                  >
                    +{fitnessmedals.length - featuredMedals.length}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-gray-800 rounded-lg">
              <p className="text-lg font-bold text-white">{stats.totalWorkouts}</p>
              <p className="text-[10px] text-gray-500">Workouts</p>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg">
              <p className="text-lg font-bold text-white">{Math.round(stats.totalVolume / 1000)}k</p>
              <p className="text-[10px] text-gray-500">Volume</p>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg">
              <p className="text-lg font-bold text-white">{stats.followers}</p>
              <p className="text-[10px] text-gray-500">Followers</p>
            </div>
            <div className="p-2 bg-gray-800 rounded-lg">
              <p className="text-lg font-bold text-white">{fitnessmedals.length}</p>
              <p className="text-[10px] text-gray-500">Medals</p>
            </div>
          </div>

          {/* Show Strength Rating Toggle — own profile only */}
          {isOwnProfile && strengthRating && !user.showStrengthRating && (
            <button
              onClick={() => onUpdateUser?.({ showStrengthRating: true })}
              className="w-full text-left p-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Show Strength Rating on card
                </span>
                <span className="text-[10px] text-sky-400">Enable</span>
              </div>
            </button>
          )}
          {isOwnProfile && user.showStrengthRating && (
            <button
              onClick={() => onUpdateUser?.({ showStrengthRating: false })}
              className="w-full text-right"
            >
              <span className="text-[10px] text-gray-600 hover:text-gray-400">Hide strength rating</span>
            </button>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isOwnProfile && (
              <Button
                onClick={onFollow}
                className={isFriend ? 'flex-1 bg-gray-700' : 'flex-1 bg-sky-600 hover:bg-sky-700'}
              >
                <Users className="w-4 h-4 mr-2" />
                {isFriend ? 'Following' : 'Follow'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onShare}
              className="flex-1 border-gray-700"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Medal Picker Dialog — choose up to 3 featured medals */}
      <Dialog open={showMedalPicker} onOpenChange={setShowMedalPicker}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Choose Featured Medals
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-2">Select up to 3 medals to showcase on your profile card</p>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {fitnessmedals
              .sort((a, b) => (tierRank[b.tier || ''] || 0) - (tierRank[a.tier || ''] || 0))
              .map((medal) => {
                const isSelected = pendingFeatured.includes(medal.definitionId);
                return (
                  <button
                    key={medal.id}
                    onClick={() => {
                      if (isSelected) {
                        setPendingFeatured(prev => prev.filter(id => id !== medal.definitionId));
                      } else if (pendingFeatured.length < 3) {
                        setPendingFeatured(prev => [...prev, medal.definitionId]);
                      }
                    }}
                    className={`relative w-full aspect-square rounded-xl bg-gradient-to-br ${getTierGradient(medal.tier)} flex items-center justify-center text-xl transition-all ${
                      isSelected ? 'ring-2 ring-sky-400 scale-105' : 'opacity-60 hover:opacity-100'
                    } ${!isSelected && pendingFeatured.length >= 3 ? 'opacity-30 cursor-not-allowed' : ''}`}
                    disabled={!isSelected && pendingFeatured.length >= 3}
                  >
                    {medal.icon}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300"
              onClick={() => { setPendingFeatured([]); }}
            >
              Auto (Top 3)
            </Button>
            <Button
              className="flex-1 bg-sky-600 hover:bg-sky-700"
              onClick={() => {
                onUpdateUser?.({
                  featuredMedalIds: pendingFeatured.length > 0 ? pendingFeatured : undefined,
                });
                setShowMedalPicker(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medal Detail Modal */}
      <Dialog open={!!selectedMedal} onOpenChange={() => setSelectedMedal(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          {selectedMedal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-3">
                  <span className="text-4xl">{selectedMedal.icon}</span>
                  <div>
                    <p className="font-bold">{selectedMedal.name}</p>
                    <p className={`text-sm capitalize ${getTierColor(selectedMedal.tier)}`}>
                      {selectedMedal.tier} Tier
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-gray-400 text-sm">{selectedMedal.description}</p>
                {selectedMedal.earnedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Earned</span>
                    <span className="text-white">{format(new Date(selectedMedal.earnedAt), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProfileCardV2;
