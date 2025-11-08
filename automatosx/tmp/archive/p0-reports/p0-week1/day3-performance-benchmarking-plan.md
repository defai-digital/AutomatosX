# Day 3 – Parser Pipeline Performance Benchmarking Plan

**Author:** Performance Engineer (with Avery)  
**Status:** Draft for sync approval  
**Audience:** Parser POC team, DevOps, Architecture  
**Objective:** Validate that unified parser pipeline delivers <10% latency increase while improving code-intel fidelity.

---

## 1. Benchmarking Objectives & Success Criteria
- Quantify end-to-end parsing throughput for Tree-sitter, SWC, Semgrep orchestration across representative repositories.
- Measure memory footprint and concurrency impacts under incremental and full reparse scenarios.
- Establish baseline telemetry for CLI query latency (`ax find`, `ax def`, `ax flow`) against updated SQLite schema.
- Detect regressions early with automated thresholds alerting when >10% degradation vs. Week 0 baseline.

**Success Criteria**
- ✅ Average parse latency per file increases ≤10% vs. v1 baseline (across TS/JS, Go, Rust).  
- ✅ Memory usage stays within +150MB envelope on standard runner (4 vCPU, 8GB RAM).  
- ✅ CLI query latency p95 increases ≤10%.  
- ✅ Benchmark harness integrated into CI (nightly) with trend dashboards.

---

## 2. Test Matrix & Target Repositories

| Repo | Language Mix | Size | Purpose | Source |
|---|---|---|---|---|
| `sample-ts-monorepo` | 80% TS/JS, 20% Markdown | 1,500 files | Exercises Tree-sitter + SWC incremental updates | Internal fixture (`tests/fixtures/ts-monorepo`) |
| `goservices-suite` | Go microservices | 950 files | Validates Go grammar, call graph depth | Internal fixture (`tests/fixtures/go-suite`) |
| `rust-crates-pack` | Rust crates with macros | 620 files | Stress-tests macro expansion handling | Git submodule (frozen) |
| `polyglot-mixed` | TS/JS, Go, Rust mix | 300 files | Mixed workload for concurrency scheduling | Synthetic fixture |
| `semgrep-rules-registry` | Semgrep rule definitions | 400 files | Ensures rule cache + parsing interplay | Upstream snapshot (read-only) |

---

## 3. Metrics & Instrumentation

| Metric | Description | Instrumentation Source | Target |
|---|---|---|---|
| `parse_duration_ms` | Time to parse single file per parser | Orchestrator telemetry span | ≤ +10% vs. baseline |
| `batch_duration_ms` | Time per language batch | Orchestrator metrics | ≤ 2.5s P95 |
| `memory_peak_mb` | Peak RSS during run | `process.memoryUsage()` sampled | ≤ baseline +150MB |
| `incremental_hit_rate` | % files using incremental artifacts | Orchestrator counters | ≥ 60% after warm cache |
| `cli_query_latency_p95` | `ax find/def/flow` latency | CLI integration tests (Vitest) | ≤ +10% |
| `fts_query_hits` | Rows scanned per FTS query | SQLite `EXPLAIN QUERY PLAN` logs | Verify index usage |
| `error_rate` | Diagnostics per 1k files | Error table diff | ≤ 5 |

**Instrumentation Hooks**
- Extend orchestrator telemetry (Section 8 in design doc).  
- Use OpenTelemetry exporter to push metrics to local JSON for CI ingestion.  
- Capture SQLite stats via `PRAGMA stats` after runs.

---

## 4. Baseline Collection Methodology

1. **Environment Normalization:** Standard runner container (`Node 20`, `SQLite 3.45+`, 4 vCPU).  
2. **Warm Cache Run:** Execute current v1 pipeline (baseline) twice; record averaged metrics.  
3. **Cold Cache Run:** Drop incremental artifacts, run pipeline again; capture worst-case.  
4. **CLI Latency Tests:** Run existing Vitest integration suite measuring `ax` commands using baseline schema.  
5. **Data Storage:** Store baseline metrics in `automatosx/tmp/p0-week1/perf-baseline.json`.

All benchmarks to run with CPU governor fixed (no turbo) to avoid noise; log system load.

---

## 5. Benchmark Execution Procedure

### 5.1 Full Parse Scenario
- Trigger orchestrator to rebuild entire dataset.  
- Collect per-parser metrics and aggregated stats.  
- Validate SQLite file growth and WAL size.

### 5.2 Incremental Parse Scenario
- Touch 5% of files (random selection weighted by dependencies).  
- Run incremental pipeline; confirm cache usage.  
- Measure diff in run duration vs. baseline incremental run.

### 5.3 Regression Command Latency
- Using CLI smoke suite, execute `ax find foo`, `ax def foo`, `ax flow foo -> bar`.  
- Capture latency distribution (p50/p95/p99).  
- Compare to baseline run results.

### 5.4 Failure Injection
- Simulate parser failure (e.g., kill Semgrep process mid-run).  
- Confirm fallback logic time impact and errors logged.  
- Ensure latency stays within tolerance (document deviation if not).

---

## 6. Test Harness Design

- **Runner Script:** `scripts/bench-parser-pipeline.ts` orchestrates runs; accepts `--scenario full|incremental|failure`.  
- **Configuration:** JSON manifest listing repos, languages, concurrency limits.  
- **Telemetry Collector:** Writes metrics to `automatosx/tmp/p0-week1/perf-results/<timestamp>.json`.  
- **Visualization:**  
  - Generate Markdown summary using Node script, embed sparkline via ASCII for CLI.  
  - Feed JSON into Grafana-like dashboard (optional) via local `ax` plugin.

**Automation:** Integrate harness with CI nightly pipeline; gate merges if >10% regression detected (configurable threshold).

---

## 7. Reporting & Dashboards

| Artifact | Description | Owner | Frequency |
|---|---|---|---|
| `perf-baseline.json` | Baseline metrics snapshot | Performance Engineer | Week 1 Day 3 |
| `perf-results/<timestamp>.json` | Each benchmark run output | CI | per run |
| `perf-summary.md` | Human-readable comparison with deltas | Performance Engineer | Week 1 Day 4 onwards |
| Slack alert (`#p0-code-intel`) | Regression >10% notification | Automation | Continuous |
| Leadership dashboard | Rolling 7-day latency trend | Performance Engineer | Weekly |

Graph template:  
- Panels for parse duration (per parser), incremental hit rate, CLI latency.  
- Use thresholds to highlight breach conditions (red >10%).

---

## 8. Risk Controls & Mitigation
- **Noise in shared runners:** Reserve dedicated CI runner for benchmark job; schedule off-peak.  
- **Repo drift:** Pin fixtures via git submodules; update quarterly.  
- **Metric drift:** Calibrate instrumentation weekly to ensure sampling accuracy.  
- **Data volume growth:** Monitor SQLite file size; trigger compression plan if growth >20%.  
- **Alert fatigue:** Use rolling average + immediate alert for >20% regressions.

---

## 9. Timeline & Responsibilities
- Week 1 Day 3: Approve plan, baseline capture (Performance Engineer).  
- Week 1 Day 4: Implement harness, integrate instrumentation (Performance Engineer + Bob).  
- Week 1 Day 5: First comparative run against new pipeline; report to Avery/Tony.  
- Week 2 Day 2: Automate nightly CI job + Slack notifications.  
- Week 2 Day 5: Present trend analysis in architecture review.

> Great architecture is invisible – disciplined measurement keeps the parser pipeline performant long after launch.
