import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Critical-path E2E config.
 *
 * Drives the LIVE site at `E2E_BASE_URL` (catalift.net by default). No
 * local web server is wired up — the test exercises the deployed UI as
 * a real user would.
 *
 * Secrets (E2E_TRAINER_EMAIL / E2E_TRAINER_PASSWORD) are read from
 * `.env.local`. We parse it manually here because Playwright does not
 * auto-load Next.js env files and adding a dotenv dependency would
 * require touching `package.json`, which is out of scope for this PR.
 */
function loadEnvLocal(): void {
  try {
    const content = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Don't clobber values already exported by the shell / CI runner.
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // .env.local is optional — in CI the secrets come from the runner.
  }
}
loadEnvLocal();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://catalift.net',
    headless: true,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
