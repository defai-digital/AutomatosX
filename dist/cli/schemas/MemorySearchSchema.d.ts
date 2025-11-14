import { z } from 'zod';
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
export declare const MemorySearchSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    query: z.ZodString;
    agent: z.ZodOptional<z.ZodString>;
    dateFrom: z.ZodOptional<z.ZodString>;
    dateTo: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    format: z.ZodDefault<z.ZodEnum<{
        text: "text";
        json: "json";
        yaml: "yaml";
        table: "table";
    }>>;
    exactMatch: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        agent: "agent";
        date: "date";
        relevance: "relevance";
    }>>>;
}, z.core.$strip>;
export type MemorySearch = z.infer<typeof MemorySearchSchema>;
/**
 * Validation helper that throws user-friendly errors
 */
export declare function validateMemorySearch(input: unknown): MemorySearch;
/**
 * Safe validation that returns success/error result
 */
export declare function safeValidateMemorySearch(input: unknown): {
    success: true;
    data: MemorySearch;
} | {
    success: false;
    error: z.ZodError;
};
//# sourceMappingURL=MemorySearchSchema.d.ts.map