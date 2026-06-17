-- 003_atomic_lifetime_marks.sql
--
-- Adds a SECURITY DEFINER Postgres function that atomically increments
-- profiles.lifetime_marks. Replaces the previous read-modify-write
-- pattern in vysti_api._bump_lifetime_marks(), which had a small TOCTOU
-- window: two concurrent /mark or /mark_text requests for the same
-- user could both GET the same value of lifetime_marks and both PATCH
-- value+1, undercounting by one.
--
-- The /mark endpoint also serializes per-user via _active_marks, so the
-- race is mostly theoretical there — but /mark_text doesn't have that
-- guard, and the lifetime counter governs the free-tier paywall.
-- Atomic increment closes the gap entirely.
--
-- Run once in the Supabase SQL Editor. The Python code falls back to
-- the old read-modify-write if the function is missing, so deploy
-- order doesn't matter.

CREATE OR REPLACE FUNCTION public.increment_lifetime_marks(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET lifetime_marks = COALESCE(lifetime_marks, 0) + 1
   WHERE id = p_user_id
   RETURNING lifetime_marks;
$$;

-- Only the service role (used by the FastAPI backend) needs to call
-- this. Anon/authenticated roles should not be able to increment a
-- profile's lifetime mark counter directly.
REVOKE ALL ON FUNCTION public.increment_lifetime_marks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_lifetime_marks(uuid) TO service_role;
