# Day 3 – Parser Pipeline Design (Code-Intel Sync)

**Author:** Avery (Architecture)  
**Contributors:** Bob (Backend), Felix (Fullstack), Stan (Standards)  
**Status:** Draft for Day 3 review  
**Related ADRs:** ADR-001 (SQLite FTS5), ADR-002 (ESM), ADR-004 (Security), ADR-005 (Profile + Abilities), ADR-006 (Team Configuration), ADR-007 (Lazy Loading), ADR-010 (Provider Router)  
**Scope:** Harmonize Tree-sitter, SWC, and Semgrep within a unified orchestration pipeline powering AutomatosX code intelligence v2.

---

## 1. Architecture Overview

### 1.1 Goals
- Provide deterministic AST and symbol parity across Tree-sitter, SWC, and Semgrep outputs.
- Enable incremental parsing with minimal latency (<10% regression from v1 baseline).
- Preserve modularity so individual parsers can be swapped/updated without destabilizing the pipeline.
- Surface rich metadata (errors, symbol relationships, code chunks) to the SQLite memory layer.

### 1.2 High-Level Flow
```
           ┌───────────────────────────────────────────────────────────┐
           │                   Parser Orchestrator                     │
           │ (Async workflow engine + port/adapter contracts)          │
           └──────────────┬──────────────────────┬─────────────────────┘
                          │                      │
          ┌───────────────▼──────────────┐ ┌─────▼────────────────┐ ┌─────────────────────────┐
          │ Tree-sitter Adapter (TS/JS,  │ │ SWC Adapter (TS/JS) │ │ Semgrep Adapter (Rules) │
          │ Go, Rust grammars)          │ │ ES AST focus)        │ │ Pattern intelligence)   │
          └───────────────┬──────────────┘ └──────────────┬───────┘ └─────────────┬──────────┘
                          │                           │                       │
                 ┌────────▼────────┐         ┌────────▼────────┐      ┌──────▼──────────┐
                 │ AST Normalizer  │<--------┴─────────────────┴----->│ Symbol Merger   │
                 │ (node typing,   │                                 │ (unified tables)│
                 │ metadata)       │                                 └──────┬──────────┘
                 └────────┬────────┘                                        │
                          │                                                 │
                     ┌────▼──────────────────────────────────────────────────▼────┐
                     │                 Memory Integration Layer                    │
                     │ (SQLite writers, cache invalidation, telemetry emission)   │
                     └────────────────────────────────────────────────────────────┘
```

### 1.3 Orchestrator Responsibilities
- Detect file change events (hash/mtime diff from memory tables).
- Batch files by language and priority (recent edits first).
- Invoke adapters concurrently with bounded concurrency (configurable, default 4).
- Aggregate results, normalize ASTs, reconcile symbol tables.
- Persist results to SQLite via transactional writers.
- Emit telemetry events (timings, memory usage, error codes) for benchmarking dashboard.

---

## 2. Port/Adapter Contract Design

### 2.1 Port Definitions
```ts
export interface ParserPort {
  readonly parserId: 'tree-sitter' | 'swc' | 'semgrep';
  supportsLanguage(lang: LanguageId): boolean;
  parse(input: ParserInput): Promise<ParserResult>;
  shutdown?(): Promise<void>;
}

export interface ParserInput {
  filePath: string;
  language: LanguageId;
  content: string;
  previousArtifacts?: IncrementalArtifacts;
  telemetry: TelemetryContext;
}

export interface ParserResult {
  ast: NormalizedAst;
  symbols: SymbolSet;
  chunks: CodeChunkSet;
  diagnostics: Diagnostic[];
  incrementalArtifacts?: IncrementalArtifacts;
  statistics: ParserStatistics;
}
```

### 2.2 Adapter Guidelines
- Adapters live under `src/core/parsers/<parser-name>-adapter.ts`.
- Each adapter isolates third-party library calls, exposing `ParserPort`.
- Use lazy loading (ADR-007) to defer heavy imports until first `parse`.
- Provide fallbacks for unsupported languages (return `ParserResult` with `diagnostics` flagging unsupported language).
- Emit structured errors (see Section 3) and avoid throwing except for fatal conditions.

### 2.3 Dependency Injection
- Orchestrator receives registered adapters via configuration (`parser-config.json`).
- Enables feature flags: e.g., `enableSemgrep` toggled per workspace.
- Support test doubles (mock adapters) for integration tests.

---

## 3. Error Handling & Fallback Strategy

| Error Type | Source | Handling Strategy | Persistence |
|---|---|---|---|
| Recoverable Parse Error | Syntax issues, partial AST | Adapter returns diagnostics; orchestrator persists partial data and flags in `errors` table | `errors` table and telemetry |
| Adapter Failure | Library crash, incompatible version | Orchestrator retries (max 2) with backoff; if still failing, demotes parser and surfaces alert | `errors` table (`code = ADAPTER_FAILURE`), escalation log |
| Timeout | Non-responsive parser > configurable threshold | Cancel task via AbortController; record fallback to previous artifacts | `errors` table, `statistics.timeout = true` |
| Schema Violation | Normalizer detects incompatible node shape | Block write, mark file as `out_of_sync` to reprocess after fix | `errors` table (`code = SCHEMA_MISMATCH`), incident |

**Fallback Sequence:**  
1. Use cached incremental artifacts if available.  
2. If AST missing from primary adapter (Tree-sitter), attempt SWC for TS/JS or skip to Semgrep for partial semantics.  
3. If all fail, mark file stale and schedule retry in next run (exponential backoff per file).

---

## 4. Incremental Parsing Strategy

- **Change Detection:** Compare `hash` and `mtime` from `files` table to current filesystem snapshot.  
- **Batching:** Group changed files by language; prioritize files with dependency fan-out (calls/imports).  
- **Artifact Cache:** Store incremental artifacts per parser in `incremental_artifacts` column (new table, see schema doc).  
- **Granular Re-parse:** Use Tree-sitter edit API to reparse specific ranges; SWC incremental mode for TS/JS; Semgrep rule caching.  
- **Invalidation Rules:**  
  - If grammar version changes → invalidate entire language queue.  
  - If fallback triggered >3 times consecutively → full reparse.  
  - Changes to shared config (Semgrep rules) triggers targeted re-run of affected files.

---

## 5. Language Support Matrix

| Language | Primary Parser | Secondary | Coverage Notes | Week 1–2 POC Target |
|---|---|---|---|---|
| TypeScript / JavaScript | Tree-sitter (priority) | SWC (AST enrichment), Semgrep (patterns) | Need alignment on TS 5.x syntax, decorator support | ✅ POC must validate |
| Go | Tree-sitter | Semgrep (security patterns) | Ensure interface/type alias mapping harmonized | ✅ POC must validate |
| Rust | Tree-sitter | Semgrep (lint rules) | Confirm macro expansion handling | ✅ POC must validate |
| Python | (Deferred) Tree-sitter | Semgrep | Out of scope for Week 1–2; design should allow drop-in | ⚪ Design only |
| Other (Java, C#) | Future Tree-sitter grammars | Semgrep community rules | Ensure adapter interface extensibility | ⚪ Document extension path |

---

## 6. AST Normalization & Symbol Table

### 6.1 Normalization Rules
- **Node Typing:** Map parser-specific node types to canonical enums (e.g., `function_declaration`, `class_declaration`).  
- **Range Format:** Store as `[start_line, start_col, end_line, end_col]` (0-index internally, 1-index when persisted).  
- **Annotations:**  
  - `origin`: `'tree-sitter' | 'swc' | 'semgrep'`  
  - `confidence`: float 0–1 (Semgrep outputs default 0.7).  
  - `inferred_symbol_id`: reference to symbol merge step.

### 6.2 Symbol Merge Algorithm
1. Normalize AST nodes into preliminary symbol candidates.  
2. Merge duplicates across adapters using `(name, kind, range)` tolerance window.  
3. For conflicting metadata, prefer Tree-sitter > SWC > Semgrep (configurable priority).  
4. Record provenance in `symbol_metadata` JSON column (SQLite `TEXT`) for audit.

### 6.3 Symbol Table Schema Alignment
- Symbol entries align to `symbols` table.  
- `signature` field populated using SWC for TS/JS (type info), Tree-sitter for Go/Rust (via grammar metadata).  
- Add `origin_mask` bitfield to track contributing parsers (see schema doc).

---

## 7. Integration with Memory System

### 7.1 Write Path
- Orchestrator opens SQLite transaction per batch.  
- Upsert into `files`, `symbols`, `calls`, `imports`, `chunks`, `chunks_fts`, `errors`, plus new `parser_runs` table.  
- Use bulk insert via prepared statements for throughput.  
- Maintain FTS5 contentless updates via triggers (detailed in schema doc).

### 7.2 Read Path Impact
- CLI commands (`ax find`, `ax def`, `ax flow`) query the updated schema; ensure backward compatibility by providing views if necessary.  
- Provide `parser_runs` metadata to show freshness (`ax status` extension).

### 7.3 Security & Compliance
- Enforce path validation via PathResolver (ADR-004).  
- Sanitize Semgrep rule imports (no remote fetch).  
- Ensure no sensitive code persisted beyond workspace boundaries (hashes only).

---

## 8. Observability & Telemetry

- **Metrics:** parse duration per parser, AST merge time, batch size, cache hit rate, failure counts.  
- **Tracing:** instrument orchestrator with spans per file to integrate with existing telemetry (OpenTelemetry).  
- **Logging:** structured logs with correlation ids for cross-parser debugging.  
- **Alerting:** threshold alerts when failure rate >5% or latency >10% baseline.

---

## 9. Open Questions & Follow-Ups
1. Should Semgrep run as post-processor or inline within orchestrator execution graph? (Need input from Felix.)  
2. Do we require a new ADR to formalize incremental parsing strategy? (Likely ADR-011.)  
3. Confirm resource envelopes on CI runners for parallel parser execution (DevOps).  
4. Evaluate cost of storing incremental artifacts (size implications per language).  
5. Determine long-term plan for languages beyond initial matrix (roadmap entry).

---

> Great architecture is invisible – this pipeline should let teams evolve parser intelligence without disruption while paying dividends in future language support.
