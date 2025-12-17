# AutomatosX - Project Context for Gemini

## Project Overview

**AutomatosX** is a contract-first AI orchestration platform that unifies multiple LLM providers (Claude, Gemini, Codex, etc.) through CLI adapters. It operates as a "pure orchestrator," delegating authentication to external tools while providing deterministic routing, event-sourced memory, execution tracing, and governance.

**Key Principles:**
- **Pure Orchestrator:** Does not manage API keys directly; relies on external CLIs.
- **Contract-First:** All data flows are validated against Zod schemas in `@automatosx/contracts`.
- **Deterministic Routing:** Model selection is based on risk levels and capabilities.
- **Event-Sourced Memory:** Full conversation history replay and auditability.

## Architecture & Structure

This is a **TypeScript Monorepo** managed by `pnpm`.

### Core Directory Structure

```text
/
├── packages/
│   ├── contracts/          # Zod schemas (Single Source of Truth) - START HERE for data changes
│   ├── cli/                # CLI Entry points (@automatosx/cli)
│   ├── core/               # Domain Logic
│   │   ├── workflow-engine/# Step execution logic
│   │   ├── routing-engine/ # Model selection logic
│   │   ├── memory-domain/  # Event-sourced state
│   │   ├── trace-domain/   # Execution tracing
│   │   └── ...
│   ├── adapters/
│   │   ├── providers/      # Integration with external CLIs (Claude, Gemini, etc.)
│   │   └── sqlite/         # Persistence
│   ├── guard/              # Governance and policy enforcement
│   └── mcp-server/         # Model Context Protocol server
├── tests/                  # Shared unit and integration tests
│   ├── core/               # Domain-specific unit tests
│   ├── integration/        # End-to-end flows
│   └── ...
├── examples/               # Example configurations and workflows
└── docs/                   # Documentation
```

### Key Packages
- **`@automatosx/contracts`**: Defines the data shapes and invariants. Any change to data structures must happen here first.
- **`@automatosx/cli`**: The main interface (`ax` command).
- **`@automatosx/mcp-server`**: Allows AutomatosX to serve as a backend for MCP-compatible tools (like Claude Code).

## Development Workflow

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.15.0
- External Provider CLIs (e.g., `claude`, `gemini`) installed for full functionality.

### Build & Run
- **Install:** `pnpm install`
- **Build:** `pnpm build` (Uses `tsc --build` for project references)
- **Setup:** `pnpm ax setup` (Initial configuration)

### Verification (The "Golden Rule")
Before submitting changes, run the full validation suite:
```bash
pnpm validate
```
This runs:
1.  Typecheck (`pnpm typecheck`)
2.  Linting (`pnpm lint`)
3.  Dependency Check (`pnpm deps:check`)
4.  Tests (`pnpm test`)

### Testing
- **Framework:** Vitest
- **Run All:** `pnpm test`
- **Watch Mode:** `pnpm test:watch`
- **Specific File:** `pnpm vitest run tests/core/routing-engine.test.ts`
- **Conventions:**
    - Unit tests: `tests/<domain>/*.test.ts`
    - Integration tests: `tests/integration/*.test.ts`

## Coding Standards & Conventions

1.  **TypeScript Strictness:**
    - No `any`.
    - Explicit return types are required.
    - Strict boolean expressions.
    - Unused arguments must be prefixed with `_`.

2.  **Architecture Invariants:**
    - **Contract-First:** Modify `@automatosx/contracts` before implementing logic changes.
    - **No Side Effects:** Core domain logic (like routing or memory) should be pure where possible; side effects belong in adapters or the workflow engine.
    - **Immutable Events:** Memory events are never modified after storage.

3.  **Dependency Management:**
    - Adhere to boundaries defined in `.dependency-cruiser.cjs`.
    - Run `pnpm deps:check` to ensure no circular or forbidden dependencies.

## Useful Commands

| Command | Description |
| :--- | :--- |
| `pnpm ax doctor` | Check system health and provider connectivity. |
| `pnpm ax call <provider> "..."` | Direct call to a provider CLI for testing. |
| `pnpm ax trace` | View execution traces (debugging). |
| `pnpm ax guard check` | Run governance checks on code. |
| `pnpm lint:fix` | Auto-fix linting errors. |
