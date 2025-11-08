-- 001_create_files_table.sql
-- Initial migration: Create files table for storing indexed code files

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  language TEXT,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index on path for fast lookups
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);

-- Index on hash for deduplication
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);

-- Index on language for filtering
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
