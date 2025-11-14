// Sprint 2 Day 17: Chaos Command Schemas
// Zod schemas for chaos testing commands

import { z } from 'zod'
import { BaseCommandSchema } from './common.js'

/**
 * Chaos scenario enum
 */
export const ChaosScenarioSchema = z.enum([
  'provider-failure',
  'network-latency',
  'timeout',
  'memory-corruption',
  'disk-full',
  'cache-miss',
  'slow-query',
  'connection-error',
])

export type ChaosScenario = z.infer<typeof ChaosScenarioSchema>

/**
 * Chaos enable command
 *
 * @example
 * ```bash
 * ax chaos enable --failure-rate 0.3 --scenarios provider-failure,network-latency
 * ```
 */
export const ChaosEnableSchema = BaseCommandSchema.extend({
  failureRate: z
    .number()
    .min(0, 'Failure rate must be between 0 and 1')
    .max(1, 'Failure rate must be between 0 and 1')
    .optional()
    .default(0.2)
    .describe('Probability of injecting failures (0.0 - 1.0)'),

  scenarios: z
    .array(ChaosScenarioSchema)
    .optional()
    .describe('Specific chaos scenarios to enable'),

  seed: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Random seed for deterministic chaos'),

  minDelay: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe('Minimum latency delay in milliseconds'),

  maxDelay: z
    .number()
    .int()
    .positive()
    .optional()
    .default(2000)
    .describe('Maximum latency delay in milliseconds'),
})

export type ChaosEnable = z.infer<typeof ChaosEnableSchema>

/**
 * Chaos disable command
 *
 * @example
 * ```bash
 * ax chaos disable
 * ```
 */
export const ChaosDisableSchema = BaseCommandSchema.extend({
  reset: z
    .boolean()
    .optional()
    .default(false)
    .describe('Reset chaos statistics when disabling'),
})

export type ChaosDisable = z.infer<typeof ChaosDisableSchema>

/**
 * Chaos status command
 *
 * @example
 * ```bash
 * ax chaos status --verbose
 * ```
 */
export const ChaosStatusSchema = BaseCommandSchema.extend({
  events: z
    .boolean()
    .optional()
    .default(false)
    .describe('Show all chaos events'),

  stats: z
    .boolean()
    .optional()
    .default(true)
    .describe('Show chaos statistics'),
})

export type ChaosStatus = z.infer<typeof ChaosStatusSchema>

/**
 * Chaos test command
 *
 * Run chaos tests to validate system resilience
 *
 * @example
 * ```bash
 * ax chaos test --iterations 100 --failure-rate 0.5
 * ```
 */
export const ChaosTestSchema = BaseCommandSchema.extend({
  iterations: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .default(50)
    .describe('Number of test iterations'),

  failureRate: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.3)
    .describe('Failure injection rate'),

  scenario: ChaosScenarioSchema.optional().describe('Test specific scenario'),

  parallel: z
    .boolean()
    .optional()
    .default(false)
    .describe('Run tests in parallel'),

  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(30000)
    .describe('Test timeout in milliseconds'),
})

export type ChaosTest = z.infer<typeof ChaosTestSchema>
