-- Migration: Add source column to mark_events for mobile tracking
-- Run in Supabase SQL Editor

ALTER TABLE mark_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'desktop';

-- Index for efficient mobile mark counting per user
CREATE INDEX IF NOT EXISTS idx_mark_events_user_source
  ON mark_events (user_id, source);

-- Index for daily mobile rate limiting
CREATE INDEX IF NOT EXISTS idx_mark_events_user_source_created
  ON mark_events (user_id, source, created_at);
