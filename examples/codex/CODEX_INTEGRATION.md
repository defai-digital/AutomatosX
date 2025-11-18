# AutomatosX Integration with OpenAI Codex

**IMPORTANT**: For the complete AutomatosX integration guide, **please read [AutomatosX-Integration.md](../AutomatosX-Integration.md)**.

This file provides **Codex-specific** setup instructions and configuration details. For comprehensive AutomatosX documentation including all agents, commands, memory features, workflows, and troubleshooting, see [AutomatosX-Integration.md](../AutomatosX-Integration.md).

---

This project uses [AutomatosX](https://github.com/defai-digital/automatosx) with OpenAI Codex CLI as a provider for AI-powered agent orchestration.

## Overview

**OpenAI Codex** is configured as a **provider** in AutomatosX, meaning:
- AutomatosX uses Codex CLI to power AI agent responses
- You interact with AutomatosX using `ax` terminal commands
- Codex runs in the background as the AI engine
- Git repository is required (Codex CLI requirement)

**Architecture**:
```
User → ax CLI → AutomatosX → Codex CLI (provider) → OpenAI API
```

## Quick Start

### Prerequisites

```bash
# 1. Install Codex CLI
npm install -g @openai/codex-cli

# 2. Verify installation
codex --version  # Should show: codex-cli 0.50.0+

# 3. Authenticate (if needed)
codex login

# 4. Initialize git repository (required by Codex)
git init  # Already done by `ax setup`
```

### Using AutomatosX with Codex

**Primary Usage**: Terminal CLI (`ax` commands)

```bash
# Run an agent with a task
ax run backend "create a REST API for user management"

# List available agents
ax list agents

# Search memory for past conversations
ax memory search "authentication"

# Check system status
ax status

# Check provider status
ax provider-limits
```

**Provider Priority**: Codex is configured with priority 1 (highest) in `automatosx.config.json`

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,        // Highest priority
      "command": "codex",   // Uses Codex CLI
      "timeout": 2700000
    }
  }
}
```

## Provider Configuration

### Configuration File

Edit `automatosx.config.json` to customize Codex provider settings:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,
      "timeout": 2700000,
      "command": "codex",
      "mcp": {
        "enabled": false,
        "command": "codex",
        "transport": "stdio",
        "autoStart": false
      },
      "healthCheck": {
        "enabled": true,
        "interval": 300000,
        "timeout": 5000
      },
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,
        "recoveryTimeout": 60000
      },
      "limitTracking": {
        "enabled": true,
        "window": "daily",
        "resetHourUtc": 0
      }
    }
  }
}
```

### Provider Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| **Basic Execution** | ✅ | `codex exec` command |
| **Streaming Output** | ✅ | Real-time responses |
| **MCP Server Mode** | ✅ | Experimental, use `codex mcp-server` |
| **Sandbox Modes** | ✅ | `workspace-write`, `full`, `none` |
| **Git Integration** | ✅ Required | Codex requires git repository |
| **Health Checks** | ✅ | Automatic provider health monitoring |
| **Circuit Breaker** | ✅ | Auto-failover on repeated failures |
| **Limit Tracking** | ✅ | Daily quota tracking |

## Available Agents

This project includes 20 specialized agents that work with Codex:

- **backend** (Bob) - Backend development (Go/Rust systems)
- **frontend** (Frank) - Frontend development (React/Next.js/Swift)
- **architecture** (Avery) - System architecture and ADR management
- **fullstack** (Felix) - Full-stack development (Node.js/TypeScript)
- **mobile** (Maya) - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** (Oliver) - DevOps and infrastructure
- **security** (Steve) - Security auditing and threat modeling
- **data** (Daisy) - Data engineering and ETL
- **quality** (Queenie) - QA and testing
- **design** (Debbee) - UX/UI design
- **writer** (Wendy) - Technical writing
- **product** (Paris) - Product management
- **cto** (Tony) - Technical strategy
- **ceo** (Eric) - Business leadership
- **researcher** (Rodman) - Research and analysis
- **data-scientist** (Dana) - Machine learning and data science
- **aerospace-scientist** (Astrid) - Aerospace engineering and mission design
- **quantum-engineer** (Quinn) - Quantum computing and algorithms
- **creative-marketer** (Candy) - Creative marketing and content strategy
- **standard** (Stan) - Software standards and best practices

For a complete list with capabilities, run: `ax list agents --format json`

## Key Features

### 1. Persistent Memory

AutomatosX agents remember all previous conversations and decisions:

```bash
# First task - design is saved to memory
ax run product "Design a calculator with add/subtract features"

# Later task - automatically retrieves the design from memory
ax run backend "Implement the calculator API"
```

### 2. Multi-Agent Collaboration

Agents can delegate tasks to each other automatically:

```bash
ax run product "Build a complete user authentication feature"
# → Product agent designs the system
# → Automatically delegates implementation to backend agent
# → Automatically delegates security audit to security agent
```

### 3. Cross-Provider Support

AutomatosX supports multiple AI providers with automatic fallback:

```bash
$ ax run backend "implement authentication API"
⚠️  Switched from openai → gemini-cli
   (OpenAI daily quota hit, resets at 2025-10-29 00:00 UTC)

✓ Task completed successfully with gemini-cli
```

**Provider Priority** (configured in `automatosx.config.json`):
1. **OpenAI Codex** (priority: 1) - Primary
2. **Gemini CLI** (priority: 2) - First fallback
3. **Claude Code** (priority: 3) - Second fallback

Check provider status:
```bash
$ ax provider-limits
📊 Provider Limits Status

  ⚠️  openai:
     Status: limited
     Window: daily
     Resets: 2025-10-29 00:00:00 (6h)

  ✓ gemini-cli:
     Status: available
     Window: daily

  ✓ claude-code:
     Status: available
     Window: weekly
```

### 4. Workspace Conventions

AutomatosX uses specific directories for organized file management:

- **`automatosx/PRD/`** - Product Requirements Documents, design specs, planning documents
  - Use for: Architecture designs, feature specs, technical requirements
  - Example: `automatosx/PRD/auth-system-design.md`

- **`automatosx/tmp/`** - Temporary files, scratch work, and intermediate outputs
  - Use for: Draft code, test outputs, temporary analysis
  - Auto-cleaned periodically
  - Example: `automatosx/tmp/draft-api-endpoints.ts`

```bash
# Save architecture design
ax run product "Save the authentication architecture design to automatosx/PRD/auth-design.md"

# Create draft implementation
ax run backend "Put the draft API implementation in automatosx/tmp/auth-api-draft.ts for review"
```

These directories are automatically created by `ax setup` and included in `.gitignore` appropriately.

## Advanced Usage

### MCP Server Mode (Experimental)

Codex CLI can run as an MCP (Model Context Protocol) server:

```bash
# Start Codex as MCP server
codex mcp-server

# Or configure in automatosx.config.json
{
  "providers": {
    "openai": {
      "mcp": {
        "enabled": true,
        "command": "codex",
        "transport": "stdio",
        "autoStart": true
      }
    }
  }
}
```

See `examples/codex/usage-examples.ts` for MCP integration code examples.

### Parallel Execution (v5.6.0+)

Run multiple agents in parallel for faster workflows:

```bash
ax run product "Design authentication system" --parallel
```

### Resumable Runs (v5.3.0+)

For long-running tasks, enable checkpoints:

```bash
ax run backend "Refactor entire codebase" --resumable

# If interrupted, resume with:
ax resume <run-id>

# List all runs
ax runs list
```

### Streaming Output (v5.6.5+)

See real-time output from Codex:

```bash
ax run backend "Explain this codebase" --streaming
```

### Spec-Driven Development (v5.8.0+)

For complex projects, use spec-driven workflows:

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Or manually define in .specify/tasks.md
ax spec run --parallel

# Check progress
ax spec status
```

## Memory System

### Search Memory

```bash
# Search for past conversations
ax memory search "authentication"
ax memory search "API design"

# List recent memories
ax memory list --limit 10

# Export memory for backup
ax memory export > backup.json
```

### How Memory Works

- **Automatic**: All agent conversations are saved automatically
- **Fast**: SQLite FTS5 full-text search (< 1ms)
- **Local**: 100% private, data never leaves your machine
- **Cost**: $0 (no API calls for memory operations)

## Troubleshooting

### Common Issues

**"Codex CLI not found"**
```bash
# Install Codex CLI
npm install -g @openai/codex-cli

# Verify installation
codex --version

# Check AutomatosX provider status
ax status
```

**"Git repository required"**
```bash
# Codex CLI requires a git repository
git init

# Or run ax setup (automatically initializes git)
ax setup
```

**"Provider not available"**
```bash
# Check system status
ax status

# View configuration
ax config show

# Check provider limits
ax provider-limits
```

**"Out of memory"**
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory stats
ax cache stats
```

**"Authentication failed"**
```bash
# Login to Codex
codex login

# Verify authentication
codex exec "test prompt"
```

### Getting Help

```bash
# View command help
ax --help
ax run --help

# Enable debug mode
ax --debug run backend "task"

# Search memory for similar past tasks
ax memory search "similar task"

# Check Codex CLI help
codex --help
```

## Direct Codex CLI Usage

While AutomatosX is the recommended interface, you can also use Codex CLI directly:

### Interactive Mode

```bash
# Start interactive session
codex

# Or with initial prompt
codex "Explain TypeScript generics"
```

### Non-Interactive Mode

```bash
# Execute single command
codex exec "Write a Python function to sort a list"

# With options
codex exec --temperature 0.7 --max-tokens 500 "Generate haiku about code"
```

### Sandbox Mode

```bash
# Run in workspace-write sandbox
codex --sandbox workspace-write "Analyze this codebase"

# Full sandbox access
codex --sandbox full "Create file structure"
```

### MCP Commands

```bash
# Start MCP server
codex mcp-server

# Manage MCP servers
codex mcp list
codex mcp start <server-name>
codex mcp stop <server-name>
```

## Code Examples

See `examples/codex/usage-examples.ts` for comprehensive code examples:

1. **Basic CLI Execution** - Simple prompts and responses
2. **Streaming Execution** - Real-time output
3. **MCP Server Management** - Starting/stopping MCP server
4. **Full Integration** - CodexBridge usage
5. **Error Handling** - Retry patterns and type-specific handling
6. **Default Instances** - Using singleton instances
7. **Advanced Configuration** - Sandbox modes, custom configs

Run examples:
```bash
npm run example:codex
```

## Best Practices

1. **Use Terminal CLI**: Primary interface is `ax` commands, not direct Codex CLI
2. **Leverage Memory**: Reference past decisions and designs
3. **Start Simple**: Test with small tasks before complex workflows
4. **Review Configurations**: Check `automatosx.config.json` for timeouts and retries
5. **Keep Agents Specialized**: Use the right agent for each task type
6. **Monitor Provider Limits**: Use `ax provider-limits` to check quota
7. **Enable Fallbacks**: Configure backup providers (Gemini, Claude) for reliability

## Documentation

- **AutomatosX Docs**: https://github.com/defai-digital/automatosx
- **Codex CLI Docs**: https://docs.openai.com/codex-cli
- **Agent Directory**: `.automatosx/agents/`
- **Configuration**: `automatosx.config.json`
- **Memory Database**: `.automatosx/memory/memories.db`
- **Workspace**: `automatosx/PRD/` (planning docs) and `automatosx/tmp/` (temporary files)
- **Code Examples**: `examples/codex/usage-examples.ts`

## Support

- **AutomatosX Issues**: https://github.com/defai-digital/automatosx/issues
- **AutomatosX NPM**: https://www.npmjs.com/package/@defai.digital/automatosx
- **Codex CLI Issues**: https://github.com/openai/codex-cli/issues
