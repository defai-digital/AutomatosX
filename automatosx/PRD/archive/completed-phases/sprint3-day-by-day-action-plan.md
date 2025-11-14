# Sprint 3 Day-by-Day Action Plan (Parity Completion + Plugin SDK Alpha)

## Working Assumptions
- Sprint window: Weeks 5–6 (Days 21–30) with 11 contributors (3 CLI/TS, 3 Quality, 3 Runtime, 2 DevOps, 1 PM).
- Test baseline entering Sprint 3 is 1,616 passing cases; goal is 2,116 (+500) with ~70 net tests per day.
- Residual parity scope (memory, CLI edges, provider fallback, golden traces) must complete before Plugin SDK Alpha tasks overtake bandwidth.
- Tooling + terminology follow Sprint 1 & Sprint 2 conventions (WorkspaceManager, golden trace harness, Vitest/fast-check, AutomatosX CLI).

## 1. Day-by-Day Overview
| Day | Date (Week 5–6) | Daily Objective | Key Deliverables | Critical Path | Test Count Target |
|-----|-----------------|-----------------|------------------|---------------|-------------------|
| 21 | Mon (Week 5) | Rebaseline parity ledger & unblock memory fixtures | Updated parity backlog, SQLite fixture pack, CLI backlog triage | Fixture ingestion + ledger sign-off | 1,616 |
| 22 | Tue (Week 5) | Agent memory integration suite kickoff | 60-test memory suite scaffolding, deterministic DB copies | Memory harness running in CI | 1,686 |
| 23 | Wed (Week 5) | Mid-point review + CLI edge expansion | 50 CLI edge tests, health check packet, risk log | Health check decisions, CLI flake burn-down | 1,756 |
| 24 | Thu (Week 5) | Provider fallback + golden trace lift | Chaos harness, 25 fallback tests, +25 traces (125 total) | Provider sandbox keys, trace diff triage | 1,826 (stretch 1,896) |
| 25 | Fri (Week 5) | Gate: parity closed + 150 traces | Parity ledger zero gaps, 150 traces, gate deck | Tests ≥1,966, gate criteria met | 1,966 |
| 26 | Mon (Week 6) | Plugin SDK Alpha kickoff | Manifest schema, validation tests, CLI scaffolding backlog | Schema approval, CLI skeleton merged | 2,016 |
| 27 | Tue (Week 6) | Lifecycle hooks + loader skeleton | Hook contracts, loader harness, 75 tests | Hook contract freeze, loader smoke green | 2,066 |
| 28 | Wed (Week 6) | CLI scaffolding + plugin runtime wiring | `ax plugin` commands, telemetry plumbing, 50 tests | CLI smoke across OS, runtime bridge ready | 2,091 |
| 29 | Thu (Week 6) | Internal plugins (telemetry export + code intel) | Two plugin repos, 55 plugin tests, demo scripts | Plugin isolation + coverage gate | 2,108 |
| 30 | Fri (Week 6) | Final gate + Plugin SDK Alpha demo | SDK docs, release notes, 2,116 tests, handoff packet | Gate checklist, release go/no-go | 2,116 |

## 2. Detailed Daily Plans — Week 5 (Days 21–25)

### Day 21 (Mon, Week 5): Rebaseline Parity Ledger & Memory Fixtures
**Morning Standup Agenda (9:00–9:15)**
1. Confirm Sprint 2 carry-overs closed and test counts stable at 1,616.
2. Outline Day 21 deliverables (ledger refresh, fixture ingestion, CLI backlog triage).
3. Surface blockers: transcript access, SQLite locking, provider sandbox quotas.

**Squad Assignments (est.)**
- **CLI/TypeScript Squad (TS1, TS2, TS3 — 6h focus)**
  - TS1 (3h): Audit CLI parity backlog vs Sprint 2 close-out, tag memory/CLI/fallback owners in Linear; acceptance: backlog grouped with priority labels.
  - TS2 (2h): Extend CLI harness to support WorkspaceManager fixture swaps for memory tests; acceptance: `ax cli:test --fixtures=memory` flag works locally.
  - TS3 (4h): Pair with PM to capture CLI edge-case narratives for Week 5 doc; acceptance: doc snippet added to sprint PRD.
- **Quality Squad (QAL, S1, S2 — 6.5h)**
  - QAL (3h): Refresh parity ledger (v1 trace IDs, owners, due dates); acceptance: ledger totals 250 residual tests.
  - S1 (2.5h): Build deterministic SQLite fixture pack with per-test DB copies; acceptance: fixtures stored under `automatosx/tmp/parity/memory-fixtures`.
  - S2 (3h): Validate golden trace capture tooling for new transcripts; acceptance: dry run adds 5 traces without diffs.
- **Runtime Squad (RE1, RE2, RE3 — 6h)**
  - RE1 (3h): Document agent memory integration points and deliver sample context factories.
  - RE2 (2h): Provide provider fallback stubs for CLI harness; acceptance: mock returns typed error envelopes.
  - RE3 (2h): Align with DevOps on chaos toggle instrumentation for provider tests.
- **DevOps Squad (DO1, DO2 — 5h)**
  - DO1 (3h): Carve CI shard for parity fixtures (Linux + macOS) with cached SQLite artifacts.
  - DO2 (2h): Validate provider sandbox capacity for chaos tests; acceptance: quota email confirmation.
- **Product Manager (PM — 3h)**
  - Host ledger walkthrough (1h), capture risk log (1h), circulate recap (1h).

**Critical Path Tasks**
- Parity ledger updated + approved by noon.
- SQLite fixture pack signed off by QAL + RE1.

**Pairing Sessions**
- 11:00–12:00 — TS2 + S1: CLI harness fixture swaps.
- 2:30–3:30 — QAL + PM: Ledger prioritization + reporting prep.

**Code Review Checkpoints**
- 3:00 PM: Fixture pack PR (S1 owner) reviewed by RE1 + DO1.
- 4:30 PM: CLI backlog doc PR (TS3 owner) reviewed by PM.

**End-of-Day Demo (5:00 PM)**
- Show parity ledger dashboard, fixture swap command, trace capture snippet.

**Test Count Target**: Maintain 1,616 (no regressions) while staging +20 smoke tests in draft.

**Definition of Done**
- Ledger reflects 250 remaining tests with owners, fixtures reusable in CI, provider quotas confirmed.

---

### Day 22 (Tue, Week 5): Agent Memory Integration Suite Kickoff
**Morning Standup Agenda**
- Review Day 21 outputs, confirm fixture availability.
- Align on 60 memory tests (reads, writes, semantic search, eviction) + CLI harness updates.
- Blockers: determinism vs caching, memory indexing perf.

**Squad Assignments**
- **CLI/TypeScript (6.5h)**
  - TS1 (4h): Implement memory CLI commands coverage (history purge, slot pinning) with Vitest; deliver 20 tests.
  - TS2 (3h): Wire CLI -> runtime contract for memory contexts with typed Zod schema; deliver contract doc.
  - TS3 (3h): Build CLI fixtures seeding script + docs.
- **Quality (7h)**
  - QAL (3h): Author integration test plan (reads/writes/semantic) + assign owners.
  - S1 (3h): Implement 25 integration tests hitting new fixtures (Vitest + fast-check) with deterministic seeds.
  - S2 (2.5h): Setup nightly job to rerun failing memory tests twice before triage.
- **Runtime (6h)**
  - RE1 (3h): Expose memory context builders to CLI via bridges; acceptance: TypeScript definitions compile.
  - RE2 (2h): Optimize caching toggles for deterministic runs.
  - RE3 (2h): Pair with QAL on failure envelopes for memory ops.
- **DevOps (5h)**
  - DO1 (3h): Split CI stage for memory suite, ensure <8m runtime.
  - DO2 (2h): Add SQLite artifacts to build cache + retention policy doc.
- **PM (2h)**
  - Monitor test velocity, prep health check inputs.

**Critical Path Tasks**
- Memory suite skeleton merged before 3 PM.
- CLI ↔ runtime contract documented + approved.

**Pairing Sessions**
- 10:30–12:00 — TS1 + S1: Write first 10 integration tests.
- 2:00–3:00 — RE1 + DO1: Validate CI shard stability.

**Code Review Checkpoints**
- Noon: Contract doc PR (TS2) reviewed by RE1 + PM.
- 4:00 PM: Memory suite PR (S1) reviewed by TS1 + QAL.

**End-of-Day Demo**
- Run CLI memory commands vs fixtures, show deterministic test logs, highlight net +70 tests.

**Test Count Target**: 1,686.

**Definition of Done**
- 60 memory tests merged or queued with green CI, CLI contract doc approved, nightly rerun job live.

---

### Day 23 (Wed, Week 5): Mid-point Review + CLI Edge Expansion
**Morning Standup Agenda**
- Start with lightning health-check: morale, scope confidence, risk log status.
- Focus for day: 50 CLI edge tests (cancellation, malformed manifest, workspace boundaries), finalize mid-point packet.
- Blockers: Need provider fallback mocks, CLI streaming logger stability.

**Squad Assignments**
- **CLI/TypeScript (6h)**
  - TS1 (3h): Add cancellation + retry tests (15 cases) for CLI runs.
  - TS2 (3h): Implement malformed manifest validation tests (15 cases) using new schema.
  - TS3 (3h): Harden workspace boundary enforcement tests (10 cases) + doc update.
- **Quality (6.5h)**
  - QAL (2h): Compile health-check metrics (velocity, quality, risk) + present midday.
  - S1 (3h): Own CLI streaming telemetry tests (10 cases) verifying event ordering.
  - S2 (3h): Run golden trace diff review for new transcripts; raise issues.
- **Runtime (5.5h)**
  - RE1 (2h): Provide cancellation hooks to CLI for deterministic tests.
  - RE2 (2h): Support workspace guard rails (capabilities) to ensure tests pass.
  - RE3 (2h): Pair with Quality on telemetry event fixture generation.
- **DevOps (4.5h)**
  - DO1 (2.5h): Instrument CI to tag CLI edge failures with owning squad.
  - DO2 (2h): Provide dashboards for health-check review.
- **PM (4h)**
  - Host mid-point health review (1.5h prep + facilitation), capture risk decisions, publish summary.

**Critical Path Tasks**
- Health-check decisions logged + action owners assigned.
- 50 CLI edge tests merged with artifacts.

**Pairing Sessions**
- 11:00–12:00 — QAL + DO2: Health metrics alignment.
- 2:30–3:30 — TS3 + RE2: Workspace boundary enforcement tests.

**Code Review Checkpoints**
- 1:00 PM: CLI cancellation PR (TS1) reviewed by RE1.
- 4:00 PM: Health check memo reviewed by leadership (async sign-off).

**End-of-Day Demo**
- Showcase failing-to-passing CLI edge cases, streaming log diff, highlight health-check findings + mitigations.

**Test Count Target**: 1,756.

**Definition of Done**
- Health check doc stored in PRD, CLI edge suite green, telemetry dashboards live.

---

### Day 24 (Thu, Week 5): Provider Fallback & Golden Trace Lift
**Morning Standup Agenda**
- Recap Day 23 learnings, confirm parity burn-down remaining.
- Goals: provider fallback chaos suite (25 tests), error recovery (25 tests), golden trace expansion from 100 → 125 traces.
- Blockers: Provider credentials, deterministic seeding, trace diff triage capacity.

**Squad Assignments**
- **CLI/TypeScript (6.5h)**
  - TS1 (3h): Extend CLI fallback scenarios (timeout, throttling) with 15 tests.
  - TS2 (3h): Implement error recovery command coverage for `ax rerun --recover` (10 tests).
  - TS3 (2h): Write CLI doc strings + example outputs for fallback tests.
- **Quality (7h)**
  - QAL (2.5h): Coordinate golden trace sourcing, ensure metadata for plugin-ready transcripts.
  - S1 (3h): Script provider chaos harness (fault injection toggles) and 20 tests.
  - S2 (3h): Run 25 new traces through diff analyzer, tag anomalies.
- **Runtime (6h)**
  - RE1 (2h): Provide fallback deterministic hooks (latency injection, retry knobs).
  - RE2 (2h): Build error recovery envelope handler for plugin-safe contexts.
  - RE3 (2h): Pair with Quality on chaos harness reliability.
- **DevOps (5h)**
  - DO1 (2.5h): Wire chaos suite into nightly job with provider quotas guardrail.
  - DO2 (2h): Add golden trace diff alerts to Slack (Quality + PM channels).
- **PM (3h)**
  - Track anomaly triage, prep gate review slides (first draft).

**Critical Path Tasks**
- Chaos harness merged + nightly job configured.
- Golden trace set hits 125 validated transcripts.

**Pairing Sessions**
- 10:30–12:00 — S1 + RE3: Chaos harness implementation.
- 3:00–4:00 — PM + QAL: Trace anomaly triage + messaging.

**Code Review Checkpoints**
- 2:00 PM: Chaos harness PR reviewed by RE1 + DO1.
- 4:30 PM: Golden trace diff report reviewed by PM + Quality.

**End-of-Day Demo**
- Run chaotic provider scenario live, show auto-recovery, share trace gallery.

**Test Count Target**: 1,826 (stretch 1,896 if chaos suite fully green).

**Definition of Done**
- Provider fallback + recovery suites stable, golden traces at 125 with anomalies triaged, gate deck draft ready.

---

### Day 25 (Fri, Week 5): Gate — Parity Closure & 150 Golden Traces
**Morning Standup Agenda**
- Review remaining parity gaps (<50), align on gate criteria.
- Outline combined push: final parity tests, golden trace uplift to 150, gate packet completion.
- Blockers: flake triage capacity, coverage deltas on provider suite.

**Squad Assignments**
- **CLI/TypeScript (6.5h)**
  - TS1 (3h): Close remaining CLI parity items (installation edge cases) — 10 tests.
  - TS2 (3h): Harden manifest lint warnings + fallback doc generator (5 tests + docs).
  - TS3 (3h): Support gate demo CLI script + finalize `ax status` parity report.
- **Quality (7h)**
  - QAL (3h): Facilitate gate dry run, collect sign-offs.
  - S1 (3h): Finish remaining parity tests (memory, CLI, fallback) — 30 tests.
  - S2 (3h): Expand golden trace pool to 150, ensure plugin metadata tagged.
- **Runtime (6h)**
  - RE1 (2h): Resolve parity-adjacent runtime regressions.
  - RE2 (2h): Validate provider fallback telemetry coverage.
  - RE3 (2h): Support Quality for flake busting.
- **DevOps (5h)**
  - DO1 (3h): Update coverage gate to enforce ≥88% on parity modules.
  - DO2 (2h): Build gate report (CI artifact) with trendline.
- **PM (4h)**
  - Run gate review (prep + facilitation), ensure decision recorded, update leadership.

**Critical Path Tasks**
- All parity ledger items closed, 150 golden traces validated.
- Gate checklist approved with ≥1,966 passing tests.

**Pairing Sessions**
- 11:00–12:30 — TS1 + S1: Final CLI parity push.
- 2:00–3:00 — PM + DO2: Gate deck packaging.

**Code Review Checkpoints**
- Noon: Parity close-out PR approved by RE1 + QAL.
- 3:30 PM: Gate packet reviewed by leadership.

**End-of-Day Demo**
- Showcase parity summary dashboard, run golden trace 150-case playback, preview Plugin SDK backlog.

**Test Count Target**: 1,966 (minimum 1,896 before noon, stretch to gate number by EOD).

**Definition of Done**
- Gate pass recorded with sign-offs, parity ledger archived with zero open items, golden traces stable at 150.

## 3. Week 5 Mid-Point Review (Day 23)
**Health Check Template**
- Metrics snapshot: actual vs planned tests, open defects count, flake rate, CI runtime, team load.
- Voice of team: quick pulse survey (confidence 1–5, blockers, support needed).
- Scope alignment: confirm parity completion path, plugin SDK readiness, risk log updates.
- Actions: top 3 mitigations with owners + deadlines, confirm stakeholder communications.

**Risk Assessment Questions**
1. Are memory fixtures producing deterministic results across environments? (Owner: QAL)
2. Do CLI edge cases show regressions that threaten Week 5 gate? (Owner: TS1)
3. Is provider fallback quota sufficient for chaos suite? (Owner: DO2)
4. Are we deferring Plugin SDK prep items that could cause Week 6 crunch? (Owner: PM)
5. Any morale or capacity risks (vacations, context switching) needing reallocation? (Owner: PM)

## 4. Week 5 Gate Review (Day 25)
**Gate Criteria Checklist**
- [ ] 1,966 tests passing (with trendline screenshot).
- [ ] Parity ledger = zero open items, signed off by PM + QAL.
- [ ] Golden trace corpus = 150, diff log clean for 24h.
- [ ] Provider fallback + error recovery suites green twice consecutively.
- [ ] Coverage ≥88% for parity-touching modules.
- [ ] Gate deck circulated to leadership + stakeholders.

**Go/No-Go Framework**
- **Go** if all checklist boxes checked and no Sev1 bugs open.
- **Conditional Go** if tests ≥1,966 but ≤2 parity items remain with mitigation plan (requires PM + Quality approval, 24h resolution window).
- **No-Go** if tests <1,926, golden traces <150, or Sev1 parity defects outstanding — triggers weekend triage sprint before Plugin SDK work begins.

## 5. Detailed Daily Plans — Week 6 (Days 26–30)

### Day 26 (Mon, Week 6): Plugin SDK Alpha Kickoff
**Morning Standup Agenda**
- Celebrate Week 5 gate, align on Plugin SDK mission.
- Priorities: manifest schema freeze, validation tests, CLI scaffolding backlog grooming.
- Blockers: manifest TOML schema open questions, capability taxonomy.

**Squad Assignments**
- **CLI/TypeScript (6.5h)**
  - TS1 (3h): Draft `plugin.toml` Zod schema + validation utilities.
  - TS2 (3h): Prototype `ax plugin create` scaffolding skeleton.
  - TS3 (3h): Document schema + CLI prompts, align with docs team.
- **Quality (6.5h)**
  - QAL (2h): Define Plugin SDK test plan (manifest validation, CLI scaffolding, lifecycle hooks).
  - S1 (3h): Build 20 manifest validation tests (happy + error paths).
  - S2 (2.5h): Add fast-check property tests for capability constraints.
- **Runtime (6h)**
  - RE1 (3h): Provide lifecycle hook shape proposals aligning with manifest.
  - RE2 (2h): Map resource/capability guardrails for isolation.
  - RE3 (2h): Pair with TS2 on scaffolding output to ensure runtime compatibility.
- **DevOps (5h)**
  - DO1 (3h): Prepare dedicated CI shard for Plugin SDK suites.
  - DO2 (2h): Configure artifact publishing workflow for scaffolding templates.
- **PM (3h)**
  - Host kickoff workshop, document decisions, align stakeholders.

**Critical Path Tasks**
- Manifest schema + validation utilities merged.
- `ax plugin create` scaffold CLI skeleton lands behind feature flag.

**Pairing Sessions**
- 11:00–12:00 — TS1 + RE1: Schema + lifecycle alignment.
- 3:00–4:00 — TS2 + DO2: Scaffolding artifact pipeline.

**Code Review Checkpoints**
- 2:00 PM: Manifest schema PR reviewed by PM + Quality.
- 4:30 PM: CLI scaffolding skeleton PR reviewed by Runtime + DevOps.

**End-of-Day Demo**
- Walkthrough of `ax plugin create my-plugin --dry-run`, show validation errors, test counts.

**Test Count Target**: 2,016.

**Definition of Done**
- Schema + validation tests merged, scaffolding command behind feature flag, CI shard ready.

---

### Day 27 (Tue, Week 6): Lifecycle Hooks + Loader Skeleton
**Morning Standup Agenda**
- Review manifest outcomes, confirm hook signatures + loader plan.
- Goals: implement lifecycle hook interfaces, create loader harness, add 75 tests.
- Blockers: isolation policy decisions, concurrency strategy.

**Squad Assignments**
- **CLI/TypeScript (6h)**
  - TS1 (3h): Implement hook interface types + TypeScript SDK exports.
  - TS2 (3h): Extend scaffolding to include hook stubs + example tests.
  - TS3 (2h): Draft docs for hook usage.
- **Quality (6.5h)**
  - QAL (2h): Define loader verification matrix (capabilities × hooks).
  - S1 (3h): Add 30 hook unit tests (init/plan/act/recover) with context mocks.
  - S2 (2.5h): Build loader harness tests (20 cases) covering compatibility + failures.
- **Runtime (6.5h)**
  - RE1 (3h): Implement loader skeleton with manifest compatibility checking.
  - RE2 (2h): Add capability guard enforcement + sandbox budgets.
  - RE3 (2h): Pair with Quality on loader harness instrumentation.
- **DevOps (5h)**
  - DO1 (3h): Wire loader suite into CI with coverage tracking.
  - DO2 (2h): Set up sandbox telemetry for hook executions.
- **PM (2.5h)**
  - Review SDK UX, sync with stakeholders on hook semantics, capture open questions.

**Critical Path Tasks**
- Loader skeleton merges with manifest compatibility enforcement.
- Hook tests achieve ≥85% coverage on SDK module.

**Pairing Sessions**
- 10:30–12:00 — RE1 + S2: Loader harness bring-up.
- 1:30–2:30 — TS2 + QAL: Hook test fixture alignment.

**Code Review Checkpoints**
- 3:00 PM: Hook interfaces PR reviewed by Runtime + PM.
- 4:30 PM: Loader harness PR reviewed by Quality + DevOps.

**End-of-Day Demo**
- Show plugin sample exercising hook lifecycle, display loader logs + telemetry.

**Test Count Target**: 2,066.

**Definition of Done**
- Hook contracts documented, loader skeleton merged, 75 tests added with coverage report.

---

### Day 28 (Wed, Week 6): CLI Scaffolding + Plugin Runtime Wiring
**Morning Standup Agenda**
- Confirm loader/hook stability, align on CLI scaffolding breadth + runtime wiring for plugin isolation.
- Priorities: `ax plugin install/remove/list`, runtime registration flows, telemetry plumbing.
- Blockers: Template repository structure, capability enforcement across CLI/runtime.

**Squad Assignments**
- **CLI/TypeScript (6.5h)**
  - TS1 (3h): Implement `ax plugin install/remove` with manifest linting + local registry support (15 tests).
  - TS2 (3h): Build `ax plugin list` command + table output (10 tests).
  - TS3 (3h): Add telemetry prompts + CLI UX polish for scaffolding.
- **Quality (6.5h)**
  - QAL (2.5h): Validate CLI scaffolding UX (heuristic eval) + log findings.
  - S1 (3h): Author 20 CLI scaffolding tests (scaffold/install/list) across OS matrix.
  - S2 (2.5h): Expand golden trace suite with plugin-aware runbook (10 new traces capturing plugin lifecycle events).
- **Runtime (6h)**
  - RE1 (2h): Wire plugin runtime registration into core event bus.
  - RE2 (2h): Implement error envelopes for plugin failures.
  - RE3 (2h): Pair with DevOps on telemetry export for plugin runs.
- **DevOps (5h)**
  - DO1 (3h): Ensure CLI scaffolding commands run in CI matrix (macOS/Linux/Windows experimental).
  - DO2 (2h): Stream plugin telemetry to dashboards, set alerts for hook failures.
- **PM (3h)**
  - Review UX copy, prep Day 29 demo script, sync with docs/writer partner.

**Critical Path Tasks**
- CLI scaffolding commands stable with cross-platform coverage.
- Runtime registration ensures isolation + telemetry instrumentation.

**Pairing Sessions**
- 11:00–12:00 — TS1 + DO1: Windows CLI matrix support.
- 2:30–3:30 — QAL + RE3: Plugin telemetry validation.

**Code Review Checkpoints**
- 2:00 PM: CLI install/remove PR reviewed by Runtime + DevOps.
- 5:00 PM: Telemetry wiring PR reviewed by PM + Quality.

**End-of-Day Demo**
- Live run: Scaffold plugin → install → list → uninstall, show telemetry traces + runtime registration logs.

**Test Count Target**: 2,091.

**Definition of Done**
- CLI commands merged w/ tests, runtime wiring stable, plugin-aware traces captured.

---

### Day 29 (Thu, Week 6): Internal Plugins (Telemetry Export + Code Intelligence)
**Morning Standup Agenda**
- Confirm scaffolding + loader readiness, align on building two internal reference plugins.
- Focus: telemetry-export plugin (30 tests) + code-intelligence booster (25 tests), plus demo prep.
- Blockers: Sample repos for code-intel plugin, telemetry sink configs.

**Squad Assignments**
- **CLI/TypeScript (6.5h)**
  - TS1 (3h): Partner with Runtime on telemetry-export plugin TypeScript code + CLI integration.
  - TS2 (3h): Implement code-intel plugin scaffolding + heuristics.
  - TS3 (2.5h): Build CLI examples + docs for both plugins.
- **Quality (7h)**
  - QAL (2h): Define plugin acceptance checklist (perf, isolation, telemetry).
  - S1 (3h): Write 30 telemetry plugin tests (buffering, retries, failure paths).
  - S2 (3h): Write 25 code-intel plugin tests using fixture repos.
- **Runtime (6.5h)**
  - RE1 (3h): Implement telemetry-export runtime hooks (act + recover) with backpressure.
  - RE2 (2h): Wire code-intel heuristics into plan stage.
  - RE3 (2h): Validate isolation + capability enforcement for both plugins.
- **DevOps (5h)**
  - DO1 (3h): Provision telemetry sink sandbox + fixture repos for tests.
  - DO2 (2h): Configure plugin build + publish pipeline (internal registry).
- **PM (3.5h)**
  - Coordinate demo storyline, capture success metrics, prep leadership preview.

**Critical Path Tasks**
- Both internal plugins operational with passing test suites.
- Demo script drafted + rehearsed.

**Pairing Sessions**
- 10:00–11:30 — TS1 + RE1 + S1: Telemetry plugin deep dive.
- 2:00–3:00 — TS2 + RE2 + S2: Code-intel heuristics + tests.

**Code Review Checkpoints**
- 3:00 PM: Telemetry plugin PR reviewed by DevOps + PM.
- 5:00 PM: Code-intel plugin PR reviewed by Runtime + Quality.

**End-of-Day Demo**
- Run telemetry plugin streaming events, show code-intel plugin improving planning, preview Day 30 demo deck.

**Test Count Target**: 2,108.

**Definition of Done**
- Plugins merged with docs, telemetry dashboards reflect plugin outputs, demo script rehearsed.

---

### Day 30 (Fri, Week 6): Final Gate + Plugin SDK Alpha Demo
**Morning Standup Agenda**
- Confirm outstanding bugs, align on release checklist, rehearse demo roles.
- Priorities: finalize docs, release notes, coverage reporting, gate review, Sprint 4 handoff.
- Blockers: doc approvals, packaging pipeline.

**Squad Assignments**
- **CLI/TypeScript (6h)**
  - TS1 (2.5h): Polish SDK API docs + examples.
  - TS2 (2.5h): Wrap CLI scaffolding polish + fix final bugs.
  - TS3 (2h): Support demo + post-release backlog triage.
- **Quality (6.5h)**
  - QAL (2.5h): Run full regression suite + summarize metrics.
  - S1 (2h): Validate plugin tests on fresh workspace, confirm determinism.
  - S2 (2h): Finalize coverage + flake reports, archive Sprint 3 dashboards.
- **Runtime (5.5h)**
  - RE1 (2h): Address any bug fixes from final regression.
  - RE2 (2h): Assist with documentation for lifecycle hooks.
  - RE3 (1.5h): Support demo scenario instrumentation.
- **DevOps (5h)**
  - DO1 (3h): Publish SDK artifacts, tag release, ensure `ax` distribution updated.
  - DO2 (2h): Capture final metrics + attach to gate deck, prep Sprint 4 env toggles.
- **PM (4h)**
  - Lead final gate review, facilitate demo + retrospective, compile Sprint 4 handoff doc.

**Critical Path Tasks**
- 2,116 tests passing with dashboard evidence.
- SDK docs + release artifacts published.
- Gate review recorded with Go/No-Go decision + Sprint 4 ready backlog.

**Pairing Sessions**
- 11:00–12:00 — PM + TS1 + Writer partner: Doc sign-off.
- 2:00–3:00 — PM + QAL + DO1: Gate review + release checklist.

**Code Review Checkpoints**
- Noon: Documentation PR reviewed by leadership.
- 3:30 PM: Release checklist PR reviewed by DevOps + PM.

**End-of-Day Demo**
- Show Plugin SDK Alpha end-to-end (scaffold → manifest validation → install → plugin run), highlight metrics, share Sprint 4 focus.

**Test Count Target**: 2,116.

**Definition of Done**
- Gate checklist signed, SDK artifacts + docs live, Sprint 4 backlog prioritized, retrospective notes captured.

## 6. Week 6 Final Gate Review (Day 30)
**Sprint 3 Completion Criteria**
- [ ] 2,116 tests passing consistently across CI shards.
- [ ] Plugin SDK Alpha feature set complete (manifest, CLI, loader, lifecycle hooks).
- [ ] Internal plugins (telemetry export, code intelligence) operational with ≥90% coverage.
- [ ] Documentation + release notes published in AX-GUIDE and release repo.
- [ ] Golden trace suite (150) green for 3 consecutive nights.
- [ ] Known issues list documented with owners + mitigation for Sprint 4.

**Plugin SDK Alpha Delivery Checklist**
1. Manifest schema + validation CLI output approved by PM + QA.
2. Lifecycle hooks documented with examples + capability table.
3. Loader instrumentation + telemetry dashboards linked in PRD.
4. CLI scaffolding commands feature-flagged + docs for enabling.
5. Internal plugins packaged, tests green, example demos recorded.
6. Release notes + FAQ appended to AX-GUIDE + CHANGELOG.

**Handoff to Sprint 4**
- Provide backlog of SDK Beta improvements, plugin marketplace research tasks, residual tech debt (chaos harness automation, telemetry scaling).
- Share team availability, risks, and success metrics from Sprint 3 in Sprint 4 kickoff deck.

## 7. Communication Plan
- **Daily Standups (Mon–Fri, 9:00 AM, 15 min)**: Focus on blockers + test count delta; PM facilitates, notes in shared doc.
- **Mid-week Reviews (Wed each week)**: Week 5 health check (Day 23), Week 6 SDK sync (Day 28) — 30 min each with stakeholders.
- **Gate Reviews**: Day 25 mid-sprint gate, Day 30 final gate; attendees include PM, squad leads, leadership (CTO/QA head).
- **Async Updates**: PM posts nightly Slack summary (test counts, blockers, risk flags). DevOps posts CI health snapshot every morning.
- **Demo + Stakeholder Briefings**: Day 25 parity demo for internal QA; Day 29 preview for leadership; Day 30 final demo recorded + distributed.

## 8. Contingency Plans
- **Parity Tests Fall Behind**
  - Trigger: Actual test count slips >40 behind planned curve for two consecutive days.
  - Actions: Freeze non-critical Plugin SDK prep, reassign TS3 + RE3 temporarily to Quality, run evening parity blitz under PM coordination, add additional golden trace reviewers.
- **Plugin SDK Design Shifts**
  - Trigger: Manifest or lifecycle decisions blocked beyond Day 26.
  - Actions: Convene rapid design review (PM, Runtime, CLI, DevOps), decide within 24h; if unresolved, scope-limit alpha (e.g., fewer hooks) but maintain CLI scaffolding + manifest readiness; update stakeholders on trade-offs.
- **Golden Trace Issues Emerge**
  - Trigger: ≥3 critical diffs detected after Day 24.
  - Actions: Spin up SWAT pod (QAL + RE2 + TS1), pause new trace intake, root-cause diffs, patch regressions before proceeding; DevOps increases retry budget; PM communicates delays + mitigations.

