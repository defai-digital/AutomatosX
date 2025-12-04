/**
 * MCP Tool: get_agent_context (v10.5.0)
 *
 * Retrieves agent context without executing.
 * This tool is for explicit context retrieval when the AI assistant
 * wants to execute the task directly.
 *
 * Use cases:
 * - Pre-fetch context for complex workflows
 * - Build custom prompts with agent expertise
 * - Inspect agent capabilities before execution
 */

import type { ToolHandler } from '../types.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../shared/logging/logger.js';
import { validateAgentName, validateStringParameter } from '../utils/validation.js';

export interface GetAgentContextInput {
  agent: string;
  task: string;
  includeMemory?: boolean;
  maxMemoryResults?: number;
}

export interface GetAgentContextOutput {
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
  suggestedApproach: string;
  workspaceContext: {
    projectDir: string;
  };
  latencyMs: number;
}

export interface GetAgentContextDependencies {
  profileLoader: ProfileLoader;
  memoryManager: IMemoryManager;
}

export function createGetAgentContextHandler(
  deps: GetAgentContextDependencies
): ToolHandler<GetAgentContextInput, GetAgentContextOutput> {
  return async (input: GetAgentContextInput): Promise<GetAgentContextOutput> => {
    const {
      agent,
      task,
      includeMemory = true,
      maxMemoryResults = 5
    } = input;

    const startTime = Date.now();

    // Validate inputs
    validateAgentName(agent);
    validateStringParameter(task, 'task', {
      required: true,
      minLength: 1,
      maxLength: 10000
    });

    logger.info('[MCP] get_agent_context called', {
      agent,
      task: task.substring(0, 100),
      includeMemory,
      maxMemoryResults
    });

    // Load agent profile
    const profile = await deps.profileLoader.loadProfile(agent);
    const systemPrompt = profile?.systemPrompt || `You are ${agent}, a specialized AI assistant.`;
    const expertise = profile?.abilities || [];
    const role = profile?.role || agent;

    // Search relevant memory if requested
    let relevantMemory: Array<{ id: number; content: string; similarity: number }> = [];
    if (includeMemory) {
      try {
        const results = await deps.memoryManager.search({ text: task, limit: maxMemoryResults });
        relevantMemory = results.map(r => ({
          id: r.entry.id,
          content: r.entry.content.substring(0, 500), // Truncate for context
          similarity: r.similarity || 0
        }));
      } catch (error) {
        logger.debug('[get_agent_context] Memory search failed', { error });
      }
    }

    // Build enhanced prompt
    const memoryContext = relevantMemory.length > 0
      ? `\n\nRelevant context from memory:\n${relevantMemory.map(m => `- ${m.content}`).join('\n')}`
      : '';

    const enhancedPrompt = `${systemPrompt}${memoryContext}\n\n---\n\nTask: ${task}`;

    // Generate suggested approach based on agent expertise
    const suggestedApproach = expertise.length > 0
      ? `As ${role} with expertise in ${expertise.slice(0, 3).join(', ')}, approach this task by leveraging domain knowledge and best practices.`
      : `Approach this task methodically, breaking it down into manageable steps.`;

    const latencyMs = Date.now() - startTime;

    logger.info('[MCP] get_agent_context completed', {
      agent,
      latencyMs,
      memoryResults: relevantMemory.length
    });

    return {
      agentProfile: {
        name: agent,
        role,
        expertise,
        systemPrompt
      },
      relevantMemory,
      enhancedPrompt,
      suggestedApproach,
      workspaceContext: {
        projectDir: process.cwd()
      },
      latencyMs
    };
  };
}
