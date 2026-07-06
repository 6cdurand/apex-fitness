/**
 * paidCountDeriveModel.test.ts
 *
 * BUG-016 regression guard for the "/payments Paid count drifting/resetting" bug.
 *
 * Root cause: the displayed Paid number was a denormalized `trainer_clients.total_paid`
 * counter kept in parallel to the durable `client_payments` history. Logging a payment
 * wrote BOTH the history row AND a +N to the counter; on a session where the counter
 * write didn't land, the count reverted while the history rows persisted (Carla showed
 * 53, should be 57).
 *
 * Fix (mirrors the v16-D3 session model): DERIVE the Paid count at read time via
 * getDisplayedPaidCount as `totalPaidOffset + SUM(client_payments.sessionsIncluded
 * WHERE status='paid')`. Manual edits write the OFFSET, not the raw counter.
 *
 * This file locks that model:
 *  1. No offset, 3 paid payments (2,1,1) → 4.
 *  2. Payment missing sessionsIncluded → counts as 1.
 *  3. Offset set so displayed === manual target (history sum 4, offset 53 → 57).
 *  4. Non-paid / other-client payments excluded.
 *  5. Deleting a payment lowers the derived total.
 *
 * Run: npx tsx src/lib/__tests__/paidCountDeriveModel.test.ts
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

import { getDisplayedPaidCount } from '../stores/trainerStore';

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

const CLIENT = 'client-1';
function paid(sessionsIncluded?: number, clientId: string = CLIENT, status: string = 'paid') {
  return { clientId, status, sessionsIncluded };
}

// 1. No offset, 3 paid payments (2,1,1) → 4.
assertEqual(
  getDisplayedPaidCount(
    { clientId: CLIENT },
    [paid(2), paid(1), paid(1)],
  ),
  4,
  'no offset + SUM(sessionsIncluded 2,1,1) → 4',
);

// 2. Payment missing sessionsIncluded → counts as 1.
assertEqual(
  getDisplayedPaidCount(
    { clientId: CLIENT },
    [paid(undefined), paid(undefined)],
  ),
  2,
  'missing sessionsIncluded counts as 1',
);

// 3. Offset set so displayed === manual target (history sum 4, offset 53 → 57).
assertEqual(
  getDisplayedPaidCount(
    { clientId: CLIENT, totalPaidOffset: 53 },
    [paid(2), paid(1), paid(1)],
  ),
  57,
  'offset + history sum yields manual target (Carla 53+4 → 57)',
);

// 4. Non-paid / other-client payments excluded.
assertEqual(
  getDisplayedPaidCount(
    { clientId: CLIENT },
    [
      paid(2),
      paid(5, CLIENT, 'pending'),        // wrong status
      paid(9, 'other-client', 'paid'),   // wrong client
      paid(3, CLIENT, 'refunded'),       // wrong status
    ],
  ),
  2,
  'non-paid statuses and other-client rows excluded',
);

// 5. Deleting a payment lowers the derived total.
const beforeDelete = [paid(2), paid(1), paid(1)];
const afterDelete = beforeDelete.slice(1); // remove the sessionsIncluded=2 row
assertEqual(
  getDisplayedPaidCount({ clientId: CLIENT }, beforeDelete),
  4,
  'before delete → 4',
);
assertEqual(
  getDisplayedPaidCount({ clientId: CLIENT }, afterDelete),
  2,
  'after deleting the 2-session payment → 2 (self-heals)',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('\nAll paidCountDeriveModel assertions passed.');
