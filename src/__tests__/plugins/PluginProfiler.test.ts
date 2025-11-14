/**
 * Plugin Profiler Tests
 * Sprint 5 Day 49: Per-plugin profiling tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PluginProfiler,
  createPluginProfiler,
  getGlobalPluginProfiler,
  resetGlobalPluginProfiler,
} from '../../plugins/PluginProfiler.js'

describe('PluginProfiler', () => {
  let profiler: PluginProfiler

  beforeEach(() => {
    profiler = createPluginProfiler()
  })

  describe('Profile Management', () => {
    it('should start a profile', () => {
      const profileId = profiler.startProfile('test-plugin', 'testMethod')

      expect(profileId).toBeTruthy()
      expect(profileId).toContain('test-plugin')
      expect(profileId).toContain('testMethod')
    })

    it('should return empty string when disabled', () => {
      profiler.disable()

      const profileId = profiler.startProfile('test-plugin', 'testMethod')

      expect(profileId).toBe('')
    })

    it('should end a profile', () => {
      const profileId = profiler.startProfile('test-plugin', 'testMethod')

      const record = profiler.endProfile(profileId)

      expect(record).toBeDefined()
      expect(record?.pluginId).toBe('test-plugin')
      expect(record?.method).toBe('testMethod')
      expect(record?.success).toBe(true)
    })

    it('should record error in profile', () => {
      const profileId = profiler.startProfile('test-plugin', 'testMethod')

      const error = new Error('Test error')
      const record = profiler.endProfile(profileId, error)

      expect(record?.success).toBe(false)
      expect(record?.error).toBe('Test error')
    })

    it('should emit profile-completed event', () => {
      const listener = vi.fn()
      profiler.on('profile-completed', listener)

      const profileId = profiler.startProfile('test-plugin', 'testMethod')
      profiler.endProfile(profileId)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test-plugin',
          method: 'testMethod',
        })
      )
    })

    it('should return null for non-existent profile', () => {
      const record = profiler.endProfile('non-existent')

      expect(record).toBeNull()
    })

    it('should return null when disabled', () => {
      profiler.disable()

      const profileId = profiler.startProfile('test-plugin', 'testMethod')
      const record = profiler.endProfile(profileId)

      expect(record).toBeNull()
    })
  })

  describe('Metrics', () => {
    beforeEach(() => {
      const profileId1 = profiler.startProfile('plugin1', 'method1')
      profiler.endProfile(profileId1)

      const profileId2 = profiler.startProfile('plugin1', 'method2')
      profiler.endProfile(profileId2)

      const profileId3 = profiler.startProfile('plugin2', 'method1')
      const error = new Error('Test error')
      profiler.endProfile(profileId3, error)
    })

    it('should get metrics for a plugin', () => {
      const metrics = profiler.getMetrics('plugin1')

      expect(metrics).toBeDefined()
      expect(metrics?.pluginId).toBe('plugin1')
      expect(metrics?.totalCalls).toBe(2)
      expect(metrics?.errors).toBe(0)
    })

    it('should calculate average duration', () => {
      const metrics = profiler.getMetrics('plugin1')

      expect(metrics?.averageDuration).toBeGreaterThanOrEqual(0)
      expect(metrics?.totalDuration).toBe(metrics!.averageDuration * metrics!.totalCalls)
    })

    it('should track min/max duration', () => {
      const metrics = profiler.getMetrics('plugin1')

      expect(metrics?.minDuration).toBeLessThanOrEqual(metrics!.maxDuration)
    })

    it('should track errors', () => {
      const metrics = profiler.getMetrics('plugin2')

      expect(metrics?.errors).toBe(1)
      expect(metrics?.lastError).toBe('Test error')
    })

    it('should emit metrics-updated event', () => {
      const listener = vi.fn()
      profiler.on('metrics-updated', listener)

      const profileId = profiler.startProfile('plugin3', 'method1')
      profiler.endProfile(profileId)

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'plugin3',
        metrics: expect.objectContaining({
          pluginId: 'plugin3',
        }),
      })
    })

    it('should get all metrics', () => {
      const allMetrics = profiler.getAllMetrics()

      expect(allMetrics).toHaveLength(2)
      expect(allMetrics.map((m) => m.pluginId)).toContain('plugin1')
      expect(allMetrics.map((m) => m.pluginId)).toContain('plugin2')
    })

    it('should return undefined for non-existent plugin', () => {
      const metrics = profiler.getMetrics('non-existent')

      expect(metrics).toBeUndefined()
    })
  })

  describe('Call History', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        const profileId = profiler.startProfile('plugin1', `method${i}`)
        profiler.endProfile(profileId)
      }

      for (let i = 0; i < 3; i++) {
        const profileId = profiler.startProfile('plugin2', `method${i}`)
        profiler.endProfile(profileId)
      }
    })

    it('should get call history for a plugin', () => {
      const history = profiler.getCallHistory('plugin1')

      expect(history).toHaveLength(5)
      expect(history.every((c) => c.pluginId === 'plugin1')).toBe(true)
    })

    it('should limit call history', () => {
      const history = profiler.getCallHistory('plugin1', 3)

      expect(history).toHaveLength(3)
    })

    it('should get all call history', () => {
      const history = profiler.getAllCallHistory()

      expect(history).toHaveLength(8) // 5 + 3
    })

    it('should limit all call history', () => {
      const history = profiler.getAllCallHistory(5)

      expect(history).toHaveLength(5)
    })
  })

  describe('Top Plugins', () => {
    beforeEach(() => {
      // Plugin1: 5 calls
      for (let i = 0; i < 5; i++) {
        const profileId = profiler.startProfile('plugin1', 'method')
        profiler.endProfile(profileId)
      }

      // Plugin2: 3 calls
      for (let i = 0; i < 3; i++) {
        const profileId = profiler.startProfile('plugin2', 'method')
        profiler.endProfile(profileId)
      }

      // Plugin3: 1 call
      const profileId = profiler.startProfile('plugin3', 'method')
      profiler.endProfile(profileId)
    })

    it('should get top plugins by calls', () => {
      const top = profiler.getTopPluginsByCalls(2)

      expect(top).toHaveLength(2)
      expect(top[0].pluginId).toBe('plugin1')
      expect(top[0].totalCalls).toBe(5)
      expect(top[1].pluginId).toBe('plugin2')
      expect(top[1].totalCalls).toBe(3)
    })

    it('should get top plugins by duration', () => {
      const top = profiler.getTopPluginsByDuration(3)

      expect(top).toHaveLength(3)
      expect(top[0].totalDuration).toBeGreaterThanOrEqual(top[1].totalDuration)
    })

    it('should get top plugins by memory', () => {
      const top = profiler.getTopPluginsByMemory(3)

      expect(top).toHaveLength(3)
      expect(top[0].peakMemory).toBeGreaterThanOrEqual(top[1].peakMemory)
    })

    it('should limit top plugins', () => {
      const top = profiler.getTopPluginsByCalls(1)

      expect(top).toHaveLength(1)
      expect(top[0].pluginId).toBe('plugin1')
    })
  })

  describe('Plugins with Errors', () => {
    beforeEach(() => {
      const profileId1 = profiler.startProfile('plugin1', 'method')
      profiler.endProfile(profileId1, new Error('Error 1'))

      const profileId2 = profiler.startProfile('plugin1', 'method')
      profiler.endProfile(profileId2, new Error('Error 2'))

      const profileId3 = profiler.startProfile('plugin2', 'method')
      profiler.endProfile(profileId3, new Error('Error 3'))

      const profileId4 = profiler.startProfile('plugin3', 'method')
      profiler.endProfile(profileId4) // No error
    })

    it('should get plugins with errors', () => {
      const withErrors = profiler.getPluginsWithErrors()

      expect(withErrors).toHaveLength(2)
      expect(withErrors.map((p) => p.pluginId)).toContain('plugin1')
      expect(withErrors.map((p) => p.pluginId)).toContain('plugin2')
    })

    it('should sort by error count', () => {
      const withErrors = profiler.getPluginsWithErrors()

      expect(withErrors[0].pluginId).toBe('plugin1')
      expect(withErrors[0].errors).toBe(2)
      expect(withErrors[1].pluginId).toBe('plugin2')
      expect(withErrors[1].errors).toBe(1)
    })
  })

  describe('Clear Metrics', () => {
    beforeEach(() => {
      const profileId1 = profiler.startProfile('plugin1', 'method')
      profiler.endProfile(profileId1)

      const profileId2 = profiler.startProfile('plugin2', 'method')
      profiler.endProfile(profileId2)
    })

    it('should clear metrics for a plugin', () => {
      profiler.clearMetrics('plugin1')

      expect(profiler.getMetrics('plugin1')).toBeUndefined()
      expect(profiler.getMetrics('plugin2')).toBeDefined()
    })

    it('should emit metrics-cleared event', () => {
      const listener = vi.fn()
      profiler.on('metrics-cleared', listener)

      profiler.clearMetrics('plugin1')

      expect(listener).toHaveBeenCalledWith({ pluginId: 'plugin1' })
    })

    it('should clear all metrics', () => {
      profiler.clearAllMetrics()

      expect(profiler.getAllMetrics()).toHaveLength(0)
      expect(profiler.getAllCallHistory()).toHaveLength(0)
    })

    it('should emit all-metrics-cleared event', () => {
      const listener = vi.fn()
      profiler.on('all-metrics-cleared', listener)

      profiler.clearAllMetrics()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Enable/Disable', () => {
    it('should start enabled', () => {
      expect(profiler.isEnabled()).toBe(true)
    })

    it('should disable profiling', () => {
      profiler.disable()

      expect(profiler.isEnabled()).toBe(false)
    })

    it('should emit disabled event', () => {
      const listener = vi.fn()
      profiler.on('disabled', listener)

      profiler.disable()

      expect(listener).toHaveBeenCalled()
    })

    it('should enable profiling', () => {
      profiler.disable()
      profiler.enable()

      expect(profiler.isEnabled()).toBe(true)
    })

    it('should emit enabled event', () => {
      const listener = vi.fn()
      profiler.on('enabled', listener)

      profiler.disable()
      profiler.enable()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i++) {
        const profileId = profiler.startProfile('plugin1', 'method')
        profiler.endProfile(profileId)
      }

      for (let i = 0; i < 2; i++) {
        const profileId = profiler.startProfile('plugin2', 'method')
        if (i === 1) {
          profiler.endProfile(profileId, new Error('Test error'))
        } else {
          profiler.endProfile(profileId)
        }
      }
    })

    it('should get statistics', () => {
      const stats = profiler.getStatistics()

      expect(stats).toMatchObject({
        totalPlugins: 2,
        totalCalls: 5,
        totalErrors: 1,
      })
      expect(stats.totalDuration).toBeGreaterThanOrEqual(0)
      expect(stats.averageCallsPerPlugin).toBe(2.5)
    })

    it('should calculate averages', () => {
      const stats = profiler.getStatistics()

      expect(stats.averageDurationPerCall).toBeGreaterThanOrEqual(0)
      expect(stats.averageDurationPerCall).toBe(stats.totalDuration / stats.totalCalls)
    })
  })

  describe('Export', () => {
    beforeEach(() => {
      const profileId = profiler.startProfile('plugin1', 'method')
      profiler.endProfile(profileId)
    })

    it('should export metrics as JSON', () => {
      const json = profiler.exportMetrics()

      expect(() => JSON.parse(json)).not.toThrow()

      const data = JSON.parse(json)
      expect(data.metrics).toBeDefined()
      expect(data.calls).toBeDefined()
      expect(data.statistics).toBeDefined()
    })

    it('should include all data in export', () => {
      const json = profiler.exportMetrics()
      const data = JSON.parse(json)

      expect(data.metrics).toHaveLength(1)
      expect(data.calls).toHaveLength(1)
      expect(data.statistics.totalPlugins).toBe(1)
    })
  })

  describe('Format Metrics', () => {
    it('should format metrics for display', () => {
      const profileId = profiler.startProfile('plugin1', 'method')
      profiler.endProfile(profileId)

      const metrics = profiler.getMetrics('plugin1')!
      const formatted = PluginProfiler.formatMetrics(metrics)

      expect(formatted).toContain('Plugin: plugin1')
      expect(formatted).toContain('Total Calls: 1')
      expect(formatted).toContain('Average Duration:')
      expect(formatted).toContain('Peak Memory:')
    })

    it('should include error information', () => {
      const profileId = profiler.startProfile('plugin1', 'method')
      profiler.endProfile(profileId, new Error('Test error'))

      const metrics = profiler.getMetrics('plugin1')!
      const formatted = PluginProfiler.formatMetrics(metrics)

      expect(formatted).toContain('Errors: 1')
      expect(formatted).toContain('Last Error: Test error')
    })
  })

  describe('Global Profiler', () => {
    beforeEach(() => {
      resetGlobalPluginProfiler()
    })

    it('should get global profiler', () => {
      const global = getGlobalPluginProfiler()

      expect(global).toBeInstanceOf(PluginProfiler)
    })

    it('should return same instance', () => {
      const profiler1 = getGlobalPluginProfiler()
      const profiler2 = getGlobalPluginProfiler()

      expect(profiler1).toBe(profiler2)
    })

    it('should reset global profiler', () => {
      const profiler1 = getGlobalPluginProfiler()

      resetGlobalPluginProfiler()

      const profiler2 = getGlobalPluginProfiler()

      expect(profiler2).not.toBe(profiler1)
    })
  })
})
