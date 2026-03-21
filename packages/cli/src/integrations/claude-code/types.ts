/**
 * Claude Code Integration - Type Definitions
 *
 * Types for Claude Code 2026 integration:
 * settings.json management, hooks, subagent frontmatter, .mcp.json.
 */

// ─── MCP ──────────────────────────────────────────────────────────────────────

export type McpTransport = 'stdio' | 'http' | 'sse';

export interface ClaudeMCPServer {
  type?: McpTransport;
  /** Required for stdio transport */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Required for http/sse transport */
  url?: string;
  headers?: Record<string, string>;
  description?: string;
}

export interface MCPManifest {
  version?: string;
  name?: string;
  description?: string;
  mcpServers?: Record<string, ClaudeMCPServer>;
  [key: string]: unknown;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface ClaudeCodeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  hooks?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export type HookType = 'command' | 'prompt' | 'http';
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'SessionStart'
  | 'SessionEnd'
  | 'SubagentStart'
  | 'SubagentStop';

export interface HookEntry {
  type: HookType;
  command?: string;
  timeout?: number;
  url?: string;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

export interface HooksConfig {
  [event: string]: HookMatcher[];
}

// ─── Subagent frontmatter ─────────────────────────────────────────────────────

export type SubagentPermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'dontAsk'
  | 'bypassPermissions'
  | 'plan';
export type SubagentMemoryScope = 'user' | 'project' | 'local';
export type SubagentEffort = 'low' | 'medium' | 'high' | 'max';

export interface SubagentFrontmatter {
  name: string;
  description: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: string;
  permissionMode?: SubagentPermissionMode;
  maxTurns?: number;
  memory?: SubagentMemoryScope;
  background?: boolean;
  isolation?: boolean;
  effort?: SubagentEffort;
  mcpServers?: string[];
  skills?: string[];
}

// ─── Agent claude_code config (stored in agent YAML) ─────────────────────────

export interface AgentClaudeCodeConfig {
  model?: string;
  permissionMode?: SubagentPermissionMode;
  maxTurns?: number;
  memory?: SubagentMemoryScope;
  background?: boolean;
  isolation?: boolean;
  effort?: SubagentEffort;
  mcpServers?: string[];
  skills?: string[];
  tools?: { allow?: string[]; deny?: string[] };
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

export interface ClaudeCodeDiagnostics {
  settingsConfigured: boolean;
  mcpProjectConfigGenerated: boolean;
  hooksGenerated: boolean;
  subagentFilesGenerated: boolean;
  errors: string[];
  warnings: string[];
}
