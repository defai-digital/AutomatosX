/**
 * MCP Prompts Registry
 *
 * Combines all prompt definitions and handlers.
 *
 * MCP Prompts are user-controlled templates that generate
 * structured prompts with context from the system.
 */

import type { MCPPrompt, MCPPromptMessage, PromptHandler } from '../types.js';

// Import prompt definitions and handlers
import {
  reviewChangesPrompt,
  handleReviewChanges,
} from './review-changes.js';
import {
  explainWorkflowPrompt,
  handleExplainWorkflow,
} from './explain-workflow.js';
import {
  troubleshootSessionPrompt,
  handleTroubleshootSession,
} from './troubleshoot-session.js';
import {
  agentGuidePrompt,
  handleAgentGuide,
} from './agent-guide.js';

// ============================================================================
// Combined Exports
// ============================================================================

/**
 * All MCP prompts
 */
export const ALL_PROMPTS: MCPPrompt[] = [
  reviewChangesPrompt,
  explainWorkflowPrompt,
  troubleshootSessionPrompt,
  agentGuidePrompt,
];

/**
 * All prompt handlers
 */
export const PROMPT_HANDLERS: Record<string, PromptHandler> = {
  'review-changes': handleReviewChanges,
  'explain-workflow': handleExplainWorkflow,
  'troubleshoot-session': handleTroubleshootSession,
  'agent-guide': handleAgentGuide,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets a prompt by name
 */
export function getPrompt(name: string): MCPPrompt | undefined {
  return ALL_PROMPTS.find((p) => p.name === name);
}

/**
 * Gets a prompt handler by name
 */
export function getPromptHandler(name: string): PromptHandler | undefined {
  return PROMPT_HANDLERS[name];
}

/**
 * Executes a prompt with the given arguments
 */
export async function executePrompt(
  name: string,
  args: Record<string, string>
): Promise<{
  description?: string;
  messages: MCPPromptMessage[];
} | { error: string; message: string }> {
  const prompt = getPrompt(name);
  if (prompt === undefined) {
    return {
      error: 'PROMPT_NOT_FOUND',
      message: `Prompt "${name}" not found. Available prompts: ${ALL_PROMPTS.map((p) => p.name).join(', ')}`,
    };
  }

  // Validate required arguments
  const requiredArgs = prompt.arguments?.filter((a) => a.required) ?? [];
  const missingArgs = requiredArgs.filter((a) => args[a.name] === undefined);

  if (missingArgs.length > 0) {
    return {
      error: 'MISSING_REQUIRED_ARGUMENT',
      message: `Missing required arguments: ${missingArgs.map((a) => a.name).join(', ')}`,
    };
  }

  const handler = getPromptHandler(name);
  if (handler === undefined) {
    return {
      error: 'PROMPT_HANDLER_NOT_FOUND',
      message: `No handler registered for prompt "${name}"`,
    };
  }

  return handler(args);
}

// Re-export individual prompts for direct access
export * from './review-changes.js';
export * from './explain-workflow.js';
export * from './troubleshoot-session.js';
