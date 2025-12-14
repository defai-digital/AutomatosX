/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPSchema;
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
 * MCP Property definition
 */
export interface MCPProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string | undefined;
  enum?: string[] | undefined;
  items?: MCPProperty | undefined;
  default?: unknown;
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
