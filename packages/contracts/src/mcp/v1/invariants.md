# MCP Tool Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for MCP tools. All tool implementations MUST satisfy these invariants.

## Invariants

### INV-MCP-001: Schema Conformance

**Statement:** Tool inputs and outputs MUST strictly conform to their declared schemas.

**Rationale:** Schema conformance enables reliable tool composition and prevents runtime errors from propagating through workflows.

**Enforcement:**
- Input validation MUST occur before tool execution
- Output validation MUST occur after tool execution
- Validation failures MUST return INVALID_INPUT or INVALID_OUTPUT errors

### INV-MCP-002: No Undeclared Side Effects

**Statement:** Tools MUST NOT introduce side effects not declared in their description or metadata.

**Rationale:** Predictable behavior is essential for safe AI-driven tool usage. Hidden side effects make system behavior unpredictable.

**Enforcement:**
- Tool descriptions must document all side effects
- File system, network, and state mutations must be explicit
- Audit logging of actual operations for verification

### INV-MCP-003: Standardized Error Codes

**Statement:** All failures MUST return standardized error codes from the declared set.

**Rationale:** Consistent error handling enables reliable retry logic and error recovery across tools.

**Enforcement:**
- All errors must use codes from StandardErrorCodes or tool-specific declared codes
- Error messages must be human-readable
- Error details must provide actionable context

### INV-MCP-004: Idempotency Declaration

**Statement:** Tools MUST declare whether they are idempotent.

**Rationale:** Retry safety depends on knowing whether repeated invocations produce the same result.

**Enforcement:**
- Metadata should include `idempotent: boolean`
- Non-idempotent tools must be marked as `retryable: false` for all error codes

### INV-MCP-005: Input Isolation

**Statement:** Tools MUST NOT modify their input objects.

**Rationale:** Input mutation causes hidden coupling and makes debugging difficult.

**Enforcement:**
- Inputs should be treated as immutable
- Deep cloning if modification is needed for processing

## Testing Requirements

Each invariant must have corresponding tests:

1. `INV-MCP-001`: Test schema validation for inputs and outputs
2. `INV-MCP-002`: Test that tools only perform declared operations (Phase 2+)
3. `INV-MCP-003`: Test that all errors use standard or declared codes
4. `INV-MCP-004`: Test idempotency behavior matches declaration (Phase 2+)
5. `INV-MCP-005`: Test that inputs are not mutated (Phase 2+)

### INV-MCP-006: Rate Limiting

**Statement:** Tools MUST be subject to configurable rate limits to prevent resource exhaustion.

**Rationale:** Runaway agent loops or excessive tool calls can exhaust system resources. Rate limiting provides a safety mechanism.

**Enforcement:**
- Each tool is assigned a category (execution, mutation, read)
- Execution tools have strictest limits (30 rpm, burst 5)
- Mutation tools have moderate limits (100 rpm, burst 20)
- Read tools have highest limits (200 rpm, burst 50)
- Exceeded limits return RATE_LIMITED error with retryAfter
- Limits are configurable via config_set

### INV-MCP-007: Rate Limit Transparency

**Statement:** Rate limit status MUST be transparent to callers.

**Rationale:** Callers need to know when they are being rate limited and how long to wait.

**Enforcement:**
- RATE_LIMITED errors include retryAfter in seconds
- Response headers or error details include remaining quota
- Limits are discoverable via configuration

## Testing Requirements

Each invariant must have corresponding tests:

1. `INV-MCP-001`: Test schema validation for inputs and outputs
2. `INV-MCP-002`: Test that tools only perform declared operations (Phase 2+)
3. `INV-MCP-003`: Test that all errors use standard or declared codes
4. `INV-MCP-004`: Test idempotency behavior matches declaration (Phase 2+)
5. `INV-MCP-005`: Test that inputs are not mutated (Phase 2+)
6. `INV-MCP-006`: Test rate limits are enforced per tool category
7. `INV-MCP-007`: Test RATE_LIMITED errors include retryAfter

## Version History

- V1 (2024-12-14): Initial contract definition
- V1.1 (2024-12-17): Added rate limiting invariants (INV-MCP-006, INV-MCP-007)
