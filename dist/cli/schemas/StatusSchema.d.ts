import { z } from 'zod';
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
export declare const StatusSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    checkMemory: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    checkProviders: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    checkAgents: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    checkCache: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    checkFilesystem: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    format: z.ZodDefault<z.ZodDefault<z.ZodEnum<["text", "json", "table", "yaml"]>>>;
    showMetrics: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    format: "text" | "json" | "yaml" | "table";
    debug: boolean;
    quiet: boolean;
    checkMemory: boolean;
    checkProviders: boolean;
    checkAgents: boolean;
    checkCache: boolean;
    checkFilesystem: boolean;
    showMetrics: boolean;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    format?: "text" | "json" | "yaml" | "table" | undefined;
    debug?: boolean | undefined;
    quiet?: boolean | undefined;
    checkMemory?: boolean | undefined;
    checkProviders?: boolean | undefined;
    checkAgents?: boolean | undefined;
    checkCache?: boolean | undefined;
    checkFilesystem?: boolean | undefined;
    showMetrics?: boolean | undefined;
}>;
export type Status = z.infer<typeof StatusSchema>;
/**
 * Validation helper that throws user-friendly errors
 */
export declare function validateStatus(input: unknown): Status;
/**
 * Safe validation that returns success/error result
 */
export declare function safeValidateStatus(input: unknown): {
    success: true;
    data: Status;
} | {
    success: false;
    error: z.ZodError;
};
//# sourceMappingURL=StatusSchema.d.ts.map