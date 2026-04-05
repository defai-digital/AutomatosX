# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

Store all temporary files and generated reports in `automatosx/tmp/`.
Store all PRD (Product Requirement Document) files in `automatosx/prd/`.

## Commands

```bash
# Build all packages (respects dependency order via tools/build-workspaces.ts)
npm run build

# Run all tests
npm test

# Run a specific test file
npx vitest run packages/cli/tests/cli-dispatch.test.ts

# Run tests for a specific package
npm run test:cli              # packages/cli/tests
npm run test:shared-runtime   # packages/shared-runtime/tests
npm run test:migration        # tests/migration

# Type-check (no emit)
npm run typecheck

# Clean build artifacts
npm run clean
```

## Architecture

AutomatosX v14 is a monorepo (npm workspaces) being repositioned as **AX Trust** — trusted execution and governance for AI software delivery. All packages are scoped as `@defai.digital/*`, use ES modules (`.mjs` output), and require Node >= 22.5.0 (for `node:sqlite`).

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

### Dual surface pattern

CLI (`packages/cli`) and MCP (`packages/mcp-server`) are thin adapters — all orchestration logic lives in `shared-runtime`. New features belong in shared-runtime, not duplicated across surfaces.

### Workflow execution pipeline

```
WorkflowLoader → WorkflowRunner → StepExecutor (per step type)
                       ↓
               StepGuardEngine  (pre/post governance gates)
                       ↓
           TraceStore + StateStore  (persistence)
```

Step types: `prompt | tool | conditional | loop | parallel | discuss | delegate` — all 7 fully implemented.

### Contract-first rule

All domain types and schemas live in `packages/contracts`. Other packages import from `@defai.digital/contracts`; never define domain types locally.

### Delegate step

The `delegate` step type routes execution to a registered agent via `DelegateExecutorLike` (defined in `workflow-engine/src/step-executor-factory.ts`). Pass a `delegateExecutor` in `RealStepExecutorConfig`. Enforced invariants:
- **INV-DT-001**: Depth never exceeds `maxDelegationDepth` (default 3)
- **INV-DT-002**: No circular delegations

Required config field: `targetAgentId`. Optional: `task`, `input`.

## Module conventions

- **ES modules throughout** — all imports must use `.js` extensions even for TypeScript source (e.g., `from './loader.js'` not `from './loader'`).
- **JSON imports** use assertion syntax: `import pkg from '../package.json' with { type: 'json' };`
- **Path aliases** (`@defai.digital/*`) resolve to TypeScript source in tests (via `vitest.config.ts`) and to built output in production (via `tsconfig.json` paths).

## CLI command registration

To add a new CLI command:

1. Create `packages/cli/src/commands/<name>.ts` exporting `<name>Command(args, options)`.
2. Re-export from `packages/cli/src/commands/index.ts`.
3. Add entry in `command-manifest.ts` (registry).
4. Add entry in `command-metadata.ts` (usage, description, category, stability).

Commands return `CommandResult` via builders `success(message, data)` and `failure(message, exitCode)` from `utils/formatters.ts`. Categories: `root | workflow | retained | advanced`.

## Commit conventions

Commits are validated by commitlint (husky `commit-msg` hook) using conventional commit format:

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`. Subject max 100 chars. Scope is typically a package name (e.g., `shared-runtime`, `cli`, `contracts`).

The `pre-commit` hook runs `npm run typecheck && npm test` — both must pass before committing.

## Testing

Tests are co-located (`packages/*/tests/*.test.ts`) and use Vitest with the Node environment. The `vitest.config.ts` shims `node:sqlite` for packages that need it and resolves all `@defai.digital/*` aliases directly to TypeScript source (no build step needed for tests).

## Key invariants

The codebase enforces safety invariants documented inline with `INV-<CODE>` identifiers:

- **INV-DT-001/002**: Delegation depth and circularity guards (workflow-engine)
- **INV-WF-SEC-001**: Blocks `__proto__`/`constructor`/`prototype` traversal in workflow conditions
- **INV-WF-COND-001/002**: Balanced parentheses and equality operator rules in conditions
- **INV-CP-001/002**: Checkpoint data integrity and monotonic step index ordering

## Workflow artifacts

Workflow execution produces artifacts at:
```
.automatosx/workflows/<workflow-id>/<trace-id>/
  ├── manifest.json
  ├── summary.json
  └── artifacts/*.md
```

Status lifecycle: `pending → preview (dry-run) | dispatched (success) | failed`
