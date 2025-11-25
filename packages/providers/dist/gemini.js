// src/gemini.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
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
    this.events.onExecutionStart?.(request);
    try {
      const timeout = request.timeout ?? DEFAULT_EXECUTION_TIMEOUT_MS;
      const executePromise = this.execute(request);
      let response;
      if (timeout > 0) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Execution timeout after ${timeout}ms`)), timeout);
        });
        try {
          response = await Promise.race([executePromise, timeoutPromise]);
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        response = await executePromise;
      }
      const duration = Date.now() - start;
      this.updateHealth(response.success, duration);
      this.events.onExecutionEnd?.(response);
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateHealth(false, duration);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isTimeout = errorMessage.includes(TIMEOUT_ERROR_PATTERN);
      this.events.onError?.(error instanceof Error ? error : new Error(errorMessage));
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
      this.events.onHealthChange?.(this.getHealth());
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

// src/gemini.ts
var MCP_CLIENT_NAME = "automatosx";
var MCP_CLIENT_VERSION = "11.0.0";
var DEFAULT_COMMAND = "gemini";
var DEFAULT_ARGS = ["mcp"];
var MCP_TOOL_NAME = "run_task";
var ERROR_CODE_NOT_CONNECTED = "NOT_CONNECTED";
var ERROR_CODE_MCP_ERROR = "MCP_ERROR";
var GeminiProvider = class extends BaseProvider {
  id = "gemini";
  name = "Gemini CLI";
  integrationMode = "mcp";
  client = null;
  transport = null;
  command;
  args;
  /** Promise lock to prevent concurrent initialization race conditions */
  initPromise = null;
  constructor(options) {
    super();
    this.command = options?.command ?? DEFAULT_COMMAND;
    this.args = options?.args ?? DEFAULT_ARGS;
  }
  /**
   * Initialize MCP client connection
   * Uses Promise lock to prevent race conditions with concurrent calls
   */
  async initialize() {
    if (this.client) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }
  /**
   * Internal initialization logic
   */
  async doInitialize() {
    if (this.client) {
      return;
    }
    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args
    });
    this.client = new Client(
      {
        name: MCP_CLIENT_NAME,
        version: MCP_CLIENT_VERSION
      },
      {
        capabilities: {}
      }
    );
    try {
      await this.client.connect(this.transport);
    } catch (error) {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      this.client = null;
      throw error;
    }
  }
  /**
   * Execute a task via Gemini CLI MCP
   */
  async execute(request) {
    const start = Date.now();
    try {
      await this.ensureConnected();
      if (!this.client) {
        return this.createErrorResponse(
          request,
          ERROR_CODE_NOT_CONNECTED,
          "Gemini MCP client not connected",
          true
        );
      }
      const result = await this.client.callTool({
        name: MCP_TOOL_NAME,
        arguments: {
          task: request.task,
          agent: request.agent,
          timeout: request.timeout
        }
      });
      const duration = Date.now() - start;
      const output = this.extractMcpOutput(result);
      return this.createSuccessResponse(output, duration);
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createErrorResponse(request, ERROR_CODE_MCP_ERROR, message, true);
    }
  }
  /**
   * Check Gemini CLI health via MCP ping
   */
  async checkHealth() {
    try {
      await this.ensureConnected();
      if (!this.client) {
        return false;
      }
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Cleanup MCP connection
   */
  async cleanup() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    await super.cleanup();
  }
  /**
   * Ensure client is connected
   */
  async ensureConnected() {
    if (!this.client) {
      await this.initialize();
    }
  }
};
export {
  GeminiProvider
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
 * Gemini CLI Provider - MCP-based integration
 *
 * Integrates with Gemini CLI via Model Context Protocol (MCP).
 *
 * @module @ax/providers/gemini
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=gemini.js.map