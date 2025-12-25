/**
 * Discussion Provider Bridge
 *
 * Bridges the discussion-domain's DiscussionProviderExecutor interface
 * to the provider-adapters' ProviderRegistry.
 *
 * This adapter pattern allows the discussion domain to remain decoupled
 * from the concrete provider implementation details.
 */

import { TIMEOUT_PROVIDER_DEFAULT } from '@defai.digital/contracts';
import type {
  DiscussionProviderExecutor,
  ProviderExecuteRequest,
  ProviderExecuteResult,
} from './types.js';

/**
 * Minimal LLMProvider interface (mirrors provider-adapters without importing)
 */
interface LLMProviderLike {
  providerId: string;
  complete(request: CompletionRequestLike): Promise<CompletionResponseLike>;
  checkHealth(): Promise<HealthCheckResultLike>;
  isAvailable(): Promise<boolean>;
}

/**
 * Minimal CompletionRequest interface
 */
interface CompletionRequestLike {
  requestId: string;
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  timeout?: number | undefined;
  systemPrompt?: string | undefined;
}

/**
 * Minimal CompletionResponse interface (discriminated union)
 */
type CompletionResponseLike =
  | {
      success: true;
      requestId: string;
      content: string;
      model: string;
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
      latencyMs: number;
    }
  | {
      success: false;
      requestId: string;
      error: {
        category: string;
        message: string;
        shouldRetry: boolean;
      };
      latencyMs: number;
    };

/**
 * Minimal HealthCheckResult interface
 * Note: Supports both `healthy: boolean` and `status: 'healthy'|'unhealthy'` formats
 */
interface HealthCheckResultLike {
  healthy?: boolean | undefined;
  status?: 'healthy' | 'degraded' | 'unhealthy' | undefined;
  message?: string | undefined;
  latencyMs: number;
}

/**
 * Helper to check if a health result indicates healthy status
 */
function isHealthy(result: HealthCheckResultLike): boolean {
  // Support both formats: `healthy: boolean` and `status: 'healthy'`
  if (result.healthy !== undefined) {
    return result.healthy;
  }
  if (result.status !== undefined) {
    return result.status === 'healthy';
  }
  return false;
}

/**
 * Minimal ProviderRegistry interface
 */
export interface ProviderRegistryLike {
  get(providerId: string): LLMProviderLike | undefined;
  getAll(): LLMProviderLike[];
  has(providerId: string): boolean;
}

/**
 * Options for creating the provider bridge
 */
export interface ProviderBridgeOptions {
  /**
   * Default timeout per provider call in milliseconds
   */
  defaultTimeoutMs?: number | undefined;

  /**
   * Default max tokens per response
   */
  defaultMaxTokens?: number | undefined;

  /**
   * Whether to perform health checks before considering a provider available
   */
  performHealthChecks?: boolean | undefined;

  /**
   * Cache health check results for this many milliseconds
   */
  healthCheckCacheMs?: number | undefined;
}

/**
 * Creates a DiscussionProviderExecutor that bridges to a ProviderRegistry
 *
 * @param registry - The provider registry to bridge to
 * @param options - Bridge configuration options
 * @returns A DiscussionProviderExecutor implementation
 */
export function createProviderBridge(
  registry: ProviderRegistryLike,
  options: ProviderBridgeOptions = {}
): DiscussionProviderExecutor {
  const {
    defaultTimeoutMs = TIMEOUT_PROVIDER_DEFAULT,
    defaultMaxTokens = 4000,
    performHealthChecks = true,
    healthCheckCacheMs = 60000, // 1 minute cache for health check results
  } = options;

  // Cache for health check results
  const healthCache = new Map<string, { healthy: boolean; timestamp: number }>();

  return {
    async execute(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
      const startTime = Date.now();
      const { providerId, prompt, systemPrompt, temperature, maxTokens, timeoutMs } = request;

      // Get provider from registry
      const provider = registry.get(providerId);

      if (!provider) {
        return {
          success: false,
          error: `Provider ${providerId} not found in registry`,
          retryable: false,
          durationMs: Date.now() - startTime,
        };
      }

      try {
        // Check abort signal
        if (request.abortSignal?.aborted) {
          return {
            success: false,
            error: 'Request aborted',
            retryable: false,
            durationMs: Date.now() - startTime,
          };
        }

        // Build messages array
        const messages: CompletionRequestLike['messages'] = [];

        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }

        messages.push({ role: 'user', content: prompt });

        // Build completion request
        const completionRequest: CompletionRequestLike = {
          requestId: `discuss-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          model: 'default',
          messages,
          maxTokens: maxTokens ?? defaultMaxTokens,
          temperature: temperature ?? 0.7,
          timeout: timeoutMs ?? defaultTimeoutMs,
        };

        // Execute the completion
        const response = await provider.complete(completionRequest);

        if (response.success) {
          return {
            success: true,
            content: response.content,
            durationMs: response.latencyMs,
            tokenCount: response.usage.totalTokens,
          };
        } else {
          return {
            success: false,
            error: response.error.message,
            retryable: response.error.shouldRetry,
            durationMs: response.latencyMs,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
          success: false,
          error: errorMessage,
          retryable: true, // Assume retryable for unexpected errors
          durationMs: Date.now() - startTime,
        };
      }
    },

    async isAvailable(providerId: string): Promise<boolean> {
      const provider = registry.get(providerId);

      if (!provider) {
        return false;
      }

      // Check cache first
      const cached = healthCache.get(providerId);
      if (cached && Date.now() - cached.timestamp < healthCheckCacheMs) {
        return cached.healthy;
      }

      // Perform health check if enabled
      if (performHealthChecks) {
        try {
          const health = await provider.checkHealth();
          const healthy = isHealthy(health);
          healthCache.set(providerId, {
            healthy,
            timestamp: Date.now(),
          });
          return healthy;
        } catch {
          healthCache.set(providerId, {
            healthy: false,
            timestamp: Date.now(),
          });
          return false;
        }
      }

      // If health checks disabled, just check if provider exists
      return true;
    },

    async getAvailableProviders(): Promise<string[]> {
      const allProviders = registry.getAll();
      const now = Date.now();

      // Separate cached vs uncached providers
      const cached: string[] = [];
      const toCheck: LLMProviderLike[] = [];

      for (const provider of allProviders) {
        const entry = healthCache.get(provider.providerId);
        if (entry && now - entry.timestamp < healthCheckCacheMs) {
          if (entry.healthy) cached.push(provider.providerId);
        } else if (performHealthChecks) {
          toCheck.push(provider);
        } else {
          cached.push(provider.providerId); // No health check, assume available
        }
      }

      // Check uncached providers in parallel
      if (toCheck.length === 0) return cached;

      const results = await Promise.allSettled(
        toCheck.map(async (provider) => {
          try {
            const health = await provider.checkHealth();
            const healthy = isHealthy(health);
            healthCache.set(provider.providerId, { healthy, timestamp: Date.now() });
            return healthy ? provider.providerId : null;
          } catch {
            healthCache.set(provider.providerId, { healthy: false, timestamp: Date.now() });
            return null;
          }
        })
      );

      // Collect successful health checks
      const checked = results
        .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((id): id is string => id !== null);

      return [...cached, ...checked];
    },
  };
}

/**
 * Creates a provider bridge with a custom provider map (for testing)
 *
 * @param providers - Map of provider ID to execute function
 * @returns A DiscussionProviderExecutor implementation
 */
export function createSimpleProviderBridge(
  providers: Map<
    string,
    (prompt: string, systemPrompt?: string) => Promise<{ content: string; tokenCount?: number }>
  >
): DiscussionProviderExecutor {
  return {
    async execute(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
      const startTime = Date.now();
      const { providerId, prompt, systemPrompt } = request;

      const executeFunc = providers.get(providerId);

      if (!executeFunc) {
        return {
          success: false,
          error: `Provider ${providerId} not available`,
          retryable: false,
          durationMs: Date.now() - startTime,
        };
      }

      try {
        if (request.abortSignal?.aborted) {
          return {
            success: false,
            error: 'Request aborted',
            retryable: false,
            durationMs: Date.now() - startTime,
          };
        }

        const result = await executeFunc(prompt, systemPrompt);

        return {
          success: true,
          content: result.content,
          durationMs: Date.now() - startTime,
          tokenCount: result.tokenCount,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: true,
          durationMs: Date.now() - startTime,
        };
      }
    },

    async isAvailable(providerId: string): Promise<boolean> {
      return providers.has(providerId);
    },

    async getAvailableProviders(): Promise<string[]> {
      return Array.from(providers.keys());
    },
  };
}
