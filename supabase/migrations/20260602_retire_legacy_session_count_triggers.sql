-- 20260602_retire_legacy_session_count_triggers.sql
-- v19-fix-02 — end the dual counting authority.
--
-- After v16-D3 the displayed lifetime count is derived CLIENT-SIDE as:
--   historical_offset_sessions + COUNT(completed trainer_sessions)
-- The legacy triggers below instead count calendar_events and MUTATE
-- historical_sessions_offset / total_sessions. With the app reading the new
-- column directly (v19-fix-02 F1), those triggers are now ONLY a drift source:
-- a master-toggle flip bulk-rebuckets the legacy offset and the two authorities
-- count different row sets, so they routinely disagree.
--
-- PRECONDITION (probe B1): public.trainer_clients.historical_offset_sessions
--   exists and is backfilled. ONLY APPLY when probe B1 has_new_col = true AND
--   probe B2 returns >= 1 trigger row. If B1 = false, apply
--   20260530_add_historical_offset_sessions.sql FIRST, re-run B1, then apply this.
--
-- ROLLBACK: re-run 20260520_hybrid_auto_count_default.sql to recreate the
--   functions + the users trigger wiring. (The functions are KEPT below — only
--   the trigger wiring is dropped — so rollback is a single re-run of 20260520.)

BEGIN;

-- Drop the AFTER trigger on users that bulk-rebuckets historical_sessions_offset
-- for every "follow default" client when the master toggle flips.
DROP TRIGGER IF EXISTS users_auto_count_default_recompute ON public.users;

-- The calendar_events AFTER trigger + the trainer_clients BEFORE-UPDATE trigger
-- were created in earlier migrations under their original (env-specific) trigger
-- names. Discover + drop them BY FUNCTION so we don't depend on a specific
-- trigger name across environments. Functions are intentionally NOT dropped
-- (harmless un-wired) so rollback stays a single re-run of 20260520.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname, c.relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc  p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND p.proname IN ('recompute_total_sessions_from_calendar','recompute_after_offset_change_v2')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname);
  END LOOP;
END $$;

COMMIT;

-- POST-APPLY VERIFICATION (run separately): expect ZERO rows.
-- SELECT t.tgname, c.relname, p.proname FROM pg_trigger t
--   JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
--  WHERE NOT t.tgisinternal AND p.proname IN
--   ('recompute_total_sessions_from_calendar','recompute_after_offset_change_v2','recompute_clients_on_trainer_default_change');
