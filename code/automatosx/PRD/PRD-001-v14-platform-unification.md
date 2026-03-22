# PRD-001: AutomatosX v14 Platform Unification

## 1. Objective
Build AutomatosX v14 as a unified platform that combines:

- the modular architecture, package boundaries, and MCP depth of `13.5`
- the workflow-first UX and durable outcome model of `11.4`

The result should be one product, one repo, and one default story.

## 1.1 Ownership and Sign-Off
- Product requirements owner: Workflow-first rollout / PM
- Architecture sign-off owner: Platform architecture
- Delivery sign-off owner: Tech lead for v14 migration
- Release-gate sign-off owner: QA / compatibility lead

Execution sequencing and ticket owners are tracked canonically in [v14 Implementation Plan](./v14-implementation-plan.md).

## 2. Product Thesis
AutomatosX v14 should become:

**The governed AI delivery platform with a workflow-first UX and a modular MCP-native core**

Product experience:
- easy task entry for humans
- broad MCP capability for AI IDEs and coding assistants
- repeatable outputs with trace and governance

Core differentiation:
- workflow-first human UX
- modular runtime architecture
- governance and contract boundaries
- multi-provider routing
- persistent memory, traces, and reviewability

## 3. Problem Statement
The current state is fragmented:

- `11.4` is easier to explain and use from the CLI, but harder to evolve safely
- `13.5` is cleaner architecturally, but less opinionated as a default product entry point
- the codebases overlap in capability but diverge in structure, terminology, and tests

Without a clear migration strategy, v14 risks becoming:
- a code dump of both trees
- a platform with too many entry points
- a rewrite that loses existing user-facing value

## 4. Target Users
- Solo developers who want fast workflow entry for shipping, architecture, audits, QA, and releases
- Tech leads who need repeatable, governed delivery flows with artifacts and traces
- AI-first teams using Codex, Claude, Gemini, Cursor, or MCP-compatible tools
- Internal platform maintainers who need a codebase that can evolve without monolith regression

## 5. Product Goals
1. Establish one canonical v14 repository and architecture.
2. Preserve the strongest workflow UX from `11.4`.
3. Preserve the strongest modularity and MCP surface from `13.5`.
4. Reduce duplicated code and conflicting product narratives.
5. Make release readiness measurable through compatibility and platform hardening gates.

## 6. Non-Goals
v14 does not aim to:
- preserve every file, command alias, or internal abstraction from both versions
- launch new top-level product categories unrelated to the merge
- redesign every workflow from scratch before parity is reached
- maintain multiple equally promoted default entry surfaces
- solve every enterprise or licensing concern in the first migration phase

## 7. Product Requirements

### 7.1 Canonical Product Surface
v14 must have a clear default user path.

Primary promoted CLI workflows:

```bash
ax ship
ax architect
ax audit
ax qa
ax release
```

Primary promoted AI-tool integration path:

```bash
ax init
```

This means:
- humans get task-oriented workflow commands
- AI assistants and IDEs get MCP tools through initialization and server registration
- both surfaces rely on the same underlying platform capabilities

Minimal v14 requirement for `ax init`:
- initialize the AI-tool integration surface without invoking workflow execution
- configure or register the MCP/server integration path required by the repo
- return actionable output describing what was initialized
- remain explicitly out of the workflow artifact contract defined for `ax ship` through `ax release`

### 7.2 Workflow Requirements
Each flagship workflow must:
- execute through versioned workflow definitions
- support `--dry-run`
- emit a trace id
- produce `summary.json`
- produce `manifest.json`
- produce documented artifacts
- run through guards, contracts, and runtime tracing

Expected outputs:
- `ax ship`: review summary, test summary or test plan, risk notes, PR draft
- `ax architect`: architecture proposal, ADR draft, phased plan, risk matrix
- `ax audit`: audit report, severity ranking, remediation plan
- `ax qa`: pass/fail summary, defects, repro notes, evidence references
- `ax release`: changelog draft, release notes, deployment checklist

### 7.3 Architecture Requirements
v14 must:
- use package boundaries consistent with `13.5`
- keep domain logic out of ad hoc CLI command implementations
- isolate persistence and provider concerns behind adapters
- support both CLI and MCP execution without duplicated orchestration paths
- make migration status visible through tests and documentation

### 7.4 Compatibility Requirements
v14 must define explicit compatibility targets for `11.4` and `13.5`.

Required retained behaviors from `11.4`:
- workflow-first commands
- dry-run previews
- artifact-oriented outputs
- traceable governed execution

Required retained behaviors from `13.5`:
- monorepo modularity
- MCP tool surface
- dashboard and trace ecosystem
- package-level separation of core domains and adapters

### 7.5 Testing Requirements
v14 must ship with:
- black-box workflow compatibility tests modeled on `11.4` integration expectations
- MCP server and CLI regression tests modeled on `13.5`
- migration checklists for commands, artifacts, traces, and persistence

No feature is considered migrated only because code was copied.

## 8. Migration Strategy
This section is a product-level summary only.
The canonical execution breakdown, sprint sequencing, and ticket dependencies live in [v14 Implementation Plan](./v14-implementation-plan.md).

### 8.1 Phase 0: Decision and Documentation
- approve architecture direction
- create PRD and ADR
- define migration invariants
- identify feature mapping between `11.4` and `13.5`

### 8.2 Phase 1: Foundation
- establish v14 repo structure
- import or implement the modular package skeleton
- define workflow registry and artifact contracts
- add compatibility test harness

### 8.3 Phase 2: Workflow-First Parity
- restore `ax ship`
- restore `ax architect`
- validate dry-run, traces, and artifacts
- align CLI help and README around the new default story

### 8.4 Phase 3: Platform Parity
- restore `ax audit`, `ax qa`, and `ax release`
- complete MCP, dashboard, trace, and shared store integration
- migrate high-value provider and memory behaviors

### 8.5 Phase 4: Hardening and Release
- remove transitional duplication
- close known high-risk concurrency and persistence gaps
- finalize packaging, docs, and release criteria

## 9. Success Metrics
- one canonical repository is used for all v14 development
  Verification: all active v14 migration tickets point to this repository only.
- flagship workflow commands are available and tested
  Verification: `ax ship`, `ax architect`, `ax audit`, `ax qa`, and `ax release` each have passing compatibility coverage.
- MCP initialization and tool execution remain available and tested
  Verification: at least one `ax init` path and one MCP end-to-end path pass release-gate tests.
- duplicated orchestration logic is reduced versus preserving both trees
  Verification threshold: no workflow command implements provider orchestration directly in CLI command handlers; all flagship commands route through the shared adapter/runtime boundary.
- all flagship workflows produce trace ids and durable artifacts
  Verification: each flagship workflow emits `traceId`, `summary.json`, `manifest.json`, and expected artifact files in compatibility tests.
- release readiness is gated by test-backed parity, not subjective confidence
  Verification: release requires passing PRD Section 11 gates and tracker sign-off.

## 10. Risks and Mitigations
- Risk: the migration becomes a loose code merge
  Mitigation: require behavior mapping, package ownership, and compatibility tests
- Risk: workflow UX is lost while preserving architecture
  Mitigation: make workflow-first parity a top-level migration gate
- Risk: modularity is lost while preserving old commands
  Mitigation: port behavior into packages instead of copying monolith internals
- Risk: MCP and dashboard capabilities regress
  Mitigation: preserve `13.5` MCP and trace packages as first-class scope
- Risk: hidden concurrency and persistence defects ship into v14
  Mitigation: include hardening phase with explicit release gates

## 11. Release Gates
v14 should not be declared release-ready until:
- `ax ship` and `ax architect` pass compatibility tests
- at least one MCP end-to-end flow passes against the v14 server
- trace persistence works across CLI and MCP execution paths
- known high-risk architectural issues have either been fixed or explicitly waived
- README and onboarding reflect the unified product story

## 12. Open Questions
- Which `13.5` packages can be adopted unchanged versus refactored immediately?
- Which `11.4` workflow artifacts should be preserved exactly versus normalized?
- Should v14 preserve older expert commands unchanged, or demote some behind advanced help?
- What minimum parity is required before users should migrate from either legacy branch?

## 13. Final Recommendation
Treat v14 as a controlled replatform.

Do not merge codebases mechanically.
Do not pick only one branch and discard the other branch's strongest advantage.

Build on the `13.5` modular core, restore the `11.4` workflow-first product surface, and enforce the merge through documented invariants and compatibility tests.
