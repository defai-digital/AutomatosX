# P0 Week 1 Day 1 – Decision Log

## Cluster Decisions

### CLI Cluster (26 modules)
- **Disposition:** Conditional
- **Key Findings:**
  - P0 CLI parity shows 8/26 modules Complete or Ready for QA; the remaining P0 scope stays In Progress/In Review, so we need disciplined follow-through to hit parity.
  - `src/cli/commands/gemini.ts` remains blocked until Gemini streaming parity and fallback behavior are resolved, leaving users without Gemini management in v2.
  - `src/cli/commands/memory.ts` and `src/cli/commands/runs.ts` have not started; both depend on backend readiness (`memory-search-service.ts`, TelemetryHook) and jeopardize the expectation of v1-equivalent flows.
  - `src/cli/shared/workspace-target-resolver.ts` is still unscheduled, which keeps workspace alias validation from running end-to-end.
- **Flagged Modules:**

| Module | Status | Note |
|---|---|---|
| `src/cli/commands/gemini.ts` | Blocked | Waiting on Gemini streaming parity; CLI cannot expose Gemini controls until fallback defined. |
| `src/cli/commands/memory.ts` | Not Started | Depends on `src/memory/memory-search-service.ts` contract and DAO updates. |
| `src/cli/commands/runs.ts` | Not Started | Requires telemetry aggregation refresh to replace v1 runs list behavior. |
| `src/cli/shared/workspace-target-resolver.ts` | Not Started | Blocks workspace command alias resolution verification. |

- **Risks:** R-1, R-2, R-4
- **Action Items:** AI-1, AI-2, AI-3, AI-5
- **Dependencies:** Memory & Code Intelligence (`src/memory/memory-search-service.ts`, `src/memory/memory-index.ts`), Providers (`src/providers/gemini-streaming.ts`), Core Runtime instrumentation (`src/core/telemetry-dispatcher.ts`)

### Core Runtime Cluster (36 modules)
- **Disposition:** Conditional
- **Key Findings:**
  - 12/36 modules are Complete or Ready for QA, yet key P0 foundations (`src/core/memory-manager.ts`, `src/core/telemetry-dispatcher.ts`, `src/core/execution-metrics.ts`) have not started, leaving runtime orchestration without persistence or observability coverage.
  - ReScript integration pieces (`src/core/state-machine-adapter.ts`, `src/core/validation-pipeline.ts`) are mid-implementation with no feature-flag gating or rollback story documented.
  - Runtime telemetry lacks an agreed plan, so operational readiness is unverifiable.
- **Flagged Modules:**

| Module | Status | Note |
|---|---|---|
| `src/core/memory-manager.ts` | Not Started | Awaiting memory service API to wire persistence layer. |
| `src/core/telemetry-dispatcher.ts` | Not Started | No instrumentation plan; threatens operational visibility (R-4). |
| `src/core/execution-metrics.ts` | Not Started | Metrics aggregation undefined; runtime health cannot be monitored. |
| `src/core/state-machine-adapter.ts` | In Progress | Needs documented feature flag + rollback (ADR-011) before merge. |

- **Risks:** R-2, R-3, R-4
- **Action Items:** AI-2, AI-4, AI-5, AI-7
- **Dependencies:** Memory & Code Intelligence (`src/memory/memory-search-service.ts`), DevOps telemetry stack, Workflow engines (`src/workflows/plan-generator.ts`)

### Agents Cluster (10 modules)
- **Disposition:** Conditional
- **Key Findings:**
  - AgentExecutor, ProfileLoader, and AgentContextManager are on track, but agent-memory integration has not begun, so agents cannot access v2 memory features.
  - Delegation refactor work is underway without final capability alignment, raising coordination concerns with `src/agents/capability-matrix.ts`.
- **Flagged Modules:**

| Module | Status | Note |
|---|---|---|
| `src/agents/agent-memory-bridge.ts` | Not Started | Depends on `src/core/memory-manager.ts`; blocks memory-backed context (R-2). |
| `src/agents/delegation-parser.ts` | In Progress | Needs updated capability mapping once refactor lands; tests pending. |

- **Risks:** R-2
- **Action Items:** AI-2, AI-4
- **Dependencies:** Core Runtime (`src/core/memory-manager.ts`), Memory & Code Intelligence (`src/memory/memory-search-service.ts`)

### Providers Cluster (14 modules)
- **Disposition:** Conditional
- **Key Findings:**
  - Base providers (OpenAI, Claude) are close, but `src/providers/openai-assistants.ts` has not started, leaving assistant orchestration parity uncovered.
  - Streaming connectors (`src/providers/gemini-streaming.ts`, `src/providers/openai-streaming.ts`) rely on unresolved upstream parity and lack documented fallback to align with ADR-010.
  - Telemetry expectations for provider retries/failover are not yet tied into the runtime instrumentation plan.
- **Flagged Modules:**

| Module | Status | Note |
|---|---|---|
| `src/providers/openai-assistants.ts` | Not Started | Ownership confirmed but implementation not kicked off; required for assistant parity. |
| `src/providers/gemini-streaming.ts` | In Progress | Upstream API parity unresolved; directly tied to CLI `GeminiCommand` (R-1). |
| `src/providers/openai-provider.ts` | In Progress | Load-testing evidence missing for new retry settings; keep on radar. |

- **Risks:** R-1, R-4
- **Action Items:** AI-1, AI-5, AI-6
- **Dependencies:** CLI (`src/cli/commands/gemini.ts`, `src/cli/commands/run.ts`), DevOps streaming monitoring, ADR-010 updates

### Memory & Code Intelligence Cluster (44 modules)
- **Disposition:** Conditional
- **Key Findings:**
  - Core memory primitives (MemoryIndex, DAO, migrations) are in progress or in review, yet `src/memory/memory-search-service.ts` remains not started, blocking CLI and agent parity.
  - Schema updates (`src/memory/memory-schema.ts`) need reconciliation with code graph extensions to avoid future migrations churn.
  - Code intelligence pipeline is still early: ParserOrchestrator and FileScanner are in progress without throughput targets or telemetry, so ingestion SLAs are undefined.
  - Budget-sensitive features (MemoryEmbeddings) are in design with no cost guardrail decisions.
- **Flagged Modules:**

| Module | Status | Note |
|---|---|---|
| `src/memory/memory-search-service.ts` | Not Started | Blocks CLI search and agent context hydration (R-2). |
| `src/memory/memory-schema.ts` | In Review | Must align with new code graph tables before merge. |
| `src/codeintel/parser-orchestrator.ts` | In Progress | No throughput benchmarks; ingestion SLA risk (R-5). |
| `src/codeintel/file-scanner.ts` | In Progress | Lacks instrumentation plan for language coverage metrics. |

- **Risks:** R-2, R-5
- **Action Items:** AI-2, AI-8
- **Dependencies:** Core Runtime (`src/core/memory-manager.ts`), CLI (`src/cli/commands/memory.ts`), Data/QA for parser benchmarking

### Utils & Infrastructure Cluster (93 modules)
- **Disposition:** Conditional
- **Key Findings:**
  - Utilities for logging, retries, and filesystem are progressing, yet `src/utils/task-runner.ts` is still not started, leaving concurrency harness coverage missing.
  - Workflow foundations (`src/workflows/state-graph-builder.ts`, `src/workflows/plan-generator.ts`) require design sign-off and integration with the ReScript state machine adapter.
  - MCP stack remains in design (P1/P2), which aligns with roadmap, but requires coordination once TaskRunner and workflow orchestration are stable.
- **Flagged Modules:**

| Module | Status | Note |
|---|---|---|
| `src/utils/task-runner.ts` | Not Started | Concurrency harness missing; blocks regression parity (R-6). |
| `src/workflows/state-graph-builder.ts` | Design | P0 deliverable still at concept stage; needs spec and acceptance criteria. |
| `src/workflows/plan-generator.ts` | In Progress | Integration with `src/core/state-machine-adapter.ts` unverified; ensure gating (R-3). |

- **Risks:** R-3, R-6
- **Action Items:** AI-5, AI-7, AI-9, AI-10
- **Dependencies:** Core Runtime (`src/core/state-machine-adapter.ts`), QA regression suites, DevOps telemetry for concurrency tests

## Summary
- **Total modules reviewed:** 223
- **Go:** 0 modules (0%)
- **Conditional:** 223 modules (100%)
- **No-Go:** 0 modules (0%)
- **Critical risks requiring immediate attention:** R-1 (Gemini streaming parity), R-2 (Memory search & integration gap), R-3 (ReScript runtime gating)
- **ADR updates needed:** Document ReScript runtime feature flag/rollback as ADR-011; update ADR-010 with Gemini streaming fallback expectations once plan lands.
- **Next review checkpoint:** 2025-01-09 – P0 Week 1 Day 3 readiness sync (focus on closing Conditional actions).

## Action Items Register

| ID | Description | Owner | Due Date | Priority | Blocking |
|---|---|---|---|---|---|
| AI-1 | Unblock `GeminiCommand` by defining Gemini streaming fallback or gating with Providers/DevOps. | Frank | 2025-01-08 | P0 | Yes |
| AI-2 | Ship baseline `MemorySearchService` and wire `MemoryCommand` to new DAO contract. | Bob | 2025-01-09 | P0 | Yes |
| AI-3 | Complete `RunsCommand` parity tests and telemetry linkage for run history. | Frank | 2025-01-09 | P0 | Yes |
| AI-4 | Finalize `MemoryManager` ↔ `AgentMemoryBridge` interface and integration plan. | Bob | 2025-01-09 | P0 | Yes |
| AI-5 | Publish telemetry plan for `TelemetryDispatcher`/`ExecutionMetrics` with DevOps rollout steps. | Oliver | 2025-01-09 | P0 | Yes |
| AI-6 | Kick off `OpenAIAssistants` v2 implementation and share stub by checkpoint. | Bob | 2025-01-09 | P0 | Yes |
| AI-7 | Draft ADR-011 covering ReScript state machine gating, feature flags, and rollback sequencing. | Avery | 2025-01-08 | P0 | Yes |
| AI-8 | Produce parser pipeline performance plan (ParserOrchestrator + FileScanner) with throughput targets. | Avery | 2025-01-10 | P1 | No |
| AI-9 | Start `TaskRunner` refactor to align with `ConcurrencyController` and land unit test scaffold. | Bob | 2025-01-09 | P0 | Yes |
| AI-10 | Secure design sign-off for `StateGraphBuilder` including acceptance tests and integration points. | Avery | 2025-01-09 | P0 | Yes |

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Trigger | Residual Risk |
|---|---|---|---|---|---|---|---|
| R-1 | Gemini streaming parity prevents `GeminiCommand` and `gemini-streaming.ts` from closing. | Medium | High | Execute AI-1 to define fallback/gating and escalate vendor ETA. | Frank | Parity unresolved by 2025-01-08. | Medium |
| R-2 | Memory search stack (MemorySearchService, MemoryManager, Agent bridge) not delivered, blocking CLI and agents. | High | High | Execute AI-2 and AI-4; add daily checkpoint until in review. | Bob | Any component still not in review by 2025-01-09. | Medium |
| R-3 | ReScript runtime ships without feature flag/rollback, risking production instability. | Medium | High | Execute AI-7; confirm gating before merging `state-machine-adapter.ts`. | Avery | Adapter merges without ADR-011 approval. | Low |
| R-4 | Runtime/provider telemetry gaps (TelemetryDispatcher, ExecutionMetrics, provider load tests) hide regressions. | Medium | Medium | Execute AI-5; integrate telemetry validation into regression checklist. | Oliver | Telemetry plan not approved by 2025-01-09. | Low |
| R-5 | Code intelligence ingestion throughput unknown, risking backlog once enabled. | Medium | Medium | Execute AI-8; baseline throughput ≥200 files/min with monitoring hooks. | Avery | No benchmark or throughput <200 files/min by 2025-01-10. | Medium |
| R-6 | `TaskRunner` rework lag delays concurrency regression coverage. | Medium | Medium | Execute AI-9; hook workflow regression tests once scaffold lands. | Bob | `TaskRunner` remains Not Started by 2025-01-09. | Low |

