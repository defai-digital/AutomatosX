-- 004_performance_indices.sql
-- Add performance optimization indices for common query patterns

-- Covering index for symbol searches
-- Includes all fields commonly needed in search results
-- Allows index-only scans without touching the main table
CREATE INDEX IF NOT EXISTS idx_symbols_search_covering
  ON symbols(name, kind, file_id, line, end_line);

-- Index for file language filtering
-- Speeds up queries like: WHERE language = 'typescript'
CREATE INDEX IF NOT EXISTS idx_files_language
  ON files(language);

-- Composite index for language + path lookups
-- Speeds up: WHERE language = ? AND path LIKE ?
CREATE INDEX IF NOT EXISTS idx_files_language_path
  ON files(language, path);

-- Index for chunk type queries
-- Speeds up filtering by chunk_type (e.g., 'symbol', 'context')
CREATE INDEX IF NOT EXISTS idx_chunks_type_file
  ON chunks(chunk_type, file_id);

-- Index for symbol_id lookups in chunks
-- Speeds up joining chunks with symbols
CREATE INDEX IF NOT EXISTS idx_chunks_symbol_id
  ON chunks(symbol_id) WHERE symbol_id IS NOT NULL;

-- Composite index for file + line lookups
-- Speeds up: WHERE file_id = ? AND line BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_chunks_file_lines
  ON chunks(file_id, start_line, end_line);

-- Update SQLite query planner statistics
-- This helps SQLite choose better query plans
ANALYZE;
