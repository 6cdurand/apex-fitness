/**
 * Tests for `useAuthStore.normalizeUserIdToCanonical` — Layer 1 of the
 * identity reconciliation fix (artifact c).
 *
 * Run with:
 *   npx tsx src/lib/stores/authStore.normalizeUserIdToCanonical.test.ts
 *
 * Coverage:
 *  1. No-op when `user` is null.
 *  2. No-op (idempotent) when current id already equals the canonical id —
 *     the in-memory user reference and localStorage blob are untouched.
 *  3. Happy path A → B: in-memory `user.id` becomes B, `apex-users`
 *     localStorage row is re-keyed from A → B, and no `updateUserInSupabase`
 *     call is made (verified defensively via a `globalThis.fetch` spy — if
 *     the action had called updateUserInSupabase it would trigger a
 *     Supabase network request).
 *  4. De-dupe: when `apex-users` already contains a row at canonical id B
 *     AND the current user at A, after normalization exactly ONE row exists
 *     at B (the old A row, id re-keyed) and ZERO rows at A.
 */

// ---- env: make isSupabaseConfigured() return true so we exercise the
// "configured" branch while still ensuring the action itself touches
// zero network. These values are NEVER sent — the test aborts any fetch.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJtest.fake.token';

// ---- localStorage shim for zustand/persist during module load ----------
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

// ---- fetch spy: any Supabase call made from within the action would
// trigger a fetch. The spy counts invocations and rejects so we never
// actually hit the network. A passing test asserts zero fetches happened
// across the window of the normalize call.
let fetchCallCount = 0;
const originalFetch = (globalThis as any).fetch;
(globalThis as any).fetch = (..._args: any[]) => {
  fetchCallCount++;
  return Promise.reject(new Error('[test] fetch blocked'));
};

import { useAuthStore } from './authStore';
import type { User } from '@/types';

// ---- tiny assertion runner (matches other tests in this repo) ----------
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
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

// ---- helpers ----------------------------------------------------------
function resetStoreAndLocalStorage() {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  (globalThis as any).localStorage.clear();
  fetchCallCount = 0;
}

function seedUser(id: string, extras: Partial<User> = {}): User {
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
    ...extras,
  };
  useAuthStore.setState({ user: u, isAuthenticated: true, isLoading: false });
  return u;
}

function writeApexUsers(rows: any[]) {
  (globalThis as any).localStorage.setItem('apex-users', JSON.stringify(rows));
}
function readApexUsers(): any[] {
  return JSON.parse((globalThis as any).localStorage.getItem('apex-users') || '[]');
}

// =========================================================================

console.log('\n--- normalizeUserIdToCanonical: no-op cases ---');

test('no-op when user is null (store carries no user state change)', () => {
  resetStoreAndLocalStorage();
  writeApexUsers([{ id: 'canonical-B', email: 'alice@example.com' }]);
  useAuthStore.getState().normalizeUserIdToCanonical('canonical-B');
  assertEqual(useAuthStore.getState().user, null, 'user stays null');
  // localStorage is NOT mutated when there's no current user
  assertEqual(
    readApexUsers(),
    [{ id: 'canonical-B', email: 'alice@example.com' }],
    'apex-users untouched when user is null',
  );
  assertEqual(fetchCallCount, 0, 'zero network calls');
});

test('no-op (idempotent) when currentId === canonicalId', () => {
  resetStoreAndLocalStorage();
  const u = seedUser('canonical-B');
  const before = readApexUsers();
  useAuthStore.getState().normalizeUserIdToCanonical('canonical-B');
  // Reference equality would be too strict (set() always creates a new obj
  // in the "normalize" path), so we assert the user object is unchanged by
  // id AND that localStorage was not rewritten.
  assertEqual(useAuthStore.getState().user?.id, 'canonical-B', 'user.id unchanged');
  assertEqual(useAuthStore.getState().user?.email, u.email, 'user.email unchanged');
  assertEqual(
    readApexUsers(),
    before,
    'apex-users byte-identical when id already canonical',
  );
  assertEqual(fetchCallCount, 0, 'zero network calls');
});

// =========================================================================

console.log('\n--- normalizeUserIdToCanonical: happy path A → B ---');

test('rewrites in-memory user.id from A to canonical B', () => {
  resetStoreAndLocalStorage();
  seedUser('auth-A');
  writeApexUsers([{ id: 'auth-A', email: 'alice@example.com', password: 'h_xyz' }]);

  useAuthStore.getState().normalizeUserIdToCanonical('canonical-B');

  assertEqual(useAuthStore.getState().user?.id, 'canonical-B', 'in-memory user.id');
  // Other fields are preserved
  assertEqual(useAuthStore.getState().user?.email, 'alice@example.com', 'email preserved');
  assertEqual(useAuthStore.getState().user?.displayName, 'Alice', 'displayName preserved');
});

test('rewrites apex-users row id A → B, preserves other fields (incl. password)', () => {
  resetStoreAndLocalStorage();
  seedUser('auth-A');
  writeApexUsers([
    { id: 'auth-A', email: 'alice@example.com', password: 'h_xyz', displayName: 'Alice' },
    { id: 'other-user', email: 'bob@example.com', password: 'h_bob' },
  ]);

  useAuthStore.getState().normalizeUserIdToCanonical('canonical-B');

  const rows = readApexUsers();
  assertEqual(rows.length, 2, 'row count unchanged (no duplicates)');

  const healed = rows.find((r: any) => r.email === 'alice@example.com');
  assertTrue(healed, 'healed row still present');
  assertEqual(healed.id, 'canonical-B', 'healed row id is canonical');
  assertEqual(healed.password, 'h_xyz', 'password hash preserved');
  assertEqual(healed.displayName, 'Alice', 'displayName preserved');

  const bob = rows.find((r: any) => r.email === 'bob@example.com');
  assertTrue(bob, 'other users untouched');
  assertEqual(bob.id, 'other-user', 'other users have their id intact');
});

test('does NOT call updateUserInSupabase (zero network fetches during normalize)', () => {
  resetStoreAndLocalStorage();
  seedUser('auth-A');
  writeApexUsers([{ id: 'auth-A', email: 'alice@example.com' }]);

  useAuthStore.getState().normalizeUserIdToCanonical('canonical-B');

  // The action is synchronous; any Supabase PATCH/UPDATE would route
  // through fetch(). Zero fetches in the synchronous window proves the
  // client-only contract held.
  assertEqual(fetchCallCount, 0, 'zero fetches during normalize');
});

// =========================================================================

console.log('\n--- normalizeUserIdToCanonical: de-dupe when B row already exists ---');

test('de-dupes when apex-users contains BOTH A and canonical B rows', () => {
  resetStoreAndLocalStorage();
  seedUser('auth-A', { displayName: 'Alice-Fresh' });
  // Pre-seed the localStorage with a stale row at canonical-B (e.g. from a
  // prior OAuth login on this same device) alongside the current stale row
  // at auth-A. After normalize, there must be EXACTLY ONE row at B and
  // ZERO rows at A.
  writeApexUsers([
    { id: 'canonical-B', email: 'alice@example.com', displayName: 'Alice-Old', password: 'h_old' },
    { id: 'auth-A', email: 'alice@example.com', displayName: 'Alice-Fresh', password: 'h_fresh' },
    { id: 'unrelated', email: 'bob@example.com' },
  ]);

  useAuthStore.getState().normalizeUserIdToCanonical('canonical-B');

  const rows = readApexUsers();
  const atB = rows.filter((r: any) => r.id === 'canonical-B');
  const atA = rows.filter((r: any) => r.id === 'auth-A');

  assertEqual(atB.length, 1, 'exactly one row at canonical-B');
  assertEqual(atA.length, 0, 'zero rows at auth-A');

  // The surviving row is the one we were currently operating on (auth-A,
  // re-keyed to canonical-B) — so fields like the fresh password hash and
  // displayName should carry through.
  assertEqual(atB[0].displayName, 'Alice-Fresh', 'surviving row = the re-keyed fresh row');
  assertEqual(atB[0].password, 'h_fresh', 'surviving row keeps fresh password hash');

  // Unrelated user untouched.
  const bob = rows.find((r: any) => r.id === 'unrelated');
  assertTrue(bob, 'unrelated user still present');
});

// =========================================================================

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);

// Restore original fetch in case the runner continues after this file
(globalThis as any).fetch = originalFetch;

if (failed > 0) process.exit(1);
