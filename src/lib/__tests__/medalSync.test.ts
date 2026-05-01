/**
 * Tests for the medals schema-drift fix (2026-05-01).
 *
 * Run with: npx tsx src/lib/__tests__/medalSync.test.ts
 *
 * Bug: `toDbMedal` previously sent `earned` and `earned_at`, neither of
 * which exist in `public.medals`. Every medal upsert returned
 * `400 PGRST204 "Could not find the 'earned' column of 'medals' in the
 * schema cache"`.
 *
 * Verified via live PostgREST per-column probe (2026-05-01):
 *   EXISTS: id, user_id, definition_id, name, description, icon, tier,
 *           category, rarity, achieved_at, progress, target, times_earned,
 *           created_at (+ legacy medal_type/exercise_id/exercise_name/weight).
 *   MISSING: earned, earned_at, evolution_tier, updated_at.
 *
 * Fix (option B — no migration):
 *   - `toDbMedal` drops `earned` entirely and renames `earned_at` → `achieved_at`.
 *   - `fromDbMedal` derives `earned = !!dbMedal.achieved_at` and maps
 *     `earnedAt ← dbMedal.achieved_at`.
 *   - App-side `Medal.earned` / `Medal.earnedAt` stay authoritative.
 *
 * Coverage (matches command-center spec + spyWarn/IIFE convention from
 * `programStartUtils.test.ts`):
 *   - toDbMedal never emits `earned` or `earned_at` keys and carries the
 *     earnedAt timestamp under `achieved_at`.
 *   - toDbMedal with `earnedAt: undefined` still does NOT include `earned`,
 *     and `achieved_at` passes through as undefined.
 *   - fromDbMedal derives `earned = true` when `achieved_at` is a string.
 *   - fromDbMedal derives `earned = false` when `achieved_at` is null /
 *     undefined / ''.
 *   - Round-trip preserves `earned`, `earnedAt`, `progress`, `target`,
 *     `timesEarned` for three representative medal shapes (earned,
 *     progressing, evolved-timesEarned>1).
 */

import type { Medal } from '@/types';
import { toDbMedal, fromDbMedal } from '../supabaseSync';

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

// spyWarn parity with programStartUtils.test.ts — lets us verify no
// unexpected warnings are emitted during the happy-path round-trips.
function spyWarn() {
  const original = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => { calls.push(args); };
  return {
    get count() { return calls.length; },
    get calls() { return calls; },
    restore() { console.warn = original; },
  };
}

// Minimal valid Medal factory — keeps tests tight without duplicating
// every field. Overrides merge on top.
function mkMedal(overrides: Partial<Medal> = {}): Medal {
  return {
    id: 'm1',
    userId: 'user-a',
    definitionId: 'first-workout',
    name: 'First Workout',
    description: 'Completed your first workout',
    icon: '🏋️',
    tier: 'bronze',
    category: 'milestone',
    rarity: 'common',
    earned: true,
    earnedAt: '2026-05-01T12:00:00.000Z',
    progress: 1,
    target: 1,
    timesEarned: 1,
    evolutionTier: 'base',
    ...overrides,
  } as Medal;
}

(() => {
  console.log('\n--- toDbMedal: drops `earned`, renames earned_at → achieved_at ---');
  {
    const warn = spyWarn();
    try {
      const payload = toDbMedal(mkMedal({ earned: true, earnedAt: '2026-05-01T12:00:00.000Z' }));
      const keys = Object.keys(payload);
      assert(
        "achieved_at carries the earnedAt timestamp",
        payload.achieved_at === '2026-05-01T12:00:00.000Z',
        `got ${JSON.stringify(payload.achieved_at)}`,
      );
      assert(
        "payload does NOT contain 'earned' key",
        !Object.prototype.hasOwnProperty.call(payload, 'earned'),
        `keys=${keys.join(',')}`,
      );
      assert(
        "payload does NOT contain 'earned_at' key",
        !Object.prototype.hasOwnProperty.call(payload, 'earned_at'),
        `keys=${keys.join(',')}`,
      );
      assert(
        'no warnings emitted during happy path',
        warn.count === 0,
        `got ${warn.count}`,
      );
    } finally {
      warn.restore();
    }
  }

  console.log('\n--- toDbMedal: unearned medal (earned=false, earnedAt=undefined) ---');
  {
    const payload = toDbMedal(mkMedal({ earned: false, earnedAt: undefined, progress: 3, target: 10 }));
    assert(
      "achieved_at is undefined (no timestamp yet)",
      payload.achieved_at === undefined,
      `got ${JSON.stringify(payload.achieved_at)}`,
    );
    assert(
      "payload does NOT contain 'earned' key even for unearned medals",
      !Object.prototype.hasOwnProperty.call(payload, 'earned'),
      `keys=${Object.keys(payload).join(',')}`,
    );
    assert(
      'progress/target carried through',
      payload.progress === 3 && payload.target === 10,
      `got progress=${payload.progress}, target=${payload.target}`,
    );
  }

  console.log('\n--- toDbMedal: required column set (whitelist) ---');
  {
    const payload = toDbMedal(mkMedal());
    const actual = Object.keys(payload).sort();
    const expected = [
      'achieved_at',
      'category',
      'definition_id',
      'description',
      'icon',
      'id',
      'name',
      'progress',
      'rarity',
      'target',
      'tier',
      'times_earned',
      'user_id',
    ];
    assert(
      `emitted keys exactly match DB-present columns (${expected.join(', ')})`,
      JSON.stringify(actual) === JSON.stringify(expected),
      `actual=${actual.join(',')}`,
    );
  }

  console.log('\n--- fromDbMedal: derives earned = !!achieved_at ---');
  {
    const m = fromDbMedal({
      id: 'm1',
      user_id: 'user-a',
      definition_id: 'first-workout',
      name: 'First Workout',
      description: 'desc',
      icon: '🏋️',
      tier: 'bronze',
      category: 'milestone',
      rarity: 'common',
      achieved_at: '2026-05-01T12:00:00.000Z',
      progress: 1,
      target: 1,
      times_earned: 1,
    });
    assert('earned=true when achieved_at is an ISO string', m.earned === true, `got ${m.earned}`);
    assert(
      'earnedAt is mapped from achieved_at',
      m.earnedAt === '2026-05-01T12:00:00.000Z',
      `got ${JSON.stringify(m.earnedAt)}`,
    );
  }
  for (const [label, at] of [
    ['null', null],
    ['undefined', undefined],
    ["'' (empty string)", ''],
  ] as [string, unknown][]) {
    const m = fromDbMedal({
      id: 'm1', user_id: 'u', definition_id: 'd', name: '', description: '', icon: '',
      tier: 'bronze', category: 'milestone', rarity: 'common',
      achieved_at: at, progress: 0, target: 1, times_earned: 1,
    });
    assert(
      `earned=false when achieved_at is ${label}`,
      m.earned === false,
      `got ${m.earned}`,
    );
    assert(
      `earnedAt is undefined when achieved_at is ${label}`,
      m.earnedAt === undefined,
      `got ${JSON.stringify(m.earnedAt)}`,
    );
  }

  console.log('\n--- fromDbMedal: rarity falls back to tier, evolutionTier falls back to base ---');
  {
    const m = fromDbMedal({
      id: 'm1', user_id: 'u', definition_id: 'd', name: '', description: '', icon: '',
      tier: 'gold', category: 'milestone', /* no rarity, no evolution_tier */
      achieved_at: '2026-05-01T12:00:00.000Z',
      progress: 1, target: 1, times_earned: 1,
    });
    // rarity || tier fallback: at runtime this yields the tier string
    // ('gold'), which is outside the `MedalRarity` compile-time union, so we
    // assert through a String() coercion to satisfy the type checker.
    assert('rarity falls back to tier', String(m.rarity) === 'gold', `got ${m.rarity}`);
    assert('evolutionTier falls back to base', m.evolutionTier === 'base', `got ${m.evolutionTier}`);
  }

  console.log('\n--- round-trip: fromDbMedal(toDbMedal(m)) preserves app-side fields ---');
  const roundTripSamples: Array<[string, Medal]> = [
    ['earned medal (timesEarned=1)', mkMedal({
      earned: true, earnedAt: '2026-05-01T12:00:00.000Z', progress: 1, target: 1, timesEarned: 1,
    })],
    // NOTE: timesEarned=1 here (not 0) because toDbMedal coerces falsy
    // values via `medal.timesEarned || 1` (pre-existing semantics, matches
    // the DB column default and `medalStore.earnMedal`). A value of 0 would
    // round-trip to 1 and trip this regression, which is intentional.
    ['progressing medal (earned=false)', mkMedal({
      earned: false, earnedAt: undefined, progress: 3, target: 10, timesEarned: 1,
      definitionId: '100-workouts', name: '100 Workouts',
    })],
    ['evolved medal (timesEarned=15)', mkMedal({
      earned: true, earnedAt: '2026-04-10T08:30:00.000Z',
      progress: 15, target: 10, timesEarned: 15,
      tier: 'gold', rarity: 'epic' as const,
      definitionId: 'bench-press-pro', name: 'Bench Press Pro',
    })],
  ];
  for (const [label, original] of roundTripSamples) {
    const roundTripped = fromDbMedal(toDbMedal(original));
    assert(`${label}: earned preserved`, roundTripped.earned === original.earned, `got ${roundTripped.earned}, expected ${original.earned}`);
    assert(
      `${label}: earnedAt preserved (undefined ↔ undefined)`,
      roundTripped.earnedAt === original.earnedAt,
      `got ${JSON.stringify(roundTripped.earnedAt)}, expected ${JSON.stringify(original.earnedAt)}`,
    );
    assert(`${label}: progress preserved`, roundTripped.progress === original.progress, `got ${roundTripped.progress}`);
    assert(`${label}: target preserved`, roundTripped.target === original.target, `got ${roundTripped.target}`);
    assert(`${label}: timesEarned preserved`, roundTripped.timesEarned === original.timesEarned, `got ${roundTripped.timesEarned}`);
  }

  // --- Summary ---
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
