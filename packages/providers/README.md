# @ax/providers

AI provider integrations for AutomatosX.

## Installation

```bash
pnpm add @ax/providers
```

## Overview

This package provides integrations with multiple AI providers:

- **Claude** - Anthropic's Claude via MCP
- **Gemini** - Google's Gemini via MCP
- **OpenAI** - OpenAI/Codex via bash commands
- **ax-cli** - Direct ax-cli SDK integration

## Supported Providers

| Provider | Integration | Features |
|----------|-------------|----------|
| Claude | MCP | Streaming, tools, context |
| Gemini | MCP | Streaming, tools, context |
| OpenAI | Bash | Command execution |
| ax-cli | SDK | Direct SDK calls |

## Usage

### Creating Providers

```typescript
import { createProvider, createProviders } from '@ax/providers';

// Create single provider
const claude = createProvider('claude', {
  enabled: true,
  priority: 1,
  timeout: 300000,
});

// Create multiple providers
const providers = createProviders({
  claude: { enabled: true, priority: 1 },
  gemini: { enabled: true, priority: 2 },
  openai: { enabled: false },
});
```

### Executing Requests

```typescript
const response = await provider.execute({
  task: 'Explain TypeScript generics',
  agent: 'backend',
  timeout: 60000,
});

if (response.success) {
  console.log(response.content);
  console.log(response.metadata.duration);
  console.log(response.tokens);
}
```

### Health Monitoring

```typescript
// Check provider health
const isHealthy = await provider.checkHealth();

// Get provider status
const status = provider.getStatus();
console.log(status.healthy);
console.log(status.lastCheck);
console.log(status.successRate);

// Listen for health changes
provider.onHealthChange((healthy, reason) => {
  console.log(`Provider ${provider.id} health: ${healthy}`);
});
```

### Base Provider Class

All providers extend `BaseProvider`:

```typescript
import { BaseProvider } from '@ax/providers';

class CustomProvider extends BaseProvider {
  readonly id = 'custom';
  readonly integrationMode = 'sdk';

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Implementation
  }

  async checkHealth(): Promise<boolean> {
    // Health check implementation
  }
}
```

### Provider Events

```typescript
const provider = createProvider('claude', config);

provider.onExecutionStart((request) => {
  console.log('Starting:', request.task);
});

provider.onExecutionEnd((request, response) => {
  console.log('Completed in:', response.metadata.duration);
});

provider.onError((error, request) => {
  console.error('Failed:', error.message);
});
```

## Configuration

Provider configuration options:

```typescript
interface ProviderConfig {
  enabled: boolean;
  priority: number;           // Lower = higher priority
  timeout?: number;           // Request timeout (ms)
  healthCheck?: {
    enabled: boolean;
    interval: number;         // Check interval (ms)
    timeout: number;          // Health check timeout (ms)
  };
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number; // Failures before opening
    recoveryTimeout: number;  // Time before retry (ms)
  };
}
```

## License

Apache-2.0
