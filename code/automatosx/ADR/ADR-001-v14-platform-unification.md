# ADR-001: Build AutomatosX v14 on the 13.5 Modular Architecture and Reintroduce the 11.4 Workflow-First Product Surface

## Status
Accepted

## Date
2026-03-21

## Related Document
Requirements and product scope are tracked in [PRD-001](../PRD/PRD-001-v14-platform-unification.md).
Execution phases, sprint sequencing, and ticket ownership are tracked canonically in [v14 Implementation Plan](../PRD/v14-implementation-plan.md).
Workflow command adapter and compatibility expectations are defined in [workflow-command-adapter-contract](../PRD/migration/workflow-command-adapter-contract.md), [v14 Implementation Status](../PRD/v14-implementation-plan-status.md), and the V14-104 compatibility harness.

## Context
AutomatosX currently exists in two materially different forms:

- `automatosx.11.4` is a large single-package codebase with a workflow-first product surface centered on `ax ship`, `ax architect`, `ax audit`, `ax qa`, and `ax release`.
- `automatosx.13.5` is a modular monorepo with stronger separation between domains, adapters, CLI, and MCP server surfaces.

Both codebases contain valuable capabilities, but they optimize for different entry points:

- `11.4` optimizes for human task entry and durable workflow outputs.
- `13.5` optimizes for modularity, MCP tooling, platform composition, and maintainability.

Attempting to combine them by copying features across directories would create a hybrid codebase with duplicated responsibilities, unclear ownership, and multiple conflicting product surfaces.

## Decision
AutomatosX v14 will be built on the `13.5` modular architecture as the system base.

The `11.4` workflow-first product surface will be reintroduced as a thin, explicit layer on top of that base.

Initial flagship workflow commands for v14:

```bash
ax ship
ax architect
ax audit
ax qa
ax release
```

These commands must dispatch into versioned workflows executed through the v14 runtime. They are product entry points, not independent execution engines.

## Architectural Invariants
1. `13.5` package boundaries are the default architectural shape for v14.
2. No direct feature copy from `11.4` may bypass package boundaries or re-create a monolithic runtime inside `packages/cli`.
3. Workflow commands must execute via versioned workflow definitions, not ad hoc command-specific provider logic.
4. MCP tools remain a first-class integration surface, but not the only promoted product surface.
5. The same core services must support both human CLI workflows and MCP-driven execution by default. If a shared service cannot support both surfaces, the fallback decision is: keep the shared domain contract, isolate only the surface adapter, document the exception in an ADR or mapping decision, and add a parity test showing the divergence is intentional and bounded.
6. Traceability, guards, contracts, and persistence remain mandatory for workflow executions.
7. `11.4` behavior is preserved by compatibility tests and artifact contracts, not by preserving `11.4` file structure.
8. When `11.4` and `13.5` conflict, v14 should prefer the cleaner `13.5` architectural boundary and port only the behavior that still matters.

## Consequences
Required:
- adopt monorepo package boundaries as the long-term maintainable structure
- restore the workflow-first UX as a product layer
- define explicit mapping from `11.4` workflows into `13.5` runtime packages
- create compatibility tests for workflow commands, traces, and artifacts
- close known high-risk concurrency and persistence gaps before broad rollout

Rejected:
- merging source trees directly
- keeping two top-level product stories in tension without a default path
- preserving old implementation details solely because they already exist

## Phase Alignment
Phase numbering is defined canonically in [PRD-001](../PRD/PRD-001-v14-platform-unification.md) Section 8 and in [v14 Implementation Plan](../PRD/v14-implementation-plan.md).

This ADR maps to those phases as follows:
- PRD Phase 0 / Sprint 1: decision, documentation, mapping, adapter contract, compatibility harness
- PRD Phase 1 / Sprint 2: `ax ship` and `ax architect` workflow-first parity
- PRD Phase 2 / Sprint 3: `ax audit`, `ax qa`, and `ax release` parity
- PRD Phase 3 / Sprint 4: MCP and shared runtime convergence
- PRD Phase 4 / Sprint 5: hardening and release

## Alternatives Considered
- Start from `11.4` and modularize later
  Rejected because it preserves the most difficult long-term maintenance problem.
- Keep `13.5` as-is and drop the workflow-first UX
  Rejected because it loses the clearest user-facing value from `11.4`.
- Maintain two separate products
  Rejected because it splits engineering effort and weakens platform identity.

## Rationale
`13.5` already expresses the architecture v14 should want: domain isolation, adapter boundaries, separate CLI and MCP packages, and a clearer path to controlled growth.

`11.4` already expresses the product surface v14 should want: named, governed, repeatable workflows with durable outputs.

The correct v14 move is not to choose one codebase and abandon the other. It is to keep `13.5` as the architectural skeleton and restore `11.4`'s strongest product behavior as a compatibility-driven layer above it.

## Acceptance Criteria
- v14 package layout follows the modular boundary style established by `13.5`
  Verification: repository package layout and dependency boundaries reviewed against [v14 Implementation Plan](../PRD/v14-implementation-plan.md).
- `ax ship` and `ax architect` execute through the v14 workflow runtime
  Verification: V14-104 workflow compatibility harness and runtime-backed acceptance tests.
- workflow runs emit trace ids, summary outputs, manifests, and artifacts
  Verification: workflow adapter tests and migration compatibility tests in V14-104.
- MCP tools and CLI workflows can coexist without duplicated core orchestration logic
  Verification: shared runtime convergence work and MCP regression coverage in Sprint 4 tickets.
- migration work is tracked against explicit compatibility and release gates
  Verification: [v14 Implementation Status](../PRD/v14-implementation-plan-status.md) and [migration tracker](../PRD/migration/migration-tracker.md).

## Compatibility Definition
In this ADR, "compatibility tests" means black-box checks for:
- workflow command dry-run behavior
- emitted `traceId`
- `manifest.json` and `summary.json` presence and status transitions
- documented artifact file presence and expected naming/shape
- runtime dispatch success/failure propagation

The current contract boundary for those checks is defined in [workflow-command-adapter-contract](../PRD/migration/workflow-command-adapter-contract.md) and enforced by the V14-104 harness.

## Summary
AutomatosX v14 will not be a file merge. It will be a replatform: modular core from `13.5`, workflow-first product surface from `11.4`, unified by contracts, tests, and runtime invariants.
