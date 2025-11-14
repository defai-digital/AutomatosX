// Sprint 2 Day 15: Performance Profiler
// Measures CLI bridge overhead and execution metrics

import { EventEmitter } from 'events'

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  name: string
  duration: number
  startTime: number
  endTime: number
  metadata?: Record<string, unknown>
}

/**
 * Performance profile summary
 */
export interface PerformanceProfile {
  totalDuration: number
  measurements: PerformanceMeasurement[]
  overhead: number
  targetOverhead: number
  passes: boolean
}

/**
 * Performance profiler options
 */
export interface ProfilerOptions {
  targetOverhead?: number // Maximum allowed overhead in ms
  enableLogging?: boolean
  sampleSize?: number
}

/**
 * Performance Profiler
 *
 * Tracks execution time of CLI bridge operations
 *
 * @example
 * ```typescript
 * const profiler = new PerformanceProfiler({ targetOverhead: 10 })
 *
 * profiler.start('validation')
 * // ... validation code
 * profiler.end('validation')
 *
 * profiler.start('execution')
 * // ... execution code
 * profiler.end('execution')
 *
 * const profile = profiler.getProfile()
 * console.log(`Total overhead: ${profile.overhead}ms`)
 * console.log(`Passes: ${profile.passes}`)
 * ```
 */
export class PerformanceProfiler extends EventEmitter {
  private measurements: Map<string, PerformanceMeasurement>
  private activeTimers: Map<string, number>
  private targetOverhead: number
  private enableLogging: boolean
  private sampleSize: number
  private samples: number[]

  constructor(options: ProfilerOptions = {}) {
    super()
    this.measurements = new Map()
    this.activeTimers = new Map()
    this.targetOverhead = options.targetOverhead || 10 // Default 10ms
    this.enableLogging = options.enableLogging ?? false
    this.sampleSize = options.sampleSize || 100
    this.samples = []
  }

  /**
   * Start timing a measurement
   */
  start(name: string, metadata?: Record<string, unknown>): void {
    const startTime = this.getHighResolutionTime()
    this.activeTimers.set(name, startTime)

    if (this.enableLogging) {
      this.log(`⏱️  Started: ${name}`)
    }

    this.emit('measurement-start', { name, startTime, metadata })
  }

  /**
   * End timing a measurement
   */
  end(name: string, metadata?: Record<string, unknown>): PerformanceMeasurement | undefined {
    const endTime = this.getHighResolutionTime()
    const startTime = this.activeTimers.get(name)

    if (!startTime) {
      if (this.enableLogging) {
        this.log(`⚠️  Warning: No start time for "${name}"`)
      }
      return undefined
    }

    const duration = endTime - startTime
    const measurement: PerformanceMeasurement = {
      name,
      duration,
      startTime,
      endTime,
      metadata,
    }

    this.measurements.set(name, measurement)
    this.activeTimers.delete(name)
    this.samples.push(duration)

    // Keep only recent samples
    if (this.samples.length > this.sampleSize) {
      this.samples.shift()
    }

    if (this.enableLogging) {
      this.log(`✅ Completed: ${name} (${duration.toFixed(2)}ms)`)
    }

    this.emit('measurement-end', measurement)
    return measurement
  }

  /**
   * Measure a synchronous function
   */
  measure<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    this.start(name, metadata)
    try {
      const result = fn()
      this.end(name, metadata)
      return result
    } catch (error) {
      this.end(name, { ...metadata, error: true })
      throw error
    }
  }

  /**
   * Measure an async function
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(name, metadata)
    try {
      const result = await fn()
      this.end(name, metadata)
      return result
    } catch (error) {
      this.end(name, { ...metadata, error: true })
      throw error
    }
  }

  /**
   * Get performance profile
   */
  getProfile(): PerformanceProfile {
    const measurements = Array.from(this.measurements.values())
    const totalDuration = measurements.reduce((sum, m) => sum + m.duration, 0)
    const overhead = totalDuration

    return {
      totalDuration,
      measurements,
      overhead,
      targetOverhead: this.targetOverhead,
      passes: overhead <= this.targetOverhead,
    }
  }

  /**
   * Get measurement by name
   */
  getMeasurement(name: string): PerformanceMeasurement | undefined {
    return this.measurements.get(name)
  }

  /**
   * Get all measurements
   */
  getAllMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.measurements.values())
  }

  /**
   * Get statistics for a measurement
   */
  getStatistics(): PerformanceStatistics {
    const durations = Array.from(this.measurements.values()).map(m => m.duration)

    if (durations.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
      }
    }

    const sorted = [...durations].sort((a, b) => a - b)
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length
    const stdDev = Math.sqrt(variance)

    return {
      count: durations.length,
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev,
    }
  }

  /**
   * Check if overhead target is met
   */
  meetsTarget(): boolean {
    const profile = this.getProfile()
    return profile.passes
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.measurements.clear()
    this.activeTimers.clear()
    this.samples = []

    if (this.enableLogging) {
      this.log('🔄 Profiler reset')
    }

    this.emit('reset')
  }

  /**
   * Export measurements as JSON
   */
  export(): string {
    const profile = this.getProfile()
    const stats = this.getStatistics()

    return JSON.stringify(
      {
        profile,
        statistics: stats,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  }

  /**
   * Get high-resolution time in milliseconds
   */
  private getHighResolutionTime(): number {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now()
    }
    return Date.now()
  }

  /**
   * Log message
   */
  private log(message: string): void {
    console.log(`[Profiler] ${message}`)
  }
}

/**
 * Performance statistics
 */
export interface PerformanceStatistics {
  count: number
  mean: number
  median: number
  min: number
  max: number
  p95: number
  p99: number
  stdDev: number
}

/**
 * Global profiler instance
 */
let globalProfiler: PerformanceProfiler | null = null

/**
 * Get or create global profiler
 */
export function getGlobalProfiler(options?: ProfilerOptions): PerformanceProfiler {
  if (!globalProfiler) {
    globalProfiler = new PerformanceProfiler(options)
  }
  return globalProfiler
}

/**
 * Reset global profiler
 */
export function resetGlobalProfiler(): void {
  globalProfiler = null
}
