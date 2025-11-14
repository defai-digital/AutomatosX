-- Migration 012: Monitoring & Observability Tables
-- Phase 3 Week 3 Day 11-12: Metrics Collection & Aggregation
-- Creates tables for real-time monitoring, alerts, and cost analytics

-- =====================================================
-- RAW METRICS (7 day retention)
-- =====================================================

CREATE TABLE IF NOT EXISTS metrics_raw (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  metric_type TEXT NOT NULL,           -- 'request', 'cache', 'rate_limit'
  provider TEXT,
  model TEXT,
  user_id TEXT,

  -- Performance metrics
  latency INTEGER,                      -- Response time in ms
  success INTEGER NOT NULL DEFAULT 1,   -- 1 = success, 0 = error
  error_message TEXT,

  -- Token metrics
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Cost metrics
  cost REAL DEFAULT 0.0,

  -- Cache metrics
  cache_event TEXT,                     -- 'hit', 'miss', 'store'
  cache_saved_cost REAL DEFAULT 0.0,
  cache_saved_tokens INTEGER DEFAULT 0,

  -- Rate limit metrics
  rate_limit_event TEXT,                -- 'allowed', 'denied'
  rate_limit_type TEXT,                 -- 'user', 'provider', 'ip', 'global'
  rate_limit_remaining INTEGER,

  -- Metadata
  metadata TEXT,                        -- JSON
  created_at INTEGER NOT NULL
);

-- Indexes for efficient time-series queries
CREATE INDEX IF NOT EXISTS idx_metrics_raw_timestamp ON metrics_raw(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_raw_provider ON metrics_raw(provider, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_raw_type ON metrics_raw(metric_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_raw_user ON metrics_raw(user_id, timestamp);

-- =====================================================
-- AGGREGATED METRICS (1-minute rollups)
-- =====================================================

CREATE TABLE IF NOT EXISTS metrics_1min (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,          -- Start of 1-minute window
  provider TEXT,
  model TEXT,

  -- Request metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,

  -- Latency metrics (ms)
  avg_latency REAL,
  min_latency INTEGER,
  max_latency INTEGER,
  p50_latency REAL,
  p95_latency REAL,
  p99_latency REAL,

  -- Token metrics
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Cost metrics
  total_cost REAL DEFAULT 0.0,
  avg_cost_per_request REAL DEFAULT 0.0,

  -- Cache metrics
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  cache_hit_rate REAL DEFAULT 0.0,
  cache_saved_cost REAL DEFAULT 0.0,

  -- Rate limit metrics
  rate_limit_allowed INTEGER DEFAULT 0,
  rate_limit_denied INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL,
  UNIQUE(timestamp, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_metrics_1min_time ON metrics_1min(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_1min_provider ON metrics_1min(provider, timestamp);

-- =====================================================
-- AGGREGATED METRICS (1-hour rollups)
-- =====================================================

CREATE TABLE IF NOT EXISTS metrics_1hour (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,          -- Start of 1-hour window
  provider TEXT,
  model TEXT,

  -- Request metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  success_rate REAL,

  -- Latency metrics
  avg_latency REAL,
  min_latency INTEGER,
  max_latency INTEGER,
  p50_latency REAL,
  p95_latency REAL,
  p99_latency REAL,

  -- Token metrics
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Cost metrics
  total_cost REAL DEFAULT 0.0,
  avg_cost_per_request REAL DEFAULT 0.0,

  -- Cache metrics
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  cache_hit_rate REAL DEFAULT 0.0,
  cache_saved_cost REAL DEFAULT 0.0,

  created_at INTEGER NOT NULL,
  UNIQUE(timestamp, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_metrics_1hour_time ON metrics_1hour(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_1hour_provider ON metrics_1hour(provider, timestamp);

-- =====================================================
-- AGGREGATED METRICS (1-day rollups)
-- =====================================================

CREATE TABLE IF NOT EXISTS metrics_1day (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  provider TEXT,
  model TEXT,

  -- Request metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  success_rate REAL,

  -- Latency metrics
  avg_latency REAL,
  min_latency INTEGER,
  max_latency INTEGER,
  p95_latency REAL,

  -- Token metrics
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Cost metrics
  total_cost REAL DEFAULT 0.0,
  avg_cost_per_request REAL DEFAULT 0.0,

  -- Cache metrics
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  cache_hit_rate REAL DEFAULT 0.0,
  cache_saved_cost REAL DEFAULT 0.0,

  created_at INTEGER NOT NULL,
  UNIQUE(date, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_metrics_1day_date ON metrics_1day(date);
CREATE INDEX IF NOT EXISTS idx_metrics_1day_provider ON metrics_1day(provider, date);

-- =====================================================
-- ALERT RULES
-- =====================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Condition
  metric TEXT NOT NULL,                -- 'latency', 'error_rate', 'cost', etc.
  operator TEXT NOT NULL,              -- '>', '<', '>=', '<=', '==', '!='
  threshold REAL NOT NULL,
  duration_seconds INTEGER DEFAULT 60, -- Alert after N seconds

  -- Filters
  provider TEXT,
  model TEXT,

  -- Severity
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'

  -- State
  enabled INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  labels TEXT,                         -- JSON labels
  annotations TEXT,                    -- JSON annotations

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- =====================================================
-- ALERTS (Active and Historical)
-- =====================================================

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,

  -- State
  state TEXT NOT NULL DEFAULT 'firing', -- 'firing', 'resolved', 'acknowledged'
  severity TEXT NOT NULL,

  -- Timing
  started_at INTEGER NOT NULL,
  resolved_at INTEGER,
  acknowledged_at INTEGER,
  acknowledged_by TEXT,

  -- Values
  current_value REAL,
  threshold_value REAL,

  -- Context
  provider TEXT,
  model TEXT,
  labels TEXT,                         -- JSON
  annotations TEXT,                    -- JSON

  -- Notification
  notified INTEGER DEFAULT 0,
  notification_time INTEGER,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_state ON alerts(state, started_at);
CREATE INDEX IF NOT EXISTS idx_alerts_rule ON alerts(rule_id, state);
CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(started_at);

-- =====================================================
-- ALERT HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  state_from TEXT NOT NULL,
  state_to TEXT NOT NULL,
  changed_by TEXT,
  reason TEXT,
  timestamp INTEGER NOT NULL,

  FOREIGN KEY (alert_id) REFERENCES alerts(id)
);

CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON alert_history(alert_id, timestamp);

-- =====================================================
-- COST BUDGETS
-- =====================================================

CREATE TABLE IF NOT EXISTS cost_budgets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Budget settings
  period TEXT NOT NULL,                -- 'daily', 'weekly', 'monthly', 'annual'
  limit_amount REAL NOT NULL,

  -- Scope
  provider TEXT,                       -- NULL = all providers
  model TEXT,                          -- NULL = all models
  user_id TEXT,                        -- NULL = all users

  -- Alerts
  alert_at_50_percent INTEGER DEFAULT 0,
  alert_at_80_percent INTEGER DEFAULT 1,
  alert_at_95_percent INTEGER DEFAULT 1,
  alert_at_exceeded INTEGER DEFAULT 1,

  -- State
  enabled INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  start_date TEXT,                     -- YYYY-MM-DD
  end_date TEXT,                       -- YYYY-MM-DD

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- =====================================================
-- COST PROJECTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS cost_projections (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  projection_date TEXT NOT NULL,       -- Date when projection was made

  -- Projections
  daily_projection REAL,
  weekly_projection REAL,
  monthly_projection REAL,
  annual_projection REAL,

  -- Confidence
  confidence REAL,                     -- 0.0 - 1.0
  low_estimate REAL,                   -- 10th percentile
  high_estimate REAL,                  -- 90th percentile

  -- Breakdown
  by_provider TEXT,                    -- JSON: {claude: X, gemini: Y, openai: Z}
  by_model TEXT,                       -- JSON

  -- Metadata
  days_in_period INTEGER,
  days_remaining INTEGER,
  current_spend REAL,
  projected_spend REAL,

  created_at INTEGER NOT NULL,
  UNIQUE(date, projection_date)
);

CREATE INDEX IF NOT EXISTS idx_cost_projections_date ON cost_projections(date);

-- =====================================================
-- VIEWS
-- =====================================================

-- Recent metrics summary (last hour)
CREATE VIEW IF NOT EXISTS metrics_recent_summary AS
SELECT
  provider,
  COUNT(*) as request_count,
  AVG(latency) as avg_latency,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
  SUM(cost) as total_cost,
  SUM(total_tokens) as total_tokens
FROM metrics_raw
WHERE timestamp > strftime('%s', 'now', '-1 hour') * 1000
GROUP BY provider
ORDER BY request_count DESC;

-- Active alerts summary
CREATE VIEW IF NOT EXISTS alerts_active_summary AS
SELECT
  severity,
  COUNT(*) as count
FROM alerts
WHERE state = 'firing'
GROUP BY severity;

-- Cost summary by provider (today)
CREATE VIEW IF NOT EXISTS cost_today_summary AS
SELECT
  provider,
  SUM(cost) as total_cost,
  COUNT(*) as request_count,
  AVG(cost) as avg_cost_per_request
FROM metrics_raw
WHERE timestamp > strftime('%s', 'now', 'start of day') * 1000
GROUP BY provider
ORDER BY total_cost DESC;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update alert state history
CREATE TRIGGER IF NOT EXISTS update_alert_history
AFTER UPDATE OF state ON alerts
WHEN OLD.state != NEW.state
BEGIN
  INSERT INTO alert_history (id, alert_id, state_from, state_to, timestamp)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    OLD.state,
    NEW.state,
    strftime('%s', 'now') * 1000
  );
END;

-- Auto-update alert updated_at
CREATE TRIGGER IF NOT EXISTS update_alert_timestamp
AFTER UPDATE ON alerts
BEGIN
  UPDATE alerts
  SET updated_at = strftime('%s', 'now') * 1000
  WHERE id = NEW.id;
END;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default alert rules
INSERT OR IGNORE INTO alert_rules (id, name, description, metric, operator, threshold, duration_seconds, severity, enabled, created_at, updated_at)
VALUES
  ('rule_high_latency', 'High Latency', 'Alert when P95 latency exceeds 2 seconds', 'p95_latency', '>', 2000, 300, 'warning', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('rule_error_spike', 'Error Spike', 'Alert when error rate exceeds 5%', 'error_rate', '>', 0.05, 60, 'critical', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('rule_cache_low', 'Low Cache Hit Rate', 'Alert when cache hit rate below 40%', 'cache_hit_rate', '<', 0.40, 600, 'warning', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('rule_cost_high', 'High Cost', 'Alert when hourly cost exceeds $10', 'hourly_cost', '>', 10.0, 300, 'warning', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('rule_rate_limit', 'High Rate Limit Denials', 'Alert when denial rate exceeds 10%', 'rate_limit_denial_rate', '>', 0.10, 300, 'warning', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Insert default monthly budget
INSERT OR IGNORE INTO cost_budgets (id, name, description, period, limit_amount, alert_at_80_percent, alert_at_95_percent, enabled, created_at, updated_at)
VALUES
  ('budget_monthly', 'Monthly Budget', 'Default monthly spending limit', 'monthly', 500.0, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
