# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutomatosX is an AI Agent Orchestration Platform that combines declarative workflow specs, policy-driven cost optimization, and persistent memory. It's a production-ready CLI tool (v6.5.10) that routes AI requests across multiple providers (Claude, Gemini, OpenAI) based on cost, latency, and policy constraints.

**Key Capabilities:**

- **Spec-Kit Integration**: YAML-driven workflow generation (plans, DAGs, scaffolds, tests)
- **Policy-Driven Routing**: Automatic provider selection based on cost/latency/privacy constraints
- **Persistent Memory**: SQLite + FTS5 for full-text search with no embedding dependencies
- **Multi-Agent Orchestration**: 20 specialized agents with delegation parsing
- **Cost Optimization**: 60-80% cost reduction through intelligent routing and free-tier utilization

**Repository**: https://github.com/defai-digital/automatosx
**Main Branch**: main

## Build & Development Commands

### Essential Commands

```bash
# Development
npm run dev -- run backend "test task"    # Run CLI in dev mode with tsx
npm run build                              # Build with tsup (includes prebuild:config)
npm run prebuild:config                    # Generate config.generated.ts from automatosx.config.json

# Testing
npm test                                   # Run all tests (unit + integration + smoke)
npm run test:unit                          # Unit tests only (fast)
npm run test:integration                   # Integration tests (requires providers)
npm run test:smoke                         # Smoke tests (bash script)
npm run test:watch                         # Watch mode for TDD
npm run test:debug                         # Debug with inspector

# Run a single test file
npx vitest run tests/unit/core/router.test.ts

# Quality Checks
npm run typecheck                          # TypeScript type checking (no emit)
npm run typecheck:incremental              # Faster incremental type checking
npm run lint                               # ESLint check
npm run lint:fix                           # Auto-fix ESLint issues
npm run verify                             # Full verification (typecheck + build + unit tests)

# Release & Versioning
npm run sync:all-versions                  # Sync version across all files
npm version patch                          # Bump patch version (hooks handle sync)
npm run release:check                      # Validate release readiness
npm run check:size                         # Check package size
```

### Testing Notes

- Tests use Vitest with strict isolation (4 max threads, 4 max concurrency)
- Environment: `AUTOMATOSX_MOCK_PROVIDERS=true` is set by default in tests
- Global setup: `vitest.setup.ts`, teardown: `vitest.global-teardown.ts`
- Test timeout: 60s per test, 10s for teardown
- Integration tests can be skipped: `SKIP_INTEGRATION_TESTS=true npm test`

## Architecture Overview

### Core System Components

1. **Router (`src/core/router.ts`)**
   - Policy-driven provider selection using `PolicyEvaluator` and `PolicyParser`
   - Multi-provider routing with fallback and circuit breaker
   - Free-tier prioritization and workload-aware routing
   - Trace logging via `RouterTraceLogger` (JSONL format in `.automatosx/logs/`)
   - Provider cooldown on failure (default 30s)

2. **Memory Manager (`src/core/memory-manager.ts`)**
   - SQLite + FTS5 for full-text search (no vector embeddings required)
   - Smart cleanup with configurable strategies (oldest/least_accessed/hybrid)
   - Prepared statements for performance (< 1ms search)
   - Debounced saves with busy timeout (5s default)

3. **Session Manager (`src/core/session-manager.ts`)**
   - Multi-agent collaborative sessions with UUID v4 validation
   - Debounced persistence with atomic saves (temp file + rename)
   - Task tracking with metadata size limits (10KB)
   - Automatic cleanup of old sessions (configurable retention)

4. **Delegation Parser (`src/agents/delegation-parser.ts`)**
   - Parses natural language delegations: `@agent task` or `DELEGATE TO agent: task`
   - Supports display name resolution via ProfileLoader
   - Multiple syntax patterns with position-based priority
   - < 1ms parsing (regex-based, no LLM)

5. **Spec-Kit System (`src/core/spec/`)**
   - `SpecLoader.ts`: Loads and validates YAML specs
   - `PolicyParser.ts` + `PolicyEvaluator.ts`: Policy-driven provider selection
   - `PlanGenerator.ts`: Generates execution plans with cost estimates
   - `DagGenerator.ts`: Creates dependency graphs with change detection hashes
   - `ScaffoldGenerator.ts`: Project structure generation
   - `TestGenerator.ts`: Auto-generates unit/integration/E2E tests
   - `SpecExecutor.ts`: Orchestrates spec execution

### Provider Architecture

**Base Provider (`src/providers/base-provider.ts`)**

- Abstract base with rate limiting, retry logic, circuit breaker
- Availability caching (60s TTL) and version detection caching (5min TTL)
- Provider name whitelist for security: `claude`, `claude-code`, `gemini`, `gemini-cli`, `openai`, `codex`
- Cost tracking and usage stats

**Provider Implementations:**

- `claude-provider.ts`: CLI-based Claude integration
- `gemini-provider.ts`: CLI-based Gemini integration (lowest cost, 1500 free req/day)
- `openai-provider.ts`: OpenAI integration with CLI/SDK modes (controlled by `AUTOMATOSX_CLI_ONLY` env var)

**Provider Metadata (`src/core/provider-metadata-registry.ts`)**

- Centralized registry with pricing, latency, free-tier limits
- Used by PolicyEvaluator for constraint-based filtering

**Integration Layer (`src/integrations/`)**

Bridges between AutomatosX and external AI platforms:

- `claude-code/`: Claude Code integration with MCP manager, command manager, config manager
- `gemini-cli/`: Gemini CLI integration with command translator and file readers
- `openai-codex/`: OpenAI Codex integration with CLI wrapper and MCP support

Each integration provides:

- Bridge classes for provider communication
- Command managers for CLI interaction
- Config managers for platform-specific settings
- Validation utilities and file readers
- Type definitions for platform interfaces

### Configuration System

**Config Loading (`src/core/config.ts`)**

- Loads from `automatosx.config.json` (user) + default config
- Deep merge with lodash.merge semantics
- Generates TypeScript types at build time via `tools/prebuild-config.cjs`
- Result: `src/config.generated.ts` (committed for type safety)

**Key Config Sections:**

- `providers`: Provider-specific timeouts, health checks, circuit breakers
- `execution`: Timeouts, concurrency, retry logic, stage execution
- `orchestration`: Session limits, delegation depth, cycle detection
- `memory`: Max entries, persistence path, auto-cleanup, FTS search limits
- `router`: Health check intervals, cooldown, free-tier prioritization
- `performance`: Various cache configurations (profile, team, provider, adaptive)

### CLI Architecture (`src/cli/`)

**Entry Point (`src/cli/index.ts`)**

- Uses yargs for command parsing
- Global options: `--debug`, `--quiet`, `--config`
- Installs exit handlers via `installExitHandlers()` for cleanup
- Global performance tracking with `globalTracker`

**Key Commands:**

- `run`: Execute agent tasks with memory and delegation support
- `spec`: Spec-driven workflow execution
- `gen`: Generate plans, DAGs, scaffolds, tests from specs
- `providers`: List providers, show info, view trace logs
- `memory`: Search, add, export memory entries
- `session`: Multi-agent session management
- `agent`: Create/list/show/remove custom agents
- `doctor`: Diagnostic checks for provider setup
- `free-tier`: Check quota status and usage history

## Important Development Patterns

### Resource Management

- Always register cleanup handlers for intervals, timers, database connections
- Use `installExitHandlers()` from `utils/process-manager.ts` for subprocess cleanup
- Database connections: Set busyTimeout (default 5s) to handle concurrent access
- Debounce saves to reduce I/O (e.g., SessionManager uses 1s debounce)

### Error Handling

- Use typed errors: `ProviderError`, `SessionError`, `MemoryError`, `SpecError`
- Include error codes for programmatic handling
- Retry logic: Check `shouldRetryError()` from `providers/retry-errors.ts`
- Circuit breaker: Providers have configurable failure thresholds (default 3)

### Performance Optimization

- Cache expensive operations (provider availability, version detection, profiles)
- Use prepared statements for frequent SQLite queries
- Regex patterns should be class-level constants (avoid recreation)
- Debounce I/O operations (saves, logs) to reduce syscalls
- Use adaptive caching with TTL adjustment based on access patterns

### Testing Patterns

- Mock providers are auto-enabled via `AUTOMATOSX_MOCK_PROVIDERS=true`
- Use test helpers from `tests/helpers/`
- Fixtures in `tests/fixtures/`
- Integration tests may require real provider setup (skip with env var)
- Cleanup in afterEach hooks to prevent resource leaks

### Type Safety

- Strict TypeScript mode enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- Path aliases: `@/*` → `src/*`, `@tests/*` → `tests/*`
- Generated types: `src/config.generated.ts` is built from JSON schema
- Provider types: See `src/types/provider.ts` for core interfaces

### Spec-Driven Development

- Specs are YAML files with metadata, policy, and actors
- Policy goals: `cost`, `latency`, `reliability`, `balanced`
- Constraints: `cost.maxPerRequest`, `latency.p95`, `privacy.allowedClouds`
- Change detection: DAGs include spec hash to detect outdated plans
- Validation: JSON Schema validation via `SpecSchemaValidator.ts`

## Common Workflows

### Adding a New Provider

1. Create provider class extending `BaseProvider` in `src/providers/`
2. Add provider metadata to `src/core/provider-metadata-registry.ts`
3. Register in router configuration (`automatosx.config.json`)
4. Add provider name to whitelist in `BaseProvider.ALLOWED_PROVIDER_NAMES`
5. Create integration bridge if needed (see `src/integrations/`)
6. Add tests in `tests/unit/providers/` and `tests/integration/providers/`

### Adding a New CLI Command

1. Create command file in `src/cli/commands/`
2. Export command using yargs builder pattern
3. Import and register in `src/cli/index.ts`
4. Add examples to CLI usage
5. Add tests in `tests/unit/cli/commands/`

### Adding a New Agent

1. Create agent profile YAML in `examples/agents/` or `.automatosx/agents/`
2. Use `ax agent create <name> --template <type>` for scaffolding
3. Define persona, expertise, reasoning_style, delegation_protocol
4. Add to team compositions if needed (in `examples/teams/`)

### Debugging Provider Issues

1. Enable debug mode: `ax --debug <command>`
2. Check provider availability: `ax doctor <provider>`
3. View routing decisions: `ax providers trace --follow`
4. Check free-tier status: `ax free-tier status`
5. Review logs in `.automatosx/logs/`

### Working with Specs

1. Create spec: `ax spec create "description"` (natural language)
2. Or write YAML manually following `examples/specs/` patterns
3. Validate: `ax gen plan <spec>` (shows cost estimates)
4. Generate DAG: `ax gen dag <spec> --format mermaid`
5. Execute: `ax run <spec>`
6. Monitor: `ax providers trace --follow` (in separate terminal)

## File Organization

```text
src/
├── agents/          # Agent system (delegation, profiles, templates)
├── cli/             # CLI commands and renderers
├── core/            # Core services (router, memory, session, spec-kit)
│   ├── analytics/   # Usage analytics and optimization
│   ├── feature-flags/ # Feature flag system
│   ├── free-tier/   # Free tier quota management
│   ├── spec/        # Spec-Kit components (plan, DAG, scaffold, test gen)
│   ├── telemetry/   # Telemetry collection
│   └── workload/    # Workload analysis for routing
├── integrations/    # Provider integrations (claude-code, gemini-cli, openai-codex)
├── mcp/             # Model Context Protocol (MCP) server
├── providers/       # Provider implementations
├── types/           # TypeScript type definitions
├── utils/           # Utilities (logger, errors, performance, etc.)
└── workers/         # Worker pool for parallel execution

tests/
├── unit/            # Unit tests (fast, mocked)
├── integration/     # Integration tests (requires providers)
├── smoke/           # Smoke tests (bash scripts)
├── benchmark/       # Performance benchmarks
├── e2e/             # End-to-end tests
├── reliability/     # Reliability tests
├── fixtures/        # Test fixtures
└── helpers/         # Test utilities

docs/                # Documentation (recently reorganized)
├── getting-started/ # Installation, quick start, core concepts
├── guides/          # Feature guides (agents, memory, orchestration, specs)
├── reference/       # CLI commands reference
├── providers/       # Provider-specific documentation
├── platform/        # Platform-specific guides (Windows, macOS, Linux)
├── advanced/        # Advanced topics (caching, performance, parallelization)
├── api/             # API documentation and observability
├── tutorials/       # Step-by-step tutorials
└── contributing/    # Contributing guidelines and standards

examples/
├── agents/          # Agent profile examples
├── specs/           # Workflow spec examples
├── teams/           # Team composition examples
└── abilities/       # Agent ability examples

automatosx/          # Workspace directories (see Workspace Conventions below)
├── PRD/             # Planning documents (committed to git)
└── tmp/             # Temporary files (not committed, auto-cleaned)
```

## Key Files to Know

- `automatosx.config.json`: Main configuration (user-editable)
- `src/config.generated.ts`: Generated TypeScript config (DO NOT EDIT manually)
- `tools/prebuild-config.cjs`: Config generator script (runs before build)
- `tools/sync-all-versions.js`: Version sync tool (used in release process)
- `vitest.setup.ts`: Test setup (mocks, globals)
- `vitest.config.ts`: Vitest configuration
- `tsconfig.json`: TypeScript compiler config
- `tsup.config.ts`: Build configuration

## Version Management

- Single source of truth: `package.json` version field
- Sync script: `npm run sync:all-versions` updates README.md, CLAUDE.md, config
- Git hooks (via Husky): Auto-sync on `npm version`
- Release workflow: `npm version [patch|minor|major]` → auto-sync → commit → tag

## Cost Estimation (v6.5.11+)

**IMPORTANT**: Cost estimation is **disabled by default** as of v6.5.11.

Users reported that pricing changes frequently, making estimates unreliable. Cost estimation can be optionally enabled in `automatosx.config.json`:

```json
{
  "costEstimation": {
    "enabled": false,  // Set to true to enable
    "disclaimer": "Cost estimates are approximate and may be outdated."
  }
}
```

**When disabled** (default):
- Provider metadata returns $0 for all cost fields
- PolicyEvaluator skips cost constraints (always passes)
- PlanGenerator shows "N/A (cost estimation disabled)"
- CLI commands show "Cost estimation disabled" messages

**When enabled**:
- Full cost tracking and estimation as before
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
- Path validation enabled for file operations (see `advanced.security` config)
- Allowed file extensions configurable (default: common dev files)
- No embedding API calls by default (uses FTS5 for search)
- Local-first: All data in `.automatosx/` (never sent to cloud unless via provider)

## Debugging Tips

- Use `--debug` flag for verbose logging
- Check `.automatosx/logs/router-trace-*.jsonl` for routing decisions
- Use `ax doctor` to diagnose provider setup issues
- Use `ax cleanup` to kill orphaned provider processes
- Use `ax cache status` to check cache performance
- Use `ax free-tier status` to check quota usage
- Set `AUTOMATOSX_CLI_ONLY=true` to force CLI mode (no API calls)

## Known Constraints

- Node.js >= 20.0.0 required (uses ES2022 features)
- SQLite must support FTS5 extension (usually built-in)
- Provider CLIs must be installed separately (gemini, claude, codex)
- Max delegation depth: 2 (configurable in orchestration.delegation.maxDepth)
- Max concurrent agents: 4 (configurable in execution.concurrency.maxConcurrentAgents)
- Memory max entries: 10,000 (auto-cleanup if exceeded)
- Session persistence debounce: 1s (reduces I/O but delays saves)

## Workspace Conventions

AutomatosX uses standardized workspace directories for organization:

**`automatosx/PRD/`** - Planning and Requirements Documents

- Committed to git
- Contains architectural designs, implementation plans, completion summaries
- Use for: Feature specs, architecture docs, project plans
- Example: `automatosx/PRD/auth-system-design.md`

**`automatosx/tmp/`** - Temporary Working Files

- NOT committed to git (in .gitignore)
- Auto-cleaned periodically
- Use for: Draft implementations, experimental code, temporary analysis
- Example: `automatosx/tmp/draft-implementation.ts`

**Best Practice**: Always use these directories for project-related documents and temporary files to maintain workspace organization.

## Documentation Structure

Documentation follows this organized structure:

- **Getting Started** (`docs/getting-started/`) - Installation, quick start, core concepts
- **Guides** (`docs/guides/`) - Feature guides for agents, memory, orchestration, specs
- **Reference** (`docs/reference/`) - CLI commands and API reference
- **Providers** (`docs/providers/`) - Provider-specific setup and configuration
- **Platform** (`docs/platform/`) - Platform-specific guides (Windows setup, troubleshooting)
- **Advanced** (`docs/advanced/`) - Performance, caching, parallel execution
- **Tutorials** (`docs/tutorials/`) - Step-by-step walkthroughs
- **Contributing** (`docs/contributing/`) - Development guidelines, testing standards

When referencing documentation, prefer these organized locations over root-level markdown files.

## Git Workflow

- Main branch: `main`
- Commit message format: Conventional Commits (feat/fix/chore/docs)
- Husky hooks: Pre-commit linting, commit-msg validation
- CI: Tests run on push (see `test:ci` script)
- Version management: Automated via `npm version` with hooks that sync versions across files

---

## Working with AutomatosX as a User

When using AutomatosX via Claude Code (or other AI assistants), prefer natural language commands:

**Natural Language (Recommended)**:

```text
"Please work with the backend agent to implement user authentication"
"Ask the security agent to audit this code for vulnerabilities"
"Have the quality agent write tests for this feature"
```

**Direct CLI Usage**:

```bash
ax run backend "implement user authentication"
ax memory search "authentication"
ax providers trace --follow
```

**Integration Guide**: See [AX-GUIDE.md](AX-GUIDE.md) for comprehensive usage guide including:

- Complete agent directory with capabilities
- Memory system and context management
- Multi-agent orchestration patterns
- Platform-specific integration (Claude Code, Gemini CLI, etc.)
- Configuration and troubleshooting

**Claude as a Provider**: If you're configuring Claude Code as a provider in AutomatosX (not using Claude Code to develop), see [docs/providers/claude-code.md](docs/providers/claude-code.md) for setup instructions.

**Documentation**: For detailed feature documentation, see the reorganized `docs/` directory structure above.

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
