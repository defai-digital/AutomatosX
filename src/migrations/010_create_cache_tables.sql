-- Migration 010: Provider Response Cache Tables
-- Phase 3 Week 1 Day 1: Response Caching Layer
-- Creates tables for intelligent response caching

-- Cache entries table
CREATE TABLE IF NOT EXISTS provider_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,           -- Hash of request content
  request_hash TEXT NOT NULL,               -- SHA-256 of normalized request
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  request_content TEXT NOT NULL,            -- Normalized request for matching
  response_content TEXT NOT NULL,           -- Cached response
  response_data TEXT NOT NULL,              -- Full ProviderResponse JSON
  tokens_used INTEGER NOT NULL DEFAULT 0,   -- Tokens from original request
  cost_saved REAL NOT NULL DEFAULT 0.0,     -- Estimated cost savings
  hit_count INTEGER NOT NULL DEFAULT 0,     -- Number of cache hits
  last_hit_at INTEGER,                      -- Last time cache was hit
  ttl_seconds INTEGER NOT NULL DEFAULT 3600,-- Time-to-live in seconds
  expires_at INTEGER NOT NULL,              -- Expiration timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for cache lookups
CREATE INDEX IF NOT EXISTS idx_cache_key ON provider_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_hash ON provider_cache(request_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON provider_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_provider ON provider_cache(provider);
CREATE INDEX IF NOT EXISTS idx_cache_created ON provider_cache(created_at);

-- Cache statistics table
CREATE TABLE IF NOT EXISTS cache_stats (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                       -- YYYY-MM-DD format
  provider TEXT NOT NULL,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  hit_rate REAL NOT NULL DEFAULT 0.0,       -- Percentage
  cost_saved REAL NOT NULL DEFAULT 0.0,     -- Estimated savings
  tokens_saved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(date, provider)
);

-- Index for statistics queries
CREATE INDEX IF NOT EXISTS idx_cache_stats_date ON cache_stats(date);
CREATE INDEX IF NOT EXISTS idx_cache_stats_provider ON cache_stats(provider);

-- Cache configuration table
CREATE TABLE IF NOT EXISTS cache_config (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Insert default cache configuration
INSERT OR IGNORE INTO cache_config (id, key, value, description, created_at, updated_at)
VALUES
  ('cfg_001', 'enabled', 'true', 'Enable/disable caching globally', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('cfg_002', 'default_ttl', '3600', 'Default TTL in seconds (1 hour)', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('cfg_003', 'max_cache_size', '10000', 'Maximum number of cache entries', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('cfg_004', 'eviction_policy', 'lru', 'Cache eviction policy (lru, lfu, fifo)', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('cfg_005', 'semantic_threshold', '0.85', 'Similarity threshold for semantic caching (0-1)', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- View for cache hit rate analysis
CREATE VIEW IF NOT EXISTS cache_hit_rate_summary AS
SELECT
  provider,
  SUM(cache_hits) as total_hits,
  SUM(cache_misses) as total_misses,
  SUM(total_requests) as total_requests,
  CASE
    WHEN SUM(total_requests) > 0
    THEN CAST(SUM(cache_hits) AS REAL) / SUM(total_requests) * 100
    ELSE 0
  END as overall_hit_rate,
  SUM(cost_saved) as total_cost_saved,
  SUM(tokens_saved) as total_tokens_saved
FROM cache_stats
GROUP BY provider;

-- View for top cached responses
CREATE VIEW IF NOT EXISTS top_cached_responses AS
SELECT
  id,
  provider,
  model,
  request_content,
  hit_count,
  cost_saved,
  tokens_used,
  created_at,
  last_hit_at
FROM provider_cache
WHERE hit_count > 0
ORDER BY hit_count DESC
LIMIT 100;

-- Trigger to update cache statistics on cache hit
CREATE TRIGGER IF NOT EXISTS update_cache_stats_on_hit
AFTER UPDATE OF hit_count ON provider_cache
BEGIN
  INSERT INTO cache_stats (id, date, provider, cache_hits, cache_misses, total_requests, hit_rate, cost_saved, tokens_saved, created_at, updated_at)
  VALUES (
    lower(hex(randomblob(16))),
    date('now'),
    NEW.provider,
    1,
    0,
    1,
    100.0,
    NEW.cost_saved,
    NEW.tokens_used,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
  )
  ON CONFLICT(date, provider) DO UPDATE SET
    cache_hits = cache_hits + 1,
    total_requests = total_requests + 1,
    hit_rate = CAST(cache_hits AS REAL) / total_requests * 100,
    cost_saved = cost_saved + NEW.cost_saved,
    tokens_saved = tokens_saved + NEW.tokens_used,
    updated_at = strftime('%s', 'now') * 1000;
END;

-- Trigger to clean up expired cache entries
CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
AFTER INSERT ON provider_cache
BEGIN
  DELETE FROM provider_cache
  WHERE expires_at < strftime('%s', 'now') * 1000;
END;
