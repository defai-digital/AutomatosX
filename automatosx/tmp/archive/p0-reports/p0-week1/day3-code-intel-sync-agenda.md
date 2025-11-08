# P0 Week 1 Day 3 – Code-Intel Parser Dependencies Sync

**Date:** Week 1 Day 3  
**Time:** 75 minutes (recommend 09:00–10:15 PT)  
**Location:** Zoom (`<insert link>`) + live notes in `automatosx/tmp/p0-week1/day3-parser-pipeline-design.md` draft  
**Facilitator:** Avery (Architecture)  
**Co-Facilitator:** Bob (Backend Parser Owner)  
**Scribe:** Felix (Fullstack)  
**References:** `automatosx/PRD/v2-p0-kickoff-action-plan.md`, `.automatosx/abilities/our-architecture-decisions.md`, `automatosx/tmp/p0-week1/day3-parser-pipeline-design.md`, `automatosx/tmp/p0-week1/day3-sqlite-schema-design.md`

## Technical Objectives
- Converge on the modular parser pipeline architecture that harmonizes Tree-sitter, SWC, and Semgrep AST outputs for v2.
- Validate integration POC scope, success metrics, and cross-language coverage (TS/JS, Go, Rust) before sprint kickoff.
- Confirm SQLite schema evolution strategy that supports enriched parser metadata without exceeding latency guardrails.
- Align on performance benchmarking protocol and tooling owners to enforce the <10% latency increase target.

## Expected Outcomes (Success Criteria)
- Approved parser pipeline architecture with named owners for each adapter interface.
- Agreement on POC exit criteria demonstrating AST harmony and symbol table parity.
- Ratified SQLite schema diff and migration runbook ready for implementation.
- Performance benchmarking plan adopted with scheduled baseline collection.
- Action log with owners, due dates, and dependencies captured in Confluence/Notion tracker.

## Participants & Technical Roles
| Participant | Focus Area | RACI | Notes |
|---|---|---|---|
| Avery (Architecture) | Facilitates, approves architecture, documents ADR updates | Accountable | Primary owner of architecture runway and ADRs |
| Bob (Backend) | Parser orchestrator, Tree-sitter and SWC integration | Responsible | Leads backend POC implementation |
| Felix (Fullstack) | CLI contract alignment, Semgrep integration, developer ergonomics | Responsible | Owns CLI ingestion layer updates |
| Stan (Standards) | Coding standards, parser contract validation, test scaffolding | Consulted | Ensures TypeScript strict mode contracts met |
| DevOps Observer (Oliver delegate) | Runtime observability, deployment considerations | Consulted | Advises on pipeline automation and resource envelopes |
| Performance Engineer | Benchmarking harness, telemetry instrumentation | Responsible | Sets measurement protocol and dashboards |
| Tony (CTO) | Strategic oversight, risk acceptance | Informed | Receives summary + decision log |
| Queenie (Quality) | Test coverage alignment, regression guardrails | Informed | Validates POC results feed QA automation |

## Agenda Breakdown (75 Minutes)
| Time | Segment | Lead | Purpose | Inputs |
|---|---|---|---|---|
| 0–5 min | Kickoff, quorum, objective recap | Avery | Frame outcomes, confirm agenda | Agenda, P0 action plan |
| 5–20 min | Tree-sitter Pipeline Deep Dive | Bob | Present current AST, incremental parsing hooks, error catalog | Tree-sitter POC notes, error logs |
| 20–35 min | SWC Adapter Alignment | Bob & Stan | Validate SWC AST normalization vs. Tree-sitter baseline | SWC schema diff, TypeScript contracts |
| 35–50 min | Semgrep Integration & Pattern Consistency | Felix | Review Semgrep rule coverage, map symbol table harmonization | Semgrep ruleset inventory, CLI contracts |
| 50–60 min | Unified Orchestration Architecture Walkthrough | Avery | Propose port/adapter layout, fallback logic, observability hooks | Draft design doc, ADR cross-links |
| 60–68 min | SQLite Schema Evolution & Migration Plan | Avery & Bob | Review proposed tables, indexing, migration sequence | Schema draft, current memory.db |
| 68–73 min | Performance Benchmark Protocol | Performance Engineer | Align metrics, repo selection, automation wiring | Benchmark plan draft, telemetry baselines |
| 73–75 min | Decision Review & Action Assignments | Avery | Confirm decisions, owners, timelines, communication plan | Decision log template |

## Pre-Sync Preparation Checklist (Due 24h Prior)
- ✅ Bob publishes latest Tree-sitter and SWC adapter diagrams plus known failure cases.
- ✅ Felix assembles Semgrep rule coverage matrix across TS/JS, Go, Rust with gaps flagged.
- ✅ Avery circulates draft parser pipeline design (`day3-parser-pipeline-design.md`) and schema proposal (`day3-sqlite-schema-design.md`) for offline comments.
- ✅ Performance engineer refreshes baseline metrics (parse throughput, memory footprint, latency) from current v1 pipeline.
- ✅ Stan reviews TypeScript strict contracts and identifies required contract tests.
- ✅ DevOps observer readies CI resource envelope data and containerization constraints.
- ✅ Agenda, success criteria, and pre-read links distributed to all participants.

## Key Technical Decisions To Make
- Select orchestration strategy (event-driven vs. batch) and finalize port/adapter contracts per parser.
- Approve AST normalization specification (node typing, symbol metadata, error taxonomy).
- Agree on incremental parsing triggers (file change detection, batching rules) and cache policy.
- Confirm SQLite schema changes (tables, indexes, triggers) and migration sequencing.
- Lock performance targets, baseline repos, and instrumentation responsibilities.

## Post-Sync Deliverables & Ownership
| Deliverable | Owner | Due | Notes |
|---|---|---|---|
| Finalized parser pipeline design doc (ready for sign-off) | Avery (with Bob, Felix) | Week 1 Day 3 EOD | Document updates pushed to `day3-parser-pipeline-design.md` |
| Parser integration POC backlog (Tree-sitter, SWC, Semgrep tasks) | Bob & Felix | Week 1 Day 3 EOD | Stories sized for Week 1–2 sprint |
| SQLite schema migration script draft & review checklist | Bob | Week 1 Day 4 | Align with memory system owner |
| Benchmarking harness setup plan + runbook | Performance Engineer | Week 1 Day 4 | Scripts stored in `automatosx/tmp/p0-week1/` |
| ADR updates referencing approved decisions | Avery | Week 1 Day 4 | Update `.automatosx/abilities/our-architecture-decisions.md` |
| Executive recap with risk/mitigation summary | Program PM | Week 1 Day 3 EOD | Shared with Tony and leadership |

## POC Kickoff Plan (Week 1–Week 2)
1. **Day 3–4:** Stand up unified parser orchestrator skeleton; stub adapters for all three parsers.  
2. **Day 4–6:** Implement incremental parsing hooks and shared symbol table generator; run TS/JS baseline repo tests.  
3. **Day 6–7:** Extend to Go and Rust repos, resolve normalization gaps; populate SQLite staging DB.  
4. **Day 7–8:** Execute performance benchmarks, capture telemetry, compare to baseline (<10% latency delta).  
5. **Day 8–9:** Review findings, update ADRs, and prep Week 2 review with leadership.

> Great architecture is invisible – synchronize early so parser intelligence scales without friction.
