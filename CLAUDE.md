# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📂 Workspace Conventions (IMPORTANT!)

**When working on AutomatosX development, follow these file organization rules:**

### Development Workspace Directories

- **`automatosx/PRD/`** - Product Requirements Documents, design specs, planning documents
  - Use for: Feature designs, architecture decisions, technical planning
  - Example: `automatosx/PRD/new-feature-design.md`
  - Keep: Long-term planning documents

- **`automatosx/tmp/`** - Temporary files, scratch work, intermediate outputs
  - Use for: Draft code, test outputs, analysis, experimental work
  - Example: `automatosx/tmp/draft-implementation.ts`
  - Note: Auto-cleaned periodically, don't put important files here

- **`docs/`** - User-facing documentation
  - Use for: User guides, API docs, tutorials
  - Example: `docs/guide/getting-started.md`

- **`tests/`** - Test files organized by type
  - `tests/unit/` - Unit tests
  - `tests/integration/` - Integration tests
  - `tests/e2e/` - End-to-end tests
  - `tests/reliability/` - Reliability & chaos tests

### File Organization Rules

1. **Planning & Design** → `automatosx/PRD/`
2. **Temporary/Experimental** → `automatosx/tmp/`
3. **Implementation** → Appropriate `src/` directory
4. **Tests** → Corresponding `tests/` directory
5. **Documentation** → `docs/` directory

## Project Overview

AutomatosX is an AI agent orchestration platform that provides persistent memory, multi-agent collaboration, and cross-provider support (Claude, Gemini, OpenAI). It transforms stateless AI assistants into a collaborative workforce with long-term memory and intelligent delegation.

**Current Version**: v5.8.8 (October 2025)
**Status**: Production Ready
**Language**: TypeScript (ESM modules, strict mode)
**Node**: >=20.0.0

## Essential Commands

### Development
```bash
# Run CLI in dev mode (use for testing changes)
npm run dev -- <command>

# Examples:
npm run dev -- list agents
npm run dev -- run assistant "test task"
```

### Building
```bash
# Build project (auto-runs prebuild:config first)
npm run build

# Generate config.generated.ts from automatosx.config.json
npm run prebuild:config
```

### Tools & Scripts
```bash
# Check shell script syntax
npm run tools:check

# Check for timer leaks (resource cleanup validation)
npm run check:timers

# Check package size before publishing
npm run check:size

# Manual script execution
node tools/sync-all-versions.js     # Sync versions to README/CLAUDE.md
node tools/check-release.js         # Validate release readiness
bash tools/cleanup-prd.sh           # Clean PRD directory
bash tools/cleanup-tmp.sh           # Clean tmp directory
```

### Testing
```bash
# Run all tests (unit + integration + smoke)
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:smoke          # Smoke tests (bash script)
npm run test:all            # All vitest tests (unit + integration + e2e + reliability)

# Development testing
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report

# CI testing
npm run test:ci             # CI-optimized config
npm run test:memory         # With memory profiling
```

### Type Checking & Quality
```bash
# Type check (required before commits)
npm run typecheck

# Check shell scripts
npm run tools:check

# Check timer cleanup (detect leaks)
npm run check:timers
```

### Version Management
```bash
# Sync versions across package.json, README, CLAUDE.md
npm run sync:all-versions

# Bump version (auto-syncs versions)
npm run version:patch
npm run version:minor
npm run version:major
npm run version:beta
npm run version:rc
```

### Commits & Releases
```bash
# Interactive commit (enforces conventional commits)
npm run commit

# Release management (uses standard-version)
npm run release              # Auto-detect version bump
npm run release:patch
npm run release:minor
npm run release:major
npm run release:beta
npm run release:rc
```

## Code Architecture

### Module Structure

```
src/
├── cli/              # CLI interface (yargs-based commands)
│   ├── commands/     # Individual command implementations
│   ├── renderers/    # Output rendering (progress, tables, etc.)
│   └── utils/        # CLI-specific utilities
├── core/             # Core orchestration logic
│   ├── router.ts                      # Provider routing & fallback
│   ├── memory-manager.ts              # SQLite + FTS5 memory
│   ├── stage-execution-controller.ts  # Stage-based execution
│   ├── checkpoint-manager.ts          # Checkpoint persistence
│   ├── session-manager.ts             # Multi-agent sessions
│   ├── workspace-manager.ts           # Workspace operations
│   ├── provider-limit-manager.ts      # Provider quota tracking
│   ├── adaptive-cache.ts              # LRU + frequency-based cache
│   └── spec/                          # Spec-Kit (DAG execution)
│       ├── SpecExecutor.ts            # Execute spec tasks
│       ├── SpecValidator.ts           # Validate spec files
│       ├── SpecGraphBuilder.ts        # Build dependency DAG
│       ├── SpecLoader.ts              # Load .specify/ files
│       ├── SpecGenerator.ts           # Generate specs from NL
│       └── SpecRegistry.ts            # Task state tracking
├── agents/           # Agent system
│   ├── executor.ts              # Agent execution orchestration
│   ├── context-manager.ts       # Context building
│   ├── profile-loader.ts        # Load agent YAML profiles
│   ├── delegation-parser.ts     # @mention delegation parsing
│   ├── parallel-agent-executor.ts  # Parallel delegation execution
│   ├── dependency-graph.ts      # Delegation dependency DAG
│   └── execution-planner.ts     # Execution plan generation
├── providers/        # AI provider integrations
│   ├── base-provider.ts    # Abstract base class
│   ├── claude-provider.ts  # Claude Code integration
│   ├── gemini-provider.ts  # Gemini CLI integration
│   └── openai-provider.ts  # OpenAI CLI integration
├── integrations/     # External tool integrations
│   ├── claude-code/  # Claude Code CLI wrapper
│   └── gemini-cli/   # Gemini CLI wrapper
├── mcp/              # MCP server (for Claude Code)
│   ├── tools/        # MCP tool implementations
│   └── middleware/   # MCP middleware
├── types/            # TypeScript type definitions
├── utils/            # Shared utilities
└── workers/          # Background workers
```

### Key Architecture Patterns

#### 1. Provider Routing System (`src/core/router.ts`)
- **Priority-based routing**: Providers sorted by priority (lower = higher priority)
- **Automatic fallback**: Falls back to next available provider on failure
- **Provider limit tracking**: Detects usage limits, auto-rotates providers
- **Health checks**: Periodic health monitoring with circuit breaker
- **Cache warmup**: Immediate cache warmup on startup to eliminate cold-start latency

#### 2. Memory System (`src/core/memory-manager.ts`)
- **SQLite + FTS5**: Full-text search using SQLite's FTS5 extension (keyword matching)
- **Vector search**: Optional support via `sqlite-vec` extension (disabled by default, available for Plus version)
- **No embeddings required**: Works without external embedding providers (FTS5 mode)
- **Sub-millisecond search**: < 1ms target (optimized prepared statements, static regex for sanitization)
- **LRU eviction**: Smart cleanup with configurable strategies (oldest, least accessed, hybrid)
- **Access tracking**: Tracks access counts for intelligent eviction
- **Auto-cleanup**: Configurable cleanup based on entry count and age

#### 3. Stage Execution System (`src/core/stage-execution-controller.ts`)
- **Stage-based execution**: Break tasks into stages (design → implement → test)
- **Checkpoint persistence**: Save/restore execution state
- **Interactive mode**: User confirmation at checkpoints
- **Progress tracking**: Real-time progress updates via channels
- **Hook system**: Lifecycle hooks (beforeStage, afterStage, onError)

#### 4. Spec-Kit System (`src/core/spec/`)
- **DAG-based execution**: Tasks executed based on dependency graph
- **Cycle detection**: Prevents infinite loops in task dependencies
- **Parallel execution**: Automatically runs independent tasks in parallel
- **Natural language generation**: Generate specs from plain English descriptions
- **Progress persistence**: Save task completion state, resume from checkpoints

#### 5. Multi-Agent Orchestration
- **Agent profiles**: YAML-based profiles in `examples/agents/` or `.automatosx/agents/`
- **Delegation syntax**: Use `@agentName` in responses to delegate to other agents
- **Delegation depth limits**: Configurable `maxDelegationDepth` to prevent infinite loops
- **Session management**: Group related agent tasks into sessions

#### 6. Workspace Conventions
- **PRD path**: `automatosx/PRD/` - Product requirements and design docs
- **Tmp path**: `automatosx/tmp/` - Temporary files (auto-cleanup)
- **Local storage**: `.automatosx/` - Configuration, memory, logs, checkpoints
  - `.automatosx/agents/` - Custom agent profiles
  - `.automatosx/memory/` - SQLite memory database
  - `.automatosx/checkpoints/` - Checkpoint snapshots
  - `.automatosx/sessions/` - Session state
  - `.automatosx/cache/` - Response cache

## Critical Implementation Details

### Configuration System
- **Generated config**: `src/config.generated.ts` is auto-generated from `automatosx.config.json` by `tools/prebuild-config.cjs` (runs before build)
- **Config priority** (highest to lowest):
  1. `.automatosx/config.yaml`
  2. `.automatosx/config.json`
  3. `automatosx.config.yaml`
  4. `automatosx.config.json`
  5. `~/.automatosx/config.yaml`
  6. `~/.automatosx/config.json`
  7. `DEFAULT_CONFIG` (fallback)
- **Runtime config**: User configs merged with defaults using deep merge
- **Config versioning**: `automatosx.config.json` has its own version field (separate from package version)

### Provider Integrations
- **Claude Code**: Subprocess execution via `claude` CLI command (no native streaming, 200K context)
- **Gemini CLI**: Subprocess execution via `gemini` CLI command (no native streaming, 1M context)
- **OpenAI**: Subprocess execution via `codex` CLI command (native streaming support, 128K context)
- **Process management**: All child processes cleaned up on exit via `installExitHandlers()` (fixes hanging tasks in Claude Code)

### Memory Search
- **Query sanitization**: Strip FTS5 special characters, boolean operators, normalize whitespace
- **Prepared statements**: All queries use prepared statements for performance
- **Metadata filters**: Support filtering by agent, task type, timestamp

### Stage Execution
- **Checkpoint format**: JSON snapshots with run ID, timestamp, completed stages, results
- **Resume logic**: Load checkpoint, skip completed stages, continue from next pending stage
- **Interactive prompts**: CLI prompts for user confirmation at checkpoints

### Spec-Kit Integration
- **File structure**: `.specify/` directory contains `spec.md`, `plan.md`, `tasks.md`
- **Task format**: `- [ ] id:task:name ops:"ax run agent 'task'" dep:dep1,dep2`
- **DAG construction**: Parse tasks → build adjacency list → topological sort → detect cycles
- **Parallel execution**: Group tasks by dependency level, execute level in parallel

### Testing Strategy
- **Unit tests**: Individual module testing (`tests/unit/`) - 106 test files
- **Integration tests**: Cross-module workflows (`tests/integration/`)
- **E2E tests**: Complete workflow testing (`tests/e2e/`)
- **Reliability tests**: Chaos, concurrency, load testing (`tests/reliability/`)
- **Smoke tests**: Basic CLI functionality (`tests/smoke/`)
- **Benchmark tests**: Performance regression tracking (`tests/benchmark/`)
- **Coverage target**: ~85% (maintained, not decreased)

## Common Development Tasks

### Adding a New CLI Command
1. Create command file in `src/cli/commands/` (or subdirectory like `src/cli/commands/agent/`)
2. Implement yargs command interface (command, describe, builder, handler)
3. Import and register in `src/cli/index.ts`
4. Add tests:
   - Unit tests: `tests/unit/*-command.test.ts`
   - Integration tests: `tests/integration/*-command.integration.test.ts`

### Adding a New Agent

**Option 1: Using CLI (Recommended)**
```bash
# Create agent from template
ax agent create <name> --template <template-name>

# Available templates in examples/templates/
ax agent create backend --template developer
```

**Option 2: Manual Creation**
1. Create YAML profile in `.automatosx/agents/` (custom) or `examples/agents/` (built-in)
2. Define: name, role, expertise, maxDelegationDepth, timeout
3. Optionally add abilities:
   - Custom abilities: `.automatosx/abilities/` (basePath)
   - Built-in abilities: `examples/abilities/` (fallbackPath)
4. Test with: `ax run <agent-name> "test task"`

### Adding a New Provider
1. Extend `BaseProvider` class in `src/providers/`
2. Implement required abstract members:
   - `get version(): string` - Provider version
   - `get capabilities(): ProviderCapabilities` - Supported features
   - `executeRequest(request)` - Main execution method
   - `generateEmbeddingInternal(text, options)` - Embedding generation
   - `buildCLIArgs(request)` - CLI command arguments
   - `supportsStreaming(): boolean` - Streaming support check
   - `supportsParameter(param)` - Parameter support check
3. Register in `automatosx.config.json` with priority, command, and limits
4. Add tests in `tests/unit/providers.test.ts` or create new provider-specific test file

### Modifying Memory Schema
1. Update schema in `src/core/memory-manager.ts` (table creation in constructor via `db.exec()`)
2. Add migration logic in constructor (version check)
3. Update `MemoryEntry` type in `src/types/memory.ts`
4. Test with: `npm run test:unit -- memory` (runs all memory-related tests)

### Adding Spec-Kit Features
1. Modify relevant module in `src/core/spec/`
2. Update `SpecValidator.ts` if adding new syntax
3. Update task parsing in `SpecLoader.ts` if changing format
4. Add tests in `tests/unit/spec/spec-loader.test.ts` or create new spec test file

## Performance Considerations

### Critical Paths
- **Memory search**: < 1ms target (documented in README - use prepared statements, avoid repeated COUNT(*))
- **Provider routing**: Minimize overhead (cache availability checks with 60s interval, parallel health checks)
- **Checkpoint save/restore**: Optimize I/O (use streaming JSON, avoid large payloads)
- **Config loading**: Cached with 60s TTL (configCache in config.ts, max 10 entries)

### Resource Management
- **Database connections**: Use connection pooling (`src/core/db-connection-pool.ts`)
- **Child processes**: Always cleanup on exit (handled by `process-manager.ts`)
- **Timers**: Clear all timers on module cleanup (checked by `tools/check-timer-cleanup.sh`)
- **Caches**: Use LRU eviction with TTL (adaptive-cache.ts)

### Memory Leaks
- **Event listeners**: Remove listeners on cleanup
- **Database statements**: Finalize prepared statements when done
- **Worker threads**: Terminate workers on exit
- **Streams**: Close streams properly (especially for provider responses)

## Git Workflow

### Commit Convention
- **Format**: `<type>(<scope>): <subject>` (Conventional Commits)
- **Types**: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
- **Scopes**: agents, cli, memory, router, providers, spec, mcp, etc.
- **Enforcement**: Commitizen + commitlint hooks validate all commits
- **Tool**: Use `npm run commit` for guided commits

### Pre-Release Checklist
1. Run `npm run typecheck` (must pass)
2. Run `npm test` (all tests must pass)
3. Run `npm run build` (must succeed)
4. Update CHANGELOG.md (if manual entry needed)
5. Commit changes with conventional commit message
6. Run `npm run version:patch` (or minor/major) - this auto-syncs versions via hook
7. Review changes: `git log --oneline -5` and `git show HEAD`
8. Push with tags: `git push && git push --tags`

## Key Dependencies

### Runtime
- `better-sqlite3`: SQLite bindings (native module)
- `sqlite-vec`: Vector search extension (v0.1.7-alpha.2)
- `yargs`: CLI argument parsing
- `chalk`: Terminal colors
- `ora`: Loading spinners
- `boxen`: Terminal boxes
- `async-mutex`: Async locking primitives

### Development
- `typescript`: Strict mode, ESM target
- `vitest`: Test runner (fast, ESM-native)
- `tsup`: Build tool (fast, minimal config)
- `tsx`: Dev runner (fast, no compilation)
- `husky`: Git hooks (pre-commit, commit-msg)
- `@commitlint/cli` + `@commitlint/config-conventional`: Commit message validation

## Troubleshooting Common Issues

### Build Failures
- Check Node version: `node --version` (must be >= 20.0.0)
- Clean and rebuild: `rm -rf dist && npm run build`
- Check generated config: Ensure `src/config.generated.ts` exists (generated by `prebuild:config`)
- Verify prebuild runs: `npm run prebuild:config` should create `src/config.generated.ts` from `automatosx.config.json`

### Test Failures
- Check SQLite: Ensure `better-sqlite3` native module built correctly
- Check file permissions: Tests may fail if `.automatosx/` not writable
- Check timeouts: Increase timeout in `vitest.config.ts` if needed

### Memory Issues
- Check database locks: Ensure no orphaned SQLite processes
- Check cleanup: Run `npm run check:timers` to detect leaked timers
- Check temp files: Clean `.automatosx/tmp/` manually if needed

### Provider Issues
- Check CLI tools: Ensure `claude`, `gemini`, and `codex` commands available in PATH
- Check limits: Run `ax provider-limits` to see quota status and reset times
- Check health: Provider health checks log to `.automatosx/logs/`
- Test providers: Use `tools/real-provider-test.sh` to test all providers

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

You can interact with AutomatosX agents directly in Claude Code using natural language or slash commands:

**Natural Language (Recommended)**:
```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

**Slash Command**:
```
/ax-agent backend, create a REST API for user management
/ax-agent security, audit the authentication flow
/ax-agent quality, write unit tests for the API
```

### Available Agents

This project includes the following specialized agents:

- **backend** (Bob) - Backend development (Go/Rust/Python systems)
- **frontend** (Frank) - Frontend development (React/Next.js/Swift)
- **fullstack** (Felix) - Full-stack development (Node.js/TypeScript + Python)
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
- **stan** (Peter) - Best practices and code quality expert

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

These directories are automatically created by `ax init` and included in `.gitignore` appropriately.

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

You can interact with AutomatosX agents directly in Claude Code using natural language or slash commands:

**Natural Language (Recommended)**:
```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

**Slash Command**:
```
/ax-agent backend, create a REST API for user management
/ax-agent security, audit the authentication flow
/ax-agent quality, write unit tests for the API
```

### Available Agents

This project includes the following specialized agents:

- **backend** - Backend development (Go/Rust/Python systems)
- **frontend** - Frontend development (React/Next.js/Swift)
- **fullstack** - Full-stack development (Node.js/TypeScript + Python)
- **mobile** - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** - DevOps and infrastructure
- **security** - Security auditing and threat modeling
- **data** - Data engineering and ETL
- **quality** - QA and testing
- **design** - UX/UI design
- **writer** - Technical writing
- **product** - Product management
- **cto** - Technical strategy
- **ceo** - Business leadership
- **researcher** - Research and analysis

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
- Claude (Anthropic)
- Gemini (Google)
- OpenAI (GPT)

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

You can interact with AutomatosX agents directly in Claude Code using natural language or slash commands:

**Natural Language (Recommended)**:
```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

**Slash Command**:
```
/ax-agent backend, create a REST API for user management
/ax-agent security, audit the authentication flow
/ax-agent quality, write unit tests for the API
```

### Available Agents

This project includes the following specialized agents:

- **backend** - Backend development (Go/Rust/Python systems)
- **frontend** - Frontend development (React/Next.js/Swift)
- **fullstack** - Full-stack development (Node.js/TypeScript + Python)
- **mobile** - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** - DevOps and infrastructure
- **security** - Security auditing and threat modeling
- **data** - Data engineering and ETL
- **quality** - QA and testing
- **design** - UX/UI design
- **writer** - Technical writing
- **product** - Product management
- **cto** - Technical strategy
- **ceo** - Business leadership
- **researcher** - Research and analysis

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
- Claude (Anthropic)
- Gemini (Google)
- OpenAI (GPT)

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

You can interact with AutomatosX agents directly in Claude Code using natural language or slash commands:

**Natural Language (Recommended)**:
```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

**Slash Command**:
```
/ax-agent backend, create a REST API for user management
/ax-agent security, audit the authentication flow
/ax-agent quality, write unit tests for the API
```

### Available Agents

This project includes the following specialized agents:

- **backend** - Backend development (Go/Rust/Python systems)
- **frontend** - Frontend development (React/Next.js/Swift)
- **fullstack** - Full-stack development (Node.js/TypeScript + Python)
- **mobile** - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** - DevOps and infrastructure
- **security** - Security auditing and threat modeling
- **data** - Data engineering and ETL
- **quality** - QA and testing
- **design** - UX/UI design
- **writer** - Technical writing
- **product** - Product management
- **cto** - Technical strategy
- **ceo** - Business leadership
- **researcher** - Research and analysis

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
- Claude (Anthropic)
- Gemini (Google)
- OpenAI (GPT)

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
