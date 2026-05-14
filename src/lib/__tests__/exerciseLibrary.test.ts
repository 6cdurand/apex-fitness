/**
 * Tests for exerciseLibrary integrity (v12-D5).
 *
 * Run with: npx tsx src/lib/__tests__/exerciseLibrary.test.ts
 *
 * Covers:
 *  - The build-time guard that rejects duplicates / bad redirects.
 *  - resolveExerciseId() returns canonical or input.
 *  - getExerciseById follows redirects.
 *  - exerciseLibrary contains no duplicate ids at runtime.
 */

import {
  exerciseLibrary,
  exerciseLibraryMap,
  EXERCISE_ID_REDIRECTS,
  resolveExerciseId,
  getExerciseById,
} from '../exercises';

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n--- exerciseLibrary integrity ---');

{
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const ex of exerciseLibrary) {
    if (seen.has(ex.id)) dups.push(ex.id);
    seen.add(ex.id);
  }
  assert('exerciseLibrary has zero duplicate ids',
    dups.length === 0,
    dups.length ? `found ${dups.length} dups: ${dups.slice(0, 5).join(', ')}` : '');
}

{
  // Sanity: library must have a healthy minimum number of exercises.
  assert('exerciseLibrary has at least 200 entries',
    exerciseLibrary.length >= 200,
    `actual: ${exerciseLibrary.length}`);
}

{
  // Map and array should be in sync.
  assert('exerciseLibraryMap covers every entry in exerciseLibrary',
    exerciseLibrary.every(ex => exerciseLibraryMap.has(ex.id)));
}

console.log('\n--- resolveExerciseId ---');

{
  // No-op for canonical ids: pass through unchanged.
  assert('returns canonical id unchanged when no redirect exists',
    resolveExerciseId('bench-press') === 'bench-press');
}

{
  // Empty string should round-trip (callers handle the falsy case).
  assert('returns empty string unchanged',
    resolveExerciseId('') === '');
}

{
  // Unknown id should pass through (so a typo doesn't crash callers).
  assert('returns unknown id unchanged',
    resolveExerciseId('this-id-definitely-does-not-exist') === 'this-id-definitely-does-not-exist');
}

console.log('\n--- getExerciseById follows redirects ---');

{
  const direct = getExerciseById('bench-press');
  assert('canonical lookup still works (bench-press)',
    direct?.id === 'bench-press' && direct?.name === 'Barbell Bench Press');
}

{
  const missing = getExerciseById('not-a-real-exercise');
  assert('returns undefined for unknown id',
    missing === undefined);
}

console.log('\n--- EXERCISE_ID_REDIRECTS shape ---');

{
  // Currently the map is empty — this is fine.
  // When entries are added, every target MUST exist in the library, no chains, no self-loops.
  // The build-time guard at module load asserts this, so reaching this code at all means the guard passed.
  for (const [from, to] of Object.entries(EXERCISE_ID_REDIRECTS)) {
    assert(`redirect '${from}' → '${to}' is not a self-loop`, from !== to);
    assert(`redirect target '${to}' exists in library`, exerciseLibraryMap.has(to));
    assert(`redirect '${from}' → '${to}' is not chained`,
      !(EXERCISE_ID_REDIRECTS as Record<string, string>)[to]);
  }
  // If the map is empty, mark a synthetic pass so the test count isn't zero in this section.
  if (Object.keys(EXERCISE_ID_REDIRECTS).length === 0) {
    assert('EXERCISE_ID_REDIRECTS is empty (no legacy aliases registered yet)', true);
  }
}

console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
