# MCP Gap Closure PRD

**Version**: 1.0.0
**Created**: 2025-12-14
**Status**: Approved for Implementation

---

## Executive Summary

This PRD addresses identified gaps between the current AutomatosX MCP implementation and full feature parity. All implementations must follow AutomatosX architectural principles:

- **Contract-Driven**: Schemas in `@automatosx/contracts`
- **Domain-Driven**: Clear domain-tool mapping
- **Behavior-Driven**: Testable invariants (INV-MCP-*)
- **Governance-Driven**: Guard integration where applicable
- **Event-Sourced**: Tool calls emit trace events

---

## 1. Gap Analysis Summary

| Priority | Feature | Current | Target | Domain |
|----------|---------|---------|--------|--------|
| HIGH | memory_list | Missing | Implemented | memory-domain |
| HIGH | memory_delete | Missing | Implemented | memory-domain |
| HIGH | session_join | Missing | Implemented | session-domain |
| HIGH | session_leave | Missing | Implemented | session-domain |
| HIGH | Trace Integration | None | All tools traced | trace-domain |
| MEDIUM | MCP Resources | None | 4 resources | mcp-server |
| MEDIUM | Output Validation | None | Zod validation | contracts |
| LOW | MCP Prompts | None | 3 prompts | mcp-server |
| LOW | agent_register | Missing | Implemented | agent-domain |
| LOW | agent_remove | Missing | Implemented | agent-domain |
| LOW | session_fail | Missing | Implemented | session-domain |

---

## 2. High Priority Requirements

### 2.1 Memory Tools Completion

#### 2.1.1 memory_list Tool

**Purpose**: List all keys in memory with optional namespace filtering.

**Contract Schema** (`packages/contracts/src/mcp/v1/tools/memory.ts`):

```typescript
export const MemoryListInputSchema = z.object({
  namespace: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  prefix: z.string().max(200).optional(),
});

export const MemoryListOutputSchema = z.object({
  keys: z.array(z.object({
    key: z.string(),
    namespace: z.string(),
    storedAt: z.string().datetime(),
  })),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});
```

**Invariants**:
- INV-MCP-MEM-001: Keys returned in storage order (oldest first)
- INV-MCP-MEM-002: Namespace filter is exact match
- INV-MCP-MEM-003: Prefix filter is case-sensitive

#### 2.1.2 memory_delete Tool

**Purpose**: Delete a key from memory.

**Contract Schema**:

```typescript
export const MemoryDeleteInputSchema = z.object({
  key: z.string().min(1).max(500),
  namespace: z.string().max(100).optional(),
});

export const MemoryDeleteOutputSchema = z.object({
  deleted: z.boolean(),
  key: z.string(),
  namespace: z.string(),
  message: z.string(),
});

export const MemoryToolErrorCode = {
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  DELETE_FAILED: 'DELETE_FAILED',
  NAMESPACE_NOT_FOUND: 'NAMESPACE_NOT_FOUND',
} as const;
```

**Invariants**:
- INV-MCP-MEM-004: Delete is idempotent (deleting non-existent key returns deleted=false)
- INV-MCP-MEM-005: Delete emits trace event with key info

---

### 2.2 Session Tools Completion

#### 2.2.1 session_join Tool

**Purpose**: Join an existing session as a participant.

**Contract Schema** (`packages/contracts/src/mcp/v1/tools/session.ts` - extend existing):

```typescript
export const SessionJoinInputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().min(1).max(50),
  role: z.enum(['collaborator', 'observer', 'specialist']).optional().default('collaborator'),
});

export const SessionJoinOutputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string(),
  role: z.string(),
  joinedAt: z.string().datetime(),
  participantCount: z.number().int().min(1),
});
```

**Invariants**:
- INV-MCP-SES-001: Cannot join completed/failed session
- INV-MCP-SES-002: Joining twice returns existing participation (idempotent)
- INV-MCP-SES-003: Max participants enforced (default: 10)

#### 2.2.2 session_leave Tool

**Purpose**: Leave a session.

**Contract Schema**:

```typescript
export const SessionLeaveInputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().min(1).max(50),
});

export const SessionLeaveOutputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string(),
  leftAt: z.string().datetime(),
  remainingParticipants: z.number().int().min(0),
});
```

**Invariants**:
- INV-MCP-SES-004: Cannot leave if not a participant
- INV-MCP-SES-005: Initiator cannot leave active session (must complete/fail first)

---

### 2.3 Trace Integration

**Purpose**: All MCP tool calls emit trace events for observability.

**Design Pattern**: Decorator/wrapper around tool handlers.

**Contract Schema** (`packages/contracts/src/mcp/v1/tools/trace.ts` - extend):

```typescript
export const ToolTraceEventSchema = z.object({
  toolName: z.string(),
  input: z.record(z.unknown()),
  output: z.unknown().optional(),
  durationMs: z.number(),
  success: z.boolean(),
  errorCode: z.string().optional(),
});
```

**Implementation** (`packages/mcp-server/src/trace-wrapper.ts`):

```typescript
export function withTracing(
  toolName: string,
  handler: ToolHandler,
  recorder: TraceRecorder
): ToolHandler {
  return async (args) => {
    const traceId = await recorder.startTrace(`mcp.${toolName}`);
    const startTime = Date.now();

    try {
      await recorder.recordEvent(traceId, 'tool.invoke', {
        payload: { toolName, input: args },
      });

      const result = await handler(args);
      const durationMs = Date.now() - startTime;

      await recorder.recordEvent(traceId, 'tool.result', {
        payload: { toolName, success: !result.isError, durationMs },
        durationMs,
      });

      await recorder.endTrace(traceId, !result.isError);
      return result;
    } catch (error) {
      await recorder.recordError(traceId, 'TOOL_ERROR', error.message);
      await recorder.endTrace(traceId, false);
      throw error;
    }
  };
}
```

**Invariants**:
- INV-MCP-007: Every tool call produces exactly one trace
- INV-MCP-008: Trace includes input/output/duration/success

---

## 3. Medium Priority Requirements

### 3.1 MCP Resources

**Purpose**: Expose read-only data via MCP Resource protocol (application-controlled).

**Resources to implement**:

| URI Pattern | Description | Data Source |
|-------------|-------------|-------------|
| `automatosx://workflows` | List all workflows | workflow-engine |
| `automatosx://workflows/{id}` | Get workflow by ID | workflow-engine |
| `automatosx://agents` | List all agents | agent-domain |
| `automatosx://agents/{id}` | Get agent by ID | agent-domain |
| `automatosx://policies` | List all policies | guard |
| `automatosx://policies/{id}` | Get policy by ID | guard |
| `automatosx://sessions/active` | List active sessions | session-domain |

**Contract Schema** (`packages/contracts/src/mcp/v1/resources/schema.ts`):

```typescript
export const McpResourceSchema = z.object({
  uri: z.string().url(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().default('application/json'),
});

export const ResourceListResponseSchema = z.object({
  resources: z.array(McpResourceSchema),
});

export const ResourceReadResponseSchema = z.object({
  contents: z.array(z.object({
    uri: z.string(),
    mimeType: z.string(),
    text: z.string().optional(),
    blob: z.string().optional(), // base64
  })),
});
```

**Implementation** (`packages/mcp-server/src/resources/`):

```
resources/
├── index.ts         # Resource registry
├── workflows.ts     # Workflow resources
├── agents.ts        # Agent resources
├── policies.ts      # Policy resources
└── sessions.ts      # Session resources
```

**Invariants**:
- INV-MCP-RES-001: Resources are read-only
- INV-MCP-RES-002: URI patterns follow RFC 3986
- INV-MCP-RES-003: Content returned as JSON text

---

### 3.2 Output Validation

**Purpose**: Validate tool outputs against Zod schemas at runtime.

**Implementation Pattern**:

```typescript
// packages/mcp-server/src/validation.ts
import { type ToolResult } from './types.js';
import { type z } from 'zod';

export function validateOutput<T>(
  schema: z.ZodType<T>,
  toolName: string,
  output: unknown
): T {
  const result = schema.safeParse(output);
  if (!result.success) {
    console.warn(`Output validation failed for ${toolName}:`, result.error);
    // Log but don't fail - graceful degradation
  }
  return output as T;
}

// Usage in handlers
export const handleSessionCreate: ToolHandler = async (args) => {
  // ... implementation
  const output = { sessionId, initiator, task, status, createdAt, workspace };
  validateOutput(SessionCreateOutputSchema, 'session_create', output);
  return { content: [{ type: 'text', text: JSON.stringify(output) }] };
};
```

**Invariants**:
- INV-MCP-VAL-001: Validation failures logged but don't break response
- INV-MCP-VAL-002: All output schemas defined in contracts package

---

## 4. Low Priority Requirements

### 4.1 MCP Prompts

**Purpose**: Provide reusable prompt templates (user-controlled).

**Prompts to implement**:

| Name | Description | Arguments |
|------|-------------|-----------|
| `code-review` | Code review prompt template | `files`, `focus_areas` |
| `refactor-plan` | Refactoring plan template | `target`, `goals`, `constraints` |
| `debug-assist` | Debugging assistance template | `error_message`, `context` |

**Contract Schema** (`packages/contracts/src/mcp/v1/prompts/schema.ts`):

```typescript
export const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
});

export const PromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
});

export const GetPromptResponseSchema = z.object({
  description: z.string().optional(),
  messages: z.array(PromptMessageSchema),
});
```

---

### 4.2 Agent Tools Completion

#### 4.2.1 agent_register Tool

**Purpose**: Register a new agent profile via MCP.

**Contract Schema**:

```typescript
export const AgentRegisterInputSchema = z.object({
  agentId: z.string().min(1).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
  description: z.string().min(1).max(1000),
  displayName: z.string().max(100).optional(),
  team: z.string().max(100).optional(),
  capabilities: z.array(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});

export const AgentRegisterOutputSchema = z.object({
  registered: z.boolean(),
  agentId: z.string(),
  message: z.string(),
});
```

#### 4.2.2 agent_remove Tool

**Purpose**: Remove an agent from the registry.

**Contract Schema**:

```typescript
export const AgentRemoveInputSchema = z.object({
  agentId: z.string().min(1).max(50),
});

export const AgentRemoveOutputSchema = z.object({
  removed: z.boolean(),
  agentId: z.string(),
  message: z.string(),
});
```

---

### 4.3 session_fail Tool

**Purpose**: Mark a session as failed with error details.

**Contract Schema**:

```typescript
export const SessionFailInputSchema = z.object({
  sessionId: z.string().uuid(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    taskId: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }),
});

export const SessionFailOutputSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('failed'),
  failedAt: z.string().datetime(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
```

---

## 5. Implementation Plan

### Phase 1: High Priority (Contracts + Tools)

| Step | Task | Files |
|------|------|-------|
| 1.1 | Create memory tool contracts | `contracts/src/mcp/v1/tools/memory.ts` |
| 1.2 | Extend session tool contracts | `contracts/src/mcp/v1/tools/session.ts` |
| 1.3 | Implement memory_list handler | `mcp-server/src/tools/memory.ts` |
| 1.4 | Implement memory_delete handler | `mcp-server/src/tools/memory.ts` |
| 1.5 | Implement session_join handler | `mcp-server/src/tools/session.ts` |
| 1.6 | Implement session_leave handler | `mcp-server/src/tools/session.ts` |
| 1.7 | Update tool registry | `mcp-server/src/tools/index.ts` |
| 1.8 | Add tests for new tools | `tests/application/mcp-server.test.ts` |

### Phase 2: High Priority (Trace Integration)

| Step | Task | Files |
|------|------|-------|
| 2.1 | Create trace wrapper | `mcp-server/src/trace-wrapper.ts` |
| 2.2 | Apply wrapper to all handlers | `mcp-server/src/tools/*.ts` |
| 2.3 | Add trace integration tests | `tests/application/mcp-trace.test.ts` |

### Phase 3: Medium Priority (Resources)

| Step | Task | Files |
|------|------|-------|
| 3.1 | Create resource contracts | `contracts/src/mcp/v1/resources/schema.ts` |
| 3.2 | Implement resource handlers | `mcp-server/src/resources/*.ts` |
| 3.3 | Register resources in server | `mcp-server/src/server.ts` |
| 3.4 | Add resource tests | `tests/application/mcp-resources.test.ts` |

### Phase 4: Medium Priority (Validation)

| Step | Task | Files |
|------|------|-------|
| 4.1 | Create validation utility | `mcp-server/src/validation.ts` |
| 4.2 | Apply to all handlers | `mcp-server/src/tools/*.ts` |

### Phase 5: Low Priority (Remaining)

| Step | Task | Files |
|------|------|-------|
| 5.1 | Create prompt contracts | `contracts/src/mcp/v1/prompts/schema.ts` |
| 5.2 | Implement prompt handlers | `mcp-server/src/prompts/*.ts` |
| 5.3 | Extend agent contracts | `contracts/src/mcp/v1/tools/agent.ts` |
| 5.4 | Implement agent_register/remove | `mcp-server/src/tools/agent.ts` |
| 5.5 | Extend session contracts | `contracts/src/mcp/v1/tools/session.ts` |
| 5.6 | Implement session_fail | `mcp-server/src/tools/session.ts` |
| 5.7 | Update registry and tests | Various |

---

## 6. Success Criteria

### Functional Requirements

- [ ] All 25 MCP tools implemented and tested
- [ ] All 7 MCP resources implemented and tested
- [ ] All 3 MCP prompts implemented and tested
- [ ] 100% contract coverage for inputs/outputs
- [ ] Trace integration for all tool calls

### Non-Functional Requirements

- [ ] Build passes: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] No TypeScript errors
- [ ] Follows existing code patterns

### Tool Count Target

| Category | Current | Target | Delta |
|----------|---------|--------|-------|
| Workflow | 3 | 3 | 0 |
| Trace | 3 | 3 | 0 |
| Memory | 3 | 5 | +2 |
| Guard | 3 | 3 | 0 |
| Agent | 3 | 5 | +2 |
| Session | 4 | 7 | +3 |
| **Total** | **19** | **26** | **+7** |

---

## 7. Appendix: Tool Summary

### Final Tool List (26 Tools)

**Workflow Tools (3)**:
- workflow_run, workflow_list, workflow_describe

**Trace Tools (3)**:
- trace_list, trace_get, trace_analyze

**Memory Tools (5)**:
- memory_store, memory_retrieve, memory_search, **memory_list**, **memory_delete**

**Guard Tools (3)**:
- guard_check, guard_list, guard_apply

**Agent Tools (5)**:
- agent_list, agent_run, agent_get, **agent_register**, **agent_remove**

**Session Tools (7)**:
- session_create, session_status, session_complete, session_list, **session_join**, **session_leave**, **session_fail**
