// src/ax-cli.ts
import "@ax/schemas";

// src/base.ts
import {
  ExecutionResponseSchema,
  DEFAULT_HEALTH_VALUES
} from "@ax/schemas";
var DEFAULT_EXECUTION_TIMEOUT_MS = 3e5;
var REQUEST_HISTORY_SIZE = 100;
var DEFAULT_SUCCESS_RATE = 1;
var CIRCUIT_STATE_OPEN = "open";
var CIRCUIT_STATE_CLOSED = "closed";
var CIRCUIT_STATE_HALF_OPEN = "half-open";
var DEFAULT_FAILURE_THRESHOLD = 3;
var DEFAULT_RECOVERY_TIMEOUT_MS = 6e4;
var ERROR_CODE_CIRCUIT_OPEN = "CIRCUIT_OPEN";
var ERROR_CODE_TIMEOUT = "TIMEOUT";
var ERROR_CODE_EXECUTION_ERROR = "EXECUTION_ERROR";
var TIMEOUT_ERROR_PATTERN = "timeout";
var MCP_CONTENT_TYPE_TEXT = "text";
var MCP_OUTPUT_SEPARATOR = "\n";
function safeInvokeEvent(eventName, callback, ...args) {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.error(
      `[ax/provider] Event callback "${eventName}" threw an error:`,
      error instanceof Error ? error.message : error
    );
  }
}
var BaseProvider = class {
  /** Provider configuration */
  config = null;
  /** Event handlers */
  events = {};
  /** Current health status */
  health = {
    ...DEFAULT_HEALTH_VALUES,
    lastCheck: /* @__PURE__ */ new Date()
  };
  /** Request history for success rate calculation */
  requestHistory = [];
  historySize = REQUEST_HISTORY_SIZE;
  /** Circuit breaker recovery timeout ID */
  recoveryTimeoutId = null;
  /**
   * Initialize provider (optional)
   * Override in concrete providers if initialization is needed
   */
  async initialize(config) {
    this.config = config ?? null;
  }
  /**
   * Cleanup provider resources (optional)
   * Override in concrete providers if cleanup is needed
   */
  async cleanup() {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
      this.recoveryTimeoutId = null;
    }
    this.resetHealth();
  }
  // =============================================================================
  // Public Methods
  // =============================================================================
  /**
   * Get current health status
   */
  getHealth() {
    return { ...this.health };
  }
  /**
   * Check if provider is currently healthy
   */
  isHealthy() {
    return this.health.healthy && this.health.circuitState !== CIRCUIT_STATE_OPEN;
  }
  /**
   * Get provider configuration
   */
  getConfig() {
    return this.config;
  }
  /**
   * Set event handlers
   */
  setEvents(events) {
    this.events = { ...this.events, ...events };
  }
  /**
   * Execute with automatic health tracking, circuit breaker, and timeout
   */
  async executeWithTracking(request) {
    if (this.health.circuitState === CIRCUIT_STATE_OPEN) {
      return this.createErrorResponse(
        request,
        ERROR_CODE_CIRCUIT_OPEN,
        `Provider ${this.id} circuit is open due to repeated failures`,
        false
      );
    }
    const start = Date.now();
    safeInvokeEvent("onExecutionStart", this.events.onExecutionStart, request);
    try {
      const timeout = request.timeout ?? DEFAULT_EXECUTION_TIMEOUT_MS;
      const executePromise = this.execute(request);
      let response;
      if (timeout > 0) {
        const timeoutHolder = { id: null };
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHolder.id = setTimeout(
            () => reject(new Error(`Execution timeout after ${timeout}ms`)),
            timeout
          );
        });
        try {
          response = await Promise.race([executePromise, timeoutPromise]);
        } finally {
          if (timeoutHolder.id !== null) {
            clearTimeout(timeoutHolder.id);
          }
        }
      } else {
        response = await executePromise;
      }
      const duration = Date.now() - start;
      this.updateHealth(response.success, duration);
      safeInvokeEvent("onExecutionEnd", this.events.onExecutionEnd, response);
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateHealth(false, duration);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isTimeout = errorMessage.includes(TIMEOUT_ERROR_PATTERN);
      safeInvokeEvent("onError", this.events.onError, error instanceof Error ? error : new Error(errorMessage));
      return this.createErrorResponse(
        request,
        isTimeout ? ERROR_CODE_TIMEOUT : ERROR_CODE_EXECUTION_ERROR,
        errorMessage,
        !isTimeout
        // Timeouts are generally not retryable
      );
    }
  }
  // =============================================================================
  // Protected Methods
  // =============================================================================
  /**
   * Update health status after an operation
   */
  updateHealth(success, latencyMs) {
    const previousHealth = this.health.healthy;
    this.health.lastCheck = /* @__PURE__ */ new Date();
    this.health.latencyMs = latencyMs;
    this.requestHistory.push(success);
    if (this.requestHistory.length > this.historySize) {
      this.requestHistory.shift();
    }
    const successCount = this.requestHistory.filter(Boolean).length;
    this.health.successRate = this.requestHistory.length > 0 ? successCount / this.requestHistory.length : DEFAULT_SUCCESS_RATE;
    if (success) {
      this.health.consecutiveFailures = 0;
      if (this.health.circuitState === CIRCUIT_STATE_HALF_OPEN) {
        this.health.circuitState = CIRCUIT_STATE_CLOSED;
        this.health.healthy = true;
      }
    } else {
      this.health.consecutiveFailures++;
      const threshold = this.config?.circuitBreaker?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
      if (this.health.consecutiveFailures >= threshold && this.health.circuitState !== CIRCUIT_STATE_OPEN) {
        this.health.circuitState = CIRCUIT_STATE_OPEN;
        this.health.healthy = false;
        if (this.recoveryTimeoutId) {
          clearTimeout(this.recoveryTimeoutId);
        }
        const recoveryTimeout = this.config?.circuitBreaker?.recoveryTimeout ?? DEFAULT_RECOVERY_TIMEOUT_MS;
        this.recoveryTimeoutId = setTimeout(() => {
          if (this.health.circuitState === CIRCUIT_STATE_OPEN) {
            this.health.circuitState = CIRCUIT_STATE_HALF_OPEN;
          }
          this.recoveryTimeoutId = null;
        }, recoveryTimeout);
      }
    }
    if (previousHealth !== this.health.healthy) {
      safeInvokeEvent("onHealthChange", this.events.onHealthChange, this.getHealth());
    }
  }
  /**
   * Extract output from MCP tool result
   * Shared by all MCP-based providers (Claude, Gemini)
   */
  extractMcpOutput(result) {
    if (!result || typeof result !== "object") {
      return "";
    }
    const typedResult = result;
    if (Array.isArray(typedResult.content)) {
      return typedResult.content.filter((item) => item.type === MCP_CONTENT_TYPE_TEXT && typeof item.text === "string").map((item) => item.text).join(MCP_OUTPUT_SEPARATOR);
    }
    return "";
  }
  /**
   * Create a standardized error response
   */
  createErrorResponse(request, code, message, retryable) {
    return ExecutionResponseSchema.parse({
      success: false,
      output: "",
      metadata: {
        provider: this.id,
        integrationMode: this.integrationMode,
        duration: 0
      },
      error: message,
      errorDetails: {
        code,
        message,
        retryable
      }
    });
  }
  /**
   * Create a successful response
   */
  createSuccessResponse(output, duration, tokens) {
    return ExecutionResponseSchema.parse({
      success: true,
      output,
      metadata: {
        provider: this.id,
        integrationMode: this.integrationMode,
        duration,
        tokens
      }
    });
  }
  /**
   * Reset health to default state
   */
  resetHealth() {
    this.health = {
      ...DEFAULT_HEALTH_VALUES,
      lastCheck: /* @__PURE__ */ new Date()
    };
    this.requestHistory = [];
  }
};

// src/ax-cli.ts
var DEFAULT_TIMEOUT_MS = 3e5;
var DEFAULT_ENABLE_CHECKPOINTS = true;
var DEFAULT_ENABLE_SUBAGENTS = true;
var ERROR_CODE_NOT_INITIALIZED = "NOT_INITIALIZED";
var ERROR_CODE_EXECUTION_FAILED = "EXECUTION_FAILED";
var ERROR_CODE_SDK_ERROR = "SDK_ERROR";
var AxCliSDKPlaceholder = class {
  config;
  initialized = false;
  constructor(config) {
    this.config = config;
  }
  async initialize() {
    this.initialized = true;
  }
  async execute(options) {
    if (!this.initialized) {
      throw new Error("SDK not initialized");
    }
    return {
      success: true,
      output: `[ax-cli SDK placeholder] Task: ${options.prompt}`,
      tokensUsed: 0
    };
  }
  async healthCheck() {
    return this.initialized;
  }
  async close() {
    this.initialized = false;
  }
};
var AxCliProvider = class extends BaseProvider {
  id = "ax-cli";
  name = "ax-cli";
  integrationMode = "sdk";
  sdk = null;
  sdkConfig;
  constructor(options) {
    super();
    this.sdkConfig = {
      enableCheckpoints: options?.enableCheckpoints ?? DEFAULT_ENABLE_CHECKPOINTS,
      enableSubagents: options?.enableSubagents ?? DEFAULT_ENABLE_SUBAGENTS,
      timeout: options?.timeout ?? DEFAULT_TIMEOUT_MS
    };
  }
  /**
   * Initialize ax-cli SDK
   */
  async initialize() {
    if (this.sdk) {
      return;
    }
    this.sdk = new AxCliSDKPlaceholder(this.sdkConfig);
    await this.sdk.initialize();
  }
  /**
   * Execute a task via ax-cli SDK
   */
  async execute(request) {
    const start = Date.now();
    try {
      await this.ensureInitialized();
      if (!this.sdk) {
        return this.createErrorResponse(
          request,
          ERROR_CODE_NOT_INITIALIZED,
          "ax-cli SDK not initialized",
          true
        );
      }
      const result = await this.sdk.execute({
        prompt: request.task,
        ...request.agent !== null && request.agent !== void 0 && { agent: request.agent },
        timeout: request.timeout,
        stream: request.stream,
        useMcp: true
        // SDK handles MCP internally
      });
      const duration = Date.now() - start;
      if (result.success) {
        return this.createSuccessResponse(
          result.output,
          duration,
          result.tokensUsed !== null && result.tokensUsed !== void 0 ? { total: result.tokensUsed } : void 0
        );
      } else {
        return this.createErrorResponse(
          request,
          ERROR_CODE_EXECUTION_FAILED,
          result.output || "Execution failed",
          true
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createErrorResponse(request, ERROR_CODE_SDK_ERROR, message, true);
    }
  }
  /**
   * Check ax-cli SDK health
   */
  async checkHealth() {
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
  async cleanup() {
    if (this.sdk) {
      await this.sdk.close();
      this.sdk = null;
    }
    await super.cleanup();
  }
  /**
   * Ensure SDK is initialized
   */
  async ensureInitialized() {
    if (!this.sdk) {
      await this.initialize();
    }
  }
};
export {
  AxCliProvider
};
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
//# sourceMappingURL=ax-cli.js.map