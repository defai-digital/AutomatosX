# Changelog

All notable changes to AutomatosX are documented here.

## [14.0.1] - 2026-03-24

### Code Refactoring

- Removed checked-in JavaScript duplicates from package source and test trees so TypeScript is the single source of truth
- Kept NodeNext-compatible `.js` import specifiers while moving package publishing to compiled `dist/` outputs
- Added package-local build configs to compile each workspace package in dependency order

### Build System

- Switched package `files`, `exports`, `types`, and CLI `bin` metadata to publish built artifacts from `dist/`
- Added explicit workspace package build scripts and root build orchestration for `contracts`, `workflow-engine`, `state-store`, `trace-store`, `shared-runtime`, `monitoring`, `mcp-server`, and `cli`
- Updated internal package dependency ranges to `^14.0.1`

### Tests

- Added a build-aware process-test helper that only compiles workspace packages when required
- Preserved full regression coverage after the TypeScript-only migration with all 191 tests passing
- Verified package build, typecheck, and runtime process entrypoints against the `14.0.1` workspace version

## [14.0.0] - 2026-03-23

### Features

- Monorepo unification of v11.4 workflow-first UX and v13.5 modular runtime/MCP surface
- Full delegate step execution with INV-DT-001 (max depth) and INV-DT-002 (circular delegation) enforcement
- SQLite backends for state-store and trace-store (WAL mode, FTS5 full-text search, hierarchical traces)
- New CLI commands: ability, feedback, history, iterate, monitor, scaffold, update
- Complete condition evaluation engine with `&&`, `||`, `!`, comparison operators and parentheses grouping
- Prototype pollution protection (INV-WF-SEC-001) in workflow condition evaluation
- After-guard exceptions fail the workflow with structured AFTER_GUARD_ERROR details
- Node.js built-in `node:sqlite` integration (requires Node >=22.5.0)

### Bug Fixes

- WorkflowStep timeout minimum raised from 100ms to 1000ms (RETRY_DELAY_DEFAULT)
- Retry `mapErrorCodeToRetryType` now recognises RATE_LIMITED alias and server_error codes prefixed with '5'
- Package versions aligned to 14.0.0 across all packages
