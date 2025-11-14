/**
 * CLI Profiler Tests
 * Sprint 5 Day 41: CLI profiling tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CLIProfiler, getProfiler } from '../../performance/CLIProfiler.js'

describe('CLIProfiler', () => {
  let profiler: CLIProfiler

  beforeEach(() => {
    profiler = getProfiler()
    profiler.disable() // Start disabled
  })

  afterEach(() => {
    profiler.disable()
  })

  describe('Enable/Disable', () => {
    it('should start disabled by default', () => {
      expect(profiler.isEnabled()).toBe(false)
    })

    it('should enable profiling', () => {
      profiler.enable()

      expect(profiler.isEnabled()).toBe(true)
    })

    it('should disable profiling', () => {
      profiler.enable()
      profiler.disable()

      expect(profiler.isEnabled()).toBe(false)
    })

    it('should be singleton', () => {
      const profiler1 = getProfiler()
      const profiler2 = getProfiler()

      expect(profiler1).toBe(profiler2)
    })
  })

  describe('Command Profiling', () => {
    it('should profile command execution', () => {
      profiler.enable()
      profiler.startCommand('test-command')

      // Simulate work
      const start = Date.now()
      while (Date.now() - start < 10) {
        // Busy wait
      }

      const result = profiler.endCommand()

      expect(result).not.toBeNull()
      expect(result!.command).toBe('test-command')
      expect(result!.totalDuration).toBeGreaterThan(0)
    })

    it('should return null when disabled', () => {
      profiler.startCommand('test')
      const result = profiler.endCommand()

      expect(result).toBeNull()
    })

    it('should include metadata in results', () => {
      profiler.enable()
      profiler.startCommand('test', { version: '1.0.0' })

      const result = profiler.endCommand()

      expect(result).not.toBeNull()
      expect(result!.metadata.version).toBe('1.0.0')
    })

    it('should track peak memory usage', () => {
      profiler.enable()
      profiler.startCommand('memory-test')

      // Allocate some memory
      const arr = new Array(1000).fill({})

      const result = profiler.endCommand()

      expect(result).not.toBeNull()
      expect(result!.peakMemory).toBeGreaterThan(0)
    })

    it('should reset state after endCommand', () => {
      profiler.enable()
      profiler.startCommand('test-1')
      profiler.endCommand()

      profiler.startCommand('test-2')
      const result = profiler.endCommand()

      expect(result!.command).toBe('test-2')
    })
  })

  describe('Phase Profiling', () => {
    it('should track individual phases', () => {
      profiler.enable()
      profiler.startCommand('test')

      profiler.startPhase('phase-1')
      profiler.endPhase('phase-1')

      const result = profiler.endCommand()

      expect(result).not.toBeNull()
      expect(result!.phases).toHaveLength(1)
      expect(result!.phases[0].name).toBe('phase-1')
      expect(result!.phases[0].duration).toBeDefined()
    })

    it('should track multiple phases', () => {
      profiler.enable()
      profiler.startCommand('test')

      profiler.startPhase('init')
      profiler.endPhase('init')

      profiler.startPhase('execution')
      profiler.endPhase('execution')

      profiler.startPhase('cleanup')
      profiler.endPhase('cleanup')

      const result = profiler.endCommand()

      expect(result!.phases).toHaveLength(3)
      expect(result!.phases[0].name).toBe('init')
      expect(result!.phases[1].name).toBe('execution')
      expect(result!.phases[2].name).toBe('cleanup')
    })

    it('should measure phase duration accurately', async () => {
      profiler.enable()
      profiler.startCommand('test')

      profiler.startPhase('delay')
      await new Promise((resolve) => setTimeout(resolve, 50))
      profiler.endPhase('delay')

      const result = profiler.endCommand()

      const phase = result!.phases.find((p) => p.name === 'delay')
      expect(phase).toBeDefined()
      expect(phase!.duration).toBeGreaterThan(45)
      expect(phase!.duration).toBeLessThan(100)
    })

    it('should include phase metadata', () => {
      profiler.enable()
      profiler.startCommand('test')

      profiler.startPhase('phase-1', { step: 1 })
      profiler.endPhase('phase-1')

      const result = profiler.endCommand()

      expect(result!.phases[0].metadata).toEqual({ step: 1 })
    })

    it('should warn on ending unknown phase', () => {
      profiler.enable()
      profiler.startCommand('test')

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      profiler.endPhase('unknown-phase')

      expect(consoleSpy).toHaveBeenCalledWith('Phase unknown-phase not found')

      consoleSpy.mockRestore()
    })
  })

  describe('Metadata', () => {
    it('should add custom metadata', () => {
      profiler.enable()
      profiler.startCommand('test')

      profiler.addMetadata('key1', 'value1')
      profiler.addMetadata('key2', 123)

      const result = profiler.endCommand()

      expect(result!.metadata.key1).toBe('value1')
      expect(result!.metadata.key2).toBe(123)
    })

    it('should not add metadata when disabled', () => {
      profiler.startCommand('test')
      profiler.addMetadata('key', 'value')

      const result = profiler.endCommand()

      expect(result).toBeNull()
    })
  })

  describe('Formatting', () => {
    it('should format result as text', () => {
      profiler.enable()
      profiler.startCommand('format-test')

      profiler.startPhase('phase-1')
      profiler.endPhase('phase-1')

      const result = profiler.endCommand()

      const formatted = CLIProfiler.formatResult(result!)

      expect(formatted).toContain('Command: format-test')
      expect(formatted).toContain('Total Duration:')
      expect(formatted).toContain('Peak Memory:')
      expect(formatted).toContain('Phases:')
      expect(formatted).toContain('phase-1')
    })

    it('should export as JSON', () => {
      profiler.enable()
      profiler.startCommand('json-test')

      const result = profiler.endCommand()

      const json = CLIProfiler.exportJSON(result!)
      const parsed = JSON.parse(json)

      expect(parsed.command).toBe('json-test')
      expect(parsed.totalDuration).toBeDefined()
    })

    it('should sort phases by duration in formatted output', () => {
      profiler.enable()
      profiler.startCommand('test')

      profiler.startPhase('slow')
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100)
      profiler.endPhase('slow')

      profiler.startPhase('fast')
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)
      profiler.endPhase('fast')

      const result = profiler.endCommand()
      const formatted = CLIProfiler.formatResult(result!)

      // "slow" should appear before "fast" in output (sorted by duration desc)
      const slowIndex = formatted.indexOf('slow')
      const fastIndex = formatted.indexOf('fast')

      expect(slowIndex).toBeLessThan(fastIndex)
    })
  })

  describe('Startup Analysis', () => {
    it('should detect optimal performance', () => {
      const result = {
        command: 'test',
        startTime: 0,
        endTime: 150,
        totalDuration: 150, // <200ms - optimal
        phases: [],
        peakMemory: 30 * 1024 * 1024, // 30MB - optimal
        metadata: {},
      }

      const analysis = CLIProfiler.analyzeStartup(result)

      expect(analysis.isOptimal).toBe(true)
      expect(analysis.issues).toHaveLength(0)
      expect(analysis.recommendations).toHaveLength(0)
    })

    it('should detect slow startup', () => {
      const result = {
        command: 'test',
        startTime: 0,
        endTime: 250,
        totalDuration: 250, // >200ms
        phases: [],
        peakMemory: 30 * 1024 * 1024,
        metadata: {},
      }

      const analysis = CLIProfiler.analyzeStartup(result)

      expect(analysis.isOptimal).toBe(false)
      expect(analysis.issues.length).toBeGreaterThan(0)
      expect(analysis.issues[0]).toContain('250.00ms')
    })

    it('should detect high memory usage', () => {
      const result = {
        command: 'test',
        startTime: 0,
        endTime: 150,
        totalDuration: 150,
        phases: [],
        peakMemory: 60 * 1024 * 1024, // 60MB - high
        metadata: {},
      }

      const analysis = CLIProfiler.analyzeStartup(result)

      expect(analysis.isOptimal).toBe(false)
      expect(analysis.issues.some((issue) => issue.includes('memory'))).toBe(true)
    })

    it('should detect slow phases', () => {
      const result = {
        command: 'test',
        startTime: 0,
        endTime: 150,
        totalDuration: 150,
        phases: [
          {
            name: 'slow-phase',
            startTime: 0,
            endTime: 80,
            duration: 80, // >50ms - slow
          },
        ],
        peakMemory: 30 * 1024 * 1024,
        metadata: {},
      }

      const analysis = CLIProfiler.analyzeStartup(result)

      expect(analysis.isOptimal).toBe(false)
      expect(analysis.issues.some((issue) => issue.includes('slow-phase'))).toBe(
        true
      )
    })

    it('should provide recommendations for issues', () => {
      const result = {
        command: 'test',
        startTime: 0,
        endTime: 250,
        totalDuration: 250,
        phases: [],
        peakMemory: 60 * 1024 * 1024,
        metadata: {},
      }

      const analysis = CLIProfiler.analyzeStartup(result)

      expect(analysis.recommendations.length).toBeGreaterThan(0)
      expect(analysis.recommendations.some((r) => r.includes('lazy loading'))).toBe(
        true
      )
    })
  })
})
