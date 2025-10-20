# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

### Essential Commands

```bash
# Development
npm run build              # Build → dist/
npm test                   # All tests
npm run typecheck          # TypeScript validation
npm run dev -- <command>   # Hot reload mode

# Testing
npx vitest run tests/unit/router.test.ts           # Single test
npx vitest run tests/e2e/ -t "provider fallback"   # Pattern match
npm run test:coverage      # Coverage report
npm run test:smoke         # Smoke tests (package verification)
npm run tools:check        # Validate shell scripts syntax

# Agent Operations
ax run <agent-name> "task"              # Execute agent
ax run <agent-name> "task" --parallel   # Execute with parallel delegations (v5.6.0+)
ax run <agent-name> "task" --streaming  # Real-time provider output (v5.6.5+)
ax run <agent-name> "task" --verbose    # Verbose output with real-time feedback (v5.6.5+)
ax run <agent-name> "task" --show-dependency-graph # Show dependency graph
ax run <agent-name> "task" --show-timeline         # Show execution timeline
ax agent create <name> --template dev   # Create agent
ax --debug run <agent> "task"           # Debug mode

# Resumable Runs
ax run <agent> "task" --resumable       # Enable checkpoints
ax resume <run-id>                      # Resume
ax runs list                            # List runs

# Configuration
ax config show                          # View config
ax config set execution.defaultTimeout 1500000

# Listing
ax list agents                          # List agents (text format)
ax list agents --format json            # List agents (JSON format)
ax list abilities                       # List abilities (text format)
ax list abilities --format json         # List abilities (JSON format)
ax list providers                       # List providers (text format)
ax list providers --format json         # List providers (JSON format)

# Gemini CLI Integration (NEW v5.4.3-beta.0)
ax gemini setup                         # Interactive setup
ax gemini sync-mcp                      # Register AutomatosX MCP
ax gemini import-command <name>         # Import Gemini command
ax gemini export-ability <name>         # Export ability to Gemini
ax gemini status                        # Integration status

# Cache Management (NEW v5.5.0)
ax cache stats                          # View cache statistics
ax cache clear                          # Clear all cache
ax cache show <key>                     # Show cached entry

# Publishing
npm run version:patch      # Bump version (x.x.N)
npm run version:minor      # Bump version (x.N.0)
npm run version:major      # Bump version (N.0.0)
npm run version:beta       # Bump version (x.x.x-beta.N)
npm publish                # Publish (auto: typecheck + test + build)

# Release Management (standard-version)
npm run release:patch      # Create patch release
npm run release:minor      # Create minor release
npm run release:major      # Create major release
npm run release:beta       # Create beta pre-release
npm run release:rc         # Create RC pre-release
```

### Critical Timeouts

**All layers MUST align at 25 minutes (1500000ms)**:

- Bash tool: `timeout: 1500000`
- Provider: `automatosx.config.json` → `providers.*.timeout`
- Execution: `automatosx.config.json` → `execution.defaultTimeout`

**Why**: Complex tasks (500+ LOC generation, multi-file refactoring, security audits, multi-agent workflows) need 25 minutes.

### TypeScript Strict Mode

- `noUncheckedIndexedAccess: true` - Array/object access returns `T | undefined`
- Always handle undefined values
- Run `npm run typecheck` before committing
- Path aliases available: `@/` → `src/`, `@tests/` → `tests/`

---

## Project Overview

**AutomatosX**: AI Agent Orchestration Platform (TypeScript)

- Multi-LLM providers (Claude, Gemini, OpenAI) with fallback routing
- SQLite FTS5 memory (< 1ms search)
- 4 teams, 24 specialized agents
- v5.6.11 | 2,116 tests passing (12 skipped) | Node.js 20+

**Version Management**:

- `package.json` is the single source of truth for version
- Tests read version dynamically from package.json - never hardcode
- Use `src/utils/version.ts` utility for accessing version in code

## Integration Modes

### 1. Claude Code (Recommended)

Natural language: `"please work with backend agent to implement auth API"`

- Auto agent selection, full context, error handling
- Agents: technical names (backend) = friendly names (Bob)
- See [Best Practices](docs/BEST-PRACTICES.md)

### 2. CLI Mode

Direct: `ax run backend "implement auth API"`

- For CI/CD, scripting, automation

### 3. MCP Server

`ax mcp` - 90% faster, 16 tools, persistent state

- See [MCP Configuration](#mcp-server)

### 4. Gemini CLI Integration (NEW in v5.4.3-beta.0)

Bidirectional command translation between AutomatosX and Gemini CLI

- Import Gemini commands as AutomatosX abilities
- Export AutomatosX abilities as Gemini TOML commands
- See [Gemini CLI Integration](#gemini-cli-integration)

## Critical Development Notes

### Latest Release: v5.6.11 (October 2025)

**What's New**:

- **Phase 2 Agent Expansion (v5.6.11)**: Two new specialist agents completing design and IoT capabilities
  - **Fiona (Figma Expert)**: Design-to-code automation, design tokens, MCP integration (50-70% time reduction)
  - **Ivy (IoT/Embedded Engineer)**: IoT protocols, edge computing, embedded systems, robotics (end-to-end IoT development)
  - **24 Total Agents** (was 22): Complete design team + enhanced engineering team
  - **8 New Ability Files**: Figma API, design tokens, IoT protocols, edge computing, embedded systems, robotics (~4,025 lines, 110+ keywords)
- **Agent Team Optimization (v5.6.9-5.6.10)**: Comprehensive skill redistribution and specialist agents
  - **Quinn (Quantum Systems Engineer), Astrid (Aerospace Mission Scientist)**: Quantum algorithms, orbital mechanics, mission analysis
  - **Stan (Best Practices Expert)**: SOLID, design patterns, clean code, refactoring, architecture
  - **Emma (ERP Integration Specialist)**: SAP, Oracle, Dynamics 365, enterprise integration patterns
  - **Mira (ML Engineer)**: PyTorch/TensorFlow, CNN/Transformer, LLM fine-tuning
  - **19 → 24 Agents**: Enhanced engineering, core, and design teams
  - **Skill Redistribution**: Eliminated JS/TS and Python overlaps across Bob, Frank, Felix, Maya
    - Bob (backend): Focused on Go/Rust + systems programming, Python only for math validation
    - Frank (frontend): Pure frontend (React/Next.js/Swift), removed Python tooling
    - Felix (fullstack): Now owns Node.js/TypeScript backend + Python automation
    - Maya (mobile): Enhanced Swift/Kotlin/Flutter expertise, coordinates with Astrid on telemetry
  - **Mathematical Reasoning Enhancement**: New shared ability for Bob and Dana to support Quinn/Astrid
  - **9 New Ability Files**: Quantum algorithms, orbital mechanics, mission analysis, mathematical reasoning (~21 KB)
  - **Expected Productivity Gain**: 15-20% from reduced context switching and clearer agent boundaries
- **Multi-Language Expertise (Bob)**: Enhanced with 6 programming languages
  - C++, C, Python, Rust, Go, JavaScript/TypeScript abilities
  - 7,079 lines of comprehensive language guidance
  - 19 keyword mappings for smart ability loading
  - Expected C++ task success: 60% → 85%+ (42% improvement)
- **Multi-Framework Expertise (Frank)**: Enhanced with 4 frontend frameworks
  - React, Next.js, Swift/SwiftUI, Python frontend tooling abilities
  - 6,846 lines of comprehensive framework guidance
  - 28 keyword mappings for smart ability loading
  - Expected React: 70% → 90%+, Next.js: 50% → 85%+, Swift: 40% → 80%+ task success
- **Path Security Enhancement (v5.6.8)**: Centralized path validation utilities preventing traversal attacks
  - New `src/utils/path-utils.ts` module for cross-platform path normalization
  - Security validation in all managers (PathResolver, WorkspaceManager, ConfigManager, SessionManager, MemoryManager)
  - Blocks `..`, absolute paths outside project, symbolic links
- **Simplified Architecture (v5.6.8)**: Removed legacy stage executors (~1,200 LOC, -30KB package size)
- **Single Execution Path (v5.6.8)**: All multi-stage agents now use `StageExecutionController`
- **Centralized Retry Logic (v5.6.8)**: New `src/providers/retry-errors.ts` for consistent error handling
  - Provider-specific retryable errors (Claude, Gemini, OpenAI)
  - Common network, rate limit, and server error patterns
  - Non-retryable error detection (authentication, configuration)

### Completed Features

#### Parallel Agent Execution (v5.6.0)

**Status**: Released in v5.6.0 with comprehensive testing (161/163 parallel execution tests passing, 2 flaky timing tests)

**Overview**: Major architectural enhancement to support parallel execution of independent agents, reducing complex workflow execution time by 40-60%.

**Implementation Status** (v5.6.0):

- ✅ Phase 1: Foundation (Week 1-2) - COMPLETE
  - DependencyGraphBuilder with cycle detection
  - ExecutionPlanner with batch grouping
  - Agent profile extensions (dependencies, parallel fields)
- ✅ Phase 2: Parallel Execution Engine (Week 3-4) - COMPLETE
  - ParallelAgentExecutor with error handling
  - Partial failure handling and cancellation
  - 22 unit tests passing (100%)
- ✅ Phase 3: Integration (Week 5) - COMPLETE ✅
  - ✅ AgentExecutor.executeDelegationsParallel() method integrated
  - ✅ CLI --parallel flag added to `ax run` command
  - ✅ ExecutionOptions extended with parallel execution parameters
  - ✅ Unit tests: 13 tests in `executor-delegation-parallel.test.ts` (all passing)
  - ✅ Integration tests: 13 tests in `cli-run-parallel.test.ts` (all passing)
  - ✅ All tests passing (1,920 tests total)
- ✅ Phase 4: Observability (Week 6) - COMPLETE
  - ✅ Implemented `--show-dependency-graph` flag to visualize agent dependencies.
  - ✅ Implemented `--show-timeline` flag to visualize agent execution timeline.
  - ✅ Added `MetricsCollector` for Prometheus-compatible metrics.
  - ✅ All related tests are passing.
- ✅ Phase 5: Testing & Optimization (Week 7) - COMPLETE (100%) 🎉
  - ✅ Profiling Tools: MemoryProfiler + CPUProfiler implemented (24 tests)
  - ✅ Reliability Tests: Chaos (24 tests) + Concurrency (14 tests) passing (100%)
  - ✅ Benchmark Tests: 6 tests passing - Performance targets exceeded by 26-73%
  - ✅ Load Tests: 8 tests passing - System stable at 50 agents (100% success rate)
  - ✅ Performance Validation: All PRD targets met or exceeded
    - P50: 63.78% improvement (target: 40%) ⭐
    - P95: 59.11% improvement (target: 50%) ⭐
    - Memory overhead: 0.15% (target: <20%) ⭐
    - 50 agents: 100% success rate ⭐
  - 📄 Final Report: `tmp/phase5-final-performance-report.md`
- ✅ Phase 6-7: Beta Testing & GA Release - COMPLETE
  - Released in v5.6.0 (2025-10-17)
  - Merged from beta branch to main
  - Full feature set available in production

**Key Components** (NEW):

1. **DependencyGraphBuilder** (`src/agents/dependency-graph.ts`) - Build DAG, detect cycles, calculate execution levels
2. **ExecutionPlanner** (`src/agents/execution-planner.ts`) - Create execution plan with parallel batches
3. **ParallelAgentExecutor** (`src/agents/parallel-agent-executor.ts`) - Execute agents in parallel with error handling

**Testing Focus**:

- **Unit Tests** (110 total):
  - `tests/unit/dependency-graph-builder.test.ts` (4 tests)
  - `tests/unit/execution-planner.test.ts` (3 tests)
  - `tests/unit/parallel-agent-executor.test.ts` (20 tests)
  - `tests/unit/executor-delegation-parallel.test.ts` (13 tests)
  - `tests/unit/utils/memory-profiler.test.ts` (11 tests) ✨ Phase 5
  - `tests/unit/utils/cpu-profiler.test.ts` (13 tests) ✨ Phase 5
- **Integration Tests** (13 total):
  - `tests/integration/cli-run-parallel.test.ts` (13 tests)
- **Reliability Tests** (38 total): ✨ Phase 5
  - `tests/reliability/chaos-testing.test.ts` (24 tests - 30%/50%/70% failure rates)
  - `tests/reliability/concurrency.test.ts` (14 tests - race conditions, workspace isolation)
- **Total Parallel Execution Tests**: 161/163 tests passing (2 flaky timing tests)
- **Overall Test Suite**: 2,116 tests passing (12 skipped) across 101 test files
- **Key Scenarios Tested**:
  - Circular dependency detection ✅
  - Partial failure handling ✅
  - Resource limits (maxConcurrentAgents) ✅
  - Backward compatibility ✅
  - CLI flag integration ✅
  - Error handling & validation ✅
  - Memory profiling ✅
  - CPU profiling ✅
  - Chaos testing (random failures) ✅
  - Concurrency & data consistency ✅
  - Single delegation timeline (`tests/unit/test-single-delegation-timeline.test.ts`) ✅
  - Provider streaming (`tests/unit/provider-streaming.test.ts`, `tests/integration/streaming-workflow.test.ts`) ✅

**Configuration**:

```yaml
# Agent dependencies (NEW field in agent YAML)
dependencies: [agent-name, ...]  # Optional, defaults to []
parallel: true                    # Optional, defaults to true
```

**Key Use Cases** (from PRD):

1. **Multi-team collaboration**: CTO coordinates frontend and backend parallel development
2. **Data pipelines**: Fetch from multiple data sources simultaneously
3. **Testing workflows**: Run unit, integration, and static analysis tests in parallel

**When working on parallel execution**:

- Always test circular dependency detection
- Verify `maxConcurrentAgents` limit (default: 4)
- Check failure propagation to dependent agents
- Test with real providers (set `TEST_REAL_PROVIDERS=true`)
- Review PRD Section 4.3 (Error Handling & Recovery) for failure scenarios

**Performance Targets** (from PRD):

- P50 execution time: -40% (3 independent agents)
- P95 execution time: -50% (complex workflows)
- CPU utilization: +30%
- Memory overhead: <20%

**Critical Risks** (from PRD Section 6):

1. **Race conditions**: Multiple agents accessing shared resources (workspace, memory)
   - Mitigation: File-based locking, concurrency limits, workspace validation
2. **Resource exhaustion**: Too many parallel agents consuming memory/CPU
   - Mitigation: `maxConcurrentAgents: 4` default, dynamic resource monitoring
3. **Provider rate limits**: Parallel API calls hitting rate limits
   - Mitigation: Provider-specific concurrency limits, fallback to sequential
4. **Complex error handling**: Failure propagation in parallel execution
   - Mitigation: Clear failure rules, detailed logging, debugging tools

**Known Issues**:

- **Flaky Timing Tests** (2 tests):
  - `tests/unit/performance.test.ts` - Report generation sorting may fail under heavy load
  - `tests/unit/utils/cpu-profiler.test.ts` - CPU time measurement may exceed threshold by ~0.1ms
  - These are non-critical and don't affect production functionality

#### Provider Cache Optimization (v5.6.2-5.6.3) 🎉

**Status**: Released in v5.6.2 and v5.6.3 with comprehensive enhancements

**Overview**: Multi-phase performance optimization reducing provider check latency by 99% and eliminating cold-start delays.

**Implementation Status**:

- ✅ Phase 1 (v5.6.2): Enhanced Cache Metrics - COMPLETE
  - Enhanced `getCacheMetrics()` API with avgAge, lastHit, lastMiss
  - Health metrics (uptime, consecutive successes)
  - Router `getHealthCheckStatus()` API
  - CLI `ax cache stats` command enhancements
- ✅ Phase 2 (v5.6.2): Background Health Checks - COMPLETE
  - Configurable health check intervals
  - Immediate cache warmup on startup
  - Proactive cache refresh
  - 90%+ cold-start latency reduction (100ms → <10ms)
- ✅ Phase 3 (v5.6.3): Observability + Polish - COMPLETE 🎉
  - **Adaptive TTL**: Dynamic cache adjustment (30-120s based on uptime)
  - **Cache Poisoning Prevention**: Only cache successful results
  - **Graceful Degradation**: Handle cache errors without crashes
  - **Enhanced Metrics**: Per-provider cache hit rates, uptime tracking
  - **Documentation**: PERFORMANCE.md, CACHE.md guides
  - **57 New Tests**: Comprehensive test coverage (100% passing)

**Key Features**:

1. **Availability Cache**:
   - Baseline TTL: 60 seconds
   - Adaptive TTL: 30-120s (based on provider stability)
   - Cache hit rate: 50-90% (depending on request patterns)
   - Latency reduction: 99% (100ms → <1ms)

2. **Version Cache**:
   - TTL: 5 minutes
   - Per-command caching
   - Memory efficient: ~500 bytes per command

3. **Background Health Checks**:
   - Configurable interval (default: 60 seconds)
   - Parallel cache warmup on startup
   - Continuous cache refresh
   - Provider health monitoring

4. **Adaptive TTL Strategy**:
   - Highly stable (>99% uptime): 120s TTL
   - Normal (90-99% uptime): 60s TTL
   - Unstable (<90% uptime): 30s TTL

**Configuration**:

```json
// automatosx.config.json
{
  "router": {
    "healthCheckInterval": 60000  // 60 seconds (optional)
  }
}
```

**CLI Commands**:

```bash
# View comprehensive cache statistics
ax cache stats

# Output:
# 📊 Cache Statistics
#
# Router Status:
#   Health Checks: ✅ Enabled (60s interval)
#   Checks Performed: 120
#   Average Duration: 15ms
#   Success Rate: 100.0%
#
# Provider: gemini-cli
#   Availability Cache:
#     Hit Rate: 85.0% (85 hits / 100 total)
#     Average Age: 5.0s (max: 60s)
#     Last Hit: 2s ago
#   Health:
#     Uptime: 99.5%
#     Consecutive Successes: 100

# Clear all caches
ax cache clear
```

**Performance Impact**:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| First request (cold) | 100ms | <1ms | **99%** |
| Subsequent requests | 100ms | <1ms | **99%** |
| Cache hit rate | 0% | 50-90% | **+∞** |
| Memory per provider | - | <50KB | - |

**Testing**:

- **57 New Tests** (all passing):
  - Enhanced cache metrics: 20 tests
  - Adaptive TTL: 19 tests
  - Router health checks: 18 tests
  - Cache error handling: 11 tests (from Phase 3 Day 3)
  - Total test suite: 2,116 tests passing (12 skipped)

**Documentation**:

- `docs/PERFORMANCE.md` - Performance optimization guide
- `docs/CACHE.md` - Cache architecture and design
- `tmp/phase3-day3-progress.md` - Phase 3 completion report

**Key Implementation Files**:

- `src/providers/base-provider.ts` - Provider caching logic
- `src/providers/retry-errors.ts` - Centralized retry error patterns (v5.6.4+)
- `src/core/router.ts` - Health check orchestration
- `src/cli/commands/cache.ts` - CLI cache commands
- `tests/unit/base-provider-cache-metrics-enhanced.test.ts` - Enhanced metrics tests
- `tests/unit/base-provider-adaptive-ttl.test.ts` - Adaptive TTL tests
- `tests/unit/router-health-check-phase3-metrics.test.ts` - Router health tests

#### Response Cache (v5.5.0)

**Status**: Implemented, disabled by default

**Location**: `src/core/response-cache.ts`

**Features**:

- Dual-layer caching: L1 (in-memory LRU), L2 (SQLite persistent)
- TTL-based expiration (default: 24 hours)
- Cache key: SHA256 hash of (provider + prompt + modelParams)
- Project-isolated (`.automatosx/cache/responses.db`)

**Configuration**:

```json
// automatosx.config.json
{
  "performance": {
    "providerCache": {
      "enabled": false,  // Set to true to enable
      "maxEntries": 100,
      "ttl": 600000
    }
  }
}
```

**Commands**:

```bash
ax cache stats                    # View cache statistics
ax cache clear                    # Clear all cache
ax cache show <key>              # Show cached entry
```

#### Claude Code Integration (v5.5.0)

**Status**: Implemented

**Location**: `src/integrations/claude-code/`

**Features**:

- Bidirectional integration: AutomatosX ↔ Claude Code
- Project-level commands (`.claude/commands/`)
- MCP configuration management
- Config manager, command manager, MCP manager

**Setup**:

```bash
ax init                          # Initializes .claude/ directory
```

**Key Components**:

- `bridge.ts`: High-level API for integration
- `config-manager.ts`: Claude Code config management
- `command-manager.ts`: Slash command installation
- `mcp-manager.ts`: MCP server registration

### Claude Code Provider (v5.4.3)

**Session-Based Execution**: Claude provider uses built-in authentication instead of API calls.

**How it works**:

- Uses `--continue` and `--fork-session` flags for isolated sessions
- Leverages Claude Code's built-in account (no API key required)
- Avoids API rate limits and 500 errors
- Each execution runs in a forked session (no context pollution)

**Configuration**:

```bash
# Enable session mode (default: true)
export CLAUDE_USE_SESSION=true

# Disable to use legacy --print mode (API-based, not recommended)
export CLAUDE_USE_SESSION=false
```

**Provider Priority** (as of v5.4.3):

1. `claude-code` (priority 1) - Built-in auth, no API calls
2. `gemini-cli` (priority 2) - Fallback
3. `openai` (priority 3) - Fallback

See `tmp/claude-cli-integration-plan.md` for implementation details.

### Provider Retry Logic (v5.6.4)

**Centralized Error Handling**: All providers now use consistent retry logic from `src/providers/retry-errors.ts`.

**Retryable Errors**:

- **Common**: Network errors (ECONNRESET, ETIMEDOUT), rate limits, server errors (500, 503)
- **Claude**: overloaded_error, internal_server_error
- **Gemini**: resource_exhausted, deadline_exceeded, internal
- **OpenAI**: internal_error

**Non-Retryable Errors** (fail immediately):

- Authentication errors (invalid_api_key, unauthorized)
- Configuration errors (invalid_request, permission denied)
- Not found errors

**Usage in Custom Providers**:

```typescript
import { shouldRetryError, getRetryableErrors } from '@/providers/retry-errors.js';

// Check if error should be retried
if (shouldRetryError(error, 'gemini')) {
  // Retry logic
}

// Get all retryable errors for a provider
const errors = getRetryableErrors('claude');
```

### Provider Model Parameters (v5.0.5)

Only OpenAI supports `maxTokens` & `temperature` (configured in agent YAML):

```yaml
# .automatosx/agents/qa-specialist.yaml
temperature: 0        # Deterministic (OpenAI only)
maxTokens: 2048       # Limit tokens (OpenAI only)
```

- Gemini/Claude: Use provider-optimized defaults
- See `docs/guide/provider-parameters.md`

### Memory System (FTS5)

- SQLite FTS5 full-text search (< 1ms)
- Auto-sanitizes 15+ special chars & boolean operators
- Location: `.automatosx/memory/memories.db`

### Delegation Parser

- Detects 7 delegation patterns (incl. Chinese)
- Filters false positives (quoted text, docs, tests)
- Max depth: 2 (default), 3 (coordinators: CTO, DevOps, Data Scientist)

## Development Workflow

### Testing

```bash
npm test                   # All tests: unit + integration + smoke (2,116 passing)
npm run test:unit          # Unit tests only (101 test files)
npm run test:integration   # Integration tests only
npm run test:smoke         # Smoke tests (package verification)
npm run test:coverage      # Coverage report
npm run test:watch         # Watch mode

# Single test file
npx vitest run tests/unit/router.test.ts
npx vitest run tests/unit/provider-streaming.test.ts

# Pattern matching
npx vitest run tests/e2e/ -t "provider fallback"

# Real providers (for integration/E2E testing)
export TEST_REAL_PROVIDERS=true
export TEST_REAL_GEMINI_CLI=true
```

**Timeouts** (vitest.config.ts): Test 30s, Hook 30s, Teardown 10s

**Test Coverage**: 2,116 tests passing (12 skipped) across 101 test files. See CONTRIBUTING.md for test requirements.

### Debugging

```bash
ax --debug run <agent> "task"    # Debug mode
ax status                        # System health
ax config show                   # View config
ax memory search "keyword"       # Search memory
AUTOMATOSX_DEBUG=true npm test   # Debug tests
```

## Architecture

### Core Flow

```text
CLI → Router → TeamManager → ContextManager → AgentExecutor → Provider CLI
```

**Key Components**:

1. **Router** (`src/core/router.ts`) - Provider fallback (Codex → Gemini → Claude)
2. **TeamManager** (`src/core/team-manager.ts`) - 4 teams, shared config
3. **AgentExecutor** (`src/agents/executor.ts`) - Delegation, retry, timeouts
4. **MemoryManager** (`src/core/memory-manager.ts`) - SQLite FTS5 (< 1ms)
5. **SessionManager** (`src/core/session-manager.ts`) - JSON persistence
6. **WorkspaceManager** (`src/core/workspace-manager.ts`) - PRD/tmp workspaces

### Teams & Agents

**4 Teams**: core (QA, Best Practices), engineering (dev), business (product), design (UX)
**24 Agents**: Including 7 specialist agents (Quinn, Astrid, Stan, Emma, Mira, Fiona, Ivy)

- Agents inherit team config (provider, abilities, orchestration)
- Specialist agents (v5.6.9-5.6.11):
  - Quinn (Quantum Systems Engineer), Astrid (Aerospace Mission Scientist): `maxDelegationDepth: 1`
  - Stan (Best Practices Expert): SOLID, design patterns, clean code
  - Emma (ERP Integration Specialist): SAP, Oracle, Dynamics 365
  - Mira (ML Engineer): PyTorch/TensorFlow, CNN/Transformer, LLM fine-tuning
  - Fiona (Figma Expert): Design-to-code automation, design tokens, MCP integration
  - Ivy (IoT/Embedded Engineer): IoT protocols, edge computing, embedded systems, robotics
- See `examples/AGENTS_INFO.md` for full directory

### CLI Commands

`init` | `run` | `list` | `memory` | `status` | `session` | `workspace` | `mcp` | `gemini` | `cache` (v5.5.0+)

- `config`: show/get/set/reset
- `agent`: create/list/show/remove/templates
- `gemini`: sync-mcp/list-mcp/list-commands/import-command/export-ability/validate/setup/status
- `cache`: stats/clear/show (v5.5.0+)
- See `src/cli/commands/` for implementations

## Configuration Examples

### Team Config (`.automatosx/teams/engineering.yaml`)

```yaml
name: engineering
provider:
  primary: codex
  fallbackChain: [codex, gemini, claude]
sharedAbilities: [coding-standards, code-generation]
orchestration:
  maxDelegationDepth: 2
```

### Agent Config (`.automatosx/agents/backend.yaml`)

```yaml
name: backend
team: engineering              # Inherits all team config
displayName: "Bob"             # Friendly name
role: Senior Backend Engineer
abilities: [backend-development]  # Merged with team abilities
```

## Agent Templates

```bash
ax agent create <name> --template developer --interactive
ax agent templates             # List: basic-agent, developer, analyst, designer, qa-specialist
```

**Templates**: `examples/templates/` | **Engine**: `src/agents/template-engine.ts`

## Delegation

**7 Patterns**: `@agent`, `DELEGATE TO`, `please ask`, `I need`, Chinese

- Max depth: 2 (most), 3 (coordinators: Tony/CTO, Oliver/DevOps, Daisy/Data)
- Auto cycle detection & capability-first strategy
- See `examples/AGENTS_INFO.md` for full governance rules

## Configuration Priority

1. `.automatosx/config.json` (project)
2. `automatosx.config.json` (project root)
3. `~/.automatosx/config.json` (global)
4. `DEFAULT_CONFIG` (`src/types/config.ts`)

**Sections**: providers, execution, orchestration, memory, abilities, logging, performance

## Common Tasks

### Add New Agent

```bash
ax agent create <name> --template developer --interactive
# Manual: Create .automatosx/agents/<name>.yaml + abilities
```

### Add New Command

1. Create `src/cli/commands/my-command.ts`
2. Register in `src/cli/index.ts`
3. Add tests: `tests/unit/` + `tests/integration/`
4. Follow Conventional Commits for commit messages (see CONTRIBUTING.md)

### Working with tmp Directory and Workspace Paths

**CRITICAL**: AutomatosX uses workspace isolation with two separate tmp directories:

| Path | Purpose | Managed By |
|------|---------|------------|
| `/tmp/` | User's project temporary directory | User |
| `/automatosx/tmp/` | Agent workspace (isolated) | AutomatosX |
| `/automatosx/PRD/` | Planning documents | AutomatosX |

**When agents report "saved to tmp/file.md"**, check **both** locations:

```bash
# Check user tmp (less likely)
ls tmp/*.md

# Check agent workspace (more likely)
ls automatosx/tmp/*.md
```

**Key Points**:

- All providers (OpenAI, Gemini CLI, Claude Code) should write to `automatosx/tmp/` for agent files
- User files go in project `/tmp/`
- Agent files are isolated in `/automatosx/tmp/` for auto-cleanup and workspace management
- See `docs/workspace-conventions.md` for full details
- Should NOT be committed to git (add to `.gitignore` if needed)

### Commit Changes

```bash
# Interactive commit (recommended)
npm run commit

# Manual commit (follow Conventional Commits)
git commit -m "feat(scope): description"
git commit -m "fix(scope): description"
git commit -m "docs: description"
```

**Commit Types**: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

### Debug Delegation

```bash
ax --debug run <agent> "task"  # Parser logs
ax agent show <name>            # Config
# Check: .automatosx/sessions/sessions.json, automatosx/PRD/, automatosx/tmp/
```

## Checkpoints & Resume (v5.3.0)

```bash
ax run <agent> "task" --resumable        # Enable
ax resume <run-id>                       # Resume
ax runs list/show/delete                 # Manage
```

- Storage: `.automatosx/checkpoints/<run-id>/`
- See `docs/guide/checkpoints-and-resume.md`

## Security

- **Path validation** (PathResolver + path-utils) - Prevents directory traversal attacks
  - Centralized path normalization (`src/utils/path-utils.ts`)
  - Security validation in `PathResolver`, `WorkspaceManager`, `ConfigManager`, `SessionManager`, `MemoryManager`
  - Blocks `..`, absolute paths outside project, symbolic links
- Workspace access control (PRD/tmp only)
- Input sanitization
- No arbitrary code execution
- **MCP**: Reject `..`, `~/`, `/etc/`, absolute paths | Rate limit: 100 req/min

## Important Files

**Core**:

- `src/cli/index.ts` - CLI entry
- `src/core/` - router, team-manager, memory-manager, session-manager, workspace-manager, response-cache (v5.5.0+), path-resolver (v5.6.3+)
- `src/utils/path-utils.ts` - Path normalization and validation utilities (v5.6.4+)
- `src/agents/` - executor, delegation-parser, template-engine, context-manager, dependency-graph (v5.6.0), execution-planner (v5.6.0), parallel-agent-executor (v5.6.0)
- `src/providers/` - base-provider, claude-provider, gemini-provider, openai-provider, retry-errors (v5.6.4+)
- `src/mcp/` - server, types, tools (16 tools)
- `src/integrations/gemini-cli/` - bridge, command-translator, types, utils (v5.4.3-beta.0)
- `src/integrations/claude-code/` - bridge, config-manager, command-manager, mcp-manager (v5.5.0+)

**Config**:

- `automatosx.config.json` - Project config
- `tsconfig.json` - TypeScript strict mode
- `tsup.config.ts` - Build (src/cli/index.ts → dist/)
- `vitest.config.ts` - Tests (mock providers)

**Examples**:

- `examples/templates/` - 5 agent templates
- `examples/AGENTS_INFO.md` - Full agent directory

## Environment Variables

```bash
# Core
AUTOMATOSX_DEBUG=true             # Verbose logging
AUTOMATOSX_QUIET=true             # Suppress output
AUTOMATOSX_CONFIG_PATH=<path>     # Custom config
AUTOMATOSX_PROFILE=true           # Performance profiling

# Provider Configuration
CLAUDE_USE_SESSION=true           # Use session-based execution (default: true)
CLAUDE_USE_SESSION=false          # Use legacy --print mode (API-based)

# Testing
AUTOMATOSX_MOCK_PROVIDERS=true    # Mock providers (testing)
TEST_REAL_PROVIDERS=true          # Real providers (testing)
TEST_REAL_GEMINI_CLI=true         # Real Gemini CLI (testing)
```

## Documentation

**User**: README.md, FAQ.md, TROUBLESHOOTING.md, CHANGELOG.md

**Developer**: CONTRIBUTING.md, docs/E2E-TESTING.md, examples/AGENTS_INFO.md

**Guides**: docs/ (Quick Start, Core Concepts, CLI Reference)

**PRDs**: automatosx/PRD/ (Product Requirements Documents for new features)

## MCP Server

**Setup** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "automatosx": {
      "command": "ax",
      "args": ["mcp"]
    }
  }
}
```

**16 Tools**:

- **Core** (4): run_agent, list_agents, search_memory, get_status
- **Session** (5): session_create/list/status/complete/fail
- **Memory** (7): memory_add/list/delete/export/import/stats/clear

**Performance**: <300ms p50, <1.5s cold start | JSON-RPC 2.0 over stdio
**Manifest**: `examples/claude/mcp/automatosx.json`

## Gemini CLI Integration

**NEW in v5.4.3-beta.0**: Bidirectional command translation between AutomatosX and Gemini CLI.

### Gemini CLI Quick Start

```bash
# Setup (interactive wizard)
ax gemini setup

# Sync AutomatosX MCP with Gemini CLI
ax gemini sync-mcp

# Import Gemini command as AutomatosX ability
ax gemini import-command <command-name>

# Export AutomatosX ability as Gemini TOML command
ax gemini export-ability <ability-name>

# Status and discovery
ax gemini status              # Integration status
ax gemini list-mcp            # List MCP servers
ax gemini list-commands       # List Gemini commands
ax gemini validate [--fix]    # Validate configuration
```

### Gemini CLI Architecture

**Key Components**:

1. **GeminiCLIBridge** (`src/integrations/gemini-cli/bridge.ts`) - MCP server discovery, AutomatosX registration
2. **CommandTranslator** (`src/integrations/gemini-cli/command-translator.ts`) - TOML ↔ Markdown translation
3. **File System Utilities** (`src/integrations/gemini-cli/utils/`) - Cross-platform file operations

**File Formats**:

- **Gemini Commands**: `.toml` files in `~/.gemini/commands` or `.gemini/commands`
- **AutomatosX Abilities**: `.md` files in `.automatosx/abilities`

**Configuration Paths**:

- **User-level**: `~/.gemini/settings.json` (MCP servers, global settings)
- **Project-level**: `.gemini/settings.json` (project-specific settings)

### Common Workflows

**Import Gemini command to AutomatosX**:

```bash
# Discover available commands
ax gemini list-commands

# Import specific command
ax gemini import-command plan
# → Creates .automatosx/abilities/plan.md

# Use in agent
ax agent create my-planner --template basic-agent
# Edit .automatosx/agents/my-planner.yaml to include 'plan' ability
```

**Export AutomatosX ability to Gemini**:

```bash
# Export ability as TOML
ax gemini export-ability backend-development
# → Creates .gemini/commands/backend-development.toml

# Verify in Gemini CLI
ax gemini list-commands
# → Shows backend-development command
```

**Troubleshooting**:

```bash
# Validate configuration
ax gemini validate

# Auto-fix common issues
ax gemini validate --fix

# Check detailed status
ax gemini status --json
```

### Gemini CLI Testing

```bash
# Integration tests
npx vitest run tests/integration/gemini-cli

# E2E tests (requires real Gemini CLI)
export TEST_REAL_GEMINI_CLI=true
npx vitest run tests/e2e/gemini-cli
```

## Support

- Issues: <https://github.com/defai-digital/automatosx/issues>
- npm: <https://www.npmjs.com/package/@defai.digital/automatosx>
