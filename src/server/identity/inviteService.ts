import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Invite + claim service. Replaces the ad-hoc sendClientInvitation path.
 *
 * Lifecycle:
 *   createProvisionalClient()  → public.users row with account_status='placeholder'
 *   issueInvitation()           → upsert client_invitations, send email
 *   claimInvitation()           → atomic transition to active, mirrored in auth.users
 */

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateInviteToken(): string {
  // 32 random bytes → 43-char URL-safe base64. Cryptographically strong.
  return crypto.randomBytes(32).toString('base64url');
}

export type CreateProvisionalClientArgs = {
  trainerId: string;
  displayName: string;
  email?: string | null;
  onboarding?: {
    notes?: string;
    goals?: string[];
    gender?: string;
  };
};

export type CreateProvisionalClientResult = {
  clientId: string;
  trainerClientId: string;
};

/**
 * Create a provisional client file. Produces a public.users row with
 * account_status='placeholder' and a trainer_clients relationship row.
 * Does NOT create an auth.users row — that only happens on claim.
 *
 * Idempotent on (trainer, email): re-running with the same email returns
 * the existing placeholder id.
 */
export async function createProvisionalClient(
  args: CreateProvisionalClientArgs,
): Promise<CreateProvisionalClientResult> {
  const admin = getSupabaseAdmin();

  const emailNorm = args.email ? args.email.toLowerCase().trim() : null;

  // Idempotency: if a placeholder with this email already exists for this
  // trainer, reuse it.
  if (emailNorm) {
    const { data: existing } = await admin
      .from('users')
      .select('id, account_status')
      .eq('email', emailNorm)
      .maybeSingle();
    if (existing?.id) {
      const { data: tc } = await admin
        .from('trainer_clients')
        .select('id')
        .eq('trainer_id', args.trainerId)
        .eq('client_id', existing.id)
        .maybeSingle();
      if (tc?.id) {
        return { clientId: existing.id, trainerClientId: tc.id };
      }
      // User exists but not linked to this trainer → link them.
      const { data: newTc, error: tcErr } = await admin
        .from('trainer_clients')
        .insert({
          trainer_id: args.trainerId,
          client_id: existing.id,
          status: 'active',
          onboarding_complete: false,
          notes: args.onboarding?.notes,
          goals: args.onboarding?.goals,
        })
        .select('id')
        .single();
      if (tcErr) throw new Error(`trainer_clients insert failed: ${tcErr.message}`);
      return { clientId: existing.id, trainerClientId: newTc.id };
    }
  }

  // Create a fresh placeholder user row.
  const clientId = crypto.randomUUID();
  const username = args.displayName
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');

  const { error: userErr } = await admin.from('users').insert({
    id: clientId,
    email: emailNorm,
    username,
    display_name: args.displayName,
    gender: args.onboarding?.gender ?? 'other',
    is_trainer: false,
    is_verified_trainer: false,
    mode: 'user',
    preferred_unit: 'kg',
    account_status: 'placeholder',
    auth_migration_status: 'skipped',
    trainer_id: args.trainerId,
    password_hash: 'placeholder_no_auth',
  });
  if (userErr) throw new Error(`users insert failed: ${userErr.message}`);

  const { data: tcRow, error: tcErr } = await admin
    .from('trainer_clients')
    .insert({
      trainer_id: args.trainerId,
      client_id: clientId,
      status: 'active',
      onboarding_complete: false,
      notes: args.onboarding?.notes,
      goals: args.onboarding?.goals,
    })
    .select('id')
    .single();
  if (tcErr) throw new Error(`trainer_clients insert failed: ${tcErr.message}`);

  await admin.from('identity_events').insert({
    event_type: 'provisional_client_created',
    user_id: clientId,
    payload: { trainer_id: args.trainerId, email: emailNorm },
  });

  return { clientId, trainerClientId: tcRow.id };
}

export type IssueInvitationArgs = {
  trainerId: string;
  clientId: string;
  email: string;
  appUrl?: string;
  trainerName?: string;
  clientName?: string;
  sendEmail?: boolean; // default true
};

export type IssueInvitationResult = {
  inviteToken: string;
  expiresAt: string;
  inviteUrl: string;
  emailed: boolean;
};

/**
 * Create or refresh an invitation for a given (trainerId, email) pair.
 * Uses the `client_invitations_trainer_email_unique` constraint so a
 * second call updates the existing row.
 */
export async function issueInvitation(
  args: IssueInvitationArgs,
): Promise<IssueInvitationResult> {
  const admin = getSupabaseAdmin();
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString();
  const emailNorm = args.email.toLowerCase().trim();

  const { error } = await admin
    .from('client_invitations')
    .upsert(
      {
        trainer_id: args.trainerId,
        client_id: args.clientId,
        email: emailNorm,
        invite_token: token,
        status: 'pending',
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'trainer_id,email' },
    );
  if (error) throw new Error(`client_invitations upsert failed: ${error.message}`);

  const appUrl = args.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://catalift.net';
  const inviteUrl = `${appUrl}/auth?token=${encodeURIComponent(token)}`;

  let emailed = false;
  if (args.sendEmail !== false) {
    try {
      const { error: fnErr } = await admin.functions.invoke('send-client-invite', {
        body: {
          to: emailNorm,
          clientName: args.clientName,
          trainerName: args.trainerName,
          inviteToken: token,
          inviteUrl,
          appUrl,
        },
      });
      if (fnErr) {
        console.error('[inviteService] Edge function failed:', fnErr.message);
        await admin
          .from('client_invitations')
          .update({ status: 'failed' })
          .eq('invite_token', token);
      } else {
        await admin
          .from('client_invitations')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('invite_token', token);
        emailed = true;
      }
    } catch (e: any) {
      console.error('[inviteService] Edge function exception:', e?.message || e);
    }
  }

  return { inviteToken: token, expiresAt, inviteUrl, emailed };
}

export type ClaimInvitationArgs = {
  token: string;
  // Exactly one of these must be set:
  newPassword?: string;           // email+password claim
  oauthIdentity?: {
    provider: string;
    providerUserId: string;
    email: string;
  };
};

export type ClaimInvitationResult = {
  userId: string;
  trainerId: string;
  email: string;
  sessionEmail: string;
  sessionPassword?: string;
  wasClaimedNow: boolean;
};

/**
 * Claim an invitation. Atomic + idempotent.
 *
 * Flow:
 *   1. Read the invitation row (validate token, expiry, status).
 *   2. Ensure an auth.users row exists with id = provisional_client_id.
 *      - If it exists → no-op (idempotent).
 *      - If it doesn't → admin.createUser({ id: provisional_id, email, password })
 *        which fires the on_auth_user_created trigger that transitions the
 *        public.users row from placeholder → active.
 *   3. Call claim_invitation() RPC which marks the invitation accepted and
 *      emits a telemetry event.
 */
export async function claimInvitation(
  args: ClaimInvitationArgs,
): Promise<ClaimInvitationResult> {
  const admin = getSupabaseAdmin();

  // 1. Load invitation.
  const { data: inv, error: invErr } = await admin
    .from('client_invitations')
    .select('*')
    .eq('invite_token', args.token)
    .maybeSingle();
  if (invErr || !inv) throw new Error('invite_not_found');
  if (new Date(inv.expires_at) < new Date()) throw new Error('invite_expired');
  if (inv.status === 'accepted' && inv.client_id) {
    // Idempotent no-op path. Return the canonical ids so the caller can
    // sign the user in normally.
    return {
      userId: inv.client_id,
      trainerId: inv.trainer_id,
      email: inv.email,
      sessionEmail: inv.email,
      wasClaimedNow: false,
    };
  }
  if (!['pending', 'sent'].includes(inv.status)) {
    throw new Error(`invite_unusable_status:${inv.status}`);
  }

  const provisionalId: string = inv.client_id;
  const email: string = (inv.email || '').toLowerCase().trim();
  if (!email) throw new Error('invite_missing_email');

  // 2. Ensure auth.users row exists with id = provisional id.
  //    We use admin.createUser({ id }) which preserves the provisional id,
  //    so every existing client_id reference remains valid.
  const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existingAuthUser = existingList?.users?.find(
    (u) => u.email?.toLowerCase() === email,
  );

  let sessionPassword: string | undefined;

  if (!existingAuthUser) {
    sessionPassword = args.newPassword || crypto.randomBytes(16).toString('base64url');
    const { error: createErr } = await admin.auth.admin.createUser({
      id: provisionalId,
      email,
      password: sessionPassword,
      email_confirm: true,
      user_metadata: {
        display_name: inv.client_name ?? undefined,
        claimed_from_invite: true,
      },
    });
    if (createErr) {
      // Capture telemetry so we can investigate later.
      await admin.from('identity_events').insert({
        event_type: 'claim_create_user_failed',
        user_id: provisionalId,
        payload: { error: createErr.message, email },
      });
      throw new Error(`auth_create_user_failed: ${createErr.message}`);
    }
  } else if (existingAuthUser.id !== provisionalId) {
    // Conflict: someone signed up (e.g. via Google) with this email and
    // was assigned a different auth.users.id. Resolve by updating the
    // auth.users id to match the provisional id. The simplest safe route
    // is to delete the conflicting auth row and re-create with the
    // correct id — this keeps every public.users / FK reference intact.
    console.warn(
      '[inviteService] Auth id conflict during claim. auth_id=',
      existingAuthUser.id,
      'provisional=',
      provisionalId,
      '→ recreating with provisional id.',
    );
    const tempPwd = crypto.randomBytes(16).toString('base64url');
    const { error: delErr } = await admin.auth.admin.deleteUser(existingAuthUser.id);
    if (delErr) {
      await admin.from('identity_events').insert({
        event_type: 'claim_auth_id_mismatch_unresolved',
        user_id: provisionalId,
        payload: { existing_auth_id: existingAuthUser.id, error: delErr.message },
      });
      throw new Error(`auth_id_conflict_unresolved: ${delErr.message}`);
    }
    sessionPassword = args.newPassword || tempPwd;
    const { error: reCreateErr } = await admin.auth.admin.createUser({
      id: provisionalId,
      email,
      password: sessionPassword,
      email_confirm: true,
    });
    if (reCreateErr) throw new Error(`auth_recreate_failed: ${reCreateErr.message}`);
  } else if (args.newPassword) {
    // Auth user exists with matching id; caller supplied a password — reset it.
    const { error: updErr } = await admin.auth.admin.updateUserById(provisionalId, {
      password: args.newPassword,
    });
    if (updErr) throw new Error(`auth_password_update_failed: ${updErr.message}`);
    sessionPassword = args.newPassword;
  }

  // 3. Finalise via the SQL RPC (atomic: marks placeholder→active, invitation→accepted).
  const { data: rpc, error: rpcErr } = await admin.rpc('claim_invitation', {
    p_token: args.token,
    p_auth_user_id: provisionalId,
  });
  if (rpcErr) throw new Error(`claim_rpc_failed: ${rpcErr.message}`);

  const row = Array.isArray(rpc) ? rpc[0] : rpc;

  return {
    userId: row?.user_id ?? provisionalId,
    trainerId: row?.trainer_id ?? inv.trainer_id,
    email: row?.email ?? email,
    sessionEmail: email,
    sessionPassword,
    wasClaimedNow: row?.was_claimed ?? true,
  };
}
