/**
 * Workflow Mode Definitions
 *
 * Defines workflow modes that control agent behavior and tool availability.
 * Modes can restrict which tools are available and provide mode-specific instructions.
 *
 * @since v11.3.0
 */

import { z } from 'zod';

/**
 * Available workflow modes
 */
export type WorkflowMode = 'default' | 'plan' | 'iterate' | 'review';

/**
 * Zod schema for WorkflowMode
 */
export const WorkflowModeSchema = z.enum(['default', 'plan', 'iterate', 'review']);

/**
 * Configuration for a workflow mode
 */
export interface WorkflowModeConfig {
  /** Mode identifier */
  name: WorkflowMode;
  /** Human-readable description */
  description: string;
  /** Display name for UI */
  displayName: string;
  /** Tools that are allowed in this mode (whitelist, if specified) */
  allowedTools?: string[];
  /** Tools that are blocked in this mode (blacklist) */
  blockedTools?: string[];
  /** System instructions injected when this mode is active */
  systemInstructions: string;
  /** Whether this mode can be nested within another mode */
  allowNesting: boolean;
  /** Maximum depth if nesting is allowed */
  maxNestingDepth?: number;
  /** Auto-exit conditions */
  autoExitConditions?: {
    /** Exit after N turns */
    maxTurns?: number;
    /** Exit when specific tool is used */
    onToolUse?: string[];
    /** Exit on specific keywords in response */
    onKeywords?: string[];
  };
}

/**
 * Zod schema for WorkflowModeConfig
 */
export const WorkflowModeConfigSchema = z.object({
  name: WorkflowModeSchema,
  description: z.string(),
  displayName: z.string(),
  allowedTools: z.array(z.string()).optional(),
  blockedTools: z.array(z.string()).optional(),
  systemInstructions: z.string(),
  allowNesting: z.boolean(),
  maxNestingDepth: z.number().int().positive().optional(),
  autoExitConditions: z.object({
    maxTurns: z.number().int().positive().optional(),
    onToolUse: z.array(z.string()).optional(),
    onKeywords: z.array(z.string()).optional()
  }).optional()
});

/**
 * Read-only tools that don't modify the codebase
 */
export const READ_ONLY_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'Task',
  'AskUserQuestion',
  'TodoWrite',
  'BashOutput'
] as const;

/**
 * Write tools that modify the codebase
 */
export const WRITE_TOOLS = [
  'Write',
  'Edit',
  'NotebookEdit',
  'Bash'
] as const;

/**
 * Default mode configuration
 */
export const DEFAULT_MODE_CONFIG: WorkflowModeConfig = {
  name: 'default',
  displayName: 'Default',
  description: 'Standard operation mode with all tools available',
  systemInstructions: '',
  allowNesting: true,
  maxNestingDepth: 3
};

/**
 * Plan mode configuration
 * Restricts to read-only tools for exploration and planning
 */
export const PLAN_MODE_CONFIG: WorkflowModeConfig = {
  name: 'plan',
  displayName: 'Plan Mode',
  description: 'Planning mode - read-only exploration without code modifications',
  blockedTools: [...WRITE_TOOLS],
  systemInstructions: `## Plan Mode Active

You are in **Plan Mode**. This mode is for exploration and planning only.

**Restrictions:**
- You CANNOT use Write, Edit, or Bash tools that modify files
- Focus on reading, searching, and understanding the codebase
- Create a comprehensive plan before implementation

**Your Goals:**
1. Explore the codebase to understand existing patterns
2. Identify files that need to be modified
3. Design an implementation approach
4. Document your plan clearly
5. Use ExitPlanMode when ready to implement

**Remember:** No code modifications in this mode. Plan first, implement later.`,
  allowNesting: false,
  autoExitConditions: {
    onToolUse: ['ExitPlanMode']
  }
};

/**
 * Iterate mode configuration
 * Full access with continuous execution focus
 */
export const ITERATE_MODE_CONFIG: WorkflowModeConfig = {
  name: 'iterate',
  displayName: 'Iterate Mode',
  description: 'Continuous iteration mode for implementation with automatic continuation',
  systemInstructions: `## Iterate Mode Active

You are in **Iterate Mode**. This mode enables continuous task execution.

**Behavior:**
- Continue working until the task is complete
- After each step, assess progress and continue
- Don't stop to ask for confirmation unless critical
- Mark todos as completed as you finish them

**Guidelines:**
1. Work through tasks systematically
2. Test changes as you go when possible
3. Update todo list to track progress
4. Only pause for critical decisions or blockers

**Remember:** Keep iterating until the task is done or you hit a blocker.`,
  allowNesting: true,
  maxNestingDepth: 2
};

/**
 * Review mode configuration
 * Read-only with focus on code review and analysis
 */
export const REVIEW_MODE_CONFIG: WorkflowModeConfig = {
  name: 'review',
  displayName: 'Review Mode',
  description: 'Code review mode - analyze code quality, security, and best practices',
  blockedTools: [...WRITE_TOOLS],
  systemInstructions: `## Review Mode Active

You are in **Review Mode**. This mode is for code review and analysis.

**Focus Areas:**
- Code quality and readability
- Security vulnerabilities (OWASP Top 10)
- Performance issues
- Best practices and patterns
- Test coverage gaps

**Output Format:**
Provide structured feedback:
1. **Critical Issues** - Must fix before merge
2. **Warnings** - Should address
3. **Suggestions** - Nice to have improvements
4. **Positive Notes** - Good patterns observed

**Remember:** No code modifications. Provide actionable feedback only.`,
  allowNesting: false
};

/**
 * All predefined mode configurations
 */
export const WORKFLOW_MODE_CONFIGS: Record<WorkflowMode, WorkflowModeConfig> = {
  default: DEFAULT_MODE_CONFIG,
  plan: PLAN_MODE_CONFIG,
  iterate: ITERATE_MODE_CONFIG,
  review: REVIEW_MODE_CONFIG
};

/**
 * Get configuration for a workflow mode
 */
export function getWorkflowModeConfig(mode: WorkflowMode): WorkflowModeConfig {
  return WORKFLOW_MODE_CONFIGS[mode];
}

/**
 * Check if a tool is allowed in a given mode
 */
export function isToolAllowedInMode(tool: string, mode: WorkflowMode): boolean {
  const config = getWorkflowModeConfig(mode);

  // If allowedTools is specified, tool must be in the list
  if (config.allowedTools && config.allowedTools.length > 0) {
    return config.allowedTools.includes(tool);
  }

  // If blockedTools is specified, tool must not be in the list
  if (config.blockedTools && config.blockedTools.length > 0) {
    return !config.blockedTools.includes(tool);
  }

  // Default: allow all tools
  return true;
}

/**
 * Get list of blocked tools for a mode
 */
export function getBlockedToolsForMode(mode: WorkflowMode): string[] {
  const config = getWorkflowModeConfig(mode);
  return config.blockedTools || [];
}

/**
 * Get list of allowed tools for a mode
 */
export function getAllowedToolsForMode(mode: WorkflowMode): string[] | undefined {
  const config = getWorkflowModeConfig(mode);
  return config.allowedTools;
}

/**
 * Check if a string is a valid workflow mode
 */
export function isValidWorkflowMode(mode: string): mode is WorkflowMode {
  return mode in WORKFLOW_MODE_CONFIGS;
}

/**
 * Get description for a workflow mode
 */
export function getWorkflowModeDescription(mode: WorkflowMode): string {
  const config = getWorkflowModeConfig(mode);
  return config.description;
}

/**
 * Alias for WORKFLOW_MODE_CONFIGS for simpler access
 */
export const WORKFLOW_MODES = WORKFLOW_MODE_CONFIGS;
