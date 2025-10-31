# OpenAI Codex CLI Integration

Complete guide for integrating OpenAI Codex CLI with AutomatosX.

## Overview

AutomatosX supports OpenAI's Codex CLI as a provider, enabling you to use OpenAI's powerful models (GPT-4o, o1-preview, etc.) for agent execution. The integration includes optional MCP (Model Context Protocol) server support for advanced use cases.

**Features**:
- ✅ Execute agents using OpenAI Codex CLI
- ✅ Native streaming support
- ✅ Sandbox mode for secure file access
- ✅ Optional MCP server for bidirectional communication
- ✅ Automatic process management and cleanup
- ✅ Cost estimation and usage tracking

---

## Installation

### 1. Install Codex CLI

**Via npm** (recommended):
```bash
npm install -g @openai/codex
```

**Via Homebrew** (macOS):
```bash
brew install --cask codex
```

### 2. Verify Installation

```bash
# Check version
codex --version

# Should output: codex-cli 0.50.0 (or later)
```

### 3. Configure OpenAI API Key

```bash
# Login to codex (opens browser for OAuth)
codex login

# Or set API key manually
export OPENAI_API_KEY="your-api-key-here"
```

---

## Configuration

### Basic Configuration

OpenAI Codex provider is pre-configured in `automatosx.config.json`:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,
      "timeout": 2700000,
      "command": "codex"
    }
  }
}
```

**Configuration Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable OpenAI provider |
| `priority` | number | `1` | Provider priority (lower = higher priority) |
| `timeout` | number | `2700000` | Execution timeout in milliseconds (45 min) |
| `command` | string | `"codex"` | CLI command to execute |

### Advanced Configuration

#### Enable MCP Server (Optional)

The MCP server enables bidirectional communication with Codex CLI:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,
      "command": "codex",
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

**MCP Configuration Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mcp.enabled` | boolean | `false` | Enable MCP server |
| `mcp.command` | string | `"codex"` | CLI command for MCP server |
| `mcp.transport` | string | `"stdio"` | Transport protocol (stdio only) |
| `mcp.autoStart` | boolean | `false` | Auto-start MCP on provider init |

#### Health Check Configuration

```json
{
  "providers": {
    "openai": {
      "healthCheck": {
        "enabled": true,
        "interval": 300000,
        "timeout": 5000
      }
    }
  }
}
```

#### Circuit Breaker Configuration

```json
{
  "providers": {
    "openai": {
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,
        "recoveryTimeout": 60000
      }
    }
  }
}
```

---

## Usage

### Basic Agent Execution

```bash
# Run an agent with OpenAI Codex
ax run backend "Create a REST API for user management"

# Force use of OpenAI provider
ax run backend "Implement authentication" --provider openai

# Use specific model
ax run backend "Write tests" --model gpt-4o
```

### Streaming Output

```bash
# Enable streaming for real-time output
ax run backend "Explain this codebase" --streaming
```

### With Memory

```bash
# Execute with memory (default)
ax run backend "Continue the API implementation"

# Disable memory
ax run backend "Quick task" --no-memory
```

### Session Management

```bash
# Create a multi-step session
ax session create "api-development"
ax session run "api-development" backend "Design API"
ax session run "api-development" backend "Implement API"
ax session run "api-development" quality "Write tests"
```

---

## MCP Server Usage

### Starting the MCP Server

**Automatic** (when `autoStart: true`):
```typescript
// MCP server starts automatically when provider initializes
const executor = new AgentExecutor(config);
await executor.execute(context);
```

**Manual**:
```typescript
import { getDefaultBridge } from './integrations/openai-codex';

const bridge = getDefaultBridge(
  { command: 'codex' },
  { enabled: true, command: 'codex', transport: 'stdio' }
);

// Initialize and start MCP server
await bridge.initialize();
await bridge.startMCPServer();

// Check server status
const status = await bridge.getStatus();
console.log(status.mcpServer);

// Stop server when done
await bridge.stopMCPServer();
await bridge.cleanup();
```

### MCP Server Status

```typescript
import { getDefaultBridge } from './integrations/openai-codex';

const bridge = getDefaultBridge();
const status = await bridge.getStatus();

console.log({
  cliAvailable: status.cliAvailable,
  version: status.version,
  mcpRunning: status.mcpServer?.running,
  mcpPid: status.mcpServer?.pid
});
```

---

## Sandbox Modes

Codex CLI supports different sandbox modes for file access:

### Workspace Write Mode (Default)

Allows writing to the workspace directory:

```typescript
import { CodexCLI } from './integrations/openai-codex';

const cli = new CodexCLI({
  command: 'codex',
  sandboxMode: 'workspace-write'
});

await cli.execute({
  prompt: 'Create a new file',
  sandboxMode: 'workspace-write'
});
```

### Full Access Mode

Full filesystem access (use with caution):

```typescript
await cli.execute({
  prompt: 'Read system files',
  sandboxMode: 'full'
});
```

### No Sandbox Mode

No file access:

```typescript
await cli.execute({
  prompt: 'Analyze code',
  sandboxMode: 'none'
});
```

---

## Cost Management

### Track Usage

```bash
# View provider limits and usage
ax provider-limits

# Example output:
# Provider: openai
# Usage: 15,234 tokens
# Cost: $0.45
# Reset: 2025-10-30 00:00:00 UTC
```

### Configure Limits

```json
{
  "providers": {
    "openai": {
      "limitTracking": {
        "enabled": true,
        "window": "daily",
        "resetHourUtc": 0
      }
    }
  }
}
```

---

## Programmatic Usage

### Basic Execution

```typescript
import { CodexCLI } from './integrations/openai-codex';

// Create CLI instance
const cli = new CodexCLI({
  command: 'codex',
  sandboxMode: 'workspace-write',
  timeout: 60000
});

// Execute prompt
const result = await cli.execute({
  prompt: 'Write a function to calculate factorial',
  temperature: 0.7,
  maxTokens: 2000
});

console.log(result.content);
console.log(`Duration: ${result.duration}ms`);
console.log(`Tokens: ${result.tokenCount}`);
```

### With Streaming

```typescript
const result = await cli.execute({
  prompt: 'Explain design patterns',
  streaming: true,
  temperature: 0.5
});
```

### Error Handling

```typescript
import { CodexError, CodexErrorType } from './integrations/openai-codex';

try {
  const result = await cli.execute({ prompt: 'Task' });
} catch (error) {
  if (error instanceof CodexError) {
    switch (error.type) {
      case CodexErrorType.CLI_NOT_FOUND:
        console.error('Codex CLI not installed');
        break;
      case CodexErrorType.TIMEOUT:
        console.error('Execution timed out');
        break;
      case CodexErrorType.EXECUTION_FAILED:
        console.error('Execution failed:', error.context);
        break;
    }
  }
}
```

### Full Integration Example

```typescript
import { CodexBridge } from './integrations/openai-codex';

// Create bridge with MCP support
const bridge = new CodexBridge(
  {
    command: 'codex',
    sandboxMode: 'workspace-write',
    temperature: 0.7,
    timeout: 120000
  },
  {
    enabled: true,
    command: 'codex',
    transport: 'stdio'
  }
);

// Initialize
await bridge.initialize();

// Execute multiple prompts
const result1 = await bridge.execute({
  prompt: 'Design a REST API'
});

const result2 = await bridge.execute({
  prompt: 'Implement the API based on the design above',
  model: 'gpt-4o'
});

// Check MCP server health
const healthy = await bridge.isMCPServerHealthy();
console.log(`MCP Server healthy: ${healthy}`);

// Cleanup
await bridge.cleanup();
```

---

## Troubleshooting

### Codex CLI Not Found

**Error**: `CLI_NOT_FOUND: Codex CLI not found`

**Solution**:
```bash
# Check if codex is in PATH
which codex

# If not found, reinstall
npm install -g @openai/codex

# Or via Homebrew
brew install --cask codex

# Verify installation
codex --version
```

### Authentication Issues

**Error**: `Unauthorized` or `Invalid API key`

**Solution**:
```bash
# Re-login
codex login

# Or check API key
echo $OPENAI_API_KEY

# Set API key if missing
export OPENAI_API_KEY="sk-..."
```

### Timeout Errors

**Error**: `TIMEOUT: Codex execution timeout after 60000ms`

**Solution**:
```json
{
  "providers": {
    "openai": {
      "timeout": 120000
    }
  }
}
```

### Process Cleanup Issues

**Error**: Orphaned codex processes

**Solution**:
```bash
# Check for orphaned processes
ps aux | grep codex

# Kill orphaned processes
pkill -f codex

# Restart AutomatosX
ax list agents
```

### MCP Server Start Failure

**Error**: `MCP_ERROR: Failed to start MCP server`

**Solution**:
```bash
# Test MCP server manually
codex mcp-server

# Check for port conflicts
lsof -i :3000

# Restart with auto-start disabled
# Edit config: "autoStart": false
# Then start manually when needed
```

---

## Performance Optimization

### Response Caching

Enable response caching for repeated prompts:

```json
{
  "performance": {
    "responseCache": {
      "enabled": true,
      "ttl": 86400,
      "maxSize": 1000
    }
  }
}
```

### Rate Limiting

Prevent API rate limit errors:

```json
{
  "performance": {
    "rateLimit": {
      "enabled": true,
      "requestsPerMinute": 60,
      "burstSize": 10
    }
  }
}
```

### Concurrency Control

Limit parallel agent executions:

```json
{
  "execution": {
    "concurrency": {
      "maxConcurrentAgents": 4
    }
  }
}
```

---

## Best Practices

### 1. Use Appropriate Models

```typescript
// For simple tasks - faster and cheaper
await cli.execute({
  prompt: 'Format this code',
  model: 'gpt-4o-mini'
});

// For complex reasoning - more capable
await cli.execute({
  prompt: 'Design system architecture',
  model: 'o1-preview'
});
```

### 2. Set Reasonable Timeouts

```typescript
// Short timeout for quick tasks
await cli.execute({
  prompt: 'Quick analysis',
  timeout: 30000 // 30 seconds
});

// Long timeout for complex tasks
await cli.execute({
  prompt: 'Refactor entire codebase',
  timeout: 300000 // 5 minutes
});
```

### 3. Handle Errors Gracefully

```typescript
const maxRetries = 3;
let attempt = 0;

while (attempt < maxRetries) {
  try {
    const result = await cli.execute({ prompt: 'Task' });
    break;
  } catch (error) {
    attempt++;
    if (attempt >= maxRetries) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}
```

### 4. Cleanup Resources

```typescript
// Always cleanup when done
try {
  const result = await cli.execute({ prompt: 'Task' });
  // Process result
} finally {
  await cli.cleanup();
}
```

### 5. Monitor Usage

```bash
# Regular monitoring
ax provider-limits

# Set up alerts for high usage
# Configure in monitoring system
```

---

## API Reference

See the [OpenAI Codex Integration API Reference](../api/openai-codex.md) for complete API documentation.

**Key Classes**:
- `CodexCLI` - CLI command execution
- `CodexMCPManager` - MCP server management
- `CodexBridge` - Unified integration interface

**Key Types**:
- `CodexConfig` - CLI configuration
- `CodexMCPConfig` - MCP server configuration
- `CodexExecutionOptions` - Execution parameters
- `CodexExecutionResult` - Execution results

---

## Support

- **Documentation**: [AutomatosX Docs](https://github.com/defai-digital/automatosx/docs)
- **Issues**: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- **OpenAI Codex**: [Official Docs](https://developers.openai.com/codex/cli/)

---

## Changelog

### v5.13.0 (2025-10-29)
- ✅ Initial OpenAI Codex CLI integration
- ✅ MCP server support
- ✅ Sandbox mode configuration
- ✅ Process management and cleanup
- ✅ Comprehensive error handling

---

**Updated**: 2025-10-29
**Version**: 5.13.0
