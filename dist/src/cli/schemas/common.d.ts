import { z } from 'zod';
/**
 * Base command schema with global flags available to all commands
 */
export declare const BaseCommandSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    json: boolean;
    debug: boolean;
    quiet: boolean;
}, {
    verbose?: boolean | undefined;
    json?: boolean | undefined;
    debug?: boolean | undefined;
    quiet?: boolean | undefined;
}>;
export type BaseCommand = z.infer<typeof BaseCommandSchema>;
/**
 * Agent name validation
 * - Must start with lowercase letter
 * - Only lowercase alphanumeric + hyphens
 * - Cannot start or end with hyphen
 * - Max 50 characters
 */
export declare const AgentNameSchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * Task description validation
 * - Min 3 characters
 * - Max 5000 characters
 * - Must contain non-whitespace
 */
export declare const TaskDescriptionSchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * Provider selection enum
 */
export declare const ProviderSchema: z.ZodEnum<["claude", "claude-code", "gemini", "gemini-cli", "openai", "gpt"]>;
export type Provider = z.infer<typeof ProviderSchema>;
/**
 * Output format enum
 */
export declare const OutputFormatSchema: z.ZodDefault<z.ZodEnum<["text", "json", "table", "yaml"]>>;
export type OutputFormat = z.infer<typeof OutputFormatSchema>;
/**
 * File path validation
 * - Must not be empty
 * - Cannot contain directory traversal (..)
 */
export declare const FilePathSchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * Timeout validation (in milliseconds)
 * - Positive integer
 * - Max 30 minutes (1800000ms)
 */
export declare const TimeoutSchema: z.ZodOptional<z.ZodNumber>;
/**
 * Limit/pagination validation
 * - Positive integer
 * - Max 100
 */
export declare const LimitSchema: z.ZodDefault<z.ZodNumber>;
/**
 * Offset/skip validation
 * - Non-negative integer
 */
export declare const OffsetSchema: z.ZodDefault<z.ZodNumber>;
/**
 * Date/time string validation (ISO 8601 format)
 */
export declare const DateTimeSchema: z.ZodOptional<z.ZodString>;
/**
 * Tag array validation
 */
export declare const TagsSchema: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
/**
 * UUID validation
 */
export declare const UUIDSchema: z.ZodString;
/**
 * Config key validation
 * - Alphanumeric + dots for nested keys
 * - Max 100 characters
 */
export declare const ConfigKeySchema: z.ZodString;
export declare const CommonSchemas: {
    BaseCommand: z.ZodObject<{
        debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        verbose: boolean;
        json: boolean;
        debug: boolean;
        quiet: boolean;
    }, {
        verbose?: boolean | undefined;
        json?: boolean | undefined;
        debug?: boolean | undefined;
        quiet?: boolean | undefined;
    }>;
    AgentName: z.ZodEffects<z.ZodString, string, string>;
    TaskDescription: z.ZodEffects<z.ZodString, string, string>;
    Provider: z.ZodEnum<["claude", "claude-code", "gemini", "gemini-cli", "openai", "gpt"]>;
    OutputFormat: z.ZodDefault<z.ZodEnum<["text", "json", "table", "yaml"]>>;
    FilePath: z.ZodEffects<z.ZodString, string, string>;
    Timeout: z.ZodOptional<z.ZodNumber>;
    Limit: z.ZodDefault<z.ZodNumber>;
    Offset: z.ZodDefault<z.ZodNumber>;
    DateTime: z.ZodOptional<z.ZodString>;
    Tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    UUID: z.ZodString;
    ConfigKey: z.ZodString;
};
//# sourceMappingURL=common.d.ts.map