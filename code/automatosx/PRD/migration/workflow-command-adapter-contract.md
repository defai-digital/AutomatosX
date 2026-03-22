# v14 Workflow Command Adapter Contract (Sprint 1: V14-102)

## Goal
Define the minimum contract boundary between CLI command handlers and the workflow runtime before adding `ship|architect|audit|qa|release` commands in v14.

## Proposed Package Boundary
- New file target: `packages/cli/src/workflow-adapter.ts` (or command-local module if command package is split further)
- CLI handlers must call only this interface; no direct provider orchestration or trace-store writes.
- Runtime dispatch is handled by `workflow-engine` + trace/event tooling.

## Contract

### Types

- `WorkflowCommandId`
  - Union: `'ship' | 'architect' | 'audit' | 'qa' | 'release'`

- `WorkflowCommandInput`
  - `commandId: WorkflowCommandId`
  - `arguments: Record<string, string | boolean>`
    Note: This is intentionally generic for Sprint 1. Per-command argument schemas (e.g. `scope`/`issue` for `ship`, `request`/`timeline` for `architect`) will be narrowed in Sprint 2 (V14-201) once the production package swap is complete. Until then, callers must conform to the argument names defined in `mapping.md` Command-to-Artifact Contract table.
  - `options: { provider?: string; dryRun?: boolean; outputDir?: string; verbose?: boolean; quiet?: boolean }`
  - `traceContext?: { parentTraceId?: string }`

- `WorkflowCommandPreview`
  - `workflowId: string`
  - `workflowName: string`
  - `traceId: string`
  - `agent: string`
  - `stages: string[]`
  - `task: string`
  - `artifactNames: string[]`
  - `artifactCount: number`

- `WorkflowCommandResult`
  - `success: boolean`
  - `traceId: string`
  - `outputDir: string`
  - `manifestPath?: string`
  - `summaryPath?: string`
  - `artifactPaths?: string[]`
  - `errorCode?: string`
  - `errorMessage?: string`

### Service Interface

- `preview(commandInput): Promise<WorkflowCommandPreview>`
  - Must not write to the trace store, artifact directories, or any persistent state.
  - Generates deterministic task text + artifact plan.
  - Must return a new `traceId` for each invocation. This ID is ephemeral and display-only unless the caller explicitly reuses it by passing it back through `traceContext.parentTraceId` on a later `dispatch` call.

- `dispatch(commandInput): Promise<WorkflowCommandResult>`
  - Must write artifact directories in the same style as 11.4:
    - `<outputRoot>/.automatosx/workflows/<command>/<trace-id>/`
    - `manifest.json`
    - `summary.json`
    - artifact markdown files under `artifacts/`
  - Must call workflow runtime to execute and return final status.
  - Must propagate runtime failure as `success:false` with stable `errorCode`.

- `buildWorkflowInput(commandInput): WorkflowInputPayload`
  - Internal helper converting legacy command parameters into workflow runtime payload.

## Invariants
- V14 commands must not invoke `runCommand`/provider internals directly.
- All five commands must route through the same adapter entry points.
- `--dry-run` uses `preview` only and must never mutate execution state.
- Output directory default must preserve 11.4 legacy style when no `--output-dir` is provided.

## Exit Conditions for V14-102
- `packages/cli/src/workflow-adapter.ts` exists and is used by all five command handlers.
- No runtime orchestration logic exists inside command handlers (CLI-only concerns only).
- Existing `run` command remains intact and receives same payload contract for delegated workflows.
- Tests cover:
  - one command preview path for each of 5 commands
  - five dry-run exits
  - runtime-backed end-to-end dispatch path via `tests/migration/workflow-runtime-bridge.test.ts` (not mock-only)

---

## Contract Version
- Version: `1.0` (Sprint 1 baseline)
- Last Updated: 2026-03-22
- Next revision: Sprint 2 (V14-201) — per-command argument schemas to be narrowed when production package swap is complete.
