// Workout Time Estimation System
// Calculates estimated workout duration based on exercises, tempo, rest, and equipment type

export type Tempo = [number, number, number, number]; // eccentric, pause, concentric, pause

export type ExerciseType = "barbell" | "machine" | "cable" | "dumbbell" | "bodyweight" | "other";

export type EstimatorExercise = {
  name: string;
  sets: number;
  reps: number;
  restSeconds?: number;     // rest between sets
  tempo?: Tempo;            // if provided, overrides avgRepSeconds
  type?: ExerciseType;
  warmupSets?: number;      // optional ramp/warmup sets
  warmupReps?: number;      // default to reps if missing
  warmupRestSeconds?: number; // default shorter rest
};

export type CardioBlock = {
  name: string;
  durationSeconds: number; // total block duration
};

export type EstimatorSettings = {
  avgRepSeconds: number; // used if no tempo
  defaultRestSeconds: number;
  transitionSecondsBetweenExercises: number;
  setupSecondsPerExercise: number;
  setOverheadSeconds: number; // unrack/brace/positioning
  overheadMultiplier: number;

  // optional type modifiers
  typeSetupExtraSeconds: Record<ExerciseType, number>;
  typeRestMultiplier: Record<ExerciseType, number>;
};

export type EstimateBreakdown = {
  workSeconds: number;
  restSeconds: number;
  transitionSeconds: number;
  setupSeconds: number;
  cardioSeconds: number;
  totalSecondsRaw: number;
  totalSeconds: number;
};

export const defaultSettings: EstimatorSettings = {
  avgRepSeconds: 3,
  defaultRestSeconds: 90,
  transitionSecondsBetweenExercises: 45,
  setupSecondsPerExercise: 20,
  setOverheadSeconds: 10,
  overheadMultiplier: 1.08,

  typeSetupExtraSeconds: {
    barbell: 20,
    machine: 0,
    cable: 10,
    dumbbell: 10,
    bodyweight: 0,
    other: 0,
  },
  typeRestMultiplier: {
    barbell: 1.1,
    machine: 1.0,
    cable: 1.0,
    dumbbell: 1.0,
    bodyweight: 0.9,
    other: 1.0,
  },
};

// Common tempo presets
export const TEMPO_PRESETS: Record<string, { label: string; tempo: Tempo; description: string }> = {
  normal: { label: 'Normal', tempo: [2, 0, 1, 0], description: '2-0-1-0 (3s/rep)' },
  controlled: { label: 'Controlled', tempo: [3, 1, 2, 0], description: '3-1-2-0 (6s/rep)' },
  slow: { label: 'Slow Eccentric', tempo: [4, 1, 1, 0], description: '4-1-1-0 (6s/rep)' },
  explosive: { label: 'Explosive', tempo: [2, 0, 1, 1], description: '2-0-1-1 (4s/rep)' },
  pause: { label: 'Pause Reps', tempo: [2, 2, 1, 0], description: '2-2-1-0 (5s/rep)' },
  timeUnderTension: { label: 'TUT', tempo: [4, 1, 4, 1], description: '4-1-4-1 (10s/rep)' },
};

// Rest time presets in seconds
export const REST_PRESETS = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
  { label: '5min', value: 300 },
];

function tempoSecondsPerRep(tempo: Tempo): number {
  return tempo.reduce((a, b) => a + b, 0);
}

export function estimateWorkoutLengthSeconds(
  exercises: EstimatorExercise[],
  cardioBlocks: CardioBlock[] = [],
  settings: Partial<EstimatorSettings> = {}
): EstimateBreakdown {
  const s: EstimatorSettings = { ...defaultSettings, ...settings };

  let workSeconds = 0;
  let restSeconds = 0;
  let transitionSeconds = 0;
  let setupSeconds = 0;

  exercises.forEach((ex, idx) => {
    const sets = Math.max(0, ex.sets || 0);
    const reps = Math.max(0, ex.reps || 0);

    const exType: ExerciseType = ex.type || "other";
    const rest = (ex.restSeconds ?? s.defaultRestSeconds) * (s.typeRestMultiplier[exType] ?? 1);

    const secondsPerRep = ex.tempo
      ? tempoSecondsPerRep(ex.tempo)
      : s.avgRepSeconds;

    const setTime = reps * secondsPerRep + s.setOverheadSeconds;

    // Working sets
    workSeconds += sets * setTime;

    // Rest between sets
    if (sets >= 2) restSeconds += (sets - 1) * rest;

    // Warmup sets (optional)
    const wuSets = Math.max(0, ex.warmupSets || 0);
    if (wuSets > 0) {
      const wuReps = Math.max(0, ex.warmupReps ?? reps);
      const wuSetTime = wuReps * secondsPerRep + s.setOverheadSeconds;
      const wuRest = ex.warmupRestSeconds ?? Math.max(30, rest * 0.6);

      workSeconds += wuSets * wuSetTime;
      if (wuSets >= 2) restSeconds += (wuSets - 1) * wuRest;
      // rest between last warmup and first working set
      if (sets > 0) restSeconds += wuRest;
    }

    // Setup time for each exercise
    setupSeconds += s.setupSecondsPerExercise + (s.typeSetupExtraSeconds[exType] ?? 0);

    // Transition between exercises
    if (idx !== 0) transitionSeconds += s.transitionSecondsBetweenExercises;
  });

  const cardioSeconds = cardioBlocks.reduce((sum, b) => sum + Math.max(0, b.durationSeconds), 0);

  const totalSecondsRaw =
    workSeconds + restSeconds + transitionSeconds + setupSeconds + cardioSeconds;

  const totalSeconds = Math.round(totalSecondsRaw * s.overheadMultiplier);

  return {
    workSeconds: Math.round(workSeconds),
    restSeconds: Math.round(restSeconds),
    transitionSeconds: Math.round(transitionSeconds),
    setupSeconds: Math.round(setupSeconds),
    cardioSeconds: Math.round(cardioSeconds),
    totalSecondsRaw: Math.round(totalSecondsRaw),
    totalSeconds,
  };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m`;
  return `~${m} min`;
}

export function formatDurationDetailed(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatRestTimer(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Map equipment string to ExerciseType
export function mapEquipmentToType(equipment?: string): ExerciseType {
  if (!equipment) return 'other';
  const eq = equipment.toLowerCase();
  if (eq === 'barbell') return 'barbell';
  if (eq === 'dumbbell') return 'dumbbell';
  if (eq === 'machine') return 'machine';
  if (eq === 'cable') return 'cable';
  if (eq === 'bodyweight' || eq === 'body weight') return 'bodyweight';
  return 'other';
}
