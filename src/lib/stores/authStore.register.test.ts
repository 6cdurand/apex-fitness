/**
 * Tests for `useAuthStore.register` — Layer 2 of the identity reconciliation
 * fix (artifact c).
 *
 * Run with:
 *   npx tsx src/lib/stores/authStore.register.test.ts
 *
 * Coverage (per PLAN_identity_reconciliation_artifact_c.md §2.4):
 *  1. `supabase.auth.signUp` is called EXACTLY ONCE with the provided
 *     email/password (and display_name inside options.data).
 *  2. Genuine new signup (no placeholder in localStorage): the resulting
 *     `useAuthStore.user.id` equals the auth.users.id returned by signUp —
 *     i.e. public.users.id == auth.users.id from day one, zero divergence.
 *  3. Placeholder-upgrade path: when a trainer-created placeholder at
 *     `placeholder-id-XYZ` exists in localStorage, the resulting
 *     `useAuthStore.user.id` equals that placeholder id (continuity of
 *     trainer-side assignments is preserved).
 *  4. `registerUserWithAuthLink` is ALWAYS called with
 *     `authUserId === signUp.data.user.id`, regardless of whether the
 *     canonical public.users.id equals the auth id (genuine new) or the
 *     placeholder id (upgrade). That's what populates public.users.auth_user_id
 *     and lets `effective_uid()` resolve the canonical id on the server.
 *  5. `supabase.auth.signUp` error → `register` returns false, does NOT
 *     touch localStorage, does NOT call `registerUserWithAuthLink`, and
 *     leaves the store's `user` at null / `isAuthenticated` false.
 *  6. `supabase.auth.signUp` succeeds BUT `registerUserWithAuthLink` throws
 *     → `register` still returns true, auth state is set, user is logged
 *     in. Non-fatal: auth.users row exists, the on_auth_user_created
 *     trigger may have linked auth_user_id server-side, and the user can
 *     still use the app while the sync is retried later.
 *
 * The test uses two injection points:
 *  (a) `supabase.auth.signUp` — replaced directly on the shared auth client
 *      instance by assigning a stub; instance-level assignment shadows the
 *      prototype method, same pattern as any standard method spy.
 *  (b) `__setRegisterUserWithAuthLinkForTests` — named test seam exported
 *      from authStore.ts, mirroring the `__setMessagingSupabaseClientForTests`
 *      / `__setWorkoutSupabaseClientForTests` pattern already used in
 *      supabaseSync.ts. No production code path reads the override.
 */

// ---- env: make isSupabaseConfigured() return true so the register path
// reaches the signUp call. The stub intercepts before any real network.
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

// ---- fetch spy: blocks any network so a silent Supabase PATCH / INSERT
// from a test misconfiguration fails loudly instead of touching prod.
let fetchCallCount = 0;
const originalFetch = (globalThis as any).fetch;
(globalThis as any).fetch = (..._args: any[]) => {
  fetchCallCount++;
  return Promise.reject(new Error('[test] fetch blocked'));
};

import { useAuthStore, __setRegisterUserWithAuthLinkForTests } from './authStore';
import { supabase } from '../supabase';
import type { User } from '@/types';

// ---- signUp stub -------------------------------------------------------
type SignUpArg = { email: string; password: string; options?: { data?: any } };
type SignUpResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};
const signUpCalls: SignUpArg[] = [];
let signUpNext: SignUpResult = {
  data: { user: { id: 'auth-default' } },
  error: null,
};
// instance-level property assignment shadows GoTrueClient.prototype.signUp
(supabase.auth as any).signUp = async (arg: SignUpArg): Promise<SignUpResult> => {
  signUpCalls.push(arg);
  return signUpNext;
};

// ---- registerUserWithAuthLink stub -------------------------------------
type LinkCall = { user: User; password: string; authUserId: string; accountStatus?: string };
const linkCalls: LinkCall[] = [];
let linkBehavior: 'ok' | 'throw' = 'ok';
__setRegisterUserWithAuthLinkForTests(async (user, password, authUserId, accountStatus) => {
  linkCalls.push({ user, password, authUserId, accountStatus });
  if (linkBehavior === 'throw') throw new Error('[test] registerUserWithAuthLink exploded');
  return true;
});

// ---- assertion runner --------------------------------------------------
let passed = 0;
let failed = 0;
function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(
      () => { passed++; console.log(`  ✅ ${name}`); },
      (e: any) => { failed++; console.error(`  ❌ ${name}\n     ${e?.message ?? e}`); },
    );
}
function assertEqual<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}
function assertTrue(cond: any, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy, got ${String(cond)}`);
}

// ---- per-test reset ----------------------------------------------------
function resetAll() {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  (globalThis as any).localStorage.clear();
  signUpCalls.length = 0;
  linkCalls.length = 0;
  linkBehavior = 'ok';
  signUpNext = { data: { user: { id: 'auth-default' } }, error: null };
  fetchCallCount = 0;
}

function writeApexUsers(rows: any[]) {
  (globalThis as any).localStorage.setItem('apex-users', JSON.stringify(rows));
}
function readApexUsers(): any[] {
  return JSON.parse((globalThis as any).localStorage.getItem('apex-users') || '[]');
}

// =========================================================================

(async () => {
  console.log('\n--- register: supabase.auth.signUp wiring ---');

  await test('calls supabase.auth.signUp exactly once with email/password/display_name', async () => {
    resetAll();
    signUpNext = { data: { user: { id: 'auth-111' } }, error: null };
    const ok = await useAuthStore.getState().register({
      email: 'new-user@example.com',
      username: 'newuser',
      displayName: 'New User',
      password: 'pw-12345',
    });
    assertTrue(ok, 'register returns true');
    assertEqual(signUpCalls.length, 1, 'signUp called exactly once');
    assertEqual(signUpCalls[0].email, 'new-user@example.com', 'signUp email');
    assertEqual(signUpCalls[0].password, 'pw-12345', 'signUp password (plaintext, Supabase hashes server-side)');
    assertEqual(
      signUpCalls[0].options?.data?.display_name,
      'New User',
      'signUp options.data.display_name',
    );
  });

  // =======================================================================

  console.log('\n--- register: genuine new signup (no placeholder) ---');

  await test('uses auth.users.id as public.users.id when no placeholder exists (zero divergence)', async () => {
    resetAll();
    signUpNext = { data: { user: { id: 'auth-genuine-999' } }, error: null };
    const ok = await useAuthStore.getState().register({
      email: 'brand-new@example.com',
      username: 'brandnew',
      displayName: 'Brand New',
      password: 'pw-ok',
    });
    assertTrue(ok, 'register returns true');
    assertEqual(
      useAuthStore.getState().user?.id,
      'auth-genuine-999',
      'store user.id === signUp.data.user.id',
    );
    assertEqual(useAuthStore.getState().isAuthenticated, true, 'isAuthenticated flipped true');

    // Also visible in apex-users
    const rows = readApexUsers();
    const row = rows.find((r: any) => r.email === 'brand-new@example.com');
    assertTrue(row, 'apex-users row written');
    assertEqual(row.id, 'auth-genuine-999', 'apex-users row id === auth id');
    assertEqual(row.accountStatus, 'active', 'accountStatus marked active');
  });

  // =======================================================================

  console.log('\n--- register: placeholder-upgrade continuity ---');

  await test('reuses placeholder id (NOT auth id) when a placeholder exists for the email', async () => {
    resetAll();
    // Trainer previously created a placeholder for this client at placeholder-id-XYZ.
    writeApexUsers([
      {
        id: 'placeholder-id-XYZ',
        email: 'invited-client@example.com',
        username: 'invited',
        displayName: 'Invited Client',
        accountStatus: 'placeholder',
        createdAt: '2026-01-01T00:00:00.000Z',
        trainerId: 'trainer-abc',
      },
    ]);
    signUpNext = { data: { user: { id: 'auth-fresh-000' } }, error: null };

    const ok = await useAuthStore.getState().register({
      email: 'invited-client@example.com',
      username: 'invited',
      displayName: 'Invited Client',
      password: 'pw-upgrade',
    });
    assertTrue(ok, 'register returns true');
    // Critical: public.users.id is the PLACEHOLDER id, not the auth id.
    // If this regresses, trainer assignments pointing at placeholder-id-XYZ
    // silently go dark.
    assertEqual(
      useAuthStore.getState().user?.id,
      'placeholder-id-XYZ',
      'store user.id === placeholder id (continuity preserved)',
    );
    assertEqual(
      useAuthStore.getState().user?.trainerId,
      'trainer-abc',
      'trainerId carried forward from placeholder',
    );
    assertEqual(
      useAuthStore.getState().user?.createdAt,
      '2026-01-01T00:00:00.000Z',
      'createdAt carried forward from placeholder',
    );
    // apex-users: placeholder row replaced (not duplicated)
    const rows = readApexUsers();
    const matches = rows.filter((r: any) => r.email === 'invited-client@example.com');
    assertEqual(matches.length, 1, 'exactly one row for the email (placeholder replaced, not duplicated)');
    assertEqual(matches[0].id, 'placeholder-id-XYZ', 'the surviving row still has the placeholder id');
    assertEqual(matches[0].accountStatus, 'active', 'surviving row upgraded to active');
  });

  // =======================================================================

  console.log('\n--- register: registerUserWithAuthLink always gets auth.users.id ---');

  await test('linkFn called with authUserId = signUp id (genuine new branch)', async () => {
    resetAll();
    signUpNext = { data: { user: { id: 'auth-link-check-1' } }, error: null };
    await useAuthStore.getState().register({
      email: 'link1@example.com',
      username: 'link1',
      displayName: 'Link One',
      password: 'pw',
    });
    assertEqual(linkCalls.length, 1, 'linkFn called exactly once');
    assertEqual(
      linkCalls[0].authUserId,
      'auth-link-check-1',
      'linkFn received the auth id as authUserId',
    );
    // In the genuine-new branch, user.id also equals the auth id.
    assertEqual(
      linkCalls[0].user.id,
      'auth-link-check-1',
      'user.id === authUserId for genuine new signup',
    );
    assertEqual(linkCalls[0].password, 'pw', 'linkFn received plaintext password');
  });

  await test('linkFn called with authUserId = signUp id (placeholder upgrade branch)', async () => {
    resetAll();
    writeApexUsers([
      {
        id: 'placeholder-id-XYZ',
        email: 'link2@example.com',
        username: 'link2',
        displayName: 'Link Two',
        accountStatus: 'placeholder',
      },
    ]);
    signUpNext = { data: { user: { id: 'auth-link-check-2' } }, error: null };
    await useAuthStore.getState().register({
      email: 'link2@example.com',
      username: 'link2',
      displayName: 'Link Two',
      password: 'pw',
    });
    assertEqual(linkCalls.length, 1, 'linkFn called exactly once');
    assertEqual(
      linkCalls[0].authUserId,
      'auth-link-check-2',
      'linkFn received the AUTH id (not the placeholder id)',
    );
    // But user.id is the placeholder id — divergent from authUserId because
    // this is the continuity path. That's the whole point of passing
    // authUserId separately: it populates public.users.auth_user_id.
    assertEqual(
      linkCalls[0].user.id,
      'placeholder-id-XYZ',
      'user.id === placeholder id (continuity)',
    );
    assertTrue(
      linkCalls[0].user.id !== linkCalls[0].authUserId,
      'user.id and authUserId intentionally differ in the upgrade branch',
    );
  });

  // =======================================================================

  console.log('\n--- register: signUp error path ---');

  await test('signUp error → returns false, no localStorage write, no linkFn call, no auth state', async () => {
    resetAll();
    signUpNext = {
      data: { user: null },
      error: { message: 'User already registered' },
    };
    const before = (globalThis as any).localStorage.getItem('apex-users');
    const ok = await useAuthStore.getState().register({
      email: 'dup@example.com',
      username: 'dup',
      displayName: 'Dup',
      password: 'pw',
    });
    assertEqual(ok, false, 'register returns false on signUp error');
    assertEqual(linkCalls.length, 0, 'linkFn NOT called when signUp errors');
    assertEqual(
      (globalThis as any).localStorage.getItem('apex-users'),
      before,
      'apex-users untouched on signUp error',
    );
    assertEqual(useAuthStore.getState().user, null, 'store user stays null');
    assertEqual(useAuthStore.getState().isAuthenticated, false, 'isAuthenticated stays false');
  });

  // =======================================================================

  console.log('\n--- register: linkFn throws → non-fatal ---');

  await test('linkFn throws → register still returns true + sets auth state', async () => {
    resetAll();
    signUpNext = { data: { user: { id: 'auth-nonfatal-777' } }, error: null };
    linkBehavior = 'throw';
    const ok = await useAuthStore.getState().register({
      email: 'nonfatal@example.com',
      username: 'nonfatal',
      displayName: 'Non Fatal',
      password: 'pw',
    });
    assertEqual(ok, true, 'register returns true even when linkFn throws');
    assertEqual(
      useAuthStore.getState().user?.id,
      'auth-nonfatal-777',
      'store user.id still set from auth id',
    );
    assertEqual(useAuthStore.getState().isAuthenticated, true, 'isAuthenticated flipped true');
    // localStorage row was written before the link call, so it survives.
    const rows = readApexUsers();
    const row = rows.find((r: any) => r.email === 'nonfatal@example.com');
    assertTrue(row, 'apex-users row written before linkFn throw');
    assertEqual(row.id, 'auth-nonfatal-777', 'apex-users row id preserved');
  });

  // =======================================================================

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);

  // Restore original fetch
  (globalThis as any).fetch = originalFetch;

  if (failed > 0) process.exit(1);
})();
