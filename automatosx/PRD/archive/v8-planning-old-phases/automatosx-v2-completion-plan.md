# AutomatosX Completion Plan — Product Requirements Document

## 1. Executive Summary
- **Vision**: Deliver AutomatosX as a production-grade, privacy-first automation fabric that is faster, cheaper, and more extensible than v1 while matching feature parity and exceeding reliability benchmarks.
- **Current Status**: Core foundations (Code Intelligence, Query Optimization, Privacy Telemetry, enhanced CLI UX) are complete with 13 language parsers, 716 total tests (97.2% pass), and 50–200x faster code queries (8–12 ms).
- **Remaining Gap (≈50–60%)**: Missing 1,707 tests to reach full agent parity, ReScript runtime maturity (state machines, rule engine, planning, retry), Plugin SDK, production-grade deployment pipeline, and P2 advanced features (WASM sandbox, reranking, language filters, incremental indexing).
- **Outcome**: Ship v2 GA within 12 weeks through staged execution that locks parity first, then extensibility, then advanced performance tooling—all without regressing cost, latency, or privacy guarantees.

## 2. Product Vision & Goals
- **Complete Definition**: v2 is “complete” when we deliver deterministic multi-agent orchestration, Plugin SDK extensibility, v1 command/test parity, production release readiness (npm, docs, CI/CD), and advanced runtime features that keep AutomatosX ahead on speed, cost, and privacy.
- **User Value**:
  - **Developers** gain consistent outcomes with self-healing task plans, replayable histories, and plugin-driven customization.
  - **Teams** gain governance: telemetry is opt-in, auditable, and minimal-cost while workflows are faster (≤15 ms query response) and cheaper (free vs. $0.01 per query).
  - **Partners** gain a clear SDK to embed AutomatosX intelligence into their tools.
- **Success Criteria**:
  - 100% parity with v1 agent behaviors and 2,423 automated tests.
  - ≤1% failed CLI sessions caused by platform errors (rolling 7-day).
  - Plugin SDK produces three third-party plugins within 30 days post-GA.
  - Production publish (npm) with SLA-backed CI/CD and docs.

## 3. Technical Architecture
- **ReScript Core Runtime**
  - Event-driven state machines orchestrating agents, retries, and fallbacks.
  - Rule engine to enforce pre/post-conditions, guardrails, and telemetry hooks.
  - Task planning service that composes workflows, handles cancellation, and records provenance into the memory DB.
- **TypeScript Integration Layer**
  - Bridges CLI commands, provides generated type bindings from ReScript artifacts, and mediates plugin registration.
  - Hosts validation via Zod schemas, CLI UX rendering, and shell adapters (zsh/bash/pwsh).
- **Plugin SDK**
  - TypeScript-first developer kit with scaffolding command, lifecycle hooks (init, plan, act, recover), capability descriptors, and sandbox guards.
  - Supports parser extensions, command injectors, and custom agent definitions; aligns with WorkspaceManager IO contracts.
- **Agent System**
  - Catalog stored in `.automatosx/agents/` with metadata for persona, expertise, latency, and costs.
  - ReScript runtime schedules agents, surfaces in CLI (ax list/run), and logs telemetry to SQLite FTS5 DB.
- **Production Infrastructure**
  - GitHub Actions → npm publish (beta, RC, GA) with signed artifacts.
  - Regression gate: full 2,423-test suite + smoke tests on macOS/Linux/Windows containers.
  - Observability stack (structured logs, privacy-first telemetry, optional OpenTelemetry exporters).
- **Advanced Compute Layer (P2)**
  - WASM sandbox for untrusted plugins.
  - Reranking/semantic filters to boost query relevance.
  - Incremental indexing service to keep large repos fresh without full re-scans.

## 4. Feature Specifications
### 4.1 ReScript Core Runtime
- Deterministic state machines covering task lifecycle: `Initialized → Planned → Executing → Reviewing → Completed/Failed`.
- Rule engine supports declarative retries (max attempts, cooldown) and fallback agent escalation.
- Planner consumes repo signals (size, languages, test coverage) to prioritize subtasks; exposes debug traces via `ax flow --plan`.
- Built-in resilience features: checkpointing, resumable runs, cancellation interrupts, and privacy gates around file/command access.

### 4.2 Plugin SDK
- CLI scaffold `ax agent create <name>` generating TypeScript + ReScript bindings, manifest, and sample tests.
- Capability descriptors (skills, inputs, outputs, cost hints) and guardrails (workspace isolation, telemetry opt-in/out flags).
- Test harness for plugin authors with mocked ReScript runtime + fixtures; integrates into `ax lint/flow` for validation.
- Distribution model: publish to `.automatosx/plugins/` registry manifest with semantic versioning and compatibility metadata.

### 4.3 Agent Parity & Test Coverage
- Backfill the missing 1,707 tests across orchestration, CLI commands, and agent behaviors with structured inventory per domain (parsing, planning, execution, recovery).
- Introduce golden trace tests that replay v1 transcripts through v2 runtime to ensure behavioral parity.
- Expand language adapters for ReScript runtime to support 13 existing languages plus hooks for new ones in SDK.

### 4.4 Production Deployment
- CI/CD pipeline with gated branches: `main` (stable), `release/*` (RC), `develop` (integration).
- Automated semantic versioning + changelog generation, signed npm packages, SBOM export, and privacy documentation updates.
- Documentation bundle (AX-GUIDE updates, API reference, migration cookbook) shipped alongside release artifacts.

### 4.5 P2 Advanced Features
- **WASM sandbox**: run plugin analyzers in isolated WASM runtime with CPU/memory quotas, deterministic IO, and kill switches.
- **Query reranking + language filters**: combine BM25 + semantic reranking to boost `ax find/def` accuracy; expose `--lang` and `--relevance` flags.
- **Incremental indexing**: background worker detects git diffs and updates partial AST/metadata caches to keep queries fresh without full repo reindex.

## 5. Implementation Phases (Weeks 1–12)
| Phase | Weeks | Focus | Key Deliverables |
|-------|-------|-------|------------------|
| **Phase 1 – Stabilize Core** | 1–2 | Harden ReScript runtime skeleton, finalize state machine contract, backfill core unit tests, document planner APIs. | Runtime alpha, planner traces, 200 new tests covering lifecycle + retries. |
| **Phase 2 – Parity & Coverage** | 3–5 | Port remaining v1 behaviors, add 900 regression tests, ship golden trace harness, expand CLI smoke coverage on macOS/Linux/Windows. | 80% test parity (1,940/2,423 tests), nightly parity dashboard. |
| **Phase 3 – Plugin & SDK Beta** | 6–7 | Deliver SDK scaffolding, plugin lifecycle hooks, sample plugins, SDK docs, and security audits. | SDK beta, two internal plugins, WorkspaceManager guard validations. |
| **Phase 4 – Production Readiness** | 8–9 | Build CI/CD, npm publish pipeline, docs + release notes automation, telemetry hardening, privacy review. | Signed npm RC, docs freeze, telemetry compliance checklist, 95% pass automation. |
| **Phase 5 – Advanced Features & GA** | 10–12 | Launch WASM sandbox MVP, reranking/language filters, incremental indexing, close final 20% of tests, GA release. | 100% test parity, WASM beta, reranking live behind flag, GA tag + marketing kit. |

## 6. Success Metrics
- **Quality & Reliability**: 100% of 2,423 automated tests passing in CI; <0.5% user-reported regressions in first 30 days.
- **Performance**: Maintain 8–12 ms query latency P50 (≤20 ms P95) and keep cost per query at $0; full flow latency reduced 30% vs v1.
- **Adoption**: 70% of active v1 users migrate within 60 days; 3+ third-party plugins published within 30 days of GA; ≥50 weekly active AutomatosX sessions per large repo.
- **Operational**: CI success rate ≥98%; release pipeline time <45 minutes; telemetry opt-in rate ≥35% with zero privacy violations.

## 7. Testing Strategy
- **Test Inventory & Tracking**: Single source-of-truth spreadsheet/Notion board mirroring 2,423 v1 tests with status, owner, and blockers; integrated with CI dashboards.
- **Porting Approach**:
  - Phase 1: Core runtime unit tests (state transitions, rule engine).
  - Phase 2: Golden trace suite replaying v1 transcripts; CLI end-to-end tests for each command on macOS/Linux/Windows.
  - Phase 3+: Plugin SDK harness tests + WASM sandbox security tests.
- **Automation**:
  - Parallelize suites in GitHub Actions using matrix build; enforce “no merge if <100% parity”.
  - Nightly long-run flows (ax flow, ax lint, ax find/def) on representative repos.
  - Telemetry-based anomaly detection: flag spikes in retries, failures, or timeouts.

## 8. Migration Path
- **Compatibility Layer**: Maintain identical CLI syntax and flags; TypeScript adapters map legacy behaviors to new ReScript handlers.
- **Opt-In Rollout**: Provide `AX_V2=1` environment flag in weeks 3–6, switch default in week 10, keep v1 fallback for two releases post-GA.
- **Migration Toolkit**:
  - CLI command `ax status` surfaces parity progress and highlights missing workflows for users.
  - Cookbook guides, change logs, and video snippets showing new runtime behaviors.
- **Data & Telemetry**: Memory DB schema remains compatible; migration script validates indexes and backs up `.automatosx/memory/memories.db` automatically.

## 9. Risk Assessment
| Risk | Impact | Likelihood | Mitigation | Owner |
|------|--------|------------|------------|-------|
| Runtime instability from new ReScript state machines | High | Medium | Incremental rollout with feature flags, exhaustive unit tests, shadow runs comparing v1 vs v2 outputs. | Core Runtime Lead |
| Test debt (1,707 missing tests) delaying GA | High | Medium | Dedicated “Parity squad”, weekly coverage reviews, automated dashboards, enforce merge gates. | Quality Lead |
| Plugin SDK security issues | High | Medium | WASM sandbox, WorkspaceManager access policies, static analysis on plugins before publish. | Security Lead |
| CI/CD bottlenecks or npm publish delays | Medium | Medium | Parallel pipelines, pre-release dry runs, artifact signing rehearsals. | DevOps Lead |
| Adoption lag from v1 loyalists | Medium | Medium | Targeted comms, opt-in flags, migration assistance, track satisfaction metrics. | Product Marketing |
| Telemetry/privacy regressions | High | Low | Privacy reviews, automated redaction tests, legal sign-off before GA. | Privacy Officer |

## 10. Resource Requirements
- **Team**
  - Core Runtime Squad (2 ReScript engineers, 1 architect).
  - CLI/TypeScript Squad (3 engineers covering commands, SDK, WorkspaceManager).
  - Quality & Reliability (1 lead + 2 SDETs) to drive test parity and automation.
  - DevOps & Release (2 engineers) for CI/CD, packaging, and observability.
  - Security & Privacy (1 engineer, shared analyst) for sandboxing and compliance.
  - Product/Docs (1 PM, 1 writer) for roadmap, comms, and documentation updates.
- **Infrastructure**
  - GitHub Actions runners with macOS/Linux/Windows coverage and WASM toolchains.
  - Test artifact storage (S3 or equivalent) for golden traces and telemetry snapshots.
  - Dedicated staging npm org for RCs; feature-flag service (LaunchDarkly or lightweight config) for runtime toggles.
- **Budget (Quarterly Rough Order)**
  - Cloud + CI: $12k (runners, storage, monitoring).
  - Tooling & licenses (LaunchDarkly, security scanners): $4k.
  - Contingency for contractor/consultant support (SDK reviews, docs): $8k.

---

Build the right thing, not just things right. Completing AutomatosX means shipping parity, extensibility, and production confidence together so users realize faster, cheaper, safer automation outcomes.
