-- =============================================================================
-- CATALIFT / APEX FITNESS — Supabase Schema Optimization Migration
-- =============================================================================
-- Run this in the Supabase SQL Editor.
-- All index creations use CONCURRENTLY where possible (no table locks).
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS guards).
-- =============================================================================


-- ===================== A) CONVERSATIONS & MESSAGES =====================

-- 1. Unique normalized pair to prevent duplicate conversations
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_conversations_pair
ON public.conversations (
  LEAST(participant_1, participant_2),
  GREATEST(participant_1, participant_2)
);

-- 2. Messages by conversation, ordered by time (covers the main chat query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_messages_conversation_created_at
ON public.messages (conversation_id, created_at DESC);

-- 3. Messages lookup by sender/receiver for unread counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_messages_receiver_read
ON public.messages (receiver_id, read, created_at DESC);


-- ===================== B) BLOCK PERFORMANCE ANALYTICS =====================

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_block_performances_client
ON public.block_performances (client_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_block_performances_trainer
ON public.block_performances (trainer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_block_performances_block
ON public.block_performances (block_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_block_performances_performed_at
ON public.block_performances (performed_at DESC);

-- Composite for trainer dashboard: "all performances for a trainer's client"
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_block_performances_trainer_client
ON public.block_performances (trainer_id, client_id, performed_at DESC);


-- ===================== C) TRAINER CORE TABLES =====================

-- trainer_clients: fast lookup by trainer
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_trainer_clients_trainer
ON public.trainer_clients (trainer_id);

-- trainer_sessions: fast lookup by trainer + date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_trainer_sessions_trainer_date
ON public.trainer_sessions (trainer_id, date DESC);

-- trainer_sessions: fast lookup by client
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_trainer_sessions_client
ON public.trainer_sessions (client_id, date DESC);

-- session_packages: fast lookup by trainer + client
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_session_packages_trainer_client
ON public.session_packages (trainer_id, client_id);

-- client_payments: fast lookup by trainer, ordered by creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_client_payments_trainer
ON public.client_payments (trainer_id, created_at DESC);

-- client_payments: fast lookup by client
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_client_payments_client
ON public.client_payments (client_id, created_at DESC);

-- calendar_events: fast lookup by trainer + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_calendar_events_trainer_date
ON public.calendar_events (trainer_id, date);

-- calendar_events: fast lookup by client
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_calendar_events_client
ON public.calendar_events (client_id, date);

-- client_programs: fast lookup by trainer + client
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_client_programs_trainer_client
ON public.client_programs (trainer_id, client_id);

-- booking_requests: fast lookup by trainer
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_booking_requests_trainer
ON public.booking_requests (trainer_id);


-- ===================== D) WORKOUT & USER DATA =====================

-- workouts: fast lookup by user, ordered by time
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_workouts_user_start_time
ON public.workouts (user_id, start_time DESC);

-- personal_bests: fast lookup by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_personal_bests_user
ON public.personal_bests (user_id);

-- medals: fast lookup by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_medals_user
ON public.medals (user_id);

-- friendships: fast follower/following lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_friendships_follower
ON public.friendships (follower_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_friendships_following
ON public.friendships (following_id);

-- client_exercise_history: fast lookup by user + exercise
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_client_exercise_history_user
ON public.client_exercise_history (user_id, exercise_id);

-- strength_ratings: fast lookup by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_strength_ratings_user
ON public.strength_ratings (user_id);


-- ===================== E) NEW TABLES (client_profiles, workout_templates) =====================

-- Create client_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  trainer_id TEXT NOT NULL,
  primary_goal TEXT,
  secondary_goal TEXT,
  custom_goal_text TEXT,
  training_preference TEXT,
  experience_level TEXT,
  injury_flags JSONB DEFAULT '[]'::jsonb,
  injury_notes TEXT,
  days_per_week INTEGER,
  available_days JSONB DEFAULT '[]'::jsonb,
  schedule_notes TEXT,
  session_length INTEGER,
  train_alone_outside_pt TEXT,
  movement_confidence JSONB DEFAULT '{}'::jsonb,
  wants_classes TEXT,
  class_ready BOOLEAN DEFAULT false,
  sleep_quality INTEGER,
  stress_level INTEGER,
  job_activity TEXT,
  current_phase TEXT,
  progression_plan JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_client_profiles_trainer
ON public.client_profiles (trainer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_client_profiles_client
ON public.client_profiles (client_id);

-- Create workout_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  exercises JSONB DEFAULT '[]'::jsonb,
  blocks JSONB,
  created_by TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  category TEXT,
  estimated_duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_workout_templates_created_by
ON public.workout_templates (created_by);


-- ===================== F) SESSION WORKOUTS =====================

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_session_workouts_trainer
ON public.session_workouts (trainer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_session_workouts_client
ON public.session_workouts (client_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_session_workouts_event
ON public.session_workouts (event_id);


-- ===================== G) RPC: GET CONVERSATION SUMMARY =====================
-- Returns conversations for a user with last message and unread count

CREATE OR REPLACE FUNCTION public.get_conversation_summary(p_user_id TEXT, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  conversation_id TEXT,
  other_participant TEXT,
  last_message_content TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id AS conversation_id,
    CASE WHEN c.participant_1 = p_user_id THEN c.participant_2 ELSE c.participant_1 END AS other_participant,
    last_msg.content AS last_message_content,
    last_msg.created_at AS last_message_at,
    COALESCE(unread.cnt, 0) AS unread_count
  FROM public.conversations c
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) last_msg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.receiver_id = p_user_id
      AND m.read = false
  ) unread ON true
  WHERE c.participant_1 = p_user_id OR c.participant_2 = p_user_id
  ORDER BY last_msg.created_at DESC NULLS LAST
  LIMIT p_limit;
$$;


-- ===================== H) RPC: TRAINER DASHBOARD STATS =====================
-- Returns key metrics for a trainer in a single call

CREATE OR REPLACE FUNCTION public.get_trainer_dashboard(p_trainer_id TEXT)
RETURNS TABLE (
  total_clients BIGINT,
  active_clients BIGINT,
  total_sessions BIGINT,
  completed_sessions BIGINT,
  total_revenue NUMERIC,
  outstanding_revenue NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT COUNT(*) FROM public.trainer_clients WHERE trainer_id = p_trainer_id) AS total_clients,
    (SELECT COUNT(*) FROM public.trainer_clients WHERE trainer_id = p_trainer_id AND status = 'active') AS active_clients,
    (SELECT COUNT(*) FROM public.trainer_sessions WHERE trainer_id = p_trainer_id) AS total_sessions,
    (SELECT COUNT(*) FROM public.trainer_sessions WHERE trainer_id = p_trainer_id AND status = 'completed') AS completed_sessions,
    (SELECT COALESCE(SUM(amount), 0) FROM public.client_payments WHERE trainer_id = p_trainer_id AND status = 'paid') AS total_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM public.client_payments WHERE trainer_id = p_trainer_id AND status != 'paid') AS outstanding_revenue;
$$;


-- ===================== DONE =====================
-- All indexes created CONCURRENTLY (no table locks).
-- New tables created with IF NOT EXISTS.
-- RPCs created with CREATE OR REPLACE.
-- Safe to run on a live database.
