# v14 Agentic Orchestration Wave 1 Plan

## 1. Purpose

Execution plan for [PRD-004](./PRD-004-v14-agentic-orchestration-wave-1.md).

This plan defines the first post-release capability wave after the completed v14 migration.

Current status:
- Phase A is implemented and verified in the current repo.
- Phase B is implemented and verified in the current repo.
- Phase C is implemented and verified in the current repo.

## 2. Scope Summary

This wave implements:
- `agent.run`
- `agent.recommend`
- `parallel.plan`
- `parallel.run`
- `semantic.store`
- `semantic.search`
- `semantic.get`
- `semantic.list`
- `semantic.delete`
- `semantic.stats`
- `semantic.clear`

This wave does not implement:
- research
- feedback
- sqlite migration
- distributed execution
- broader legacy parity restoration

## 3. Delivery Strategy

### Phase A: Agent Execution Foundation

Goal:
- make registered agents executable through the shared runtime and MCP

Tickets:
- `A-101` — define runtime agent execution contract
- `A-102` — implement `agent.run` trace lifecycle and timeout handling
- `A-103` — implement `agent.recommend` deterministic ranking
- `A-104` — add MCP schemas and regression coverage for `agent.run` and `agent.recommend`

Exit gate:
- registered agents can be run and recommended through MCP with durable traces

### Phase B: Parallel Orchestration

Goal:
- add bounded multi-agent DAG planning and execution

Tickets:
- `B-201` — define plan/task schema and dependency validation
- `B-202` — implement `parallel.plan`
- `B-203` — implement `parallel.run` with bounded concurrency and dependency ordering
- `B-204` — add trace lineage and partial-result aggregation semantics
- `B-205` — add MCP schemas and regression coverage for parallel tools

Exit gate:
- orchestration plans validate correctly and execute with predictable aggregation and trace linkage

### Phase C: Semantic Context Domain

Goal:
- add persistent semantic storage and retrieval

Tickets:
- `C-301` — define semantic item model and namespace rules
- `C-302` — implement storage/indexing and deterministic similarity ranking
- `C-303` — implement retrieval and management operations
- `C-304` — expose semantic tools in MCP with typed schemas
- `C-305` — add persistence and search regression coverage

Exit gate:
- semantic content can be stored, searched, managed, and inspected through MCP

## 4. Architectural Approach

### 4.1 Package Direction

Preferred direction:
- add focused domain modules under existing runtime/store structure first
- split into separate packages only when the boundaries are proven by the implementation

Initial write areas:
- `packages/shared-runtime/src/`
- `packages/state-store/src/`
- `packages/mcp-server/src/`
- tests under the corresponding package test directories

### 4.2 Persistence Direction

Wave 1 default:
- continue using the current local file-backed persistence model
- isolate semantic persistence behind a clear storage boundary so a future sqlite migration remains possible

### 4.3 Trace Direction

Every new runtime entrypoint must:
- create or join a trace
- preserve parent/root trace ids where provided
- produce deterministic result envelopes for MCP callers

## 5. Sequencing and Dependencies

Recommended order:
1. Phase A
2. Phase B
3. Phase C

Dependency notes:
- `parallel.run` depends on `agent.run`
- `parallel.plan` may be built before `parallel.run`
- semantic work is mostly independent and can begin in parallel once Phase A contracts are stable

## 6. Risks

### Risk 1: Overbuilding parity instead of useful capability

Mitigation:
- keep the wave limited to agent execution, parallel orchestration, and semantic context

### Risk 2: Trace complexity grows too quickly

Mitigation:
- reuse the current trace model and add lineage fields only where needed

### Risk 3: Semantic search quality is poor on first pass

Mitigation:
- use deterministic ranking with explicit test fixtures and documented limitations

### Risk 4: Concurrency bugs in parallel execution

Mitigation:
- keep execution bounded and in-process for Wave 1
- add regression coverage for dependency order, aggregation, and partial failure

## 7. Verification Plan

Primary test targets:
- `packages/shared-runtime/tests/shared-runtime.test.ts`
- `packages/state-store/tests/state-store.test.ts`
- `packages/mcp-server/tests/mcp-server.test.ts`

Wave completion gate:
- `npm run typecheck` passes
- `npm test` passes
- new MCP tools return typed schemas and stable result envelopes

## 8. Deferred Follow-Ups

After this wave, reassess:
- whether `ax call` autonomy should invoke `agent.run`
- whether semantic storage should move to sqlite
- whether research and feedback should become the next PRD instead of more parity work
