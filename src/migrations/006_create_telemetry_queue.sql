-- Migration: 006_create_telemetry_queue
-- Description: Create table for remote telemetry submission queue
-- Date: 2025-11-07

-- Telemetry submission queue table
-- Tracks events waiting to be submitted to remote server
CREATE TABLE IF NOT EXISTS telemetry_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  queued_at INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  next_retry_at INTEGER, -- Null if ready to submit, otherwise timestamp of next retry
  last_error TEXT, -- Error message from last submission attempt
  FOREIGN KEY (event_id) REFERENCES telemetry_events(id) ON DELETE CASCADE
);

-- Index for finding events ready to submit (next_retry_at is null or in the past)
CREATE INDEX IF NOT EXISTS idx_telemetry_queue_next_retry ON telemetry_queue(next_retry_at);

-- Index for queuing time (for FIFO ordering)
CREATE INDEX IF NOT EXISTS idx_telemetry_queue_queued_at ON telemetry_queue(queued_at);

-- Index for finding events by retry count (for debugging/monitoring)
CREATE INDEX IF NOT EXISTS idx_telemetry_queue_retry_count ON telemetry_queue(retry_count);
