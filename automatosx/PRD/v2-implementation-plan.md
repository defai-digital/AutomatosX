# AutomatosX v2 Implementation Plan

Great architecture is invisible – it enables teams, evolves gracefully, and pays dividends over decades. This plan outlines how we evolve AutomatosX from v1 to v2 while preserving current capabilities, minimizing disruption, and laying an adaptable foundation for future tooling.

## Context & Objectives

- Leverage the mature TypeScript 5.3 codebase (agents, CLI, SQLite FTS5 memory, 1K+ tests) as the baseline.
- Introduce ReScript-backed state machines and rule evaluation without regressing existing AgentExecutor flows.
- Extend the SQLite knowledge base to power code intelligence features (files, symbols, calls, imports, chunks).
- Integrate language tooling (Tree-sitter, SWC, Semgrep) to populate and query the enriched graph.
- Ship new CLI experiences (`ax find`, `ax def`, `ax flow`, `ax lint`) with Zod validation and backward compatibility.
- Deliver in incremental phases with tight feedback loops, feature flags, and no breaking changes.

## Reuse vs. Net-New Build

| Capability | v1 Asset to Reuse | v2 Action | Notes |
|------------|------------------|-----------|-------|
| Agent orchestration | `src/agents`, `src/core/router`, ProfileLoader | Extend | Wrap action selection with ReScript state evaluations via new adapter layer. |
| CLI framework & commands | `src/cli`, `packages/cli-interactive` | Extend | Add new commands under existing command registration, reuse help & telemetry. |
| Memory subsystem | `src/core/memory-manager`, SQLite FTS5 schema | Extend | Add migration scripts and DAO layer for code graph tables; preserve existing APIs. |
| Provider routing | `src/core/provider-router` | Reuse | Integrate ReScript outcomes as advisory signals, no change to provider contracts. |
| Testing harness | `tests/unit`, `tests/integration`, Vitest config | Extend | Add ReScript bindings tests, schema migrations, new CLI command coverage. |
| Configuration system | `automatosx.config.json`, `src/types/config.js` | Extend | Introduce Zod-based validation layer, maintain JSON schema compatibility. |
| Code intelligence | N/A | New | Implement parser ingestion pipeline, symbol graph builder, query services. |
| ReScript runtime | N/A | New | Add ReScript compiler toolchain, idiomatic bindings, and packaging strategy. |

## Architectural Strategy

### ReScript Runtime Integration

- Create a dedicated package (e.g., `packages/rescript-core`) compiled to `.bs.js` modules consumed by TypeScript via generated TypeScript declaration files.
- Define a stable adaptor interface in `src/core/state-machines` encapsulating ReScript rule/state evaluation; expose asynchronous APIs compatible with current AgentExecutor hooks.
- Use feature flags and dependency inversion: inject ReScript evaluators through constructor parameters so existing orchestrations can run without the ReScript bundle when disabled.
- Establish build/CI steps: `rescript build` before TypeScript compilation, ensure `tsup` bundles `.bs.js` artifacts correctly.

### Data & Storage Layer Enhancements

- Introduce new SQLite tables (`files`, `symbols`, `symbol_refs`, `call_graph`, `imports`, `code_chunks`) with forward-only migration scripts managed by the existing migration runner.
- Expand the memory manager with repository-scoped DAOs and query helpers; maintain existing search APIs by adding union views for backward compatibility.
- Implement background ingestion workers under `src/workers/ingestion` to populate tables; operations triggered by CLI commands or session initialization.

### Parser & Static Analysis Pipeline

- Add a pluggable parser service in `src/integrations/parsers` orchestrating Tree-sitter (language-agnostic AST), SWC (JS/TS focus), and Semgrep (rules).
- Define a normalized intermediate representation (IR) used to populate SQLite tables; ensure deterministic IDs for incremental updates.
- Cache parser results in the filesystem (e.g., `.automatosx/tmp/parsing/`) with invalidation keyed on file hash.
- Provide resilience: Tree-sitter as primary AST source, SWC specialized for JS/TS transformations, Semgrep for rule evaluation and lint command integration.

### Validation & Schema Governance

- Adopt Zod for runtime validation of configuration, CLI arguments, and parser outputs.
- Place Zod schemas under `src/types/schemas/`; generate TypeScript types from schemas to keep compile-time and runtime validation aligned.
- Maintain compatibility by allowing legacy config parsing path to coexist during transition, gated by configuration flag.

### CLI Layering & Backward Compatibility

- Implement new commands within `src/cli/commands` using existing command registration; reuse the CLI executor and telemetry stack.
- Provide fallbacks: if v2 data not yet ingested, commands degrade gracefully with informative messaging and guidance.
- Use command-level feature flags (`--experimental-v2`) initially; toggle default once telemetry confirms stability.

### Testing & Observability

- Extend Vitest suites with fixtures covering ReScript evaluations, parser outputs, and CLI flows.
- Introduce contract tests for SQLite DAOs against in-memory DB, and golden tests for parser IR outputs.
- Add structured logging (existing logger utilities) to highlight ingestion pipeline status and ReScript decision traces for debugging.

## Migration & Compatibility Approach

- Deliver schema migrations as additive changes with versioned migration scripts; include automatic detection and upgrade prompts in CLI startup.
- Introduce configuration toggles in `automatosx.config.json` for enabling ReScript state control and code intelligence features.
- Maintain dual execution paths during transition: default to existing TypeScript logic if ReScript module missing or disabled.
- Ship incremental releases with telemetry instrumentation to monitor adoption and error rates before promoting features to GA.

## Phase Plan

### P0 – Foundation (Weeks 0–4)

**Goals:** Establish toolchain, data model, and scaffolding without exposing new UX surface.

- Set up ReScript compiler, directory structure, and TypeScript bindings; add CI steps and smoke tests.
- Design and implement SQLite migrations for code graph tables with migration rollback scripts and automated schema validation tests.
- Create parser orchestrator scaffolding with Tree-sitter embedded and placeholder adapters for SWC and Semgrep.
- Author ADRs covering ReScript integration, code intelligence schema, and parser architecture.
- Implement Zod validation framework for config loading and CLI argument parsing; keep default path unchanged.

**Dependencies:** ReScript compiler, tree-sitter binaries, SQLite migration runner.  
**Testing Focus:** CI build coverage, migration unit tests, parser smoke tests on representative repositories.

### P1 – Feature Enablement (Weeks 5–10)

**Goals:** Deliver functional slices of v2 capabilities behind feature flags.

- Integrate ReScript state machine evaluation into AgentExecutor for session planning flows; provide configuration-driven toggles per agent/team.
- Implement ingestion workers leveraging parser pipeline to populate new tables; include incremental update logic (file hashing, change detection).
- Build query services for `find`, `def`, and `flow` commands using SQLite FTS and graph traversal; expose APIs in `src/core/code-intelligence`.
- Develop `ax find`, `ax def`, `ax flow`, `ax lint` commands with Zod-validated inputs, telemetry, and fallback messaging.
- Wire Semgrep rule execution to support `ax lint` with rule pack management (allow local rule packs).
- Expand unit/integration tests, including CLI snapshot tests and ReScript decision engine contract tests.

**Dependencies:** Successful P0 migrations, parser IR stability, ReScript adaptor availability.  
**Testing Focus:** End-to-end CLI flows, parser ingestion accuracy (golden files), ReScript regression tests, lint rule pack fixtures.

### P2 – Hardening & Rollout (Weeks 11–14)

**Goals:** Optimize, document, and prepare for GA rollout while ensuring backward compatibility.

- Optimize SQLite indices and query strategies; add caching where necessary for high-volume repositories.
- Extend parser support matrix (additional languages, fallback heuristics) and enhance error handling/telemetry.
- Finalize migration tooling with CLI prompts, backup guidance, and automated compatibility checks.
- Update documentation, tutorials, and onboarding flows; publish new ADRs reflecting final decisions and deprecations.
- Graduate features from experimental flags based on telemetry, add automated upgrade tests, and plan long-term maintenance (e.g., parser updates).

**Dependencies:** Stable telemetry dashboards, completed feature validation in P1.  
**Testing Focus:** Performance benchmarks, backward-compatibility regression suite, documentation accuracy reviews.

## Dependencies & Tooling Updates

- Add ReScript toolchain (`rescript`, `@rescript/react` if needed) and configure `bsconfig.json`.
- Include Tree-sitter CLI/bindings, SWC parsers, Semgrep CLI (vendored or via managed dependency).
- Update build scripts (`tsup.config.ts`, `package.json`) to orchestrate multi-language compilation.
- Introduce migration tooling command (e.g., `ax db migrate`) to surface new schema changes.

## Risk & Mitigation Summary

| Risk | Likelihood | Impact | Mitigation | Trigger |
|------|------------|--------|------------|---------|
| ReScript build integration destabilizes CI | Medium | High | Prototype in isolated branch, add CI smoke job, fall back to TypeScript path if build fails | Build failures on main |
| Parser performance on large repos | Medium | High | Benchmark during P1, add incremental parsing & caching, gate via feature flag | CLI command latency > target |
| Schema migration failure on user installs | Low | High | Provide backup/export tooling, thorough migration tests, rollback scripts | Migration error telemetry |
| Backward compatibility regressions | Low | Medium | Maintain dual execution paths, add regression suite for legacy commands, staged rollout | Customer support tickets |
| Dependency security issues (Tree-sitter/Semgrep) | Medium | Medium | Version pinning, automate vulnerability scanning, document update procedure | Security advisories |

Residual risk after mitigation remains Medium for parser performance; monitor telemetry closely during rollout.

## Upcoming ADRs

- **ADR-011:** ReScript integration strategy and interoperability contract.
- **ADR-012:** Code intelligence data model and migration policy.
- **ADR-013:** Parser orchestration and toolchain governance.
- **ADR-014:** Runtime validation with Zod, including compatibility guarantees.

Each ADR should be drafted during P0 to guide downstream implementation choices and keep the architecture knowledge base current.

## Next Steps

- Schedule architecture review with domain leads (backend, devops, quality) to validate phase scope.
- Kick off P0 spike to validate ReScript ↔ TypeScript bridge and Tree-sitter embedding.
- Establish telemetry dashboards to measure ingestion throughput, command latency, and adoption as features graduate from experimental status.

