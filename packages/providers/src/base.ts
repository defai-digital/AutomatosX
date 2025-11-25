/**
 * Base Provider - Abstract provider interface
 *
 * All providers must extend this base class and implement
 * the required abstract methods.
 *
 * @module @ax/providers/base
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Provider Constants
// =============================================================================

/** Default execution timeout in milliseconds (5 minutes) */
export const DEFAULT_EXECUTION_TIMEOUT_MS = 300_000;

/** Request history size for success rate calculation */
const REQUEST_HISTORY_SIZE = 100;

/** Default success rate when no history exists */
const DEFAULT_SUCCESS_RATE = 1;

/** Circuit breaker states */
const CIRCUIT_STATE_OPEN = 'open';
const CIRCUIT_STATE_CLOSED = 'closed';
const CIRCUIT_STATE_HALF_OPEN = 'half-open';

/** Circuit breaker defaults */
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RECOVERY_TIMEOUT_MS = 60000;

/** Error codes */
const ERROR_CODE_CIRCUIT_OPEN = 'CIRCUIT_OPEN';
const ERROR_CODE_TIMEOUT = 'TIMEOUT';
const ERROR_CODE_EXECUTION_ERROR = 'EXECUTION_ERROR';

/** Timeout detection pattern */
const TIMEOUT_ERROR_PATTERN = 'timeout';

/** MCP content type for text */
const MCP_CONTENT_TYPE_TEXT = 'text';

/** MCP output line separator */
const MCP_OUTPUT_SEPARATOR = '\n';

// =============================================================================
// Imports
// =============================================================================

import {
  type ProviderType,
  type IntegrationMode,
  type ExecutionRequest,
  type ExecutionResponse,
  type ProviderHealth,
  type ProviderConfig,
  ExecutionResponseSchema,
  DEFAULT_HEALTH_VALUES,
} from '@ax/schemas';

// =============================================================================
// Types
// =============================================================================

export interface ProviderEvents {
  onHealthChange?: (health: ProviderHealth) => void;
  onExecutionStart?: (request: ExecutionRequest) => void;
  onExecutionEnd?: (response: ExecutionResponse) => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// Base Provider Class
// =============================================================================

export abstract class BaseProvider {
  /** Provider type identifier */
  abstract readonly id: ProviderType;

  /** Human-readable provider name */
  abstract readonly name: string;

  /** Integration mode (mcp, sdk, bash) */
  abstract readonly integrationMode: IntegrationMode;

  /** Provider configuration */
  protected config: ProviderConfig | null = null;

  /** Event handlers */
  protected events: ProviderEvents = {};

  /** Current health status */
  protected health: ProviderHealth = {
    ...DEFAULT_HEALTH_VALUES,
    lastCheck: new Date(),
  };

  /** Request history for success rate calculation */
  private requestHistory: boolean[] = [];
  private readonly historySize = REQUEST_HISTORY_SIZE;

  /** Circuit breaker recovery timeout ID */
  private recoveryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // =============================================================================
  // Abstract Methods
  // =============================================================================

  /**
   * Execute a task using this provider
   * Must be implemented by concrete providers
   */
  abstract execute(request: ExecutionRequest): Promise<ExecutionResponse>;

  /**
   * Check if provider is healthy and available
   * Must be implemented by concrete providers
   */
  abstract checkHealth(): Promise<boolean>;

  /**
   * Initialize provider (optional)
   * Override in concrete providers if initialization is needed
   */
  async initialize(config?: ProviderConfig): Promise<void> {
    this.config = config ?? null;
  }

  /**
   * Cleanup provider resources (optional)
   * Override in concrete providers if cleanup is needed
   */
  async cleanup(): Promise<void> {
    // Clear any pending recovery timeout to prevent memory leaks
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = null;
    }
  }

  // =============================================================================
  // Public Methods
  // =============================================================================

  /**
   * Get current health status
   */
  getHealth(): ProviderHealth {
    return { ...this.health };
  }

  /**
   * Check if provider is currently healthy
   */
  isHealthy(): boolean {
    return this.health.healthy && this.health.circuitState !== CIRCUIT_STATE_OPEN;
  }

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig | null {
    return this.config;
  }

  /**
   * Set event handlers
   */
  setEvents(events: ProviderEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Execute with automatic health tracking, circuit breaker, and timeout
   */
  async executeWithTracking(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Check circuit breaker
    if (this.health.circuitState === CIRCUIT_STATE_OPEN) {
      return this.createErrorResponse(
        request,
        ERROR_CODE_CIRCUIT_OPEN,
        `Provider ${this.id} circuit is open due to repeated failures`,
        false
      );
    }

    const start = Date.now();
    this.events.onExecutionStart?.(request);

    try {
      // Apply timeout if specified in request
      const timeout = request.timeout ?? DEFAULT_EXECUTION_TIMEOUT_MS;
      const executePromise = this.execute(request);

      let response: ExecutionResponse;
      if (timeout > 0) {
        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<ExecutionResponse>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Execution timeout after ${timeout}ms`)), timeout);
        });
        try {
          response = await Promise.race([executePromise, timeoutPromise]);
        } finally {
          clearTimeout(timeoutId!);
        }
      } else {
        response = await executePromise;
      }

      const duration = Date.now() - start;

      // Update health on success
      this.updateHealth(response.success, duration);

      this.events.onExecutionEnd?.(response);
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateHealth(false, duration);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes(TIMEOUT_ERROR_PATTERN);
      this.events.onError?.(error instanceof Error ? error : new Error(errorMessage));

      return this.createErrorResponse(
        request,
        isTimeout ? ERROR_CODE_TIMEOUT : ERROR_CODE_EXECUTION_ERROR,
        errorMessage,
        !isTimeout // Timeouts are generally not retryable
      );
    }
  }

  // =============================================================================
  // Protected Methods
  // =============================================================================

  /**
   * Update health status after an operation
   */
  protected updateHealth(success: boolean, latencyMs: number): void {
    const previousHealth = this.health.healthy;

    this.health.lastCheck = new Date();
    this.health.latencyMs = latencyMs;

    // Update request history
    this.requestHistory.push(success);
    if (this.requestHistory.length > this.historySize) {
      this.requestHistory.shift();
    }

    // Calculate success rate
    const successCount = this.requestHistory.filter(Boolean).length;
    this.health.successRate = this.requestHistory.length > 0 ? successCount / this.requestHistory.length : DEFAULT_SUCCESS_RATE;

    if (success) {
      this.health.consecutiveFailures = 0;

      // Recovery from half-open
      if (this.health.circuitState === CIRCUIT_STATE_HALF_OPEN) {
        this.health.circuitState = CIRCUIT_STATE_CLOSED;
        this.health.healthy = true;
      }
    } else {
      this.health.consecutiveFailures++;

      // Check circuit breaker threshold - only open if not already open
      const threshold = this.config?.circuitBreaker?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
      if (this.health.consecutiveFailures >= threshold && this.health.circuitState !== CIRCUIT_STATE_OPEN) {
        this.health.circuitState = CIRCUIT_STATE_OPEN;
        this.health.healthy = false;

        // Clear any existing recovery timeout to prevent race conditions
        if (this.recoveryTimeoutId) {
          clearTimeout(this.recoveryTimeoutId);
        }

        // Schedule recovery attempt
        const recoveryTimeout = this.config?.circuitBreaker?.recoveryTimeout ?? DEFAULT_RECOVERY_TIMEOUT_MS;
        this.recoveryTimeoutId = setTimeout(() => {
          if (this.health.circuitState === CIRCUIT_STATE_OPEN) {
            this.health.circuitState = CIRCUIT_STATE_HALF_OPEN;
          }
          this.recoveryTimeoutId = null;
        }, recoveryTimeout);
      }
    }

    // Notify health change
    if (previousHealth !== this.health.healthy) {
      this.events.onHealthChange?.(this.getHealth());
    }
  }

  /**
   * Extract output from MCP tool result
   * Shared by all MCP-based providers (Claude, Gemini)
   */
  protected extractMcpOutput(result: unknown): string {
    if (!result || typeof result !== 'object') {
      return '';
    }

    const typedResult = result as { content?: Array<{ text?: string; type?: string }> };

    if (Array.isArray(typedResult.content)) {
      return typedResult.content
        .filter((item) => item.type === MCP_CONTENT_TYPE_TEXT && typeof item.text === 'string')
        .map((item) => item.text)
        .join(MCP_OUTPUT_SEPARATOR);
    }

    return '';
  }

  /**
   * Create a standardized error response
   */
  protected createErrorResponse(
    request: ExecutionRequest,
    code: string,
    message: string,
    retryable: boolean
  ): ExecutionResponse {
    return ExecutionResponseSchema.parse({
      success: false,
      output: '',
      metadata: {
        provider: this.id,
        integrationMode: this.integrationMode,
        duration: 0,
      },
      error: message,
      errorDetails: {
        code,
        message,
        retryable,
      },
    });
  }

  /**
   * Create a successful response
   */
  protected createSuccessResponse(
    output: string,
    duration: number,
    tokens?: { input?: number; output?: number; total?: number }
  ): ExecutionResponse {
    return ExecutionResponseSchema.parse({
      success: true,
      output,
      metadata: {
        provider: this.id,
        integrationMode: this.integrationMode,
        duration,
        tokens,
      },
    });
  }

  /**
   * Reset health to default state
   */
  protected resetHealth(): void {
    this.health = {
      ...DEFAULT_HEALTH_VALUES,
      lastCheck: new Date(),
    };
    this.requestHistory = [];
  }
}
