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
export declare const ConfigShowSchema: z.ZodObject<z.objectUtil.extendShape<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, {
    key: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodDefault<z.ZodEnum<["text", "json", "table", "yaml"]>>>;
    showDefaults: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    showSources: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    category: z.ZodDefault<z.ZodOptional<z.ZodEnum<["all", "providers", "execution", "memory", "agents", "performance"]>>>;
}>, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    category: "memory" | "all" | "performance" | "providers" | "agents" | "execution";
    format: "text" | "json" | "yaml" | "table";
    debug: boolean;
    quiet: boolean;
    showDefaults: boolean;
    showSources: boolean;
    key?: string | undefined;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    key?: string | undefined;
    category?: "memory" | "all" | "performance" | "providers" | "agents" | "execution" | undefined;
    format?: "text" | "json" | "yaml" | "table" | undefined;
    debug?: boolean | undefined;
    quiet?: boolean | undefined;
    showDefaults?: boolean | undefined;
    showSources?: boolean | undefined;
}>;
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