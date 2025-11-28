# AutomatosX Integration with ax-cli

This guide explains how to connect AutomatosX to [ax-cli](https://github.com/defai-digital/ax-cli) so users can access AutomatosX agent orchestration features through the ax-cli interface.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          ax-cli v3.8+                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MCP Client                                               │   │
│  │  - Connects to AutomatosX MCP server via stdio            │   │
│  │  - Auto-detects .automatosx/config.json                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              │ stdio transport                   │
│                              ▼                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                  AutomatosX MCP Server (ax-mcp)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tools Available:                                         │   │
│  │  - ax_run: Execute tasks with agents                      │   │
│  │  - ax_list_agents: List available agents                  │   │
│  │  - ax_agent_info: Get agent details                       │   │
│  │  - ax_memory_search: Search persistent memory             │   │
│  │  - ax_memory_save: Save to memory                         │   │
│  │  - ax_memory_stats: Memory statistics                     │   │
│  │  - ax_session_create: Create new session                  │   │
│  │  - ax_session_list: List sessions                         │   │
│  │  - ax_session_info: Get session details                   │   │
│  │  - ax_status: System status                               │   │
│  │  - ax_provider_status: Provider health                    │   │
│  │  - ax_config: Configuration info                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Setup

### Option 1: Auto-Detection (Recommended)

ax-cli automatically detects AutomatosX configurations. Simply ensure you have a valid `.automatosx/config.json`:

```bash
# In your project directory with .automatosx/
ax status  # ax-cli will auto-detect and connect to AutomatosX
```

### Option 2: Manual Configuration

Add AutomatosX to your ax-cli settings:

```bash
# Create or edit ~/.ax-cli/settings.json
```

```json
{
  "mcpServers": {
    "automatosx": {
      "command": "npx",
      "args": ["@ax/mcp"],
      "env": {
        "AUTOMATOSX_BASE_PATH": "/path/to/your/project/.automatosx"
      }
    }
  }
}
```

### Option 3: Global Installation

```bash
# Install AutomatosX MCP server globally
npm install -g @ax/mcp

# Add to ax-cli settings
ax config set mcpServers.automatosx.command "ax-mcp"
```

## Configuration File

The `.automatosx/config.json` file is auto-detected by ax-cli:

```json
{
  "version": "11.0.0",
  "mcpServers": {
    "automatosx": {
      "command": "node",
      "args": ["./node_modules/@ax/mcp/dist/server.js"],
      "env": {
        "AUTOMATOSX_BASE_PATH": "${workspaceFolder}/.automatosx"
      },
      "timeout": 300000
    }
  },
  "defaults": {
    "provider": "claude",
    "timeout": 300000
  },
  "memory": {
    "enabled": true,
    "maxEntries": 10000
  }
}
```

## Using AutomatosX Tools via ax-cli

Once connected, you can use AutomatosX tools through ax-cli:

### Execute Agent Tasks

```bash
# Run a task with a specific agent
ax run backend "Create a REST API for user authentication"

# Run with automatic agent selection
ax run auto "Design the database schema"
```

### Memory Operations

```bash
# Search memory
ax memory search "authentication implementation"

# View memory stats
ax memory stats
```

### Session Management

```bash
# Create a new session
ax session create --name "Feature Development"

# List sessions
ax session list

# View session details
ax session info <session-id>
```

### System Status

```bash
# Check system status
ax status

# Check provider health
ax provider status
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTOMATOSX_BASE_PATH` | Path to .automatosx directory | `${cwd}/.automatosx` |
| `NODE_ENV` | Environment mode | `development` |

## Troubleshooting

### ax-cli doesn't detect AutomatosX

1. Ensure `.automatosx/config.json` exists and is valid JSON
2. Check that the MCP server path is correct
3. Run `ax doctor` to diagnose issues

### Connection timeout

Increase the timeout in your configuration:

```json
{
  "mcpServers": {
    "automatosx": {
      "timeout": 600000
    }
  }
}
```

### Memory issues

Check memory database path and permissions:

```bash
ls -la .automatosx/memory/
```

## Compatibility

| ax-cli Version | AutomatosX Version | MCP SDK |
|----------------|-------------------|---------|
| 3.8.35+ | 11.0.0+ | 1.22.0 |

## Related Documentation

- [ax-cli Documentation](https://github.com/defai-digital/ax-cli)
- [AutomatosX Agents Guide](./agents.md)
- [Memory System](./memory.md)
- [MCP Protocol](https://modelcontextprotocol.io/)
