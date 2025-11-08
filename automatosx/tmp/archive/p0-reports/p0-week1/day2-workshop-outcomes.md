# P0 Week 1 Day 2 – QA Feature Preservation Workshop Outcomes

Quality is not an act, it's a habit. Test early, test often, test everything.

**Date/Time:** Week 1 Day 2, 09:00–10:00 PT  
**Facilitator:** Queenie (QA Lead)  
**Scribe:** QA Program Specialist  
**Format:** Zoom + live Confluence notes

## Attendance
- Queenie (QA Lead – Accountable)
- Avery (Architecture – Responsible)
- Bob (Backend – Responsible)
- Frank (Frontend – Responsible)
- Maya (Mobile – Responsible)
- Stan (Standards – Consulted)
- DevRel Representative – Consulted
- Program PM – Informed
- Tony (CTO) – Informed

## Key Decisions
- Preserve v1 behaviour via traceability-first gating; each checklist item now mapped to explicit automation (ref: day2-traceability-matrix.md).
- Adopt tag hierarchy (`@p0-smoke`, `@p0-regression`, `@p0-deep`) with sub-tags per preservation item for CI orchestration.
- Require golden datasets (memory search, billing feeds) and synthetic fixtures before enabling v2 feature flags impacting preservation items.
- Escalate Gemini streaming parity (Risk R-1) and Memory stack readiness (Risk R-2) to daily leadership standup until mitigated.
- Set exit gate: three consecutive green Tier-1/Tier-2 runs ≥95%/≥92% pass rate, zero critical defects open, telemetry variance within ±5%.

## Coverage Assessment
- **Current v1 automation coverage across preservation items:** 79% average (range 68–92%) with strongest coverage on configuration validation, weakest on MCP negative paths.
- **Target coverage for v2 readiness:** ≥90% averaged across items; specific high-risk items (1, 3, 8, 10) require ≥92%.
- **Gaps identified:** Weighted provider routing, multi-hop delegation, vector recall golden dataset, CLI long-tail commands, synthetic billing feeds.

## Critical Gaps & Action Plans
| Gap | Description | Owner | Mitigation | ETA |
|---|---|---|---|---|
| GAP-01 | Missing automated weighted fallback coverage. | Bob | Extend chaos harness + add telemetry assertions. | 2025-01-08 |
| GAP-02 | No automated multi-hop delegation resume test. | Queenie | Author new e2e spec + reuse executor mocks. | 2025-01-09 |
| GAP-03 | Vector golden dataset absent in CI. | Queenie & Data | Export dataset; integrate diff job. | 2025-01-08 |
| GAP-04 | CLI full command tour automation absent. | Frank | Build manifest diff + CLI tour harness. | 2025-01-09 |
| GAP-05 | Cost telemetry synthetic feed missing. | Avery & DevOps | Script generator; wire to nightly jobs. | 2025-01-09 |

## Exit Gate Criteria for P0
- `@p0-regression` suite ≥95% pass rate for 3 consecutive runs (no retries).
- `@p0-deep` suite ≥92% pass rate over same window.
- Critical defects: 0 open blocking issues tied to preservation items.
- Telemetry parity: fallback counts, memory recall, cost variance all within ±5% vs v1 baselines.
- Traceability matrix shows 100% items with mapped automated tests and owners; no red status.

## Action Items
| ID | Description | Owner | Due | Status |
|---|---|---|---|---|
| AI-W2D2-01 | Land weighted provider fallback unit + integration coverage. | Bob | 2025-01-08 | In Progress |
| AI-W2D2-02 | Create multi-hop delegation e2e + crash recovery scenario. | Queenie | 2025-01-09 | Planned |
| AI-W2D2-03 | Deliver memory search golden dataset and diff job. | Queenie & Data Partner | 2025-01-08 | Blocked (await dataset export) |
| AI-W2D2-04 | Implement CLI full command tour harness with tagging. | Frank | 2025-01-09 | Not Started |
| AI-W2D2-05 | Stand up synthetic billing feed + telemetry assertions. | Avery & DevOps | 2025-01-09 | In Progress |
| AI-W2D2-06 | Publish CI configuration update for new tag strategy. | Queenie | 2025-01-08 | In Progress |
| AI-W2D2-07 | Update ADR-011 with QA gating requirements for ReScript state machine. | Avery | 2025-01-08 | In Progress |

## Risks & Dependencies
- **R-1 Gemini streaming parity (Medium/High):** Blocks CLI Gemini command; tracked via leadership standup; escalate if upstream parity unresolved by 2025-01-08.
- **R-2 Memory search stack readiness (High/High):** Automation blocked until MemorySearchService + MemoryManager land; daily checkpoint with Backend lead.
- **R-3 Delegation resumability (Medium/High):** Needs new e2e coverage; escalate if mock harness not delivered by 2025-01-09.
- **R-4 Telemetry instrumentation (Medium/Medium):** Dependent on DevOps plan (AI-5 from Day 1); align deliverable with cost tracking automation.

## Next Steps
1. Owners execute action items; report status at daily QA sync.
2. QA to integrate updated tag strategy into CI workflows and enforce traceability linting.
3. Architecture to circulate updated ADR-011 including rollback and telemetry hooks by 2025-01-08.
4. Prepare regression suite dry-run for Week 1 Day 4 to validate sharding + artifact retention.
5. Review progress with leadership on Week 1 Day 3 using updated traceability matrix and risk dashboard.
