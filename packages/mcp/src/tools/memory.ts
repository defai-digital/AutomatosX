/**
 * Memory Tools
 *
 * MCP tools for memory operations.
 *
 * @module @ax/mcp/tools/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import {
  formatBytes,
  LIST_SEARCH_LIMIT,
  LIST_TOP_TAGS,
  DISPLAY_PREVIEW_LONG,
} from '@ax/schemas';
import type { ToolHandler, ToolResult } from '../types.js';
import type { CLIContext } from './context.js';

// =============================================================================
// Tool: ax_memory_search
// =============================================================================

export function createMemorySearchTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_memory_search',
      description: 'Search the AutomatosX memory system for past conversations and decisions.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (supports full-text search)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 10)',
          },
          agentId: {
            type: 'string',
            description: 'Filter results by agent ID',
          },
        },
        required: ['query'],
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const query = args['query'] as string;
        const limit = (args['limit'] as number | undefined) ?? LIST_SEARCH_LIMIT;
        const agentId = args['agentId'] as string | undefined;

        const ctx = await getContext();
        const result = ctx.memoryManager.search({
          query,
          limit,
          offset: 0,
          sortBy: 'relevance',
          sortDirection: 'desc',
          includeContent: true,
          highlight: false,
          filter: agentId ? { agentId } : undefined,
        });

        if (result.entries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No memories found for query: "${query}"`,
              },
            ],
          };
        }

        const formattedResults = result.entries
          .map((entry, i) => {
            const source = entry.metadata.source;
            return [
              `[${i + 1}] Source: ${source}`,
              `    ${entry.content.slice(0, DISPLAY_PREVIEW_LONG)}${entry.content.length > DISPLAY_PREVIEW_LONG ? '...' : ''}`,
            ].join('\n');
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.total} memories:\n\n${formattedResults}`,
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
// Tool: ax_memory_save
// =============================================================================

export function createMemorySaveTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_memory_save',
      description: 'Save information to the AutomatosX memory system for future reference.',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Content to save to memory',
          },
          source: {
            type: 'string',
            description: 'Source identifier for this memory',
          },
          type: {
            type: 'string',
            description: 'Type of memory (conversation, decision, task, code, document)',
            enum: ['conversation', 'decision', 'task', 'code', 'document'],
          },
          tags: {
            type: 'array',
            description: 'Tags to associate with this memory',
          },
        },
        required: ['content', 'source'],
      },
    },

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const content = args['content'] as string;
        const source = args['source'] as string;
        const type = (args['type'] as string | undefined) ?? 'document';
        const tags = (args['tags'] as string[] | undefined) ?? [];

        const ctx = await getContext();

        const id = ctx.memoryManager.add({
          content,
          metadata: {
            type: type as 'conversation' | 'decision' | 'task' | 'code' | 'document',
            source,
            tags,
            importance: 0.5,
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: `Memory saved successfully (ID: ${id})`,
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
// Tool: ax_memory_stats
// =============================================================================

export function createMemoryStatsTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_memory_stats',
      description: 'Get statistics about the AutomatosX memory system.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    async execute(): Promise<ToolResult> {
      try {
        const ctx = await getContext();
        const stats = ctx.memoryManager.getStats();

        const info = [
          `Memory Statistics:`,
          `- Total entries: ${stats.totalEntries.toLocaleString()}`,
          `- Database size: ${formatBytes(stats.databaseSizeBytes)}`,
          `- Avg content length: ${Math.round(stats.avgContentLength)} chars`,
          `- Total access count: ${stats.totalAccessCount.toLocaleString()}`,
        ];

        if (stats.oldestEntry && stats.newestEntry) {
          info.push(`- Date range: ${stats.oldestEntry.toLocaleDateString()} - ${stats.newestEntry.toLocaleDateString()}`);
        }

        if (stats.topTags.length > 0) {
          info.push(`- Top tags: ${stats.topTags.slice(0, LIST_TOP_TAGS).map(t => `${t.tag}(${t.count})`).join(', ')}`);
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

