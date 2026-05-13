import { StrengthTier, StrengthSlice, StrengthCategory, StrengthRating, TierRange, PersonalBest } from '@/types';

// ============ TIER RANGES (kg) ============
// Based on StrengthLevel.com data with trend math applied
// Compound lifts: steeper progression (1.0x → 1.55x → 2.15x → 2.9x → 3.7x)
// Free weights only: barbell, dumbbell, bodyweight (machines/cables excluded from strength rating)

export const maleTierRanges: Record<string, TierRange> = {
  // ========== CHEST ==========
  // Barbell Bench Press (compound, steeper)
  'bench-press': {
    beginner: [0, 47],
    novice: [47, 73],
    intermediate: [73, 101],
    advanced: [101, 136],
    elite: [136, 174],
  },
  // Alias for barbell-bench-press (same as bench-press)
  'barbell-bench-press': {
    beginner: [0, 47],
    novice: [47, 73],
    intermediate: [73, 101],
    advanced: [101, 136],
    elite: [136, 174],
  },
  // Incline Barbell Bench (compound)
  'incline-bench-press': {
    beginner: [0, 44],
    novice: [44, 68],
    intermediate: [68, 95],
    advanced: [95, 128],
    elite: [128, 163],
  },
  // Dumbbell Bench Press
  'dumbbell-bench-press': {
    beginner: [0, 15],
    novice: [15, 23],
    intermediate: [23, 32],
    advanced: [32, 44],
    elite: [44, 56],
  },
  // Incline Dumbbell Press
  'incline-dumbbell-press': {
    beginner: [0, 13],
    novice: [13, 20],
    intermediate: [20, 28],
    advanced: [28, 38],
    elite: [38, 48],
  },
  // Dumbbell Press (flat)
  'dumbbell-press': {
    beginner: [0, 15],
    novice: [15, 23],
    intermediate: [23, 32],
    advanced: [32, 44],
    elite: [44, 56],
  },
  // Dips (bodyweight - added weight)
  'dips': {
    beginner: [-20, 0],
    novice: [0, 15],
    intermediate: [15, 35],
    advanced: [35, 55],
    elite: [55, 80],
  },
  'chest-dips': {
    beginner: [-20, 0],
    novice: [0, 15],
    intermediate: [15, 35],
    advanced: [35, 55],
    elite: [55, 80],
  },
  // v11-D4: Assisted Dips (counterweight kg, lower = better)
  'assisted-dips': {
    beginner: [35, 50],
    novice: [20, 35],
    intermediate: [10, 20],
    advanced: [2.5, 10],
    elite: [0, 2.5],
    polarity: 'lower-is-better',
  },

  // ========== BACK ==========
  // Deadlift (compound, steeper) - also counts for legs
  'deadlift': {
    beginner: [0, 78],
    novice: [78, 121],
    intermediate: [121, 168],
    advanced: [168, 226],
    elite: [226, 289],
  },
  // Romanian Deadlift / RDL (compound)
  'romanian-deadlift': {
    beginner: [0, 55],
    novice: [55, 85],
    intermediate: [85, 118],
    advanced: [118, 160],
    elite: [160, 204],
  },
  'rdl': {
    beginner: [0, 55],
    novice: [55, 85],
    intermediate: [85, 118],
    advanced: [118, 160],
    elite: [160, 204],
  },
  // Dumbbell Romanian Deadlift (dumbbell hinge)
  'dumbbell-rdl': {
    beginner: [0, 10],
    novice: [10, 18],
    intermediate: [18, 28],
    advanced: [28, 40],
    elite: [40, 54],
  },
  // Barbell Row (compound)
  'barbell-row': {
    beginner: [0, 40],
    novice: [40, 62],
    intermediate: [62, 86],
    advanced: [86, 116],
    elite: [116, 148],
  },
  'bent-over-row': {
    beginner: [0, 40],
    novice: [40, 62],
    intermediate: [62, 86],
    advanced: [86, 116],
    elite: [116, 148],
  },
  // Dumbbell Row
  'dumbbell-row': {
    beginner: [0, 15],
    novice: [15, 23],
    intermediate: [23, 32],
    advanced: [32, 44],
    elite: [44, 56],
  },
  'single-arm-dumbbell-row': {
    beginner: [0, 15],
    novice: [15, 23],
    intermediate: [23, 32],
    advanced: [32, 44],
    elite: [44, 56],
  },
  // Pull-up (bodyweight + added)
  'pull-up': {
    beginner: [-15, 0],
    novice: [0, 10],
    intermediate: [10, 25],
    advanced: [25, 40],
    elite: [40, 60],
  },
  'chin-up': {
    beginner: [-15, 0],
    novice: [0, 12],
    intermediate: [12, 28],
    advanced: [28, 45],
    elite: [45, 65],
  },
  // v11-D4: Assisted Pull-Up (counterweight kg, lower = better)
  'assisted-pull-up': {
    beginner: [45, 60],
    novice: [30, 45],
    intermediate: [15, 30],
    advanced: [5, 15],
    elite: [0, 5],
    polarity: 'lower-is-better',
  },
  // v11-D4: Assisted Chin-Up (counterweight kg, lower = better)
  'assisted-chin-up': {
    beginner: [45, 60],
    novice: [30, 45],
    intermediate: [15, 30],
    advanced: [5, 15],
    elite: [0, 5],
    polarity: 'lower-is-better',
  },
  // T-Bar Row (compound)
  't-bar-row': {
    beginner: [0, 35],
    novice: [35, 54],
    intermediate: [54, 75],
    advanced: [75, 102],
    elite: [102, 130],
  },

  // ========== SHOULDERS ==========
  // Overhead Press / Military Press (compound)
  'overhead-press': {
    beginner: [0, 30],
    novice: [30, 47],
    intermediate: [47, 65],
    advanced: [65, 87],
    elite: [87, 111],
  },
  'military-press': {
    beginner: [0, 30],
    novice: [30, 47],
    intermediate: [47, 65],
    advanced: [65, 87],
    elite: [87, 111],
  },
  // Dumbbell Shoulder Press
  'dumbbell-shoulder-press': {
    beginner: [0, 13],
    novice: [13, 20],
    intermediate: [20, 28],
    advanced: [28, 38],
    elite: [38, 48],
  },
  // Lateral Raise (dumbbell - isolation, lighter weights)
  'lateral-raise': {
    beginner: [0, 4],
    novice: [4, 8],
    intermediate: [8, 15],
    advanced: [15, 22],
    elite: [22, 30],
  },
  'dumbbell-lateral-raise': {
    beginner: [0, 4],
    novice: [4, 8],
    intermediate: [8, 15],
    advanced: [15, 22],
    elite: [22, 30],
  },
  // ========== LEGS ==========
  // Squat (compound, steeper)
  'squat': {
    beginner: [0, 64],
    novice: [64, 99],
    intermediate: [99, 138],
    advanced: [138, 186],
    elite: [186, 237],
  },
  'back-squat': {
    beginner: [0, 64],
    novice: [64, 99],
    intermediate: [99, 138],
    advanced: [138, 186],
    elite: [186, 237],
  },
  // Front Squat (compound)
  'front-squat': {
    beginner: [0, 52],
    novice: [52, 81],
    intermediate: [81, 112],
    advanced: [112, 151],
    elite: [151, 192],
  },
  // Goblet Squat (dumbbell)
  'goblet-squat': {
    beginner: [0, 13],
    novice: [13, 26],
    intermediate: [26, 42],
    advanced: [42, 63],
    elite: [63, 87],
  },
  // Hip Thrust (compound - glutes)
  'hip-thrust': {
    beginner: [0, 38],
    novice: [38, 76],
    intermediate: [76, 129],
    advanced: [129, 196],
    elite: [196, 273],
  },
  // Split Squat / Bulgarian (dumbbell)
  'split-squat': {
    beginner: [0, 10],
    novice: [10, 16],
    intermediate: [16, 22],
    advanced: [22, 29],
    elite: [29, 37],
  },
  'bulgarian-split-squat': {
    beginner: [0, 10],
    novice: [10, 18],
    intermediate: [18, 30],
    advanced: [30, 44],
    elite: [44, 60],
  },
};

// Female standards (approximately 65-70% of male values)
// Special handling for exercises with negative values (assisted)
export const femaleTierRanges: Record<string, TierRange> = Object.fromEntries(
  Object.entries(maleTierRanges).map(([exercise, ranges]) => {
    // For dips, females get easier tiers (more assistance allowed)
    if (exercise === 'dips' || exercise === 'chest-dips') {
      return [exercise, {
        beginner: [-30, -15] as [number, number],  // More assistance for females
        novice: [-15, 0] as [number, number],      // Up to bodyweight
        intermediate: [0, 25] as [number, number],
        advanced: [25, 43] as [number, number],
        elite: [43, 62] as [number, number],
      }];
    }
    // v11-D4: Assisted exercises get custom female ranges (counterweight kg, lower = better)
    if (exercise === 'assisted-dips') {
      return [exercise, {
        beginner: [30, 40] as [number, number],
        novice: [18, 30] as [number, number],
        intermediate: [9, 18] as [number, number],
        advanced: [2.5, 9] as [number, number],
        elite: [0, 2.5] as [number, number],
        polarity: 'lower-is-better',
      }];
    }
    if (exercise === 'assisted-pull-up') {
      return [exercise, {
        beginner: [40, 50] as [number, number],
        novice: [28, 40] as [number, number],
        intermediate: [14, 28] as [number, number],
        advanced: [4, 14] as [number, number],
        elite: [0, 4] as [number, number],
        polarity: 'lower-is-better',
      }];
    }
    if (exercise === 'assisted-chin-up') {
      return [exercise, {
        beginner: [40, 50] as [number, number],
        novice: [28, 40] as [number, number],
        intermediate: [14, 28] as [number, number],
        advanced: [4, 14] as [number, number],
        elite: [0, 4] as [number, number],
        polarity: 'lower-is-better',
      }];
    }
    // Standard 65% scaling for other exercises
    return [exercise, {
      beginner: [ranges.beginner[0] * 0.65, ranges.beginner[1] * 0.65] as [number, number],
      novice: [ranges.novice[0] * 0.65, ranges.novice[1] * 0.65] as [number, number],
      intermediate: [ranges.intermediate[0] * 0.65, ranges.intermediate[1] * 0.65] as [number, number],
      advanced: [ranges.advanced[0] * 0.65, ranges.advanced[1] * 0.65] as [number, number],
      elite: [ranges.elite[0] * 0.65, ranges.elite[1] * 0.65] as [number, number],
    }];
  })
);

// ============ CATEGORY DEFINITIONS ============
export interface SliceDefinition {
  id: string;
  name: string;
  weight: number; // percentage (e.g., 40 = 40%)
  exercises: string[]; // exercise IDs that can contribute (best one used)
}

export interface CategoryDefinition {
  id: string;
  name: string;
  icon: string;
  slices: SliceDefinition[];
}

// ============ CATEGORY DEFINITIONS ============
// All exercises enabled for testing

export const categoryDefinitions: Record<string, CategoryDefinition> = {
  chest: {
    id: 'chest',
    name: 'Chest',
    icon: '💪',
    slices: [
      { 
        id: 'middle-chest', 
        name: 'Middle Chest', 
        weight: 40, 
        exercises: ['bench-press', 'barbell-bench-press', 'dumbbell-bench-press', 'dumbbell-press', 'machine-chest-press'] 
      },
      { 
        id: 'upper-chest', 
        name: 'Upper Chest', 
        weight: 30, 
        exercises: ['incline-bench-press', 'incline-dumbbell-press'] 
      },
      { 
        id: 'lower-chest', 
        name: 'Lower Chest', 
        weight: 30, 
        exercises: ['chest-dips', 'dips', 'decline-bench-press', 'chest-fly', 'machine-chest-fly'] 
      },
    ],
  },
  back: {
    id: 'back',
    name: 'Back',
    icon: '🔙',
    slices: [
      { 
        id: 'vertical-pull', 
        name: 'Vertical Pull (Lats)', 
        weight: 35, 
        exercises: ['pull-up', 'chin-up'] 
      },
      { 
        id: 'horizontal-pull', 
        name: 'Horizontal Pull (Mid Back)', 
        weight: 35, 
        exercises: ['barbell-row', 'bent-over-row', 'dumbbell-row', 'single-arm-dumbbell-row', 't-bar-row'] 
      },
      { 
        id: 'posterior-chain', 
        name: 'Posterior Chain', 
        weight: 30, 
        exercises: ['deadlift', 'romanian-deadlift', 'rdl'] 
      },
    ],
  },
  shoulders: {
    id: 'shoulders',
    name: 'Shoulders',
    icon: '🎯',
    slices: [
      { 
        id: 'front-delt', 
        name: 'Front Delts', 
        weight: 55, 
        exercises: ['overhead-press', 'military-press', 'dumbbell-shoulder-press'] 
      },
      { 
        id: 'side-delt', 
        name: 'Side Delts', 
        weight: 45, 
        exercises: ['lateral-raise', 'dumbbell-lateral-raise'] 
      },
    ],
  },
  legs: {
    id: 'legs',
    name: 'Legs',
    icon: '🦵',
    slices: [
      { 
        id: 'quads', 
        name: 'Quads', 
        weight: 50, 
        exercises: ['squat', 'back-squat', 'front-squat', 'goblet-squat', 'split-squat', 'bulgarian-split-squat'] 
      },
      { 
        id: 'glutes-hamstrings', 
        name: 'Glutes/Hamstrings', 
        weight: 50, 
        exercises: ['deadlift', 'romanian-deadlift', 'rdl', 'dumbbell-rdl', 'hip-thrust', 'squat', 'back-squat', 'front-squat', 'goblet-squat', 'split-squat', 'bulgarian-split-squat'] 
      },
    ],
  },
};

// ============ CALCULATION FUNCTIONS ============

/**
 * Calculate 1RM from weight and reps
 * - 1 rep: actual weight (pure number)
 * - 2-6 reps: Brzycki formula
 * - 7-20 reps: Epley formula
 * - >20 reps: returns null (doesn't count toward strength rating)
 */
export function calculate1RM(weight: number, reps: number): number | null {
  // More than 20 reps doesn't count toward strength rating
  if (reps > 20) return null;
  
  // 1 rep = pure weight
  if (reps === 1) return weight;
  
  // 2-6 reps: Brzycki formula
  if (reps <= 6) {
    return Math.round(weight * (36 / (37 - reps)));
  }
  
  // 7-20 reps: Epley formula
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Get the tier for a given 1RM value
 */
export function getTierFor1RM(oneRM: number, exerciseId: string, isMale: boolean = true): StrengthTier {
  const ranges = isMale ? maleTierRanges[exerciseId] : femaleTierRanges[exerciseId];
  if (!ranges) return 'beginner';
  
  const isLowerBetter = ranges.polarity === 'lower-is-better';
  
  if (isLowerBetter) {
    // For assisted exercises: lower counterweight = better (reverse tier checks)
    if (oneRM <= ranges.elite[1]) return 'elite';
    if (oneRM <= ranges.advanced[1]) return 'advanced';
    if (oneRM <= ranges.intermediate[1]) return 'intermediate';
    if (oneRM <= ranges.novice[1]) return 'novice';
    return 'beginner';
  } else {
    // Standard: higher weight = better
    if (oneRM >= ranges.elite[0]) return 'elite';
    if (oneRM >= ranges.advanced[0]) return 'advanced';
    if (oneRM >= ranges.intermediate[0]) return 'intermediate';
    if (oneRM >= ranges.novice[0]) return 'novice';
    return 'beginner';
  }
}

/**
 * Calculate progress percentage within current tier
 * Returns 0-100
 */
export function getProgressInTier(oneRM: number, exerciseId: string, isMale: boolean = true): { tier: StrengthTier; progress: number } {
  const ranges = isMale ? maleTierRanges[exerciseId] : femaleTierRanges[exerciseId];
  if (!ranges) {
    console.log('[getProgressInTier] No ranges found for:', exerciseId);
    return { tier: 'beginner', progress: 0 };
  }
  
  const isLowerBetter = ranges.polarity === 'lower-is-better';
  const tiers: StrengthTier[] = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];
  
  if (isLowerBetter) {
    // For assisted exercises: lower counterweight = better (check from elite down to beginner)
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i];
      const [min, max] = ranges[tier];
      
      if (oneRM <= max) {
        // Within this tier (lower is better, so we're measuring down from max)
        const range = max - min;
        const progress = range > 0 ? Math.min(100, ((max - oneRM) / range) * 100) : 100;
        console.log(`[getProgressInTier] ${exerciseId} (lower-is-better): oneRM=${oneRM}, tier=${tier}, min=${min}, max=${max}, progress=${progress.toFixed(1)}%`);
        return { tier, progress };
      }
    }
  } else {
    // Standard: higher weight = better
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i];
      const [min, max] = ranges[tier];
      
      if (oneRM >= min) {
        // Within this tier
        const range = max - min;
        const progress = range > 0 ? Math.min(100, ((oneRM - min) / range) * 100) : 100;
        console.log(`[getProgressInTier] ${exerciseId}: oneRM=${oneRM}, tier=${tier}, min=${min}, max=${max}, progress=${progress.toFixed(1)}%`);
        return { tier, progress };
      }
    }
  }
  
  return { tier: 'beginner', progress: 0 };
}

/**
 * Calculate recency decay factor for a PB based on when it was achieved.
 * - Within 90 days: 100% (no decay)
 * - 90–180 days: linear decay from 100% → 75%
 * - 180–365 days: linear decay from 75% → 50%
 * - Beyond 365 days: 50% floor (all-time still counts, just reduced)
 */
export function getRecencyFactor(achievedAt: string | undefined): number {
  if (!achievedAt) return 0.5; // Unknown date = treat as old
  const daysSince = (Date.now() - new Date(achievedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 90) return 1.0;
  if (daysSince <= 180) return 1.0 - 0.25 * ((daysSince - 90) / 90);
  if (daysSince <= 365) return 0.75 - 0.25 * ((daysSince - 180) / 185);
  return 0.5;
}

/**
 * Get tier name for display
 */
export function getTierName(tier: StrengthTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Get tier color class
 */
export function getTierColor(tier: StrengthTier): string {
  switch (tier) {
    case 'elite': return 'text-amber-400';
    case 'advanced': return 'text-purple-400';
    case 'intermediate': return 'text-blue-400';
    case 'novice': return 'text-sky-400';
    default: return 'text-gray-400';
  }
}

/**
 * Get tier background color class
 */
export function getTierBgColor(tier: StrengthTier): string {
  switch (tier) {
    case 'elite': return 'bg-amber-500';
    case 'advanced': return 'bg-purple-500';
    case 'intermediate': return 'bg-blue-500';
    case 'novice': return 'bg-sky-500';
    default: return 'bg-gray-500';
  }
}

/**
 * Calculate a single category's strength rating
 * 
 * RULES:
 * 1. If a lift is ABOVE the category's current tier, it counts as 100% for that slice
 * 2. Category tier is locked to lowest slice tier (all must contribute)
 * 3. Total points = sum of (slice.weight × slice.progressPercent / 100)
 */
export function calculateCategory(
  categoryDef: CategoryDefinition,
  personalBests: PersonalBest[],
  isMale: boolean = true
): StrengthCategory {
  const slices: StrengthSlice[] = [];
  let lowestTier: StrengthTier = 'elite';
  const tierOrder: StrengthTier[] = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];
  
  for (const sliceDef of categoryDef.slices) {
    // Find best contributing lift for this slice
    let bestOneRM = 0;
    let bestExerciseId = '';
    let bestLiftName = '';
    let bestWeight = 0;
    let bestReps = 0;
    
    for (const exerciseId of sliceDef.exercises) {
      const pb = personalBests.find(p => p.exerciseId === exerciseId);
      if (pb && pb.oneRepMax > 0) {
        // Apply recency decay — recent PBs count more
        const decay = getRecencyFactor(pb.achievedAt);
        const decayed1RM = pb.oneRepMax * decay;
        if (decayed1RM > bestOneRM) {
          bestOneRM = decayed1RM;
          bestExerciseId = exerciseId;
          bestLiftName = exerciseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          bestWeight = pb.bestWeight || 0;
          bestReps = pb.bestReps || 0;
        }
      }
    }
    
    // Calculate tier and progress for this lift
    const { tier, progress } = bestOneRM > 0 
      ? getProgressInTier(bestOneRM, bestExerciseId, isMale)
      : { tier: 'beginner' as StrengthTier, progress: 0 };
    
    // Track lowest tier (determines category tier)
    if (tierOrder.indexOf(tier) < tierOrder.indexOf(lowestTier)) {
      lowestTier = tier;
    }
    
    // Calculate points for this slice
    const points = (sliceDef.weight * progress) / 100;
    
    slices.push({
      id: sliceDef.id,
      name: sliceDef.name,
      weight: sliceDef.weight,
      contributingLift: bestExerciseId,
      liftName: bestLiftName || 'No lift recorded',
      oneRM: bestOneRM,
      bestWeight,
      bestReps,
      tier,
      progressPercent: Math.round(progress * 10) / 10,
      points: Math.round(points * 10) / 10,
    });
  }
  
  // Apply the tier lock rule: if any slice is below category tier, adjust points
  // If a slice's tier is ABOVE category tier, it counts as 100% for POINTS but we keep actual progress for display
  const adjustedSlices = slices.map(slice => {
    const sliceTierIndex = tierOrder.indexOf(slice.tier);
    const categoryTierIndex = tierOrder.indexOf(lowestTier);
    
    if (sliceTierIndex > categoryTierIndex) {
      // Slice is above category tier - counts as 100% for points, but keep actual progress for UI
      return {
        ...slice,
        // Keep the actual progressPercent for UI display (shows where within tier)
        // Only points contribution is maxed out
        points: slice.weight,
      };
    }
    return slice;
  });
  
  // Calculate total points
  const totalPoints = adjustedSlices.reduce((sum, s) => sum + s.points, 0);
  
  return {
    id: categoryDef.id,
    name: categoryDef.name,
    icon: categoryDef.icon,
    tier: lowestTier,
    totalPoints: Math.round(totalPoints * 10) / 10,
    slices: adjustedSlices,
  };
}

/**
 * Calculate full strength rating for all categories
 */
export function calculateFullStrengthRating(
  personalBests: PersonalBest[],
  isMale: boolean = true
): StrengthRating {
  const chest = calculateCategory(categoryDefinitions.chest, personalBests, isMale);
  const back = calculateCategory(categoryDefinitions.back, personalBests, isMale);
  const shoulders = calculateCategory(categoryDefinitions.shoulders, personalBests, isMale);
  const legs = calculateCategory(categoryDefinitions.legs, personalBests, isMale);
  
  // Overall tier is the lowest category tier (only from categories with data)
  const tierOrder: StrengthTier[] = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];
  const allCategories = [chest, back, shoulders, legs];
  const categoriesWithData = allCategories.filter(c => c.totalPoints > 0);
  const allTiers = categoriesWithData.length > 0 
    ? categoriesWithData.map(c => c.tier)
    : allCategories.map(c => c.tier);
  const lowestTierIndex = Math.min(...allTiers.map(t => tierOrder.indexOf(t)));
  const overallTier = tierOrder[lowestTierIndex];
  
  // Overall score: average across ALL 4 categories (0-data categories count as 0)
  // KEY RULE: If a category has surpassed the overall tier, it counts as 100%
  // (e.g., Legs at 35% Intermediate counts as 100% if overall tier is Beginner)
  const overallTierIdx = tierOrder.indexOf(overallTier);
  const categoryScores = allCategories.map(cat => {
    if (cat.totalPoints <= 0) return 0; // no data = 0
    const catTierIdx = tierOrder.indexOf(cat.tier);
    if (catTierIdx > overallTierIdx) {
      return 100; // surpassed overall tier → counts as 100%
    }
    return cat.totalPoints;
  });
  // Always divide by total number of categories (4), not just ones with data
  const overall = Math.round(categoryScores.reduce((a, b) => a + b, 0) / allCategories.length);
  
  return {
    overall,
    overallTier,
    categories: { chest, back, shoulders, legs },
    lastUpdated: new Date().toISOString(),
    // Legacy fields
    push: chest.totalPoints,
    pull: back.totalPoints,
    legs: legs.totalPoints,
    core: 0,
    tier: overallTier,
    breakdown: [],
  };
}
