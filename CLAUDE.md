# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

**File Management**:
- Store temporary files and generated reports in `automatosx/tmp/`
- Store PRD (Product Requirement Document) files in `automatosx/PRD/`

---

## Project Overview

AutomatosX (v11.4.0) is an AI Agent Orchestration Platform that combines workflow templates, persistent memory, and multi-agent collaboration. It's a production-ready CLI tool that wraps around existing AI provider CLIs (claude, gemini, codex, ax-cli).

**Repository**: https://github.com/defai-digital/automatosx

## Quick Reference

```bash
# Development
npm run dev -- run backend "test task"    # Dev mode with tsx
npm run build                              # Full build (includes config generation)
npm test                                   # All tests
npm run verify                             # Pre-commit checks

# Single test
npx vitest run tests/unit/core/router.test.ts

# Linting & Types
npm run lint                               # Check lint issues
npm run lint:fix                           # Auto-fix lint issues
npm run typecheck                          # Full TypeScript check

# Test commands
npm run test:unit                          # Unit tests only
npm run test:integration                   # Integration tests only
npm run test:coverage                      # Generate coverage report

# Debugging
ax --debug <command>                       # Verbose logging
ax run backend "task" --quiet              # Quiet mode (for CI)

# Release
npm run sync:all-versions                  # Sync versions across files
npm version patch                          # Bump version (auto-syncs)
```

## Critical Development Patterns

### Config Generation

```bash
# NEVER edit src/config.generated.ts directly!
# After changing ax.config.json:
npm run prebuild:config    # Regenerates config.generated.ts
npm run build              # Also calls prebuild:config automatically
```

**Commit config.generated.ts only if types/structure changed** (not just timestamps).

### Test Isolation

Tests MUST clean up after themselves:
```typescript
afterEach(() => {
  // Close database connections
  // Clear timers/intervals
  // Reset singletons
})
```

Each test manages its own timers (no global fake timers):
```typescript
beforeEach(() => vi.useFakeTimers())  // For fake timers
beforeEach(() => vi.useRealTimers())   // For real timers
```

### Provider Safety

Provider names MUST be whitelisted in `BaseProvider.ALLOWED_PROVIDER_NAMES` to prevent command injection.

### Memory Operations

Always use prepared statements for SQLite:
```typescript
const stmt = db.prepare('SELECT * FROM memories WHERE id = ?');
stmt.get(id);
// Never: db.prepare(`SELECT * FROM memories WHERE id = ${id}`);
```

### Runtime Validation

Use Zod for validating external data (API responses, config files, user input):
```typescript
const result = Schema.safeParse(rawResponse);
if (!result.success) throw new ProviderError('Invalid response');
```

## Architecture Overview

### Core Flow

```
1. Workflow Template (.automatosx/workflows/*.yaml) OR Direct Task
   ↓
2. ax run <agent> "task" --workflow <template>
   ↓
3. Provider CLI Selection (wraps claude/gemini/codex/ax-cli)
   ↓
4. Execution (runs provider CLI, handles output parsing)
   ↓
5. Memory Indexing (SQLite FTS5 for future context)
   ↓
6. Trace Logging (JSONL in .automatosx/logs/)
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Provider CLI Wrappers | `src/integrations/` | Wrap claude, gemini, codex, ax-cli CLIs |
| Memory Manager | `src/core/memory-manager.ts` | SQLite FTS5 full-text search (<1ms) |
| Session Manager | `src/core/session-manager.ts` | Multi-agent collaborative sessions |
| Delegation Parser | `src/agents/delegation-parser.ts` | Parse `@agent task` syntax (<1ms regex) |
| Spec-Kit Generators | `src/core/spec/` | Generate plans, DAGs, scaffolds, tests |
| Iterate Mode | `src/core/iterate/` | Auto-responder, classifier, multi-phase orchestration |
| Base Provider | `src/providers/base-provider.ts` | Abstract base with retry/error handling |

### Provider Architecture

- Whitelist: `claude`, `claude-code`, `gemini`, `gemini-cli`, `openai`, `codex`
- Availability caching (60s TTL), version detection caching (5min TTL)
- Circuit breaker with configurable failure thresholds (default 3)

### Configuration

- `ax.config.json`: Main configuration (user-editable)
- `src/config.generated.ts`: Generated TypeScript config (**DO NOT EDIT**)
- Key sections: `providers`, `execution`, `orchestration`, `memory`, `router`, `performance`

## File Organization

```
src/
├── agents/          # Agent system (delegation, profiles, templates)
├── cli/             # CLI commands (yargs-based)
├── core/            # Core services (router, memory, session, spec-kit)
├── integrations/    # Provider integrations (claude-code, gemini-cli, ax-cli)
├── providers/       # Provider implementations
├── types/           # TypeScript type definitions
├── utils/           # Utilities (logger, errors, performance)
└── workers/         # Worker pool for parallel execution

tests/
├── unit/            # Fast, mocked unit tests
├── integration/     # Integration tests (requires providers)
├── smoke/           # Smoke tests (bash scripts)
└── fixtures/        # Test fixtures
```

## Common Workflows

### Adding a New Provider

1. Create provider class extending `BaseProvider` in `src/providers/`
2. Add provider metadata to `src/core/provider-metadata-registry.ts`
3. Register in `ax.config.json`
4. **Add provider name to whitelist** in `BaseProvider.ALLOWED_PROVIDER_NAMES`
5. Create integration bridge if needed (see `src/integrations/`)
6. Add tests in `tests/unit/providers/` and `tests/integration/providers/`

### Adding a New CLI Command

1. Create command file in `src/cli/commands/`
2. Export command using yargs builder pattern
3. Import and register in `src/cli/index.ts`
4. Add tests in `tests/unit/cli/commands/`

### Debugging Provider Issues

```bash
ax --debug <command>              # Verbose logging
ax doctor <provider>              # Diagnose provider setup
ax providers trace --follow       # Real-time routing decisions
# Review logs: .automatosx/logs/router-trace-*.jsonl
```

## Testing Notes

- Vitest with strict isolation (4 max threads, 4 max concurrency)
- `AX_MOCK_PROVIDERS=true` set by default in tests
- Test timeout: 60s per test, 10s for teardown
- Skip integration tests: `SKIP_INTEGRATION_TESTS=true npm test`
- Cleanup in afterEach hooks is **mandatory**

## Type Safety

- Strict TypeScript mode (`strict: true`, `noUncheckedIndexedAccess: true`)
- Path aliases: `@/*` → `src/*`, `@tests/*` → `tests/*`
- Excluded SDK providers in tsconfig.json (placeholder implementations)

## Known Constraints

- Node.js >= 24.0.0 required
- SQLite must support FTS5 extension
- Provider CLIs must be installed separately
- Max delegation depth: 2 (configurable)
- Max concurrent agents: 4 (configurable)
- Memory max entries: 10,000 (auto-cleanup)

## Working with AutomatosX Agents

When executing `ax run` commands, **DO NOT prematurely interrupt agents**:

1. Wait at least 60-120 seconds for code review/analysis tasks
2. Check `BashOutput` status before killing any agent process
3. Only kill if stuck: No new output for 5+ minutes

**Typical Agent Durations**:
- Quality agent (code review): 60-120 seconds
- Backend agent (implementation): 120-300 seconds
- Security agent (audit): 90-180 seconds

## ax-cli SDK Integration

AutomatosX integrates with ax-cli (v3.14.5, SDK v1.3.0) for provider-agnostic access to GLM, xAI, OpenAI, Anthropic, and Ollama models.

**Execution Modes** (in `ax.config.json`):
- `"sdk"`: ~5ms overhead (production)
- `"cli"`: ~50-200ms overhead (fallback)
- `"auto"` (default): SDK if available, else CLI

**Key Integration Files**:
- CLI Adapter: `src/integrations/ax-cli/`
- SDK Adapter: `src/integrations/ax-cli-sdk/`
- Provider: `src/providers/ax-cli-provider.ts`

## Git Workflow

- **Commit format**: Conventional Commits (feat/fix/chore/docs)
- **Husky hooks**: Pre-commit linting, commit-msg validation
- **Version sync**: `npm run sync:all-versions` updates README.md, CLAUDE.md, config

---

For complete documentation, see [docs/AX-Integration.md](docs/AX-Integration.md).
For support, see [GitHub Issues](https://github.com/defai-digital/automatosx/issues).
