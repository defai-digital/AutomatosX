# Configuration Guide

Complete guide to configuring AutomatosX for your workflow.

**Last Updated**: 2025-10-31
**Version**: 6.3.8

---

## Overview

AutomatosX configuration is stored in `ax.config.json` at your project root. This guide covers all configuration options, provider setup, and common scenarios.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration File Structure](#configuration-file-structure)
- [Provider Configuration](#provider-configuration)
- [Memory Configuration](#memory-configuration)
- [Logging Configuration](#logging-configuration)
- [Team Configuration](#team-configuration)
- [Agent Configuration](#agent-configuration)
- [Environment Variables](#environment-variables)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### View Current Configuration

```bash
# View all configuration
ax config show

# Get specific value
ax config get providers.claude-code.priority

# List all providers
ax providers list
```

### Basic Configuration File

The minimal `ax.config.json`:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1,
      "timeout": 1500000,
      "command": "claude"
    }
  },
  "memory": {
    "maxEntries": 10000,
    "persistPath": ".automatosx/memory"
  },
  "logging": {
    "level": "info",
    "console": true
  }
}
```

---

## Configuration File Structure

### Complete Configuration Example

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1,
      "timeout": 1500000,
      "command": "claude",
      "parameters": {
        "temperature": 0.7,
        "maxTokens": 4000
      }
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2,
      "timeout": 1500000,
      "command": "gemini",
      "gemini": {
        "approvalMode": "auto_edit",
        "embeddingModel": "text-embedding-004"
      }
    },
    "openai": {
      "enabled": false,
      "priority": 3,
      "timeout": 1500000,
      "command": "codex"
    }
  },
  "memory": {
    "maxEntries": 10000,
    "persistPath": ".automatosx/memory",
    "autoCleanup": true,
    "cleanupDays": 30,
    "searchLimit": 10
  },
  "logging": {
    "level": "info",
    "path": ".automatosx/logs",
    "console": true,
    "maxFiles": 10,
    "maxSize": "10M"
  },
  "router": {
    "healthCheckEnabled": true,
    "healthCheckInterval": 60000,
    "fallbackEnabled": true
  },
  "orchestration": {
    "maxConcurrentAgents": 3,
    "delegationTimeout": 300000
  }
}
```

---

## Provider Configuration

### Provider Priority

Providers are tried in priority order (1 = highest):

```json
{
  "providers": {
    "gemini-cli": { "priority": 1 },    // Tried first (free tier!)
    "claude-code": { "priority": 2 },   // Fallback if Gemini unavailable
    "openai": { "priority": 3 }         // Last resort
  }
}
```

### Provider Setup

AutomatosX calls provider CLI tools directly - **no API keys stored in AutomatosX**.

#### Claude Code CLI

```bash
# Install
npm install -g @anthropic-ai/claude-code
# Or: curl -fsSL https://claude.ai/install.sh | bash
# Or: brew install --cask claude-code

# Authenticate
claude login

# Verify
claude --version
```

**Configuration**:
```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1,
      "timeout": 1500000,
      "command": "claude",
      "parameters": {
        "temperature": 0.7,
        "maxTokens": 4000
      }
    }
  }
}
```

#### Gemini CLI

```bash
# Install
curl -fsSL https://gemini.google.com/install.sh | sh
# Or: brew install gemini-cli
# Or: npm install -g @google/gemini-cli

# Authenticate
gemini login

# Verify
gemini --version
```

**Configuration**:
```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,
      "timeout": 2700000,
      "command": "gemini",
      "gemini": {
        "approvalMode": "auto_edit",
        "embeddingModel": "text-embedding-004"
      },
      "parameters": {
        "temperature": 0.7
      }
    }
  }
}
```

**Approval Modes**:
- `auto_edit` - Automatically approve file edits (recommended)
- `manual` - Require manual approval for each edit
- `none` - No approval required (use with caution)

See [Gemini Integration Guide](./gemini-integration.md) for cost optimization tips.

#### OpenAI Codex CLI

```bash
# Install
npm install -g @openai/codex
# Or: brew install codex

# Authenticate
codex auth login

# Verify
codex --version
```

**Configuration**:
```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 3,
      "timeout": 1500000,
      "command": "codex",
      "parameters": {
        "temperature": 0.7,
        "maxTokens": 4000,
        "model": "gpt-4"
      }
    }
  }
}
```

### Provider Parameters

Common parameters across providers:

```json
{
  "parameters": {
    "temperature": 0.7,      // Creativity (0.0-1.0)
    "maxTokens": 4000,       // Max response length
    "topP": 0.9,             // Nucleus sampling
    "frequencyPenalty": 0.0, // Repetition penalty
    "presencePenalty": 0.0   // Topic diversity
  }
}
```

**Recommended Values**:
- **Code Generation**: `temperature: 0.3-0.5` (more deterministic)
- **Creative Writing**: `temperature: 0.7-0.9` (more creative)
- **Documentation**: `temperature: 0.5-0.7` (balanced)

---

## Memory Configuration

### Memory Settings

```json
{
  "memory": {
    "maxEntries": 10000,              // Max memories to store
    "persistPath": ".automatosx/memory", // Storage location
    "autoCleanup": true,              // Auto-delete old memories
    "cleanupDays": 30,                // Keep memories for 30 days
    "searchLimit": 10,                // Max search results
    "embeddingModel": "default"       // Embedding model to use
  }
}
```

### Memory Management Commands

```bash
# List memories
ax memory list --limit 20

# Search memories
ax memory search "authentication"

# Clear old memories
ax memory clear --before "2024-01-01"

# Export backup
ax memory export > backup.json

# Import memories
ax memory import backup.json

# View statistics
ax cache stats
```

See [Memory Management Tutorial](../tutorials/memory-management.md) for detailed usage.

---

## Logging Configuration

### Log Levels

```json
{
  "logging": {
    "level": "info",              // debug | info | warn | error
    "path": ".automatosx/logs",   // Log directory
    "console": true,              // Print to console
    "maxFiles": 10,               // Max log files to keep
    "maxSize": "10M"              // Max size per log file
  }
}
```

**Log Levels**:
- `debug` - Verbose output (for troubleshooting)
- `info` - Normal output (default)
- `warn` - Warnings only
- `error` - Errors only

### Debug Mode

Enable debug logging temporarily:

```bash
# Run with debug logging
ax --debug run backend "task"

# Or set environment variable
export AUTOMATOSX_LOG_LEVEL=debug
ax run backend "task"
```

---

## Team Configuration

### Team-Based Organization

Organize agents into teams with shared configuration:

```json
{
  "teams": {
    "engineering": {
      "provider": "claude-code",
      "agents": ["backend", "frontend", "devops"],
      "parameters": {
        "temperature": 0.5
      }
    },
    "leadership": {
      "provider": "openai",
      "agents": ["cto", "ceo"],
      "parameters": {
        "temperature": 0.7,
        "maxTokens": 6000
      }
    }
  }
}
```

See [Team Configuration Guide](./team-configuration.md) for details.

---

## Agent Configuration

### Agent Profiles

Agent profiles are stored in `.automatosx/agents/` as YAML files.

**Example** (`.automatosx/agents/backend.yaml`):

```yaml
name: backend
displayName: Bob
role: Backend Developer
team: engineering
description: Expert in Go, Rust, Python, APIs, and databases

systemPrompt: |
  You are Bob, a senior backend engineer with expertise in:
  - Go, Rust, Python
  - REST APIs and GraphQL
  - PostgreSQL, MongoDB, Redis
  - Microservices architecture

  Focus on: Performance, scalability, clean code

abilities:
  - database-design
  - api-design
  - performance-optimization

parameters:
  temperature: 0.5
  maxTokens: 4000

provider: claude-code
```

### Create Custom Agents

```bash
# Interactive creation
ax agent create my-agent --template developer --interactive

# Quick creation
ax agent create my-agent \
  --template developer \
  --display-name "Mike" \
  --role "Backend Engineer" \
  --team engineering
```

See [Agent Templates Guide](./agent-templates.md) for details.

---

## Environment Variables

### Supported Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTOMATOSX_LOG_LEVEL` | Logging level | `info` |
| `AUTOMATOSX_CONFIG` | Config file path | `ax.config.json` |
| `AX_MOCK_PROVIDERS` | Use mock providers | `false` |
| `AUTOMATOSX_DISABLE_CACHE` | Disable caching | `false` |
| `AUTOMATOSX_MEMORY_PATH` | Memory storage path | `.automatosx/memory` |
| `AUTOMATOSX_NO_COLOR` | Disable colored output | `false` |
| `AUTOMATOSX_TIMEOUT` | Global timeout (ms) | `1500000` |

### Usage Examples

**Windows (Command Prompt)**:
```batch
set AUTOMATOSX_LOG_LEVEL=debug
ax run backend "task"
```

**Windows (PowerShell)**:
```powershell
$env:AUTOMATOSX_LOG_LEVEL="debug"
ax run backend "task"
```

**macOS/Linux**:
```bash
export AUTOMATOSX_LOG_LEVEL=debug
ax run backend "task"

# Or one-liner
AUTOMATOSX_LOG_LEVEL=debug ax run backend "task"
```

---

## Common Scenarios

### Scenario 1: Cost Optimization (Use Free Tier)

Prioritize Gemini CLI for maximum cost savings:

```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,
      "timeout": 2700000,
      "command": "gemini"
    },
    "claude-code": {
      "enabled": true,
      "priority": 2
    }
  }
}
```

Gemini offers 1,500 requests/day free (99.6% cost savings vs OpenAI).

### Scenario 2: High-Quality Responses (Use Claude)

Prioritize Claude Code for best quality:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1,
      "parameters": {
        "temperature": 0.7,
        "maxTokens": 6000
      }
    }
  }
}
```

### Scenario 3: Multi-Provider Fallback

Automatic fallback if primary provider fails:

```json
{
  "providers": {
    "claude-code": { "enabled": true, "priority": 1 },
    "gemini-cli": { "enabled": true, "priority": 2 },
    "openai": { "enabled": true, "priority": 3 }
  },
  "router": {
    "healthCheckEnabled": true,
    "fallbackEnabled": true
  }
}
```

### Scenario 4: Team-Specific Providers

Different providers for different teams:

```json
{
  "teams": {
    "engineering": {
      "provider": "claude-code",
      "agents": ["backend", "frontend", "devops"]
    },
    "creative": {
      "provider": "openai",
      "agents": ["writer", "designer"]
    },
    "cost-conscious": {
      "provider": "gemini-cli",
      "agents": ["analyst", "researcher"]
    }
  }
}
```

### Scenario 5: Development vs Production

Different configs for different environments:

```bash
# Development (verbose logging, mock providers)
export AUTOMATOSX_CONFIG=automatosx.dev.json
export AUTOMATOSX_LOG_LEVEL=debug
export AX_MOCK_PROVIDERS=true

# Production (minimal logging, real providers)
export AUTOMATOSX_CONFIG=automatosx.prod.json
export AUTOMATOSX_LOG_LEVEL=warn
```

---

## Troubleshooting

### "Provider not available"

**Check provider installation**:
```bash
ax providers list
ax providers test --provider claude-code
```

**Verify CLI is installed**:
```bash
claude --version
gemini --version
codex --version
```

**Check configuration**:
```bash
ax config get providers.claude-code.enabled
ax config get providers.claude-code.command
```

### "Configuration file not found"

```bash
# Check current directory
pwd

# Initialize if needed
ax setup

# Specify custom config
ax --config /path/to/config.json run backend "task"
```

### "Invalid configuration"

```bash
# Validate configuration
ax config validate

# View current config
ax config show

# Reset to defaults
ax setup --force
```

### Provider Priority Not Working

Ensure priority values are **unique integers**:

```json
{
  "providers": {
    "gemini-cli": { "priority": 1 },    // ✅ Unique
    "claude-code": { "priority": 2 },   // ✅ Unique
    "openai": { "priority": 2 }         // ❌ Duplicate (will cause issues)
  }
}
```

---

## Advanced Configuration

### Custom Workspace Paths

```json
{
  "workspace": {
    "agents": ".automatosx/agents",
    "abilities": ".automatosx/abilities",
    "memory": ".automatosx/memory",
    "logs": ".automatosx/logs",
    "sessions": ".automatosx/sessions"
  }
}
```

### Performance Tuning

```json
{
  "performance": {
    "cacheEnabled": true,
    "cacheTTL": 3600000,
    "maxConcurrentRequests": 5,
    "requestTimeout": 1500000
  }
}
```

### Router Configuration

```json
{
  "router": {
    "healthCheckEnabled": true,
    "healthCheckInterval": 60000,
    "fallbackEnabled": true,
    "retryAttempts": 3,
    "retryDelay": 1000
  }
}
```

---

## See Also

- [Quick Start Guide](./quick-start.md) - Get up and running
- [Provider Comparison](./provider-comparison.md) - Compare Claude, Gemini, OpenAI
- [Gemini Integration](./gemini-integration.md) - Cost optimization with Gemini
- [Team Configuration](./team-configuration.md) - Organize agents into teams
- [CLI Commands Reference](../reference/cli-commands.md) - Complete command list
- [Troubleshooting](../troubleshooting/common-issues.md) - Common issues and solutions

---

**Need Help?**

- **Documentation**: [docs/](https://github.com/defai-digital/automatosx/tree/main/docs)
- **Issues**: [github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)
- **Examples**: Check `.automatosx/` after running `ax setup`
