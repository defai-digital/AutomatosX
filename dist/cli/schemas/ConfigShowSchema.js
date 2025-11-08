// Sprint 2 Day 12: Config Show Command Schema
// Zod validation for `ax config show` CLI command
import { z } from 'zod';
import { BaseCommandSchema, OutputFormatSchema, ConfigKeySchema } from './common.js';
/**
 * Schema for the `ax config show` command
 *
 * Usage: ax config show [key] [options]
 *
 * Examples:
 * - ax config show
 * - ax config show providers.claude.enabled
 * - ax config show --format json
 * - ax config show execution.timeout --verbose
 */
export const ConfigShowSchema = BaseCommandSchema.extend({
    // Optional key to show specific config value
    key: ConfigKeySchema.optional().describe('Specific config key to display (supports nested keys with dots)'),
    // Output formatting
    format: OutputFormatSchema.default('text').describe('Output format (text, json, table, yaml)'),
    showDefaults: z
        .boolean()
        .optional()
        .default(false)
        .describe('Show default values for all config keys'),
    showSources: z
        .boolean()
        .optional()
        .default(false)
        .describe('Show config value sources (file, env, default)'),
    // Filtering options
    category: z
        .enum(['all', 'providers', 'execution', 'memory', 'agents', 'performance'], {
        errorMap: () => ({
            message: 'Category must be: all, providers, execution, memory, agents, or performance',
        }),
    })
        .optional()
        .default('all')
        .describe('Filter config keys by category'),
    // Output configuration (inherits verbose, debug, quiet, json from BaseCommandSchema)
});
/**
 * Validation helper that throws user-friendly errors
 */
export function validateConfigShow(input) {
    try {
        return ConfigShowSchema.parse(input);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
            throw new Error(`Invalid config show command:\n${errorMessages}`);
        }
        throw error;
    }
}
/**
 * Safe validation that returns success/error result
 */
export function safeValidateConfigShow(input) {
    const result = ConfigShowSchema.safeParse(input);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
}
//# sourceMappingURL=ConfigShowSchema.js.map