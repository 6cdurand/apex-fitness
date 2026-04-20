import { test } from '@playwright/test';

/**
 * Skip the whole suite when the environment isn't wired to a real Supabase
 * project + service-role key. Tests that mutate auth.users / public.users
 * can only run against a disposable instance.
 *
 * Required env vars for the suite to run:
 *   E2E_SUPABASE_URL
 *   E2E_SUPABASE_ANON_KEY
 *   E2E_SUPABASE_SERVICE_ROLE_KEY
 */
export function skipWithoutE2ECreds() {
  const missing = [
    'E2E_SUPABASE_URL',
    'E2E_SUPABASE_ANON_KEY',
    'E2E_SUPABASE_SERVICE_ROLE_KEY',
  ].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    test.skip(true, `E2E env missing: ${missing.join(', ')}. Set them in .env.test.local.`);
  }
}

export const E2E = {
  supabaseUrl: process.env.E2E_SUPABASE_URL ?? '',
  anonKey: process.env.E2E_SUPABASE_ANON_KEY ?? '',
  serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? '',
  adminSecret: process.env.ADMIN_RECONCILE_SECRET ?? '',
};
