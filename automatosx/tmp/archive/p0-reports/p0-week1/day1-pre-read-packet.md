# P0 Week 1 Day 1 – Engineering Leads Review Pre-Read Packet

**Audience:** Engineering leads, Architecture, QA, Program PM  
**Review Window:** Circulate 48h before session  
**Reference Sets:** `automatosx/PRD/automatosx-v2-revamp.md`, `automatosx/PRD/v2-module-inventory-status.md`, `automatosx/PRD/v2-implementation-plan.md`

---

## 1. Executive Summary – v2 Revamp
- AutomatosX v2 modernizes the platform around a ReScript core runtime, extended TypeScript integration layer, and deterministic validation pipeline (Zod) to enable predictable multi-agent orchestration.  
- The SQLite FTS5-backed memory system (ADR-001) underpins both CLI workflows and upcoming code intelligence features, eliminating external dependencies while improving recall.  
- CLI parity remains non-negotiable: v2 retains v1 ergonomics while introducing new commands (`ax find`, `ax def`, `ax flow`, `ax lint`) and lazy-loading performance optimizations (ADR-007).  
- Success hinges on validating 223 modules across seven clusters for readiness, ensuring no regressions while enabling the code-intel expansion described in the implementation plan.

**P0 Objectives Recap** (from `v2-implementation-plan.md`):
1. Ship the ReScript-driven orchestration adapter without breaking existing AgentExecutor flows.  
2. Extend SQLite schema for code graph data while preserving API contracts.  
3. Introduce parser pipeline (Tree-sitter, SWC, Semgrep) with migration and observability guardrails.  
4. Maintain strict TypeScript guardrails (ADR-003) and three-layer security controls (ADR-004).

---

## 2. Module Review Clusters & Leads
| Cluster | Modules Covered | Cluster Lead | Primary Review Goals |
|---|---|---|---|
| CLI Experience | Command handlers & shared CLI plumbing | Frank | Confirm command readiness, telemetry coverage, and backward compatibility adherence. |
| Core Runtime | Orchestration, workflow engines, state machines | Avery | Validate ReScript integration readiness, failover paths, and feature flag strategy. |
| Agents & Profiles | Agent lifecycle, abilities, team config | Bob | Ensure profile/ability separation (ADR-005) is preserved and TTL caching (ADR-009) is scoped. |
| Provider Integrations | Provider router, connectors, quotas | Bob (w/ DevOps) | Confirm Provider Router pattern (ADR-010) compliance and fallback readiness. |
| Memory & Persistence | SQLite DAOs, migrations, recall logging | Queenie (QA) | Validate migration safety, retention policies, and monitoring hooks. |
| Utilities & Shared Services | Cross-cutting helpers, security utilities | Stan | Ensure shared libs uphold strict mode and security layering (ADR-004). |
| Code Intelligence | Parser adapters, ingestion workers, code graph | Avery + Frank | Assess new pipeline maturity, performance targets, and release gating.

> **Tip:** Use the filtered views in `v2-module-inventory-status.md` (tabs per cluster) to pre-stage talking points.

---

## 3. Decision Framework
### 3.1 Evaluation Criteria
1. **Readiness Evidence:** Tests, spike outputs, or migration notes demonstrating functional parity.  
2. **Operational Fitness:** Telemetry, observability, and rollback plan validated.  
3. **Security & Compliance:** Adherence to three-layer security (ADR-004) and provider policies.  
4. **Dependency Alignment:** No unmitigated upstream/downstream blockers; feature flags defined.  
5. **Documentation & ADR Impact:** Required updates to `.automatosx/abilities/our-architecture-decisions.md` identified.

### 3.2 Decision Outcomes
- **Go:** Ready for P0 execution; no outstanding blockers; action items limited to tracking tasks.  
- **Conditional Go:** Proceed with explicit mitigations due ≤3 days; triggers defined.  
- **No-Go:** Blocked; requires rework or architectural decision before inclusion in P0 runway.

### 3.3 Escalation Path
- Unresolved disputes escalate to Architecture Review Board within 24 hours.  
- Conditional items older than 5 days escalate to Avery + Tony for prioritization.

---

## 4. RACI Matrix (Cluster-Level Decisions)
| Cluster | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| CLI Experience | Frank, CLI SMEs | Tony | Avery, Queenie, DevOps | Delivery Managers |
| Core Runtime | Avery, ReScript lead | Tony | Bob, Stan | Program PM, QA |
| Agents & Profiles | Bob | Tony | Avery, Product | Mobile lead |
| Provider Integrations | Bob, DevOps | Tony | Security (Steve), Avery | Support, Finance |
| Memory & Persistence | Queenie, Memory DAO owner | Avery | Bob, Data | Docs lead |
| Utilities & Shared Services | Stan | Avery | Security, QA | All teams |
| Code Intelligence | Avery, Frank | Tony | Data Scientist, DevOps | Product, Docs |

---

## 5. Pre-Work Expectations
- **Cluster Leads:** Annotate the inventory status with evidence links and preliminary recommendation (Go/Conditional/No-Go).  
- **QA (Queenie):** Prepare regression coverage summary for each cluster, highlighting gaps.  
- **DevOps:** Provide telemetry readiness snapshots (ingestion throughput, provider uptime).  
- **Architecture:** Draft ADR update stubs for ReScript integration (ADR-011+) as contingencies.

---

## 6. Appendices
### 6.1 Time Investment Estimate
| Activity | Owner | Estimate |
|---|---|---|
| Pre-read review per lead | Each cluster lead | 45–60 min |
| Evidence aggregation | Module SMEs | 30 min per module needing clarification |
| Decision log update | Avery + Scribe | 15 min post-meeting |
| ADR backlog refresh | Avery | 20 min |

### 6.2 Open Questions to Resolve in Session
1. How do we gate the ReScript runtime in environments lacking the toolchain (`v2-implementation-plan.md` §ReScript Runtime Integration)?  
2. What telemetry thresholds define success for the new parser ingestion pipeline?  
3. Are provider failover strategies (ADR-010) validated in staging for `azure-openai` and `anthropic` connectors?

### 6.3 Artifacts Checklist
- Latest export of `v2-module-inventory-status.md` filtered by cluster.  
- Draft decision log and action tracker template.  
- Risk register skeleton (see review template).  
- ADR delta list (ADR-011 → ADR-014 drafts).

> Arrive prepared with evidence; our 90-minute window is for decisions, not discovery.
