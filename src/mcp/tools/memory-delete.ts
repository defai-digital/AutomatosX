/**
 * MCP Tool: memory_delete
 *
 * Deletes a specific memory entry by ID.
 */

import type {
  ToolHandler,
  MemoryDeleteInput,
  MemoryDeleteOutput
} from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../shared/logging/logger.js';

export interface MemoryDeleteDependencies {
  memoryManager: IMemoryManager;
}

export function createMemoryDeleteHandler(
  deps: MemoryDeleteDependencies
): ToolHandler<MemoryDeleteInput, MemoryDeleteOutput> {
  return async (input: MemoryDeleteInput): Promise<MemoryDeleteOutput> => {
    logger.info('[MCP] memory_delete called', { input });

    try {
      const { id } = input;

      // Verify entry exists before deletion
      const entry = await deps.memoryManager.get(id);
      if (!entry) {
        throw new Error(`Memory entry not found: ${id}`);
      }

      // Delete the entry
      await deps.memoryManager.delete(id);

      const result: MemoryDeleteOutput = {
        success: true,
        id
      };

      logger.info('[MCP] memory_delete completed', { id });

      return result;
    } catch (error) {
      logger.error('[MCP] memory_delete failed', { error });
      throw new Error(`Memory delete failed: ${(error as Error).message}`);
    }
  };
}
