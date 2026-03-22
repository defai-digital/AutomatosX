# v14 Migration Tracker

## Field Definitions
- `ticketId`
- `status`: `not_started | in_progress | blocked | done`
- `owner`
- `startDate`
- `endDate`
- `dependencies`
- `notes`
- `verification`

## Current Entries

### `V14-101`
- `status`: `done`
- `owner`: `Product + Architecture`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-22`
- `dependencies`: `none`
- `notes`: Migration mapping and ownership map completed in [mapping.md](./mapping.md).
- `verification`: PRD/ADR/mapping alignment reviewed; workflow command mapping table and ownership section present.

### `V14-102`
- `status`: `done`
- `owner`: `Platform`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-101`
- `notes`: Adapter boundary is implemented in [workflow-command-adapter-contract.md](./workflow-command-adapter-contract.md), [workflow-adapter.ts](../../packages/cli/src/workflow-adapter.ts), and runtime bridge code. Sprint 1 exit-gate decisions have been resolved in [sprint-1-exit-decisions.md](./sprint-1-exit-decisions.md).
- `verification`: Adapter boundary contract exists; no workflow command handler bypasses the shared adapter in current v14 CLI migration code; adapter and runtime-backed tests pass.

### `V14-102-a`
- `status`: `done`
- `owner`: `CLI + Workflow Engine`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-102`
- `notes`: Runtime bridge wired through [run.ts](../../packages/cli/src/commands/run.ts) and local workflow-engine package.
- `verification`: Runtime-backed acceptance suite in [workflow-runtime-bridge.test.ts](../../tests/migration/workflow-runtime-bridge.test.ts) passes.

### `V14-103`
- `status`: `done`
- `owner`: `PM + Engineering`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-101`
- `notes`: Status board and migration tracker are active, and Sprint 1 exit decisions are explicitly recorded in [sprint-1-exit-decisions.md](./sprint-1-exit-decisions.md).
- `verification`: [v14-implementation-plan-status.md](../v14-implementation-plan-status.md), [mapping.md](./mapping.md), and this tracker are updated to current state.

### `V14-104`
- `status`: `done`
- `owner`: `QA`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-102`, `V14-102-a`
- `notes`: Compatibility harness, migration matrix, runtime-bridge tests, and direct engine tests are in place.
- `verification`: `npm test` passes with adapter tests, migration compatibility tests, runtime-backed acceptance tests, and workflow-engine tests green.

### `V14-105`
- `status`: `done`
- `owner`: `Platform`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-104`
- `notes`: Workspace metadata, scripts, lockfile, package metadata, and the `contracts/workflow-engine` workflow surface are now aligned to the `13.5` baseline used for Sprint 1 acceptance.
- `verification`: [package.json](../../package.json), [package-lock.json](../../package-lock.json), [tsconfig.json](../../tsconfig.json), [vitest.config.ts](../../vitest.config.ts), [packages/contracts/src/workflow/v1](../../packages/contracts/src/workflow/v1), and [packages/workflow-engine/src](../../packages/workflow-engine/src) all pass `npm run typecheck` and `npm test`.

### `V14-201`
- `status`: `done`
- `owner`: `CLI`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-102`
- `notes`: First-class workflow command definitions are registered in [workflows.ts](../../packages/cli/src/commands/workflows.ts) and exported via [index.ts](../../packages/cli/src/commands/index.ts).
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts) confirms `ship` and `architect` are registered as stable command-layer entrypoints.

### `V14-202`
- `status`: `done`
- `owner`: `CLI + Core`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-201`
- `notes`: First-class workflow commands route through the shared workflow adapter and runtime bridge instead of direct provider code paths.
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts), [workflow-runtime-bridge.test.ts](../../tests/migration/workflow-runtime-bridge.test.ts), and [workflow-adapter.ts](../../packages/cli/src/workflow-adapter.ts) confirm dispatch goes through the shared adapter/runtime path.

### `V14-203`
- `status`: `done`
- `owner`: `CLI`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-202`
- `notes`: `--dry-run` now flows through the command-layer dispatch path so preview mode remains side-effect-safe while still generating preview artifacts.
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts) and [workflow-compatibility.test.ts](../../tests/migration/workflow-compatibility.test.ts) confirm preview status and preview artifacts.

### `V14-204`
- `status`: `done`
- `owner`: `Workflow engine`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-202`
- `notes`: Artifact contract is preserved across first-class commands and adapter/runtime paths with `manifest.json`, `summary.json`, and placeholder markdown artifacts.
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts), [workflow-compatibility.test.ts](../../tests/migration/workflow-compatibility.test.ts), and [workflow-runtime-bridge.test.ts](../../tests/migration/workflow-runtime-bridge.test.ts) all assert artifact outputs.

### `V14-205`
- `status`: `done`
- `owner`: `Trace domain`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-202`
- `notes`: First-class command handlers now propagate `options.traceId` into the shared workflow adapter so command responses and artifacts carry the same trace identifier.
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts), [workflow-adapter.test.ts](../../packages/cli/tests/workflow-adapter.test.ts), and [workflow-runtime-bridge.test.ts](../../tests/migration/workflow-runtime-bridge.test.ts) confirm trace reuse and response propagation.

### `V14-301`
- `status`: `done`
- `owner`: `Workflow + CLI`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-201`, `V14-202`
- `notes`: `audit` is now promoted to a stable first-class workflow command entrypoint.
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts) and [workflow-compatibility.test.ts](../../tests/migration/workflow-compatibility.test.ts) verify dispatch, artifacts, and trace propagation for `audit`.

### `V14-302`
- `status`: `done`
- `owner`: `Workflow + CLI`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-201`, `V14-202`
- `notes`: `qa` is now promoted to a stable first-class workflow command entrypoint.
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts) and [workflow-compatibility.test.ts](../../tests/migration/workflow-compatibility.test.ts) verify dispatch, artifacts, and trace propagation for `qa`.

### `V14-303`
- `status`: `done`
- `owner`: `Workflow + CLI`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-201`, `V14-202`
- `notes`: `release` is now promoted to a stable first-class workflow command entrypoint.
- `verification`: [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts) and [workflow-compatibility.test.ts](../../tests/migration/workflow-compatibility.test.ts) verify dispatch, artifacts, and trace propagation for `release`.

### `V14-304`
- `status`: `done`
- `owner`: `Docs + CLI UX`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-301`, `V14-302`, `V14-303`
- `notes`: Workflow-first help text and quickstart guidance now exist in the CLI help command and root README.
- `verification`: [help.ts](../../packages/cli/src/commands/help.ts), [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts), and [README.md](../../README.md) all show the workflow-first default story.

### `V14-305`
- `status`: `done`
- `owner`: `QA`
- `startDate`: `2026-03-22`
- `endDate`: `2026-03-22`
- `dependencies`: `V14-301`, `V14-302`, `V14-303`
- `notes`: The direct command-layer matrix now covers all five workflow commands, and compatibility tests still validate the full artifact-state matrix.
- `verification`: `npm run typecheck` and `npm test` pass with [workflow-commands.test.ts](../../packages/cli/tests/workflow-commands.test.ts), [workflow-compatibility.test.ts](../../tests/migration/workflow-compatibility.test.ts), and [workflow-runtime-bridge.test.ts](../../tests/migration/workflow-runtime-bridge.test.ts) green.

## Sprint 1 Blockers Before Sprint 2
- None open. Sprint 1 is complete and Sprint 2 can start from the verified baseline.

## Sprint 2 Blockers Before Sprint 3
- None open. Sprint 2 is complete and Sprint 3 can start from the verified command-layer baseline.

## Sprint 3 Blockers Before Sprint 4
- None open. Sprint 3 is complete and Sprint 4 can start from the verified five-workflow baseline.

### `V14-401`
- `status`: `done`
- `owner`: `Platform + MCP`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-305`
- `notes`: Added a shared runtime surface in [packages/shared-runtime/src/index.ts](../../packages/shared-runtime/src/index.ts) and rewired the generic CLI run path in [run.ts](../../packages/cli/src/commands/run.ts) to use it.
- `verification`: [shared-runtime.test.ts](../../packages/shared-runtime/tests/shared-runtime.test.ts), [workflow-runtime-bridge.test.ts](../../tests/migration/workflow-runtime-bridge.test.ts), `npm run typecheck`, and `npm test` all pass.

### `V14-402`
- `status`: `done`
- `owner`: `Trace + Storage`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-401`
- `notes`: Introduced a shared file-backed trace store in [packages/trace-store/src/index.ts](../../packages/trace-store/src/index.ts) and routed CLI, MCP, and monitoring through the same trace semantics.
- `verification`: [dashboard.test.ts](../../packages/monitoring/tests/dashboard.test.ts), [mcp-server.test.ts](../../packages/mcp-server/tests/mcp-server.test.ts), and `npm test` confirm CLI and MCP traces are visible from one store.

### `V14-403`
- `status`: `done`
- `owner`: `Memory + Config`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-401`
- `notes`: Added a shared state store in [packages/state-store/src/index.ts](../../packages/state-store/src/index.ts) and exposed memory/policy APIs through the shared runtime and MCP surface.
- `verification`: [shared-runtime.test.ts](../../packages/shared-runtime/tests/shared-runtime.test.ts), [mcp-server.test.ts](../../packages/mcp-server/tests/mcp-server.test.ts), `npm run typecheck`, and `npm test` all pass.

### `V14-404`
- `status`: `done`
- `owner`: `QA`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-401`, `V14-402`, `V14-403`
- `notes`: Added MCP regression coverage in [packages/mcp-server/tests/mcp-server.test.ts](../../packages/mcp-server/tests/mcp-server.test.ts) for workflow, trace, memory, policy, and dashboard tool paths.
- `verification`: `npm test` passes with the MCP suite green and no skipped Sprint 4 tests.

### `V14-405`
- `status`: `done`
- `owner`: `Monitoring + CLI`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-402`, `V14-404`
- `notes`: Added monitoring visibility in [packages/monitoring/src/index.ts](../../packages/monitoring/src/index.ts) and validated that CLI and MCP workflow traces appear in the same dashboard surface.
- `verification`: [dashboard.test.ts](../../packages/monitoring/tests/dashboard.test.ts), `npm run typecheck`, and `npm test` pass.

## Sprint 4 Blockers Before Sprint 5
- None open. Sprint 4 is complete and Sprint 5 can start from the verified shared runtime, trace store, and MCP baseline.

### `V14-501`
- `status`: `done`
- `owner`: `Agents + Storage`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-403`
- `notes`: Added idempotent agent registration and uniqueness enforcement in [packages/state-store/src/index.ts](../../packages/state-store/src/index.ts), exposed it through [packages/shared-runtime/src/index.ts](../../packages/shared-runtime/src/index.ts), and added MCP support in [packages/mcp-server/src/index.ts](../../packages/mcp-server/src/index.ts).
- `verification`: [state-store.test.ts](../../packages/state-store/tests/state-store.test.ts), [shared-runtime.test.ts](../../packages/shared-runtime/tests/shared-runtime.test.ts), and [mcp-server.test.ts](../../packages/mcp-server/tests/mcp-server.test.ts) pass.

### `V14-502`
- `status`: `done`
- `owner`: `Discussion + Resilience`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-401`
- `notes`: Added bounded discussion-provider budgets, bounded round counts, and queue-aware concurrent discussion handling in [packages/shared-runtime/src/index.ts](../../packages/shared-runtime/src/index.ts).
- `verification`: [shared-runtime.test.ts](../../packages/shared-runtime/tests/shared-runtime.test.ts), `npm run typecheck`, and `npm test` pass.

### `V14-503`
- `status`: `done`
- `owner`: `Platform`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-401`, `V14-402`, `V14-403`
- `notes`: The promoted runtime path is now shared-runtime-backed for CLI and MCP, and storage mutations are centralized at the file-backed store layer instead of ad hoc surface logic.
- `verification`: [run.ts](../../packages/cli/src/commands/run.ts), [shared-runtime/src/index.ts](../../packages/shared-runtime/src/index.ts), and the full test suite confirm the shared orchestration path.

### `V14-504`
- `status`: `done`
- `owner`: `Docs + PM`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-503`
- `notes`: Finalized release-facing docs and migration guidance in [README.md](../../README.md) and [v14-migration-guide.md](../v14-migration-guide.md).
- `verification`: Docs reflect workflow-first entry paths, advanced-surface guidance, shared-store expectations, and verification commands.

### `V14-505`
- `status`: `done`
- `owner`: `QA + Tech Lead`
- `startDate`: `2026-03-21`
- `endDate`: `2026-03-21`
- `dependencies`: `V14-501`, `V14-502`, `V14-503`, `V14-504`
- `notes`: Release dry run recorded in [v14-release-dry-run.md](../v14-release-dry-run.md).
- `verification`: `npm run typecheck` and `npm test` pass with `11` files and `42` tests green; PRD Section 11 release gates are satisfied.

## Sprint 5 Blockers Before Release
- None open. Sprint 5 is complete and v14 is release-ready against the current migration plan.
