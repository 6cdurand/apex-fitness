/**
 * Tests for userFetchUtils — chunking, UUID validation, and name resolution.
 * 
 * Run with: npx tsx src/lib/__tests__/userFetchUtils.test.ts
 * Or integrate with Jest/Vitest when a test framework is added.
 */

import { chunkArray, isValidUUID, resolveClientDisplayName } from '../userFetchUtils';
import { readWithSessionGate } from '../supabase';

// ============ Simple test runner ============
let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

// ============ chunkArray tests ============
console.log('\n--- chunkArray ---');

assert('splits 5 items into chunks of 2', (() => {
  const result = chunkArray([1, 2, 3, 4, 5], 2);
  return result.length === 3 && result[0].length === 2 && result[2].length === 1;
})());

assert('single chunk when array smaller than batch', (() => {
  const result = chunkArray([1, 2], 25);
  return result.length === 1 && result[0].length === 2;
})());

assert('empty array returns empty', (() => {
  return chunkArray([], 25).length === 0;
})());

assert('120 items with batch 25 = 5 chunks', (() => {
  const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`);
  const chunks = chunkArray(ids, 25);
  return chunks.length === 5 && chunks[4].length === 20;
})());

assert('exact multiple: 50 items / 25 = 2 chunks', (() => {
  const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
  const chunks = chunkArray(ids, 25);
  return chunks.length === 2 && chunks[0].length === 25 && chunks[1].length === 25;
})());

// ============ isValidUUID tests ============
console.log('\n--- isValidUUID ---');

assert('valid UUID v4', isValidUUID('58a60636-1234-4abc-9def-abcdef123456'));
assert('valid UUID uppercase', isValidUUID('58A60636-1234-4ABC-9DEF-ABCDEF123456'));
assert('rejects empty string', !isValidUUID(''));
assert('rejects short string', !isValidUUID('58a60636'));
assert('rejects non-UUID', !isValidUUID('not-a-uuid-at-all'));
assert('rejects plain name', !isValidUUID('Karen'));

// ============ resolveClientDisplayName tests ============
console.log('\n--- resolveClientDisplayName ---');

assert('priority 1: users.display_name', 
  resolveClientDisplayName({ userProfile: { id: '1', displayName: 'Karen', username: 'karen99' } }) === 'Karen'
);

assert('priority 2: users.username when no displayName',
  resolveClientDisplayName({ userProfile: { id: '1', username: 'karen99' } }) === 'karen99'
);

assert('priority 3: trainerClientName from onboarding',
  resolveClientDisplayName({ trainerClientName: 'Karen S' }) === 'Karen S'
);

assert('priority 4: calendar contactName',
  resolveClientDisplayName({ contactName: 'Karen' }) === 'Karen'
);

assert('priority 5: parse "Session with Karen"',
  resolveClientDisplayName({ eventTitle: 'Session with Karen' }) === 'Karen'
);

assert('priority 5: parse "Session - Karen"',
  resolveClientDisplayName({ eventTitle: 'Session - Karen' }) === 'Karen'
);

assert('rejects UUID as contactName',
  resolveClientDisplayName({ contactName: '58a60636-1234-4abc-9def-abcdef123456' }) === 'Unknown Client'
);

assert('falls back to Unknown Client when nothing available',
  resolveClientDisplayName({}) === 'Unknown Client'
);

assert('trims whitespace', 
  resolveClientDisplayName({ userProfile: { id: '1', displayName: '  Karen  ' } }) === 'Karen'
);

assert('skips empty displayName, uses username',
  resolveClientDisplayName({ userProfile: { id: '1', displayName: '', username: 'karen99' } }) === 'karen99'
);

// ============ Integration-style: 120 client IDs, one chunk fails ============
console.log('\n--- Integration: partial success simulation ---');

assert('partial success: failed IDs tracked separately', (() => {
  // Simulate: 5 chunks, chunk 3 fails
  const allIds = Array.from({ length: 120 }, (_, i) => `id-${i}`);
  const chunks = chunkArray(allIds, 25);
  const usersById: Record<string, { id: string; displayName: string }> = {};
  const failedIds: string[] = [];
  
  chunks.forEach((chunk, i) => {
    if (i === 2) {
      // Simulate chunk 3 failure
      failedIds.push(...chunk);
    } else {
      chunk.forEach(id => {
        usersById[id] = { id, displayName: `User ${id}` };
      });
    }
  });
  
  // 95 resolved (120 - 25 failed), 25 failed
  return Object.keys(usersById).length === 95 && failedIds.length === 25;
})());

// ============ BUG-008: native cold-start auth race (readWithSessionGate) ============
// On native the Supabase session restores from Preferences asynchronously, so an
// authenticated read fired on mount can outrun the JWT -> PostgREST 401 -> client
// names cached as "unknown" with no refetch. readWithSessionGate (A) awaits the
// session-ready signal BEFORE the read, and (B) retries exactly once after
// re-confirming the session. These drive the gate with injected fakes (no live
// Supabase client) so the ordering + one-retry contract is deterministic.
console.log('\n--- BUG-008: cold-start session gate ---');

;(async () => {
  // CONTROL — reproduces the bug: a read fired BEFORE the async session attaches
  // comes back 401 (the source of the "unknown" names). No gate here.
  {
    let attached = false;
    queueMicrotask(() => { attached = true; });
    const racyRead = async () => (attached
      ? { data: [{ id: 'u1', display_name: 'Karen' }], error: null }
      : { data: null, error: { status: 401, message: 'no JWT' } });
    const preFix = await racyRead(); // fires immediately, no gate
    assert('control: read before session attaches -> 401 (reproduces "unknown")',
      (preFix.error as { status?: number } | null)?.status === 401 && preFix.data === null);
  }

  // A — the gate makes the read WAIT for session-ready, so names resolve.
  {
    const order: string[] = [];
    let sessionReady = false;
    const ensureSession = async () => { await Promise.resolve(); sessionReady = true; order.push('session'); };
    const gatedRead = async () => {
      order.push('read');
      return sessionReady
        ? { data: [{ id: 'u1', display_name: 'Karen' }], error: null }
        : { data: null, error: { status: 401, message: 'no JWT' } };
    };
    const res = await readWithSessionGate(ensureSession, gatedRead);
    assert('A: read awaits session-ready -> names resolve, no 401',
      res.error === null && (res.data as Array<{ display_name: string }> | null)?.[0]?.display_name === 'Karen');
    assert('A: session attaches strictly before the read fires',
      order[0] === 'session' && order[1] === 'read');
  }

  // B — a transient 401 on the first read self-heals on the next retry.
  // (no-op sleep so the bounded backoff doesn't slow the test down.)
  {
    let ensureCalls = 0;
    let readCalls = 0;
    const ensureSession = async () => { ensureCalls++; };
    const flakyRead = async () => {
      readCalls++;
      return readCalls === 1
        ? { data: null, error: { status: 401, message: 'no JWT' } }
        : { data: [{ id: 'u1', display_name: 'Karen' }], error: null };
    };
    const res = await readWithSessionGate(ensureSession, flakyRead, { sleep: async () => {} });
    assert('B: retry after re-confirming session -> resolves (no "unknown")',
      res.error === null && readCalls === 2 && ensureCalls === 2);
  }

  // B — the retry is bounded: a persistent error surfaces after 1 initial +
  // `retries` attempts (default 2 retries => 3 reads), never looping forever.
  {
    let reads = 0;
    const persistentErr = async () => { reads++; return { data: null, error: { status: 401 } }; };
    const res = await readWithSessionGate(async () => {}, persistentErr, { sleep: async () => {} });
    assert('B: retry bounded (persistent error -> 3 attempts, error surfaced)',
      (res.error as { status?: number } | null)?.status === 401 && reads === 3);
  }

  // ============ Regression A (iPadOS 18): late-attaching token self-heals ====
  // PR #49's single getSession()/one-retry lost the race on iPadOS 18's slower
  // restore. The hardened gate retries with bounded backoff: a token that only
  // attaches by the THIRD read still resolves names — no 401-driven "unknown".
  {
    let attached = 0;
    let reads = 0;
    // Session attaches on the 3rd ensureSession call (initial + 2 retries).
    const ensureSession = async () => { attached++; };
    const lateRead = async () => {
      reads++;
      return attached >= 3
        ? { data: [{ id: 'u1', display_name: 'Karen' }], error: null }
        : { data: null, error: { status: 401, message: 'no JWT' } };
    };
    const res = await readWithSessionGate(ensureSession, lateRead, { sleep: async () => {} });
    assert('Regression A: token attaches after first render -> names resolve (no "unknown")',
      res.error === null
      && (res.data as Array<{ display_name: string }> | null)?.[0]?.display_name === 'Karen'
      && reads === 3);
  }
})().then(() => {
  // ============ Summary ============
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}).catch((e) => {
  console.error('Async regression block crashed:', e);
  process.exit(1);
});
