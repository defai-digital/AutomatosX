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
export declare const ListAgentsSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    category: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        all: "all";
        development: "development";
        operations: "operations";
        leadership: "leadership";
        creative: "creative";
        science: "science";
    }>>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        name: "name";
        category: "category";
        priority: "priority";
    }>>>;
    format: z.ZodDefault<z.ZodDefault<z.ZodEnum<{
        text: "text";
        json: "json";
        table: "table";
        yaml: "yaml";
    }>>>;
    showCapabilities: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
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