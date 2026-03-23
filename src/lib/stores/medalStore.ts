import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Medal, StrengthRating, PersonalBest, Workout } from '@/types';
import { useAuthStore } from './authStore';
import { syncMedalToSupabase } from '../supabaseSync';

// Lazy import to avoid circular dep with workoutStore
let _workoutStore: any = null;
const getWorkoutStore = () => { if (!_workoutStore) _workoutStore = require('./workoutStore').useWorkoutStore; return _workoutStore; };

interface MedalState {
  medals: Medal[];
  evolvingMedalProgress: Record<string, number>; // medalId -> progress
  strengthRating: StrengthRating | null;
  
  // Medal actions
  earnMedal: (definitionId: string, forUserId?: string) => void;
  updateEvolvingMedalProgress: (medalId: string, progress: number) => void;
  getMedalsByCategory: (category: Medal['category']) => Medal[];
  getMedalsForUser: (userId: string) => Medal[];
  hasMedal: (definitionId: string, userId?: string) => boolean;
  revokeMedalsForUser: (userId: string) => void;
  clearMedalsForUser: (userId: string) => void;
  clearAllMedals: () => void;
  
  // Strength rating
  calculateStrengthRating: () => void;
  calculateStrengthRatingForUser: (userId: string) => StrengthRating | null;
  getStrengthRating: () => StrengthRating | null;
}

export const useMedalStore = create<MedalState>()(
  persist(
    (set, get) => ({
      medals: [],
      evolvingMedalProgress: {},
      strengthRating: null,

      earnMedal: (definitionId, forUserId?: string) => {
        const userId = forUserId || useAuthStore.getState().user?.id || '';
        const existingMedal = get().medals.find(m => m.definitionId === definitionId && m.userId === userId);
        
        // If already earned, increment timesEarned counter and update evolution
        if (existingMedal?.earned) {
          const { getEvolutionGlowTier, getEvolutionLabel } = require('../medals');
          const newTimesEarned = (existingMedal.timesEarned || 1) + 1;
          const oldEvolutionTier = existingMedal.evolutionTier || 'base';
          const newEvolutionTier = getEvolutionGlowTier(newTimesEarned, definitionId);
          const updatedMedal = {
            ...existingMedal,
            timesEarned: newTimesEarned,
            evolutionTier: newEvolutionTier,
          };
          set(state => ({
            medals: state.medals.map(m => 
              m.definitionId === definitionId && m.userId === userId ? updatedMedal : m
            ),
          }));
          syncMedalToSupabase(updatedMedal);
          return;
        }

        // Import medal definitions dynamically to avoid circular deps
        const { milestoneMedals } = require('../medals');
        const definition = milestoneMedals.find((m: any) => m.id === definitionId);
        if (!definition) return;
        
        const newMedal: Medal = {
          id: uuidv4(),
          userId,
          definitionId,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          tier: definition.tier,
          category: definition.category,
          rarity: definition.rarity,
          earned: true,
          earnedAt: new Date().toISOString(),
          progress: definition.target || 1,
          target: definition.target || 1,
          timesEarned: 1,
          evolutionTier: 'base',
        };

        set(state => ({
          medals: existingMedal 
            ? state.medals.map(m => m.definitionId === definitionId ? newMedal : m)
            : [...state.medals, newMedal],
        }));

        // Sync medal to Supabase
        syncMedalToSupabase(newMedal);
      },

      updateEvolvingMedalProgress: (medalId, progress) => {
        set(state => ({
          evolvingMedalProgress: {
            ...state.evolvingMedalProgress,
            [medalId]: progress,
          },
        }));
      },

      getMedalsByCategory: (category) => {
        return get().medals.filter(m => m.category === category);
      },

      getMedalsForUser: (userId: string) => {
        return get().medals.filter(m => m.userId === userId);
      },

      hasMedal: (definitionId, userId?: string) => {
        const targetUserId = userId || useAuthStore.getState().user?.id;
        return get().medals.some(m => m.definitionId === definitionId && m.earned && m.userId === targetUserId);
      },

      revokeMedalsForUser: (userId: string) => {
        // Silently clear all medals for user (used by deriveAll revoke-and-re-earn cycle)
        set(state => ({
          medals: state.medals.filter(m => m.userId !== userId),
        }));
      },

      clearMedalsForUser: (userId: string) => {
        set(state => ({
          medals: state.medals.filter(m => m.userId !== userId),
        }));
      },

      clearAllMedals: () => {
        set({ medals: [], evolvingMedalProgress: {} });
      },

      calculateStrengthRating: () => {
        const { personalBests } = getWorkoutStore().getState() as { personalBests: PersonalBest[] };
        const user = useAuthStore.getState().user;
        
        if (!user) {
          set({ strengthRating: null });
          return;
        }
        
        // Filter personal bests for the current user only
        const userPBs = personalBests.filter((pb: PersonalBest) => pb.userId === user.id);
        
        if (userPBs.length === 0) {
          set({ strengthRating: null });
          return;
        }

        const isMale = user.gender === 'male';
        
        // Use the new comprehensive strength rating calculation
        const { calculateFullStrengthRating } = require('../strengthRating');
        const rating = calculateFullStrengthRating(userPBs, isMale);

        set({ strengthRating: rating });
      },

      calculateStrengthRatingForUser: (userId: string) => {
        const { personalBests } = getWorkoutStore().getState() as { personalBests: PersonalBest[] };
        
        // Filter personal bests for the specified user
        const userPBs = personalBests.filter((pb: PersonalBest) => pb.userId === userId);
        
        if (userPBs.length === 0) {
          console.log(`[MedalStore] No PBs found for user ${userId}`);
          return null;
        }

        // Look up user gender - check current user first, then stored users
        const currentUser = useAuthStore.getState().user;
        let isMale = true; // Default
        
        if (currentUser?.id === userId) {
          isMale = currentUser.gender !== 'female';
        } else {
          // Check stored users (clients)
          try {
            const storedUsers = JSON.parse(localStorage.getItem('apex-users') || '[]');
            const targetUser = storedUsers.find((u: any) => u.id === userId);
            if (targetUser?.gender === 'female') {
              isMale = false;
            }
          } catch (e) {
            console.error('[MedalStore] Error looking up user gender:', e);
          }
        }
        
        console.log(`[MedalStore] Calculating strength rating for ${userId} (${isMale ? 'male' : 'female'}), ${userPBs.length} PBs`);
        
        const { calculateFullStrengthRating } = require('../strengthRating');
        const rating = calculateFullStrengthRating(userPBs, isMale);
        
        // Store in state if this is the current user
        if (currentUser?.id === userId && rating) {
          set({ strengthRating: rating });
        }
        
        return rating;
      },

      getStrengthRating: () => {
        return get().strengthRating;
      },
    }),
    {
      name: 'apex-medals',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ============ RETROACTIVE MEDAL CHECK ============
// Runs on app load to award medals for existing stats (industry standard: Strava, Apple Fitness, Garmin all do this)
export function checkAllMedalsRetroactive(userId: string) {
  const { earnMedal, hasMedal } = useMedalStore.getState();
  const { workoutHistory, personalBests } = getWorkoutStore().getState() as { workoutHistory: Workout[]; personalBests: PersonalBest[] };
  const userWorkouts = workoutHistory.filter((w: Workout) => w.userId === userId && w.status === 'completed');
  const userPBs = personalBests.filter((pb: PersonalBest) => pb.userId === userId);
  let awarded = 0;

  // --- WORKOUT COUNT ---
  const workoutCount = userWorkouts.length;
  const wcMedals: [string, number][] = [
    ['first-blood', 1], ['getting-started', 5], ['dedicated', 25], ['committed', 50], ['centurion', 100],
  ];
  for (const [id, threshold] of wcMedals) {
    if (workoutCount >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
  }

  // --- VOLUME ---
  const totalVolume = userWorkouts.reduce((sum: number, w: Workout) => sum + (w.totalVolume || 0), 0);
  const volMedals: [string, number][] = [
    ['volume-10k', 10000], ['volume-50k', 50000], ['volume-100k', 100000],
  ];
  for (const [id, threshold] of volMedals) {
    if (totalVolume >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
  }

  // --- PR COUNT ---
  const pbCount = userPBs.length;
  const prMedals: [string, number][] = [
    ['first-pr', 1], ['pr-hunter', 10], ['pr-collector', 25],
  ];
  for (const [id, threshold] of prMedals) {
    if (pbCount >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
  }

  // --- STRENGTH MEDALS (from existing PBs) ---
  const { normalizeExerciseId } = require('../exerciseStats');
  
  // Map of exercise ID patterns → medal checks
  const strengthChecks: { match: string[]; medals: [string, number][] }[] = [
    { match: ['bench-press', 'dumbbell-bench-press'], medals: [['bench-common', 50], ['bench-uncommon', 70], ['bench-rare', 100], ['bench-epic', 130], ['bench-legendary', 160]] },
    { match: ['squat', 'back-squat'], medals: [['squat-common', 64], ['squat-uncommon', 93], ['squat-rare', 130], ['squat-epic', 173], ['squat-legendary', 219]] },
    { match: ['deadlift', 'romanian-deadlift', 'rdl'], medals: [['deadlift-common', 55], ['deadlift-uncommon', 84], ['deadlift-rare', 120], ['deadlift-epic', 164], ['deadlift-legendary', 211]] },
    { match: ['lat-pulldown', 'rope-pulldown'], medals: [['lat-common', 38], ['lat-uncommon', 58], ['lat-rare', 82], ['lat-epic', 110], ['lat-legendary', 141]] },
    { match: ['barbell-row', 'bent-over-row', 'seated-row', 'cable-row', 'seated-cable-row'], medals: [['row-common', 41], ['row-uncommon', 61], ['row-rare', 86], ['row-epic', 115], ['row-legendary', 147]] },
    { match: ['overhead-press', 'military-press', 'dumbbell-shoulder-press', 'machine-shoulder-press'], medals: [['ohp-common', 30], ['ohp-uncommon', 45], ['ohp-rare', 64], ['ohp-epic', 87], ['ohp-legendary', 112]] },
    { match: ['leg-press', 'leg-press-machine'], medals: [['legpress-common', 86], ['legpress-uncommon', 147], ['legpress-rare', 226], ['legpress-epic', 324], ['legpress-legendary', 432]] },
    { match: ['leg-extension'], medals: [['legext-common', 20], ['legext-uncommon', 40], ['legext-rare', 60], ['legext-epic', 90], ['legext-legendary', 120]] },
    { match: ['leg-curl', 'lying-leg-curl'], medals: [['legcurl-common', 20], ['legcurl-uncommon', 35], ['legcurl-rare', 50], ['legcurl-epic', 75], ['legcurl-legendary', 100]] },
    { match: ['machine-chest-press', 'chest-press'], medals: [['chestpress-common', 20], ['chestpress-uncommon', 35], ['chestpress-rare', 50], ['chestpress-epic', 75], ['chestpress-legendary', 100]] },
    { match: ['pull-up', 'pull-ups', 'weighted-pull-up'], medals: [['pullup-bw', 0], ['pullup-10', 10], ['pullup-25', 25], ['pullup-40', 40]] },
    { match: ['t-bar-row', 'tbar-row', 'landmine-row'], medals: [['tbar-35', 35], ['tbar-54', 54], ['tbar-75', 75], ['tbar-102', 102], ['tbar-130', 130]] },
    { match: ['dumbbell-bench-press', 'db-bench-press'], medals: [['dbbench-15', 15], ['dbbench-23', 23], ['dbbench-32', 32], ['dbbench-44', 44]] },
    { match: ['dumbbell-shoulder-press', 'db-shoulder-press'], medals: [['dbohp-13', 13], ['dbohp-20', 20], ['dbohp-28', 28], ['dbohp-38', 38]] },
    { match: ['hip-thrust', 'barbell-hip-thrust'], medals: [['hipthrust-38', 38], ['hipthrust-76', 76], ['hipthrust-129', 129], ['hipthrust-196', 196]] },
    { match: ['bulgarian-split-squat', 'split-squat'], medals: [['bss-10', 10], ['bss-18', 18], ['bss-30', 30], ['bss-44', 44]] },
  ];

  for (const pb of userPBs) {
    const normId = normalizeExerciseId(pb.exerciseId);
    for (const check of strengthChecks) {
      if (check.match.includes(normId)) {
        for (const [medalId, threshold] of check.medals) {
          if (pb.bestWeight >= threshold && !hasMedal(medalId, userId)) { earnMedal(medalId, userId); awarded++; }
        }
      }
    }
  }

  // --- POWERLIFTING TOTAL ---
  const benchPB = userPBs.find((p: PersonalBest) => ['bench-press', 'barbell-bench-press'].includes(normalizeExerciseId(p.exerciseId)));
  const squatPB = userPBs.find((p: PersonalBest) => ['squat', 'back-squat'].includes(normalizeExerciseId(p.exerciseId)));
  const deadliftPB = userPBs.find((p: PersonalBest) => ['deadlift'].includes(normalizeExerciseId(p.exerciseId)));
  if (benchPB && squatPB && deadliftPB) {
    const sbdTotal = (benchPB.oneRepMax || 0) + (squatPB.oneRepMax || 0) + (deadliftPB.oneRepMax || 0);
    const plMedals: [string, number][] = [
      ['300-club', 300], ['400-club', 400], ['1000lb-club', 454], ['500-club', 500], ['600-club', 600],
    ];
    for (const [id, threshold] of plMedals) {
      if (sbdTotal >= threshold && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; }
    }
  }

  // --- CARDIO / STRETCH / CIRCUIT BLOCK COUNTS ---
  let totalCardioBlocks = 0;
  let totalStretchBlocks = 0;
  let totalCircuitBlocks = 0;
  let totalAmraps = 0;
  let totalEmoms = 0;

  userWorkouts.forEach((w: Workout) => {
    const blocks = (w as any).blocks || [];
    const exTypes = (w.exercises || []).map((ex: any) => ex.blockType).filter(Boolean);
    if (blocks.some((b: any) => b.type === 'cardio') || exTypes.includes('cardio')) totalCardioBlocks++;
    if (blocks.some((b: any) => b.type === 'cooldown') || exTypes.includes('cooldown') ||
        (w.exercises || []).some((ex: any) => ex.exercise?.category === 'stretching')) totalStretchBlocks++;
    blocks.forEach((b: any) => {
      if (b.type === 'circuit') {
        totalCircuitBlocks++;
        if (b.circuitStyle === 'amrap') totalAmraps++;
        if (b.circuitStyle === 'emom') totalEmoms++;
      }
    });
    if (exTypes.includes('circuit') && !blocks.some((b: any) => b.type === 'circuit')) totalCircuitBlocks++;
  });

  // Cardio medals
  const cardioMedals: [string, number][] = [['cardio-first', 1], ['cardio-10', 10], ['cardio-50', 50], ['cardio-100', 100]];
  for (const [id, t] of cardioMedals) { if (totalCardioBlocks >= t && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; } }
  // Stretch medals
  const stretchMedals: [string, number][] = [['stretch-first', 1], ['stretch-10', 10], ['stretch-50', 50]];
  for (const [id, t] of stretchMedals) { if (totalStretchBlocks >= t && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; } }
  // Circuit medals
  const circuitMedals: [string, number][] = [['circuit-first', 1], ['circuit-10', 10], ['circuit-50', 50]];
  for (const [id, t] of circuitMedals) { if (totalCircuitBlocks >= t && !hasMedal(id, userId)) { earnMedal(id, userId); awarded++; } }
  if (totalAmraps >= 1 && !hasMedal('amrap-first', userId)) { earnMedal('amrap-first', userId); awarded++; }
  if (totalAmraps >= 10 && !hasMedal('amrap-10', userId)) { earnMedal('amrap-10', userId); awarded++; }
  if (totalEmoms >= 1 && !hasMedal('emom-first', userId)) { earnMedal('emom-first', userId); awarded++; }
  if (totalEmoms >= 10 && !hasMedal('emom-10', userId)) { earnMedal('emom-10', userId); awarded++; }

  // --- SPECIAL MEDALS ---
  // Variety king (20 different exercises used)
  const uniqueExercises = new Set<string>();
  userWorkouts.forEach((w: Workout) => (w.exercises || []).forEach((ex: any) => uniqueExercises.add(ex.exerciseId)));
  if (uniqueExercises.size >= 20 && !hasMedal('variety-king', userId)) { earnMedal('variety-king', userId); awarded++; }

  // Early bird / Night owl (check workout start times)
  userWorkouts.forEach((w: Workout) => {
    const hour = new Date(w.startTime).getHours();
    if (hour < 6 && !hasMedal('early-bird', userId)) { earnMedal('early-bird', userId); awarded++; }
    if (hour >= 22 && !hasMedal('night-owl', userId)) { earnMedal('night-owl', userId); awarded++; }
  });

  // Marathon session (2+ hours)
  if (userWorkouts.some((w: Workout) => (w.duration || 0) >= 7200) && !hasMedal('marathon-session', userId)) {
    earnMedal('marathon-session', userId); awarded++;
  }

  console.log(`[RetroactiveMedals] Scanned ${userWorkouts.length} workouts, ${userPBs.length} PBs → awarded ${awarded} medals`);
  return awarded;
}
