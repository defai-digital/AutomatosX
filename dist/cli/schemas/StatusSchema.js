// Sprint 2 Day 12: Status Command Schema
// Zod validation for `ax status` CLI command
import { z } from 'zod';
import { BaseCommandSchema, OutputFormatSchema } from './common.js';
/**
 * Schema for the `ax status` command
 *
 * Usage: ax status [options]
 *
 * Examples:
 * - ax status
 * - ax status --verbose --format json
 * - ax status --check-providers --check-memory
 */
export const StatusSchema = BaseCommandSchema.extend({
    // Health check component toggles
    checkMemory: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include memory database health check'),
    checkProviders: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include AI provider connectivity check'),
    checkAgents: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include agent catalog validation check'),
    checkCache: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include cache system health check'),
    checkFilesystem: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include filesystem permissions check'),
    // Output formatting
    format: OutputFormatSchema.default('text').describe('Output format (text, json, table, yaml)'),
    showMetrics: z
        .boolean()
        .optional()
        .default(false)
        .describe('Show detailed performance metrics'),
    // Output configuration (inherits verbose, debug, quiet, json from BaseCommandSchema)
});
/**
 * Validation helper that throws user-friendly errors
 */
export function validateStatus(input) {
    try {
        return StatusSchema.parse(input);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
            throw new Error(`Invalid status command:\n${errorMessages}`);
        }
        throw error;
    }
}
/**
 * Safe validation that returns success/error result
 */
export function safeValidateStatus(input) {
    const result = StatusSchema.safeParse(input);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
}
//# sourceMappingURL=StatusSchema.js.map