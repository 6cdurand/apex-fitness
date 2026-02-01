'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore, useWorkoutStore, useMedalStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  categoryDefinitions, 
  calculateCategory, 
  getTierName, 
  getTierColor,
  getTierBgColor,
  maleTierRanges,
  femaleTierRanges,
} from '@/lib/strengthRating';
import { StrengthSlice, StrengthTier } from '@/types';
import { ChevronRight, Dumbbell, TrendingUp, Info } from 'lucide-react';
import { convertWeight } from '@/lib/unitConversion';

export default function StrengthCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.category as string;
  
  const { user, isAuthenticated } = useAuthStore();
  const { personalBests } = useWorkoutStore();
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) return null;

  const categoryDef = categoryDefinitions[categoryId];
  if (!categoryDef) {
    return (
      <MainLayout>
        <PageHeader title="Category Not Found" showBack />
        <div className="px-4 py-8 text-center text-gray-400">
          Invalid strength category
        </div>
      </MainLayout>
    );
  }

  const isMale = user.gender === 'male';
  // Filter personal bests for current user only
  const userPBs = personalBests.filter(pb => pb.userId === user.id);
  const category = calculateCategory(categoryDef, userPBs, isMale);
  
  // Debug logging - trace progressPercent values
  console.log('=== STRENGTH CATEGORY DEBUG ===');
  console.log('Category:', categoryId, 'Overall tier:', category.tier);
  category.slices.forEach(s => {
    console.log(`Slice: ${s.name} | oneRM: ${s.oneRM}kg | Tier: ${s.tier} | Progress: ${s.progressPercent}% | Lift: ${s.contributingLift}`);
  });
  
  const getTierRangeForSlice = (slice: StrengthSlice) => {
    if (!slice.contributingLift) return null;
    const ranges = isMale ? maleTierRanges[slice.contributingLift] : femaleTierRanges[slice.contributingLift];
    return ranges;
  };

  const getProgressBarColor = (tier: StrengthTier) => {
    switch (tier) {
      case 'elite': return 'bg-amber-500';
      case 'advanced': return 'bg-purple-500';
      case 'intermediate': return 'bg-blue-500';
      case 'novice': return 'bg-sky-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title={`${category.name} Strength`}
        subtitle={`${category.icon} Enhanced View`}
        showBack 
      />

      <div className="px-4 py-6 space-y-6">
        {/* Category Overview */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Overall {category.name} Rating</p>
                <div className="flex items-baseline gap-3">
                  <span className={`text-5xl font-bold ${getTierColor(category.tier)}`}>
                    {category.totalPoints.toFixed(1)}%
                  </span>
                  <Badge className={`${getTierBgColor(category.tier)} text-white`}>
                    {getTierName(category.tier)}
                  </Badge>
                </div>
              </div>
              <div className="text-6xl">{category.icon}</div>
            </div>
            
            {/* Overall progress bar */}
            <div className="mt-4">
              <Progress 
                value={Math.min(category.totalPoints, 100)} 
                tier={category.tier}
                className="h-4"
              />
            </div>
          </CardContent>
        </Card>

        {/* Slice Breakdown */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            Breakdown by Area
          </h2>
          
          {category.slices.map((slice) => {
            const ranges = getTierRangeForSlice(slice);
            
            return (
              <Card key={slice.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  {/* Slice Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{slice.name}</h3>
                      <p className="text-sm text-gray-500">Weight: {slice.weight}%</p>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getTierBgColor(slice.tier)} text-white mb-1`}>
                        {getTierName(slice.tier)}
                      </Badge>
                      <p className={`text-2xl font-bold ${getTierColor(slice.tier)}`}>
                        {slice.progressPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <Progress 
                      value={Math.min(slice.progressPercent, 100)} 
                      tier={slice.tier}
                      className="h-3"
                    />
                  </div>

                  {/* Contributing Lift */}
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Dumbbell className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {slice.liftName || 'No lift recorded'}
                        </p>
                        {slice.oneRM > 0 && (
                          <p className="text-xs text-gray-500">Contributing lift</p>
                        )}
                      </div>
                    </div>
                    {slice.oneRM > 0 && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-400">
                          {convertWeight(slice.oneRM, user.exerciseUnit || 'kg')}{user.exerciseUnit || 'kg'}
                        </p>
                        <p className="text-xs text-gray-500">
                          1RM {slice.bestWeight && slice.bestReps ? `(${convertWeight(slice.bestWeight, user.exerciseUnit || 'kg')}×${slice.bestReps})` : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tier Ranges Info */}
                  {ranges && slice.oneRM > 0 && (
                    <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Tier ranges for {slice.liftName}
                      </p>
                      <div className="grid grid-cols-5 gap-1 text-xs">
                        {(['beginner', 'novice', 'intermediate', 'advanced', 'elite'] as StrengthTier[]).map((tier) => {
                          const [min, max] = ranges[tier];
                          const isCurrentTier = tier === slice.tier;
                          const tierBgStyles: Record<StrengthTier, string> = {
                            beginner: 'bg-slate-600',
                            novice: 'bg-sky-600',
                            intermediate: 'bg-blue-600',
                            advanced: 'bg-purple-600',
                            elite: 'bg-orange-600',
                          };
                          return (
                            <div 
                              key={tier}
                              className={`p-2 rounded text-center ${tierBgStyles[tier]} ${
                                isCurrentTier 
                                  ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' 
                                  : 'opacity-60'
                              }`}
                            >
                              <p className="font-medium capitalize text-white">{tier.slice(0, 3)}</p>
                              <p className="text-[10px] text-white/80">
                                {Math.round(convertWeight(min, user.exerciseUnit || 'kg'))}-{Math.round(convertWeight(max, user.exerciseUnit || 'kg'))}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Points Contribution */}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Points contributed</span>
                    <span className="font-medium text-white">
                      {slice.points.toFixed(1)} / {slice.weight} pts
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Calculation Explanation */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <Info className="w-4 h-4" />
              How it's calculated
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 space-y-2">
            <p>• Each slice contributes weighted points based on progress within tier</p>
            <p>• If a lift exceeds category tier, it counts as 100% for that slice</p>
            <p>• Category tier = lowest tier among all slices</p>
            <p>• Total = sum of (slice weight × progress%)</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
