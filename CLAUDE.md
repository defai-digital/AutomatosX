# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutomatosX (v7.0.0) is an AI Agent Orchestration Platform that combines declarative YAML workflow specs, policy-driven cost optimization, and persistent memory. It's a production-ready CLI tool that intelligently routes AI requests across multiple providers (Claude, Gemini, OpenAI) based on cost, latency, and policy constraints.

**Key Differentiators:**
- **Spec-Kit**: Define workflows in YAML → Auto-generate plans, DAGs, scaffolds, and tests
- **Policy Router**: Optimize every request for cost/latency/reliability (saves 60-80% on AI costs)
- **Persistent Memory**: SQLite FTS5 full-text search (< 1ms) - perfect context with zero API costs
- **Multi-Agent Orchestration**: 20 specialized agents that delegate tasks autonomously
- **Complete Observability**: JSONL trace logging for every routing decision

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
ax --debug <command>                       # CLI debug mode

# Release workflow
npm run sync:all-versions                  # Sync versions across files
npm version patch                          # Bump version (auto-syncs via hook)
npm run release:check                      # Validate release readiness
```

### Current State (v7.0.0)

- ✅ Production-ready with 2,423+ passing tests
- ✅ Unified setup command (`ax setup` replaces `ax init`)
- ✅ Natural language-first design (slash commands removed)
- ✅ Spec-Kit 100% complete (plans, DAGs, scaffolds, tests)
- ✅ Policy-driven routing with free-tier optimization
- ⚠️ Cost estimation **disabled by default** (v6.5.11+) - enable in config if needed

## Architecture Overview

### Core Flow: YAML Spec → Generation → Policy Routing → Execution → Memory

```
1. YAML Spec (workflow.ax.yaml)
   ↓
2. Spec-Kit Generation (PlanGenerator, DagGenerator, ScaffoldGenerator, TestGenerator)
   ↓
3. Policy Evaluation (PolicyEvaluator filters/scores providers by constraints)
   ↓
4. Router Execution (selects optimal provider, logs decisions, handles fallback)
   ↓
5. Memory Indexing (saves to SQLite FTS5 for future context)
   ↓
6. Trace Logging (JSONL in .automatosx/logs/ for observability)
```

### Key System Components

**1. Router (`src/core/router.ts`)**
- Policy-driven provider selection via `PolicyEvaluator` and `PolicyParser`
- Multi-provider routing with circuit breaker and fallback
- Free-tier prioritization (Gemini 1,500 req/day)
- Workload-aware routing (large tasks → cheaper providers)
- Trace logging (`RouterTraceLogger`) in JSONL format

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
- Abstract base with rate limiting, retry logic, circuit breaker
- Provider name whitelist: `claude`, `claude-code`, `gemini`, `gemini-cli`, `openai`, `codex`
- Availability caching (60s TTL), version detection caching (5min TTL)
- Cost tracking and usage stats

**Implementations:**
- `claude-provider.ts`: CLI-based Claude integration
- `gemini-provider.ts`: CLI-based Gemini integration (lowest cost)
- `openai-provider.ts`: OpenAI with CLI/SDK modes (`AUTOMATOSX_CLI_ONLY` env var controls mode)

**Provider Metadata Registry (`src/core/provider-metadata-registry.ts`)**
- Centralized pricing, latency, free-tier limits
- Used by PolicyEvaluator for constraint-based filtering

**Integration Layer (`src/integrations/`)**
- `claude-code/`: MCP manager, command manager, config manager
- `gemini-cli/`: Command translator, file readers
- `openai-codex/`: CLI wrapper, MCP support

### Configuration System

**Config Loading (`src/core/config.ts`)**
- Merges `automatosx.config.json` (user) + default config
- Generates `src/config.generated.ts` at build time via `tools/prebuild-config.cjs`
- **CRITICAL**: `config.generated.ts` is auto-generated - **never edit manually**

**Config Workflow:**
```bash
# Always regenerate after changing automatosx.config.json
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
- `run`: Execute agent tasks with memory and delegation
- `spec`: Spec-driven workflow execution
- `gen`: Generate plans, DAGs, scaffolds, tests from specs
- `providers`: List providers, show info, view trace logs
- `memory`: Search, add, export memory entries
- `session`: Multi-agent session management
- `agent`: Create/list/show/remove custom agents
- `doctor`: Diagnostic checks for provider setup
- `free-tier`: Check quota status and usage history

## Critical Development Patterns

### 1. Config Generation Workflow

```bash
# NEVER edit src/config.generated.ts directly - changes will be lost!
# After changing automatosx.config.json:
npm run prebuild:config    # Regenerates config.generated.ts
# OR
npm run build              # Calls prebuild:config automatically
```

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

### 5. Resource Management

- Register cleanup handlers for intervals, timers, database connections
- Use `installExitHandlers()` from `utils/process-manager.ts` for subprocess cleanup
- Set busyTimeout (default 5s) for concurrent SQLite access
- Debounce saves to reduce I/O (e.g., SessionManager uses 1s debounce)

### 6. Error Handling

- Use typed errors: `ProviderError`, `SessionError`, `MemoryError`, `SpecError`
- Include error codes for programmatic handling
- Check `shouldRetryError()` from `providers/retry-errors.ts`
- Circuit breaker: Providers have configurable failure thresholds (default 3)

### 7. Performance Optimization

- Cache expensive operations (provider availability, version detection, profiles)
- Use prepared statements for frequent SQLite queries
- Regex patterns should be class-level constants (avoid recreation)
- Debounce I/O operations to reduce syscalls
- Use adaptive caching with TTL adjustment based on access patterns

## File Organization

```
src/
├── agents/          # Agent system (delegation, profiles, templates)
├── cli/             # CLI commands and renderers
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

- `automatosx.config.json`: Main configuration (user-editable)
- `src/config.generated.ts`: Generated TypeScript config (**DO NOT EDIT manually**)
- `tools/prebuild-config.cjs`: Config generator script (runs before build)
- `tools/sync-all-versions.js`: Version sync tool (used in release process)
- `vitest.setup.ts`: Test setup (mocks, globals)
- `vitest.config.ts`: Vitest configuration
- `tsup.config.ts`: Build configuration (tsup with ESM output)

## Testing Notes

- Tests use Vitest with strict isolation (4 max threads, 4 max concurrency)
- `AUTOMATOSX_MOCK_PROVIDERS=true` is set by default in tests
- Global setup: `vitest.setup.ts`, teardown: `vitest.global-teardown.ts`
- Test timeout: 60s per test, 10s for teardown
- Integration tests can be skipped: `SKIP_INTEGRATION_TESTS=true npm test`
- Cleanup in afterEach hooks is **mandatory** to prevent resource leaks

## Type Safety

- Strict TypeScript mode enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- Path aliases: `@/*` → `src/*`, `@tests/*` → `tests/*`
- Generated types: `src/config.generated.ts` built from JSON schema
- Provider types: See `src/types/provider.ts` for core interfaces

## Common Workflows

### Adding a New Provider

1. Create provider class extending `BaseProvider` in `src/providers/`
2. Add provider metadata to `src/core/provider-metadata-registry.ts`
3. Register in router configuration (`automatosx.config.json`)
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
- Changed `automatosx.config.json`? → **Commit** (schema change)
- Just from rebuild? → Check `git diff src/config.generated.ts`
  - Only timestamps/comments changed? → Can skip
  - Types/structure changed? → **Must commit** for type safety

**Good Practice:**
```bash
git diff src/config.generated.ts  # Review changes
# If meaningful changes:
git add src/config.generated.ts
git commit -m "chore: Regenerate config.generated.ts from schema"
```

## Version Management

- Single source of truth: `package.json` version field
- Sync script: `npm run sync:all-versions` updates README.md, CLAUDE.md, config
- Git hooks (Husky): Auto-sync on `npm version`
- Release workflow: `npm version [patch|minor|major]` → auto-sync → commit → tag

## Cost Estimation (v6.5.11+)

**IMPORTANT**: Cost estimation is **disabled by default**.

Users reported pricing changes frequently, making estimates unreliable. Cost estimation can be optionally enabled in `automatosx.config.json`:

```json
{
  "costEstimation": {
    "enabled": false,  // Set to true to enable
    "disclaimer": "Cost estimates are approximate and may be outdated."
  }
}
```

**When disabled (default):**
- Provider metadata returns $0 for all cost fields
- PolicyEvaluator skips cost constraints (always passes)
- PlanGenerator shows "N/A (cost estimation disabled)"
- **Note**: Policy routing still works (selects optimal provider by latency/reliability/privacy)

**When enabled:**
- Full cost tracking and estimation
- Pricing data from Oct 2024 (may be outdated)
- Users should verify current pricing on provider websites

## Performance Considerations

- Router selects providers in < 5ms (with policy evaluation)
- Memory search: < 1ms with FTS5 prepared statements
- Delegation parsing: < 1ms per response (regex-based)
- Provider availability check: Cached for 60s (adaptive TTL)
- Config loading: Lazy with caching (5min TTL for profiles)
- Database: Use prepared statements, avoid COUNT(*) in hot paths

## Security Notes

- Provider names are whitelisted to prevent command injection
- Path validation enabled for file operations (`advanced.security` config)
- Allowed file extensions configurable (default: common dev files)
- No embedding API calls by default (uses FTS5 for search)
- Local-first: All data in `.automatosx/` (never sent to cloud unless via provider)

## Known Constraints

- Node.js >= 20.0.0 required (ES2022 features)
- SQLite must support FTS5 extension (usually built-in)
- Provider CLIs must be installed separately (`gemini`, `claude`, `codex`)
- Max delegation depth: 2 (configurable in `orchestration.delegation.maxDepth`)
- Max concurrent agents: 4 (configurable in `execution.concurrency.maxConcurrentAgents`)
- Memory max entries: 10,000 (auto-cleanup if exceeded)
- Session persistence debounce: 1s (reduces I/O but delays saves)

## Workspace Conventions

AutomatosX uses standardized workspace directories:

- **`automatosx/PRD/`** - Planning and Requirements Documents (committed to git)
  - Use for: Feature specs, architecture docs, project plans
  - Example: `automatosx/PRD/auth-system-design.md`

- **`automatosx/tmp/`** - Temporary Working Files (NOT committed, in .gitignore)
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
- [AX-GUIDE.md](AX-GUIDE.md) - Comprehensive usage guide
- [docs/providers/claude-code.md](docs/providers/claude-code.md) - Claude Code integration
- [docs/providers/gemini.md](docs/providers/gemini.md) - Gemini CLI integration

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

---

# AutomatosX Integration

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

Configuration is in `automatosx.config.json`.

## Configuration

### Project Configuration

Edit `automatosx.config.json` to customize:

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
4. **Review Configurations**: Check `automatosx.config.json` for timeouts and retries
5. **Keep Agents Specialized**: Use the right agent for each task type

## Documentation

- **AutomatosX Docs**: https://github.com/defai-digital/automatosx
- **Agent Directory**: `.automatosx/agents/`
- **Configuration**: `automatosx.config.json`
- **Memory Database**: `.automatosx/memory/memories.db`
- **Workspace**: `automatosx/PRD/` (planning docs) and `automatosx/tmp/` (temporary files)

## Support

- Issues: https://github.com/defai-digital/automatosx/issues
- NPM: https://www.npmjs.com/package/@defai.digital/automatosx
