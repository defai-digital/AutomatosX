/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * Defines types for stdio JSON-RPC communication between
 * AutomatosX MCP server and MCP clients (e.g., Claude Code).
 */

// Re-export JSON-RPC base types from shared location
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError
} from '../providers/mcp/types.js';

/** Default MCP protocol version (v3 - 2025-11-25) */
export const MCP_PROTOCOL_VERSION = '2025-11-25';
/** Supported versions (descending order, newest preferred) */
export const MCP_SUPPORTED_VERSIONS = ['2025-11-25', '2024-12-05', '2024-11-05'] as const;
export type SupportedMcpProtocolVersion = typeof MCP_SUPPORTED_VERSIONS[number];

export interface McpCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  /** v2: Resource templates */
  resourceTemplates?: Record<string, unknown>;
  /** v2+: experimental capability channel */
  experimental?: Record<string, unknown>;
}

// MCP Protocol Messages
export interface McpInitializeRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: McpCapabilities;
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface McpInitializeResponse {
  protocolVersion: string;
  capabilities: McpCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface McpToolListRequest {
  method: 'tools/list';
  params?: Record<string, never>;
}

export interface McpToolListResponse {
  tools: McpTool[];
}

export interface McpToolCallRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface McpToolCallResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'application/json'; json: unknown }
  >;
  isError?: boolean;
}

// MCP resources (optional)
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceListRequest {
  method: 'resources/list';
  params?: Record<string, never>;
}

export interface McpResourceListResponse {
  resources: McpResource[];
}

export interface McpResourceReadRequest {
  method: 'resources/read';
  params: {
    uri: string;
  };
}

export interface McpResourceReadResponse {
  uri: string;
  mimeType?: string;
  contents: Array<{ type: 'text'; text: string } | { type: 'application/json'; json: unknown }>;
}

// MCP resource templates (v2)
export interface McpResourceTemplate {
  name: string;
  uriTemplate: string;
  description?: string;
  mimeType?: string;
  variableDefinitions?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpResourceTemplateListRequest {
  method: 'resources/templates/list';
  params?: Record<string, never>;
}

export interface McpResourceTemplateListResponse {
  resourceTemplates: McpResourceTemplate[];
}

export interface McpResourceTemplateReadRequest {
  method: 'resources/templates/read';
  params: {
    uri: string;
    variables?: Record<string, string>;
  };
}

export interface McpResourceTemplateReadResponse {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  contents: Array<{ type: 'text'; text: string } | { type: 'application/json'; json: unknown }>;
}

// MCP prompts (optional)
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpPromptListRequest {
  method: 'prompts/list';
  params?: Record<string, never>;
}

export interface McpPromptListResponse {
  prompts: McpPrompt[];
}

export interface McpPromptGetRequest {
  method: 'prompts/get';
  params: {
    name: string;
    arguments?: Record<string, string>;
  };
}

export interface McpPromptGetResponse {
  prompt: McpPrompt;
  content: Array<{ type: 'text'; text: string } | { type: 'application/json'; json: unknown }>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Optional auth/allowlist tag */
  requiresAuth?: boolean;
  /** Optional flag to signal hidden tools when allowlisting */
  hidden?: boolean;
}

// Tool-Specific Input/Output Types

// v10.5.0: MCP Session for Smart Routing
// v12.0.0: Removed ax-cli (deprecated), added glm/grok
export interface McpSession {
  clientInfo: {
    name: string;
    version?: string;
  };
  normalizedProvider: 'claude' | 'gemini' | 'codex' | 'glm' | 'grok' | 'unknown';
  initTime: number;
}

/**
 * v12.0.0: Enhanced MCP Session for bidirectional communication
 *
 * Extends McpSession with:
 * - Unique session ID for isolation
 * - Memory namespace for per-session memory
 * - Activity tracking for timeout management
 * - Agent context for delegation chains
 */
export interface EnhancedMcpSession extends McpSession {
  /** Unique session identifier */
  sessionId: string;
  /** Memory namespace for session isolation */
  memoryNamespace: string;
  /** Session creation timestamp */
  createdAt: number;
  /** Last activity timestamp (for timeout) */
  lastActivityAt: number;
  /** Current agent (if any) */
  currentAgent?: string;
  /** Parent session ID (for delegated calls) */
  parentSessionId?: string;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * MCP Session Manager configuration
 */
export interface McpSessionManagerConfig {
  /** Maximum concurrent sessions (default: 10) */
  maxSessions?: number;
  /** Session timeout in ms (default: 30 minutes) */
  sessionTimeoutMs?: number;
  /** Enable memory namespace isolation (default: true) */
  enableMemoryIsolation?: boolean;
}

// run_agent (v10.5.0: Added mode for Smart Routing)
// v12.5.1: Made agent optional - system auto-selects best agent based on task
export interface RunAgentInput {
  /** Agent name. If omitted, system auto-selects the best agent for the task. */
  agent?: string;
  task: string;
  provider?: 'claude' | 'gemini' | 'openai';
  no_memory?: boolean;
  /** v10.5.0: Execution mode - auto (default), context (always return context), execute (always spawn) */
  mode?: 'auto' | 'context' | 'execute';
}

export interface RunAgentOutput {
  content: string;
  agent: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs?: number;
  /** v10.5.0: Routing decision - context_returned (same-provider), executed (cross-provider) */
  routingDecision?: 'context_returned' | 'executed';
  /** v10.6.0: How the task was executed - mcp_pooled, mcp_new, cli_spawn, cli_fallback, context_returned */
  executionMode?: 'mcp_pooled' | 'mcp_new' | 'cli_spawn' | 'cli_fallback' | 'context_returned';
  /** v10.5.0: Context returned when caller == best provider (Smart Routing) */
  agentContext?: {
    agentProfile: {
      name: string;
      role: string;
      expertise: string[];
      systemPrompt: string;
    };
    relevantMemory: Array<{
      id: number;
      content: string;
      similarity: number;
    }>;
    enhancedPrompt: string;
    detectedCaller: string;
    recommendedProvider: string;
  };
}

// list_agents
export interface ListAgentsOutput {
  agents: Array<{
    name: string;
    displayName?: string;
    role?: string;
    team?: string;
    // v5.7.0+: Agent Selection Metadata for improved routing
    selectionMetadata?: {
      primaryIntents?: string[];
      secondarySignals?: string[];
      negativeIntents?: string[];
      redirectWhen?: Array<{
        phrase: string;
        suggest: string;
      }>;
    };
  }>;
}

// search_memory
export interface SearchMemoryInput {
  query: string;
  limit?: number;
}

export interface SearchMemoryOutput {
  results: Array<{
    id: number;
    similarity: number;
    content: string;
    metadata: {
      agent?: string;
      timestamp?: string;
      [key: string]: unknown;
    };
  }>;
}

// get_status
export interface GetStatusOutput {
  version: string;
  providers: string[];
  memory: {
    entries: number;
    dbSize?: string;
  };
  sessions: {
    active: number;
    total: number;
  };
}

// ============================================
// Phase 2: Session Management Tools
// ============================================

// session_create
export interface SessionCreateInput {
  name: string;
  agent: string;
}

export interface SessionCreateOutput {
  sessionId: string;
  name: string;
  agent: string;
  status: string;
  createdAt: string;
}

// session_list
export interface SessionListOutput {
  sessions: Array<{
    id: string;
    task: string;
    initiator: string;
    status: string;
    agents: string[];
    createdAt: string;
    updatedAt: string;
  }>;
}

// session_status
export interface SessionStatusInput {
  id: string;
}

export interface SessionStatusOutput {
  id: string;
  task: string;
  initiator: string;
  status: string;
  agents: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// session_complete
export interface SessionCompleteInput {
  id: string;
}

export interface SessionCompleteOutput {
  success: boolean;
  sessionId: string;
  status: string;
}

// session_fail
export interface SessionFailInput {
  id: string;
  reason: string;
}

export interface SessionFailOutput {
  success: boolean;
  sessionId: string;
  status: string;
  error: string;
}

// ============================================
// Phase 2: Memory Management Tools
// ============================================

// memory_add
export interface MemoryAddInput {
  content: string;
  metadata?: {
    agent?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

export interface MemoryAddOutput {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// memory_list
export interface MemoryListInput {
  agent?: string;
  limit?: number;
}

export interface MemoryListOutput {
  entries: Array<{
    id: number;
    content: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  total: number;
}

// memory_delete
export interface MemoryDeleteInput {
  id: number;
}

export interface MemoryDeleteOutput {
  success: boolean;
  id: number;
}

// memory_export
export interface MemoryExportInput {
  path: string;
}

export interface MemoryExportOutput {
  success: boolean;
  path: string;
  entries: number;
}

// memory_import
export interface MemoryImportInput {
  path: string;
}

export interface MemoryImportOutput {
  success: boolean;
  imported: number;
  skipped: number;
}

// memory_stats
export interface MemoryStatsOutput {
  totalEntries: number;
  dbSize: string;
  byAgent: Record<string, number>;
}

// memory_clear
export interface MemoryClearOutput {
  success: boolean;
  deleted: number;
}

// Tool Handler Type
export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context?: { signal?: AbortSignal }
) => Promise<TOutput>;

// Error Codes (align with JSON-RPC standard)
export enum McpErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // Custom error codes (application-specific)
  ToolNotFound = -32001,
  ToolExecutionFailed = -32002,
  InvalidToolInput = -32003,
  ServerNotInitialized = -32004,

  // Cancellation (JSON-RPC best practice)
  RequestCancelled = -32800,
}
