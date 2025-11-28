/**
 * ax-cli Provider - SDK-based integration
 *
 * Integrates with ax-cli using its SDK for native execution.
 * This provider uses SDK mode for better performance and features
 * like checkpoints and subagent delegation.
 *
 * @module @ax/providers/ax-cli
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Provider Constants
// =============================================================================

/** Default timeout in milliseconds (5 minutes) */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Default feature flags */
const DEFAULT_ENABLE_CHECKPOINTS = true;
const DEFAULT_ENABLE_SUBAGENTS = true;

/** Error codes */
const ERROR_CODE_NOT_INITIALIZED = 'NOT_INITIALIZED';
const ERROR_CODE_EXECUTION_FAILED = 'EXECUTION_FAILED';
const ERROR_CODE_SDK_ERROR = 'SDK_ERROR';

// =============================================================================
// Imports
// =============================================================================

import { type ExecutionRequest, type ExecutionResponse } from '@ax/schemas';
import { BaseProvider } from './base.js';

// =============================================================================
// Types for ax-cli SDK (will be imported from actual SDK when available)
// =============================================================================

interface AxCliSDKConfig {
  enableCheckpoints?: boolean;
  enableSubagents?: boolean;
  timeout?: number;
}

interface AxCliExecuteOptions {
  prompt: string;
  agent?: string;
  timeout?: number;
  stream?: boolean;
  useMcp?: boolean;
}

interface AxCliExecuteResult {
  success: boolean;
  output: string;
  tokensUsed?: number;
  checkpointId?: string;
}

/**
 * Placeholder for ax-cli SDK
 * Will be replaced with actual import when SDK is available
 */
class AxCliSDKPlaceholder {
  private config: AxCliSDKConfig;
  private initialized = false;

  constructor(config: AxCliSDKConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // In real implementation, this would initialize the SDK
    this.initialized = true;
  }

  async execute(options: AxCliExecuteOptions): Promise<AxCliExecuteResult> {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    // Placeholder implementation
    // Real implementation would call ax-cli SDK
    return {
      success: true,
      output: `[ax-cli SDK placeholder] Task: ${options.prompt}`,
      tokensUsed: 0,
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}

// =============================================================================
// ax-cli Provider
// =============================================================================

export class AxCliProvider extends BaseProvider {
  readonly id = 'ax-cli' as const;
  readonly name = 'ax-cli';
  readonly integrationMode = 'sdk' as const;

  private sdk: AxCliSDKPlaceholder | null = null;
  private sdkConfig: AxCliSDKConfig;

  constructor(options?: AxCliSDKConfig) {
    super();
    this.sdkConfig = {
      enableCheckpoints: options?.enableCheckpoints ?? DEFAULT_ENABLE_CHECKPOINTS,
      enableSubagents: options?.enableSubagents ?? DEFAULT_ENABLE_SUBAGENTS,
      timeout: options?.timeout ?? DEFAULT_TIMEOUT_MS,
    };
  }

  /**
   * Initialize ax-cli SDK
   */
  override async initialize(): Promise<void> {
    if (this.sdk) {
      return; // Already initialized
    }

    this.sdk = new AxCliSDKPlaceholder(this.sdkConfig);
    await this.sdk.initialize();
  }

  /**
   * Execute a task via ax-cli SDK
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      await this.ensureInitialized();

      if (!this.sdk) {
        return this.createErrorResponse(
          request,
          ERROR_CODE_NOT_INITIALIZED,
          'ax-cli SDK not initialized',
          true
        );
      }

      const result = await this.sdk.execute({
        prompt: request.task,
        ...(request.agent !== null && request.agent !== undefined && { agent: request.agent }),
        timeout: request.timeout,
        stream: request.stream,
        useMcp: true, // SDK handles MCP internally
      });

      const _duration = Date.now() - start;

      if (result.success) {
        return this.createSuccessResponse(
          result.output,
          _duration,
          result.tokensUsed !== null && result.tokensUsed !== undefined
            ? { total: result.tokensUsed }
            : undefined
        );
      } else {
        return this.createErrorResponse(
          request,
          ERROR_CODE_EXECUTION_FAILED,
          result.output || 'Execution failed',
          true
        );
      }
    } catch (error) {
      const _duration = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return this.createErrorResponse(request, ERROR_CODE_SDK_ERROR, message, true);
    }
  }

  /**
   * Check ax-cli SDK health
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.ensureInitialized();

      if (!this.sdk) {
        return false;
      }

      return await this.sdk.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Cleanup SDK resources
   */
  override async cleanup(): Promise<void> {
    if (this.sdk) {
      await this.sdk.close();
      this.sdk = null;
    }
    // Call base cleanup to clear recovery timeout
    await super.cleanup();
  }

  /**
   * Ensure SDK is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.sdk) {
      await this.initialize();
    }
  }
}
