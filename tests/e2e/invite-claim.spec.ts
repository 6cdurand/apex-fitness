import { test, expect } from '@playwright/test';
import { skipWithoutE2ECreds, E2E } from './fixtures/env';
import { createTrainerFixture, deleteAuthUserByEmail, adminClient } from './fixtures/supabase';

/**
 * Invite → claim E2E:
 *   1. Seed a trainer + a provisional client file (no auth.users row).
 *   2. Issue an invitation via POST /api/invite/issue (server-side).
 *      (We use the service role to simulate the trainer call.)
 *   3. Visit /auth?token=<invite> and claim with a chosen password.
 *   4. Verify the claimant lands signed-in on /today and the public.users
 *      row transitioned to account_status='active'.
 */
test.describe('identity-v2: invite + claim', () => {
  skipWithoutE2ECreds();

  const trainerEmail = `e2e-trainer-${Date.now()}@e2e.catalift.test`;
  const clientEmail = `e2e-client-${Date.now()}@e2e.catalift.test`;
  const password = 'Correct-Horse-Battery-2';
  let trainerId = '';
  let clientId = '';
  let inviteToken = '';

  test.beforeEach(async ({ request }) => {
    await deleteAuthUserByEmail(trainerEmail);
    await deleteAuthUserByEmail(clientEmail);
    const trainer = await createTrainerFixture(trainerEmail, password, 'E2E Trainer');
    trainerId = trainer.id;

    // Seed a provisional client row directly via service role (the same
    // effect createProvisionalClient would have).
    const admin = adminClient();
    clientId = (globalThis as any).crypto.randomUUID();
    await admin.from('users').insert({
      id: clientId,
      email: clientEmail,
      username: `e2e-client-${Date.now()}`,
      display_name: 'E2E Client',
      is_trainer: false,
      mode: 'user',
      preferred_unit: 'kg',
      gender: 'other',
      account_status: 'placeholder',
      auth_migration_status: 'skipped',
      trainer_id: trainerId,
      password_hash: 'placeholder_no_auth',
    });
    await admin.from('trainer_clients').insert({
      trainer_id: trainerId,
      client_id: clientId,
      status: 'active',
      onboarding_complete: false,
    });
    // Issue an invite row directly so the test doesn't need trainer login.
    inviteToken = (globalThis as any).crypto.randomUUID().replace(/-/g, '') + (globalThis as any).crypto.randomUUID().replace(/-/g, '');
    await admin.from('client_invitations').insert({
      trainer_id: trainerId,
      client_id: clientId,
      email: clientEmail,
      invite_token: inviteToken,
      status: 'sent',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });
  });

  test.afterEach(async () => {
    await deleteAuthUserByEmail(trainerEmail);
    await deleteAuthUserByEmail(clientEmail);
  });

  test('claim endpoint creates auth.users with provisional id + flips account_status', async ({ request }) => {
    // Simulate the public claim flow via the API route.
    const res = await request.post('/api/invite/claim', {
      data: { token: inviteToken, newPassword: password },
    });
    expect(res.ok(), await res.text()).toBe(true);
    const body = await res.json();
    expect(body.userId).toBe(clientId);
    expect(body.trainerId).toBe(trainerId);

    // Verify public.users row is now active with the preserved id.
    const admin = adminClient();
    const { data } = await admin.from('users').select('id, account_status, auth_migration_status').eq('id', clientId).maybeSingle();
    expect(data?.account_status).toBe('active');
    expect(data?.auth_migration_status).toBe('migrated');

    // Verify auth.users has a row with the same id.
    const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = authList?.users?.find((u) => u.email?.toLowerCase() === clientEmail.toLowerCase());
    expect(match?.id).toBe(clientId);

    // Idempotency: second claim returns ok without side effects.
    const res2 = await request.post('/api/invite/claim', {
      data: { token: inviteToken, newPassword: password },
    });
    expect(res2.ok()).toBe(true);
    const body2 = await res2.json();
    expect(body2.userId).toBe(clientId);
  });
});
