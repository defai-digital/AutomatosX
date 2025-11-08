// Sprint 2 Day 12: Memory Search Command Schema
// Zod validation for `ax memory search "<query>"` CLI command
import { z } from 'zod';
import { BaseCommandSchema, AgentNameSchema, OutputFormatSchema, LimitSchema, OffsetSchema, DateTimeSchema, TagsSchema, } from './common.js';
/**
 * Schema for the `ax memory search` command
 *
 * Usage: ax memory search "<query>" [options]
 *
 * Examples:
 * - ax memory search "authentication implementation"
 * - ax memory search "API design" --agent backend --limit 20
 * - ax memory search "bug fixes" --date-from 2025-01-01T00:00:00Z --format json
 */
export const MemorySearchSchema = BaseCommandSchema.extend({
    // Positional argument
    query: z
        .string()
        .min(1, 'Search query cannot be empty')
        .max(500, 'Search query too long (max 500 characters)')
        .describe('Search query for memory database (FTS5 full-text search)'),
    // Filtering options
    agent: AgentNameSchema.optional().describe('Filter by specific agent name'),
    dateFrom: DateTimeSchema.describe('Filter results from this date onwards'),
    dateTo: DateTimeSchema.describe('Filter results up to this date'),
    tags: TagsSchema.describe('Filter by tags (matches any tag in array)'),
    // Pagination
    limit: LimitSchema.describe('Maximum number of results to return'),
    offset: OffsetSchema.describe('Number of results to skip (for pagination)'),
    // Output formatting
    format: OutputFormatSchema.describe('Output format (text, json, table, yaml)'),
    // Advanced search options
    exactMatch: z
        .boolean()
        .optional()
        .default(false)
        .describe('Require exact phrase match instead of fuzzy search'),
    sortBy: z
        .enum(['relevance', 'date', 'agent'], {
        errorMap: () => ({ message: 'Sort must be: relevance, date, or agent' }),
    })
        .optional()
        .default('relevance')
        .describe('Sort order for results'),
    // Output configuration (inherits verbose, debug, quiet, json from BaseCommandSchema)
});
/**
 * Validation helper that throws user-friendly errors
 */
export function validateMemorySearch(input) {
    try {
        return MemorySearchSchema.parse(input);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
            throw new Error(`Invalid memory search command:\n${errorMessages}`);
        }
        throw error;
    }
}
/**
 * Safe validation that returns success/error result
 */
export function safeValidateMemorySearch(input) {
    const result = MemorySearchSchema.safeParse(input);
    return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
}
//# sourceMappingURL=MemorySearchSchema.js.map