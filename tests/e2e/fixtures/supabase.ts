import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { E2E } from './env';

/**
 * Service-role Supabase client for E2E fixture setup/teardown. Only used
 * by the tests themselves — never by the app code under test.
 */
export function adminClient(): SupabaseClient {
  return createClient(E2E.supabaseUrl, E2E.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function deleteAuthUserByEmail(email: string) {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const match = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (match) await admin.auth.admin.deleteUser(match.id);
  await admin.from('users').delete().eq('email', email.toLowerCase());
}

export async function createTrainerFixture(email: string, password: string, displayName: string) {
  const admin = adminClient();
  await deleteAuthUserByEmail(email);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw new Error(`createTrainerFixture: ${error?.message}`);
  await admin
    .from('users')
    .update({ is_trainer: true, display_name: displayName, mode: 'trainer' })
    .eq('id', data.user.id);
  return { id: data.user.id, email };
}
