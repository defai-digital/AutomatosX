/**
 * Lazy Loader Tests
 * Sprint 5 Day 44: Lazy loading tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  LazyLoader,
  createLazyLoader,
  getGlobalLoader,
  resetGlobalLoader,
} from '../../cli/LazyLoader.js'
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('LazyLoader', () => {
  let loader: LazyLoader
  let testDir: string

  beforeEach(() => {
    loader = createLazyLoader()
    testDir = join(tmpdir(), `lazy-loader-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Registration', () => {
    it('should register a module', () => {
      loader.register('test-module', {
        path: './test.js',
      })

      expect(loader.getRegisteredModules()).toContain('test-module')
    })

    it('should register multiple modules', () => {
      loader.register('module1', { path: './mod1.js' })
      loader.register('module2', { path: './mod2.js' })
      loader.register('module3', { path: './mod3.js' })

      expect(loader.getRegisteredModules()).toHaveLength(3)
    })

    it('should not auto-preload by default', () => {
      loader.register('test', { path: './test.js' })

      expect(loader.isLoaded('test')).toBe(false)
    })
  })

  describe('Loading', () => {
    it('should throw when loading unregistered module', async () => {
      await expect(loader.load('unregistered')).rejects.toThrow(
        'Module "unregistered" not registered'
      )
    })

    it('should return cached module on second load', async () => {
      // Create a test module
      const testModule = join(testDir, 'test.mjs')
      writeFileSync(testModule, 'export const value = 42;')

      loader.register('test', { path: testModule })

      const result1 = await loader.load('test')
      const result2 = await loader.load('test')

      expect(result1.cached).toBe(false)
      expect(result2.cached).toBe(true)
      expect(result2.duration).toBe(0)
    })

    it('should track load time', async () => {
      const testModule = join(testDir, 'test.mjs')
      writeFileSync(testModule, 'export const value = 123;')

      loader.register('test', { path: testModule })

      const result = await loader.load('test')

      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(loader.getLoadTime('test')).toBe(result.duration)
    })

    it('should emit module-loaded event', async () => {
      const testModule = join(testDir, 'test.mjs')
      writeFileSync(testModule, 'export const data = "test";')

      const listener = vi.fn()
      loader.on('module-loaded', listener)

      loader.register('test', { path: testModule })
      await loader.load('test')

      expect(listener).toHaveBeenCalledWith({
        name: 'test',
        duration: expect.any(Number),
      })
    })

    it('should emit load-error on failure', async () => {
      const listener = vi.fn()
      loader.on('load-error', listener)

      loader.register('bad', { path: './non-existent.js' })

      await expect(loader.load('bad')).rejects.toThrow()

      expect(listener).toHaveBeenCalled()
    })

    it('should handle concurrent loads', async () => {
      const testModule = join(testDir, 'concurrent.mjs')
      writeFileSync(testModule, 'export const value = 999;')

      loader.register('concurrent', { path: testModule })

      const [result1, result2, result3] = await Promise.all([
        loader.load('concurrent'),
        loader.load('concurrent'),
        loader.load('concurrent'),
      ])

      expect(result1.module.value).toBe(999)
      expect(result2.module.value).toBe(999)
      expect(result3.module.value).toBe(999)
    })

    it.skip('should timeout on slow loads', async () => {
      loader.register('slow', {
        path: './slow-module.js',
        timeout: 10, // Very short timeout
      })

      await expect(loader.load('slow')).rejects.toThrow('timeout')
    }, 1000)
  })

  describe('Module Access', () => {
    it('should get loaded module', async () => {
      const testModule = join(testDir, 'get-test.mjs')
      writeFileSync(testModule, 'export const name = "TestModule";')

      loader.register('test', { path: testModule })
      await loader.load('test')

      const module = loader.get('test')

      expect(module.name).toBe('TestModule')
    })

    it('should throw when getting unloaded module', () => {
      loader.register('test', { path: './test.js' })

      expect(() => loader.get('test')).toThrow(
        'Module "test" not loaded. Call load() first.'
      )
    })

    it('should check if loaded', async () => {
      const testModule = join(testDir, 'check.mjs')
      writeFileSync(testModule, 'export const x = 1;')

      loader.register('test', { path: testModule })

      expect(loader.isLoaded('test')).toBe(false)

      await loader.load('test')

      expect(loader.isLoaded('test')).toBe(true)
    })

    it('should check if loading', async () => {
      const testModule = join(testDir, 'loading.mjs')
      writeFileSync(testModule, 'export const y = 2;')

      loader.register('test', { path: testModule })

      const loadPromise = loader.load('test')

      expect(loader.isLoading('test')).toBe(true)

      await loadPromise

      expect(loader.isLoading('test')).toBe(false)
    })
  })

  describe('Preloading', () => {
    it('should preload multiple modules', async () => {
      const mod1 = join(testDir, 'mod1.mjs')
      const mod2 = join(testDir, 'mod2.mjs')

      writeFileSync(mod1, 'export const a = 1;')
      writeFileSync(mod2, 'export const b = 2;')

      loader.register('mod1', { path: mod1 })
      loader.register('mod2', { path: mod2 })

      await loader.preload(['mod1', 'mod2'])

      expect(loader.isLoaded('mod1')).toBe(true)
      expect(loader.isLoaded('mod2')).toBe(true)
    })

    it('should emit preload-error on failure', async () => {
      const listener = vi.fn()
      loader.on('preload-error', listener)

      loader.register('bad', { path: './missing.js' })

      await loader.preload(['bad'])

      expect(listener).toHaveBeenCalled()
    })

    it('should continue preloading on individual failures', async () => {
      const good = join(testDir, 'good.mjs')
      writeFileSync(good, 'export const ok = true;')

      loader.register('bad', { path: './missing.js' })
      loader.register('good', { path: good })

      await loader.preload(['bad', 'good'])

      expect(loader.isLoaded('good')).toBe(true)
    })
  })

  describe('Cache Management', () => {
    it('should clear cached module', async () => {
      const testModule = join(testDir, 'clear.mjs')
      writeFileSync(testModule, 'export const val = 100;')

      loader.register('test', { path: testModule })
      await loader.load('test')

      expect(loader.isLoaded('test')).toBe(true)

      loader.clear('test')

      expect(loader.isLoaded('test')).toBe(false)
      expect(loader.getLoadTime('test')).toBeUndefined()
    })

    it('should clear all cached modules', async () => {
      const mod1 = join(testDir, 'clear1.mjs')
      const mod2 = join(testDir, 'clear2.mjs')

      writeFileSync(mod1, 'export const x = 1;')
      writeFileSync(mod2, 'export const y = 2;')

      loader.register('mod1', { path: mod1 })
      loader.register('mod2', { path: mod2 })

      await loader.preload(['mod1', 'mod2'])

      expect(loader.getLoadedModules()).toHaveLength(2)

      loader.clearAll()

      expect(loader.getLoadedModules()).toHaveLength(0)
    })

    it.skip('should reload after clear', async () => {
      const testModule = join(testDir, 'reload.mjs')
      writeFileSync(testModule, 'export const version = 1;')

      loader.register('test', { path: testModule })

      await loader.load('test')
      loader.clear('test')

      // Modify module
      writeFileSync(testModule, 'export const version = 2;')

      const result = await loader.load('test')

      expect(result.module.version).toBe(2)
    })
  })

  describe('Statistics', () => {
    it('should calculate statistics', async () => {
      const mod1 = join(testDir, 'stat1.mjs')
      const mod2 = join(testDir, 'stat2.mjs')

      writeFileSync(mod1, 'export const a = 1;')
      writeFileSync(mod2, 'export const b = 2;')

      loader.register('mod1', { path: mod1 })
      loader.register('mod2', { path: mod2 })
      loader.register('mod3', { path: './unloaded.js' })

      await loader.preload(['mod1', 'mod2'])

      const stats = loader.getStatistics()

      expect(stats).toMatchObject({
        registered: 3,
        loaded: 2,
        loading: 0,
        totalLoadTime: expect.any(Number),
        averageLoadTime: expect.any(Number),
      })
    })

    it('should track slowest module', async () => {
      const fast = join(testDir, 'fast.mjs')
      const slow = join(testDir, 'slow.mjs')

      writeFileSync(fast, 'export const f = 1;')
      writeFileSync(
        slow,
        'export const s = 1; await new Promise(r => setTimeout(r, 50));'
      )

      loader.register('fast', { path: fast })
      loader.register('slow', { path: slow })

      await loader.load('fast')
      await loader.load('slow')

      const stats = loader.getStatistics()

      expect(stats.slowestModule?.name).toBe('slow')
    })

    it('should return null slowest when no modules loaded', () => {
      const stats = loader.getStatistics()

      expect(stats.slowestModule).toBeNull()
    })
  })

  describe('Lazy Getter', () => {
    it('should create lazy getter function', async () => {
      const testModule = join(testDir, 'getter.mjs')
      writeFileSync(testModule, 'export const greeting = "hello";')

      loader.register('test', { path: testModule })

      const getter = loader.createGetter('test')

      const module = await getter()

      expect(module.greeting).toBe('hello')
    })

    it('should cache result on subsequent calls', async () => {
      const testModule = join(testDir, 'cache-getter.mjs')
      writeFileSync(testModule, 'export const num = 456;')

      loader.register('test', { path: testModule })

      const getter = loader.createGetter('test')

      await getter()
      const result2 = await loader.load('test')

      expect(result2.cached).toBe(true)
    })
  })

  describe('Unregister', () => {
    it('should unregister module', () => {
      loader.register('test', { path: './test.js' })

      expect(loader.getRegisteredModules()).toContain('test')

      loader.unregister('test')

      expect(loader.getRegisteredModules()).not.toContain('test')
    })

    it('should clear module on unregister', async () => {
      const testModule = join(testDir, 'unreg.mjs')
      writeFileSync(testModule, 'export const z = 3;')

      loader.register('test', { path: testModule })
      await loader.load('test')

      loader.unregister('test')

      expect(loader.isLoaded('test')).toBe(false)
    })
  })

  describe('Global Loader', () => {
    afterEach(() => {
      resetGlobalLoader()
    })

    it('should get global loader', () => {
      const loader = getGlobalLoader()

      expect(loader).toBeInstanceOf(LazyLoader)
    })

    it('should return same instance', () => {
      const loader1 = getGlobalLoader()
      const loader2 = getGlobalLoader()

      expect(loader1).toBe(loader2)
    })

    it('should reset global loader', () => {
      const loader1 = getGlobalLoader()

      resetGlobalLoader()

      const loader2 = getGlobalLoader()

      expect(loader2).not.toBe(loader1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty preload', async () => {
      await expect(loader.preload([])).resolves.not.toThrow()
    })

    it('should handle clearing non-existent module', () => {
      expect(() => loader.clear('non-existent')).not.toThrow()
    })

    it('should handle unregistering non-existent module', () => {
      expect(() => loader.unregister('non-existent')).not.toThrow()
    })

    it('should handle getting load time for unloaded module', () => {
      expect(loader.getLoadTime('unloaded')).toBeUndefined()
    })
  })
})
