# Archived: Sprint 1 Task Breakdown: v14 Foundation

Status: superseded

This document has been archived.

Reason:
- its active content is now covered by [v14 Implementation Plan](/Users/akiralam/code/automatosx/PRD/v14-implementation-plan.md),
- [v14 Implementation Status](/Users/akiralam/code/automatosx/PRD/v14-implementation-plan-status.md),
- and [Migration Tracker](/Users/akiralam/code/automatosx/PRD/migration/migration-tracker.md).

The original Sprint 1 breakdown is preserved below for history.

# Sprint 1 Task Breakdown: v14 Foundation

This document breaks down Sprint 1 into implementation-ready work items with explicit target files and acceptance outputs.

## 1) Migration Inventory and Ownership Map (V14-101)

- Create migration map in `/Users/akiralam/code/automatosx/PRD/migration/mapping.md`
- Capture `11.4` command surface equivalents and map to `13.5` package boundaries
- List unresolved conflicts and recommended source-of-truth package for each capability
- Include status tags: `KEEP`, `PORT`, `REIMPLEMENT`, `RETIRED`, `DEFER`
- Add approver for each mapped area (`Architecture`, `CLI`, `MCP`, `Core`)

## 2) CLI to Workflow Runtime Adapter Boundaries (V14-102)

- Create adapter spec in `/Users/akiralam/code/automatosx/packages/cli/src/workflow-adapter.ts` (or create folder if missing)
- Define interfaces for:
- Command input normalization
- Workflow dispatch
- Trace context propagation
- Artifact export contract
- Add compile-time type boundary to prevent command-level direct provider calls
- Add interface acceptance tests in `/Users/akiralam/code/automatosx/packages/cli/src/workflow-adapter.test.ts`

## 3) Migration Tracker Setup (V14-103)

- Finalize status file as the source of truth:
- `/Users/akiralam/code/automatosx/PRD/v14-implementation-plan-status.md`
- Add columns: `status`, `owner`, `startDate`, `endDate`, `dependencies`, `notes`
- Add a short "Definition of Done" block for each ticket
- Ensure this file is updated before each PR merge

## 4) Compatibility Test Harness Baseline (V14-104)

- Add harness scaffold in `/Users/akiralam/code/automatosx/PRD/tests/` or `/Users/akiralam/code/automatosx/tests/migration/` depending on monorepo final shape
- Define fixture format for workflow command inputs/outputs and trace assertions
- Add placeholder test suites:
- `/Users/akiralam/code/automatosx/tests/migration/workflows-compat.test.ts`
- `/Users/akiralam/code/automatosx/tests/migration/mcp-compat.test.ts`
- Add minimal smoke tests that fail if required files are absent, so the migration contract is always checked once implemented

## 5) Environment Baseline (V14-105)

- Add environment baseline doc in `/Users/akiralam/code/automatosx/PRD/migration/environment-baseline.md`
- Lock major tool versions used in migration:
- Node
- pnpm
- TypeScript
- ESLint
- Vitest
- Confirm workspace scripts expose:
- `build`
- `test`
- `test:ci`
- `typecheck`
- `lint`

## 6) Dependencies and Sequencing (Execution Rule)

- Start V14-101 and V14-102 in parallel
- Start V14-103 and V14-104 after V14-101 draft is complete
- Start V14-105 immediately if environment lock files are available
- Do not start Sprint 2 (`V14-201` and onward) until Sprint 1 Gate 1 is satisfied

## 7) Sprint 1 Exit Conditions

- Migration map is approved and unambiguous
- CLI→workflow adapter boundary is defined
- Compatibility harness exists and is wired in CI/job runner
- Environment baseline declared and shared
- Status tracker is active and maintained

## 8) Recommended first PR sequence

- PR-1: V14-101 + V14-103
- PR-2: V14-105
- PR-3: V14-102 scaffold + harness stubs from V14-104
- PR-4: Status tracker refinements + sprint notes in PRD
