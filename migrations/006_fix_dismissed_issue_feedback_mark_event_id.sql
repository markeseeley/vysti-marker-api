-- 006_fix_dismissed_issue_feedback_mark_event_id.sql
--
-- APPLIED IN PRODUCTION: 2026-06-18 (via Supabase SQL Editor).
--
-- The dismissed_issue_feedback.mark_event_id column was created as
-- bigint, but mark_events.id is uuid. Two frontend writers actively
-- send UUIDs into this column:
--
--   - student-react/src/components/RevisionPracticePanel.jsx (~L858)
--   - student.html (legacy student app)
--
-- Both wrap the insert in `if (insertError) console.warn(...)` — which
-- means every dismissal with a non-null mark_event_id has been silently
-- erroring at PostgREST forever. The table was found empty (total_rows
-- = 0) at audit time on 2026-06-18, confirming the writes had never
-- succeeded since this table was created.
--
-- Fix: ALTER the column to uuid (USING NULL — safe because the table
-- is empty and every prior value would have been NULL anyway) and
-- attach a proper FK to mark_events(id) with ON DELETE CASCADE.

ALTER TABLE dismissed_issue_feedback
  ALTER COLUMN mark_event_id TYPE uuid
  USING NULL;

ALTER TABLE dismissed_issue_feedback
  ADD CONSTRAINT dismissed_issue_feedback_mark_event_id_fkey
  FOREIGN KEY (mark_event_id)
  REFERENCES mark_events(id)
  ON DELETE CASCADE;

-- After this migration:
--   * Every dismissal feedback row will actually persist (no more
--     silent-warn on type mismatch).
--   * The FK guarantees children go with their parent on delete.
--
-- No application code change required — the frontend writers were
-- already sending the right values; the schema just couldn't accept
-- them.
