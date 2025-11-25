// src/openai.ts
import { spawn } from "child_process";
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

// src/openai.ts
var DEFAULT_COMMAND = "codex";
var DEFAULT_TIMEOUT_MS = 3e5;
var HEALTH_CHECK_TIMEOUT_MS = 5e3;
var NON_INTERACTIVE_TERM = "dumb";
var PROMPT_ARG_FLAG = "-p";
var PROCESS_SUCCESS_EXIT_CODE = 0;
var PROCESS_KILL_SIGNAL = "SIGTERM";
var STDIO_PIPE_CONFIG = ["pipe", "pipe", "pipe"];
var HEALTH_CHECK_KEYWORD_CODEX = "codex";
var HEALTH_CHECK_KEYWORD_OPENAI = "openai";
var ERROR_CODE_BASH_ERROR = "BASH_ERROR";
var OpenAIProvider = class extends BaseProvider {
  id = "openai";
  name = "OpenAI Codex";
  integrationMode = "bash";
  command;
  defaultArgs;
  activeProcess = null;
  constructor(options) {
    super();
    this.command = options?.command ?? DEFAULT_COMMAND;
    this.defaultArgs = options?.args ?? [];
  }
  /**
   * Execute a task via OpenAI Codex CLI
   */
  async execute(request) {
    const start = Date.now();
    try {
      const output = await this.runCommand(request.task, request.timeout);
      const duration = Date.now() - start;
      return this.createSuccessResponse(output, duration);
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createErrorResponse(request, ERROR_CODE_BASH_ERROR, message, true);
    }
  }
  /**
   * Check OpenAI Codex CLI availability
   */
  async checkHealth() {
    try {
      const output = await this.runCommand("--version", HEALTH_CHECK_TIMEOUT_MS);
      return output.includes(HEALTH_CHECK_KEYWORD_CODEX) || output.includes(HEALTH_CHECK_KEYWORD_OPENAI) || output.length > 0;
    } catch {
      return false;
    }
  }
  /**
   * Cleanup any active processes
   */
  async cleanup() {
    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = null;
    }
    await super.cleanup();
  }
  /**
   * Run a command via subprocess
   */
  runCommand(input, timeout = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const args = [...this.defaultArgs, PROMPT_ARG_FLAG, input];
      const proc = spawn(this.command, args, {
        stdio: STDIO_PIPE_CONFIG,
        timeout,
        env: {
          ...process.env,
          // Ensure non-interactive mode
          TERM: NON_INTERACTIVE_TERM
        }
      });
      this.activeProcess = proc;
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timeoutId;
      const onStdoutData = (data) => {
        stdout += data.toString();
      };
      const onStderrData = (data) => {
        stderr += data.toString();
      };
      const onClose = (code) => {
        settle(() => {
          if (code === PROCESS_SUCCESS_EXIT_CODE) {
            resolve(stdout.trim());
          } else {
            reject(new Error(stderr.trim() || `Process exited with code ${code}`));
          }
        });
      };
      const onError = (error) => {
        settle(() => reject(error));
      };
      const settle = (fn) => {
        if (!settled) {
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          proc.stdout.removeListener("data", onStdoutData);
          proc.stderr.removeListener("data", onStderrData);
          proc.removeListener("close", onClose);
          proc.removeListener("error", onError);
          this.activeProcess = null;
          fn();
        }
      };
      proc.stdout.on("data", onStdoutData);
      proc.stderr.on("data", onStderrData);
      proc.on("close", onClose);
      proc.on("error", onError);
      timeoutId = setTimeout(() => {
        if (!settled && this.activeProcess === proc) {
          proc.kill(PROCESS_KILL_SIGNAL);
          settle(() => reject(new Error(`Command timed out after ${timeout}ms`)));
        }
      }, timeout);
    });
  }
};
export {
  OpenAIProvider
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
 * OpenAI Codex Provider - Bash-based integration
 *
 * Integrates with OpenAI Codex via process spawning (bash mode).
 * Using bash mode because OpenAI's MCP implementation has known bugs.
 *
 * @module @ax/providers/openai
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=openai.js.map