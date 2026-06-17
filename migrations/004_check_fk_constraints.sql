-- 004_check_fk_constraints.sql
--
-- READ-ONLY DIAGNOSTIC — does not change anything. Run this in the
-- Supabase SQL Editor and look at the two result sets. You're checking
-- that orphan rows can't accumulate if a parent (mark_events, profiles,
-- classes, etc.) is deleted but a child table's FK doesn't cascade.
--
-- Background: the post-prune audit flagged that /api/delete-account
-- deletes tables in a specific order (issue_examples,
-- dismissed_issue_feedback, revision_drafts, mark_events) assuming
-- FKs are correctly set. If they aren't, orphan rows persist in
-- those child tables indefinitely.
--
-- Run the two queries below and read the result narratives.

-- ─────────────────────────────────────────────────────────────────
-- 1. List every foreign-key constraint declared in the database
--    against the tables that store user/teacher data.
--    Look at the `on_delete` and `on_update` columns. A healthy
--    setup has on_delete='CASCADE' from issue_examples,
--    dismissed_issue_feedback, revision_drafts back to mark_events
--    (and from those plus class_students back to profiles when the
--    user is deleted).
-- ─────────────────────────────────────────────────────────────────
SELECT
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column,
  rc.delete_rule AS on_delete,
  rc.update_rule AS on_update,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
  AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'mark_events',
    'issue_examples',
    'dismissed_issue_feedback',
    'revision_drafts',
    'class_students',
    'classes',
    'mark_event_qc',
    'api_keys',
    'api_usage',
    'profiles'
  )
ORDER BY tc.table_name, tc.constraint_name;


-- ─────────────────────────────────────────────────────────────────
-- 2. Check for actual orphan rows RIGHT NOW. Each subquery returns
--    a non-zero count if cleanup has historically been incomplete.
--    Expected output: every count = 0. Non-zero counts tell you
--    which child table has accumulated orphans that need a one-off
--    cleanup DELETE.
-- ─────────────────────────────────────────────────────────────────
SELECT
  'issue_examples_orphans (mark_event_id → mark_events.id missing)' AS check_name,
  (
    SELECT count(*)
    FROM issue_examples ie
    LEFT JOIN mark_events me ON me.id = ie.mark_event_id
    WHERE ie.mark_event_id IS NOT NULL
      AND me.id IS NULL
  ) AS orphan_count
UNION ALL
SELECT
  'dismissed_issue_feedback_orphans (mark_event_id → mark_events.id missing)',
  (
    SELECT count(*)
    FROM dismissed_issue_feedback dif
    LEFT JOIN mark_events me ON me.id = dif.mark_event_id
    WHERE dif.mark_event_id IS NOT NULL
      AND me.id IS NULL
  )
UNION ALL
SELECT
  'mark_events_orphans (user_id → profiles.id or auth.users.id missing)',
  (
    SELECT count(*)
    FROM mark_events me
    LEFT JOIN profiles p ON p.id = me.user_id
    WHERE me.user_id IS NOT NULL
      AND p.id IS NULL
  )
UNION ALL
SELECT
  'mark_events_orphans (class_id → classes.id missing)',
  (
    SELECT count(*)
    FROM mark_events me
    LEFT JOIN classes c ON c.id = me.class_id
    WHERE me.class_id IS NOT NULL
      AND c.id IS NULL
  )
UNION ALL
SELECT
  'class_students_orphans (class_id → classes.id missing)',
  (
    SELECT count(*)
    FROM class_students cs
    LEFT JOIN classes c ON c.id = cs.class_id
    WHERE cs.class_id IS NOT NULL
      AND c.id IS NULL
  );

-- Interpretation:
--   • All zero → FKs are doing their job; nothing to clean up.
--   • Any non-zero → query 1 above probably shows that constraint
--     is missing or has on_delete='NO ACTION'. The next migration
--     should add the missing FK with ON DELETE CASCADE (or SET NULL
--     for class_id, which is the right behaviour: deleting a class
--     should not delete its students' essays).
