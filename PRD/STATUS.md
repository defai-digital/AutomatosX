# AutomatosX Project Status

## Overview

AutomatosX is a contract-first AI workflow orchestration system based on PRD v3.1. The architecture enforces AI-safe governance, behavioral invariants, and strict dependency boundaries.

## Current Status: Phase 4 Complete

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation & Contracts | Complete |
| 2 | Core Domain Logic | Complete |
| 3 | Adapters | Complete |
| 4 | Application Layer | Complete |
| 5 | Full CI/Governance | Pending |

**Last validated:** 2024-12-14
- TypeScript: Pass
- ESLint: Pass
- Dependency-cruiser: 177 modules, 320 dependencies, 0 violations
- Tests: 186 passing (12 test files)

---

## Architecture

```
automatosx/
├── packages/
│   ├── contracts/        # SSOT - Schema + Behavioral Invariants
│   ├── core/             # Pure business logic
│   │   ├── workflow-engine/
│   │   ├── routing-engine/
│   │   ├── memory-domain/
│   │   └── trace-domain/
│   ├── adapters/         # External integrations
│   │   └── sqlite/
│   ├── cli/              # Command-line interface
│   └── mcp-server/       # MCP protocol server
└── tests/
    ├── contract/
    ├── core/
    ├── adapters/
    └── application/
```

### Dependency Rules (Enforced)

| From \ To   | contracts | core | adapters | cli | mcp-server |
|-------------|-----------|------|----------|-----|------------|
| contracts   | -         | No   | No       | No  | No         |
| core        | Yes       | -    | No       | No  | No         |
| adapters    | Yes       | Yes  | -        | No  | No         |
| cli         | Yes       | Yes  | No       | -   | No         |
| mcp-server  | Yes       | Yes  | No       | No  | -          |

---

## Phase Summaries

### Phase 1: Foundation & Contracts

**Deliverables:**
- pnpm monorepo with workspace configuration
- TypeScript strict mode (`exactOptionalPropertyTypes: true`)
- ESLint flat config
- Vitest test runner
- dependency-cruiser boundary enforcement

**Contracts (JSON Schema + Zod):**
- `workflow/v1` - Workflow definition, steps, retry policies
- `mcp/v1` - MCP tool definitions, input/output schemas
- `routing/v1` - Model selection decisions, budget constraints
- `memory/v1` - Event sourcing, immutable events
- `trace/v1` - Execution traces, event types

**Tests:** 81 contract validation tests

---

### Phase 2: Core Domain Logic

**Packages:**

| Package | Description | Key Exports |
|---------|-------------|-------------|
| `@automatosx/workflow-engine` | Workflow execution | `createWorkflowRunner`, `WorkflowRunner` |
| `@automatosx/routing-engine` | Model routing decisions | `createRoutingEngine`, `RoutingEngine` |
| `@automatosx/memory-domain` | Event store interface | `createMemoryDomain`, `MemoryDomain` |
| `@automatosx/trace-domain` | Trace collection | `createTraceDomain`, `TraceDomain` |

**Key Features:**
- Step execution with retry policies
- Budget-aware model routing
- Deterministic routing (same input = same output)
- Immutable event storage
- Complete trace event chains

**Tests:** 55 core domain tests

---

### Phase 3: Adapters

**Package:** `@automatosx/sqlite-adapter`

**Stores:**
- `WorkflowStore` - Workflow CRUD operations
- `TraceStore` - Trace and event persistence
- `MemoryStore` - Key-value with namespace support

**Features:**
- SQLite via better-sqlite3
- Auto-migration on initialization
- Correlation ID support for related operations
- Ordered event retrieval

**Tests:** 15 adapter tests

---

### Phase 4: Application Layer

**CLI (`@automatosx/cli`):**

| Command | Description |
|---------|-------------|
| `run <workflow-id>` | Execute a workflow |
| `list [--status]` | List available workflows |
| `trace <trace-id>` | View trace details |
| `help` | Show help |
| `version` | Show version |

**MCP Server (`@automatosx/mcp-server`):**

| Tool | Description |
|------|-------------|
| `workflow_run` | Execute workflow by ID |
| `workflow_list` | List available workflows |
| `workflow_describe` | Get workflow details |
| `trace_list` | List recent traces |
| `trace_get` | Get trace details |
| `trace_analyze` | Analyze trace performance |
| `memory_store` | Store value by key |
| `memory_retrieve` | Retrieve value by key |
| `memory_search` | Search memory by query |

**Protocol:** JSON-RPC 2.0 over STDIO

**Tests:** 35 application tests

---

## Phase 5: Full CI/Governance (TODO)

### 5.1 GitHub Actions CI Pipeline

- [ ] Create `.github/workflows/ci.yml`
- [ ] Run on push to main and pull requests
- [ ] Jobs: typecheck, lint, test, deps-check
- [ ] Node.js matrix (18.x, 20.x, 22.x)
- [ ] pnpm caching for faster builds
- [ ] Fail-fast on first error

```yaml
# Example structure
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm eslint
      - run: pnpm deps:check
      - run: pnpm test
```

### 5.2 Branch Protection

- [ ] Require CI to pass before merge
- [ ] Require pull request reviews
- [ ] Prevent force push to main
- [ ] Require linear history (optional)

### 5.3 Code Coverage

- [ ] Add coverage reporter to vitest config
- [ ] Generate coverage reports in CI
- [ ] Set minimum coverage threshold (e.g., 80%)
- [ ] Upload coverage to service (Codecov/Coveralls)

```typescript
// vitest.config.ts addition
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  thresholds: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
}
```

### 5.4 Mutation Testing (Optional)

- [ ] Add Stryker mutator
- [ ] Configure mutation score threshold (PRD: >= 80%)
- [ ] Run on CI (can be slow, consider nightly)

### 5.5 Release Automation

- [ ] Add changesets for version management
- [ ] Automated changelog generation
- [ ] npm publish workflow (if publishing packages)
- [ ] Git tags for releases

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

### 5.6 Metrics Collection (PRD Requirements)

- [ ] Latency tracking per step
- [ ] Token usage per routing decision
- [ ] Cache hit rate monitoring
- [ ] Error rate by workflow/step
- [ ] Dashboard or logging integration

### 5.7 Contract Compatibility Checks

- [ ] Schema backward compatibility validation
- [ ] Breaking change detection on PR
- [ ] Automated migration generation (if needed)

---

## Validation Commands

```bash
# Run all validations
pnpm typecheck && pnpm eslint && pnpm deps:check && pnpm test

# Individual checks
pnpm typecheck      # TypeScript compilation
pnpm eslint         # Linting
pnpm deps:check     # Dependency boundaries
pnpm test           # Unit tests

# Build all packages
pnpm build
```

---

## Notes

### Current Limitations

1. **Mock Data in Application Layer**
   - CLI and MCP server use hardcoded sample data
   - Not yet wired to SQLite adapter for persistence
   - Recommended next step: integrate real persistence

2. **No LLM Provider Integration**
   - Routing engine makes decisions but doesn't call actual APIs
   - Provider adapters would be needed for real execution

3. **No Authentication/Authorization**
   - MCP server accepts all requests
   - Would need auth layer for production use

### Recommended Next Steps (Before Phase 5)

1. Wire CLI/MCP server to SQLite adapter
2. Add workflow registry (store/retrieve real workflows)
3. Connect trace collection to actual workflow runs
4. End-to-end integration test

---

## References

- Plan file: `.claude/plans/tingly-toasting-sparkle.md`
- PRD: v3.1 (AI-safe governance, behavioral invariants)
