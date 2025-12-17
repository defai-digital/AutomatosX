# PRD: Architecture Compliance & Quality Improvement

## Executive Summary

This PRD addresses architectural violations found in the AutomatosX codebase:

### Category A: Package Layer Violations
1. **3 packages in wrong layer** - Should be under `packages/core/`
2. **5 contracts missing `schema.ts`** - Schemas fragmented across multiple files
3. **1 empty storage contract** - No schema or invariants defined
4. **4 misplaced test files** - Tests not in correct layer directories

### Category B: Dependency & Structure Violations (Existing)
1. **15 contracts missing `invariants.md`** - Behavioral guarantees not documented
2. **2 circular dependency cycles** - In MCP server module
3. **18 dependency layer violations** - Direct adapter imports from application/core layers

**Goal:** Achieve 100% compliance with the contract-first, layered architecture.

---

## Category A: New Violations Discovered

### A1. Packages in Wrong Layer

| Package | Current Location | Correct Location |
|---------|-----------------|------------------|
| `@automatosx/agent-execution` | `packages/agent-execution/` | `packages/core/agent-execution/` |
| `@automatosx/cross-cutting` | `packages/cross-cutting/` | `packages/core/cross-cutting/` |
| `@automatosx/provider-domain` | `packages/provider-domain/` | `packages/core/provider-domain/` |

**Note:** `packages/guard/` is intentionally kept as a special governance layer between core and application.

### A2. Contracts Missing Consolidated `schema.ts`

| Contract | Issue | Files to Consolidate |
|----------|-------|---------------------|
| `config/v1` | Schemas split across 4 files | `config.ts`, `operations.ts`, `events.ts`, `provider-config.ts` |
| `guard/v1` | Wrong file naming | `policy.schema.ts` should be `schema.ts` |
| `provider/v1` | Schemas split across 4 files | `circuit-breaker.ts`, `health.ts`, `port.ts`, `rate-limit.ts` |
| `resilience/v1` | Schemas split across 5 files | `circuit-breaker.ts`, `loop-guard.ts`, `metrics.ts`, `rate-limiter.ts`, `resource-limits.ts` |
| `cross-cutting/v1` | Schemas split across 4 files | `dead-letter.ts`, `idempotency.ts`, `retention.ts`, `saga.ts` |

### A3. Empty Storage Contract

- `packages/contracts/src/storage/v1/` - Directory exists but is completely empty
- Needs: `schema.ts`, `index.ts`, `invariants.md`

### A4. Misplaced Test Files

| Current Location | Correct Location | Reason |
|------------------|------------------|--------|
| `tests/application/resilience-domain.test.ts` | `tests/core/resilience-domain.test.ts` | Tests core domain logic |
| `tests/cross-cutting/cross-cutting.test.ts` | `tests/contract/cross-cutting.test.ts` | Tests contract schemas |
| `tests/guard/agent-policy.test.ts` | `tests/contract/guard-policy.test.ts` | Tests contract validation |
| `tests/guard/gate-invariants.test.ts` | `tests/contract/guard-invariants.test.ts` | Tests invariants |

---

## Category B: Existing Violations

---

## Problem Analysis

### Current Architecture (Intended)

```
┌─────────────────────────────────────┐
│  CLI / MCP Server (application)     │  → Can use: core, contracts
├─────────────────────────────────────┤
│  Guard (governance)                 │  → Can use: core, contracts
├─────────────────────────────────────┤
│  Core Domains (business logic)      │  → Can use: contracts ONLY
├─────────────────────────────────────┤
│  Adapters (sqlite, providers)       │  → Can use: contracts, core
├─────────────────────────────────────┤
│  Contracts (Zod schemas)            │  → ZERO dependencies
└─────────────────────────────────────┘
```

### Current Violations

| Layer | Violation | Files Affected |
|-------|-----------|----------------|
| MCP Server | Imports `@automatosx/provider-adapters` | `shared-registry.ts` |
| MCP Server | Circular imports | `agent.ts ↔ shared-registry.ts ↔ tools/index.ts` |
| Core | agent-domain imports `@automatosx/agent-execution` | `executor.ts`, `enhanced-executor.ts` |
| CLI | Imports `@automatosx/sqlite-adapter` | `storage-instances.ts` |
| CLI | Imports `@automatosx/provider-adapters` | `provider-factory.ts`, `call.ts` |

---

## Solution Design

### Principle: Ports & Adapters (Hexagonal Architecture)

Instead of importing adapters directly, we:
1. **Define interfaces (ports)** in contracts or core domains
2. **Implement adapters** that satisfy these interfaces
3. **Wire everything** at composition root (main entry point)

### Phase 1: Break Circular Dependencies

**Problem:** MCP server has circular imports:
```
agent.ts → shared-registry.ts → tools/index.ts → agent.ts
shared-registry.ts → tools/index.ts → ability.ts → shared-registry.ts
```

**Solution:** Extract shared types and lazy initialization.

#### 1.1 Create `packages/mcp-server/src/registry-types.ts`

```typescript
/**
 * Registry Types - Shared interfaces to break circular dependencies
 */
import type { AgentRegistry, AgentExecutor } from '@automatosx/agent-domain';
import type { AbilityRegistry, AbilityManager } from '@automatosx/ability-domain';

export interface SharedRegistryState {
  agentRegistry: AgentRegistry | null;
  agentExecutor: AgentExecutor | null;
  abilityRegistry: AbilityRegistry | null;
  abilityManager: AbilityManager | null;
  initialized: boolean;
}

export interface RegistryAccessor {
  getAgentRegistry(): AgentRegistry;
  getAgentExecutor(): AgentExecutor;
  getAbilityRegistry(): AbilityRegistry;
  getAbilityManager(): AbilityManager;
  isInitialized(): boolean;
}
```

#### 1.2 Refactor `shared-registry.ts`

- Remove direct import of `TOOL_HANDLERS` from `tools/index.ts`
- Use lazy initialization pattern
- Export accessor functions, not singletons

#### 1.3 Refactor tool files (`agent.ts`, `ability.ts`)

- Import from `registry-types.ts` instead of `shared-registry.ts`
- Receive registry via parameter injection

---

### Phase 2: Fix Dependency Layer Violations

#### 2.1 Define Provider Port in Contracts

**New File:** `packages/contracts/src/provider/v1/port.ts`

```typescript
/**
 * Provider Port - Interface for LLM provider access
 *
 * This is the contract that adapters implement and application layer uses.
 * Following Ports & Adapters pattern.
 */
import { z } from 'zod';

export const ProviderRequestSchema = z.object({
  requestId: z.string().uuid(),
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const ProviderResponseSchema = z.object({
  requestId: z.string().uuid(),
  success: z.boolean(),
  content: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  usage: z.object({
    promptTokens: z.number().int(),
    completionTokens: z.number().int(),
  }).optional(),
});

export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;

/**
 * Provider Port Interface
 *
 * INV-PROV-PORT-001: Implementations must validate requests
 * INV-PROV-PORT-002: Responses must match schema
 * INV-PROV-PORT-003: Errors must not throw, return error response
 */
export interface ProviderPort {
  readonly providerId: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  isAvailable(): Promise<boolean>;
}

/**
 * Provider Registry Port Interface
 */
export interface ProviderRegistryPort {
  getProvider(providerId: string): ProviderPort | undefined;
  getDefaultProvider(): ProviderPort | undefined;
  listProviders(): string[];
}
```

#### 2.2 Define Storage Port in Contracts

**New File:** `packages/contracts/src/storage/v1/port.ts`

```typescript
/**
 * Storage Port - Interface for persistence
 */
import type { Checkpoint } from '../agent/v1/schema.js';
import type { TraceEvent } from '../trace/v1/schema.js';

/**
 * Checkpoint Storage Port
 *
 * INV-STORAGE-001: save() must be atomic
 * INV-STORAGE-002: load() returns null for non-existent
 * INV-STORAGE-003: list() returns in creation order (newest first)
 */
export interface CheckpointStoragePort {
  save(checkpoint: Checkpoint): Promise<void>;
  load(checkpointId: string): Promise<Checkpoint | null>;
  loadLatest(agentId: string, sessionId?: string): Promise<Checkpoint | null>;
  list(agentId: string, limit?: number): Promise<Checkpoint[]>;
  delete(checkpointId: string): Promise<boolean>;
}

/**
 * Trace Storage Port
 */
export interface TraceStoragePort {
  write(event: TraceEvent): Promise<void>;
  flush(): Promise<void>;
  getTrace(traceId: string): Promise<TraceEvent[]>;
  deleteTrace(traceId: string): Promise<boolean>;
}
```

#### 2.3 Refactor CLI to Use Ports

**Before (`storage-instances.ts`):**
```typescript
import { createSqliteCheckpointStorage } from '@automatosx/sqlite-adapter'; // VIOLATION
```

**After:**
```typescript
import type { CheckpointStoragePort } from '@automatosx/contracts';

// Composition root wires the actual implementation
let _checkpointStorage: CheckpointStoragePort | null = null;

export function setCheckpointStorage(storage: CheckpointStoragePort): void {
  _checkpointStorage = storage;
}

export function getCheckpointStorage(): CheckpointStoragePort {
  if (!_checkpointStorage) {
    throw new Error('Checkpoint storage not initialized. Call initializeStorage() first.');
  }
  return _checkpointStorage;
}
```

**Composition Root (`packages/cli/src/main.ts`):**
```typescript
import { createSqliteCheckpointStorage } from '@automatosx/sqlite-adapter';
import { setCheckpointStorage } from './utils/storage-instances.js';

// Wire up dependencies at application entry point
async function bootstrap() {
  const db = await initializeDatabase();
  if (db) {
    setCheckpointStorage(createSqliteCheckpointStorage(db));
  } else {
    setCheckpointStorage(createInMemoryCheckpointStorage());
  }
}
```

#### 2.4 Refactor MCP Server to Use Ports

**Before (`shared-registry.ts`):**
```typescript
import { createProviderRegistry } from '@automatosx/provider-adapters'; // VIOLATION
```

**After:**
```typescript
import type { ProviderRegistryPort } from '@automatosx/contracts';

let _providerRegistry: ProviderRegistryPort | null = null;

export function setProviderRegistry(registry: ProviderRegistryPort): void {
  _providerRegistry = registry;
}
```

**Composition Root (`packages/mcp-server/src/main.ts`):**
```typescript
import { createProviderRegistry } from '@automatosx/provider-adapters';
import { setProviderRegistry } from './shared-registry.js';

// Wire dependencies
setProviderRegistry(createProviderRegistry());
```

#### 2.5 Refactor agent-domain

**Problem:** `agent-domain/executor.ts` imports from `@automatosx/agent-execution`

**Solution:** Move `DelegationTracker` interface to contracts, implementation to agent-execution.

**New in Contracts:**
```typescript
// packages/contracts/src/agent/v1/delegation.ts
export interface DelegationTrackerPort {
  canDelegate(fromAgent: string, toAgent: string): boolean;
  recordDelegation(fromAgent: string, toAgent: string): void;
  getCurrentDepth(agentId: string): number;
}
```

**agent-domain uses the port:**
```typescript
import type { DelegationTrackerPort } from '@automatosx/contracts';

constructor(config: AgentDomainConfig) {
  this.delegationTracker = config.delegationTracker; // Injected, not imported
}
```

---

### Phase 3: Add Missing Invariants

Create `invariants.md` for 15 contracts following this template:

```markdown
# {Domain} Contract V1 - Behavioral Invariants

## Overview
{Brief description of the domain and its purpose}

## Invariants

### INV-{CODE}-001: {Name}

**Statement:** {What must be true}

**Rationale:** {Why it matters}

**Enforcement:**
- {How to verify 1}
- {How to verify 2}

## Testing Requirements
{Test requirements for each invariant}

## Version History
- V1 ({date}): Initial contract definition
```

#### Invariants to Create

| Contract | Suggested Invariants |
|----------|---------------------|
| `agent` | INV-AGT-001: Profile Validation, INV-AGT-002: Unique IDs, INV-AGT-003: Workflow Step Order |
| `session` | INV-SESS-001: State Transitions, INV-SESS-002: Participant Uniqueness, INV-SESS-003: Audit Trail |
| `config` | INV-CFG-001: Schema Validation, INV-CFG-002: Atomic Writes, INV-CFG-003: Version Migration |
| `resilience` | INV-RES-001: Circuit Breaker States, INV-RES-002: Rate Limit Enforcement, INV-RES-003: Metrics Accuracy |
| `provider` | INV-PROV-001: Health Check Timeout, INV-PROV-002: No Network in Detection, INV-PROV-003: Graceful Degradation |
| `cross-cutting` | INV-CC-001: Saga Compensation, INV-CC-002: DLQ Capture, INV-CC-003: Idempotency Keys |
| `bugfix` | INV-BUG-001: Scan Determinism, INV-BUG-002: Fix Atomicity, INV-BUG-003: Backup Before Fix |
| `refactor` | INV-REF-001: AST Preservation, INV-REF-002: Semantic Equivalence, INV-REF-003: Test Preservation |
| `analysis` | INV-ANL-001: Context Size Limits, INV-ANL-002: Finding Severity Ordering, INV-ANL-003: Provider Fallback |
| `context` | INV-CTX-001: File Size Limits, INV-CTX-002: UTF-8 Validation, INV-CTX-003: Total Size Budget |
| `iterate` | INV-ITR-001: Budget Enforcement, INV-ITR-002: Safety Pause, INV-ITR-003: Intent Classification |
| `orchestration` | INV-ORC-001: Plan Validation, INV-ORC-002: Agent Selection, INV-ORC-003: Result Aggregation |
| `design` | INV-DES-001: Template Validity, INV-DES-002: Code Generation, INV-DES-003: Interface Consistency |
| `telemetry` | INV-TEL-001: Event Ordering, INV-TEL-002: No Data Loss, INV-TEL-003: Privacy Compliance |
| `token-budget` | INV-TOK-001: Allocation Limits, INV-TOK-002: Usage Tracking, INV-TOK-003: Budget Exhaustion |
| `cli` | INV-CLI-001: Exit Codes, INV-CLI-002: Output Formats, INV-CLI-003: Error Messages |

---

## Implementation Plan

### Phase 1: Break Circular Dependencies (Priority: HIGH)

| Task | File | Effort |
|------|------|--------|
| Create `registry-types.ts` | `packages/mcp-server/src/registry-types.ts` | Small |
| Refactor `shared-registry.ts` | `packages/mcp-server/src/shared-registry.ts` | Medium |
| Refactor `agent.ts` tool | `packages/mcp-server/src/tools/agent.ts` | Small |
| Refactor `ability.ts` tool | `packages/mcp-server/src/tools/ability.ts` | Small |
| Update `tools/index.ts` | `packages/mcp-server/src/tools/index.ts` | Small |

**Verification:** `pnpm deps:check` shows no circular dependency errors.

### Phase 2: Fix Dependency Violations (Priority: HIGH)

| Task | Files | Effort |
|------|-------|--------|
| Create Provider Port | `packages/contracts/src/provider/v1/port.ts` | Small |
| Create Storage Port | `packages/contracts/src/storage/v1/port.ts` | Small |
| Create Delegation Port | `packages/contracts/src/agent/v1/delegation.ts` | Small |
| Refactor CLI storage | `packages/cli/src/utils/storage-instances.ts` | Medium |
| Refactor CLI providers | `packages/cli/src/utils/provider-factory.ts`, `commands/call.ts` | Medium |
| Refactor MCP shared-registry | `packages/mcp-server/src/shared-registry.ts` | Medium |
| Refactor agent-domain | `packages/core/agent-domain/src/executor.ts`, `enhanced-executor.ts` | Medium |
| Create CLI composition root | `packages/cli/src/bootstrap.ts` | Medium |
| Create MCP composition root | `packages/mcp-server/src/bootstrap.ts` | Medium |

**Verification:** `pnpm deps:check` shows 0 violations.

### Phase 3: Add Missing Invariants (Priority: MEDIUM)

| Contract | File to Create |
|----------|----------------|
| agent | `packages/contracts/src/agent/v1/invariants.md` |
| session | `packages/contracts/src/session/v1/invariants.md` |
| config | `packages/contracts/src/config/v1/invariants.md` |
| resilience | `packages/contracts/src/resilience/v1/invariants.md` |
| provider | `packages/contracts/src/provider/v1/invariants.md` |
| cross-cutting | `packages/contracts/src/cross-cutting/v1/invariants.md` |
| bugfix | `packages/contracts/src/bugfix/v1/invariants.md` |
| refactor | `packages/contracts/src/refactor/v1/invariants.md` |
| analysis | `packages/contracts/src/analysis/v1/invariants.md` |
| context | `packages/contracts/src/context/v1/invariants.md` |
| iterate | `packages/contracts/src/iterate/v1/invariants.md` |
| orchestration | `packages/contracts/src/orchestration/v1/invariants.md` |
| design | `packages/contracts/src/design/v1/invariants.md` |
| telemetry | `packages/contracts/src/telemetry/v1/invariants.md` |
| token-budget | `packages/contracts/src/token-budget/v1/invariants.md` |
| cli | `packages/contracts/src/cli/v1/invariants.md` |

**Verification:** All contract directories have `invariants.md`.

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Circular dependencies | 0 |
| Dependency violations | 0 |
| Contracts with invariants | 22/22 (100%) |
| `pnpm deps:check` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | All tests pass |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Medium | High | Incremental refactoring with tests |
| Import path errors | Medium | Medium | TypeScript catches at compile time |
| Runtime initialization errors | Low | High | Composition root validation |
| Test failures | Medium | Medium | Update tests alongside code |

---

## Appendix: Dependency Rules Reference

From `.dependency-cruiser.cjs`:

```javascript
{
  name: 'core-only-contracts',
  from: { path: '^packages/core/' },
  to: {
    pathNot: ['^packages/contracts/', '^packages/core/'],
    path: '^packages/'
  }
},
{
  name: 'cli-no-adapters',
  from: { path: '^packages/cli/' },
  to: { path: '^packages/adapters/' }
},
{
  name: 'mcp-server-no-adapters',
  from: { path: '^packages/mcp-server/' },
  to: { path: '^packages/adapters/' }
}
```

These rules enforce the layered architecture and must be satisfied for the build to pass.
