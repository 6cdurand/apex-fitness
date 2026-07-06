/**
 * v19-fix-04 — claim-flow RLS smoke test (diagnostic, safe + self-cleaning).
 *
 * Verifies the LIVE prod posture of client_invitations after phase-1B:
 *   1. ANON cannot directly SELECT client_invitations (RLS denies -> 0 rows).
 *   2. ANON can call get_invitation_by_token (granted) -> empty for unknown.
 *   3. Positive path: create a temp invite (service_role), confirm ANON
 *      resolves it via the RPC, confirm ANON still cannot direct-select it,
 *      then DELETE the temp invite (always cleaned up).
 *
 * NOTE: accept_invitation requires an authenticated user session
 * (canonical_user_id()), which a script can't mint — that leg is a manual
 * browser test (log in as a test client, click the invite, expect 'accepted').
 *
 * Run:
 *   set -a; . ./.env.local; set +a; npx tsx scripts/smoke-invite-rls.ts
 */
/* eslint-disable no-console */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg: string): never {
  console.error(`[smoke] ❌ FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  if (!url || !anonKey) fail('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!svcKey) fail('Missing SUPABASE_SERVICE_ROLE_KEY (needed to create/cleanup the temp invite)');

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const svc = createClient(url, svcKey, { auth: { persistSession: false } });

  let pass = 0;

  // 1) ANON direct SELECT must be denied (0 rows, no leak).
  {
    const { data, error } = await anon.from('client_invitations').select('*').limit(5);
    if (error) {
      console.log(`[smoke] ✅ #1 anon direct select errored as locked-down: ${error.message}`);
      pass++;
    } else if ((data ?? []).length === 0) {
      console.log('[smoke] ✅ #1 anon direct select returns 0 rows (RLS denies enumeration)');
      pass++;
    } else {
      fail(`#1 anon direct select returned ${data!.length} row(s) — table is STILL READABLE by anon`);
    }
  }

  // 2) ANON can call the RPC; unknown token -> empty, no error.
  {
    const { data, error } = await anon.rpc('get_invitation_by_token', { p_token: '__no_such_token__' });
    if (error) fail(`#2 anon cannot call get_invitation_by_token: ${error.message}`);
    if (Array.isArray(data) && data.length === 0) {
      console.log('[smoke] ✅ #2 anon RPC callable; unknown token -> []');
      pass++;
    } else {
      fail(`#2 unexpected RPC result for unknown token: ${JSON.stringify(data)}`);
    }
  }

  // 3) Positive path with a temp invite (created + deleted via service_role).
  const token = `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const testEmail = `smoke+${Date.now()}@catalift.test`;
  let createdTrainerId: string | null = null;
  try {
    const { data: trainer, error: tErr } = await svc
      .from('users')
      .select('id')
      .eq('is_trainer', true)
      .limit(1)
      .maybeSingle();
    if (tErr) fail(`#3 could not find a trainer for the temp invite: ${tErr.message}`);
    if (!trainer) fail('#3 no trainer row found to anchor the temp invite');
    createdTrainerId = trainer.id;

    const { error: insErr } = await svc.from('client_invitations').insert({
      trainer_id: createdTrainerId,
      email: testEmail,
      status: 'pending',
      invite_token: token,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });
    if (insErr) fail(`#3 failed to create temp invite: ${insErr.message}`);

    // ANON resolves the real token via RPC.
    const { data: rpcRow, error: rpcErr } = await anon.rpc('get_invitation_by_token', { p_token: token });
    if (rpcErr) fail(`#3 anon RPC errored for real token: ${rpcErr.message}`);
    const row = Array.isArray(rpcRow) ? rpcRow[0] : null;
    if (row && row.email === testEmail && row.trainer_id === createdTrainerId) {
      console.log('[smoke] ✅ #3a anon RPC resolves the real token (trainer_id + email match)');
      pass++;
    } else {
      fail(`#3a anon RPC did not return the expected row: ${JSON.stringify(rpcRow)}`);
    }

    // ANON still cannot direct-select that row.
    const { data: leak } = await anon.from('client_invitations').select('*').eq('invite_token', token);
    if ((leak ?? []).length === 0) {
      console.log('[smoke] ✅ #3b anon direct-select of the known token still returns 0 rows');
      pass++;
    } else {
      fail('#3b anon could direct-select the invite row — RLS leak');
    }
  } finally {
    // Always clean up the temp invite.
    const { error: delErr } = await svc.from('client_invitations').delete().eq('invite_token', token);
    if (delErr) console.error(`[smoke] ⚠️ cleanup failed for token ${token}: ${delErr.message} (delete it manually)`);
    else console.log(`[smoke] 🧹 cleaned up temp invite (${token})`);
  }

  console.log(`[smoke] DONE — ${pass}/4 checks passed.`);
  console.log('[smoke] Manual leg remaining: accept_invitation via a logged-in test client in the browser.');
  if (pass !== 4) process.exit(1);
}

main().catch((e) => {
  console.error('[smoke] fatal:', e);
  process.exit(1);
});
