# P0 Week 1 Day 3 – Code-Intel Technical Outcomes

## 1. Design Review Results

### Parser Pipeline (Tree-sitter · SWC · Semgrep)
- **Disposition:** Conditionally Approved
- **Key Findings:**
  - Port/adapter contracts align with our modular architecture and support language-specific capabilities without breaking Layer 3–5 boundaries.
  - Incremental parsing strategy (hash/mtime diff + artifact cache) satisfies the Memory & Code Intelligence cluster dependency from Day 1, provided cleanup and telemetry are added.
  - AST normalization and symbol merge precedence (Tree-sitter > SWC > Semgrep) provide deterministic provenance needed for downstream CLI queries.
- **Modifications Required:**
  1. Document and implement Semgrep as an inline orchestrator stage with a concurrency cap of 2 workers and a feature flag (`enableSemgrep`) to disable per workspace. (Owner: Bob w/ Felix, Due: 2025-01-09)
  2. Add a retention policy for `incremental_artifacts` (14-day TTL, 500 MB cap per workspace) with nightly cleanup and telemetry gauges surfaced through `TelemetryDispatcher`. (Owner: Bob, Due: 2025-01-10)
  3. Extend telemetry integration notes to specify event schemas consumed by `TelemetryDispatcher` and performance dashboards (parse duration, cache hit rate, fallback counters). (Owner: Oliver, Due: 2025-01-09)
- **Risks Identified:**
  - Semgrep inline execution may drop throughput below the ≥200 files/min target (Severity: High).
  - Incremental artifact growth could exceed 500 MB per repo without TTL enforcement (Severity: High).
  - Telemetry wiring gap keeps R-4 (runtime observability) open (Severity: Medium).
- **Dependencies:**
  - `src/core/memory-manager.ts` / `agent-memory-bridge.ts` integration (Day 1 AI-4).
  - Telemetry plan from AI-5 (Oliver) for metric ingestion.
  - Updated Tree-sitter grammars for TS 5.x decorators and Rust macros (Bob).

### SQLite Schema Evolution
- **Disposition:** Conditionally Approved
- **Key Findings:**
  - New tables (`files`, `symbols`, `calls`, `imports`, `chunks`, `errors`, `parser_runs`, `incremental_artifacts`) capture the metadata required for unified code intelligence.
  - Index strategy (language, name/kind, file-level) preserves query plans for `ax find/def/flow` while enabling incremental scheduling.
  - Trigger set keeps FTS synchronized with chunk updates and supports transactional batch writes from the orchestrator.
- **Modifications Required:**
  1. Revise `chunks_fts` DDL to use `content='chunks', content_rowid='id'` so the virtual table remains contentless but still supports `snippet()` via the base `chunks` table. (Owner: Avery, Due: 2025-01-09)
  2. Publish a compatibility view (`codeintel_symbols_v1`) mirroring the legacy column layout to avoid breaking existing CLI queries until the CLI migration lands. (Owner: Felix, Due: 2025-01-10)
  3. Define and document a JSON schema for the `symbols.metadata` column (allowed keys, value types) to keep provenance consistent and queryable. (Owner: Avery, Due: 2025-01-10)
- **Risks Identified:**
  - Migration may hold write locks long enough to block CLI usage on large workspaces (Severity: Medium).
  - Unbounded `chunks.text` payloads risk SQLite file growth >20% quarter-over-quarter (Severity: Medium).
  - Backfill of `origin_mask` relies on accurate legacy parser attribution; errors could skew downstream analytics (Severity: Low).
- **Dependencies:**
  - Migration tooling (`ax datastore migrate`) and backup automation.
  - CLI contract alignment (Felix) and Memory Manager wiring (Bob).
  - Performance plan reliance on `parser_runs` metrics (Performance Engineer).

### Performance Benchmarking Plan
- **Disposition:** Approved
- **Key Findings:**
  - Test matrix covers target languages and repo shapes (monorepo TS, Go services, Rust macros, polyglot mix, Semgrep rules) to validate throughput and latency.
  - Metrics instrumentation aligns with orchestrator telemetry hooks (`parse_duration_ms`, `batch_duration_ms`, `incremental_hit_rate`, CLI latency p95).
  - Failure-injection scenario ensures fallback logic timing is measured prior to production rollout.
- **Modifications Required:** None.
- **Risks Identified:**
  - Shared runner noise could mask >10% regressions unless the dedicated CI runner reservation is completed (Severity: Medium).
  - Benchmark data drift if fixtures are not pinned quarterly (Severity: Low).
- **Dependencies:**
  - TelemetryDispatcher and orchestrator instrumentation changes from parser pipeline modifications.
  - Dedicated CI runner allocation (DevOps) and nightly job plumbing.
  - SQLite schema migrations to ensure metrics land in `parser_runs` and related tables.

## 2. Technical Decisions Log

| # | Decision | Rationale | Trade-offs | Owner | Follow-up |
|---|---|---|---|---|---|
| D-1 | Run Semgrep inline within the orchestrator after AST normalization with max concurrency of 2 workers. | Keeps symbol provenance consistent per batch and simplifies retry semantics. | Inline execution increases latency; mitigated with concurrency cap and feature flag. | Bob | Update parser design doc & orchestrator config by 2025-01-09. |
| D-2 | Enforce a 14-day TTL (and 500 MB cap) on `incremental_artifacts` with nightly cleanup and telemetry. | Controls SQLite growth and prevents stale artifacts from skewing incremental hit rates. | Re-parsing aged artifacts adds compute overhead after TTL expiry. | Bob | Implement cleanup job and telemetry gauge by 2025-01-10. |
| D-3 | Configure `chunks_fts` with `content='chunks', content_rowid='id'` to leverage base-table text for snippets. | Preserves snippet support while avoiding duplicate text storage. | Migration requires rebuilding triggers and reindexing FTS. | Avery | Update schema doc + migration script draft by 2025-01-09. |
| D-4 | Create `codeintel_symbols_v1` compatibility view for CLI until new queries ship. | Prevents CLI regressions during schema migration window. | Additional view maintenance until CLI parity achieved. | Felix | Land view definition with migration 0013 by 2025-01-10. |
| D-5 | Gate nightly benchmarks in CI and page #p0-code-intel when parse throughput drops below 200 files/min or latency breaches 10%. | Keeps performance guardrails actionable and transparent. | Nightly job consumes CI minutes and requires dedicated runners. | Performance Engineer | Wire job + alerting in CI by 2025-01-10. |

## 3. POC Kickoff Plan
- **Scope:** Implement unified parser orchestrator (Tree-sitter TS/JS/Go/Rust, SWC enrichment, Semgrep rule engine), populate new SQLite schema tables, and deliver telemetry + benchmark automation proving throughput ≥200 files/min with <10% latency regression.
- **Success Criteria:** 
  - Parser run on `sample-ts-monorepo`, `goservices-suite`, and `rust-crates-pack` completes within 5 minutes with ≥60% incremental hit rate after warm cache.
  - CLI commands (`ax find`, `ax def`, `ax flow`) operate against new schema with p95 latency <100 ms (symbol) / <500 ms (FTS).
  - `parser_runs` dashboard shows completed batches with Semgrep inline stage enabled and zero critical errors.
  - Migration 0013 runs in <2 minutes on 10k-file fixture with validated rollback plan.
- **Timeline (Week 1–2):**
  - **W1 D3–D4:** Finalize design updates (Semgrep inline spec, FTS adjustments), stub orchestrator skeleton, create compatibility view.
  - **W1 D4–D6:** Implement adapters + incremental cache TTL, run TS/JS baseline, validate schema writes.
  - **W1 D6–D7:** Extend to Go & Rust, populate call graph/import tables, execute migration dry run.
  - **W1 D7–D8:** Execute performance harness full and incremental scenarios, capture telemetry, tune concurrency.
  - **W2 D1–D2:** Automate nightly CI benchmarks, close action items, prep demo artifacts.
  - **W2 D3:** Leadership review + ADR updates.
- **Resource Assignments:** Bob (orchestrator + schema writes), Felix (CLI integration + compatibility view), Avery (architecture governance, ADR updates), Oliver (telemetry ingestion), Performance Engineer (benchmark harness), Stan (TypeScript strict contracts, adapter tests).
- **Daily Check-ins:** 09:15 PT parser stand-up (Bob, Felix, Avery, Performance Engineer, Oliver) with 15-minute limit; asynchronous update in `#p0-code-intel` by 15:00 PT.
- **Escalation Criteria:** Raise to Avery/Tony if throughput <150 files/min after two tuning attempts, migration dry run exceeds 10-minute lock window, or telemetry gap persists beyond W1 D6.

## 4. Integration Points
- **Memory & Code Intelligence Cluster:** Orchestrator writes consume `MemoryManager` APIs; compatibility view keeps CLI stable while Memory bridge aligns with new symbol metadata. Incremental TTL ties into Day 1 AI-4 deliverables.
- **SQLite Schema & Migration:** Parser pipeline now depends on migration 0013; `parser_runs` metrics feed performance dashboards; cleanup job leverages schema triggers.
- **CI/CD & Telemetry:** Nightly benchmark job feeds `TelemetryDispatcher` metrics into Grafana-equivalent dashboards; alerts integrate with DevOps paging. Migration scripts executed via `ax datastore migrate` before enabling new pipeline in CI.
- **CLI Contract:** Felix to update CLI ingestion to respect parser health (via `parser_runs` status) and leverage new view until full query rewrite completes.

## 5. Action Items Register

| ID | Task | Owner | Due | Priority | Blocking | Dependencies | Acceptance Criteria |
|---|---|---|---|---|---|---|---|
| AI-D3-1 | Update parser design doc + orchestrator config with Semgrep inline stage (concurrency cap, feature flag, fallback notes). | Bob | 2025-01-09 | P0 | Yes | day3-parser-pipeline-design.md, Semgrep rule matrix | Document merged + reviewed by Avery & Felix; config stub checked into repo. |
| AI-D3-2 | Implement 14-day TTL cleanup for `incremental_artifacts` with telemetry gauges. | Bob | 2025-01-10 | P0 | Yes | SQLite schema, TelemetryDispatcher spec | Cleanup job runs in staging DB; telemetry panel shows artifact size + TTL hits. |
| AI-D3-3 | Revise migration 0013 with `chunks_fts` content linkage and rebuild triggers. | Avery | 2025-01-09 | P0 | Yes | day3-sqlite-schema-design.md, migration scaffolding | Updated DDL reviewed by Bob; dry-run migration passes on fixture DB. |
| AI-D3-4 | Publish `codeintel_symbols_v1` compatibility view and update CLI to query view until rewrite. | Felix | 2025-01-10 | P0 | Yes | Migration 0013, CLI query layer | View available post-migration; CLI smoke tests pass against new schema. |
| AI-D3-5 | Extend TelemetryDispatcher plan with parser metrics schema + alert routing. | Oliver | 2025-01-09 | P0 | Yes | Existing AI-5 telemetry plan | Telemetry plan addendum approved by Avery; alert pipeline configured. |
| AI-D3-6 | Reserve dedicated CI runner and wire nightly benchmark job + alert thresholds. | Performance Engineer | 2025-01-10 | P1 | No | DevOps runner allocation, benchmarking harness | Nightly job visible in CI, alert fires on synthetic regression test. |
| AI-D3-7 | Update ADR-010 appendix / draft ADR-011 to reference new parser orchestration decisions. | Avery | 2025-01-13 | P1 | No | ADR backlog, design outcomes | ADR updates merged; Tony notified in weekly architecture recap. |

## 6. Risk Register Updates

| Risk | Likelihood | Impact | Mitigation | Owner | Trigger | Residual Risk |
|---|---|---|---|---|---|---|
| R-7: Semgrep inline stage reduces throughput below 200 files/min | Medium | High | Cap Semgrep workers at 2, measure `parse_duration_ms` per language, abort Semgrep on repeated timeouts while logging provenance. | Bob | Benchmark run shows <200 files/min throughput. | Medium |
| R-8: Incremental artifacts table exceeds 500 MB causing SQLite bloat | Medium | Medium | Enforce 14-day TTL cleanup, emit size gauge, page when >400 MB. | Bob | Telemetry gauge >400 MB for any workspace. | Low |
| R-9: Migration 0013 locks database >5 minutes impacting CLI users | Low | High | Perform dry-run on staging, schedule maintenance window, provide rollback instructions in runbook. | Avery | Migration rehearsal exceeds 5 minutes or lock detected in staging. | Low |
| R-10: Telemetry gap blocks benchmark gating and violates R-4 | Medium | Medium | Complete TelemetryDispatcher integration, verify metrics recorded before enabling nightly gate. | Oliver | No parser metrics in telemetry feed by W1 D6. | Low |

> Great architecture is invisible – today’s decisions keep the parser pipeline governable, observable, and ready to evolve for the next decade.
