-- Inbox Concierge – reset data for testing
-- Run in Supabase SQL Editor when you want to clear all user data and re-test the flow.
-- Tables are not dropped; only data is deleted. Run schema.sql first if tables don't exist.

-- Delete in dependency order (child-like data first; no FKs currently, but order avoids confusion)
DELETE FROM classifications;
DELETE FROM buckets;
DELETE FROM threads_cache;
DELETE FROM tokens;

-- Re-seed default buckets for the 'default' user
INSERT INTO buckets (user_id, id, name, is_default) VALUES
  ('default', 'important', 'Important', true),
  ('default', 'can-wait', 'Can wait', true),
  ('default', 'auto-archive', 'Auto-archive', true),
  ('default', 'newsletter', 'Newsletter', true),
  ('default', 'other', 'Other', true)
ON CONFLICT (user_id, id) DO NOTHING;
