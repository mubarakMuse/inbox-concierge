-- Inbox Concierge – Postgres schema
-- Local: applied by docker-compose on first boot, or:
--   psql "$DATABASE_URL" -f server/db/schema.sql
-- RDS: from a host with VPC access (or briefly db_publicly_accessible=true).

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

-- Async classify / recategorize jobs (App Runner enqueues; Lambda or local worker runs)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  done INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs (user_id);

-- RLS (uncomment when using real user_id from auth):
-- ALTER TABLE buckets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE threads_cache ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can manage own buckets" ON buckets FOR ALL USING (user_id = current_setting('app.user_id', true));
