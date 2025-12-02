# Gemini CLI MCP Integration

**Version**: v10.2.0+
**Status**: Production Ready
**Protocol**: MCP (Model Context Protocol)

---

## Overview

AutomatosX provides bidirectional integration with Gemini CLI via the **MCP (Model Context Protocol)**. This enables Gemini CLI to directly invoke AutomatosX agents, search memory, and manage sessions without subprocess spawning.

**Benefits**:
- ✅ **Direct Invocation** - Gemini CLI calls AutomatosX tools natively
- ✅ **Zero Subprocess Overhead** - No `spawn()` calls, < 50ms latency
- ✅ **Rich Capabilities** - Access to all AutomatosX features
- ✅ **Automatic Setup** - Configured via `ax setup`
- ✅ **Standard Protocol** - MCP is vendor-neutral and future-proof

---

## Quick Start

### 1. Setup AutomatosX with Gemini CLI MCP

```bash
# Initialize AutomatosX in your project
ax setup

# MCP configuration is created automatically if Gemini CLI detected
# Creates: .gemini/mcp-servers.json
```

### 2. Verify MCP Configuration

```bash
# Check that MCP server is configured
cat .gemini/mcp-servers.json

# Should contain:
# {
#   "automatosx": {
#     "command": "node",
#     "args": ["/path/to/automatosx/dist/mcp/index.js"],
#     "description": "AutomatosX AI agent orchestration platform...",
#     "env": {
#       "AUTOMATOSX_CONFIG_PATH": "/path/to/project/ax.config.json",
#       "AUTOMATOSX_LOG_LEVEL": "warn"
#     }
#   }
# }
```

### 3. Use AutomatosX from Gemini CLI

```
# In Gemini CLI, use natural language
User: "Use AutomatosX to implement user authentication with the backend agent"

Gemini CLI:
  → Invokes MCP tool: run_agent
  → AutomatosX executes backend agent
  → Returns result via MCP
  → Gemini CLI continues conversation with full context
```

---

## Available MCP Tools

AutomatosX exposes the following tools via MCP protocol:

### Agent Execution

#### `run_agent`

Execute an AutomatosX agent with a specific task.

**Input Schema**:
```typescript
{
  agent: string;      // Agent name (e.g., "backend", "security", "quality")
  task: string;       // Task description
  provider?: string;  // Optional: Override AI provider ("claude", "gemini", "openai")
  no_memory?: boolean; // Optional: Skip memory injection (default: false)
}
```

**Example**:
```json
{
  "agent": "backend",
  "task": "Create a REST API for user authentication with JWT tokens"
}
```

**Response**:
```json
{
  "result": "Successfully implemented authentication API...",
  "metadata": {
    "agent": "backend",
    "provider": "gemini-cli",
    "duration": 45230,
    "tokensUsed": 8542
  }
}
```

#### `list_agents`

List all available AutomatosX agents.

**Input Schema**:
```typescript
{
  // No parameters
}
```

**Response**:
```json
{
  "agents": [
    {
      "name": "backend",
      "displayName": "Bob (Backend Developer)",
      "role": "Backend development specialist",
      "capabilities": ["Go", "Rust", "System Design", "APIs"]
    },
    {
      "name": "security",
      "displayName": "Steve (Security Expert)",
      "role": "Security auditing and threat modeling",
      "capabilities": ["OWASP", "Penetration Testing", "Security Review"]
    }
    // ... more agents
  ]
}
```

### Memory Operations

#### `search_memory`

Search AutomatosX persistent memory for relevant information.

**Input Schema**:
```typescript
{
  query: string;   // Search query
  limit?: number;  // Max results (default: 10)
}
```

**Example**:
```json
{
  "query": "authentication implementation",
  "limit": 5
}
```

**Response**:
```json
{
  "results": [
    {
      "id": 42,
      "content": "Implemented JWT authentication with refresh tokens...",
      "metadata": {
        "agent": "backend",
        "timestamp": "2025-11-20T15:30:00Z"
      },
      "relevance": 0.95
    }
    // ... more results
  ]
}
```

#### `memory_add`

Add a new memory entry to the system.

**Input Schema**:
```typescript
{
  content: string;                // Memory content
  metadata?: {                     // Optional metadata
    agent?: string;
    timestamp?: string;
  };
}
```

#### `memory_list`

List memory entries with optional filtering.

**Input Schema**:
```typescript
{
  agent?: string;   // Filter by agent name
  limit?: number;   // Max entries (default: 50)
}
```

#### `memory_stats`

Get detailed memory statistics.

**Input Schema**:
```typescript
{
  // No parameters
}
```

**Response**:
```json
{
  "totalEntries": 1523,
  "byAgent": {
    "backend": 450,
    "security": 230,
    "quality": 180
  },
  "databaseSize": "12.5 MB",
  "oldestEntry": "2025-01-15T10:00:00Z",
  "newestEntry": "2025-11-23T14:45:00Z"
}
```

### Session Management

#### `session_create`

Create a new multi-agent collaboration session.

**Input Schema**:
```typescript
{
  name: string;   // Session name/description
  agent: string;  // Initiating agent
}
```

**Example**:
```json
{
  "name": "User Authentication Feature",
  "agent": "product"
}
```

**Response**:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "User Authentication Feature",
  "createdBy": "product",
  "createdAt": "2025-11-23T15:00:00Z",
  "status": "active"
}
```

#### `session_list`

List all active sessions.

**Input Schema**:
```typescript
{
  // No parameters
}
```

#### `session_status`

Get detailed status of a specific session.

**Input Schema**:
```typescript
{
  id: string;  // Session ID (UUID)
}
```

#### `session_complete`

Mark a session as completed.

**Input Schema**:
```typescript
{
  id: string;  // Session ID
}
```

#### `session_fail`

Mark a session as failed with an error reason.

**Input Schema**:
```typescript
{
  id: string;    // Session ID
  reason: string; // Failure reason
}
```

### System Status

#### `get_status`

Get AutomatosX system status and configuration.

**Input Schema**:
```typescript
{
  // No parameters
}
```

**Response**:
```json
{
  "version": "10.2.0",
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "available": true,
      "priority": 1
    },
    "claude-code": {
      "enabled": true,
      "available": true,
      "priority": 2
    }
  },
  "memory": {
    "totalEntries": 1523,
    "size": "12.5 MB"
  },
  "sessions": {
    "active": 3,
    "completed": 147
  }
}
```

---

## Architecture

### How It Works

```
┌──────────────┐         MCP Protocol          ┌─────────────────────┐
│              │◄────────────────────────────►│                     │
│  Gemini CLI  │  (stdio JSON-RPC transport)  │  AutomatosX MCP     │
│              │                               │      Server         │
└──────────────┘                               └─────────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────────┐
                                               │  AutomatosX Core    │
                                               │  - Router           │
                                               │  - Memory Manager   │
                                               │  - Session Manager  │
                                               │  - Agent Execution  │
                                               └─────────────────────┘
```

### MCP Communication Flow

1. **User Input** (in Gemini CLI):
   ```
   "Use AutomatosX backend agent to implement user auth"
   ```

2. **Gemini CLI Processing**:
   - Gemini CLI analyzes the request
   - Recognizes AutomatosX tool invocation
   - Constructs MCP tool call: `run_agent`

3. **MCP Protocol** (stdio JSON-RPC):
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "run_agent",
       "arguments": {
         "agent": "backend",
         "task": "implement user authentication"
       }
     }
   }
   ```

4. **AutomatosX Execution**:
   - MCP server receives request
   - Validates input against schema
   - Executes agent via AgentRunner
   - Collects result and metadata

5. **MCP Response**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "content": [{
         "type": "text",
         "text": "{\"result\": \"Successfully implemented...\", \"metadata\": {...}}"
       }]
     }
   }
   ```

6. **Gemini CLI Display**:
   - Parses MCP response
   - Displays result to user
   - Continues conversation with full context

---

## Configuration

### Manual MCP Configuration

If you need to manually configure or troubleshoot:

**File**: `.gemini/mcp-servers.json`

```json
{
  "automatosx": {
    "command": "node",
    "args": [
      "/usr/local/lib/node_modules/@defai.digital/automatosx/dist/mcp/index.js"
    ],
    "description": "AutomatosX AI agent orchestration platform with persistent memory and multi-agent collaboration",
    "env": {
      "AUTOMATOSX_CONFIG_PATH": "/path/to/project/ax.config.json",
      "AUTOMATOSX_LOG_LEVEL": "warn"
    }
  }
}
```

**Environment Variables**:
- `AUTOMATOSX_CONFIG_PATH` - Path to project's `ax.config.json`
- `AUTOMATOSX_LOG_LEVEL` - Log verbosity (`debug`, `info`, `warn`, `error`)

### Global vs Local Installation

**Global Installation** (recommended):
```bash
npm install -g @defai.digital/automatosx
```

MCP server path: `/usr/local/lib/node_modules/@defai.digital/automatosx/dist/mcp/index.js`

**Local Installation**:
```bash
npm install @defai.digital/automatosx
```

MCP server path: `./node_modules/@defai.digital/automatosx/dist/mcp/index.js`

**Auto-detection**: `ax setup` automatically detects installation type and configures the correct path.

---

## Troubleshooting

### MCP Server Not Found

**Symptom**: Gemini CLI reports "AutomatosX server not found"

**Solution**:
1. Verify AutomatosX is installed:
   ```bash
   npm list -g @defai.digital/automatosx
   ```

2. Check MCP configuration:
   ```bash
   cat .gemini/mcp-servers.json
   ```

3. Verify MCP server path exists:
   ```bash
   ls -la /usr/local/lib/node_modules/@defai.digital/automatosx/dist/mcp/index.js
   ```

4. Reinstall if missing:
   ```bash
   npm uninstall -g @defai.digital/automatosx
   npm install -g @defai.digital/automatosx
   ax setup
   ```

### MCP Server Fails to Start

**Symptom**: Gemini CLI reports "Failed to start AutomatosX server"

**Solution**:
1. Check Node.js version (requires 24+):
   ```bash
   node --version  # Should be v24.0.0 or higher
   ```

2. Test MCP server manually:
   ```bash
   node /path/to/automatosx/dist/mcp/index.js --debug
   ```

3. Check logs:
   ```bash
   tail -f .automatosx/logs/mcp-server-*.log
   ```

4. Verify AutomatosX setup:
   ```bash
   ax doctor
   ```

### Tool Invocation Errors

**Symptom**: "Invalid parameters" or "Tool not found"

**Solution**:
1. Verify tool name is correct:
   ```bash
   # Check available tools
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
     node /path/to/mcp/index.js
   ```

2. Validate input schema matches documentation

3. Enable debug logging:
   ```bash
   # In .gemini/mcp-servers.json, set:
   "env": {
     "AUTOMATOSX_LOG_LEVEL": "debug"
   }
   ```

### Performance Issues

**Symptom**: MCP tool calls are slow (> 1 second)

**Solution**:
1. Check if providers are healthy:
   ```bash
   ax doctor
   ```

2. Optimize memory database:
   ```bash
   ax memory stats
   # If database > 50MB, consider cleanup
   ax memory clear --before "2025-01-01"
   ```

3. Reduce agent timeout if needed:
   ```json
   // In ax.config.json
   {
     "execution": {
       "defaultTimeout": 60000  // 1 minute instead of 25 minutes
     }
   }
   ```

---

## Best Practices

### 1. Use Natural Language in Gemini CLI

**Good** (recommended):
```
"Use AutomatosX backend agent to implement user authentication"
"Search AutomatosX memory for authentication patterns"
"Create a session with product and backend agents for this feature"
```

**Also Works** (but verbose):
```
"Invoke the run_agent MCP tool with agent=backend and task=implement auth"
```

### 2. Leverage Memory for Context

AutomatosX automatically saves all agent interactions to memory. Gemini CLI can search this memory:

```
"Search AutomatosX memory for similar authentication implementations"
→ Finds past agent work on auth
→ Reuses patterns and decisions
→ Faster, more consistent results
```

### 3. Multi-Agent Sessions for Complex Tasks

For complex features, create sessions:

```
"Create an AutomatosX session for user authentication feature"
→ Session created

"Add backend agent to work on API implementation"
→ Backend agent executes with session context

"Add security agent to audit the implementation"
→ Security agent sees backend's work, performs audit

"Complete the session"
→ Session marked complete, all work saved to memory
```

### 4. Monitor System Status

Periodically check AutomatosX health:

```
"Get AutomatosX system status"
→ Shows providers, memory, sessions
→ Helps diagnose issues
→ Confirms everything is working
```

---

## Examples

### Example 1: Simple Agent Execution

```
User (in Gemini CLI):
"Use AutomatosX backend agent to create a REST API for user management"

Gemini CLI:
  → Analyzes request
  → Invokes MCP tool: run_agent
  → Arguments: { agent: "backend", task: "create REST API for user management" }

AutomatosX:
  → Executes backend agent
  → Routes to optimal provider (Gemini CLI in this case)
  → Generates API code
  → Saves to memory
  → Returns result

Gemini CLI:
  → Receives MCP response
  → Displays: "Successfully created REST API with the following endpoints..."
  → User can continue conversation with full context
```

### Example 2: Memory Search + Execution

```
User:
"Search AutomatosX memory for authentication patterns, then implement JWT auth"

Gemini CLI:
  → Step 1: Invokes search_memory
  → Arguments: { query: "authentication patterns", limit: 5 }
  → Retrieves past auth implementations

  → Step 2: Invokes run_agent
  → Arguments: { agent: "backend", task: "implement JWT authentication" }
  → Includes memory search results in context

AutomatosX:
  → Memory search finds relevant patterns
  → Backend agent uses these patterns
  → Implements JWT auth consistently
  → Saves new implementation to memory

Gemini CLI:
  → Displays results
  → Shows: "Found 3 similar auth implementations in memory..."
  → Shows: "Implemented JWT auth following established patterns..."
```

### Example 3: Multi-Agent Workflow

```
User:
"Create a session for user auth feature, then work with product and backend agents"

Gemini CLI:
  → Step 1: session_create
  → Arguments: { name: "User Auth Feature", agent: "product" }
  → Session created

  → Step 2: run_agent
  → Arguments: { agent: "product", task: "design user auth system" }
  → Product agent designs system, saves to session

  → Step 3: run_agent
  → Arguments: { agent: "backend", task: "implement the auth design" }
  → Backend agent sees product's design from session
  → Implements based on design

  → Step 4: session_status
  → Arguments: { id: "<session-id>" }
  → Shows all work done in session

  → Step 5: session_complete
  → Arguments: { id: "<session-id>" }
  → Marks session complete
```

---

## Comparison: MCP vs CLI Wrapper

### Before MCP (v10.0.0 and earlier)

```typescript
// AutomatosX spawned Gemini CLI as subprocess
import { spawn } from 'child_process';

const gemini = spawn('gemini', [task]);
gemini.stdout.on('data', (data) => {
  // Parse output (fragile, version-dependent)
  const result = parseGeminiOutput(data.toString());
});
```

**Issues**:
- Subprocess overhead (~10-50ms)
- Output parsing fragility
- No bidirectional communication
- Limited control over behavior

### After MCP (v10.2.0+)

```
Gemini CLI → MCP Protocol → AutomatosX MCP Server → AutomatosX Core
```

**Benefits**:
- ✅ Direct invocation (< 5ms overhead)
- ✅ Structured data (JSON schema validation)
- ✅ Bidirectional communication
- ✅ Rich tool access (15+ MCP tools)
- ✅ Version-independent (protocol-based)

---

## Version Compatibility

**AutomatosX**: v10.2.0+
**Gemini CLI**: v0.16.0+ (MCP support experimental)
**MCP Protocol**: `2024-11-05`

**Backwards Compatibility**:
- If Gemini CLI doesn't support MCP, AutomatosX falls back to CLI wrapper
- No breaking changes
- All existing workflows continue to work

---

## FAQ

### Q: Do I need to learn MCP protocol?

**A**: No! Just talk naturally to Gemini CLI. It handles MCP automatically:

```
"Use AutomatosX to implement auth"  ← Natural language
```

### Q: Can I use both MCP and CLI wrapper?

**A**: Yes! AutomatosX supports both:
- Gemini CLI uses MCP (when available)
- Direct `ax` commands use providers directly
- No conflicts

### Q: What if Gemini CLI doesn't support MCP yet?

**A**: AutomatosX detects this and falls back to CLI wrapper automatically. Your workflows don't change.

### Q: How do I disable MCP integration?

**A**: Remove AutomatosX from `.gemini/mcp-servers.json`:

```bash
# Edit .gemini/mcp-servers.json
# Remove "automatosx" entry
```

### Q: Can other AI tools use AutomatosX MCP server?

**A**: Yes! Any MCP-compliant client can use it:
- Claude Code (already supported)
- Gemini CLI (v10.2.0+)
- Future MCP clients

---

## Support

**Documentation**: [AutomatosX Docs](https://github.com/defai.digital/automatosx/docs)
**Issues**: [GitHub Issues](https://github.com/defai.digital/automatosx/issues)
**NPM**: [@defai.digital/automatosx](https://www.npmjs.com/package/@defai.digital/automatosx)

---

**Last Updated**: 2025-11-23
**Version**: v10.2.0
