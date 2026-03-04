-- Inbox Concierge – Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- Buckets: default + custom per user
CREATE TABLE IF NOT EXISTS buckets (
  user_id TEXT NOT NULL DEFAULT 'default',
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- Seed default buckets for user 'default' (run once)
INSERT INTO buckets (user_id, id, name, is_default) VALUES
  ('default', 'important', 'Important', true),
  ('default', 'can-wait', 'Can wait', true),
  ('default', 'auto-archive', 'Auto-archive', true),
  ('default', 'newsletter', 'Newsletter', true),
  ('default', 'other', 'Other', true)
ON CONFLICT (user_id, id) DO NOTHING;

-- Classifications: thread_id → bucket_id + reason per user
CREATE TABLE IF NOT EXISTS classifications (
  user_id TEXT NOT NULL DEFAULT 'default',
  thread_id TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);

-- Threads cache: one row per user, jsonb array of { id, subject, snippet }
CREATE TABLE IF NOT EXISTS threads_cache (
  user_id TEXT NOT NULL DEFAULT 'default' PRIMARY KEY,
  threads JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OAuth tokens, one row per user.
CREATE TABLE IF NOT EXISTS tokens (
  user_id TEXT NOT NULL DEFAULT 'default' PRIMARY KEY,
  tokens JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS (uncomment when using real user_id from auth):
-- ALTER TABLE buckets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE threads_cache ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can manage own buckets" ON buckets FOR ALL USING (user_id = current_setting('app.user_id', true));
