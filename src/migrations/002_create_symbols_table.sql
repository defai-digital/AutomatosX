-- 002_create_symbols_table.sql
-- Create symbols table for storing extracted code symbols

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  line INTEGER NOT NULL,
  column INTEGER NOT NULL,
  end_line INTEGER,
  end_column INTEGER,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Index on file_id for fast lookup by file
CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols(file_id);

-- Index on name for fast symbol search
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);

-- Index on kind for filtering by symbol type
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);

-- Composite index for name + kind queries
CREATE INDEX IF NOT EXISTS idx_symbols_name_kind ON symbols(name, kind);
