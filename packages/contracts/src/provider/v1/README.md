# Provider Contract

## Purpose

The Provider domain defines the interface for LLM provider adapters. AutomatosX uses CLI-based providers where each provider wraps an external CLI tool (claude, gemini, codex, etc.) and handles authentication externally.

## Key Concepts

- **Provider**: An LLM service adapter (Claude, Gemini, Codex, etc.)
- **ProviderPort**: The interface that all providers must implement
- **ProviderRegistry**: Collection of available providers
- **ModelInfo**: Metadata about available models (context window, capabilities)

## Schemas

| Schema | Purpose |
|--------|---------|
| `ProviderRequestSchema` | Request to send to a provider |
| `ProviderResponseSchema` | Response from a provider |
| `ModelInfoSchema` | Model metadata and capabilities |
| `ProviderStatusSchema` | Health status of a provider |

## Port Interfaces

```typescript
interface ProviderPort {
  readonly providerId: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  isAvailable(): Promise<boolean>;
  getModels(): ModelInfo[];
  getStatus(): 'open' | 'closed' | 'half-open';
}

interface ProviderRegistryPort {
  getProvider(providerId: string): ProviderPort | undefined;
  getDefaultProvider(): ProviderPort | undefined;
  listProviders(): string[];
  hasProvider(providerId: string): boolean;
}
```

## Usage Example

```typescript
import type { ProviderPort, ProviderRequest } from '@automatosx/contracts/provider/v1';

async function callProvider(provider: ProviderPort, prompt: string) {
  const request: ProviderRequest = {
    prompt,
    maxTokens: 4096,
  };

  const response = await provider.complete(request);
  if (response.success) {
    return response.content;
  }
  throw new Error(response.error?.message);
}
```

## Related Domains

- `routing`: Selects which provider to use
- `resilience`: Provides circuit breaker for provider failures
- `config`: Stores provider configuration

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-PROV-001: No credential management (delegated to CLI tools)
- INV-PROV-002: Consistent response format across providers
