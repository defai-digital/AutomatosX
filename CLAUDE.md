# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start
- Node.js >= 20.0.0 required
- `npm install` after pulling
- `npm run dev -- <command>` for CLI in watch mode (e.g., `npm run dev -- run backend "test"`)
- `npm run build` before committing (auto-runs `npm run prebuild:config`)
- `npm run typecheck` to resolve type issues
- `npm test` runs all tests; scope with `npm run test:unit`, `npm run test:integration`, `npm run test:smoke`

## Directory Structure
- `src/` — runtime source
  - `cli/commands/` — command handlers (run.ts, gen.ts, status.ts, etc.)
  - `agents/` — agent execution and delegation logic
  - `core/` — router, memory, spec-kit, policy evaluation, telemetry
  - `providers/` — CLI subprocess wrappers (Claude, Gemini, OpenAI/codex)
  - `integrations/` — external tool integrations (MCP servers)
  - `utils/` — shared utilities
- `tests/` — test suites (unit: ~1,536 tests, integration, reliability, smoke)
- `automatosx/PRD/` — product requirements documents (read before major changes)
- `dist/` — generated bundles (never edit directly)
- `src/config.generated.ts` — auto-generated from `automatosx.config.json` (never edit)

## Development Workflow
1. Review `automatosx/PRD/` for context on architectural decisions
2. Modify implementation in `src/` and corresponding tests in `tests/`
3. Run `npm run prebuild:config` if you modify `automatosx.config.json`
4. Run `npm run verify` before committing (typecheck + build + unit tests)
5. Update `docs/` when changing user-facing behavior

## Essential Commands

```bash
# Development
npm run dev -- run backend "task"              # Test CLI in watch mode
npm run prebuild:config                        # Regenerate src/config.generated.ts
npm run typecheck                              # Type check without emitting

# Testing
npm test                                       # All tests (unit + integration + smoke)
npm run test:unit                              # Unit tests only (~1,536 tests)
npm run test:unit -- <pattern>                 # Run specific test suite (e.g., memory)
npm run test:ci                                # CI profile (critical tests only)
AUTOMATOSX_MOCK_PROVIDERS=true npm run test:unit  # Mock provider calls

# Quality
npm run verify                                 # Typecheck + build + unit tests (pre-commit)
npm run tools:check                            # Validate shell scripts syntax
npm run check:timers                           # Verify no timer leaks
```

## Architecture Overview

### Core Systems

AutomatosX is a policy-driven AI orchestration platform with persistent memory. Key subsystems:

- **Router** (`src/core/router.ts`) — Provider routing with policy evaluation, automatic failover, trace logging
- **PolicyEvaluator** (`src/core/spec/PolicyEvaluator.ts`) — Scores providers by cost/latency/privacy constraints
- **Memory** (`src/core/memory-manager.ts`) — SQLite FTS5 for conversation context (< 1ms search)
- **Spec-Kit** (`src/core/spec/`) — Generates plans, DAGs, scaffolds, tests from YAML specs
- **Providers** (`src/providers/`) — CLI subprocess wrappers (claude, gemini, codex commands)
- **Telemetry** (`src/core/telemetry/`, `src/core/analytics/`) — Local-only usage analytics

### Key Patterns

1. **Config Precompilation**: `automatosx.config.json` → `src/config.generated.ts` at build (90% startup boost)
   - Never edit `config.generated.ts` directly
   - Always run `npm run prebuild:config` after config changes

2. **Policy-Driven Routing**: `PolicyEvaluator` filters/scores providers before execution
   - Constraints: cost, latency, privacy, reliability
   - Trace all decisions to `.automatosx/logs/router-trace.jsonl`

3. **Path Aliases**: `@/*` maps to `src/*`, `@tests/*` maps to `tests/*` (tsconfig.json)

4. **Provider Integration**: All providers use CLI subprocesses (no direct SDK calls by default)
   - OpenAI: `codex` command (can use SDK mode with `integration: "sdk"`)
   - Claude: `claude` command
   - Gemini: `gemini` command

### Important Constraints

- **TypeScript strict mode** — all code must be type-safe, use `noUncheckedIndexedAccess`
- **ESM only** — no CommonJS (except `tools/*.cjs` build scripts)
- **Node 20+** target — use ES2022 features
- **Never edit**: `dist/`, `src/config.generated.ts`, `.automatosx/` runtime directories

## Testing Strategy

- **Unit tests** (`tests/unit/`) — ~1,536 tests, fast, isolated, 30s timeout
- **Integration tests** (`tests/integration/`) — Real I/O, provider calls
- **Smoke tests** (`tests/smoke/`) — End-to-end bash script validation

### CI vs Local

- **CI** (`npm run test:ci`) — Critical unit tests only, single-threaded (Windows SQLite stability)
- **Local** (`npm test`) — Full suite (unit + integration + smoke)

### Mock Providers

Set `AUTOMATOSX_MOCK_PROVIDERS=true` to avoid real provider calls during tests (CI uses this by default).

## Common Development Tasks

### Adding a New CLI Command

1. Create handler in `src/cli/commands/<name>.ts`
2. Register in `src/cli/index.ts` (yargs builder)
3. Add unit tests in `tests/unit/cli/commands/`
4. Add smoke test case in `tests/smoke/smoke-test.sh`
5. Update user docs if needed

### Modifying Configuration Schema

1. Edit `automatosx.config.json` (source of truth)
2. Run `npm run prebuild:config` to regenerate `src/config.generated.ts`
3. Update types in `src/types/config.ts` if adding new fields
4. Run `npm run typecheck` to catch type errors
5. Update tests and documentation

### Adding a New Provider

1. Extend `BaseProvider` in `src/providers/<name>-provider.ts`
2. Add metadata to `src/core/provider-metadata-registry.ts` (cost, latency, features)
3. Update `automatosx.config.json` with provider defaults
4. Run `npm run prebuild:config`
5. Add tests in `tests/unit/providers/`

## Troubleshooting

- **CI test failures**: Run `npm run test:ci` locally to reproduce
- **Config not updating**: Run `npm run prebuild:config` manually, then rebuild
- **Timer leaks**: Run `npm run check:timers` to detect unclosed intervals/timeouts
- **Stale workspace**: Run `bash tools/cleanup-tmp.sh` to clean temporary files
- **Type errors**: Run `npm run typecheck:incremental` for faster feedback loop
- **Provider issues**: Check that CLI tools are installed (`codex`, `gemini`, `claude` commands)
