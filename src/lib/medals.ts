import { MedalDefinition, MedalTier, MedalCategory, MedalRarity, EvolutionGlowTier } from '@/types';

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
  // CONSISTENCY EVOLUTION - Streak medal that evolves (weekly streaks)
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
  
  // STREAK MEDALS (weekly consistency — 1+ workout per Mon-Sun week)
  { id: 'streak-2w', name: '2 Week Streak', description: 'Work out every week for 2 weeks', icon: '🔥', tier: 'bronze', category: 'consistency', rarity: 'common', requirement: '2 week streak', target: 2 },
  { id: 'streak-4w', name: 'Monthly Streak', description: 'Work out every week for 4 weeks', icon: '🔥', tier: 'bronze', category: 'consistency', rarity: 'common', requirement: '4 week streak', target: 4 },
  { id: 'streak-12w', name: 'Quarter Streak', description: 'Work out every week for 12 weeks', icon: '🔥', tier: 'silver', category: 'consistency', rarity: 'uncommon', requirement: '12 week streak', target: 12 },
  { id: 'streak-26w', name: 'Half-Year Streak', description: 'Work out every week for 26 weeks', icon: '🔥', tier: 'gold', category: 'consistency', rarity: 'rare', requirement: '26 week streak', target: 26 },
  { id: 'streak-52w', name: 'Year Streak', description: 'Work out every week for 52 weeks', icon: '🔥', tier: 'platinum', category: 'consistency', rarity: 'epic', requirement: '52 week streak', target: 52 },
  
  // TRAINER MEDALS - Client Count
  { id: 'trainer-first-client', name: 'First Client', description: 'Get your first training client', icon: '👤', tier: 'bronze', category: 'trainer', rarity: 'common', requirement: '1 client', target: 1 },
  { id: 'trainer-5-clients', name: 'Growing Roster', description: 'Train 5 clients', icon: '👥', tier: 'bronze', category: 'trainer', rarity: 'uncommon', requirement: '5 clients', target: 5 },
  { id: 'trainer-10-clients', name: 'Popular Trainer', description: 'Train 10 clients', icon: '🌟', tier: 'silver', category: 'trainer', rarity: 'rare', requirement: '10 clients', target: 10 },
  { id: 'trainer-25-clients', name: 'Client Magnet', description: 'Train 25 clients', icon: '💫', tier: 'gold', category: 'trainer', rarity: 'epic', requirement: '25 clients', target: 25 },
  { id: 'trainer-50-clients', name: 'Training Empire', description: 'Train 50 clients', icon: '👑', tier: 'platinum', category: 'trainer', rarity: 'legendary', requirement: '50 clients', target: 50 },
  
  // TRAINER MEDALS - Sessions Conducted
  { id: 'trainer-first-session', name: 'Session One', description: 'Complete your first training session', icon: '🎯', tier: 'bronze', category: 'trainer', rarity: 'common', requirement: '1 session', target: 1 },
  { id: 'trainer-25-sessions', name: 'Session Pro', description: 'Complete 25 training sessions', icon: '📋', tier: 'bronze', category: 'trainer', rarity: 'uncommon', requirement: '25 sessions', target: 25 },
  { id: 'trainer-100-sessions', name: 'Session Master', description: 'Complete 100 training sessions', icon: '🏆', tier: 'silver', category: 'trainer', rarity: 'rare', requirement: '100 sessions', target: 100 },
  { id: 'trainer-500-sessions', name: 'Session Legend', description: 'Complete 500 training sessions', icon: '⭐', tier: 'gold', category: 'trainer', rarity: 'epic', requirement: '500 sessions', target: 500 },
  { id: 'trainer-1000-sessions', name: 'Session God', description: 'Complete 1000 training sessions', icon: '💎', tier: 'platinum', category: 'trainer', rarity: 'legendary', requirement: '1000 sessions', target: 1000 },
  
  // TRAINER MEDALS - Revenue
  { id: 'trainer-first-payment', name: 'First Dollar', description: 'Receive your first payment', icon: '💵', tier: 'bronze', category: 'trainer', rarity: 'common', requirement: '$1 earned', target: 1 },
  { id: 'trainer-500-revenue', name: 'Side Hustle', description: 'Earn $500 from training', icon: '💰', tier: 'bronze', category: 'trainer', rarity: 'uncommon', requirement: '$500 earned', target: 500 },
  { id: 'trainer-2500-revenue', name: 'Part Timer', description: 'Earn $2,500 from training', icon: '💳', tier: 'silver', category: 'trainer', rarity: 'rare', requirement: '$2,500 earned', target: 2500 },
  { id: 'trainer-10000-revenue', name: 'Full Timer', description: 'Earn $10,000 from training', icon: '🤑', tier: 'gold', category: 'trainer', rarity: 'epic', requirement: '$10,000 earned', target: 10000 },
  { id: 'trainer-50000-revenue', name: 'Fitness Mogul', description: 'Earn $50,000 from training', icon: '💎', tier: 'platinum', category: 'trainer', rarity: 'legendary', requirement: '$50,000 earned', target: 50000 },
  
  // === CARDIO MEDALS ===
  { id: 'cardio-first', name: 'First Sweat', description: 'Complete your first cardio block', icon: '💦', tier: 'bronze', category: 'cardio', rarity: 'common', requirement: 'Complete 1 cardio block', target: 1 },
  { id: 'cardio-10', name: 'Cardio Regular', description: 'Complete 10 cardio blocks', icon: '🫀', tier: 'bronze', category: 'cardio', rarity: 'uncommon', requirement: 'Complete 10 cardio blocks', target: 10 },
  { id: 'cardio-50', name: 'Endurance Engine', description: 'Complete 50 cardio blocks', icon: '⚡', tier: 'silver', category: 'cardio', rarity: 'rare', requirement: 'Complete 50 cardio blocks', target: 50 },
  { id: 'cardio-100', name: 'Cardio Machine', description: 'Complete 100 cardio blocks', icon: '🔋', tier: 'gold', category: 'cardio', rarity: 'epic', requirement: 'Complete 100 cardio blocks', target: 100 },
  { id: 'cardio-30min', name: 'Half Hour Hustle', description: 'Complete a 30+ minute cardio session', icon: '⏱️', tier: 'bronze', category: 'cardio', rarity: 'common', requirement: '30+ min cardio session', target: 1 },
  { id: 'cardio-60min', name: 'Hour of Power', description: 'Complete a 60+ minute cardio session', icon: '🕐', tier: 'silver', category: 'cardio', rarity: 'uncommon', requirement: '60+ min cardio session', target: 1 },
  { id: 'run-5k', name: '5K Runner', description: 'Run 5km in a single session', icon: '🏃', tier: 'bronze', category: 'cardio', rarity: 'uncommon', requirement: 'Run 5km', target: 5000 },
  { id: 'run-10k', name: '10K Runner', description: 'Run 10km in a single session', icon: '🏃‍♂️', tier: 'silver', category: 'cardio', rarity: 'rare', requirement: 'Run 10km', target: 10000 },
  { id: 'row-2k', name: '2K Rower', description: 'Row 2000m in a single session', icon: '🚣', tier: 'bronze', category: 'cardio', rarity: 'uncommon', requirement: 'Row 2000m', target: 2000 },
  { id: 'row-5k', name: '5K Rower', description: 'Row 5000m in a single session', icon: '🚣‍♂️', tier: 'silver', category: 'cardio', rarity: 'rare', requirement: 'Row 5000m', target: 5000 },
  { id: 'calories-500', name: 'Calorie Crusher', description: 'Burn 500+ calories in one session', icon: '🔥', tier: 'bronze', category: 'cardio', rarity: 'uncommon', requirement: 'Burn 500 calories', target: 500 },
  { id: 'calories-1000', name: 'Inferno', description: 'Burn 1000+ calories in one session', icon: '🌋', tier: 'gold', category: 'cardio', rarity: 'epic', requirement: 'Burn 1000 calories', target: 1000 },
  
  // === STRETCH / MOBILITY MEDALS ===
  { id: 'stretch-first', name: 'Limber Up', description: 'Complete your first stretch block', icon: '🧘', tier: 'bronze', category: 'stretch', rarity: 'common', requirement: 'Complete 1 stretch block', target: 1 },
  { id: 'stretch-10', name: 'Flexi Regular', description: 'Complete 10 stretch blocks', icon: '🧘‍♂️', tier: 'bronze', category: 'stretch', rarity: 'uncommon', requirement: 'Complete 10 stretch blocks', target: 10 },
  { id: 'stretch-50', name: 'Mobility Master', description: 'Complete 50 stretch blocks', icon: '🤸', tier: 'silver', category: 'stretch', rarity: 'rare', requirement: 'Complete 50 stretch blocks', target: 50 },
  { id: 'stretch-total-60', name: 'Hour of Zen', description: 'Accumulate 60 minutes total stretching', icon: '🕊️', tier: 'silver', category: 'stretch', rarity: 'uncommon', requirement: '60 min total stretching', target: 3600 },
  { id: 'stretch-total-300', name: 'Flexibility God', description: 'Accumulate 300 minutes total stretching', icon: '🏅', tier: 'gold', category: 'stretch', rarity: 'epic', requirement: '300 min total stretching', target: 18000 },
  
  // === CIRCUIT / HIIT MEDALS ===
  { id: 'circuit-first', name: 'Circuit Starter', description: 'Complete your first circuit block', icon: '🔄', tier: 'bronze', category: 'circuit', rarity: 'common', requirement: 'Complete 1 circuit block', target: 1 },
  { id: 'circuit-10', name: 'Circuit Regular', description: 'Complete 10 circuit blocks', icon: '🔁', tier: 'bronze', category: 'circuit', rarity: 'uncommon', requirement: 'Complete 10 circuit blocks', target: 10 },
  { id: 'circuit-50', name: 'Circuit Beast', description: 'Complete 50 circuit blocks', icon: '⚙️', tier: 'silver', category: 'circuit', rarity: 'rare', requirement: 'Complete 50 circuit blocks', target: 50 },
  { id: 'amrap-first', name: 'AMRAP Warrior', description: 'Complete your first AMRAP', icon: '💥', tier: 'bronze', category: 'circuit', rarity: 'common', requirement: 'Complete 1 AMRAP', target: 1 },
  { id: 'amrap-10', name: 'AMRAP Addict', description: 'Complete 10 AMRAPs', icon: '🎯', tier: 'silver', category: 'circuit', rarity: 'uncommon', requirement: 'Complete 10 AMRAPs', target: 10 },
  { id: 'emom-first', name: 'EMOM Starter', description: 'Complete your first EMOM', icon: '⏰', tier: 'bronze', category: 'circuit', rarity: 'common', requirement: 'Complete 1 EMOM', target: 1 },
  { id: 'emom-10', name: 'EMOM Master', description: 'Complete 10 EMOMs', icon: '⏲️', tier: 'silver', category: 'circuit', rarity: 'uncommon', requirement: 'Complete 10 EMOMs', target: 10 },
  { id: 'fortime-pr', name: 'Against The Clock', description: 'Beat your previous "For Time" result', icon: '⚡', tier: 'silver', category: 'circuit', rarity: 'rare', requirement: 'Beat For Time PR', target: 1 },
  
  // === VO2 MAX MEDALS (when health data connected) ===
  { id: 'vo2-good', name: 'Good Fitness', description: 'VO2 Max reaches "Good" range', icon: '🫁', tier: 'bronze', category: 'cardio', rarity: 'uncommon', requirement: 'VO2 Max >= 35', target: 35 },
  { id: 'vo2-excellent', name: 'Excellent Fitness', description: 'VO2 Max reaches "Excellent" range', icon: '🫁', tier: 'silver', category: 'cardio', rarity: 'rare', requirement: 'VO2 Max >= 45', target: 45 },
  { id: 'vo2-elite', name: 'Elite Cardio', description: 'VO2 Max reaches "Elite" range', icon: '🫁', tier: 'gold', category: 'cardio', rarity: 'epic', requirement: 'VO2 Max >= 55', target: 55 },
  
  // === ADDITIONAL STRENGTH MEDALS (from strength standards) ===
  // PULL-UP
  { id: 'pullup-bw', name: 'First Pull-Up', description: 'Complete a bodyweight pull-up', icon: '🏋️', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Bodyweight pull-up', target: 1 },
  { id: 'pullup-10', name: 'Weighted Pull-Up +10', description: 'Pull-up with +10kg', icon: '🏋️', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Pull-up +10kg', target: 10 },
  { id: 'pullup-25', name: 'Weighted Pull-Up +25', description: 'Pull-up with +25kg', icon: '🏋️', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Pull-up +25kg', target: 25 },
  { id: 'pullup-40', name: 'Pull-Up Beast', description: 'Pull-up with +40kg', icon: '🏋️', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Pull-up +40kg', target: 40 },
  
  // T-BAR ROW
  { id: 'tbar-35', name: 'T-Bar Starter', description: 'T-Bar Row 35kg', icon: '🔩', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'T-Bar Row 35kg', target: 35 },
  { id: 'tbar-54', name: 'T-Bar Builder', description: 'T-Bar Row 54kg', icon: '🔩', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'T-Bar Row 54kg', target: 54 },
  { id: 'tbar-75', name: 'T-Bar Warrior', description: 'T-Bar Row 75kg', icon: '🔩', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'T-Bar Row 75kg', target: 75 },
  { id: 'tbar-102', name: 'T-Bar Elite', description: 'T-Bar Row 102kg', icon: '🔩', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'T-Bar Row 102kg', target: 102 },
  { id: 'tbar-130', name: 'T-Bar Legend', description: 'T-Bar Row 130kg', icon: '🔩', tier: 'platinum', category: 'strength', rarity: 'legendary', requirement: 'T-Bar Row 130kg', target: 130 },
  
  // DUMBBELL BENCH PRESS
  { id: 'dbbench-15', name: 'DB Bench Starter', description: 'Dumbbell Bench Press 15kg each', icon: '🏋️‍♂️', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'DB Bench 15kg', target: 15 },
  { id: 'dbbench-23', name: 'DB Bench Builder', description: 'Dumbbell Bench Press 23kg each', icon: '🏋️‍♂️', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'DB Bench 23kg', target: 23 },
  { id: 'dbbench-32', name: 'DB Bench Warrior', description: 'Dumbbell Bench Press 32kg each', icon: '🏋️‍♂️', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'DB Bench 32kg', target: 32 },
  { id: 'dbbench-44', name: 'DB Bench Elite', description: 'Dumbbell Bench Press 44kg each', icon: '🏋️‍♂️', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'DB Bench 44kg', target: 44 },
  
  // DUMBBELL SHOULDER PRESS
  { id: 'dbohp-13', name: 'DB Press Starter', description: 'DB Shoulder Press 13kg each', icon: '🎯', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'DB OHP 13kg', target: 13 },
  { id: 'dbohp-20', name: 'DB Press Builder', description: 'DB Shoulder Press 20kg each', icon: '🎯', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'DB OHP 20kg', target: 20 },
  { id: 'dbohp-28', name: 'DB Press Warrior', description: 'DB Shoulder Press 28kg each', icon: '🎯', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'DB OHP 28kg', target: 28 },
  { id: 'dbohp-38', name: 'DB Press Elite', description: 'DB Shoulder Press 38kg each', icon: '🎯', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'DB OHP 38kg', target: 38 },
  
  // HIP THRUST
  { id: 'hipthrust-38', name: 'Hip Thrust Starter', description: 'Hip Thrust 38kg', icon: '🍑', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'Hip Thrust 38kg', target: 38 },
  { id: 'hipthrust-76', name: 'Hip Thrust Builder', description: 'Hip Thrust 76kg', icon: '🍑', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'Hip Thrust 76kg', target: 76 },
  { id: 'hipthrust-129', name: 'Hip Thrust Warrior', description: 'Hip Thrust 129kg', icon: '🍑', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'Hip Thrust 129kg', target: 129 },
  { id: 'hipthrust-196', name: 'Hip Thrust Elite', description: 'Hip Thrust 196kg', icon: '🍑', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'Hip Thrust 196kg', target: 196 },
  
  // BULGARIAN SPLIT SQUAT
  { id: 'bss-10', name: 'BSS Starter', description: 'Bulgarian Split Squat 10kg each', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'common', requirement: 'BSS 10kg', target: 10 },
  { id: 'bss-18', name: 'BSS Builder', description: 'Bulgarian Split Squat 18kg each', icon: '🦵', tier: 'bronze', category: 'strength', rarity: 'uncommon', requirement: 'BSS 18kg', target: 18 },
  { id: 'bss-30', name: 'BSS Warrior', description: 'Bulgarian Split Squat 30kg each', icon: '🦵', tier: 'silver', category: 'strength', rarity: 'rare', requirement: 'BSS 30kg', target: 30 },
  { id: 'bss-44', name: 'BSS Elite', description: 'Bulgarian Split Squat 44kg each', icon: '🦵', tier: 'gold', category: 'strength', rarity: 'epic', requirement: 'BSS 44kg', target: 44 },
];

// === EVOLUTION GLOW SYSTEM ===
// Medals that do NOT evolve (streaks are tier-locked by streak length, powerlifting clubs are one-time)
export const NON_EVOLVING_MEDAL_IDS = new Set([
  'streak-2w', 'streak-4w', 'streak-12w', 'streak-26w', 'streak-52w',
  '300-club', '400-club', '500-club', '1000lb-club', '600-club',
]);

// Calculate evolution glow tier from timesEarned
// Every medal evolves the same way: 5x = gold, 20x = diamond, 50x = pink diamond
export function getEvolutionGlowTier(timesEarned: number, medalId?: string): EvolutionGlowTier {
  if (medalId && NON_EVOLVING_MEDAL_IDS.has(medalId)) return 'base';
  if (timesEarned >= 50) return 'pink_diamond_glow';
  if (timesEarned >= 20) return 'diamond_glow';
  if (timesEarned >= 5) return 'gold_glow';
  return 'base';
}

// Get CSS class for evolution glow
export function getEvolutionGlowClass(tier: EvolutionGlowTier): string {
  switch (tier) {
    case 'gold_glow': return 'medal-glow-gold';
    case 'diamond_glow': return 'medal-glow-diamond';
    case 'pink_diamond_glow': return 'medal-glow-pink-diamond';
    default: return '';
  }
}

// Get CSS class for evolution frame
export function getEvolutionFrameClass(tier: EvolutionGlowTier): string {
  switch (tier) {
    case 'gold_glow': return 'medal-frame-gold';
    case 'diamond_glow': return 'medal-frame-diamond';
    case 'pink_diamond_glow': return 'medal-frame-pink-diamond';
    default: return '';
  }
}

// Get human-readable label for evolution tier
export function getEvolutionLabel(tier: EvolutionGlowTier): string {
  switch (tier) {
    case 'gold_glow': return 'Gold';
    case 'diamond_glow': return 'Diamond';
    case 'pink_diamond_glow': return 'Pink Diamond';
    default: return '';
  }
}

// Get next evolution threshold (how many timesEarned needed for next glow)
export function getNextEvolutionThreshold(timesEarned: number): number | null {
  if (timesEarned < 5) return 5;
  if (timesEarned < 20) return 20;
  if (timesEarned < 50) return 50;
  return null; // Max evolution reached (pink diamond)
}

// Get evolution number (0-3) for display
export function getEvolutionNumber(timesEarned: number): number {
  if (timesEarned >= 50) return 3;
  if (timesEarned >= 20) return 2;
  if (timesEarned >= 5) return 1;
  return 0;
}

// Check if a medal is close to evolving (within 20% of next threshold or <=2 away)
export function isCloseToEvolving(timesEarned: number, medalId?: string): { close: boolean; next: number | null; remaining: number } {
  if (medalId && NON_EVOLVING_MEDAL_IDS.has(medalId)) return { close: false, next: null, remaining: 0 };
  const next = getNextEvolutionThreshold(timesEarned);
  if (!next) return { close: false, next: null, remaining: 0 };
  const remaining = next - timesEarned;
  const threshold = Math.max(2, Math.ceil(next * 0.2)); // within 20% or 2
  return { close: remaining <= threshold, next, remaining };
}

// Filter medals by mode — trainer medals only in trainer mode
export function isTrainerMedal(medalId: string): boolean {
  return medalId.startsWith('trainer-');
}

// Medal priority order (1 = highest priority)
export const MEDAL_PRIORITY: Record<string, number> = {
  'milestone': 1,   // Exercise-specific weight achievements (highest)
  'strength': 1,    // Strength milestones (same as milestone)
  'trainer': 1,     // Trainer milestones (clients, revenue, sessions)
  'cardio': 2,      // Cardio milestones
  'circuit': 2,     // Circuit/HIIT milestones
  'stretch': 2,     // Stretch/mobility milestones
  'consistency': 3, // Streak medals
  'workout': 4,     // Workout count medals
  'special': 4,     // Special achievements
  'social': 5,      // Social/evolving medals (lowest)
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
