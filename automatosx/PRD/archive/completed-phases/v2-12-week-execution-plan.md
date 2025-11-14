# AutomatosX v2 — 12-Week Execution Plan

This plan decomposes the AutomatosX v2 PRD (`automatosx/PRD/automatosx-v2-completion-plan.md`) into actionable weekly execution steps across six sprints. It emphasizes user outcomes: reliable automation parity, extensible Plugin SDK, and production-ready delivery with clear gates, ownership, and measurable test growth.

---

## Sprint & Phase Mapping

| Sprint | Weeks | Phase Focus | Primary Outcomes | Squads on Point |
|--------|-------|-------------|------------------|-----------------|
| Sprint 1 | 1-2 | Phase 1 – Stabilize Core | Harden ReScript runtime, rule engine, telemetry | Core Runtime, Quality |
| Sprint 2 | 3-4 | Phase 2 – Parity & Coverage | Parity inventory + CLI/TS bridge, reach 1,616 tests | CLI/TS, Quality |
| Sprint 3 | 5-6 | Phase 2 → Phase 3 | Close parity gap, Plugin SDK Alpha, 2,116 tests | Core Runtime, CLI/TS, Quality |
| Sprint 4 | 7-8 | Phase 3 → Phase 4 | Plugin SDK Beta, production pipelines, 2,323 tests | CLI/TS, DevOps, Quality |
| Sprint 5 | 9-10 | Phase 4 → Phase 5 | Production hardening, advanced features start, 2,423 tests | DevOps, Core Runtime, Security |
| Sprint 6 | 11-12 | Phase 5 | P2 features, GA readiness, sustained 100% pass rate | All squads |

---

## Milestones, Gates, and Testing Targets

| Week | Milestone / Gate | Test Target (cumulative) | Gate Owner |
|------|------------------|--------------------------|------------|
| 2 | ReScript runtime stability review; CLI smoke badge | 916 (716 + 200 runtime) | Core Runtime + Quality |
| 4 | Parity inventory sign-off; CLI/TS integration demo | 1,616 (+700 parity) | Product + Quality |
| 6 | Plugin SDK Alpha go/no-go; parity completion checkpoint | 2,116 (+500) | Product + CLI/TS |
| 8 | Plugin SDK Beta release candidate; production pipeline dry-run | 2,323 (+207) | DevOps |
| 10 | Production hardening gate; advanced feature readiness demo | 2,423 (+100) | Product + Security |
| 12 | GA release decision; telemetry & SLA validation | 2,423 (100% pass) | Exec Review |

Failure to meet a gate pauses downstream work until remediation plans are approved.

---

## Resource Allocation by Week

| Week | Core Runtime Squad | CLI/TypeScript Squad | Quality Squad | DevOps Squad | Security Squad |
|------|-------------------|----------------------|---------------|--------------|----------------|
| 1 | Runtime refactors, state machine audits | Input contracts prep | Runtime test harness | Pipeline scaffolds | Threat modeling kick-off |
| 2 | Rule engine + telemetry guards | WorkspaceManager enforcement | Runtime regression suite | Test runners caching | Privacy checklist draft |
| 3 | Planner resiliency | CLI parity backlog, schema sync | Parity test authoring | CI parallels | Privacy tooling reviews |
| 4 | Runtime support for CLI hooks | CLI UX polish, binding generation | Golden trace replay | Artifact storage | Secrets rotation plan |
| 5 | Stateful retries + self-heal | Plugin SDK Alpha scaffolding | Plugin adapter tests | Pipeline observability | Plugin trust policy |
| 6 | Runtime APIs for SDK | SDK validation harness | 500 parity tests | Release rehearsals | SBOM + supply-chain scans |
| 7 | SDK runtime embedders | SDK Beta polish | SDK Beta tests | Production infra IaC | Sandbox policy enforcement |
| 8 | Guardrail tuning | CLI publish prep | 2,323-test gate | Multi-env smoke | Pen-test dry run |
| 9 | WASM sandbox core | Advanced feature CLI switches | Performance regressions | Failover drills | Threat model updates |
|10 | Reranking services | CLI GA polish | 2,423-test maintenance | RC → GA pipeline | Compliance audit support |
|11 | Incremental indexing service | Docs + GA packaging | Long-run reliability tests | GA incident playbooks | Final SOC2 artifacts |
|12 | Runtime KPIs + telemetry | Post-GA backlog triage | 100% pass sustainment | Launch support | Security sign-off |

---

## Critical Path & Cross-Week Dependencies

1. **Runtime stability (Weeks 1-2)** → prerequisite for parity tests (Weeks 3-6) and SDK lifecycle hooks (Weeks 5-8).
2. **Parity inventory (Week 3) + golden traces (Week 4)** → unblock Plugin SDK validation and production gates.
3. **Plugin SDK Alpha (Week 6)** must land before Beta polish + documentation (Weeks 7-8) and third-party plugin commitments.
4. **Production pipeline dry-run (Week 8)** → required before security/compliance hardening (Weeks 9-10) and GA release (Week 12).
5. **Advanced features (Weeks 9-11)** rely on telemetry + observability primitives from Weeks 1-4 to avoid regressions.

Any slippage in the above chain triggers re-plan with Product before next sprint starts.

---

## Week-by-Week Breakdown

### Week 1 — Phase 1: Stabilize Core (Sprint 1, ReScript Core Runtime)
- **Primary Objectives**
  - Complete runtime code audits to identify determinism gaps.
  - Establish rule engine guardrail specs and telemetry contracts.
  - Bootstrap runtime-focused regression harness (~100 tests).
  - Draft threat model updates for new runtime APIs.
- **Detailed Tasks**

| Task | Squad | Est. (person-days) | Dependencies |
|------|-------|--------------------|--------------|
| State machine tracing instrumentation | Core Runtime | 4 | Existing runtime |
| Rule engine policy backlog + sizing | Core Runtime | 2 | Audit findings |
| Runtime test harness (property + snapshot) | Quality | 3 | Instrumentation |
| CLI contract stub updates for WorkspaceManager | CLI/TS | 2 | Runtime API docs |
| Initial threat model refresh | Security | 1 | Architecture notes |
| CI job for runtime suite | DevOps | 2 | Test harness |

- **Dependencies**: None; foundation week.
- **Key Deliverables & Success Criteria**
  - Tracing instrumentation merged; deterministic transitions logged.
  - Runtime harness running in CI; ≥50 new tests passing.
  - Rule engine backlog groomed and prioritized.
  - Threat model doc updated with runtime surfaces.
- **Risks & Mitigations**
  - *Runtime churn risks regressions*: enforce feature freeze outside critical fixes.
  - *Instrumentation performance hit*: use sampling and toggle via env flags.
  - *Security review lag*: Security squad embedded in audit meetings.

### Week 2 — Phase 1: Stabilize Core (Sprint 1)
- **Primary Objectives**
  - Finish rule engine guardrails + telemetry hooks.
  - Reach 916 tests (add 200 runtime tests).
  - Validate CLI smoke badge using new runtime.
  - Document rollback and retry workflows.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Implement guardrail policies (pre/post conditions) | Core Runtime | 4 | Week 1 backlog |
| Telemetry hook integration with privacy filters | Core Runtime + Security | 3 | Guardrail code |
| Expand runtime suite to 200 tests + failure injection | Quality | 4 | Guardrails |
| CLI smoke harness invoking new runtime | CLI/TS | 2 | Runtime APIs |
| CI cache optimization for runtime suite | DevOps | 2 | Expanded tests |
| Rollback playbook documentation | Product + DevOps | 1 | Guardrail behavior |

- **Dependencies**: Builds on Week 1 instrumentation and backlog.
- **Key Deliverables & Success Criteria**
  - All guardRails behind flags; telemetry verified with opt-in.
  - CI reports 916 total tests (200 added) with ≥97% pass.
  - CLI smoke badge green across macOS/Linux runners.
  - Runbooks for rollback/retry published.
- **Risks & Mitigations**
  - *Telemetry privacy concerns*: Security validates data minimization.
  - *CI instability*: DevOps pre-warms caches and parallelizes suites.

### Week 3 — Phase 2: Parity & Coverage (Sprint 2, Test Parity Foundation)
- **Primary Objectives**
  - Inventory remaining parity gaps vs. v1 agents.
  - Begin CLI parity bridge (WorkspaceManager + schema sync).
  - Author first 350 parity tests toward Week 4 goal.
  - Align planner resiliency with parity scenarios.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Parity gap matrix (agents × behaviors) | Product + Quality | 3 | Week 2 telemetry |
| Planner resiliency fixes (cancel/resume) | Core Runtime | 4 | Gap findings |
| CLI schema + WorkspaceManager parity | CLI/TS | 3 | Gap matrix |
| Author 350 parity tests (mock + golden) | Quality | 5 | Gap matrix |
| CI parallel shard setup for parity suite | DevOps | 2 | Test backlog |
| Privacy tooling validation for new flows | Security | 2 | CLI changes |

- **Dependencies**: Week 2 guardrails must be stable.
- **Key Deliverables & Success Criteria**
  - Published parity matrix with owners/dates.
  - 350 new tests merged (1,066 total).
  - Planner handles pause/resume + cancellation.
  - CLI parity backlog prioritized with ETS (effort, target, squad).
- **Risks & Mitigations**
  - *Scope creep in parity list*: freeze after sign-off, handle new items via change control.
  - *Planner regressions*: add canary tests per behavior type.

### Week 4 — Phase 2: Parity & Coverage (Sprint 2)
- **Primary Objectives**
  - Hit 1,616 tests (add 700 parity tests total vs. Week 2).
  - Demo CLI/TS parity features (WorkspaceManager enforcement, schema validation).
  - Introduce golden trace replay harness.
  - Finalize go/no-go for Sprint 3 parity closeout.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Golden trace capture + replay infra | Quality | 4 | CLI parity hooks |
| Add 350 more parity tests (700 cumulative) | Quality | 4 | Trace harness |
| CLI UX polish (error surfacing, hints) | CLI/TS | 3 | Schema sync |
| Runtime support for CLI hooks (WorkspaceManager) | Core Runtime | 3 | CLI changes |
| CI artifact storage for traces/logs | DevOps | 2 | Trace harness |
| Privacy review of recorded traces | Security | 1 | Trace samples |

- **Dependencies**: Week 3 parity matrix + initial tests.
- **Key Deliverables & Success Criteria**
  - 1,616 total automated tests.
  - Golden trace harness gating parity PRs.
  - CLI parity demo approved; backlog burn-down plan for Week 5.
- **Risks & Mitigations**
  - *Trace data leakage*: anonymize artifacts + auto-delete after 7 days.
  - *Test flake risk*: DevOps adds retry logic + flake dashboard.

### Week 5 — Phase 2 → Phase 3: Test Completion + Plugin SDK Alpha (Sprint 3)
- **Primary Objectives**
  - Close remaining parity gaps (inventory ≤10 open).
  - Deliver Plugin SDK Alpha scaffolding + docs outline.
  - Add 250 parity tests (toward Week 6 target 2,116).
  - Implement runtime self-healing features required by SDK.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Finish parity backlog (≤10 open items) | Quality + Core Runtime | 4 | Week 4 matrix |
| SDK Alpha scaffolding command (`ax agent create`) | CLI/TS | 4 | Runtime APIs |
| Runtime self-heal + retry states | Core Runtime | 3 | Guardrails |
| SDK Alpha documentation outline | Product + Writer | 2 | Scaffolding |
| Plugin test harness (mock runtime) | Quality | 3 | SDK CLI |
| Release pipeline rehearsal (Alpha tag) | DevOps | 2 | SDK artifacts |

- **Dependencies**: Golden traces + CLI hooks from Week 4.
- **Key Deliverables & Success Criteria**
  - Parity backlog nearly cleared.
  - SDK Alpha CLI command generates runnable template.
  - Plugin test harness executing sample plugin.
  - Total tests ~1,866.
- **Risks & Mitigations**
  - *Alpha scope churn*: freeze feature set, log stretch ideas separately.
  - *Self-heal complexity*: pair programming between Core Runtime + CLI.

### Week 6 — Phase 3: Plugin & SDK Alpha/Beta Bridge (Sprint 3)
- **Primary Objectives**
  - Hit 2,116 tests (add final 250 parity + 500 total vs. Week 4).
  - Ship Plugin SDK Alpha (internal) go/no-go.
  - Validate SDK lifecycle hooks with runtime.
  - Prepare Beta backlog + partner feedback loop.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Final 250 parity tests + regression sweep | Quality | 4 | Week 5 parity |
| SDK runtime bridge (init/plan/act/recover) | Core Runtime | 4 | Self-heal |
| SDK validation harness + fixtures | CLI/TS + Quality | 3 | Runtime bridge |
| Partner feedback sessions (2) | Product | 2 | Alpha build |
| Beta backlog grooming + sizing | Product + CLI/TS | 2 | Feedback |
| Release rehearsal incl. changelog + docs stub | DevOps + Writer | 2 | Alpha artifacts |

- **Dependencies**: Parity closure from Week 5.
- **Key Deliverables & Success Criteria**
  - 2,116 tests passing; parity gap = 0.
  - SDK Alpha tagged, docs outline published.
  - Partner feedback captured with action items.
- **Risks & Mitigations**
  - *Partner schedule slip*: pre-book sessions; have async feedback form.
  - *Runtime/SDK mismatch*: daily sync between squads + contract tests.

### Week 7 — Phase 3: Plugin SDK Beta Prep (Sprint 4)
- **Primary Objectives**
  - Implement SDK Beta features (capability descriptors, guardrails).
  - Onboard first internal beta plugin authors.
  - Add 150 SDK/production tests toward Week 8 target 2,323.
  - Stand up production infrastructure IaC (staging env).
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Capability descriptor API + docs | CLI/TS | 3 | Alpha feedback |
| Runtime embedders for descriptors + guardrails | Core Runtime | 3 | API spec |
| SDK Beta test suite (intent + sandbox) | Quality | 4 | Guardrails |
| Internal beta enablement workshop | Product + Writer | 2 | SDK Beta |
| IaC for staging pipeline (GitHub Actions + envs) | DevOps | 4 | Release rehearsal |
| Sandbox policy enforcement review | Security | 2 | Guardrails |

- **Dependencies**: SDK Alpha sign-off.
- **Key Deliverables & Success Criteria**
  - Beta-ready SDK features merged.
  - 150 new tests covering SDK flows (2,266 total).
  - Staging pipeline provisioned with smoke tests.
- **Risks & Mitigations**
  - *Plugin authors blocked by docs*: deliver quickstart + office hours.
  - *IaC drift*: DevOps uses Terraform lint + PR gating.

### Week 8 — Phase 4: Production Readiness (Sprint 4)
- **Primary Objectives**
  - Hit 2,323 total tests (+207 SDK/production).
  - Run production pipeline dry-run (beta publish, telemetry opt-in).
  - Execute security + privacy reviews for SDK.
  - Finalize go/no-go for production hardening sprint.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Production pipeline dry-run (beta tag → npm) | DevOps | 4 | Week 7 IaC |
| SDK Beta documentation + samples | Writer + CLI/TS | 3 | Beta features |
| SDK Beta test expansion (+57 tests) | Quality | 3 | Docs |
| Telemetry + observability integration (structured logs) | Core Runtime | 3 | Dry-run feedback |
| Privacy & security review sign-off | Security + Product | 2 | Telemetry |
| Incident response tabletop (staging) | DevOps + Product | 2 | Dry-run |

- **Dependencies**: Week 7 Beta features + IaC.
- **Key Deliverables & Success Criteria**
  - 2,323 tests passing; SDK Beta published internally.
  - Production pipeline dry-run documented (timings, issues).
  - Security/privacy sign-off with tracked mitigations.
- **Risks & Mitigations**
  - *Dry-run failures*: maintain rollback steps and T-minus schedule.
  - *Telemetry noise*: add sampling + log schema validation.

### Week 9 — Phase 4 → Phase 5: Production Hardening (Sprint 5)
- **Primary Objectives**
  - Implement WASM sandbox core + advanced feature toggles.
  - Conduct failover drills and validate observability KPIs.
  - Add 50 P2 tests (toward Week 10 target 2,423).
  - Update threat model + compliance artifacts.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| WASM sandbox execution engine | Core Runtime + Security | 5 | Guardrail reviews |
| Advanced feature toggles in CLI (reranking, filters) | CLI/TS | 3 | Runtime APIs |
| Failover + disaster recovery drill | DevOps | 3 | Dry-run learnings |
| Performance regression harness | Quality | 3 | Observability |
| Threat model + compliance updates | Security | 2 | Sandbox |
| Customer advisory sync on advanced features | Product | 1 | Toggles |

- **Dependencies**: Production pipeline established in Week 8.
- **Key Deliverables & Success Criteria**
  - WASM sandbox prototype with policy enforcement.
  - DR drill report with remediation backlog.
  - 2,373 tests (adds 50 P2 + maintenance).
- **Risks & Mitigations**
  - *Sandbox performance hit*: benchmark and allow opt-out flag.
  - *DR drill reveals gaps*: treat as blockers before Week 10 gate.

### Week 10 — Phase 5: Advanced Features & GA Prep (Sprint 5)
- **Primary Objectives**
  - Reach 2,423 tests (+100 P2 tests) and stabilize suite.
  - Finalize reranking + language filters; document APIs.
  - Production hardening gate (observability KPIs met).
  - Prep GA RC publish (RC1).
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Add 50 more P2 tests + reliability soak | Quality | 4 | Week 9 harness |
| Reranking service + API docs | Core Runtime + Writer | 3 | Toggles |
| Language filter implementation + CLI switches | CLI/TS | 3 | Runtime data |
| GA RC pipeline (signed artifacts, SBOM) | DevOps + Security | 4 | Week 8 pipeline |
| Observability KPI validation (≤1% failed sessions) | Product + DevOps | 2 | Logs |
| GA launch readiness review | Product | 1 | KPI results |

- **Dependencies**: Failover drill + sandbox from Week 9.
- **Key Deliverables & Success Criteria**
  - 2,423 tests passing with trend dashboards.
  - RC1 artifacts signed with SBOM + attestation.
  - GA readiness review outcome and action items.
- **Risks & Mitigations**
  - *Test flake resurgence*: enforce quarantine policy + triage SWAT.
  - *SBOM tooling delays*: pre-stage tools Week 9.

### Week 11 — Phase 5: P2 Features & GA Finalization (Sprint 6)
- **Primary Objectives**
  - Finish incremental indexing service + CLI UX.
  - Long-run reliability testing (72-hour suites).
  - Publish docs/tutorials for GA launch.
  - Finalize incident response + support playbooks.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Incremental indexing service | Core Runtime | 4 | Telemetry |
| CLI UX for indexing + status | CLI/TS | 3 | Service API |
| 72-hour reliability soak + report | Quality | 4 | Stable suite |
| GA docs/tutorials + release notes | Writer + Product | 3 | Feature completion |
| Incident response + comms playbooks | DevOps + Product | 2 | DR drill |
| Final SOC2/SBOM artifact packaging | Security | 2 | RC pipeline |

- **Dependencies**: RC1 readiness (Week 10).
- **Key Deliverables & Success Criteria**
  - Indexing service deployed to staging.
  - Reliability soak report shows ≤0.5% failure.
  - GA docs ready for public site.
- **Risks & Mitigations**
  - *Service performance variance*: add autoscaling config + caching.
  - *Documentation bottleneck*: use writer + product co-authoring.

### Week 12 — Phase 5: GA Launch (Sprint 6)
- **Primary Objectives**
  - Maintain 2,423 tests with 100% pass for release week.
  - Execute GA launch plan (npm publish, announcements, support readiness).
  - Post-launch telemetry + rollback drills.
  - Collect early user feedback for post-GA roadmap.
- **Detailed Tasks**

| Task | Squad | Est. | Dependencies |
|------|-------|------|--------------|
| Final GA publish (npm, docs site) | DevOps + Product | 3 | RC pipeline |
| Post-release telemetry dashboarding | Core Runtime + DevOps | 2 | Observability |
| Support desk + escalation readiness (24h window) | Product + Quality | 2 | Playbooks |
| Post-launch review + lessons learned | All squads | 1 | Launch day |
| Roadmap backlog grooming (post-GA) | Product | 1 | Feedback |

- **Dependencies**: Weeks 1-11 completed; GA gate approval.
- **Key Deliverables & Success Criteria**
  - GA release live, telemetry green (≤1% session failures).
  - 100% pass rate sustained for 72 hours.
  - Feedback log + prioritized follow-ups.
- **Risks & Mitigations**
  - *Launch regressions*: rollback plan rehearsed, staged rollout.
  - *Support overload*: shift schedule + templated responses ready.

---

## Weekly Standup Template

Use this template for each squad’s weekly standup to ensure alignment on outcomes and risks:

```
Week #: Phase / Sprint:
Squad: Core Runtime / CLI-TS / Quality / DevOps / Security

1. Outcomes targeting this week
   - Objective 1
   - Objective 2

2. Progress vs. plan (tasks, estimates, % complete)
   - Task / owner / ETA

3. Blockers / dependencies
   - Blocker, impact, mitigation owner

4. Test count & quality signals
   - Current count vs. target, pass rate, flakes

5. Risks & mitigation status
   - Risk description, confidence, escalation path

6. Decisions needed / Product feedback
   - Decision, due date, stakeholders
```

---

## Next Steps
- Review plan with squad leads; confirm capacity and estimates.
- Instrument dashboards to track weekly objectives, test counts, and gate readiness.
- Schedule gate reviews at end of Weeks 2, 4, 6, 8, 10, and 12 with clear entry/exit criteria.

Build the right thing, not just things right. Ship, learn, iterate.
