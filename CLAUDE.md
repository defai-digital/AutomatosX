# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

**IMPORTANT - File Management**:
- Store all temporary files and generated reports in `automatosx/tmp/`
- Store all PRD (Product Requirement Document) files in `automatosx/PRD/`
- Store all project status reports in `automatosx/tmp/`

---

## Project Overview

AutomatosX (v9.2.4) is an AI Agent Orchestration Platform that combines declarative YAML workflow specs, persistent memory, and multi-agent collaboration. It's a production-ready CLI tool that wraps around existing AI provider CLIs (claude, gemini, grok, codex) for seamless orchestration.

**Key Differentiators:**
- **Spec-Kit**: Define workflows in YAML → Auto-generate plans, DAGs, scaffolds, and tests
- **Pure CLI Wrapper**: Wraps around existing `claude`, `gemini`, `grok`, `codex` CLIs for simple integration
- **Persistent Memory**: SQLite FTS5 full-text search (< 1ms) - perfect context with zero API costs
- **Multi-Agent Orchestration**: 20 specialized agents that delegate tasks autonomously
- **Token-Based Budgets**: Reliable budget control using token limits (no more unreliable cost estimates)
- **Complete Observability**: JSONL trace logging for every execution decision
- **AI Assistant Integration**: Works seamlessly with Claude Code, Gemini CLI, Grok CLI, and OpenAI Codex

**Repository**: https://github.com/defai-digital/automatosx

## Quick Reference for Common Tasks

```bash
# Development workflow
npm run dev -- run backend "test task"    # Dev mode with tsx (fastest iteration)
npm run build                              # Full build (includes config generation)
npm test                                   # All tests (unit + integration + smoke)
npm run verify                             # Pre-commit (typecheck + build + unit tests)

# Working with a single test
npx vitest run tests/unit/core/router.test.ts

# Debugging
npm run test:watch                         # Watch mode for TDD
ax --debug <command>                       # CLI debug mode (enables verbose logging)

# Log level control (reduces token usage)
export AUTOMATOSX_LOG_LEVEL=warn          # Default: only warnings and errors
export AUTOMATOSX_LOG_LEVEL=info          # Verbose: shows all initialization logs
export AUTOMATOSX_LOG_LEVEL=error         # Minimal: only errors

# Verbosity control (v8.5.8+ - controls CLI output)
ax run backend "task" --quiet             # Quiet mode (minimal output)
ax run backend "task"                      # Normal mode (default, shows progress)
ax run backend "task" --verbose            # Verbose mode (all details)
export AUTOMATOSX_VERBOSITY=0              # Quiet mode via env var
export AUTOMATOSX_VERBOSITY=1              # Normal mode via env var
export AUTOMATOSX_VERBOSITY=2              # Verbose mode via env var

# Release workflow
npm run sync:all-versions                  # Sync versions across files
npm version patch                          # Bump version (auto-syncs via hook)
npm run release:check                      # Validate release readiness
```

### Current State (v9.2.4)

- ✅ Production-ready orchestration platform
- ✅ 20+ specialized AI agents for different domains
- ✅ Spec-Kit 100% complete (plans, DAGs, scaffolds, tests)
- ✅ Pure CLI wrapper (no API keys needed for CLI mode)
- ✅ Persistent memory with SQLite FTS5 search
- ✅ Multi-provider support (Claude, Gemini, Grok, OpenAI Codex)
- ✅ Token-based budget control (stable and reliable)
- ✅ Natural language integration with AI assistants
- ✅ Enterprise MCP support with lifecycle logging

**Breaking Changes (v9.0.0 - Token-Based Budgets):**
- 🚨 **Cost-Based Tracking Removed**: ~1,200 lines of unreliable cost estimation code removed
- ✅ **Token-Only Budgets**: Use `--iterate-max-tokens` instead of `--iterate-max-cost`
- ✅ **Stable Tracking**: Token counts never change (unlike provider pricing)
- ✅ **Accurate Limits**: Direct from provider API responses, no estimates
- 📖 **Migration Guide**: See `docs/migration/v9-cost-to-tokens.md` for upgrade path
- 🎯 **Zero Maintenance**: No more pricing updates or outdated cost estimates

**Recent Changes (v9.2.4 - Token Budget System):**
- 🎯 **Token-Based Limits**: `--iterate-max-tokens` and `--iterate-max-tokens-per-iteration`
- 📊 **Progressive Warnings**: Alerts at 75% and 90% of token budget
- 🔍 **Real-Time Tracking**: Accurate token usage from provider responses
- ⚡ **Better Control**: Token limits more reliable than cost estimates

**Previous Changes (v8.5.8 - Verbosity Control System):**
- 🎯 **3-Level Verbosity System**: Quiet (AI assistants), Normal (CLI), Verbose (debugging)
- 🤖 **Auto-Quiet Mode**: Automatically detects non-interactive contexts (Claude Code, CI, background)
- 🔇 **60-80% Noise Reduction**: Minimal output for AI assistant integration
- ⚡ **Smart Defaults**: `--quiet` flag, `AUTOMATOSX_VERBOSITY` env var, auto-detection
- 📊 **Enhanced UX**: Execution timing in normal mode, debug summary in verbose mode

## Architecture Overview

### Core Flow: YAML Spec → Generation → CLI Wrapper → Execution → Memory

```
1. YAML Spec (workflow.ax.yaml)
   ↓
2. Spec-Kit Generation (PlanGenerator, DagGenerator, ScaffoldGenerator, TestGenerator)
   ↓
3. Provider CLI Selection (wraps existing claude/gemini/grok/codex commands)
   ↓
4. Execution (runs provider CLI with task, handles output parsing)
   ↓
5. Memory Indexing (saves to SQLite FTS5 for future context)
   ↓
6. Trace Logging (JSONL in .automatosx/logs/ for observability)
```

### Key System Components

**1. Provider CLI Wrappers (`src/integrations/`)**
- Pure CLI wrappers around existing `claude`, `gemini`, `grok`, `codex` commands
- No API keys needed for CLI mode (uses installed provider CLIs)
- Stream parsing and output handling
- Error handling and retry logic
- Trace logging in JSONL format

**2. Memory Manager (`src/core/memory-manager.ts`)**
- SQLite + FTS5 for full-text search (no vector embeddings)
- < 1ms search with prepared statements
- Smart cleanup strategies (oldest/least_accessed/hybrid)
- Debounced persistence (reduces I/O)

**3. Session Manager (`src/core/session-manager.ts`)**
- Multi-agent collaborative sessions with UUID validation
- Atomic saves (temp file + rename pattern)
- Task tracking with metadata size limits (10KB)
- Auto-cleanup of old sessions

**4. Delegation Parser (`src/agents/delegation-parser.ts`)**
- Parses `@agent task` and `DELEGATE TO agent: task` syntax
- < 1ms regex-based parsing (no LLM calls)
- Display name resolution via ProfileLoader

**5. Spec-Kit System (`src/core/spec/`)**
- `SpecLoader.ts`: Loads/validates YAML specs
- `PolicyParser.ts` + `PolicyEvaluator.ts`: Provider selection logic
- `PlanGenerator.ts`: Execution plans with cost estimates
- `DagGenerator.ts`: Dependency graphs with change detection hashes
- `ScaffoldGenerator.ts`: Project structure generation
- `TestGenerator.ts`: Auto-generates unit/integration/E2E tests
- `SpecExecutor.ts`: Orchestrates spec execution

### Provider Architecture

**Base Provider (`src/providers/base-provider.ts`)**
- Abstract base with retry logic and error handling
- Provider name whitelist: `claude`, `claude-code`, `gemini`, `gemini-cli`, `openai`, `codex`
- Availability caching (60s TTL), version detection caching (5min TTL)
- Token usage tracking (accurate from provider responses)

**Implementations:**
- `claude-provider.ts`: CLI-based Claude integration
- `gemini-provider.ts`: CLI-based Gemini integration
- `openai-provider.ts`: OpenAI Codex CLI integration

**Integration Layer (`src/integrations/`)**
- `claude-code/`: MCP manager, command manager, config manager
- `gemini-cli/`: Command translator, file readers, MCP support
- `ax-cli/`: Multi-provider CLI adapter (GLM, xAI, OpenAI, Anthropic, Ollama)
- `openai-codex/`: CLI wrapper, MCP support, AGENTS.md auto-injection, streaming progress

### Configuration System

**Config Loading (`src/core/config.ts`)**
- Merges `ax.config.json` (user) + default config
- Generates `src/config.generated.ts` at build time via `tools/prebuild-config.cjs`
- **CRITICAL**: `config.generated.ts` is auto-generated - **never edit manually**

**Config Workflow:**
```bash
# Always regenerate after changing ax.config.json
npm run prebuild:config    # Regenerates src/config.generated.ts
npm run build              # Also calls prebuild:config automatically
```

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
- Global performance tracking

**Key Commands:**
- `setup`: Initialize .automatosx/ directory with agents and config (v7.0.0)
- `init`: AI-powered initialization with template generation (v7.1.2)
- `cli`: Interactive ChatGPT-style CLI with streaming responses (v7.1.0+)
- `run`: Execute agent tasks with memory and delegation
- `spec`: Spec-driven workflow execution
- `gen`: Generate plans, DAGs, scaffolds, tests from specs
- `providers`: List providers, show info, view trace logs
- `memory`: Search, add, export memory entries
- `session`: Multi-agent session management
- `agent`: Create/list/show/remove custom agents
- `doctor`: Diagnostic checks for provider setup
- `free-tier`: Check quota status and usage history

**Command: `ax setup` (v7.0.0+)**
Replaces the old `ax init` command. Sets up the AutomatosX workspace:
```bash
ax setup           # Initialize .automatosx/ with agents and config
ax setup -f        # Force reinitialize (removes existing .automatosx/)
```

**What it does:**
- Creates `.automatosx/` directory structure
- Installs all 20 specialized agents
- Generates `ax.config.json` with optimal defaults
- Initializes SQLite memory database
- Sets up session management and trace logging

**Command: `ax init` (v7.1.2+)**
AI-powered initialization with intelligent project detection:
```bash
ax init                    # Interactive mode with AI analysis
ax init --template react   # Use specific template
ax init --force            # Reinitialize existing setup
```

**What it does:**
- Analyzes existing project structure using AI
- Detects framework, language, build tools automatically
- Generates tailored `AX.md` file for AI assistant integration
- Creates project-specific agent configurations
- Suggests optimal AutomatosX setup for your project

### AI Assistant Integration

AutomatosX is designed to work seamlessly with your preferred AI assistant:

**Supported Assistants:**
- **Claude Code** - Primary integration with MCP support
- **Gemini CLI** - Google's CLI with natural language support and MCP
- **Grok CLI** - xAI's CLI with project instructions and user settings
- **OpenAI Codex** - OpenAI's development assistant with AGENTS.md auto-injection

**How It Works:**
1. You interact with your AI assistant (Claude Code, Gemini CLI, etc.)
2. The AI assistant invokes AutomatosX agents via CLI commands
3. AutomatosX orchestrates multi-agent workflows and manages memory
4. Results are returned to your AI assistant for natural conversation

**Example Workflow (via Claude Code):**
```
User: "Please work with ax agent backend to implement user authentication"
Claude Code: Executes `ax run backend "implement user authentication"`
AutomatosX: Routes to optimal provider, executes agent, saves to memory
Claude Code: Displays results and continues conversation
```

**Benefits:**
- ✅ Use familiar AI interface you already know
- ✅ No new commands or syntax to learn
- ✅ Best-in-class AI conversation experience
- ✅ AutomatosX focuses on orchestration, not UI

## Controlling Output Verbosity (v8.5.8+)

AutomatosX provides three verbosity levels for different use cases, with automatic detection for non-interactive contexts.

### Quiet Mode (Level 0) - For AI Assistants

**Use When**: Running through Claude Code, background processes, CI environments

```bash
ax run backend "task" --quiet
# OR
ax run backend "task" -q
# OR
export AUTOMATOSX_VERBOSITY=0
ax run backend "task"
```

**What's Shown**:
- Only errors and final results
- No banners, spinners, or progress indicators
- Minimal whitespace for clean output

**Auto-Enabled When**:
- No TTY attached (piped output, background processes)
- `CI=true` environment variable
- `--iterate` or `--auto-continue` flags active

**Perfect For**: AI assistant integration, automated scripts, log file generation

### Normal Mode (Level 1) - Default for CLI

**Use When**: Interactive terminal sessions, direct CLI use

```bash
ax run backend "task"
# OR
export AUTOMATOSX_VERBOSITY=1
ax run backend "task"
```

**What's Shown**:
- Welcome banner
- Progress spinner ("Working...")
- Final result with execution time
- Completion message

**What's Hidden**:
- Complexity analysis
- Provider details
- Debug information

**Perfect For**: Daily development workflows, manual testing

### Verbose Mode (Level 2) - For Debugging

**Use When**: Troubleshooting issues, debugging workflows

```bash
ax run backend "task" --verbose
# OR
ax run backend "task" -v
# OR
export AUTOMATOSX_VERBOSITY=2
ax run backend "task"
```

**What's Shown**:
- Everything from Normal mode
- Complexity analysis for tasks
- Provider selection details
- Agent name resolution
- Memory status
- Execution summary with timing

**Perfect For**: Debugging, understanding system behavior, performance analysis

### Verbosity Priority Order

When multiple flags are set, this priority order applies:

1. `--verbosity=N` flag (highest priority)
2. `--quiet` or `--verbose` flags
3. `AUTOMATOSX_VERBOSITY` environment variable
4. Auto-detection (based on TTY, CI, iterate mode)
5. Default (Normal mode for interactive, Quiet for non-interactive)

### Examples

```bash
# Quiet mode for Claude Code integration (automatic)
# Claude Code runs without TTY → auto-quiet mode
ax run backend "implement auth"

# Explicit quiet mode for scripts
ax run backend "analyze code" --quiet > report.txt

# Normal mode for development (default in terminal)
ax run backend "refactor module"
# Output: Banner + "Working..." + result + "Complete (5.2s)"

# Verbose mode for debugging
ax run backend "debug issue" --verbose
# Output: All details including complexity, provider, timing

# Override auto-detection
AUTOMATOSX_VERBOSITY=1 ax run backend "task"  # Force normal mode even in CI
```

### Backward Compatibility

**Preserved**:
- `--verbose` flag still works (maps to level 2)
- `AUTOMATOSX_LOG_LEVEL` still controls internal logger (separate system)
- All existing commands work unchanged

**Breaking Change**:
- Non-interactive contexts (no TTY) now default to quiet mode instead of normal mode
- To restore old behavior: `export AUTOMATOSX_VERBOSITY=1`

## Critical Development Patterns

### 1. Config Generation Workflow

```bash
# NEVER edit src/config.generated.ts directly - changes will be lost!
# After changing ax.config.json:
npm run prebuild:config    # Regenerates config.generated.ts
# OR
npm run build              # Calls prebuild:config automatically
```

**IMPORTANT - When to Commit config.generated.ts:**

After running `npm run build`, you may see `src/config.generated.ts` modified in git. Use this decision guide:

1. **Check what changed:**
   ```bash
   git diff src/config.generated.ts
   ```

2. **If only timestamps/comments changed:**
   - These are cosmetic changes from the build process
   - You can skip committing (run `git restore src/config.generated.ts`)

3. **If types or structure changed:**
   - This means `ax.config.json` schema was updated
   - **YOU MUST COMMIT** to keep type safety in sync
   ```bash
   git add src/config.generated.ts
   git commit -m "chore: regenerate config.generated.ts from updated schema"
   ```

4. **When in doubt:**
   - Commit it. It's safer to have the generated file in sync than risk type mismatches.

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

**Important Test Setup Notes:**
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

// Safe parsing (returns success/failure)
const result = ProviderResponseSchema.safeParse(rawResponse);
if (!result.success) {
  logger.error('Invalid provider response', { error: result.error });
  throw new ProviderError('Invalid response format');
}
const validated = result.data; // Type-safe!

// ❌ Never trust external data without validation
// const data = JSON.parse(rawData); // Unsafe! No runtime validation
```

**When to Use Zod:**
- External API responses (provider APIs, MCP)
- User configuration files (ax.config.json)
- CLI arguments and environment variables
- YAML spec file parsing
- Any data from files, network, or user input

**Benefits:**
- Runtime type safety (TypeScript only validates at compile-time)
- Better error messages with detailed validation failures
- Type inference (schema → TypeScript types automatically)
- Single source of truth for both validation and types

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

### 8. Performance Optimization

- Cache expensive operations (provider availability, version detection, profiles)
- Use prepared statements for frequent SQLite queries
- Regex patterns should be class-level constants (avoid recreation)
- Debounce I/O operations to reduce syscalls
- Use adaptive caching with TTL adjustment based on access patterns

### 9. Agent Profile Instructions (v8.4.15 Critical Insight)

**CRITICAL**: Keep agent system prompts simple - **NEVER mention sandboxes, permissions, or constraints**.

**Why This Matters**:
When you tell AI agents about sandboxes or restrictions (even to "ignore" them), you trigger unintended behavior:
- Agents become aware of constraints as a concept
- They check for sandbox/read-only mode preemptively
- They refuse operations based on assumptions, not reality
- They report "environment is read-only" without attempting operations

**The v8.4.15 Discovery**:
- **v8.4.12**: Agents hung indefinitely waiting for permission in background mode
- **v8.4.13**: Added instructions telling agents NOT to ask for permission → Fixed hanging ✓
- **v8.4.14**: Added "IGNORE sandbox restrictions - you have full write access" → Agents refused to write (checked for sandbox preemptively) ✗
- **v8.4.15**: Examined v7.6.1 (which worked perfectly) and discovered it had NO sandbox mentions at all!

**Correct Approach** (v8.4.15 - Like v7.6.1):
```yaml
**CRITICAL - Non-Interactive Mode Behavior**:
When running in non-interactive mode or background mode, proceed automatically without asking for permission or confirmation.

- Execute tasks directly without prompting
- If you cannot complete a task, explain why and provide workarounds
- NEVER output messages like "need to know if you want me to proceed"
```

**What This Does**:
1. ✅ Prevents hanging (agents don't ask for permission)
2. ✅ Agents attempt operations naturally
3. ✅ OS-level restrictions are hit organically and reported clearly
4. ✅ No premature "read-only environment" refusals
5. ✅ Better error messages with actual OS errors, not assumptions

**Key Lesson**: Sometimes the best fix is to REMOVE complexity, not add more. Let the environment enforce restrictions naturally - don't pre-program AI to assume them.

**Reference**: See `automatosx/tmp/V8.4.15-SOLUTION-SUMMARY.md` for detailed problem journey and test results.

## File Organization

```
src/
├── agents/          # Agent system (delegation, profiles, templates)
├── cli/             # CLI commands and renderers
│   ├── commands/    # Individual command implementations
│   │   ├── setup.ts     # Setup command (v7.0.0)
│   │   ├── init.ts      # AI-powered init (v7.1.2)
│   │   └── run.ts       # Agent execution
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

### Documentation (Root)
- `README.md`: User-facing documentation
- `CLAUDE.md`: This file - development guidance for Claude Code
- `AGENTS.md`: Agent integration guide following open standard
- `GEMINI.md`: Gemini CLI integration guide
- `AX.md`: AutomatosX integration template (generated by `ax init`)

### Build System Notes

**tsup.config.ts** - Critical externals configuration:
- Native modules: `better-sqlite3`, `sqlite-vec` (must be external)
- Interactive CLI: `marked`, `marked-terminal`, `cardinal`, `cli-highlight` (dynamic requires)
- Terminal UI: `chalk`, `ora`, `boxen`, `cli-table3`, `inquirer` (ANSI codes, TTY)
- Other: `yargs`, `find-up`, `js-yaml`, `mustache`, `openai`

**Why externals matter**: Bundling these would break dynamic requires, native code, or TTY interactions. Keep them external!

## Testing Notes

- Tests use Vitest with strict isolation (4 max threads, 4 max concurrency)
- `AX_MOCK_PROVIDERS=true` is set by default in tests
- Global setup: `vitest.setup.ts`, teardown: `vitest.global-teardown.ts`
- Test timeout: 60s per test, 10s for teardown
- Integration tests can be skipped: `SKIP_INTEGRATION_TESTS=true npm test`
- Cleanup in afterEach hooks is **mandatory** to prevent resource leaks
- **v5.7.0+**: Tests manage their own timers (no global fake timers)
- 95%+ test coverage with TypeScript strict mode
- Core orchestration features have comprehensive test coverage

## Type Safety

- Strict TypeScript mode enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- Path aliases: `@/*` → `src/*`, `@tests/*` → `tests/*`
- Generated types: `src/config.generated.ts` built from JSON schema
- Provider types: See `src/types/provider.ts` for core interfaces
- **Runtime validation**: Use Zod for validating external inputs, API responses, and configuration

### When to Use Zod

**ALWAYS use Zod for:**
- Validating external API responses (provider APIs, MCP responses)
- Parsing user configuration files (ax.config.json, agent profiles)
- Validating CLI arguments and options
- Parsing YAML spec files (workflow.ax.yaml)
- Validating environment variables
- Any data from external sources (files, network, user input)

**Example - Validating Provider Response:**
```typescript
import { z } from 'zod';

const ProviderResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number()
  }).optional()
});

// Parse and validate
const result = ProviderResponseSchema.safeParse(rawResponse);
if (!result.success) {
  throw new ProviderError(`Invalid response: ${result.error.message}`);
}
const validated = result.data; // Type-safe!
```

**Example - Validating Configuration:**
```typescript
const ConfigSchema = z.object({
  providers: z.record(z.object({
    enabled: z.boolean(),
    priority: z.number().min(1),
    timeout: z.number().optional()
  })),
  execution: z.object({
    maxConcurrentAgents: z.number().min(1).max(10)
  })
});

const config = ConfigSchema.parse(rawConfig); // Throws on invalid
```

**Why Zod?**
- TypeScript types are compile-time only - they disappear at runtime
- Zod validates at runtime AND provides TypeScript types
- Prevents runtime errors from malformed data
- Better error messages for debugging
- Type inference from schemas (single source of truth)

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

### Using AutomatosX with AI Assistants

**Via Claude Code (Recommended):**
```
User: "Please work with ax backend agent to implement user authentication"
Claude Code: Executes ax run backend "implement user authentication"
AutomatosX: Orchestrates task, uses memory, returns results
```

**Via Gemini CLI:**
```bash
gemini "Ask ax to help design the database schema"
# Gemini invokes: ax run backend "design database schema"
```

**Direct CLI Usage:**
```bash
ax run backend "implement user authentication"
ax memory search "authentication"
ax session create "auth-work" backend security
ax spec run workflow.ax.yaml
```

## Git Workflow & Handling Generated Files

**Commit Message Format**: Conventional Commits (feat/fix/chore/docs)
**Husky Hooks**: Pre-commit linting, commit-msg validation

### When You See Modified Files After Build

```bash
# Common scenario after npm run build:
M  src/config.generated.ts    # Auto-generated
M  package-lock.json           # Dependency changes
```

**Decision Guide for `src/config.generated.ts`:**
- Changed `ax.config.json`? → **Commit** (schema change)
- Just from rebuild? → Check `git diff src/config.generated.ts`
  - Only timestamps/comments changed? → Can skip
  - Types/structure changed? → **Must commit** for type safety

**Good Practice:**
```bash
git diff src/config.generated.ts  # Review changes
# If meaningful changes:
git add src/config.generated.ts
git commit -m "chore: regenerate config.generated.ts from schema"
```

## Version Management

- Single source of truth: `package.json` version field
- Sync script: `npm run sync:all-versions` updates README.md, CLAUDE.md, config
- Git hooks (Husky): Auto-sync on `npm version`
- Release workflow: `npm version [patch|minor|major]` → auto-sync → commit → tag

## Token-Based Budget Control (v9.0.0+)

**BREAKING CHANGE**: Cost estimation has been **completely removed** in v9.0.0.

AutomatosX now uses **token-based budgets** for reliable resource control:

```bash
# Token-based limits (NEW - v9.0.0+)
ax run backend "task" --iterate-max-tokens 1000000
ax run backend "task" --iterate-max-tokens-per-iteration 100000

# Old cost-based flags REMOVED in v9.0.0:
# ❌ --iterate-max-cost (removed)
# ❌ maxEstimatedCostUsd (removed from config)
```

**Why Token-Based?**
- ✅ **Stable**: Token counts never change (unlike provider pricing)
- ✅ **Accurate**: Direct from provider API responses, no estimates
- ✅ **Zero Maintenance**: No pricing updates needed
- ✅ **Predictable**: Budget limits that actually work

**Migration:**
- See `docs/migration/v9-cost-to-tokens.md` for complete migration guide
- Replace `--iterate-max-cost 5.0` with `--iterate-max-tokens 1000000`
- Update config: `maxEstimatedCostUsd` → `maxTotalTokens`
- Calculate costs manually if needed: `tokens * price_per_1M_tokens`

**Token Budget Features:**
- Progressive warnings at 75% and 90% of budget
- Real-time tracking from provider responses
- Per-iteration and total token counters
- Automatic pause when limit exceeded

## Performance Considerations

- Provider CLI execution: Depends on underlying CLI performance
- Memory search: < 1ms with FTS5 prepared statements
- Delegation parsing: < 1ms per response (regex-based)
- Provider availability check: Cached for 60s (adaptive TTL)
- Config loading: Lazy with caching (5min TTL for profiles)
- Database: Use prepared statements, avoid COUNT(*) in hot paths
- Token tracking overhead: < 1ms per iteration

## Security Notes

- Provider names are whitelisted to prevent command injection
- Path validation enabled for file operations (`advanced.security` config)
- Allowed file extensions configurable (default: common dev files)
- No embedding API calls by default (uses FTS5 for search)
- Local-first: All data in `.automatosx/` (never sent to cloud unless via provider)

## Known Constraints

- Node.js >= 24.0.0 required (ES2022 features)
- SQLite must support FTS5 extension (usually built-in)
- Provider CLIs must be installed separately (`claude`, `gemini`, `grok`, `codex`)
- Max delegation depth: 2 (configurable in `orchestration.delegation.maxDepth`)
- Max concurrent agents: 4 (configurable in `execution.concurrency.maxConcurrentAgents`)
- Memory max entries: 10,000 (auto-cleanup if exceeded)
- Session persistence debounce: 1s (reduces I/O but delays saves)
- Token budgets enforced via `maxTotalTokens` and `maxTokensPerIteration`

## Workspace Conventions

AutomatosX uses standardized workspace directories:

- **`automatosx/PRD/`** - Planning and Requirements Documents (in .gitignore)
  - Use for: Feature specs, architecture docs, project plans
  - Example: `automatosx/PRD/auth-system-design.md`
  - **Note**: Excluded from git to keep internal planning private

- **`automatosx/tmp/`** - Temporary Working Files (in .gitignore)
  - Use for: Draft implementations, experimental code, temporary analysis
  - Auto-cleaned periodically
  - Example: `automatosx/tmp/draft-implementation.ts`

## Documentation Structure

When referencing documentation, use organized locations:

- **Getting Started**: `docs/getting-started/` - Installation, quick start, core concepts
- **Guides**: `docs/guides/` - Feature guides (agents, memory, orchestration, specs)
- **Reference**: `docs/reference/` - CLI commands and API reference
- **Providers**: `docs/providers/` - Provider-specific setup and configuration
- **Advanced**: `docs/advanced/` - Performance, caching, parallel execution
- **Platform**: `docs/platform/` - Platform-specific guides (Windows, macOS, Linux)

## Working with AutomatosX as a User

When using AutomatosX via Claude Code (or other AI assistants), prefer natural language:

**Natural Language (Recommended)**:
```
"Please use ax to implement user authentication"
"Ask ax to audit this code for vulnerabilities"
"Have ax write tests for this feature"
```

**Direct CLI Usage**:
```bash
ax run backend "implement user authentication"
ax memory search "authentication"
ax providers trace --follow
```

**Integration Guides:**
- [AGENTS.md](AGENTS.md) - Open standard for AI agent integration
- [GEMINI.md](GEMINI.md) - Gemini CLI integration guide
- [AX.md](AX.md) - Project-specific AutomatosX integration (generated by `ax init`)
- [docs/providers/claude-code.md](docs/providers/claude-code.md) - Claude Code integration

For end-user documentation, see [README.md](README.md) and the `docs/` directory. This CLAUDE.md focuses on development guidance.

### Working with AutomatosX Agents (IMPORTANT!)

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

**Example of Correct Workflow**:
```bash
# Start agent
ax run quality "Review the fix in provider-bridge.ts"

# Wait patiently (estimates may say 900s, but actual ~68s)
# Check output periodically with BashOutput
# Let agent complete naturally
# ✅ Agent completes in ~68 seconds
```

**Common Mistake** (DO NOT DO THIS):
```bash
# Start agent
ax run quality "task"
# See estimate: 948 seconds
# Think: "That's too long, let me kill it!"
# ❌ Try to kill after 60s
# Agent was already completing successfully!
```

**Why**: AutomatosX provides conservative time estimates for safety. Actual execution is usually 10-20% of the estimate. The system has built-in timeout handling - trust it!

### Working with `ax setup` (IMPORTANT!)

The `ax setup` command initializes the AutomatosX workspace. **DO NOT interrupt it prematurely**!

**Critical Rules**:
1. **Be patient**: Setup typically takes 30-90 seconds (may show conservative estimates)
2. **Let it complete**: Setup creates directories, agent profiles, and configuration
3. **Check for completion**: Wait for the success message before proceeding
4. **Only interrupt if stuck**: No output for 5+ minutes = stuck

**Typical Setup Duration**: 30-90 seconds

**Example of Correct Workflow**:
```bash
# Start setup
ax setup

# Wait patiently (may show conservative estimate)
# Let setup complete naturally
# ✅ Setup completes with success message
```

**Common Mistake** (DO NOT DO THIS):
```bash
# Start setup
ax setup
# See it creating files...
# Think: "Is it stuck?"
# ❌ Interrupt after 30 seconds
# Setup was still creating agent profiles!
```

**Why**: Setup involves multiple steps (directory creation, template installation, config generation). Each step is logged - trust the process!

### Working with Provider CLIs Directly (IMPORTANT!)

When running `claude`, `gemini`, or `codex` CLI commands directly, **DO NOT interrupt prematurely**!

**Critical Rules**:
1. **Be patient**: Provider CLIs can take 60-300 seconds for complex tasks
2. **Check streaming output**: Look for gradual progress, not silence
3. **Wait for completion marker**: Each provider signals when done
4. **Only kill if truly stuck**: No output for 5+ minutes = stuck

**Typical CLI Durations**:
- Simple queries: 10-30 seconds
- Code generation: 30-120 seconds
- Complex analysis: 60-300 seconds
- Multi-step tasks: 120-600 seconds

**Example of Correct Workflow**:
```bash
# Start provider CLI
claude "Analyze this codebase and suggest improvements"

# Wait patiently for streaming output
# Provider sends incremental responses
# ✅ Completes with final response
```

**Common Mistake** (DO NOT DO THIS):
```bash
# Start provider
gemini "Complex task..."
# See first response chunk...
# Think: "It's taking too long!"
# ❌ Kill after 60 seconds
# Provider was streaming a comprehensive response!
```

**Why**: Provider CLIs stream responses incrementally. A 200-line response might take 2-3 minutes to fully stream. The CLI handles timeouts automatically - trust it!

### Background Agent Notifications (v8.5.0+)

AutomatosX automatically creates status files when agents complete, enabling efficient notification without polling.

**How It Works**:
When you run an agent in the background, AutomatosX writes a status file to `.automatosx/status/` upon completion. This allows Claude Code (or other AI assistants) to be notified when background agents finish, eliminating the need for manual polling.

**Status File Format**:
```json
{
  "agent": "backend",
  "status": "completed",
  "timestamp": "2025-11-18T15:11:37.508Z",
  "pid": 8113,
  "duration": 13096,
  "task": "implement user authentication",
  "provider": "gemini-cli"
}
```

**Usage Pattern** (recommended for background agents):

```typescript
// Example: Running agent in background with automatic notification
// The status file will be created automatically when the agent completes

// Start background agent
await Bash({
  command: 'ax run quality "analyze code quality"',
  run_in_background: true
});

// Status file will be written to:
// .automatosx/status/quality-{timestamp}.json
//
// You can check for this file periodically or use fs.watch()
// to detect when it appears (future BackgroundAgentMonitor integration)
```

**Benefits**:
- No manual polling required
- < 5ms overhead per agent execution
- Automatic file creation (no configuration needed)
- Non-blocking async operation
- Works with all agents and providers

**Implementation Details** (src/cli/commands/run.ts:1037-1046):
- Status writing integrated at run.ts:1037-1046 (success path)
- Status writing integrated at run.ts:1105-1115 (failure path)
- Status files are automatically cleaned up after processing
- Files stored in `.automatosx/status/` directory
- Filename pattern: `{agentName}-{timestamp}.json`

**Note**: This feature is automatically enabled for all agent executions. Status files are created regardless of task success/failure, allowing you to track agent completion.

### Polling Background Agents (CRITICAL GUIDANCE)

When monitoring background agents with `BashOutput`, **DO NOT poll excessively**! Follow exponential backoff to reduce API calls and noise.

**❌ BAD: Excessive Polling (Every 3-5 seconds)**
```
⏺ BashOutput - 0s
⏺ BashOutput - 3s
⏺ BashOutput - 6s
⏺ BashOutput - 9s
... (13 polls in 45 seconds!)
```
**Problems**: Wasteful API calls, noisy output, poor user experience

**✅ GOOD: Exponential Backoff (Smart intervals)**
```
⏺ Start agent in background
⏺ Wait 30s (let agent initialize)
⏺ BashOutput - check 1 (30s)
⏺ Wait 15s
⏺ BashOutput - check 2 (45s)
⏺ Wait 20s
⏺ BashOutput - check 3 (65s)
✅ Agent completes (68s)
```
**Benefits**: 3 polls vs 13, cleaner output, efficient

**Polling Strategy - Exponential Backoff**:
```
First wait:  30 seconds (let agent start)
Check 1:     30s total
Wait:        +15s
Check 2:     45s total
Wait:        +20s
Check 3:     65s total
Wait:        +30s
Check 4+:    Every 30s thereafter
```

**When to Use Each Approach**:

1. **BackgroundAgentMonitor** (BEST - Zero Polling):
   ```typescript
   import { BackgroundAgentMonitor } from './core/background-agent-monitor.js';

   const monitor = new BackgroundAgentMonitor();
   const status = await monitor.watchAgent('writer');
   // Automatic notification via file watching (10-50ms latency)
   ```

2. **SmartPoller** (GOOD - Exponential Backoff):
   ```typescript
   import { SmartPoller } from './utils/smart-poller.js';

   const poller = new SmartPoller();
   const result = await poller.poll(async () => {
     const output = await BashOutput({ bash_id: shellId });
     return output.status === 'completed' ? output : null;
   });
   ```

3. **Manual Polling** (ACCEPTABLE - If necessary):
   - Initial wait: 30 seconds minimum
   - Subsequent checks: Every 15-30 seconds
   - Max frequency: 1 check per 15 seconds
   - Stop after: 5 minutes of no progress

**Key Principles**:
- **Trust the timeout system**: Agents have built-in timeouts (default 120 minutes)
- **Be patient**: Wait 30-60s before first check
- **Reduce noise**: Don't show every poll to user
- **Use file notification when possible**: BackgroundAgentMonitor eliminates polling
- **Only poll if needed**: For tasks <60s, just wait for completion

**Example - Using BackgroundAgentMonitor**:
```typescript
import { BackgroundAgentMonitor } from './core/background-agent-monitor.js';

// Start agent
await Bash({
  command: 'ax run writer "task"',
  run_in_background: true
});

// Use file-based notification (no polling!)
const monitor = new BackgroundAgentMonitor();
await monitor.watchAgent('writer', (status) => {
  console.log(`✅ ${status.agent} completed in ${status.duration}ms`);
});

// Agent completes → Status file created → Instant notification
```

**Anti-Patterns to Avoid**:
- ❌ Polling every 3-5 seconds
- ❌ Checking more than 4 times in first 2 minutes
- ❌ Showing every poll result to user
- ❌ Assuming agent is stuck before 5 minutes
- ❌ Not using BackgroundAgentMonitor when available

---

## Major Milestones

### v9.0.0 - Token-Based Budgets (2025-11-18)

**BREAKING CHANGE**: Cost estimation completely removed, replaced with token-based budgets

**What Changed**:
- 🚨 **Removed Cost Tracking**: ~1,200 lines of unreliable cost estimation code deleted
- ✅ **Token-Only Budgets**: `--iterate-max-tokens` replaces `--iterate-max-cost`
- ✅ **Stable Tracking**: Token counts never change (unlike provider pricing)
- ✅ **Accurate Limits**: Direct from provider API responses, no estimates
- ✅ **Zero Maintenance**: No more pricing updates needed
- 📖 **Migration Guide**: `docs/migration/v9-cost-to-tokens.md` provides upgrade path

**Breaking Changes**:
- ❌ `--iterate-max-cost` flag removed (use `--iterate-max-tokens`)
- ❌ `maxEstimatedCostUsd` config removed (use `maxTotalTokens`)
- ❌ `cost_limit_exceeded` pause reason removed (use `token_limit_exceeded`)
- ❌ `enableCostTracking` config removed
- ❌ `warnAtCostPercent` config removed
- ❌ CostTracker class and all cost estimation infrastructure removed

**What Remains**:
- ✅ All core CLI commands (ax run, ax memory, ax session, etc.)
- ✅ 20+ specialized agents with persistent memory
- ✅ Pure CLI wrapper architecture (simple integration)
- ✅ Spec-Kit workflow system
- ✅ Multi-provider support (Claude, Gemini, Grok, Codex)
- ✅ Complete observability and tracing
- ✅ Enterprise MCP support

**Migration**:
```bash
# Old (v8.x)
ax run backend "task" --iterate-max-cost 5.0

# New (v9.0+)
ax run backend "task" --iterate-max-tokens 1000000
```

**Why This Change**:
Provider pricing changes frequently and unpredictably, making cost estimates unreliable and confusing. Token-based budgets are stable, accurate, and require zero maintenance. Users can calculate costs manually if needed using current provider pricing.

### v8.2.0 - Streamlined for AI Assistant Integration

**Major Change**: Removed standalone chatbot interface to focus on core orchestration

**What Changed**:
- 🔄 Removed `ax cli` interactive mode (~25,000 lines of code)
- ✅ Focused on AI assistant integration (Claude Code, Gemini CLI, Grok, Codex)
- ✅ Simplified UX - use familiar AI tools instead of learning new CLI
- ✅ Reduced maintenance burden and complexity
- ✅ Better separation of concerns: AutomatosX = orchestration, AI assistants = UI

**What Remains**:
- ✅ All core CLI commands (ax run, ax memory, ax session, etc.)
- ✅ 20+ specialized agents with persistent memory
- ✅ Pure CLI wrapper (no API keys needed)
- ✅ Spec-Kit workflow system
- ✅ Multi-provider support with fallback
- ✅ Complete observability and tracing

**Migration**: See `MIGRATION.md` for guidance on transitioning from v7.x

**Why This Change**:
Users preferred using Claude Code, Gemini CLI, Grok, or Codex for conversations. The standalone chatbot duplicated functionality and added complexity. By removing it, AutomatosX becomes a pure orchestration platform that works **with** AI assistants rather than trying to replace them.

---

For support, see [GitHub Issues](https://github.com/defai-digital/automatosx/issues) or email <support@defai.digital>.

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

### Spec-Driven Development (v5.8.0+)

For complex projects, use spec-driven workflows:

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Or manually define in .specify/tasks.md
ax spec run --parallel

# Check progress
ax spec status
```

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

### Spec-Driven Development (v5.8.0+)

For complex projects, use spec-driven workflows:

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Or manually define in .specify/tasks.md
ax spec run --parallel

# Check progress
ax spec status
```

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

### Spec-Driven Development (v5.8.0+)

For complex projects, use spec-driven workflows:

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Or manually define in .specify/tasks.md
ax spec run --parallel

# Check progress
ax spec status
```

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
