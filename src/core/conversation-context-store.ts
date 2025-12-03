/**
 * Conversation Context Store
 *
 * Manages bidirectional context sharing between AI assistants and AutomatosX.
 * Stores conversation context to reduce repeated information.
 *
 * @since v10.2.0 (Phase 3.1)
 */

import { mkdir, readFile, writeFile, readdir, unlink, stat } from 'node:fs/promises';
import { join, resolve, relative } from 'path';
import { logger } from '../utils/logger.js';

/**
 * Valid context ID pattern - alphanumeric, underscores, hyphens only
 * Max 64 characters to prevent filesystem issues
 */
const VALID_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Conversation context entry
 */
export interface ConversationContext {
  id: string;                    // Unique context ID
  source: string;                 // Source assistant (e.g., "gemini-cli", "claude-code")
  timestamp: string;              // ISO 8601 timestamp
  content: string;                // Context content
  metadata?: {
    topic?: string;               // Conversation topic
    participants?: string[];      // Agent names involved
    tags?: string[];              // Searchable tags
  };
}

export interface ConversationContextStoreOptions {
  storePath: string;              // Storage directory (e.g., .automatosx/context)
  maxEntries?: number;            // Max entries before auto-cleanup (default: 100)
  ttlMs?: number;                 // TTL in milliseconds (default: 24 hours)
}

/**
 * Conversation Context Store
 *
 * Provides persistent storage for conversation context with TTL cleanup.
 */
export class ConversationContextStore {
  private readonly storePath: string;
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options: ConversationContextStoreOptions) {
    this.storePath = options.storePath;
    this.maxEntries = options.maxEntries ?? 100;
    this.ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Validate and sanitize context ID to prevent path traversal attacks
   *
   * SECURITY: This is critical to prevent path traversal vulnerabilities.
   * A malicious ID like "../../.ssh/id_rsa" could read/write/delete files
   * outside the context store directory.
   *
   * @param id - Context ID to validate
   * @returns Sanitized file path within storePath
   * @throws Error if ID is invalid or path escapes storePath
   */
  private validateAndResolvePath(id: string): string {
    // Step 1: Validate ID format (strict whitelist)
    if (!VALID_ID_PATTERN.test(id)) {
      throw new Error(
        `Invalid context ID: "${id}". IDs must be 1-64 characters, alphanumeric with underscores/hyphens only.`
      );
    }

    // Step 2: Construct and resolve the full path
    const filePath = join(this.storePath, `${id}.json`);
    const resolvedPath = resolve(filePath);
    const resolvedStorePath = resolve(this.storePath);

    // Step 3: Verify path stays within storePath (defense in depth)
    const relativePath = relative(resolvedStorePath, resolvedPath);
    if (relativePath.startsWith('..') || relativePath.includes('/..') || relativePath.includes('\\..')) {
      logger.error('[ContextStore] Path traversal attempt blocked', { id, resolvedPath });
      throw new Error(`Security violation: context ID "${id}" would escape store directory`);
    }

    return resolvedPath;
  }

  /**
   * Initialize store (create directory if needed)
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.storePath, { recursive: true });
      logger.info('[ContextStore] Initialized', { storePath: this.storePath });
    } catch (error) {
      logger.error('[ContextStore] Failed to initialize', { error });
      throw error;
    }
  }

  /**
   * Save conversation context
   */
  async save(context: ConversationContext): Promise<void> {
    await this.initialize(); // Ensure directory exists

    // SECURITY: Validate ID to prevent path traversal
    const filePath = this.validateAndResolvePath(context.id);
    const data = JSON.stringify(context, null, 2);

    try {
      await writeFile(filePath, data, 'utf-8');
      logger.info('[ContextStore] Context saved', {
        id: context.id,
        source: context.source,
        size: data.length
      });

      // Trigger cleanup if needed
      await this.cleanup();
    } catch (error) {
      logger.error('[ContextStore] Failed to save context', { id: context.id, error });
      throw error;
    }
  }

  /**
   * Get conversation context by ID
   */
  async get(id: string): Promise<ConversationContext | null> {
    // SECURITY: Validate ID to prevent path traversal
    const filePath = this.validateAndResolvePath(id);

    try {
      const data = await readFile(filePath, 'utf-8');
      const context = JSON.parse(data) as ConversationContext;

      // Check TTL
      const age = Date.now() - new Date(context.timestamp).getTime();
      if (age > this.ttlMs) {
        logger.info('[ContextStore] Context expired', { id, age });
        await this.delete(id);
        return null;
      }

      return context;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null; // Not found
      }
      logger.error('[ContextStore] Failed to get context', { id, error });
      throw error;
    }
  }

  /**
   * List all context entries (non-expired)
   */
  async list(options?: {
    source?: string;
    limit?: number;
  }): Promise<ConversationContext[]> {
    try {
      const files = await readdir(this.storePath);
      const contexts: ConversationContext[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const id = file.replace('.json', '');
        const context = await this.get(id);

        if (context) {
          // Filter by source if specified
          if (options?.source && context.source !== options.source) {
            continue;
          }

          contexts.push(context);
        }
      }

      // Sort by timestamp (newest first)
      contexts.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply limit
      const limit = options?.limit ?? contexts.length;
      return contexts.slice(0, limit);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return []; // Directory doesn't exist yet
      }
      logger.error('[ContextStore] Failed to list contexts', { error });
      throw error;
    }
  }

  /**
   * Delete context entry
   */
  async delete(id: string): Promise<void> {
    // SECURITY: Validate ID to prevent path traversal
    const filePath = this.validateAndResolvePath(id);

    try {
      await unlink(filePath);
      logger.info('[ContextStore] Context deleted', { id });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return; // Already deleted
      }
      logger.error('[ContextStore] Failed to delete context', { id, error });
      throw error;
    }
  }

  /**
   * Clean up expired and excess entries
   */
  async cleanup(): Promise<void> {
    try {
      const files = await readdir(this.storePath);
      const entries: Array<{ id: string; mtime: Date }> = [];

      // Collect all entries with modification times
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.storePath, file);
        const stats = await stat(filePath);
        const id = file.replace('.json', '');

        entries.push({ id, mtime: stats.mtime });
      }

      // Sort by modification time (oldest first)
      entries.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // Delete expired entries
      for (const entry of entries) {
        const context = await this.get(entry.id);
        if (!context) {
          // Already deleted by get() if expired
          continue;
        }
      }

      // Delete excess entries (keep newest maxEntries)
      if (entries.length > this.maxEntries) {
        const toDelete = entries.slice(0, entries.length - this.maxEntries);
        for (const entry of toDelete) {
          await this.delete(entry.id);
        }
        logger.info('[ContextStore] Cleaned up excess entries', {
          deleted: toDelete.length,
          remaining: this.maxEntries
        });
      }
    } catch (error) {
      logger.error('[ContextStore] Cleanup failed', { error });
      // Don't throw - cleanup is best-effort
    }
  }

  /**
   * Clear all contexts
   */
  async clear(): Promise<void> {
    try {
      const files = await readdir(this.storePath);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = file.replace('.json', '');
        await this.delete(id);
      }

      logger.info('[ContextStore] All contexts cleared');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return; // Directory doesn't exist
      }
      logger.error('[ContextStore] Failed to clear contexts', { error });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async stats(): Promise<{
    totalEntries: number;
    bySource: Record<string, number>;
    oldestEntry?: string;
    newestEntry?: string;
  }> {
    const contexts = await this.list();

    const bySource: Record<string, number> = {};
    for (const context of contexts) {
      bySource[context.source] = (bySource[context.source] ?? 0) + 1;
    }

    return {
      totalEntries: contexts.length,
      bySource,
      oldestEntry: contexts[contexts.length - 1]?.timestamp,
      newestEntry: contexts[0]?.timestamp
    };
  }
}
