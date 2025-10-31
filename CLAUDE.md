# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutomatosX is an AI Agent Orchestration Platform that combines declarative workflow specs, policy-driven cost optimization, and persistent memory. It's a production-ready CLI tool (v6.3.8) that routes AI requests across multiple providers (Claude, Gemini, OpenAI) based on cost, latency, and policy constraints.

**Key Capabilities:**

- **Spec-Kit Integration**: YAML-driven workflow generation (plans, DAGs, scaffolds, tests)
- **Policy-Driven Routing**: Automatic provider selection based on cost/latency/privacy constraints
- **Persistent Memory**: SQLite + FTS5 for full-text search with no embedding dependencies
- **Multi-Agent Orchestration**: 23 specialized agents with delegation parsing
- **Cost Optimization**: 60-80% cost reduction through intelligent routing and free-tier utilization

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
- `openai-provider.ts`: OpenAI integration with CLI/SDK modes

**Provider Metadata (`src/core/provider-metadata-registry.ts`)**

- Centralized registry with pricing, latency, free-tier limits
- Used by PolicyEvaluator for constraint-based filtering

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

examples/
├── agents/          # Agent profile examples
├── specs/           # Workflow spec examples
├── teams/           # Team composition examples
└── abilities/       # Agent ability examples
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

## Git Workflow

- Main branch: `main`
- Recent commits focus on bug fixes (resource leaks, race conditions)
- Commit message format: Conventional Commits (feat/fix/chore/docs)
- Husky hooks: Pre-commit linting, commit-msg validation
- CI: Tests run on push (see `test:ci` script)

---

<!-- AutomatosX Integration v6.3.8 - Generated 2025-10-31 -->

# AutomatosX Integration for Claude Code

This project uses [AutomatosX](https://github.com/defai-digital/automatosx) - an AI agent orchestration platform with persistent memory and multi-agent collaboration.

## Quick Start for Claude Code

Claude Code works best with **natural language commands**. Just describe what you want AutomatosX agents to do:

```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
```

Claude Code will automatically:
1. Run the appropriate `ax` command
2. Return the agent's response
3. Continue with full context from memory

### Essential Commands

```bash
ax list agents                    # See all available agents
ax run <agent> "task"            # Run an agent
ax memory search "keyword"        # Search past conversations
ax status                         # Check system status
```

## Using AutomatosX in Claude Code

### Natural Language (Recommended)

Claude Code's natural language interface is the most powerful way to work with AutomatosX:

```
"Please coordinate with AutomatosX agents to build a complete auth system:
1. Have the product agent design the architecture
2. Have the backend agent implement the API
3. Have the security agent audit the implementation
4. Have the quality agent write comprehensive tests"
```

Claude Code excels at:
- ✅ Multi-agent coordination
- ✅ Context management across conversations
- ✅ Remembering past decisions (via AutomatosX memory)
- ✅ Complex workflow orchestration

### Alternative: Slash Commands

You can also use slash commands:

```
/ax-agent backend, create a REST API for user management
/ax-agent security, audit the authentication flow
/ax-agent quality, write unit tests for the API
```

### Best Practices for Claude Code

✅ **Do**:
- Use natural language (it's more powerful in Claude Code)
- Let Claude coordinate multi-step workflows
- Reference past conversations ("use the design from yesterday")
- Ask for explanations of agent outputs

❌ **Don't**:
- Manually run `ax` commands unless debugging
- Repeat context (Claude + memory handle this)
- Use slash commands for complex workflows (natural language works better)

## Available Agents

**Core Development**: backend, frontend, fullstack, mobile, devops
**Specialized**: security, quality, product, data, writer
**Leadership**: cto, ceo, researcher

[Complete agent directory → AX-GUIDE.md#agents](AX-GUIDE.md#agents) (19 agents total)

## Workspace Conventions

**IMPORTANT**: Use these directories for organized file management:

- **`automatosx/PRD/`** - Planning documents (committed to git)
  - Example: `automatosx/PRD/auth-system-design.md`

- **`automatosx/tmp/`** - Temporary files (not committed, auto-cleaned)
  - Example: `automatosx/tmp/draft-api-endpoints.ts`

**Usage**:
```
"Please save the architecture design to automatosx/PRD/user-auth-design.md"
"Put the draft implementation in automatosx/tmp/auth-draft.ts for review"
```

## Full Documentation

📚 **Complete Integration Guide: [AX-GUIDE.md](AX-GUIDE.md)**

Comprehensive coverage of:
- [All 19 agents with capabilities](AX-GUIDE.md#agents)
- [Memory system details](AX-GUIDE.md#memory)
- [Configuration options](AX-GUIDE.md#configuration)
- [Advanced features](AX-GUIDE.md#advanced) (parallel execution, resumable runs, spec-driven)
- [Troubleshooting guide](AX-GUIDE.md#troubleshooting)
- [Best practices](AX-GUIDE.md#best-practices)

**Platform guides**:
- [Using with Claude Code](AX-GUIDE.md#claude-code) (this platform)
- [Using with Gemini CLI](AX-GUIDE.md#gemini-cli)
- [Using with other AI assistants](AX-GUIDE.md#other-assistants)

**Quick links**:
- Configuration: `automatosx.config.json`
- Agent directory: `.automatosx/agents/`
- Memory database: `.automatosx/memory/memories.db`
- Support: https://github.com/defai-digital/automatosx/issues
