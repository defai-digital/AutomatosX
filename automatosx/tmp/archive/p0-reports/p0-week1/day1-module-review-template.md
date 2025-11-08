# Module Cluster Review Template – P0 Week 1 Day 1

**Cluster Name:** `<CLI / Core / Agents / Providers / Memory / Utils / Code Intelligence>`  
**Cluster Lead:** `<Name>`  
**Date:** `<YYYY-MM-DD>`  
**Facilitator:** Avery  
**Source Inventory:** `automatosx/PRD/v2-module-inventory-status.md` (filtered tab)

---

## 1. Snapshot Summary
| Metric | Value | Notes |
|---|---|---|
| Total modules in cluster | `<#>` | e.g., 26 CLI command modules |
| Status mix | `<Green / Yellow / Red counts>` | Use latest inventory export |
| Primary dependencies | `<List teams/services>` | Highlight upstream/downstream |
| ADR impacts | `<ADR IDs>` | e.g., ADR-005, ADR-010 |

---

## 2. Status Validation Checklist
- [ ] Inventory entries validated within last 48 hours (timestamp recorded).  
- [ ] Evidence artifacts linked (tests, spike docs, migration notes).  
- [ ] Regression coverage summarized; gaps identified with QA plan.  
- [ ] Operational readiness confirmed (telemetry, rollback, feature flags).  
- [ ] Security & compliance checks aligned with ADR-004 guardrails.  
- [ ] Documentation impacts scoped (CLI help, guides, internal runbooks).  
- [ ] ADR update requirements captured in backlog (e.g., ADR-011 draft).

Add supporting links beneath each checklist item as bullet points during review.

---

## 3. Module Disposition Matrix
| Module | Owner | Proposed Status | Evidence Summary | Decision (Go / Conditional / No-Go) | Conditions / Follow-ups |
|---|---|---|---|---|---|
| e.g., `src/cli/commands/list.ts` | Frank | In Progress | New agent filters demo recorded | Conditional Go | Complete CLI smoke tests by 2025-01-12 |
| | | | | | |

> **Guidance:** Keep rows concise; detail evidence in linked doc to avoid time overruns.

---

## 4. Go / Conditional / No-Go Decision Matrix (Cluster Level)
| Criteria | Threshold | Cluster Assessment |
|---|---|---|
| Evidence of functional parity | ≥90% modules with validated tests/demo artifacts | `<Pass / Gap>` |
| Operational readiness | Telemetry dashboards configured + rollback path documented | `<Pass / Gap>` |
| Security & compliance | 100% modules reviewed against ADR-004 checklist | `<Pass / Gap>` |
| Dependencies | No critical unresolved upstream blockers | `<Pass / Gap>` |
| Documentation | All user-facing changes queued for docs update | `<Pass / Gap>` |

**Cluster Disposition:** `<Go / Conditional Go / No-Go>`

- **If Conditional:** list explicit mitigations, due dates, and triggers.  
- **If No-Go:** capture rationale, required decisions, and escalation route.

---

## 5. Risk Register (Cluster)
Use the risk assessment format to capture new or updated risks.

| Risk | Likelihood | Impact | Mitigation | Owner | Trigger | Residual Risk |
|---|---|---|---|---|---|---|
| Parser ingestion throughput below target | Medium | High | Tune batching, add telemetry alerts | Avery | Throughput < 200 files/min for 2 runs | Medium |
| | | | | | | |

> Align likelihood/impact with team standards (Low/Medium/High). Record triggers that prompt immediate action or escalation.

---

## 6. Action Items & Follow-Ups
| Action | Owner | Due Date | Notes / Dependencies |
|---|---|---|---|
| e.g., Ship CLI regression suite expansion | Queenie | 2025-01-10 | Cover new lazy-loading paths |
| | | | |

- Flag actions requiring ADR updates (`ADR-011` etc.) with `ADR:` prefix.  
- Feed approved actions into Jira immediately after meeting via Program PM.

---

## 7. Notes & Decisions Log
- Decision summaries (one line each) with timestamp.  
- Outstanding questions to route to Architecture Review Board.  
- Links to supporting artifacts (recording timestamp, doc snippets).

---

## 8. Post-Review Updates
- Update `v2-module-inventory-status.md` with final disposition and links.  
- Notify owners of Conditional/No-Go outcomes and expected follow-up cadence.  
- Inform Architecture to refresh ADR backlog entries and runway board.

> Use this template live during the session (shared doc) to ensure decisions remain auditable and traceable across the architecture runway.
