# CLAUDE.md

Claude Code guidance for AutomatosX - AI Agent Orchestration Platform (TypeScript)

## Quick Reference

### Essential Commands

```bash
# Development
npm run build              # Build → dist/
npm test                   # All tests (unit + integration + smoke)
npm run typecheck          # TypeScript validation
npx eslint src/            # Lint source code
npm run dev -- <command>   # Hot reload mode

# Agent Operations
ax run <agent> "task"                          # Execute agent
ax run <agent> "task" --parallel               # Parallel delegations
ax run <agent> "task" --streaming              # Real-time output
ax agent suggest "task description"            # Auto agent selection (NEW v5.7.0)
ax --debug run <agent> "task"                  # Debug mode

# Memory & Cache
ax memory search "keyword"                     # Search memory
ax cache stats                                 # Cache statistics
ax status                                      # System health

# Publishing
npm run version:patch|minor|major              # Bump version
npm publish                                    # Publish (auto: typecheck + test + build)
```

### Critical Configuration

**Timeouts (25 minutes for complex tasks)**:
- Bash tool: `timeout: 1500000`
- Provider: `automatosx.config.json` → `providers.*.timeout`
- Execution: `automatosx.config.json` → `execution.defaultTimeout`

**TypeScript Strict Mode**:
- `noUncheckedIndexedAccess: true` - Always handle undefined values
- Path aliases: `@/` → `src/`, `@tests/` → `tests/`
- Run `npm run typecheck` before committing

**ESLint Rules** (v5.6.23):
- `@typescript-eslint/no-floating-promises: error` - Await or handle all promises
- `@typescript-eslint/no-misused-promises: error` - Prevent promise misuse
- `@typescript-eslint/await-thenable: error` - Only await promise-returning values
- Run `npm run check:timers` to verify timer cleanup

### Git Commit Guidelines

**CRITICAL**: Follow user's global `.claude/CLAUDE.md` rules:
- Never mention AI/Claude assistance in commits
- No "Generated with Claude Code" attribution (except pre-approved templates)
- Use Conventional Commits: `type(scope): description`
- Types: feat, fix, docs, style, refactor, perf, test, chore

**Before GitHub push**:
1. Update README.md
2. Create GitHub release notes for versions
3. Ensure all temporary files are in `/tmp/` (not tracked)

---

## Project Overview

**AutomatosX v5.6.34** - Multi-LLM agent orchestration with persistent memory
- Providers: Claude, Gemini, OpenAI (automatic fallback)
- SQLite FTS5 memory (< 1ms search)
- 4 teams, 19 core agents (52+ total including variants)
- Node.js 20+ | 121 test files

**Version Management**:
- `package.json` = single source of truth
- Use `src/utils/version.ts` for version access
- Never hardcode versions in tests

## Latest Release (v5.6.34)

**Critical Memory Leak Fix**:

- Fixed AbortSignal listener memory leak in `AgentExecutor.sleep()` (src/agents/executor.ts:984-1011)
- 100% resource cleanup coverage (9/9 AbortSignal locations)
- Prevents ~200-300 bytes leak per retry attempt in long-running applications

**Recent Key Fixes**:

- v5.6.30: Fixed incomplete agent list (now shows all 19 agents), enhanced home directory error messages
- v5.6.29: Windows compatibility fix (spawn ENOENT errors)
- v5.6.23: ESLint rules for async/promise patterns
- v5.6.21: Peter agent (Best Practices Expert)
- v5.6.18-20: 21 critical bugs fixed (memory/timeout leaks)
- v5.6.15: ProcessManager singleton
- v5.6.13: 70% performance improvement (background health checks)
- v5.6.0: Parallel agent execution (40-60% faster workflows)

## Architecture

### Core Flow
```text
CLI → Router → TeamManager → ContextManager → AgentExecutor → Provider CLI
```

**Key Components**:

- **Router** (`src/core/router.ts`) - Provider fallback chain
- **TeamManager** (`src/core/team-manager.ts`) - 4 teams, shared config
- **AgentExecutor** (`src/agents/executor.ts`) - Delegation, retry, timeouts
- **MemoryManager** (`src/core/memory-manager.ts`) - SQLite FTS5
- **WorkspaceManager** (`src/core/workspace-manager.ts`) - PRD/tmp isolation
- **ProviderCache** (`src/core/provider-cache.ts`) - Adaptive TTL cache (30-120s)
- **ProcessManager** (`src/utils/process-manager.ts`) - Singleton for process lifecycle
- **SessionManager** (`src/core/session-manager.ts`) - Session-based execution tracking

### Teams & Agents

**4 Teams**: core (QA, Best Practices), engineering (dev), business (product), design (UX)

**19 Agents**: backend (Bob), frontend (Frank), fullstack, mobile, devops (Oliver), security, data (Dana), quality (Queenie), design, writer, product (Pete), cto (Tony), ceo (Eva), researcher (Rodman), quantum (Quinn), aerospace (Astrid), ml-engineer (Mira), marketer (Candy), best-practices (Peter)

**Specialist Agents**:
- Quinn (Quantum): Qiskit/Cirq, error correction - `maxDelegationDepth: 1`
- Astrid (Aerospace): Orbital mechanics, telemetry - `maxDelegationDepth: 1`
- Dana (Data Scientist): ML strategy, statistical analysis, model architecture
- Peter (Best Practices): SOLID, design patterns, clean code, refactoring

## Agent Selection Guide (v5.7.0)

**Quick Selection**:
- ML/Data Science: **Dana** (debugging, analysis, modeling)
- DL Implementation: **Mira** (training code, optimization, deployment)
- Backend/Systems: **Bob** (APIs, database, Go/Rust)
- Research/Feasibility: **Rodman** (studies, literature, evaluation)
- Code Quality: **Queenie** (review, refactoring, tests)
- Best Practices: **Peter** (SOLID, patterns) or **Tony** (architecture)

**Automated Selection**: `ax agent suggest "task description"` - Returns scored agent recommendations

**Disambiguation Rules**:
- "analysis" → Dana (data/ML), Bob (performance), Rodman (feasibility)
- "model" → Dana/Mira (ML), Rodman (mental model), Bob (data schema)
- "architecture" → Dana (ML), Tony/Peter (software), Bob (systems)
- "performance" → Dana (model accuracy), Mira (training), Bob (API/DB)

## Development Workflow

### Testing

```bash
npm test                   # All tests (unit + integration + smoke)
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:smoke         # Smoke tests (bash script)
npm run test:coverage      # Coverage report
npm run test:watch         # Watch mode

# Single test
npx vitest run tests/unit/router.test.ts

# Real providers (for E2E)
export TEST_REAL_PROVIDERS=true
export TEST_REAL_GEMINI_CLI=true
```

**Test Config**: 60s timeout, max 4 threads, auto-cleanup (clearMocks, mockReset, restoreMocks), memory monitoring (logHeapUsage)

### Debugging

```bash
ax --debug run <agent> "task"    # Debug mode
ax status                        # System health
ax config show                   # View config
AUTOMATOSX_DEBUG=true npm test   # Debug tests
```

## Configuration

### Priority Order
1. `.automatosx/config.json` (project)
2. `automatosx.config.json` (project root)
3. `~/.automatosx/config.json` (global)
4. `DEFAULT_CONFIG` (`src/types/config.ts`)

### Example Config

```json
{
  "providers": {
    "claude-code": { "enabled": true, "priority": 1, "timeout": 1500000 },
    "gemini-cli": { "enabled": true, "priority": 2, "timeout": 1500000 }
  },
  "execution": {
    "defaultTimeout": 1500000,
    "maxRetries": 3
  },
  "memory": {
    "enabled": true,
    "maxEntries": 10000
  }
}
```

## Common Tasks

### Build & Release Workflow

**Pre-build Configuration**:

```bash
# The build process automatically runs prebuild:config via npm hook
npm run build
# → Executes: node tools/prebuild-config.cjs (generates src/config.generated.ts)
# → Then: tsup (builds dist/)
```

**Version Bumping**:

```bash
npm run version:patch   # 5.6.34 → 5.6.35 (bug fixes)
npm run version:minor   # 5.6.34 → 5.7.0 (new features)
npm run version:major   # 5.6.34 → 6.0.0 (breaking changes)
npm run version:beta    # 5.6.34 → 5.6.35-beta.0 (pre-release)

# Auto-syncs: package.json → README.md, CLAUDE.md
# Auto-commits: "chore: bump version to X.X.X"
```

**Publishing to NPM**:

```bash
npm publish
# Auto-runs prepublishOnly hook:
# 1. npm run build (with prebuild:config)
# 2. npm run typecheck (strict TypeScript validation)
# 3. npm run test:all (all tests must pass)
# 4. Publishes to @defai.digital/automatosx
```

**CRITICAL**: The `prepublishOnly` hook skips tests in CI (`[ -n "$CI" ]`), but runs full test suite locally.

### Add New Agent

```bash
ax agent create <name> --template developer --interactive
# Manual: Create .automatosx/agents/<name>.yaml + abilities
```

### Add New Command

1. Create `src/cli/commands/my-command.ts`
2. Register in `src/cli/index.ts`
3. Add tests: `tests/unit/` + `tests/integration/`
4. Follow Conventional Commits

### Workspace Paths

**CRITICAL**: AutomatosX uses workspace isolation:

| Path | Purpose | Git Tracking |
|------|---------|--------------|
| `/tmp/` | User's project temporary directory | **NOT tracked** |
| `/automatosx/tmp/` | Agent workspace (isolated) | **NOT tracked** |
| `/automatosx/PRD/` | Planning documents | **NOT tracked** |

**Key Points**:
- Providers write to `automatosx/tmp/` for agent files
- User files go in project `/tmp/`
- ALL improvement plans/reviews MUST be in `/tmp/` folder
- See `docs/workspace-conventions.md`

## Key Features

### Parallel Execution (v5.6.0)

```bash
ax run <agent> "task" --parallel              # Enable
ax run <agent> "task" --show-dependency-graph # Visualize
```

**Performance**: 40-60% faster workflows, memory overhead <1%

### Provider Cache (v5.6.2-5.6.3)

- Adaptive TTL (30-120s)
- Background health checks (60s interval)
- 99% latency reduction (100ms → <1ms)

### Memory System (FTS5)

- SQLite FTS5 full-text search (< 1ms)
- Auto-sanitizes special chars & boolean operators
- Location: `.automatosx/memory/memories.db`

### Delegation Parser

- 7 patterns: `@agent`, `DELEGATE TO`, `please ask`, `I need`, Chinese
- Max depth: 2 (default), 3 (coordinators: Tony, Oliver, Dana)
- Auto cycle detection

### Checkpoints & Resume (v5.3.0)

```bash
ax run <agent> "task" --resumable  # Enable
ax resume <run-id>                 # Resume
ax runs list                       # List runs
```

## Integration Modes

**1. Claude Code (Recommended)**
- Natural language: `"please work with backend agent to implement auth API"`
- Auto agent selection, full context, error handling

**2. CLI Mode**
- Direct: `ax run backend "implement auth API"`
- For CI/CD, scripting, automation

**3. MCP Server**
- `ax mcp` - 90% faster, 16 tools, persistent state
- Setup: Add to `claude_desktop_config.json`

**4. Gemini CLI Integration** (v5.4.3-beta.0)
- `ax gemini setup` - Interactive setup
- Bidirectional command translation

## Important Files

**Core**:
- `src/cli/index.ts` - CLI entry
- `src/core/` - router, team-manager, memory-manager, session-manager, workspace-manager
- `src/agents/` - executor, delegation-parser, dependency-graph, parallel-agent-executor
- `src/providers/` - base-provider, claude-provider, gemini-provider, openai-provider
- `src/utils/` - path-utils, process-manager, version

**Config**:
- `automatosx.config.json` - Project config
- `tsconfig.json` - TypeScript strict mode
- `vitest.config.ts` - Test config

## Security

- Path validation (prevents traversal attacks)
- Workspace access control (PRD/tmp only)
- Input sanitization
- No arbitrary code execution
- MCP rate limit: 100 req/min

## Environment Variables

```bash
# Core
AUTOMATOSX_DEBUG=true             # Verbose logging
CLAUDE_USE_SESSION=true           # Session-based execution (default)

# Testing
TEST_REAL_PROVIDERS=true          # Real providers
TEST_REAL_GEMINI_CLI=true         # Real Gemini CLI
```

## Documentation

- **User**: README.md, FAQ.md, TROUBLESHOOTING.md, CHANGELOG.md
- **Developer**: CONTRIBUTING.md, docs/E2E-TESTING.md
- **Guides**: docs/ (Quick Start, Core Concepts, CLI Reference)
- **PRDs**: automatosx/PRD/ (Product Requirements Documents)

## Support

- Issues: https://github.com/defai-digital/automatosx/issues
- NPM: https://www.npmjs.com/package/@defai.digital/automatosx
