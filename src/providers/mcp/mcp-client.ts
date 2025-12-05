/**
 * MCP Client Base Class (v10.6.0)
 *
 * Manages stdio-based JSON-RPC communication with MCP servers.
 * Used for cross-provider execution when AutomatosX needs to
 * call other AI providers via their MCP server interface.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createInterface, Interface } from 'readline';
import { logger } from '../../shared/logging/logger.js';
import { MCP_PROTOCOL_VERSION } from '../../mcp/types.js';
import type {
  McpClientConfig,
  McpClientState,
  JsonRpcRequest,
  JsonRpcResponse,
  McpInitializeParams,
  McpInitializeResult,
  McpToolCallParams,
  McpToolCallResult
} from './types.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class McpClient extends EventEmitter {
  protected config: Required<McpClientConfig>;
  protected process: ChildProcess | null = null;
  protected readline: Interface | null = null;
  protected state: McpClientState;
  protected pendingRequests: Map<string | number, PendingRequest> = new Map();
  protected nextRequestId = 1;
  /** BUG FIX: Maximum request ID before wraparound to prevent Number precision loss.
   * JavaScript loses integer precision after Number.MAX_SAFE_INTEGER (2^53 - 1).
   * Using 1 billion as a safe wraparound point - still unique within any realistic session. */
  private static readonly MAX_REQUEST_ID = 1_000_000_000;
  protected serverInfo: McpInitializeResult['serverInfo'] | null = null;

  constructor(config: McpClientConfig) {
    super();
    this.config = {
      command: config.command,
      args: config.args,
      timeout: config.timeout ?? 30000,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
      env: config.env ?? {}
    };
    this.state = {
      status: 'disconnected',
      lastUsed: 0,
      errorCount: 0
    };
  }

  /**
   * Connect to MCP server by spawning process
   */
  async connect(): Promise<void> {
    if (this.state.status === 'connected') {
      return;
    }

    if (this.state.status === 'connecting') {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const onConnected = () => {
          this.off('error', onError);
          resolve();
        };
        const onError = (err: Error) => {
          this.off('connected', onConnected);
          reject(err);
        };
        this.once('connected', onConnected);
        this.once('error', onError);
      });
    }

    this.state.status = 'connecting';
    const startTime = Date.now();

    logger.debug('[MCP Client] Connecting', {
      command: this.config.command,
      args: this.config.args
    });

    try {
      // Spawn MCP server process
      this.process = spawn(this.config.command, this.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...this.config.env,
          // Force non-interactive mode
          TERM: 'dumb',
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          CI: 'true'
        }
      });

      // Set up readline for JSON-RPC over stdout
      this.readline = createInterface({
        input: this.process.stdout!,
        crlfDelay: Infinity
      });

      // Handle incoming messages
      this.readline.on('line', (line) => this.handleMessage(line));

      // Handle process errors
      this.process.on('error', (err) => this.handleProcessError(err));
      this.process.on('exit', (code) => this.handleProcessExit(code));

      // Handle stderr (log but don't fail)
      this.process.stderr?.on('data', (data) => {
        logger.debug('[MCP Client] stderr', {
          provider: this.config.command,
          data: data.toString().trim()
        });
      });

      // Perform MCP initialize handshake
      await this.initialize();

      this.state.status = 'connected';
      this.state.lastUsed = Date.now();
      this.state.errorCount = 0;

      const connectTime = Date.now() - startTime;
      logger.info('[MCP Client] Connected', {
        provider: this.config.command,
        serverInfo: this.serverInfo,
        connectTimeMs: connectTime
      });

      this.emit('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.state.status = 'error';
      this.state.errorCount++;
      this.state.lastError = err.message;

      logger.error('[MCP Client] Connection failed', {
        provider: this.config.command,
        error: err.message
      });

      this.cleanup();
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.state.status === 'disconnected') {
      return;
    }

    logger.debug('[MCP Client] Disconnecting', {
      provider: this.config.command
    });

    this.rejectAllPending('Client disconnected');
    this.cleanup();
    this.state.status = 'disconnected';

    logger.info('[MCP Client] Disconnected', {
      provider: this.config.command
    });

    this.emit('disconnected');
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolCallResult> {
    if (this.state.status !== 'connected') {
      throw new Error(`MCP client not connected (status: ${this.state.status})`);
    }

    const params: McpToolCallParams = {
      name,
      arguments: args
    };

    const result = await this.sendRequest('tools/call', params);
    this.state.lastUsed = Date.now();

    return result as McpToolCallResult;
  }

  /**
   * Health check - verify connection is still valid
   */
  async healthCheck(): Promise<boolean> {
    if (this.state.status !== 'connected' || !this.process) {
      return false;
    }

    try {
      // Send a ping (list tools as lightweight check)
      await this.sendRequest('tools/list', {}, 5000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.status === 'connected' && this.process !== null;
  }

  /**
   * Get current state
   */
  getState(): McpClientState {
    return { ...this.state };
  }

  /**
   * Get server info from initialize response
   */
  getServerInfo(): McpInitializeResult['serverInfo'] | null {
    return this.serverInfo;
  }

  // ============================================
  // Protected Methods
  // ============================================

  /**
   * Perform MCP initialize handshake
   */
  protected async initialize(): Promise<void> {
    const params: McpInitializeParams = {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'automatosx',
        version: '10.6.0'
      }
    };

    const result = await this.sendRequest('initialize', params) as McpInitializeResult;
    this.serverInfo = result.serverInfo;

    // Send initialized notification
    this.sendNotification('notifications/initialized', {});
  }

  /**
   * Send JSON-RPC request and wait for response
   */
  protected async sendRequest(
    method: string,
    params: unknown,
    timeout?: number
  ): Promise<unknown> {
    // BUG FIX: Capture stdin reference immediately to avoid race condition.
    // Previously checked `this.process?.stdin` but then used `this.process!.stdin!`
    // later, which could fail if the process was disconnected between the check
    // and the write (race condition during concurrent disconnect).
    const stdin = this.process?.stdin;
    if (!stdin) {
      throw new Error('MCP client not connected');
    }

    // BUG FIX: Use wraparound for request IDs to prevent Number precision loss.
    // After MAX_REQUEST_ID, reset to 1 to avoid ID collisions from precision errors.
    const id = this.nextRequestId++;
    if (this.nextRequestId > McpClient.MAX_REQUEST_ID) {
      this.nextRequestId = 1;
    }
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout ?? this.config.timeout;

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      const message = JSON.stringify(request) + '\n';
      try {
        // BUG FIX: Use captured stdin reference instead of non-null assertions
        stdin.write(message);
      } catch (error) {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(id);
        }

        const err = error instanceof Error ? error : new Error(String(error));
        reject(err);
        return;
      }

      logger.debug('[MCP Client] Sent request', {
        id,
        method,
        provider: this.config.command
      });
    });
  }

  /**
   * Send JSON-RPC notification (no response expected)
   *
   * BUG FIX: Handle write errors gracefully. If the process has exited or the
   * pipe is broken, write() could throw an uncaught exception that would crash
   * the application.
   */
  protected sendNotification(method: string, params: unknown): void {
    if (!this.process?.stdin) {
      return;
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    const message = JSON.stringify(notification) + '\n';

    // BUG FIX: Wrap write in try-catch to handle broken pipe errors
    try {
      this.process.stdin.write(message);
    } catch (error) {
      logger.debug('[MCP Client] Failed to send notification (pipe may be closed)', {
        method,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle incoming JSON-RPC message
   */
  protected handleMessage(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: JsonRpcResponse;
    try {
      message = JSON.parse(trimmed);
    } catch (error) {
      logger.warn('[MCP Client] Failed to parse message', {
        provider: this.config.command,
        line: trimmed.substring(0, 200),
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    logger.debug('[MCP Client] Received message', {
      provider: this.config.command,
      id: message.id,
      hasResult: !!message.result,
      hasError: !!message.error
    });

    // Handle notifications from server (no id field)
    if ('method' in message && !('id' in message)) {
      this.emit('notification', message);
      return;
    }

    // Handle response to our request
    if (message.id === undefined || message.id === null) return;

    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    this.pendingRequests.delete(message.id);
    clearTimeout(pending.timeout);

    if (message.error) {
      pending.reject(new Error(`MCP error ${message.error.code}: ${message.error.message}`));
    } else {
      pending.resolve(message.result);
    }
  }

  /**
   * Handle process error
   */
  protected handleProcessError(error: Error): void {
    logger.error('[MCP Client] Process error', {
      provider: this.config.command,
      error: error.message
    });

    this.state.status = 'error';
    this.state.errorCount++;
    this.state.lastError = error.message;

    this.rejectAllPending(`Process error: ${error.message}`);
    this.emit('error', error);
    this.cleanup();
  }

  /**
   * Handle process exit
   */
  protected handleProcessExit(code: number | null): void {
    logger.debug('[MCP Client] Process exited', {
      provider: this.config.command,
      code
    });

    const wasConnected = this.state.status === 'connected';
    const wasConnecting = this.state.status === 'connecting';

    // Update state to disconnected regardless of previous state
    this.state.status = 'disconnected';

    this.rejectAllPending(`Process exited unexpectedly with code ${code}`);

    // Emit appropriate event
    if (wasConnected) {
      this.emit('disconnected');
    } else if (wasConnecting) {
      // Emit error so concurrent connect() callers are notified
      this.emit('error', new Error(`Process exited during connection with code ${code}`));
    }

    this.cleanup();
  }

  /**
   * Reject all pending requests with an error message
   */
  protected rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  /**
   * Cleanup resources
   */
  protected cleanup(): void {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

// ============================================
// Provider Configuration & Factory
// ============================================

/** Shared config values for all MCP providers */
const MCP_DEFAULTS = {
  timeout: 60000,
  healthCheckInterval: 30000
} as const;

/** Provider-specific MCP command configurations */
const PROVIDER_CONFIGS: Record<string, { command: string; args: string[] }> = {
  claude: { command: 'claude', args: ['mcp', 'serve'] },
  gemini: { command: 'gemini', args: ['mcp', 'serve'] },
  codex: { command: 'codex', args: ['mcp-server'] }
};

/** Provider name aliases (maps user-facing names to canonical names) */
const PROVIDER_ALIASES: Record<string, string> = {
  'claude-code': 'claude',
  'gemini-cli': 'gemini',
  'openai': 'codex'
};

/**
 * Factory function to create provider-specific MCP client
 */
export function createMcpClient(provider: string): McpClient {
  // Resolve alias to canonical name
  const canonical = PROVIDER_ALIASES[provider] ?? provider;
  const config = PROVIDER_CONFIGS[canonical];

  if (!config) {
    throw new Error(`Unknown provider for MCP client: ${provider}`);
  }

  return new McpClient({
    ...config,
    ...MCP_DEFAULTS
  });
}
