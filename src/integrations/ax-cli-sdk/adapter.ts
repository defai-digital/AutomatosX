/**
 * AxCliSdkAdapter - SDK-based execution adapter (v9.2.0)
 *
 * Provides 10-40x performance improvement over CLI process spawning by
 * using the ax-cli SDK directly in-process.
 *
 * Performance characteristics:
 * - First call: ~50-100ms (agent initialization)
 * - Subsequent calls: ~5ms (direct function call)
 * - vs CLI: 50-200ms overhead per call
 *
 * @module integrations/ax-cli-sdk/adapter
 */

import type { AxCliAdapter, AxCliOptions } from '../ax-cli/interface.js';
import type { ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../utils/logger.js';
import { TokenEstimator } from './token-estimator.js';

/**
 * SDK Adapter configuration options
 */
export interface SdkAdapterOptions {
  /** Reuse agent instances between calls (recommended for performance) */
  reuseEnabled?: boolean;

  /** Enable streaming events */
  streamingEnabled?: boolean;
}

/**
 * Agent configuration for SDK
 */
interface AgentConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  maxToolRounds?: number;
}

/**
 * Adapter for ax-cli SDK (programmatic API)
 *
 * Features:
 * - In-process execution (no process spawning)
 * - Direct ExecutionResponse format (no parsing)
 * - Agent reuse for performance
 * - Streaming event support
 * - Automatic error mapping
 */
export class AxCliSdkAdapter implements AxCliAdapter {
  private agent: any = null;  // Will type as LLMAgent after import
  private agentConfig: AgentConfig | null = null;
  private readonly reuseEnabled: boolean;
  private readonly streamingEnabled: boolean;
  private sdkAvailable: boolean | null = null;

  constructor(options: SdkAdapterOptions = {}) {
    this.reuseEnabled = options.reuseEnabled ?? true;
    this.streamingEnabled = options.streamingEnabled ?? false;

    logger.debug('AxCliSdkAdapter initialized', {
      reuseEnabled: this.reuseEnabled,
      streamingEnabled: this.streamingEnabled
    });
  }

  /**
   * Execute prompt via SDK
   *
   * Performance: ~5ms overhead vs ~50-200ms for CLI spawning
   */
  async execute(prompt: string, options: AxCliOptions): Promise<ExecutionResponse> {
    const startTime = Date.now();

    try {
      // Ensure SDK is available
      if (!(await this.ensureSDKAvailable())) {
        throw new Error('ax-cli SDK not available. Install with: npm install @defai.digital/ax-cli');
      }

      // Initialize or recreate agent if config changed
      if (!this.agent || this.hasConfigChanged(options)) {
        await this.initializeAgent(options);
      }

      logger.debug('Executing via SDK', {
        model: options.model,
        promptLength: prompt.length,
        streaming: this.streamingEnabled
      });

      // Execute via SDK (no process spawning!)
      const result = await this.agent.processUserMessage(prompt);

      // Convert SDK response to ExecutionResponse format
      const response = this.convertToExecutionResponse(result, prompt, startTime);

      logger.info('SDK execution successful', {
        model: response.model,
        contentLength: response.content.length,
        tokensUsed: response.tokensUsed.total,
        latencyMs: response.latencyMs
      });

      return response;
    } catch (error) {
      logger.error('SDK execution failed', {
        error: error instanceof Error ? error.message : String(error),
        model: options.model
      });

      // Map SDK errors to AutomatosX error format
      throw this.mapError(error);
    }
  }

  /**
   * Initialize or reinitialize agent
   */
  private async initializeAgent(options: AxCliOptions): Promise<void> {
    try {
      // Dynamic import to avoid loading SDK unless needed
      const { createAgent, initializeSDK } = await import('@defai.digital/ax-cli/sdk');

      const config: AgentConfig = {
        apiKey: options.apiKey,
        model: options.model || 'glm-4.6',
        baseURL: options.baseUrl,
        maxToolRounds: options.maxToolRounds || 400
      };

      // Initialize SDK (required for first use)
      await initializeSDK({
        apiKey: config.apiKey,
        model: config.model,
        baseURL: config.baseURL
      });

      logger.debug('Initializing SDK agent', {
        model: config.model,
        maxToolRounds: config.maxToolRounds,
        reuse: this.reuseEnabled
      });

      // Create agent via SDK
      this.agent = await createAgent(config);
      this.agentConfig = config;

      // Set up event handlers if streaming enabled
      if (this.streamingEnabled) {
        this.setupEventHandlers();
      }

      logger.info('SDK agent initialized', {
        model: config.model
      });
    } catch (error) {
      logger.error('Failed to initialize SDK agent', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to initialize SDK agent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if agent config has changed (requires new agent)
   */
  private hasConfigChanged(options: AxCliOptions): boolean {
    if (!this.agentConfig) return true;

    const changed = (
      this.agentConfig.model !== (options.model || 'glm-4.6') ||
      this.agentConfig.apiKey !== options.apiKey ||
      this.agentConfig.baseURL !== options.baseUrl ||
      this.agentConfig.maxToolRounds !== (options.maxToolRounds || 400)
    );

    if (changed) {
      logger.debug('Agent config changed, will reinitialize', {
        oldModel: this.agentConfig.model,
        newModel: options.model || 'glm-4.6'
      });
    }

    return changed;
  }

  /**
   * Set up streaming event handlers
   */
  private setupEventHandlers(): void {
    if (!this.agent) return;

    try {
      // SDK events: 'stream', 'tool', 'reasoning', etc.
      this.agent.on('stream', (chunk: any) => {
        logger.debug('Stream chunk received', {
          type: chunk.type,
          contentLength: chunk.content?.length
        });
      });

      this.agent.on('tool', (data: any) => {
        logger.debug('Tool invocation', {
          name: data.name
        });
      });

      this.agent.on('error', (error: Error) => {
        logger.error('Agent error event', {
          error: error.message
        });
      });
    } catch (error) {
      logger.warn('Failed to setup event handlers', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Convert SDK response to ExecutionResponse format
   *
   * SDK returns an array of chat entries:
   * [
   *   { type: "user", content: "...", timestamp: "..." },
   *   { type: "assistant", content: "...", timestamp: "..." }
   * ]
   *
   * Note: SDK doesn't expose token counts, so we estimate them based on content length.
   */
  private convertToExecutionResponse(result: any, prompt: string, startTime: number): ExecutionResponse {
    const latencyMs = Date.now() - startTime;

    // SDK returns array of chat entries
    if (Array.isArray(result)) {
      // Find the last assistant message
      const assistantMessages = result.filter((entry: any) => entry.type === 'assistant');

      if (assistantMessages.length === 0) {
        throw new Error('No assistant response found in SDK result');
      }

      // Get the last assistant message
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      const content = lastAssistant.content || '';

      // Extract token usage if available (might be on agent or result)
      const usage = lastAssistant.usage || lastAssistant.tokens || {};
      const actualTokens = {
        prompt: usage.prompt || usage.input || usage.promptTokens,
        completion: usage.completion || usage.output || usage.completionTokens,
        total: usage.total || usage.totalTokens
      };

      // Estimate tokens from content (SDK doesn't expose actual counts)
      const estimated = TokenEstimator.estimateUsage(prompt, content);

      // Merge actual (if available) with estimated (fallback)
      const finalTokens = TokenEstimator.mergeWithActual(estimated, actualTokens);

      logger.debug('Token usage', {
        estimated: TokenEstimator.format(estimated, true),
        actual: actualTokens.total ? TokenEstimator.format(actualTokens as any) : 'not available',
        final: TokenEstimator.format(finalTokens)
      });

      // Extract model name
      const model = lastAssistant.model || this.agentConfig?.model || 'glm-4.6';

      // Determine finish reason
      let finishReason: 'stop' | 'length' | 'error' = 'stop';
      if (lastAssistant.finishReason) {
        finishReason = lastAssistant.finishReason as 'stop' | 'length' | 'error';
      } else if (lastAssistant.stopReason) {
        finishReason = lastAssistant.stopReason === 'max_tokens' ? 'length' : 'stop';
      }

      return {
        content,
        model,
        tokensUsed: finalTokens,
        latencyMs,
        finishReason,
        cached: lastAssistant.cached || false
      };
    }

    // Fallback: single response object (if SDK API changes)
    const content = typeof result === 'string' ? result : result.content || result.text || '';
    const usage = result.usage || result.tokens || {};
    const actualTokens = {
      prompt: usage.prompt || usage.input || usage.promptTokens,
      completion: usage.completion || usage.output || usage.completionTokens,
      total: usage.total || usage.totalTokens
    };

    // Estimate tokens from content
    const estimated = TokenEstimator.estimateUsage(prompt, content);
    const finalTokens = TokenEstimator.mergeWithActual(estimated, actualTokens);

    const model = result.model || this.agentConfig?.model || 'glm-4.6';

    let finishReason: 'stop' | 'length' | 'error' = 'stop';
    if (result.finishReason) {
      finishReason = result.finishReason as 'stop' | 'length' | 'error';
    } else if (result.stopReason) {
      finishReason = result.stopReason === 'max_tokens' ? 'length' : 'stop';
    }

    return {
      content,
      model,
      tokensUsed: finalTokens,
      latencyMs,
      finishReason,
      cached: result.cached || false
    };
  }

  /**
   * Map SDK errors to AutomatosX error types
   */
  private mapError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error(`SDK error: ${String(error)}`);
    }

    const message = error.message.toLowerCase();

    // Map common SDK errors
    if (message.includes('rate limit') || message.includes('rate_limit')) {
      const mappedError = new Error(`Rate limit exceeded: ${error.message}`);
      (mappedError as any).code = 'RATE_LIMIT_EXCEEDED';
      return mappedError;
    }

    if (message.includes('context length') || message.includes('max_tokens')) {
      const mappedError = new Error(`Context length exceeded: ${error.message}`);
      (mappedError as any).code = 'CONTEXT_LENGTH_EXCEEDED';
      return mappedError;
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      const mappedError = new Error(`Request timeout: ${error.message}`);
      (mappedError as any).code = 'TIMEOUT';
      return mappedError;
    }

    if (message.includes('invalid api key') || message.includes('authentication')) {
      const mappedError = new Error(`Authentication failed: ${error.message}`);
      (mappedError as any).code = 'AUTHENTICATION_FAILED';
      return mappedError;
    }

    if (message.includes('network') || message.includes('econnrefused')) {
      const mappedError = new Error(`Network error: ${error.message}`);
      (mappedError as any).code = 'NETWORK_ERROR';
      return mappedError;
    }

    // Pass through other errors
    return error;
  }

  /**
   * Ensure SDK is available
   */
  private async ensureSDKAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      // Try to import SDK
      await import('@defai.digital/ax-cli/sdk');
      this.sdkAvailable = true;
      logger.debug('SDK is available');
      return true;
    } catch (error) {
      this.sdkAvailable = false;
      logger.warn('SDK not available', {
        error: error instanceof Error ? error.message : String(error),
        hint: 'Run: npm install @defai.digital/ax-cli'
      });
      return false;
    }
  }

  /**
   * Check if SDK is available
   */
  async isAvailable(): Promise<boolean> {
    return await this.ensureSDKAvailable();
  }

  /**
   * Get SDK version
   */
  async getVersion(): Promise<string> {
    try {
      // Try to read version from SDK constants
      const { GLM_MODELS } = await import('@defai.digital/ax-cli/sdk');
      // SDK doesn't expose version directly, so return a fixed string
      return '3.4.6';  // TODO: Find better way to get version
    } catch (error) {
      logger.warn('Failed to get SDK version', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 'unknown';
    }
  }

  /**
   * Get command name (for compatibility with AxCliAdapter interface)
   */
  getCommand(): string {
    return 'ax-cli-sdk';
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    return 'ax-cli (SDK)';
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.agent) {
      try {
        // SDK may provide cleanup method
        if (typeof this.agent.cleanup === 'function') {
          await this.agent.cleanup();
        }

        this.agent = null;
        this.agentConfig = null;

        logger.debug('SDK agent destroyed');
      } catch (error) {
        logger.warn('Error during agent cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}
