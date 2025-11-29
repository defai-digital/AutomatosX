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

// src/claude.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import "@ax/schemas";
var MCP_CLIENT_NAME = "automatosx";
var MCP_CLIENT_VERSION = "11.0.0";
var DEFAULT_COMMAND = "claude";
var DEFAULT_ARGS = ["mcp"];
var MCP_TOOL_NAME = "run_task";
var ERROR_CODE_NOT_CONNECTED = "NOT_CONNECTED";
var ERROR_CODE_MCP_ERROR = "MCP_ERROR";
var ClaudeProvider = class extends BaseProvider {
  id = "claude";
  name = "Claude Code";
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
    } catch (error) {
      this.initPromise = null;
      throw error;
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
   * Execute a task via Claude Code MCP
   */
  async execute(request) {
    const start = Date.now();
    try {
      await this.ensureConnected();
      if (!this.client) {
        return this.createErrorResponse(
          request,
          ERROR_CODE_NOT_CONNECTED,
          "Claude MCP client not connected",
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
   * Check Claude Code health via MCP ping
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
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
    } finally {
      if (this.transport) {
        try {
          await this.transport.close();
        } catch (error) {
          console.warn(
            `[ax/claude] Failed to close transport: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
        this.transport = null;
      }
      this.initPromise = null;
      await super.cleanup();
    }
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

// src/gemini.ts
import { Client as Client2 } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport as StdioClientTransport2 } from "@modelcontextprotocol/sdk/client/stdio.js";
import "@ax/schemas";
var MCP_CLIENT_NAME2 = "automatosx";
var MCP_CLIENT_VERSION2 = "11.0.0";
var DEFAULT_COMMAND2 = "gemini";
var DEFAULT_ARGS2 = ["mcp"];
var MCP_TOOL_NAME2 = "run_task";
var ERROR_CODE_NOT_CONNECTED2 = "NOT_CONNECTED";
var ERROR_CODE_MCP_ERROR2 = "MCP_ERROR";
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
    this.command = options?.command ?? DEFAULT_COMMAND2;
    this.args = options?.args ?? DEFAULT_ARGS2;
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
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }
  /**
   * Internal initialization logic
   */
  async doInitialize() {
    if (this.client) {
      return;
    }
    this.transport = new StdioClientTransport2({
      command: this.command,
      args: this.args
    });
    this.client = new Client2(
      {
        name: MCP_CLIENT_NAME2,
        version: MCP_CLIENT_VERSION2
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
          ERROR_CODE_NOT_CONNECTED2,
          "Gemini MCP client not connected",
          true
        );
      }
      const result = await this.client.callTool({
        name: MCP_TOOL_NAME2,
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
      return this.createErrorResponse(request, ERROR_CODE_MCP_ERROR2, message, true);
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
    this.initPromise = null;
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

// src/ax-cli.ts
import "@ax/schemas";
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

// src/openai.ts
import { spawn } from "child_process";
import "@ax/schemas";
var DEFAULT_COMMAND3 = "codex";
var DEFAULT_TIMEOUT_MS2 = 3e5;
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
    this.command = options?.command ?? DEFAULT_COMMAND3;
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
  runCommand(input, timeout = DEFAULT_TIMEOUT_MS2) {
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

// src/index.ts
import "@ax/schemas";
function createProvider(type, options) {
  switch (type) {
    case "claude":
      return new ClaudeProvider(options?.claude);
    case "gemini":
      return new GeminiProvider(options?.gemini);
    case "ax-cli":
      return new AxCliProvider(options?.["ax-cli"]);
    case "openai":
      return new OpenAIProvider(options?.openai);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
function createAllProviders(options) {
  const providers = /* @__PURE__ */ new Map();
  providers.set("claude", new ClaudeProvider(options?.claude));
  providers.set("gemini", new GeminiProvider(options?.gemini));
  providers.set("ax-cli", new AxCliProvider(options?.["ax-cli"]));
  providers.set("openai", new OpenAIProvider(options?.openai));
  return providers;
}
function getIntegrationMode(type) {
  switch (type) {
    case "claude":
    case "gemini":
      return "mcp";
    case "ax-cli":
      return "sdk";
    case "openai":
      return "bash";
    default: {
      const _exhaustive = type;
      throw new Error(`Unknown provider type: ${_exhaustive}`);
    }
  }
}
export {
  AxCliProvider,
  BaseProvider,
  ClaudeProvider,
  GeminiProvider,
  OpenAIProvider,
  createAllProviders,
  createProvider,
  getIntegrationMode
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
 * Claude Code Provider - MCP-based integration
 *
 * Integrates with Claude Code via Model Context Protocol (MCP).
 *
 * @module @ax/providers/claude
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
/**
 * AutomatosX Providers
 *
 * Provider implementations for multi-provider AI orchestration.
 *
 * Supported providers:
 * - Claude Code (MCP)
 * - Gemini CLI (MCP)
 * - ax-cli (SDK)
 * - OpenAI Codex (Bash)
 *
 * @packageDocumentation
 * @module @ax/providers
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map