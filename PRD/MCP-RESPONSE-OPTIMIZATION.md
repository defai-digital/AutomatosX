# PRD: MCP Response Optimization

## Problem Statement

Claude Code's "error compacting conversation" occurs when MCP tools return responses that are:
- **Fat**: Large payloads (>10KB JSON, deep nesting, long arrays)
- **Noisy**: Unstructured text, raw logs, full diffs
- **Sticky**: Data that can't be summarized or deduplicated

This is **not** about MCP count, but about **MCP responses polluting conversation context**.

### Root Cause Analysis

| Factor | Impact | Current Risk |
|--------|--------|--------------|
| Large JSON payloads | High | `trace_get`, `bugfix_scan` return full results |
| Deep nesting | Medium | `agent_run` returns nested step results |
| Long arrays | High | `*_list` tools return unbounded arrays |
| Raw logs/text | High | `trace_analyze` returns analysis text |
| No summarization | Critical | All tools return full data |

---

## Solution: Claude-Safe MCP Response Contract

### Principle 1: Two-Phase Returns

**Current (Wrong)**
```typescript
// MCP returns everything in response
return {
  content: [{
    type: 'text',
    text: JSON.stringify(fullResults) // 50KB of data
  }]
};
```

**Optimized (Correct)**
```typescript
// MCP returns summary + reference
return {
  content: [{
    type: 'text',
    text: JSON.stringify({
      summary: "Found 15 bugs: 3 critical, 5 high, 7 medium",
      count: 15,
      topItems: results.slice(0, 3), // Only top 3
      artifactRef: `ax://traces/${traceId}`, // Full data stored externally
      hasMore: results.length > 3,
    })
  }]
};
```

### Principle 2: Hard Response Limits

| Constraint | Limit | Enforcement |
|------------|-------|-------------|
| Total response size | ≤ 10 KB | Truncate + summarize |
| JSON depth | ≤ 4 levels | Flatten deeper structures |
| Array length | ≤ 10 items | Paginate with `hasMore` |
| String fields | ≤ 500 chars | Truncate with `...` |
| Log lines | ≤ 20 lines | Head/tail with count |

### Principle 3: Strict Response Schema

All MCP responses MUST follow this structure:

```typescript
interface MCPResponseContract {
  // Required: One-line summary
  summary: string; // max 100 chars

  // Required: Action result
  success: boolean;

  // Optional: Numeric counts (compressible)
  count?: number;

  // Optional: Top N items only
  items?: Array<{
    id: string;
    label: string; // max 50 chars
    severity?: 'critical' | 'high' | 'medium' | 'low';
  }>; // max 10 items

  // Optional: Reference to full data
  artifactRef?: string; // ax://domain/id

  // Optional: Pagination
  hasMore?: boolean;
  nextCursor?: string;
}
```

---

## Implementation Plan

### Phase 1: Response Wrapper Utility

**File: `packages/mcp-server/src/utils/response.ts`**

```typescript
import { estimateTokens } from './tokens.js';

export interface ResponseLimits {
  maxBytes: number;      // Default: 10240 (10KB)
  maxArrayItems: number; // Default: 10
  maxStringLength: number; // Default: 500
  maxJsonDepth: number;  // Default: 4
}

export const DEFAULT_LIMITS: ResponseLimits = {
  maxBytes: 10240,
  maxArrayItems: 10,
  maxStringLength: 500,
  maxJsonDepth: 4,
};

/**
 * Wrap MCP response to enforce Claude-safe limits
 * INV-MCP-RESP-001: All responses must be compressible
 */
export function wrapResponse<T>(
  data: T,
  options: {
    summary: string;
    limits?: Partial<ResponseLimits>;
    artifactStore?: (data: T) => Promise<string>; // Returns artifactRef
  }
): MCPToolResult {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };

  // Enforce limits
  const truncated = truncateResponse(data, limits);
  const needsArtifact = JSON.stringify(data).length > limits.maxBytes;

  let artifactRef: string | undefined;
  if (needsArtifact && options.artifactStore) {
    artifactRef = await options.artifactStore(data);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        summary: options.summary.slice(0, 100),
        ...truncated,
        ...(artifactRef ? { artifactRef, hasMore: true } : {}),
      }, null, 2)
    }]
  };
}

/**
 * Truncate arrays, strings, and flatten deep objects
 */
function truncateResponse(data: unknown, limits: ResponseLimits, depth = 0): unknown {
  if (depth > limits.maxJsonDepth) {
    return '[truncated]';
  }

  if (Array.isArray(data)) {
    const truncated = data.slice(0, limits.maxArrayItems).map(
      item => truncateResponse(item, limits, depth + 1)
    );
    if (data.length > limits.maxArrayItems) {
      return {
        items: truncated,
        totalCount: data.length,
        showing: limits.maxArrayItems,
      };
    }
    return truncated;
  }

  if (typeof data === 'string' && data.length > limits.maxStringLength) {
    return data.slice(0, limits.maxStringLength) + '...';
  }

  if (typeof data === 'object' && data !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = truncateResponse(value, limits, depth + 1);
    }
    return result;
  }

  return data;
}

/**
 * Create summary from results
 */
export function createSummary(
  action: string,
  results: { count: number; bySeverity?: Record<string, number> }
): string {
  const { count, bySeverity } = results;
  if (bySeverity) {
    const parts = Object.entries(bySeverity)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`);
    return `${action}: ${count} total (${parts.join(', ')})`;
  }
  return `${action}: ${count} items`;
}
```

### Phase 2: Apply to High-Risk Tools

#### 2.1 Bugfix Tools (High Risk)

**Before:**
```typescript
return {
  content: [{
    type: 'text',
    text: JSON.stringify({ bugs: allBugs }, null, 2) // Could be 100KB+
  }]
};
```

**After:**
```typescript
import { wrapResponse, createSummary } from '../utils/response.js';

const bySeverity = {
  critical: bugs.filter(b => b.severity === 'critical').length,
  high: bugs.filter(b => b.severity === 'high').length,
  medium: bugs.filter(b => b.severity === 'medium').length,
  low: bugs.filter(b => b.severity === 'low').length,
};

return wrapResponse(bugs, {
  summary: createSummary('Found bugs', { count: bugs.length, bySeverity }),
  artifactStore: async (data) => {
    // Store full results in memory domain
    const key = `bugfix:scan:${scanId}`;
    await memoryStore(key, data);
    return `ax://bugfix/${scanId}`;
  }
});
```

#### 2.2 Trace Tools (High Risk)

**Before:**
```typescript
return {
  content: [{
    type: 'text',
    text: JSON.stringify(fullTrace, null, 2) // Entire execution trace
  }]
};
```

**After:**
```typescript
return wrapResponse({
  traceId: trace.traceId,
  status: trace.status,
  duration: trace.durationMs,
  eventCount: trace.events.length,
  // Only include first/last events
  startEvent: trace.events[0],
  endEvent: trace.events[trace.events.length - 1],
  errorSummary: trace.error?.message,
}, {
  summary: `Trace ${trace.traceId}: ${trace.status} (${trace.durationMs}ms, ${trace.events.length} events)`,
  artifactStore: async (data) => {
    await memoryStore(`trace:${trace.traceId}`, trace);
    return `ax://trace/${trace.traceId}`;
  }
});
```

#### 2.3 List Tools (Medium Risk)

All `*_list` tools should enforce pagination:

```typescript
export function paginatedListResponse<T extends { id: string }>(
  items: T[],
  options: {
    domain: string;
    limit?: number;
    labelField?: keyof T;
  }
) {
  const limit = options.limit ?? 10;
  const showing = items.slice(0, limit);

  return {
    summary: `${items.length} ${options.domain}(s)`,
    items: showing.map(item => ({
      id: item.id,
      label: String(item[options.labelField ?? 'id']).slice(0, 50),
    })),
    totalCount: items.length,
    hasMore: items.length > limit,
  };
}
```

### Phase 3: Artifact Storage Integration

Store full results externally, return only references:

```typescript
// packages/mcp-server/src/utils/artifact-store.ts

import { handleMemoryStore } from '../tools/memory.js';

/**
 * Store artifact and return reference
 * Full data stored in memory domain, not in conversation
 */
export async function storeArtifact(
  domain: string,
  id: string,
  data: unknown
): Promise<string> {
  const key = `${domain}:${id}`;
  await handleMemoryStore({
    key,
    value: data,
    namespace: 'artifacts',
  });
  return `ax://${domain}/${id}`;
}

/**
 * Retrieve artifact by reference
 */
export async function retrieveArtifact(ref: string): Promise<unknown> {
  const match = ref.match(/^ax:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid artifact ref: ${ref}`);

  const [, domain, id] = match;
  const result = await handleMemoryRetrieve({
    key: `${domain}:${id}`,
    namespace: 'artifacts',
  });

  return JSON.parse(result.content[0].text);
}
```

---

## Tool-Specific Optimizations

### High Risk Tools (Must Optimize)

| Tool | Risk | Optimization |
|------|------|--------------|
| `bugfix_scan` | Critical | Return summary + top 5, store full in artifact |
| `bugfix_list` | High | Paginate, max 10 items |
| `refactor_scan` | Critical | Return summary + top 5, store full in artifact |
| `refactor_list` | High | Paginate, max 10 items |
| `trace_get` | Critical | Return summary, store events in artifact |
| `trace_analyze` | High | Return key metrics only, no raw analysis |
| `agent_run` | High | Return summary, store stepResults in artifact |

### Medium Risk Tools (Should Optimize)

| Tool | Risk | Optimization |
|------|------|--------------|
| `session_status` | Medium | Limit participant details |
| `session_list` | Medium | Paginate, max 10 sessions |
| `memory_search` | Medium | Paginate results, max 10 matches |
| `workflow_list` | Low | Paginate if >10 workflows |
| `agent_list` | Low | Paginate if >10 agents |

### Low Risk Tools (Monitor Only)

| Tool | Risk | Notes |
|------|------|-------|
| `memory_store` | Low | Returns confirmation only |
| `memory_retrieve` | Low | Single item, user-requested |
| `config_*` | Low | Small payloads |
| `guard_*` | Low | Structured results |

---

## Response Size Budget

Target: **< 10 KB per response, < 25 KB total MCP context**

| Category | Budget | Tools |
|----------|--------|-------|
| Execution results | 3 KB | agent_run, workflow_run |
| List responses | 2 KB | *_list tools |
| Status/details | 1.5 KB | session_status, trace_get |
| Scan results | 2 KB | bugfix_scan, refactor_scan |
| Config/memory | 1.5 KB | config_*, memory_* |

---

## Invariants

Add to `packages/mcp-server/src/invariants.md`:

```markdown
## Response Optimization Invariants

- **INV-MCP-RESP-001**: All MCP responses MUST be < 10 KB
- **INV-MCP-RESP-002**: Arrays MUST be limited to 10 items with `hasMore` flag
- **INV-MCP-RESP-003**: Strings MUST be truncated at 500 chars
- **INV-MCP-RESP-004**: JSON depth MUST NOT exceed 4 levels
- **INV-MCP-RESP-005**: Large results MUST be stored as artifacts with `artifactRef`
- **INV-MCP-RESP-006**: All responses MUST include `summary` field (max 100 chars)
```

---

## Testing Plan

### 1. Response Size Tests

```typescript
describe('MCP Response Limits', () => {
  it('should enforce 10KB limit on all responses', async () => {
    for (const tool of ALL_TOOLS) {
      const result = await TOOL_HANDLERS[tool.name](mockArgs);
      const size = JSON.stringify(result).length;
      expect(size).toBeLessThan(10240);
    }
  });

  it('should truncate arrays to 10 items', async () => {
    const result = await handleBugfixScan({ paths: ['src/'] });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.items?.length ?? 0).toBeLessThanOrEqual(10);
  });

  it('should include summary in all responses', async () => {
    for (const tool of ALL_TOOLS) {
      const result = await TOOL_HANDLERS[tool.name](mockArgs);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.length).toBeLessThanOrEqual(100);
    }
  });
});
```

### 2. Artifact Storage Tests

```typescript
describe('Artifact Storage', () => {
  it('should store large results as artifacts', async () => {
    const result = await handleBugfixScan({ paths: ['large-codebase/'] });
    const parsed = JSON.parse(result.content[0].text);

    if (parsed.hasMore) {
      expect(parsed.artifactRef).toMatch(/^ax:\/\/bugfix\//);

      // Verify artifact is retrievable
      const full = await retrieveArtifact(parsed.artifactRef);
      expect(full.bugs.length).toBeGreaterThan(10);
    }
  });
});
```

---

## Migration Path

### Phase 1 (Immediate): Add Response Wrapper
- Create `utils/response.ts`
- Apply to `bugfix_*` and `refactor_*` tools

### Phase 2 (Week 1): High-Risk Tools
- Apply to `trace_*` tools
- Apply to `agent_run`

### Phase 3 (Week 2): All Tools
- Apply wrapper to all list tools
- Add response size monitoring

### Phase 4 (Ongoing): Monitoring
- Log response sizes
- Alert on >10KB responses
- Track artifact storage usage

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Max response size | Unbounded | < 10 KB |
| Avg response size | ~5 KB | < 3 KB |
| Compaction errors | Frequent | Zero |
| Artifact storage usage | N/A | < 100 MB/session |
