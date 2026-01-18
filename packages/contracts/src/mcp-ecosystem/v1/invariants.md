# MCP Ecosystem Invariants

This document defines the behavioral guarantees for the MCP Ecosystem domain.
All implementations MUST enforce these invariants.

## Discovery Invariants

### INV-MCP-ECO-001: Tool Discovery is Idempotent

**Statement**: Discovering tools from the same server multiple times produces identical results.

**Rationale**: Idempotent discovery enables safe retry logic and caching.

**Enforcement**:
- Discovery returns the same tool set for unchanged server state
- forceRefresh bypasses cache but still returns consistent results
- Discovery timestamp tracks when tools were last refreshed

**Test Scenarios**:
1. Discover tools twice in succession - results match
2. forceRefresh=true returns same tools as forceRefresh=false
3. Discovery after server restart returns updated tool set

---

### INV-MCP-ECO-002: Failed Servers Don't Block Others

**Statement**: A failed server connection does not prevent discovery from other servers.

**Rationale**: Partial availability is better than complete failure.

**Enforcement**:
- Discovery runs in parallel across servers
- Each server reports status independently
- Aggregated results include successful discoveries even if some servers fail
- Per-server error reporting enables debugging

**Test Scenarios**:
1. Server A fails, Server B succeeds - B's tools are still available
2. All servers fail - empty tool set returned with error details
3. Slow server doesn't block others (timeout per-server)

---

## Namespacing Invariants

### INV-MCP-ECO-003: Tool Namespacing Prevents Collisions

**Statement**: Tools from different servers never have conflicting names.

**Rationale**: Multiple servers may provide tools with the same name.

**Enforcement**:
- fullName = serverId + '.' + toolName
- Tool lookup by fullName is unambiguous
- Lookup by toolName alone fails if ambiguous (multiple matches)
- serverId must be unique in the registry

**Test Scenarios**:
1. Two servers both provide "search" tool - no collision
2. Lookup "search" fails with AMBIGUOUS_TOOL if multiple exist
3. Lookup "server-a.search" succeeds unambiguously

---

## Connection Invariants

### INV-MCP-ECO-100: Connection Timeout Enforced

**Statement**: Server connections respect configured timeout.

**Rationale**: Prevents indefinite hangs on unresponsive servers.

**Enforcement**:
- connectionTimeoutMs applied to initial connection
- requestTimeoutMs applied to tool invocations
- Timeout errors include server ID and operation

**Test Scenarios**:
1. Slow server exceeds connectionTimeoutMs - CONNECTION_TIMEOUT error
2. Slow tool exceeds requestTimeoutMs - INVOCATION_FAILED error

---

### INV-MCP-ECO-101: Retry Logic Bounded

**Statement**: Connection retries respect maxRetries limit.

**Rationale**: Prevents infinite retry loops.

**Enforcement**:
- Connection attempts limited to maxRetries + 1
- Each retry uses exponential backoff
- Final failure reports total attempts

**Test Scenarios**:
1. Server fails 3 times with maxRetries=3 - 4 total attempts, then error
2. Server succeeds on retry 2 - no error, attempt count logged

---

## State Invariants

### INV-MCP-ECO-200: Server State Consistency

**Statement**: Server state accurately reflects actual server condition.

**Rationale**: Enables reliable health monitoring.

**Enforcement**:
- Status updated immediately on connection change
- lastError cleared on successful connection
- toolCount/resourceCount updated after discovery

**Test Scenarios**:
1. Server connects - status='connected', lastError=undefined
2. Server fails - status='error', lastError contains message
3. Discovery succeeds - toolCount updated

---

### INV-MCP-ECO-201: Disabled Servers Not Connected

**Statement**: Servers with enabled=false are never connected.

**Rationale**: Explicit control over server lifecycle.

**Enforcement**:
- Disabled servers have status='disabled'
- Discovery skips disabled servers unless includeDisabled=true
- Enabling a server allows connection

**Test Scenarios**:
1. Register disabled server - no connection attempt
2. Enable server - connection initiated
3. Discover with includeDisabled=false - disabled servers skipped

---

## Invocation Invariants

### INV-MCP-ECO-300: Tool Arguments Validated

**Statement**: Tool invocation validates arguments against input schema.

**Rationale**: Catch errors early, before sending to server.

**Enforcement**:
- Arguments validated against tool's inputSchema
- Validation errors returned before RPC call
- Extra arguments preserved (open schema)

**Test Scenarios**:
1. Missing required argument - validation error
2. Invalid argument type - validation error
3. Valid arguments - invocation proceeds

---

### INV-MCP-ECO-301: Invocation Errors Propagated

**Statement**: Tool invocation errors are captured and returned.

**Rationale**: Enables proper error handling by callers.

**Enforcement**:
- Server errors captured in response.error
- isError flag indicates error responses
- Content may still be present for partial results

**Test Scenarios**:
1. Tool returns error - isError=true, error message populated
2. Connection lost during invocation - INVOCATION_FAILED error
3. Tool timeout - INVOCATION_FAILED with timeout message
