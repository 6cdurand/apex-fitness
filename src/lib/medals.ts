import { MedalDefinition, MedalTier, MedalCategory, MedalRarity } from '@/types';

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

// Evolving medals - progress through tiers with the same medal
export const evolvingMedals: EvolvingMedal[] = [
  // WORKOUT EVOLUTION - Single medal that evolves
  {
    id: 'workout-warrior',
    name: 'Workout Warrior',
    description: 'Complete workouts to evolve this medal',
    icon: '💪',
    category: 'workout',
    rarity: 'common',
    evolutions: [
      { tier: 'bronze', target: 1, requirement: 'Complete 1 workout' },
      { tier: 'silver', target: 10, requirement: 'Complete 10 workouts' },
      { tier: 'gold', target: 50, requirement: 'Complete 50 workouts' },
      { tier: 'platinum', target: 100, requirement: 'Complete 100 workouts' },
      { tier: 'diamond', target: 250, requirement: 'Complete 250 workouts' },
    ],
  },
  // CONSISTENCY EVOLUTION - Streak medal that evolves
  {
    id: 'streak-master',
    name: 'Streak Master',
    description: 'Maintain workout streaks to evolve',
    icon: '🔥',
    category: 'consistency',
    rarity: 'uncommon',
    evolutions: [
      { tier: 'bronze', target: 7, requirement: '7 day streak' },
      { tier: 'silver', target: 14, requirement: '14 day streak' },
      { tier: 'gold', target: 30, requirement: '30 day streak' },
      { tier: 'platinum', target: 60, requirement: '60 day streak' },
      { tier: 'diamond', target: 100, requirement: '100 day streak' },
    ],
  },
  // VOLUME EVOLUTION - Total volume lifted
  {
    id: 'iron-lifter',
    name: 'Iron Lifter',
    description: 'Accumulate total volume to evolve',
    icon: '🏋️',
    category: 'milestone',
    rarity: 'common',
    evolutions: [
      { tier: 'bronze', target: 10000, requirement: 'Lift 10,000kg total' },
      { tier: 'silver', target: 50000, requirement: 'Lift 50,000kg total' },
      { tier: 'gold', target: 100000, requirement: 'Lift 100,000kg total' },
      { tier: 'platinum', target: 500000, requirement: 'Lift 500,000kg total' },
      { tier: 'diamond', target: 1000000, requirement: 'Lift 1,000,000kg total' },
    ],
  },
  // PR HUNTER EVOLUTION
  {
    id: 'pr-collector',
    name: 'PR Collector',
    description: 'Set personal records to evolve',
    icon: '🏆',
    category: 'strength',
    rarity: 'uncommon',
    evolutions: [
      { tier: 'bronze', target: 1, requirement: 'Set 1 PR' },
      { tier: 'silver', target: 10, requirement: 'Set 10 PRs' },
      { tier: 'gold', target: 25, requirement: 'Set 25 PRs' },
      { tier: 'platinum', target: 50, requirement: 'Set 50 PRs' },
      { tier: 'diamond', target: 100, requirement: 'Set 100 PRs' },
    ],
  },
  // SOCIAL EVOLUTION
  {
    id: 'community-builder',
    name: 'Community Builder',
    description: 'Grow your network to evolve',
    icon: '🤝',
    category: 'social',
    rarity: 'common',
    evolutions: [
      { tier: 'bronze', target: 1, requirement: 'Follow 1 person' },
      { tier: 'silver', target: 10, requirement: 'Follow 10 people' },
      { tier: 'gold', target: 25, requirement: 'Follow 25 people' },
      { tier: 'platinum', target: 50, requirement: 'Follow 50 people' },
      { tier: 'diamond', target: 100, requirement: 'Follow 100 people' },
    ],
  },
];

// Milestone medals - one-time achievements with fixed rarity
export const milestoneMedals: MedalDefinition[] = [
  // WORKOUT COUNT MILESTONES
  { id: 'first-blood', name: 'First Blood', description: 'Complete your first workout', icon: '💪', tier: 'bronze', category: 'workout', rarity: 'common', requirement: 'Complete 1 workout', target: 1 },
  { id: 'getting-started', name: 'Getting Started', description: 'Complete 5 workouts', icon: '🏃', tier: 'bronze', category: 'workout', rarity: 'common', requirement: 'Complete 5 workouts', target: 5 },
  { id: 'dedicated', name: 'Dedicated', description: 'Complete 25 workouts', icon: '🎯', tier: 'silver', category: 'workout', rarity: 'uncommon', requirement: 'Complete 25 workouts', target: 25 },
  { id: 'committed', name: 'Committed', description: 'Complete 50 workouts', icon: '🔥', tier: 'gold', category: 'workout', rarity: 'rare', requirement: 'Complete 50 workouts', target: 50 },
  { id: 'centurion', name: 'Centurion', description: 'Complete 100 workouts', icon: '⚔️', tier: 'platinum', category: 'workout', rarity: 'epic', requirement: 'Complete 100 workouts', target: 100 },
  
  // VOLUME MILESTONES  
  { id: 'volume-10k', name: 'Iron Starter', description: 'Lift 10,000kg total volume', icon: '🏋️', tier: 'bronze', category: 'milestone', rarity: 'common', requirement: 'Lift 10,000kg total', target: 10000 },
  { id: 'volume-50k', name: 'Iron Worker', description: 'Lift 50,000kg total volume', icon: '🏋️‍♂️', tier: 'silver', category: 'milestone', rarity: 'uncommon', requirement: 'Lift 50,000kg total', target: 50000 },
  { id: 'volume-100k', name: 'Iron Master', description: 'Lift 100,000kg total volume', icon: '💎', tier: 'gold', category: 'milestone', rarity: 'rare', requirement: 'Lift 100,000kg total', target: 100000 },
  
  // PR MILESTONES
  { id: 'first-pr', name: 'First PR', description: 'Set your first personal record', icon: '🏆', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Set 1 PR', target: 1 },
  { id: 'pr-hunter', name: 'PR Hunter', description: 'Set 10 personal records', icon: '🎖️', tier: 'silver', category: 'strength', rarity: 'uncommon', requirement: 'Set 10 PRs', target: 10 },
  { id: 'pr-collector', name: 'PR Collector', description: 'Set 25 personal records', icon: '👑', tier: 'gold', category: 'strength', rarity: 'rare', requirement: 'Set 25 PRs', target: 25 },
  
  // FLAT BENCH PRESS MILESTONES (Male: 50/70/100/130/160)
  { id: 'bench-common', name: 'Bench Beginner', description: 'Bench press 50kg', icon: '🏋️', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Bench 50kg 1RM', target: 50 },
  { id: 'bench-uncommon', name: 'Bench Builder', description: 'Bench press 70kg', icon: '🏋️', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Bench 70kg 1RM', target: 70 },
  { id: 'bench-rare', name: 'Two Plate Club', description: 'Bench press 100kg (2 plates)', icon: '🥈', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Bench 100kg 1RM', target: 100 },
  { id: 'bench-epic', name: 'Bench Elite', description: 'Bench press 130kg', icon: '🥇', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Bench 130kg 1RM', target: 130 },
  { id: 'bench-legendary', name: 'Bench Legend', description: 'Bench press 160kg', icon: '💎', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Bench 160kg 1RM', target: 160 },
  
  // SQUAT MILESTONES (Male: 64/93/130/173/219)
  { id: 'squat-common', name: 'Squat Starter', description: 'Squat 64kg', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Squat 64kg 1RM', target: 64 },
  { id: 'squat-uncommon', name: 'Squat Builder', description: 'Squat 93kg', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Squat 93kg 1RM', target: 93 },
  { id: 'squat-rare', name: 'Squat Warrior', description: 'Squat 130kg', icon: '🦿', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Squat 130kg 1RM', target: 130 },
  { id: 'squat-epic', name: 'Squat Beast', description: 'Squat 173kg', icon: '🔱', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Squat 173kg 1RM', target: 173 },
  { id: 'squat-legendary', name: 'Squat Legend', description: 'Squat 219kg', icon: '👑', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Squat 219kg 1RM', target: 219 },
  
  // DEADLIFT/RDL MILESTONES (Male: 55/84/120/164/211)
  { id: 'deadlift-common', name: 'Deadlift Starter', description: 'Deadlift/RDL 55kg', icon: '💀', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Deadlift 55kg 1RM', target: 55 },
  { id: 'deadlift-uncommon', name: 'Deadlift Builder', description: 'Deadlift/RDL 84kg', icon: '💀', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Deadlift 84kg 1RM', target: 84 },
  { id: 'deadlift-rare', name: 'Deadlift Warrior', description: 'Deadlift/RDL 120kg', icon: '☠️', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Deadlift 120kg 1RM', target: 120 },
  { id: 'deadlift-epic', name: 'Deadlift King', description: 'Deadlift/RDL 164kg', icon: '👊', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Deadlift 164kg 1RM', target: 164 },
  { id: 'deadlift-legendary', name: 'Deadlift God', description: 'Deadlift/RDL 211kg', icon: '⚡', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Deadlift 211kg 1RM', target: 211 },
  
  // LAT PULLDOWN MILESTONES (Male: 38/58/82/110/141)
  { id: 'lat-common', name: 'Lat Beginner', description: 'Lat Pulldown 38kg', icon: '🔙', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Lat Pulldown 38kg', target: 38 },
  { id: 'lat-uncommon', name: 'Lat Builder', description: 'Lat Pulldown 58kg', icon: '🔙', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Lat Pulldown 58kg', target: 58 },
  { id: 'lat-rare', name: 'Lat Warrior', description: 'Lat Pulldown 82kg', icon: '🔙', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Lat Pulldown 82kg', target: 82 },
  { id: 'lat-epic', name: 'Lat Elite', description: 'Lat Pulldown 110kg', icon: '🔙', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Lat Pulldown 110kg', target: 110 },
  { id: 'lat-legendary', name: 'Lat Legend', description: 'Lat Pulldown 141kg', icon: '🔙', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Lat Pulldown 141kg', target: 141 },
  
  // ROW MILESTONES (Male: 41/61/86/115/147)
  { id: 'row-common', name: 'Row Starter', description: 'Row 41kg', icon: '🚣', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Row 41kg', target: 41 },
  { id: 'row-uncommon', name: 'Row Builder', description: 'Row 61kg', icon: '🚣', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Row 61kg', target: 61 },
  { id: 'row-rare', name: 'Row Warrior', description: 'Row 86kg', icon: '🚣', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Row 86kg', target: 86 },
  { id: 'row-epic', name: 'Row Elite', description: 'Row 115kg', icon: '🚣', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Row 115kg', target: 115 },
  { id: 'row-legendary', name: 'Row Legend', description: 'Row 147kg', icon: '🚣', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Row 147kg', target: 147 },
  
  // SHOULDER PRESS MILESTONES (Male: 30/45/64/87/112)
  { id: 'ohp-common', name: 'OHP Starter', description: 'Overhead Press 30kg', icon: '🎯', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'OHP 30kg 1RM', target: 30 },
  { id: 'ohp-uncommon', name: 'OHP Builder', description: 'Overhead Press 45kg', icon: '🎯', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'OHP 45kg 1RM', target: 45 },
  { id: 'ohp-rare', name: 'OHP Warrior', description: 'Overhead Press 64kg', icon: '🎯', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'OHP 64kg 1RM', target: 64 },
  { id: 'ohp-epic', name: 'OHP Elite', description: 'Overhead Press 87kg', icon: '🎯', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'OHP 87kg 1RM', target: 87 },
  { id: 'ohp-legendary', name: 'OHP Legend', description: 'Overhead Press 112kg', icon: '🎯', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'OHP 112kg 1RM', target: 112 },
  
  // LEG PRESS MILESTONES (Male: 86/147/226/324/432)
  { id: 'legpress-common', name: 'Leg Press Starter', description: 'Leg Press 86kg', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Leg Press 86kg', target: 86 },
  { id: 'legpress-uncommon', name: 'Leg Press Builder', description: 'Leg Press 147kg', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Leg Press 147kg', target: 147 },
  { id: 'legpress-rare', name: 'Leg Press Warrior', description: 'Leg Press 226kg', icon: '🦵', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Leg Press 226kg', target: 226 },
  { id: 'legpress-epic', name: 'Leg Press Elite', description: 'Leg Press 324kg', icon: '🦵', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Leg Press 324kg', target: 324 },
  { id: 'legpress-legendary', name: 'Leg Press Legend', description: 'Leg Press 432kg', icon: '🦵', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Leg Press 432kg', target: 432 },
  
  // LEG EXTENSION MILESTONES (20/40/60/90/120)
  { id: 'legext-common', name: 'Leg Ext Starter', description: 'Leg Extension 20kg', icon: '🦿', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Leg Extension 20kg', target: 20 },
  { id: 'legext-uncommon', name: 'Leg Ext Builder', description: 'Leg Extension 40kg', icon: '🦿', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Leg Extension 40kg', target: 40 },
  { id: 'legext-rare', name: 'Leg Ext Warrior', description: 'Leg Extension 60kg', icon: '🦿', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Leg Extension 60kg', target: 60 },
  { id: 'legext-epic', name: 'Leg Ext Elite', description: 'Leg Extension 90kg', icon: '🦿', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Leg Extension 90kg', target: 90 },
  { id: 'legext-legendary', name: 'Leg Ext Legend', description: 'Leg Extension 120kg', icon: '🦿', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Leg Extension 120kg', target: 120 },
  
  // LEG CURL MILESTONES (20/35/50/75/100)
  { id: 'legcurl-common', name: 'Leg Curl Starter', description: 'Leg Curl 20kg', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Leg Curl 20kg', target: 20 },
  { id: 'legcurl-uncommon', name: 'Leg Curl Builder', description: 'Leg Curl 35kg', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Leg Curl 35kg', target: 35 },
  { id: 'legcurl-rare', name: 'Leg Curl Warrior', description: 'Leg Curl 50kg', icon: '🦵', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Leg Curl 50kg', target: 50 },
  { id: 'legcurl-epic', name: 'Leg Curl Elite', description: 'Leg Curl 75kg', icon: '🦵', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Leg Curl 75kg', target: 75 },
  { id: 'legcurl-legendary', name: 'Leg Curl Legend', description: 'Leg Curl 100kg', icon: '🦵', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Leg Curl 100kg', target: 100 },
  
  // CHEST PRESS (MACHINE) MILESTONES (20/35/50/75/100)
  { id: 'chestpress-common', name: 'Chest Press Starter', description: 'Machine Chest Press 20kg', icon: '💪', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Chest Press 20kg', target: 20 },
  { id: 'chestpress-uncommon', name: 'Chest Press Builder', description: 'Machine Chest Press 35kg', icon: '💪', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Chest Press 35kg', target: 35 },
  { id: 'chestpress-rare', name: 'Chest Press Warrior', description: 'Machine Chest Press 50kg', icon: '💪', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Chest Press 50kg', target: 50 },
  { id: 'chestpress-epic', name: 'Chest Press Elite', description: 'Machine Chest Press 75kg', icon: '💪', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Chest Press 75kg', target: 75 },
  { id: 'chestpress-legendary', name: 'Chest Press Legend', description: 'Machine Chest Press 100kg', icon: '💪', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'Chest Press 100kg', target: 100 },
  
  // POWERLIFTING TOTAL MILESTONES
  { id: '300-club', name: '300kg Club', description: 'Combined SBD total of 300kg', icon: '🎖️', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'SBD total 300kg', target: 300 },
  { id: '400-club', name: '400kg Club', description: 'Combined SBD total of 400kg', icon: '🏅', tier: 'silver', category: 'strength', rarity: 'uncommon', requirement: 'SBD total 400kg', target: 400 },
  { id: '500-club', name: '500kg Club', description: 'Combined SBD total of 500kg', icon: '🎯', tier: 'gold', category: 'strength', rarity: 'rare', requirement: 'SBD total 500kg', target: 500 },
  { id: '1000lb-club', name: '1000lb Club', description: 'Combined SBD total of 454kg (1000lbs)', icon: '🏆', tier: 'gold', category: 'strength', rarity: 'rare', requirement: 'SBD total 454kg', target: 454 },
  { id: '600-club', name: '600kg Club', description: 'Combined SBD total of 600kg', icon: '💎', tier: 'platinum', category: 'strength', rarity: 'epic', requirement: 'SBD total 600kg', target: 600 },
  
  // SPECIAL ACHIEVEMENTS
  { id: 'early-bird', name: 'Early Bird', description: 'Complete a workout before 6am', icon: '🌅', tier: 'bronze', category: 'special', rarity: 'uncommon', requirement: 'Workout before 6am', target: 1 },
  { id: 'night-owl', name: 'Night Owl', description: 'Complete a workout after 10pm', icon: '🦉', tier: 'bronze', category: 'special', rarity: 'uncommon', requirement: 'Workout after 10pm', target: 1 },
  { id: 'marathon-session', name: 'Marathon Session', description: 'Complete a 2+ hour workout', icon: '⏱️', tier: 'silver', category: 'special', rarity: 'rare', requirement: '2+ hour workout', target: 1 },
  { id: 'variety-king', name: 'Jack of All Trades', description: 'Use 20 different exercises', icon: '🎰', tier: 'silver', category: 'special', rarity: 'uncommon', requirement: 'Use 20 exercises', target: 20 },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Complete all sets in a workout at 100%', icon: '✅', tier: 'bronze', category: 'special', rarity: 'common', requirement: '100% set completion', target: 1 },
  { id: 'weekly-warrior', name: 'Weekly Warrior', description: 'Work out 5+ days in a single week', icon: '📅', tier: 'silver', category: 'consistency', rarity: 'uncommon', requirement: '5 workouts in 7 days', target: 5 },
  
  // STREAK MEDALS (consistency)
  { id: 'streak-3', name: '3 Day Streak', description: 'Work out 3 days in a row', icon: '🔥', tier: 'bronze', category: 'consistency', rarity: 'common', requirement: '3 day streak', target: 3 },
  { id: 'streak-7', name: 'Week Warrior', description: 'Work out 7 days in a row', icon: '🔥', tier: 'bronze', category: 'consistency', rarity: 'common', requirement: '7 day streak', target: 7 },
  { id: 'streak-14', name: 'Fortnight Fighter', description: 'Work out 14 days in a row', icon: '🔥', tier: 'silver', category: 'consistency', rarity: 'uncommon', requirement: '14 day streak', target: 14 },
  { id: 'streak-30', name: 'Monthly Master', description: 'Work out 30 days in a row', icon: '🔥', tier: 'gold', category: 'consistency', rarity: 'rare', requirement: '30 day streak', target: 30 },
  { id: 'streak-60', name: 'Iron Will', description: 'Work out 60 days in a row', icon: '🔥', tier: 'platinum', category: 'consistency', rarity: 'epic', requirement: '60 day streak', target: 60 },
  { id: 'streak-100', name: 'Unstoppable', description: 'Work out 100 days in a row', icon: '🔥', tier: 'diamond', category: 'consistency', rarity: 'legendary', requirement: '100 day streak', target: 100 },
];

// Medal priority order (1 = highest priority)
export const MEDAL_PRIORITY: Record<string, number> = {
  'milestone': 1,   // Exercise-specific weight achievements (highest)
  'strength': 1,    // Strength milestones (same as milestone)
  'consistency': 2, // Streak medals
  'workout': 3,     // Workout count medals
  'special': 3,     // Special achievements
  'social': 4,      // Social/evolving medals (lowest)
};

// Get medal priority (lower = higher priority)
export function getMedalPriority(medal: MedalDefinition): number {
  return MEDAL_PRIORITY[medal.category] || 99;
}

// Sort medals by priority (milestone first, then streak, then others)
export function sortMedalsByPriority(medals: MedalDefinition[]): MedalDefinition[] {
  return [...medals].sort((a, b) => {
    const priorityDiff = getMedalPriority(a) - getMedalPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    // Within same priority, sort by rarity (legendary first)
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    return (rarityOrder[a.rarity] || 5) - (rarityOrder[b.rarity] || 5);
  });
}

// Legacy export for backward compatibility
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

// Get current evolution tier based on progress
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
