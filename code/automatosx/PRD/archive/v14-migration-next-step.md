# Archived: v14 Migration: Best-Next Step Plan

Status: superseded

This document has been archived.

Reason:
- the active next-step sequencing now lives in [v14 Implementation Status](/Users/akiralam/code/automatosx/PRD/v14-implementation-plan-status.md),
- [v14 Implementation Plan](/Users/akiralam/code/automatosx/PRD/v14-implementation-plan.md),
- and [Migration Tracker](/Users/akiralam/code/automatosx/PRD/migration/migration-tracker.md).

The historical note is preserved below for reference.

# v14 Migration: Best-Next Step Plan (2026-03-22)

## Priority Sequence

1. Finalize V14-104 harness and runtime stability checks
   - Completed locally: installed dependencies and ran the migration compatibility matrix plus runtime-bridge suite in the local workspace.
   - Completed locally: validated `dispatch()` against the local runtime-backed execution path.

2. Continue with the next engineering-quality step
   - Replace the local `@defai.digital/contracts` and `@defai.digital/workflow-engine` slice with the production 13.5 implementation without changing test expectations.
   - Treat [sprint-1-exit-decisions.md](/Users/akiralam/code/automatosx/PRD/migration/sprint-1-exit-decisions.md) as locked guidance during that swap.
   - Keep the same acceptance bar:
     - successful `dispatched` result
     - `manifest.json` + `summary.json` state transitions (`preview` -> `dispatched`)
     - durable `traceId` propagation into artifacts
     - artifact markdown status staying aligned with summary/manifest status
   - Preserve adapter boundaries; do not move orchestration back into CLI commands.

3. Lock the environment for repeatability
   - Commit the generated lockfile and keep workspace scripts stable.
   - Add any missing package metadata needed for the production package swap.

## Why this is the best next step

- It preserves the one-bridge architecture: all workflow commands remain thin and adapter-driven.
- It keeps the migration on a deterministic path by validating runtime behavior through a contracts-backed local runtime slice before swapping in the full 13.5 engine.
- It keeps compatibility risk low by adding acceptance checks before expanding to `ax audit`, `ax qa`, `ax release` in production.

## Exit criteria

- `packages/cli/src/commands/run.ts` uses runtime bridge wiring to `@defai.digital/workflow-engine` with explicit dependency failures when wiring is missing.
- `dispatch()` and `preview()` are covered by adapter tests, migration compatibility matrix coverage, direct workflow-engine tests, and runtime-backed acceptance coverage.
- Local verification is complete (`npm test` passed).
- Status board reflects current state before opening the next PR.
