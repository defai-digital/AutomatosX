# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages (required before running CLI or tests)
pnpm build

# Type check all packages
pnpm typecheck

# Run all tests
pnpm test

# Run specific test file
pnpm vitest run tests/core/routing-engine.test.ts

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint
pnpm lint:fix

# Check dependency boundaries
pnpm deps:check

# Full validation (typecheck + lint + deps + tests)
pnpm validate

# Run CLI (after build)
pnpm ax <command>
# Examples:
pnpm ax setup                               # Global setup (one-time)
pnpm ax init                                # Per-project init (MCP registration)
pnpm ax doctor                              # Check provider health
pnpm ax call claude "..."                   # Direct provider call
pnpm ax agent list                          # List agents
pnpm ax scaffold project my-app -m order    # Scaffold new project
pnpm ax scaffold contract billing           # Scaffold contract
pnpm ax scaffold domain billing             # Scaffold domain
```

## Setup vs Init

- **`ax setup`**: Global, one-time setup. Detects provider CLIs and creates global config at `~/.automatosx/`.
- **`ax init`**: Per-project initialization. Creates `.automatosx/` in current directory and registers MCP with provider CLIs. Run this in each project directory.

## Architecture Overview

AutomatosX is a **contract-first AI orchestration platform** that unifies multiple LLM providers through CLI adapters. Core principle: AutomatosX is a pure orchestrator - all authentication is delegated to external CLI tools.

**Monorepo structure**: Uses pnpm workspaces. All packages use `@defai.digital/` scope and are published to npm. Package aliases are configured in `vitest.config.ts` for testing.

### Package Dependency Layers (Strictly Enforced)

```
┌─────────────────────────────────────────────────────┐
│  CLI / MCP Server (application layer)              │
├─────────────────────────────────────────────────────┤
│  Guard (governance gates)                          │
├─────────────────────────────────────────────────────┤
│  Core Domains (business logic)                     │
│  - routing-engine, workflow-engine, memory-domain  │
│  - trace-domain, session-domain, agent-domain      │
│  - config-domain, resilience-domain, etc.          │
├─────────────────────────────────────────────────────┤
│  Adapters (external integrations)                  │
│  - providers (CLI adapters for LLMs)               │
│  - sqlite (persistence)                            │
├─────────────────────────────────────────────────────┤
│  Contracts (Zod schemas - Single Source of Truth)  │
└─────────────────────────────────────────────────────┘
```

**Dependency Rules** (enforced by `.dependency-cruiser.cjs`):
- `contracts` → ZERO internal dependencies (pure schemas)
- `core/*` → only contracts (and other core packages)
- `adapters/*` → contracts and core only
- `cli`, `mcp-server` → contracts and core only (NOT adapters directly)
- **Exception**: `bootstrap.ts` files are composition roots - they ARE allowed to import adapters
- No circular dependencies allowed

### Key Directories

| Path | Purpose |
|------|---------|
| `packages/contracts/src/*/v1/` | Zod schemas with `schema.ts`, `invariants.md`, optional JSON schemas |
| `packages/core/*/src/` | Domain logic implementations |
| `packages/adapters/providers/src/` | CLI-based LLM provider adapters (claude, gemini, codex, etc.) |
| `packages/mcp-server/src/tools/` | MCP tool implementations |
| `templates/` | Project scaffold templates (monorepo, standalone) |
| `tests/contract/` | Contract validation tests |
| `tests/core/` | Domain logic unit tests |
| `tests/integration/` | Integration tests |
| `tests/application/` | E2E tests |
| `tests/cli/` | CLI command tests |
| `packages/guard/src/` | Governance gate implementations |

### Contract-First Design

All external behavior is defined in contracts (`packages/contracts`). Each domain has:
- `schema.ts` - Zod schemas (the source of truth)
- `invariants.md` - Behavioral guarantees that MUST be enforced
- Optional `.schema.json` - JSON Schema exports

When modifying behavior, **update the contract first**, then update implementation and tests.

### Invariants

Key invariants documented in `packages/contracts/src/*/v1/invariants.md`:

- **INV-RT-001**: Routing decisions are deterministic (same input = same output)
- **INV-RT-002**: High risk never selects experimental models
- **INV-MEM-001**: Memory events are immutable after storage
- **INV-TR-001**: Every trace has run.start and run.end events
- **INV-MCP-001**: All MCP tools validate inputs via Zod schemas

### Provider Architecture

Providers use external CLI tools - AutomatosX does NOT manage credentials:
- `claude` - [Claude Code](https://github.com/anthropics/claude-code)
- `gemini` - [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- `codex` - [Codex CLI](https://github.com/openai/codex)
- `ax-grok` - [ax-cli](https://github.com/defai-digital/ax-cli) Grok wrapper (XAI_API_KEY)
- `antigravity` - [Google Antigravity](https://developers.google.com/agentic-experience)
- `opencode` - [OpenCode](https://github.com/opencode-ai/opencode)

Provider configurations are centralized in `packages/cli/src/bootstrap.ts` (PROVIDER_CONFIGS).

### Test Organization

Tests mirror the architecture layers:
- `tests/contract/*.test.ts` - Schema validation, invariant enforcement
- `tests/core/*.test.ts` - Domain logic unit tests
- `tests/integration/*.test.ts` - Cross-package integration
- `tests/application/*.test.ts` - Full E2E flows

Use Vitest with the `--run` flag for single runs. The config in `vitest.config.ts` sets up path aliases matching the monorepo structure.

## Design Decisions

- **No cost-based routing**: Cost calculations excluded by design as costs change frequently
- **Event-sourced memory**: Full replay capability for conversation state
- **Guard system**: Post-check governance gates enforce policy compliance after AI code generation
- **CLI-only providers**: Simplifies credential management, leverages existing auth flows
- **Dependency injection for executors**: Core domains provide stub implementations with runtime warnings; production code injects real executors via config
- **Hexagonal Architecture**: CLI/MCP Server depend on port interfaces; only `bootstrap.ts` knows about concrete adapter implementations

## Multi-Model Discussions

The `ax discuss` command enables multi-model collaboration where multiple AI providers discuss a topic and reach consensus:

```bash
# Quick synthesis (default: 2 rounds, claude/grok/gemini)
pnpm ax discuss "Best approach for caching?"

# Structured patterns
pnpm ax discuss --pattern debate "REST vs GraphQL"   # Pros/cons debate
pnpm ax discuss --pattern voting "React vs Vue"      # Voting on options
pnpm ax discuss --pattern critique "Review this API" # Critique mode
```

Key files:
- `packages/core/discussion-domain/src/` - Discussion orchestration
- `packages/contracts/src/discussion/v1/schema.ts` - Discussion contracts
- `packages/cli/src/commands/discuss.ts` - CLI command

## Environment Variables

- `AX_STORAGE` - Storage mode: `sqlite` (default) or `memory`
- `AX_MCP_TOOL_PREFIX` - Optional prefix for MCP tool names (e.g., `ax_`)

## Storage Architecture

Storage mode controlled by `AX_STORAGE` environment variable:
- `sqlite` (default): Persistent storage at `~/.automatosx/data.db`
- `memory`: In-memory storage (data lost between invocations)

SQLite is preferred; falls back to in-memory if unavailable.

## MCP Server Tools

MCP tools in `packages/mcp-server/src/tools/` are organized by domain:
- `workflow.ts` - Workflow execution (`workflow_run`, `workflow_list`, `workflow_describe`)
- `agent.ts` - Agent management (`agent_list`, `agent_run`, `agent_get`, `agent_register`)
- `session.ts` - Collaboration sessions (`session_create`, `session_join`, `session_complete`)
- `memory.ts` - Key-value memory (`memory_store`, `memory_retrieve`, `memory_search`)
- `trace.ts` - Execution traces (`trace_list`, `trace_get`, `trace_analyze`)
- `guard.ts` - Governance gates (`guard_check`, `guard_list`, `guard_apply`)
- `bugfix.ts` - Bug detection/fixing (`bugfix_scan`, `bugfix_run`, `bugfix_list`)
- `refactor.ts` - Refactoring (`refactor_scan`, `refactor_apply`, `refactor_list`)
- `ability.ts` - Ability injection (`ability_list`, `ability_inject`)
- `config.ts` - Configuration (`config_get`, `config_set`, `config_show`)

## Guard System

Built-in policies:
- `provider-refactor` - Provider adapter changes (2 package radius)
- `bugfix` - Bug fixes (3 package radius)
- `rebuild` - Major refactoring (10 package radius)

Gates in `packages/guard/src/gates/`:
- `path.ts` - Enforce allowed/forbidden paths
- `change-radius.ts` - Limit number of packages modified
- `dependency.ts` - Check import boundaries
- `contract-tests.ts` - Verify contract tests pass
- `secrets.ts` - Detect potential secrets in code

## Scaffold System

The CLI provides contract-first scaffolding for creating new projects, domains, and guard policies.

### Commands

```bash
# Create a new project from template
pnpm ax scaffold project <name> -m <domain> [-t monorepo|standalone] [-s @scope]

# Scaffold contract (Zod schemas + invariants)
pnpm ax scaffold contract <name> [-d description] [--dry-run]

# Scaffold domain implementation
pnpm ax scaffold domain <name> [--no-tests] [--no-guard]

# Scaffold guard policy
pnpm ax scaffold guard <policy-id> [-r radius] [-g gates]
```

### Templates

Templates are in `templates/`:
- `templates/monorepo/` - Multi-package monorepo structure
- `templates/standalone/` - Single-package project structure

Each template has:
- `template.json` - Configuration and structure definition
- `*.hbs` - Handlebars template files

### Template Variables

- `{{projectName}}` - Project name
- `{{domainName}}` - Domain name
- `{{scope}}` - NPM package scope
- `{{pascalCase domainName}}` - PascalCase domain name
- `{{upperCase (substring domainName 0 3)}}` - 3-letter domain code

### Invariant Naming

Invariants follow the pattern `INV-XXX-NNN`:
- `XXX` - 3-letter domain code (e.g., ORD, PAY)
- `NNN` - Sequence number
  - `001-099` - Schema invariants
  - `100-199` - Runtime invariants
  - `200-299` - Business invariants
  - `300-399` - Cross-aggregate invariants

## Adding New Components

### Adding a New Provider

1. Add config in `packages/adapters/providers/src/configs/` (follow existing pattern)
2. Export from `packages/adapters/providers/src/index.ts`
3. Register in `packages/cli/src/bootstrap.ts` `PROVIDER_CONFIGS`
4. Add to README provider table

### Adding a New Contract Domain

1. Create `packages/contracts/src/<domain>/v1/` directory
2. Add `schema.ts` with Zod schemas
3. Add `invariants.md` documenting behavioral guarantees
4. Export from `packages/contracts/src/index.ts`
5. Run `pnpm contracts:check` to validate

Or use scaffolding: `pnpm ax scaffold contract <domain-name>`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" after adding package | Run `pnpm build` to compile TypeScript |
| Dependency cruiser failing | Check import in `bootstrap.ts` not elsewhere |
| Provider not found | Run `pnpm ax doctor` to check provider health |
| SQLite errors | Set `AX_STORAGE=memory` to use in-memory storage |
| Tests failing with alias errors | Add package alias to `vitest.config.ts` |
| Type errors after contract changes | Run `pnpm typecheck` to see all affected files |
| MCP not working in new project | Run `ax init` to register MCP with providers |
| `ax setup` says "providers changed" | Run `ax setup --force` to update configuration |
