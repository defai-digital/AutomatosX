# MCP Contract

## Purpose

The MCP (Model Context Protocol) domain defines the interface for tools exposed via the MCP server. It standardizes tool definitions, error codes, and rate limiting for reliable AI tool usage.

## Key Concepts

- **McpTool**: Tool definition with input/output schemas
- **ToolResult**: Standardized result format (success or error)
- **ErrorCode**: Standardized error codes for consistent handling
- **RateLimit**: Per-tool rate limiting configuration

## Schemas

| Schema | Purpose |
|--------|---------|
| `McpToolSchema` | Tool definition with schemas |
| `ToolResultSchema` | Execution result (success/error) |
| `ToolErrorSchema` | Error with code and details |
| `RateLimitConfigSchema` | Rate limiting configuration |

## Standard Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Input validation failed |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Unexpected server error |
| `TIMEOUT` | Operation timed out |

## Usage Example

```typescript
import {
  McpToolSchema,
  createSuccessResult,
  createErrorResult,
  StandardErrorCodes,
  type McpTool,
  type ToolResult,
} from '@defai.digital/contracts/mcp/v1';

// Define a tool
const myTool: McpTool = McpToolSchema.parse({
  name: 'my_tool',
  description: 'Does something useful',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  },
});

// Return success
const success: ToolResult = createSuccessResult({ output: 'done' });

// Return error
const error: ToolResult = createErrorResult(
  StandardErrorCodes.INVALID_INPUT,
  'Input must not be empty'
);
```

## Related Domains

- `agent`: Tools used by agents
- `workflow`: Tools used in workflow steps
- `guard`: guard_check and guard_apply tools
- `trace`: trace_list and trace_get tools

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-MCP-001: Schema conformance for inputs/outputs
- INV-MCP-003: Standardized error codes
- INV-MCP-006: Rate limits enforced per tool
- INV-MCP-007: RATE_LIMITED errors include retryAfter
