/**
 * Session Tools
 *
 * MCP tools for session management.
 *
 * @module @ax/mcp/tools/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { ToolHandler, ToolResult } from '../types.js';
import type { CLIContext } from './context.js';

// =============================================================================
// Tool: ax_session_create
// =============================================================================

export function createSessionCreateTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_session_create',
      description: 'Create a new AutomatosX session for tracking a workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Session name',
          },
          agents: {
            type: 'array',
            description: 'List of agent IDs participating in this session',
          },
          goal: {
            type: 'string',
            description: 'Session goal/objective',
          },
          description: {
            type: 'string',
            description: 'Session description',
          },
        },
        required: ['name', 'agents'],
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const name = args['name'] as string;
        const agents = args['agents'] as string[];
        const goal = args['goal'] as string | undefined;
        const description = args['description'] as string | undefined;

        const ctx = await getContext();
        const session = await ctx.sessionManager.create({
          name,
          agents,
          goal,
          description,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Session created: ${session.id}\nName: ${session.name}\nAgents: ${session.agents.join(', ')}\nState: ${session.state}`,
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
// Tool: ax_session_list
// =============================================================================

export function createSessionListTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_session_list',
      description: 'List AutomatosX sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            description: 'Filter by state (active, paused, completed, cancelled, failed)',
            enum: ['active', 'paused', 'completed', 'cancelled', 'failed'],
          },
          agent: {
            type: 'string',
            description: 'Filter by agent ID',
          },
        },
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const stateArg = args['state'] as string | undefined;
        const agent = args['agent'] as string | undefined;

        const ctx = await getContext();
        const filter: { state?: 'active' | 'paused' | 'completed' | 'cancelled' | 'failed'; agent?: string } = {};
        if (stateArg) {
          filter.state = stateArg as 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
        }
        if (agent) {
          filter.agent = agent;
        }
        const sessions = await ctx.sessionManager.list(filter);

        if (sessions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No sessions found.',
              },
            ],
          };
        }

        const sessionList = sessions
          .map((s) => `- ${s.id.slice(0, 8)}: ${s.name} [${s.state}] - ${s.agentCount} agent(s), ${s.totalTasks} task(s)`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Sessions (${sessions.length}):\n\n${sessionList}`,
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
// Tool: ax_session_info
// =============================================================================

export function createSessionInfoTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_session_info',
      description: 'Get detailed information about an AutomatosX session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session ID to get info for',
          },
        },
        required: ['sessionId'],
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const sessionId = args['sessionId'] as string;

        const ctx = await getContext();
        const session = await ctx.sessionManager.get(sessionId);

        if (!session) {
          return {
            content: [
              {
                type: 'text',
                text: `Session "${sessionId}" not found.`,
              },
            ],
            isError: true,
          };
        }

        const info = [
          `Session: ${session.id}`,
          `Name: ${session.name}`,
          `State: ${session.state}`,
          `Agents: ${session.agents.join(', ')}`,
          `Tasks: ${session.tasks.length}`,
          `Created: ${session.createdAt.toLocaleString()}`,
        ];

        if (session.completedAt) {
          info.push(`Completed: ${session.completedAt.toLocaleString()}`);
        }

        if (session.goal) {
          info.push(`Goal: ${session.goal}`);
        }

        if (session.tags.length > 0) {
          info.push(`Tags: ${session.tags.join(', ')}`);
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
