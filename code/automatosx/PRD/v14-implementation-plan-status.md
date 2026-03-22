# v14 Implementation Status

Last Updated: 2026-03-22

## Legend
- `not_started` — ready to schedule
- `in_progress` — assigned and actively being worked
- `blocked` — waiting on dependency or decision
- `done` — complete and verified by PRD release gate

## Current Phase
- `Sprint 1 (Foundation and migration scaffolding)` — `done`
- `Sprint 2 (Workflow command layer)` — `done`
- `Sprint 3 (Workflow expansion)` — `done`
- `Sprint 4 (MCP and shared runtime convergence)` — `done`
- `Sprint 5 (Hardening and release)` — `done`

## Sprint 1 Board

### Done
- `V14-101` — Migration inventory and ownership map (`done`)
- `V14-102` — Define adapter boundaries for CLI→workflow runtime (`done`)
- `V14-102-a` — Wire adapter dispatch to 13.5 runtime bridge (`done`)
- `V14-103` — Add v14 migration tracker (`done`)
- `V14-104` — Baseline harness for compatibility tests (`done`)
- `V14-105` — Baseline environment lock (`done`)

## Current Blocker
- No open blocker. Sprint 5 hardening and release dry run are complete.

## Current Implementation Notes
- Scope scaffold is in place for `packages/cli/src/workflow-adapter.ts`, `packages/cli/src/commands/workflows.ts`, and `packages/cli/tests/workflow-adapter.test.ts`.
- `packages/cli/src/commands/run.ts` now resolves and invokes the 13.5-style runtime path when dependencies are available, and returns explicit action-guiding errors when runtime wiring is incomplete.
- Added a local workspace/test scaffold (`package.json`, `tsconfig.json`, `vitest.config.ts`) plus local `@defai.digital/contracts` and `@defai.digital/workflow-engine` packages.
- Replaced the one-file temporary workflow engine with a 13.5-shaped slice (`loader`, `runner`, `validation`, `retry`, `executor`, `types`) and local contract schemas.
- Added a 13.5-shaped workflow contract module (`packages/contracts/src/workflow/v1`) and exported `safeValidateWorkflow` from the local contracts package.
- Added a production-shaped `createRealStepExecutor` bridge to the local workflow engine to reduce friction for the eventual 13.5 package swap.
- Wired `packages/cli/src/commands/run.ts` to prefer the production-shaped executor path (`createRealStepExecutor`) instead of always falling back to `defaultStepExecutor`.
- Added runtime bridge coverage for prompt, tool, and discuss step execution through the generic `run` command.
- Added `13.5` step-guard contracts and workflow-engine support (`packages/contracts/src/workflow/v1/step-guard.ts`, `packages/workflow-engine/src/step-guard.ts`) plus runner-level guard blocking behavior.
- Aligned workspace and package metadata with the `13.5` baseline (`version`, `engines`, `build/typecheck` scripts, package-level metadata).
- Registered first-class workflow command definitions in `packages/cli/src/commands/workflows.ts` and exported them through `packages/cli/src/commands/index.ts`.
- Updated the first-class workflow command path so `--dry-run` flows through `dispatch()` and preserves `manifest.json` / `summary.json` preview artifacts instead of bypassing the artifact contract with `preview()` only.
- Promoted `audit`, `qa`, and `release` to stable first-class workflow commands in the command registry.
- Added workflow-first help and quickstart surfaces in `packages/cli/src/commands/help.ts` and `README.md`.
- Added direct command-layer coverage for all five workflow commands plus help/quickstart in `packages/cli/tests/workflow-commands.test.ts`.
- Added additional adapter harness assertions for dry-run status/trace behavior in `packages/cli/tests/workflow-adapter.test.ts`.
- Added migration compatibility matrix coverage in `tests/migration/workflow-compatibility.test.ts` for preview, dispatched, and failed artifact-state contracts across all five workflow commands.
- Added runtime-backed migration coverage in `tests/migration/workflow-runtime-bridge.test.ts` against local workflow definitions under `workflows/`.
- Added direct workflow-engine validation/loader and step-guard coverage in `packages/workflow-engine/tests/`.
- Added shared runtime/store packages for Sprint 4 convergence: `packages/shared-runtime`, `packages/trace-store`, `packages/state-store`, `packages/mcp-server`, and `packages/monitoring`.
- Rewired `packages/cli/src/commands/run.ts` to use the shared runtime service and shared trace store instead of a CLI-only runner path.
- Fixed the adapter/runtime seam so `outputDir` propagates through `toRunOptions()` and CLI traces land in the same shared store base path used by monitoring and MCP.
- Added Sprint 4 test coverage in `packages/shared-runtime/tests/shared-runtime.test.ts`, `packages/mcp-server/tests/mcp-server.test.ts`, and `packages/monitoring/tests/dashboard.test.ts`.
- Hardened the file-backed state and trace stores with serialized writes and atomic temp-file promotion.
- Added idempotent agent registration with uniqueness enforcement in `packages/state-store`, shared-runtime exposure, and MCP tools.
- Hardened discussion execution with bounded provider budgets, bounded rounds, and queue-aware stress coverage in `packages/shared-runtime`.
- Added Sprint 5 hardening coverage in `packages/state-store/tests/state-store.test.ts` and `packages/trace-store/tests/trace-store.test.ts`.
- Finalized migration/release docs in `README.md`, `PRD/v14-migration-guide.md`, and `PRD/v14-release-dry-run.md`.
- Added post-release hardening for trace analysis and session correlation across CLI, shared runtime, and MCP surfaces.
- Added a configurable provider subprocess bridge for shared-runtime prompt and discussion execution, with deterministic simulation fallback when no executor is configured.
- Added first-class `ax config` and `ax cleanup` commands plus shared-runtime / MCP stale-trace cleanup support (`trace.close_stuck`).
- Added explicit simulation warnings for `ax discuss`, a v14-native `guard` surface across CLI/MCP/shared-runtime, and pragmatic `iterate` / `resume` command support.
- Added direct provider invocation via `ax call`, operator runtime visibility via `ax status`, and shared-runtime support for `git diff` inspection.
- Expanded the MCP filesystem/tooling surface with `file.exists`, `file.write`, `directory.create`, and `git.diff`.
- Deepened the guard system with a built-in `safe-filesystem` policy and real enforcement gates for path violations, change radius, sensitive paths, and secret leakage.
- Expanded `ax call` with bounded autonomy mode (`--autonomous`, intent-aware rounds, goal targeting, and `--require-real`) and strengthened provider execution with opt-in native CLI adapter presets plus richer bridge protocols.
- Verified locally with `npm run typecheck` and `npm test`: 15 files passed, 111 tests passed.
- Resolved Sprint 1 exit-gate decisions in `PRD/migration/sprint-1-exit-decisions.md`.
- Consolidated PRD folder structure so the active set is `PRD-001`, implementation plan, implementation status, and migration reference docs; superseded planning snapshots moved to `PRD/archive/`.
- Sprint 1 through Sprint 5 exit gates are satisfied; v14 is release-ready against the current PRD gates.

## Sprint 2 Board

### Done
- `V14-201` — Add workflow command registry (`done`)
- `V14-202` — Implement workflow dispatch adapter (`done`)
- `V14-203` — Implement `--dry-run` for workflow commands (`done`)
- `V14-204` — Artifact contract implementation (`done`)
- `V14-205` — Trace propagation (`done`)

## Sprint 3 Board

### Done
- `V14-301` — Restore `ax audit` workflow entry (`done`)
- `V14-302` — Restore `ax qa` workflow entry (`done`)
- `V14-303` — Restore `ax release` workflow entry (`done`)
- `V14-304` — CLI help and quickstart rewrite (`done`)
- `V14-305` — Compatibility assertions for full workflow matrix (`done`)

## Sprint 4 Board

### Done
- `V14-401` — Shared runtime service contracts (`done`)
- `V14-402` — Trace store unification (`done`)
- `V14-403` — Memory and policy store convergence (`done`)
- `V14-404` — MCP regression suite (`done`)
- `V14-405` — Cross-surface dashboard validation (`done`)

## Sprint 5 Board

### Done
- `V14-501` — Fix agent registration race and uniqueness strategy (`done`)
- `V14-502` — Concurrency hardening in recursive/discussion paths (`done`)
- `V14-503` — Cleanup duplicate orchestration paths (`done`)
- `V14-504` — Final docs and migration communications (`done`)
- `V14-505` — v14 release dry run (`done`)

## Next Sequence

### Suggested Sequence
1. Cut the release branch or PR from the `14.0.0` baseline.
2. Treat new work as post-release follow-up instead of migration-sprint scope.

### Cross-Phase Dependency Map
- V14-201 depends on V14-102 and V14-102-a
- V14-202 depends on V14-201
- V14-203 depends on V14-202
- V14-204 depends on V14-202
- V14-205 depends on V14-202
- V14-305 depends on V14-201 through V14-303
- V14-401 through V14-405 depend on Sprint 2 and Sprint 3 outputs
- V14-501/V14-502 depend on stabilized workflow and MCP execution paths

## Sprint Exit Gates (before moving to Sprint 2)
- Gate 1: `ship` and `architect` compatibility checks for dry-run preview, artifact contract, and trace propagation — **done**
- Gate 2: `run` runtime bridge and artifact status transitions validated — **done**
- Gate 3: migration tracker updated before each state transition — **done**
- Gate 4: Sprint 1 exit-gate decisions explicitly resolved and documented — **done** (see `PRD/migration/sprint-1-exit-decisions.md`)

## Sprint 2 Exit Gates (before moving to Sprint 3)
- Gate 1: `ax ship` and `ax architect` are registered as first-class command-layer entrypoints — **done**
- Gate 2: command-layer `--dry-run` preserves preview artifact contract (`manifest.json`, `summary.json`, artifacts dir) — **done**
- Gate 3: no direct provider calls exist in first-class workflow command code paths — **done**
- Gate 4: command-layer tests cover registration, dry-run artifact contract, and trace propagation for `ship` and `architect` — **done**

## Sprint 3 Exit Gates (before moving to Sprint 4)
- Gate 1: all five workflow commands execute successfully in non-destructive mode — **done**
- Gate 2: updated docs and command help consistently show workflow-first default — **done**
- Gate 3: command-layer tests cover all five workflow commands, dry-run behavior, artifact contract, and trace propagation — **done**

## Sprint 4 Exit Gates (before moving to Sprint 5)
- Gate 1: CLI and MCP share runtime contracts for workflow execution, trace lookup, and store access — **done**
- Gate 2: CLI and MCP write/read the same trace store semantics — **done**
- Gate 3: MCP regression suite covers representative workflow, trace, memory, policy, and dashboard tools — **done**
- Gate 4: dashboard visibility confirms CLI and MCP traces are visible from the same monitoring surface — **done**

## Sprint 5 Exit Gates (release gate)
- Gate 1: high-risk persistence and registration defects are fixed at the storage layer — **done**
- Gate 2: discussion execution has bounded provider/round behavior with stress coverage — **done**
- Gate 3: README and migration docs reflect the final unified v14 story — **done**
- Gate 4: release dry run passes the PRD release gates — **done**
