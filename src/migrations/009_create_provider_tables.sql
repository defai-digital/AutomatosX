-- Migration 009: Create Provider Tables
-- Phase 2 Week 1 Day 3: Provider Lifecycle Management
-- Date: 2025-11-09

-- ============================================================================
-- Provider Logs Table
-- ============================================================================
-- Stores complete lifecycle logs for each provider request
CREATE TABLE IF NOT EXISTS provider_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  conversation_id TEXT,
  user_id TEXT,
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'gemini', 'openai')),
  model TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('idle', 'validating', 'requesting', 'streaming', 'rate_limited', 'retrying', 'completed', 'failed')),
  request_data TEXT NOT NULL, -- JSON stringified request
  response_data TEXT, -- JSON stringified response
  error_message TEXT,
  error_code TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration INTEGER,
  retry_attempt INTEGER NOT NULL DEFAULT 0,
  tags TEXT, -- JSON array of strings
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================================================
-- Provider Metrics Table
-- ============================================================================
-- Stores aggregated metrics for provider performance tracking
CREATE TABLE IF NOT EXISTS provider_metrics (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'gemini', 'openai')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  first_token_latency INTEGER, -- milliseconds
  total_duration INTEGER, -- milliseconds
  chunks_received INTEGER DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  is_fallback INTEGER NOT NULL DEFAULT 0 CHECK(is_fallback IN (0, 1)),
  fallback_provider TEXT,
  success INTEGER NOT NULL DEFAULT 0 CHECK(success IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (request_id) REFERENCES provider_logs(request_id) ON DELETE CASCADE
);

-- ============================================================================
-- Provider Rate Limits Table
-- ============================================================================
-- Tracks rate limit information for each provider
CREATE TABLE IF NOT EXISTS provider_rate_limits (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'gemini', 'openai')),
  model TEXT NOT NULL,
  limit_type TEXT NOT NULL CHECK(limit_type IN ('requests_per_minute', 'tokens_per_minute', 'requests_per_day')),
  current_usage INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(provider, model, limit_type)
);

-- ============================================================================
-- Provider Configurations Table
-- ============================================================================
-- Stores provider-specific configuration and credentials
CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK(provider IN ('claude', 'gemini', 'openai')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  priority INTEGER NOT NULL DEFAULT 1,
  api_key_encrypted TEXT, -- Encrypted API key
  api_url TEXT,
  default_model TEXT,
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  rate_limit_rpm INTEGER, -- Requests per minute
  rate_limit_tpm INTEGER, -- Tokens per minute
  fallback_providers TEXT, -- JSON array of provider names
  config_json TEXT, -- Additional JSON config
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================================================
-- Indexes for Provider Logs
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_provider_logs_request_id ON provider_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_provider_logs_conversation_id ON provider_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_provider_logs_user_id ON provider_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_logs_provider ON provider_logs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_logs_state ON provider_logs(state);
CREATE INDEX IF NOT EXISTS idx_provider_logs_created_at ON provider_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_logs_provider_state ON provider_logs(provider, state);
CREATE INDEX IF NOT EXISTS idx_provider_logs_conversation_created ON provider_logs(conversation_id, created_at);

-- ============================================================================
-- Indexes for Provider Metrics
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_provider_metrics_request_id ON provider_metrics(request_id);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider ON provider_metrics(provider);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_model ON provider_metrics(model);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_created_at ON provider_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_success ON provider_metrics(success);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider_model ON provider_metrics(provider, model);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider_success ON provider_metrics(provider, success);

-- ============================================================================
-- Indexes for Provider Rate Limits
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_provider_rate_limits_provider ON provider_rate_limits(provider);
CREATE INDEX IF NOT EXISTS idx_provider_rate_limits_reset_at ON provider_rate_limits(reset_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_rate_limits_unique ON provider_rate_limits(provider, model, limit_type);

-- ============================================================================
-- Indexes for Provider Configurations
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_provider_configs_enabled ON provider_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_provider_configs_priority ON provider_configs(priority);

-- ============================================================================
-- Triggers for Updated At
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_provider_logs_updated_at
  AFTER UPDATE ON provider_logs
  FOR EACH ROW
BEGIN
  UPDATE provider_logs SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_provider_rate_limits_updated_at
  AFTER UPDATE ON provider_rate_limits
  FOR EACH ROW
BEGIN
  UPDATE provider_rate_limits SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_provider_configs_updated_at
  AFTER UPDATE ON provider_configs
  FOR EACH ROW
BEGIN
  UPDATE provider_configs SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- ============================================================================
-- Default Provider Configurations
-- ============================================================================

INSERT OR IGNORE INTO provider_configs (id, provider, enabled, priority, default_model, max_retries, timeout_ms)
VALUES
  ('config_claude', 'claude', 1, 1, 'claude-3-sonnet-20240229', 3, 30000),
  ('config_gemini', 'gemini', 1, 2, 'gemini-pro', 3, 30000),
  ('config_openai', 'openai', 1, 3, 'gpt-4', 3, 30000);

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Provider success rate view
CREATE VIEW IF NOT EXISTS provider_success_rate AS
SELECT
  provider,
  model,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
  CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100 as success_rate,
  AVG(total_duration) as avg_duration,
  AVG(first_token_latency) as avg_first_token_latency,
  SUM(total_tokens) as total_tokens_used
FROM provider_metrics
WHERE created_at >= strftime('%s', 'now', '-7 days') * 1000
GROUP BY provider, model;

-- Provider performance by hour
CREATE VIEW IF NOT EXISTS provider_performance_hourly AS
SELECT
  provider,
  strftime('%Y-%m-%d %H:00:00', datetime(created_at / 1000, 'unixepoch')) as hour,
  COUNT(*) as request_count,
  AVG(total_duration) as avg_duration,
  AVG(first_token_latency) as avg_first_token_latency,
  SUM(total_tokens) as total_tokens
FROM provider_metrics
WHERE created_at >= strftime('%s', 'now', '-24 hours') * 1000
GROUP BY provider, hour
ORDER BY hour DESC;

-- Failed requests view
CREATE VIEW IF NOT EXISTS provider_failed_requests AS
SELECT
  pl.id,
  pl.request_id,
  pl.provider,
  pl.model,
  pl.state,
  pl.error_message,
  pl.error_code,
  pl.retry_attempt,
  pl.created_at,
  pm.total_duration
FROM provider_logs pl
LEFT JOIN provider_metrics pm ON pl.request_id = pm.request_id
WHERE pl.state = 'failed'
ORDER BY pl.created_at DESC;
