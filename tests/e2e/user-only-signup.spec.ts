import { test, expect } from '@playwright/test';
import { skipWithoutE2ECreds, E2E } from './fixtures/env';
import { deleteAuthUserByEmail } from './fixtures/supabase';

/**
 * Fresh user-only signup flow — no trainer linkage, no invite.
 * The account lands on /today and has is_trainer=false in public.users.
 */
test.describe('identity-v2: user-only signup', () => {
  skipWithoutE2ECreds();

  const email = `e2e-user-${Date.now()}@e2e.catalift.test`;
  const password = 'Correct-Horse-Battery-1';

  test.beforeEach(async () => { await deleteAuthUserByEmail(email); });
  test.afterEach(async () => { await deleteAuthUserByEmail(email); });

  test('can sign up, lands on /today with is_trainer=false', async ({ page }) => {
    await page.goto('/auth');

    // Navigate to register tab (see existing auth page UI).
    const registerTab = page.getByRole('tab', { name: /register|sign up/i }).first();
    if (await registerTab.count()) await registerTab.click();

    await page.getByLabel(/email/i).first().fill(email);
    await page.getByLabel(/password/i).first().fill(password);
    // Username if present:
    const userField = page.getByLabel(/username/i).first();
    if (await userField.count()) await userField.fill(`e2e${Date.now()}`);

    await page.getByRole('button', { name: /create account|sign up|register/i }).first().click();

    await page.waitForURL('**/today', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/today/);

    // Verify server-side row has is_trainer=false via the admin API.
    const res = await fetch(`${E2E.supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=is_trainer,account_status`, {
      headers: {
        apikey: E2E.serviceRoleKey,
        Authorization: `Bearer ${E2E.serviceRoleKey}`,
      },
    });
    const rows = await res.json();
    expect(rows[0]?.is_trainer).toBe(false);
    expect(rows[0]?.account_status).toBe('active');
  });
});
