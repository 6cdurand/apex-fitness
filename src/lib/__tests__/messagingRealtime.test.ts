/**
 * Tests for M1 + M2: realtime messages + conversations merge.
 *
 * Run with: npx tsx src/lib/__tests__/messagingRealtime.test.ts
 *
 * Coverage:
 *  - M1 (Sev-1): __applyMessageRealtimeEvent merges an inbound realtime
 *    INSERT into useMessageStore.messages so the receiver sees new
 *    messages without a reload. Dedupes on id (self-echo of an
 *    optimistically inserted message is a no-op).
 *  - M2: the same apply call patches the owning conversation's
 *    `lastMessage` and `updatedAt` so the /messages list preview line
 *    is filled on the receiver side without a /messages-page change.
 *  - D2 preservation: a stale remote `read=false` row cannot regress a
 *    freshly-flipped local `read=true` (read-prefer semantics hold).
 *  - Stale-UPDATE guard: an UPDATE event echoing an older message does
 *    NOT regress the conversation's lastMessage to older content.
 *  - Conversation channel: __applyConversationRealtimeEvent field-level
 *    merges a DB row (snake_case → local shape) and critically PRESERVES
 *    the local `lastMessage` (the DB conversations table does not store
 *    it, so we must not wholesale-replace the local row).
 *  - Malformed row: a payload missing `id` is silently ignored.
 *
 * We drive the pure helpers directly (test seams) — no Realtime channel
 * mocking required. This mirrors the D11 allowance ("if it requires
 * mocking the Realtime layer significantly, skip") and matches the
 * existing seam pattern (__setWorkoutSupabaseClientForTests).
 */

// ---- localStorage shim for zustand/persist during module load -----------
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

// Not strictly required by the helpers under test (they don't hit the
// network), but SupabaseSync.tsx imports @/lib/supabase whose module
// initialisation reads env and creates a client. Seed safe placeholders.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJtest.fake.token';

import { useMessageStore, type Message, type Conversation } from '../messageStore';
import {
  __applyMessageRealtimeEvent,
  __applyConversationRealtimeEvent,
} from '../../components/SupabaseSync';

// ---- tiny assertion runner (mirrors other test files in this dir) -------
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`❌ ${name}\n   ${e?.message ?? e}`);
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

// ---- helpers to reset store between tests -------------------------------
function resetStore(initial?: { messages?: Message[]; conversations?: Conversation[] }) {
  useMessageStore.setState({
    messages: initial?.messages ?? [],
    conversations: initial?.conversations ?? [],
  });
}

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const CONV_ID = '33333333-3333-3333-3333-333333333333';

// ============================================================================
// M1: receiver-side realtime INSERT lands in the store
// ============================================================================

test('M1: inbound INSERT event appends the message to messages', () => {
  resetStore({
    conversations: [
      { id: CONV_ID, participants: [USER_A, USER_B], updatedAt: '2026-04-28T10:00:00.000Z' },
    ],
  });

  __applyMessageRealtimeEvent({
    id: 'msg-1',
    conversation_id: CONV_ID,
    sender_id: USER_A,
    receiver_id: USER_B,
    content: 'yo',
    read: false,
    created_at: '2026-04-28T11:00:00.000Z',
  });

  const { messages } = useMessageStore.getState();
  assertEqual(messages.length, 1, 'messages.length');
  assertEqual(messages[0].id, 'msg-1', 'messages[0].id');
  assertEqual(messages[0].content, 'yo', 'messages[0].content');
  assertEqual(messages[0].read, false, 'messages[0].read');
  assertEqual(messages[0].senderId, USER_A, 'messages[0].senderId');
  assertEqual(messages[0].receiverId, USER_B, 'messages[0].receiverId');
});

test('M1: re-applying the same INSERT is idempotent (self-echo dedupe)', () => {
  resetStore({
    messages: [
      {
        id: 'msg-1',
        conversationId: CONV_ID,
        senderId: USER_B, // already sent locally by the receiver-of-echo
        receiverId: USER_A,
        content: 'hi',
        createdAt: '2026-04-28T11:00:00.000Z',
        read: false,
      },
    ],
    conversations: [
      { id: CONV_ID, participants: [USER_A, USER_B], updatedAt: '2026-04-28T11:00:00.000Z' },
    ],
  });

  // Realtime echo of the same row (same id).
  __applyMessageRealtimeEvent({
    id: 'msg-1',
    conversation_id: CONV_ID,
    sender_id: USER_B,
    receiver_id: USER_A,
    content: 'hi',
    read: false,
    created_at: '2026-04-28T11:00:00.000Z',
  });

  const { messages } = useMessageStore.getState();
  assertEqual(messages.length, 1, 'still exactly one message (no duplicate)');
});

// ============================================================================
// M2: conv.lastMessage preview is filled on incoming messages
// ============================================================================

test('M2: inbound message patches conversation lastMessage + updatedAt', () => {
  resetStore({
    conversations: [
      { id: CONV_ID, participants: [USER_A, USER_B], updatedAt: '2026-04-28T10:00:00.000Z' },
    ],
  });

  __applyMessageRealtimeEvent({
    id: 'msg-2',
    conversation_id: CONV_ID,
    sender_id: USER_A,
    receiver_id: USER_B,
    content: 'ping',
    read: false,
    created_at: '2026-04-28T11:30:00.000Z',
  });

  const conv = useMessageStore.getState().conversations.find(c => c.id === CONV_ID)!;
  assertTrue(conv, 'conversation still exists');
  assertEqual(conv.lastMessage?.id, 'msg-2', 'conv.lastMessage.id');
  assertEqual(conv.lastMessage?.content, 'ping', 'conv.lastMessage.content');
  assertEqual(conv.lastMessage?.senderId, USER_A, 'conv.lastMessage.senderId');
  assertEqual(conv.lastMessage?.createdAt, '2026-04-28T11:30:00.000Z', 'conv.lastMessage.createdAt');
  assertEqual(conv.updatedAt, '2026-04-28T11:30:00.000Z', 'conv.updatedAt advanced');
});

test('M2: later message wins — newer inbound replaces older lastMessage', () => {
  resetStore({
    conversations: [
      {
        id: CONV_ID,
        participants: [USER_A, USER_B],
        updatedAt: '2026-04-28T11:30:00.000Z',
        lastMessage: {
          id: 'msg-old',
          conversationId: CONV_ID,
          senderId: USER_A,
          receiverId: USER_B,
          content: 'first',
          createdAt: '2026-04-28T11:30:00.000Z',
          read: false,
        },
      },
    ],
    messages: [
      {
        id: 'msg-old',
        conversationId: CONV_ID,
        senderId: USER_A,
        receiverId: USER_B,
        content: 'first',
        createdAt: '2026-04-28T11:30:00.000Z',
        read: false,
      },
    ],
  });

  __applyMessageRealtimeEvent({
    id: 'msg-new',
    conversation_id: CONV_ID,
    sender_id: USER_A,
    receiver_id: USER_B,
    content: 'second',
    read: false,
    created_at: '2026-04-28T12:00:00.000Z',
  });

  const conv = useMessageStore.getState().conversations.find(c => c.id === CONV_ID)!;
  assertEqual(conv.lastMessage?.id, 'msg-new', 'lastMessage advanced to newer');
  assertEqual(conv.lastMessage?.content, 'second', 'lastMessage content advanced');
  assertEqual(conv.updatedAt, '2026-04-28T12:00:00.000Z', 'updatedAt advanced');
});

test('M2: stale UPDATE event does NOT regress lastMessage to older content', () => {
  resetStore({
    conversations: [
      {
        id: CONV_ID,
        participants: [USER_A, USER_B],
        updatedAt: '2026-04-28T12:00:00.000Z',
        lastMessage: {
          id: 'msg-new',
          conversationId: CONV_ID,
          senderId: USER_A,
          receiverId: USER_B,
          content: 'second',
          createdAt: '2026-04-28T12:00:00.000Z',
          read: false,
        },
      },
    ],
    messages: [
      {
        id: 'msg-new',
        conversationId: CONV_ID,
        senderId: USER_A,
        receiverId: USER_B,
        content: 'second',
        createdAt: '2026-04-28T12:00:00.000Z',
        read: false,
      },
    ],
  });

  // Out-of-order UPDATE for the older message arriving late.
  __applyMessageRealtimeEvent({
    id: 'msg-old',
    conversation_id: CONV_ID,
    sender_id: USER_A,
    receiver_id: USER_B,
    content: 'first',
    read: true,
    created_at: '2026-04-28T11:30:00.000Z',
  });

  const conv = useMessageStore.getState().conversations.find(c => c.id === CONV_ID)!;
  assertEqual(conv.lastMessage?.id, 'msg-new', 'lastMessage preserved (did not regress)');
  assertEqual(conv.lastMessage?.content, 'second', 'lastMessage content preserved');
  assertEqual(conv.updatedAt, '2026-04-28T12:00:00.000Z', 'updatedAt preserved');
});

// ============================================================================
// D2 preservation through the realtime path
// ============================================================================

test('D2: realtime UPDATE with read=false does not regress local read=true', () => {
  resetStore({
    messages: [
      {
        id: 'msg-3',
        conversationId: CONV_ID,
        senderId: USER_A,
        receiverId: USER_B,
        content: 'hey',
        createdAt: '2026-04-28T11:00:00.000Z',
        read: true, // locally flipped
      },
    ],
    conversations: [
      { id: CONV_ID, participants: [USER_A, USER_B], updatedAt: '2026-04-28T11:00:00.000Z' },
    ],
  });

  // Stale remote echo claiming read=false.
  __applyMessageRealtimeEvent({
    id: 'msg-3',
    conversation_id: CONV_ID,
    sender_id: USER_A,
    receiver_id: USER_B,
    content: 'hey',
    read: false,
    created_at: '2026-04-28T11:00:00.000Z',
  });

  const msg = useMessageStore.getState().messages.find(m => m.id === 'msg-3')!;
  assertEqual(msg.read, true, 'read=true preserved (mergeMessagesPreferRead)');
});

// ============================================================================
// Conversation channel
// ============================================================================

test('conv channel: existing conversation UPDATE preserves local lastMessage', () => {
  resetStore({
    conversations: [
      {
        id: CONV_ID,
        participants: [USER_A, USER_B],
        updatedAt: '2026-04-28T10:00:00.000Z',
        lastMessage: {
          id: 'msg-keep',
          conversationId: CONV_ID,
          senderId: USER_A,
          receiverId: USER_B,
          content: 'keep me',
          createdAt: '2026-04-28T11:00:00.000Z',
          read: false,
        },
      },
    ],
  });

  __applyConversationRealtimeEvent({
    id: CONV_ID,
    participant_1: USER_A,
    participant_2: USER_B,
    updated_at: '2026-04-28T12:00:00.000Z',
  });

  const conv = useMessageStore.getState().conversations.find(c => c.id === CONV_ID)!;
  assertEqual(conv.updatedAt, '2026-04-28T12:00:00.000Z', 'updatedAt advanced');
  assertEqual(conv.lastMessage?.id, 'msg-keep', 'local lastMessage preserved');
  assertEqual(conv.lastMessage?.content, 'keep me', 'local lastMessage content preserved');
  assertEqual(conv.participants, [USER_A, USER_B], 'participants preserved');
});

test('conv channel: new conversation INSERT is appended', () => {
  resetStore({ conversations: [] });

  __applyConversationRealtimeEvent({
    id: CONV_ID,
    participant_1: USER_A,
    participant_2: USER_B,
    updated_at: '2026-04-28T12:00:00.000Z',
  });

  const conv = useMessageStore.getState().conversations.find(c => c.id === CONV_ID)!;
  assertTrue(conv, 'conversation inserted');
  assertEqual(conv.participants, [USER_A, USER_B], 'participants mapped from participant_1/2');
  assertEqual(conv.updatedAt, '2026-04-28T12:00:00.000Z', 'updatedAt mapped from updated_at');
});

test('conv channel: stale updated_at does not regress local updatedAt', () => {
  resetStore({
    conversations: [
      { id: CONV_ID, participants: [USER_A, USER_B], updatedAt: '2026-04-28T12:00:00.000Z' },
    ],
  });

  __applyConversationRealtimeEvent({
    id: CONV_ID,
    participant_1: USER_A,
    participant_2: USER_B,
    updated_at: '2026-04-28T10:00:00.000Z',
  });

  const conv = useMessageStore.getState().conversations.find(c => c.id === CONV_ID)!;
  assertEqual(conv.updatedAt, '2026-04-28T12:00:00.000Z', 'newer local updatedAt retained');
});

// ============================================================================
// Malformed payloads
// ============================================================================

test('malformed message row (missing id) is silently ignored', () => {
  resetStore({
    conversations: [
      { id: CONV_ID, participants: [USER_A, USER_B], updatedAt: '2026-04-28T10:00:00.000Z' },
    ],
  });

  __applyMessageRealtimeEvent({ conversation_id: CONV_ID, content: 'nope' });
  __applyMessageRealtimeEvent(null);
  __applyMessageRealtimeEvent(undefined);

  assertEqual(useMessageStore.getState().messages.length, 0, 'no messages were added');
});

test('malformed conversation row (missing participant) is silently ignored', () => {
  resetStore({ conversations: [] });

  __applyConversationRealtimeEvent({ id: CONV_ID, updated_at: '2026-04-28T12:00:00.000Z' });
  __applyConversationRealtimeEvent(null);

  assertEqual(useMessageStore.getState().conversations.length, 0, 'no conversations were added');
});

// ---- summary -------------------------------------------------------------
console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
if (failed > 0) process.exit(1);
