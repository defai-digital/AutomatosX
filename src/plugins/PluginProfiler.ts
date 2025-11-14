/**
 * Plugin Profiler
 * Sprint 5 Day 49: Per-plugin profiling and metrics
 */

import { EventEmitter } from 'events'

/**
 * Plugin metrics
 */
export interface PluginMetrics {
  pluginId: string
  totalCalls: number
  totalDuration: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  memoryUsed: number
  peakMemory: number
  cpuTime: number
  errors: number
  lastError?: string
  lastCallTime: number
}

/**
 * Plugin call record
 */
export interface PluginCallRecord {
  pluginId: string
  method: string
  startTime: number
  endTime: number
  duration: number
  memoryBefore: number
  memoryAfter: number
  success: boolean
  error?: string
}

/**
 * Plugin profiler
 */
export class PluginProfiler extends EventEmitter {
  private metrics = new Map<string, PluginMetrics>()
  private calls: PluginCallRecord[] = []
  private activeProfiles = new Map<string, { startTime: number; memoryBefore: number }>()
  private enabled: boolean = true

  /**
   * Start profiling a plugin call
   */
  startProfile(pluginId: string, method: string): string {
    if (!this.enabled) return ''

    const profileId = `${pluginId}:${method}:${Date.now()}`

    this.activeProfiles.set(profileId, {
      startTime: Date.now(),
      memoryBefore: this.getMemoryUsage(),
    })

    return profileId
  }

  /**
   * End profiling a plugin call
   */
  endProfile(profileId: string, error?: Error): PluginCallRecord | null {
    if (!this.enabled) return null

    const profile = this.activeProfiles.get(profileId)
    if (!profile) return null

    const [pluginId, method] = profileId.split(':')
    const endTime = Date.now()
    const duration = endTime - profile.startTime
    const memoryAfter = this.getMemoryUsage()

    const record: PluginCallRecord = {
      pluginId,
      method,
      startTime: profile.startTime,
      endTime,
      duration,
      memoryBefore: profile.memoryBefore,
      memoryAfter,
      success: !error,
      error: error?.message,
    }

    this.calls.push(record)
    this.activeProfiles.delete(profileId)

    // Update metrics
    this.updateMetrics(record)

    this.emit('profile-completed', record)

    return record
  }

  /**
   * Update plugin metrics
   */
  private updateMetrics(record: PluginCallRecord): void {
    let metrics = this.metrics.get(record.pluginId)

    if (!metrics) {
      metrics = {
        pluginId: record.pluginId,
        totalCalls: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        memoryUsed: 0,
        peakMemory: 0,
        cpuTime: 0,
        errors: 0,
        lastCallTime: 0,
      }
      this.metrics.set(record.pluginId, metrics)
    }

    metrics.totalCalls++
    metrics.totalDuration += record.duration
    metrics.averageDuration = metrics.totalDuration / metrics.totalCalls
    metrics.minDuration = Math.min(metrics.minDuration, record.duration)
    metrics.maxDuration = Math.max(metrics.maxDuration, record.duration)

    const memoryDelta = record.memoryAfter - record.memoryBefore
    metrics.memoryUsed += memoryDelta
    metrics.peakMemory = Math.max(metrics.peakMemory, record.memoryAfter)

    if (!record.success) {
      metrics.errors++
      metrics.lastError = record.error
    }

    metrics.lastCallTime = record.endTime

    this.emit('metrics-updated', { pluginId: record.pluginId, metrics })
  }

  /**
   * Get metrics for a plugin
   */
  getMetrics(pluginId: string): PluginMetrics | undefined {
    return this.metrics.get(pluginId)
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PluginMetrics[] {
    return Array.from(this.metrics.values())
  }

  /**
   * Get call history for a plugin
   */
  getCallHistory(pluginId: string, limit?: number): PluginCallRecord[] {
    const history = this.calls.filter((c) => c.pluginId === pluginId)

    if (limit) {
      return history.slice(-limit)
    }

    return history
  }

  /**
   * Get all call history
   */
  getAllCallHistory(limit?: number): PluginCallRecord[] {
    if (limit) {
      return this.calls.slice(-limit)
    }

    return [...this.calls]
  }

  /**
   * Get top plugins by calls
   */
  getTopPluginsByCalls(limit: number = 10): PluginMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, limit)
  }

  /**
   * Get top plugins by duration
   */
  getTopPluginsByDuration(limit: number = 10): PluginMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit)
  }

  /**
   * Get top plugins by memory
   */
  getTopPluginsByMemory(limit: number = 10): PluginMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.peakMemory - a.peakMemory)
      .slice(0, limit)
  }

  /**
   * Get plugins with errors
   */
  getPluginsWithErrors(): PluginMetrics[] {
    return Array.from(this.metrics.values())
      .filter((m) => m.errors > 0)
      .sort((a, b) => b.errors - a.errors)
  }

  /**
   * Clear metrics for a plugin
   */
  clearMetrics(pluginId: string): void {
    this.metrics.delete(pluginId)
    this.calls = this.calls.filter((c) => c.pluginId !== pluginId)
    this.emit('metrics-cleared', { pluginId })
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear()
    this.calls = []
    this.emit('all-metrics-cleared')
  }

  /**
   * Enable profiling
   */
  enable(): void {
    this.enabled = true
    this.emit('enabled')
  }

  /**
   * Disable profiling
   */
  disable(): void {
    this.enabled = false
    this.emit('disabled')
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    return process.memoryUsage().heapUsed
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalPlugins: number
    totalCalls: number
    totalDuration: number
    totalMemory: number
    totalErrors: number
    averageCallsPerPlugin: number
    averageDurationPerCall: number
  } {
    const metricsArray = Array.from(this.metrics.values())

    const totalCalls = metricsArray.reduce((sum, m) => sum + m.totalCalls, 0)
    const totalDuration = metricsArray.reduce((sum, m) => sum + m.totalDuration, 0)
    const totalMemory = metricsArray.reduce((sum, m) => sum + m.peakMemory, 0)
    const totalErrors = metricsArray.reduce((sum, m) => sum + m.errors, 0)

    return {
      totalPlugins: metricsArray.length,
      totalCalls,
      totalDuration,
      totalMemory,
      totalErrors,
      averageCallsPerPlugin: metricsArray.length > 0 ? totalCalls / metricsArray.length : 0,
      averageDurationPerCall: totalCalls > 0 ? totalDuration / totalCalls : 0,
    }
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: Array.from(this.metrics.values()),
      calls: this.calls,
      statistics: this.getStatistics(),
    }, null, 2)
  }

  /**
   * Format metrics for display
   */
  static formatMetrics(metrics: PluginMetrics): string {
    return `Plugin: ${metrics.pluginId}
  Total Calls: ${metrics.totalCalls}
  Average Duration: ${metrics.averageDuration.toFixed(2)}ms
  Min/Max Duration: ${metrics.minDuration.toFixed(2)}ms / ${metrics.maxDuration.toFixed(2)}ms
  Peak Memory: ${(metrics.peakMemory / 1024 / 1024).toFixed(2)}MB
  Errors: ${metrics.errors}${metrics.lastError ? `\n  Last Error: ${metrics.lastError}` : ''}`
  }
}

/**
 * Create plugin profiler
 */
export function createPluginProfiler(): PluginProfiler {
  return new PluginProfiler()
}

/**
 * Global profiler instance
 */
let globalProfiler: PluginProfiler | null = null

/**
 * Get global profiler
 */
export function getGlobalPluginProfiler(): PluginProfiler {
  if (!globalProfiler) {
    globalProfiler = createPluginProfiler()
  }
  return globalProfiler
}

/**
 * Reset global profiler
 */
export function resetGlobalPluginProfiler(): void {
  globalProfiler = null
}
