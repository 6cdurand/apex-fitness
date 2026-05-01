/**
 * Shared utility for converting program/builder block data into the format
 * expected by startFromTemplate(). Preserves:
 * - Pyramid/reverse-pyramid/drop-set rep structure per set
 * - Block metadata (type, circuit settings)
 * - Exercise repType (reps vs time)
 * - Cardio-specific fields
 */

/**
 * Normalize a raw `sets` value (which may come from legacy program_data,
 * trainer-builder input, or AI generation) into a safe positive integer
 * suitable for `Array.from({ length: n })`. Without this guard, negative
 * numbers, Infinity, or NaN crash Start with `RangeError: Invalid array
 * length` (command-center ticket 2026-05-01).
 *
 * - Non-finite (NaN / ±Infinity) or <= 0 → default to 3, warn
 * - Floats are floored
 * - Clamped to [1, 50]; any clamp fires a warn
 */
export function normalizeSetCount(raw: unknown, contextLabel?: string): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''));
  if (!Number.isFinite(n) || n <= 0) {
    console.warn('[programStartUtils] Invalid set count', raw, contextLabel ? `(${contextLabel})` : '', '→ defaulting to 3');
    return 3;
  }
  const clamped = Math.max(1, Math.min(50, Math.floor(n)));
  if (clamped !== n) {
    console.warn('[programStartUtils] Set count', raw, 'clamped to', clamped, contextLabel ? `(${contextLabel})` : '');
  }
  return clamped;
}

/**
 * Parse a rep string like '12→10→8→6' into per-set rep values.
 * Falls back to parseInt for flat strings like '10' or '8-12'.
 */
export function parseRepsPerSet(reps: string | number, setCount: number): number[] {
  // Belt-and-braces: direct callers may pass an unsanitised setCount from raw
  // program_data. Re-clamp here so Array(setCount) / Array.from never throw.
  setCount = normalizeSetCount(setCount, 'parseRepsPerSet');

  if (typeof reps === 'number') {
    return Array(setCount).fill(reps);
  }

  const str = String(reps).trim();

  // Arrow-separated: '12→10→8→6'
  if (str.includes('→')) {
    const parts = str.split('→').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (parts.length > 0) {
      // Pad or trim to match setCount
      return Array.from({ length: setCount }, (_, i) => parts[i] ?? parts[parts.length - 1]);
    }
  }

  // Comma-separated: '12,10,8,6'
  if (str.includes(',')) {
    const parts = str.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (parts.length > 0) {
      return Array.from({ length: setCount }, (_, i) => parts[i] ?? parts[parts.length - 1]);
    }
  }

  // AMRAP — use 0 as placeholder
  if (str.toLowerCase() === 'amrap') {
    return Array(setCount).fill(0);
  }

  // Range like '8-12' — use the higher end
  const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const high = parseInt(rangeMatch[2]);
    return Array(setCount).fill(isNaN(high) ? 10 : high);
  }

  // Plain number
  const flat = parseInt(str);
  return Array(setCount).fill(isNaN(flat) ? 10 : flat);
}

/**
 * Convert a program day's blocks into { exercises, blocks } suitable for startFromTemplate.
 * Preserves block structure so the active workout page can render circuits, pyramids, etc.
 */
export function convertProgramDayToTemplate(
  day: any,
  opts: { programId: string; dayIndex: number; programName: string; userId: string }
) {
  const blocks = (day?.blocks || []).map((block: any, bi: number) => {
    const blockId = block.id || `block-${Date.now()}-${bi}`;
    return {
      id: blockId,
      type: block.type || 'work',
      name: block.name || block.type || 'Block',
      circuitStyle: block.circuitStyle,
      circuitRounds: block.circuitRounds || block.rounds,
      circuitDuration: block.circuitDuration || (block.roundDuration ? parseInt(block.roundDuration) * 60 : undefined),
      circuitRestBetween: block.circuitRestBetween || (block.restBetweenRounds ? parseInt(block.restBetweenRounds) : undefined),
      exercises: (block.exercises || []).map((ex: any) => ({
        id: ex.id || `bex-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        exerciseId: ex.exerciseId || ex.id,
        exerciseName: ex.exerciseName || ex.name || 'Exercise',
        sets: ex.sets || 3,
        reps: ex.reps || '10',
        rest: ex.rest || '90s',
        repType: ex.repType || 'reps',
        setStyle: ex.setStyle || 'fixed',
        tempo: ex.tempo,
        notes: ex.notes,
        isCardio: ex.isCardio,
        cardioType: ex.cardioType,
        distance: ex.distance,
        distanceUnit: ex.distanceUnit,
        targetTime: ex.targetTime,
        targetPace: ex.targetPace,
        intervals: ex.intervals,
        intervalWork: ex.intervalWork,
        intervalRest: ex.intervalRest,
        movementPattern: ex.movementPattern,
      })),
    };
  });

  // Build flat exercises array for startFromTemplate (it maps these into WorkoutExercise)
  const exercises = blocks.flatMap((block: any) =>
    (block.exercises || []).map((ex: any) => {
      const setCount = normalizeSetCount(ex.sets, `${ex.exerciseName ?? ex.exerciseId}`);
      const repsPerSet = parseRepsPerSet(ex.reps, setCount);

      return {
        id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        exerciseId: ex.exerciseId,
        exercise: {
          id: ex.exerciseId,
          name: ex.exerciseName || 'Exercise',
          category: ex.isCardio ? 'cardio' : (block.type === 'circuit' ? 'circuit' : 'strength'),
          muscleGroups: [],
        },
        sets: Array.from({ length: setCount }, (_, si) => ({
          id: `set-${Date.now()}-${si}-${Math.random().toString(36).substr(2, 5)}`,
          setNumber: si + 1,
          targetReps: repsPerSet[si],
          reps: repsPerSet[si],
          weight: 0,
          completed: false,
          // Preserve time-based duration for repType === 'time'
          ...(ex.repType === 'time' ? { duration: parseInt(ex.reps) || 30 } : {}),
        })),
        restTimerSeconds: parseInt(ex.rest) || 90,
        notes: ex.notes || '',
        repType: ex.repType,
        setStyle: ex.setStyle,
        isCardio: ex.isCardio,
      };
    })
  );

  const template = {
    id: `program-${opts.programId}-${opts.dayIndex}`,
    name: `${day?.dayLabel || 'Workout'} - ${opts.programName}`,
    description: `From ${opts.programName}`,
    exercises,
    blocks,
    category: 'strength',
    estimatedDuration: 60,
    createdAt: new Date().toISOString(),
    createdBy: opts.userId,
    isPublic: false,
    updatedAt: new Date().toISOString(),
  };

  return template;
}
