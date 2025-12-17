# PRD: Dependency Injection & Composition Root Refactoring

## Executive Summary

This PRD details the refactoring required to eliminate the remaining 14 dependency layer violations by implementing proper dependency injection with composition roots. This follows the Ports & Adapters (Hexagonal Architecture) pattern established in the previous phase.

**Current State:** 14 dependency violations
**Target State:** 0 dependency violations

---

## Problem Statement

### Current Violations

```
mcp-server-no-adapters (3 violations):
  - shared-registry.ts → @automatosx/provider-adapters

core-only-contracts (4 violations):
  - agent-domain/executor.ts → @automatosx/agent-execution
  - agent-domain/enhanced-executor.ts → @automatosx/agent-execution

cli-no-adapters (7 violations):
  - utils/storage-instances.ts → @automatosx/sqlite-adapter
  - utils/provider-factory.ts → @automatosx/provider-adapters
  - commands/call.ts → @automatosx/provider-adapters
```

### Root Cause

Application code directly imports adapter implementations instead of depending on port interfaces. This violates the layered architecture:

```
❌ Current (Incorrect):
  CLI → directly imports → sqlite-adapter
  CLI → directly imports → provider-adapters
  MCP Server → directly imports → provider-adapters
  agent-domain → directly imports → agent-execution

✅ Target (Correct):
  CLI → depends on → Port Interfaces (from contracts)
  Bootstrap → wires → Port Interfaces ← Adapter Implementations
```

---

## Solution Architecture

### Composition Root Pattern

A **composition root** is the single location in an application where all dependencies are wired together. This is typically at the application entry point.

```
┌─────────────────────────────────────────────────────────┐
│                    Application Entry                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Composition Root                      │   │
│  │  (bootstrap.ts)                                   │   │
│  │                                                    │   │
│  │  1. Import adapters (ONLY place that can)         │   │
│  │  2. Create instances                              │   │
│  │  3. Wire to application via setters/DI container  │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Application Code                      │   │
│  │                                                    │   │
│  │  - Depends ONLY on port interfaces               │   │
│  │  - Receives implementations via injection        │   │
│  │  - Never imports adapters directly               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Dependency Flow

```
contracts (defines ports)
    ↑
core domains (use ports)
    ↑
adapters (implement ports)
    ↑
bootstrap (wires adapters to ports)
    ↑
application entry (calls bootstrap, runs app)
```

---

## Implementation Plan

### Phase 1: CLI Composition Root

#### 1.1 Create CLI Bootstrap Module

**New File:** `packages/cli/src/bootstrap.ts`

```typescript
/**
 * CLI Composition Root
 *
 * This is the ONLY place in CLI that imports adapter implementations.
 * All other CLI code depends on port interfaces from contracts.
 *
 * Following Ports & Adapters (Hexagonal Architecture) pattern.
 */

import type {
  CheckpointStoragePort,
  ProviderRegistryPort,
  ProviderPort,
} from '@automatosx/contracts';

// Adapter imports - ONLY allowed in composition root
import { createProviderRegistry } from '@automatosx/provider-adapters';
import {
  createSqliteCheckpointStorage,
  createSqliteTraceStore,
  createSqliteDeadLetterStorage,
} from '@automatosx/sqlite-adapter';
import { createInMemoryCheckpointStorage } from '@automatosx/agent-execution';

import { getDatabase, initializeDatabase } from './utils/database.js';

// ============================================================================
// Dependency Container
// ============================================================================

interface CLIDependencies {
  checkpointStorage: CheckpointStoragePort;
  providerRegistry: ProviderRegistryPort;
  traceStore: TraceStoragePort;
  deadLetterQueue: DeadLetterQueuePort;
}

let _dependencies: CLIDependencies | null = null;
let _initialized = false;

// ============================================================================
// Bootstrap Function
// ============================================================================

/**
 * Initialize all CLI dependencies
 *
 * Called once at application startup. Wires adapters to ports.
 */
export async function bootstrap(): Promise<CLIDependencies> {
  if (_initialized && _dependencies) {
    return _dependencies;
  }

  // Initialize database
  const db = await initializeDatabaseSafe();

  // Create storage implementations
  const checkpointStorage = db
    ? createSqliteCheckpointStorage(db)
    : createInMemoryCheckpointStorage();

  const traceStore = db
    ? createSqliteTraceStore(db)
    : createInMemoryTraceStore();

  const deadLetterStorage = db
    ? createSqliteDeadLetterStorage(db)
    : createInMemoryDeadLetterStorage();

  // Create provider registry
  const providerRegistry = createProviderRegistry();

  // Build dependency container
  _dependencies = {
    checkpointStorage,
    providerRegistry,
    traceStore,
    deadLetterQueue: createDeadLetterQueue(deadLetterStorage),
  };

  _initialized = true;
  return _dependencies;
}

/**
 * Get initialized dependencies
 * Throws if bootstrap() not called
 */
export function getDependencies(): CLIDependencies {
  if (!_dependencies) {
    throw new Error('CLI not bootstrapped. Call bootstrap() first.');
  }
  return _dependencies;
}

/**
 * Get checkpoint storage
 */
export function getCheckpointStorage(): CheckpointStoragePort {
  return getDependencies().checkpointStorage;
}

/**
 * Get provider registry
 */
export function getProviderRegistry(): ProviderRegistryPort {
  return getDependencies().providerRegistry;
}

// ============================================================================
// Safe Database Initialization
// ============================================================================

async function initializeDatabaseSafe(): Promise<Database | null> {
  try {
    return await initializeDatabase();
  } catch (error) {
    console.warn('SQLite unavailable, using in-memory storage');
    return null;
  }
}
```

#### 1.2 Update CLI Entry Point

**Modify:** `packages/cli/src/cli.ts`

```typescript
// At the very start of main()
import { bootstrap } from './bootstrap.js';

async function main() {
  // Initialize all dependencies FIRST
  await bootstrap();

  // Rest of CLI initialization...
}
```

#### 1.3 Refactor storage-instances.ts

**Before:**
```typescript
import { createSqliteCheckpointStorage } from '@automatosx/sqlite-adapter'; // VIOLATION
```

**After:**
```typescript
import type { CheckpointStoragePort } from '@automatosx/contracts';
import { getCheckpointStorage } from '../bootstrap.js';

// No adapter imports - uses bootstrap-provided instance
export function getCheckpointStorage(): CheckpointStoragePort {
  return getCheckpointStorage();
}
```

#### 1.4 Refactor provider-factory.ts

**Before:**
```typescript
import { createProviderRegistry } from '@automatosx/provider-adapters'; // VIOLATION
```

**After:**
```typescript
import type { ProviderRegistryPort, ProviderPort } from '@automatosx/contracts';
import { getProviderRegistry } from '../bootstrap.js';

export function getProviderRegistry(): ProviderRegistryPort {
  return getProviderRegistry();
}

export function getProvider(providerId: string): ProviderPort | undefined {
  return getProviderRegistry().getProvider(providerId);
}
```

#### 1.5 Refactor commands/call.ts

**Before:**
```typescript
import { createProviderRegistry } from '@automatosx/provider-adapters'; // VIOLATION
```

**After:**
```typescript
import { getProviderRegistry } from '../bootstrap.js';

// Use registry from bootstrap
const registry = getProviderRegistry();
const provider = registry.getProvider(providerId);
```

---

### Phase 2: MCP Server Composition Root

#### 2.1 Create MCP Server Bootstrap Module

**New File:** `packages/mcp-server/src/bootstrap.ts`

```typescript
/**
 * MCP Server Composition Root
 *
 * This is the ONLY place in MCP Server that imports adapter implementations.
 * All other MCP code depends on port interfaces from contracts.
 */

import type {
  ProviderRegistryPort,
  CheckpointStoragePort,
} from '@automatosx/contracts';

// Adapter imports - ONLY allowed in composition root
import { createProviderRegistry } from '@automatosx/provider-adapters';

// ============================================================================
// Dependency Container
// ============================================================================

interface MCPDependencies {
  providerRegistry: ProviderRegistryPort;
}

let _dependencies: MCPDependencies | null = null;

// ============================================================================
// Bootstrap Function
// ============================================================================

export async function bootstrap(): Promise<MCPDependencies> {
  if (_dependencies) {
    return _dependencies;
  }

  // Create provider registry
  const providerRegistry = createProviderRegistry();

  _dependencies = {
    providerRegistry,
  };

  return _dependencies;
}

export function getDependencies(): MCPDependencies {
  if (!_dependencies) {
    throw new Error('MCP Server not bootstrapped. Call bootstrap() first.');
  }
  return _dependencies;
}

export function getProviderRegistry(): ProviderRegistryPort {
  return getDependencies().providerRegistry;
}
```

#### 2.2 Refactor shared-registry.ts

**Before:**
```typescript
import { createProviderRegistry } from '@automatosx/provider-adapters'; // VIOLATION
```

**After:**
```typescript
import type { ProviderRegistryPort } from '@automatosx/contracts';
import { getProviderRegistry } from './bootstrap.js';

// Use bootstrap-provided registry
async function initializeRegistry(): Promise<void> {
  const providerRegistry = getProviderRegistry();

  // Create prompt executor using port interface
  const promptExecutor = createProviderPromptExecutor(providerRegistry, {
    defaultProvider: 'claude',
    defaultTimeout: 120000,
  });

  // ... rest of initialization
}
```

#### 2.3 Update MCP Server Entry Point

**Modify:** `packages/mcp-server/src/index.ts` or `bin.ts`

```typescript
import { bootstrap } from './bootstrap.js';

async function main() {
  // Initialize dependencies
  await bootstrap();

  // Start server...
}
```

---

### Phase 3: Agent Domain Refactoring

#### 3.1 Problem Analysis

The agent-domain imports from agent-execution for `DelegationTracker`:

```typescript
// Current (VIOLATION)
import { createDelegationTracker } from '@automatosx/agent-execution';
```

#### 3.2 Solution: Move Interface to Contracts, Keep Implementation in agent-execution

**Already Done:** `DelegationTrackerPort` is defined in `contracts/src/agent/v1/storage-port.ts`

#### 3.3 Refactor agent-domain/executor.ts

**Before:**
```typescript
import { createDelegationTracker } from '@automatosx/agent-execution'; // VIOLATION
```

**After:**
```typescript
import type { DelegationTrackerPort } from '@automatosx/contracts';

export class DefaultAgentExecutor implements AgentExecutor {
  private readonly delegationTracker: DelegationTrackerPort;

  constructor(
    registry: AgentRegistry,
    config: AgentDomainConfig
  ) {
    // Delegation tracker injected via config, not imported
    this.delegationTracker = config.delegationTracker;

    if (!this.delegationTracker) {
      throw new Error('DelegationTracker required. Provide via config.delegationTracker');
    }
  }
}
```

#### 3.4 Update AgentDomainConfig

**Modify:** `packages/core/agent-domain/src/types.ts`

```typescript
import type { DelegationTrackerPort } from '@automatosx/contracts';

export interface AgentDomainConfig {
  // ... existing fields

  /**
   * Delegation tracker for managing delegation chains
   * Required - no default provided
   */
  delegationTracker: DelegationTrackerPort;
}
```

#### 3.5 Provide Delegation Tracker from Application Layer

Applications (CLI, MCP Server) provide the delegation tracker:

```typescript
// In CLI or MCP Server bootstrap
import { createDelegationTracker } from '@automatosx/agent-execution';

const config: AgentDomainConfig = {
  delegationTracker: createDelegationTracker({ maxDepth: 5 }),
  // ... other config
};
```

---

### Phase 4: Update Dependency Cruiser Rules

After refactoring, update `.dependency-cruiser.cjs` to allow bootstrap modules to import adapters:

```javascript
{
  name: 'cli-bootstrap-allowed-adapters',
  comment: 'CLI bootstrap module may import adapters',
  from: { path: '^packages/cli/src/bootstrap\\.ts$' },
  to: { path: '^packages/adapters/' },
  severity: 'ignore',
},
{
  name: 'mcp-bootstrap-allowed-adapters',
  comment: 'MCP Server bootstrap module may import adapters',
  from: { path: '^packages/mcp-server/src/bootstrap\\.ts$' },
  to: { path: '^packages/adapters/' },
  severity: 'ignore',
},
```

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/cli/src/bootstrap.ts` | CLI composition root |
| `packages/mcp-server/src/bootstrap.ts` | MCP Server composition root |

### Modified Files

| File | Changes |
|------|---------|
| `packages/cli/src/cli.ts` | Call bootstrap() at startup |
| `packages/cli/src/utils/storage-instances.ts` | Use bootstrap, remove adapter imports |
| `packages/cli/src/utils/provider-factory.ts` | Use bootstrap, remove adapter imports |
| `packages/cli/src/commands/call.ts` | Use bootstrap, remove adapter imports |
| `packages/mcp-server/src/shared-registry.ts` | Use bootstrap, remove adapter imports |
| `packages/mcp-server/src/index.ts` | Call bootstrap() at startup |
| `packages/core/agent-domain/src/executor.ts` | Accept delegationTracker via config |
| `packages/core/agent-domain/src/enhanced-executor.ts` | Accept delegationTracker via config |
| `packages/core/agent-domain/src/types.ts` | Add delegationTracker to config |
| `.dependency-cruiser.cjs` | Add bootstrap exceptions |

---

## Implementation Order

### Step 1: CLI Bootstrap (Highest Impact - 7 violations)

1. Create `packages/cli/src/bootstrap.ts`
2. Refactor `storage-instances.ts` to use bootstrap
3. Refactor `provider-factory.ts` to use bootstrap
4. Refactor `commands/call.ts` to use bootstrap
5. Update `cli.ts` to call bootstrap
6. Run `pnpm deps:check` - should drop from 14 to 7 violations

### Step 2: MCP Server Bootstrap (3 violations)

1. Create `packages/mcp-server/src/bootstrap.ts`
2. Refactor `shared-registry.ts` to use bootstrap
3. Update entry point to call bootstrap
4. Run `pnpm deps:check` - should drop from 7 to 4 violations

### Step 3: Agent Domain Refactoring (4 violations)

1. Update `AgentDomainConfig` to require `delegationTracker`
2. Refactor `executor.ts` to use injected tracker
3. Refactor `enhanced-executor.ts` to use injected tracker
4. Update CLI/MCP bootstraps to provide delegation tracker
5. Run `pnpm deps:check` - should be 0 violations

### Step 4: Update Dependency Rules

1. Add bootstrap exceptions to `.dependency-cruiser.cjs`
2. Run `pnpm deps:check` - should pass with 0 errors

---

## Testing Strategy

### Unit Tests

1. **Bootstrap Tests**
   - Test bootstrap initializes all dependencies
   - Test getDependencies throws if not bootstrapped
   - Test bootstrap is idempotent (safe to call multiple times)

2. **Refactored Module Tests**
   - Test storage-instances works with mock bootstrap
   - Test provider-factory works with mock bootstrap
   - Test commands work with injected dependencies

### Integration Tests

1. **CLI Integration**
   - Test CLI starts correctly after refactoring
   - Test all commands work with bootstrapped dependencies

2. **MCP Server Integration**
   - Test server starts correctly
   - Test all tools work with bootstrapped dependencies

### Regression Tests

1. Run all existing tests
2. Verify no behavior changes
3. Verify all dependency violations resolved

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Medium | High | Incremental migration, comprehensive tests |
| Initialization order issues | Medium | Medium | Clear bootstrap sequence, error on use before init |
| Circular dependency in bootstrap | Low | High | Bootstrap imports adapters only, not application code |
| Performance overhead | Low | Low | Bootstrap runs once at startup |

---

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Dependency violations | 14 | 0 |
| `pnpm deps:check` | FAIL | PASS |
| `pnpm build` | PASS | PASS |
| `pnpm test` | PASS | PASS |
| CLI tests | 64 pass | 64 pass |

---

## Appendix: Port Interface Reference

### From `@automatosx/contracts`

```typescript
// Provider Ports
interface ProviderPort {
  readonly providerId: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  isAvailable(): Promise<boolean>;
  getModels(): ModelInfo[];
  getStatus(): 'open' | 'closed' | 'half-open';
}

interface ProviderRegistryPort {
  getProvider(providerId: string): ProviderPort | undefined;
  getDefaultProvider(): ProviderPort | undefined;
  listProviders(): string[];
  hasProvider(providerId: string): boolean;
}

// Storage Ports
interface CheckpointStoragePort {
  save(checkpoint: Checkpoint): Promise<void>;
  load(checkpointId: string): Promise<Checkpoint | null>;
  loadLatest(agentId: string, sessionId?: string): Promise<Checkpoint | null>;
  list(agentId: string, sessionId?: string): Promise<Checkpoint[]>;
  delete(checkpointId: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}

interface DelegationTrackerPort {
  canDelegate(fromAgent: string, toAgent: string): boolean;
  recordDelegation(fromAgent: string, toAgent: string): void;
  getCurrentDepth(agentId: string): number;
  getChain(agentId: string): string[];
  isInChain(agentId: string): boolean;
  completeDelegation(agentId: string): void;
}
```

---

## Appendix: Dependency Cruiser Configuration

Final `.dependency-cruiser.cjs` rules after implementation:

```javascript
module.exports = {
  forbidden: [
    // Core can only import contracts
    {
      name: 'core-only-contracts',
      from: { path: '^packages/core/' },
      to: {
        pathNot: ['^packages/contracts/', '^packages/core/'],
        path: '^packages/'
      }
    },
    // CLI cannot import adapters (except bootstrap)
    {
      name: 'cli-no-adapters',
      from: {
        path: '^packages/cli/',
        pathNot: '^packages/cli/src/bootstrap\\.ts$'
      },
      to: { path: '^packages/adapters/' }
    },
    // MCP Server cannot import adapters (except bootstrap)
    {
      name: 'mcp-server-no-adapters',
      from: {
        path: '^packages/mcp-server/',
        pathNot: '^packages/mcp-server/src/bootstrap\\.ts$'
      },
      to: { path: '^packages/adapters/' }
    },
    // No circular dependencies
    {
      name: 'no-circular',
      from: {},
      to: { circular: true }
    }
  ]
};
```
