# AutomatosX MCP Server Product Requirements Document (PRD)

**Version**: 3.0.0
**Last Updated**: 2025-12-14
**Status**: Living Document
**MCP Specification**: 2025-06-18

---

## Executive Summary

The AutomatosX MCP (Model Context Protocol) Server provides a standardized interface for AI assistants to interact with AutomatosX functionality. MCP is an **industry-wide open standard** (adopted by Anthropic, OpenAI, Google, Microsoft) that enables secure, two-way connections between AI systems and data sources through three core primitives: **Tools**, **Resources**, and **Prompts**.

### Design Principles

1. **Protocol Compliance**: Strict adherence to MCP specification (2025-06-18)
2. **Contract-Driven**: All tool inputs/outputs defined in `@automatosx/contracts` package with Zod schemas
3. **Domain-Driven**: Each tool category maps to a specific domain package (workflow → workflow-engine, memory → memory-domain, etc.)
4. **Behavior-Driven**: Explicit invariants (INV-MCP-*) with testable guarantees
5. **Governance-Driven**: Integration with Guard domain for policy enforcement
6. **Event-Sourced**: All tool calls emit traceable events per trace-domain
7. **Provider Agnostic**: Works with Claude Code, Gemini CLI, Codex CLI, and other MCP clients

### MCP Adoption

MCP has been adopted by major AI providers:
- **Claude Code** (Anthropic) - Native MCP support via `claude mcp` commands
- **Gemini CLI** (Google) - MCP support via `gemini mcp` commands
- **Codex CLI** (OpenAI) - MCP support via `codex mcp` commands

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Protocol Specification](#2-protocol-specification)
3. [MCP Primitives Overview](#3-mcp-primitives-overview)
4. [Tool Categories](#4-tool-categories)
5. [Workflow Tools](#5-workflow-tools)
6. [Trace Tools](#6-trace-tools)
7. [Memory Tools](#7-memory-tools)
8. [Agent Tools](#8-agent-tools)
9. [Session Tools](#9-session-tools)
10. [Guard Tools](#10-guard-tools)
11. [MCP Resources](#11-mcp-resources)
12. [MCP Prompts](#12-mcp-prompts)
13. [Content Types](#13-content-types)
14. [Error Handling](#14-error-handling)
15. [Behavioral Invariants](#15-behavioral-invariants)
16. [Security Considerations](#16-security-considerations)
17. [Provider-Specific Notes](#17-provider-specific-notes)
18. [Implementation Roadmap](#18-implementation-roadmap)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Client                                │
│                   (Claude, ChatGPT, etc.)                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ JSON-RPC 2.0 over stdio
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Workflow   │  │    Trace     │  │   Memory     │           │
│  │    Tools     │  │    Tools     │  │    Tools     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Agent     │  │   Session    │  │   Resources  │           │
│  │    Tools     │  │    Tools     │  │   (read-only)│           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    Tool Handler Registry                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Packages                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ workflow   │ │  trace     │ │  memory    │ │   agent    │   │
│  │  engine    │ │  domain    │ │  domain    │ │   domain   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│  ┌────────────┐                                                 │
│  │  session   │                                                 │
│  │  domain    │                                                 │
│  └────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Package Dependencies

```typescript
// @automatosx/mcp-server dependencies
{
  "@automatosx/contracts": "workspace:*",      // Zod schemas (source of truth)
  "@automatosx/workflow-engine": "workspace:*", // Workflow execution
  "@automatosx/trace-domain": "workspace:*",    // Event tracing
  "@automatosx/memory-domain": "workspace:*",   // Memory management
  "@automatosx/agent-domain": "workspace:*",    // Agent orchestration
  "@automatosx/session-domain": "workspace:*",  // Session lifecycle
  "@automatosx/guard": "workspace:*"            // Governance gates
}
```

### 1.3 Domain-Tool Mapping

Each tool category is owned by a specific domain:

| Tool Prefix | Domain Package | Aggregate Root |
|-------------|----------------|----------------|
| `workflow_*` | workflow-engine | Workflow |
| `trace_*` | trace-domain | Trace |
| `memory_*` | memory-domain | MemoryEntry |
| `agent_*` | agent-domain | AgentProfile |
| `session_*` | session-domain | Session |
| `guard_*` | guard | Policy |

### 1.4 Contract Location

All MCP schemas MUST be defined in the contracts package:

```
packages/contracts/src/mcp/v1/
├── schema.ts           # Base MCP types
├── invariants.md       # Behavioral invariants
├── tools/
│   ├── workflow.ts     # Workflow tool schemas
│   ├── trace.ts        # Trace tool schemas
│   ├── memory.ts       # Memory tool schemas
│   ├── agent.ts        # Agent tool schemas
│   ├── session.ts      # Session tool schemas
│   └── guard.ts        # Guard tool schemas
├── resources/
│   └── schema.ts       # Resource schemas
└── prompts/
    └── schema.ts       # Prompt schemas
```

### 1.5 Server Configuration

```typescript
interface MCPServerConfig {
  name: string;              // Server name (default: "automatosx-mcp")
  version: string;           // Server version (default: "1.0.0")
  description?: string;      // Human-readable description
}
```

---

## 2. Protocol Specification

### 2.1 Transport

- **Protocol**: JSON-RPC 2.0
- **Transport**: Standard input/output (stdio) or HTTP with SSE
- **Format**: Line-delimited JSON (one message per line)
- **Encoding**: UTF-8
- **Spec Version**: 2025-06-18

### 2.2 Supported Methods

| Category | Method | Description | Requires Init |
|----------|--------|-------------|---------------|
| Lifecycle | `initialize` | Initialize server and negotiate capabilities | No |
| Lifecycle | `shutdown` | Gracefully shutdown server | Yes |
| Tools | `tools/list` | List available tools (supports pagination) | Yes |
| Tools | `tools/call` | Execute a tool by name | Yes |
| Resources | `resources/list` | List available resources (supports pagination) | Yes |
| Resources | `resources/read` | Read a resource by URI | Yes |
| Resources | `resources/templates/list` | List parameterized resource templates | Yes |
| Resources | `resources/subscribe` | Subscribe to resource changes | Yes |
| Prompts | `prompts/list` | List available prompts (supports pagination) | Yes |
| Prompts | `prompts/get` | Get a prompt with arguments | Yes |

### 2.3 Notifications (Server → Client)

| Notification | Description |
|--------------|-------------|
| `notifications/tools/list_changed` | Tool list has changed |
| `notifications/resources/list_changed` | Resource list has changed |
| `notifications/resources/updated` | Specific resource has been updated |
| `notifications/prompts/list_changed` | Prompt list has changed |

### 2.4 Initialize Request

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-code",
      "version": "1.0.0"
    }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": {
        "listChanged": true
      },
      "resources": {
        "subscribe": true,
        "listChanged": true
      },
      "prompts": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "automatosx-mcp",
      "version": "1.0.0"
    }
  }
}
```

### 2.5 Tools List Request (with Pagination)

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {
    "cursor": "optional-cursor-value"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "workflow_run",
        "title": "Execute Workflow",
        "description": "Execute a workflow by ID",
        "inputSchema": {
          "type": "object",
          "properties": {
            "workflowId": { "type": "string" }
          },
          "required": ["workflowId"]
        },
        "outputSchema": {
          "type": "object",
          "properties": {
            "success": { "type": "boolean" }
          }
        }
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

### 2.6 Tools Call Request

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "workflow_run",
    "arguments": {
      "workflowId": "data-pipeline"
    }
  }
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\": true, ...}"
      }
    ],
    "structuredContent": {
      "success": true,
      "workflowId": "data-pipeline"
    }
  }
}
```

**Response (Error)**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Error: Workflow not found"
      }
    ],
    "isError": true
  }
}
```

---

## 3. MCP Primitives Overview

MCP defines three core primitives with different control models:

| Primitive | Control Model | Description | Use Case |
|-----------|---------------|-------------|----------|
| **Tools** | Model-controlled | Functions the LLM can call to perform actions | Executing workflows, storing data, running agents |
| **Resources** | Application-controlled | Read-only data sources (like REST GET endpoints) | Listing memory entries, viewing active sessions |
| **Prompts** | User-controlled | Pre-defined templates for optimal tool/resource usage | Slash commands for common operations |

### 3.1 Tools (Model-Controlled)

Tools are executable functions that LLMs can invoke. The model decides when and how to use tools based on the conversation context.

**Characteristics**:
- Can have side effects (write data, execute actions)
- Inputs validated against JSON Schema
- Results returned as content arrays (text, image, audio, resource)
- Support structured output via `outputSchema`

### 3.2 Resources (Application-Controlled)

Resources provide read-only access to data. The application/client decides which resources to expose to the model.

**Characteristics**:
- No side effects (read-only operations)
- Identified by URI (e.g., `memory://entries`, `file:///path`)
- Support subscriptions for change notifications
- Can be parameterized via templates (RFC 6570)

### 3.3 Prompts (User-Controlled)

Prompts are pre-defined templates exposed as slash commands. Users explicitly invoke prompts through the UI.

**Characteristics**:
- Triggered via slash commands (e.g., `/mcp__automatosx__run-workflow`)
- Support arguments for customization
- Return structured messages for the conversation

---

## 4. Tool Categories

### 4.1 Tool Naming Convention

All tool names use `snake_case` with category prefix:
- `workflow_*` - Workflow execution tools
- `trace_*` - Trace analysis tools
- `memory_*` - Memory management tools
- `agent_*` - Agent orchestration tools
- `session_*` - Session management tools

### 4.2 Tool Summary

| Category | Tool Name | Status | Description |
|----------|-----------|--------|-------------|
| Workflow | `workflow_run` | Implemented | Execute a workflow |
| Workflow | `workflow_list` | Implemented | List workflows |
| Workflow | `workflow_describe` | Implemented | Describe workflow |
| Trace | `trace_list` | Implemented | List traces |
| Trace | `trace_get` | Implemented | Get trace details |
| Trace | `trace_analyze` | Implemented | Analyze trace |
| Memory | `memory_store` | Implemented | Store value |
| Memory | `memory_retrieve` | Implemented | Retrieve value |
| Memory | `memory_search` | Implemented | Search memory |
| Memory | `memory_list` | **Planned** | List entries |
| Memory | `memory_delete` | **Planned** | Delete entry |
| Agent | `agent_list` | **Planned** | List agents |
| Agent | `agent_run` | **Planned** | Run agent |
| Agent | `agent_get` | **Planned** | Get agent details |
| Session | `session_create` | **Planned** | Create session |
| Session | `session_status` | **Planned** | Get session status |
| Session | `session_complete` | **Planned** | Complete session |
| Session | `session_list` | **Planned** | List sessions |
| Guard | `guard_check` | **Planned** | Run governance gates |
| Guard | `guard_list` | **Planned** | List policies |
| Guard | `guard_apply` | **Planned** | Apply policy to session |

---

## 5. Workflow Tools

### 5.1 workflow_run

Execute a workflow by ID with optional input parameters.

**Input Schema**:
```typescript
interface WorkflowRunInput {
  workflowId: string;        // Required: Workflow identifier
  input?: object;            // Optional: Input parameters
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "workflowId": {
      "type": "string",
      "description": "The ID of the workflow to execute"
    },
    "input": {
      "type": "object",
      "description": "Optional input parameters for the workflow"
    }
  },
  "required": ["workflowId"]
}
```

**Output**:
```typescript
interface WorkflowRunOutput {
  success: boolean;
  workflowId: string;
  stepsCompleted: string[];
  output?: object;
  error?: {
    code: string;
    message: string;
  };
}
```

**Example**:
```json
// Input
{ "workflowId": "data-pipeline", "input": { "source": "api" } }

// Output
{
  "success": true,
  "workflowId": "data-pipeline",
  "stepsCompleted": ["step-1", "step-2", "step-3"],
  "output": { "processed": 100 }
}
```

**Error Codes**:
- `WORKFLOW_NOT_FOUND` - Workflow does not exist
- `WORKFLOW_VALIDATION_ERROR` - Input validation failed
- `WORKFLOW_STEP_FAILED` - Step execution failed
- `WORKFLOW_TIMEOUT` - Workflow timed out

---

### 5.2 workflow_list

List all available workflows with optional filtering.

**Input Schema**:
```typescript
interface WorkflowListInput {
  status?: 'active' | 'inactive' | 'draft';  // Optional filter
  limit?: number;                             // Default: 10
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "description": "Filter by status",
      "enum": ["active", "inactive", "draft"]
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of workflows to return",
      "default": 10
    }
  }
}
```

**Output**:
```typescript
interface WorkflowListOutput {
  workflows: {
    id: string;
    name: string;
    version: string;
    status: string;
    stepCount: number;
  }[];
}
```

---

### 5.3 workflow_describe

Get detailed information about a specific workflow.

**Input Schema**:
```typescript
interface WorkflowDescribeInput {
  workflowId: string;        // Required
}
```

**Output**:
```typescript
interface WorkflowDescribeOutput {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: string;
  steps: {
    stepId: string;
    name: string;
    type: string;
    description?: string;
  }[];
  inputSchema?: object;
}
```

---

## 6. Trace Tools

### 6.1 trace_list

List recent execution traces with optional filtering.

**Input Schema**:
```typescript
interface TraceListInput {
  limit?: number;                              // Default: 10
  status?: 'success' | 'failure' | 'running';  // Optional filter
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "limit": {
      "type": "number",
      "description": "Maximum number of traces to return",
      "default": 10
    },
    "status": {
      "type": "string",
      "description": "Filter by status",
      "enum": ["success", "failure", "running"]
    }
  }
}
```

**Output**:
```typescript
interface TraceListOutput {
  traces: {
    traceId: string;
    workflowId: string;
    startTime: string;       // ISO8601
    endTime?: string;        // ISO8601
    status: string;
    eventCount: number;
    durationMs: number;
  }[];
}
```

---

### 6.2 trace_get

Get detailed information about a specific trace.

**Input Schema**:
```typescript
interface TraceGetInput {
  traceId: string;           // Required
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "traceId": {
      "type": "string",
      "description": "The ID of the trace to retrieve"
    }
  },
  "required": ["traceId"]
}
```

**Output**:
```typescript
interface TraceGetOutput {
  traceId: string;
  workflowId: string;
  startTime: string;
  endTime?: string;
  status: string;
  durationMs: number;
  events: {
    eventId: string;
    type: string;            // 'run.start' | 'step.execute' | 'run.end' | etc.
    sequence: number;
    timestamp: string;
    payload?: object;
    status?: string;
    durationMs?: number;
  }[];
}
```

**Event Types**:
- `run.start` - Workflow execution started
- `run.end` - Workflow execution ended
- `decision.routing` - Model routing decision made
- `step.execute` - Step executed
- `tool.invoke` - Tool invoked
- `error` - Error occurred

---

### 6.3 trace_analyze

Analyze a trace for performance issues or errors.

**Input Schema**:
```typescript
interface TraceAnalyzeInput {
  traceId: string;           // Required
}
```

**Output**:
```typescript
interface TraceAnalyzeOutput {
  traceId: string;
  summary: string;
  performance: {
    totalDuration: number;
    averageStepDuration: number;
    slowestStep: {
      stepId: string;
      stepName: string;
      durationMs: number;
    };
  };
  issues: {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    stepId?: string;
  }[];
  recommendations: {
    type: string;
    message: string;
    severity: string;
  }[];
  metrics: {
    stepCount: number;
    successRate: number;
    errorCount: number;
  };
}
```

---

## 7. Memory Tools

### 7.1 memory_store

Store a value in memory with a key.

**Input Schema**:
```typescript
interface MemoryStoreInput {
  key: string;               // Required
  value: object;             // Required
  namespace?: string;        // Default: "default"
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "key": {
      "type": "string",
      "description": "The key to store the value under"
    },
    "value": {
      "type": "object",
      "description": "The value to store"
    },
    "namespace": {
      "type": "string",
      "description": "Optional namespace for the key"
    }
  },
  "required": ["key", "value"]
}
```

**Output**:
```typescript
interface MemoryStoreOutput {
  success: boolean;
  key: string;
  namespace: string;
  message: string;
}
```

**Storage Behavior**:
- Values are stored with timestamp metadata
- Keys are namespaced: `{namespace}:{key}`
- Duplicate keys overwrite existing values
- Maximum value size: 100KB

---

### 7.2 memory_retrieve

Retrieve a value from memory by key.

**Input Schema**:
```typescript
interface MemoryRetrieveInput {
  key: string;               // Required
  namespace?: string;        // Default: "default"
}
```

**Output**:
```typescript
interface MemoryRetrieveOutput {
  found: boolean;
  key: string;
  namespace: string;
  value?: object;            // Only if found
  storedAt?: string;         // ISO8601, only if found
  message?: string;          // Only if not found
}
```

---

### 7.3 memory_search

Search memory for values matching a query.

**Input Schema**:
```typescript
interface MemorySearchInput {
  query: string;             // Required: Search query
  namespace?: string;        // Optional: Filter by namespace
  limit?: number;            // Default: 10
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query"
    },
    "namespace": {
      "type": "string",
      "description": "Optional namespace to search in"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results",
      "default": 10
    }
  },
  "required": ["query"]
}
```

**Output**:
```typescript
interface MemorySearchOutput {
  query: string;
  namespace: string;         // "all" if not specified
  count: number;
  results: {
    key: string;
    namespace: string;
    value: object;
    storedAt: string;
  }[];
}
```

**Search Behavior**:
- Substring match on keys
- Case-sensitive matching
- Results sorted by recency

---

### 7.4 memory_list (Planned)

List all memory entries with optional filtering.

**Input Schema**:
```typescript
interface MemoryListInput {
  namespace?: string;        // Optional: Filter by namespace
  limit?: number;            // Default: 100
  offset?: number;           // Default: 0
}
```

**Output**:
```typescript
interface MemoryListOutput {
  entries: {
    key: string;
    namespace: string;
    storedAt: string;
    size: number;            // Value size in bytes
  }[];
  total: number;
  hasMore: boolean;
}
```

---

### 7.5 memory_delete (Planned)

Delete a memory entry by key.

**Input Schema**:
```typescript
interface MemoryDeleteInput {
  key: string;               // Required
  namespace?: string;        // Default: "default"
}
```

**Output**:
```typescript
interface MemoryDeleteOutput {
  deleted: boolean;
  key: string;
  namespace: string;
  message: string;
}
```

---

## 8. Agent Tools

### 8.1 agent_list (Planned)

List all registered agents.

**Input Schema**:
```typescript
interface AgentListInput {
  team?: string;             // Optional: Filter by team
  enabled?: boolean;         // Optional: Filter by enabled status
  limit?: number;            // Default: 50
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "team": {
      "type": "string",
      "description": "Filter by team name"
    },
    "enabled": {
      "type": "boolean",
      "description": "Filter by enabled status"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of agents to return",
      "default": 50
    }
  }
}
```

**Output**:
```typescript
interface AgentListOutput {
  agents: {
    agentId: string;
    displayName?: string;
    description: string;
    team?: string;
    enabled: boolean;
    capabilities?: string[];
  }[];
  total: number;
}
```

---

### 8.2 agent_run (Planned)

Execute an agent with input.

**Input Schema**:
```typescript
interface AgentRunInput {
  agentId: string;           // Required
  input?: object;            // Optional: Input data
  sessionId?: string;        // Optional: Session to associate
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "agentId": {
      "type": "string",
      "description": "The ID of the agent to run"
    },
    "input": {
      "type": "object",
      "description": "Input data for the agent"
    },
    "sessionId": {
      "type": "string",
      "description": "Optional session ID to associate with execution"
    }
  },
  "required": ["agentId"]
}
```

**Output**:
```typescript
interface AgentRunOutput {
  success: boolean;
  agentId: string;
  sessionId?: string;
  output?: object;
  stepResults?: {
    stepId: string;
    success: boolean;
    durationMs: number;
  }[];
  totalDurationMs: number;
  error?: {
    code: string;
    message: string;
  };
}
```

**Error Codes**:
- `AGENT_NOT_FOUND` - Agent does not exist
- `AGENT_PERMISSION_DENIED` - Agent is disabled
- `AGENT_STAGE_FAILED` - Stage execution failed
- `AGENT_DELEGATION_DEPTH_EXCEEDED` - Max delegation depth reached

---

### 8.3 agent_get (Planned)

Get detailed information about a specific agent.

**Input Schema**:
```typescript
interface AgentGetInput {
  agentId: string;           // Required
}
```

**Output**:
```typescript
interface AgentGetOutput {
  agentId: string;
  displayName?: string;
  version?: string;
  description: string;
  role?: string;
  expertise?: string[];
  capabilities?: string[];
  team?: string;
  tags?: string[];
  enabled: boolean;
  workflow?: {
    stepId: string;
    name: string;
    type: string;
  }[];
  orchestration?: {
    maxDelegationDepth?: number;
    canReadWorkspaces?: string[];
    canWriteToShared?: boolean;
  };
}
```

---

## 9. Session Tools

### 9.1 session_create (Planned)

Create a new collaboration session.

**Input Schema**:
```typescript
interface SessionCreateInput {
  initiator: string;         // Required: Agent ID
  task: string;              // Required: Task description
  workspace?: string;        // Optional: Workspace path
  metadata?: object;         // Optional: Additional metadata
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "initiator": {
      "type": "string",
      "description": "The agent ID initiating the session"
    },
    "task": {
      "type": "string",
      "description": "Description of the session task"
    },
    "workspace": {
      "type": "string",
      "description": "Optional workspace path"
    },
    "metadata": {
      "type": "object",
      "description": "Optional metadata"
    }
  },
  "required": ["initiator", "task"]
}
```

**Output**:
```typescript
interface SessionCreateOutput {
  sessionId: string;
  initiator: string;
  task: string;
  status: 'active';
  createdAt: string;
  workspace?: string;
}
```

---

### 9.2 session_status (Planned)

Get current status of a session.

**Input Schema**:
```typescript
interface SessionStatusInput {
  sessionId: string;         // Required
}
```

**Output**:
```typescript
interface SessionStatusOutput {
  sessionId: string;
  status: 'active' | 'completed' | 'failed';
  initiator: string;
  task: string;
  participants: {
    agentId: string;
    role: string;
    joinedAt: string;
    taskCount: number;
  }[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

---

### 9.3 session_complete (Planned)

Complete an active session.

**Input Schema**:
```typescript
interface SessionCompleteInput {
  sessionId: string;         // Required
  summary?: string;          // Optional: Completion summary
}
```

**Output**:
```typescript
interface SessionCompleteOutput {
  sessionId: string;
  status: 'completed';
  completedAt: string;
  summary?: string;
}
```

**Error Codes**:
- `SESSION_NOT_FOUND` - Session does not exist
- `SESSION_ALREADY_COMPLETED` - Session already terminal
- `SESSION_INVALID_TRANSITION` - Invalid status transition

---

### 9.4 session_list (Planned)

List sessions with optional filtering.

**Input Schema**:
```typescript
interface SessionListInput {
  status?: 'active' | 'completed' | 'failed';
  initiator?: string;        // Filter by initiator agent
  limit?: number;            // Default: 20
}
```

**Output**:
```typescript
interface SessionListOutput {
  sessions: {
    sessionId: string;
    initiator: string;
    task: string;
    status: string;
    participantCount: number;
    createdAt: string;
  }[];
  total: number;
}
```

---

## 10. Guard Tools

Guard tools integrate with the governance domain to enforce policies on AI coding sessions.

### 10.1 guard_check (Planned)

Run governance gates on pending changes.

**Input Schema**:
```typescript
interface GuardCheckInput {
  policyId: string;             // Required: Policy to evaluate
  changedPaths: string[];       // Required: Files that changed
  sessionId?: string;           // Optional: Session context
}
```

**JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "policyId": {
      "type": "string",
      "description": "The policy ID to evaluate against"
    },
    "changedPaths": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of changed file paths"
    },
    "sessionId": {
      "type": "string",
      "description": "Optional session ID for context"
    }
  },
  "required": ["policyId", "changedPaths"]
}
```

**Output**:
```typescript
interface GuardCheckOutput {
  passed: boolean;
  policyId: string;
  gateResults: {
    gate: string;               // Gate type (path_violation, dependency, etc.)
    passed: boolean;
    violations: {
      type: string;
      path: string;
      message: string;
    }[];
  }[];
  summary: string;
}
```

**Error Codes**:
- `POLICY_NOT_FOUND` - Policy does not exist
- `GATE_EXECUTION_FAILED` - Gate execution error
- `INVALID_PATH_PATTERN` - Invalid glob pattern

---

### 10.2 guard_list (Planned)

List available governance policies.

**Input Schema**:
```typescript
interface GuardListInput {
  limit?: number;               // Default: 20
}
```

**Output**:
```typescript
interface GuardListOutput {
  policies: {
    policyId: string;
    allowedPaths: string[];
    forbiddenPaths: string[];
    gates: string[];
    changeRadiusLimit: number;
  }[];
  total: number;
}
```

---

### 10.3 guard_apply (Planned)

Apply a governance policy to an active session.

**Input Schema**:
```typescript
interface GuardApplyInput {
  sessionId: string;            // Required: Session to apply policy to
  policyId: string;             // Required: Policy to apply
}
```

**Output**:
```typescript
interface GuardApplyOutput {
  applied: boolean;
  sessionId: string;
  policyId: string;
  message: string;
}
```

**Error Codes**:
- `SESSION_NOT_FOUND` - Session does not exist
- `POLICY_NOT_FOUND` - Policy does not exist
- `POLICY_ALREADY_APPLIED` - Policy already active on session

---

## 11. MCP Resources

Resources provide read-only access to AutomatosX data with no side effects.

### 11.1 Resource URI Scheme

```
{domain}://{collection}[/{id}]

Examples:
  memory://entries
  memory://entries/user-context
  sessions://active
  traces://recent
  agents://available
```

### 11.2 Supported Resources

| URI | Description | Status |
|-----|-------------|--------|
| `memory://entries` | List all memory entries | **Planned** |
| `memory://conversations` | List conversations | **Planned** |
| `sessions://active` | List active sessions | **Planned** |
| `traces://recent` | Recent execution traces | **Planned** |
| `agents://available` | Available agents | **Planned** |

### 11.3 Resource List Request

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list"
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resources": [
      {
        "uri": "memory://entries",
        "name": "Memory Entries",
        "description": "All stored memory entries",
        "mimeType": "application/json"
      }
    ]
  }
}
```

### 11.4 Resource Read Request

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "memory://entries"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "contents": [
      {
        "uri": "memory://entries",
        "mimeType": "application/json",
        "text": "[{\"key\": \"...\", ...}]"
      }
    ]
  }
}
```

---

## 12. MCP Prompts

Prompts are user-controlled templates exposed as slash commands. Users explicitly invoke prompts through the UI.

### 12.1 Prompt Definition Schema

```typescript
interface MCPPrompt {
  name: string;                    // Unique identifier
  title?: string;                  // Human-readable display name
  description?: string;            // Description of what the prompt does
  arguments?: PromptArgument[];    // Arguments for customization
}

interface PromptArgument {
  name: string;                    // Argument name
  description?: string;            // Description
  required?: boolean;              // Whether required (default: false)
}
```

### 12.2 Prompts List Request

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/list",
  "params": {
    "cursor": "optional-cursor-value"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "prompts": [
      {
        "name": "run_workflow",
        "title": "Run Workflow",
        "description": "Execute a workflow with optional input",
        "arguments": [
          {
            "name": "workflowId",
            "description": "The ID of the workflow to execute",
            "required": true
          },
          {
            "name": "input",
            "description": "JSON input for the workflow",
            "required": false
          }
        ]
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

### 12.3 Prompts Get Request

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "prompts/get",
  "params": {
    "name": "run_workflow",
    "arguments": {
      "workflowId": "data-pipeline",
      "input": "{\"source\": \"api\"}"
    }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "description": "Execute the data-pipeline workflow",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Please execute the 'data-pipeline' workflow with input: {\"source\": \"api\"}"
        }
      }
    ]
  }
}
```

### 12.4 Planned AutomatosX Prompts

| Prompt Name | Description | Arguments | Status |
|-------------|-------------|-----------|--------|
| `run_workflow` | Execute a workflow | workflowId*, input | **Planned** |
| `analyze_trace` | Analyze a trace | traceId* | **Planned** |
| `search_memory` | Search memory | query*, namespace | **Planned** |
| `list_agents` | List available agents | team, enabled | **Planned** |
| `run_agent` | Execute an agent | agentId*, input | **Planned** |

---

## 13. Content Types

MCP supports multiple content types in tool results and prompt messages.

### 13.1 Text Content

The most common content type for natural language and structured data.

```json
{
  "type": "text",
  "text": "Tool result text or JSON"
}
```

### 13.2 Image Content

For returning visual content (e.g., charts, diagrams).

```json
{
  "type": "image",
  "data": "base64-encoded-image-data",
  "mimeType": "image/png",
  "annotations": {
    "audience": ["user"],
    "priority": 0.9
  }
}
```

### 13.3 Audio Content

For returning audio content.

```json
{
  "type": "audio",
  "data": "base64-encoded-audio-data",
  "mimeType": "audio/wav"
}
```

### 13.4 Resource Link

Reference to an MCP resource without embedding content.

```json
{
  "type": "resource_link",
  "uri": "memory://entries/user-context",
  "name": "User Context",
  "description": "Stored user context data",
  "mimeType": "application/json",
  "annotations": {
    "audience": ["assistant"],
    "priority": 0.9
  }
}
```

### 13.5 Embedded Resource

Full resource content embedded in the response.

```json
{
  "type": "resource",
  "resource": {
    "uri": "memory://entries/user-context",
    "mimeType": "application/json",
    "text": "{\"userId\": \"123\", \"preferences\": {...}}",
    "annotations": {
      "audience": ["user", "assistant"],
      "priority": 0.7,
      "lastModified": "2025-12-14T10:30:00Z"
    }
  }
}
```

### 13.6 Content Annotations

All content types support optional annotations:

| Annotation | Type | Description |
|------------|------|-------------|
| `audience` | `string[]` | Who should see: `["user"]`, `["assistant"]`, or both |
| `priority` | `number` | Importance 0.0-1.0 (1.0 = required, 0.0 = optional) |
| `lastModified` | `string` | ISO 8601 timestamp |

---

## 14. Error Handling

### 14.1 JSON-RPC Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON |
| -32600 | Invalid Request | Not a valid request object |
| -32601 | Method Not Found | Method does not exist |
| -32602 | Invalid Params | Invalid method parameters |
| -32603 | Internal Error | Internal server error |

### 14.2 Tool Error Codes

Standard error codes that all tools MUST use:

| Code | Description | Retryable |
|------|-------------|-----------|
| `INVALID_INPUT` | Input validation failed | No |
| `RESOURCE_NOT_FOUND` | Requested resource not found | No |
| `PERMISSION_DENIED` | Operation not permitted | No |
| `RATE_LIMITED` | Rate limit exceeded | Yes |
| `INTERNAL_ERROR` | Internal server error | Yes |
| `TIMEOUT` | Operation timed out | Yes |
| `NOT_IMPLEMENTED` | Feature not implemented | No |

### 14.3 Tool Error Response Format

```typescript
interface ToolErrorResult {
  content: [{
    type: 'text';
    text: string;  // Error message
  }];
  isError: true;
}
```

### 14.4 Error Response Best Practices

1. Always include human-readable error message
2. Include error code for programmatic handling
3. Include relevant context (e.g., which field failed validation)
4. Never expose internal stack traces

---

## 15. Behavioral Invariants

### INV-MCP-001: Schema Conformance

**Description**: Tool inputs and outputs MUST strictly conform to declared schemas.

**Enforcement**:
- Input validation occurs before execution
- Output validation occurs after execution
- Schema violations result in `INVALID_INPUT` error

---

### INV-MCP-002: No Undeclared Side Effects

**Description**: Tools MUST NOT introduce side effects not declared in their description.

**Examples**:
- A "read" tool must not modify data
- A "store" tool must not delete existing data
- Tools must not make external network calls unless declared

---

### INV-MCP-003: Standardized Error Codes

**Description**: All tool failures MUST return codes from StandardErrorCodes or declared tool-specific codes.

**Enforcement**:
- Error codes must be UPPERCASE_SNAKE_CASE
- Custom codes must be documented in tool definition
- Unknown errors default to `INTERNAL_ERROR`

---

### INV-MCP-004: Idempotency Declaration

**Description**: Tools MUST declare whether they are idempotent.

**Categories**:
- Read operations: Always idempotent
- Write operations: Must declare in metadata
- Delete operations: Idempotent (deleting non-existent is OK)

---

### INV-MCP-005: Input Isolation

**Description**: Tools MUST NOT modify their input objects.

**Enforcement**:
- Inputs should be treated as immutable
- Create copies for any modifications needed

---

### INV-MCP-006: Initialization Required

**Description**: All methods except `initialize` require prior initialization.

**Enforcement**:
- Server tracks initialization state
- Non-initialize calls before init return `INVALID_REQUEST`

---

### INV-MCP-007: Event Sourcing

**Description**: All tool calls MUST emit domain events per trace-domain.

**Event Schema**:
```typescript
interface MCPToolCallEvent extends BaseEvent {
  type: 'mcp.toolCalled';
  aggregateId: string;  // Tool name
  payload: {
    toolName: string;
    input: unknown;
    output: unknown;
    success: boolean;
    durationMs: number;
    errorCode?: string;
  };
}
```

**Enforcement**:
- Tool handlers emit events before returning
- Events include correlationId for request tracing
- Failed calls include error code in event

---

### INV-MCP-008: Contract Schema Reference

**Description**: All tool schemas MUST be defined in `@automatosx/contracts` package.

**Enforcement**:
- No inline schema definitions in server implementation
- Tool handlers import schemas from contracts
- Schema validation uses contract Zod schemas

---

## 16. Security Considerations

### 16.1 Input Validation

- All inputs validated against JSON Schema
- String lengths bounded
- Numeric ranges enforced
- No arbitrary code execution

### 16.2 Resource Limits

- Maximum request size: 1MB
- Maximum response size: 10MB
- Maximum array items: 1000
- Request timeout: 30 seconds

### 16.3 Namespace Isolation

- Memory operations scoped to namespace
- Sessions scoped to workspace
- Agents scoped to registry

### 16.4 No Credential Handling

- MCP server does not handle API keys
- Authentication delegated to provider CLIs
- No secrets in tool parameters

---

## 17. Provider-Specific Notes

MCP is an industry-wide standard adopted by all major AI providers. Each provider implements MCP as a **client**, connecting to MCP servers to access tools, resources, and prompts.

### 17.1 Claude Code (Anthropic)

Claude Code has native MCP support as a client.

**Configuration**:
- Config file: `~/.claude.json`
- CLI commands: `claude mcp add`, `claude mcp list`, `claude mcp remove`

**Key Features**:
- Resources exposed as `@` mentions
- Prompts exposed as slash commands (`/mcp__servername__promptname`)
- Enterprise-managed MCP configurations supported

**Connection Example**:
```bash
claude mcp add automatosx -- npx @automatosx/mcp-server
```

### 17.2 Gemini CLI (Google)

Gemini CLI supports MCP servers with FastMCP integration.

**Configuration**:
- Config file: `~/.gemini/settings.json`
- CLI commands: `gemini mcp add`, `gemini mcp list`

**Key Features**:
- OAuth 2.0 support for remote servers
- Rich content support (images, audio in responses)
- Root directory configuration for project management

**Connection Example**:
```bash
gemini mcp add automatosx -- npx @automatosx/mcp-server
```

### 17.3 Codex CLI (OpenAI)

Codex CLI supports MCP servers and can also run as an MCP server itself.

**Configuration**:
- Config file: `~/.codex/config.toml`
- CLI commands: `codex mcp add`
- Enable remote MCP: `[features].rmcp_client = true`

**Key Features**:
- Supports both stdio and OAuth transports
- Can run Codex as an MCP server for other clients
- Shared config between CLI and IDE extension

**Connection Example**:
```bash
codex mcp add automatosx -- npx @automatosx/mcp-server
```

### 17.4 Common Patterns

All three providers share these characteristics when connecting to AutomatosX MCP:

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---------|-------------|------------|-----------|
| stdio transport | ✅ | ✅ | ✅ |
| HTTP/SSE transport | ✅ | ✅ | ✅ (with feature flag) |
| Tool discovery | `tools/list` | `tools/list` | `tools/list` |
| Resource access | `resources/read` | `resources/read` | `resources/read` |
| Prompts as commands | `/mcp__*` | `/mcp__*` | `/mcp__*` |
| OAuth support | ✅ | ✅ | ✅ |

### 17.5 Installation Guide

To connect any of these providers to AutomatosX MCP server:

1. **Build the MCP server**:
   ```bash
   cd automatosx
   pnpm build
   ```

2. **Add to provider config**:

   **Claude Code**:
   ```json
   // ~/.claude.json
   {
     "mcpServers": {
       "automatosx": {
         "command": "node",
         "args": ["./packages/mcp-server/dist/bin.js"]
       }
     }
   }
   ```

   **Gemini CLI**:
   ```json
   // ~/.gemini/settings.json
   {
     "mcpServers": {
       "automatosx": {
         "command": "node",
         "args": ["./packages/mcp-server/dist/bin.js"]
       }
     }
   }
   ```

   **Codex CLI**:
   ```toml
   # ~/.codex/config.toml
   [mcp.automatosx]
   command = "node"
   args = ["./packages/mcp-server/dist/bin.js"]
   ```

3. **Verify connection**:
   - The MCP server should respond to `initialize` with capabilities
   - Tools should appear in `tools/list`
   - Resources should appear in `resources/list`

---

## 18. Implementation Roadmap

### Phase 1: Current Implementation (Complete)

| Tool | Status |
|------|--------|
| `workflow_run` | Done |
| `workflow_list` | Done |
| `workflow_describe` | Done |
| `trace_list` | Done |
| `trace_get` | Done |
| `trace_analyze` | Done |
| `memory_store` | Done |
| `memory_retrieve` | Done |
| `memory_search` | Done |

### Phase 2: Memory & Agent Tools

| Tool | Priority |
|------|----------|
| `memory_list` | High |
| `memory_delete` | High |
| `agent_list` | High |
| `agent_run` | High |
| `agent_get` | Medium |

### Phase 3: Session Tools

| Tool | Priority |
|------|----------|
| `session_create` | High |
| `session_status` | High |
| `session_complete` | High |
| `session_list` | Medium |

### Phase 4: Guard Tools

| Tool | Priority |
|------|----------|
| `guard_check` | High |
| `guard_list` | High |
| `guard_apply` | Medium |

### Phase 5: MCP Resources

| Resource | Priority |
|----------|----------|
| `memory://entries` | Medium |
| `agents://available` | Medium |
| `sessions://active` | Medium |
| `traces://recent` | Low |

---

## Glossary

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol - Standard for AI tool integration |
| **Tool** | Executable function exposed via MCP |
| **Resource** | Read-only data endpoint |
| **JSON-RPC** | Remote procedure call protocol using JSON |
| **Namespace** | Isolation boundary for memory operations |
| **Session** | Multi-agent collaboration context |

---

## References

- [Model Context Protocol Specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Resources Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [MCP Prompts Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Claude Code MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- [Gemini CLI MCP Documentation](https://geminicli.com/docs/tools/mcp-server/)
- [Codex CLI MCP Documentation](https://developers.openai.com/codex/mcp)
- [AutomatosX PRD](./PRD.md)
- [AutomatosX Agentic PRD](./Agentic-PRD.md)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-14 | AutomatosX Team | Initial MCP PRD |
| 2.0.0 | 2025-12-14 | AutomatosX Team | Added Agent, Session tools, Resources, comprehensive schemas |
| 3.0.0 | 2025-12-14 | AutomatosX Team | Updated to MCP spec 2025-06-18, added Prompts, Content Types, Provider-Specific Notes |
| 3.1.0 | 2025-12-14 | AutomatosX Team | Architecture review: Added Guard tools, Domain-Tool mapping, Contract location spec, Event sourcing invariant (INV-MCP-007), Contract schema reference invariant (INV-MCP-008) |
