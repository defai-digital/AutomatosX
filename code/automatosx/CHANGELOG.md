# Changelog

All notable changes to AutomatosX are documented here.

## [14.0.3] - 2026-04-05

### Bug Fixes

- **cli/monitor:** Activity tab sort comparator no longer returns `NaN` when a trace has a missing or unparseable `startedAt`. Invalid timestamps are coerced to `0` so the sort order stays stable and traces with bad data do not scramble the list. (`monitor-dashboard-script-tabs.ts:16`)
- **cli/monitor:** Activity tab empty state now distinguishes "no runs recorded yet" from "runs exist but were filtered out". Previously the empty body always showed the first-run onboarding hint (`No workflow runs yet. Try ax ship ...`) even when the user had narrowed the view down with workflow/search/time filters — now filtered-empty states show `No runs match the current filters. Try widening the time window, clearing the search, or switching the workflow.` instead. (`monitor-dashboard-script-tabs.ts:78`)
- **cli/monitor:** Activity tab workflow dropdown is now built from traces inside the current time window (and sorted), so users can no longer select workflows whose only runs fall outside the selected window and end up staring at an empty list. (`monitor-dashboard-script-tabs.ts:29`)
- **shared-runtime (workflow resume):** `runWorkflow` now rejects resume requests that provide `priorStepOutputs` or `resumeFromStepIndex` without a `checkpointWorkflowHash` (`CHECKPOINT_HASH_REQUIRED`). Previously the drift check was silently skipped in that shape, which allowed stale cached outputs to be replayed against a modified workflow definition. The CLI `ax resume` path already supplies the hash, so this closes an API misuse hole for MCP / library consumers.
- **shared-runtime (workflow resume):** `runWorkflow` now rejects resume requests whose `resumeFromStepIndex` is negative or past the end of the loaded workflow (`CHECKPOINT_RESUME_INDEX_OUT_OF_RANGE`). Previously an out-of-range index could silently cause every step to be treated as cached or to execute from the start without flagging the inconsistency to the caller.

### Tests

- Added two new `runtime-workflow-runner-service` tests covering the missing-hash and out-of-range resume rejections. Suite: 50 files, 424 tests (up from 422), all green. Typecheck + build clean.

### Build System

- Bumped root + all 8 workspace packages (`contracts`, `workflow-engine`, `state-store`, `trace-store`, `shared-runtime`, `monitoring`, `mcp-server`, `cli`) from `14.0.2` to `14.0.3`, and updated internal `@defai.digital/*` dependency ranges to `^14.0.3`.

## [14.0.2] - 2026-04-05

### Bug Fixes

- **monitor (cli):** Activity tab filter-pill counts now honor the active workflow, search, and time-window filters. Previously the pills showed totals from the entire trace set, so users could see "All (30)" while the list below rendered an empty state because those 30 runs fell outside the current 7-day window. Pill counts now match the runs that would actually render if the pill were selected.
- **tests (cli):** Monitor command test fixtures that relied on absolute `2026-03-24` timestamps are now pinned relative to `Date.now()` so they stop aging out of the default 7-day activity window.

### Features

- **workflow-engine:** Workflow resume + checkpointing. Added `WorkflowRunner.resumeFromStepIndex` / `priorStepOutputs` config, a new `checkpoint.ts` module with deterministic `computeWorkflowHash`, `buildCheckpointRecord`, `validateCheckpoint`, and `isCheckpointOrdered` helpers guarding INV-CP-001 (checkpoint data integrity) and INV-CP-002 (monotonic step-index ordering). Workflow steps gain an optional `noCache: boolean` field to opt individual steps out of cached replay on resume.
- **contracts:** New `CheckpointRecordSchema` / `CheckpointRecord` type as the single source of truth for checkpoint payloads across workflow-engine, shared-runtime, and trace-store.
- **trace-store (sqlite):** Persists checkpoint state via new `checkpoint_step_index`, `checkpoint_step_id`, `checkpoint_at`, `workflow_hash`, and `checkpoint_outputs` columns on `trace_records`, with online migration from prior schemas.
- **mcp-server:** Exposes `STABLE_V15_MCP_TOOL_FAMILIES`, `LEGACY_MCP_TOOL_ALIASES`, and `DEFAULT_SETUP_MCP_TOOL_FAMILIES` constants so the CLI `setup` flow and future v15 surface manifests share one authoritative list of stable tool families vs. legacy aliases.
- **cli:** New `ax resume` pathway for workflow continuation, plus extracted support modules (`doctor-support`, `monitor-support`, `project-bootstrap-support`, `setup-support`) that let the main command files stay thin while consolidating shared workflow logic.
- **cli (product surface):** Added `product-surface-summary`, `v15-surface-registry` tests, and `product-surface-contract` tests that lock in the stable v15 CLI/MCP surface ahead of the v15 deprecation window. New docs: `docs/ax-trust-overview.md` and `docs/v15-surface-deprecation-matrix.md`.

### Code Refactoring

- **shared-runtime:** Published dedicated runtime domain entrypoints (`governance`, trace analysis, workflow runner service) so downstream consumers import narrower subpaths instead of the whole barrel. New `runtime-workflow-runner-service` helpers centralise checkpoint wiring between the workflow engine and trace store. Follow-up to the `contract runtime surface` / `split governance exports` commits already on this branch.
- **cli (monitor dashboard):** Split the monitor dashboard script into focused modules (`overview`, `tabs`, `shared`, `navigation`, `actions`, and per-entity `detail-*` files) so each tab owns its own render logic. No behaviour change beyond the activity-tab bug fix above.
- **cli (json helpers):** Extracted `json-file-write` and `json-object-file` helpers for consistent atomic writes across CLI commands that persist state.
- **docs cleanup:** Removed in-flight planning docs (`TODO/*`, `automatosx/adr/0001-*`, `automatosx/prd/ax-bridge-*`, `automatosx/todo/*`, `docs/governance-migration-note.md`, `docs/governance-upstream-sync-note.md`) whose contents have been absorbed into shipped code, the AX Trust overview, or the v15 deprecation matrix.

### Build System

- Bumped root package and all eight workspace packages (`contracts`, `workflow-engine`, `state-store`, `trace-store`, `shared-runtime`, `monitoring`, `mcp-server`, `cli`) from `14.0.1` to `14.0.2`, and updated internal `@defai.digital/*` dependency ranges to `^14.0.2`.

### Tests

- Full suite passes: 50 test files, 422 tests green on Node 22.5+. Typecheck clean. Covers the new checkpoint/resume paths, the monitor activity filter fix, the v15 surface registry contract, and the published shared-runtime subpath entrypoints.

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
