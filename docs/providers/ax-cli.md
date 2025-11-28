# ax-cli Provider Integration

This guide covers the ax-cli provider for AutomatosX, enabling SDK-based integration for native execution with advanced features like checkpoints and subagent delegation.

## Overview

The ax-cli provider integrates AutomatosX with itself via SDK mode, allowing:
- Nested agent execution
- Checkpoint support for resumable tasks
- Subagent delegation
- Native MCP integration

This provider is useful for:
- Running AutomatosX agents from within other agents
- Building hierarchical agent workflows
- Enabling recursive task delegation

## Configuration

### Basic Setup

Add the ax-cli provider to your `ax.config.json`:

```json
{
  "providers": {
    "ax-cli": {
      "enabled": true,
      "priority": 3
    }
  }
}
```

### Provider Options

```typescript
interface AxCliProviderOptions {
  // Enable checkpoint support for resumable tasks
  enableCheckpoints?: boolean;  // default: true

  // Enable subagent delegation
  enableSubagents?: boolean;    // default: true

  // Execution timeout in milliseconds
  timeout?: number;             // default: 300000 (5 minutes)
}
```

### Example Configuration

```json
{
  "providers": {
    "ax-cli": {
      "enabled": true,
      "priority": 3,
      "options": {
        "enableCheckpoints": true,
        "enableSubagents": true,
        "timeout": 600000
      }
    }
  }
}
```

## Usage

### Programmatic Usage

```typescript
import { AxCliProvider } from '@ax/providers/ax-cli';

// Create provider instance
const provider = new AxCliProvider({
  enableCheckpoints: true,
  enableSubagents: true,
  timeout: 300000
});

// Initialize the provider
await provider.initialize();

// Execute a task
const response = await provider.execute({
  task: 'Analyze the codebase structure',
  agent: 'backend',
  timeout: 60000,
  stream: false
});

console.log(response.output);

// Cleanup when done
await provider.cleanup();
```

### CLI Usage

The ax-cli provider is automatically used when running agents through the CLI:

```bash
# Run an agent task
ax run backend "implement user authentication"

# With specific timeout
ax run backend "refactor database layer" --timeout 600000

# Enable streaming output
ax run backend "explain this codebase" --streaming
```

## Features

### Checkpoints

When `enableCheckpoints` is true, long-running tasks can be paused and resumed:

```bash
# Start a resumable task
ax run backend "refactor entire codebase" --resumable

# If interrupted, resume with:
ax resume <run-id>

# List all runs
ax runs list
```

### Subagent Delegation

When `enableSubagents` is true, agents can delegate subtasks to other specialized agents:

```typescript
// The backend agent can delegate to security agent
const response = await provider.execute({
  task: 'Build authentication with security audit',
  agent: 'backend'  // Will automatically delegate security audit to security agent
});
```

### MCP Integration

The ax-cli provider handles MCP (Model Context Protocol) internally, providing:
- Tool discovery and execution
- Resource access
- Prompt templates

## Error Handling

The provider returns structured error responses:

```typescript
interface ExecutionResponse {
  success: boolean;
  output: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  metrics?: {
    duration: number;
    tokensUsed?: number;
  };
}
```

### Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `NOT_INITIALIZED` | SDK not initialized | Yes |
| `EXECUTION_FAILED` | Task execution failed | Yes |
| `SDK_ERROR` | Internal SDK error | Yes |

### Example Error Handling

```typescript
const response = await provider.execute({
  task: 'complex task',
  agent: 'backend'
});

if (!response.success) {
  if (response.error?.retryable) {
    // Retry the task
    console.log(`Retrying: ${response.error.message}`);
  } else {
    // Handle non-retryable error
    console.error(`Failed: ${response.error?.message}`);
  }
}
```

## Health Checks

Monitor provider health:

```typescript
const isHealthy = await provider.checkHealth();

if (!isHealthy) {
  // Re-initialize or switch to fallback provider
  await provider.initialize();
}
```

## Best Practices

1. **Initialize Once**: Initialize the provider once and reuse it for multiple executions
2. **Set Appropriate Timeouts**: Use longer timeouts for complex tasks
3. **Enable Checkpoints**: For long-running tasks, enable checkpoints for recoverability
4. **Cleanup Resources**: Always call `cleanup()` when done to free resources

## Integration with Provider Router

The ax-cli provider works with the ProviderRouter for automatic fallback:

```typescript
import { ProviderRouter } from '@ax/core/router';
import { AxCliProvider } from '@ax/providers/ax-cli';
import { ClaudeProvider } from '@ax/providers/claude';

const router = new ProviderRouter({
  providers: [
    { provider: new ClaudeProvider(), priority: 1 },
    { provider: new AxCliProvider(), priority: 2 }
  ],
  fallbackEnabled: true
});

// Router will try Claude first, fall back to ax-cli if needed
const response = await router.execute(request);
```

## Limitations

- Currently uses a placeholder SDK implementation
- Full SDK integration pending ax-cli SDK release
- Some advanced features may not be available until SDK is complete

## Related Documentation

- [Claude Provider](./claude.md)
- [Gemini Provider](./gemini.md)
- [OpenAI/Codex Provider](./codex.md)
- [Architecture Overview](../ARCHITECTURE.md)
