/**
 * CLI Profiler
 * Sprint 5 Day 41: CLI startup and command profiling
 */

import { performance, PerformanceObserver } from 'perf_hooks'

/**
 * Profiling phase
 */
export interface ProfilingPhase {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

/**
 * Profiling result
 */
export interface ProfilingResult {
  command: string
  startTime: number
  endTime: number
  totalDuration: number
  phases: ProfilingPhase[]
  peakMemory: number
  metadata: Record<string, any>
}

/**
 * CLI Profiler
 */
export class CLIProfiler {
  private static instance: CLIProfiler | null = null
  private enabled = false
  private command: string = ''
  private startTime: number = 0
  private phases: Map<string, ProfilingPhase> = new Map()
  private peakMemory: number = 0
  private observer: PerformanceObserver | null = null
  private metadata: Record<string, any> = {}

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): CLIProfiler {
    if (!CLIProfiler.instance) {
      CLIProfiler.instance = new CLIProfiler()
    }
    return CLIProfiler.instance
  }

  /**
   * Enable profiling
   */
  enable(): void {
    this.enabled = true
    this.setupObserver()
  }

  /**
   * Disable profiling
   */
  disable(): void {
    this.enabled = false
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  }

  /**
   * Check if profiling is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Start profiling a command
   */
  startCommand(command: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return

    this.command = command
    this.startTime = performance.now()
    this.phases.clear()
    this.peakMemory = 0
    this.metadata = metadata || {}

    this.trackMemory()
  }

  /**
   * Start a phase
   */
  startPhase(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return

    const phase: ProfilingPhase = {
      name,
      startTime: performance.now(),
      metadata,
    }

    this.phases.set(name, phase)
    this.trackMemory()
  }

  /**
   * End a phase
   */
  endPhase(name: string): void {
    if (!this.enabled) return

    const phase = this.phases.get(name)
    if (!phase) {
      console.warn(`Phase ${name} not found`)
      return
    }

    phase.endTime = performance.now()
    phase.duration = phase.endTime - phase.startTime

    this.trackMemory()
  }

  /**
   * End command profiling
   */
  endCommand(): ProfilingResult | null {
    if (!this.enabled) return null

    const endTime = performance.now()
    const totalDuration = endTime - this.startTime

    const phases = Array.from(this.phases.values())

    const result: ProfilingResult = {
      command: this.command,
      startTime: this.startTime,
      endTime,
      totalDuration,
      phases,
      peakMemory: this.peakMemory,
      metadata: this.metadata,
    }

    // Reset state
    this.command = ''
    this.startTime = 0
    this.phases.clear()
    this.peakMemory = 0
    this.metadata = {}

    return result
  }

  /**
   * Track memory usage
   */
  private trackMemory(): void {
    const memUsage = process.memoryUsage()
    const heapUsed = memUsage.heapUsed
    if (heapUsed > this.peakMemory) {
      this.peakMemory = heapUsed
    }
  }

  /**
   * Setup performance observer
   */
  private setupObserver(): void {
    if (this.observer) {
      this.observer.disconnect()
    }

    this.observer = new PerformanceObserver((items) => {
      const entries = items.getEntries()
      for (const entry of entries) {
        if (entry.entryType === 'measure') {
          this.metadata[entry.name] = entry.duration
        }
      }
    })

    this.observer.observe({ entryTypes: ['measure'] })
  }

  /**
   * Add metadata
   */
  addMetadata(key: string, value: any): void {
    if (!this.enabled) return
    this.metadata[key] = value
  }

  /**
   * Format profiling result
   */
  static formatResult(result: ProfilingResult): string {
    const header = `
Command: ${result.command}
Total Duration: ${result.totalDuration.toFixed(2)}ms
Peak Memory: ${(result.peakMemory / 1024 / 1024).toFixed(2)}MB
`.trim()

    const phases = result.phases
      .filter((p) => p.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .map((p) => `  ${p.name}: ${p.duration!.toFixed(2)}ms`)
      .join('\n')

    const metadata = Object.entries(result.metadata)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n')

    return `${header}\n\nPhases:\n${phases}\n\nMetadata:\n${metadata}`
  }

  /**
   * Export as JSON
   */
  static exportJSON(result: ProfilingResult): string {
    return JSON.stringify(result, null, 2)
  }

  /**
   * Analyze startup performance
   */
  static analyzeStartup(result: ProfilingResult): {
    isOptimal: boolean
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check total duration (target: <200ms)
    if (result.totalDuration > 200) {
      issues.push(`Startup took ${result.totalDuration.toFixed(2)}ms (target: <200ms)`)
      recommendations.push('Consider lazy loading modules or caching CLI state')
    }

    // Check memory usage (target: <50MB)
    const memoryMB = result.peakMemory / 1024 / 1024
    if (memoryMB > 50) {
      issues.push(`Peak memory ${memoryMB.toFixed(2)}MB (target: <50MB)`)
      recommendations.push('Review module dependencies and remove unused imports')
    }

    // Check for slow phases (>50ms)
    const slowPhases = result.phases.filter((p) => (p.duration || 0) > 50)
    if (slowPhases.length > 0) {
      slowPhases.forEach((p) => {
        issues.push(`Phase "${p.name}" took ${p.duration!.toFixed(2)}ms`)
      })
      recommendations.push('Optimize slow phases with lazy loading or caching')
    }

    const isOptimal = issues.length === 0

    return { isOptimal, issues, recommendations }
  }
}

/**
 * Get CLI profiler instance
 */
export function getProfiler(): CLIProfiler {
  return CLIProfiler.getInstance()
}

/**
 * Profiling decorator for async functions
 */
export function profile(phaseName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const profiler = getProfiler()
      profiler.startPhase(phaseName)

      try {
        const result = await originalMethod.apply(this, args)
        return result
      } finally {
        profiler.endPhase(phaseName)
      }
    }

    return descriptor
  }
}
