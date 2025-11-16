/**
 * Tests for Lazy Loader
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LazyLoader, LazyLoaderRegistry, lazyRegistry, createLazyModule } from '../../src/core/lazy-loader.js';

describe('LazyLoader', () => {
  describe('constructor', () => {
    it('should create lazy loader with name and loader function', () => {
      const loader = new LazyLoader('test', async () => ({ value: 42 }));
      expect(loader.isLoaded()).toBe(false);
    });
  });

  describe('get', () => {
    it('should load module on first call', async () => {
      let callCount = 0;
      const loader = new LazyLoader('test', async () => {
        callCount++;
        return { value: 42 };
      });

      const result = await loader.get();
      expect(result.value).toBe(42);
      expect(callCount).toBe(1);
      expect(loader.isLoaded()).toBe(true);
    });

    it('should return cached instance on subsequent calls', async () => {
      let callCount = 0;
      const loader = new LazyLoader('test', async () => {
        callCount++;
        return { value: 42 };
      });

      const result1 = await loader.get();
      const result2 = await loader.get();
      const result3 = await loader.get();

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(callCount).toBe(1); // Should only load once
    });

    it('should handle concurrent get calls correctly', async () => {
      let callCount = 0;
      const loader = new LazyLoader('test', async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return { value: 42 };
      });

      // Make 3 concurrent calls
      const [result1, result2, result3] = await Promise.all([
        loader.get(),
        loader.get(),
        loader.get()
      ]);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(callCount).toBe(1); // Should only load once even with concurrent calls
    });

    it('should handle loader errors', async () => {
      const loader = new LazyLoader('test', async () => {
        throw new Error('Load failed');
      });

      await expect(loader.get()).rejects.toThrow('Load failed');
      expect(loader.isLoaded()).toBe(false);

      // Should retry on next call
      await expect(loader.get()).rejects.toThrow('Load failed');
    });
  });

  describe('isLoaded', () => {
    it('should return false before loading', () => {
      const loader = new LazyLoader('test', async () => ({ value: 42 }));
      expect(loader.isLoaded()).toBe(false);
    });

    it('should return true after loading', async () => {
      const loader = new LazyLoader('test', async () => ({ value: 42 }));
      await loader.get();
      expect(loader.isLoaded()).toBe(true);
    });
  });

  describe('unload', () => {
    it('should clear cached instance', async () => {
      let callCount = 0;
      const loader = new LazyLoader('test', async () => {
        callCount++;
        return { value: 42 };
      });

      await loader.get();
      expect(loader.isLoaded()).toBe(true);
      expect(callCount).toBe(1);

      loader.unload();
      expect(loader.isLoaded()).toBe(false);

      // Should reload on next get
      await loader.get();
      expect(callCount).toBe(2);
    });
  });
});

describe('LazyLoaderRegistry', () => {
  let registry: LazyLoaderRegistry;

  beforeEach(() => {
    registry = new LazyLoaderRegistry();
  });

  describe('register', () => {
    it('should register a lazy loader', () => {
      const loader = registry.register('test', async () => ({ value: 42 }));
      expect(loader).toBeInstanceOf(LazyLoader);
      expect(registry.get('test')).toBe(loader);
    });

    it('should allow multiple registrations', () => {
      registry.register('loader1', async () => ({ value: 1 }));
      registry.register('loader2', async () => ({ value: 2 }));
      registry.register('loader3', async () => ({ value: 3 }));

      expect(registry.get('loader1')).toBeDefined();
      expect(registry.get('loader2')).toBeDefined();
      expect(registry.get('loader3')).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return registered loader', () => {
      const loader = registry.register('test', async () => ({ value: 42 }));
      expect(registry.get('test')).toBe(loader);
    });

    it('should return undefined for unregistered loader', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('getInstance', () => {
    it('should load and return instance', async () => {
      registry.register('test', async () => ({ value: 42 }));
      const instance = await registry.getInstance<{ value: number }>('test');
      expect(instance.value).toBe(42);
    });

    it('should throw error for unregistered loader', async () => {
      await expect(registry.getInstance('nonexistent'))
        .rejects.toThrow('Lazy loader not found: nonexistent');
    });

    it('should return cached instance on subsequent calls', async () => {
      let callCount = 0;
      registry.register('test', async () => {
        callCount++;
        return { value: 42 };
      });

      const instance1 = await registry.getInstance('test');
      const instance2 = await registry.getInstance('test');

      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1);
    });
  });

  describe('preload', () => {
    it('should preload multiple modules', async () => {
      const loadCounts = { a: 0, b: 0, c: 0 };

      registry.register('a', async () => {
        loadCounts.a++;
        return { value: 1 };
      });
      registry.register('b', async () => {
        loadCounts.b++;
        return { value: 2 };
      });
      registry.register('c', async () => {
        loadCounts.c++;
        return { value: 3 };
      });

      await registry.preload(['a', 'b', 'c']);

      expect(loadCounts.a).toBe(1);
      expect(loadCounts.b).toBe(1);
      expect(loadCounts.c).toBe(1);

      // Should use cached instances
      await registry.getInstance('a');
      await registry.getInstance('b');
      await registry.getInstance('c');

      expect(loadCounts.a).toBe(1);
      expect(loadCounts.b).toBe(1);
      expect(loadCounts.c).toBe(1);
    });

    it('should handle preload errors gracefully', async () => {
      registry.register('good', async () => ({ value: 42 }));
      registry.register('bad', async () => {
        throw new Error('Load failed');
      });

      // Should not throw, just log warning
      await expect(registry.preload(['good', 'bad'])).resolves.toBeUndefined();

      // Good module should be loaded
      const good = registry.get('good');
      expect(good?.isLoaded()).toBe(true);

      // Bad module should not be loaded
      const bad = registry.get('bad');
      expect(bad?.isLoaded()).toBe(false);
    });
  });

  describe('unloadAll', () => {
    it('should unload all modules', async () => {
      registry.register('a', async () => ({ value: 1 }));
      registry.register('b', async () => ({ value: 2 }));
      registry.register('c', async () => ({ value: 3 }));

      await registry.preload(['a', 'b', 'c']);

      expect(registry.get('a')?.isLoaded()).toBe(true);
      expect(registry.get('b')?.isLoaded()).toBe(true);
      expect(registry.get('c')?.isLoaded()).toBe(true);

      registry.unloadAll();

      expect(registry.get('a')?.isLoaded()).toBe(false);
      expect(registry.get('b')?.isLoaded()).toBe(false);
      expect(registry.get('c')?.isLoaded()).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      registry.register('a', async () => ({ value: 1 }));
      registry.register('b', async () => ({ value: 2 }));
      registry.register('c', async () => ({ value: 3 }));

      let stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.loaded).toBe(0);
      expect(stats.unloaded).toBe(3);

      // Load some modules
      await registry.getInstance('a');
      await registry.getInstance('b');

      stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.loaded).toBe(2);
      expect(stats.unloaded).toBe(1);

      // Load remaining
      await registry.getInstance('c');

      stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.loaded).toBe(3);
      expect(stats.unloaded).toBe(0);
    });
  });
});

describe('Helper functions', () => {
  describe('createLazyModule', () => {
    it('should create and register lazy module', async () => {
      const loader = createLazyModule('test-module', async () => ({ value: 42 }));

      expect(loader).toBeInstanceOf(LazyLoader);
      expect(lazyRegistry.get('test-module')).toBe(loader);

      const instance = await loader.get();
      expect(instance.value).toBe(42);
    });
  });
});
