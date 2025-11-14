import { z } from 'zod';
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
export declare const ConfigShowSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    key: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodDefault<z.ZodEnum<{
        text: "text";
        json: "json";
        yaml: "yaml";
        table: "table";
    }>>>;
    showDefaults: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    showSources: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    category: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        memory: "memory";
        all: "all";
        providers: "providers";
        execution: "execution";
        agents: "agents";
        performance: "performance";
    }>>>;
}, z.core.$strip>;
export type ConfigShow = z.infer<typeof ConfigShowSchema>;
/**
 * Validation helper that throws user-friendly errors
 */
export declare function validateConfigShow(input: unknown): ConfigShow;
/**
 * Safe validation that returns success/error result
 */
export declare function safeValidateConfigShow(input: unknown): {
    success: true;
    data: ConfigShow;
} | {
    success: false;
    error: z.ZodError;
};
//# sourceMappingURL=ConfigShowSchema.d.ts.map