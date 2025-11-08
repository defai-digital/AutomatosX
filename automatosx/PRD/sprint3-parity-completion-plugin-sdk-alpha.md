# Sprint 3 PRD — Parity Completion & Plugin SDK Alpha (Weeks 5–6)

## 1. Sprint Overview
- **Mission**: Complete v1 test parity and lay the Plugin SDK foundation so teams can extend AutomatosX safely while keeping existing workflows trustworthy.
- **Scope**: Finish the outstanding 500 parity tests (1,616 → 2,116), harden golden traces, and deliver Plugin SDK Alpha (manifest, lifecycle hooks, CLI scaffolding, two internal plugins, documentation).
- **Outcome Definition**:
  - All parity gaps from Sprint 2 closed with deterministic coverage (agent memory, CLI edges, provider fallbacks).
  - Plugin SDK Alpha consumable via CLI scaffolding, manifest validation, lifecycle hooks, runtime loader, and two operational internal plugins.
  - Golden trace corpus expanded from 100 to 150 transcripts with zero critical diffs.
  - CI reports 2,116 tests passing with plugin modules at ≥90% coverage.

## 2. Technical Deep-Dive
### 2.1 Parity Test Coverage Strategy
- **Residual gaps**: 250 tests for agent memory flows, CLI edge cases, provider fallback resilience, and regression tests for error recovery discovered late in Sprint 2.
- **Approach**: Extend the parity ledger to trace every missing scenario back to v1 transcripts, sequence writing by user impact (memory > fallback > CLI), and enforce pair-programming for tests + fixes.
- **Tooling**: Reuse Vitest + fast-check harness, add SQLite fixtures for agent memory, and supply determinism toggles for provider mocks.

### 2.2 Plugin SDK Architecture
- **Manifest structure**: `plugin.toml` (name, version, compatibility, capabilities, permissions, telemetry posture) + TypeScript schema auto-generated with Zod for CLI validation.
- **Lifecycle hooks**: `init`, `plan`, `act`, `recover`, each receiving context (workspace, memory, telemetry, cancellation tokens). Hooks run inside isolated runtime contexts with explicit capability grants.
- **Isolation model**: Namespaced WorkspaceManager channels, sandboxed command execution with allowlisted syscalls, and policy-enforced resource budgets. Property-based tests stress cross-plugin leakage and guardrail enforcement.

### 2.3 Plugin Scaffolding CLI
- **Commands**: `ax plugin create <name>` (scaffold TS project + manifest + sample tests), `ax plugin install <pkg>` / `ax plugin remove <pkg>`, `ax plugin list` for introspection.
- **Features**: Template selection (agent, tool, workflow), opt-in telemetry wiring, local registry linking, and manifest linting before installation.
- **Developer UX**: Inline docs + prompts, dry-run flag, compatibility checks against current AutomatosX version.

### 2.4 Plugin Runtime Integration
- **Loader**: Resolves manifests, enforces compatibility, hydrates lifecycle hooks, and registers capability descriptors with the ReScript runtime.
- **Lifecycle management**: Structured event bus for hook transitions, per-plugin error envelopes, retry/fallback strategy (retry `init` once, downgrade `plan` to safe defaults, escalate `act` failures, auto-invoke `recover`).
- **Error handling**: Granular telemetry, plugin-level circuit breakers, and fallback to built-in behaviors when alpha plugins misbehave.

### 2.5 Golden Trace Test Expansion
- **Goal**: Increase transcripts from 100 → 150 to cover memory-heavy sessions, CLI automation loops, and plugin-aware scenarios.
- **Execution**: Quality squad sources additional v1 transcripts, tags each with agent + provider combos, and ensures plugin-mode traces validate new lifecycle instrumentation.
- **Output**: 150 deterministic traces wired into CI nightly, feeding parity dashboards and supporting regression detection for plugin-enabled runs.

## 3. Work Breakdown Structure
### Item 1. Parity Gap Closure (Remaining 250 Tests)
- **Description**: Finish the outstanding parity ledger items (memory, CLI, provider fallbacks) with deterministic tests and documented mappings to v1 behaviors.
- **Acceptance Criteria**:
  - [ ] 250 new parity tests merged with trace IDs.
  - [ ] Parity ledger marked “zero known gaps” and linked in AX-GUIDE.
  - [ ] All tests run green across macOS/Linux runners.
- **Estimate**: 40h
- **Dependencies**: Sprint 2 parity inventory
- **Risks**: Hidden v1 behaviors may surface late; mitigate with daily parity triage.

### Item 2. Agent Memory Integration Test Suite
- **Description**: Author integration tests that exercise agent memory reads/writes, semantic search, and caching behavior through the CLI bridge.
- **Acceptance Criteria**:
  - [ ] 60 new integration tests covering memory query permutations.
  - [ ] Deterministic SQLite fixtures checked into repo.
  - [ ] Memory regressions auto-open GitHub issues via CI hook.
- **Estimate**: 24h
- **Dependencies**: Item 1, memory builders from Sprint 2
- **Risks**: File-lock flakes; mitigate with per-test DB copies.

### Item 3. CLI Edge Case Coverage Pack
- **Description**: Expand CLI tests for streaming logs, cancellation, malformed manifests, and workspace boundary enforcement.
- **Acceptance Criteria**:
  - [ ] 50 CLI tests covering error surfaces, telemetry toggles, and cancellation.
  - [ ] Snapshot diffs stable across shells.
  - [ ] CLI help/docs updated for new flags.
- **Estimate**: 20h
- **Dependencies**: CLI bridge enhancements (Sprint 2)
- **Risks**: Snapshot churn; introduce normalizers.

### Item 4. Provider Fallback & Error Recovery Harness
- **Description**: Simulate provider failures, backpressure, and quota loss to validate fallback policies and recovery flows.
- **Acceptance Criteria**:
  - [ ] Chaos toggles for Claude/Gemini/OpenAI integrated into tests.
  - [ ] 40 tests covering failover + error surfacing.
  - [ ] Telemetry proves fallback latency <2× baseline.
- **Estimate**: 24h
- **Dependencies**: Multi-provider routing (Sprint 2)
- **Risks**: Mock drift vs. real APIs; schedule validation with provider logs.

### Item 5. Golden Trace Expansion (100 → 150)
- **Description**: Curate and automate 50 additional transcripts focusing on memory-heavy and plugin-aware scenarios.
- **Acceptance Criteria**:
  - [ ] 150 total traces replay nightly with zero critical diffs.
  - [ ] Each trace annotated with capabilities + expected outcomes.
  - [ ] Documentation updated with trace selection rubric.
- **Estimate**: 18h
- **Dependencies**: Items 1–4
- **Risks**: Transcript sourcing delays; use product support backlog as fallback.

### Item 6. Plugin Manifest Specification & Validator
- **Description**: Finalize `plugin.toml` schema, generate Zod validators, and wire manifest checks into CLI + runtime.
- **Acceptance Criteria**:
  - [ ] Manifest spec published with versioning + migration guidance.
  - [ ] CLI blocks invalid manifests with actionable errors.
  - [ ] Validation tests cover positive/negative cases (40 tests).
- **Estimate**: 28h
- **Dependencies**: Item 9 (CLI scaffolding) for integration hooks
- **Risks**: Scope creep on schema; enforce alpha-friendly minimal surface.

### Item 7. Lifecycle Hooks Implementation
- **Description**: Implement `init/plan/act/recover` hook contracts in TypeScript + ReScript runtime with typed contexts and guardrails.
- **Acceptance Criteria**:
  - [ ] Hooks executed with capability-scoped contexts.
  - [ ] Retry/backoff policies documented and tested.
  - [ ] 80 hook-specific tests (unit + integration) green.
- **Estimate**: 36h
- **Dependencies**: Item 6, runtime APIs from Sprint 1
- **Risks**: Hook ordering bugs; add state diagrams + reviews.

### Item 8. Plugin Runtime Loader & Isolation Layer
- **Description**: Build loader that resolves manifests, spins up isolated plugin sandboxes, and manages lifecycle transitions with telemetry + error handling.
- **Acceptance Criteria**:
  - [ ] Loader supports hot reload in dev mode and deterministic ordering in CI.
  - [ ] Isolation tests prove plugins cannot escape assigned workspace roots.
  - [ ] Property-based tests stress concurrency + resource budgets.
- **Estimate**: 40h
- **Dependencies**: Item 7
- **Risks**: Isolation regressions; run nightly stress suite.

### Item 9. Plugin CLI Scaffolding & Package Management
- **Description**: Ship `ax plugin create/install/list/remove` with templates, dependency wiring, and local registry awareness.
- **Acceptance Criteria**:
  - [ ] CLI scaffolds TS project with runnable tests in <30s.
  - [ ] Install/remove commands manage `.automatosx/plugins/`.
  - [ ] 50 CLI automation tests cover success/failure paths.
- **Estimate**: 32h
- **Dependencies**: Item 6 (manifest schema)
- **Risks**: Dependency resolution bugs; include dry-run + rollback.

### Item 10. Internal Plugin — Telemetry Export
- **Description**: Build telemetry-export plugin that streams structured events to configurable sinks (file, OTLP mock) using SDK hooks.
- **Acceptance Criteria**:
  - [ ] Plugin registers `act` + `recover` hooks with backpressure handling.
  - [ ] 30 dedicated tests validate buffering, retries, and failures.
  - [ ] Docs include configuration walkthrough.
- **Estimate**: 24h
- **Dependencies**: Items 6–9
- **Risks**: Performance overhead; enforce sampling controls.

### Item 11. Internal Plugin — Code Intelligence Booster
- **Description**: Implement code-intelligence plugin that enriches planning with repository heuristics and cross-file context.
- **Acceptance Criteria**:
  - [ ] Plugin delivers measurable plan improvements on sample repos.
  - [ ] 35 tests cover heuristics + guardrails.
  - [ ] Hook outputs observable via CLI debug flag.
- **Estimate**: 28h
- **Dependencies**: Items 7–9
- **Risks**: Determinism issues; use fixture repos + snapshots.

### Item 12. Plugin SDK Documentation & Release Package
- **Description**: Author SDK guide, API reference, quickstart, and publish alpha artifacts + release notes.
- **Acceptance Criteria**:
  - [ ] Docs merged into AX-GUIDE + docs site with version tags.
  - [ ] Release notes summarize scope, limitations, install steps.
  - [ ] Sprint demo deck showcases parity metrics + SDK walkthrough.
- **Estimate**: 16h
- **Dependencies**: Items 6–11
- **Risks**: Doc lag; block sprint exit on doc sign-off.

## 4. Testing Strategy
- **500 new tests**: 250 parity (Items 1–5) + 250 Plugin SDK (Items 6–11).
  - Parity: 60 memory, 50 CLI edge, 40 provider fallback, 50 regression/backfill, 50 golden trace assertions.
  - Plugin SDK: 40 manifest validation, 80 lifecycle hooks, 60 runtime loader/isolation (incl. property-based), 40 CLI scaffolding, 30 telemetry plugin, 30 code-intelligence plugin.
- **Property-based testing**: fast-check suites target plugin isolation (workspace boundaries, capability grants) and loader concurrency to ensure no cross-plugin contamination.
- **Integration tests**: Full-stack flows invoking CLI scaffolding → manifest validation → runtime registration → lifecycle execution for both internal plugins, run on macOS + Linux.
- **Golden trace validation**: Replay harness extends to plugin-aware traces; failure auto-opens flake/bug with attached diff + telemetry snapshot.
- **Quality instrumentation**: Coverage gates enforce ≥90% on plugin modules and ≥85% on updated CLI/runtime files; flake bot reruns failing suites twice before tagging owners.

## 5. Quality Gates
- **Week 5 Gate (Day 25)**:
  - 1,866 tests passing (net +250).
  - All parity ledger items closed and reviewed.
  - Golden traces at 150 with nightly green run.
  - Go/No-go: Failure pauses SDK work; focus shifts to parity triage until gate satisfied.
- **Week 6 Gate (Day 30)**:
  - 2,116 tests passing (net +500).
  - Plugin SDK Alpha (manifest, hooks, loader, CLI) feature-complete with two internal plugins operational.
  - Documentation + release kits published, demo rehearsed.
  - Go/No-go: Any miss blocks v2 Phase 3 kickoff; requires RCA + exec review.

## 6. Dependencies & Blockers
- **Sprint 2 exit state**: 1,616 tests passing, golden trace harness stable, CLI bridge enhancements merged.
- **Sprint 1 runtime stability**: ReScript core + rule engine must remain green to host plugin hooks.
- **Pending decisions**: Manifest format finalization (TOML vs. JSON) and lifecycle hook signatures; need approval by Day 22 to avoid rework.
- **External**: Provider credentials + rate limits for fallback testing; ensure quotas reserved for chaos tests.

## 7. Success Metrics
- Tests: 2,116 automated tests passing in CI (500 added this sprint).
- Coverage: ≥90% line coverage on plugin SDK modules, ≥85% on CLI/runtime touched areas.
- Plugin SDK: Telemetry-export + code-intelligence plugins installed and running in demo environment with zero critical bugs.
- Documentation: Plugin SDK guide, manifest reference, and internal plugin quickstarts published and linked from AX-GUIDE + AX CLI help.
- Reliability: Golden trace suite (150) green three consecutive nights; provider fallback latency budget met (<2× baseline).

## 8. Team Structure & Ownership
- **CLI/TypeScript Squad (3 engineers)**: Own Items 3, 6, 9, and support manifest validation + CLI UX.
- **Quality Squad (3 people)**: Lead Items 1, 2, 4, 5, and overall testing strategy + flake triage.
- **Runtime Squad (3 engineers)**: Own Items 7 and 8, co-build internal plugins with CLI squad, ensure isolation guarantees.
- **DevOps Squad (2 engineers)**: Enable CI shards for plugin suites, manage artifact publishing, enforce coverage + gate automation.
- **Product Manager (1 person)**: Drives prioritization, stakeholder updates, demo narrative, and owns Definition of Done checklist.
- Collaboration rhythms: Daily standups, mid-sprint gate review (Day 25), cross-squad test triage twice weekly, and demo rehearsal Day 29.

## 9. Risk Management
1. **Plugin isolation complexity** — Mitigation: design reviews + property-based tests before merging loader changes; add kill switches per plugin.
2. **SDK surface ballooning** — Mitigation: constrain alpha scope to manifest + four hooks; defer extras (analytics, custom storage) to Phase 3 backlog.
3. **Golden trace maintenance burden** — Mitigation: automation for transcript ingestion + diff triage; rotate Quality owners weekly.
4. **Late parity discoveries** — Mitigation: keep parity bug bash running until Day 23; if new gaps emerge, trade lower-priority SDK nice-to-haves.
5. **CLI scaffolding churn across OS** — Mitigation: matrix tests on macOS/Linux + shell snapshot normalizers; provide quick patch instructions.

## 10. Definition of Done
- All 12 work items merged with reviews, linked issues closed, and owners recorded.
- CI dashboard shows 2,116 passing tests with ≥90% coverage on plugin modules and no open P0/P1 defects.
- Plugin SDK Alpha published: CLI scaffolding, manifest validator, lifecycle hooks, runtime loader, telemetry-export plugin, code-intelligence plugin.
- Documentation + release notes live (AX-GUIDE + docs site), and sample plugins install via CLI without manual tweaks.
- Sprint 3 demo delivered to stakeholders demonstrating parity metrics, plugin workflows, and golden trace health, with approval logged for Phase 3 kickoff.
