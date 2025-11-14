-- Migration 009: Backup & Disaster Recovery Tables
-- Phase 5 Week 4: Disaster Recovery

-- Backup metadata
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('full', 'incremental')),
  size INTEGER NOT NULL,
  compressed_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  encryption_enabled INTEGER NOT NULL DEFAULT 0,
  backup_path TEXT NOT NULL,
  metadata TEXT NOT NULL,  -- JSON: dbVersion, recordCount, etc.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'deleted')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  retention_until INTEGER,  -- When this backup can be deleted
  uploaded_to_remote INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_backups_timestamp ON backups(timestamp);
CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(type);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_retention ON backups(retention_until);

-- Backup destinations (local, S3, GCS, etc.)
CREATE TABLE IF NOT EXISTS backup_destinations (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('local', 's3', 'gcs', 'azure')),
  config TEXT NOT NULL,  -- JSON configuration (credentials, paths)
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher priority destinations tried first
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_destinations_enabled ON backup_destinations(enabled);
CREATE INDEX IF NOT EXISTS idx_backup_destinations_priority ON backup_destinations(priority DESC);

-- Backup uploads tracking
CREATE TABLE IF NOT EXISTS backup_uploads (
  id TEXT PRIMARY KEY,
  backup_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'uploading', 'completed', 'failed')),
  uploaded_size INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  FOREIGN KEY (backup_id) REFERENCES backups(id) ON DELETE CASCADE,
  FOREIGN KEY (destination_id) REFERENCES backup_destinations(id)
);

CREATE INDEX IF NOT EXISTS idx_backup_uploads_backup ON backup_uploads(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_uploads_destination ON backup_uploads(destination_id);
CREATE INDEX IF NOT EXISTS idx_backup_uploads_status ON backup_uploads(status);

-- Restore operations log
CREATE TABLE IF NOT EXISTS restore_operations (
  id TEXT PRIMARY KEY,
  backup_id TEXT NOT NULL,
  restore_type TEXT NOT NULL CHECK (restore_type IN ('full', 'point_in_time')),
  target_timestamp INTEGER,  -- For PITR
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  initiated_by TEXT NOT NULL,
  error_message TEXT,
  validation_result TEXT,  -- JSON with validation checks
  FOREIGN KEY (backup_id) REFERENCES backups(id),
  FOREIGN KEY (initiated_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_restore_operations_backup ON restore_operations(backup_id);
CREATE INDEX IF NOT EXISTS idx_restore_operations_status ON restore_operations(status);
CREATE INDEX IF NOT EXISTS idx_restore_operations_started ON restore_operations(started_at);

-- WAL (Write-Ahead Log) archive for PITR
CREATE TABLE IF NOT EXISTS wal_archives (
  id TEXT PRIMARY KEY,
  sequence_number INTEGER NOT NULL UNIQUE,
  start_lsn TEXT NOT NULL,  -- Log Sequence Number
  end_lsn TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  archived_at INTEGER NOT NULL,
  retention_until INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wal_archives_sequence ON wal_archives(sequence_number);
CREATE INDEX IF NOT EXISTS idx_wal_archives_retention ON wal_archives(retention_until);

-- Insert default local backup destination
INSERT OR IGNORE INTO backup_destinations (
  id, name, type, config, enabled, priority, created_at, updated_at
) VALUES (
  'dest_local',
  'Local Backup Directory',
  'local',
  '{"path": ".automatosx/backups/"}',
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);
