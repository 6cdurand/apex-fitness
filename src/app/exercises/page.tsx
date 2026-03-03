'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useWorkoutStore } from '@/lib/store';
import { useAuthStore } from '@/lib/store';
import { maleTierRanges, femaleTierRanges, getTierColor, getTierBgColor } from '@/lib/strengthRating';
import { Workout, WorkoutExercise } from '@/types';
import { Search, Dumbbell, TrendingUp, ChevronRight, Trophy } from 'lucide-react';
import { ExerciseImage } from '@/components/ExerciseImage';
import { format } from 'date-fns';

type StrengthTier = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

interface ExerciseStats {
  exerciseId: string;
  exerciseName: string;
  personalBest: number;
  tier: StrengthTier;
  tierProgress: number;
  lastPerformed?: string;
  totalSets?: number;
}

export default function ExercisesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { personalBests, workoutHistory } = useWorkoutStore();
  const { user } = useAuthStore();
  
  const isMale = user?.gender !== 'female';
  const tierRanges = isMale ? maleTierRanges : femaleTierRanges;

  // Calculate stats for all exercises with tier data
  const exerciseStats = useMemo(() => {
    const stats: ExerciseStats[] = [];
    
    Object.keys(tierRanges).forEach((exerciseId) => {
      const pb = personalBests.find(p => p.exerciseId === exerciseId && p.userId === user?.id);
      const weight = pb?.oneRepMax || 0;
      const ranges = tierRanges[exerciseId];
      
      // Calculate tier and progress
      let tier: StrengthTier = 'beginner';
      let tierProgress = 0;
      
      if (weight >= ranges.elite[0]) {
        tier = 'elite';
        tierProgress = Math.min(100, ((weight - ranges.elite[0]) / (ranges.elite[1] - ranges.elite[0])) * 100);
      } else if (weight >= ranges.advanced[0]) {
        tier = 'advanced';
        tierProgress = ((weight - ranges.advanced[0]) / (ranges.advanced[1] - ranges.advanced[0])) * 100;
      } else if (weight >= ranges.intermediate[0]) {
        tier = 'intermediate';
        tierProgress = ((weight - ranges.intermediate[0]) / (ranges.intermediate[1] - ranges.intermediate[0])) * 100;
      } else if (weight >= ranges.novice[0]) {
        tier = 'novice';
        tierProgress = ((weight - ranges.novice[0]) / (ranges.novice[1] - ranges.novice[0])) * 100;
      } else {
        tier = 'beginner';
        tierProgress = ranges.beginner[1] > 0 ? (weight / ranges.beginner[1]) * 100 : 0;
      }

      // Format exercise name
      const exerciseName = exerciseId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Find last performed date
      let lastPerformed: string | undefined;
      let totalSets = 0;
      
      const userWorkouts = workoutHistory.filter((w: Workout) => w.userId === user?.id);
      userWorkouts.forEach((w: Workout) => {
        w.exercises?.forEach((e: WorkoutExercise) => {
          if (e.exerciseId === exerciseId || e.exercise?.name?.toLowerCase().replace(/\s+/g, '-') === exerciseId) {
            totalSets += e.sets?.length || 0;
            const wDate = w.startTime || w.endTime;
            if (wDate && (!lastPerformed || new Date(wDate) > new Date(lastPerformed))) {
              lastPerformed = wDate;
            }
          }
        });
      });

      stats.push({
        exerciseId,
        exerciseName,
        personalBest: weight,
        tier,
        tierProgress: Math.max(0, Math.min(100, tierProgress)),
        lastPerformed,
        totalSets,
      });
    });

    // Sort by personal best (exercises with PBs first, then alphabetically)
    return stats.sort((a, b) => {
      if (a.personalBest > 0 && b.personalBest === 0) return -1;
      if (a.personalBest === 0 && b.personalBest > 0) return 1;
      if (a.personalBest > 0 && b.personalBest > 0) {
        // Sort by tier level for exercises with PBs
        const tierOrder = ['elite', 'advanced', 'intermediate', 'novice', 'beginner'];
        return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
      }
      return a.exerciseName.localeCompare(b.exerciseName);
    });
  }, [personalBests, workoutHistory, tierRanges, user?.id]);

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exerciseStats;
    const query = searchQuery.toLowerCase();
    return exerciseStats.filter(e => 
      e.exerciseName.toLowerCase().includes(query) ||
      e.exerciseId.includes(query)
    );
  }, [exerciseStats, searchQuery]);

  // Group exercises
  const exercisesWithPB = filteredExercises.filter(e => e.personalBest > 0);
  const exercisesWithoutPB = filteredExercises.filter(e => e.personalBest === 0);

  const getTierTextColor = (tier: StrengthTier) => {
    switch (tier) {
      case 'elite': return 'text-orange-400';
      case 'advanced': return 'text-purple-400';
      case 'intermediate': return 'text-blue-400';
      case 'novice': return 'text-sky-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Exercise Stats" 
        subtitle="Track your progress on every lift"
        showBack
      />
      
      <div className="px-4 py-6 space-y-6 -mt-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 bg-slate-900/90 border-slate-700 h-12 rounded-xl"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-4 text-center">
              <Dumbbell className="w-5 h-5 mx-auto mb-1 text-sky-400" />
              <p className="text-2xl font-bold text-white">{exercisesWithPB.length}</p>
              <p className="text-xs text-slate-500">Tracked</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-4 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-orange-400" />
              <p className="text-2xl font-bold text-white">
                {exercisesWithPB.filter(e => e.tier === 'elite' || e.tier === 'advanced').length}
              </p>
              <p className="text-xs text-slate-500">Adv/Elite</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/90 border-slate-800">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
              <p className="text-2xl font-bold text-white">
                {Object.keys(tierRanges).length}
              </p>
              <p className="text-xs text-slate-500">Available</p>
            </CardContent>
          </Card>
        </div>

        {/* Exercises with PBs */}
        {exercisesWithPB.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide px-1">
              Your Personal Bests ({exercisesWithPB.length})
            </h3>
            <div className="space-y-2">
              {exercisesWithPB.map((exercise) => (
                <Card 
                  key={exercise.exerciseId}
                  className="bg-slate-900/90 border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                  onClick={() => router.push(`/exercises/${exercise.exerciseId}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <ExerciseImage exerciseId={exercise.exerciseId} size="sm" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate">{exercise.exerciseName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-lg font-bold text-white">{exercise.personalBest}kg</span>
                          <Badge className={`${getTierBgColor(exercise.tier)} ${getTierTextColor(exercise.tier)} border-0 text-xs`}>
                            {exercise.tier.charAt(0).toUpperCase() + exercise.tier.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
                    </div>
                    <Progress 
                      value={exercise.tierProgress} 
                      tier={exercise.tier}
                      className="h-2"
                    />
                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                      <span>{Math.round(exercise.tierProgress)}% to next tier</span>
                      {exercise.lastPerformed && (
                        <span>Last: {format(new Date(exercise.lastPerformed), 'MMM d')}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Exercises without PBs */}
        {exercisesWithoutPB.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide px-1">
              Not Yet Tracked ({exercisesWithoutPB.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {exercisesWithoutPB.slice(0, 20).map((exercise) => (
                <Card 
                  key={exercise.exerciseId}
                  className="bg-slate-900/50 border-slate-800/50 hover:border-slate-700 transition-all cursor-pointer"
                  onClick={() => router.push(`/exercises/${exercise.exerciseId}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ExerciseImage exerciseId={exercise.exerciseId} size="sm" className="!w-8 !h-8 !rounded-md" />
                      <p className="text-sm text-slate-400 truncate flex-1">{exercise.exerciseName}</p>
                    </div>
                    <p className="text-xs text-slate-600">Tap to view standards</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {exercisesWithoutPB.length > 20 && (
              <p className="text-xs text-slate-600 text-center">
                +{exercisesWithoutPB.length - 20} more exercises
              </p>
            )}
          </div>
        )}

        {filteredExercises.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-slate-700 mb-4" />
            <p className="text-slate-400">No exercises found</p>
            <p className="text-sm text-slate-600 mt-1">Try a different search term</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
