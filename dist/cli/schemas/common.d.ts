import { z } from 'zod';
/**
 * Base command schema with global flags available to all commands
 */
export declare const BaseCommandSchema: z.ZodObject<{
    debug: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    quiet: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    json: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type BaseCommand = z.infer<typeof BaseCommandSchema>;
/**
 * Agent name validation
 * - Must start with lowercase letter
 * - Only lowercase alphanumeric + hyphens
 * - Cannot start or end with hyphen
 * - Max 50 characters
 */
export declare const AgentNameSchema: z.ZodString;
/**
 * Task description validation
 * - Min 3 characters
 * - Max 5000 characters
 * - Must contain non-whitespace
 */
export declare const TaskDescriptionSchema: z.ZodString;
/**
 * Provider selection enum
 */
export declare const ProviderSchema: z.ZodEnum<{
    claude: "claude";
    gemini: "gemini";
    openai: "openai";
    "claude-code": "claude-code";
    "gemini-cli": "gemini-cli";
    gpt: "gpt";
}>;
export type Provider = z.infer<typeof ProviderSchema>;
/**
 * Output format enum
 */
export declare const OutputFormatSchema: z.ZodDefault<z.ZodEnum<{
    text: "text";
    json: "json";
    table: "table";
    yaml: "yaml";
}>>;
export type OutputFormat = z.infer<typeof OutputFormatSchema>;
/**
 * File path validation
 * - Must not be empty
 * - Cannot contain directory traversal (..)
 */
export declare const FilePathSchema: z.ZodString;
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
export declare const TagsSchema: z.ZodOptional<z.ZodArray<z.ZodString>>;
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
    }, z.core.$strip>;
    AgentName: z.ZodString;
    TaskDescription: z.ZodString;
    Provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
        "claude-code": "claude-code";
        "gemini-cli": "gemini-cli";
        gpt: "gpt";
    }>;
    OutputFormat: z.ZodDefault<z.ZodEnum<{
        text: "text";
        json: "json";
        table: "table";
        yaml: "yaml";
    }>>;
    FilePath: z.ZodString;
    Timeout: z.ZodOptional<z.ZodNumber>;
    Limit: z.ZodDefault<z.ZodNumber>;
    Offset: z.ZodDefault<z.ZodNumber>;
    DateTime: z.ZodOptional<z.ZodString>;
    Tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    UUID: z.ZodString;
    ConfigKey: z.ZodString;
};
//# sourceMappingURL=common.d.ts.map