-- Migration: async jobs table for classify / recategorize
-- Run against Postgres for existing databases that predate jobs.

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
