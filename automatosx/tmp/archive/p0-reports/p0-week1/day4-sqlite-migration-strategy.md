# SQLite Migration Strategy (P0 Sprint 1)

## 1. Goals
- Provide deterministic, auditable schema evolution for new SQLite-backed services.  
- Enable fast local iteration while preserving parity with staging and eventual production environments.  
- Align with P0 success criteria: migrations runnable locally and in staging with checksum validation and rollback safety.

## 2. Naming Convention
- Use UTC timestamp prefix with 24-hour format followed by short slug:  
  `YYYYMMDDHHMM_<summary>.sql` (e.g., `202501181015_create-session-tables.sql`).  
- Store migration files under `migrations/sqlite/`.  
- Maintain an index manifest (`migrations/sqlite/_manifest.json`) to track order and checksums.

## 3. Migration Script Structure
Each SQL file should include:
```sql
-- migration: 202501181015_create-session-tables
-- created_by: bob
-- created_on: 2025-01-18T10:15:00Z

BEGIN TRANSACTION;

-- Up migration statements
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
```
Down migrations are supplied either inline (separate section) or via paired file:
- Prefer paired files with suffix `_down.sql` for clarity:  
  `202501181015_create-session-tables.sql` and `202501181015_create-session-tables_down.sql`.

## 4. Checksum Validation
- Compute SHA-256 checksum for each migration file and record it in the manifest:  
  ```json
  {
    "id": "202501181015_create-session-tables",
    "file": "202501181015_create-session-tables.sql",
    "checksum": "e3b0c44298...",
    "applied_at": null
  }
  ```
- The migration runner compares stored checksum against database metadata table `migration_history`.  
- Diverging checksums break execution and require explicit override by the Release Manager after root-cause analysis.

## 5. Up/Down Execution Patterns
- Use a lightweight TypeScript or ReScript runner (`scripts/sqlite-migrate.ts`) that:  
  1. Opens SQLite connection using `better-sqlite3` or equivalent.  
  2. Wraps each migration in a transaction with `BEGIN IMMEDIATE`.  
  3. Logs progress and updates `migration_history` table with `id`, `applied_at`, `checksum`, and `runtime_ms`.  
  4. Supports `up`, `down`, and `status` commands.  
- Down migrations run in reverse chronological order; each file must fully revert schema changes introduced by its counterpart.  
- Reserve destructive down migrations for non-production environments; production rollbacks rely on restore-from-backup strategy (see Section 6).

## 6. Rollback Procedures & Safety
- **Non-production:** Execute down migrations via runner, validate schema parity with snapshot tests.  
- **Production/Staging:**  
  - Prior to applying migrations, capture database backup (`.db` copy or logical export).  
  - In failure scenarios, restore from backup and re-run successful migrations.  
  - Maintain runbook with decision tree (rollback vs. hot-fix).  
- All rollbacks require Release Manager and Avery approval when impacting customer data.

## 7. Testing Migrations
- **Local:**  
  ```bash
  pnpm migrate:sqlite up --env local
  pnpm migrate:sqlite status
  pnpm migrate:sqlite down --to 202501181015_create-session-tables
  ```
  - Integrate with Vitest snapshot tests verifying schema (e.g., introspecting `sqlite_master`).  
  - Seed data via fixtures to ensure migrations handle real-world states.
- **CI:**  
  - GitHub Actions job executes `pnpm migrate:sqlite up --env ci` against ephemeral database.  
  - Post-run, export schema using `sqlite3 .schema` and compare against expected baseline.  
  - Fail build on checksum mismatch or unapplied migrations.

## 8. Execution Order & Dependency Handling
- Runner loads manifest sorted by timestamp to guarantee deterministic execution.  
- Each migration declares dependencies (optional) via manifest:
  ```json
  {
    "id": "202501201200_add-indexes",
    "depends_on": ["202501181015_create-session-tables"]
  }
  ```
- If dependencies are unmet, runner halts with actionable error.  
- Avoid long dependency chains by combining related schema changes or using feature flags in application logic.

## 9. Schema Version Tracking
- Introduce `migration_history` table:
  ```sql
  CREATE TABLE IF NOT EXISTS migration_history (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at DATETIME NOT NULL,
    runtime_ms INTEGER NOT NULL DEFAULT 0
  );
  ```
- Application code reads latest version to enforce startup checks (fail fast if pending migrations exist in mandatory environments).  
- Publish schema version via operational metrics (e.g., `sqlite_schema_version` gauge) for visibility.

## 10. Governance & Documentation
- Require code review from Avery or delegate for every migration touching core data structures.  
- Attach migration rationale to ADR updates or sprint notes.  
- Release Manager maintains changelog summarizing applied migrations per deployment.  
- Store runbooks under `automatosx/PRD/` for permanent reference.
