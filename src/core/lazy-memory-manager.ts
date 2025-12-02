/**
 * Lazy Memory Manager - Deferred initialization wrapper
 *
 * **Purpose**: Delay MemoryManager initialization until first actual use
 *
 * **Problem**: MemoryManager.create() takes ~328ms (92% of CLI startup time)
 * due to SQLite database initialization, even when memory is not immediately needed.
 *
 * **Solution**: Wrap MemoryManager with lazy initialization proxy that defers
 * the expensive database setup until the first search() or add() call.
 *
 * **Benefits**:
 * - CLI startup: 355ms → 27ms (-92%)
 * - Backward compatible: Implements IMemoryManager interface
 * - Thread-safe: Prevents race conditions during initialization
 * - Transparent: Users don't need to change their code
 *
 * **Usage**:
 * ```typescript
 * // Before (eager initialization - 328ms on startup)
 * const memory = await MemoryManager.create({ dbPath: '...' });
 *
 * // After (lazy initialization - 0ms on startup, 328ms on first use)
 * const memory = new LazyMemoryManager({ dbPath: '...' });
 * ```
 *
 * v5.6.24: Initial implementation for startup optimization
 */

import type {
  IMemoryManager,
  MemoryEntry,
  MemoryMetadata,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryManagerConfig,
  MemoryStats,
  ExportOptions,
  ExportResult,
  ImportOptions,
  ImportResult
} from '../types/memory.js';
import { MemoryManager } from './memory-manager.js';
import { logger } from '../utils/logger.js';
import {
  ComponentType,
  LifecycleState,
  markState,
  PerformanceTimer
} from '../utils/performance-markers.js';

export class LazyMemoryManager implements IMemoryManager {
  private manager?: MemoryManager;
  private config: MemoryManagerConfig;
  private initPromise?: Promise<MemoryManager>;
  private closing = false; // BUG FIX (v5.12.1): Prevent access during shutdown

  constructor(config: MemoryManagerConfig) {
    this.config = config;
    markState(ComponentType.LAZY_MEMORY_MANAGER, LifecycleState.NOT_INITIALIZED, {
      dbPath: config.dbPath,
      message: 'created (initialization deferred until first use)'
    });
  }

  /**
   * Ensure MemoryManager is initialized (singleton pattern)
   *
   * **Thread-safe**: Prevents duplicate initialization if called concurrently
   *
   * v5.6.27: Fixed race condition - await initPromise before returning manager
   * v5.12.1: Added closing flag check to prevent access during shutdown
   */
  private async ensureInitialized(): Promise<MemoryManager> {
    // BUG FIX (v5.12.1): Wait if manager is being closed
    if (this.closing) {
      throw new Error('MemoryManager is closing, cannot perform operations');
    }

    // Fast path: Already initialized
    if (this.manager) {
      return this.manager;
    }

    // Prevent duplicate initialization (race condition)
    if (this.initPromise) {
      logger.debug('🔄 LazyMemoryManager: waiting for concurrent initialization');
      await this.initPromise;
      return this.manager!; // Safe: initPromise guarantees manager is set
    }

    // Initialize MemoryManager
    markState(ComponentType.LAZY_MEMORY_MANAGER, LifecycleState.INITIALIZING, {
      message: 'triggering database initialization',
      trigger: 'first method call'
    });

    const timer = new PerformanceTimer(
      ComponentType.LAZY_MEMORY_MANAGER,
      'initialize database',
      'database'
    );

    this.initPromise = MemoryManager.create(this.config);
    try {
      this.manager = await this.initPromise;
      timer.end();

      markState(ComponentType.LAZY_MEMORY_MANAGER, LifecycleState.INITIALIZED, {
        message: 'database initialized'
      });

      return this.manager;
    } finally {
      // CRITICAL: Always clear initPromise to allow retry on failure
      this.initPromise = undefined;
    }
  }

  /**
   * Search memory entries (lazy initialization on first call)
   */
  async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const manager = await this.ensureInitialized();
    return manager.search(query);
  }

  /**
   * Add memory entry (lazy initialization on first call)
   */
  async add(
    content: string,
    embedding: number[] | null,
    metadata: MemoryMetadata
  ): Promise<MemoryEntry> {
    const manager = await this.ensureInitialized();
    return manager.add(content, embedding, metadata);
  }

  /**
   * Get memory entry by ID (lazy initialization on first call)
   */
  async get(id: number): Promise<MemoryEntry | null> {
    const manager = await this.ensureInitialized();
    return manager.get(id);
  }

  /**
   * Update memory metadata (lazy initialization on first call)
   */
  async update(id: number, metadata: Partial<MemoryMetadata>): Promise<void> {
    const manager = await this.ensureInitialized();
    return manager.update(id, metadata);
  }

  /**
   * Get memory statistics (lazy initialization on first call)
   */
  async getStats(): Promise<MemoryStats> {
    const manager = await this.ensureInitialized();
    return manager.getStats();
  }

  /**
   * Cleanup old memories (lazy initialization on first call)
   */
  async cleanup(olderThanDays?: number): Promise<number> {
    const manager = await this.ensureInitialized();
    return manager.cleanup(olderThanDays);
  }

  /**
   * Delete memory entry (lazy initialization on first call)
   */
  async delete(id: number): Promise<void> {
    const manager = await this.ensureInitialized();
    return manager.delete(id);
  }

  /**
   * Clear all memory entries (lazy initialization on first call)
   */
  async clear(): Promise<void> {
    const manager = await this.ensureInitialized();
    return manager.clear();
  }

  /**
   * Save index to disk (lazy initialization on first call)
   */
  async saveIndex(): Promise<void> {
    const manager = await this.ensureInitialized();
    return manager.saveIndex();
  }

  /**
   * Load index from disk (lazy initialization on first call)
   */
  async loadIndex(): Promise<void> {
    const manager = await this.ensureInitialized();
    return manager.loadIndex();
  }

  /**
   * Backup database to destination path (lazy initialization on first call)
   */
  async backup(destPath: string, onProgress?: (progress: number) => void): Promise<void> {
    const manager = await this.ensureInitialized();
    // Note: MemoryManager.backup() doesn't accept onProgress, but interface requires it
    // We ignore onProgress for now (future enhancement)
    return manager.backup(destPath);
  }

  /**
   * Restore memory from backup (lazy initialization on first call)
   */
  async restore(srcPath: string): Promise<void> {
    const manager = await this.ensureInitialized();
    return manager.restore(srcPath);
  }

  /**
   * Export memories to JSON file (lazy initialization on first call)
   */
  async exportToJSON(filePath: string, options?: ExportOptions): Promise<ExportResult> {
    const manager = await this.ensureInitialized();
    return manager.exportToJSON(filePath, options);
  }

  /**
   * Import memories from JSON file (lazy initialization on first call)
   */
  async importFromJSON(filePath: string, options?: ImportOptions): Promise<ImportResult> {
    const manager = await this.ensureInitialized();
    return manager.importFromJSON(filePath, options);
  }

  /**
   * Get all memory entries with optional filters (lazy initialization on first call)
   */
  async getAll(options?: {
    type?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
    orderBy?: 'created' | 'accessed' | 'count';
    order?: 'asc' | 'desc';
  }): Promise<MemoryEntry[]> {
    const manager = await this.ensureInitialized();
    return manager.getAll(options);
  }

  /**
   * Close database connection (only if initialized)
   *
   * **Safe**: Does nothing if never initialized (no connection to close)
   * **Race-safe**: Waits for any in-flight initialization before closing
   * v5.12.1: Enhanced with closing flag to prevent concurrent access during shutdown
   */
  async close(): Promise<void> {
    // CRITICAL: Wait for any in-flight initialization to complete
    // to avoid leaving a dangling open manager
    if (this.initPromise) {
      try {
        logger.debug('LazyMemoryManager: waiting for initialization to complete before closing');
        await this.initPromise;
      } catch (error) {
        // Initialization failed, nothing to close
        logger.debug('LazyMemoryManager: initialization failed, nothing to close', {
          error: (error as Error).message
        });
        // Clear initPromise to prevent post-close method calls from failing
        this.initPromise = undefined;
        return;
      }
    }

    // BUG FIX (v5.12.1): Prevent new operations from starting during close
    if (!this.manager) {
      logger.debug('LazyMemoryManager close() called but never initialized');
      return;
    }

    this.closing = true;
    const manager = this.manager;
    this.manager = undefined;
    this.initPromise = undefined;

    try {
      logger.debug('Closing LazyMemoryManager (was initialized)');
      await manager.close();
    } finally {
      this.closing = false;
    }
  }

  /**
   * Check if MemoryManager has been initialized
   *
   * **Useful for testing** and debugging
   */
  isInitialized(): boolean {
    return this.manager !== undefined;
  }
}
