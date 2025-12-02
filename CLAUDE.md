# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

**IMPORTANT - File Management**:
- Store all temporary files and generated reports in `automatosx/tmp/`
- Store all PRD (Product Requirement Document) files in `automatosx/PRD/`
- Store all project status reports in `automatosx/tmp/`

---

## Project Overview

AutomatosX (v11.0.0) is an AI Agent Orchestration Platform that combines workflow templates, persistent memory, and multi-agent collaboration. It's a production-ready CLI tool that wraps around existing AI provider CLIs (claude, gemini, codex, ax-cli) for seamless orchestration.

**Key Differentiators:**
- **Workflow Templates** (v11.0.0): YAML-based workflow templates with `--workflow` flag for iterate mode
- **Spec-Kit Generators**: Auto-generate plans, DAGs, scaffolds, and tests (`ax gen` commands)
- **Pure CLI Wrapper**: Wraps around existing `claude`, `gemini`, `codex`, `ax-cli` CLIs for simple integration
- **Persistent Memory**: SQLite FTS5 full-text search (< 1ms) - perfect context with zero API costs
- **Multi-Agent Orchestration**: 20 specialized agents that delegate tasks autonomously
- **Token-Based Budgets**: Reliable budget control using token limits (v9.0.0+)
- **Complete Observability**: JSONL trace logging for every execution decision

**Repository**: https://github.com/defai-digital/automatosx

## Package Manager Setup

This project uses a **hybrid package manager approach**:

| Context | Package Manager | Lock File |
|---------|-----------------|-----------|
| CI/CD Pipelines | pnpm | pnpm-lock.yaml |
| Local Development | npm or pnpm | package-lock.json or pnpm-lock.yaml |
| End User Installation | npm | (uses published package) |

**Why pnpm for CI?**
- 30-50% faster install times (hardlinks + content-addressable store)
- Stricter dependency resolution (catches phantom dependencies)
- Better disk efficiency in CI runners

**Local Development:** Both npm and pnpm work. Husky hooks auto-detect and use the appropriate package manager.

```bash
# Using npm (traditional)
npm install
npm run build
npm test

# Using pnpm (faster)
pnpm install
pnpm run build
pnpm test
```

## Quick Reference for Common Tasks

```bash
# Development workflow (npm or pnpm)
npm run dev -- run backend "test task"    # Dev mode with tsx (fastest iteration)
npm run build                              # Full build (includes config generation)
npm test                                   # All tests (unit + integration + smoke)
npm run verify                             # Pre-commit (typecheck + build + unit tests)

# Or with pnpm (faster)
pnpm run dev -- run backend "test task"
pnpm run build
pnpm test

# Working with a single test
npx vitest run tests/unit/core/router.test.ts
# Or: pnpm exec vitest run tests/unit/core/router.test.ts

# Linting
npm run lint                               # Check for lint issues
npm run lint:fix                           # Auto-fix lint issues

# Type checking
npm run typecheck                          # Full TypeScript check
npm run typecheck:incremental              # Faster incremental check

# Test commands
npm run test:unit                          # Unit tests only
npm run test:integration                   # Integration tests only
npm run test:coverage                      # Generate coverage report
npm run test:watch                         # Watch mode for TDD

# Debugging
ax --debug <command>                       # CLI debug mode (verbose logging)

# Log level control
export AUTOMATOSX_LOG_LEVEL=warn          # Default: only warnings and errors
export AUTOMATOSX_LOG_LEVEL=info          # Verbose: shows all initialization logs

# Verbosity control (CLI output)
ax run backend "task" --quiet              # Quiet mode (for AI assistants, CI)
ax run backend "task"                      # Normal mode (default)
ax run backend "task" --verbose            # Verbose mode (debugging)

# Release workflow
npm run sync:all-versions                  # Sync versions across files
npm version patch                          # Bump version (auto-syncs via hook)
npm run release:check                      # Validate release readiness
```

## Critical Development Patterns

### 1. Config Generation Workflow

```bash
# NEVER edit src/config.generated.ts directly - changes will be lost!
# After changing ax.config.json:
npm run prebuild:config    # Regenerates config.generated.ts
npm run build              # Also calls prebuild:config automatically
```

**When to Commit config.generated.ts:**
- Check `git diff src/config.generated.ts`
- Only timestamps/comments changed? → Skip (`git restore src/config.generated.ts`)
- Types/structure changed? → **Must commit** for type safety

### 2. Test Isolation

```typescript
// Tests MUST clean up after themselves to prevent resource leaks
afterEach(() => {
  // Close database connections
  // Clear timers/intervals
  // Reset singletons
  // Clean temporary files
})
```

- Global fake timers were removed in v5.7.0
- Each test should explicitly declare timer requirements:
  ```typescript
  beforeEach(() => vi.useFakeTimers())  // For fake timers
  beforeEach(() => vi.useRealTimers())   // For real timers
  ```
- Global cleanup hooks in `vitest.setup.ts` handle cache clearing and mock restoration

### 3. Provider Safety

```typescript
// Provider names MUST be whitelisted (prevents command injection)
// See BaseProvider.ALLOWED_PROVIDER_NAMES
// When adding a provider, add to whitelist first!
```

### 4. Memory Operations

```typescript
// Always use prepared statements for SQLite (fast + SQL injection safe)
const stmt = db.prepare('SELECT * FROM memories WHERE id = ?');
stmt.get(id);

// ❌ Never use string concatenation
// db.prepare(`SELECT * FROM memories WHERE id = ${id}`);
```

### 5. Runtime Validation with Zod

```typescript
import { z } from 'zod';

// ✅ ALWAYS validate external data (API responses, config files, user input)
const ProviderResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative()
  }).optional()
});

const result = ProviderResponseSchema.safeParse(rawResponse);
if (!result.success) {
  throw new ProviderError('Invalid response format');
}
const validated = result.data; // Type-safe!
```

**When to Use Zod:** External API responses, config files, CLI arguments, YAML specs, any external input.

### 6. Resource Management

- Register cleanup handlers for intervals, timers, database connections
- Use `installExitHandlers()` from `utils/process-manager.ts` for subprocess cleanup
- Set busyTimeout (default 5s) for concurrent SQLite access
- Debounce saves to reduce I/O (e.g., SessionManager uses 1s debounce)

### 7. Error Handling

- Use typed errors: `ProviderError`, `SessionError`, `MemoryError`, `SpecError`
- Include error codes for programmatic handling
- Check `shouldRetryError()` from `providers/retry-errors.ts`
- Circuit breaker: Providers have configurable failure thresholds (default 3)

### 8. Agent Profile Instructions (v8.4.15 Critical Insight)

**CRITICAL**: Keep agent system prompts simple - **NEVER mention sandboxes, permissions, or constraints**.

When you tell AI agents about sandboxes or restrictions (even to "ignore" them), agents become aware of constraints as a concept and refuse operations based on assumptions, not reality.

**Correct Approach**:
```yaml
**CRITICAL - Non-Interactive Mode Behavior**:
When running in non-interactive mode, proceed automatically without asking for permission.

- Execute tasks directly without prompting
- If you cannot complete a task, explain why and provide workarounds
- NEVER output messages like "need to know if you want me to proceed"
```

**Key Lesson**: Sometimes the best fix is to REMOVE complexity. Let the environment enforce restrictions naturally.

## Architecture Overview

### Core Flow: Workflow → CLI Wrapper → Execution → Memory

```
1. Workflow Template (.automatosx/workflows/*.yaml) OR Direct Task
   ↓
2. ax run <agent> "task" --workflow <template> (auto-enables iterate mode)
   ↓
3. Provider CLI Selection (wraps existing claude/gemini/codex/ax-cli commands)
   ↓
4. Execution (runs provider CLI with task, handles output parsing)
   ↓
5. Memory Indexing (saves to SQLite FTS5 for future context)
   ↓
6. Trace Logging (JSONL in .automatosx/logs/ for observability)
```

**v11.0.0 Note**: Spec-Kit execution commands (`ax spec run/init/create/validate`) were removed.
Use `ax run <agent> "task" --iterate` or `--workflow <template>` for complex tasks.

### Key System Components

**1. Provider CLI Wrappers (`src/integrations/`)**
- Pure CLI wrappers around existing `claude`, `gemini`, `codex`, `ax-cli` commands
- No API keys needed for CLI mode (uses installed provider CLIs)
- Stream parsing, error handling, retry logic, JSONL trace logging

**2. Memory Manager (`src/core/memory-manager.ts`)**
- SQLite + FTS5 for full-text search (no vector embeddings)
- < 1ms search with prepared statements
- Smart cleanup strategies (oldest/least_accessed/hybrid)

**3. Session Manager (`src/core/session-manager.ts`)**
- Multi-agent collaborative sessions with UUID validation
- Atomic saves (temp file + rename pattern)
- Task tracking with metadata size limits (10KB)

**4. Delegation Parser (`src/agents/delegation-parser.ts`)**
- Parses `@agent task` and `DELEGATE TO agent: task` syntax
- < 1ms regex-based parsing (no LLM calls)

**5. Spec-Kit Generators (`src/core/spec/`)** (v11.0.0: Execution removed)
- `SpecLoader.ts`: Loads/validates YAML specs
- `PlanGenerator.ts`: Generate execution plans from specs
- `DagGenerator.ts`: Generate dependency graphs
- `ScaffoldGenerator.ts`: Generate project scaffolds
- `TestGenerator.ts`: Auto-generate test files
- Note: Execution commands removed in v11.0.0. Use `--workflow` flag instead.

### Provider Architecture

**Base Provider (`src/providers/base-provider.ts`)**
- Abstract base with retry logic and error handling
- Provider name whitelist: `claude`, `claude-code`, `gemini`, `gemini-cli`, `openai`, `codex`
- Availability caching (60s TTL), version detection caching (5min TTL)
- Token usage tracking (accurate from provider responses)

**Implementations:**
- `claude-provider.ts`: CLI-based Claude integration
- `gemini-provider.ts`: CLI-based Gemini integration
- `openai-provider.ts`: Codex CLI integration

**Integration Layer (`src/integrations/`)**
- `claude-code/`: MCP manager, command manager, config manager
- `gemini-cli/`: Command translator, file readers, MCP support
- `ax-cli/`: Multi-provider CLI adapter (GLM, xAI, OpenAI, Anthropic, Ollama)
- `openai-codex/`: CLI wrapper, MCP support, AGENTS.md auto-injection

### Configuration System

**Config Loading (`src/core/config.ts`)**
- Merges `ax.config.json` (user) + default config
- Generates `src/config.generated.ts` at build time via `tools/prebuild-config.cjs`
- **CRITICAL**: `config.generated.ts` is auto-generated - **never edit manually**

**Key Config Sections:**
- `providers`: Timeouts, health checks, circuit breakers
- `execution`: Timeouts, concurrency, retry logic
- `orchestration`: Session limits, delegation depth, cycle detection
- `memory`: Max entries, persistence path, auto-cleanup, FTS search limits
- `router`: Health check intervals, cooldown, free-tier prioritization
- `performance`: Cache configurations (profile, team, provider, adaptive)

### CLI Architecture (`src/cli/`)

**Entry Point (`src/cli/index.ts`)**
- Yargs-based command parsing
- Global options: `--debug`, `--quiet`, `--config`
- Exit handlers via `installExitHandlers()` for cleanup

**Key Commands:**
- `setup`: Initialize .automatosx/ directory with agents and config
- `init`: AI-powered initialization with template generation
- `run`: Execute agent tasks with memory, delegation, and `--workflow` templates
- `spec explain`: Explain a spec file (execution removed in v11.0.0)
- `gen`: Generate plans, DAGs, scaffolds, tests from specs
- `providers`: List providers, show info, view trace logs
- `memory`: Search, add, export memory entries
- `session`: Multi-agent session management
- `agent`: Create/list/show/remove custom agents
- `doctor`: Diagnostic checks for provider setup
- `free-tier`: Check quota status and usage history

## File Organization

```
src/
├── agents/          # Agent system (delegation, profiles, templates)
├── cli/             # CLI commands and renderers
│   ├── commands/    # Individual command implementations
│   └── index.ts     # CLI entry point
├── core/            # Core services (router, memory, session, spec-kit)
│   ├── analytics/   # Usage analytics and optimization
│   ├── free-tier/   # Free tier quota management
│   ├── spec/        # Spec-Kit components (plan, DAG, scaffold, test gen)
│   ├── telemetry/   # Telemetry collection
│   └── workload/    # Workload analysis for routing
├── integrations/    # Provider integrations (claude-code, gemini-cli, openai-codex)
├── providers/       # Provider implementations
├── types/           # TypeScript type definitions
├── utils/           # Utilities (logger, errors, performance, etc.)
└── workers/         # Worker pool for parallel execution

tests/
├── unit/            # Fast, mocked unit tests
├── integration/     # Integration tests (requires providers)
├── smoke/           # Smoke tests (bash scripts)
├── benchmark/       # Performance benchmarks
├── fixtures/        # Test fixtures
└── helpers/         # Test utilities
```

## Key Files to Know

### Core Configuration
- `ax.config.json`: Main configuration (user-editable)
- `src/config.generated.ts`: Generated TypeScript config (**DO NOT EDIT manually**)
- `tools/prebuild-config.cjs`: Config generator script (runs before build)
- `tools/sync-all-versions.js`: Version sync tool (used in release process)

### Testing & Build
- `vitest.setup.ts`: Test setup (mocks, globals, cleanup hooks)
- `vitest.config.ts`: Vitest configuration (thread pool, timeouts, coverage)
- `tsup.config.ts`: Build configuration (tsup with ESM output, externals list)
- `tsconfig.json`: TypeScript configuration (strict mode, path aliases)

### Excluded TypeScript Files

These SDK provider files are excluded from TypeScript compilation (see tsconfig.json):
- `src/providers/claude-sdk-provider.ts`
- `src/providers/gemini-sdk-provider.ts`
- `src/providers/openai-sdk-provider.ts`

These are placeholder/future implementations that are intentionally skipped.

### Build System Notes

**tsup.config.ts** - Critical externals configuration:
- Native modules: `better-sqlite3`, `sqlite-vec` (must be external)
- Interactive CLI: `marked`, `marked-terminal`, `cardinal`, `cli-highlight` (dynamic requires)
- Terminal UI: `chalk`, `ora`, `boxen`, `cli-table3`, `inquirer` (ANSI codes, TTY)
- Other: `yargs`, `find-up`, `js-yaml`, `mustache`, `openai`

**Why externals matter**: Bundling these would break dynamic requires, native code, or TTY interactions.

## Testing Notes

- Tests use Vitest with strict isolation (4 max threads, 4 max concurrency)
- `AX_MOCK_PROVIDERS=true` is set by default in tests
- Global setup: `vitest.setup.ts`, teardown: `vitest.global-teardown.ts`
- Test timeout: 60s per test, 10s for teardown
- Integration tests can be skipped: `SKIP_INTEGRATION_TESTS=true npm test`
- Cleanup in afterEach hooks is **mandatory** to prevent resource leaks
- **v5.7.0+**: Tests manage their own timers (no global fake timers)

## Type Safety

- Strict TypeScript mode enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- Path aliases: `@/*` → `src/*`, `@tests/*` → `tests/*`
- Generated types: `src/config.generated.ts` built from JSON schema
- Provider types: See `src/types/provider.ts` for core interfaces
- **Runtime validation**: Use Zod for validating external inputs

## Common Workflows

### Adding a New Provider

1. Create provider class extending `BaseProvider` in `src/providers/`
2. Add provider metadata to `src/core/provider-metadata-registry.ts`
3. Register in router configuration (`ax.config.json`)
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
ax free-tier status               # Check quota usage
# Review logs: .automatosx/logs/router-trace-*.jsonl
```

## Token-Based Budget Control (v9.0.0+)

Cost estimation was **removed** in v9.0.0. Use token-based budgets:

```bash
ax run backend "task" --iterate-max-tokens 1000000
ax run backend "task" --iterate-max-tokens-per-iteration 100000
```

**Why Token-Based?**
- Token counts never change (unlike provider pricing)
- Direct from provider API responses, no estimates
- No pricing updates needed

**Migration**: See `docs/migration/v9-cost-to-tokens.md`

## Git Workflow

**Commit Message Format**: Conventional Commits (feat/fix/chore/docs)
**Husky Hooks**: Pre-commit linting, commit-msg validation

**Version Management:**
- Single source of truth: `package.json` version field
- Sync script: `npm run sync:all-versions` updates README.md, CLAUDE.md, config
- Release workflow: `npm version [patch|minor|major]` → auto-sync → commit → tag

## Performance Considerations

- Provider CLI execution: Depends on underlying CLI performance
- Memory search: < 1ms with FTS5 prepared statements
- Delegation parsing: < 1ms per response (regex-based)
- Provider availability check: Cached for 60s (adaptive TTL)
- Config loading: Lazy with caching (5min TTL for profiles)
- Database: Use prepared statements, avoid COUNT(*) in hot paths

## Known Constraints

- Node.js >= 24.0.0 required (ES2022 features)
- SQLite must support FTS5 extension (usually built-in)
- Provider CLIs must be installed separately (`claude`, `gemini`, `codex`, `ax-cli`)
- Max delegation depth: 2 (configurable in `orchestration.delegation.maxDepth`)
- Max concurrent agents: 4 (configurable in `execution.concurrency.maxConcurrentAgents`)
- Memory max entries: 10,000 (auto-cleanup if exceeded)
- Session persistence debounce: 1s (reduces I/O but delays saves)

## ax-cli SDK Integration

AutomatosX has **comprehensive ax-cli integration** (v3.14.5, SDK v1.3.0) with both CLI and SDK execution modes, providing provider-agnostic access to GLM, xAI, OpenAI, Anthropic, and Ollama models.

### ax-cli Architecture

```
AutomatosX                         ax-cli (v3.14.5)
    │                                   │
    ├─ AxCliProvider ─────────────────► HybridAxCliAdapter
    │   (src/providers/                 │
    │    ax-cli-provider.ts)            │
    │                                   │
    │   ┌───────────────────────────────┴───────────────────────────────┐
    │   │                                                               │
    │   ▼                                                               ▼
    │  SDK Mode (10-40x faster)                                   CLI Mode
    │  AxCliSdkAdapter                                          AxCliAdapter
    │  (src/integrations/ax-cli-sdk/)                    (src/integrations/ax-cli/)
    │   │                                                               │
    │   ├─ createAgent()                                          ├─ ax-cli -p "prompt"
    │   ├─ agent.processUserMessageStream()                       ├─ JSONL parsing
    │   ├─ Streaming events                                       └─ Shell-safe escaping
    │   └─ Token tracking                                               │
    │                                                                   │
    └───────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │   AI Providers      │
                              ├─────────────────────┤
                              │ • GLM (glm-4.6)     │
                              │ • xAI/Grok (grok-2) │
                              │ • OpenAI (gpt-4)    │
                              │ • Anthropic         │
                              │ • Ollama (local)    │
                              └─────────────────────┘
```

**Note**: Grok/xAI is only accessible through ax-cli.

### ax-cli SDK v1.3.0 Exports

The SDK now has **dedicated entry points**:
```typescript
// Import from dedicated SDK module
import { createAgent, createSubagent } from '@defai.digital/ax-cli/sdk';
import type { AgentOptions, SubagentConfig } from '@defai.digital/ax-cli/sdk/types';
```

**Core Classes:**
- `LLMAgent` - Main agent class with streaming and tool execution
- `Subagent` - Specialized task agents for focused domains
- `SubagentOrchestrator` - Multi-agent coordination and parallel execution
- `ContextManager` - Context window optimization and monitoring
- `LLMClient` - Direct LLM access without agent abstraction
- `MCPManager` / `MCPManagerV2` - MCP server lifecycle management (v1.3.0)
- `ToolRegistry` - Tool registration and lifecycle management
- `ProgressReporter` - Progress event handling (v1.3.0)
- `UnifiedLogger` - Centralized logging system (v1.3.0)
- `PermissionManager` - Permission/risk tier system (v1.3.0)

**Testing Utilities:**
```typescript
import { MockAgent, createMockAgent, MockSettingsManager, MockMCPServer } from '@defai.digital/ax-cli/sdk';
```

### Execution Modes

| Mode | Performance | Use Case |
|------|-------------|----------|
| `"sdk"` | ~5ms overhead | Production (requires SDK installed) |
| `"cli"` | ~50-200ms overhead | Legacy/fallback mode |
| `"auto"` (default) | SDK if available, else CLI | Recommended |

**Configuration** in `ax.config.json`:
```json
{
  "providers": {
    "ax-cli": {
      "enabled": true,
      "priority": 4,
      "mode": "auto",
      "axCliSdk": {
        "streamingEnabled": true,
        "reuseEnabled": true
      }
    }
  }
}
```

### SDK createAgent API (v1.2.0)

```typescript
import { createAgent, removeCleanupHandlers } from '@defai.digital/ax-cli/sdk';

const agent = await createAgent({
  maxToolRounds: 400,        // 1-1000, default 400
  debug: false,              // Verbose logging mode
  autoCleanup: true,         // Auto cleanup on process exit (default: true)
  onDispose: () => {},       // Lifecycle hook before agent disposal
  onError: (err) => {}       // Error handler callback
});

// For manual lifecycle control
removeCleanupHandlers(agent);
```

### SDK Subagent Roles (v1.2.0)

The SDK now provides **6 specialized subagent roles**:

```typescript
import { createSubagent } from '@defai.digital/ax-cli/sdk';

// Available roles
const tester = createSubagent('testing', config);
const docs = createSubagent('documentation', config);
const refactor = createSubagent('refactoring', config);
const analyst = createSubagent('analysis', config);
const debugger = createSubagent('debugging', config);
const perf = createSubagent('performance', config);
```

**SubagentRole Mapping** (AutomatosX → ax-cli):
| AutomatosX Agent | ax-cli SubagentRole |
|------------------|---------------------|
| backend, frontend, fullstack, mobile | `developer` |
| security | `auditor` |
| quality | `testing` |
| architecture, cto | `architect` |
| researcher, data-scientist, data | `analysis` |
| writer, product | `documentation` |
| standard | `reviewer` |
| devops, performance | `performance` |
| debug | `debugging` |

### Integration Code Structure

**CLI Adapter** (`src/integrations/ax-cli/`):
- `adapter.ts`: CLI process spawning, availability caching
- `command-builder.ts`: Shell-safe argument building
- `response-parser.ts`: JSONL parsing with Zod validation
- `interface.ts`: TypeScript interfaces
- `types.ts`: Zod schemas

**SDK Adapter** (`src/integrations/ax-cli-sdk/`):
- `adapter.ts`: In-process SDK execution via `createAgent()`
- `hybrid-adapter.ts`: Mode selection and fallback logic
- `token-estimator.ts`: Fallback token estimation (4 chars/token)
- `subagent-adapter.ts`: Parallel multi-agent execution
- `checkpoint-adapter.ts`: Resumable workflow support
- `instructions-bridge.ts`: Unified agent instructions
- `mcp-manager.ts`: MCP server template management (v10.4.1)

**Provider** (`src/providers/ax-cli-provider.ts`): Provider-agnostic AI access, extends BaseProvider

### Advanced SDK Features

**1. Parallel Multi-Agent Execution** (`SubagentAdapter`):
```typescript
const provider = new AxCliProvider({ mode: 'auto' });

const results = await provider.executeParallelTasks([
  { task: 'Implement API', config: { role: 'developer', specialization: 'backend' } },
  { task: 'Write tests', config: { role: 'testing' } },
  { task: 'Security audit', config: { role: 'auditor', specialization: 'security' } }
]);
```

**2. Resumable Workflows** (`CheckpointAdapter`):
```typescript
await provider.saveCheckpoint('auth-workflow', {
  phase: 2,
  completedTasks: ['design', 'implement'],
  context: 'OAuth integration complete...',
  tokensUsed: { prompt: 5000, completion: 3000, total: 8000 }
});

const checkpoint = await provider.loadCheckpoint('auth-workflow');
```

**3. Unified Agent Instructions** (`InstructionsBridge`):
```typescript
const instructions = await provider.getAgentInstructions('backend', 'Additional context');
console.log(instructions.systemPrompt);  // Combined system prompt
```

**4. Context Window Management** (NEW in v3.12.x):
```typescript
import { ContextManager } from '@defai.digital/ax-cli/sdk';

const contextMgr = new ContextManager();
// Monitor and optimize context window usage
// Prevents exhaustion during long conversations
```

### Recent ax-cli Improvements (v3.9.0 → v3.14.5)

| Version | Feature |
|---------|---------|
| v3.14.5 | SDK v1.3.0: Event interfaces, MCPManagerV2, PermissionManager |
| v3.14.4 | MCP SDK updated to v1.22.0 |
| v3.14.x | Project Memory system with 50% token savings |
| v3.13.x | Enhanced security: AES-256-GCM encryption, PBKDF2 key derivation |
| v3.12.10 | Fixed parseInt NaN bug in git churn calculator |
| v3.12.9 | Fixed infinite spin-wait loop in `getMCPManager()` |
| v3.12.9 | Fixed O(n²) complexity in `generateDiff()` |
| v3.12.7 | VS Code auto-opens files after creation/modification |
| v3.12.6 | Rolling tool display (Claude Code-style grouping) |
| v3.12.5 | Interactive `ask_user` dialog with multi-question support |
| v3.12.3 | Quick actions: toggle verbosity, auto-edit, thinking mode |

### MCP Integration (v10.4.1)

AutomatosX now integrates with ax-cli's MCP system, exposing **13 predefined server templates**:

| Template | Category | Transport | Official |
|----------|----------|-----------|----------|
| figma | design | stdio | ✅ |
| github | version-control | stdio | ✅ |
| postgres | backend | stdio | ✅ |
| sqlite | backend | stdio | ✅ |
| vercel | deployment | HTTP | |
| netlify | deployment | HTTP | |
| puppeteer | testing | stdio | |
| storybook | testing | HTTP | |
| chromatic | testing | HTTP | |
| sentry | monitoring | HTTP | |
| supabase | backend | HTTP | |
| firebase | backend | HTTP | |

**MCP Manager Usage:**
```typescript
import { AxCliSdkAdapter } from '@/integrations/ax-cli-sdk/adapter.js';

const adapter = new AxCliSdkAdapter();

// Get MCP manager
const mcp = adapter.getMCPManager();

// List available templates
const templates = await adapter.getMCPTemplateNames();
// ['figma', 'github', 'vercel', 'netlify', ...]

// Add MCP server from template
await adapter.addMCPFromTemplate('github', {
  GITHUB_TOKEN: 'ghp_xxx'
});

// List configured servers
const servers = await adapter.listMCPServers();
```

**Direct MCP Manager:**
```typescript
import { AxCliMCPManager } from '@/integrations/ax-cli-sdk/mcp-manager.js';

const mcp = new AxCliMCPManager();

// Get template details
const result = await mcp.getTemplate('figma');
if (result.ok) {
  console.log(result.value.description);
  console.log(result.value.requiredEnv); // ['FIGMA_ACCESS_TOKEN']
}

// Search templates by keyword
const testing = await mcp.searchTemplates('test');
// Returns puppeteer, storybook, chromatic

// Get templates by category
const backend = await mcp.getTemplatesByCategory('backend');
// Returns postgres, sqlite, supabase, firebase
```

### Usage Examples

**Via AxCliProvider** (recommended):
```typescript
import { AxCliProvider } from '@/providers/ax-cli-provider.js';

const provider = new AxCliProvider({
  name: 'ax-cli',
  mode: 'auto',
  axCliSdk: {
    streamingEnabled: true,
    reuseEnabled: true
  }
});

const response = await provider.execute({
  task: 'Implement feature X',
  timeout: 120000
});
```

**Direct SDK Usage** (for testing):
```typescript
import { createAgent, createMockAgent } from '@defai.digital/ax-cli/sdk';

// Production
const agent = await createAgent({ maxToolRounds: 400 });

// Testing
const mockAgent = createMockAgent();
```

### ax-cli vs AutomatosX

| Capability | ax-cli | AutomatosX |
|------------|--------|------------|
| Single-agent execution | ✅ Primary focus | ✅ Via AxCliProvider |
| Multi-agent orchestration | ✅ SubagentOrchestrator | ✅ 20+ specialized agents |
| Parallel subagent execution | ✅ SDK API | ✅ Via SubagentAdapter |
| Session continuity | ✅ `--continue` | ✅ Session manager |
| Persistent memory | ✅ Project memory | ✅ SQLite FTS5 (< 1ms) |
| MCP support | ✅ 13 templates | ✅ Via AxCliMCPManager (v10.4.1) |
| Workflow automation | ❌ | ✅ YAML specs |
| Provider routing | Single provider | Multi-provider with fallback |
| Testing utilities | ✅ MockAgent, MockMCP | ✅ Via ax-cli SDK |
| Context management | ✅ ContextManager | ✅ Via SDK adapter |

## Workspace Conventions

- **`automatosx/PRD/`** - Planning and Requirements Documents (in .gitignore)
- **`automatosx/tmp/`** - Temporary Working Files (in .gitignore)

## Working with AutomatosX Agents (IMPORTANT!)

When Claude Code executes `ax run` commands, **DO NOT prematurely interrupt agents**!

**Critical Rules**:
1. **Be patient**: Time estimates are intentionally conservative (10-20x actual duration)
2. **Wait at least 60-120 seconds** for code review/analysis tasks
3. **Check `BashOutput` status** before attempting to kill any agent process
4. **Only kill if stuck**: No new output for 5+ minutes = stuck, otherwise let it run

**Typical Agent Durations** (actual, not estimated):
- Quality agent (code review): 60-120 seconds
- Backend agent (implementation): 120-300 seconds
- Security agent (audit): 90-180 seconds
- Other agents: Usually 60-180 seconds

### Working with `ax setup`

The `ax setup` command initializes the AutomatosX workspace. **DO NOT interrupt it prematurely**!

- **Typical Duration**: 30-90 seconds
- **Only interrupt if stuck**: No output for 5+ minutes

### Working with Provider CLIs Directly

When running `claude`, `gemini`, or `codex` CLI commands directly:

- Provider CLIs can take 60-300 seconds for complex tasks
- Check streaming output for gradual progress
- **Only kill if truly stuck**: No output for 5+ minutes

### Background Agent Notifications (v8.5.0+)

AutomatosX automatically creates status files when agents complete in `.automatosx/status/`:

```json
{
  "agent": "backend",
  "status": "completed",
  "timestamp": "2025-11-18T15:11:37.508Z",
  "duration": 13096,
  "task": "implement user authentication"
}
```

### Polling Background Agents

When monitoring background agents with `BashOutput`, use exponential backoff:

```
First wait:  30 seconds (let agent start)
Check 1:     30s total
Check 2:     45s total (+15s)
Check 3:     65s total (+20s)
Check 4+:    Every 30s thereafter
```

**Anti-Patterns to Avoid**:
- ❌ Polling every 3-5 seconds
- ❌ Checking more than 4 times in first 2 minutes
- ❌ Assuming agent is stuck before 5 minutes

**Best Approach**: Use `BackgroundAgentMonitor` for file-based notification (zero polling):
```typescript
import { BackgroundAgentMonitor } from './core/background-agent-monitor.js';
const monitor = new BackgroundAgentMonitor();
await monitor.watchAgent('writer', (status) => {
  console.log(`✅ ${status.agent} completed`);
});
```

---

For complete version history, see [CHANGELOG.md](CHANGELOG.md).
For support, see [GitHub Issues](https://github.com/defai-digital/automatosx/issues).

---

# AutomatosX Integration for Claude Code

**IMPORTANT**: For the complete AutomatosX integration guide, **please read [AutomatosX-Integration.md](../AutomatosX-Integration.md)**.

This file provides Claude Code-specific tips and quick reference. For comprehensive documentation including all agents, commands, memory features, workflows, and troubleshooting, see [AutomatosX-Integration.md](../AutomatosX-Integration.md).

---

This project uses [AutomatosX](https://github.com/defai-digital/automatosx) - an AI agent orchestration platform with persistent memory and multi-agent collaboration.

## Quick Start

### Available Commands

```bash
# List all available agents
ax list agents

# Run an agent with a task
ax run <agent-name> "your task description"

# Example: Ask the backend agent to create an API
ax run backend "create a REST API for user management"

# Search memory for past conversations
ax memory search "keyword"

# View system status
ax status
```

### Using AutomatosX in Claude Code

You can interact with AutomatosX agents directly in Claude Code using natural language:

**Natural Language Examples**:
```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
"Use ax agent product to design this new feature"
"Work with ax agent devops to set up the deployment pipeline"
```

Claude Code will understand your intent and invoke the appropriate AutomatosX agent for you. Just describe what you need in natural language - no special commands required!

### Available Agents

This project includes the following specialized agents:

- **backend** (Bob) - Backend development (Go/Rust systems)
- **frontend** (Frank) - Frontend development (React/Next.js/Swift)
- **architecture** (Avery) - System architecture and ADR management
- **fullstack** (Felix) - Full-stack development (Node.js/TypeScript)
- **mobile** (Maya) - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** (Oliver) - DevOps and infrastructure
- **security** (Steve) - Security auditing and threat modeling
- **data** (Daisy) - Data engineering and ETL
- **quality** (Queenie) - QA and testing
- **design** (Debbee) - UX/UI design
- **writer** (Wendy) - Technical writing
- **product** (Paris) - Product management
- **cto** (Tony) - Technical strategy
- **ceo** (Eric) - Business leadership
- **researcher** (Rodman) - Research and analysis
- **data-scientist** (Dana) - Machine learning and data science
- **aerospace-scientist** (Astrid) - Aerospace engineering and mission design
- **quantum-engineer** (Quinn) - Quantum computing and algorithms
- **creative-marketer** (Candy) - Creative marketing and content strategy
- **standard** (Stan) - Standards and best practices expert

For a complete list with capabilities, run: `ax list agents --format json`

## Key Features

### 1. Persistent Memory

AutomatosX agents remember all previous conversations and decisions:

```bash
# First task - design is saved to memory
ax run product "Design a calculator with add/subtract features"

# Later task - automatically retrieves the design from memory
ax run backend "Implement the calculator API"
```

### 2. Multi-Agent Collaboration

Agents can delegate tasks to each other automatically:

```bash
ax run product "Build a complete user authentication feature"
# → Product agent designs the system
# → Automatically delegates implementation to backend agent
# → Automatically delegates security audit to security agent
```

### 3. Cross-Provider Support

AutomatosX supports multiple AI providers with automatic fallback:
- **Claude** (Anthropic) - Primary provider for Claude Code users
- **Gemini** (Google) - Alternative provider
- **OpenAI** (GPT) - Alternative provider

Configuration is in `ax.config.json`.

## Configuration

### Project Configuration

Edit `ax.config.json` to customize:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2
    }
  },
  "execution": {
    "defaultTimeout": 1500000,  // 25 minutes
    "maxRetries": 3
  },
  "memory": {
    "enabled": true,
    "maxEntries": 10000
  }
}
```

### Agent Customization

Create custom agents in `.automatosx/agents/`:

```bash
ax agent create my-agent --template developer --interactive
```

### Workspace Conventions

**IMPORTANT**: AutomatosX uses specific directories for organized file management. Please follow these conventions when working with agents:

- **`automatosx/PRD/`** - Product Requirements Documents, design specs, and planning documents
  - Use for: Architecture designs, feature specs, technical requirements
  - Example: `automatosx/PRD/auth-system-design.md`

- **`automatosx/tmp/`** - Temporary files, scratch work, and intermediate outputs
  - Use for: Draft code, test outputs, temporary analysis
  - Auto-cleaned periodically
  - Example: `automatosx/tmp/draft-api-endpoints.ts`

**Usage in Claude Code**:
```
"Please save the architecture design to automatosx/PRD/user-auth-design.md"
"Put the draft implementation in automatosx/tmp/auth-draft.ts for review"
"Work with ax agent backend to implement the spec in automatosx/PRD/api-spec.md"
```

These directories are automatically created by `ax setup` and included in `.gitignore` appropriately.

## Memory System

### Search Memory

```bash
# Search for past conversations
ax memory search "authentication"
ax memory search "API design"

# List recent memories
ax memory list --limit 10

# Export memory for backup
ax memory export > backup.json
```

### How Memory Works

- **Automatic**: All agent conversations are saved automatically
- **Fast**: SQLite FTS5 full-text search (< 1ms)
- **Local**: 100% private, data never leaves your machine
- **Cost**: $0 (no API calls for memory operations)

## Advanced Usage

### Parallel Execution (v5.6.0+)

Run multiple agents in parallel for faster workflows:

```bash
ax run product "Design authentication system" --parallel
```

### Resumable Runs (v5.3.0+)

For long-running tasks, enable checkpoints:

```bash
ax run backend "Refactor entire codebase" --resumable

# If interrupted, resume with:
ax resume <run-id>

# List all runs
ax runs list
```

### Streaming Output (v5.6.5+)

See real-time output from AI providers:

```bash
ax run backend "Explain this codebase" --streaming
```

### Workflow Templates (v11.0.0+)

For complex multi-step tasks, use workflow templates:

```bash
# Use a predefined workflow template
ax run backend "implement user authentication" --workflow auth-flow

# Available templates in .automatosx/workflows/:
# - auth-flow: Authentication implementation with security review
# - feature-flow: End-to-end feature development
# - api-flow: RESTful API design and implementation
# - refactor-flow: Safe code refactoring

# Workflows auto-enable iterate mode with preconfigured settings
# Custom workflows: .automatosx/workflows/my-workflow.yaml
```

**Note**: `ax spec run/init/create/validate` commands were removed in v11.0.0.
Use `ax gen plan/dag/scaffold/tests` for generation, and `--workflow` flag for execution.

## Troubleshooting

### Common Issues

**"Agent not found"**
```bash
# List available agents
ax list agents

# Make sure agent name is correct
ax run backend "task"  # ✓ Correct
ax run Backend "task"  # ✗ Wrong (case-sensitive)
```

**"Provider not available"**
```bash
# Check system status
ax status

# View configuration
ax config show
```

**"Out of memory"**
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory stats
ax cache stats
```

### Getting Help

```bash
# View command help
ax --help
ax run --help

# Enable debug mode
ax --debug run backend "task"

# Search memory for similar past tasks
ax memory search "similar task"
```

## Best Practices

1. **Use Natural Language in Claude Code**: Let Claude Code coordinate with agents for complex tasks
2. **Leverage Memory**: Reference past decisions and designs
3. **Start Simple**: Test with small tasks before complex workflows
4. **Review Configurations**: Check `ax.config.json` for timeouts and retries
5. **Keep Agents Specialized**: Use the right agent for each task type

## Documentation

- **AutomatosX Docs**: https://github.com/defai-digital/automatosx
- **Agent Directory**: `.automatosx/agents/`
- **Configuration**: `ax.config.json`
- **Memory Database**: `.automatosx/memory/memories.db`
- **Workspace**: `automatosx/PRD/` (planning docs) and `automatosx/tmp/` (temporary files)

## Support

- Issues: https://github.com/defai-digital/automatosx/issues
- NPM: https://www.npmjs.com/package/@defai.digital/automatosx
