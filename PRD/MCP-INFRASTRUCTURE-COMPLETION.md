# MCP Infrastructure Completion PRD

**Version**: 2.0.0
**Created**: 2025-12-14
**Status**: Approved for Implementation

---

## Executive Summary

This PRD addresses remaining infrastructure gaps for full MCP feature parity. All implementations follow AutomatosX architectural principles:

- **Contract-Driven**: Schemas in `@defai.digital/contracts`
- **Domain-Driven**: Clear domain mapping
- **Behavior-Driven**: Testable invariants (INV-MCP-*)
- **Governance-Driven**: Guard integration where applicable
- **Event-Sourced**: All tool calls emit trace events

---

## 1. Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| MCP Tools (26) | COMPLETE | All tools implemented |
| Tool Contracts | COMPLETE | All schemas defined |
| Tool Tests | COMPLETE | 430 tests passing |
| Trace Integration | **PENDING** | Infrastructure wrapper needed |
| Output Validation | **PENDING** | Runtime validation needed |
| MCP Resources | **PENDING** | 7 resources needed |
| MCP Prompts | **PENDING** | 3 prompts needed |

---

## 2. HIGH Priority: Trace Integration

### 2.1 Purpose

Wrap all MCP tool handlers to emit trace events for observability, following INV-TR-* invariants.

### 2.2 Design Pattern

**Decorator/Higher-Order Function** approach that wraps existing handlers without modifying them.

### 2.3 Contract Schema

**File**: `packages/contracts/src/mcp/v1/trace/tool-trace.ts`

```typescript
import { z } from 'zod';

/**
 * Tool trace event schema
 * Records MCP tool invocations for observability
 */
export const ToolTraceEventSchema = z.object({
  toolName: z.string(),
  input: z.record(z.unknown()),
  output: z.unknown().optional(),
  durationMs: z.number().min(0),
  success: z.boolean(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type ToolTraceEvent = z.infer<typeof ToolTraceEventSchema>;
```

### 2.4 Implementation

**File**: `packages/mcp-server/src/trace-wrapper.ts`

```typescript
import type { ToolHandler, MCPToolResult } from './types.js';
import type { TraceRecorder } from '@defai.digital/trace-domain';

/**
 * Wraps a tool handler with tracing
 *
 * Invariants:
 * - INV-MCP-007: Every tool call produces exactly one trace
 * - INV-MCP-008: Trace includes input/output/duration/success
 */
export function withTracing(
  toolName: string,
  handler: ToolHandler,
  recorder: TraceRecorder
): ToolHandler {
  return async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const traceId = await recorder.startTrace(`mcp.tool.${toolName}`);
    const startTime = Date.now();

    try {
      // Record tool invocation
      await recorder.recordEvent(traceId, 'tool.invoke', {
        payload: { toolName, input: args },
      });

      // Execute handler
      const result = await handler(args);
      const durationMs = Date.now() - startTime;

      // Record result
      await recorder.recordEvent(traceId, 'tool.result', {
        payload: {
          toolName,
          success: !result.isError,
          durationMs,
          hasOutput: result.content.length > 0,
        },
        durationMs,
        status: result.isError ? 'failure' : 'success',
      });

      await recorder.endTrace(traceId, !result.isError, { durationMs });
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      await recorder.recordError(traceId, 'TOOL_ERROR', message, {
        toolName,
        durationMs,
      });
      await recorder.endTrace(traceId, false, undefined, {
        code: 'TOOL_ERROR',
        message,
      });

      throw error;
    }
  };
}

/**
 * Wraps all handlers in a registry with tracing
 */
export function wrapHandlersWithTracing(
  handlers: Record<string, ToolHandler>,
  recorder: TraceRecorder
): Record<string, ToolHandler> {
  const wrapped: Record<string, ToolHandler> = {};
  for (const [name, handler] of Object.entries(handlers)) {
    wrapped[name] = withTracing(name, handler, recorder);
  }
  return wrapped;
}
```

### 2.5 Invariants

- **INV-MCP-007**: Every tool call produces exactly one trace (start → result → end)
- **INV-MCP-008**: Trace includes input/output/duration/success metrics

---

## 3. MEDIUM Priority: Output Validation

### 3.1 Purpose

Validate all tool outputs against Zod schemas at runtime with graceful degradation.

### 3.2 Design Pattern

**Validation utility** that logs validation failures but doesn't break responses.

### 3.3 Implementation

**File**: `packages/mcp-server/src/validation.ts`

```typescript
import { type z } from 'zod';

/**
 * Validates tool output against schema
 *
 * Invariants:
 * - INV-MCP-VAL-001: Validation failures logged but don't break response
 * - INV-MCP-VAL-002: All output schemas defined in contracts package
 */
export function validateOutput<T>(
  schema: z.ZodType<T>,
  toolName: string,
  output: unknown
): { valid: boolean; data: T; errors?: string[] } {
  const result = schema.safeParse(output);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  // INV-MCP-VAL-001: Log but don't fail
  const errors = result.error.errors.map(
    (e) => `${e.path.join('.')}: ${e.message}`
  );
  console.warn(`Output validation failed for ${toolName}:`, errors);

  return { valid: false, data: output as T, errors };
}

/**
 * Creates a validated handler wrapper
 */
export function withValidation<T>(
  handler: ToolHandler,
  outputSchema: z.ZodType<T>,
  toolName: string
): ToolHandler {
  return async (args) => {
    const result = await handler(args);

    // Parse output from content
    if (result.content.length > 0 && result.content[0].text) {
      try {
        const parsed = JSON.parse(result.content[0].text);
        validateOutput(outputSchema, toolName, parsed);
      } catch {
        // JSON parse error - skip validation
      }
    }

    return result;
  };
}
```

### 3.4 Invariants

- **INV-MCP-VAL-001**: Validation failures logged but don't break response
- **INV-MCP-VAL-002**: All output schemas defined in contracts package

---

## 4. MEDIUM Priority: MCP Resources

### 4.1 Purpose

Expose read-only data via MCP Resource protocol (application-controlled).

### 4.2 Resources to Implement

| URI Pattern | Description | Data Source |
|-------------|-------------|-------------|
| `automatosx://workflows` | List all workflows | workflow-engine |
| `automatosx://workflows/{id}` | Get workflow by ID | workflow-engine |
| `automatosx://agents` | List all agents | agent-domain |
| `automatosx://agents/{id}` | Get agent by ID | agent-domain |
| `automatosx://policies` | List all policies | guard |
| `automatosx://policies/{id}` | Get policy by ID | guard |
| `automatosx://sessions/active` | List active sessions | session-domain |

### 4.3 Contract Schema

**File**: `packages/contracts/src/mcp/v1/resources/schema.ts`

```typescript
import { z } from 'zod';

/**
 * MCP Resource definition
 */
export const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().default('application/json'),
});

export type McpResource = z.infer<typeof McpResourceSchema>;

/**
 * Resource list response
 */
export const ResourceListResponseSchema = z.object({
  resources: z.array(McpResourceSchema),
});

export type ResourceListResponse = z.infer<typeof ResourceListResponseSchema>;

/**
 * Resource content item
 */
export const ResourceContentSchema = z.object({
  uri: z.string(),
  mimeType: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(), // base64 encoded
});

export type ResourceContent = z.infer<typeof ResourceContentSchema>;

/**
 * Resource read response
 */
export const ResourceReadResponseSchema = z.object({
  contents: z.array(ResourceContentSchema),
});

export type ResourceReadResponse = z.infer<typeof ResourceReadResponseSchema>;
```

### 4.4 Implementation Structure

```
packages/mcp-server/src/resources/
├── index.ts         # Resource registry and handlers
├── workflows.ts     # Workflow resource handlers
├── agents.ts        # Agent resource handlers
├── policies.ts      # Policy resource handlers
└── sessions.ts      # Session resource handlers
```

### 4.5 Invariants

- **INV-MCP-RES-001**: Resources are read-only
- **INV-MCP-RES-002**: URI patterns follow RFC 3986
- **INV-MCP-RES-003**: Content returned as JSON text

---

## 5. LOW Priority: MCP Prompts

### 5.1 Purpose

Provide reusable prompt templates (user-controlled).

### 5.2 Prompts to Implement

| Name | Description | Arguments |
|------|-------------|-----------|
| `code-review` | Code review prompt | `files`, `focus_areas` |
| `refactor-plan` | Refactoring plan | `target`, `goals`, `constraints` |
| `debug-assist` | Debugging assistance | `error_message`, `context` |

### 5.3 Contract Schema

**File**: `packages/contracts/src/mcp/v1/prompts/schema.ts`

```typescript
import { z } from 'zod';

/**
 * Prompt argument definition
 */
export const PromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export type PromptArgument = z.infer<typeof PromptArgumentSchema>;

/**
 * MCP Prompt definition
 */
export const McpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(PromptArgumentSchema).optional(),
});

export type McpPrompt = z.infer<typeof McpPromptSchema>;

/**
 * Prompt message
 */
export const PromptMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
});

export type PromptMessage = z.infer<typeof PromptMessageSchema>;

/**
 * Get prompt response
 */
export const GetPromptResponseSchema = z.object({
  description: z.string().optional(),
  messages: z.array(PromptMessageSchema),
});

export type GetPromptResponse = z.infer<typeof GetPromptResponseSchema>;
```

### 5.4 Implementation Structure

```
packages/mcp-server/src/prompts/
├── index.ts         # Prompt registry
├── code-review.ts   # Code review prompt
├── refactor-plan.ts # Refactoring prompt
└── debug-assist.ts  # Debugging prompt
```

---

## 6. Implementation Plan

### Phase 1: Contracts (All Priorities)

| Step | Task | File |
|------|------|------|
| 1.1 | Create tool trace contract | `contracts/src/mcp/v1/trace/tool-trace.ts` |
| 1.2 | Create resource contracts | `contracts/src/mcp/v1/resources/schema.ts` |
| 1.3 | Create prompt contracts | `contracts/src/mcp/v1/prompts/schema.ts` |
| 1.4 | Update contracts index | `contracts/src/mcp/v1/index.ts` |

### Phase 2: HIGH Priority Implementation

| Step | Task | File |
|------|------|------|
| 2.1 | Create trace wrapper | `mcp-server/src/trace-wrapper.ts` |
| 2.2 | Create validation utility | `mcp-server/src/validation.ts` |
| 2.3 | Update server to use wrapped handlers | `mcp-server/src/server.ts` |

### Phase 3: MEDIUM Priority Implementation

| Step | Task | File |
|------|------|------|
| 3.1 | Create resource index | `mcp-server/src/resources/index.ts` |
| 3.2 | Implement workflow resources | `mcp-server/src/resources/workflows.ts` |
| 3.3 | Implement agent resources | `mcp-server/src/resources/agents.ts` |
| 3.4 | Implement policy resources | `mcp-server/src/resources/policies.ts` |
| 3.5 | Implement session resources | `mcp-server/src/resources/sessions.ts` |
| 3.6 | Add resources to server | `mcp-server/src/server.ts` |

### Phase 4: LOW Priority Implementation

| Step | Task | File |
|------|------|------|
| 4.1 | Create prompt index | `mcp-server/src/prompts/index.ts` |
| 4.2 | Implement code-review prompt | `mcp-server/src/prompts/code-review.ts` |
| 4.3 | Implement refactor-plan prompt | `mcp-server/src/prompts/refactor-plan.ts` |
| 4.4 | Implement debug-assist prompt | `mcp-server/src/prompts/debug-assist.ts` |
| 4.5 | Add prompts to server | `mcp-server/src/server.ts` |

### Phase 5: Testing

| Step | Task | File |
|------|------|------|
| 5.1 | Add trace wrapper tests | `tests/application/mcp-trace.test.ts` |
| 5.2 | Add validation tests | `tests/application/mcp-validation.test.ts` |
| 5.3 | Add resource tests | `tests/application/mcp-resources.test.ts` |
| 5.4 | Add prompt tests | `tests/application/mcp-prompts.test.ts` |
| 5.5 | Update server tests | `tests/application/mcp-server.test.ts` |

---

## 7. Success Criteria

### Functional Requirements

- [ ] Trace wrapper implemented and applied to all 26 tools
- [ ] Validation utility implemented with graceful degradation
- [ ] All 7 MCP resources implemented
- [ ] All 3 MCP prompts implemented
- [ ] Server handles resources/list, resources/read methods
- [ ] Server handles prompts/list, prompts/get methods

### Non-Functional Requirements

- [ ] Build passes: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] No TypeScript errors
- [ ] Follows existing code patterns
- [ ] All invariants documented and enforced

### Invariants Checklist

- [ ] INV-MCP-007: Every tool call produces exactly one trace
- [ ] INV-MCP-008: Trace includes input/output/duration/success
- [ ] INV-MCP-VAL-001: Validation failures logged but don't break
- [ ] INV-MCP-VAL-002: All output schemas in contracts
- [ ] INV-MCP-RES-001: Resources are read-only
- [ ] INV-MCP-RES-002: URI patterns follow RFC 3986
- [ ] INV-MCP-RES-003: Content returned as JSON text

---

## 8. File Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `contracts/src/mcp/v1/trace/tool-trace.ts` | Tool trace event schema |
| `contracts/src/mcp/v1/resources/schema.ts` | Resource schemas |
| `contracts/src/mcp/v1/prompts/schema.ts` | Prompt schemas |
| `mcp-server/src/trace-wrapper.ts` | Trace wrapper utility |
| `mcp-server/src/validation.ts` | Validation utility |
| `mcp-server/src/resources/index.ts` | Resource registry |
| `mcp-server/src/resources/workflows.ts` | Workflow resources |
| `mcp-server/src/resources/agents.ts` | Agent resources |
| `mcp-server/src/resources/policies.ts` | Policy resources |
| `mcp-server/src/resources/sessions.ts` | Session resources |
| `mcp-server/src/prompts/index.ts` | Prompt registry |
| `mcp-server/src/prompts/code-review.ts` | Code review prompt |
| `mcp-server/src/prompts/refactor-plan.ts` | Refactor plan prompt |
| `mcp-server/src/prompts/debug-assist.ts` | Debug assist prompt |

### Files to Modify

| File | Changes |
|------|---------|
| `contracts/src/mcp/v1/index.ts` | Export new schemas |
| `mcp-server/src/server.ts` | Add resource/prompt handlers |
| `mcp-server/src/index.ts` | Export new modules |
| `tests/application/mcp-server.test.ts` | Add comprehensive tests |
