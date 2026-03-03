// AI Exercise Image Generation — prompt builder + generation via OpenAI DALL-E
// Falls back to Supabase-cached URLs when available

import { Exercise, MuscleGroup, Equipment } from '@/types';

// ---------------------------------------------------------------------------
// 1. Prompt engineering
// ---------------------------------------------------------------------------

const MUSCLE_VISUAL_MAP: Record<string, string> = {
  chest: 'pectoral muscles',
  back: 'latissimus dorsi and upper back',
  shoulders: 'deltoid muscles',
  biceps: 'biceps brachii',
  triceps: 'triceps brachii',
  forearms: 'forearm muscles',
  quads: 'quadriceps',
  hamstrings: 'hamstring muscles',
  glutes: 'gluteal muscles',
  calves: 'calf muscles',
  abs: 'abdominal core muscles',
  traps: 'trapezius muscles',
  lats: 'latissimus dorsi',
  obliques: 'oblique muscles',
  'hip flexors': 'hip flexor muscles',
  adductors: 'inner thigh adductor muscles',
  'lower back': 'erector spinae lower back',
};

const EQUIPMENT_VISUAL_MAP: Record<string, string> = {
  barbell: 'using a barbell',
  dumbbell: 'using dumbbells',
  cable: 'using a cable machine',
  machine: 'using a gym machine',
  bodyweight: 'using bodyweight only',
  kettlebell: 'using a kettlebell',
  band: 'using a resistance band',
  'ez-bar': 'using an EZ curl bar',
  'smith-machine': 'using a Smith machine',
  'trap-bar': 'using a hex/trap bar',
  other: '',
};

/**
 * Build a high-quality DALL-E prompt for an exercise illustration.
 */
export function buildExercisePrompt(exercise: {
  name: string;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  equipment: string;
  instructions?: string;
}): string {
  const muscles = exercise.primaryMuscles
    .map(m => MUSCLE_VISUAL_MAP[m] || m)
    .join(' and ');

  const equip = EQUIPMENT_VISUAL_MAP[exercise.equipment] || '';

  return [
    `Clean, modern fitness illustration of a person performing "${exercise.name}" ${equip}.`,
    `Highlighted muscles: ${muscles}.`,
    'Athletic figure in a gym setting, anatomical muscle highlights glowing subtly in blue-green.',
    'Dark background, minimal style, professional fitness app aesthetic.',
    'No text, no labels, no watermarks.',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// 2. Client-side helpers (call our API route)
// ---------------------------------------------------------------------------

export interface GenerateImageResult {
  imageUrl: string;
  cached: boolean;
  error?: string;
}

/**
 * Request an AI-generated image for an exercise via our API route.
 * The API handles generation, Supabase caching, and returns the URL.
 */
export async function generateExerciseImage(
  exerciseId: string
): Promise<GenerateImageResult> {
  const res = await fetch('/api/exercise-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exerciseId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { imageUrl: '', cached: false, error: data.error || 'Generation failed' };
  }

  return res.json();
}

/**
 * Fetch the cached image URL for an exercise (no generation).
 */
export async function getExerciseImageUrl(
  exerciseId: string
): Promise<string | null> {
  const res = await fetch(`/api/exercise-image?exerciseId=${encodeURIComponent(exerciseId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.imageUrl || null;
}

/**
 * Batch-fetch cached image URLs for multiple exercises.
 */
export async function getExerciseImageUrls(
  exerciseIds: string[]
): Promise<Record<string, string>> {
  const res = await fetch('/api/exercise-image/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exerciseIds }),
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.images || {};
}

// ---------------------------------------------------------------------------
// 3. Placeholder SVG generator (client-side fallback when no image exists)
// ---------------------------------------------------------------------------

const MUSCLE_COLOR_MAP: Record<string, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f59e0b',
  biceps: '#8b5cf6',
  triceps: '#ec4899',
  quads: '#10b981',
  hamstrings: '#14b8a6',
  glutes: '#f97316',
  calves: '#06b6d4',
  abs: '#eab308',
  traps: '#6366f1',
  lats: '#2563eb',
  forearms: '#a855f7',
  obliques: '#d946ef',
  'hip flexors': '#84cc16',
  adductors: '#22c55e',
  'lower back': '#0ea5e9',
};

/**
 * Generate a simple placeholder SVG data URL based on the exercise's primary muscle group.
 */
export function exercisePlaceholderSvg(
  primaryMuscle: string,
  equipment: string
): string {
  const color = MUSCLE_COLOR_MAP[primaryMuscle] || '#64748b';
  const equipIcon = equipment === 'barbell' ? '🏋️' :
    equipment === 'dumbbell' ? '💪' :
    equipment === 'cable' ? '⚡' :
    equipment === 'machine' ? '⚙️' :
    equipment === 'bodyweight' ? '🤸' :
    equipment === 'kettlebell' ? '🔔' : '🏋️';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="200" height="200" rx="16" fill="url(#bg)"/>
    <circle cx="100" cy="90" r="60" fill="url(#glow)"/>
    <text x="100" y="100" font-size="48" text-anchor="middle" dominant-baseline="middle">${equipIcon}</text>
    <text x="100" y="160" font-size="11" fill="${color}" text-anchor="middle" font-family="system-ui" opacity="0.8">${primaryMuscle}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
