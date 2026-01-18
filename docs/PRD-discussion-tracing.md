# PRD: Discussion Tracing Implementation

## Overview

**Problem Statement:** Multi-model discussions executed via `ax_discuss`, `ax_discuss_quick`, and `ax_discuss_recursive` tools do not create trace events, making them invisible in the monitoring dashboard and preventing observability into discussion executions.

**Impact:** Users cannot:
- See discussion executions in the dashboard
- Debug failed discussions
- Track provider participation in discussions
- Analyze discussion performance metrics
- Correlate discussions with sessions

## Current State

### What Works (Agent Tracing)
The agent handler (`packages/mcp-server/src/tools/agent.ts`) properly implements tracing:

```typescript
// Gets trace store
const traceStore = getTraceStore();

// Creates trace hierarchy
const traceHierarchy = createRootTraceHierarchy(traceId, sessionId);

// Emits run.start event
const startEvent: TraceEvent = {
  eventId: randomUUID(),
  traceId,
  type: 'run.start',
  timestamp: startTimestamp,
  context: { agentId, ...traceHierarchy },
  payload: { command: 'agent', agentId, input, ... },
};
await traceStore.write(startEvent);

// Emits run.end event on completion
const endEvent: TraceEvent = {
  type: 'run.end',
  status: result.success ? 'success' : 'failure',
  durationMs: Date.now() - startTime,
  ...
};
await traceStore.write(endEvent);
```

### What's Missing (Discussion Tracing)
The discussion handlers (`packages/mcp-server/src/tools/discuss.ts`) do not:
1. Import or use `getTraceStore()`
2. Generate trace IDs
3. Emit `run.start` / `run.end` events
4. Emit discussion-specific events (`discussion.start`, `discussion.round`, etc.)

## Requirements

### Functional Requirements

#### FR-1: Basic Trace Lifecycle (Must Have)
All discussion tools MUST emit standard trace events:
- `run.start` event before execution begins
- `run.end` event after execution completes (success or failure)
- Include `command: 'discuss'` | `'discuss_quick'` | `'discuss_recursive'` in payload

#### FR-2: Discussion-Specific Events (Should Have)
Discussion executions SHOULD emit granular events:
- `discussion.start` - When discussion begins with configuration
- `discussion.round` - After each discussion round completes
- `discussion.provider` - For each provider response received
- `discussion.consensus` - When consensus is reached
- `discussion.end` - Final discussion result

#### FR-3: Provider Correlation (Must Have)
Per INV-TR-010, all provider calls MUST include `context.providerId`:
- Each `discussion.provider` event must include the provider ID
- Enables filtering discussions by provider in dashboard

#### FR-4: Hierarchy Support (Should Have)
Per INV-TR-020 through INV-TR-024:
- Support `parentTraceId` and `rootTraceId` for nested discussions
- Support `sessionId` for session correlation
- Maintain `traceDepth` consistency

#### FR-5: Token Usage Recording (Could Have)
Per INV-TR-012, capture token usage when providers report it:
- Include `tokenUsage` in provider response events
- Enable cost tracking for discussions

### Non-Functional Requirements

#### NFR-1: Performance
- Trace writes MUST NOT block discussion execution
- Use fire-and-forget pattern with error logging (similar to workflow.ts fix)

#### NFR-2: Backward Compatibility
- Existing discussion tests must continue to pass
- Dashboard must handle discussions without breaking

#### NFR-3: Test Coverage
- Unit tests for trace event emission
- Integration tests verifying dashboard visibility

## Technical Design

### 1. Import Required Dependencies

```typescript
// Add to discuss.ts imports
import { getTraceStore } from '../bootstrap.js';
import type { TraceEvent } from '@defai.digital/contracts';
import { randomUUID } from 'node:crypto';
import {
  createRootTraceHierarchy,
  createChildTraceHierarchy,
  type TraceHierarchy,
} from '@defai.digital/trace-domain';
```

### 2. Update Handler Signature

Each handler needs optional hierarchy parameters:

```typescript
export const handleDiscuss: ToolHandler = async (args): Promise<MCPToolResult> => {
  const {
    topic,
    // ... existing params
    // Add hierarchy support
    sessionId,
    parentTraceId,
    rootTraceId: inputRootTraceId,
    parentDepth,
  } = args as { /* ... */ };
```

### 3. Implement Trace Event Emission

```typescript
// Before execution
const traceId = randomUUID();
const traceStore = getTraceStore();
const startTime = Date.now();

// Create hierarchy context
const traceHierarchy = parentTraceId
  ? createChildTraceHierarchy(parentTraceId, {
      parentTraceId: undefined,
      rootTraceId: inputRootTraceId ?? parentTraceId,
      traceDepth: parentDepth ?? 0,
      sessionId
    })
  : createRootTraceHierarchy(traceId, sessionId);

// Emit run.start
const startEvent: TraceEvent = {
  eventId: randomUUID(),
  traceId,
  type: 'run.start',
  timestamp: new Date().toISOString(),
  context: {
    ...traceHierarchy,
  },
  payload: {
    command: 'discuss',
    topic,
    pattern,
    providers: selection.providers,
  },
};
await traceStore.write(startEvent);

try {
  // Execute discussion
  const result = await executor.execute(config);

  // Emit run.end on success
  const endEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.end',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    status: result.success ? 'success' : 'failure',
    context: { ...traceHierarchy },
    payload: {
      command: 'discuss',
      success: result.success,
      synthesis: result.synthesis,
      participatingProviders: result.metadata?.participatingProviders,
    },
  };
  await traceStore.write(endEvent);

  return { /* ... */ };
} catch (error) {
  // Emit run.end on failure
  const endEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.end',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    status: 'failure',
    context: { ...traceHierarchy },
    payload: {
      command: 'discuss',
      success: false,
      error: { message: error instanceof Error ? error.message : 'Unknown error' },
    },
  };
  await traceStore.write(endEvent);
  throw error;
}
```

### 4. Discussion-Specific Event Hooks (Phase 2)

For granular tracing, hook into DiscussionExecutor callbacks:

```typescript
const executor = new DiscussionExecutor({
  providerExecutor: providerBridge,
  // Add event hooks
  onRoundComplete: (round, responses) => {
    traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'discussion.round',
      timestamp: new Date().toISOString(),
      context: { roundNumber: round },
      payload: {
        responses: responses.map(r => ({
          providerId: r.providerId,
          success: r.success
        }))
      },
    }).catch(console.error);
  },
  onProviderResponse: (providerId, response) => {
    traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'discussion.provider',
      timestamp: new Date().toISOString(),
      context: { providerId },
      payload: {
        success: response.success,
        tokenUsage: response.tokenUsage,
      },
    }).catch(console.error);
  },
});
```

## Implementation Plan

### Phase 1: Basic Tracing (Priority 1 - Must Have)
**Scope:** Add `run.start` and `run.end` events to all discussion handlers

| Task | File | Effort |
|------|------|--------|
| Add trace imports to discuss.ts | `mcp-server/src/tools/discuss.ts` | S |
| Implement tracing in `handleDiscuss` | `mcp-server/src/tools/discuss.ts` | M |
| Implement tracing in `handleDiscussQuick` | `mcp-server/src/tools/discuss.ts` | M |
| Implement tracing in `handleDiscussRecursive` | `mcp-server/src/tools/discuss.ts` | M |
| Add unit tests for trace emission | `tests/contract/discuss-tools.test.ts` | M |
| Verify dashboard visibility | Manual testing | S |

**Estimated Effort:** 1-2 days

### Phase 2: Granular Events (Priority 2 - Should Have)
**Scope:** Add discussion-specific events for detailed observability

| Task | File | Effort |
|------|------|--------|
| Add callback hooks to DiscussionExecutor | `discussion-domain/src/executor.ts` | M |
| Emit `discussion.round` events | `mcp-server/src/tools/discuss.ts` | S |
| Emit `discussion.provider` events | `mcp-server/src/tools/discuss.ts` | S |
| Emit `discussion.consensus` events | `mcp-server/src/tools/discuss.ts` | S |
| Add tests for granular events | `tests/contract/discuss-tools.test.ts` | M |
| Update dashboard to show discussion timeline | `cli/src/web/dashboard.ts` | L |

**Estimated Effort:** 2-3 days

### Phase 3: Dashboard Enhancements (Priority 3 - Could Have)
**Scope:** Enhanced visualization for discussion traces

| Task | File | Effort |
|------|------|--------|
| Discussion-specific trace detail view | `cli/src/web/dashboard.ts` | L |
| Provider participation chart | `cli/src/web/dashboard.ts` | M |
| Round timeline visualization | `cli/src/web/dashboard.ts` | M |

**Estimated Effort:** 3-5 days

## Success Criteria

### Phase 1 Complete When:
- [ ] Running `ax_discuss` creates visible traces in dashboard
- [ ] Traces show command type as "discuss" / "discuss_quick" / "discuss_recursive"
- [ ] Success/failure status is correctly recorded
- [ ] Duration is accurately captured
- [ ] All existing discuss tests pass
- [ ] New tests verify trace event emission

### Phase 2 Complete When:
- [ ] Dashboard shows discussion rounds in trace timeline
- [ ] Individual provider responses are visible
- [ ] Provider IDs are correctly correlated
- [ ] Token usage is captured (when available)

### Phase 3 Complete When:
- [ ] Dashboard has dedicated discussion trace view
- [ ] Provider participation is visually represented
- [ ] Round progression is shown in timeline

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Trace writes slow down discussions | Medium | Use fire-and-forget pattern with error logging |
| Breaking existing tests | High | Run full test suite before merge |
| Dashboard overwhelmed with events | Low | Start with run.start/end only, add granular events later |

## Related Documents

- [Trace Invariants](/packages/contracts/src/trace/v1/invariants.md)
- [Trace Schema](/packages/contracts/src/trace/v1/schema.ts)
- [Agent Tracing Reference](/packages/mcp-server/src/tools/agent.ts)

## Appendix: Trace Event Types

The following discussion-specific event types are already defined in the trace schema:

```typescript
// From packages/contracts/src/trace/v1/schema.ts
export const TraceEventTypeSchema = z.enum([
  // ... standard events
  // Discussion-specific events
  'discussion.start',
  'discussion.round',
  'discussion.provider',
  'discussion.consensus',
  'discussion.end',
]);
```
