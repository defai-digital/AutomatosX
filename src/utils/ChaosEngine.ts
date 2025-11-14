// Sprint 2 Day 17: Chaos Engineering Framework
// Controlled failure injection for testing resilience

import { EventEmitter } from 'events'
import { SeededRandom } from './DeterministicSeeds.js'

/**
 * Chaos scenario types
 */
export type ChaosScenario =
  | 'provider-failure'
  | 'network-latency'
  | 'timeout'
  | 'memory-corruption'
  | 'disk-full'
  | 'cache-miss'
  | 'slow-query'
  | 'connection-error'

/**
 * Chaos configuration
 */
export interface ChaosConfig {
  enabled: boolean
  seed?: number
  failureRate?: number
  scenarios?: ChaosScenario[]
  minDelay?: number
  maxDelay?: number
}

/**
 * Chaos event
 */
export interface ChaosEvent {
  type: ChaosScenario
  timestamp: number
  target: string
  injected: boolean
  metadata?: Record<string, unknown>
}

/**
 * Chaos injection result
 */
export interface ChaosInjectionResult {
  shouldFail: boolean
  scenario?: ChaosScenario
  delay?: number
  error?: Error
}

/**
 * Chaos Engine
 *
 * Controlled failure injection for testing system resilience
 *
 * @example
 * ```typescript
 * const chaos = new ChaosEngine({
 *   enabled: true,
 *   failureRate: 0.3,
 *   scenarios: ['provider-failure', 'network-latency'],
 *   seed: 12345
 * })
 *
 * // Check if should inject failure
 * const result = chaos.shouldInject('provider-request')
 * if (result.shouldFail) {
 *   throw result.error
 * }
 *
 * // Add delay
 * await chaos.injectDelay()
 * ```
 */
export class ChaosEngine extends EventEmitter {
  private config: Required<ChaosConfig>
  private random: SeededRandom
  private events: ChaosEvent[]
  private stats: Map<ChaosScenario, number>

  constructor(config: ChaosConfig = { enabled: false }) {
    super()
    this.config = {
      enabled: config.enabled,
      seed: config.seed || Date.now(),
      failureRate: config.failureRate || 0.2,
      scenarios: config.scenarios || this.getAllScenarios(),
      minDelay: config.minDelay || 100,
      maxDelay: config.maxDelay || 2000,
    }

    this.random = new SeededRandom(this.config.seed)
    this.events = []
    this.stats = new Map()

    // Initialize stats
    this.getAllScenarios().forEach(scenario => {
      this.stats.set(scenario, 0)
    })
  }

  /**
   * Check if chaos should be injected
   */
  shouldInject(target: string, metadata?: Record<string, unknown>): ChaosInjectionResult {
    if (!this.config.enabled) {
      return { shouldFail: false }
    }

    const roll = this.random.next()

    if (roll < this.config.failureRate) {
      const scenario = this.selectScenario()
      const error = this.createError(scenario)
      const delay = this.random.nextInRange(this.config.minDelay, this.config.maxDelay)

      this.recordEvent({
        type: scenario,
        timestamp: Date.now(),
        target,
        injected: true,
        metadata,
      })

      this.incrementStat(scenario)

      this.emit('chaos-injected', {
        scenario,
        target,
        error: error.message,
        delay,
      })

      return {
        shouldFail: true,
        scenario,
        delay,
        error,
      }
    }

    return { shouldFail: false }
  }

  /**
   * Inject delay (latency chaos)
   */
  async injectDelay(target?: string): Promise<number> {
    if (!this.config.enabled) {
      return 0
    }

    const result = this.shouldInject(target || 'latency-injection')

    if (result.shouldFail && result.delay) {
      await new Promise(resolve => setTimeout(resolve, result.delay))
      return result.delay
    }

    return 0
  }

  /**
   * Inject error if chaos should trigger
   */
  injectError(target: string, metadata?: Record<string, unknown>): void {
    const result = this.shouldInject(target, metadata)

    if (result.shouldFail && result.error) {
      throw result.error
    }
  }

  /**
   * Conditionally inject chaos
   */
  async maybeInjectChaos(
    target: string,
    operation: () => Promise<any>,
    metadata?: Record<string, unknown>
  ): Promise<any> {
    const result = this.shouldInject(target, metadata)

    if (result.shouldFail) {
      if (result.delay) {
        await new Promise(resolve => setTimeout(resolve, result.delay))
      }

      if (result.error) {
        throw result.error
      }
    }

    return await operation()
  }

  /**
   * Enable chaos mode
   */
  enable(config?: Partial<ChaosConfig>): void {
    this.config.enabled = true

    if (config) {
      this.config = {
        ...this.config,
        ...config,
      }
    }

    this.emit('chaos-enabled', { config: this.config })
  }

  /**
   * Disable chaos mode
   */
  disable(): void {
    this.config.enabled = false
    this.emit('chaos-disabled')
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get configuration
   */
  getConfig(): ChaosConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChaosConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    }

    this.emit('config-updated', { config: this.config })
  }

  /**
   * Get chaos events
   */
  getEvents(): ChaosEvent[] {
    return [...this.events]
  }

  /**
   * Get chaos statistics
   */
  getStats(): Map<ChaosScenario, number> {
    return new Map(this.stats)
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEvents: number
    eventsInjected: number
    scenarioCounts: Record<ChaosScenario, number>
    failureRate: number
  } {
    const totalEvents = this.events.length
    const eventsInjected = this.events.filter(e => e.injected).length

    const scenarioCounts = {} as Record<ChaosScenario, number>
    this.stats.forEach((count, scenario) => {
      scenarioCounts[scenario] = count
    })

    return {
      totalEvents,
      eventsInjected,
      scenarioCounts,
      failureRate: totalEvents > 0 ? eventsInjected / totalEvents : 0,
    }
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.events = []
    this.stats.clear()
    this.getAllScenarios().forEach(scenario => {
      this.stats.set(scenario, 0)
    })

    this.emit('reset')
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events = []
    this.emit('events-cleared')
  }

  /**
   * Select a random chaos scenario
   */
  private selectScenario(): ChaosScenario {
    const scenarios = this.config.scenarios
    const index = Math.floor(this.random.next() * scenarios.length)
    return scenarios[index]
  }

  /**
   * Create error for scenario
   */
  private createError(scenario: ChaosScenario): Error {
    const errors: Record<ChaosScenario, string> = {
      'provider-failure': 'Provider request failed (chaos injected)',
      'network-latency': 'Network latency exceeded timeout (chaos injected)',
      timeout: 'Operation timed out (chaos injected)',
      'memory-corruption': 'Memory corruption detected (chaos injected)',
      'disk-full': 'Disk full error (chaos injected)',
      'cache-miss': 'Cache miss forced (chaos injected)',
      'slow-query': 'Database query timeout (chaos injected)',
      'connection-error': 'Connection refused (chaos injected)',
    }

    const error = new Error(errors[scenario])
    error.name = `ChaosError:${scenario}`
    return error
  }

  /**
   * Record chaos event
   */
  private recordEvent(event: ChaosEvent): void {
    this.events.push(event)
  }

  /**
   * Increment scenario stat
   */
  private incrementStat(scenario: ChaosScenario): void {
    const current = this.stats.get(scenario) || 0
    this.stats.set(scenario, current + 1)
  }

  /**
   * Get all available scenarios
   */
  private getAllScenarios(): ChaosScenario[] {
    return [
      'provider-failure',
      'network-latency',
      'timeout',
      'memory-corruption',
      'disk-full',
      'cache-miss',
      'slow-query',
      'connection-error',
    ]
  }
}

/**
 * Chaos mode helper decorator
 */
export function withChaos(chaos: ChaosEngine, target: string) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      return await chaos.maybeInjectChaos(target, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

/**
 * Global chaos engine instance
 */
let globalChaosEngine: ChaosEngine | null = null

/**
 * Get or create global chaos engine
 */
export function getGlobalChaos(config?: ChaosConfig): ChaosEngine {
  if (!globalChaosEngine) {
    globalChaosEngine = new ChaosEngine(config)
  }
  return globalChaosEngine
}

/**
 * Reset global chaos engine
 */
export function resetGlobalChaos(): void {
  globalChaosEngine = null
}
