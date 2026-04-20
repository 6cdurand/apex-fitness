import 'server-only';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Role normalisation — reconcile the canonical `is_trainer` flag with the
 * presentation-only `mode` column. Emits an identity_events row on drift so
 * the integrity monitor can flag repeated occurrences.
 *
 * Contract:
 *   - `is_trainer` is canonical for authorisation.
 *   - `mode` ('user' | 'trainer' | 'athlete') is presentation only.
 *   - A user whose mode is 'trainer' but is_trainer=false → bug; fix by
 *     setting is_trainer=true (assumes a human operator flipped mode).
 *   - A user whose mode='user' but is_trainer=true → keep is_trainer=true
 *     (trainer accounts CAN be in user mode; don't demote silently).
 */

export type RoleNormaliseResult = {
  userId: string;
  isTrainer: boolean;
  mode: string | null;
  changed: boolean;
  reason?: string;
};

export async function normaliseRole(userId: string): Promise<RoleNormaliseResult | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('users')
    .select('id, is_trainer, mode')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    console.error('[roleNormalisation] lookup failed:', error?.message);
    return null;
  }

  const isTrainer: boolean = !!data.is_trainer;
  const mode: string | null = data.mode ?? null;

  let changed = false;
  let reason: string | undefined;

  // Drift case: mode says trainer, is_trainer flag says no. Fix the flag.
  if (mode === 'trainer' && !isTrainer) {
    const { error: upErr } = await admin
      .from('users')
      .update({ is_trainer: true, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (upErr) {
      console.error('[roleNormalisation] update failed:', upErr.message);
    } else {
      changed = true;
      reason = 'mode_trainer_but_flag_false';
    }
  }

  // Record telemetry whenever we detect or fix drift.
  if (changed || (mode === 'trainer' && !isTrainer)) {
    await admin.from('identity_events').insert({
      event_type: 'role_drift_detected',
      user_id: userId,
      payload: { is_trainer: isTrainer, mode, changed, reason },
    });
  }

  return {
    userId,
    isTrainer: changed ? true : isTrainer,
    mode,
    changed,
    reason,
  };
}
