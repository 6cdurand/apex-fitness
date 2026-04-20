import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the service role key.
 * NEVER import this from a client component — `server-only` will throw.
 *
 * Used by identity services (backfill, invite/claim, role normalisation)
 * and by admin routes that need to bypass RLS for reconciliation tasks.
 */

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL is required');
  if (!serviceKey) {
    throw new Error(
      '[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is required for server-side admin operations. ' +
        'Add it to your environment (never prefix with NEXT_PUBLIC_).',
    );
  }

  _client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}
