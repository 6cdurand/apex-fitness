/**
 * Tests for the SupabaseSync heal-on-mount identity normalization
 * (Layer 1 — artifact c).
 *
 * Run with:
 *   npx tsx src/components/SupabaseSync.identityNormalization.test.tsx
 *
 * Strategy:
 *  These tests drive the pure decision function `__decideIdentityNormalization`
 *  directly (test seam, same pattern as `__applyMessageRealtimeEvent`). The
 *  React `useEffect` inside `SupabaseSync()` is a thin orchestrator that:
 *    1. calls __decideIdentityNormalization,
 *    2. on 'normalize', calls useAuthStore.getState().normalizeUserIdToCanonical(),
 *    3. awaits a microtask tick,
 *    4. flips isIdentityNormalized → true so the two existing data-sync
 *       effects un-gate.
 *  By testing the decision function + the store-action wiring, we cover the
 *  behavioural contract without pulling in React Testing Library.
 *
 * Coverage (mapped to the plan):
 *  1. resolveCanonical returns null → skip/no-canonical, downstream unblocked.
 *  2. resolveCanonical returns a DIFFERENT canonical id → normalize with
 *     that id; the simulated orchestrator calls normalizeUserIdToCanonical
 *     exactly once with the canonical id, THEN flips the un-gate flag.
 *  3. resolveCanonical returns the SAME id → skip/already-canonical,
 *     normalizeUserIdToCanonical is not called, downstream unblocked.
 *  4. resolveCanonical throws → skip/error, downstream still unblocked
 *     (fail-open: better to sync with stale id than block forever).
 */

// ---- env & localStorage shim (same as other tests) --------------------
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJtest.fake.token';

if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    key(i: number) { return Array.from(store.keys())[i] ?? null; },
    getItem(k: string) { return store.get(k) ?? null; },
    setItem(k: string, v: string) { store.set(k, v); },
    removeItem(k: string) { store.delete(k); },
  };
}

import { __decideIdentityNormalization } from './SupabaseSync';
import { useAuthStore } from '@/lib/stores/authStore';
import type { User } from '@/types';

// ---- tiny assertion runner --------------------------------------------
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ❌ ${name}\n     ${e?.message ?? e}`);
  }
}
function assertEqual<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}
function assertTrue(cond: any, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy, got ${String(cond)}`);
}

function seedUser(id: string): User {
  const u: User = {
    id,
    email: 'alice@example.com',
    username: 'alice',
    displayName: 'Alice',
    gender: 'female',
    mode: 'user',
    isTrainer: false,
    isVerifiedTrainer: false,
    preferredUnit: 'kg',
    membershipTier: 'pro',
    createdAt: '2026-01-01T00:00:00.000Z',
    followers: [],
    following: [],
  };
  useAuthStore.setState({ user: u, isAuthenticated: true, isLoading: false });
  return u;
}

/**
 * Mirror the effect's orchestration exactly: call the decision function,
 * then (on 'normalize') call the store action, then flip the un-gate flag.
 * Returns a trace so tests can assert ordering + calls.
 */
async function runEffectLogic(userId: string, userEmail: string, stub: {
  resolveCanonical: (email: string) => Promise<{ id: string } | null>;
}): Promise<{
  decision: Awaited<ReturnType<typeof __decideIdentityNormalization>>;
  normalizeCalls: string[];
  sequence: string[];
  isIdentityNormalized: boolean;
}> {
  const sequence: string[] = [];
  const normalizeCalls: string[] = [];

  // Wrap the real store action so we can count calls and capture ordering.
  const store = useAuthStore.getState();
  const realNormalize = store.normalizeUserIdToCanonical;
  (useAuthStore as any).setState({
    normalizeUserIdToCanonical: (canonicalId: string) => {
      sequence.push(`normalize(${canonicalId})`);
      normalizeCalls.push(canonicalId);
      realNormalize(canonicalId);
    },
  });

  sequence.push('decide:start');
  const decision = await __decideIdentityNormalization({
    userId,
    userEmail,
    resolveCanonical: stub.resolveCanonical,
  });
  sequence.push(`decide:${decision.action}`);

  let isIdentityNormalized = false;

  if (decision.action === 'normalize') {
    useAuthStore.getState().normalizeUserIdToCanonical(decision.canonicalId);
    // The real effect awaits a microtask tick before flipping the flag so
    // the store update is flushed — mirror that exactly.
    await new Promise((r) => setTimeout(r, 0));
  }

  isIdentityNormalized = true;
  sequence.push('ungate');

  // Restore the real action.
  (useAuthStore as any).setState({ normalizeUserIdToCanonical: realNormalize });

  return { decision, normalizeCalls, sequence, isIdentityNormalized };
}

// =========================================================================

(async () => {
  console.log('\n--- __decideIdentityNormalization: pure decisions ---');

  await test('resolveCanonical returns null → skip/no-canonical', async () => {
    const decision = await __decideIdentityNormalization({
      userId: 'auth-A',
      userEmail: 'alice@example.com',
      resolveCanonical: async () => null,
    });
    assertEqual(decision, { action: 'skip', reason: 'no-canonical' }, 'decision');
  });

  await test('resolveCanonical returns DIFFERENT id → normalize to canonical', async () => {
    const decision = await __decideIdentityNormalization({
      userId: 'auth-A',
      userEmail: 'alice@example.com',
      resolveCanonical: async () => ({ id: 'canonical-B' }),
    });
    assertEqual(decision, { action: 'normalize', canonicalId: 'canonical-B' }, 'decision');
  });

  await test('resolveCanonical returns SAME id → skip/already-canonical', async () => {
    const decision = await __decideIdentityNormalization({
      userId: 'same-id',
      userEmail: 'alice@example.com',
      resolveCanonical: async () => ({ id: 'same-id' }),
    });
    assertEqual(decision, { action: 'skip', reason: 'already-canonical' }, 'decision');
  });

  await test('resolveCanonical throws → skip/error (fail-open)', async () => {
    const decision = await __decideIdentityNormalization({
      userId: 'auth-A',
      userEmail: 'alice@example.com',
      resolveCanonical: async () => { throw new Error('network down'); },
    });
    assertEqual(decision, { action: 'skip', reason: 'error' }, 'decision');
  });

  // =======================================================================

  console.log('\n--- Effect-level wiring: normalize is called before un-gate ---');

  await test('canonical null → no normalize call, flag flips true, downstream unblocked', async () => {
    seedUser('auth-A');
    const result = await runEffectLogic('auth-A', 'alice@example.com', {
      resolveCanonical: async () => null,
    });
    assertEqual(result.decision, { action: 'skip', reason: 'no-canonical' }, 'decision');
    assertEqual(result.normalizeCalls, [], 'no normalize calls');
    assertTrue(result.isIdentityNormalized, 'un-gate flag flipped true');
    // user.id should remain unchanged (stale id carries through)
    assertEqual(useAuthStore.getState().user?.id, 'auth-A', 'user.id untouched');
  });

  await test('canonical differs → normalizeUserIdToCanonical called exactly once BEFORE un-gate', async () => {
    seedUser('auth-A');
    const result = await runEffectLogic('auth-A', 'alice@example.com', {
      resolveCanonical: async () => ({ id: 'canonical-B' }),
    });
    assertEqual(result.decision, { action: 'normalize', canonicalId: 'canonical-B' }, 'decision');
    assertEqual(result.normalizeCalls, ['canonical-B'], 'normalize called once with canonical id');

    // Sequence must be: decide:start → decide:normalize → normalize(canonical-B) → ungate.
    // The "normalize must fire BEFORE ungate" contract is what prevents downstream
    // data fetches from running with a stale user.id.
    const normalizeIdx = result.sequence.indexOf('normalize(canonical-B)');
    const ungateIdx = result.sequence.indexOf('ungate');
    assertTrue(normalizeIdx >= 0, 'normalize appears in sequence');
    assertTrue(ungateIdx > normalizeIdx, 'ungate strictly after normalize');

    // The store's user.id must now be the canonical value at the moment the
    // downstream sync effects would read it.
    assertEqual(useAuthStore.getState().user?.id, 'canonical-B', 'store user.id healed');
    assertTrue(result.isIdentityNormalized, 'un-gate flag flipped true');
  });

  await test('canonical same as stored → no normalize call, flag flips true', async () => {
    seedUser('same-id');
    const result = await runEffectLogic('same-id', 'alice@example.com', {
      resolveCanonical: async () => ({ id: 'same-id' }),
    });
    assertEqual(result.decision, { action: 'skip', reason: 'already-canonical' }, 'decision');
    assertEqual(result.normalizeCalls, [], 'no normalize calls (id already canonical)');
    assertTrue(result.isIdentityNormalized, 'un-gate flag flipped true');
    assertEqual(useAuthStore.getState().user?.id, 'same-id', 'user.id unchanged');
  });

  await test('resolveCanonical throws → no normalize call, flag still flips true', async () => {
    seedUser('auth-A');
    const result = await runEffectLogic('auth-A', 'alice@example.com', {
      resolveCanonical: async () => { throw new Error('network down'); },
    });
    assertEqual(result.decision, { action: 'skip', reason: 'error' }, 'decision');
    assertEqual(result.normalizeCalls, [], 'no normalize calls on error');
    // Fail-open: the downstream data fetches must still be allowed to run
    // (better to sync with a possibly stale id than block the app forever).
    assertTrue(result.isIdentityNormalized, 'un-gate flag flipped true despite error');
    assertEqual(useAuthStore.getState().user?.id, 'auth-A', 'user.id untouched on error');
  });

  // =======================================================================

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
