// PGIF Template System - Phase/Goal/Injury/Frequency
import { TrainingPhase, TrainingGoal, InjuryFlag, MovementPattern } from '@/types';

// ============ PHASE DEFINITIONS ============
export interface PhaseConfig {
  id: TrainingPhase;
  name: string;
  description: string;
  color: string;
  colorHex: string;
  reps: { min: number; max: number };
  sets: number;
  restSeconds: { min: number; max: number };
  intensity: string;
  focus: string[];
  workoutsToProgress: number;
}

export const PHASE_CONFIGS: Record<TrainingPhase, PhaseConfig> = {
  foundation: {
    id: 'foundation',
    name: 'Foundation / Base',
    description: 'Build confidence, movement patterns, and consistency. Machine-led, simple progressions.',
    color: 'emerald',
    colorHex: '#10b981',
    reps: { min: 12, max: 15 },
    sets: 3,
    restSeconds: { min: 60, max: 90 },
    intensity: 'RPE 6-7',
    focus: ['Confidence', 'Consistency', 'Movement Quality', 'Habit Building'],
    workoutsToProgress: 24,
  },
  strength: {
    id: 'strength',
    name: 'Strength',
    description: 'Progressive overload focus. Heavier loads, compound movements.',
    color: 'blue',
    colorHex: '#3b82f6',
    reps: { min: 6, max: 8 },
    sets: 4,
    restSeconds: { min: 90, max: 120 },
    intensity: 'RPE 7-8',
    focus: ['Load Progression', 'Compound Lifts', 'Strength Gains'],
    workoutsToProgress: 36,
  },
  performance: {
    id: 'performance',
    name: 'Performance',
    description: 'Power and athletic performance. Complex movements, peak outputs.',
    color: 'purple',
    colorHex: '#8b5cf6',
    reps: { min: 3, max: 5 },
    sets: 5,
    restSeconds: { min: 120, max: 180 },
    intensity: 'RPE 8-9',
    focus: ['Power', 'Speed', 'Peak Performance', 'Sport-Specific'],
    workoutsToProgress: 24,
  },
  return: {
    id: 'return',
    name: 'Return / Rehab',
    description: 'Recovery-focused programming. Light loads, high reps, movement restoration.',
    color: 'orange',
    colorHex: '#f97316',
    reps: { min: 15, max: 20 },
    sets: 2,
    restSeconds: { min: 45, max: 60 },
    intensity: 'RPE 4-6',
    focus: ['Recovery', 'Mobility', 'Pain Reduction', 'Movement Restoration'],
    workoutsToProgress: 12,
  },
};

// ============ GOAL DEFINITIONS ============
export interface GoalConfig {
  id: TrainingGoal;
  name: string;
  description: string;
  icon: string;
}

export const GOAL_CONFIGS: Record<TrainingGoal, GoalConfig> = {
  fat_loss: { id: 'fat_loss', name: 'Fat Loss', description: 'Higher volume, shorter rest', icon: '🔥' },
  hypertrophy: { id: 'hypertrophy', name: 'Muscle Building', description: 'Time under tension focus', icon: '💪' },
  strength: { id: 'strength', name: 'Strength', description: 'Heavy loads, lower reps', icon: '🏋️' },
  conditioning: { id: 'conditioning', name: 'Conditioning', description: 'Cardio and circuits', icon: '❤️' },
  mobility: { id: 'mobility', name: 'Mobility', description: 'Range of motion focus', icon: '🧘' },
  general: { id: 'general', name: 'General Fitness', description: 'Balanced approach', icon: '⚡' },
  powerlifting: { id: 'powerlifting', name: 'Powerlifting', description: 'SBD competition focus', icon: '🥇' },
  athletic_performance: { id: 'athletic_performance', name: 'Athletic', description: 'Sport-specific power', icon: '🏃' },
  pain_reduction: { id: 'pain_reduction', name: 'Pain Reduction', description: 'Therapeutic focus', icon: '🩹' },
};

// ============ INJURY DEFINITIONS ============
export const INJURY_CONFIGS: Record<InjuryFlag, { name: string; modifyMovements: MovementPattern[] }> = {
  shoulder: { name: 'Shoulder', modifyMovements: ['push', 'pull'] },
  knee: { name: 'Knee', modifyMovements: ['squat', 'lunge'] },
  back: { name: 'Lower Back', modifyMovements: ['hinge', 'squat'] },
  hip: { name: 'Hip', modifyMovements: ['squat', 'hinge', 'lunge'] },
  ankle: { name: 'Ankle', modifyMovements: ['squat', 'lunge'] },
  wrist: { name: 'Wrist', modifyMovements: ['push'] },
  neck: { name: 'Neck', modifyMovements: ['push', 'pull'] },
  none: { name: 'None', modifyMovements: [] },
};

// ============ TEMPLATE INTERFACE ============
export interface PGIFTemplate {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  phase: TrainingPhase;
  goals: TrainingGoal[];
  injuryWarnings: InjuryFlag[];
  frequency: number;
  structure: 'full_body' | 'upper_lower' | 'push_pull_legs' | 'split' | 'circuit';
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  days: PGIFTemplateDay[];
  isUserTemplate?: boolean;
  isPTOnly?: boolean;
}

export interface PGIFTemplateDay {
  dayNumber: number;
  dayLabel: string;
  focus: string;
  blocks: PGIFTemplateBlock[];
}

export interface PGIFTemplateBlock {
  type: 'warmup' | 'work' | 'cooldown';
  name: string;
  exercises: PGIFTemplateExercise[];
}

export interface PGIFTemplateExercise {
  exerciseId: string;
  exerciseName: string;
  movementPattern: MovementPattern;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  injuryFlags: InjuryFlag[];
}

// Export template collections
export * from './templates/foundationTemplates';
export * from './templates/strengthTemplates';
export * from './templates/userTemplates';

// ============ RECOMMENDATION ENGINE ============

import { ClientProgrammingProfile } from '@/types';
import { FOUNDATION_TEMPLATES } from './templates/foundationTemplates';
import { STRENGTH_TEMPLATES, PERFORMANCE_TEMPLATES, RETURN_TEMPLATES } from './templates/strengthTemplates';
import { USER_TEMPLATES } from './templates/userTemplates';

// Get all PT templates
export const getAllPTTemplates = (): PGIFTemplate[] => [
  ...FOUNDATION_TEMPLATES,
  ...STRENGTH_TEMPLATES,
  ...PERFORMANCE_TEMPLATES,
  ...RETURN_TEMPLATES,
];

// Get templates by phase
export const getTemplatesByPhase = (phase: TrainingPhase): PGIFTemplate[] => {
  return getAllPTTemplates().filter(t => t.phase === phase);
};

// Get templates by frequency
export const getTemplatesByFrequency = (frequency: number): PGIFTemplate[] => {
  return getAllPTTemplates().filter(t => t.frequency === frequency);
};

// Recommend templates based on client profile
export const getRecommendedTemplates = (
  profile: ClientProgrammingProfile
): { template: PGIFTemplate; score: number; reasons: string[] }[] => {
  const allTemplates = getAllPTTemplates();
  
  return allTemplates
    .map(template => {
      let score = 0;
      const reasons: string[] = [];
      
      // Phase match (most important)
      if (template.phase === profile.currentPhase) {
        score += 40;
        reasons.push(`Matches ${PHASE_CONFIGS[profile.currentPhase].name} phase`);
      }
      
      // Goal match
      if (template.goals.includes(profile.primaryGoal)) {
        score += 25;
        reasons.push(`Targets ${GOAL_CONFIGS[profile.primaryGoal].name}`);
      }
      if (profile.secondaryGoal && template.goals.includes(profile.secondaryGoal)) {
        score += 10;
      }
      
      // Frequency match
      if (template.frequency === profile.daysPerWeek) {
        score += 20;
        reasons.push(`${profile.daysPerWeek}x per week`);
      } else if (Math.abs(template.frequency - profile.daysPerWeek) === 1) {
        score += 10;
      }
      
      // Injury compatibility (penalize if conflicts)
      const hasInjuryConflict = profile.injuryFlags.some(
        injury => injury !== 'none' && template.injuryWarnings.includes(injury)
      );
      if (hasInjuryConflict) {
        score -= 15;
        reasons.push('⚠️ Injury consideration');
      }
      
      // Difficulty match based on experience
      const difficultyMap = { new: 'beginner', some: 'beginner', confident: 'intermediate', advanced: 'advanced' };
      if (template.difficulty === difficultyMap[profile.experienceLevel]) {
        score += 5;
      }
      
      return { template, score, reasons };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
};

// Check if template has injury warnings for client
export const getInjuryWarnings = (
  template: PGIFTemplate, 
  clientInjuries: InjuryFlag[]
): { hasWarning: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  
  clientInjuries.forEach(injury => {
    if (injury === 'none') return;
    
    // Check template-level warnings
    if (template.injuryWarnings.includes(injury)) {
      warnings.push(`Template may affect ${INJURY_CONFIGS[injury].name}`);
    }
    
    // Check exercise-level warnings
    template.days.forEach(day => {
      day.blocks.forEach(block => {
        block.exercises.forEach(ex => {
          if (ex.injuryFlags.includes(injury)) {
            warnings.push(`${ex.exerciseName} may affect ${INJURY_CONFIGS[injury].name}`);
          }
        });
      });
    });
  });
  
  return {
    hasWarning: warnings.length > 0,
    warnings: [...new Set(warnings)], // Remove duplicates
  };
};

// Get phase color classes for UI
export const getPhaseColors = (phase: TrainingPhase) => {
  const config = PHASE_CONFIGS[phase];
  return {
    bg: `bg-${config.color}-500/20`,
    border: `border-${config.color}-500/50`,
    text: `text-${config.color}-400`,
    solid: `bg-${config.color}-500`,
    hex: config.colorHex,
  };
};

// Get reps/sets for phase
export const getPhaseRepsSets = (phase: TrainingPhase) => {
  const config = PHASE_CONFIGS[phase];
  return {
    reps: `${config.reps.min}-${config.reps.max}`,
    sets: config.sets,
    rest: `${config.restSeconds.min}-${config.restSeconds.max}s`,
  };
};
