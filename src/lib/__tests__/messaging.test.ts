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
  dedupeConversationsByParticipants,
  attachLastMessagesToConversations,
  useMessageStore,
  type Conversation,
  type Message,
} from '../messageStore';
import {
  syncMessageToSupabase,
  syncConversationToSupabase,
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

  // ============ D8: participant-order canonicalization ============
  // Prod Sev-1: the live `conversations` table has a CHECK constraint
  // `conversations_participant_order_check` enforcing `participant_1 <
  // participant_2`. Client-side must canonicalize before upsert.
  console.log('\n--- D8: canonicalize conversation participant order ---');

  // Deliberately lex-ordered so the "wrong" order is obvious in assertions.
  const USER_LO = 'a1111111-1111-1111-1111-111111111111'; // lex-smaller
  const USER_HI = 'f9999999-9999-9999-9999-999999999999'; // lex-greater

  // --- D8 Test (a): syncConversationToSupabase canonicalizes both orderings. ---
  {
    // Supplied in canonical order → upsert payload stays canonical.
    const { client: clientCanonical, events: eventsCanonical } = makeFakeClient();
    __setMessagingSupabaseClientForTests(clientCanonical);

    const okCanonical = await syncConversationToSupabase({
      id: 'conv-canonical',
      participants: [USER_LO, USER_HI],
      updatedAt: '2026-04-30T00:00:00.000Z',
    });

    __setMessagingSupabaseClientForTests(null);

    const payloadCanonical = eventsCanonical.find(
      e => e.table === 'conversations' && e.phase === 'enter',
    )?.payload;

    assert('D8(a)/canonical-input: returns true', okCanonical === true);
    assert(
      'D8(a)/canonical-input: payload has participant_1 < participant_2',
      payloadCanonical?.participant_1 === USER_LO &&
        payloadCanonical?.participant_2 === USER_HI,
      `payload=${JSON.stringify(payloadCanonical)}`,
    );

    // Supplied in REVERSED order → sync layer MUST still write canonical.
    // This is the defence-in-depth layer that closes the prod Sev-1 hole
    // when a stale locally-persisted row (pre-D8-Edit-1) flows through.
    const { client: clientReversed, events: eventsReversed } = makeFakeClient();
    __setMessagingSupabaseClientForTests(clientReversed);

    const okReversed = await syncConversationToSupabase({
      id: 'conv-reversed',
      participants: [USER_HI, USER_LO],
      updatedAt: '2026-04-30T00:00:00.000Z',
    });

    __setMessagingSupabaseClientForTests(null);

    const payloadReversed = eventsReversed.find(
      e => e.table === 'conversations' && e.phase === 'enter',
    )?.payload;

    assert('D8(a)/reversed-input: returns true', okReversed === true);
    assert(
      'ACCEPTANCE D8(a): sync-layer canonicalizes reversed input to participant_1 < participant_2',
      payloadReversed?.participant_1 === USER_LO &&
        payloadReversed?.participant_2 === USER_HI,
      `payload=${JSON.stringify(payloadReversed)}`,
    );
  }

  // --- D8 Test (b): getOrCreateConversation canonicalizes + lookup is order-agnostic. ---
  {
    // Install a no-op fake client for the fire-and-forget
    // syncConversationToSupabase call that getOrCreateConversation triggers.
    // We are testing the store shape here, not the sync payload (covered in 'a').
    const { client: noopClient } = makeFakeClient();
    __setMessagingSupabaseClientForTests(noopClient);

    // Reset the store so stale persisted state doesn't leak between test runs.
    useMessageStore.setState({ conversations: [], messages: [] });

    // Call in NON-canonical order: currentUserId (USER_HI) > otherUserId (USER_LO).
    // The store must flip them before persisting locally.
    const first = useMessageStore
      .getState()
      .getOrCreateConversation(USER_HI, USER_LO);

    assert(
      'D8(b)/first-call: returned conversation participants are canonical',
      first.participants[0] === USER_LO && first.participants[1] === USER_HI,
      `participants=${JSON.stringify(first.participants)}`,
    );

    // Second call with the args FLIPPED (now in canonical order) must return
    // the SAME conversation — the .includes() lookup is order-insensitive.
    const second = useMessageStore
      .getState()
      .getOrCreateConversation(USER_LO, USER_HI);

    assert(
      'ACCEPTANCE D8(b): getOrCreateConversation lookup is order-agnostic (same id)',
      second.id === first.id,
      `first.id=${first.id} second.id=${second.id}`,
    );
    assert(
      'D8(b)/second-call: returned conversation still has canonical participant order',
      second.participants[0] === USER_LO && second.participants[1] === USER_HI,
      `participants=${JSON.stringify(second.participants)}`,
    );
    assert(
      'D8(b): exactly one conversation row exists in the store for the pair',
      useMessageStore.getState().conversations.filter(
        c => c.participants.includes(USER_LO) && c.participants.includes(USER_HI),
      ).length === 1,
    );

    // Legacy-locally-persisted case: a conversation stored BEFORE the D8 fix
    // may still sit in Zustand with participants in reversed order. The
    // `.includes()` lookup must still find it — no local data repair needed.
    useMessageStore.setState({
      conversations: [
        {
          id: 'legacy-conv',
          participants: [USER_HI, USER_LO], // pre-D8 order
          updatedAt: '2026-04-29T00:00:00.000Z',
        },
      ],
      messages: [],
    });

    const legacyLookup = useMessageStore
      .getState()
      .getOrCreateConversation(USER_LO, USER_HI);

    assert(
      'D8(b)/legacy-local: order-insensitive .includes() lookup still matches',
      legacyLookup.id === 'legacy-conv',
      `got id=${legacyLookup.id}`,
    );

    // Clean up so later additions don't inherit this seeded state.
    useMessageStore.setState({ conversations: [], messages: [] });
    __setMessagingSupabaseClientForTests(null);
  }

  // ============ D8(c): dedupeConversationsByParticipants ============
  // Pure-helper coverage for the heal-on-sync routine that collapses
  // duplicate conversation rows for the same participant pair (the
  // "two message blocks with hendrik" symptom Christo reported in
  // /messages). All tests run against the exported pure function — no
  // store mutation, no zustand reads.
  {
    const A = '00000000-0000-0000-0000-aaaaaaaaaaaa';
    const B = '00000000-0000-0000-0000-bbbbbbbbbbbb';
    const C = '00000000-0000-0000-0000-cccccccccccc';

    const mkConv = (
      id: string,
      participants: string[],
      updatedAt: string,
    ): Conversation => ({ id, participants, updatedAt });

    const mkMsg = (
      id: string,
      conversationId: string,
    ): Message => ({
      id,
      conversationId,
      senderId: A,
      receiverId: B,
      content: 'hi',
      createdAt: '2026-04-28T00:00:00.000Z',
      read: false,
    });

    // --- (c1) No duplicates → input passes through unchanged ---
    {
      const conv = [mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z')];
      const msgs = [mkMsg('m1', 'c1')];
      const out = dedupeConversationsByParticipants(conv, msgs);
      assert(
        'D8(c1): single conversation passes through unchanged',
        out.conversations.length === 1 &&
          out.conversations[0].id === 'c1' &&
          out.messages.length === 1 &&
          out.messages[0].conversationId === 'c1',
      );
    }

    // --- (c2) Two convs same pair, picks newer updatedAt ---
    {
      const older = mkConv('c-old', [A, B], '2026-05-01T00:00:00.000Z');
      const newer = mkConv('c-new', [A, B], '2026-05-07T00:00:00.000Z');
      const msgs = [mkMsg('m-old', 'c-old'), mkMsg('m-new', 'c-new')];
      const out = dedupeConversationsByParticipants([older, newer], msgs);
      assert(
        'ACCEPTANCE D8(c2): one conv kept (the newer one) for the pair',
        out.conversations.length === 1 && out.conversations[0].id === 'c-new',
        `got ${JSON.stringify(out.conversations.map(c => c.id))}`,
      );
      assert(
        'D8(c2): all messages reassigned to the kept conversation id',
        out.messages.every(m => m.conversationId === 'c-new'),
        `got ${JSON.stringify(out.messages.map(m => [m.id, m.conversationId]))}`,
      );
    }

    // --- (c3) Order-insensitive grouping ---
    {
      // Two rows with the same pair but participants in reversed order
      // (a pre-D8(b) legacy row + a canonical row) — must still collapse.
      const reversed = mkConv('c-rev', [B, A], '2026-05-01T00:00:00.000Z');
      const canonical = mkConv('c-can', [A, B], '2026-05-08T00:00:00.000Z');
      const out = dedupeConversationsByParticipants([reversed, canonical], []);
      assert(
        'ACCEPTANCE D8(c3): order-insensitive grouping collapses [B,A] + [A,B]',
        out.conversations.length === 1 && out.conversations[0].id === 'c-can',
        `got ${JSON.stringify(out.conversations.map(c => [c.id, c.participants]))}`,
      );
    }

    // --- (c4) Different pairs are NOT collapsed ---
    {
      const ab = mkConv('c-ab', [A, B], '2026-05-01T00:00:00.000Z');
      const ac = mkConv('c-ac', [A, C], '2026-05-01T00:00:00.000Z');
      const out = dedupeConversationsByParticipants([ab, ac], []);
      assert(
        'D8(c4): distinct participant pairs are preserved',
        out.conversations.length === 2,
        `got ${out.conversations.length}`,
      );
    }

    // --- (c5) Tie on updatedAt → smallest id wins (deterministic) ---
    {
      const a = mkConv('c-aaa', [A, B], '2026-05-01T00:00:00.000Z');
      const z = mkConv('c-zzz', [A, B], '2026-05-01T00:00:00.000Z');
      const out = dedupeConversationsByParticipants([a, z], []);
      assert(
        'D8(c5): tie-break prefers the smallest id (deterministic across clients)',
        out.conversations.length === 1 && out.conversations[0].id === 'c-aaa',
        `got ${out.conversations[0]?.id}`,
      );
    }

    // --- (c6) Three duplicates collapse to one + all messages remap ---
    {
      const c1 = mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z');
      const c2 = mkConv('c2', [A, B], '2026-05-05T00:00:00.000Z');
      const c3 = mkConv('c3', [A, B], '2026-05-08T00:00:00.000Z');
      const msgs = [mkMsg('m1', 'c1'), mkMsg('m2', 'c2'), mkMsg('m3', 'c3')];
      const out = dedupeConversationsByParticipants([c1, c2, c3], msgs);
      assert(
        'D8(c6): three duplicates collapse to one (newest by updatedAt)',
        out.conversations.length === 1 && out.conversations[0].id === 'c3',
      );
      assert(
        'D8(c6): every message reassigned to the kept id (no orphans)',
        out.messages.length === 3 &&
          out.messages.every(m => m.conversationId === 'c3'),
        `got ${JSON.stringify(out.messages.map(m => [m.id, m.conversationId]))}`,
      );
    }

    // --- (c7) Pure function: input arrays not mutated ---
    {
      const c1 = mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z');
      const c2 = mkConv('c2', [A, B], '2026-05-08T00:00:00.000Z');
      const msgs = [mkMsg('m1', 'c1')];
      const inputConvs = [c1, c2];
      const inputMsgs = [...msgs];
      dedupeConversationsByParticipants(inputConvs, inputMsgs);
      assert(
        'D8(c7): purity — input conversations array unchanged',
        inputConvs.length === 2 && inputConvs[0].id === 'c1' && inputConvs[1].id === 'c2',
      );
      assert(
        'D8(c7): purity — input messages unchanged (conversationId not mutated)',
        inputMsgs[0].conversationId === 'c1',
      );
    }

    // --- (c8) Malformed rows pass through (defensive) ---
    {
      const malformed = { id: 'bad', participants: [], updatedAt: '' } as any as Conversation;
      const good = mkConv('c-good', [A, B], '2026-05-01T00:00:00.000Z');
      const out = dedupeConversationsByParticipants([malformed, good], []);
      assert(
        'D8(c8): malformed row (empty participants) does NOT collapse with valid rows',
        out.conversations.length === 2,
        `got ${out.conversations.length}`,
      );
    }
  }

  // ============ M3: attachLastMessagesToConversations ============
  // Acceptance: opening /messages on a fresh device (or after any
  // SupabaseSync re-fetch) shows the same preview snippets as the device
  // where the messages were sent. The conversations table has no
  // last_message_* columns, so lastMessage must be projected from the
  // messages array on every sync.
  console.log('\n## M3: attachLastMessagesToConversations');
  {
    const A = '11111111-1111-1111-1111-111111111111';
    const B = '22222222-2222-2222-2222-222222222222';
    const mkConv = (id: string, parts: [string, string], updatedAt: string, lastMessage?: Message): Conversation => ({
      id,
      participants: parts,
      updatedAt,
      ...(lastMessage ? { lastMessage } : {}),
    });
    const mkMsg = (id: string, convId: string, createdAt: string, content = id): Message => ({
      id,
      conversationId: convId,
      senderId: A,
      receiverId: B,
      content,
      createdAt,
      read: false,
    });

    // --- (m1) Empty conversations → returned untouched ---
    {
      const out = attachLastMessagesToConversations([], [mkMsg('m1', 'c1', '2026-05-08T12:00:00.000Z')]);
      assert(
        'M3(m1): empty conversations input is a no-op',
        Array.isArray(out) && out.length === 0,
      );
    }

    // --- (m2) Conversation with one message → lastMessage attached, updatedAt bumped ---
    {
      const c = mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z');
      const m = mkMsg('m1', 'c1', '2026-05-08T12:00:00.000Z', 'hello');
      const [out] = attachLastMessagesToConversations([c], [m]);
      assert(
        'ACCEPTANCE M3(m2): single message becomes the conversation lastMessage',
        out.lastMessage?.id === 'm1' && out.lastMessage?.content === 'hello',
        `got ${JSON.stringify(out.lastMessage)}`,
      );
      assert(
        'M3(m2): updatedAt advances to the latest message createdAt when newer',
        out.updatedAt === '2026-05-08T12:00:00.000Z',
        `got ${out.updatedAt}`,
      );
    }

    // --- (m3) Multiple messages → newest by createdAt wins ---
    {
      const c = mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z');
      const ms = [
        mkMsg('m1', 'c1', '2026-05-05T10:00:00.000Z', 'older'),
        mkMsg('m2', 'c1', '2026-05-08T12:00:00.000Z', 'newer'),
        mkMsg('m3', 'c1', '2026-05-06T10:00:00.000Z', 'middle'),
      ];
      const [out] = attachLastMessagesToConversations([c], ms);
      assert(
        'M3(m3): newest message by createdAt wins',
        out.lastMessage?.id === 'm2' && out.lastMessage?.content === 'newer',
        `got ${out.lastMessage?.id}/${out.lastMessage?.content}`,
      );
    }

    // --- (m4) Tie on createdAt → smallest id wins (deterministic across clients) ---
    {
      const c = mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z');
      const ms = [
        mkMsg('m-zzz', 'c1', '2026-05-08T12:00:00.000Z', 'z'),
        mkMsg('m-aaa', 'c1', '2026-05-08T12:00:00.000Z', 'a'),
      ];
      const [out] = attachLastMessagesToConversations([c], ms);
      assert(
        'M3(m4): tie-break prefers the smallest id (deterministic)',
        out.lastMessage?.id === 'm-aaa',
        `got ${out.lastMessage?.id}`,
      );
    }

    // --- (m5) Empty conversation (no messages) → row preserved, lastMessage undefined ---
    {
      const c = mkConv('c-empty', [A, B], '2026-05-01T00:00:00.000Z');
      const [out] = attachLastMessagesToConversations([c], []);
      assert(
        'M3(m5): conversation with no messages is preserved',
        out.id === 'c-empty' && out.participants.length === 2,
      );
      assert(
        'M3(m5): conversation with no messages keeps lastMessage undefined',
        out.lastMessage === undefined,
      );
      assert(
        'M3(m5): updatedAt unchanged when no messages',
        out.updatedAt === '2026-05-01T00:00:00.000Z',
      );
    }

    // --- (m6) Stale lastMessage on incoming row is overwritten by the projection ---
    {
      const stale = mkMsg('m-stale', 'c1', '2026-04-01T00:00:00.000Z', 'STALE');
      const c = mkConv('c1', [A, B], '2026-04-01T00:00:00.000Z', stale);
      const newer = mkMsg('m-new', 'c1', '2026-05-08T12:00:00.000Z', 'FRESH');
      const [out] = attachLastMessagesToConversations([c], [newer]);
      assert(
        'M3(m6): stale lastMessage on the conversation row is replaced by the newest message in the list',
        out.lastMessage?.id === 'm-new' && out.lastMessage?.content === 'FRESH',
        `got ${out.lastMessage?.id}/${out.lastMessage?.content}`,
      );
    }

    // --- (m7) Messages for OTHER conversations are NOT attached here ---
    {
      const c1 = mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z');
      const c2 = mkConv('c2', [A, B], '2026-05-01T00:00:00.000Z');
      const ms = [
        mkMsg('m1-c1', 'c1', '2026-05-02T10:00:00.000Z', 'c1 msg'),
        mkMsg('m1-c2', 'c2', '2026-05-08T10:00:00.000Z', 'c2 msg'),
      ];
      const out = attachLastMessagesToConversations([c1, c2], ms);
      const c1Out = out.find(c => c.id === 'c1')!;
      const c2Out = out.find(c => c.id === 'c2')!;
      assert(
        'M3(m7): per-conversation scoping — c1 lastMessage is c1-only',
        c1Out.lastMessage?.id === 'm1-c1' && c2Out.lastMessage?.id === 'm1-c2',
        `c1=${c1Out.lastMessage?.id} c2=${c2Out.lastMessage?.id}`,
      );
    }

    // --- (m8) updatedAt is NOT regressed when conversation row is newer than messages ---
    {
      const c = mkConv('c1', [A, B], '2026-05-08T15:00:00.000Z');
      const olderMsg = mkMsg('m1', 'c1', '2026-05-08T12:00:00.000Z', 'older');
      const [out] = attachLastMessagesToConversations([c], [olderMsg]);
      assert(
        'M3(m8): updatedAt does NOT regress when the conversation row is newer than the latest message',
        out.updatedAt === '2026-05-08T15:00:00.000Z',
        `got ${out.updatedAt}`,
      );
      assert(
        'M3(m8): lastMessage is still attached even when updatedAt is not bumped',
        out.lastMessage?.id === 'm1',
      );
    }

    // --- (m9) Pure: input arrays not mutated ---
    {
      const c = mkConv('c1', [A, B], '2026-05-01T00:00:00.000Z');
      const m = mkMsg('m1', 'c1', '2026-05-08T12:00:00.000Z');
      const inputConvs = [c];
      const inputMsgs = [m];
      attachLastMessagesToConversations(inputConvs, inputMsgs);
      assert(
        'M3(m9): purity — input conversations array unchanged',
        inputConvs[0].lastMessage === undefined,
      );
      assert(
        'M3(m9): purity — input messages array unchanged',
        inputMsgs[0].id === 'm1' && inputMsgs[0].createdAt === '2026-05-08T12:00:00.000Z',
      );
    }
  }

  // ============ Summary ============
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
})();
