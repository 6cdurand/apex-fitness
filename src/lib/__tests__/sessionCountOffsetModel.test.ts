/**
 * sessionCountOffsetModel.test.ts
 *
 * v19-fix-02 regression guard for the "inconsistent session records" outage.
 *
 * Root cause (F1): the displayed lifetime count is derived CLIENT-SIDE by
 * getDisplayedSessionCount as `historical_offset_sessions + COUNT(completed
 * trainer_sessions)`. A `??` chain in the read previously fell through to the
 * trigger-mutated legacy column whenever the new offset merely equalled 0, so a
 * master-toggle bulk-rebucket silently shifted the displayed count.
 *
 * This file locks the offset model:
 *  1. offset present (>0) → offset + COUNT(completed).
 *  2. offset present = 0 → MUST return COUNT only, NEVER fall through to the
 *     legacy historicalSessionsOffset (the dual-authority drift bug).
 *  3. no offset metadata at all → legacy totalSessions best-effort fallback
 *     (the only surviving path, dead once 20260530 is applied).
 *  4. getEffectiveAutoCount precedence (per-client > trainer default > true).
 *
 * Run: npx tsx src/lib/__tests__/sessionCountOffsetModel.test.ts
 */

// trainerStore.ts builds a zustand persist store at module load, which needs a
// localStorage + env shim before import.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    key(i: number) { return Array.from(store.keys())[i] ?? null; },
    getItem(k: string) { return store.get(k) ?? null; },
    setItem(k: string, v: string) { store.set(k, String(v)); },
    removeItem(k: string) { store.delete(k); },
  };
}

import { getDisplayedSessionCount, getEffectiveAutoCount } from '../stores/trainerStore';

// ─── Tiny test helpers (no jest dependency) ────────────────────────────────
let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    console.error(`✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
    failures += 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

const TRAINER = 'trainer-1';
const CLIENT = 'client-1';
function session(status: string) {
  return { clientId: CLIENT, trainerId: TRAINER, status };
}
const threeCompleted = [session('completed'), session('completed'), session('completed'), session('cancelled')];

// 1. offset present (>0) + 3 completed → 5 + 3 = 8
assertEqual(
  getDisplayedSessionCount(
    { clientId: CLIENT, trainerId: TRAINER, historicalOffsetSessions: 5, historicalSessionsOffset: 99, totalSessions: 42 },
    threeCompleted,
  ),
  8,
  'offset>0 + COUNT(completed) ignores legacy columns',
);

// 2. offset present = 0 → MUST be COUNT only (3), NEVER the legacy 99.
//    This is the core F1 dual-authority regression.
assertEqual(
  getDisplayedSessionCount(
    { clientId: CLIENT, trainerId: TRAINER, historicalOffsetSessions: 0, historicalSessionsOffset: 99, totalSessions: 42 },
    threeCompleted,
  ),
  3,
  'offset===0 does NOT fall through to legacy offset (drift fix)',
);

// 3. no offset metadata at all → legacy totalSessions best-effort fallback.
assertEqual(
  getDisplayedSessionCount(
    { clientId: CLIENT, trainerId: TRAINER, totalSessions: 42 },
    threeCompleted,
  ),
  42,
  'no offset metadata → legacy totalSessions fallback',
);

// 3b. legacy offset present but new column absent (unmigrated env) → legacy + count.
assertEqual(
  getDisplayedSessionCount(
    { clientId: CLIENT, trainerId: TRAINER, historicalSessionsOffset: 4, totalSessions: 42 },
    threeCompleted,
  ),
  7,
  'unmigrated env: legacy offset + COUNT(completed)',
);

// 4. getEffectiveAutoCount precedence.
assertEqual(getEffectiveAutoCount(false, true), false, 'per-client override wins over trainer default');
assertEqual(getEffectiveAutoCount(null, false), false, 'null per-client follows trainer default');
assertEqual(getEffectiveAutoCount(null, undefined), true, 'no override + no default → true');

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('\nAll sessionCountOffsetModel assertions passed.');
