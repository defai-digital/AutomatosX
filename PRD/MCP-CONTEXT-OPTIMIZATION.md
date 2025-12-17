# PRD: MCP Context Optimization

## Problem Statement

Claude Code warns that the AutomatosX MCP server consumes **~42,435 tokens** of context, exceeding the recommended **25,000 token threshold** by 70%. This impacts:

1. **Reduced working context** for actual tasks
2. **Slower response times** due to processing overhead
3. **Higher costs** for token-based billing
4. **Potential context truncation** in complex conversations

### Current State

| Category | Tools | Est. Tokens |
|----------|-------|-------------|
| Memory | 10 | ~6,500 |
| Session | 7 | ~4,500 |
| Orchestration | 7 | ~5,000 |
| Telemetry | 7 | ~4,500 |
| Agent | 5 | ~3,500 |
| Ability | 5 | ~3,500 |
| Design | 5 | ~4,500 |
| Guard | 3 | ~2,000 |
| Workflow | 3 | ~2,000 |
| Trace | 3 | ~2,000 |
| Config | 3 | ~1,800 |
| Bugfix | 3 | ~2,100 |
| Refactor | 3 | ~2,000 |
| **Total** | **64** | **~42,435** |

### Target

Reduce to **~20,000 tokens** (50% reduction) while maintaining full functionality.

---

## Solution: Multi-Strategy Optimization

### Strategy 1: Tool Consolidation (Primary - 40% reduction)

Merge related tools into single tools with `action` parameter:

#### Before (64 tools)
```
memory_store, memory_retrieve, memory_search, memory_list,
memory_delete, memory_export, memory_import, memory_stats,
memory_bulk_delete, memory_clear
```

#### After (32 tools)

| Consolidated Tool | Replaces | Actions |
|-------------------|----------|---------|
| `memory` | 10 tools | store, get, search, list, delete, export, import, stats, bulk_delete, clear |
| `task` | 5 tools | submit, status, list, cancel, retry |
| `queue` | 2 tools | create, list |
| `session` | 7 tools | create, status, complete, list, join, leave, fail |
| `agent` | 5 tools | list, run, get, register, remove |
| `ability` | 5 tools | list, get, inject, register, remove |
| `metrics` | 4 tools | record, increment, query, list |
| `timer` | 2 tools | start, stop |
| `design` | 5 tools | api, component, schema, architecture, list |
| `bugfix` | 3 tools | scan, run, list |
| `refactor` | 3 tools | scan, apply, list |
| `guard` | 3 tools | check, list, apply |
| `trace` | 3 tools | list, get, analyze |
| `workflow` | 3 tools | run, list, describe |
| `config` | 3 tools | get, set, show |
| `telemetry_summary` | 1 tool | (keep standalone - different signature) |

**Result: 64 → 16 tools**

### Strategy 2: Description Compression (20% reduction)

#### Current (verbose)
```typescript
description: 'Delete multiple keys from memory. SIDE EFFECTS: Removes keys from store. Idempotent - deleting non-existent keys returns notFound count.'
```

#### Optimized (concise)
```typescript
description: 'Bulk delete keys. Returns {deleted, notFound}.'
```

#### Rules
1. Remove "SIDE EFFECTS:" prefix - move to `sideEffects: true` property
2. Remove "Idempotent -" prefix - move to `idempotent: true` property
3. Max 60 characters for descriptions
4. Remove parameter descriptions for self-explanatory names

### Strategy 3: Schema Compression (10% reduction)

#### Current
```typescript
inputSchema: {
  type: 'object',
  properties: {
    key: {
      type: 'string',
      description: 'The key to store the value under',
    },
    value: {
      type: 'object',
      description: 'The value to store',
    },
    namespace: {
      type: 'string',
      description: 'Optional namespace for the key',
    },
  },
  required: ['key', 'value'],
}
```

#### Optimized
```typescript
inputSchema: {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['store', 'get', ...] },
    key: { type: 'string' },
    value: { type: 'object' },
    namespace: { type: 'string' },
  },
  required: ['action'],
}
```

### Strategy 4: Tool Tiering (Optional - for further reduction)

If further reduction needed, implement tool tiers:

| Tier | Tools | Load Condition |
|------|-------|----------------|
| Core | memory, task, agent, config | Always loaded |
| Standard | session, workflow, trace, guard | Loaded by default |
| Extended | design, bugfix, refactor, telemetry | On-demand |

---

## Implementation Plan

### Phase 1: Tool Consolidation

#### 1.1 Create Consolidated Tool Definitions

**File: `packages/mcp-server/src/tools/consolidated/memory.ts`**

```typescript
import type { MCPTool, ToolHandler } from '../../types.js';

export const memoryTool: MCPTool = {
  name: 'memory',
  description: 'Key-value store operations',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['store', 'get', 'search', 'list', 'delete', 'export', 'import', 'stats', 'bulk_delete', 'clear'],
      },
      key: { type: 'string' },
      keys: { type: 'array', items: { type: 'string' } },
      value: { type: 'object' },
      namespace: { type: 'string' },
      query: { type: 'string' },
      prefix: { type: 'string' },
      limit: { type: 'number', default: 100 },
      data: { type: 'array' },
      overwrite: { type: 'boolean', default: false },
      confirm: { type: 'boolean' },
      includeMetadata: { type: 'boolean', default: true },
      detailed: { type: 'boolean', default: false },
    },
    required: ['action'],
  },
};

export const handleMemory: ToolHandler = async (args) => {
  const action = args.action as string;

  switch (action) {
    case 'store': return handleStore(args);
    case 'get': return handleRetrieve(args);
    case 'search': return handleSearch(args);
    case 'list': return handleList(args);
    case 'delete': return handleDelete(args);
    case 'export': return handleExport(args);
    case 'import': return handleImport(args);
    case 'stats': return handleStats(args);
    case 'bulk_delete': return handleBulkDelete(args);
    case 'clear': return handleClear(args);
    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ACTION', action }) }],
        isError: true,
      };
  }
};
```

#### 1.2 Consolidated Tool List

**File: `packages/mcp-server/src/tools/consolidated/index.ts`**

```typescript
import { memoryTool, handleMemory } from './memory.js';
import { taskTool, handleTask } from './task.js';
import { sessionTool, handleSession } from './session.js';
import { agentTool, handleAgent } from './agent.js';
import { abilityTool, handleAbility } from './ability.js';
import { metricsTool, handleMetrics } from './metrics.js';
import { timerTool, handleTimer } from './timer.js';
import { designTool, handleDesign } from './design.js';
import { bugfixTool, handleBugfix } from './bugfix.js';
import { refactorTool, handleRefactor } from './refactor.js';
import { guardTool, handleGuard } from './guard.js';
import { traceTool, handleTrace } from './trace.js';
import { workflowTool, handleWorkflow } from './workflow.js';
import { configTool, handleConfig } from './config.js';
import { queueTool, handleQueue } from './queue.js';
import { telemetrySummaryTool, handleTelemetrySummary } from './telemetry.js';

export const CONSOLIDATED_TOOLS = [
  memoryTool,
  taskTool,
  queueTool,
  sessionTool,
  agentTool,
  abilityTool,
  metricsTool,
  timerTool,
  designTool,
  bugfixTool,
  refactorTool,
  guardTool,
  traceTool,
  workflowTool,
  configTool,
  telemetrySummaryTool,
];

export const CONSOLIDATED_HANDLERS = {
  memory: handleMemory,
  task: handleTask,
  queue: handleQueue,
  session: handleSession,
  agent: handleAgent,
  ability: handleAbility,
  metrics: handleMetrics,
  timer: handleTimer,
  design: handleDesign,
  bugfix: handleBugfix,
  refactor: handleRefactor,
  guard: handleGuard,
  trace: handleTrace,
  workflow: handleWorkflow,
  config: handleConfig,
  telemetry_summary: handleTelemetrySummary,
};
```

### Phase 2: Configuration Toggle

Add config option to switch between legacy and consolidated modes:

**File: `packages/mcp-server/src/server.ts`**

```typescript
interface ServerConfig {
  toolMode: 'legacy' | 'consolidated';
}

const tools = config.toolMode === 'consolidated'
  ? CONSOLIDATED_TOOLS
  : ALL_TOOLS;
```

### Phase 3: Migration Guide

Create documentation for callers migrating from legacy to consolidated:

```markdown
## Migration Examples

### Memory Operations

Before:
```json
{ "tool": "memory_store", "key": "foo", "value": {...} }
{ "tool": "memory_retrieve", "key": "foo" }
```

After:
```json
{ "tool": "memory", "action": "store", "key": "foo", "value": {...} }
{ "tool": "memory", "action": "get", "key": "foo" }
```
```

---

## Detailed Tool Consolidation Specs

### 1. `memory` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| store | key, value | namespace |
| get | key | namespace |
| search | query | namespace, limit |
| list | - | namespace, limit, prefix |
| delete | key | namespace |
| export | - | namespace, prefix, includeMetadata |
| import | data | namespace, overwrite |
| stats | - | namespace, detailed |
| bulk_delete | - | keys, namespace, prefix |
| clear | namespace, confirm | - |

### 2. `task` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| submit | name | description, agentId, input, priority, queueId, dependencies, tags, type, scheduledAt |
| status | taskId | - |
| list | - | queueId, agentId, status, priority, tags, limit |
| cancel | taskId | force, reason |
| retry | taskId | resetAttempts |

### 3. `session` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| create | initiator, task | workspace, metadata |
| status | sessionId | - |
| complete | sessionId | summary |
| list | - | status, initiator, limit |
| join | sessionId, agentId | role |
| leave | sessionId, agentId | - |
| fail | sessionId, error | - |

### 4. `agent` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| list | - | team, enabled, limit |
| run | agentId | input, sessionId |
| get | agentId | - |
| register | agentId, description | displayName, capabilities, team, tags, systemPrompt, workflow, enabled |
| remove | agentId | - |

### 5. `ability` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| list | - | category, tags, enabled, limit |
| get | abilityId | - |
| inject | agentId, task | coreAbilities, maxAbilities, maxTokens, includeMetadata |
| register | abilityId, content | displayName, description, category, tags, applicableTo, excludeFrom, priority, enabled |
| remove | abilityId | - |

### 6. `metrics` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| record | metricName, value | labels, type |
| increment | metricName | delta, labels |
| query | metricName | labels, aggregation, limit |
| list | - | category, type, prefix |

### 7. `design` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| api | name, endpoints | description, baseUrl, version, format, outputPath |
| component | name, type, description | inputs, outputs, dependencies, patterns, language, outputPath |
| schema | name, fields | description, format, outputPath |
| architecture | name, description, pattern, components | format, outputPath |
| list | - | type, status, limit |

### 8. `guard` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| check | policyId, changedPaths | target |
| list | - | limit |
| apply | sessionId, policyId | - |

### 9. `trace` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| list | - | status, limit |
| get | traceId | - |
| analyze | traceId | - |

### 10. `workflow` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| run | workflowId | input |
| list | - | status, limit |
| describe | workflowId | - |

### 11. `config` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| get | path | scope |
| set | path, value | scope |
| show | - | scope |

### 12. `bugfix` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| scan | paths | categories, minSeverity, excludePatterns, maxFiles, useAst |
| run | bugId | dryRun, autoApply, createBackup |
| list | - | scanId, severity, category, limit |

### 13. `refactor` Tool

| Action | Required Params | Optional Params |
|--------|-----------------|-----------------|
| scan | paths | types, minConfidence, maxImpact, excludePatterns, maxFiles |
| apply | opportunityId | dryRun, autoApply, createBackup, runTests |
| list | - | scanId, type, impact, limit |

---

## Estimated Token Savings

| Change | Before | After | Savings |
|--------|--------|-------|---------|
| Tool consolidation (64→16) | ~25,000 | ~8,000 | ~17,000 |
| Description compression | ~8,000 | ~4,000 | ~4,000 |
| Schema compression | ~9,000 | ~7,000 | ~2,000 |
| **Total** | **~42,435** | **~19,000** | **~23,435** |

**Final estimate: ~19,000 tokens (55% reduction)**

---

## Testing Plan

### 1. Unit Tests
- Test each consolidated handler dispatches correctly
- Test error handling for invalid actions
- Test parameter validation per action

### 2. Integration Tests
- Run existing test suite against consolidated tools
- Verify backward compatibility with legacy tool names (if alias mode enabled)

### 3. Token Count Verification
```bash
# Before optimization
pnpm ax doctor  # Shows ~42,435 tokens

# After optimization
pnpm ax doctor  # Target: ~19,000 tokens
```

---

## Rollout Plan

1. **Week 1**: Implement consolidated tools alongside legacy
2. **Week 2**: Add `toolMode` config, default to `legacy`
3. **Week 3**: Switch default to `consolidated`, deprecate legacy
4. **Week 4**: Remove legacy tools (breaking change in next major)

---

## Success Criteria

- [ ] Token count < 21,000 (50% reduction)
- [ ] All existing tests pass
- [ ] No functionality lost
- [ ] Migration guide documented
- [ ] `claude doctor` shows no warnings

---

## Alternatives Considered

### 1. Dynamic Tool Loading
Load tools based on context/conversation. Rejected: adds complexity, unpredictable behavior.

### 2. Tool Removal
Remove less-used tools entirely. Rejected: loses functionality.

### 3. External Tool Registry
Move tool definitions to external file fetched on demand. Rejected: latency, reliability concerns.

---

## Appendix: Full Consolidated Schema

```typescript
// packages/mcp-server/src/tools/consolidated/schemas.ts

export const consolidatedSchemas = {
  memory: {
    name: 'memory',
    description: 'Key-value store operations',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['store', 'get', 'search', 'list', 'delete', 'export', 'import', 'stats', 'bulk_delete', 'clear'] },
        key: { type: 'string' },
        keys: { type: 'array', items: { type: 'string' } },
        value: { type: 'object' },
        namespace: { type: 'string' },
        query: { type: 'string' },
        prefix: { type: 'string' },
        limit: { type: 'number' },
        data: { type: 'array' },
        overwrite: { type: 'boolean' },
        confirm: { type: 'boolean' },
        includeMetadata: { type: 'boolean' },
        detailed: { type: 'boolean' },
      },
      required: ['action'],
    },
  },
  // ... remaining 15 tools
};
```
