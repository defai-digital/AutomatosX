/**
 * Claude Code per-agent configuration types.
 *
 * Kept in src/types/ (not in src/integrations/) so that agent.ts can import
 * without creating a circular dependency through the integrations layer.
 *
 * @module types/agent-claude-code
 */

/** Claude Code subagent permission mode */
export type SubagentPermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'dontAsk'
  | 'bypassPermissions'
  | 'plan';

/** Claude Code subagent memory scope */
export type SubagentMemoryScope = 'user' | 'project' | 'local';

/** Claude Code effort level (Opus 4.6+) */
export type SubagentEffort = 'low' | 'medium' | 'high' | 'max';

/**
 * Optional claude_code: section in agent YAML profiles.
 * When present, overrides defaults used when generating
 * .claude/agents/<name>.md subagent files.
 *
 * Example in backend.yaml:
 * ```yaml
 * claude_code:
 *   model: sonnet
 *   permissionMode: acceptEdits
 *   maxTurns: 50
 *   memory: project
 *   tools:
 *     allow: [Read, Edit, Write, Bash, Glob, Grep]
 *     deny: [WebSearch]
 * ```
 */
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
  tools?: {
    allow?: string[];
    deny?: string[];
  };
}
