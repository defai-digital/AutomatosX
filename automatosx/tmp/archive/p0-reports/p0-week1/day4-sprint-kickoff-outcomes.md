# P0 Week 1 Day 4 – Sprint 1 Kickoff Outcomes

**Session Date:** 2025-01-09  
**Facilitator:** Avery (Architecture Lead)  
**Duration:** 120 minutes  
**Attendees:** Avery (Architecture), Bob (Backend), Felix (Fullstack), ReScript Champion (Interop Specialist), Oliver (DevOps), Queenie (QA), Release Manager, Stan (Standards – partial), Tony (CTO – opening context)

Great architecture is invisible – it enables teams, evolves gracefully, and pays dividends over decades. Today’s kickoff establishes the runway for delivering ReScript module conversions and SQLite code-intel migrations in Sprint 1.

---

## 1. Sprint Overview
- **Sprint Goal:** Deliver two ReScript-migrated core runtime modules with validated TypeScript bindings, land the first tranche of SQLite code-intel migrations through staging, and finalize onboarding/telemetry guardrails for sustained delivery.
- **Success Criteria:**
  - CI executes `pnpm res:build` + Vitest coverage on every PR touching ReScript artifacts with ≥85% line coverage for generated bindings.
  - Demonstrate MemorySearchService and AgentMemoryBridge running via ReScript bindings in CLI dry-run with telemetry hooks enabled.
  - Apply migrations `202501090900_bootstrap_codeintel.sql` through staging with checksum verification and rollback rehearsal logged.
  - Developer onboarding guide validated by new engineer shadow (TBD) with no critical gaps; telemetry verification checklist executed end-to-end.
- **Sprint Timeline:** 2025-01-09 → 2025-01-22 (10 working days)
  - Day 4 Kickoff (today)
  - Mid-sprint health check: 2025-01-16 (Day 9) at 10:30 PT
  - Demo & Retro: 2025-01-22 (Day 15) at 11:00 PT
- **Team Rituals and Cadence:**
  - Daily standup 09:15–09:30 PT (asynchronous backup Slack thread #p0-sprint1-standup)
  - Architecture / DevOps sync on telemetry Tuesdays 13:00 PT
  - QA alignment sync Thursdays 08:30 PT to track regression gating
  - Release Manager office hours Mondays 14:00 PT for deployment prep
- **Capacity & Assignments:** (Assumption: 1 story point ≈ 6 focused hours)

| Team Member | Role | Availability (hours) | Focus Factor | Effective Capacity (hours) | Velocity Capacity (points) | Primary Sprint Focus |
|-------------|------|----------------------|--------------|----------------------------|----------------------------|----------------------|
| Avery | Architecture | 16 | 0.6 | 9.6 | 2 | FFI patterns, SQLite governance, ADR updates |
| Bob | Backend | 64 | 0.8 | 51.2 | 9 | MemorySearchService, parsers, migrations |
| Felix | Fullstack | 64 | 0.8 | 51.2 | 9 | CLI integration, compatibility views |
| ReScript Champion | Specialist | 48 | 0.7 | 33.6 | 6 | Compiler config, bindings support |
| Oliver | DevOps | 32 | 0.5 | 16.0 | 3 | CI pipelines, telemetry plumbing |
| Queenie | QA | 40 | 0.7 | 28.0 | 5 | Regression coverage, telemetry verification |
| Release Manager | Coordination | 24 | 0.5 | 12.0 | 2 | Migration runbooks, deployment gates |

- **Forecasted Velocity:** 36 committed points (45 stretch). Stretch scope reserved for parser telemetry enhancements contingent on Semgrep throughput.

---

## 2. ReScript Setup Decisions
- **Compiler Configuration:** Confirmed adoption of `rescript@10.1.4` with `@rescript/react@0.12.0`. `bsconfig.json` pinned with `module: "es6"`, `.mjs` suffix, `namespace: true`, and Gentype output to `rescript/gen/*.gen.ts`. Architecture to track deviations via ADR-011 addendum.
- **Build Pipeline:** `pnpm build` now orchestrates `pnpm res:build && tsup`. Watch mode splits ReScript/TypeScript watchers (`pnpm res:watch` + `tsup --watch`). `.gitignore` updated to include `lib/bs`, `.bs.js`, and generated `.gen.ts` artifacts to prevent accidental commits.
- **CI Integration:** New workflow `ci-rescript.yml` triggers on PRs touching `rescript/**` or `bsconfig.json`. Jobs install Node 20 + pnpm 9, run `res:build`, execute `pnpm test:res`, publish coverage via `pnpm coverage:res`, and archive logs on failure. Oliver to wire coverage thresholds and caching of `~/.cache/rescript` by 2025-01-10 (Action ITEM-04).
- **FFI / Binding Patterns:** Gentype `.gen.ts` files are the only TypeScript consumption surface. For ReScript calling TS, we will expose minimal ESM shims under `rescript-shims/` and annotate via `external` with typed `.resi` signatures. Shared types defined in `types/interop/`. Reference module `MemorySearchBridge` will demonstrate both directions by Day 6.
- **Validation Results:**
  - Local build on macOS + Ubuntu verified with 0 warnings after `pnpm res:build`.
  - TypeScript consumer smoke test (`tests/rescript/memory-search.test.ts`) passes, confirming FFI pattern viability.
  - Build pipeline executed on sandbox runner capturing 3m18s runtime; cache priming expected to reduce to <2m.
- **Open Actions:**
  - Avery to append FFI guidelines and deviation policy to ADR-011 (due 2025-01-10 – See ACTION-01).
  - ReScript Champion to publish binding scaffold CLI (`pnpm scaffold:binding`) manual and first tutorial Loom (due 2025-01-13 – ACTION-02).

---

## 3. SQLite Migration Plan
- **Migration Script Review:** Reviewed initial drafts for tables `files`, `symbols`, `calls`, `imports`, `chunks`, `chunks_fts`, `errors`, `parser_runs`, and `incremental_artifacts`. Scripts align with timestamp convention (`YYYYMMDDHHMM_slug.sql`) and include metadata headers. Each migration paired with `_down.sql` for non-production rollback.
- **Versioning & Manifest:** Agreed to maintain `migrations/sqlite/_manifest.json` featuring ordered IDs, SHA-256 checksums, dependencies, and environment flags. Runner will fail fast on checksum drift; Release Manager owns manifest updates and `migration_history` audit table seeding by 2025-01-11.
- **Rollback Strategy:** 
  - Local/CI: Utilize down migrations in reverse order with automated schema snapshot verification.
  - Staging/Production: Pre-run `sqlite-backup` export, apply migrations via `pnpm migrate:sqlite up --env staging`, rehearse restore path, and require Avery + Release Manager approval for rollback invocation.
- **Contentless FTS5 Validation:** Confirmed adoption of `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, tokenize='porter', content='chunks', content_rowid='id');` with triggers on `INSERT/UPDATE/DELETE` to keep the virtual table synchronized without duplicating payload. Unit test `tests/migrations/chunks-fts.test.ts` authored to assert `snippet()` behavior.
- **Compatibility Views:** Felix to publish `CREATE VIEW codeintel_symbols_v1` mirroring legacy schema for CLI queries; includes column aliasing and default values to prevent breaking v1 automation. View to be accompanied by deprecation notice in release notes.
- **Telemetry Hooks:** `parser_runs` table will log `id`, `started_at`, `completed_at`, `duration_ms`, `incremental_hit_rate`, and `workspace_slug`. TelemetryDispatcher to emit `sqlite_schema_version` gauge post-migration.
- **Outstanding Work:**
  - ACTION-03: Avery to update `chunks_fts` DDL per Day 3 finding and regenerate test fixtures (due 2025-01-10).
  - ACTION-05: Felix to deliver compatibility view + migration test harness (due 2025-01-12).
  - ACTION-06: Oliver to script checksum validation in CI pipeline `pnpm migrate:sqlite status --assert-clean` (due 2025-01-11).

---

## 4. Developer Onboarding & Workflow
- **Handbook Status:** Day 4 handbook now marked “Ready for Validation”. Added ReScript compiler steps, Gentype workflow, migration command cheatsheet, and debugging guidance. Remaining gap: integrate telemetry verification walkthrough once DevOps publishes dashboards (ACTION-07).
- **Setup Checklist Enhancements:**
  - Mandatory verification commands: `pnpm res:build`, `pnpm test`, `pnpm test:res`, `pnpm migrate:sqlite status`.
  - `.env` template updated with `RESCRIPT_CACHE_DIR` and `SQLITE_DB_MIGRATION_PATH`.
  - Container image `automatosx-dev` now includes sqlite3 3.45, Vitest 1.3, and c8 coverage.
- **Local Development Flow:** Documented change sequence: ReScript update → Gentype verification → TS consumer updates → migrations (if needed) → telemetry instrumentation check → tests → docs. Pairing expectation: new ReScript contributions require co-review with ReScript Champion until confidence improves.
- **Code Review Checkpoints for ReScript PRs:**
  1. `bsconfig` or Gentype changes require Architecture sign-off.
  2. Proof of automated test coverage referencing new `.gen.ts` exports.
  3. Link to ADR-011 section and annotate deviations.
  4. Confirm fallback flag or kill-switch for runtime changes.
  5. Ensure telemetry instrumentation plan validated with Queenie/Oliver when touching metrics.
- **Telemetry Verification Workflow:** 
  - Step 1: Deploy branch to staging sandbox.
  - Step 2: Run `pnpm telemetry:verify --suite rescript-bindings` to compare metrics vs. baseline.
  - Step 3: Queenie reviews Grafana dashboards for `parse_duration_ms`, `sqlite_schema_version`, `cli_latency_p95`.
  - Step 4: Release Manager logs results in `automatosx/tmp/p0-week1/telemetry-verify-log.csv`.
  - Step 5: Failure triggers entry in daily standup thread with owner & ETA.

---

## 5. Sprint Backlog (Committed Scope)

| ID | Title | Type | Description | Acceptance Criteria | Points | Owner(s) | Status |
|----|-------|------|-------------|---------------------|--------|----------|--------|
| P0-S1-01 | Deliver MemorySearchService baseline (AI-2) | Story | Implement ReScript-backed MemorySearchService and wire CLI | - [ ] ReScript module compiled with Gentype shim<br>- [ ] CLI dry-run returns search results<br>- [ ] Telemetry events emitted<br>- [ ] QA smoke passes | 8 | Bob, ReScript Champion | In Progress |
| P0-S1-02 | Finalize MemoryManager ↔ AgentMemoryBridge (AI-4) | Story | Align runtime bridge interfaces and integration tests | - [ ] Contract signed off in ADR-011<br>- [ ] Integration test `agent-memory-bridge.spec.ts` green<br>- [ ] CLI + agents share bridge<br>- [ ] Rollback flag documented | 5 | Bob, Felix | Not Started |
| P0-S1-03 | Publish telemetry rollout plan (AI-5) | Story | Deliver telemetry plan covering runtime + providers | - [ ] Plan reviewed by Architecture + QA<br>- [ ] Metrics catalog updated<br>- [ ] CI lint checks added<br>- [ ] Risk R-4 residual set to Low | 3 | Oliver | In Progress |
| P0-S1-04 | Gemini streaming fallback strategy (AI-1) | Story | Provide fallback for Gemini command while parity gap remains | - [ ] Fallback spec published<br>- [ ] Feature flag gating implemented<br>- [ ] QA scenario automated<br>- [ ] Risk R-1 residual Medium | 3 | Frank | Not Started |
| P0-S1-05 | RunsCommand parity closure (AI-3) | Story | Ensure RunsCommand matches v1 behavior with telemetry | - [ ] Unit + integration tests covering history<br>- [ ] CLI parity demo recorded<br>- [ ] Telemetry tie-in validated<br>- [ ] Docs updated | 3 | Frank | Not Started |
| P0-S1-06 | OpenAI Assistants v2 stub (AI-6) | Story | Stand up Assistants provider stub with tests and feature flag | - [ ] Stub merged with feature flag<br>- [ ] Contract doc shared<br>- [ ] Unit tests + smoke CLI run<br>- [ ] Rollback path defined | 5 | Bob | Not Started |
| P0-S1-07 | Draft ADR-011 ReScript gating (AI-7) | Story | Complete ADR describing feature flags, rollback, QA hooks | - [ ] Draft circulated<br>- [ ] QA requirements included<br>- [ ] Telemetry + rollback sections added<br>- [ ] Approved by Architecture Board | 2 | Avery | In Progress |
| P0-S1-08 | Parser performance plan execution (AI-8) | Story | Documented throughput plan with instrumentation | - [ ] Bench scripts parameterized<br>- [ ] Telemetry events live<br>- [ ] CI job scheduled<br>- [ ] ≥200 files/min target reachable | 3 | Avery, Bob | In Progress |
| P0-S1-09 | TaskRunner refactor kickoff (AI-9) | Story | Align TaskRunner with ConcurrencyController | - [ ] Refactor plan documented<br>- [ ] Unit scaffold merged<br>- [ ] Backward compatibility tests<br>- [ ] Risk R-6 residual Low | 5 | Bob | Not Started |
| P0-S1-10 | StateGraphBuilder design sign-off (AI-10) | Story | Secure approvals for StateGraphBuilder with tests | - [ ] Design doc updated<br>- [ ] Integration tests defined<br>- [ ] Release Manager sign-off<br>- [ ] Linked to ADR-010 addendum | 3 | Avery, Bob | Not Started |
| P0-S1-11 | Inline Semgrep stage implementation | Story | Add Semgrep inline stage with feature flag per Day 3 | - [ ] Concurrency cap enforced<br>- [ ] Feature flag toggles per workspace<br>- [ ] Telemetry instrumentation added<br>- [ ] Performance regression <10% | 5 | Bob, Felix | Not Started |
| P0-S1-12 | Incremental artifact TTL enforcement | Task | Implement TTL/size caps for incremental artifacts | - [ ] Nightly cleanup job<br>- [ ] Telemetry gauge<br>- [ ] Manifest doc updated<br>- [ ] QA verifies no data loss | 3 | Bob | Not Started |
| P0-S1-13 | Telemetry event schema publication | Task | Define schema for parser + migration events | - [ ] JSON schema committed<br>- [ ] TelemetryDispatcher docs updated<br>- [ ] QA sign-off<br>- [ ] Linked to metrics catalog | 2 | Oliver, Avery | Not Started |
| P0-S1-14 | Update chunks_fts DDL | Task | Adjust DDL to match contentless strategy | - [ ] Migration updated<br>- [ ] Tests updated<br>- [ ] Backfilled DB validated<br>- [ ] Doc notes pushed | 2 | Avery | In Progress |
| P0-S1-15 | Create codeintel_symbols_v1 view | Story | Provide compatibility view for legacy CLI queries | - [ ] View migration applied<br>- [ ] CLI regression tests pass<br>- [ ] Deprecation plan documented<br>- [ ] QA sign-off | 3 | Felix | Not Started |
| P0-S1-16 | Symbols metadata schema definition | Task | Document allowed metadata keys/types | - [ ] Schema doc merged<br>- [ ] Validation added to migrations<br>- [ ] QA tests updated<br>- [ ] Linked in ADR-010 addendum | 2 | Avery | Not Started |
| P0-S1-17 | ResScript bsconfig governance | Task | Final review + lock bsconfig changes | - [ ] Governance checklist completed<br>- [ ] Diff summary posted<br>- [ ] Standards review sign-off<br>- [ ] CI baseline recorded | 2 | Avery, ReScript Champion | In Progress |
| P0-S1-18 | ReScript CI cache optimization | Task | Add caching to CI workflow | - [ ] Cache step implemented<br>- [ ] Runtime reduced <2m<br>- [ ] Failure fallback documented<br>- [ ] Telemetry on cache hits | 3 | Oliver | Not Started |
| P0-S1-19 | Binding scaffold CLI tutorial | Task | Document `pnpm scaffold:binding` usage | - [ ] README + Loom<br>- [ ] Sample module generated<br>- [ ] Feedback from Bob<br>- [ ] Linked in onboarding | 2 | ReScript Champion | Not Started |
| P0-S1-20 | Telemetry verification checklist run | Task | Execute telemetry workflow on sample branch | - [ ] Checklist executed<br>- [ ] Metrics snapshot saved<br>- [ ] Findings shared with QA<br>- [ ] Residual risk logged | 2 | Queenie, Release Manager | Not Started |

**Dependencies & Blockers**

| Dependency | Description | Owner | Needed By | Status | Mitigation |
|------------|-------------|-------|-----------|--------|------------|
| D-01 | Gentype `.gen.ts` generation for MemorySearchService | ReScript Champion | 2025-01-11 | On Track | Pairing w/ Bob on Day 5 |
| D-02 | Telemetry dashboard updates for new metrics | Oliver | 2025-01-13 | At Risk | ACTION-07 to fast-track instrumentation |
| D-03 | Semgrep license token renewal for CI | Release Manager | 2025-01-12 | At Risk | Escalate to Tony if procurement delays |
| D-04 | Dedicated CI runner reservation for benchmarks | DevOps | 2025-01-14 | On Track | Backup: fall back to shared runner overnight |
| D-05 | QA golden dataset (GAP-03) availability | Queenie & Data | 2025-01-11 | Blocked | Data partner escalated; daily check-ins |

---

## 6. Action Items

| ID | Description | Owner | Due | Notes |
|----|-------------|-------|-----|-------|
| ACTION-01 | Append FFI governance and review checklist to ADR-011 | Avery | 2025-01-10 | Include examples for inbound/outbound bindings |
| ACTION-02 | Publish binding scaffold tutorial (README + Loom) | ReScript Champion | 2025-01-13 | Collect feedback from Bob & Felix |
| ACTION-03 | Update `chunks_fts` DDL + regenerate migration fixtures | Avery | 2025-01-10 | Aligns with Day 3 modification requirement |
| ACTION-04 | Enable ReScript cache + coverage thresholds in CI | Oliver | 2025-01-10 | Target runtime <2m, threshold ≥85% |
| ACTION-05 | Deliver `codeintel_symbols_v1` compatibility view migration | Felix | 2025-01-12 | Include regression test updates |
| ACTION-06 | Add checksum validation to CI migration job | Oliver | 2025-01-11 | Fail build on mismatch |
| ACTION-07 | Integrate telemetry verification walkthrough into onboarding | Queenie & Oliver | 2025-01-13 | Depends on updated dashboards |
| ACTION-08 | Schedule spike outcome review for Semgrep throughput | Bob | 2025-01-14 | Validate <10% latency regression |
| ACTION-09 | Confirm Semgrep feature flag defaults documented | Avery | 2025-01-12 | Add to release notes + configuration docs |
| ACTION-10 | Align sprint backlog items with Jira tickets (AI-1…AI-10) | Release Manager | 2025-01-09 | Link backlog table IDs to Jira keys |

Legacy action items AI-1 through AI-10 remain open; sprint backlog entries P0-S1-01 through P0-S1-10 map directly to them for execution tracking.

---

## 7. Risk Updates

| Risk ID | Description | Likelihood | Impact | Mitigation | Owner | Trigger | Residual |
|---------|-------------|------------|--------|------------|-------|---------|----------|
| R-1 | Gemini streaming parity gap delaying CLI readiness | Medium (steady) | High | Sprint story P0-S1-04, alternate fallback flow, QA automation | Frank | No fallback by 2025-01-12 | Medium |
| R-2 | Memory search stack not delivered (blocks CLI + agents) | High (improving) | High | P0-S1-01/02 commitment, paired delivery, daily progress reporting | Bob | Status slips >1 day | Medium |
| R-3 | ReScript runtime ships without rollback | Medium (improving) | High | ADR-011 gating, feature flags, telemetry verification checklist | Avery | ADR-011 not approved by 2025-01-11 | Low |
| R-4 | Telemetry gaps hide regressions | Medium (steady) | Medium | Telemetry plan (P0-S1-03), dashboards, ACTION-07 | Oliver | Coverage <85% or missing metrics | Low |
| R-5 | Parser throughput <200 files/min with Semgrep inline | Medium (rising) | Medium | P0-S1-11/12, throughput spike review ACTION-08 | Bob | Latency regression >10% | Medium |
| R-6 | TaskRunner refactor delays concurrency coverage | Medium (steady) | Medium | P0-S1-09 with unit scaffold, weekly check-in | Bob | No PR by 2025-01-15 | Low |
| R-7 | ReScript CI coverage instrumentation brittle | Medium (new) | Medium | CI thresholds (ACTION-04), telemetry verification checklist, gating on coverage report | Oliver | Coverage job fails 2 consecutive runs | Low |
| R-8 | SQLite migration lock contention in staging | Low (new) | High | Rollback rehearsal, staging window scheduling, runbook updates | Release Manager | Migration runtime >2m | Low |

Risks R-1 through R-6 persist from Day 1; mitigations strengthened via sprint backlog commitments. New risks R-7 and R-8 introduced to track CI coverage robustness and migration contention respectively.

---

## 8. Sprint Success Tracking
- **Definition of Done Alignment:** ReScript builds green in CI (coverage ≥85%), migrations applied locally/staging with checksums, documentation updated, telemetry verified, QA sign-off recorded, Release Manager approval secured.
- **Metrics:** Daily burn-down maintained on shared board; telemetry KPIs include `parse_duration_ms`, `incremental_hit_rate`, `sqlite_schema_version`, CLI latency p95.
- **Communication:** End-of-day status posted to #p0-sprint1-standup with progress, risks, and blockers. Mid-sprint health check to review burn-down, risk triggers, and adjust scope if MemorySearchService remains at risk.
- **Escalation Protocol:** Blockers >24h escalate to Avery & Tony; unresolved dependencies flagged in morning standup and tracked via ACTION log.

---

## 9. Closing Notes
- Sprint commitment affirmed by all owners. Stretch scope limited to performance telemetry once core stories P0-S1-01 through P0-S1-06 show “At Risk” = No.
- Avery to circulate this outcomes document, update `.automatosx/abilities/our-architecture-decisions.md` after ADR-011 is finalized, and ensure cross-team alignment through weekly architecture runway review.
- Next checkpoints: Daily standups, telemetry sync (2025-01-14), mid-sprint health check (2025-01-16), leadership update (2025-01-17).

The runway is now defined—let’s execute with discipline so the architecture remains invisible and empowering.
