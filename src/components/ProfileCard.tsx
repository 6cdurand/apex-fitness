'use client';

import React, { useState } from 'react';
import { User, Medal, StrengthRating } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  BadgeCheck, 
  ChevronDown, 
  ChevronUp, 
  Trophy, 
  Zap, 
  Users, 
  Dumbbell,
  TrendingUp,
  Image as ImageIcon,
  Lock,
  Share2,
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface ProfileCardProps {
  user: User;
  medals: Medal[];
  strengthRating: StrengthRating | null;
  personalBests: any[];
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
}

export function ProfileCard({
  user,
  medals,
  strengthRating,
  personalBests,
  stats,
  isOwnProfile = false,
  isFriend = false,
  onFollow,
  onShare,
}: ProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMedal, setSelectedMedal] = useState<Medal | null>(null);

  const earnedMedals = medals.filter(m => m.earned);
  const topMedals = earnedMedals.slice(0, 3);
  const additionalMedals = earnedMedals.slice(3, isOwnProfile || isFriend ? 12 : 6);

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'elite': return 'text-amber-400';
      case 'advanced': return 'text-purple-400';
      case 'intermediate': return 'text-blue-400';
      case 'novice': return 'text-emerald-400';
      default: return 'text-gray-400';
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

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'legendary': return 'text-orange-400 border-orange-400';
      case 'epic': return 'text-purple-400 border-purple-400';
      case 'rare': return 'text-blue-400 border-blue-400';
      case 'uncommon': return 'text-emerald-400 border-emerald-400';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  return (
    <>
      {/* Mini Card - Always Visible */}
      <Card 
        className={`bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 border-2 ${
          strengthRating?.tier === 'elite' ? 'border-amber-500/50' :
          strengthRating?.tier === 'advanced' ? 'border-purple-500/50' :
          strengthRating?.tier === 'intermediate' ? 'border-blue-500/50' :
          'border-gray-700'
        } overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.02]`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* FIFA-style Header Banner */}
        <div className={`h-2 bg-gradient-to-r ${
          strengthRating?.tier === 'elite' ? 'from-amber-500 via-yellow-400 to-amber-500' :
          strengthRating?.tier === 'advanced' ? 'from-purple-500 via-purple-400 to-purple-500' :
          strengthRating?.tier === 'intermediate' ? 'from-blue-500 via-blue-400 to-blue-500' :
          strengthRating?.tier === 'novice' ? 'from-emerald-500 via-emerald-400 to-emerald-500' :
          'from-gray-600 via-gray-500 to-gray-600'
        }`} />

        <CardContent className="p-4">
          {/* Top Row: Avatar + Name + Rating */}
          <div className="flex items-center gap-4">
            {/* Avatar with Tier Ring */}
            <div className={`relative p-1 rounded-full bg-gradient-to-br ${
              strengthRating?.tier === 'elite' ? 'from-amber-400 to-yellow-600' :
              strengthRating?.tier === 'advanced' ? 'from-purple-400 to-purple-600' :
              strengthRating?.tier === 'intermediate' ? 'from-blue-400 to-blue-600' :
              'from-gray-400 to-gray-600'
            }`}>
              <Avatar className="w-16 h-16 border-2 border-gray-900">
                <AvatarImage src={user.profilePhoto} />
                <AvatarFallback className="bg-gray-800 text-white text-xl">
                  {user.displayName?.[0]?.toUpperCase() || user.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Overall Rating Badge */}
              {strengthRating && (
                <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gray-900 border-2 ${
                  strengthRating.tier === 'elite' ? 'border-amber-400 text-amber-400' :
                  strengthRating.tier === 'advanced' ? 'border-purple-400 text-purple-400' :
                  strengthRating.tier === 'intermediate' ? 'border-blue-400 text-blue-400' :
                  'border-gray-400 text-gray-400'
                }`}>
                  {strengthRating.overall}
                </div>
              )}
            </div>

            {/* Name & Stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white truncate">{user.displayName || user.username}</h3>
                {user.isVerifiedTrainer && <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />}
              </div>
              <p className="text-xs text-gray-500">@{user.username}</p>
              
              {/* Mini Stats Row */}
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1 text-gray-400">
                  <Dumbbell className="w-3 h-3" />
                  {stats.totalWorkouts}
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Users className="w-3 h-3" />
                  {stats.followers}
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Trophy className="w-3 h-3" />
                  {earnedMedals.length}
                </span>
              </div>
            </div>

            {/* Top 3 Medals (Mini) */}
            <div className="flex -space-x-2">
              {topMedals.map((medal, idx) => (
                <div
                  key={medal.id}
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${getTierGradient(medal.tier)} flex items-center justify-center text-lg border-2 border-gray-900`}
                  style={{ zIndex: 3 - idx }}
                >
                  {medal.icon}
                </div>
              ))}
              {topMedals.length === 0 && (
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-600">
                  <Trophy className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Expand Indicator */}
            <div className="text-gray-500">
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Card View */}
      {isExpanded && (
        <Card className="bg-gray-900 border-gray-800 mt-2 overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 space-y-5">
            {/* Top 3 Medals - Full Display */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Top Achievements
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {topMedals.map((medal) => (
                  <button
                    key={medal.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedMedal(medal); }}
                    className={`p-3 rounded-xl bg-gradient-to-br ${getTierGradient(medal.tier)} relative overflow-hidden hover:scale-105 transition-transform`}
                  >
                    <div className="text-center">
                      <span className="text-3xl block mb-1">{medal.icon}</span>
                      <p className="text-xs font-medium text-white truncate">{medal.name}</p>
                      <p className="text-[10px] text-white/60 capitalize">{medal.tier}</p>
                    </div>
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none" />
                  </button>
                ))}
                {topMedals.length === 0 && (
                  <div className="col-span-3 py-6 text-center text-gray-500">
                    <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No achievements yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Medals */}
            {additionalMedals.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">More Achievements</h4>
                <div className="flex flex-wrap gap-2">
                  {additionalMedals.map((medal) => (
                    <button
                      key={medal.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedMedal(medal); }}
                      className={`px-3 py-2 rounded-lg bg-gray-800 border ${getRarityColor(medal.rarity || 'common')} hover:bg-gray-750 transition-colors flex items-center gap-2`}
                    >
                      <span>{medal.icon}</span>
                      <span className="text-xs text-white">{medal.name}</span>
                    </button>
                  ))}
                </div>
                {!isOwnProfile && !isFriend && earnedMedals.length > 6 && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Follow to see more achievements
                  </p>
                )}
              </div>
            )}

            {/* Strength Ratings */}
            {strengthRating && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Strength Ratings
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {strengthRating.categories && Object.entries(strengthRating.categories).map(([key, cat]) => (
                    <div key={key} className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400 capitalize">{cat.name}</span>
                        <span className={`text-lg font-bold ${getTierColor(cat.tier)}`}>
                          {cat.totalPoints.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={Math.min(cat.totalPoints, 100)} className="h-2" />
                      <p className={`text-xs mt-1 ${getTierColor(cat.tier)} capitalize`}>{cat.tier}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Stats */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Stats
              </h4>
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
                  <p className="text-lg font-bold text-white">{personalBests.length}</p>
                  <p className="text-[10px] text-gray-500">PRs</p>
                </div>
                <div className="p-2 bg-gray-800 rounded-lg">
                  <p className="text-lg font-bold text-white">{earnedMedals.length}</p>
                  <p className="text-[10px] text-gray-500">Medals</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {!isOwnProfile && (
                <Button
                  onClick={(e) => { e.stopPropagation(); onFollow?.(); }}
                  className={isFriend ? 'flex-1 bg-gray-700' : 'flex-1 bg-emerald-600 hover:bg-emerald-700'}
                >
                  <Users className="w-4 h-4 mr-2" />
                  {isFriend ? 'Following' : 'Follow'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onShare?.(); }}
                className="flex-1 border-gray-700"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

                {/* Evolution Progress */}
                {selectedMedal.target && selectedMedal.target > 1 && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-500">Progress</span>
                      <span className="text-white">{selectedMedal.progress} / {selectedMedal.target}</span>
                    </div>
                    <Progress value={(selectedMedal.progress / selectedMedal.target) * 100} className="h-2" />
                  </div>
                )}

                {/* Attached Media Placeholder */}
                {(isOwnProfile || isFriend) && (
                  <div className="p-4 bg-gray-800 rounded-lg text-center">
                    <ImageIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No media attached</p>
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

export default ProfileCard;
