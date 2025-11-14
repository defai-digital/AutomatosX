# Sprint 2 PRD – Agent Parity Foundation (Weeks 3–4)

## 1. Sprint Overview
- **Mission**: Establish the agent parity foundation by porting priority v1 agent behaviors and their corresponding tests so v2 can reliably orchestrate agents at scale.
- **Scope**: (a) harden the CLI ⇄ TypeScript bridge, (b) build and validate agent orchestration features with multi-provider routing + memory access, and (c) create the golden trace harness to replay v1 interactions through the new runtime.
- **Outcome Definition**: 1,616 automated tests passing (916 → 1,616) with demonstrable coverage of agent scheduling, provider fallback, memory queries, CLI UX, and a documented backlog covering the remaining 1,007 parity tests needed post-sprint.

## 2. Technical Deep-Dive
### Agent Catalog Structure
- `.automatosx/agents/` stores JSON/YAML descriptors (persona, capabilities, provider defaults, routing hints). Sprint 2 extends metadata with: supported platforms, dependency graph, golden trace IDs, and Zod schema references generated from ReScript types.
- Catalog treat as source of truth for parity inventory; each agent entry links to legacy v1 test cases and expected behaviors.

### Agent Orchestration
- Scheduler consumes catalog metadata + user request context to choose agent(s); delegation orchestrated via a rule engine seeded in Sprint 1.
- Enhancements: priority queues per persona cluster, deterministic replay hooks for golden traces, and observability hooks (structured logs per decision).

### Multi-Provider Routing
- Providers: Claude, Gemini, OpenAI. Routing layer ranks providers by capability, latency, and quota health, then invokes fallback when a provider errors or SLA metrics degrade.
- Need per-provider adapters with uniform telemetry and chaos-toggle to simulate failures during tests.

### Memory Integration
- Memory DB lives at `.automatosx/memory/memories.db` (SQLite + FTS5). Introduce query helpers so agents can run semantic + metadata filters through the CLI bridge, with connection pooling to avoid file-lock churn.
- Provide typed query builders (TS) that match ReScript definitions; include caching for read-heavy traces.

### CLI/TypeScript Bridge
- Bridge translates CLI invocations into TS handlers backed by ReScript-generated types. Sprint 2 adds Zod validation, error surface standardization, and typed event emitters for orchestration callbacks.
- Command handlers must expose streaming logs for long-running agent orchestration tasks.

### Golden Trace Testing
- Golden traces = canonical v1 transcripts (prompt, provider responses, tool calls). Harness replays them through v2 orchestrator, diffing logs, memory accesses, and completion shapes.
- Provide fixtures (JSON) + deterministic seeding to isolate nondeterministic provider responses.

## 3. Work Breakdown Structure (10 Major Items, 272h)
1. **Agent parity inventory (16h)** – Catalog all 1,707 missing tests mapped to agents + behaviors. Output: prioritised spreadsheet + Git-tracked doc; include dependency + confidence scores.
2. **CLI/TS bridge enhancements (28h)** – Implement Zod schemas, ReScript → TS type generation, error envelopes, and streaming logs. Acceptance: CLI commands validated end-to-end with new types.
3. **Agent orchestration core (32h)** – Extend scheduler/delegation logic, add deterministic replay hooks, and log instrumentation.
4. **Multi-provider routing implementation (20h)** – Build adapter abstraction, retry/fallback policy, SLA metrics exporters, and failure injection toggles.
5. **Memory integration (24h)** – Typed query builders, connection pooling, caching, and CLI exposure for agent prompts.
6. **Golden trace harness (28h)** – Build replay runner, diff tooling, and fixture loader for 100 initial traces.
7. **First 350 parity tests – CLI commands (40h)** – Port CLI-centric tests covering command parsing, streaming output, and error handling.
8. **Next 350 parity tests – agent behaviors (40h)** – Port orchestration-focused cases covering delegation chains, tool calls, and provider fallback.
9. **Platform coverage (24h)** – Enable macOS/Linux/Windows CI shards with provider mocking, artifact uploads, and flaky test detection.
10. **Documentation & integration testing (20h)** – Update AX-GUIDE, write runbooks for golden traces, and execute cross-squad integration test passes.

## 4. Testing Strategy
- **Test Categories**: 350 CLI command tests, 200 agent orchestration tests, 100 memory query tests, 50 platform-specific smoke tests.
- **Golden Trace Tests**: Minimum 100 v1 transcript replays validating orchestration decisions, provider routing, and memory usage. Each trace must diff logs + outcomes and feed regressions into the parity backlog.
- **What to Test**: Scheduling determinism, provider fallback, CLI UX (progress + error messaging), memory query accuracy, cross-platform path handling.
- **Tooling**: Vitest harness with mocked provider adapters, fake SQLite DB for deterministic memory fixtures, snapshot testing for CLI output, and deterministic seeds for golden traces.
- **Coverage Target**: ≥80% line + branch coverage on agent orchestration modules and ≥70% on bridge + memory helpers.

## 5. Quality Gates
- **Week 3 Gate (Day 15)**: ≥1,300 tests passing, parity inventory published, CLI bridge with Zod validation merged. If missed, pause new feature work and swarm on blockers; Quality Squad halts new trace authoring until bridge stabilises.
- **Week 4 Gate (Day 20)**: 1,616 tests passing, golden trace harness operational with 100 traces green, macOS/Linux/Windows CI all green. If missed, Sprint 3 scope is reduced to address gaps; leadership evaluates slipping Go/No-go for v2 launch.

## 6. Dependencies & Blockers
- Stable ReScript runtime + state machine work from Sprint 1.
- Access to v1 codebase + transcript archives for trace generation.
- Provider API keys/quotas (Claude, Gemini, OpenAI) with observability on rate limits.
- CI infrastructure capable of running platform shards with required secrets.

## 7. Success Metrics
- Test count: 1,616 automated tests (net +700) passing in CI.
- Agent orchestration code coverage ≥80% (line + branch) with tracked report.
- Platform coverage: macOS, Linux, Windows nightly runs green three days consecutively prior to Sprint review.
- Golden traces: 100 replay suites pass with no critical diffs.
- Zero P0/P1 bugs opened against agent behaviors during the sprint window.

## 8. Team Structure & Ownership
- **CLI/TypeScript Squad (3 engineers)** – Lead Items 2 & 7, co-own bridge documentation.
- **Quality Squad (3 people)** – Lead Items 1, 6, 7, 8; maintain golden traces + test ledger.
- **Core Runtime Squad (3 engineers)** – Lead Items 3, 5, and provide support on multi-provider routing.
- **DevOps Squad (2 engineers)** – Lead Item 9, ensure secrets + CI stability.
- **Total**: 11 contributors (two added for increased parity/test scope).
- Each work item has a DRIs list in the parity inventory doc; squads run daily syncs focused on gate readiness.

## 9. Risk Management (Top 5)
1. **Parity inventory expands beyond 1,707 tests** – Mitigation: rank by user impact, cut low-value traces, and feed excess into Sprint 3 backlog.
2. **Golden trace diffs caused by v1/v2 behavior drift** – Mitigation: start with simple traces, add replay flags to mimic v1 heuristics, and open design reviews for unavoidable differences.
3. **Multi-provider routing instability** – Mitigation: build robust mocks, run chaos tests nightly, and expose manual override to pin providers.
4. **Platform CI delays** – Mitigation: DevOps starts Day 11, use matrix builds with fast-fail, and borrow capacity from Core Runtime if blockers linger.
5. **Test debt re-accumulation** – Mitigation: pair engineers for feature + test writing, block merges lacking parity tests, and monitor coverage dashboards daily.

## 10. Definition of Done
- All ten work items merged with sign-offs from respective squads.
- CI reports 1,616 tests passing (or more) across all platforms.
- Parity inventory published, versioned, and linked in AX-GUIDE with residual backlog prioritized.
- Golden trace harness part of CI smoke suite with documented runbook.
- macOS/Linux/Windows pipelines green with no flaky suppressions active.
- Zero open P0/P1 bugs related to agent behaviors.
- Sprint 3 handoff package prepared (notes, open risks, target tests) and reviewed with leadership.
