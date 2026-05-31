-- supabase/migrations/20260531_client_programs_endcycle_notified.sql
-- Sprint: v18 dispatch 03
--
-- v18-D3: trainer-side 3-day end-of-cycle notification idempotency.
--
-- The web client currently dedupes notifications via a localStorage guard
-- (`apex-endcycle-notified-<programId>-<YYYY-MM-DD>` in
-- src/lib/programProgress.ts). That works on a single device but is lost
-- if the trainer clears storage or signs in from another browser, so a
-- column-backed guard is desirable for v2.
--
-- This migration adds the column only. The web client's idempotency code
-- continues to use localStorage in v1 and will be wired to read/write
-- this column in a follow-up. Safe to apply at any time.
--
-- Idempotency key shape (when this column starts being written):
--   set `end_cycle_notified_at = now()` after firing the
--   `program_ending_soon` notification for the program's CURRENT end_date.
--   If a trainer later extends the program (end_date moves forward),
--   compare stored `end_cycle_notified_at` against the new `end_date`:
--   if `end_cycle_notified_at < end_date - INTERVAL '3 days'`, the
--   notification may re-fire and reset this column \u2014 desired per the
--   v18-D3 brief \u00a71 ("Program extended/edited").

ALTER TABLE client_programs
  ADD COLUMN IF NOT EXISTS end_cycle_notified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN client_programs.end_cycle_notified_at IS
  'v18-D3: set when the 3-days-before-end trainer notification fired for this program''s current end date. Compare against end_date for re-fire eligibility if the program is extended.';
