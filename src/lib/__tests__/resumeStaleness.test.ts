/**
 * Regression B — iPad staleness cluster (BUG-007 / BACKLOG #10).
 *
 * Two contracts of the refetch-on-resume fix, both unit-testable without React
 * or a device:
 *
 *  1) MEMO RE-RENDER WITHOUT REMOUNT — the /clients/[id] `sessions` /
 *     `packages` / `calendarEvents` memos were keyed on `clientId` ONLY, so a
 *     refetch-on-resume that REPLACED the underlying store collection produced
 *     the SAME memoized value (clientId unchanged) → the screen showed stale
 *     data until force-quit. Keying the memo on its data collection (mirroring
 *     PR #45's payments fix) makes it recompute when the collection changes.
 *
 *  2) RESUME DEBOUNCE — `useRefetchOnResume` debounces so a quick
 *     background→foreground flicker (or web focus + visibilitychange firing
 *     together) doesn't double-fetch.
 *
 * Run with: npx tsx src/lib/__tests__/resumeStaleness.test.ts
 */

import { __shouldFireResume } from '../hooks/useRefetchOnResume';

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

// ---------------------------------------------------------------------------
// A tiny model of React's useMemo: recompute only when one of the deps changes
// (Object.is comparison, same as React). `compute` is the memo body.
// ---------------------------------------------------------------------------
function makeMemo<T>(compute: () => T) {
  let prevDeps: unknown[] | null = null;
  let value: T;
  return (deps: unknown[]): T => {
    const changed =
      prevDeps === null ||
      deps.length !== prevDeps.length ||
      deps.some((d, i) => !Object.is(d, prevDeps![i]));
    if (changed) {
      value = compute();
      prevDeps = deps;
    }
    return value;
  };
}

type Session = { id: string; clientId: string };

console.log('\n--- Regression B: memo recompute on resume (BACKLOG #10) ---');

// The memo BODY is the store getter: filter the live collection by clientId.
// `store.sessions` is the mutable collection a resume refetch REPLACES.
{
  const clientId = 'client-1';
  const store = { sessions: [{ id: 's1', clientId }] as Session[] };
  const selectSessions = () => store.sessions.filter((s) => s.clientId === clientId);

  // BUGGY: keyed on [clientId] only.
  const buggyMemo = makeMemo(selectSessions);
  const buggyFirst = buggyMemo([clientId]);
  // A session is booked on another device; resume refetch replaces the array.
  store.sessions = [...store.sessions, { id: 's2', clientId }];
  const buggyAfter = buggyMemo([clientId]); // same dep → stale value returned
  assert('control: clientId-only memo stays stale after resume refetch (reproduces bug)',
    buggyFirst.length === 1 && buggyAfter.length === 1);

  // FIXED: keyed on [clientId, collection]. Reset the collection first.
  store.sessions = [{ id: 's1', clientId }];
  const fixedMemo = makeMemo(selectSessions);
  const fixedFirst = fixedMemo([clientId, store.sessions]);
  store.sessions = [...store.sessions, { id: 's2', clientId }]; // new array identity
  const fixedAfter = fixedMemo([clientId, store.sessions]);
  assert('fix: collection-keyed memo recomputes → new session appears (no remount)',
    fixedFirst.length === 1 && fixedAfter.length === 2 && fixedAfter.some((s) => s.id === 's2'));

  // Same fix applies to notifications (a separate collection, same mechanism).
  const notifStore = { notifications: [{ id: 'n1' }] };
  const selectNotifs = () => notifStore.notifications;
  const notifMemo = makeMemo(selectNotifs);
  notifMemo([notifStore.notifications]);
  notifStore.notifications = [...notifStore.notifications, { id: 'n2' }];
  const notifsAfter = notifMemo([notifStore.notifications]);
  assert('fix: notifications appear after resume refetch (no remount)',
    notifsAfter.length === 2);
}

console.log('\n--- Regression B: resume debounce gate ---');
{
  assert('first resume always fires (lastFired=0)',
    __shouldFireResume(0, 1_000, 800) === true);
  assert('rapid second resume within window is debounced',
    __shouldFireResume(1_000, 1_300, 800) === false);
  assert('resume after the debounce window fires again',
    __shouldFireResume(1_000, 2_000, 800) === true);
}

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) process.exit(1);
