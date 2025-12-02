/**
 * MCP Tool: memory_list
 *
 * Lists memory entries with optional filtering by agent.
 */

import type {
  ToolHandler,
  MemoryListInput,
  MemoryListOutput
} from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';

export interface MemoryListDependencies {
  memoryManager: IMemoryManager;
}

export function createMemoryListHandler(
  deps: MemoryListDependencies
): ToolHandler<MemoryListInput, MemoryListOutput> {
  return async (input: MemoryListInput): Promise<MemoryListOutput> => {
    logger.info('[MCP] memory_list called', { input });

    try {
      const { agent, limit = 50 } = input;

      // Get all entries with optional limit
      const allEntries = await deps.memoryManager.getAll({
        limit: agent ? undefined : limit  // Get all if filtering by agent, otherwise limit
      });

      // Filter by agent if specified
      const entries = agent
        ? allEntries.filter((entry) => entry.metadata?.agentId === agent).slice(0, limit)
        : allEntries;

      const result: MemoryListOutput = {
        entries: entries.map((entry) => ({
          id: entry.id,
          content: entry.content,
          metadata: entry.metadata || {},
          createdAt: entry.createdAt.toISOString()
        })),
        total: entries.length
      };

      logger.info('[MCP] memory_list completed', {
        count: entries.length,
        agent
      });

      return result;
    } catch (error) {
      logger.error('[MCP] memory_list failed', { error });
      throw new Error(`Memory list failed: ${(error as Error).message}`);
    }
  };
}
