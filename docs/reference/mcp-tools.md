# MCP Tools Reference

Complete reference for AutomatosX MCP (Model Context Protocol) tools.

## Overview

AutomatosX provides 73+ MCP tools for integration with AI assistants like Claude Code. These tools enable AI-powered development workflows, code review, agent orchestration, multi-model discussions, semantic search, research synthesis, and more.

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
| [Session](#session-tools) | 8 | Collaboration session management |
| [Memory](#memory-tools) | 5 | Key-value memory storage |
| [Review](#review-tools) | 2 | AI-powered code review |
| [Guard](#guard-tools) | 3 | Governance and policy enforcement |
| [Trace](#trace-tools) | 6 | Execution tracing |
| [Scaffold](#scaffold-tools) | 3 | Contract-first scaffolding |
| [File System](#file-system-tools) | 3 | File operations |
| [Config](#config-tools) | 3 | Configuration management |
| [Ability](#ability-tools) | 2 | Ability management |
| [Discussion](#discussion-tools) | 3 | Multi-model AI discussions |
| [Parallel](#parallel-execution-tools) | 2 | DAG-based parallel agent execution |
| [Semantic](#semantic-search-tools) | 7 | Vector similarity search |
| [Research](#research-tools) | 3 | Web research and synthesis |
| [Design](#design-tools) | 5 | Design artifact generation |
| [Git](#git-tools) | 5 | Git operations and PR management |
| [Feedback](#feedback-tools) | 5 | Agent performance feedback |
| [MCP Ecosystem](#mcp-ecosystem-tools) | 6 | External MCP server management |

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

### session_close_stuck

Close stuck sessions.

```json
{
  "maxAgeMs": 86400000
}
```

**Parameters:**
- `maxAgeMs` (optional): Max age before considered stuck (default: 24 hours)

**Side Effects:** Marks stuck sessions as failed.

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

### trace_tree

Get hierarchical tree view of a trace.

```json
{
  "traceId": "trace-uuid"
}
```

**Returns:** Complete trace tree structure with delegated child traces.

---

### trace_by_session

Get traces for a session.

```json
{
  "sessionId": "session-uuid"
}
```

**Returns:** Traces associated with the session, sorted by start time.

---

### trace_close_stuck

Close stuck traces.

```json
{
  "maxAgeMs": 3600000
}
```

**Parameters:**
- `maxAgeMs` (optional): Max age before considered stuck (default: 1 hour)

**Side Effects:** Marks stuck traces as failed.

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

## Discussion Tools

### discuss

Multi-model discussion with synthesis.

```json
{
  "topic": "Should we use microservices or monolith?",
  "providers": ["claude", "gemini", "grok"],
  "pattern": "synthesis",
  "consensus": "synthesis",
  "rounds": 2,
  "context": "5-person startup building an e-commerce platform"
}
```

**Parameters:**
- `topic` (required): Discussion topic (max 2000 chars)
- `providers` (optional): Providers to participate (default: claude, grok, gemini)
- `participants` (optional): Mix of providers and agents
- `pattern` (optional): `synthesis`, `voting`, `debate`, `critique`, `round-robin`
- `consensus` (optional): `synthesis`, `voting`, `moderator`, `unanimous`, `majority`
- `rounds` (optional): Discussion rounds 1-5 (default: 2)
- `timeout` (optional): Per-provider timeout in ms
- `context` (optional): Additional context
- `fastMode` (optional): Single round, skip cross-discussion

**Side Effects:** Makes LLM API calls to multiple providers.

---

### discuss_quick

Quick 2-round synthesis discussion.

```json
{
  "topic": "REST vs GraphQL for mobile app",
  "providers": ["claude", "gemini", "grok"]
}
```

**Parameters:**
- `topic` (required): Topic for discussion
- `providers` (optional): Providers to use

---

### discuss_recursive

Recursive multi-model discussion with depth control.

```json
{
  "topic": "Design a distributed caching system",
  "maxDepth": 2,
  "maxCalls": 20,
  "timeoutStrategy": "cascade"
}
```

**Parameters:**
- `topic` (required): Topic for discussion
- `maxDepth` (optional): Recursion depth 1-4 (default: 2)
- `maxCalls` (optional): Max provider calls (default: 20)
- `timeoutStrategy` (optional): `fixed`, `cascade`, `budget`
- `totalBudget` (optional): Total timeout budget in ms

**Side Effects:** Makes LLM API calls, may spawn nested discussions.

---

## Parallel Execution Tools

### parallel_run

Execute multiple agents in parallel with DAG-based dependency management.

```json
{
  "tasks": [
    {"agentId": "security", "input": {"query": "audit auth"}},
    {"agentId": "quality", "input": {"query": "review tests"}, "dependencies": []},
    {"agentId": "fullstack", "dependencies": ["security", "quality"]}
  ],
  "config": {
    "maxConcurrentAgents": 5,
    "failureStrategy": "failSafe",
    "resultAggregation": "merge"
  }
}
```

**Parameters:**
- `tasks` (required): Tasks to execute (max 100)
- `config` (optional): Execution configuration
  - `maxConcurrentAgents`: Max parallel agents (default: 5)
  - `failureStrategy`: `failFast`, `failSafe`, `continueOnError`
  - `resultAggregation`: `merge`, `list`, `firstSuccess`
- `sharedContext` (optional): Shared context for all agents
- `sessionId` (optional): Session for tracking

**Side Effects:** Creates agent executions, may modify session state.

---

### parallel_plan

Preview execution plan without running.

```json
{
  "tasks": [
    {"agentId": "security"},
    {"agentId": "quality"},
    {"agentId": "fullstack", "dependencies": ["security", "quality"]}
  ]
}
```

**Returns:** DAG structure, execution layers, parallelism analysis.

---

## Semantic Search Tools

### semantic_store

Store content with vector embeddings for similarity search.

```json
{
  "key": "auth-implementation",
  "content": "The authentication module uses JWT tokens with...",
  "namespace": "code-docs",
  "tags": ["auth", "security"],
  "metadata": {"file": "src/auth/jwt.ts"}
}
```

**Parameters:**
- `key` (required): Unique storage key
- `content` (required): Text content to store and index
- `namespace` (optional): Namespace for organization
- `tags` (optional): Tags for filtering
- `metadata` (optional): Additional metadata
- `forceRecompute` (optional): Recompute embedding

**Side Effects:** Creates/updates entry with computed embedding.

---

### semantic_search

Search for semantically similar content.

```json
{
  "query": "How does authentication work?",
  "namespace": "code-docs",
  "topK": 10,
  "minSimilarity": 0.7,
  "filterTags": ["auth"]
}
```

**Parameters:**
- `query` (required): Search query text
- `namespace` (optional): Namespace to search
- `topK` (optional): Max results (default: 10)
- `minSimilarity` (optional): Similarity threshold 0-1 (default: 0.7)
- `filterTags` (optional): Filter by tags (all must match)

**Returns:** Ranked results by similarity score.

---

### semantic_get

Retrieve a specific item by key.

```json
{
  "key": "auth-implementation",
  "namespace": "code-docs"
}
```

---

### semantic_list

List semantic items with filtering.

```json
{
  "namespace": "code-docs",
  "keyPrefix": "auth-",
  "limit": 10
}
```

---

### semantic_delete

Delete an item by key.

```json
{
  "key": "auth-implementation",
  "namespace": "code-docs"
}
```

**Side Effects:** Removes item from store.

---

### semantic_stats

Get storage statistics.

```json
{
  "namespace": "code-docs"
}
```

---

### semantic_clear

Clear all items in a namespace.

```json
{
  "namespace": "code-docs",
  "confirm": true
}
```

**Side Effects:** Removes all items in namespace. Requires `confirm: true`.

---

## Research Tools

### research_query

Web search with AI synthesis.

```json
{
  "query": "Best practices for TypeScript monorepo 2024",
  "sources": ["web", "docs", "github"],
  "maxSources": 5,
  "synthesize": true,
  "language": "typescript"
}
```

**Parameters:**
- `query` (required): Research query (max 5000 chars)
- `sources` (optional): Source types - `web`, `docs`, `github`, `stackoverflow`, `arxiv`
- `maxSources` (optional): Max sources 1-20 (default: 5)
- `synthesize` (optional): Combine results (default: true)
- `language` (optional): Programming language filter
- `includeCode` (optional): Include code examples (default: true)

**Returns:** Sources and synthesized answer with confidence.

---

### research_fetch

Fetch and extract content from URL.

```json
{
  "url": "https://example.com/docs/api",
  "extractCode": true,
  "maxLength": 10000
}
```

**Parameters:**
- `url` (required): URL to fetch
- `extractCode` (optional): Extract code blocks (default: true)
- `maxLength` (optional): Max content length (default: 10000)

---

### research_synthesize

Combine multiple sources into a coherent answer.

```json
{
  "query": "How to implement OAuth2 in Node.js",
  "sources": [...],
  "style": "detailed",
  "includeCode": true
}
```

**Parameters:**
- `query` (required): Original query for context
- `sources` (required): Sources to synthesize
- `style` (optional): `concise`, `detailed`, `tutorial`
- `includeCode` (optional): Include code examples

**Returns:** Synthesized answer with source citations.

---

## Design Tools

### design_api

Generate OpenAPI/AsyncAPI specifications.

```json
{
  "name": "Orders API",
  "endpoints": [
    {"path": "/orders", "method": "GET", "summary": "List orders"},
    {"path": "/orders/{id}", "method": "GET", "summary": "Get order by ID"},
    {"path": "/orders", "method": "POST", "summary": "Create order"}
  ],
  "format": "openapi",
  "version": "1.0.0",
  "baseUrl": "https://api.example.com"
}
```

**Parameters:**
- `name` (required): API name
- `endpoints` (required): List of API endpoints
- `format` (optional): `openapi`, `asyncapi`
- `version` (optional): API version (default: 1.0.0)
- `baseUrl` (optional): Base URL
- `outputPath` (optional): File path to write

---

### design_component

Generate component interface designs.

```json
{
  "name": "UserService",
  "type": "service",
  "description": "Handles user management operations",
  "inputs": [
    {"name": "userId", "type": "string", "required": true}
  ],
  "outputs": [
    {"name": "user", "type": "User"}
  ],
  "language": "typescript"
}
```

**Parameters:**
- `name` (required): Component name
- `type` (required): `function`, `class`, `module`, `service`, `controller`, etc.
- `description` (required): Component purpose
- `inputs` (optional): Input parameters
- `outputs` (optional): Output values
- `language` (optional): Programming language
- `patterns` (optional): Design patterns to apply

---

### design_schema

Generate data schemas (Zod, JSON Schema, TypeScript).

```json
{
  "name": "Order",
  "fields": [
    {"name": "id", "type": "uuid", "required": true},
    {"name": "status", "type": "enum", "enumValues": ["pending", "completed", "cancelled"]},
    {"name": "items", "type": "array", "required": true}
  ],
  "format": "zod"
}
```

**Parameters:**
- `name` (required): Schema name
- `fields` (required): Schema fields with types
- `format` (optional): `zod`, `json-schema`, `typescript`, `prisma`, `drizzle`
- `outputPath` (optional): File path to write

---

### design_architecture

Generate architecture diagrams (Mermaid, PlantUML, C4).

```json
{
  "name": "E-Commerce Platform",
  "description": "Microservices architecture for online store",
  "pattern": "microservices",
  "components": [
    {"id": "api-gateway", "name": "API Gateway", "type": "service"},
    {"id": "order-service", "name": "Order Service", "type": "domain", "dependencies": ["api-gateway"]},
    {"id": "payment-service", "name": "Payment Service", "type": "external", "dependencies": ["order-service"]}
  ],
  "format": "mermaid"
}
```

**Parameters:**
- `name` (required): Architecture name
- `description` (required): Architecture description
- `pattern` (required): `hexagonal`, `clean`, `layered`, `microservices`, `event-driven`, etc.
- `components` (required): Architecture components
- `format` (optional): `mermaid`, `plantuml`, `markdown`, `c4`

---

### design_list

List generated design artifacts.

```json
{
  "type": "api",
  "status": "approved",
  "limit": 50
}
```

---

## Git Tools

### git_status

Get repository status.

```json
{
  "path": "/path/to/repo",
  "short": false
}
```

**Returns:** Branch, staged/unstaged changes, untracked files.

---

### git_diff

Get diff for files or commits.

```json
{
  "staged": true,
  "paths": ["src/api/users.ts"],
  "commit": "HEAD~1",
  "stat": false
}
```

**Parameters:**
- `staged` (optional): Show staged changes
- `paths` (optional): Specific file paths
- `commit` (optional): Compare with commit
- `base` (optional): Base commit for comparison
- `stat` (optional): Show diffstat summary

---

### commit_prepare

Stage files and generate AI commit message.

```json
{
  "paths": ["src/api/users.ts", "src/types/user.ts"],
  "type": "feat",
  "scope": "api",
  "stageAll": false
}
```

**Parameters:**
- `paths` (required): Files to stage and commit
- `type` (optional): Commit type - `feat`, `fix`, `refactor`, `docs`, `test`, etc.
- `scope` (optional): Commit scope
- `stageAll` (optional): Stage all modified files

**Side Effects:** Stages files. Requires user confirmation to commit.

---

### pr_create

Create GitHub pull request with AI description.

```json
{
  "title": "Add user authentication",
  "base": "main",
  "draft": false,
  "push": true
}
```

**Parameters:**
- `title` (required): PR title
- `base` (optional): Base branch (default: main)
- `body` (optional): PR body (AI generates if empty)
- `draft` (optional): Create as draft
- `push` (optional): Push branch first (default: true)

**Side Effects:** Pushes branch and creates PR. Requires GitHub CLI.

---

### pr_review

Get PR details for review.

```json
{
  "prNumber": 123,
  "focus": "security"
}
```

**Parameters:**
- `prNumber` (required): PR number
- `focus` (optional): Review focus - `security`, `architecture`, `performance`, `all`

**Returns:** PR diff, commits, files for analysis.

---

## Feedback Tools

### feedback_submit

Submit feedback for an agent task.

```json
{
  "taskDescription": "Review authentication code",
  "selectedAgent": "security",
  "recommendedAgent": "reviewer",
  "rating": 5,
  "outcome": "success",
  "userComment": "Excellent security analysis"
}
```

**Parameters:**
- `taskDescription` (required): Task description (max 5000 chars)
- `selectedAgent` (required): Agent that was used
- `recommendedAgent` (optional): Agent that was recommended
- `rating` (optional): Rating 1-5
- `outcome` (optional): `success`, `failure`, `partial`, `cancelled`
- `feedbackType` (optional): `explicit`, `implicit`, `outcome`
- `userComment` (optional): User comment

**Side Effects:** Creates feedback record, may update score adjustments.

---

### feedback_history

Get feedback history.

```json
{
  "agentId": "security",
  "since": "2024-01-01T00:00:00Z",
  "limit": 20
}
```

---

### feedback_stats

Get feedback statistics for an agent.

```json
{
  "agentId": "security"
}
```

---

### feedback_overview

Get system-wide feedback summary.

```json
{}
```

---

### feedback_adjustments

View score adjustments for an agent.

```json
{
  "agentId": "security"
}
```

**Returns:** Score adjustments based on feedback (bounded -0.5 to +0.5).

---

## MCP Ecosystem Tools

### mcp_server_register

Register an external MCP server.

```json
{
  "serverId": "custom-tools",
  "command": "npx",
  "args": ["-y", "@example/mcp-server"],
  "enabled": true,
  "connectNow": true,
  "discoverNow": true
}
```

**Parameters:**
- `serverId` (required): Unique server ID (lowercase alphanumeric with hyphens)
- `command` (required): Command to start server
- `name` (optional): Human-readable name
- `args` (optional): Command arguments
- `env` (optional): Environment variables
- `enabled` (optional): Enable server (default: true)
- `connectNow` (optional): Connect immediately (default: true)
- `discoverNow` (optional): Discover tools (default: true)

**Side Effects:** Creates/updates server registration.

---

### mcp_server_list

List registered MCP servers.

```json
{
  "status": "connected",
  "enabled": true,
  "limit": 10
}
```

---

### mcp_server_unregister

Remove an MCP server.

```json
{
  "serverId": "custom-tools"
}
```

**Side Effects:** Removes server and clears its tools.

---

### mcp_tools_discover

Discover tools from registered servers.

```json
{
  "serverIds": ["custom-tools"],
  "forceRefresh": false,
  "includeDisabled": false
}
```

---

### mcp_tool_invoke

Call a tool on an external MCP server.

```json
{
  "toolName": "custom_tool",
  "serverId": "custom-tools",
  "arguments": {"param": "value"}
}
```

**Parameters:**
- `toolName` (required): Tool name (use `serverId.toolName` for disambiguation)
- `serverId` (optional): Server ID (required if tool name is ambiguous)
- `arguments` (optional): Tool arguments

---

### mcp_tools_list

List discovered tools from MCP servers.

```json
{
  "serverId": "custom-tools",
  "category": "utility"
}
```

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
