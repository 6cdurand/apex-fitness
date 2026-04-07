/**
 * Tests for userFetchUtils — chunking, UUID validation, and name resolution.
 * 
 * Run with: npx tsx src/lib/__tests__/userFetchUtils.test.ts
 * Or integrate with Jest/Vitest when a test framework is added.
 */

import { chunkArray, isValidUUID, resolveClientDisplayName } from '../userFetchUtils';

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

// ============ Summary ============
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) process.exit(1);
