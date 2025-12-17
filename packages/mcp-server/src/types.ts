/**
 * MCP Tool definition
 * INV-MCP-004: Tools MUST declare idempotency
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPSchema;
  /**
   * Output schema for the tool result
   * INV-MCP-006: Tools SHOULD declare output schemas
   */
  outputSchema?: MCPSchema;
  /**
   * Whether the tool is idempotent (can be safely retried)
   * INV-MCP-004: Tools MUST declare idempotency
   */
  idempotent?: boolean;
  /**
   * Error codes that are safe to retry
   */
  retryableErrors?: string[];
}

/**
 * MCP Schema (JSON Schema subset)
 */
export interface MCPSchema {
  type: 'object';
  properties: Record<string, MCPProperty>;
  required?: string[];
}

/**
 * MCP Property definition (JSON Schema subset)
 */
export interface MCPProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string | undefined;
  enum?: string[] | undefined;
  items?: MCPProperty | undefined;
  default?: unknown;
  // Additional JSON Schema properties
  minItems?: number | undefined;
  maxItems?: number | undefined;
  minimum?: number | undefined;
  maximum?: number | undefined;
  properties?: Record<string, MCPProperty> | undefined;
  required?: string[] | undefined;
  additionalProperties?: MCPProperty | boolean | undefined;
}

/**
 * MCP Tool call request
 */
export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean | undefined;
}

/**
 * MCP Content block
 */
export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string | undefined;
  data?: string | undefined;
  mimeType?: string | undefined;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string | undefined;
}

/**
 * Tool handler function
 */
export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<MCPToolResult>;

/**
 * MCP message types
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown> | undefined;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: MCPError | undefined;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Standard MCP error codes
 */
export const MCPErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ============================================================================
// MCP Resource Types
// ============================================================================

/**
 * MCP Resource definition
 */
export interface MCPResource {
  /** Resource URI (e.g., "automatosx://workflows") */
  uri: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string | undefined;
  /** MIME type of resource content */
  mimeType?: string | undefined;
}

/**
 * MCP Resource content
 */
export interface MCPResourceContent {
  /** Resource URI */
  uri: string;
  /** MIME type */
  mimeType: string;
  /** Text content */
  text?: string | undefined;
  /** Binary content (base64) */
  blob?: string | undefined;
}

/**
 * Resource handler function
 */
export type ResourceHandler = (
  uri: string,
  params?: Record<string, string>
) => Promise<MCPResourceContent>;

// ============================================================================
// MCP Prompt Types
// ============================================================================

/**
 * MCP Prompt argument definition
 */
export interface MCPPromptArgument {
  /** Argument name */
  name: string;
  /** Description */
  description?: string | undefined;
  /** Whether required */
  required?: boolean | undefined;
}

/**
 * MCP Prompt definition
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string;
  /** Description */
  description?: string | undefined;
  /** Arguments */
  arguments?: MCPPromptArgument[] | undefined;
}

/**
 * MCP Prompt message
 */
export interface MCPPromptMessage {
  /** Role */
  role: 'user' | 'assistant';
  /** Content */
  content: {
    type: 'text';
    text: string;
  };
}

/**
 * Prompt handler function
 */
export type PromptHandler = (
  args: Record<string, string>
) => Promise<{
  description?: string;
  messages: MCPPromptMessage[];
}>;
