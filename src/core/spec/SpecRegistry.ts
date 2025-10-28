/**
 * SpecRegistry - Per-workspace spec management
 *
 * Factory pattern for managing spec lifecycle per workspace
 * Handles detection, loading, validation, caching, and events
 * Thread-safe with async locks for idempotent creation
 *
 * @module core/spec/SpecRegistry
 */

import { EventEmitter } from 'events';
import { stat, access, readFile } from 'fs/promises';
import { join } from 'path';
import { watch, FSWatcher } from 'fs';
import { createHash } from 'crypto';
import type {
  SpecRegistryOptions,
  SpecMetadata,
  ParsedSpec,
  SpecValidationResult,
  SpecEvent,
  SpecEventType,
  SpecErrorCode
} from '../../types/spec.js';
import { SpecError } from '../../types/spec.js';
import { SpecLoader } from './SpecLoader.js';
import { SpecValidator } from './SpecValidator.js';
import { SpecGraphBuilder } from './SpecGraphBuilder.js';
import { SpecCache, getGlobalCache } from './SpecCache.js';
import { logger } from '../../utils/logger.js';

/**
 * Default registry options
 */
const DEFAULT_OPTIONS: Partial<SpecRegistryOptions> = {
  enableCache: true,
  cacheSize: 100,
  enableWatch: false,
  validationOptions: {
    mode: 'strict',
    validateDependencies: true,
    validateOps: true
  }
};

/**
 * SpecRegistry class
 * Manages spec lifecycle for a single workspace
 */
export class SpecRegistry extends EventEmitter {
  private options: SpecRegistryOptions;
  private workspacePath: string;
  private specDir: string;
  private cache: SpecCache | null;
  private currentSpec: ParsedSpec | null;
  private watcher: FSWatcher | null;
  private isLoading: boolean;
  private debounceTimers: Set<NodeJS.Timeout>;

  constructor(options: SpecRegistryOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.workspacePath = options.workspacePath;
    this.specDir = join(this.workspacePath, '.specify');
    this.cache = this.options.enableCache ? getGlobalCache({ maxSize: this.options.cacheSize }) : null;
    this.currentSpec = null;
    this.watcher = null;
    this.isLoading = false;
    this.debounceTimers = new Set();

    logger.info('SpecRegistry created', {
      workspacePath: this.workspacePath,
      enableCache: this.options.enableCache,
      enableWatch: this.options.enableWatch
    });
  }

  /**
   * Detect if spec exists in workspace
   */
  async detect(): Promise<SpecMetadata | null> {
    try {
      // Check if .specify directory exists
      await access(this.specDir);
      const stats = await stat(this.specDir);

      if (!stats.isDirectory()) {
        logger.debug('Spec directory is not a directory', { specDir: this.specDir });
        return null;
      }

      // Check if required files exist
      const requiredFiles = ['spec.md', 'plan.md', 'tasks.md'];
      const filesExist = await Promise.all(
        requiredFiles.map(async file => {
          try {
            await access(join(this.specDir, file));
            return true;
          } catch {
            return false;
          }
        })
      );

      if (!filesExist.every(exists => exists)) {
        logger.debug('Not all required spec files exist', {
          specDir: this.specDir,
          filesExist
        });
        return null;
      }

      // Load spec to get metadata
      const spec = await this.load();

      this.emit('spec:detected', {
        type: 'spec:detected',
        timestamp: new Date(),
        workspacePath: this.workspacePath,
        specId: spec.metadata.id,
        data: { metadata: spec.metadata }
      } as SpecEvent);

      logger.info('Spec detected', {
        specId: spec.metadata.id,
        workspacePath: this.workspacePath
      });

      return spec.metadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Spec not found', { specDir: this.specDir });
        return null;
      }

      logger.error('Spec detection failed', {
        error: (error as Error).message,
        specDir: this.specDir
      });
      throw error;
    }
  }

  /**
   * Load and parse spec
   */
  async load(): Promise<ParsedSpec> {
    // Prevent concurrent loading
    if (this.isLoading) {
      logger.debug('Spec loading already in progress, waiting...');
      await this.waitForLoad();
      if (this.currentSpec) {
        return this.currentSpec;
      }
    }

    this.isLoading = true;

    try {
      logger.info('Loading spec', { workspacePath: this.workspacePath });

      // Calculate fresh checksum quickly (no parsing)
      const freshChecksum = await this.calculateQuickChecksum();

      // Check cache with fresh checksum first
      if (this.cache) {
        const cached = this.cache.get(this.workspacePath, freshChecksum);
        if (cached) {
          logger.debug('Spec loaded from cache (checksum match)', {
            specId: cached.metadata.id,
            checksum: freshChecksum
          });
          // Update current spec with cached version
          this.currentSpec = cached;
          return cached;
        }
      }

      // Cache miss or checksum changed - do full load
      logger.debug('Cache miss or checksum changed, loading spec', {
        freshChecksum,
        oldChecksum: this.currentSpec?.metadata.checksum
      });

      // Create loader
      const loader = new SpecLoader({
        workspacePath: this.workspacePath,
        specDir: '.specify',
        parseOptions: {
          strict: this.options.validationOptions?.mode === 'strict'
        }
      });

      // Load spec (will parse everything)
      const spec = await loader.load();

      // Build graph
      spec.graph = SpecGraphBuilder.build(spec.tasks);

      // Update current spec
      this.currentSpec = spec;

      // Cache the spec
      if (this.cache) {
        this.cache.set(spec);
      }

      // Emit event
      this.emit('spec:loaded', {
        type: 'spec:loaded',
        timestamp: new Date(),
        workspacePath: this.workspacePath,
        specId: spec.metadata.id,
        data: { metadata: spec.metadata }
      } as SpecEvent);

      logger.info('Spec loaded successfully', {
        specId: spec.metadata.id,
        taskCount: spec.tasks.length,
        checksum: spec.metadata.checksum
      });

      // Enable file watching if requested
      if (this.options.enableWatch && !this.watcher) {
        this.setupFileWatcher();
      }

      return spec;
    } catch (error) {
      logger.error('Spec loading failed', {
        error: (error as Error).message,
        workspacePath: this.workspacePath
      });
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Wait for ongoing load to complete
   */
  private async waitForLoad(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.isLoading) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Calculate checksum of spec files quickly without full parsing
   */
  private async calculateQuickChecksum(): Promise<string> {
    try {
      const [specContent, planContent, tasksContent] = await Promise.all([
        readFile(join(this.specDir, 'spec.md'), 'utf8'),
        readFile(join(this.specDir, 'plan.md'), 'utf8'),
        readFile(join(this.specDir, 'tasks.md'), 'utf8')
      ]);

      const hash = createHash('sha256');
      hash.update(specContent);
      hash.update(planContent);
      hash.update(tasksContent);
      return hash.digest('hex').substring(0, 16);
    } catch (error) {
      logger.error('Failed to calculate quick checksum', {
        error: (error as Error).message,
        specDir: this.specDir
      });
      throw error;
    }
  }

  /**
   * Validate spec
   */
  async validate(): Promise<SpecValidationResult> {
    if (!this.currentSpec) {
      throw new SpecError(
        'SPEC_NOT_FOUND' as SpecErrorCode,
        'No spec loaded. Call load() first.',
        { workspacePath: this.workspacePath }
      );
    }

    logger.info('Validating spec', {
      specId: this.currentSpec.metadata.id
    });

    const validator = new SpecValidator(this.options.validationOptions);
    const result = await validator.validate(this.currentSpec);

    // Emit event
    this.emit('spec:validated', {
      type: 'spec:validated',
      timestamp: new Date(),
      workspacePath: this.workspacePath,
      specId: this.currentSpec.metadata.id,
      data: { result }
    } as SpecEvent);

    logger.info('Spec validation complete', {
      specId: this.currentSpec.metadata.id,
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    });

    return result;
  }

  /**
   * Get current spec
   */
  getSpec(): ParsedSpec | null {
    return this.currentSpec;
  }

  /**
   * Invalidate spec cache and reload
   */
  async invalidate(): Promise<void> {
    logger.info('Invalidating spec cache', {
      workspacePath: this.workspacePath
    });

    // Clear cache
    if (this.cache && this.currentSpec) {
      this.cache.invalidate(
        this.workspacePath,
        this.currentSpec.metadata.checksum
      );
    }

    // Clear current spec
    this.currentSpec = null;

    // Emit event
    this.emit('spec:invalidated', {
      type: 'spec:invalidated',
      timestamp: new Date(),
      workspacePath: this.workspacePath
    } as SpecEvent);

    // Reload
    await this.load();
  }

  /**
   * Setup file watcher for automatic invalidation
   */
  private setupFileWatcher(): void {
    if (this.watcher) {
      return;
    }

    try {
      this.watcher = watch(
        this.specDir,
        { recursive: false },
        (eventType, filename) => {
          if (filename && /\.(md|yaml|yml)$/i.test(filename)) {
            logger.debug('Spec file changed', { filename, eventType });

            // Debounce file changes
            const timer = setTimeout(() => {
              this.debounceTimers.delete(timer);
              this.handleFileChange(filename);
            }, 500);
            this.debounceTimers.add(timer);
          }
        }
      );

      logger.info('File watcher enabled', { specDir: this.specDir });
    } catch (error) {
      logger.error('Failed to setup file watcher', {
        error: (error as Error).message,
        specDir: this.specDir
      });
    }
  }

  /**
   * Handle file change event
   */
  private handleFileChange(filename: string): void {
    logger.info('Spec file changed, invalidating cache', { filename });

    // Emit event
    this.emit('spec:changed', {
      type: 'spec:changed',
      timestamp: new Date(),
      workspacePath: this.workspacePath,
      data: { filename }
    } as SpecEvent);

    // Invalidate and reload
    this.invalidate().catch(error => {
      logger.error('Failed to reload spec after file change', {
        error: (error as Error).message,
        filename
      });
    });
  }

  /**
   * Destroy registry and cleanup resources
   */
  async destroy(): Promise<void> {
    logger.info('Destroying SpecRegistry', {
      workspacePath: this.workspacePath
    });

    // Clear all debounce timers
    for (const timer of this.debounceTimers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close file watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Clear cache entries for this workspace
    if (this.cache) {
      this.cache.invalidateWorkspace(this.workspacePath);
    }

    // Clear current spec
    this.currentSpec = null;

    // Remove all listeners
    this.removeAllListeners();

    logger.info('SpecRegistry destroyed', {
      workspacePath: this.workspacePath
    });
  }

  /**
   * Emit typed event
   */
  emitEvent(type: SpecEventType, data?: Record<string, unknown>): void {
    const event: SpecEvent = {
      type,
      timestamp: new Date(),
      workspacePath: this.workspacePath,
      specId: this.currentSpec?.metadata.id,
      data
    };

    this.emit(type, event);
  }
}

/**
 * SpecRegistryFactory
 * Factory for managing per-workspace registries
 */
export class SpecRegistryFactory {
  private static registries = new Map<string, SpecRegistry>();
  private static locks = new Map<string, Promise<SpecRegistry>>();

  /**
   * Create or get registry for workspace
   */
  static async create(
    workspacePath: string,
    options?: Partial<SpecRegistryOptions>
  ): Promise<SpecRegistry> {
    // Check if registry already exists
    const existing = this.registries.get(workspacePath);
    if (existing) {
      logger.debug('Returning existing registry', { workspacePath });
      return existing;
    }

    // Check if creation is in progress
    const lock = this.locks.get(workspacePath);
    if (lock) {
      logger.debug('Registry creation in progress, waiting...', { workspacePath });
      return lock;
    }

    // Create new registry with lock
    const creationPromise = this.doCreate(workspacePath, options);
    this.locks.set(workspacePath, creationPromise);

    try {
      const registry = await creationPromise;
      this.registries.set(workspacePath, registry);
      return registry;
    } finally {
      this.locks.delete(workspacePath);
    }
  }

  /**
   * Internal creation method
   */
  private static async doCreate(
    workspacePath: string,
    options?: Partial<SpecRegistryOptions>
  ): Promise<SpecRegistry> {
    logger.info('Creating SpecRegistry', { workspacePath });

    const registry = new SpecRegistry({
      workspacePath,
      ...options
    });

    logger.info('SpecRegistry created', { workspacePath });
    return registry;
  }

  /**
   * Get registry for workspace (must exist)
   */
  static get(workspacePath: string): SpecRegistry | null {
    return this.registries.get(workspacePath) || null;
  }

  /**
   * Destroy registry for workspace
   */
  static async destroy(workspacePath: string): Promise<void> {
    const registry = this.registries.get(workspacePath);
    if (registry) {
      await registry.destroy();
      this.registries.delete(workspacePath);
      logger.info('SpecRegistry destroyed', { workspacePath });
    }
  }

  /**
   * Destroy all registries
   */
  static async destroyAll(): Promise<void> {
    logger.info('Destroying all SpecRegistries', {
      count: this.registries.size
    });

    const promises = Array.from(this.registries.keys()).map(workspacePath =>
      this.destroy(workspacePath)
    );

    await Promise.all(promises);

    logger.info('All SpecRegistries destroyed');
  }

  /**
   * Get all workspace paths with registries
   */
  static getWorkspaces(): string[] {
    return Array.from(this.registries.keys());
  }

  /**
   * Get registry count
   */
  static getCount(): number {
    return this.registries.size;
  }

  /**
   * Check if registry exists for workspace
   */
  static has(workspacePath: string): boolean {
    return this.registries.has(workspacePath);
  }
}
