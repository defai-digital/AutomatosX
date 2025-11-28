# @ax/mcp

Model Context Protocol server for AutomatosX.

## Installation

```bash
pnpm add @ax/mcp
```

## Overview

This package provides an MCP server that exposes AutomatosX functionality
to MCP-compatible clients (Claude Code, Gemini CLI, etc.).

## MCP Tools

The server exposes 11 tools:

### Agent Tools

| Tool | Description |
|------|-------------|
| `ax_run` | Execute a task with an agent |
| `ax_list_agents` | List all available agents |
| `ax_agent_info` | Get detailed agent information |

### Memory Tools

| Tool | Description |
|------|-------------|
| `ax_memory_search` | Search persistent memory |
| `ax_memory_save` | Save entry to memory |
| `ax_memory_stats` | Get memory statistics |

### Session Tools

| Tool | Description |
|------|-------------|
| `ax_session_create` | Create a new session |
| `ax_session_list` | List all sessions |
| `ax_session_info` | Get session details |

### System Tools

| Tool | Description |
|------|-------------|
| `ax_status` | Get system status |
| `ax_provider_status` | Get provider health status |
| `ax_config` | Get configuration values |

## Usage

### Starting the Server

```bash
# Via CLI
ax mcp-server

# Programmatically
import { startMCPServer } from '@ax/mcp';
await startMCPServer();
```

### Client Configuration

#### Claude Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "automatosx": {
      "command": "node",
      "args": ["/path/to/automatosx/dist/mcp/index.js"]
    }
  }
}
```

#### Gemini CLI

Add to `~/.gemini/mcp-servers.json`:

```json
{
  "automatosx": {
    "command": "ax",
    "args": ["mcp-server"]
  }
}
```

## Tool Schemas

### ax_run

```typescript
{
  agent: string;      // Agent name (e.g., 'backend')
  task: string;       // Task description
  timeout?: number;   // Timeout in milliseconds
  stream?: boolean;   // Enable streaming
}
```

### ax_memory_search

```typescript
{
  query: string;      // Search query
  limit?: number;     // Max results (default: 10)
  agent?: string;     // Filter by agent
  type?: string;      // Filter by type
}
```

### ax_session_create

```typescript
{
  agent: string;      // Primary agent
  task: string;       // Initial task
  tags?: string[];    // Session tags
}
```

## License

Apache-2.0
