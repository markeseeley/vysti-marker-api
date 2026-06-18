-- 005_cleanup_orphan_issue_examples.sql
--
-- APPLIED IN PRODUCTION: 2026-06-18 (via Supabase SQL Editor).
--
-- After removing the silent-prune block in vysti_api.py (commit 2cdf515)
-- and the DELETE+INSERT re-mark pattern (commit 0347334), a diagnostic
-- query against issue_examples joined to mark_events showed 1,124
-- orphan rows — issue_examples whose mark_event_id no longer matched
-- any mark_events.id. These were leftovers from the old DELETE+INSERT
-- pattern: each re-mark inserted a fresh mark_events row with a new
-- uuid, and the best-effort issue_examples cleanup occasionally left
-- the prior batch dangling against the dead uuid.
--
-- This migration deletes them and adds the FK so the database
-- guarantees CASCADE going forward.

BEGIN;

WITH orphans AS (
  SELECT ie.id
  FROM issue_examples ie
  LEFT JOIN mark_events me ON me.id = ie.mark_event_id
  WHERE ie.mark_event_id IS NOT NULL
    AND me.id IS NULL
)
DELETE FROM issue_examples
WHERE id IN (SELECT id FROM orphans);

-- Verify before commit:
--   SELECT count(*) FROM issue_examples ie
--   LEFT JOIN mark_events me ON me.id = ie.mark_event_id
--   WHERE ie.mark_event_id IS NOT NULL AND me.id IS NULL;
-- Expect 0.

COMMIT;

-- Add the FK so the application code no longer has to remember to
-- cascade child rows manually. Future deletions of a mark_events row
-- automatically clear its issue_examples.
ALTER TABLE issue_examples
  ADD CONSTRAINT issue_examples_mark_event_id_fkey
  FOREIGN KEY (mark_event_id)
  REFERENCES mark_events(id)
  ON DELETE CASCADE;
