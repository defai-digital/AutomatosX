# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

Store all temporary files and generated reports in `automatosx/tmp/`.
Store all PRD (Product Requirement Document) files in `automatosx/prd/`.

## Commands

```bash
# Build all packages
npm run build

# Run all tests
npm test

# Run a specific test file
npx vitest run packages/cli/tests/cli-dispatch.test.ts

# Run tests for a specific package
npm run test:cli           # packages/cli/tests
npm run test:migration     # tests/migration

# Type-check (same as build)
npm run typecheck

# Clean build artifacts
npm run clean
```

## Architecture

AutomatosX v14 is a monorepo combining two lineages: workflow-first UX from v11.4 and modular runtime/MCP surface from v13.5. All packages are scoped as `@defai.digital/*` and use ES modules (`.mjs` output, Node 20+ required; state-store/trace-store/shared-runtime require Node 22.5+ for `node:sqlite`).

**Dependency order (foundational → surface):**

```
contracts  →  workflow-engine  →  shared-runtime  →  cli
                                         ↑             ↗
                             state-store / trace-store
                                         ↑
                                    mcp-server
                                         ↑
                                     monitoring
```

### Key packages

| Package | Role |
|---|---|
| `contracts` | Zod schemas and TypeScript types — single source of truth; zero dependencies |
| `workflow-engine` | Loads YAML/JSON workflows, executes steps, enforces guards and retry policy |
| `shared-runtime` | Core orchestration service used by both CLI and MCP; manages traces, provider bridges |
| `state-store` | Persists memory, agents, policies, semantic data, feedback, sessions (JSON or SQLite) |
| `trace-store` | Persists workflow execution traces (JSON or SQLite) |
| `cli` | `ax` binary; 35+ commands dispatching to shared-runtime |
| `mcp-server` | MCP JSON-RPC 2.0 tool surface on top of shared-runtime |
| `monitoring` | Trace-level dashboard visibility helpers |

### Workflow execution pipeline

```
WorkflowLoader → WorkflowRunner → StepExecutor (per step type)
                       ↓
               StepGuardEngine  (pre/post governance gates)
                       ↓
           TraceStore + StateStore  (persistence)
```

Step types: `prompt | tool | conditional | loop | parallel | discuss | delegate` — all 7 fully implemented.

### Dual surface pattern

CLI (`packages/cli`) and MCP (`packages/mcp-server`) are thin adapters — all orchestration logic lives in `shared-runtime`. New features belong in shared-runtime, not duplicated across surfaces.

### Delegate step

The `delegate` step type routes execution to a registered agent via `DelegateExecutorLike` (defined in `workflow-engine/src/step-executor-factory.ts`). Pass a `delegateExecutor` in `RealStepExecutorConfig`. It enforces two invariants from v13.5:
- **INV-DT-001**: Depth never exceeds `maxDelegationDepth` (default 3)
- **INV-DT-002**: No circular delegations

Required config field: `targetAgentId`. Optional: `task`, `input`.

### Contract-first rule

All domain types and schemas live in `packages/contracts`. Other packages import from `@defai.digital/contracts`; never define domain types locally.

### Testing

Tests are co-located (`packages/*/tests/*.test.ts`) and use Vitest with the Node environment. The `vitest.config.ts` shims `node:sqlite` for packages that need it and resolves all `@defai.digital/*` aliases directly to TypeScript source (no build step needed for tests).
