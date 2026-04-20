import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/**
 * Resolve the current caller from the Supabase Auth session cookie.
 * Returns null if the caller isn't authenticated.
 *
 * We use a fresh anon client here (not the admin client) so the server
 * sees the request exactly as RLS does — the user's own permissions.
 */
export async function getRequestUser(): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  // Supabase JS stores the session JWT under "sb-<ref>-auth-token" as JSON.
  // We scan all cookies for a JWT-looking value and try each until one validates.
  const jar = cookieStore.getAll();

  for (const c of jar) {
    if (!c.name.startsWith('sb-')) continue;
    let token: string | null = null;
    try {
      // New format: cookie value is a JSON array [access_token, refresh_token, ...].
      const parsed = JSON.parse(c.value);
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
        token = parsed[0];
      } else if (typeof parsed === 'object' && parsed?.access_token) {
        token = parsed.access_token;
      }
    } catch {
      // Older format: raw JWT string.
      if (c.value.startsWith('ey')) token = c.value;
    }
    if (!token) continue;

    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (!error && data.user?.id && data.user.email) {
      return { id: data.user.id, email: data.user.email };
    }
  }
  return null;
}

/** Require an authenticated request — throws if none. */
export async function requireRequestUser() {
  const u = await getRequestUser();
  if (!u) throw new Error('unauthenticated');
  return u;
}
