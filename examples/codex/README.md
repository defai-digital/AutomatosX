# OpenAI Codex Integration for AutomatosX

This directory contains integration files and examples for using OpenAI Codex CLI as a provider with AutomatosX.

## Overview

**OpenAI Codex** is configured as an AI provider in AutomatosX. Unlike Claude Code and Gemini CLI which have native CLI integrations with custom slash commands, Codex operates as a background provider powering AutomatosX agents.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User                                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ AutomatosX CLI (ax commands)                            │
│  - ax run backend "task"                                │
│  - ax list agents                                       │
│  - ax memory search                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ AutomatosX Orchestration Layer                          │
│  - Agent management                                     │
│  - Memory system                                        │
│  - Provider routing                                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Codex CLI (Provider - Priority 1)                       │
│  Command: codex exec <prompt>                           │
│  Features: Streaming, MCP, Sandbox modes                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ OpenAI API                                              │
└─────────────────────────────────────────────────────────┘
```

## Files in This Directory

### Integration Documentation

- **`CODEX_INTEGRATION.md`** - Comprehensive integration guide
  - Quick start instructions
  - Provider configuration
  - Available agents
  - Advanced usage (MCP, streaming, parallel execution)
  - Troubleshooting
  - Best practices

### Code Examples

- **`usage-examples.ts`** - TypeScript code examples
  - Basic CLI execution
  - Streaming execution
  - MCP server management
  - Full integration with CodexBridge
  - Error handling patterns
  - Default instances
  - Advanced configuration

## Quick Setup

### 1. Install Codex CLI

```bash
npm install -g @openai/codex-cli
```

### 2. Verify Installation

```bash
codex --version  # Should show: codex-cli 0.50.0+
```

### 3. Initialize Project

```bash
# AutomatosX automatically initializes git (required by Codex)
ax init

# This creates:
# - .automatosx/ directory with agents, memory, logs
# - automatosx.config.json with Codex configured
# - automatosx/PRD/ and automatosx/tmp/ workspace directories
# - .gitignore with proper exclusions
# - Git repository (if not already initialized)
```

### 4. Authenticate (if needed)

```bash
codex login
```

### 5. Test Integration

```bash
# Run a simple task
ax run backend "explain TypeScript generics in 2 sentences"

# Check provider status
ax status

# View provider limits
ax provider-limits
```

## Usage Patterns

### Primary Usage: Terminal CLI

```bash
# Run an agent with a task
ax run <agent-name> "task description"

# Examples
ax run backend "create a REST API for user management"
ax run security "audit this authentication code"
ax run quality "write unit tests for this function"
```

### Provider Auto-Switching

AutomatosX automatically switches providers when limits are hit:

```bash
$ ax run backend "implement feature X"
⚠️  Switched from openai → gemini-cli
   (OpenAI daily quota hit, resets at 2025-10-29 00:00 UTC)

✓ Task completed successfully with gemini-cli
```

### Direct Codex CLI Usage (Optional)

While not the primary interface, you can also use Codex CLI directly:

```bash
# Interactive mode
codex

# Non-interactive execution
codex exec "Write a Python function to sort a list"

# MCP server mode
codex mcp-server
```

## Configuration

### Provider Settings

Edit `automatosx.config.json`:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,        // 1 = highest priority
      "timeout": 2700000,   // 45 minutes
      "command": "codex",
      "mcp": {
        "enabled": false,   // Enable for MCP server mode
        "command": "codex",
        "transport": "stdio",
        "autoStart": false
      },
      "healthCheck": {
        "enabled": true,
        "interval": 300000  // 5 minutes
      },
      "limitTracking": {
        "enabled": true,
        "window": "daily"
      }
    }
  }
}
```

### Provider Priority

Configure fallback order (lower number = higher priority):

```json
{
  "providers": {
    "openai": { "priority": 1 },      // First choice
    "gemini-cli": { "priority": 2 },  // Second choice
    "claude-code": { "priority": 3 }  // Third choice
  }
}
```

## Code Examples

### Example 1: Basic Execution

```typescript
import { CodexCLI } from '@automatosx/integrations/openai-codex';

const cli = new CodexCLI({
  command: 'codex',
  sandboxMode: 'workspace-write',
  timeout: 60000
});

const result = await cli.execute({
  prompt: 'Explain TypeScript benefits',
  temperature: 0.7,
  maxTokens: 200
});

console.log(result.content);
await cli.cleanup();
```

### Example 2: MCP Server

```typescript
import { CodexMCPManager } from '@automatosx/integrations/openai-codex';

const mcpManager = new CodexMCPManager({
  enabled: true,
  command: 'codex',
  transport: 'stdio'
});

await mcpManager.startServer();
const status = await mcpManager.getStatus();
console.log('MCP Server running:', status.running);
await mcpManager.stopServer();
```

### Example 3: Full Integration

```typescript
import { CodexBridge } from '@automatosx/integrations/openai-codex';

const bridge = new CodexBridge(
  { command: 'codex', sandboxMode: 'workspace-write' },
  { enabled: true, autoStart: false }
);

await bridge.initialize();
const result = await bridge.execute({
  prompt: 'List SOLID principles',
  maxTokens: 300
});

console.log(result.content);
await bridge.cleanup();
```

See `usage-examples.ts` for complete, runnable examples.

## Troubleshooting

### Common Issues

**Issue**: "Codex CLI not found"
```bash
# Solution: Install Codex CLI
npm install -g @openai/codex-cli
codex --version
```

**Issue**: "Git repository required"
```bash
# Solution: Initialize git (or run ax init)
git init
```

**Issue**: "Authentication failed"
```bash
# Solution: Login to Codex
codex login
```

**Issue**: "Provider not available"
```bash
# Solution: Check status and configuration
ax status
ax config show
ax provider-limits
```

## Comparison: CLI Integrations vs Providers

### CLI Integrations (Claude Code, Gemini CLI)

- **Interface**: Native CLI with conversational interface
- **Custom Commands**: Slash commands (e.g., `/ax-agent`, `/ax`)
- **Usage**: Invoke AutomatosX agents FROM their CLI
- **Example**: `/ax-agent backend, create API` inside Claude Code IDE

### Providers (OpenAI Codex)

- **Interface**: Background AI engine
- **Custom Commands**: Not applicable (used as provider, not CLI)
- **Usage**: Powered BY Codex, accessed via `ax` terminal commands
- **Example**: `ax run backend "create API"` → uses Codex internally

## Best Practices

1. **Use `ax` commands as primary interface**
   - `ax run <agent> "task"`
   - Not direct `codex` commands

2. **Configure multiple providers for resilience**
   - Codex (priority 1)
   - Gemini (priority 2)
   - Claude (priority 3)

3. **Monitor provider limits**
   - `ax provider-limits`
   - Auto-switch prevents disruption

4. **Leverage persistent memory**
   - Agents remember past conversations
   - `ax memory search "keyword"`

5. **Use specialized agents**
   - Backend, frontend, security, quality, etc.
   - Each optimized for specific tasks

6. **Enable git repository**
   - Codex requires git
   - `ax init` handles this automatically

## Documentation Links

- **Integration Guide**: `CODEX_INTEGRATION.md`
- **Code Examples**: `usage-examples.ts`
- **AutomatosX Docs**: https://github.com/defai-digital/automatosx
- **Codex CLI Docs**: https://docs.openai.com/codex-cli

## Support

- **AutomatosX Issues**: https://github.com/defai-digital/automatosx/issues
- **Codex CLI Issues**: https://github.com/openai/codex-cli/issues
