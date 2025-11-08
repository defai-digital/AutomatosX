// Sprint 2 Day 11: Common Zod Schema Patterns
// Shared validation schemas used across all CLI commands
import { z } from 'zod';
/**
 * Base command schema with global flags available to all commands
 */
export const BaseCommandSchema = z.object({
    debug: z.boolean().optional().default(false).describe('Enable debug logging'),
    verbose: z.boolean().optional().default(false).describe('Enable verbose output'),
    quiet: z.boolean().optional().default(false).describe('Suppress non-essential output'),
    json: z.boolean().optional().default(false).describe('Output as JSON'),
});
/**
 * Agent name validation
 * - Must start with lowercase letter
 * - Only lowercase alphanumeric + hyphens
 * - Cannot start or end with hyphen
 * - Max 50 characters
 */
export const AgentNameSchema = z
    .string()
    .min(1, 'Agent name cannot be empty')
    .max(50, 'Agent name too long (max 50 characters)')
    .regex(/^[a-z][a-z0-9-]*$/, 'Agent name must be lowercase alphanumeric with hyphens')
    .refine((name) => !name.startsWith('-') && !name.endsWith('-'), 'Agent name cannot start or end with hyphen')
    .describe('Valid agent identifier (e.g., backend, frontend, product)');
/**
 * Task description validation
 * - Min 3 characters
 * - Max 5000 characters
 * - Must contain non-whitespace
 */
export const TaskDescriptionSchema = z
    .string()
    .min(3, 'Task description too short (min 3 characters)')
    .max(5000, 'Task description too long (max 5000 characters)')
    .refine((task) => task.trim().length > 0, 'Task description cannot be only whitespace')
    .describe('Task instructions for the agent');
/**
 * Provider selection enum
 */
export const ProviderSchema = z
    .enum(['claude', 'claude-code', 'gemini', 'gemini-cli', 'openai', 'gpt'], {
    errorMap: () => ({
        message: 'Invalid provider. Must be one of: claude, claude-code, gemini, gemini-cli, openai, gpt',
    }),
})
    .describe('AI provider to use for task execution');
/**
 * Output format enum
 */
export const OutputFormatSchema = z
    .enum(['text', 'json', 'table', 'yaml'], {
    errorMap: () => ({
        message: 'Invalid format. Must be: text, json, table, or yaml',
    }),
})
    .default('text')
    .describe('Output formatting style');
/**
 * File path validation
 * - Must not be empty
 * - Cannot contain directory traversal (..)
 */
export const FilePathSchema = z
    .string()
    .min(1, 'File path cannot be empty')
    .refine((path) => !path.includes('..'), "File path cannot contain '..' (directory traversal)")
    .describe('Valid file system path');
/**
 * Timeout validation (in milliseconds)
 * - Positive integer
 * - Max 30 minutes (1800000ms)
 */
export const TimeoutSchema = z
    .number()
    .int()
    .positive()
    .max(30 * 60 * 1000, 'Timeout cannot exceed 30 minutes')
    .optional()
    .describe('Operation timeout in milliseconds');
/**
 * Limit/pagination validation
 * - Positive integer
 * - Max 100
 */
export const LimitSchema = z
    .number()
    .int()
    .positive()
    .max(100, 'Limit cannot exceed 100')
    .default(10)
    .describe('Maximum number of results to return');
/**
 * Offset/skip validation
 * - Non-negative integer
 */
export const OffsetSchema = z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe('Number of results to skip');
/**
 * Date/time string validation (ISO 8601 format)
 */
export const DateTimeSchema = z
    .string()
    .datetime({ message: 'Must be valid ISO 8601 datetime string' })
    .optional()
    .describe('ISO 8601 datetime string (e.g., 2025-01-15T10:30:00Z)');
/**
 * Tag array validation
 */
export const TagsSchema = z
    .array(z.string().min(1).max(50))
    .optional()
    .describe('Array of tag strings for filtering');
/**
 * UUID validation
 */
export const UUIDSchema = z
    .string()
    .uuid('Must be a valid UUID')
    .describe('UUID identifier');
/**
 * Config key validation
 * - Alphanumeric + dots for nested keys
 * - Max 100 characters
 */
export const ConfigKeySchema = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Config key must be alphanumeric with dots, underscores, or hyphens')
    .describe('Configuration key (supports nested keys with dots)');
// Export all schemas as a convenient namespace
export const CommonSchemas = {
    BaseCommand: BaseCommandSchema,
    AgentName: AgentNameSchema,
    TaskDescription: TaskDescriptionSchema,
    Provider: ProviderSchema,
    OutputFormat: OutputFormatSchema,
    FilePath: FilePathSchema,
    Timeout: TimeoutSchema,
    Limit: LimitSchema,
    Offset: OffsetSchema,
    DateTime: DateTimeSchema,
    Tags: TagsSchema,
    UUID: UUIDSchema,
    ConfigKey: ConfigKeySchema,
};
//# sourceMappingURL=common.js.map