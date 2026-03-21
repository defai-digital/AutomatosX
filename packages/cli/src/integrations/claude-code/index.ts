/**
 * Claude Code Integration
 *
 * Bidirectional integration between AutomatosX and Claude Code 2026:
 * settings.json management, hooks, .mcp.json, per-agent subagent files.
 */

export { ClaudeCodeIntegration } from './claude-code-integration.js';
export { SettingsManager } from './settings-manager.js';
export { McpProjectConfigGenerator } from './mcp-project-config.js';
export { HooksGenerator } from './hooks-generator.js';
export { SubagentGenerator } from './subagent-generator.js';

export type {
  ClaudeCodeSetupOptions,
  ClaudeCodeSetupResult,
} from './claude-code-integration.js';

export type { HooksGeneratorOptions, HooksGenerateResult } from './hooks-generator.js';
export type { SubagentGeneratorOptions, SubagentGenerateResult } from './subagent-generator.js';

export type {
  ClaudeCodeDiagnostics,
  ClaudeCodeSettings,
  HookEvent,
  HookType,
  HooksConfig,
  HookMatcher,
  HookEntry,
  McpTransport,
  ClaudeMCPServer,
  MCPManifest,
  ValidationResult,
  SubagentFrontmatter,
  SubagentPermissionMode,
  SubagentMemoryScope,
  SubagentEffort,
  AgentClaudeCodeConfig,
} from './types.js';
