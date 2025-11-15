import { z } from 'zod';
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
export declare const ListAgentsSchema: z.ZodObject<z.objectUtil.extendShape<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, {
    category: z.ZodDefault<z.ZodOptional<z.ZodEnum<["development", "operations", "leadership", "creative", "science", "all"]>>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["name", "category", "priority"]>>>;
    format: z.ZodDefault<z.ZodDefault<z.ZodEnum<["text", "json", "table", "yaml"]>>>;
    showCapabilities: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}>, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    category: "all" | "leadership" | "development" | "operations" | "creative" | "science";
    sortBy: "name" | "priority" | "category";
    format: "text" | "json" | "yaml" | "table";
    debug: boolean;
    quiet: boolean;
    showCapabilities: boolean;
    enabled?: boolean | undefined;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    category?: "all" | "leadership" | "development" | "operations" | "creative" | "science" | undefined;
    sortBy?: "name" | "priority" | "category" | undefined;
    format?: "text" | "json" | "yaml" | "table" | undefined;
    enabled?: boolean | undefined;
    debug?: boolean | undefined;
    quiet?: boolean | undefined;
    showCapabilities?: boolean | undefined;
}>;
export type ListAgents = z.infer<typeof ListAgentsSchema>;
/**
 * Validation helper that throws user-friendly errors
 */
export declare function validateListAgents(input: unknown): ListAgents;
/**
 * Safe validation that returns success/error result
 */
export declare function safeValidateListAgents(input: unknown): {
    success: true;
    data: ListAgents;
} | {
    success: false;
    error: z.ZodError;
};
//# sourceMappingURL=ListAgentsSchema.d.ts.map