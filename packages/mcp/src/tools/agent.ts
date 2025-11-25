/**
 * Agent Tools
 *
 * MCP tools for agent operations.
 *
 * @module @ax/mcp/tools/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { ToolHandler, ToolResult } from '../types.js';
import type { CLIContext } from './context.js';

// =============================================================================
// Tool: ax_run
// =============================================================================

export function createRunTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_run',
      description: 'Execute a task with an AutomatosX agent. Returns the agent response.',
      inputSchema: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            description: 'Agent ID to use (e.g., "backend", "frontend", "security")',
          },
          task: {
            type: 'string',
            description: 'Task description for the agent to execute',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 300000)',
          },
          sessionId: {
            type: 'string',
            description: 'Session ID to use for conversation continuity',
          },
        },
        required: ['agent', 'task'],
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const agent = args['agent'] as string;
        const task = args['task'] as string;
        const timeout = (args['timeout'] as number | undefined) ?? 300000;
        const sessionId = args['sessionId'] as string | undefined;

        const ctx = await getContext();

        // Check if agent exists
        if (!ctx.agentRegistry.has(agent)) {
          const available = ctx.agentRegistry.getIds().slice(0, 10);
          return {
            content: [
              {
                type: 'text',
                text: `Agent "${agent}" not found. Available agents: ${available.join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        // Execute the task
        const result = await ctx.agentExecutor.execute(agent, task, {
          sessionId,
          timeout,
          saveToMemory: true,
        });

        if (result.response.success) {
          return {
            content: [
              {
                type: 'text',
                text: result.response.output,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Task failed: ${result.response.error ?? 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}

// =============================================================================
// Tool: ax_list_agents
// =============================================================================

export function createListAgentsTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_list_agents',
      description: 'List all available AutomatosX agents with their descriptions.',
      inputSchema: {
        type: 'object',
        properties: {
          team: {
            type: 'string',
            description: 'Filter by agent team',
          },
        },
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const team = args['team'] as string | undefined;
        const ctx = await getContext();

        let agents = ctx.agentRegistry.getAll();

        if (team) {
          agents = agents.filter((a) => a.team === team);
        }

        const agentList = agents
          .filter((a) => a.enabled)
          .map((a) => `- ${a.name}: ${a.displayName} - ${a.description ?? 'No description'}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Available agents (${agents.length}):\n\n${agentList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}

// =============================================================================
// Tool: ax_agent_info
// =============================================================================

export function createAgentInfoTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_agent_info',
      description: 'Get detailed information about a specific agent.',
      inputSchema: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            description: 'Agent ID to get info for',
          },
        },
        required: ['agent'],
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const agentId = args['agent'] as string;
        const ctx = await getContext();

        const agent = ctx.agentRegistry.get(agentId);

        if (!agent) {
          return {
            content: [
              {
                type: 'text',
                text: `Agent "${agentId}" not found.`,
              },
            ],
            isError: true,
          };
        }

        const info = [
          `Agent: ${agent.displayName} (${agent.name})`,
          `Description: ${agent.description ?? 'No description'}`,
          `Team: ${agent.team}`,
          `Role: ${agent.role}`,
          `Status: ${agent.enabled ? 'Enabled' : 'Disabled'}`,
        ];

        if (agent.abilities && agent.abilities.length > 0) {
          info.push(`Abilities: ${agent.abilities.join(', ')}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: info.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
