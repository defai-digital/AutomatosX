-- Migration 015: Create strategy_telemetry table for Iterate Mode
-- This table tracks strategy effectiveness for data-driven optimization

CREATE TABLE IF NOT EXISTS strategy_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_name TEXT NOT NULL,
  task_id TEXT NOT NULL,
  failure_type TEXT NOT NULL,
  success INTEGER NOT NULL CHECK(success IN (0, 1)),
  execution_time INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index on strategy_name for per-strategy analytics
CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_name
ON strategy_telemetry(strategy_name);

-- Index on failure_type for pattern analysis
CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_failure
ON strategy_telemetry(failure_type);

-- Index on timestamp for temporal analysis
CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_timestamp
ON strategy_telemetry(timestamp);

-- Index on task_id for per-task tracking
CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_task
ON strategy_telemetry(task_id);

-- Composite index for success rate queries
CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_success_rate
ON strategy_telemetry(strategy_name, success);
