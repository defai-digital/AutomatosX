/**
 * Example Plugin Manager Tests
 * Sprint 5 Day 48: Example plugin management tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ExamplePluginManager,
  createExamplePluginManager,
  getGlobalManager,
  resetGlobalManager,
  registerBuiltInExamples,
  type ExamplePlugin,
} from '../../community/ExamplePluginManager.js'

describe('ExamplePluginManager', () => {
  let manager: ExamplePluginManager

  const samplePlugin: ExamplePlugin = {
    id: 'test-plugin',
    name: 'Test Plugin',
    description: 'A test plugin',
    category: 'beginner',
    features: ['feature1', 'feature2'],
    sourceUrl: '/examples/test-plugin',
    documentationUrl: '/docs/test-plugin',
    demoCommand: 'ax test',
    tags: ['test', 'beginner'],
  }

  beforeEach(() => {
    manager = createExamplePluginManager()
  })

  describe('Registration', () => {
    it('should register a plugin', () => {
      manager.register(samplePlugin)

      expect(manager.getPlugin('test-plugin')).toEqual(samplePlugin)
    })

    it('should emit plugin-registered event', () => {
      const listener = vi.fn()
      manager.on('plugin-registered', listener)

      manager.register(samplePlugin)

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
      })
    })

    it('should unregister a plugin', () => {
      manager.register(samplePlugin)

      const removed = manager.unregister('test-plugin')

      expect(removed).toBe(true)
      expect(manager.getPlugin('test-plugin')).toBeUndefined()
    })

    it('should emit plugin-unregistered event', () => {
      manager.register(samplePlugin)

      const listener = vi.fn()
      manager.on('plugin-unregistered', listener)

      manager.unregister('test-plugin')

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
      })
    })

    it('should return false when unregistering non-existent plugin', () => {
      const removed = manager.unregister('non-existent')

      expect(removed).toBe(false)
    })

    it('should remove from installed when unregistering', () => {
      manager.register(samplePlugin)
      manager.install('test-plugin')

      manager.unregister('test-plugin')

      expect(manager.isInstalled('test-plugin')).toBe(false)
    })
  })

  describe('Listing Plugins', () => {
    beforeEach(() => {
      manager.register({
        ...samplePlugin,
        id: 'beginner1',
        category: 'beginner',
      })
      manager.register({
        ...samplePlugin,
        id: 'intermediate1',
        category: 'intermediate',
      })
      manager.register({
        ...samplePlugin,
        id: 'advanced1',
        category: 'advanced',
      })
    })

    it('should list all plugins', () => {
      const plugins = manager.listPlugins()

      expect(plugins).toHaveLength(3)
    })

    it('should filter plugins by category', () => {
      const beginnerPlugins = manager.listPlugins('beginner')

      expect(beginnerPlugins).toHaveLength(1)
      expect(beginnerPlugins[0].id).toBe('beginner1')
    })

    it('should filter intermediate plugins', () => {
      const intermediatePlugins = manager.listPlugins('intermediate')

      expect(intermediatePlugins).toHaveLength(1)
      expect(intermediatePlugins[0].id).toBe('intermediate1')
    })

    it('should filter advanced plugins', () => {
      const advancedPlugins = manager.listPlugins('advanced')

      expect(advancedPlugins).toHaveLength(1)
      expect(advancedPlugins[0].id).toBe('advanced1')
    })
  })

  describe('Searching', () => {
    beforeEach(() => {
      manager.register({
        ...samplePlugin,
        id: 'plugin1',
        tags: ['cli', 'development'],
        features: ['hot-reload', 'debugging'],
      })
      manager.register({
        ...samplePlugin,
        id: 'plugin2',
        tags: ['cli', 'performance'],
        features: ['profiling', 'benchmarking'],
      })
    })

    it('should search by tag', () => {
      const cliPlugins = manager.searchByTag('cli')

      expect(cliPlugins).toHaveLength(2)
    })

    it('should search by specific tag', () => {
      const perfPlugins = manager.searchByTag('performance')

      expect(perfPlugins).toHaveLength(1)
      expect(perfPlugins[0].id).toBe('plugin2')
    })

    it('should search by feature', () => {
      const debuggingPlugins = manager.searchByFeature('debugging')

      expect(debuggingPlugins).toHaveLength(1)
      expect(debuggingPlugins[0].id).toBe('plugin1')
    })

    it('should return empty array for non-matching tag', () => {
      const plugins = manager.searchByTag('non-existent')

      expect(plugins).toHaveLength(0)
    })

    it('should return empty array for non-matching feature', () => {
      const plugins = manager.searchByFeature('non-existent')

      expect(plugins).toHaveLength(0)
    })
  })

  describe('Installation', () => {
    beforeEach(() => {
      manager.register(samplePlugin)
    })

    it('should install a plugin', async () => {
      const result = await manager.install('test-plugin')

      expect(result).toMatchObject({
        pluginId: 'test-plugin',
        success: true,
        installPath: '/plugins/test-plugin',
      })
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should emit install-started event', async () => {
      const listener = vi.fn()
      manager.on('install-started', listener)

      await manager.install('test-plugin')

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
      })
    })

    it('should emit install-completed event', async () => {
      const listener = vi.fn()
      manager.on('install-completed', listener)

      await manager.install('test-plugin')

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test-plugin',
          success: true,
        })
      )
    })

    it('should mark plugin as installed', async () => {
      await manager.install('test-plugin')

      expect(manager.isInstalled('test-plugin')).toBe(true)
    })

    it('should return cached result for already installed plugin', async () => {
      await manager.install('test-plugin')

      const result = await manager.install('test-plugin')

      expect(result.success).toBe(true)
      expect(result.duration).toBe(0) // Instant for cached
    })

    it('should fail for non-existent plugin', async () => {
      const result = await manager.install('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('Uninstallation', () => {
    beforeEach(async () => {
      manager.register(samplePlugin)
      await manager.install('test-plugin')
    })

    it('should uninstall a plugin', async () => {
      const success = await manager.uninstall('test-plugin')

      expect(success).toBe(true)
      expect(manager.isInstalled('test-plugin')).toBe(false)
    })

    it('should emit uninstall-started event', async () => {
      const listener = vi.fn()
      manager.on('uninstall-started', listener)

      await manager.uninstall('test-plugin')

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
      })
    })

    it('should emit uninstall-completed event', async () => {
      const listener = vi.fn()
      manager.on('uninstall-completed', listener)

      await manager.uninstall('test-plugin')

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
      })
    })

    it('should return false for non-installed plugin', async () => {
      await manager.uninstall('test-plugin')

      const success = await manager.uninstall('test-plugin')

      expect(success).toBe(false)
    })
  })

  describe('Installed Plugins', () => {
    beforeEach(async () => {
      manager.register({
        ...samplePlugin,
        id: 'plugin1',
      })
      manager.register({
        ...samplePlugin,
        id: 'plugin2',
      })
      await manager.install('plugin1')
    })

    it('should get installed plugins', () => {
      const installed = manager.getInstalledPlugins()

      expect(installed).toHaveLength(1)
      expect(installed[0].id).toBe('plugin1')
    })

    it('should check if plugin is installed', () => {
      expect(manager.isInstalled('plugin1')).toBe(true)
      expect(manager.isInstalled('plugin2')).toBe(false)
    })
  })

  describe('Statistics', () => {
    beforeEach(async () => {
      manager.register({
        ...samplePlugin,
        id: 'plugin1',
        category: 'beginner',
        tags: ['cli', 'development'],
      })
      manager.register({
        ...samplePlugin,
        id: 'plugin2',
        category: 'beginner',
        tags: ['cli', 'performance'],
      })
      manager.register({
        ...samplePlugin,
        id: 'plugin3',
        category: 'advanced',
        tags: ['performance', 'profiling'],
      })

      await manager.install('plugin1')
    })

    it('should get statistics', () => {
      const stats = manager.getStatistics()

      expect(stats).toMatchObject({
        totalPlugins: 3,
        installedPlugins: 1,
      })
    })

    it('should count by category', () => {
      const stats = manager.getStatistics()

      expect(stats.byCategory['beginner']).toBe(2)
      expect(stats.byCategory['advanced']).toBe(1)
    })

    it('should identify popular tags', () => {
      const stats = manager.getStatistics()

      // Should have tags, sorted by popularity
      expect(stats.popularTags.length).toBeGreaterThanOrEqual(3)
      expect(stats.popularTags[0].tag).toBe('cli') // Most common
      expect(stats.popularTags[0].count).toBe(2)
    })
  })

  describe('Clear', () => {
    beforeEach(async () => {
      manager.register(samplePlugin)
      await manager.install('test-plugin')
    })

    it('should clear all plugins', () => {
      manager.clear()

      expect(manager.listPlugins()).toHaveLength(0)
      expect(manager.isInstalled('test-plugin')).toBe(false)
    })

    it('should emit plugins-cleared event', () => {
      const listener = vi.fn()
      manager.on('plugins-cleared', listener)

      manager.clear()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Built-In Examples', () => {
    beforeEach(() => {
      registerBuiltInExamples(manager)
    })

    it('should register built-in examples', () => {
      const plugins = manager.listPlugins()

      expect(plugins.length).toBeGreaterThan(0)
    })

    it('should include hello-world example', () => {
      const helloWorld = manager.getPlugin('hello-world')

      expect(helloWorld).toBeDefined()
      expect(helloWorld?.category).toBe('beginner')
    })

    it('should include hot-reload-demo', () => {
      const hotReload = manager.getPlugin('hot-reload-demo')

      expect(hotReload).toBeDefined()
      expect(hotReload?.category).toBe('intermediate')
    })

    it('should include profiler-demo', () => {
      const profiler = manager.getPlugin('profiler-demo')

      expect(profiler).toBeDefined()
      expect(profiler?.category).toBe('advanced')
    })

    it('should categorize plugins correctly', () => {
      const beginner = manager.listPlugins('beginner')
      const intermediate = manager.listPlugins('intermediate')
      const advanced = manager.listPlugins('advanced')

      expect(beginner.length).toBeGreaterThan(0)
      expect(intermediate.length).toBeGreaterThan(0)
      expect(advanced.length).toBeGreaterThan(0)
    })
  })

  describe('Global Manager', () => {
    beforeEach(() => {
      resetGlobalManager()
    })

    it('should get global manager', () => {
      const global = getGlobalManager()

      expect(global).toBeInstanceOf(ExamplePluginManager)
    })

    it('should return same instance', () => {
      const manager1 = getGlobalManager()
      const manager2 = getGlobalManager()

      expect(manager1).toBe(manager2)
    })

    it('should reset global manager', () => {
      const manager1 = getGlobalManager()

      resetGlobalManager()

      const manager2 = getGlobalManager()

      expect(manager2).not.toBe(manager1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle getting non-existent plugin', () => {
      const plugin = manager.getPlugin('non-existent')

      expect(plugin).toBeUndefined()
    })

    it('should handle empty list', () => {
      const plugins = manager.listPlugins()

      expect(plugins).toHaveLength(0)
    })

    it('should handle empty search results', () => {
      const byTag = manager.searchByTag('nonexistent')
      const byFeature = manager.searchByFeature('nonexistent')

      expect(byTag).toHaveLength(0)
      expect(byFeature).toHaveLength(0)
    })
  })
})
