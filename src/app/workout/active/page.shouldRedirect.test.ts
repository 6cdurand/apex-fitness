/**
 * Tests for the active-workout redirect guard
 * (`__shouldRedirectFromActiveWorkout`).
 *
 * Run with:
 *   npx tsx src/app/workout/active/page.shouldRedirect.test.ts
 *
 * Strategy:
 *  Drives the pure decision function directly (test seam, same pattern as
 *  `__decideIdentityNormalization` in `SupabaseSync.tsx`). Avoids RTL.
 *
 * Coverage:
 *  - Returns `'auth'` when `!isAuthenticated` regardless of other state.
 *  - Returns `'workout'` when authenticated AND nothing of value mounted
 *    (no activeWorkout, no summary, no completedWorkoutData) AND
 *    `isFinishing=false`.
 *  - Returns `null` (do not redirect) when `isFinishing=true` even with
 *    no activeWorkout / no summary / no completedWorkoutData — this is the
 *    fix that keeps the post-workout summary mounted across the
 *    handleFinishWorkout await chain.
 *  - Returns `null` when `showSummary=true` (existing behaviour, regression
 *    guard for the summary screen mounted after endWorkout returns).
 *  - Returns `null` when `completedWorkoutData` is set (regression guard
 *    for the summary continuation paths).
 *  - Returns `null` when `activeWorkout` is non-null (in-progress workout).
 *
 * The page module pulls in zustand-persisted stores transitively, so we
 * pre-seed the localStorage shim + Supabase env vars before importing it
 * (same pattern as workoutSync / messaging suites).
 */

// ---- env shim -----------------------------------------------------------
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJtest.fake.token';

// ---- localStorage shim --------------------------------------------------
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

import { __shouldRedirectFromActiveWorkout } from './page';

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

const fakeWorkout = { id: 'w1' };
const fakeCompleted = { id: 'w1', name: 'X' };

(() => {
  console.log('\n--- __shouldRedirectFromActiveWorkout: auth gate ---');
  {
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: false,
      activeWorkout: null,
      showSummary: false,
      completedWorkoutData: null,
      isFinishing: false,
    });
    assert("!isAuthenticated → 'auth'", out === 'auth', `got ${out}`);
  }
  {
    // Auth gate fires even if a workout is mid-flight: a logged-out user
    // must always land on /auth, not /workout/active.
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: false,
      activeWorkout: fakeWorkout,
      showSummary: true,
      completedWorkoutData: fakeCompleted,
      isFinishing: true,
    });
    assert("!isAuthenticated wins over all other flags", out === 'auth', `got ${out}`);
  }

  console.log('\n--- __shouldRedirectFromActiveWorkout: empty state → /workout ---');
  {
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: true,
      activeWorkout: null,
      showSummary: false,
      completedWorkoutData: null,
      isFinishing: false,
    });
    assert(
      "authed + no activeWorkout + !showSummary + !completedWorkoutData + !isFinishing → 'workout'",
      out === 'workout',
      `got ${out}`,
    );
  }

  console.log('\n--- __shouldRedirectFromActiveWorkout: do-not-redirect cases ---');
  {
    // THIS is the fix: during the finish-flow await chain, activeWorkout
    // briefly becomes null before showSummary flips. Without the
    // isFinishing guard, the page used to redirect to /workout for ~half
    // a second and the user lost the summary.
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: true,
      activeWorkout: null,
      showSummary: false,
      completedWorkoutData: null,
      isFinishing: true,
    });
    assert(
      "isFinishing=true blocks redirect even when nothing else is mounted",
      out === null,
      `got ${out}`,
    );
  }
  {
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: true,
      activeWorkout: null,
      showSummary: true,
      completedWorkoutData: null,
      isFinishing: false,
    });
    assert(
      "showSummary=true blocks redirect (regression guard)",
      out === null,
      `got ${out}`,
    );
  }
  {
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: true,
      activeWorkout: null,
      showSummary: false,
      completedWorkoutData: fakeCompleted,
      isFinishing: false,
    });
    assert(
      "completedWorkoutData set blocks redirect (regression guard)",
      out === null,
      `got ${out}`,
    );
  }
  {
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: true,
      activeWorkout: fakeWorkout,
      showSummary: false,
      completedWorkoutData: null,
      isFinishing: false,
    });
    assert(
      "activeWorkout set blocks redirect (in-progress workout)",
      out === null,
      `got ${out}`,
    );
  }

  console.log('\n--- __shouldRedirectFromActiveWorkout: combinations of guards ---');
  for (const flags of [
    { showSummary: true, completedWorkoutData: fakeCompleted, isFinishing: false },
    { showSummary: true, completedWorkoutData: null, isFinishing: true },
    { showSummary: false, completedWorkoutData: fakeCompleted, isFinishing: true },
    { showSummary: true, completedWorkoutData: fakeCompleted, isFinishing: true },
  ]) {
    const out = __shouldRedirectFromActiveWorkout({
      isAuthenticated: true,
      activeWorkout: null,
      ...flags,
    });
    assert(
      `combination ${JSON.stringify(flags)} → no redirect`,
      out === null,
      `got ${out}`,
    );
  }

  // --- Summary ---
  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
})();
