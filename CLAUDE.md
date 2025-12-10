# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

**File Management**:
- Store temporary files and generated reports in `automatosx/tmp/`
- Store PRD (Product Requirement Document) files in `automatosx/PRD/`

---

## Project Overview

AutomatosX (v12.6.3) is an AI Agent Orchestration Platform that combines workflow templates, persistent memory, and multi-agent collaboration. It's a production-ready CLI tool that supports Claude Code, Gemini CLI, Codex CLI, GLM (Zhipu AI), Grok (xAI), and Qwen (Alibaba Cloud) providers.

**Repository**: https://github.com/defai-digital/automatosx

## Quick Reference

```bash
# Development (pnpm is the package manager)
pnpm install                               # Install dependencies
npm run dev -- run backend "test task"    # Dev mode with tsx
npm run build                              # Full build (includes config generation)
npm test                                   # All tests
npm run verify                             # Pre-commit checks (typecheck + build + unit tests)

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

# Release (version sync happens automatically via npm version hook)
npm version patch                          # Bump version → auto-syncs README.md, CLAUDE.md, config
npm run sync:all-versions                  # Manual sync if needed
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
3. Provider Selection (Claude Code, Gemini CLI, Codex, GLM, Grok)
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
| Provider Integrations | `src/integrations/` | Claude Code, Gemini CLI, Codex CLI, GLM, Grok |
| Memory Manager | `src/core/memory-manager.ts` | SQLite FTS5 full-text search (<1ms) |
| Session Manager | `src/core/session-manager.ts` | Multi-agent collaborative sessions |
| Delegation Parser | `src/agents/delegation-parser.ts` | Parse `@agent task` syntax (<1ms regex) |
| Spec-Kit Generators | `src/core/spec/` | Generate plans, DAGs, scaffolds, tests |
| Iterate Mode | `src/core/iterate/` | Auto-responder, classifier, multi-phase orchestration |
| Base Provider | `src/providers/base-provider.ts` | Abstract base with retry/error handling |
| MCP Server | `src/mcp/` | Model Context Protocol server (17 tools) |
| Agent Launcher | `src/core/agent-launcher.ts` | Spawns and manages agent processes |
| Provider Router | `src/core/router.ts` | Intelligent provider selection and failover |

### Provider Architecture

- Whitelist: `claude`, `claude-code`, `gemini`, `gemini-cli`, `openai`, `codex`, `glm`, `ax-glm`, `grok`, `ax-grok`
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
├── core/            # Core services (router, memory, session, spec-kit, iterate)
├── integrations/    # Provider integrations (claude-code, gemini-cli, ax-glm, ax-grok)
├── mcp/             # MCP server implementation (automatosx-mcp binary)
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

## Safe Timer Utilities (v12.4.0+)

AutomatosX provides safe timer utilities to prevent process hang and resource leaks.

### Usage

```typescript
import {
  createSafeInterval,
  createSafeTimeout,
  withTimeout,
  sleep
} from '../shared/utils/safe-timers.js';

// Safe interval - automatically calls .unref() to prevent process hang
const cleanup = createSafeInterval(() => {
  console.log('tick');
}, 1000, { name: 'heartbeat' });

// Later: cleanup();

// Safe timeout with cleanup
const cancel = createSafeTimeout(() => {
  console.log('done');
}, 5000);

// Promise with timeout
const result = await withTimeout(fetch('/api'), 5000, {
  message: 'API request timed out'
});

// Sleep with cancellation support
const controller = new AbortController();
await sleep(1000, controller.signal);
```

### Disposable Base Classes

For classes that manage resources (timers, event listeners, connections):

```typescript
import { Disposable, DisposableEventEmitter } from '../shared/utils/disposable.js';

// For non-EventEmitter classes
class MyService extends Disposable {
  private interval: () => void;

  constructor() {
    super();
    // createInterval is automatically cleaned up on destroy()
    this.interval = this.createInterval(() => this.tick(), 1000);
  }

  protected onDestroy(): void {
    // Optional: custom cleanup logic
  }
}

// For EventEmitter subclasses
class MyEmitter extends DisposableEventEmitter {
  constructor() {
    super();
    this.createInterval(() => this.emit('tick'), 1000);
  }
}

// Usage with async disposal
await using service = new MyService();
// service.destroy() called automatically when scope exits
```

### ESLint Rules

The project includes custom ESLint rules to catch timer/resource issues:

```bash
# Rules enabled (warn level):
# - automatosx/no-interval-without-unref
# - automatosx/eventemitter-requires-destroy
```

## Autonomous Bug Fixing (v12.4.0+)

AutomatosX includes an autonomous bug detection and fixing system.

### CLI Usage

```bash
# Scan and fix bugs in current directory
ax bugfix

# Dry-run mode (preview without changes)
ax bugfix --dry-run

# Fix specific scope
ax bugfix --scope src/core/

# Fix specific bug types
ax bugfix --types timer_leak,missing_destroy

# Verbose output
ax bugfix --verbose

# v12.6.0 Features:

# JSON output for CI/CD integration
ax bugfix --json

# Generate markdown report
ax bugfix --report
ax bugfix --report ./reports/bugfix-report.md

# Git-aware scanning (only scan changed files)
ax bugfix --changed           # Files changed in working tree
ax bugfix --staged            # Only staged files
ax bugfix --since main        # Files changed since branch

# Pre-commit hook check (exit 1 if bugs found)
ax bugfix check
ax bugfix check --staged --severity high
```

### Ignore Comments (v12.6.0)

Skip intentional patterns with ignore comments:

```typescript
// ax-ignore
const heartbeat = setInterval(() => ping(), 1000); // Intentionally unref'd elsewhere

// ax-ignore timer_leak
const interval = setInterval(() => tick(), 5000); // Type-specific ignore

// ax-ignore-start
// ... code block to ignore ...
// ax-ignore-end
```

### Supported Bug Types

| Bug Type | Description | Auto-Fix |
|----------|-------------|----------|
| `timer_leak` | setInterval/setTimeout without cleanup | Yes |
| `missing_destroy` | EventEmitter without destroy() | Yes |
| `promise_timeout_leak` | setTimeout not cleared on error | Partial |
| `event_leak` | Event listener without removeListener | Partial |

### Pre-commit Hook Integration (v12.6.0)

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
ax bugfix check --staged --severity high
```

### Programmatic Usage

```typescript
import { BugfixController, createDefaultBugfixConfig } from './core/bugfix/index.js';

const controller = new BugfixController({
  rootDir: process.cwd(),
  config: {
    bugTypes: ['timer_leak', 'missing_destroy'],
    maxBugs: 10,
    dryRun: false,
    requireTests: true,
    requireTypecheck: true,
  },
  fileFilter: ['src/changed-file.ts'], // Git-aware scanning
  onProgress: (state, stats) => console.log(state, stats),
  onBugFound: (bug) => console.log('Found:', bug),
  onFixApplied: (bug, attempt) => console.log('Fixed:', bug.file),
});

const result = await controller.execute();
console.log(`Fixed ${result.stats.bugsFixed} of ${result.stats.bugsFound} bugs`);
```

## Working with AutomatosX Agents

When executing `ax run` commands, **DO NOT prematurely interrupt agents**:

1. Wait at least 60-120 seconds for code review/analysis tasks
2. Check `BashOutput` status before killing any agent process
3. Only kill if stuck: No new output for 5+ minutes

**Typical Agent Durations**:
- Quality agent (code review): 60-120 seconds
- Backend agent (implementation): 120-300 seconds
- Security agent (audit): 90-180 seconds

## SDK-First Providers (v12.0.0+)

AutomatosX supports native SDK integration for GLM (Zhipu AI), Grok (xAI), and Qwen (Alibaba Cloud) providers.

**SDK-First Providers**:
- `glm`: GLM-4 and GLM-3 Turbo (API key: `GLM_API_KEY`)
- `grok`: Grok-3 and Grok-2 (API key: `XAI_API_KEY`)
- `qwen`: Qwen-Turbo, Qwen-Plus, Qwen-Max, Qwen3-Coder (API key: `DASHSCOPE_API_KEY` or `QWEN_API_KEY`) (v12.7.0)

**Qwen Provider Setup** (v12.7.0):
```bash
# Option 1: SDK mode (recommended) - set API key
export DASHSCOPE_API_KEY=your_api_key
# or
export QWEN_API_KEY=your_api_key

# Option 2: CLI mode - install Qwen Code CLI
npm install -g @qwen-code/qwen-code@latest
qwen  # First run will prompt for OAuth login (2,000 req/day free tier)
```

**Key Integration Files**:
- GLM Adapter: `src/integrations/ax-glm/`
- Grok Adapter: `src/integrations/ax-grok/`
- Qwen Adapter: `src/integrations/qwen-code/`
- GLM Provider: `src/providers/glm-provider.ts`
- Grok Provider: `src/providers/grok-provider.ts`
- Qwen Provider: `src/providers/qwen-provider.ts`

## Git Workflow

- **Commit format**: Conventional Commits (feat/fix/chore/docs)
- **Husky hooks**: Pre-commit linting, commit-msg validation
- **Version sync**: `npm version <patch|minor|major>` auto-runs `tools/sync-all-versions.js`

## MCP Server Development

The MCP server (`automatosx-mcp`) provides 17 tools for Claude Code integration:

```bash
# Build produces both CLI and MCP binaries
npm run build                     # Creates dist/index.js and dist/mcp/index.js

# Test MCP server locally
echo '{"jsonrpc":"2.0","method":"initialize","id":1}' | automatosx-mcp

# MCP server entry point
src/mcp/index.ts                  # Main entry
src/mcp/server.ts                 # Server implementation
src/mcp/tools/                    # Tool implementations
```

---

For complete documentation, see [docs/AX-Integration.md](docs/AX-Integration.md).
For support, see [GitHub Issues](https://github.com/defai-digital/automatosx/issues).
