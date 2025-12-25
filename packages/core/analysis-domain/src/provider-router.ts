/**
 * Analysis Provider Router
 *
 * Bridges the analysis domain to actual LLM provider implementations.
 * Eliminates the mock provider by connecting to real provider registry.
 */

import { TIMEOUT_PROVIDER_DEFAULT, PROVIDER_DEFAULT } from '@defai.digital/contracts';
import type {
  AnalysisProvider,
  ProviderRouter,
  ProviderRequest,
  ProviderResponse,
} from './types.js';

/**
 * Provider interface (minimal - matches what we need from provider adapters)
 */
export interface ProviderLike {
  providerId: string;
  complete(request: {
    requestId: string;
    model: string;
    messages: { role: string; content: string }[];
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<{
    success: boolean;
    content: string;
    tokensUsed?: number;
  } | { success: false; error: unknown }>;
  isAvailable(): Promise<boolean>;
  getModels(): readonly { modelId: string; isDefault?: boolean }[];
}

/**
 * Provider registry interface (minimal - matches what we need)
 */
export interface ProviderRegistryLike {
  get(providerId: string): ProviderLike | undefined;
  getProviderIds(): string[];
}

/**
 * Configuration for the analysis provider router
 */
export interface AnalysisProviderRouterConfig {
  /** Provider registry to use */
  registry: ProviderRegistryLike;

  /** Default provider ID */
  defaultProvider?: string;

  /** Default timeout in ms */
  defaultTimeout?: number;
}

/**
 * Creates a provider router that bridges to real providers
 */
export function createAnalysisProviderRouter(
  config: AnalysisProviderRouterConfig
): ProviderRouter {
  const { registry, defaultProvider = PROVIDER_DEFAULT, defaultTimeout = TIMEOUT_PROVIDER_DEFAULT } = config;

  return {
    async getProvider(providerId: string): Promise<AnalysisProvider> {
      const provider = registry.get(providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}. Available: ${registry.getProviderIds().join(', ')}`);
      }
      return wrapAsAnalysisProvider(provider, defaultTimeout);
    },

    async selectProvider(_task: string): Promise<AnalysisProvider> {
      // For now, use default provider
      // Could be enhanced to select based on task type
      const provider = registry.get(defaultProvider);
      if (!provider) {
        // Try first available provider
        const providerIds = registry.getProviderIds();
        if (providerIds.length === 0) {
          throw new Error('No providers available');
        }
        const firstProvider = registry.get(providerIds[0]!);
        if (!firstProvider) {
          throw new Error('Failed to get provider');
        }
        return wrapAsAnalysisProvider(firstProvider, defaultTimeout);
      }
      return wrapAsAnalysisProvider(provider, defaultTimeout);
    },
  };
}

/**
 * Wraps a provider from the registry as an AnalysisProvider
 */
function wrapAsAnalysisProvider(
  provider: ProviderLike,
  defaultTimeout: number
): AnalysisProvider {
  return {
    id: provider.providerId,

    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      // Get default model
      const models = provider.getModels();
      const defaultModel = models.find((m) => m.isDefault)?.modelId ?? models[0]?.modelId ?? 'default';

      // Build completion request
      const response = await provider.complete({
        requestId: crypto.randomUUID(),
        model: defaultModel,
        messages: [{ role: 'user', content: request.prompt }],
        maxTokens: request.maxTokens ?? 4000,
        temperature: request.temperature ?? 0.1,
        timeout: defaultTimeout,
      });

      // Handle failure response
      if ('success' in response && !response.success) {
        const errorResponse = response as { success: false; error: unknown };
        throw new Error(`Provider error: ${JSON.stringify(errorResponse.error)}`);
      }

      // Handle success response
      if ('success' in response && response.success) {
        const successResponse = response as { success: true; content: string; tokensUsed?: number };
        const result: ProviderResponse = {
          content: successResponse.content,
        };
        if (successResponse.tokensUsed !== undefined) {
          result.tokensUsed = successResponse.tokensUsed;
        }
        return result;
      }

      // Fallback for unexpected response shape
      const fallbackResponse = response as { content?: string; tokensUsed?: number };
      const result: ProviderResponse = {
        content: fallbackResponse.content ?? '',
      };
      if (fallbackResponse.tokensUsed !== undefined) {
        result.tokensUsed = fallbackResponse.tokensUsed;
      }
      return result;
    },
  };
}

/**
 * Creates a stub provider router for testing
 * Returns empty findings (same as mock provider behavior)
 */
export function createStubProviderRouter(): ProviderRouter {
  const stubProvider: AnalysisProvider = {
    id: 'stub',
    async complete(_request: ProviderRequest): Promise<ProviderResponse> {
      // Return empty findings response
      return {
        content: JSON.stringify({ findings: [] }),
        tokensUsed: 0,
      };
    },
  };

  return {
    async getProvider(_providerId: string): Promise<AnalysisProvider> {
      return stubProvider;
    },
    async selectProvider(_task: string): Promise<AnalysisProvider> {
      return stubProvider;
    },
  };
}
