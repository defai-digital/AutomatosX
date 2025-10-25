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

# Agent Selection (NEW v5.7.0)
ax agent suggest "task description"     # Suggest best agent(s) for a task
ax agent suggest "task" --verbose       # Show detailed scoring
ax agent suggest "task" --format json   # JSON output
ax agent suggest "task" --limit 5       # Show top 5 suggestions

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

### Git Commit Guidelines (IMPORTANT)

**CRITICAL**: Follow user's global `.claude/CLAUDE.md` rules:

- **Never mention AI/Claude assistance** in commits, comments, or documentation
- **Do not add "Generated with Claude Code"** or any AI attribution to commits
- Write commit messages in **natural, professional style** without AI references
- Follow Conventional Commits format: `type(scope): description`

**Exception**: The pre-approved commit message template for v5.6.18 optimizations is allowed (includes Claude Code attribution)

---

## Project Overview

**AutomatosX**: AI Agent Orchestration Platform (TypeScript)

- Multi-LLM providers (Claude, Gemini, OpenAI) with fallback routing
- SQLite FTS5 memory (< 1ms search)
- 4 teams, 24 specialized agents
- v5.6.22 | 2,116 tests passing (12 skipped) | Node.js 20+

**Version Management**:

- `package.json` is the single source of truth for version
- Tests read version dynamically from package.json - never hardcode
- Use `src/utils/version.ts` utility for accessing version in code
- When bumping version: `npm run version:patch|minor|major`
- Version script auto-syncs README.md and CLAUDE.md via `tools/sync-all-versions.js`

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

### Latest Release: v5.6.22 (October 2025)

**Agent Renaming & Team Refinement**: Core team structure improvements

- **Renamed Agents**: Stan → Peter (Best Practices Expert), Zara → Candy (Creative Marketer)
- **Agent Restructuring**: Moved Peter and Queenie to Core team, improved provider assignments
- **Impact**: Better team organization and clearer role definitions

**Previous Release (v5.6.21)**:

**Peter Agent Implementation** (formerly Stan): Best Practices Expert added to fill critical ownership gap

- **New Agent**: Peter (Best Practices Expert) - SOLID, design patterns, clean code, refactoring, software architecture
- **5 New Abilities**: solid-principles.md, design-patterns.md, clean-code.md, refactoring.md, software-architecture.md (~8,200 lines)
- **Enhanced Queenie**: Added base-level best-practices ability with delegation pattern to Peter
- **Collaboration Model**: Queenie (quality/bugs/tests) ↔ Peter (standards/patterns/architecture)
- **Key Files**: `.automatosx/agents/peter.yaml`, `.automatosx/abilities/solid-principles.md`, `.automatosx/abilities/design-patterns.md`, `.automatosx/abilities/clean-code.md`, `.automatosx/abilities/refactoring.md`, `.automatosx/abilities/software-architecture.md`, `.automatosx/agents/quality.yaml`

**Impact**: Dedicated expertise for SOLID principles, design patterns, and software architecture standards

**Previous Release (v5.6.20)**:

- 5 resource lifecycle bugs fixed via Ultrathink Review #6
- ProgressChannel setTimeout leak, AdaptiveCache shutdown, ResponseCache/MemoryManager cleanup, PromptManager code quality
- Complete elimination of critical memory and timeout leaks

**Previous Release (v5.6.18)**:

- 21 bugs fixed via comprehensive ultrathink reviews (6 reviews total)
- **Total Discovered**: 21 bugs (12 CRITICAL, 7 MEDIUM, 2 LOW)
- **Total Fixed**: 21 bugs (100% fix rate)
- **Focus Areas**: Timeout leaks, event listeners, resource cleanup, database management

**Review #4 - Agent Layer Timeout Leaks**:

- **AgentExecutor Leak**: Fixed Promise.race timeout leak - leaked 25-minute timeout on every execution
- **TimeoutManager Leak**: Fixed monitor warning timer leak - timer continued after execution completed
- **OpenAI Streaming Leak**: Fixed 2 nested SIGKILL timeout leaks in streaming method

**Review #5 - System-Wide Analysis** (First comprehensive all-bug-types review):

- **EventEmitter Leak**: Fixed WarningEmitter listener never removed - memory leak in long-running processes
- **Unhandled Promises**: Fixed 3 fire-and-forget promises without error handlers - prevented potential crashes
- **ProcessManager Leak**: Fixed Promise.race timeout leak in shutdown()
- **False Positive**: Verified AdaptiveCache already has correct cleanup

**Review #6 - Resource Lifecycle Analysis**:

- **ProgressChannel setTimeout Leak** (CRITICAL): Fixed timeout tracking in event queue processing - prevented orphaned timers after clear()
- **AdaptiveCache Shutdown**: Fixed cleanupInterval reference not cleared - improved shutdown state detection
- **ResponseCache Close**: Added explicit prepared statement cleanup - defensive resource management
- **MemoryManager Close**: Added explicit prepared statement cleanup - matches restore() pattern
- **PromptManager Code Quality**: Fixed non-null assertion misuse - improved code clarity

**Impact**: Complete elimination of critical memory and timeout leaks, improved system stability and resource cleanup

**Key Files**: `src/core/progress-channel.ts`, `src/core/adaptive-cache.ts`, `src/core/response-cache.ts`, `src/core/memory-manager.ts`, `src/core/prompt-manager.ts`, `src/agents/executor.ts`, `src/providers/openai-provider.ts`, `src/core/warning-emitter.ts`, `src/core/timeout-manager.ts`, `src/core/router.ts`, `src/utils/process-manager.ts`

**Previous Release (v5.6.16)**:

- **3 Ultrathink Reviews**: Systematic deep code review found 9 bugs (7 CRITICAL, 2 MEDIUM)
- **Provider Timeout Leaks**: Fixed stdin write failures, abort handlers, main timeout handlers across all 3 providers
- **BaseProvider Leaks**: Fixed version detection timeout, circuit breaker accumulation, Promise.race timeout leak
- **Impact**: 100% elimination of timeout and process leaks in provider layer
- **Key Files**: All provider files + `src/providers/base-provider.ts` - Comprehensive timeout management

**Previous Release (v5.6.15)**:

- ProcessManager singleton for process lifecycle management
- Background health checks and performance optimizations (70% improvement)
- 24 specialized agents across 4 teams

**Performance Optimizations (v5.6.13)**:

- Background health checks (60s interval, eliminates cold-start delays)
- Parallel abilities loading (60-80% faster)
- FTS5 query optimization (20-30% faster)
- **Overall**: 70% improvement (450ms → 134ms average latency)

**Agent Team Expansion**:

- **24 Total Agents** (was 19 in v5.6.8)
- New specialists: Quinn (Quantum), Astrid (Aerospace), Emma (ERP), Mira (ML), Fiona (Figma), Ivy (IoT)
- Skill redistribution eliminated JS/TS and Python overlaps
- Multi-language/framework expertise for Bob and Frank

**Architecture & Security**:

- Path security enhancement (`src/utils/path-utils.ts`) - Prevents traversal attacks
- Centralized retry logic (`src/providers/retry-errors.ts`) - Consistent error handling
- Simplified architecture - Removed legacy stage executors (~1,200 LOC)

### Completed Features

#### Parallel Agent Execution (v5.6.0)

**Overview**: Parallel execution of independent agents, reducing workflow time by 40-60%.

**Key Components**:

- `src/agents/dependency-graph.ts` - Build DAG, detect cycles
- `src/agents/execution-planner.ts` - Create execution plan with parallel batches
- `src/agents/parallel-agent-executor.ts` - Execute agents in parallel with error handling

**Configuration**:

```yaml
dependencies: [agent-name, ...]  # Optional, defaults to []
parallel: true                    # Optional, defaults to true
```

**Usage**:

```bash
ax run <agent> "task" --parallel              # Enable parallel delegations
ax run <agent> "task" --show-dependency-graph # Visualize dependencies
ax run <agent> "task" --show-timeline         # Show execution timeline
```

**Performance**:

- P50: 63.78% improvement (target: 40%)
- P95: 59.11% improvement (target: 50%)
- Memory overhead: 0.15% (target: <20%)
- 161/163 tests passing (2 flaky timing tests)

**Critical Considerations**:

- Verify `maxConcurrentAgents` limit (default: 4)
- Test circular dependency detection
- Check failure propagation to dependent agents
- See PRD for detailed error handling scenarios

#### Provider Cache Optimization (v5.6.2-5.6.3)

**Overview**: Reducing provider check latency by 99% and eliminating cold-start delays.

**Key Features**:

- Adaptive TTL (30-120s based on provider stability)
- Background health checks (60s interval)
- Cache hit rate: 50-90%
- Latency: 100ms → <1ms (99% improvement)

**Configuration**:

```json
{
  "router": {
    "healthCheckInterval": 60000  // 60 seconds (optional)
  }
}
```

**Key Files**:

- `src/providers/base-provider.ts` - Provider caching logic
- `src/core/router.ts` - Health check orchestration
- `src/cli/commands/cache.ts` - CLI cache commands
- See `docs/PERFORMANCE.md` and `docs/CACHE.md` for details

#### Response Cache (v5.5.0)

Dual-layer caching (L1 in-memory LRU + L2 SQLite), disabled by default. See `src/core/response-cache.ts`.

#### Claude Code Integration (v5.5.0)

Bidirectional integration with project-level commands (`.claude/commands/`). Run `ax init` to setup. See `src/integrations/claude-code/`.

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
npm run test:memory        # Test with garbage collection tracking

# Single test file
npx vitest run tests/unit/router.test.ts
npx vitest run tests/unit/provider-streaming.test.ts

# Pattern matching
npx vitest run tests/e2e/ -t "provider fallback"

# Real providers (for integration/E2E testing)
export TEST_REAL_PROVIDERS=true
export TEST_REAL_GEMINI_CLI=true
```

**Timeouts** (vitest.config.ts): Test 60s, Hook 60s, Teardown 10s

**Test Configuration**:

- Thread pool: Max 4 threads, isolated per test file
- File parallelism: Max 4 concurrent tests
- Auto-cleanup: Mocks, timers, env vars restored after each test
- Memory monitoring: Heap usage logging enabled
- Setup files: `vitest.setup.ts`, Global teardown: `vitest.global-teardown.ts`

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

**24 Agents**: Including 6 specialist agents (Quinn, Astrid, Emma, Mira, Fiona, Ivy)

- Agents inherit team config (provider, abilities, orchestration)
- Specialist agents (v5.6.9-5.6.11):
  - Quinn (Quantum Systems Engineer), Astrid (Aerospace Mission Scientist): `maxDelegationDepth: 1`
  - Emma (ERP Integration Specialist): SAP, Oracle, Dynamics 365
  - Mira (ML Engineer): PyTorch/TensorFlow, CNN/Transformer, LLM fine-tuning
  - Fiona (Figma Expert): Design-to-code automation, design tokens, MCP integration
  - Ivy (IoT/Embedded Engineer): IoT protocols, edge computing, embedded systems, robotics
- **Best Practices**: Handled by Bob (backend), Tony (CTO), Peter (best practices), and Queenie (quality)
- See `examples/AGENTS_INFO.md` for full directory

## Agent Selection Playbook (v5.7.0)

**Purpose**: Guide for selecting the correct agent to avoid mis-selection and improve task routing accuracy.

**NEW**: Use `ax agent suggest "task description"` for automated agent suggestions with scoring and rationale.

### Quick Decision Tree

**When user mentions...**

#### 1. ML/Data Science → Dana (Data Scientist)

- **ML Debugging**: "debug model," "training failure," "NaN loss," "overfitting," "gradient exploding"
- **Analysis**: "data analysis," "statistical significance," "A/B test," "hypothesis testing"
- **Modeling**: "transformer," "CNN," "BERT," "GPT," "LLM," "model architecture selection"
- **Performance**: "model drift," "accuracy drop," "performance regression"
- **NOT**: Feasibility studies (Rodman), backend APIs (Bob), code quality (Queenie/Bob/Tony)

#### 2. Deep Learning Implementation → Mira (ML Engineer)

- **Training Code**: "implement training loop," "custom PyTorch," "fine-tune code," "LoRA implementation"
- **Optimization**: "quantization," "pruning," "distillation," "ONNX export"
- **Deployment**: "TensorRT," "model serving," "distributed training," "DDP setup"
- **NOT**: Architecture selection (Dana), API endpoints (Bob), evaluation (Dana)

#### 3. Backend/Systems → Bob (Backend Engineer)

- **APIs**: "REST API," "GraphQL," "microservices," "API design"
- **Database**: "SQL optimization," "query performance," "indexing," "connection pooling"
- **Performance**: "API performance," "caching strategy," "backend optimization"
- **Languages**: "Go," "Rust," "backend code"
- **NOT**: ML models (Dana/Mira), frontend (Frank), architecture patterns (Tony/Bob)

#### 4. Research/Feasibility → Rodman (Researcher)

- **Studies**: "feasibility study," "cost-benefit analysis," "risk assessment"
- **Literature**: "literature review," "research paper," "prior art," "vendor comparison"
- **Evaluation**: "technology evaluation," "options analysis"
- **NOT**: ML debugging (Dana), implementation (domain experts), data analysis (Dana)

#### 5. Best Practices/Architecture → Peter/Queenie/Bob/Tony

- **Code Quality**: "code review," "refactoring," "clean code," "code smell" → **Queenie** (quality)
- **Patterns**: "SOLID principles," "design patterns," "DRY," "KISS" → **Peter** (best practices) or **Bob** (backend) or **Tony** (CTO)
- **Architecture**: "software architecture," "microservices design," "hexagonal architecture" → **Tony** (CTO) or **Peter** (best practices) or **Bob** (backend)
- **NOT**: ML architecture (Dana), implementation (domain experts), feasibility (Rodman)

### Disambiguation Rules

#### Ambiguous: "analysis"

- Data analysis / Statistical analysis? → **Dana**
- Performance analysis (API/DB)? → **Bob**
- Feasibility / Logical analysis? → **Rodman**
- Code quality analysis? → **Queenie** or **Bob**

#### Ambiguous: "model"

- ML model / Neural network? → **Dana** (strategy) or **Mira** (implementation)
- Mental model / Framework? → **Rodman**
- Data model / Database schema? → **Bob**

#### Ambiguous: "architecture"

- ML model architecture (CNN vs Transformer)? → **Dana**
- DL architecture implementation? → **Mira**
- Software architecture / Design patterns? → **Tony** or **Bob**
- Systems architecture / Infrastructure? → **Bob**

#### Ambiguous: "performance"

- Model performance / Accuracy? → **Dana**
- Training / Inference performance? → **Mira**
- API / Database performance? → **Bob**

#### Ambiguous: "optimization"

- Model hyperparameter optimization? → **Dana**
- DL optimization (quantization/pruning)? → **Mira**
- Backend optimization (caching/queries)? → **Bob**

#### Ambiguous: "debug"

- ML model debugging? → **Dana**
- Backend / Systems debugging? → **Bob**
- Frontend debugging? → **Frank**

### Common Mis-selection Scenarios

#### ❌ Scenario 1: Transformer Model Bug

**User**: "Debug transformer model - training loss is NaN"

- **Wrong Agent**: Rodman (keyword: "analysis"), Bob (keyword: "debug")
- **Correct Agent**: **Dana** (ML debugging, training failures)
- **Why Wrong**: Generic "debug" matches multiple agents; need ML-specific context

#### ❌ Scenario 2: Model Performance Regression

**User**: "Analyze model performance regression - accuracy dropped from 95% to 75%"

- **Wrong Agent**: Rodman (keyword: "analysis"), Bob (keyword: "performance")
- **Correct Agent**: **Dana** (model evaluation, accuracy analysis)
- **Why Wrong**: "Performance" is ambiguous; model accuracy ≠ API performance

#### ❌ Scenario 3: Architecture Review

**User**: "Review model architecture - should we use CNN or Transformer?"

- **Wrong Agent**: Tony/Bob (keyword: "architecture review")
- **Correct Agent**: **Dana** (ML architecture selection)
- **Why Wrong**: "Architecture" is ambiguous; software architecture ≠ ML architecture

#### ❌ Scenario 4: Fine-tuning Implementation

**User**: "Implement LoRA fine-tuning for LLaMA on custom dataset"

- **Wrong Agent**: Dana (keyword: "fine-tuning"), Bob (keyword: "implement")
- **Correct Agent**: **Mira** (DL implementation)
- **Why Wrong**: Dana designs strategy, Mira implements code

### Selection Confidence Indicators

**HIGH confidence (>90%)**:

- Multiple domain-specific keywords match
- No ambiguous keywords present
- Clear task type (debugging, implementation, analysis)

**MEDIUM confidence (60-90%)**:

- Some domain keywords match
- 1-2 ambiguous keywords present
- May need disambiguation question

**LOW confidence (<60%)**:

- Generic keywords only
- Multiple ambiguous keywords
- Should ask clarifying question

### Clarifying Questions Templates

**When ambiguous**, ask:

- "Are you looking for [Domain A] or [Domain B]?"
- "Do you need strategy/analysis (Dana) or implementation (Mira)?"
- "Is this about ML models or backend systems?"

**Examples**:

- "model optimization" → "Do you mean ML model hyperparameters (Dana) or inference optimization code (Mira)?"
- "performance analysis" → "Is this about model accuracy (Dana) or API latency (Bob)?"
- "architecture review" → "Are you asking about ML architecture (Dana) or software architecture (Tony/Peter/Bob)?"

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

| Path | Purpose | Managed By | Git Tracking |
|------|---------|------------|--------------|
| `/tmp/` | User's project temporary directory | User | **NOT tracked** (temporary tools, scripts, test files) |
| `/automatosx/tmp/` | Agent workspace (isolated) | AutomatosX | **NOT tracked** (agent workspace) |
| `/automatosx/PRD/` | Planning documents | AutomatosX | **NOT tracked** (planning docs) |

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
- **ALL improvement plans, reviews, and temporary reports MUST be in `/tmp/` folder** (per user requirements)
- `/tmp/`, `/automatosx/tmp/`, and `/automatosx/PRD/` should NOT be pushed to GitHub (already in `.gitignore`)
- See `docs/workspace-conventions.md` for full details

### Commit Changes

**IMPORTANT**: Before committing, follow user's git guidelines:

- Never mention AI/Claude assistance in commit messages
- Do not add "Generated with Claude Code" attribution (except pre-approved templates)
- Write in natural, professional style

```bash
# Interactive commit (recommended)
npm run commit

# Manual commit (follow Conventional Commits)
git commit -m "feat(scope): description"
git commit -m "fix(scope): description"
git commit -m "docs: description"
```

**Commit Types**: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

**Before Pushing to GitHub**:

1. **Update README.md** with latest changes
2. **Create GitHub release notes** for version releases
3. Ensure all temporary files are in `/tmp/` (not tracked by git)

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
- `src/core/` - Key modules:
  - router, team-manager, memory-manager, session-manager, workspace-manager
  - response-cache (v5.5.0+), path-resolver (v5.6.3+)
  - cache-warmer, adaptive-cache (v5.6.13+) - Background health checks
  - db-connection-pool, lazy-loader - Performance optimization
  - checkpoint-manager, stage-execution-controller - Execution control
  - metrics, timeout-manager, parameter-validator - System utilities
- `src/utils/path-utils.ts` - Path normalization and validation utilities (v5.6.4+)
- `src/utils/process-manager.ts` - Global process tracking and cleanup (v5.6.15+) - **CRITICAL** for Claude Code integration
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
