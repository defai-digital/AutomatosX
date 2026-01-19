/**
 * Prompt Executor Implementation
 *
 * Bridges the agent domain with LLM providers for real prompt execution.
 * This file provides both a stub executor for testing and a factory
 * for creating real executors with provider integration.
 */

import { getErrorMessage } from '@defai.digital/contracts';
import type {
  PromptExecutor,
  PromptExecutionRequest,
  PromptExecutionResponse,
} from './types.js';

/**
 * Stub prompt executor for testing and development
 * Returns mock responses without calling real providers
 *
 * WARNING: This executor returns fake responses. For production use,
 * inject a real PromptExecutor via config.promptExecutor.
 */
export class StubPromptExecutor implements PromptExecutor {
  private readonly defaultProvider: string;
  private hasWarnedOnce = false;

  constructor(defaultProvider = 'claude') {
    this.defaultProvider = defaultProvider;
  }

  async execute(request: PromptExecutionRequest): Promise<PromptExecutionResponse> {
    // Warn once on first use (not on every call to avoid log spam)
    if (!this.hasWarnedOnce) {
      console.warn(
        '[WARN] StubPromptExecutor: Using mock responses. ' +
        'For production, inject a real PromptExecutor via config.promptExecutor.'
      );
      this.hasWarnedOnce = true;
    }

    const startTime = Date.now();

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      success: true,
      content: `[Stub Response] This is a mock response for prompt: "${request.prompt.substring(0, 100)}..."`,
      provider: request.provider ?? this.defaultProvider,
      model: request.model ?? 'stub-model',
      latencyMs: Date.now() - startTime,
      usage: {
        inputTokens: Math.ceil(request.prompt.length / 4),
        outputTokens: 50,
        totalTokens: Math.ceil(request.prompt.length / 4) + 50,
      },
    };
  }

  async isProviderAvailable(_providerId: string): Promise<boolean> {
    return true;
  }

  async getAvailableProviders(): Promise<string[]> {
    return [this.defaultProvider];
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }
}

/**
 * Provider-based prompt executor configuration
 */
export interface ProviderPromptExecutorConfig {
  /**
   * Default provider to use when none specified
   */
  defaultProvider: string;

  /**
   * Default model to use when none specified (per provider)
   */
  defaultModels?: Record<string, string>;

  /**
   * Default timeout in milliseconds
   */
  defaultTimeout?: number;
}

/**
 * Interface that matches the provider registry from @defai.digital/providers
 * This allows loose coupling without direct dependency
 */
export interface ProviderRegistryLike {
  get(providerId: string): ProviderLike | undefined;
  getProviderIds(): string[];
}

/**
 * Interface that matches a provider from @defai.digital/providers
 */
export interface ProviderLike {
  providerId: string;
  complete(request: {
    requestId: string;
    model: string;
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<{
    success: boolean;
    content?: string;
    error?: { message: string; category: string };
    latencyMs: number;
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    model?: string;
  }>;
  isAvailable(): Promise<boolean>;
  getModels(): readonly { modelId: string; isDefault?: boolean | undefined }[];
}

/**
 * Real prompt executor that uses the provider registry
 */
export class ProviderPromptExecutor implements PromptExecutor {
  private readonly registry: ProviderRegistryLike;
  private readonly config: ProviderPromptExecutorConfig;

  constructor(registry: ProviderRegistryLike, config: ProviderPromptExecutorConfig) {
    this.registry = registry;
    this.config = config;
  }

  async execute(request: PromptExecutionRequest): Promise<PromptExecutionResponse> {
    const startTime = Date.now();
    const providerId = request.provider ?? this.config.defaultProvider;

    // Get the provider
    const provider = this.registry.get(providerId);
    if (provider === undefined) {
      return {
        success: false,
        error: `Provider "${providerId}" not found`,
        errorCode: 'PROVIDER_NOT_FOUND',
        latencyMs: Date.now() - startTime,
      };
    }

    // Check if provider is available
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      return {
        success: false,
        error: `Provider "${providerId}" is not available (CLI not installed or not in PATH)`,
        errorCode: 'PROVIDER_UNAVAILABLE',
        provider: providerId,
        latencyMs: Date.now() - startTime,
      };
    }

    // Determine model to use
    let model = request.model;
    if (!model) {
      // Use configured default for this provider, or provider's default model
      model = this.config.defaultModels?.[providerId];
      if (!model) {
        const models = provider.getModels();
        const defaultModel = models.find((m) => m.isDefault) ?? models[0];
        model = defaultModel?.modelId;
      }
    }

    if (!model) {
      return {
        success: false,
        error: `No model specified and no default model available for provider "${providerId}"`,
        errorCode: 'NO_MODEL',
        provider: providerId,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Build completion request with only defined properties
      const completionRequest: {
        requestId: string;
        model: string;
        messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
        timeout?: number;
      } = {
        requestId: crypto.randomUUID(),
        model,
        messages: [{ role: 'user', content: request.prompt }],
      };

      if (request.systemPrompt !== undefined) {
        completionRequest.systemPrompt = request.systemPrompt;
      }
      if (request.maxTokens !== undefined) {
        completionRequest.maxTokens = request.maxTokens;
      }
      if (request.temperature !== undefined) {
        completionRequest.temperature = request.temperature;
      }
      const timeout = request.timeout ?? this.config.defaultTimeout;
      if (timeout !== undefined) {
        completionRequest.timeout = timeout;
      }

      // Execute the completion
      const response = await provider.complete(completionRequest);

      if (response.success) {
        return {
          success: true,
          content: response.content,
          provider: providerId,
          model: response.model ?? model,
          latencyMs: response.latencyMs,
          usage: response.usage,
        };
      } else {
        return {
          success: false,
          error: response.error?.message ?? 'Unknown error',
          errorCode: response.error?.category ?? 'UNKNOWN',
          provider: providerId,
          model,
          latencyMs: response.latencyMs,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        errorCode: 'EXECUTION_ERROR',
        provider: providerId,
        model,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async isProviderAvailable(providerId: string): Promise<boolean> {
    const provider = this.registry.get(providerId);
    if (provider === undefined) {
      return false;
    }
    return provider.isAvailable();
  }

  async getAvailableProviders(): Promise<string[]> {
    const providerIds = this.registry.getProviderIds();
    const available: string[] = [];

    for (const providerId of providerIds) {
      const provider = this.registry.get(providerId);
      if (provider !== undefined) {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          available.push(providerId);
        }
      }
    }

    return available;
  }

  getDefaultProvider(): string {
    return this.config.defaultProvider;
  }
}

/**
 * Creates a stub prompt executor for testing
 */
export function createStubPromptExecutor(
  defaultProvider = 'claude'
): PromptExecutor {
  return new StubPromptExecutor(defaultProvider);
}

/**
 * Creates a real prompt executor using a provider registry
 *
 * @example
 * ```typescript
 * import { createProviderRegistry } from '@defai.digital/providers';
 * import { createProviderPromptExecutor } from '@defai.digital/agent-domain';
 *
 * const registry = createProviderRegistry();
 * const executor = createProviderPromptExecutor(registry, {
 *   defaultProvider: 'claude',
 *   defaultTimeout: 120000,
 * });
 * ```
 */
export function createProviderPromptExecutor(
  registry: ProviderRegistryLike,
  config: ProviderPromptExecutorConfig
): PromptExecutor {
  return new ProviderPromptExecutor(registry, config);
}
