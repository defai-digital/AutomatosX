/**
 * Memory Instruction Provider
 *
 * Generates embedded instructions based on relevant memories.
 * Injects contextual information from the memory system to help
 * agents make better decisions.
 *
 * @since v11.3.0
 */

import { logger } from '../../shared/logging/logger.js';
import {
  type EmbeddedInstruction,
  type InstructionProvider,
  type OrchestrationContext,
  type MemoryEntry
} from './types.js';

/**
 * Memory search interface (abstracted from actual memory manager)
 */
export interface MemorySearchProvider {
  /**
   * Search for relevant memories
   */
  search(query: {
    text: string;
    limit?: number;
    filters?: {
      agentId?: string;
      type?: string;
      tags?: string[];
    };
  }): Promise<Array<{
    content: string;
    score: number;
    metadata?: {
      agentId?: string;
      type?: string;
      tags?: string[];
      source?: string;
    };
    createdAt: Date;
  }>>;
}

/**
 * Configuration for MemoryInstructionProvider
 */
export interface MemoryProviderConfig {
  /** Whether the provider is enabled */
  enabled: boolean;
  /** Maximum number of memories to include */
  maxEntries: number;
  /** Minimum relevance score (0-1) to include a memory */
  minRelevance: number;
  /** How often to search for new memories (every N turns) */
  searchFrequency: number;
  /** Maximum age of memories to include (in milliseconds, 0 = no limit) */
  maxAge: number;
  /** Whether to include memory metadata */
  includeMetadata: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
}

/**
 * Default configuration
 */
const DEFAULT_MEMORY_CONFIG: MemoryProviderConfig = {
  enabled: true,
  maxEntries: 5,
  minRelevance: 0.5,
  searchFrequency: 3,
  maxAge: 0, // No limit by default
  includeMetadata: true,
  cacheTTL: 60000 // 1 minute
};

/**
 * Cached memory search result
 */
interface MemoryCache {
  query: string;
  results: MemoryEntry[];
  timestamp: number;
}

/**
 * Memory Instruction Provider
 *
 * Searches the memory system for relevant context and generates
 * instructions to help agents leverage past knowledge.
 */
export class MemoryInstructionProvider implements InstructionProvider {
  readonly name = 'memory';

  private config: MemoryProviderConfig;
  private searchProvider?: MemorySearchProvider;
  private cache?: MemoryCache;
  private lastSearchTurn: number = 0;

  constructor(
    searchProvider?: MemorySearchProvider,
    config?: Partial<MemoryProviderConfig>
  ) {
    this.config = {
      ...DEFAULT_MEMORY_CONFIG,
      ...config
    };
    this.searchProvider = searchProvider;

    logger.debug('MemoryInstructionProvider initialized', {
      enabled: this.config.enabled,
      maxEntries: this.config.maxEntries,
      hasSearchProvider: !!searchProvider
    });
  }

  /**
   * Set the memory search provider
   */
  setSearchProvider(provider: MemorySearchProvider): void {
    this.searchProvider = provider;
    this.clearCache();
    logger.debug('Memory search provider set');
  }

  /**
   * Check if provider should generate instructions
   */
  shouldGenerate(context: OrchestrationContext): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.searchProvider) {
      return false;
    }

    // Check if we have a current task to search for
    if (!context.currentTask && context.todos.length === 0) {
      return false;
    }

    // Check if it's time for a new search
    const turnsSinceSearch = context.turnCount - this.lastSearchTurn;
    const searchDue = turnsSinceSearch >= this.config.searchFrequency;

    // Check cache validity
    const cacheValid = this.cache &&
      (Date.now() - this.cache.timestamp) < this.config.cacheTTL;

    return searchDue || !cacheValid;
  }

  /**
   * Generate instructions based on relevant memories
   */
  async getInstructions(context: OrchestrationContext): Promise<EmbeddedInstruction[]> {
    const instructions: EmbeddedInstruction[] = [];

    if (!this.searchProvider) {
      return instructions;
    }

    // Build search query from context
    const searchQuery = this.buildSearchQuery(context);
    if (!searchQuery) {
      return instructions;
    }

    try {
      // Search for relevant memories
      const memories = await this.searchMemories(searchQuery, context);

      if (memories.length === 0) {
        return instructions;
      }

      // Update state
      this.lastSearchTurn = context.turnCount;

      // Format memories into instruction
      const content = this.formatMemories(memories);

      instructions.push({
        type: 'memory',
        priority: 'normal',
        content,
        source: 'automatosx',
        createdAt: Date.now(),
        expiresAfter: this.config.searchFrequency + 1,
        id: `memory-${Date.now()}`
      });

      logger.debug('Memory instructions generated', {
        memoriesFound: memories.length,
        query: searchQuery.substring(0, 50)
      });

    } catch (error) {
      logger.error('Failed to search memories', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return instructions;
  }

  /**
   * Build search query from context
   */
  private buildSearchQuery(context: OrchestrationContext): string | null {
    const parts: string[] = [];

    // Include current task
    if (context.currentTask) {
      parts.push(context.currentTask);
    }

    // Include in-progress todos
    const inProgressTodos = context.todos.filter(t => t.status === 'in_progress');
    for (const todo of inProgressTodos.slice(0, 2)) {
      parts.push(todo.content);
    }

    // Include agent name for context
    if (context.agentName) {
      parts.push(context.agentName);
    }

    if (parts.length === 0) {
      return null;
    }

    return parts.join(' ');
  }

  /**
   * Search for relevant memories
   */
  private async searchMemories(
    query: string,
    context: OrchestrationContext
  ): Promise<MemoryEntry[]> {
    if (!this.searchProvider) {
      return [];
    }

    // Check cache first
    if (this.cache && this.cache.query === query) {
      const age = Date.now() - this.cache.timestamp;
      if (age < this.config.cacheTTL) {
        logger.debug('Using cached memory results', {
          cacheAge: age,
          resultCount: this.cache.results.length
        });
        return this.cache.results;
      }
    }

    // Perform search
    const results = await this.searchProvider.search({
      text: query,
      limit: this.config.maxEntries * 2, // Get extra in case some are filtered
      filters: context.agentName ? { agentId: context.agentName } : undefined
    });

    // Filter by relevance
    const filtered = results
      .filter(r => r.score >= this.config.minRelevance)
      .filter(r => this.isWithinMaxAge(r.createdAt))
      .slice(0, this.config.maxEntries);

    // Convert to MemoryEntry format
    const memories: MemoryEntry[] = filtered.map(r => ({
      content: r.content,
      relevance: r.score,
      agent: r.metadata?.agentId,
      timestamp: r.createdAt.getTime()
    }));

    // Update cache
    this.cache = {
      query,
      results: memories,
      timestamp: Date.now()
    };

    return memories;
  }

  /**
   * Check if memory is within max age limit
   */
  private isWithinMaxAge(createdAt: Date): boolean {
    if (this.config.maxAge === 0) {
      return true; // No limit
    }

    const age = Date.now() - createdAt.getTime();
    return age <= this.config.maxAge;
  }

  /**
   * Format memories into instruction content
   */
  private formatMemories(memories: MemoryEntry[]): string {
    const lines: string[] = [
      '## Relevant Context from Memory',
      ''
    ];

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      if (!memory) continue;

      const relevancePercent = Math.round(memory.relevance * 100);

      if (this.config.includeMetadata && memory.agent) {
        lines.push(`### Memory ${i + 1} (${relevancePercent}% relevant, from ${memory.agent})`);
      } else {
        lines.push(`### Memory ${i + 1} (${relevancePercent}% relevant)`);
      }

      // Truncate long content
      const maxLength = 500;
      const content = memory.content.length > maxLength
        ? memory.content.substring(0, maxLength) + '...'
        : memory.content;

      lines.push(content);
      lines.push('');
    }

    lines.push('**Note:** Use this context to inform your decisions, but verify current state.');

    return lines.join('\n');
  }

  /**
   * Clear the memory cache
   */
  clearCache(): void {
    this.cache = undefined;
    logger.debug('Memory cache cleared');
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryProviderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MemoryProviderConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    // Clear cache if relevance threshold changed
    if (updates.minRelevance !== undefined || updates.maxEntries !== undefined) {
      this.clearCache();
    }

    logger.debug('MemoryInstructionProvider config updated', {
      enabled: this.config.enabled,
      maxEntries: this.config.maxEntries
    });
  }

  /**
   * Reset state
   */
  reset(): void {
    this.cache = undefined;
    this.lastSearchTurn = 0;
    logger.debug('MemoryInstructionProvider reset');
  }

  /**
   * Check if search provider is configured
   */
  hasSearchProvider(): boolean {
    return !!this.searchProvider;
  }
}

/**
 * Create a mock memory search provider for testing
 */
export function createMockMemoryProvider(
  memories: Array<{
    content: string;
    score?: number;
    agentId?: string;
    createdAt?: Date;
  }> = []
): MemorySearchProvider {
  return {
    async search(query) {
      // Simple keyword matching for mock
      const queryWords = query.text.toLowerCase().split(/\s+/);

      return memories
        .map(m => ({
          content: m.content,
          score: m.score ?? calculateMockScore(m.content, queryWords),
          metadata: m.agentId ? { agentId: m.agentId } : undefined,
          createdAt: m.createdAt ?? new Date()
        }))
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, query.limit ?? 10);
    }
  };
}

/**
 * Calculate mock relevance score based on keyword matching
 */
function calculateMockScore(content: string, queryWords: string[]): number {
  const contentLower = content.toLowerCase();
  const matches = queryWords.filter(word => contentLower.includes(word));
  return matches.length / queryWords.length;
}
