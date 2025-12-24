# MCP Tools Reference

Complete reference for AutomatosX MCP (Model Context Protocol) tools.

## Overview

AutomatosX provides 41 MCP tools for integration with AI assistants like Claude Code. These tools enable AI-powered development workflows, code review, agent orchestration, and more.

## Starting the MCP Server

```bash
# Start the MCP server
ax mcp server

# Or run directly
node packages/mcp-server/dist/bin.js
```

## Configure Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "automatosx": {
      "command": "node",
      "args": ["/path/to/automatosx/packages/mcp-server/dist/bin.js"]
    }
  }
}
```

---

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| [Workflow](#workflow-tools) | 3 | Workflow execution and management |
| [Agent](#agent-tools) | 7 | Agent management and execution |
| [Session](#session-tools) | 7 | Collaboration session management |
| [Memory](#memory-tools) | 5 | Key-value memory storage |
| [Review](#review-tools) | 2 | AI-powered code review |
| [Guard](#guard-tools) | 3 | Governance and policy enforcement |
| [Trace](#trace-tools) | 3 | Execution tracing |
| [Scaffold](#scaffold-tools) | 3 | Contract-first scaffolding |
| [File System](#file-system-tools) | 3 | File operations |
| [Config](#config-tools) | 3 | Configuration management |
| [Ability](#ability-tools) | 2 | Ability management |

---

## Workflow Tools

### workflow_run

Execute a workflow by ID.

```json
{
  "workflowId": "developer",
  "input": {"feature": "Add user authentication"}
}
```

**Parameters:**
- `workflowId` (required): The workflow ID to execute
- `input` (optional): JSON input for the workflow

**Returns:** Workflow execution result with outputs from each step.

---

### workflow_list

List available workflows.

```json
{
  "limit": 10,
  "status": "active"
}
```

**Parameters:**
- `limit` (optional): Maximum workflows to return (default: 10)
- `status` (optional): Filter by status (`active`, `inactive`, `draft`)

**Returns:** Array of workflow summaries.

---

### workflow_describe

Get detailed information about a workflow.

```json
{
  "workflowId": "developer"
}
```

**Parameters:**
- `workflowId` (required): The workflow ID to describe

**Returns:** Complete workflow definition including steps and metadata.

---

## Agent Tools

### agent_list

List available agents.

```json
{
  "team": "engineering",
  "enabled": true,
  "limit": 50
}
```

**Parameters:**
- `team` (optional): Filter by team
- `enabled` (optional): Filter by enabled status
- `limit` (optional): Maximum agents to return

**Returns:** Array of agent profiles.

---

### agent_run

Execute an agent with input.

```json
{
  "agentId": "fullstack",
  "input": {"query": "Build a REST API for orders"},
  "sessionId": "optional-session-id"
}
```

**Parameters:**
- `agentId` (required): The agent ID to run
- `input` (optional): Input data for the agent
- `sessionId` (optional): Associate with a session

**Side Effects:** Creates agent execution, may modify session state.

**Returns:** Agent execution result.

---

### agent_get

Get detailed agent information.

```json
{
  "agentId": "fullstack"
}
```

**Parameters:**
- `agentId` (required): The agent ID to retrieve

**Returns:** Complete agent profile.

---

### agent_register

Register a new agent profile.

```json
{
  "agentId": "my-agent",
  "description": "Custom agent for specific tasks",
  "displayName": "My Agent",
  "capabilities": ["code-review", "testing"],
  "systemPrompt": "You are a specialist in...",
  "enabled": true
}
```

**Parameters:**
- `agentId` (required): Unique identifier (alphanumeric, dash, underscore)
- `description` (required): Agent description
- `displayName` (optional): Human-readable name
- `capabilities` (optional): List of capabilities
- `systemPrompt` (optional): System prompt
- `workflow` (optional): Workflow steps
- `workflowTemplate` (optional): Use predefined template

**Side Effects:** Creates new agent in registry.

---

### agent_remove

Remove an agent from the registry.

```json
{
  "agentId": "my-agent"
}
```

**Parameters:**
- `agentId` (required): The agent ID to remove

**Side Effects:** Deletes agent profile.

---

### agent_recommend

Recommend the best agent for a task.

```json
{
  "task": "Review this code for security vulnerabilities",
  "requiredCapabilities": ["security-review"],
  "maxResults": 3
}
```

**Parameters:**
- `task` (required): Task description (max 2000 chars)
- `requiredCapabilities` (optional): Required capabilities
- `team` (optional): Filter by team
- `excludeAgents` (optional): Agents to exclude
- `maxResults` (optional): Max recommendations (default: 3)

**Returns:** Ranked agent matches with confidence scores.

---

### agent_capabilities

List all capabilities across agents.

```json
{
  "category": "implementer",
  "includeDisabled": false
}
```

**Parameters:**
- `category` (optional): Filter by category
- `includeDisabled` (optional): Include disabled agents

**Returns:** Capability-to-agent mapping.

---

## Session Tools

### session_create

Create a new collaboration session.

```json
{
  "initiator": "user",
  "task": "Implement user authentication",
  "workspace": "/path/to/project",
  "metadata": {}
}
```

**Parameters:**
- `initiator` (required): Identifier of session creator
- `task` (required): Session objective
- `workspace` (optional): Workspace path
- `metadata` (optional): Additional metadata

**Side Effects:** Creates new session.

**Returns:** Session ID and details.

---

### session_status

Get session status.

```json
{
  "sessionId": "session-uuid"
}
```

**Returns:** Session status, participants, and metadata.

---

### session_list

List sessions.

```json
{
  "status": "active",
  "initiator": "user",
  "limit": 20
}
```

**Parameters:**
- `status` (optional): Filter by `active`, `completed`, `failed`
- `initiator` (optional): Filter by initiator
- `limit` (optional): Maximum sessions to return

---

### session_join

Join an existing session.

```json
{
  "sessionId": "session-uuid",
  "agentId": "fullstack",
  "role": "collaborator"
}
```

**Parameters:**
- `sessionId` (required): Session to join
- `agentId` (required): Agent joining
- `role` (optional): `collaborator` or `delegate`

**Side Effects:** Adds agent to session.

---

### session_leave

Leave a session.

```json
{
  "sessionId": "session-uuid",
  "agentId": "fullstack"
}
```

**Side Effects:** Removes agent from session.

---

### session_complete

Mark session as completed.

```json
{
  "sessionId": "session-uuid",
  "summary": "Successfully implemented authentication"
}
```

**Side Effects:** Updates session status.

---

### session_fail

Mark session as failed.

```json
{
  "sessionId": "session-uuid",
  "error": {"code": "TIMEOUT", "message": "Session timed out"}
}
```

**Side Effects:** Updates session status to failed.

---

## Memory Tools

### memory_store

Store a value in memory.

```json
{
  "key": "user-preferences",
  "value": {"theme": "dark", "language": "en"},
  "namespace": "settings"
}
```

**Parameters:**
- `key` (required): Storage key
- `value` (required): Value to store (object)
- `namespace` (optional): Namespace for organization

**Side Effects:** Creates/updates memory entry.

---

### memory_retrieve

Retrieve a value from memory.

```json
{
  "key": "user-preferences",
  "namespace": "settings"
}
```

**Returns:** Stored value or null.

---

### memory_search

Search memory entries.

```json
{
  "query": "authentication",
  "namespace": "code-context",
  "limit": 10
}
```

**Parameters:**
- `query` (required): Search query
- `namespace` (optional): Namespace to search
- `limit` (optional): Maximum results

**Returns:** Matching memory entries.

---

### memory_list

List all keys in memory.

```json
{
  "namespace": "settings",
  "prefix": "user-",
  "limit": 100
}
```

**Returns:** List of matching keys.

---

### memory_delete

Delete a key from memory.

```json
{
  "key": "user-preferences",
  "namespace": "settings"
}
```

**Side Effects:** Removes key from store.

---

## Review Tools

### review_analyze

AI-powered code review with focused analysis.

```json
{
  "paths": ["src/auth/", "src/api/"],
  "focus": "security",
  "context": "Payment processing service",
  "maxFiles": 20,
  "minConfidence": 0.7,
  "outputFormat": "markdown"
}
```

**Parameters:**
- `paths` (required): File/directory paths to review
- `focus` (optional): Focus mode - `security`, `architecture`, `performance`, `maintainability`, `correctness`, `all` (default)
- `context` (optional): Additional context
- `maxFiles` (optional): Max files to analyze (default: 20)
- `maxLinesPerFile` (optional): Max lines per file (default: 500)
- `minConfidence` (optional): Confidence threshold 0-1 (default: 0.7)
- `outputFormat` (optional): `markdown`, `json`, `sarif`
- `dryRun` (optional): Preview what would be analyzed

**Returns:** Review findings organized by severity.

---

### review_list

List recent code reviews.

```json
{
  "limit": 10,
  "focus": "security"
}
```

**Returns:** Recent review summaries.

---

## Guard Tools

### guard_check

Run governance gates on changed paths.

```json
{
  "policyId": "bugfix",
  "changedPaths": ["src/service.ts", "src/types.ts"],
  "target": "payment-service"
}
```

**Parameters:**
- `policyId` (required): Policy to check against
- `changedPaths` (required): List of changed file paths
- `target` (optional): Target identifier

**Returns:** Gate results (pass/fail with details).

---

### guard_list

List available governance policies.

```json
{
  "limit": 20
}
```

**Returns:** Available policies with descriptions.

---

### guard_apply

Apply a governance policy to a session.

```json
{
  "sessionId": "session-uuid",
  "policyId": "bugfix"
}
```

**Side Effects:** Associates policy with session.

---

## Trace Tools

### trace_list

List recent execution traces.

```json
{
  "limit": 10,
  "status": "success"
}
```

**Parameters:**
- `limit` (optional): Maximum traces to return
- `status` (optional): Filter by `success`, `failure`, `running`

---

### trace_get

Get detailed trace information.

```json
{
  "traceId": "trace-uuid"
}
```

**Returns:** Complete trace with all events.

---

### trace_analyze

Analyze a trace for issues.

```json
{
  "traceId": "trace-uuid"
}
```

**Returns:** Performance analysis, error identification, recommendations.

---

## Scaffold Tools

### scaffold_contract

Generate Zod schemas and invariants.

```json
{
  "name": "payment",
  "description": "Payment processing domain",
  "dryRun": false
}
```

**Parameters:**
- `name` (required): Domain name (kebab-case)
- `description` (optional): Domain description
- `dryRun` (optional): Preview without writing

**Side Effects:** Creates contract files.

---

### scaffold_domain

Generate domain implementation package.

```json
{
  "name": "payment",
  "output": "packages/core/payment-domain",
  "includeTests": true,
  "includeGuard": true,
  "scope": "@myorg",
  "dryRun": false
}
```

**Parameters:**
- `name` (required): Domain name
- `output` (optional): Output directory
- `includeTests` (optional): Generate tests (default: true)
- `includeGuard` (optional): Generate guard policy (default: true)
- `scope` (optional): NPM scope
- `dryRun` (optional): Preview without writing

**Side Effects:** Creates domain package files.

---

### scaffold_guard

Generate guard policy.

```json
{
  "policyId": "payment-development",
  "domain": "payment",
  "radius": 3,
  "gates": ["path_violation", "dependency", "change_radius", "contract_tests"],
  "dryRun": false
}
```

**Parameters:**
- `policyId` (required): Policy ID
- `domain` (optional): Domain name
- `radius` (optional): Change radius limit (default: 3)
- `gates` (optional): Gates to include
- `dryRun` (optional): Preview without writing

**Side Effects:** Creates policy file.

---

## File System Tools

### file_write

Write content to a file.

```json
{
  "path": "src/utils/helper.ts",
  "content": "export function helper() { ... }",
  "overwrite": false,
  "backup": false,
  "createDirectories": true,
  "encoding": "utf-8"
}
```

**Parameters:**
- `path` (required): File path relative to workspace
- `content` (required): Content to write
- `overwrite` (optional): Allow overwriting (default: false)
- `backup` (optional): Create backup before overwriting
- `createDirectories` (optional): Create parent dirs (default: true)
- `encoding` (optional): Encoding (default: utf-8)

**Side Effects:** Creates/modifies file.

---

### directory_create

Create a directory.

```json
{
  "path": "src/new-module",
  "recursive": true
}
```

**Side Effects:** Creates directory.

---

### file_exists

Check if file/directory exists.

```json
{
  "path": "src/utils/helper.ts"
}
```

**Returns:** Boolean existence check.

---

## Config Tools

### config_get

Get a configuration value.

```json
{
  "path": "logLevel",
  "scope": "merged"
}
```

**Parameters:**
- `path` (required): Config path (e.g., `logLevel`, `providers.0.providerId`)
- `scope` (optional): `global`, `local`, `merged` (default)

---

### config_set

Set a configuration value.

```json
{
  "path": "logLevel",
  "value": "debug",
  "scope": "global"
}
```

**Side Effects:** Writes to config file.

---

### config_show

Show full configuration.

```json
{
  "scope": "merged"
}
```

**Returns:** Complete configuration object.

---

## Ability Tools

### ability_list

List available abilities.

```json
{
  "category": "languages",
  "enabled": true,
  "tags": ["typescript"],
  "limit": 50
}
```

**Parameters:**
- `category` (optional): Filter by category
- `enabled` (optional): Filter by enabled status
- `tags` (optional): Filter by tags
- `limit` (optional): Maximum abilities to return

---

### ability_inject

Inject relevant abilities into agent context.

```json
{
  "agentId": "fullstack",
  "task": "Build a React component with TypeScript",
  "coreAbilities": ["typescript", "react"],
  "maxAbilities": 10,
  "maxTokens": 50000,
  "includeMetadata": false
}
```

**Parameters:**
- `agentId` (required): Agent for applicability filtering
- `task` (required): Task description for matching
- `coreAbilities` (optional): Always include these
- `maxAbilities` (optional): Maximum abilities (default: 10)
- `maxTokens` (optional): Max tokens (default: 50000)
- `includeMetadata` (optional): Include headers

**Returns:** Combined ability content for agent context.

---

## Tool Naming Convention

Tools follow the naming pattern: `{domain}_{action}`

- **Read-only tools:** No side effects, safe to call repeatedly
- **Mutating tools:** Documented side effects, may modify state

With `AX_MCP_TOOL_PREFIX=ax_`, tools become `ax_workflow_run`, `ax_agent_list`, etc.

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Input validation failed |
| `NOT_FOUND` | Resource not found |
| `ALREADY_EXISTS` | Resource already exists |
| `PERMISSION_DENIED` | Operation not allowed |
| `TIMEOUT` | Operation timed out |
| `INTERNAL_ERROR` | Internal server error |
