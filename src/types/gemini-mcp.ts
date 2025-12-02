/**
 * Gemini MCP Integration Types
 *
 * Model Context Protocol (MCP) allows extending Gemini CLI
 * with custom tools and integrations.
 */

export interface MCPServerConfig {
  name: string;
  enabled: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  config?: Record<string, unknown>;
  autoStart?: boolean;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
}

export interface MCPServerStatus {
  name: string;
  running: boolean;
  pid?: number;
  startedAt?: Date;
  lastHealthCheck?: Date;
  errorCount: number;
  lastError?: string;
}

export interface MCPToolCall {
  server: string;
  tool: string;
  args: Record<string, unknown>;
  timestamp: Date;
}

export interface MCPToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * Gemini Settings.json Structure
 * ~/.gemini/settings.json
 */
export interface GeminiSettings {
  mcp?: Record<string, MCPServerConfig>;
  // Other Gemini CLI settings...
}