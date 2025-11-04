/**
 * Memory Bridge
 *
 * Integrates AutomatosX MemoryManager with interactive CLI.
 * Provides memory search and statistics functionality.
 */

import { MemoryManager } from '../../../src/core/memory-manager.js';
import type { MemoryMetadata, MemorySearchQuery } from '../../../src/types/memory.js';
import type { MemorySearchOptions, MemorySearchResult, MemoryStats } from './types.js';

export interface MemoryBridgeConfig {
  persistPath?: string;
  maxEntries?: number;
  autoCleanup?: boolean;
}

export class MemoryBridge {
  private memoryManager: MemoryManager | null = null;
  private initialized: boolean = false;

  constructor(private config: MemoryBridgeConfig = {}) {}

  /**
   * Initialize memory manager (async)
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.memoryManager = await MemoryManager.create({
        dbPath: `${this.config.persistPath || '.automatosx/memory'}/memories.db`,
        maxEntries: this.config.maxEntries || 10000,
        autoCleanup: this.config.autoCleanup ?? true,
        cleanupDays: 30,
        busyTimeout: 5000
      });
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize memory: ${(error as Error).message}`);
    }
  }

  /**
   * Search memory with filters
   */
  async search(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    await this.initialize();
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }

    const {
      limit = 10,
      agent = undefined,
      after = undefined,
      before = undefined
    } = options;

    try {
      // Build search query
      const searchQuery: MemorySearchQuery = {
        text: query,
        limit,
        filters: {}
      };

      // Add agent filter if specified
      if (agent) {
        searchQuery.filters = {
          ...searchQuery.filters,
          agentId: agent
        };
      }

      // Add date range filters if specified
      if (after || before) {
        searchQuery.filters = {
          ...searchQuery.filters,
          dateRange: {
            from: after ? new Date(after) : undefined,
            to: before ? new Date(before) : undefined
          }
        };
      }

      // Execute search
      const results = await this.memoryManager.search(searchQuery);

      // Transform results to CLI format
      return results.map(result => ({
        id: result.entry.id.toString(),
        content: result.entry.content,
        timestamp: new Date(result.entry.createdAt).toISOString(),
        agent: result.entry.metadata?.agentId as string | undefined,
        relevance: Math.round(result.similarity * 100),
        metadata: result.entry.metadata
      }));
    } catch (error) {
      throw new Error(`Memory search failed: ${(error as Error).message}`);
    }
  }

  /**
   * Add entry to memory
   */
  async add(
    content: string,
    metadata?: { agent?: string; [key: string]: unknown }
  ): Promise<string> {
    await this.initialize();
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }

    try {
      const memoryMetadata: MemoryMetadata = {
        type: 'conversation',
        source: 'cli-interactive',
        agentId: metadata?.agent,
        tags: metadata?.tags as string[] | undefined,
        ...metadata
      };

      const entry = await this.memoryManager.add(content, null, memoryMetadata);
      return entry.id.toString();
    } catch (error) {
      throw new Error(`Failed to add to memory: ${(error as Error).message}`);
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    await this.initialize();
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }

    try {
      const stats = await this.memoryManager.getStats();

      // Get oldest and newest entries separately
      const allEntries = await this.memoryManager.getAll({
        limit: 1,
        orderBy: 'created'
      });

      const newestEntries = await this.memoryManager.getAll({
        limit: 1,
        orderBy: 'created'
      });

      // Transform to CLI format
      return {
        totalEntries: stats.totalEntries,
        oldestEntry: allEntries[0] ? {
          id: allEntries[0].id.toString(),
          timestamp: new Date(allEntries[0].createdAt).toISOString()
        } : undefined,
        newestEntry: newestEntries[0] ? {
          id: newestEntries[0].id.toString(),
          timestamp: new Date(newestEntries[0].createdAt).toISOString()
        } : undefined,
        sizeBytes: stats.dbSize
      };
    } catch (error) {
      throw new Error(`Failed to get memory stats: ${(error as Error).message}`);
    }
  }

  /**
   * Get recent entries
   */
  async getRecent(limit: number = 10): Promise<MemorySearchResult[]> {
    await this.initialize();
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }

    try {
      // Get all entries and sort by created date
      const allEntries = await this.memoryManager.getAll({
        limit,
        orderBy: 'created'
      });

      return allEntries.map(entry => ({
        id: entry.id.toString(),
        content: entry.content,
        timestamp: new Date(entry.createdAt).toISOString(),
        agent: entry.metadata?.agentId as string | undefined,
        relevance: 100, // Recent entries are 100% relevant
        metadata: entry.metadata
      }));
    } catch (error) {
      throw new Error(`Failed to get recent entries: ${(error as Error).message}`);
    }
  }

  /**
   * Clear old entries
   */
  async clearOld(daysAgo: number): Promise<number> {
    await this.initialize();
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }

    try {
      const deleted = await this.memoryManager.cleanup(daysAgo);
      return deleted;
    } catch (error) {
      throw new Error(`Failed to clear old entries: ${(error as Error).message}`);
    }
  }

  /**
   * Export memory to JSON
   */
  async export(): Promise<string> {
    await this.initialize();
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }

    try {
      // Get all entries
      const allEntries = await this.memoryManager.getAll();

      // Format as JSON
      return JSON.stringify(allEntries, null, 2);
    } catch (error) {
      throw new Error(`Failed to export memory: ${(error as Error).message}`);
    }
  }

  /**
   * Close memory manager
   */
  close(): void {
    // MemoryManager cleanup is handled automatically
    this.initialized = false;
    this.memoryManager = null;
  }
}
