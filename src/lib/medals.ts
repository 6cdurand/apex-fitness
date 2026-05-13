import { MedalDefinition, MedalTier, MedalCategory, MedalRarity, EvolutionGlowTier, EvolutionSpeed } from '@/types';

// Rarity determines how difficult/rare a medal is to obtain
// Common = most users will get, Legendary = very few will achieve
export type { MedalRarity };

// Evolution medals - same medal evolves through tiers as you progress
// Each evolution tier has increasing targets
export interface EvolvingMedal {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: MedalCategory;
  rarity: MedalRarity;
  evolutions: {
    tier: MedalTier;
    target: number;
    requirement: string;
  }[];
}

// v9-03 REWRITE: Reduced from ~150 to ~30 medals
// Three categories: Foundation (1), Strength (12), Consistency & Milestones (18)
export const evolvingMedals: EvolvingMedal[] = [
  // Workout count evolution
  {
    id: 'workout-warrior',
    name: 'Workout Warrior',
    description: 'Complete workouts to evolve this medal',
    icon: '💪',
    category: 'workout',
    rarity: 'uncommon',
    evolutions: [
      { tier: 'bronze', target: 1, requirement: 'Complete 1 workout' },
      { tier: 'silver', target: 10, requirement: 'Complete 10 workouts' },
      { tier: 'gold', target: 50, requirement: 'Complete 50 workouts' },
      { tier: 'platinum', target: 100, requirement: 'Complete 100 workouts' },
      { tier: 'diamond', target: 250, requirement: 'Complete 250 workouts' },
    ],
  },
  // Streak evolution
  {
    id: 'streak-master',
    name: 'Streak Master',
    description: 'Maintain weekly workout streaks to evolve',
    icon: '🔥',
    category: 'consistency',
    rarity: 'uncommon',
    evolutions: [
      { tier: 'bronze', target: 2, requirement: '2 week streak' },
      { tier: 'silver', target: 4, requirement: '4 week streak' },
      { tier: 'gold', target: 12, requirement: '12 week streak' },
      { tier: 'platinum', target: 26, requirement: '26 week streak' },
      { tier: 'diamond', target: 52, requirement: '52 week streak' },
    ],
  },
  // Volume evolution
  {
    id: 'iron-lifter',
    name: 'Iron Lifter',
    description: 'Accumulate total volume to evolve',
    icon: '🏋️',
    category: 'milestone',
    rarity: 'uncommon',
    evolutions: [
      { tier: 'bronze', target: 10000, requirement: 'Lift 10,000kg total' },
      { tier: 'silver', target: 50000, requirement: 'Lift 50,000kg total' },
      { tier: 'gold', target: 100000, requirement: 'Lift 100,000kg total' },
      { tier: 'platinum', target: 500000, requirement: 'Lift 500,000kg total' },
      { tier: 'diamond', target: 1000000, requirement: 'Lift 1,000,000kg total' },
    ],
  },
];

export const milestoneMedals: MedalDefinition[] = [
  // === CATEGORY 1: FOUNDATION (1 medal) ===
  { 
    id: 'first-workout', 
    name: 'First Workout', 
    description: 'Complete your first Catalift session', 
    icon: '💪', 
    tier: 'bronze', 
    category: 'workout', 
    rarity: 'common', 
    requirement: 'Complete 1 workout', 
    target: 1 
  },

  // === CATEGORY 2: STRENGTH (12 medals) ===
  // Bench Press
  { 
    id: 'bench-100', 
    name: 'Two Plate Club', 
    description: 'Bench press 100kg (2 plates)', 
    icon: '🏋️', 
    tier: 'silver', 
    category: 'strength', 
    rarity: 'rare', 
    requirement: 'Bench 100kg 1RM', 
    target: 100, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'bench-140', 
    name: 'Advanced Bench', 
    description: 'Bench press 140kg', 
    icon: '🥇', 
    tier: 'gold', 
    category: 'strength', 
    rarity: 'epic', 
    requirement: 'Bench 140kg 1RM', 
    target: 140, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'bench-180', 
    name: 'Elite Bench', 
    description: 'Bench press 180kg', 
    icon: '💎', 
    tier: 'platinum', 
    category: 'strength', 
    rarity: 'legendary', 
    requirement: 'Bench 180kg 1RM', 
    target: 180, 
    evolutionSpeed: 'very_slow' 
  },

  // Squat
  { 
    id: 'squat-140', 
    name: 'Intermediate Squat', 
    description: 'Squat 140kg', 
    icon: '🦵', 
    tier: 'silver', 
    category: 'strength', 
    rarity: 'rare', 
    requirement: 'Squat 140kg 1RM', 
    target: 140, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'squat-180', 
    name: 'Advanced Squat', 
    description: 'Squat 180kg', 
    icon: '🔱', 
    tier: 'gold', 
    category: 'strength', 
    rarity: 'epic', 
    requirement: 'Squat 180kg 1RM', 
    target: 180, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'squat-220', 
    name: 'Elite Squat', 
    description: 'Squat 220kg', 
    icon: '👑', 
    tier: 'platinum', 
    category: 'strength', 
    rarity: 'legendary', 
    requirement: 'Squat 220kg 1RM', 
    target: 220, 
    evolutionSpeed: 'very_slow' 
  },

  // Deadlift
  { 
    id: 'deadlift-140', 
    name: 'Intermediate Pull', 
    description: 'Deadlift/RDL 140kg', 
    icon: '💀', 
    tier: 'silver', 
    category: 'strength', 
    rarity: 'rare', 
    requirement: 'Deadlift 140kg 1RM', 
    target: 140, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'deadlift-180', 
    name: 'Advanced Pull', 
    description: 'Deadlift/RDL 180kg', 
    icon: '☠️', 
    tier: 'gold', 
    category: 'strength', 
    rarity: 'epic', 
    requirement: 'Deadlift 180kg 1RM', 
    target: 180, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'deadlift-220', 
    name: 'Elite Pull', 
    description: 'Deadlift/RDL 220kg', 
    icon: '⚡', 
    tier: 'platinum', 
    category: 'strength', 
    rarity: 'legendary', 
    requirement: 'Deadlift 220kg 1RM', 
    target: 220, 
    evolutionSpeed: 'very_slow' 
  },

  // OHP
  { 
    id: 'ohp-60', 
    name: 'Intermediate Press', 
    description: 'Overhead Press 60kg', 
    icon: '🎯', 
    tier: 'silver', 
    category: 'strength', 
    rarity: 'rare', 
    requirement: 'OHP 60kg 1RM', 
    target: 60, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'ohp-80', 
    name: 'Advanced Press', 
    description: 'Overhead Press 80kg', 
    icon: '🎯', 
    tier: 'gold', 
    category: 'strength', 
    rarity: 'epic', 
    requirement: 'OHP 80kg 1RM', 
    target: 80, 
    evolutionSpeed: 'very_slow' 
  },
  { 
    id: 'ohp-100', 
    name: 'Elite Press', 
    description: 'Overhead Press 100kg', 
    icon: '🎯', 
    tier: 'platinum', 
    category: 'strength', 
    rarity: 'legendary', 
    requirement: 'OHP 100kg 1RM', 
    target: 100, 
    evolutionSpeed: 'very_slow' 
  },

  // v11-D4: Assisted-graduation medals (3 medals)
  {
    id: 'pull-up-graduate',
    name: 'Pull-Up Graduate',
    description: 'Performed your first unassisted pull-up after progressing through assisted variants.',
    icon: '🎓',
    tier: 'gold',
    category: 'strength',
    rarity: 'epic',
    requirement: 'First unassisted pull-up after assisted history',
    target: 1,
    evolutionSpeed: 'medium'
  },
  {
    id: 'chin-up-graduate',
    name: 'Chin-Up Graduate',
    description: 'First unassisted chin-up after assisted-variant work.',
    icon: '🎓',
    tier: 'gold',
    category: 'strength',
    rarity: 'epic',
    requirement: 'First unassisted chin-up after assisted history',
    target: 1,
    evolutionSpeed: 'medium'
  },
  {
    id: 'dips-graduate',
    name: 'Dips Graduate',
    description: 'First unassisted dip after assisted-variant work.',
    icon: '🎓',
    tier: 'gold',
    category: 'strength',
    rarity: 'epic',
    requirement: 'First unassisted dip after assisted history',
    target: 1,
    evolutionSpeed: 'medium'
  },

  // === CATEGORY 3: CONSISTENCY & MILESTONES (18 medals) ===
  
  // Workout count milestones
  { 
    id: 'workouts-50', 
    name: 'Committed', 
    description: 'Complete 50 workouts', 
    icon: '🔥', 
    tier: 'silver', 
    category: 'workout', 
    rarity: 'uncommon', 
    requirement: 'Complete 50 workouts', 
    target: 50 
  },
  { 
    id: 'workouts-100', 
    name: 'Centurion', 
    description: 'Complete 100 workouts', 
    icon: '⚔️', 
    tier: 'gold', 
    category: 'workout', 
    rarity: 'rare', 
    requirement: 'Complete 100 workouts', 
    target: 100 
  },
  { 
    id: 'workouts-250', 
    name: 'Veteran', 
    description: 'Complete 250 workouts', 
    icon: '🛡️', 
    tier: 'platinum', 
    category: 'workout', 
    rarity: 'epic', 
    requirement: 'Complete 250 workouts', 
    target: 250 
  },
  { 
    id: 'workouts-500', 
    name: 'Legend', 
    description: 'Complete 500 workouts', 
    icon: '👑', 
    tier: 'platinum', 
    category: 'workout', 
    rarity: 'epic', 
    requirement: 'Complete 500 workouts', 
    target: 500 
  },
  { 
    id: 'workouts-1000', 
    name: 'Iron Soul', 
    description: 'Complete 1000 workouts', 
    icon: '💫', 
    tier: 'diamond', 
    category: 'workout', 
    rarity: 'legendary', 
    requirement: 'Complete 1000 workouts', 
    target: 1000 
  },

  // Volume cumulative
  { 
    id: 'volume-50k', 
    name: 'Iron Worker', 
    description: 'Lift 50,000kg total volume', 
    icon: '🏋️‍♂️', 
    tier: 'silver', 
    category: 'milestone', 
    rarity: 'uncommon', 
    requirement: 'Lift 50,000kg total', 
    target: 50000 
  },
  { 
    id: 'volume-100k', 
    name: 'Iron Master', 
    description: 'Lift 100,000kg total volume', 
    icon: '💎', 
    tier: 'gold', 
    category: 'milestone', 
    rarity: 'rare', 
    requirement: 'Lift 100,000kg total', 
    target: 100000 
  },
  { 
    id: 'volume-500k', 
    name: 'Iron King', 
    description: 'Lift 500,000kg total volume', 
    icon: '👑', 
    tier: 'platinum', 
    category: 'milestone', 
    rarity: 'epic', 
    requirement: 'Lift 500,000kg total', 
    target: 500000 
  },
  { 
    id: 'volume-1m', 
    name: 'Million Kilo Club', 
    description: 'Lift 1,000,000kg total volume', 
    icon: '⚡', 
    tier: 'diamond', 
    category: 'milestone', 
    rarity: 'legendary', 
    requirement: 'Lift 1,000,000kg total', 
    target: 1000000 
  },

  // SBD totals
  { 
    id: 'sbd-400', 
    name: '400kg Club', 
    description: 'Combined SBD total of 400kg', 
    icon: '🏅', 
    tier: 'silver', 
    category: 'strength', 
    rarity: 'rare', 
    requirement: 'SBD total 400kg', 
    target: 400 
  },
  { 
    id: 'sbd-500', 
    name: '500kg Club', 
    description: 'Combined SBD total of 500kg', 
    icon: '🎯', 
    tier: 'gold', 
    category: 'strength', 
    rarity: 'epic', 
    requirement: 'SBD total 500kg', 
    target: 500 
  },
  { 
    id: 'sbd-600', 
    name: '600kg Club', 
    description: 'Combined SBD total of 600kg', 
    icon: '💎', 
    tier: 'platinum', 
    category: 'strength', 
    rarity: 'legendary', 
    requirement: 'SBD total 600kg', 
    target: 600 
  },
  { 
    id: 'sbd-1000lb', 
    name: '1000lb Club', 
    description: 'Combined SBD total of 454kg (1000lbs)', 
    icon: '🏆', 
    tier: 'gold', 
    category: 'strength', 
    rarity: 'epic', 
    requirement: 'SBD total 454kg', 
    target: 454 
  },

  // Weekly streaks
  { 
    id: 'streak-4w', 
    name: 'Monthly Streak', 
    description: 'Work out every week for 4 weeks', 
    icon: '🔥', 
    tier: 'bronze', 
    category: 'consistency', 
    rarity: 'uncommon', 
    requirement: '4 week streak', 
    target: 4 
  },
  { 
    id: 'streak-12w', 
    name: 'Quarter', 
    description: 'Work out every week for 12 weeks', 
    icon: '🔥', 
    tier: 'silver', 
    category: 'consistency', 
    rarity: 'rare', 
    requirement: '12 week streak', 
    target: 12 
  },
  { 
    id: 'streak-26w', 
    name: 'Half-Year', 
    description: 'Work out every week for 26 weeks', 
    icon: '🔥', 
    tier: 'gold', 
    category: 'consistency', 
    rarity: 'epic', 
    requirement: '26 week streak', 
    target: 26 
  },
  { 
    id: 'streak-52w', 
    name: 'Year-Strong', 
    description: 'Work out every week for 52 weeks', 
    icon: '🔥', 
    tier: 'platinum', 
    category: 'consistency', 
    rarity: 'legendary', 
    requirement: '52 week streak', 
    target: 52 
  },
];

// Non-evolving medals (single milestone, no timesEarned glow evolution)
export const NON_EVOLVING_MEDAL_IDS = new Set([
  'first-workout', 'workouts-50', 'workouts-100', 'workouts-250', 'workouts-500', 'workouts-1000',
  'volume-50k', 'volume-100k', 'volume-500k', 'volume-1m',
  'streak-4w', 'streak-12w', 'streak-26w', 'streak-52w',
  'sbd-400', 'sbd-500', 'sbd-600', 'sbd-1000lb',
  'bench-100', 'bench-140', 'bench-180',
  'squat-140', 'squat-180', 'squat-220',
  'deadlift-140', 'deadlift-180', 'deadlift-220',
  'ohp-60', 'ohp-80', 'ohp-100',
]);

// Variable evolution speed thresholds: [gold, diamond, pink_diamond]
const EVOLUTION_SPEED_THRESHOLDS: Record<EvolutionSpeed, [number, number, number]> = {
  fast:      [3,  10, 25],
  medium:    [5,  15, 40],
  slow:      [5,  20, 50],
  very_slow: [10, 30, 75],
};

export function getSpeedThresholds(speed?: EvolutionSpeed): [number, number, number] {
  return EVOLUTION_SPEED_THRESHOLDS[speed || 'slow'];
}

export function getMedalEvolutionSpeed(medalId: string): EvolutionSpeed {
  const def = milestoneMedals.find(m => m.id === medalId);
  return def?.evolutionSpeed || 'slow';
}

// Calculate evolution glow tier from timesEarned
export function getEvolutionGlowTier(timesEarned: number, medalId?: string, speed?: EvolutionSpeed): EvolutionGlowTier {
  if (medalId && NON_EVOLVING_MEDAL_IDS.has(medalId)) return 'base';
  const resolvedSpeed = speed || (medalId ? getMedalEvolutionSpeed(medalId) : 'slow');
  const [gold, diamond, pink] = getSpeedThresholds(resolvedSpeed);
  if (timesEarned >= pink) return 'pink_diamond_glow';
  if (timesEarned >= diamond) return 'diamond_glow';
  if (timesEarned >= gold) return 'gold_glow';
  return 'base';
}

export function getEvolutionGlowLabel(tier: EvolutionGlowTier): string {
  switch (tier) {
    case 'gold_glow': return 'Gold';
    case 'diamond_glow': return 'Diamond';
    case 'pink_diamond_glow': return 'Pink Diamond';
    default: return '';
  }
}

export function getNextEvolutionThreshold(timesEarned: number, medalId?: string, speed?: EvolutionSpeed): number | null {
  const resolvedSpeed = speed || (medalId ? getMedalEvolutionSpeed(medalId) : 'slow');
  const [gold, diamond, pink] = getSpeedThresholds(resolvedSpeed);
  if (timesEarned < gold) return gold;
  if (timesEarned < diamond) return diamond;
  if (timesEarned < pink) return pink;
  return null;
}

export function getEvolutionNumber(timesEarned: number, medalId?: string, speed?: EvolutionSpeed): number {
  const resolvedSpeed = speed || (medalId ? getMedalEvolutionSpeed(medalId) : 'slow');
  const [gold, diamond, pink] = getSpeedThresholds(resolvedSpeed);
  if (timesEarned >= pink) return 3;
  if (timesEarned >= diamond) return 2;
  if (timesEarned >= gold) return 1;
  return 0;
}

export function isCloseToEvolving(timesEarned: number, medalId?: string, speed?: EvolutionSpeed): { close: boolean; next: number | null; remaining: number } {
  if (medalId && NON_EVOLVING_MEDAL_IDS.has(medalId)) return { close: false, next: null, remaining: 0 };
  const next = getNextEvolutionThreshold(timesEarned, medalId, speed);
  if (!next) return { close: false, next: null, remaining: 0 };
  const remaining = next - timesEarned;
  const threshold = Math.max(2, Math.ceil(next * 0.2));
  return { close: remaining <= threshold, next, remaining };
}

export function isTrainerMedal(medalId: string): boolean {
  return medalId.startsWith('trainer-');
}

export const MEDAL_PRIORITY: Record<string, number> = {
  'milestone': 1,
  'strength': 1,
  'trainer': 1,
  'cardio': 2,
  'circuit': 2,
  'stretch': 2,
  'consistency': 3,
  'workout': 4,
  'special': 4,
  'social': 5,
};

export function getMedalPriority(medal: MedalDefinition): number {
  return MEDAL_PRIORITY[medal.category] || 99;
}

export function sortMedalsByPriority(medals: MedalDefinition[]): MedalDefinition[] {
  return [...medals].sort((a, b) => {
    const priorityDiff = getMedalPriority(a) - getMedalPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    return (rarityOrder[a.rarity] || 5) - (rarityOrder[b.rarity] || 5);
  });
}

export const medalDefinitions: MedalDefinition[] = milestoneMedals;

export function getMedalDefinition(definitionId: string): MedalDefinition | undefined {
  return medalDefinitions.find(m => m.id === definitionId);
}

export function getEvolvingMedal(medalId: string): EvolvingMedal | undefined {
  return evolvingMedals.find(m => m.id === medalId);
}

export function getMedalsByCategory(category: MedalCategory): MedalDefinition[] {
  return medalDefinitions.filter(m => m.category === category);
}

export function getMedalsByTier(tier: MedalTier): MedalDefinition[] {
  return medalDefinitions.filter(m => m.tier === tier);
}

export function getMedalsByRarity(rarity: MedalRarity): MedalDefinition[] {
  return medalDefinitions.filter(m => m.rarity === rarity);
}

export function getCurrentEvolutionTier(medal: EvolvingMedal, progress: number): { tier: MedalTier; nextTarget: number | null; currentTarget: number } {
  let currentTier: MedalTier = 'bronze';
  let currentTarget = 0;
  let nextTarget: number | null = medal.evolutions[0].target;
  
  for (let i = 0; i < medal.evolutions.length; i++) {
    const evo = medal.evolutions[i];
    if (progress >= evo.target) {
      currentTier = evo.tier;
      currentTarget = evo.target;
      nextTarget = medal.evolutions[i + 1]?.target ?? null;
    } else {
      break;
    }
  }
  
  return { tier: currentTier, nextTarget, currentTarget };
}

export function getTierColor(tier: MedalTier): string {
  switch (tier) {
    case 'bronze': return 'from-amber-700 to-amber-900';
    case 'silver': return 'from-gray-300 to-gray-500';
    case 'gold': return 'from-yellow-400 to-yellow-600';
    case 'platinum': return 'from-cyan-300 to-cyan-500';
    case 'diamond': return 'from-purple-400 to-blue-500';
  }
}

export function getTierTextColor(tier: MedalTier): string {
  switch (tier) {
    case 'bronze': return 'text-amber-600';
    case 'silver': return 'text-gray-400';
    case 'gold': return 'text-yellow-500';
    case 'platinum': return 'text-cyan-400';
    case 'diamond': return 'text-purple-400';
  }
}

export function getRarityColor(rarity: MedalRarity): string {
  switch (rarity) {
    case 'common': return 'text-gray-400 bg-gray-500/20';
    case 'uncommon': return 'text-green-400 bg-green-500/20';
    case 'rare': return 'text-blue-400 bg-blue-500/20';
    case 'epic': return 'text-purple-400 bg-purple-500/20';
    case 'legendary': return 'text-orange-400 bg-orange-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}

export function getRarityLabel(rarity: MedalRarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

export function getEvolutionGlowClass(tier: EvolutionGlowTier): string {
  switch (tier) {
    case 'gold_glow': return 'medal-glow-gold';
    case 'diamond_glow': return 'medal-glow-diamond';
    case 'pink_diamond_glow': return 'medal-glow-pink-diamond';
    default: return '';
  }
}

export function getEvolutionFrameClass(tier: EvolutionGlowTier): string {
  switch (tier) {
    case 'gold_glow': return 'medal-frame-gold';
    case 'diamond_glow': return 'medal-frame-diamond';
    case 'pink_diamond_glow': return 'medal-frame-pink-diamond';
    default: return '';
  }
}

export function getEvolutionLabel(tier: EvolutionGlowTier): string {
  switch (tier) {
    case 'gold_glow': return 'Gold';
    case 'diamond_glow': return 'Diamond';
    case 'pink_diamond_glow': return 'Pink Diamond';
    default: return '';
  }
}
