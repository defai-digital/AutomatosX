# Golden Trace Specifications

**Sprint 2 Day 13 Deliverable**
**Purpose**: Canonical v1 transcripts for v2 replay testing with deterministic validation
**Owner**: Quality Squad (S1, S2)

---

## Overview

Golden traces are canonical test cases derived from AutomatosX v1 that ensure v2 maintains behavioral parity. Each trace captures a complete interaction including inputs, provider responses, tool calls, and final outputs.

**Total Traces**: 100 planned (10 P0, 40 P1, 50 P2)
**Day 13 Target**: 10 P0 traces specified

---

## Trace Structure

Each golden trace consists of:

```json
{
  "id": "unique-trace-id",
  "name": "descriptive-name",
  "priority": "P0|P1|P2",
  "category": "cli|agent|provider|memory",
  "description": "What this trace validates",
  "deterministicSeed": 12345,
  "input": {
    "command": "ax run backend \"task description\"",
    "args": {},
    "environment": {}
  },
  "expectedBehavior": {
    "agentSelected": "backend",
    "providerCalls": [],
    "toolCalls": [],
    "memoryQueries": [],
    "output": {}
  },
  "assertions": [],
  "fixtures": []
}
```

---

## P0 Golden Traces (Day 13)

### Trace 001: Simple Agent Execution

**ID**: `GLD-001`
**Name**: `simple-backend-task`
**Priority**: P0
**Category**: agent

**Description**: Basic agent execution with single-step task

**Input**:
```json
{
  "command": "ax run backend \"List all API endpoints\"",
  "args": {
    "agent": "backend",
    "task": "List all API endpoints",
    "streaming": false,
    "provider": "claude"
  },
  "deterministicSeed": 10001
}
```

**Expected Behavior**:
```json
{
  "agentSelected": "backend",
  "providerCalls": [
    {
      "provider": "claude",
      "model": "claude-sonnet-4-5",
      "prompt": "You are Bob, a backend development specialist...",
      "maxTokens": 4096
    }
  ],
  "toolCalls": [
    { "tool": "file_search", "pattern": "**/*.{ts,js}" },
    { "tool": "grep", "pattern": "app\\.(get|post|put|delete)" }
  ],
  "output": {
    "success": true,
    "endpoints": [
      "GET /api/users",
      "POST /api/users",
      "GET /api/agents"
    ]
  }
}
```

**Assertions**:
- Agent "backend" is selected
- Exactly 1 provider call made
- Tool calls include file_search and grep
- Output contains at least 1 API endpoint
- Exit code is 0

---

### Trace 002: Memory Search Query

**ID**: `GLD-002`
**Name**: `memory-search-authentication`
**Priority**: P0
**Category**: memory

**Description**: FTS5 full-text search for past conversations

**Input**:
```json
{
  "command": "ax memory search \"authentication implementation\"",
  "args": {
    "query": "authentication implementation",
    "limit": 10,
    "offset": 0
  },
  "deterministicSeed": 10002
}
```

**Expected Behavior**:
```json
{
  "dbQuery": "SELECT * FROM memories WHERE memories MATCH 'authentication implementation' LIMIT 10 OFFSET 0",
  "resultCount": 3,
  "results": [
    {
      "id": "mem-001",
      "agent": "backend",
      "content": "Implemented JWT authentication...",
      "relevance": 0.95
    }
  ]
}
```

**Assertions**:
- FTS5 query executed successfully
- Results ranked by relevance (BM25)
- At least 1 result returned
- Results contain "authentication" keyword

---

### Trace 003: Agent List with Filtering

**ID**: `GLD-003`
**Name**: `list-agents-development-category`
**Priority**: P0
**Category**: cli

**Description**: List agents filtered by category

**Input**:
```json
{
  "command": "ax list agents --category development",
  "args": {
    "category": "development",
    "format": "table"
  },
  "deterministicSeed": 10003
}
```

**Expected Behavior**:
```json
{
  "catalogLoaded": true,
  "totalAgents": 20,
  "filteredAgents": 8,
  "agents": [
    { "name": "backend", "category": "development", "enabled": true },
    { "name": "frontend", "category": "development", "enabled": true },
    { "name": "fullstack", "category": "development", "enabled": true }
  ]
}
```

**Assertions**:
- All returned agents have category "development"
- Table format displayed
- At least 3 agents returned

---

### Trace 004: System Status Health Check

**ID**: `GLD-004`
**Name**: `status-all-healthy`
**Priority**: P0
**Category**: cli

**Description**: System status when all components healthy

**Input**:
```json
{
  "command": "ax status",
  "args": {
    "checkMemory": true,
    "checkProviders": true,
    "checkAgents": true
  },
  "deterministicSeed": 10004
}
```

**Expected Behavior**:
```json
{
  "overall": "healthy",
  "checks": {
    "memory": { "status": "healthy" },
    "providers": { "status": "healthy" },
    "agents": { "status": "healthy" }
  }
}
```

**Assertions**:
- Overall status is "healthy"
- All individual checks pass
- Exit code is 0

---

### Trace 005: Configuration Display

**ID**: `GLD-005`
**Name**: `config-show-providers`
**Priority**: P0
**Category**: cli

**Description**: Display provider configuration

**Input**:
```json
{
  "command": "ax config show providers",
  "args": {
    "key": "providers",
    "format": "json"
  },
  "deterministicSeed": 10005
}
```

**Expected Behavior**:
```json
{
  "configLoaded": true,
  "key": "providers",
  "value": {
    "claude": { "enabled": true, "priority": 1 },
    "gemini": { "enabled": true, "priority": 2 }
  }
}
```

**Assertions**:
- Config loaded successfully
- Providers object returned
- At least 2 providers configured

---

### Trace 006: Multi-Agent Delegation

**ID**: `GLD-006`
**Name**: `product-to-backend-delegation`
**Priority**: P0
**Category**: agent

**Description**: Product agent delegates to backend agent

**Input**:
```json
{
  "command": "ax run product \"Design and implement user authentication API\"",
  "args": {
    "agent": "product",
    "task": "Design and implement user authentication API",
    "parallel": false
  },
  "deterministicSeed": 10006
}
```

**Expected Behavior**:
```json
{
  "agentChain": ["product", "backend"],
  "delegations": [
    {
      "from": "product",
      "to": "backend",
      "task": "Implement authentication API endpoints",
      "reason": "Implementation expertise required"
    }
  ],
  "providerCalls": 2,
  "success": true
}
```

**Assertions**:
- Product agent selected initially
- Delegation to backend agent occurs
- Both agents make provider calls
- Final output includes implementation

---

### Trace 007: Provider Fallback

**ID**: `GLD-007`
**Name**: `claude-failure-gemini-fallback`
**Priority**: P0
**Category**: provider

**Description**: Primary provider fails, fallback to secondary

**Input**:
```json
{
  "command": "ax run backend \"Simple task\"",
  "args": {
    "agent": "backend",
    "task": "Simple task"
  },
  "environment": {
    "FORCE_PROVIDER_FAILURE": "claude"
  },
  "deterministicSeed": 10007
}
```

**Expected Behavior**:
```json
{
  "providerAttempts": [
    { "provider": "claude", "status": "failed", "error": "PROVIDER_TIMEOUT" },
    { "provider": "gemini", "status": "success" }
  ],
  "finalProvider": "gemini",
  "success": true
}
```

**Assertions**:
- Claude provider attempted first
- Fallback to Gemini occurs
- Task completes successfully with Gemini
- No user-visible error

---

### Trace 008: Validation Error Handling

**ID**: `GLD-008`
**Name**: `invalid-agent-name-error`
**Priority**: P0
**Category**: cli

**Description**: Proper error message for invalid agent name

**Input**:
```json
{
  "command": "ax run InvalidAgent \"task\"",
  "args": {
    "agent": "InvalidAgent",
    "task": "task"
  },
  "deterministicSeed": 10008
}
```

**Expected Behavior**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Agent name must be lowercase alphanumeric with hyphens",
    "suggestions": [
      "Use lowercase letters only",
      "Run `ax list agents` to see valid agent names"
    ]
  }
}
```

**Assertions**:
- Validation error thrown
- Error code is VALIDATION_ERROR
- Suggestions provided
- Exit code is 1

---

### Trace 009: Streaming Output

**ID**: `GLD-009`
**Name**: `streaming-agent-execution`
**Priority**: P0
**Category**: cli

**Description**: Real-time streaming output during execution

**Input**:
```json
{
  "command": "ax run backend \"Complex task\" --streaming",
  "args": {
    "agent": "backend",
    "task": "Complex task",
    "streaming": true
  },
  "deterministicSeed": 10009
}
```

**Expected Behavior**:
```json
{
  "streamingEnabled": true,
  "logEvents": [
    { "level": "info", "message": "Starting agent execution..." },
    { "level": "debug", "message": "Loading agent configuration" },
    { "level": "info", "message": "Executing task..." },
    { "level": "success", "message": "Task completed successfully!" }
  ],
  "realtime": true
}
```

**Assertions**:
- Streaming logger activated
- Multiple log events emitted
- Events include info, debug, success levels
- Final success message displayed

---

### Trace 010: Memory-Augmented Task

**ID**: `GLD-010`
**Name**: `task-with-memory-context`
**Priority**: P0
**Category**: memory

**Description**: Agent uses memory search for task context

**Input**:
```json
{
  "command": "ax run backend \"Continue the authentication work from yesterday\"",
  "args": {
    "agent": "backend",
    "task": "Continue the authentication work from yesterday",
    "useMemory": true,
    "memoryLimit": 5
  },
  "deterministicSeed": 10010
}
```

**Expected Behavior**:
```json
{
  "memorySearch": {
    "query": "authentication work",
    "results": 3,
    "relevantMemories": [
      { "id": "mem-001", "content": "Implemented JWT..." },
      { "id": "mem-002", "content": "Added password hashing..." }
    ]
  },
  "contextAugmented": true,
  "success": true
}
```

**Assertions**:
- Memory search executed before task
- At least 1 relevant memory found
- Memory context included in provider prompt
- Task references previous work

---

## Trace Fixture Storage

**Location**: `automatosx/tmp/sprint2/golden-traces/fixtures/`

Each trace has corresponding fixture files:
- `GLD-001.input.json` - Input parameters
- `GLD-001.expected.json` - Expected outputs
- `GLD-001.provider-responses.json` - Mocked provider responses
- `GLD-001.assertions.js` - Custom assertion logic

---

## Deterministic Replay Requirements

### Seeding Strategy

1. **Random Number Generator**: Seed with `deterministicSeed`
2. **Timestamps**: Use fixed timestamp from trace
3. **UUIDs**: Generate from seeded random
4. **Provider Responses**: Mock with fixtures
5. **File System**: Mock with in-memory FS

### Diff Tooling

**Allowed Differences**:
- Timestamp variations (if not seeded)
- UUID values (if not deterministically generated)
- Provider response variations (within semantic equivalence)

**Critical Differences** (fail the test):
- Different agent selection
- Different tool calls
- Missing or extra delegations
- Error vs success outcomes
- Different exit codes

---

## Implementation Plan

### Day 13 (Today)
- [x] Document 10 P0 trace specifications
- [ ] Create fixture files for traces 001-010
- [ ] Implement GoldenTraceRunner
- [ ] Test traces 001-005

### Day 16
- [ ] Add 20 P1 traces (provider routing, edge cases)
- [ ] Expand fixture library
- [ ] Implement diff reporting

### Day 19
- [ ] Add 70 P2 traces (platform-specific, performance)
- [ ] Complete 100-trace suite
- [ ] Nightly CI integration

---

## Success Criteria

**Trace Validity**:
- All P0 traces (10) passing by Day 13 EOD
- <5% false positive rate (flaky failures)
- Deterministic replay 100% reproducible
- Diffs categorized correctly (allowed vs critical)

**Coverage**:
- CLI commands: 5 traces minimum
- Agent orchestration: 3 traces minimum
- Provider routing: 2 traces minimum
- Memory integration: 2 traces minimum

---

**Document Control**
- **Created**: 2025-11-08 (Sprint 2 Day 13)
- **Owner**: Quality Squad (S1, S2)
- **Next Update**: Day 16 (add P1 traces)
