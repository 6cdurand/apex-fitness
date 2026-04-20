import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for identity-v2 regression suite.
 *
 * Tests run against the local dev server (`npm run dev`) by default, or
 * against PLAYWRIGHT_BASE_URL if set (use a staging URL for CI against a
 * non-local env).
 *
 * These specs require:
 *   - A dedicated Supabase project with the identity-v2 migrations applied.
 *   - The following env vars (supply via .env.test.local, never commit):
 *       E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY
 *   - Trainer + client fixture accounts (seeded by tests/e2e/setup/seed.ts).
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,            // identity-v2 mutates shared fixtures; keep serial
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
