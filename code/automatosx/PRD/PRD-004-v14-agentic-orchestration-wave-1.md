# PRD-004: v14 Agentic Orchestration Wave 1

## 1. Purpose

Define the next high-value post-release capability wave for v14.

This PRD covers the strongest functional gaps that remain after the migration and release work:
- agent execution and routing
- parallel orchestration
- semantic context storage and retrieval

This PRD does not reopen the migration tracker. It defines a new product wave.

## 2. Review Summary

### 2.1 Current Baseline

The current v14 repo already ships:
- workflow-first CLI commands
- shared runtime, trace, state, and MCP surfaces
- direct provider invocation through `ax call`
- operator commands such as `status`, `config`, `cleanup`, `guard`, `resume`, and `iterate`
- a mid-sized MCP tool surface covering workflows, traces, sessions, memory, config, review, guard, discussion, and filesystem basics

Verified release baseline:
- `npm run typecheck` passes
- `npm test` passes
- `15` test files pass
- `111` tests pass

### 2.2 High-Value Remaining Gaps

The strongest remaining capability gaps are:
- `agent.run`
  Agents can be registered and listed, but not executed as first-class runtime tasks.
- `agent.recommend`
  The runtime does not yet recommend an agent for a task from available registry state.
- `parallel.plan`
  There is no first-class task decomposition or DAG planning surface.
- `parallel.run`
  There is no bounded multi-agent parallel execution path.
- `semantic.*`
  There is no persistent semantic storage and retrieval domain for context recall.

### 2.3 Low-Value Items Explicitly Filtered Out

This wave does not include:
- package-count parity with `13.5`
- contract-count parity with `13.5`
- file modularization solely for structural cleanliness
- YAML workflow parity as a goal by itself
- lower-value legacy CLI restoration such as `history` or `update`
- net-new domains such as research, feedback, design, scaffold, or broader PR automation

## 3. Product Decision

v14 will prioritize agentic capability depth over parity accounting.

Wave 1 decision:
- add first-class agent execution and recommendation
- add bounded parallel orchestration on top of the existing runtime and trace model
- add a persistent semantic context domain with MCP-first exposure
- keep the implementation file-backed and local-first unless a stronger backend is proven necessary by this wave

## 4. Requirements

### 4.1 `agent.run`

The runtime must support first-class agent execution.

`agent.run` must:
- execute a registered agent by id
- accept structured input
- create a durable trace record
- return execution status, outputs, and trace metadata
- support bounded timeout controls
- support parent/root trace linkage for orchestration chains

Wave 1 may execute through the existing shared runtime and provider bridge. It does not need a distributed queue.

### 4.2 `agent.recommend`

The runtime must recommend agents from the registered agent catalog.

`agent.recommend` must:
- accept a task description
- optionally filter by required capabilities
- rank candidate agents with a confidence score
- explain the top match factors at a high level

Wave 1 recommendation may use deterministic heuristics over agent metadata. It does not need learned ranking.

### 4.3 `parallel.plan`

The runtime must produce a bounded orchestration plan for independent agent tasks.

`parallel.plan` must:
- accept a set of tasks with explicit dependencies
- validate the dependency graph
- return execution layers or a DAG-oriented ordering
- flag invalid cycles or missing dependencies

### 4.4 `parallel.run`

The runtime must execute a bounded parallel orchestration plan.

`parallel.run` must:
- execute independent tasks concurrently
- respect dependency ordering
- enforce configurable concurrency limits
- aggregate results deterministically
- propagate trace linkage from orchestration root to child task traces
- fail safely with partial-result reporting when configured to do so

Wave 1 may run in-process and local-only.

### 4.5 `semantic.store`

The runtime must store semantic items for later retrieval.

`semantic.store` must:
- accept a key, content, namespace, and optional tags
- persist the item durably
- compute and store retrieval metadata needed for search

### 4.6 `semantic.search`

The runtime must search semantic content by similarity.

`semantic.search` must:
- accept a query string and optional namespace or tag filters
- return ranked results with similarity scores
- be deterministic for the same stored corpus and query

### 4.7 `semantic.get`, `semantic.list`, `semantic.delete`, `semantic.stats`, `semantic.clear`

The semantic domain must also support:
- direct item retrieval by key
- namespace-aware listing
- item deletion
- namespace statistics
- explicit namespace clearing with a confirmation guard

## 5. Non-Goals

- sqlite migration in this wave
- distributed execution
- provider marketplace design
- learned agent routing
- web research or feedback systems
- full `13.5` MCP tool-count parity

## 6. Acceptance Criteria

- `agent.run` executes registered agents with durable traces and structured results.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts` and `packages/mcp-server/tests/mcp-server.test.ts`
- `agent.recommend` returns ranked candidates with capability-aware filtering.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts` and `packages/mcp-server/tests/mcp-server.test.ts`
- `parallel.plan` validates a DAG and returns a stable execution plan.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts`
- `parallel.run` executes dependent tasks with bounded concurrency and trace linkage.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts` and `packages/mcp-server/tests/mcp-server.test.ts`
- `semantic.store` and `semantic.search` persist and retrieve ranked context results.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts`
- semantic management operations (`get`, `list`, `delete`, `stats`, `clear`) work consistently by namespace.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts` and `packages/mcp-server/tests/mcp-server.test.ts`
- the MCP server exposes the new agent, parallel, and semantic tools with typed schemas.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts`
- README and PRD index reflect the new wave without reopening the migration sprint framing.
  Verification: documentation review in the repo

## 7. Implementation Notes

- Keep this wave MCP-first and runtime-first. Add CLI surfaces only if they materially improve operator usability after the MCP/runtime foundation is stable.
- Reuse the current trace and session model rather than inventing a new orchestration store first.
- Prefer deterministic heuristics for recommendation and similarity in Wave 1.
- Treat semantic storage as a domain package boundary even if the first persistence model remains file-backed.
