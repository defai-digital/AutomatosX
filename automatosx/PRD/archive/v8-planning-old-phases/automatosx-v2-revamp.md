# AutomatosX v2 Revamp – Product Requirements Document

## 1. Product Vision & Goals
- Deliver a developer copilot that orchestrates multi-agent collaboration from a single CLI, reducing context switching and time-to-outcome for complex tasks.
- Provide a predictable, auditable automation layer where every generated artifact is traceable, reviewable, and aligned to user intent.
- Unlock richer static and dynamic code understanding so the platform can reason about large codebases and surface higher-quality plans, diffs, and validations.
- Maintain backwards compatibility with v1 muscle memory while introducing a modular architecture that supports faster iteration and future modalities (e.g., desktop, API).

## 2. Technical Architecture
- **ReScript core runtime**  
  - State machine for task orchestration, deterministic execution plans, and effect handling.  
  - Encapsulates agent lifecycle management, memory IO, and command scheduling.  
- **TypeScript integration layer**  
.  - Bridges the ReScript core with Node.js ecosystem for CLI bindings, plugin registration, and third-party integrations.  
  - Exposes typed SDK to community extensions; relies on generated `.d.ts` contracts from ReScript output.  
- **Validation pipeline with Zod**  
  - Enforces schema validation on agent configs, CLI args, and API responses to catch drift early.  
  - Provides runtime-safe guards when user-defined plugins or workflows are loaded.  
- **Optional WASM execution sandbox**  
  - Compiles critical ReScript modules to WebAssembly for embeddable contexts (desktop app, browser preview).  
  - Enables safe execution of untrusted analyzer plugins with resource quotas.  
- **Message bus**  
  - Lightweight publish/subscribe channel for agent telemetry, CLI UI updates, and external integrations. Implemented via Node.js EventEmitter abstraction for now, with WebSocket upgrade path.  

## 3. Memory System
- **Storage**: SQLite database with FTS5 for semantic retrieval; path `.automatosx/memory/memories.db`.  
- **Schema**  
  ```sql
  CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent TEXT NOT NULL,
    tags TEXT, -- comma-delimited facets
    source TEXT, -- CLI, API, UI
    role TEXT NOT NULL, -- user, assistant, system
    content TEXT NOT NULL
  );

  CREATE VIRTUAL TABLE memories_fts USING fts5(
    content,
    tags,
    tokenize = 'porter'
  );

  CREATE TABLE recall_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id TEXT REFERENCES memories(id),
    recalled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    query TEXT
  );
  ```
- **Query routing**  
  - Default `ax memory search` hits FTS index with BM25 ranking.  
  - Deterministic filters (agent, tags, date) executed against base table before FTS to reduce noise.  
  - Future P1: hybrid semantic search using sentence-transformer embeddings stored in sidecar table (`memories_embeddings`).  
- **Release Phasing**  
  - **P0**: deterministic search, recall logging, retention policies (clear, export).  
  - **P1**: semantic reranking, memory summarization tasks, retention alerts.  
  - **P2**: collaborative memory between projects with namespace isolation.  

## 4. Tools & Technologies
- **Tree-sitter**: incremental parsing for multi-language AST generation powering `ax find` and structural diffs.  
- **SWC**: fast TypeScript/JS transformation pipeline used to compile CLI extensions and run linting passes.  
- **Semgrep**: security and quality rule engine invoked by `ax lint` for customizable policy checks.  
- **SQLite**: embedded data store for memory system, task logs, and offline-first metadata.  

## 5. CLI Commands
- **`ax find <pattern>`**  
  - AST-aware search leveraging Tree-sitter to locate symbols, patterns, or code smells across large repos.  
  - Supports `--lang`, `--context`, and `--output json` flags.  
- **`ax def <symbol>`**  
  - Resolves symbol definitions cross-language (TS, Go, Rust) using language adapters built on Tree-sitter.  
  - Optional `--graph` flag produces call graph snippet.  
- **`ax flow <workflow>`**  
  - Executes a predefined or custom workflow descriptor (YAML/JSON) via ReScript core orchestration.  
  - Supports checkpoints, human-in-the-loop approvals, and resumable sessions.  
- **`ax lint [path]`**  
  - Runs Semgrep and SWC transformations to detect security, quality, and style issues with severity gating.  
  - Integrated with memory system to log recurring issues for long-term remediation tracking.  

## 6. Feature Specifications
- **Workflow Orchestration**  
  - Users define multi-step flows referencing AutomatosX agents and CLI commands.  
  - UI/CLI surfaces live status, retries, and completion artifacts; outputs stored in structured directories via `--output`.  
- **Agent Capability Profiles**  
  - Agents include metadata (skills, supported languages, cost model, latency) with Zod-validated schema.  
  - CLI surfaces suggestions when a user attempts a task that matches a different agent’s strengths.  
- **Memory Insights Dashboard**  
  - CLI summary (`ax memory stats`) providing recall frequency, stale memories, and top tags.  
  - Integration hooks for future desktop UI.  
- **Plugin SDK**  
  - TypeScript layer exposes typed hooks for custom analyzers, tool integrations, and UI renderers.  
  - Includes scaffolding command `ax agent create` with template validation and testing harness.  
- **Observability**  
  - Structured logging with log levels, correlation IDs per workflow, and optional OpenTelemetry export.  
  - Error boundaries route exceptions through ReScript core for consistent user messaging.  

## 7. Implementation Phases
- **P0 (Core Revamp)**  
  - ReScript core refactor, TypeScript bindings, baseline memory system, port existing CLI commands, regression tests.  
  - Success criteria: parity with v1 workflows, <5% increase in command latency, documentation draft live.  
- **P1 (Enhancements)**  
  - Semantic memory, workflow authoring UX improvements, plugin SDK beta, WASM sandbox prototype, observability stack.  
  - Success criteria: 30% faster issue triage, 25% increase in workflow reuse, first external plugin published.  
- **P2 (Expansion)**  
  - Cross-project memory, desktop client preview, advanced analytics, marketplace infrastructure.  
  - Success criteria: retention uplift (weekly active +20%), third-party monetization pilot, telemetry-driven roadmap.  

## 8. Success Metrics
- Time-to-first-successful workflow: target <10 minutes for new users.  
- Repeat workflow adoption: ≥40% of users rerun a saved workflow within first month.  
- Memory recall precision: >85% relevant results in top 5.  
- CLI command satisfaction: CSAT ≥4.5/5 across `ax find`, `ax def`, `ax flow`, `ax lint`.  
- Plugin ecosystem health: ≥10 community plugins within 90 days of launch.  
- Quality guardrails: Semgrep false-positive rate <8%, automated regression escape rate <2%.  

## 9. Migration Path from v1
- **Inventory & Audit**: catalogue all v1 commands, agent configs, and memory usage to ensure parity.  
- **Compatibility Layer**: maintain `ax` command syntax; route legacy flags through TypeScript adapters that invoke new ReScript handlers.  
- **Incremental Rollout**: ship v2 as opt-in (`AX_EXPERIMENTAL=1`) alongside v1 until P0 metrics are met.  
- **Data Migration**: provide scripts to migrate v1 memory stores into new SQLite schema with FTS5 rebuild.  
- **Documentation & Training**: refresh `AX-GUIDE.md`, release migration playbook, conduct webinars/office hours.  
- **Feedback Loop**: capture user telemetry and qualitative feedback, triage weekly, and feed into P1 backlog.  
- **Sunset Plan**: announce v1 deprecation timeline after P1; ensure automated downgrade path if critical regressions emerge.  

