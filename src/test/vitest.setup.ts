/**
 * Vitest global setup.
 *
 * `server-only` throws when imported outside a server bundle, which would
 * break our unit tests that import from `src/server/**`. Swap the module
 * for a no-op stub in the test environment.
 */
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Provide placeholder env vars so getSupabaseAdmin() in tests doesn't throw
// when the test itself doesn't stub it; individual tests still mock
// getSupabaseAdmin directly for isolation.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://test.local';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
