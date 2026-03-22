# v14 Implementation Plan: Workflow-First Product + Modular Core

## Objective
Deliver AutomatosX v14 in ordered, verifiable phases so behavior parity is preserved while migrating to the `13.5` modular architecture.

## Execution Cadence
Use 2-week sprints with a hard gate between phases. No phase is marked done until all gate conditions are met.

## Governance
- Technical owner: Platform architecture
- Product owner: Workflow-first rollout
- QA owner: Compatibility and release-gate validation

## Sprint 1 (Week 1-2): Migration Foundation

### Goals
- Set migration structure from docs to code
- Freeze architecture direction and ownership boundaries
- Stand up baseline build/test commands and shared infra contracts

### Tickets
1. `V14-101` — Migration inventory and ownership map
  - Map `11.4` workflow commands and artifacts into `13.5` package boundaries
  - Owner: Product + Architecture
  - Deliverable: `docs/migration/feature-map.md` with 1:1 mapping and conflict notes
2. `V14-102` — Define adapter boundaries for CLI→workflow runtime
  - Finalize a single execution interface used by both CLI and MCP
  - Owner: Platform
  - Deliverable: package-level interface spec in `packages/core` and adapters in `packages/adapters`
3. `V14-103` — Add v14 migration tracker
  - Create a machine-readable checklist (or markdown tracker) of PRD acceptance criteria and ticket progress
  - Owner: PM + Engineering
  - Deliverable: `PRD/v14-implementation-plan-status.md`
4. `V14-104` — Baseline harness for compatibility tests
  - Add test folders and shared fixtures for workflow and MCP parity tests
  - Owner: QA
  - Deliverable: placeholder test suite in place, no skipped legacy tests
5. `V14-105` — Baseline environment lock
  - Align Node/pnpm/TS versions and package scripts to `13.5` baseline for the v14 worktree
  - Owner: Platform

### Exit Gate
- Migration ownership matrix is approved
- Adapter boundary interface is committed
- Test harness location and execution command are available

---

## Sprint 2 (Week 3-4): Workflow Command Layer (Phase 1)

### Goals
- Reintroduce workflow-first commands on top of modular runtime
- Ship `ship` and `architect` as stable v14 entry points

### Tickets
1. `V14-201` — Add workflow command registry
  - Register `ship` and `architect` command definitions in CLI command namespace
  - Owner: CLI
  - Dependencies: `V14-102`
2. `V14-202` — Implement workflow dispatch adapter
  - Route command invocation through versioned workflow runtime
  - Owner: CLI + Core
  - Dependencies: `V14-201`
3. `V14-203` — Implement `--dry-run` for workflow commands
  - Preview outputs without provider calls
  - Owner: CLI
  - Dependencies: `V14-202`
4. `V14-204` — Artifact contract implementation
  - Guarantee `summary.json`, `manifest.json`, artifact dir, and command output summary
  - Owner: Workflow engine
  - Dependencies: `V14-202`
5. `V14-205` — Trace propagation
  - Ensure trace id appears in all workflow starts, step logs, and command responses
  - Owner: Trace domain

### Exit Gate
- `ax ship` + `ax architect` work in compatibility tests (dry-run + artifact contract)
- No direct provider calls in workflow command code paths

---

## Sprint 3 (Week 5-6): Workflow Expansion (Phase 2)

### Goals
- Expand flagship set to full five workflows
- Keep product surface consistent and documented

### Tickets
1. `V14-301` — Restore `ax audit` workflow entry
  - Add command registration and workflow mapping
  - Output contract and artifact schema
  - Owner: Workflow + CLI
2. `V14-302` — Restore `ax qa` workflow entry
  - Add command registration and workflow mapping
  - Owner: Workflow + CLI
3. `V14-303` — Restore `ax release` workflow entry
  - Add command registration and workflow mapping
  - Owner: Workflow + CLI
4. `V14-304` — CLI help and quickstart rewrite
  - Replace onboarding to show workflow commands as default
  - Owner: Docs + CLI UX
5. `V14-305` — Compatibility assertions for full workflow matrix
  - Add/extend tests so each workflow validates outputs, dry-run, and trace behavior
  - Owner: QA
  - Dependencies: `V14-201`…`V14-303`

### Exit Gate
- All five workflow commands execute successfully in non-destructive mode
- Updated docs and command help consistently show workflow-first default

---

## Sprint 4 (Week 7-8): MCP and Shared Runtime Convergence

### Goals
- Unify CLI and MCP execution paths on shared domain services
- Stabilize persistence, memory, and monitoring integration

### Tickets
1. `V14-401` — Shared runtime service contracts
  - Ensure MCP and CLI use same workflow/trace/memory interfaces
  - Owner: Platform + MCP
2. `V14-402` — Trace store unification
  - Confirm both CLI and MCP write/read same trace source
  - Owner: Trace + Storage
3. `V14-403` — Memory and policy store convergence
  - Use same semantic/memory/agent config store where practical
  - Owner: Memory + Config
4. `V14-404` — MCP regression suite
  - Add end-to-end tests for representative MCP tools and workflow calls
  - Owner: QA
5. `V14-405` — Cross-surface dashboard validation
  - Validate traces from CLI runs are visible to monitor surfaces
  - Owner: Monitoring + CLI

### Exit Gate
- MCP + CLI share runtime contracts and trace store semantics
- Dashboard visibility for workflow trace IDs confirmed

---

## Sprint 5 (Week 9-10): Hardening and Release

### Goals
- Close known high-risk defects
- Remove duplicated transitional code
- Achieve release criteria from PRD

### Tickets
1. `V14-501` — Fix agent registration race and uniqueness strategy
  - Enforce safe registration semantics at storage layer
  - Owner: Agents + Storage
2. `V14-502` — Concurrency hardening in recursive/discussion paths
  - Verify call budgets and queueing behavior under stress
  - Owner: Discussion + Resilience
3. `V14-503` — Cleanup duplicate orchestration paths
  - Remove transitional direct execution surfaces while keeping compatibility shims
  - Owner: Platform
4. `V14-504` — Final docs and migration communications
  - Finalize user migration notes and advanced-surface deprecation guidance
  - Owner: Docs + PM
5. `V14-505` — v14 release dry run
  - Run full PRD release gate checklist
  - Owner: QA + Tech Lead

### Exit Gate
- All PRD release gates pass
- High-risk architecture issues fixed or formally waived
- v14 release artifact is ready

---

## Risks and rollback strategy
- Workflow parity drift: rollback by disabling new command routes to compatibility-only layer while keeping data/schema migration stable.
- MCP divergence: enforce shared interfaces first; if blocked, keep MCP surface as read-only until parity restored.
- Hard-to-map legacy behavior: defer into explicit compatibility flags and migration notes rather than ad hoc patches.

## Immediate next step after plan approval
1. Expand `PRD/v14-implementation-plan-status.md` with per-ticket `done/blocked/on-hold` states and a dependency graph.
2. Start Sprint 1 with `V14-101`, `V14-102`, and `V14-104` in parallel.
3. Add tracker updates before any implementation PR is merged, so scope drift is visible from day one.
