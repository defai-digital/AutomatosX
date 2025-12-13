/**
 * MCP Tool: memory_stats
 *
 * Gets detailed memory statistics including breakdown by agent.
 */

import type { ToolHandler, MemoryStatsOutput } from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../shared/logging/logger.js';
import { formatBytes } from '../../shared/helpers/format-utils.js';

export interface MemoryStatsDependencies {
  memoryManager: IMemoryManager;
}

export function createMemoryStatsHandler(
  deps: MemoryStatsDependencies
): ToolHandler<Record<string, never>, MemoryStatsOutput> {
  return async (): Promise<MemoryStatsOutput> => {
    logger.info('[MCP] memory_stats called');

    try {
      // Get overall stats
      const stats = await deps.memoryManager.getStats();

      // Get all entries to calculate per-agent breakdown
      const allEntries = await deps.memoryManager.getAll();
      const byAgent: Record<string, number> = {};

      for (const entry of allEntries) {
        const agent = (entry.metadata?.agent as string | undefined) || 'unknown';
        byAgent[agent] = (byAgent[agent] || 0) + 1;
      }

      const result: MemoryStatsOutput = {
        totalEntries: stats.totalEntries,
        dbSize: formatBytes(stats.dbSize),
        byAgent
      };

      logger.info('[MCP] memory_stats completed', {
        totalEntries: stats.totalEntries,
        agents: Object.keys(byAgent).length
      });

      return result;
    } catch (error) {
      logger.error('[MCP] memory_stats failed', { error });
      throw new Error(`Memory stats failed: ${(error as Error).message}`);
    }
  };
}
