/**
 * group7 — identity forward-fix tests.
 *
 * Run with:
 *   npx tsx src/lib/stores/authStore.ensureSelfIdentity.test.ts
 *
 * Asserts the invariant the fix exists to protect: NO auth-store path
 * persists a public.users id that diverges from auth.uid(). We monkeypatch
 * the shared `supabase` singleton (auth + rpc + from) so register / login /
 * loginWithSupabaseUser run fully offline and deterministic — no network,
 * no GoTrue internals.
 *
 * Coverage:
 *  A. ensureSelfIdentity wrapper (DI rpc): calls ensure_self_identity with
 *     { p_email }, maps the returned id, FAILS OPEN (null) on error/exception
 *     and when Supabase is not configured.
 *  B. register(): even when a local placeholder row exists AND a non-auth
 *     `userData.id` is passed, the resulting user.id === auth uid and the RPC
 *     was invoked. (Pre-fix this minted userData.id / placeholder.id.)
 *  C. login(): user.id === auth uid; RPC invoked before the profile resolve.
 *  D. loginWithSupabaseUser(): user.id === auth uid on the OAuth path too.
 */

// ---- env: make isSupabaseConfigured() return true so we exercise the
// "configured" branch. The real client is never hit — every method is stubbed.
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

// The post-login hydrate dynamic-imports the workout/trainer stores on a
// deferred microtask; any async error there is already swallowed by those
// stores and is irrelevant to these synchronous-state assertions. Guard so a
// late rejection can't crash the process before we print results + exit.
process.on('unhandledRejection', () => {});

import { supabase } from '../supabase';
import { useAuthStore } from './authStore';
import { ensureSelfIdentity } from '../supabaseSync';
import type { User } from '@/types';

// ---- fixtures ----------------------------------------------------------
const AUTH_UID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'newclient@example.com';

// ---- supabase singleton stubs ------------------------------------------
// A Proxy query-builder: every chained method returns the builder, and
// awaiting it resolves to a benign empty result. Covers every users
// read/write the store and supabaseSync touch without enumerating methods.
function makeQueryBuilder(result: any = { data: null, error: null, status: 200, count: 0 }) {
  const builder: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: any) => resolve(result);
        if (prop === 'catch') return () => builder;
        if (prop === 'finally') return (cb: any) => { cb?.(); return builder; };
        return () => builder;
      },
    },
  );
  return builder;
}

let rpcCalls: Array<{ fn: string; args: any }> = [];

function installSupabaseStubs() {
  const session = { access_token: 't', token_type: 'bearer', expires_in: 3600, user: { id: AUTH_UID, email: EMAIL } };
  (supabase.auth as any).getSession = async () => ({ data: { session: null }, error: null });
  (supabase.auth as any).signOut = async () => ({ error: null });
  (supabase.auth as any).signUp = async (args: any) => ({
    data: { user: { id: AUTH_UID, email: args?.email ?? EMAIL }, session }, error: null,
  });
  (supabase.auth as any).signInWithPassword = async (args: any) => ({
    data: { user: { id: AUTH_UID, email: args?.email ?? EMAIL }, session }, error: null,
  });
  (supabase as any).rpc = async (fn: string, args: any) => {
    rpcCalls.push({ fn, args });
    return { data: AUTH_UID, error: null };
  };
  (supabase as any).from = () => makeQueryBuilder();
}

// ---- tiny async assertion runner (matches repo style) ------------------
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ❌ ${name}\n     ${e?.stack ?? e?.message ?? e}`);
  }
}
function assertEqual<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(cond: any, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy, got ${String(cond)}`);
}

function resetAll() {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  (globalThis as any).localStorage.clear();
  rpcCalls = [];
}

async function run() {
  installSupabaseStubs();

  // ===== A. ensureSelfIdentity wrapper (DI rpc) =========================
  console.log('\n--- A. ensureSelfIdentity wrapper ---');

  await test('calls ensure_self_identity with { p_email } and returns the id', async () => {
    const calls: Array<{ fn: string; args: any }> = [];
    const id = await ensureSelfIdentity(EMAIL, (async (fn: any, args: any) => {
      calls.push({ fn, args });
      return { data: AUTH_UID, error: null };
    }) as any);
    assertEqual(calls.length, 1, 'rpc called once');
    assertEqual(calls[0].fn, 'ensure_self_identity', 'rpc name');
    assertEqual(calls[0].args, { p_email: EMAIL }, 'rpc args');
    assertEqual(id, AUTH_UID, 'returns the aligned id');
  });

  await test('null email is forwarded as { p_email: null }', async () => {
    let seen: any = undefined;
    await ensureSelfIdentity(undefined, (async (_fn: any, args: any) => {
      seen = args;
      return { data: AUTH_UID, error: null };
    }) as any);
    assertEqual(seen, { p_email: null }, 'undefined coerced to null');
  });

  await test('fails open (null) when the RPC returns an error', async () => {
    const id = await ensureSelfIdentity(EMAIL, (async () => ({ data: null, error: { message: 'boom' } })) as any);
    assertEqual(id, null, 'error → null');
  });

  await test('fails open (null) when the RPC throws', async () => {
    const id = await ensureSelfIdentity(EMAIL, (async () => { throw new Error('network'); }) as any);
    assertEqual(id, null, 'exception → null');
  });

  await test('returns null when Supabase is not configured', async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    let called = false;
    const id = await ensureSelfIdentity(EMAIL, (async () => { called = true; return { data: AUTH_UID, error: null }; }) as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    assertEqual(id, null, 'not configured → null');
    assertEqual(called, false, 'rpc not called when unconfigured');
  });

  // ===== B. register() ==================================================
  console.log('\n--- B. register() never mints a non-auth id ---');

  await test('register adopts auth uid even with a local placeholder + passed userData.id', async () => {
    resetAll();
    // Seed a trainer-created local placeholder for this email with a NON-auth id.
    (globalThis as any).localStorage.setItem('apex-users', JSON.stringify([
      { id: 'local-placeholder-uuid', email: EMAIL, accountStatus: 'placeholder', password: 'h_x' },
    ]));

    const ok = await useAuthStore.getState().register({
      // A caller-supplied id (e.g. invite flow) MUST be ignored now.
      id: 'caller-supplied-non-auth-id',
      email: EMAIL,
      password: 'secret123',
      username: 'newclient',
      displayName: 'New Client',
    } as Partial<User> & { password: string });

    assertTrue(ok, 'register returned true');
    const u = useAuthStore.getState().user;
    assertTrue(u, 'user is set');
    assertEqual(u!.id, AUTH_UID, 'user.id === auth uid (NOT placeholder / caller id)');

    const selfRpc = rpcCalls.filter(c => c.fn === 'ensure_self_identity');
    assertEqual(selfRpc.length >= 1, true, 'ensure_self_identity was invoked');
    assertEqual(selfRpc[0].args, { p_email: EMAIL }, 'RPC keyed on the signup email');
  });

  // ===== C. login() =====================================================
  console.log('\n--- C. login() aligns to auth uid ---');

  await test('login sets user.id to auth uid and invokes the RPC', async () => {
    resetAll();
    const ok = await useAuthStore.getState().login(EMAIL, 'secret123');
    assertTrue(ok, 'login returned true');
    const u = useAuthStore.getState().user;
    assertEqual(u!.id, AUTH_UID, 'user.id === auth uid');
    assertTrue(rpcCalls.some(c => c.fn === 'ensure_self_identity'), 'ensure_self_identity invoked');
  });

  // ===== D. loginWithSupabaseUser() =====================================
  console.log('\n--- D. loginWithSupabaseUser() aligns to auth uid (OAuth path) ---');

  await test('loginWithSupabaseUser sets user.id to auth uid (no diverged insert)', async () => {
    resetAll();
    const ok = await useAuthStore.getState().loginWithSupabaseUser({
      id: AUTH_UID,
      email: EMAIL,
      displayName: 'New Client',
    });
    assertTrue(ok, 'loginWithSupabaseUser returned true');
    const u = useAuthStore.getState().user;
    assertEqual(u!.id, AUTH_UID, 'user.id === auth uid');
    assertTrue(rpcCalls.some(c => c.fn === 'ensure_self_identity'), 'ensure_self_identity invoked');
  });

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
