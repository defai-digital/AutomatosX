-- Migration 011: Rate Limiting Tables
-- Phase 3 Week 2 Day 8-9: Rate Limiting System
-- Creates tables for token bucket rate limiting

-- Rate limit configurations table
CREATE TABLE IF NOT EXISTS rate_limit_configs (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  max_requests INTEGER NOT NULL,          -- Maximum requests in window
  window_ms INTEGER NOT NULL,              -- Time window in milliseconds
  burst_size INTEGER NOT NULL DEFAULT 0,   -- Allow burst above limit
  enabled INTEGER NOT NULL DEFAULT 1,      -- 1 = enabled, 0 = disabled
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Insert default rate limit configurations
INSERT OR IGNORE INTO rate_limit_configs (id, name, description, max_requests, window_ms, burst_size, enabled, created_at, updated_at)
VALUES
  ('cfg_global', 'global', 'Global rate limit for all requests', 10000, 60000, 1000, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('cfg_user', 'per_user', 'Rate limit per user', 100, 60000, 10, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('cfg_provider', 'per_provider', 'Rate limit per provider', 1000, 60000, 100, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('cfg_ip', 'per_ip', 'Rate limit per IP address', 50, 60000, 5, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Token buckets table (stores current state)
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,                -- user_id, ip, provider, 'global'
  type TEXT NOT NULL,                      -- 'user', 'provider', 'ip', 'global'
  tokens REAL NOT NULL,                    -- Current token count
  max_tokens INTEGER NOT NULL,             -- Maximum tokens (bucket capacity)
  refill_rate REAL NOT NULL,               -- Tokens added per millisecond
  last_refill INTEGER NOT NULL,            -- Last refill timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for bucket lookups
CREATE INDEX IF NOT EXISTS idx_buckets_key ON rate_limit_buckets(key);
CREATE INDEX IF NOT EXISTS idx_buckets_type ON rate_limit_buckets(type);

-- Rate limit violations table (for monitoring)
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,                       -- Identifier that exceeded limit
  type TEXT NOT NULL,                      -- 'user', 'provider', 'ip', 'global'
  config_name TEXT NOT NULL,               -- Which rate limit was violated
  violation_time INTEGER NOT NULL,
  tokens_requested INTEGER NOT NULL DEFAULT 1,
  tokens_available REAL NOT NULL,
  metadata TEXT,                           -- JSON metadata
  created_at INTEGER NOT NULL
);

-- Indexes for violation queries
CREATE INDEX IF NOT EXISTS idx_violations_key ON rate_limit_violations(key);
CREATE INDEX IF NOT EXISTS idx_violations_type ON rate_limit_violations(type);
CREATE INDEX IF NOT EXISTS idx_violations_time ON rate_limit_violations(violation_time);

-- User quotas table (custom limits per user)
CREATE TABLE IF NOT EXISTS user_quotas (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  max_requests INTEGER NOT NULL,
  window_ms INTEGER NOT NULL,
  burst_size INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,                      -- Optional expiration
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for user quota lookups
CREATE INDEX IF NOT EXISTS idx_user_quotas_user ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_expires ON user_quotas(expires_at);

-- Rate limit statistics table
CREATE TABLE IF NOT EXISTS rate_limit_stats (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                      -- YYYY-MM-DD
  type TEXT NOT NULL,                      -- 'user', 'provider', 'ip', 'global'
  total_requests INTEGER NOT NULL DEFAULT 0,
  allowed_requests INTEGER NOT NULL DEFAULT 0,
  denied_requests INTEGER NOT NULL DEFAULT 0,
  unique_keys INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(date, type)
);

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_rate_stats_date ON rate_limit_stats(date);
CREATE INDEX IF NOT EXISTS idx_rate_stats_type ON rate_limit_stats(type);

-- View for rate limit summary
CREATE VIEW IF NOT EXISTS rate_limit_summary AS
SELECT
  type,
  SUM(total_requests) as total_requests,
  SUM(allowed_requests) as allowed_requests,
  SUM(denied_requests) as denied_requests,
  CAST(SUM(allowed_requests) AS REAL) / NULLIF(SUM(total_requests), 0) * 100 as approval_rate,
  SUM(unique_keys) as total_unique_keys
FROM rate_limit_stats
GROUP BY type;

-- View for active buckets
CREATE VIEW IF NOT EXISTS active_buckets AS
SELECT
  key,
  type,
  tokens,
  max_tokens,
  CAST(tokens AS REAL) / max_tokens * 100 as fill_percentage,
  refill_rate * 1000 as tokens_per_second,
  last_refill,
  created_at
FROM rate_limit_buckets
WHERE tokens > 0
ORDER BY fill_percentage ASC;

-- View for recent violations
CREATE VIEW IF NOT EXISTS recent_violations AS
SELECT
  key,
  type,
  config_name,
  violation_time,
  tokens_requested,
  tokens_available,
  ROUND(tokens_available - tokens_requested, 2) as deficit
FROM rate_limit_violations
WHERE violation_time > strftime('%s', 'now', '-24 hours') * 1000
ORDER BY violation_time DESC
LIMIT 100;

-- Trigger to update rate limit stats
CREATE TRIGGER IF NOT EXISTS update_rate_limit_stats
AFTER INSERT ON rate_limit_violations
BEGIN
  INSERT INTO rate_limit_stats (id, date, type, total_requests, allowed_requests, denied_requests, unique_keys, created_at, updated_at)
  VALUES (
    lower(hex(randomblob(16))),
    date('now'),
    NEW.type,
    1,
    0,
    1,
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
  )
  ON CONFLICT(date, type) DO UPDATE SET
    total_requests = total_requests + 1,
    denied_requests = denied_requests + 1,
    updated_at = strftime('%s', 'now') * 1000;
END;

-- Trigger to clean up old violations (keep last 30 days)
CREATE TRIGGER IF NOT EXISTS cleanup_old_violations
AFTER INSERT ON rate_limit_violations
BEGIN
  DELETE FROM rate_limit_violations
  WHERE violation_time < strftime('%s', 'now', '-30 days') * 1000;
END;
