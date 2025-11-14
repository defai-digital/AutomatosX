/**
 * Runtime Profiler
 * Sprint 5 Day 43: Runtime performance profiling with resource tracking
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'

/**
 * Runtime profile result
 */
export interface RuntimeProfile {
  commandId: string
  command: string
  startTime: number
  endTime: number
  duration: number
  cpuTime: number
  memoryUsage: MemoryUsageSnapshot
  peakMemory: number
  gcStats: GCStats
  metadata: Record<string, any>
}

/**
 * Memory usage snapshot
 */
export interface MemoryUsageSnapshot {
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
  rss: number
}

/**
 * GC statistics
 */
export interface GCStats {
  count: number
  totalDuration: number
  majorGC: number
  minorGC: number
}

/**
 * Profile options
 */
export interface ProfileOptions {
  trackMemory?: boolean
  trackGC?: boolean
  sampleInterval?: number
  metadata?: Record<string, any>
}

/**
 * Runtime profiler for performance tracking
 */
export class RuntimeProfiler extends EventEmitter {
  private activeProfiles = new Map<string, ActiveProfile>()
  private completedProfiles: RuntimeProfile[] = []
  private enabled: boolean = true
  private sampleInterval: number = 100 // ms

  /**
   * Start profiling a command
   */
  startProfile(
    command: string,
    options: ProfileOptions = {}
  ): string {
    if (!this.enabled) {
      return ''
    }

    const commandId = this.generateId()
    const startTime = Date.now()
    const cpuStart = process.cpuUsage()
    const memoryStart = this.captureMemory()

    const profile: ActiveProfile = {
      commandId,
      command,
      startTime,
      cpuStart,
      memoryStart,
      peakMemory: memoryStart.heapUsed,
      gcCount: 0,
      gcDuration: 0,
      majorGC: 0,
      minorGC: 0,
      metadata: options.metadata || {},
      trackMemory: options.trackMemory ?? true,
      trackGC: options.trackGC ?? false,
    }

    this.activeProfiles.set(commandId, profile)

    // Start memory sampling if enabled
    if (profile.trackMemory) {
      this.startMemorySampling(commandId, options.sampleInterval || this.sampleInterval)
    }

    this.emit('profile-started', { commandId, command })

    return commandId
  }

  /**
   * End profiling
   */
  endProfile(commandId: string): RuntimeProfile | null {
    if (!this.enabled || !commandId) {
      return null
    }

    const active = this.activeProfiles.get(commandId)
    if (!active) {
      return null
    }

    const endTime = Date.now()
    const cpuEnd = process.cpuUsage(active.cpuStart)
    const memoryEnd = this.captureMemory()

    // Stop sampling
    this.stopMemorySampling(commandId)

    const profile: RuntimeProfile = {
      commandId: active.commandId,
      command: active.command,
      startTime: active.startTime,
      endTime,
      duration: endTime - active.startTime,
      cpuTime: (cpuEnd.user + cpuEnd.system) / 1000, // Convert to ms
      memoryUsage: memoryEnd,
      peakMemory: active.peakMemory,
      gcStats: {
        count: active.gcCount,
        totalDuration: active.gcDuration,
        majorGC: active.majorGC,
        minorGC: active.minorGC,
      },
      metadata: active.metadata,
    }

    this.activeProfiles.delete(commandId)
    this.completedProfiles.push(profile)

    this.emit('profile-completed', profile)

    return profile
  }

  /**
   * Capture memory snapshot
   */
  private captureMemory(): MemoryUsageSnapshot {
    const mem = process.memoryUsage()
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      rss: mem.rss,
    }
  }

  /**
   * Start memory sampling
   */
  private startMemorySampling(commandId: string, interval: number): void {
    const timer = setInterval(() => {
      const active = this.activeProfiles.get(commandId)
      if (!active) {
        clearInterval(timer)
        return
      }

      const memory = this.captureMemory()
      if (memory.heapUsed > active.peakMemory) {
        active.peakMemory = memory.heapUsed
      }
    }, interval)

    const active = this.activeProfiles.get(commandId)
    if (active) {
      active.samplingTimer = timer
    }
  }

  /**
   * Stop memory sampling
   */
  private stopMemorySampling(commandId: string): void {
    const active = this.activeProfiles.get(commandId)
    if (active?.samplingTimer) {
      clearInterval(active.samplingTimer)
      active.samplingTimer = undefined
    }
  }

  /**
   * Add metadata to active profile
   */
  addMetadata(commandId: string, key: string, value: any): void {
    const active = this.activeProfiles.get(commandId)
    if (active) {
      active.metadata[key] = value
    }
  }

  /**
   * Get completed profiles
   */
  getCompletedProfiles(): RuntimeProfile[] {
    return [...this.completedProfiles]
  }

  /**
   * Get active profiles
   */
  getActiveProfiles(): string[] {
    return Array.from(this.activeProfiles.keys())
  }

  /**
   * Clear completed profiles
   */
  clearProfiles(): void {
    this.completedProfiles = []
  }

  /**
   * Enable profiling
   */
  enable(): void {
    this.enabled = true
  }

  /**
   * Disable profiling
   */
  disable(): void {
    this.enabled = false

    // Stop all active sampling
    for (const commandId of this.activeProfiles.keys()) {
      this.stopMemorySampling(commandId)
    }
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get profile statistics
   */
  getStatistics(): ProfileStatistics {
    if (this.completedProfiles.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        averageCPU: 0,
        averageMemory: 0,
        peakMemory: 0,
      }
    }

    const durations = this.completedProfiles.map((p) => p.duration)
    const cpuTimes = this.completedProfiles.map((p) => p.cpuTime)
    const memories = this.completedProfiles.map((p) => p.memoryUsage.heapUsed)
    const peaks = this.completedProfiles.map((p) => p.peakMemory)

    return {
      count: this.completedProfiles.length,
      averageDuration: this.average(durations),
      averageCPU: this.average(cpuTimes),
      averageMemory: this.average(memories),
      peakMemory: Math.max(...peaks),
    }
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }
}

/**
 * Active profile (internal)
 */
interface ActiveProfile {
  commandId: string
  command: string
  startTime: number
  cpuStart: NodeJS.CpuUsage
  memoryStart: MemoryUsageSnapshot
  peakMemory: number
  gcCount: number
  gcDuration: number
  majorGC: number
  minorGC: number
  metadata: Record<string, any>
  trackMemory: boolean
  trackGC: boolean
  samplingTimer?: NodeJS.Timeout
}

/**
 * Profile statistics
 */
export interface ProfileStatistics {
  count: number
  averageDuration: number
  averageCPU: number
  averageMemory: number
  peakMemory: number
}

/**
 * Create runtime profiler
 */
export function createRuntimeProfiler(): RuntimeProfiler {
  return new RuntimeProfiler()
}

/**
 * Global profiler instance
 */
let globalProfiler: RuntimeProfiler | null = null

/**
 * Get global profiler
 */
export function getGlobalProfiler(): RuntimeProfiler {
  if (!globalProfiler) {
    globalProfiler = createRuntimeProfiler()
  }
  return globalProfiler
}

/**
 * Reset global profiler
 */
export function resetGlobalProfiler(): void {
  if (globalProfiler) {
    globalProfiler.disable()
  }
  globalProfiler = null
}
