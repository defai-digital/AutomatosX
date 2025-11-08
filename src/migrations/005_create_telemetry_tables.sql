-- Migration: 005_create_telemetry_tables
-- Description: Create tables for telemetry and usage analytics
-- Date: 2025-11-07

-- Telemetry events table
CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT, -- JSON data
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indices for fast querying
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events(session_id);

-- Aggregated statistics table (for performance)
CREATE TABLE IF NOT EXISTS telemetry_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stat_date TEXT NOT NULL, -- YYYY-MM-DD format
  stat_type TEXT NOT NULL, -- 'command', 'query', 'error', 'performance'
  stat_key TEXT NOT NULL, -- e.g., command name, error type
  count INTEGER NOT NULL DEFAULT 0,
  total_duration INTEGER DEFAULT 0, -- milliseconds
  avg_duration REAL DEFAULT 0,
  min_duration INTEGER DEFAULT 0,
  max_duration INTEGER DEFAULT 0,
  metadata TEXT, -- JSON for additional data
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Unique constraint on stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_stats_unique
ON telemetry_stats(stat_date, stat_type, stat_key);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_telemetry_stats_date ON telemetry_stats(stat_date);

-- Telemetry configuration table (single row config)
CREATE TABLE IF NOT EXISTS telemetry_config (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Only allow single row
  enabled INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
  remote INTEGER NOT NULL DEFAULT 0, -- Enable remote submission
  session_id TEXT NOT NULL,
  consent_date INTEGER, -- Timestamp when user opted in
  opt_out_date INTEGER, -- Timestamp when user opted out
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
