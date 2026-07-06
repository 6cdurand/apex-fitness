/**
 * completeClientOnboarding.test.ts — client-side tests for the atomic
 * onboarding completion path (RC-1/RC-2).
 *
 * These cover the CLIENT contract: payload shape, success mapping, retry/backoff
 * policy, and the no-retry rule for permanent errors. The DB-level guarantees
 * (transactional rollback, authz enforcement, idempotency at the row level) are
 * exercised by the SQL in .pipeline/onboarding-atomicity/db-tests.sql, which
 * must be run against the live DB after the migrations are applied.
 *
 * Run: npx tsx src/lib/__tests__/completeClientOnboarding.test.ts
 */

// isSupabaseConfigured() is read at call-time, so set env before invoking.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { completeClientOnboarding } from '../supabaseSync';

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`); }
}

const TRAINER = '11111111-1111-4111-8111-111111111111';
const CLIENT = 'client-abc';

const sampleProfile = {
  id: `profile-${CLIENT}`,
  clientId: CLIENT,
  trainerId: TRAINER,
  primaryGoal: 'hypertrophy',
  secondaryGoal: undefined,
  trainingPreference: '1:1',
  experienceLevel: 'some',
  injuryFlags: ['shoulder', 'knee'],
  daysPerWeek: 3,
  availableDays: ['mon', 'wed', 'fri'],
  sessionLength: 60,
  trainAloneOutsidePT: 'maybe',
  movementConfidence: { squat: 3, hinge: 3, push: 3, pull: 3, core: 3 },
  wantsClasses: 'maybe',
  classReady: false,
  sleepQuality: 3,
  stressLevel: 3,
  jobActivity: 'moderate',
  currentPhase: 'foundation',
  createdAt: '2026-07-06T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
};

async function run() {
  // --- A. Happy path: RPC ok -> {ok:true, profile}; correct args + payload ---
  console.log('\n--- A. Happy path ---');
  let capturedArgs: any = null;
  const okRpc = async (_fn: any, args: any) => {
    capturedArgs = args;
    return { data: { onboarding_complete: true, profile: { id: args.p_profile.id } }, error: null };
  };
  const okResult = await completeClientOnboarding(TRAINER, CLIENT, sampleProfile, okRpc as any);
  assert('returns ok=true', okResult.ok === true);
  assert('returns profile from RPC', okResult.profile?.id === `profile-${CLIENT}`);
  assert('passes p_trainer_id', capturedArgs?.p_trainer_id === TRAINER);
  assert('passes p_client_id', capturedArgs?.p_client_id === CLIENT);
  assert('payload injury_flags stringified', capturedArgs?.p_profile.injury_flags === '["shoulder","knee"]');
  assert('payload available_days stringified', capturedArgs?.p_profile.available_days === '["mon","wed","fri"]');
  assert('payload movement_confidence stringified', typeof capturedArgs?.p_profile.movement_confidence === 'string');
  assert('payload days_per_week is string', capturedArgs?.p_profile.days_per_week === '3');
  assert('payload class_ready is "false"', capturedArgs?.p_profile.class_ready === 'false');
  assert('payload snake_case primary_goal', capturedArgs?.p_profile.primary_goal === 'hypertrophy');

  // --- B. Permanent error (42501) -> no retry, ok=false with code ---
  console.log('\n--- B. Authz error is not retried ---');
  let authzCalls = 0;
  const authzRpc = async () => {
    authzCalls++;
    return { data: null, error: { message: 'not authorized', code: '42501' } };
  };
  const authzResult = await completeClientOnboarding(TRAINER, CLIENT, sampleProfile, authzRpc as any);
  assert('ok=false on authz error', authzResult.ok === false);
  assert('surfaces code 42501', authzResult.code === '42501');
  assert('called exactly once (no retry)', authzCalls === 1);

  // --- C. Missing relationship (P0002) -> no retry ---
  console.log('\n--- C. Missing relationship is not retried ---');
  let relCalls = 0;
  const relRpc = async () => {
    relCalls++;
    return { data: null, error: { message: 'no trainer-client relationship', code: 'P0002' } };
  };
  const relResult = await completeClientOnboarding(TRAINER, CLIENT, sampleProfile, relRpc as any);
  assert('ok=false on P0002', relResult.ok === false);
  assert('called exactly once (no retry)', relCalls === 1);

  // --- D. Transient failure then success -> retried, eventually ok ---
  console.log('\n--- D. Transient error is retried then succeeds ---');
  let attempts = 0;
  const flakyRpc = async (_fn: any, args: any) => {
    attempts++;
    if (attempts < 2) return { data: null, error: { message: 'network', code: '503' } };
    return { data: { onboarding_complete: true, profile: { id: args.p_profile.id } }, error: null };
  };
  const flakyResult = await completeClientOnboarding(TRAINER, CLIENT, sampleProfile, flakyRpc as any);
  assert('eventually ok=true', flakyResult.ok === true);
  assert('retried (>=2 attempts)', attempts >= 2);

  // --- E. Persistent transient failure -> ok=false after max attempts ---
  console.log('\n--- E. Persistent failure gives up loudly ---');
  let hardCalls = 0;
  const hardFailRpc = async () => {
    hardCalls++;
    return { data: null, error: { message: 'still down', code: '500' } };
  };
  const hardResult = await completeClientOnboarding(TRAINER, CLIENT, sampleProfile, hardFailRpc as any);
  assert('ok=false after retries', hardResult.ok === false);
  assert('tried 3 times', hardCalls === 3);

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

run();
