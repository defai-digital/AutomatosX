# Sprint 1 PRD — ReScript Core Stabilization

## 1. Sprint Overview
- **Mission**: Stabilize the greenfield ReScript runtime skeleton so it can deterministically orchestrate automations, enforce policies, and expose verifiable contracts to the CLI and TypeScript integration layer.
- **Scope**: Deliver a production-ready core runtime with finalized state machine contracts, hardened rule engine, task planning services, telemetry hooks, and 200 additional runtime-specific tests (716 → 916). Work spans runtime architecture, tooling, and documentation; UI or new feature work is explicitly out-of-scope.
- **Outcome Definition (“stabilized core”)**:
  - Runtime state machine supports all lifecycle states (init → provisioned → executing → resolved → failed/canceled) with guardrails and retries.
  - Rule engine policies evaluated uniformly with deterministic resolution, surfaced to TypeScript consumers via typed contracts.
  - Task planning service exposes cancellable async jobs with dependency awareness.
  - Telemetry + error handling pipelines emit actionable signals (metrics + structured logs) for every significant transition.
  - CI proves stability via ≥916 passing tests, 85%+ runtime code coverage, and a green CLI smoke badge.

## 2. Technical Deep-Dive
### 2.1 State Machine Design
- **States**: `BOOTSTRAPPING`, `IDLE`, `PREPARING`, `EXECUTING`, `WAITING_ON_DEP`, `COMPLETED`, `FAILED`, `CANCELED`.
- **Transitions**:
  - Bootstrapping → Idle once runtime configuration & dependency graph validated.
  - Idle → Preparing when a task plan is accepted.
  - Preparing ↔ Waiting_on_dep while dependencies hydrate; Preparing → Executing when all guards satisfied.
  - Executing → Completed on success; Executing → Failed on fatal errors; Executing → Canceled when cancellation signal accepted.
- **Events**: `TASK_SUBMITTED`, `DEPS_READY`, `RULE_VIOLATION`, `TIMEOUT`, `CANCEL_REQUEST`, `RETRY_TRIGGER`, `TELEMETRY_FLUSHED`.
- **Guards**: Schema validation (Zod), policy evaluation, resource availability, throttle compliance.
- **Actions**: Plan hydration, rule evaluation, effect execution, telemetry emission, rollback dispatch.
- **Implementation Notes**:
  - Represent state graph via typed variants to leverage ReScript exhaustiveness.
  - Provide pure transition functions + side-effect executors for testability.

### 2.2 Rule Engine Specification
- **Policy Types**: Capability (what can run), Safety (resource/time limits), Compliance (data residency), Observability (logging requirements).
- **Condition Evaluation**: Deterministic evaluation pipeline—normalize inputs → evaluate predicates → collect violations → enforce responses (deny, warn, auto-remediate).
- **Enforcement Points**: Pre-plan admission, pre-execution guard, mid-flight monitoring, post-completion auditing.
- **Extensibility**: Policies defined as declarative records w/ metadata, versioning, and priority. Provide TypeScript boundary via generated bindings.

### 2.3 Task Planning Service Contracts
- **Inputs**: Task manifest (id, intent, resources), dependency graph, policy context, cancellation token, telemetry context.
- **Outputs**: Execution plan (ordered steps + dependency locks), policy verdicts, runtime hooks (callbacks), state observable channel.
- **Dependencies**: Rule engine for admission, scheduler for concurrency, telemetry service for event emission.
- **Cancellation**: Cooperative cancellation tokens propagated through state machine; ensure idempotent cleanup.

### 2.4 Telemetry Hooks & Observability
- **Instrumentation**: Transition events, rule engine decisions, resource usage, retries, cancellation requests.
- **Signals**: Metrics (latency, throughput), structured logs (JSON), traces (span per task), alerts (guardrail violations).
- **Implementation**: Provide lightweight Telemetry SDK with pluggable sinks (console, OTLP). Buffer logs until `TELEMETRY_FLUSHED` event to avoid loss.

### 2.5 Error Handling & Resilience Patterns
- Standardize error envelopes with `kind`, `severity`, `actionableNextStep`.
- Retry policies per transition (exponential backoff w/ jitter) for transient failures.
- Circuit breaker for rule engine or telemetry sinks to isolate failures.
- Graceful degradation: fall back to safe no-op or queue for manual review when policies undecidable.

## 3. Work Breakdown Structure
### Item 1. Runtime State Machine Skeleton
- **Description**: Implement typed state machine core, transitions, event dispatcher, and effect boundaries.
- **Acceptance Criteria**:
  - [ ] Exhaustive pattern matching prevents illegal transitions.
  - [ ] State diagram documented and reviewed with architect.
  - [ ] Unit tests cover every transition + guard path.
- **Estimate**: 18h
- **Dependencies**: None
- **Risks**: Over-fitting early design; mitigate via review checkpoints.

### Item 2. Transition Guard Library
- **Description**: Build reusable guard helpers (schema validation, rate limits, dependency checks) invoked before transition commits.
- **Acceptance Criteria**:
  - [ ] Guard API accepts context + returns structured verdict.
  - [ ] Guard failures emit telemetry + actionable error.
  - [ ] Property tests cover guard combinators.
- **Estimate**: 12h
- **Dependencies**: Item 1
- **Risks**: Guard churn causing regressions; enforce contract tests.

### Item 3. Rule Engine Core
- **Description**: Implement policy registry, condition evaluator, enforcement actions, and TypeScript boundary types.
- **Acceptance Criteria**:
  - [ ] Policies hot-swappable without runtime restart.
  - [ ] Deterministic evaluation order with tie-break rules.
  - [ ] Integration tests prove deny/warn/remediate flows.
- **Estimate**: 20h
- **Dependencies**: Item 1, Item 2
- **Risks**: Policy explosion; mitigate by scoping MVP policies.

### Item 4. Policy Definition DSL & Validation
- **Description**: Define declarative schema (likely JSON/ReScript record) + validation via Zod for TypeScript consumers.
- **Acceptance Criteria**:
  - [ ] Schema published + versioned.
  - [ ] CLI ingestion path validated.
  - [ ] Snapshot tests cover representative policies.
- **Estimate**: 10h
- **Dependencies**: Item 3
- **Risks**: Schema drift; mitigate via contract tests.

### Item 5. Task Planning Service Adapter
- **Description**: Implement service contract exposing plan creation, dependency resolution, cancellation, and progress streaming.
- **Acceptance Criteria**:
  - [ ] API documented with request/response examples.
  - [ ] Supports cancellation tokens passed through runtime.
  - [ ] Integration tests cover dependency fan-in/out.
- **Estimate**: 16h
- **Dependencies**: Item 1, Item 3
- **Risks**: Async coordination bugs; use deterministic schedulers in tests.

### Item 6. Runtime Test Harness Bootstrap
- **Description**: Extend Vitest setup for ReScript runtime, add fixtures/mocks, deliver first 100 runtime tests (Week 1 goal).
- **Acceptance Criteria**:
  - [ ] Harness isolates pure transitions from side effects.
  - [ ] 100 tests added + documented tagging convention.
  - [ ] Coverage report available in CI artifact.
- **Estimate**: 14h
- **Dependencies**: Items 1–3
- **Risks**: Slow tests; enforce parallel execution + deterministic seeds.

### Item 7. CLI Contract + Smoke Badge Integration
- **Description**: Define CLI/runtime interface, wire smoke badge to runtime tests + rule engine outcomes.
- **Acceptance Criteria**:
  - [ ] CLI contract doc + fixtures checked in.
  - [ ] Smoke workflow green when runtime passes.
  - [ ] Failures provide actionable error to CLI output.
- **Estimate**: 12h
- **Dependencies**: Items 1, 4, 6
- **Risks**: Drift between CLI + runtime; plan weekly sync.

### Item 8. Telemetry Integration
- **Description**: Implement telemetry SDK, instrumentation hooks, OTLP/export plumbing, dashboards stubs.
- **Acceptance Criteria**:
  - [ ] Every transition logs structured event w/ correlation id.
  - [ ] Metrics exported locally and in CI.
  - [ ] Alert thresholds defined for rule violations.
- **Estimate**: 15h
- **Dependencies**: Items 1, 3
- **Risks**: Signal noise; include sampling + log levels.

### Item 9. Error Handling & Resilience Toolkit
- **Description**: Standard error envelope, retry/backoff utilities, circuit breaker, fallback flows.
- **Acceptance Criteria**:
  - [ ] Errors categorized (user/action/platform).
  - [ ] Retries configurable per transition.
  - [ ] Chaos tests simulate failure + prove containment.
- **Estimate**: 13h
- **Dependencies**: Items 1, 2, 8
- **Risks**: Hidden coupling; document invariants.

### Item 10. Runtime Documentation & Knowledge Transfer
- **Description**: Author runtime API docs, onboarding guides, state diagrams, and hold review/demo.
- **Acceptance Criteria**:
  - [ ] Docs published in repo + linked from AX-GUIDE.
  - [ ] Architecture review approved.
  - [ ] Sprint demo deck ready with telemetry + test proof.
- **Estimate**: 8h
- **Dependencies**: Completion of Items 1–9
- **Risks**: Documentation lag; schedule doc hours in calendar.

## 4. Testing Strategy
- **Categories**:
  - Unit tests for pure transition functions, guards, policy evaluators (goal: deterministic, fast).
  - Property-based tests (fast-check bindings) for guard combinators and rule evaluation permutations.
  - Snapshot tests for policy DSL + CLI contracts.
  - Integration tests for task planning flow, telemetry emissions, and cancellation scenarios.
- **What to Test**: All state transitions (happy + failure paths), rule enforcement decisions, telemetry signals, error envelopes, cancellation + retry loops, CLI smoke path.
- **Tooling**: Vitest for ReScript bindings, fast-check for property testing, msw-style mocks for external services, coverage via c8 + ReScript compiler source maps.
- **Targets**: +200 runtime tests (100 by Week 1, 100 by Week 2), ≥85% line coverage on runtime modules, zero flakey tests allowed (rerun strategy before merge).

## 5. Quality Gates
- **Week 1 Gate (end of day 5)**: 100 runtime tests passing, state machine contract reviewed + signed off, threat model updated with runtime vectors. Failure triggers scope freeze + daily checkpoint until recovered.
- **Week 2 Gate (end of sprint)**: 916 total tests passing, rule engine operational in CI, CLI smoke badge green. Failure escalates to release manager, blocks promotion of v2 milestones, and requires RCA before Sprint 2 planning.

## 6. Dependencies & Blockers
- ReScript toolchain readiness (compiler, build pipeline, editor support); resolve with dev-env scripts + CI cache.
- Team ramp-up on ReScript idioms; schedule workshops + pairing.
- Architecture decisions pending (state machine versioning, telemetry backend). Need architect + product sign-off by Day 3.
- Integration with existing TypeScript layer; define boundary contracts + validation via Zod early to avoid impedance mismatch.

## 7. Success Metrics
- Tests: ≥916 passing (net +200 runtime tests).
- Coverage: ≥85% line coverage on runtime packages.
- Build: <2 min full compile in CI with caching.
- Documentation: Runtime API + CLI contract docs merged.
- Quality: 0 open P0/P1 defects at sprint close.

## 8. Team Structure & Ownership
- **Core Runtime Squad**: 2 ReScript engineers (implementation), 1 architect (design sign-off + reviews). Daily pairing on state machine + rule engine.
- **Quality Squad**: 1 QA lead + 2 SDETs owning harness, property tests, flake triage.
- **Security Squad**: 1 engineer embedded 3 days/week for threat model + policy review.
- **DevOps Squad**: 2 engineers handling CI pipelines, telemetry sinks, smoke badge automation.
- **Ceremonies**: Daily standups (15 min), mid-week pairing blitz, code review SLA 4h, demo + retrospective Fridays.

## 9. Risk Management
1. **ReScript Learning Curve** — Mitigation: schedule pair programming, maintain reference snippets, architect office hours.
2. **State Machine Complexity** — Mitigation: deliver MVP path first, use visual diagram tooling, enforce transition reviews.
3. **Test Infrastructure Delays** — Mitigation: Quality squad kicks off harness in parallel, reuse Vitest scaffolding, add pre-commit hooks.
4. **TypeScript Integration Drift** — Mitigation: finalize contracts by Day 4, employ Zod validation, add contract tests in CI.
5. **Runtime Performance Issues** — Mitigation: profile early using benchmarks, set latency budgets, optimize hot paths iteratively.

## 10. Definition of Done
- All 10 work items delivered, reviewed, and merged to main.
- CI shows 916 passing tests with ≥85% runtime coverage.
- Runtime API + contract documentation published + communicated.
- No known security vulnerabilities (Security squad sign-off).
- Sprint demo completed with stakeholder approval and CLI smoke badge green.
