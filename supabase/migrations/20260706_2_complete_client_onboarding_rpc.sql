-- =============================================================================
-- 20260706_2_complete_client_onboarding_rpc.sql
-- Onboarding atomicity — STEP 2 of 3 (APPLY AFTER step 1).
--
-- ⚠️  DO NOT AUTO-APPLY. Run manually in the Supabase SQL editor (v1 prod
--     project pjkqfoeahcpvugolmxew) after reviewing. Requires the unique
--     constraint from 20260706_1_onboarding_constraints.sql (ON CONFLICT below).
--
-- RC-1: the client currently fires TWO independent, un-awaited writes — the
-- client_profiles upsert and the trainer_clients.onboarding_complete flag — with
-- no transaction. When the profile write fails but the flag write succeeds you
-- get onboarding_complete=true with NO profile row (Simon). This SECURITY
-- DEFINER function makes both writes ONE atomic transaction: either the profile
-- row is written AND the flag flips, or neither does.
--
-- Columns match the app's live write shape in supabaseSync.ts
-- syncClientProfileToSupabase (JSON fields are stored as stringified TEXT).
--
-- ⚠️  BEFORE APPLYING: confirm the live column set with
--     select column_name, data_type from information_schema.columns
--     where table_name = 'client_profiles';
--     and reconcile any drift (see .pipeline/onboarding-atomicity/changes.md).
-- =============================================================================

create or replace function public.complete_client_onboarding(
  p_trainer_id uuid,
  p_client_id  text,
  p_profile    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile client_profiles;
begin
  -- Authorization: caller must be the trainer they claim to be.
  if auth.uid() is null or auth.uid() <> p_trainer_id then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Relationship must exist (prevents cross-trainer writes).
  if not exists (
    select 1 from trainer_clients
    where trainer_id = p_trainer_id and client_id = p_client_id
  ) then
    raise exception 'no trainer-client relationship' using errcode = 'P0002';
  end if;

  -- Upsert the canonical onboarding profile row.
  insert into client_profiles (
    id, client_id, trainer_id, primary_goal, secondary_goal, custom_goal_text,
    training_preference, experience_level, injury_flags, injury_notes,
    days_per_week, available_days, schedule_notes, session_length,
    train_alone_outside_pt, movement_confidence, wants_classes, class_ready,
    sleep_quality, stress_level, job_activity, current_phase, progression_plan,
    created_at, updated_at
  )
  values (
    coalesce(p_profile->>'id', 'profile-' || p_client_id),
    p_client_id,
    p_trainer_id,
    p_profile->>'primary_goal',
    p_profile->>'secondary_goal',
    p_profile->>'custom_goal_text',
    p_profile->>'training_preference',
    p_profile->>'experience_level',
    p_profile->>'injury_flags',
    p_profile->>'injury_notes',
    nullif(p_profile->>'days_per_week', '')::int,
    p_profile->>'available_days',
    p_profile->>'schedule_notes',
    nullif(p_profile->>'session_length', '')::int,
    p_profile->>'train_alone_outside_pt',
    p_profile->>'movement_confidence',
    p_profile->>'wants_classes',
    (p_profile->>'class_ready')::boolean,
    nullif(p_profile->>'sleep_quality', '')::int,
    nullif(p_profile->>'stress_level', '')::int,
    p_profile->>'job_activity',
    p_profile->>'current_phase',
    p_profile->>'progression_plan',
    coalesce(nullif(p_profile->>'created_at', '')::timestamptz, now()),
    now()
  )
  on conflict (trainer_id, client_id) do update set
    primary_goal           = excluded.primary_goal,
    secondary_goal         = excluded.secondary_goal,
    custom_goal_text       = excluded.custom_goal_text,
    training_preference    = excluded.training_preference,
    experience_level       = excluded.experience_level,
    injury_flags           = excluded.injury_flags,
    injury_notes           = excluded.injury_notes,
    days_per_week          = excluded.days_per_week,
    available_days         = excluded.available_days,
    schedule_notes         = excluded.schedule_notes,
    session_length         = excluded.session_length,
    train_alone_outside_pt = excluded.train_alone_outside_pt,
    movement_confidence    = excluded.movement_confidence,
    wants_classes          = excluded.wants_classes,
    class_ready            = excluded.class_ready,
    sleep_quality          = excluded.sleep_quality,
    stress_level           = excluded.stress_level,
    job_activity           = excluded.job_activity,
    current_phase          = excluded.current_phase,
    progression_plan       = excluded.progression_plan,
    updated_at             = now()
  returning * into v_profile;

  -- Flip the completion flag in the SAME transaction.
  update trainer_clients
  set onboarding_complete = true, updated_at = now()
  where trainer_id = p_trainer_id and client_id = p_client_id;

  return jsonb_build_object(
    'onboarding_complete', true,
    'profile', to_jsonb(v_profile)
  );
end;
$$;

revoke all      on function public.complete_client_onboarding(uuid, text, jsonb) from public;
grant  execute  on function public.complete_client_onboarding(uuid, text, jsonb) to authenticated;

-- Rollback: drop function public.complete_client_onboarding(uuid, text, jsonb);
