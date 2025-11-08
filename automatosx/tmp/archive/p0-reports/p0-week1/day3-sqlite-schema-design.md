# Day 3 – SQLite Schema Design for Parser Pipeline

**Author:** Avery (Architecture)  
**Collaborators:** Bob (Backend), Performance Engineer  
**Status:** Draft for Day 3 sync  
**Context:** Enables enriched parser metadata for Tree-sitter, SWC, Semgrep harmonization in AutomatosX v2 memory database.

---

## 1. Design Goals
- Support unified code intelligence queries with consistent symbol metadata across parsers.
- Maintain backwards compatibility for existing CLI commands (`ax find`, `ax def`, `ax flow`) while extending capabilities.
- Ensure write throughput and query latency remain within <10% regression from v1 benchmarks.
- Facilitate incremental parsing by storing parser run metadata and incremental artifacts.

---

## 2. Schema Overview

### 2.1 Core Tables
```sql
-- Tracks known files and their parse freshness
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL,
  hash TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  parser_version TEXT NOT NULL,
  last_parsed_at INTEGER NOT NULL
);

-- Consolidated symbols across parsers
CREATE TABLE symbols (
  id INTEGER PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  signature TEXT,
  origin_mask INTEGER NOT NULL DEFAULT 0, -- bitmask per parser: 1=Tree-sitter,2=SWC,4=Semgrep
  metadata TEXT NOT NULL DEFAULT '{}' -- JSON blob (provenance, confidence scores)
);

-- Call graph edges
CREATE TABLE calls (
  caller_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  callee_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  PRIMARY KEY (caller_symbol_id, callee_symbol_id)
);

-- File-level imports
CREATE TABLE imports (
  id INTEGER PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  specifier TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'static'
);

-- AST chunk storage
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  text TEXT NOT NULL,
  origin TEXT NOT NULL -- parser source for provenance
);

-- Contentless FTS index for chunks
CREATE VIRTUAL TABLE chunks_fts USING fts5 (
  text,
  path UNINDEXED,
  symbol UNINDEXED,
  tokenize='unicode61 remove_diacritics 1'
);

-- Parser error catalog
CREATE TABLE errors (
  id INTEGER PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  parser_id TEXT NOT NULL,
  line INTEGER,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  occurred_at INTEGER NOT NULL
);
```

### 2.2 New Supporting Tables
```sql
-- Tracks each parser invocation for observability
CREATE TABLE parser_runs (
  id INTEGER PRIMARY KEY,
  parser_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0,1)),
  processed_files INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER GENERATED ALWAYS AS (finished_at - started_at) VIRTUAL,
  notes TEXT
);

-- Join table linking parser runs to files (many-to-many)
CREATE TABLE parser_run_files (
  parser_run_id INTEGER NOT NULL REFERENCES parser_runs(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- success, partial, failed, skipped
  PRIMARY KEY (parser_run_id, file_id)
);

-- Stores incremental artifacts per file + parser
CREATE TABLE incremental_artifacts (
  parser_id TEXT NOT NULL,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  artifact BLOB NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (parser_id, file_id)
);

-- Schema version tracker
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT NOT NULL
);
```

---

## 3. Index Strategy & Performance Considerations

| Table | Index | Purpose |
|---|---|---|
| files | `CREATE INDEX idx_files_lang ON files(lang);` | Speeds up language-specific batches |
| files | `CREATE INDEX idx_files_mtime ON files(mtime);` | Accelerates incremental parsing detection |
| symbols | `CREATE INDEX idx_symbols_file ON symbols(file_id);` | Core join path for symbol lookups |
| symbols | `CREATE INDEX idx_symbols_name_kind ON symbols(name, kind);` | `ax find` / `ax def` name queries |
| calls | `CREATE INDEX idx_calls_callee ON calls(callee_symbol_id);` | Reverse lookups for `ax flow` |
| imports | `CREATE INDEX idx_imports_source ON imports(source);` | Dependency resolution queries |
| chunks | `CREATE INDEX idx_chunks_file ON chunks(file_id);` | Retrieval of AST fragments |
| errors | `CREATE INDEX idx_errors_file ON errors(file_id);` | Error drill-down per file |
| parser_runs | `CREATE INDEX idx_parser_runs_parser ON parser_runs(parser_id);` | Telemetry aggregations |
| incremental_artifacts | (implicit PK) | Combine parser/file lookups |

**Write Performance:**  
- Use batched INSERT/REPLACE within transactions.  
- Employ `PRAGMA journal_mode=WAL;` to allow concurrent reads.  
- Keep `chunks.text` trimmed to relevant AST snippet (line-range) to cap DB size.  
- `origin_mask` as integer bitmask avoids extra join tables for provenance.

---

## 4. FTS5 Contentless Design

### 4.1 Virtual Table Configuration
```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,
  path UNINDEXED,
  symbol UNINDEXED,
  content='',
  tokenize='unicode61 remove_diacritics 1'
);
```

### 4.2 Triggers
```sql
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text, path, symbol)
  VALUES (new.id, new.text, (SELECT path FROM files WHERE id = new.file_id), new.node_type);
END;

CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text, path, symbol)
  VALUES('delete', old.id, old.text, NULL, NULL);
END;

CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text, path, symbol)
  VALUES('delete', old.id, old.text, NULL, NULL);
  INSERT INTO chunks_fts(rowid, text, path, symbol)
  VALUES (new.id, new.text, (SELECT path FROM files WHERE id = new.file_id), new.node_type);
END;
```

---

## 5. Migration Strategy

1. **Version Gate:** Introduce schema migration script `db/migrations/0013-parser-upgrade.sql`.  
2. **Backup:** Export current database before migration (`.backup`).  
3. **Online Migration Steps:**  
   - Add new columns to `files` (`size_bytes`, `parser_version`, `last_parsed_at`).  
   - Add `origin_mask` and `metadata` to `symbols`.  
   - Create new tables (`parser_runs`, `parser_run_files`, `incremental_artifacts`).  
   - Rebuild FTS triggers to reference new `chunks` definition.  
4. **Data Backfill:**  
   - Populate `size_bytes` and `parser_version` using existing pipeline metadata (default `v1`).  
   - Set `origin_mask` based on legacy parser (Tree-sitter only → 1).  
5. **Validation:**  
   - Run checksum queries to ensure row counts match pre-migration expectations.  
   - Execute smoke queries (Section 7).  
6. **Schema Version Bump:**  
   - Insert row into `schema_version` table with new version (e.g., 13).  

Rollback plan:  
- Use WAL checkpoint + copy pre-migration backup back in place.  
- Ensure migration is idempotent via existence checks before creation.

---

## 6. Schema Versioning Approach

- Maintain sequential migrations under `db/migrations/`.  
- `schema_version` table records applied scripts with timestamp and summary.  
- Orchestrator checks schema version at startup; if mismatch, prompt migration (automated via CLI flag `ax datastore migrate`).  
- Document ADR if major structural change (e.g., new symbol provenance semantics).

---

## 7. Query Patterns & Optimization Strategies

### 7.1 `ax find <symbol>`
```sql
SELECT s.name, s.kind, f.path, s.start_line, s.signature
FROM symbols s
JOIN files f ON f.id = s.file_id
WHERE s.name = :name
ORDER BY s.origin_mask DESC, f.path;
```
- Use prepared statements; rely on `idx_symbols_name_kind`.

### 7.2 `ax def <symbol>`
```sql
SELECT s.name, s.kind, c.text, f.path, s.start_line, s.end_line
FROM symbols s
JOIN chunks c ON c.file_id = s.file_id
JOIN files f ON f.id = s.file_id
WHERE s.id = :symbolId
AND c.start_line <= s.start_line
AND c.end_line >= s.end_line
ORDER BY c.node_type = 'function_declaration' DESC
LIMIT 1;
```
- Benefit from `idx_chunks_file`.

### 7.3 `ax flow <symbol>`
```sql
SELECT caller.name AS caller, callee.name AS callee, cf.path AS caller_path, tf.path AS callee_path
FROM calls
JOIN symbols caller ON caller.id = calls.caller_symbol_id
JOIN symbols callee ON callee.id = calls.callee_symbol_id
JOIN files cf ON cf.id = caller.file_id
JOIN files tf ON tf.id = callee.file_id
WHERE caller.name = :symbolName
ORDER BY caller.name, callee.name;
```
- Indexes on `calls` ensure performance.

### 7.4 Full-Text Search Snippet
```sql
SELECT path, snippet(chunks_fts, 0, '<mark>', '</mark>', '…', 20) AS excerpt
FROM chunks_fts
WHERE chunks_fts MATCH :query
LIMIT 25;
```
- Contentless FTS reduces duplication.

### 7.5 Freshness Dashboard
```sql
SELECT lang,
       COUNT(*) AS files,
       SUM(CASE WHEN strftime('%s','now') - last_parsed_at > 3600 THEN 1 ELSE 0 END) AS stale_files
FROM files
GROUP BY lang;
```

---

## 8. Performance Considerations
- **Row Size:** Monitor `chunks` growth; consider truncating `text` to 2000 chars upper bound.  
- **Vacuum Schedule:** Run `PRAGMA optimize;` and periodic `VACUUM` (off-hours) to reclaim space.  
- **FTS Maintenance:** Use `INSERT INTO chunks_fts(chunks_fts) VALUES ('optimize');` weekly.  
- **Concurrency:** WAL mode plus busy timeout (5s) avoids writer starvation.  
- **Telemetry:** Mirror parser run IDs in application logs for cross-correlation.

---

## 9. Open Questions
1. Should we promote `metadata` JSON to a separate table for analytics? (Current preference: keep inline for launch.)  
2. Do we need cross-file symbol deduping indices (e.g., unique on `name+lang`)?  
3. How to handle schema downgrade if Semgrep disabled? (Proposal: keep tables; data sparsity acceptable.)  
4. Should we expose `parser_runs` via CLI command (`ax parser status`)?  

> Great architecture is invisible – a disciplined schema keeps intelligence fast, observable, and ready to evolve for decades.
