/**
 * MCP Tool: memory_clear
 *
 * Clears all memory entries from the database.
 */

import type { ToolHandler, MemoryClearOutput } from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../shared/logging/logger.js';

export interface MemoryClearDependencies {
  memoryManager: IMemoryManager;
}

export function createMemoryClearHandler(
  deps: MemoryClearDependencies
): ToolHandler<Record<string, never>, MemoryClearOutput> {
  return async (): Promise<MemoryClearOutput> => {
    logger.info('[MCP] memory_clear called');

    try {
      // Get count before clearing
      const statsBefore = await deps.memoryManager.getStats();
      const countBefore = statsBefore.totalEntries;

      // Clear all memories
      await deps.memoryManager.clear();

      const result: MemoryClearOutput = {
        success: true,
        deleted: countBefore
      };

      logger.info('[MCP] memory_clear completed', {
        deleted: countBefore
      });

      return result;
    } catch (error) {
      logger.error('[MCP] memory_clear failed', { error });
      throw new Error(`Memory clear failed: ${(error as Error).message}`);
    }
  };
}
