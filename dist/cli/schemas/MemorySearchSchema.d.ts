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
} & {
    query: z.ZodString;
    agent: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    dateFrom: z.ZodOptional<z.ZodString>;
    dateTo: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    format: z.ZodDefault<z.ZodEnum<["text", "json", "table", "yaml"]>>;
    exactMatch: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["relevance", "date", "agent"]>>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    query: string;
    limit: number;
    offset: number;
    sortBy: "date" | "agent" | "relevance";
    format: "text" | "json" | "yaml" | "table";
    debug: boolean;
    quiet: boolean;
    exactMatch: boolean;
    agent?: string | undefined;
    tags?: string[] | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
}, {
    query: string;
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    agent?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    sortBy?: "date" | "agent" | "relevance" | undefined;
    format?: "text" | "json" | "yaml" | "table" | undefined;
    debug?: boolean | undefined;
    tags?: string[] | undefined;
    quiet?: boolean | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    exactMatch?: boolean | undefined;
}>;
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