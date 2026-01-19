/**
 * Provider registry for managing CLI-based LLM providers
 *
 * DESIGN: AutomatosX does NOT manage credentials.
 * Each provider CLI handles its own authentication:
 * - claude, gemini, codex: Official CLIs with built-in auth
 * - ax-grok: Grok CLI with XAI_API_KEY
 */

import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  HealthCheckResult,
  CLIProviderConfig,
  ModelConfig,
  ClassifiedError,
} from './types.js';
import { createCLIAdapter } from './cli-adapter.js';
import { ALL_PROVIDER_CONFIGS } from './providers/index.js';

/**
 * Provider registry for managing multiple LLM providers
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, LLMProvider>();

  /**
   * Registers a provider from configuration
   */
  registerFromConfig(config: CLIProviderConfig): void {
    const adapter = createCLIAdapter(config);
    this.providers.set(config.providerId, adapter);
  }

  /**
   * Registers a provider instance directly
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  /**
   * Gets a provider by ID
   */
  get(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Gets a provider by model name
   */
  getByModel(model: string): LLMProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.supportsModel(model)) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Executes a completion request, routing to the appropriate provider
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const provider = this.getByModel(request.model);

    if (provider === undefined) {
      const error: ClassifiedError = {
        category: 'not_found',
        message: `No provider found for model: ${request.model}`,
        shouldRetry: false,
        shouldFallback: true,
        retryAfterMs: null,
        originalError: undefined,
      };

      return {
        success: false,
        requestId: request.requestId,
        error,
        latencyMs: 0,
      };
    }

    return provider.complete(request);
  }

  /**
   * Checks health of all registered providers
   */
  async checkAllHealth(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    const healthChecks = [...this.providers.entries()].map(
      async ([providerId, provider]) => {
        const result = await provider.checkHealth();
        results.set(providerId, result);
      }
    );

    await Promise.all(healthChecks);
    return results;
  }

  /**
   * Gets all providers that are currently available
   */
  async getAvailableProviders(): Promise<LLMProvider[]> {
    const providers = [...this.providers.values()];
    const results = await Promise.all(
      providers.map(async (provider) => {
        const isAvailable = await provider.isAvailable();
        return isAvailable ? provider : null;
      })
    );
    return results.filter((p): p is LLMProvider => p !== null);
  }

  /**
   * Gets all registered provider IDs
   */
  getProviderIds(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Gets all available models across all providers
   */
  getAllModels(): { providerId: string; model: ModelConfig }[] {
    const models: { providerId: string; model: ModelConfig }[] = [];

    for (const provider of this.providers.values()) {
      for (const model of provider.getModels()) {
        models.push({ providerId: provider.providerId, model });
      }
    }

    return models;
  }

  /**
   * Checks if a model is available in any registered provider
   */
  hasModel(model: string): boolean {
    return this.getByModel(model) !== undefined;
  }

  /**
   * Gets the number of registered providers
   */
  get size(): number {
    return this.providers.size;
  }
}

/**
 * Creates a provider registry with all default providers registered
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register all CLI-based providers
  for (const config of ALL_PROVIDER_CONFIGS) {
    registry.registerFromConfig(config);
  }

  return registry;
}

/**
 * Creates an empty provider registry
 */
export function createEmptyRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}
