// Sprint 2 Day 17: Chaos Command Handlers
// Handlers for chaos testing CLI commands

import {
  ChaosEnableSchema,
  ChaosDisableSchema,
  ChaosStatusSchema,
  ChaosTestSchema,
  type ChaosEnable,
  type ChaosDisable,
  type ChaosStatus,
  type ChaosTest,
} from '../schemas/ChaosCommandSchema.js'
import { errorHandler, ErrorCodes } from '../../utils/ErrorEnvelope.js'
import { StreamingLogger } from '../../utils/StreamingLogger.js'
import { getGlobalChaos } from '../../utils/ChaosEngine.js'
import { ProgressTracker } from '../../utils/SpinnerLogger.js'

/**
 * Enable chaos mode
 *
 * @example
 * ```bash
 * ax chaos enable --failure-rate 0.3 --scenarios provider-failure,network-latency
 * ```
 */
export async function chaosEnableCommand(rawArgs: unknown): Promise<void> {
  const logger = new StreamingLogger({ minLevel: 'info' })

  try {
    const args = ChaosEnableSchema.parse(rawArgs)

    logger.info('Enabling chaos mode...')

    const chaos = getGlobalChaos()
    chaos.enable({
      enabled: true,
      failureRate: args.failureRate,
      scenarios: args.scenarios,
      seed: args.seed,
      minDelay: args.minDelay,
      maxDelay: args.maxDelay,
    })

    const config = chaos.getConfig()

    logger.success('Chaos mode enabled!')
    logger.info(`Failure rate: ${(config.failureRate! * 100).toFixed(0)}%`)
    logger.info(`Scenarios: ${config.scenarios?.join(', ') || 'all'}`)

    if (config.seed) {
      logger.info(`Seed: ${config.seed} (deterministic)`)
    }

    logger.info(`Latency range: ${config.minDelay}-${config.maxDelay}ms`)

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            chaosEnabled: true,
            config,
          },
          null,
          2
        )
      )
    }
  } catch (error) {
    await errorHandler(error, {
      debug: (rawArgs as any)?.debug,
      json: (rawArgs as any)?.json,
    })
  }
}

/**
 * Disable chaos mode
 *
 * @example
 * ```bash
 * ax chaos disable --reset
 * ```
 */
export async function chaosDisableCommand(rawArgs: unknown): Promise<void> {
  const logger = new StreamingLogger({ minLevel: 'info' })

  try {
    const args = ChaosDisableSchema.parse(rawArgs)

    logger.info('Disabling chaos mode...')

    const chaos = getGlobalChaos()
    const summary = chaos.getSummary()

    chaos.disable()

    if (args.reset) {
      chaos.reset()
      logger.info('Chaos statistics reset')
    }

    logger.success('Chaos mode disabled!')
    logger.info(`Total events: ${summary.totalEvents}`)
    logger.info(`Failures injected: ${summary.eventsInjected}`)

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            chaosEnabled: false,
            summary,
          },
          null,
          2
        )
      )
    }
  } catch (error) {
    await errorHandler(error, {
      debug: (rawArgs as any)?.debug,
      json: (rawArgs as any)?.json,
    })
  }
}

/**
 * Show chaos mode status
 *
 * @example
 * ```bash
 * ax chaos status --events --verbose
 * ```
 */
export async function chaosStatusCommand(rawArgs: unknown): Promise<void> {
  const logger = new StreamingLogger({ minLevel: 'info' })

  try {
    const args = ChaosStatusSchema.parse(rawArgs)

    const chaos = getGlobalChaos()
    const isEnabled = chaos.isEnabled()
    const config = chaos.getConfig()
    const summary = chaos.getSummary()

    logger.info(`Chaos mode: ${isEnabled ? '🔴 ENABLED' : '🟢 DISABLED'}`)

    if (isEnabled) {
      logger.info(`Failure rate: ${(config.failureRate! * 100).toFixed(0)}%`)
      logger.info(`Scenarios: ${config.scenarios?.join(', ') || 'all'}`)

      if (config.seed) {
        logger.info(`Seed: ${config.seed}`)
      }
    }

    if (args.stats) {
      logger.info('\n📊 Chaos Statistics:')
      logger.info(`Total events: ${summary.totalEvents}`)
      logger.info(`Failures injected: ${summary.eventsInjected}`)
      logger.info(
        `Actual failure rate: ${(summary.failureRate * 100).toFixed(1)}%`
      )

      logger.info('\n📋 Scenario Counts:')
      Object.entries(summary.scenarioCounts).forEach(([scenario, count]) => {
        if (count > 0) {
          logger.info(`  ${scenario}: ${count}`)
        }
      })
    }

    if (args.events) {
      const events = chaos.getEvents()
      logger.info(`\n📝 Recent Events (${events.length}):`)

      events.slice(-10).forEach((event, index) => {
        logger.info(
          `  ${index + 1}. [${event.type}] ${event.target} - ${event.injected ? '❌ FAILED' : '✅ OK'}`
        )
      })
    }

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            enabled: isEnabled,
            config,
            summary,
            events: args.events ? chaos.getEvents() : undefined,
          },
          null,
          2
        )
      )
    }
  } catch (error) {
    await errorHandler(error, {
      debug: (rawArgs as any)?.debug,
      json: (rawArgs as any)?.json,
    })
  }
}

/**
 * Run chaos tests
 *
 * @example
 * ```bash
 * ax chaos test --iterations 100 --failure-rate 0.5
 * ```
 */
export async function chaosTestCommand(rawArgs: unknown): Promise<void> {
  const logger = new StreamingLogger({ minLevel: 'info' })

  try {
    const args = ChaosTestSchema.parse(rawArgs)

    logger.info(`Running chaos tests (${args.iterations} iterations)...`)

    const chaos = getGlobalChaos()
    const wasEnabled = chaos.isEnabled()

    // Enable chaos for testing
    chaos.enable({
      enabled: true,
      failureRate: args.failureRate,
      scenarios: args.scenario ? [args.scenario] : undefined,
    })

    const progress = new ProgressTracker([
      { name: 'setup', status: 'pending' },
      { name: 'execute', status: 'pending' },
      { name: 'analyze', status: 'pending' },
      { name: 'report', status: 'pending' },
    ])

    // Setup
    progress.start('setup', 'Setting up chaos tests')
    await new Promise(resolve => setTimeout(resolve, 100))
    progress.complete('setup', `Configured ${args.iterations} test iterations`)

    // Execute tests
    progress.start('execute', 'Running chaos tests')

    let passed = 0
    let failed = 0
    let errors: Error[] = []

    for (let i = 0; i < args.iterations; i++) {
      if (i % 10 === 0) {
        progress.updateMessage(`Running test ${i + 1}/${args.iterations}`)
      }

      try {
        // Mock test operation
        const result = chaos.shouldInject(`test-${i}`)

        if (result.shouldFail) {
          failed++
          if (result.error) {
            errors.push(result.error)
          }
        } else {
          passed++
        }

        // Simulate test execution time
        await new Promise(resolve => setTimeout(resolve, 5))
      } catch (error) {
        failed++
        errors.push(error as Error)
      }
    }

    progress.complete('execute', `Completed ${args.iterations} iterations`)

    // Analyze results
    progress.start('analyze', 'Analyzing test results')
    await new Promise(resolve => setTimeout(resolve, 100))

    const summary = chaos.getSummary()
    const actualFailureRate = failed / args.iterations
    const expectedFailureRate = args.failureRate

    progress.complete('analyze', 'Analysis complete')

    // Report
    progress.start('report', 'Generating report')

    logger.info('\n📊 Chaos Test Results:')
    logger.info(`Total iterations: ${args.iterations}`)
    logger.info(`Passed: ${passed} (${((passed / args.iterations) * 100).toFixed(1)}%)`)
    logger.info(`Failed: ${failed} (${((failed / args.iterations) * 100).toFixed(1)}%)`)
    logger.info(`Expected failure rate: ${(expectedFailureRate * 100).toFixed(1)}%`)
    logger.info(`Actual failure rate: ${(actualFailureRate * 100).toFixed(1)}%`)

    const tolerance = 0.1 // 10% tolerance
    const rateMatch =
      Math.abs(actualFailureRate - expectedFailureRate) <= tolerance

    if (rateMatch) {
      logger.success('✅ Failure rate within expected range')
    } else {
      logger.warn('⚠️  Failure rate outside expected range')
    }

    logger.info('\n📋 Scenario Distribution:')
    Object.entries(summary.scenarioCounts).forEach(([scenario, count]) => {
      if (count > 0) {
        logger.info(`  ${scenario}: ${count}`)
      }
    })

    progress.complete('report', 'Report generated')
    progress.stopAll()

    // Restore previous chaos state
    if (!wasEnabled) {
      chaos.disable()
      logger.info('\nChaos mode disabled (restored previous state)')
    }

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            results: {
              iterations: args.iterations,
              passed,
              failed,
              actualFailureRate,
              expectedFailureRate,
              rateMatch,
              summary,
            },
          },
          null,
          2
        )
      )
    }
  } catch (error) {
    await errorHandler(error, {
      debug: (rawArgs as any)?.debug,
      json: (rawArgs as any)?.json,
    })
  }
}
