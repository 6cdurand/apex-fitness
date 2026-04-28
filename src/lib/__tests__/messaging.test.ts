/**
 * Tests for the messaging D1 + D2 + D7 fixes.
 *
 * Run with: npx tsx src/lib/__tests__/messaging.test.ts
 *
 * Coverage:
 *  - D1: computeMessageIdsToMarkRead filters to inbound-only, unread-only,
 *    conversation-scoped messages (acceptance: "don't write read=true on
 *    messages where the user is the sender").
 *  - D2: mergeMessagesPreferRead — read=true on either side wins,
 *    remote wins for non-read fields, union by id.
 *  - D7 (FK-race fix): syncMessageToSupabase awaits the conversation upsert
 *    before the message upsert when a conversation payload is provided, and
 *    returns false without firing the message upsert when the conversation
 *    upsert errors (no orphan rows). Asserted via spy on a fake supabase
 *    client injected through __setMessagingSupabaseClientForTests.
 *
 * Note: messageStore.ts uses zustand `persist` with localStorage. Under
 * Node/tsx, `localStorage` is not defined, so we install a minimal in-memory
 * shim BEFORE importing the module. We also pre-seed the Supabase env vars
 * so isSupabaseConfigured() returns true (otherwise the upsert functions
 * short-circuit before reaching the seam under test).
 */

// ---- env shim: make isSupabaseConfigured() return true under tsx --------
// supabaseSync.ts gates every upsert on Boolean(url && key && url.includes('supabase.co')).
// These values are NEVER sent to the network — we override the supabase
// client with a fake before any test runs (see fk-race section below).
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJtest.fake.token';

// ---- localStorage shim for zustand/persist during module load ------------
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

import {
  computeMessageIdsToMarkRead,
  mergeMessagesPreferRead,
  type Message,
} from '../messageStore';
import {
  syncMessageToSupabase,
  __setMessagingSupabaseClientForTests,
  type MessageData,
  type ConversationData,
} from '../supabaseSync';

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

function msg(overrides: Partial<Message> & Pick<Message, 'id'>): Message {
  return {
    conversationId: 'c1',
    senderId: 'alice',
    receiverId: 'bob',
    content: 'hi',
    createdAt: '2026-04-28T00:00:00.000Z',
    read: false,
    ...overrides,
  };
}

// ============ D1: computeMessageIdsToMarkRead ============
console.log('\n--- D1: computeMessageIdsToMarkRead (inbound-only filter) ---');

{
  // bob is the receiver in c1. alice sent him two unread messages.
  const messages: Message[] = [
    msg({ id: 'm1', senderId: 'alice', receiverId: 'bob', conversationId: 'c1' }),
    msg({ id: 'm2', senderId: 'alice', receiverId: 'bob', conversationId: 'c1' }),
  ];
  const ids = computeMessageIdsToMarkRead(messages, 'c1', 'bob');
  assert(
    'inbound unread → returned',
    ids.length === 2 && ids.includes('m1') && ids.includes('m2'),
    `got ${JSON.stringify(ids)}`,
  );
}

{
  // bob's own outbound messages must NEVER be flipped to read=true by bob.
  const messages: Message[] = [
    msg({ id: 'm-in', senderId: 'alice', receiverId: 'bob', conversationId: 'c1' }),
    msg({ id: 'm-out', senderId: 'bob', receiverId: 'alice', conversationId: 'c1' }),
  ];
  const ids = computeMessageIdsToMarkRead(messages, 'c1', 'bob');
  assert(
    'ACCEPTANCE D1: outbound (user is sender) is excluded',
    ids.length === 1 && ids[0] === 'm-in',
    `got ${JSON.stringify(ids)}`,
  );
}

{
  // Already-read inbound must not be re-returned — no-op on the sync side.
  const messages: Message[] = [
    msg({ id: 'm-old', senderId: 'alice', receiverId: 'bob', conversationId: 'c1', read: true }),
    msg({ id: 'm-new', senderId: 'alice', receiverId: 'bob', conversationId: 'c1', read: false }),
  ];
  const ids = computeMessageIdsToMarkRead(messages, 'c1', 'bob');
  assert(
    'already-read inbound is excluded',
    ids.length === 1 && ids[0] === 'm-new',
    `got ${JSON.stringify(ids)}`,
  );
}

{
  // Wrong conversation is excluded even if user is the receiver.
  const messages: Message[] = [
    msg({ id: 'm-c1', senderId: 'alice', receiverId: 'bob', conversationId: 'c1' }),
    msg({ id: 'm-c2', senderId: 'alice', receiverId: 'bob', conversationId: 'c2' }),
  ];
  const ids = computeMessageIdsToMarkRead(messages, 'c1', 'bob');
  assert(
    'other conversations are excluded',
    ids.length === 1 && ids[0] === 'm-c1',
    `got ${JSON.stringify(ids)}`,
  );
}

{
  // Empty / no match → empty array (store skips sync call).
  const ids = computeMessageIdsToMarkRead([], 'c1', 'bob');
  assert('empty messages → empty ids', ids.length === 0);
}

// ============ D2: mergeMessagesPreferRead ============
console.log('\n--- D2: mergeMessagesPreferRead (read=true wins) ---');

{
  // Local is freshly-flipped read=true; remote still has stale read=false.
  // Before the D2 fix, mergeData would regress this row to read=false.
  const local: Message[] = [msg({ id: 'm1', read: true })];
  const remote: Message[] = [msg({ id: 'm1', read: false })];
  const merged = mergeMessagesPreferRead(local, remote);
  const row = merged.find(m => m.id === 'm1');
  assert(
    'ACCEPTANCE D2: local read=true, remote read=false → merged read=true',
    merged.length === 1 && row?.read === true,
    `got ${JSON.stringify(merged)}`,
  );
}

{
  // Symmetric: remote read=true, local still unread (another device flipped it).
  // The local device should adopt read=true on next sync.
  const local: Message[] = [msg({ id: 'm1', read: false })];
  const remote: Message[] = [msg({ id: 'm1', read: true })];
  const merged = mergeMessagesPreferRead(local, remote);
  const row = merged.find(m => m.id === 'm1');
  assert(
    'symmetric: remote read=true, local read=false → merged read=true',
    row?.read === true,
    `got ${JSON.stringify(merged)}`,
  );
}

{
  // Both read=true → merged read=true (idempotent).
  const local: Message[] = [msg({ id: 'm1', read: true })];
  const remote: Message[] = [msg({ id: 'm1', read: true })];
  const merged = mergeMessagesPreferRead(local, remote);
  assert('both read=true → read=true', merged[0]?.read === true);
}

{
  // Both read=false → merged read=false.
  const local: Message[] = [msg({ id: 'm1', read: false })];
  const remote: Message[] = [msg({ id: 'm1', read: false })];
  const merged = mergeMessagesPreferRead(local, remote);
  assert('both read=false → read=false', merged[0]?.read === false);
}

{
  // Content precedence: remote is authoritative for non-read fields.
  // This preserves the "remote is source of truth" behavior for everything
  // except the read flag.
  const local: Message[] = [msg({ id: 'm1', content: 'stale local', read: true })];
  const remote: Message[] = [msg({ id: 'm1', content: 'fresh remote', read: false })];
  const merged = mergeMessagesPreferRead(local, remote);
  assert(
    'remote content wins when both sides have the row',
    merged[0]?.content === 'fresh remote',
    `got content=${merged[0]?.content}`,
  );
  assert(
    'but read=true from local is preserved',
    merged[0]?.read === true,
  );
}

{
  // Union by id: rows present only on one side are passed through unchanged.
  const local: Message[] = [
    msg({ id: 'm-local-only', read: true }),
  ];
  const remote: Message[] = [
    msg({ id: 'm-remote-only', read: false }),
  ];
  const merged = mergeMessagesPreferRead(local, remote);
  assert(
    'union by id includes local-only and remote-only rows',
    merged.length === 2 &&
      merged.some(m => m.id === 'm-local-only' && m.read === true) &&
      merged.some(m => m.id === 'm-remote-only' && m.read === false),
  );
}

{
  // Empty local + non-empty remote → merged equals remote (first-sync case).
  const remote: Message[] = [msg({ id: 'r1' }), msg({ id: 'r2' })];
  const merged = mergeMessagesPreferRead([], remote);
  assert('empty local → merged equals remote', merged.length === 2);
}

{
  // Empty remote + non-empty local → local is preserved (pre-sync case).
  const local: Message[] = [msg({ id: 'l1', read: true })];
  const merged = mergeMessagesPreferRead(local, []);
  assert(
    'empty remote → local preserved (read state intact)',
    merged.length === 1 && merged[0]?.id === 'l1' && merged[0]?.read === true,
  );
}

// ============ D7: FK-race fix (syncMessageToSupabase ordering) ============
// Wrapped in an async IIFE because tsx emits CJS and CJS forbids top-level
// await. The summary at the bottom of this file runs after this IIFE
// resolves (we await it inline).

interface FakeUpsertEvent {
  table: string;
  phase: 'enter' | 'exit';
  payload: any;
}

interface FakeClientHandle {
  client: any;
  events: FakeUpsertEvent[];
}

/**
 * Build a fake supabase client whose `.from(table).upsert(payload)` records an
 * "enter" event when the upsert begins and an "exit" event after a small async
 * tick. The async tick is the whole point of this fixture: if the conversation
 * upsert is awaited correctly, its "exit" event MUST appear before the
 * messages upsert "enter" event in the recorded sequence. If the production
 * code regresses to fire-and-forget ordering, the messages "enter" appears
 * between the conversations "enter" and "exit" — a clear failure signal.
 */
function makeFakeClient(behavior: {
  conversations?: 'ok' | 'error';
  messages?: 'ok' | 'error';
} = {}): FakeClientHandle {
  const events: FakeUpsertEvent[] = [];
  const client = {
    from(table: string) {
      return {
        upsert: async (payload: any) => {
          events.push({ table, phase: 'enter', payload });
          // Force a microtask tick so concurrent (un-awaited) calls would
          // interleave their "enter" events. With proper await ordering,
          // they cannot.
          await new Promise<void>(resolve => setTimeout(resolve, 5));
          events.push({ table, phase: 'exit', payload });
          const fail =
            (table === 'conversations' && behavior.conversations === 'error') ||
            (table === 'messages' && behavior.messages === 'error');
          return {
            error: fail ? { code: 'TEST_FAIL', message: `forced ${table} failure` } : null,
            data: null,
          };
        },
      };
    },
  };
  return { client, events };
}

const messagePayload: MessageData = {
  id: 'msg-1',
  conversationId: 'conv-1',
  senderId: 'alice',
  receiverId: 'bob',
  content: 'first message in fresh conversation',
  read: false,
  createdAt: '2026-04-29T00:00:00.000Z',
};

const conversationPayload: ConversationData = {
  id: 'conv-1',
  participants: ['alice', 'bob'],
  updatedAt: '2026-04-29T00:00:00.000Z',
};

(async () => {
  console.log('\n--- D7: syncMessageToSupabase awaits conversation upsert before message upsert ---');

  // --- Case 1: happy path. Conversation upsert is awaited before message. ---
  {
    const { client, events } = makeFakeClient();
    __setMessagingSupabaseClientForTests(client);

    const ok = await syncMessageToSupabase(messagePayload, conversationPayload);

    __setMessagingSupabaseClientForTests(null);

    assert('happy path: returns true', ok === true);
    assert(
      'ACCEPTANCE D7: conversation upsert exits before message upsert enters',
      (() => {
        const convExitIdx = events.findIndex(e => e.table === 'conversations' && e.phase === 'exit');
        const msgEnterIdx = events.findIndex(e => e.table === 'messages' && e.phase === 'enter');
        return convExitIdx >= 0 && msgEnterIdx >= 0 && convExitIdx < msgEnterIdx;
      })(),
      `events=${JSON.stringify(events.map(e => `${e.table}:${e.phase}`))}`,
    );
    assert(
      'happy path: exactly one upsert per table',
      events.filter(e => e.table === 'conversations' && e.phase === 'enter').length === 1 &&
        events.filter(e => e.table === 'messages' && e.phase === 'enter').length === 1,
    );
    assert(
      'happy path: payloads carry the right ids',
      events.find(e => e.table === 'conversations')?.payload?.id === 'conv-1' &&
        events.find(e => e.table === 'messages')?.payload?.id === 'msg-1',
    );
  }

  // --- Case 2: orphan-prevention. Conversation upsert fails → no message upsert. ---
  {
    const { client, events } = makeFakeClient({ conversations: 'error' });
    __setMessagingSupabaseClientForTests(client);

    const ok = await syncMessageToSupabase(messagePayload, conversationPayload);

    __setMessagingSupabaseClientForTests(null);

    assert('orphan-prevention: returns false on conversation error', ok === false);
    assert(
      'ACCEPTANCE D7: messages upsert NEVER fires when conversation upsert errors',
      events.every(e => e.table !== 'messages'),
      `events=${JSON.stringify(events.map(e => `${e.table}:${e.phase}`))}`,
    );
    assert(
      'orphan-prevention: conversation upsert was still attempted',
      events.some(e => e.table === 'conversations' && e.phase === 'enter'),
    );
  }

  // --- Case 3: legacy single-arg path. No conversation → only message upsert fires. ---
  {
    const { client, events } = makeFakeClient();
    __setMessagingSupabaseClientForTests(client);

    const ok = await syncMessageToSupabase(messagePayload);

    __setMessagingSupabaseClientForTests(null);

    assert('legacy single-arg: returns true', ok === true);
    assert(
      'legacy single-arg: only messages upsert fires (no conversations call)',
      events.length === 2 && events.every(e => e.table === 'messages'),
      `events=${JSON.stringify(events.map(e => `${e.table}:${e.phase}`))}`,
    );
  }

  // --- Case 4: message upsert error after successful conversation upsert. ---
  {
    const { client, events } = makeFakeClient({ messages: 'error' });
    __setMessagingSupabaseClientForTests(client);

    const ok = await syncMessageToSupabase(messagePayload, conversationPayload);

    __setMessagingSupabaseClientForTests(null);

    assert('message-error: returns false', ok === false);
    assert(
      'message-error: both upserts fired (conversation succeeded, message failed)',
      events.some(e => e.table === 'conversations' && e.phase === 'exit') &&
        events.some(e => e.table === 'messages' && e.phase === 'exit'),
    );
  }

  // ============ Summary ============
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
})();
