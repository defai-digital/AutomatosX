# P0 Week 1 Day 2 – QA Feature Preservation Strategy Brief

**Purpose:** Provide cross-functional guidance for preserving v1 feature fidelity throughout the AutomatosX delivery runway.  
**Audience:** QA, Architecture, Standards, Backend, Frontend, Mobile, DevRel, Program Leadership.  
**Frame:** Guardrails for designing, automating, and governing tests tied to the 10 critical feature preservation items.

---

## 1. Testing Approach
- **Risk-based prioritization:** Anchor coverage around the 10 checklist items; treat each as a must-have regression lane with explicit automation targets.  
- **Shift-left validation:** Pair architecture/QA with engineering leads during implementation to define test hooks, feature flags, and telemetry ahead of coding.  
- **Continuous evidence capture:** Require every change impacting a checklist item to include linked automated tests, telemetry validation, and updated traceability entries.  
- **Dual-path execution:** Maintain both smoke verification (gates runs under 10 minutes) and deep regression (parallelizable suites executed nightly) to balance velocity and depth.

## 2. Test Pyramid Strategy
| Layer | Scope & Examples | Coverage Target | Execution Cadence | Primary Owners |
|---|---|---|---|---|
| Unit | Provider router fallbacks, delegation state machine, config validators, cost calculators | ≥90% statement coverage for modules tied to checklist items | On every PR via CI | Feature teams (Bob, Frank, Maya) |
| Service / Integration | Provider router with failover, MCP bridges, memory DAO + sqlite-vec integration, workspace operations | 100% of checklist items with at least one service-level test | On PR (impacted suites) + nightly full run | QA + engineering pair |
| Contract | CLI command interface parity, MCP tool schemas, feature flag toggles | Contract snapshots per interface, diff-checked in CI | On schema change + weekly audit | Standards (Stan) + QA |
| End-to-End / CLI | CLI regression tags, delegation with resumability, spec-driven parallel flows, checkpoint resume | ≥95% pass rate for tagged `@p0-regression` suite | Nightly + pre-release gate | QA (Queenie) |
| Observability / Telemetry | Cost tracking, fallback metrics, resume checkpoints, workspace audit logs | Alerting thresholds defined and monitored | Continuous via production-like environments | DevOps + Architecture |

## 3. Regression Suite Design Principles
- **Tag-driven composition:** Tag all regression-critical tests with `@p0-regression` and sub-tags (`@provider-router`, `@memory-search`, etc.) to enable focused runs.  
- **Parallel-first:** Ensure suites can shard across 4–6 runners; align with spec-driven parallel execution architecture.  
- **Idempotent and data-resilient:** Tests must handle deterministic data setup/teardown leveraging workspace sandbox snapshots.  
- **Fail-fast telemetry:** Each test writes structured logs/metrics enabling root-cause diagnostics within minutes.  
- **Version-aware baselines:** Maintain v1 baselines to compare telemetry deltas (latency, cost metrics) during v2 runs.

## 4. Coverage Targets & Exit Gates
| Dimension | Metric | Threshold | Measurement Method | Gate Timing |
|---|---|---|---|---|
| Checklist coverage | % of 10 items with automated tests mapped | 100% | Traceability matrix + CI tag audit | Week 1 Day 5 regression draft |
| Test execution health | `@p0-regression` pass rate | ≥95% with ≤2% flake | CI dashboard + retry analysis | Pre-P0 release freeze |
| Telemetry validation | Cost + fallback metrics parity vs v1 | ±5% variance | Observability dashboard comparison | Weekly review + pre-release |
| Manual oversight | Exploratory sessions for high-risk items | 2 sessions/week focused on highest residual risk | QA schedule | Weeks 1–3 |
| Defect containment | Critical regressions escaping to staging | 0 | Defect log cross-check | Continuous |

## 5. Automation Strategy & CI Integration
- **Pipeline hooks:** Extend CI to auto-enforce traceability updates—PRs touching checklist modules must reference traceability IDs.  
- **Selective retests:** Leverage change-impact analysis to trigger only relevant regression tags on PRs, reducing cycle time.  
- **Nightly full sweep:** Schedule midnight UTC run of the entire `@p0-regression` suite with artifacts stored for 14 days.  
- **Artifact retention:** Persist CLI transcripts, execution graphs, and telemetry snapshots for each run; link to risk register.  
- **Flake management:** Introduce automatic quarantine workflow—failing tests must be triaged within 24 hours or blocked from merge.

## 6. Test Data Requirements
- **Multi-provider routing:** Mock providers with deterministic latency, error injection, and quota throttling to validate fallback logic.  
- **Memory search:** Seed datasets covering keyword and vector variants, including edge cases (diacritics, long prompts, binary attachments).  
- **Checkpoint/resume:** Maintain long-running task fixtures (>15 minutes runtime) with deterministic resume states.  
- **Spec-driven workflows:** Provide declarative workflow specs representing parallel execution, partial failure, and resumption.  
- **MCP tool execution:** Package MCP server stubs with versioned capability manifests; include negative cases (permission denied).  
- **Cost tracking:** Supply billing telemetry seeds across multiple providers to verify aggregation and thresholds.  
- **Workspace operations:** Snapshot workspace directories for create/update/delete flows, including symlink edge cases.

## 7. Risk Areas Requiring Extra Attention
| Risk Area | Rationale / Failure Mode | Mitigation Strategy | Owner |
|---|---|---|---|
| Provider fallback regressions | Concurrency and new retries could hide silent failures | Expand chaos testing + telemetry assertions for fallback counts | Bob + Queenie |
| Delegation resumability gaps | Nested delegation chains may not restore context | Simulate multi-hop delegation in e2e tests; add state-machine unit coverage | Avery + QA |
| Memory search parity | sqlite-vec integration introduces vector precision variance | Establish golden query set comparing v1/v2 results; monitor recall metrics | Queenie + Data partner |
| CLI command parity | Command surface expanded; risk of missing hidden flags | Maintain command snapshot diff + CLI smoke suite | Frank + Stan |
| Cost tracking accuracy | New telemetry pipelines could mis-aggregate across providers | Build synthetic billing feed, validate reconciliation jobs | DevOps + Architecture |

## 8. Timeline & Milestones
- **Week 1 Day 2:** Alignment workshop; finalize traceability template ownership; capture initial gaps.  
- **Week 1 Day 3:** Publish gap mitigation plan with resource assignments; update risk register.  
- **Week 1 Day 4:** Complete ADR deltas triggered by QA findings; update automation backlog.  
- **Week 1 Day 5:** Deliver runnable regression suite draft with documented gaps and mitigation ETA.  
- **Week 2 Day 2:** Validate telemetry and cost tracking instrumentation against staging data.  
- **Week 2 Day 5:** First full-dress rehearsal of `@p0-regression` suite in staging environment.

## 9. Governance & Reporting
- Maintain live traceability in `automatosx/tmp/p0-week1/day2-test-mapping-template.md`; review daily during Standup.  
- Update architecture decision backlog when new testing or tooling requirements alter existing ADRs.  
- Provide twice-weekly QA status reports covering coverage metrics, flake analysis, and risk movement.  
- Escalate blockers exceeding 48 hours to Architecture + Program leadership.

> Great architecture is invisible – it enables teams, evolves gracefully, and pays dividends over decades. Use this strategy to keep quality invisible by catching regressions before they surface.

