# Provider Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for LLM provider integration. Providers MUST satisfy all invariants.

## Provider Port Invariants

### INV-PROV-PORT-001: Request Validation

**Statement:** Provider implementations MUST validate requests before execution.

**Rationale:** Invalid requests cause unpredictable provider behavior.

**Enforcement:**
- `ProviderRequestSchema.parse()` before execution
- Invalid requests return error response
- No provider API called with invalid request

### INV-PROV-PORT-002: Response Schema Compliance

**Statement:** Provider responses MUST match `ProviderResponseSchema`.

**Rationale:** Consistent response format enables reliable error handling.

**Enforcement:**
- All responses pass schema validation
- Missing fields have defaults
- Unknown fields stripped

### INV-PROV-PORT-003: No Exception Throwing

**Statement:** Provider errors MUST return error response, NOT throw exceptions.

**Rationale:** Exceptions break control flow. Error responses enable graceful handling.

**Enforcement:**
- All errors wrapped in `ProviderResponse` with `success: false`
- Error includes code and message
- No uncaught exceptions from provider methods

## Registry Invariants

### INV-PROV-REG-001: Unknown Provider Handling

**Statement:** `getProvider()` MUST return `undefined` for unknown providers.

**Rationale:** Null/undefined is safer than throwing for missing items.

**Enforcement:**
- Unknown provider returns `undefined`
- Caller checks for existence before use
- No exception on unknown provider

### INV-PROV-REG-002: Deterministic Listing

**Statement:** `listProviders()` MUST return providers in deterministic order.

**Rationale:** Consistent ordering enables predictable behavior and testing.

**Enforcement:**
- Providers sorted by priority, then alphabetically
- Order stable across calls
- Registration order not used

## Health Invariants

### INV-PROV-HEALTH-001: Timeout Enforcement

**Statement:** Health checks MUST timeout after configured duration.

**Rationale:** Hung health checks block system startup and recovery.

**Enforcement:**
- Health check wrapped with timeout
- Timeout returns unhealthy status
- Default timeout: 5000ms

### INV-PROV-HEALTH-002: No Side Effects

**Statement:** Health checks MUST NOT have side effects.

**Rationale:** Health checks are called frequently and should be read-only.

**Enforcement:**
- Health check uses minimal API call or ping
- No data modification during health check
- No tokens consumed (or minimal)

### INV-PROV-HEALTH-003: Graceful Degradation

**Statement:** Unhealthy providers MUST be skipped, not block requests.

**Rationale:** One unhealthy provider should not affect others.

**Enforcement:**
- Routing skips unhealthy providers
- Fallback to healthy alternatives
- Clear logging of skipped providers

## Testing Requirements

1. `INV-PROV-PORT-001`: Test invalid requests return error
2. `INV-PROV-PORT-002`: Test response schema compliance
3. `INV-PROV-PORT-003`: Test no exceptions thrown
4. `INV-PROV-REG-001`: Test unknown provider returns undefined
5. `INV-PROV-REG-002`: Test listing is deterministic
6. `INV-PROV-HEALTH-001`: Test health check timeout
7. `INV-PROV-HEALTH-002`: Test health check has no side effects
8. `INV-PROV-HEALTH-003`: Test unhealthy providers skipped

## Version History

- V1 (2024-12-16): Initial contract definition
