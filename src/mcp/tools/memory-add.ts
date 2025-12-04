/**
 * MCP Tool: memory_add
 *
 * Adds a new memory entry to the system.
 */

import type {
  ToolHandler,
  MemoryAddInput,
  MemoryAddOutput
} from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../shared/logging/logger.js';

export interface MemoryAddDependencies {
  memoryManager: IMemoryManager;
}

export function createMemoryAddHandler(
  deps: MemoryAddDependencies
): ToolHandler<MemoryAddInput, MemoryAddOutput> {
  return async (input: MemoryAddInput): Promise<MemoryAddOutput> => {
    logger.info('[MCP] memory_add called', { input });

    try {
      const { content, metadata = {} } = input;

      // Construct MemoryMetadata with required fields
      const enrichedMetadata = {
        type: (metadata.type as 'conversation' | 'code' | 'document' | 'task' | 'other') || 'other',
        source: metadata.agent || 'mcp',
        agentId: metadata.agent,
        timestamp: metadata.timestamp || new Date().toISOString(),
        ...metadata
      };

      // Add memory entry (no embedding for FTS5)
      const entry = await deps.memoryManager.add(
        content,
        null,
        enrichedMetadata
      );

      const result: MemoryAddOutput = {
        id: entry.id,
        content: entry.content,
        metadata: entry.metadata || {},
        createdAt: entry.createdAt.toISOString()
      };

      logger.info('[MCP] memory_add completed', {
        id: entry.id,
        agent: enrichedMetadata.agent
      });

      return result;
    } catch (error) {
      logger.error('[MCP] memory_add failed', { error });
      throw new Error(`Memory add failed: ${(error as Error).message}`);
    }
  };
}
