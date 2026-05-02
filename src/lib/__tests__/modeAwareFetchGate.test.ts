/**
 * Tests for `__shouldSkipClientFetch` (D14).
 *
 * Run with: npx tsx src/lib/__tests__/modeAwareFetchGate.test.ts
 *
 * Coverage:
 *  - null / undefined user → skip (never fetch with no user)
 *  - user without id → skip (defensive; id is the Supabase query key)
 *  - user with mode='trainer' → skip (trainer surface owns its own fetches)
 *  - user with mode='user' → fetch (Athlete mode reads client data)
 *  - user with mode=undefined (legacy row) → fetch (safe default)
 *  - REGRESSION GUARD: user.isTrainer does NOT affect the gate. A dual-
 *    mode account (isTrainer=true currently in Athlete mode) MUST be
 *    allowed to fetch its client-scoped data — this is the D14 bug in
 *    one assertion.
 *
 * Pure helper — no React / store / Supabase mocking required.
 */

import { __shouldSkipClientFetch } from '../modeAwareFetchGate';

let passed = 0;
let failed = 0;

function assertEqual<T>(label: string, actual: T, expected: T): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(
      `  ❌ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`,
    );
  }
}

(() => {
  console.log('\n--- no user → skip ---');
  assertEqual('null user → skip', __shouldSkipClientFetch(null), true);
  assertEqual('undefined user → skip', __shouldSkipClientFetch(undefined), true);

  console.log('\n--- user without id → skip ---');
  assertEqual(
    'user with no id → skip',
    __shouldSkipClientFetch({ mode: 'user' } as { id?: string; mode?: 'user' | 'trainer' }),
    true,
  );
  assertEqual(
    'user with empty-string id → skip',
    __shouldSkipClientFetch({ id: '', mode: 'user' }),
    true,
  );

  console.log('\n--- trainer mode → skip ---');
  assertEqual(
    "user with mode='trainer' → skip",
    __shouldSkipClientFetch({ id: 'u1', mode: 'trainer' }),
    true,
  );

  console.log('\n--- athlete mode → fetch ---');
  assertEqual(
    "user with mode='user' → fetch",
    __shouldSkipClientFetch({ id: 'u1', mode: 'user' }),
    false,
  );

  console.log('\n--- legacy rows (mode=undefined) → fetch (safe default) ---');
  assertEqual(
    'user with mode=undefined → fetch',
    __shouldSkipClientFetch({ id: 'u1' }),
    false,
  );

  console.log('\n--- D14 regression guard: isTrainer does NOT gate ---');
  assertEqual(
    'dual-mode user {id, mode:user, isTrainer:true} → fetch (NOT skip)',
    __shouldSkipClientFetch(
      { id: 'brock', mode: 'user', isTrainer: true } as unknown as {
        id?: string;
        mode?: 'user' | 'trainer';
      },
    ),
    false,
  );
  assertEqual(
    'dual-mode user {id, mode:trainer, isTrainer:true} → skip (mode wins, not role)',
    __shouldSkipClientFetch(
      { id: 'brock', mode: 'trainer', isTrainer: true } as unknown as {
        id?: string;
        mode?: 'user' | 'trainer';
      },
    ),
    true,
  );
  assertEqual(
    'pure client {id, mode:user, isTrainer:false} → fetch (baseline happy path)',
    __shouldSkipClientFetch(
      { id: 'c1', mode: 'user', isTrainer: false } as unknown as {
        id?: string;
        mode?: 'user' | 'trainer';
      },
    ),
    false,
  );
  assertEqual(
    'pure trainer {id, mode:trainer, isTrainer:true} → skip (baseline)',
    __shouldSkipClientFetch(
      { id: 't1', mode: 'trainer', isTrainer: true } as unknown as {
        id?: string;
        mode?: 'user' | 'trainer';
      },
    ),
    true,
  );
})();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
