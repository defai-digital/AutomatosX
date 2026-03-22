# Sprint 1 Exit-Gate Decisions

Date: 2026-03-22

## Purpose
This document records the explicit architectural decisions that must be resolved before Sprint 2 begins.

## Decision 1: Workflow Template Format

### Decision
V14 adopts the `13.5` workflow definition shape as the canonical runtime template format:
- `workflowId`
- `version`
- `name`
- `steps`
- optional `metadata`

For Sprint 1 and Sprint 2, the workflow runtime definition remains focused on execution structure. Workflow artifact contracts are owned explicitly by the v14 workflow adapter/registry layer and validated by compatibility tests.

### Why
- This keeps runtime format aligned with `13.5`.
- It avoids inventing a second workflow schema during migration.
- It keeps artifact compatibility enforceable even before the full production package swap is complete.

### Consequence
- Runtime workflow files should conform to the `13.5`-style schema.
- Artifact names, `manifest.json`, `summary.json`, and trace/output expectations remain a compatibility contract owned by v14 workflow command mapping until a later structured metadata migration explicitly replaces that layer.

### Verification
- Local workflow files under [workflows](../../workflows) conform to the contracts-backed runtime schema.
- Runtime-backed tests in [workflow-runtime-bridge.test.ts](../../tests/migration/workflow-runtime-bridge.test.ts) pass.

## Decision 2: Command Surface

### Decision
`ship`, `architect`, `audit`, `qa`, and `release` remain first-class CLI commands in v14. They are not demoted to aliases for a generic `run` surface.

`run` remains an advanced execution surface and runtime bridge, not the promoted workflow-first entry point.

### Why
- The PRD and ADR both define workflow-first UX as the default product story.
- First-class commands preserve `11.4` usability while keeping orchestration behind the shared adapter boundary.
- This avoids collapsing the product surface back into a generic expert-only command model.

### Consequence
- CLI help, onboarding, and tests should treat these commands as stable top-level entry points.
- `run` may still execute workflows internally, but it must not replace the promoted product surface.

### Verification
- Workflow handlers in [workflows.ts](../../packages/cli/src/commands/workflows.ts) remain first-class command entry points.
- Compatibility tests cover the five named commands directly.

## Decision 3: Artifact Location

### Decision
The default workflow artifact location is:

```text
.automatosx/workflows/<command>/<trace-id>/
```

Inside that directory, v14 must produce:
- `manifest.json`
- `summary.json`
- `artifacts/`

`--output-dir` remains an explicit override for tests, CI, and advanced workflows.

### Why
- This preserves `11.4` compatibility expectations.
- It keeps downstream references stable.
- It gives a single deterministic path for CLI and test tooling.

### Consequence
- Any future runtime/package swap must preserve this default path behavior.
- Artifact compatibility tests must assert this structure.

### Verification
- The default path is encoded in [workflow-adapter.ts](../../packages/cli/src/workflow-adapter.ts).
- Migration compatibility tests assert artifact presence and state transitions.

## Decision 4: Telemetry Fallback

### Decision
Legacy command-side telemetry is not a Sprint 1 blocker and is not carried forward as a required fallback path.

The mandatory observability baseline for Sprint 1 through Sprint 3 is:
- emitted `traceId`
- `manifest.json`
- `summary.json`
- workflow success/failure propagation

If richer telemetry is later required by release gates, it must be implemented through shared trace/event domain services, not by restoring legacy CLI-local telemetry code.

### Why
- This avoids reintroducing `11.4`-style command-local observability paths into the new architecture.
- It preserves the `13.5` direction of shared runtime and trace-domain ownership.
- It gives a concrete minimum for current release gates without blocking migration on secondary telemetry work.

### Consequence
- Release gates for Sprint 1 and Sprint 2 should rely on trace/artifact evidence, not legacy command telemetry parity.
- Any future telemetry expansion requires shared-domain ownership and explicit design. The trace-domain team is the designated owner of any future telemetry work. Requests to add richer telemetry must go through that team and must not be implemented as CLI-local instrumentation.

### Verification
- Runtime-backed acceptance tests assert `traceId` and artifact state transitions.
- Tracker and status docs treat telemetry fallback as resolved for Sprint 1.
