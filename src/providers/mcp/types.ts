/**
 * MCP Client Types (v10.6.0)
 *
 * Type definitions for MCP Client connection pooling.
 * Used for cross-provider execution when AutomatosX needs to
 * call other AI providers (Claude, Gemini, Codex) via MCP.
 */

// ============================================
// Configuration Types
// ============================================

export interface McpClientConfig {
  /** Command to start MCP server (e.g., 'claude', 'gemini') */
  command: string;
  /** Arguments for MCP server (e.g., ['mcp', 'serve']) */
  args: string[];
  /** Connection timeout in ms (default: 30000) */
  timeout?: number;
  /** Health check interval in ms (default: 30000) */
  healthCheckInterval?: number;
  /** Environment variables to pass to spawned process */
  env?: Record<string, string>;
}

export interface PoolConfig {
  /** Max connections per provider (default: 2) */
  maxConnectionsPerProvider: number;
  /** Idle timeout in ms before closing connection (default: 300000 = 5min) */
  idleTimeoutMs: number;
  /** Health check interval in ms (default: 30000) */
  healthCheckIntervalMs: number;
  /** Max time to wait for connection in ms (default: 10000) */
  acquireTimeoutMs: number;
  /** Whether to fallback to CLI on MCP failure (default: true) */
  fallbackToCli: boolean;
}

export interface CrossProviderConfig {
  /** Execution mode: 'mcp' | 'cli' | 'auto' (default: 'auto') */
  mode: 'mcp' | 'cli' | 'auto';
  /** MCP pool configuration */
  mcpPool: PoolConfig;
  /** Fallback to CLI spawn on MCP failure */
  fallbackToCli: boolean;
}

// ============================================
// State Types
// ============================================

export type McpClientStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpClientState {
  /** Current connection status */
  status: McpClientStatus;
  /** Timestamp of last successful use */
  lastUsed: number;
  /** Consecutive error count */
  errorCount: number;
  /** Last error message if any */
  lastError?: string;
}

export interface PooledClientInfo {
  /** Provider name (claude, gemini, codex) */
  provider: string;
  /** Whether client is currently in use */
  inUse: boolean;
  /** Timestamp of last use */
  lastUsed: number;
  /** Total number of times used */
  useCount: number;
  /** Current state */
  state: McpClientState;
}

export interface PoolStats {
  /** Stats per provider */
  providers: Record<string, ProviderPoolStats>;
  /** Total active connections across all providers */
  totalConnections: number;
  /** Total connections in use */
  connectionsInUse: number;
}

export interface ProviderPoolStats {
  /** Number of connections in pool */
  connections: number;
  /** Number of connections currently in use */
  inUse: number;
  /** Number of connections available */
  available: number;
  /** Total requests served */
  totalRequests: number;
  /** Average latency in ms */
  avgLatencyMs: number;
}

// ============================================
// JSON-RPC Types (MCP Protocol)
// ============================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================
// MCP Protocol Types
// ============================================

export interface McpInitializeParams {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// ============================================
// Error Types
// ============================================

export class McpClientError extends Error {
  public readonly code: string;
  public readonly provider?: string;

  constructor(
    message: string,
    code: string,
    provider?: string,
    cause?: Error
  ) {
    super(message, { cause });
    this.name = 'McpClientError';
    this.code = code;
    this.provider = provider;
  }
}

export class ConnectionTimeoutError extends McpClientError {
  constructor(provider: string, timeoutMs: number) {
    super(
      `Connection to ${provider} MCP server timed out after ${timeoutMs}ms`,
      'CONNECTION_TIMEOUT',
      provider
    );
    this.name = 'ConnectionTimeoutError';
  }
}

export class PoolExhaustedError extends McpClientError {
  constructor(provider: string, maxConnections: number) {
    super(
      `Pool exhausted for ${provider}: all ${maxConnections} connections in use`,
      'POOL_EXHAUSTED',
      provider
    );
    this.name = 'PoolExhaustedError';
  }
}

export class ProtocolError extends McpClientError {
  constructor(message: string, provider?: string) {
    super(message, 'PROTOCOL_ERROR', provider);
    this.name = 'ProtocolError';
  }
}

// ============================================
// Event Types
// ============================================

export type PoolEventType =
  | 'connection_created'
  | 'connection_acquired'
  | 'connection_released'
  | 'connection_closed'
  | 'connection_error'
  | 'health_check_failed';

export interface PoolEvent {
  type: PoolEventType;
  provider: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// ============================================
// Execution Types
// ============================================

export type ExecutionMode = 'mcp_pooled' | 'mcp_new' | 'cli_spawn' | 'cli_fallback' | 'context_returned';

export interface CrossProviderResult {
  /** Execution result content */
  content: string;
  /** How the task was executed */
  executionMode: ExecutionMode;
  /** Latency in ms */
  latencyMs: number;
  /** Provider that executed the task */
  provider: string;
  /** Token usage if available */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}
