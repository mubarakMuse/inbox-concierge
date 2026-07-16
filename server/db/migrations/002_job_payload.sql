-- Migration: optional JSON payload on jobs (e.g. forceRefresh for classify)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}';
