// Sprint 2 Day 12: List Agents Command Schema
// Zod validation for `ax list agents` CLI command

import { z } from 'zod'
import { BaseCommandSchema, OutputFormatSchema } from './common.js'

/**
 * Schema for the `ax list agents` command
 *
 * Usage: ax list agents [options]
 *
 * Examples:
 * - ax list agents
 * - ax list agents --category development --format json
 * - ax list agents --enabled --sort-by priority --verbose
 */
export const ListAgentsSchema = BaseCommandSchema.extend({
  // Filtering options
  category: z
    .enum(['development', 'operations', 'leadership', 'creative', 'science', 'all'], {
      errorMap: () => ({
        message: 'Category must be: development, operations, leadership, creative, science, or all',
      }),
    })
    .optional()
    .default('all')
    .describe('Filter agents by category'),

  enabled: z
    .boolean()
    .optional()
    .describe('Filter by enabled status (true = enabled only, false = disabled only, undefined = all)'),

  // Sorting options
  sortBy: z
    .enum(['name', 'category', 'priority'], {
      errorMap: () => ({ message: 'Sort must be: name, category, or priority' }),
    })
    .optional()
    .default('name')
    .describe('Sort agents by field'),

  // Output formatting
  format: OutputFormatSchema.default('table').describe('Output format (text, json, table, yaml)'),

  showCapabilities: z
    .boolean()
    .optional()
    .default(false)
    .describe('Show detailed capabilities for each agent'),

  // Output configuration (inherits verbose, debug, quiet, json from BaseCommandSchema)
})

export type ListAgents = z.infer<typeof ListAgentsSchema>

/**
 * Validation helper that throws user-friendly errors
 */
export function validateListAgents(input: unknown): ListAgents {
  try {
    return ListAgentsSchema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n')
      throw new Error(`Invalid list agents command:\n${errorMessages}`)
    }
    throw error
  }
}

/**
 * Safe validation that returns success/error result
 */
export function safeValidateListAgents(
  input: unknown
): { success: true; data: ListAgents } | { success: false; error: z.ZodError } {
  const result = ListAgentsSchema.safeParse(input)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}
