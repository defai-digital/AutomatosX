/**
 * ax-cli SDK v1.3.0 Type Definitions
 *
 * Typed interfaces for ax-cli SDK events and managers.
 * These provide type safety when working with SDK callbacks.
 *
 * @module integrations/ax-cli-sdk/sdk-types
 */

/**
 * Result type for type-safe error handling
 *
 * PRODUCTION STANDARD: Use this type across all SDK adapters for consistent
 * error handling. Prefer Result<T> over throwing exceptions for recoverable errors.
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number> {
 *   if (b === 0) {
 *     return { ok: false, error: new Error('Division by zero') };
 *   }
 *   return { ok: true, value: a / b };
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Helper to create a success result
 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Helper to create an error result
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * SDK Agent interface - minimal typed interface for ax-cli SDK agent
 *
 * PRODUCTION STANDARD: Use this instead of 'any' when working with SDK agents.
 * Note: Uses 'unknown' for stream chunks to allow SDK-specific types to pass through.
 */
export interface SDKAgent {
  /** Process user message and return async stream of chunks */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processUserMessageStream(prompt: string): AsyncIterable<any>;

  /** Get chat history if available */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getChatHistory?(): any[];

  /** Dispose agent resources */
  dispose?(): void | Promise<void>;

  /** Get current model (SDK-specific) */
  getCurrentModel?(): string;

  /** Event subscription (optional EventEmitter-like) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on?(event: string, handler: (...args: any[]) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off?(event: string, handler: (...args: any[]) => void): void;
  removeAllListeners?(event: string): void;
}

/**
 * SDK stream chunk - unified type for all chunk types
 */
export interface SDKStreamChunk {
  type: 'content' | 'reasoning' | 'token_count' | 'tool_calls';
  content?: string;
  reasoningContent?: string;
  tokenCount?: number;
  toolCalls?: ToolCall[];
}

/**
 * SDK chat entry
 */
export interface SDKChatEntry {
  type: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * SDK Subagent interface
 */
export interface SDKSubagent extends SDKAgent {
  /** Role of the subagent */
  role?: string;
}

/**
 * Streaming content chunk from agent
 */
export interface StreamChunk {
  type: 'content' | 'reasoning';
  content?: string;
  reasoningContent?: string;
}

/**
 * Tool call information
 */
export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Token count event data
 */
export interface TokenCountData {
  tokenCount: number;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Agent status event
 */
export interface AgentStatusData {
  status: 'idle' | 'thinking' | 'executing' | 'waiting';
  detail?: string;
}

/**
 * AgentEvents interface (SDK v1.3.0)
 *
 * Typed event handlers for LLMAgent events.
 *
 * @example
 * ```typescript
 * const events: AgentEvents = {
 *   stream: (chunk) => console.log(chunk.content),
 *   tool_start: (name, args) => console.log(`Tool: ${name}`),
 *   tool_complete: (name, result) => console.log(`Done: ${name}`),
 *   token_count: (data) => console.log(`Tokens: ${data.tokenCount}`),
 *   error: (error) => console.error(error),
 *   status: (data) => console.log(`Status: ${data.status}`)
 * };
 * ```
 */
export interface AgentEvents {
  /** Stream content/reasoning chunks */
  stream?: (chunk: StreamChunk) => void;

  /** Tool execution started */
  tool_start?: (name: string, args: Record<string, unknown>) => void;

  /** Tool execution completed */
  tool_complete?: (name: string, result: unknown) => void;

  /** Token count update */
  token_count?: (data: TokenCountData) => void;

  /** Error occurred */
  error?: (error: Error) => void;

  /** Agent status changed */
  status?: (data: AgentStatusData) => void;
}

/**
 * Subagent state
 */
export type SubagentStateType = 'idle' | 'running' | 'completed' | 'failed';

/**
 * Subagent state change data
 */
export interface SubagentStateChangeData {
  previousState: SubagentStateType;
  currentState: SubagentStateType;
  subagentId: string;
}

/**
 * Subagent progress data
 */
export interface SubagentProgressData {
  subagentId: string;
  progress: number; // 0-100
  message?: string;
}

/**
 * SubagentEvents interface (SDK v1.3.0)
 *
 * Typed event handlers for Subagent events.
 *
 * @example
 * ```typescript
 * const events: SubagentEvents = {
 *   state_change: (data) => console.log(`State: ${data.currentState}`),
 *   progress: (data) => console.log(`Progress: ${data.progress}%`),
 *   task_start: (task) => console.log(`Started: ${task}`),
 *   task_complete: (task, result) => console.log(`Done: ${task}`),
 *   error: (error) => console.error(error)
 * };
 * ```
 */
export interface SubagentEvents {
  /** State changed */
  state_change?: (data: SubagentStateChangeData) => void;

  /** Progress update */
  progress?: (data: SubagentProgressData) => void;

  /** Task started */
  task_start?: (task: string) => void;

  /** Task completed */
  task_complete?: (task: string, result: string) => void;

  /** Error occurred */
  error?: (error: Error) => void;
}

/**
 * Progress event for ProgressReporter
 */
export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  taskId: string;
  progress?: number;
  message?: string;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * ProgressReporter callback type
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * ProgressReporter interface (SDK v1.3.0)
 *
 * Reports progress for long-running operations.
 */
export interface IProgressReporter {
  /** Register progress callback */
  onProgress(callback: ProgressCallback): void;

  /** Start a new task */
  startTask(taskId: string, message?: string): void;

  /** Update task progress */
  updateProgress(taskId: string, progress: number, message?: string): void;

  /** Complete a task */
  completeTask(taskId: string, message?: string): void;

  /** Report task error */
  reportError(taskId: string, error: Error): void;
}

/**
 * Permission tier levels
 */
export type PermissionTier = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  tier: PermissionTier;
  reason?: string;
  requiresConfirmation?: boolean;
}

/**
 * PermissionManager interface (SDK v1.3.0)
 *
 * Manages permission/risk tiers for tool execution.
 */
export interface IPermissionManager {
  /** Check if action is permitted */
  checkPermission(action: string, context?: Record<string, unknown>): PermissionCheckResult;

  /** Set permission tier for an action */
  setPermissionTier(action: string, tier: PermissionTier): void;

  /** Get current permission tier */
  getPermissionTier(action: string): PermissionTier;
}

/**
 * MCPManagerV2 configuration
 */
export interface MCPManagerV2Config {
  /** Auto-start servers on initialization */
  autoStart?: boolean;

  /** Server startup timeout in ms */
  startupTimeout?: number;

  /** Health check interval in ms */
  healthCheckInterval?: number;

  /** Enable server caching */
  enableCaching?: boolean;
}

/**
 * MCP server status
 */
export interface MCPServerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting';
  lastHealthCheck?: Date;
  error?: string;
  toolCount?: number;
}

/**
 * MCPManagerV2 interface (SDK v1.3.0)
 *
 * Enhanced MCP server lifecycle management.
 */
export interface IMCPManagerV2 {
  /** Initialize all configured servers */
  initialize(): Promise<void>;

  /** Get server status */
  getServerStatus(name: string): MCPServerStatus | undefined;

  /** Get all server statuses */
  getAllServerStatuses(): MCPServerStatus[];

  /** Start a specific server */
  startServer(name: string): Promise<void>;

  /** Stop a specific server */
  stopServer(name: string): Promise<void>;

  /** Restart a specific server */
  restartServer(name: string): Promise<void>;

  /** Perform health check on all servers */
  healthCheck(): Promise<Map<string, boolean>>;

  /** Shutdown all servers */
  shutdown(): Promise<void>;
}

/**
 * UnifiedLogger log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  source?: string;
}

/**
 * UnifiedLogger interface (SDK v1.3.0)
 *
 * Centralized logging system.
 */
export interface IUnifiedLogger {
  /** Log debug message */
  debug(message: string, context?: Record<string, unknown>): void;

  /** Log info message */
  info(message: string, context?: Record<string, unknown>): void;

  /** Log warning message */
  warn(message: string, context?: Record<string, unknown>): void;

  /** Log error message */
  error(message: string, context?: Record<string, unknown>): void;

  /** Set minimum log level */
  setLevel(level: LogLevel): void;

  /** Get recent log entries */
  getRecentLogs(count?: number): LogEntry[];
}
