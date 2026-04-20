/**
 * Async utilities shared across the app.
 *
 * Why this file exists: several of our reliability bugs have the same
 * shape — a supabase-js call (or any awaited promise) never resolves
 * because of a network stall, stale token refresh, CORS failure, or
 * misconfigured client, and the caller's `try/finally` never runs. The
 * UI then sticks on a spinner forever (see authStore, workout start
 * button, completion sync). Wrapping such awaits with `withTimeout`
 * guarantees that the caller's error path (and its flag cleanup) always
 * runs within a bounded time.
 */

/**
 * Race a promise against a hard timeout. If `ms` elapses before the
 * input promise settles, the returned promise rejects with an
 * `Error` whose message includes the `label` so it's easy to spot in
 * dev-tools console.
 *
 * Note: this does NOT cancel the underlying network request — Supabase
 * JS v2 lacks first-class abort support in the PostgREST client.
 * The request may still resolve/reject later; we just stop waiting.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  // PromiseLike<T>, not Promise<T>, because Supabase's PostgrestFilterBuilder
  // is a thenable but not a native Promise. Both satisfy PromiseLike and
  // both work identically with Promise.race-style racing via .then.
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[asyncUtils] ${label} timed out after ${ms}ms`));
    }, ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
