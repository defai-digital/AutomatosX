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
3. **CRITICAL**: If you modify `automatosx.config.json`:
   - Run `npm run prebuild:config` to regenerate `src/config.generated.ts`
   - Never edit `src/config.generated.ts` directly (auto-generated file)
   - `npm run build` automatically runs `prebuild:config` as a prebuild step
4. Run `npm run verify` before committing (typecheck + build + unit tests)
5. Update `docs/` when changing user-facing behavior

### Config Precompilation Build Order

When running `npm run build`:

1. **Prebuild**: `npm run prebuild:config` generates `src/config.generated.ts` from `automatosx.config.json`
2. **Build**: `tsup` bundles TypeScript → JavaScript in `dist/`
3. **Result**: 90% startup performance boost vs runtime JSON parsing

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

# Debugging
ax providers trace                             # View router trace logs
ax providers trace --follow                    # Follow trace logs in real-time
ax providers info <provider>                   # View provider metadata (cost, latency, features)
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

4. **Provider Integration**: Dual-mode provider system
   - **CLI Mode (default)**: Subprocess execution (`codex`, `claude`, `gemini` commands)
   - **SDK Mode (OpenAI only)**: Direct API via OpenAI SDK (set `integration: "sdk"` in config)
   - Use `AUTOMATOSX_CLI_ONLY=true` env var to force CLI mode even if SDK configured
   - Claude and Gemini always use CLI mode

5. **Predictive Limit Management** (`src/core/predictive-limit-manager.ts`) — Quota prediction system
   - Tracks usage trends in rolling windows
   - Predicts time-to-exhaustion before hitting limits
   - Proactive provider rotation
   - SQLite-backed usage tracking (`.automatosx/usage/usage-tracker.db`)

### Important Constraints

- **TypeScript strict mode** — all code must be type-safe, use `noUncheckedIndexedAccess`
- **ESM only** — no CommonJS (except `tools/*.cjs` build scripts)
- **Node 20+** target — use ES2022 features
- **Never edit**: `dist/`, `src/config.generated.ts`, `.automatosx/` runtime directories

## Testing Strategy

- **Unit tests** (`tests/unit/`) — ~1,536 tests (CI), ~2,457 tests (full suite), fast, isolated
- **Integration tests** (`tests/integration/`) — Real I/O, provider calls (~115 tests)
- **Smoke tests** (`tests/smoke/`) — End-to-end bash script validation
- **Reliability tests** (`tests/reliability/`) — Chaos testing, load tests (~47 tests)

### CI vs Local

- **CI** (`npm run test:ci`) — ~1,536 critical unit tests only, single-threaded (Windows SQLite stability)
  - Excludes: integration, E2E, reliability, benchmark tests
  - Excludes: slow executors, health checks, Windows-incompatible path tests
  - Target: 3-5 minutes runtime
- **Local** (`npm test`) — Full suite (~2,457 tests: unit + integration + smoke)
  - Multi-threaded execution
  - Target: 15-30 minutes runtime

### Mock Providers

Set `AUTOMATOSX_MOCK_PROVIDERS=true` to avoid real provider calls during tests (CI uses this by default).

### Environment Variables

Important environment variables for development and testing:

- `AUTOMATOSX_MOCK_PROVIDERS=true` — Use mock providers instead of real API calls (CI default)
- `AUTOMATOSX_CLI_ONLY=true` — Force CLI mode for all providers (disables OpenAI SDK)
- `NODE_ENV=test` — Enable test-specific behavior
- `CI=true` — CI environment detection (affects test parallelism and timeouts)

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
- **Windows CI failures**: Path-related tests may fail on Windows due to drive letters and separators
  - See `vitest.config.ci.ts` for excluded Windows-incompatible tests
  - Use single-threaded mode on Windows for SQLite stability
- **OpenAI SDK connection errors**: Set `AUTOMATOSX_CLI_ONLY=true` to force CLI mode
- **Trace logs not appearing**: Enable with `enableTracing: true` in router config or check `.automatosx/logs/router-trace.jsonl`

## Platform-Specific Notes

### Windows Development

- **Single-threaded tests**: CI uses `singleThread: true` for SQLite stability on Windows
- **Path issues**: Some path-related tests excluded in CI (see `vitest.config.ci.ts` lines 167-180)
- **Drive letters**: Test assertions with hardcoded Unix paths will fail (e.g., `/foo` vs `C:\foo`)

### macOS/Linux

- **Parallel tests**: Local development can use multi-threaded test execution
- **Full test suite**: All ~2,457 tests should pass
