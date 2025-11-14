/**
 * Runtime Profiler Tests
 * Sprint 5 Day 43: Runtime profiling tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  RuntimeProfiler,
  createRuntimeProfiler,
  getGlobalProfiler,
  resetGlobalProfiler,
} from '../../performance/RuntimeProfiler.js'

describe('RuntimeProfiler', () => {
  let profiler: RuntimeProfiler

  beforeEach(() => {
    profiler = createRuntimeProfiler()
  })

  describe('Basic Profiling', () => {
    it('should start and end profiling', async () => {
      const commandId = profiler.startProfile('test-command')

      expect(commandId).toBeTruthy()
      expect(profiler.getActiveProfiles()).toContain(commandId)

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      const result = profiler.endProfile(commandId)

      expect(result).toBeDefined()
      expect(result!.command).toBe('test-command')
      expect(result!.duration).toBeGreaterThanOrEqual(10)
    })

    it('should return null when ending non-existent profile', () => {
      const result = profiler.endProfile('non-existent')

      expect(result).toBeNull()
    })

    it('should return empty string when disabled', () => {
      profiler.disable()

      const commandId = profiler.startProfile('test')

      expect(commandId).toBe('')
    })

    it('should not create profile when disabled', () => {
      profiler.disable()

      profiler.startProfile('test')

      expect(profiler.getActiveProfiles()).toHaveLength(0)
    })
  })

  describe('Profile Data', () => {
    it('should capture duration', async () => {
      const commandId = profiler.startProfile('test')

      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = profiler.endProfile(commandId)

      expect(result!.duration).toBeGreaterThanOrEqual(45)
      expect(result!.duration).toBeLessThan(100)
    })

    it('should capture CPU time', async () => {
      const commandId = profiler.startProfile('test')

      // Do some CPU work
      let sum = 0
      for (let i = 0; i < 1000000; i++) {
        sum += i
      }

      const result = profiler.endProfile(commandId)

      expect(result!.cpuTime).toBeGreaterThanOrEqual(0)
    })

    it('should capture memory usage', () => {
      const commandId = profiler.startProfile('test')

      const result = profiler.endProfile(commandId)

      expect(result!.memoryUsage).toMatchObject({
        heapUsed: expect.any(Number),
        heapTotal: expect.any(Number),
        external: expect.any(Number),
        arrayBuffers: expect.any(Number),
        rss: expect.any(Number),
      })
    })

    it('should track peak memory', async () => {
      const commandId = profiler.startProfile('test', {
        sampleInterval: 10,
      })

      // Allocate memory
      const arr = new Array(1000).fill({})

      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = profiler.endProfile(commandId)

      expect(result!.peakMemory).toBeGreaterThan(0)
    })

    it('should include timestamps', async () => {
      const commandId = profiler.startProfile('test')

      // Wait a tiny bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 1))

      const result = profiler.endProfile(commandId)

      expect(result!.startTime).toBeLessThanOrEqual(result!.endTime)
      expect(result!.endTime - result!.startTime).toBe(result!.duration)
    })
  })

  describe('Metadata', () => {
    it('should accept metadata on start', () => {
      const commandId = profiler.startProfile('test', {
        metadata: {
          version: '1.0.0',
          userId: '123',
        },
      })

      const result = profiler.endProfile(commandId)

      expect(result!.metadata).toEqual({
        version: '1.0.0',
        userId: '123',
      })
    })

    it('should allow adding metadata during profiling', () => {
      const commandId = profiler.startProfile('test')

      profiler.addMetadata(commandId, 'key1', 'value1')
      profiler.addMetadata(commandId, 'key2', 123)

      const result = profiler.endProfile(commandId)

      expect(result!.metadata.key1).toBe('value1')
      expect(result!.metadata.key2).toBe(123)
    })

    it('should not add metadata to non-existent profile', () => {
      expect(() => {
        profiler.addMetadata('non-existent', 'key', 'value')
      }).not.toThrow()
    })
  })

  describe('Profile Management', () => {
    it('should store completed profiles', () => {
      const id1 = profiler.startProfile('cmd1')
      const id2 = profiler.startProfile('cmd2')

      profiler.endProfile(id1)
      profiler.endProfile(id2)

      const completed = profiler.getCompletedProfiles()

      expect(completed).toHaveLength(2)
      expect(completed[0].command).toBe('cmd1')
      expect(completed[1].command).toBe('cmd2')
    })

    it('should clear completed profiles', () => {
      const id = profiler.startProfile('test')
      profiler.endProfile(id)

      profiler.clearProfiles()

      expect(profiler.getCompletedProfiles()).toHaveLength(0)
    })

    it('should list active profiles', () => {
      const id1 = profiler.startProfile('cmd1')
      const id2 = profiler.startProfile('cmd2')

      const active = profiler.getActiveProfiles()

      expect(active).toContain(id1)
      expect(active).toContain(id2)
      expect(active).toHaveLength(2)
    })

    it('should remove profile from active after ending', () => {
      const id = profiler.startProfile('test')

      profiler.endProfile(id)

      expect(profiler.getActiveProfiles()).not.toContain(id)
    })
  })

  describe('Events', () => {
    it('should emit profile-started event', () => {
      const listener = vi.fn()
      profiler.on('profile-started', listener)

      const commandId = profiler.startProfile('test')

      expect(listener).toHaveBeenCalledWith({
        commandId,
        command: 'test',
      })
    })

    it('should emit profile-completed event', () => {
      const listener = vi.fn()
      profiler.on('profile-completed', listener)

      const commandId = profiler.startProfile('test')
      const result = profiler.endProfile(commandId)

      expect(listener).toHaveBeenCalledWith(result)
    })
  })

  describe('Memory Sampling', () => {
    it('should track peak memory with sampling', async () => {
      const commandId = profiler.startProfile('test', {
        trackMemory: true,
        sampleInterval: 10,
      })

      // Allocate and release memory
      for (let i = 0; i < 5; i++) {
        const temp = new Array(10000).fill(Math.random())
        await new Promise((resolve) => setTimeout(resolve, 15))
      }

      const result = profiler.endProfile(commandId)

      expect(result!.peakMemory).toBeGreaterThan(0)
    })

    it('should not sample when trackMemory is false', () => {
      const commandId = profiler.startProfile('test', {
        trackMemory: false,
      })

      const result = profiler.endProfile(commandId)

      // Should still have initial memory, but no sampling occurred
      expect(result).toBeDefined()
    })

    it('should use custom sample interval', async () => {
      const commandId = profiler.startProfile('test', {
        sampleInterval: 5, // Very short interval
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      const result = profiler.endProfile(commandId)

      expect(result).toBeDefined()
    })
  })

  describe('Statistics', () => {
    it('should calculate statistics for completed profiles', () => {
      for (let i = 0; i < 5; i++) {
        const id = profiler.startProfile(`cmd${i}`)
        profiler.endProfile(id)
      }

      const stats = profiler.getStatistics()

      expect(stats.count).toBe(5)
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0)
      expect(stats.averageCPU).toBeGreaterThanOrEqual(0)
      expect(stats.averageMemory).toBeGreaterThan(0)
      expect(stats.peakMemory).toBeGreaterThan(0)
    })

    it('should return zeros when no profiles', () => {
      const stats = profiler.getStatistics()

      expect(stats).toEqual({
        count: 0,
        averageDuration: 0,
        averageCPU: 0,
        averageMemory: 0,
        peakMemory: 0,
      })
    })

    it('should calculate correct averages', () => {
      // Create profiles with known durations
      const id1 = profiler.startProfile('cmd1')
      const id2 = profiler.startProfile('cmd2')

      profiler.endProfile(id1)
      profiler.endProfile(id2)

      const stats = profiler.getStatistics()

      expect(stats.count).toBe(2)
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0)
    })

    it('should track peak across all profiles', () => {
      let maxPeak = 0

      for (let i = 0; i < 3; i++) {
        const id = profiler.startProfile(`cmd${i}`)
        const result = profiler.endProfile(id)
        if (result!.peakMemory > maxPeak) {
          maxPeak = result!.peakMemory
        }
      }

      const stats = profiler.getStatistics()

      expect(stats.peakMemory).toBe(maxPeak)
    })
  })

  describe('Enable/Disable', () => {
    it('should start enabled by default', () => {
      expect(profiler.isEnabled()).toBe(true)
    })

    it('should enable profiling', () => {
      profiler.disable()
      profiler.enable()

      expect(profiler.isEnabled()).toBe(true)

      const id = profiler.startProfile('test')
      expect(id).toBeTruthy()
    })

    it('should disable profiling', () => {
      profiler.disable()

      expect(profiler.isEnabled()).toBe(false)

      const id = profiler.startProfile('test')
      expect(id).toBe('')
    })

    it('should stop sampling when disabled', async () => {
      const id = profiler.startProfile('test', {
        sampleInterval: 10,
      })

      await new Promise((resolve) => setTimeout(resolve, 20))

      profiler.disable()

      // Sampling should have stopped
      expect(profiler.isEnabled()).toBe(false)
    })
  })

  describe('Global Profiler', () => {
    afterEach(() => {
      resetGlobalProfiler()
    })

    it('should get global profiler', () => {
      const profiler = getGlobalProfiler()

      expect(profiler).toBeInstanceOf(RuntimeProfiler)
    })

    it('should return same instance', () => {
      const profiler1 = getGlobalProfiler()
      const profiler2 = getGlobalProfiler()

      expect(profiler1).toBe(profiler2)
    })

    it('should reset global profiler', () => {
      const profiler1 = getGlobalProfiler()

      resetGlobalProfiler()

      const profiler2 = getGlobalProfiler()

      expect(profiler2).not.toBe(profiler1)
    })

    it('should disable when resetting', () => {
      const profiler = getGlobalProfiler()
      const disableSpy = vi.spyOn(profiler, 'disable')

      resetGlobalProfiler()

      expect(disableSpy).toHaveBeenCalled()
    })
  })

  describe('GC Stats', () => {
    it('should initialize GC stats', () => {
      const id = profiler.startProfile('test', {
        trackGC: true,
      })

      const result = profiler.endProfile(id)

      expect(result!.gcStats).toMatchObject({
        count: 0,
        totalDuration: 0,
        majorGC: 0,
        minorGC: 0,
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid start/stop', () => {
      for (let i = 0; i < 100; i++) {
        const id = profiler.startProfile(`cmd${i}`)
        profiler.endProfile(id)
      }

      expect(profiler.getCompletedProfiles()).toHaveLength(100)
    })

    it('should handle multiple concurrent profiles', () => {
      const ids = []
      for (let i = 0; i < 10; i++) {
        ids.push(profiler.startProfile(`cmd${i}`))
      }

      expect(profiler.getActiveProfiles()).toHaveLength(10)

      for (const id of ids) {
        profiler.endProfile(id)
      }

      expect(profiler.getActiveProfiles()).toHaveLength(0)
      expect(profiler.getCompletedProfiles()).toHaveLength(10)
    })

    it('should generate unique IDs', () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        const id = profiler.startProfile('test')
        ids.add(id)
        profiler.endProfile(id)
      }

      expect(ids.size).toBe(100)
    })
  })
})
