/**
 * Lazy Loader - Deferred module loading for performance optimization
 *
 * This module provides lazy loading capabilities to reduce CLI startup time
 * by deferring the loading of heavy modules until they're actually needed.
 */

import { logger } from '../shared/logging/logger.js';

/**
 * Lazy loader for heavy modules
 */
export class LazyLoader<T> {
  private loader: () => Promise<T>;
  private instance: T | null = null;
  private loading: Promise<T> | null = null;
  private name: string;

  constructor(name: string, loader: () => Promise<T>) {
    this.name = name;
    this.loader = loader;
  }

  /**
   * Get the module instance, loading it if necessary
   */
  async get(): Promise<T> {
    // Return cached instance if already loaded
    if (this.instance) {
      return this.instance;
    }

    // Wait for ongoing load operation
    if (this.loading) {
      return this.loading;
    }

    // Start loading
    const start = performance.now();
    logger.debug(`Lazy loading module: ${this.name}`);

    this.loading = this.loader()
      .then(instance => {
        this.instance = instance;
        this.loading = null;
        const duration = performance.now() - start;
        logger.debug(`Module loaded: ${this.name} (${duration.toFixed(2)}ms)`);
        return instance;
      })
      .catch(error => {
        this.loading = null;
        logger.error(`Failed to lazy load module: ${this.name}`, { error });
        throw error;
      });

    return this.loading;
  }

  /**
   * Check if module is already loaded
   */
  isLoaded(): boolean {
    return this.instance !== null;
  }

  /**
   * Unload the module (clear cache)
   */
  unload(): void {
    this.instance = null;
    this.loading = null;
  }
}

/**
 * Lazy loader registry for managing multiple lazy loaders
 */
export class LazyLoaderRegistry {
  private loaders = new Map<string, LazyLoader<any>>();

  /**
   * Register a lazy loader
   */
  register<T>(name: string, loader: () => Promise<T>): LazyLoader<T> {
    const lazyLoader = new LazyLoader(name, loader);
    this.loaders.set(name, lazyLoader);
    return lazyLoader;
  }

  /**
   * Get a registered lazy loader
   */
  get<T>(name: string): LazyLoader<T> | undefined {
    return this.loaders.get(name);
  }

  /**
   * Get the instance from a registered loader
   */
  async getInstance<T>(name: string): Promise<T> {
    const loader = this.loaders.get(name);
    if (!loader) {
      throw new Error(`Lazy loader not found: ${name}`);
    }
    return loader.get();
  }

  /**
   * Preload specific modules
   */
  async preload(names: string[]): Promise<void> {
    const start = performance.now();
    logger.debug(`Preloading ${names.length} modules`, { names });

    await Promise.all(
      names.map(name => this.getInstance(name).catch(error => {
        logger.warn(`Failed to preload module: ${name}`, { error: error.message });
      }))
    );

    const duration = performance.now() - start;
    logger.debug(`Preload complete (${duration.toFixed(2)}ms)`);
  }

  /**
   * Unload all modules
   */
  unloadAll(): void {
    for (const loader of this.loaders.values()) {
      loader.unload();
    }
  }

  /**
   * Get statistics about loaded modules
   */
  getStats(): {
    total: number;
    loaded: number;
    unloaded: number;
  } {
    let loaded = 0;
    let unloaded = 0;

    for (const loader of this.loaders.values()) {
      if (loader.isLoaded()) {
        loaded++;
      } else {
        unloaded++;
      }
    }

    return {
      total: this.loaders.size,
      loaded,
      unloaded
    };
  }
}

/**
 * Global lazy loader registry instance
 */
export const lazyRegistry = new LazyLoaderRegistry();

/**
 * Helper function to create a lazy-loaded provider
 */
export function createLazyProvider<T>(name: string, importFn: () => Promise<{ default: new (...args: any[]) => T }>) {
  return lazyRegistry.register(
    name,
    async () => {
      const module = await importFn();
      return module.default;
    }
  );
}

/**
 * Helper function to create a lazy-loaded module
 */
export function createLazyModule<T>(name: string, importFn: () => Promise<T>) {
  return lazyRegistry.register(name, importFn);
}
