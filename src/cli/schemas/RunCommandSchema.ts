// Sprint 2 Day 12: Run Command Schema
// Zod validation for `ax run <agent> "<task>"` CLI command

import { z } from 'zod'
import {
  BaseCommandSchema,
  AgentNameSchema,
  TaskDescriptionSchema,
  ProviderSchema,
  TimeoutSchema,
} from './common.js'

/**
 * Schema for the `ax run` command
 *
 * Usage: ax run <agent> "<task>" [options]
 *
 * Examples:
 * - ax run backend "Implement user authentication API"
 * - ax run backend "Fix login bug" --streaming --provider claude
 * - ax run product "Design pricing page" --parallel --resumable
 */
export const RunCommandSchema = BaseCommandSchema.extend({
  // Positional arguments
  agent: AgentNameSchema.describe('Agent to execute the task'),

  task: TaskDescriptionSchema.describe('Task description for the agent to execute'),

  // Execution mode flags
  streaming: z
    .boolean()
    .optional()
    .default(false)
    .describe('Enable real-time streaming output from AI provider'),

  parallel: z
    .boolean()
    .optional()
    .default(false)
    .describe('Allow parallel execution with other agents'),

  resumable: z
    .boolean()
    .optional()
    .default(false)
    .describe('Enable resumable execution with checkpoints'),

  // Provider configuration
  provider: ProviderSchema.optional().describe('AI provider override (uses default if not specified)'),

  timeout: TimeoutSchema.describe('Maximum execution time in milliseconds'),

  // Memory configuration
  useMemory: z
    .boolean()
    .optional()
    .default(true)
    .describe('Search memory for relevant context before execution'),

  memoryLimit: z
    .number()
    .int()
    .positive()
    .max(50, 'Memory limit cannot exceed 50 results')
    .optional()
    .default(10)
    .describe('Maximum number of memory results to retrieve'),

  // Retry configuration
  maxRetries: z
    .number()
    .int()
    .nonnegative()
    .max(5, 'Max retries cannot exceed 5')
    .optional()
    .default(3)
    .describe('Maximum retry attempts on provider failures'),

  // Output configuration (inherits verbose, debug, quiet, json from BaseCommandSchema)
})

export type RunCommand = z.infer<typeof RunCommandSchema>

/**
 * Validation helper that throws user-friendly errors
 */
export function validateRunCommand(input: unknown): RunCommand {
  try {
    return RunCommandSchema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n')
      throw new Error(`Invalid run command:\n${errorMessages}`)
    }
    throw error
  }
}

/**
 * Safe validation that returns success/error result
 */
export function safeValidateRunCommand(
  input: unknown
): { success: true; data: RunCommand } | { success: false; error: z.ZodError } {
  const result = RunCommandSchema.safeParse(input)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}
