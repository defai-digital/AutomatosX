/**
 * Config.ts
 *
 * Configuration types and Zod schemas for AutomatosX
 */
import { z } from 'zod';
/**
 * Zod schema for language-specific configuration
 */
export const LanguageConfigSchema = z.object({
    enabled: z.boolean().default(true),
    extensions: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
    maxFileSize: z.number().positive().optional(),
});
/**
 * Zod schema for search configuration
 */
export const SearchConfigSchema = z.object({
    defaultLimit: z.number().int().positive().default(10),
    maxLimit: z.number().int().positive().default(100),
    enableSymbolSearch: z.boolean().default(true),
    enableNaturalSearch: z.boolean().default(true),
    enableHybridSearch: z.boolean().default(true),
    symbolMatchThreshold: z.number().min(0).max(1).default(0.8),
    hybridSymbolWeight: z.number().min(0).max(1).default(0.7),
});
/**
 * Zod schema for indexing configuration
 */
export const IndexingConfigSchema = z.object({
    chunkSize: z.number().int().positive().default(512),
    chunkOverlap: z.number().int().nonnegative().default(50),
    maxFileSize: z.number().int().positive().default(1024 * 1024), // 1MB default
    excludePatterns: z.array(z.string()).default([
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.min.js',
    ]),
    includePatterns: z.array(z.string()).default(['**/*']),
    followSymlinks: z.boolean().default(false),
    respectGitignore: z.boolean().default(true),
});
/**
 * Zod schema for database configuration
 */
export const DatabaseConfigSchema = z.object({
    path: z.string().default('.automatosx/db/code-intelligence.db'),
    inMemory: z.boolean().default(false),
    wal: z.boolean().default(true),
    busyTimeout: z.number().int().nonnegative().default(5000),
    cacheSize: z.number().int().default(-2000), // 2MB
});
/**
 * Zod schema for performance configuration
 */
export const PerformanceConfigSchema = z.object({
    enableCache: z.boolean().default(true),
    cacheMaxSize: z.number().int().positive().default(1000),
    cacheTTL: z.number().int().positive().default(300000), // 5 minutes
    batchSize: z.number().int().positive().default(100),
    maxConcurrency: z.number().int().positive().default(4),
});
/**
 * Zod schema for logging configuration
 */
export const LoggingConfigSchema = z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableFileLogging: z.boolean().default(false),
    logFilePath: z.string().default('.automatosx/logs/app.log'),
    maxLogFiles: z.number().int().positive().default(5),
    maxLogSize: z.number().int().positive().default(10 * 1024 * 1024), // 10MB
});
/**
 * Main configuration schema with all subsections
 */
export const AutomatosXConfigSchema = z.object({
    version: z.string().default('1.0.0'),
    languages: z.record(z.string(), LanguageConfigSchema).default({
        typescript: { enabled: true },
        javascript: { enabled: true },
        python: { enabled: true },
        go: { enabled: true },
        java: { enabled: true },
        rust: { enabled: true },
        ruby: { enabled: true },
        csharp: { enabled: true },
        cpp: { enabled: true },
        rescript: { enabled: true },
    }),
    search: SearchConfigSchema,
    indexing: IndexingConfigSchema,
    database: DatabaseConfigSchema,
    performance: PerformanceConfigSchema,
    logging: LoggingConfigSchema,
});
/**
 * Partial configuration schema for user-provided configs
 * Allows partial/incomplete configurations that will be merged with defaults
 *
 * IMPORTANT: We create schemas without defaults to prevent Zod from filling in
 * missing fields. This ensures that markConfigFields() only marks fields that
 * were actually present in the user's config file.
 */
// Create partial versions without defaults by making everything optional
const PartialSearchConfigSchema = z.object({
    defaultLimit: z.number().int().positive().optional(),
    maxLimit: z.number().int().positive().optional(),
    enableSymbolSearch: z.boolean().optional(),
    enableNaturalSearch: z.boolean().optional(),
    enableHybridSearch: z.boolean().optional(),
    symbolMatchThreshold: z.number().min(0).max(1).optional(),
    hybridSymbolWeight: z.number().min(0).max(1).optional(),
}).strict();
const PartialIndexingConfigSchema = z.object({
    chunkSize: z.number().int().positive().optional(),
    chunkOverlap: z.number().int().nonnegative().optional(),
    maxFileSize: z.number().int().positive().optional(),
    excludePatterns: z.array(z.string()).optional(),
    includePatterns: z.array(z.string()).optional(),
    followSymlinks: z.boolean().optional(),
    respectGitignore: z.boolean().optional(),
}).strict();
const PartialDatabaseConfigSchema = z.object({
    path: z.string().optional(),
    inMemory: z.boolean().optional(),
    wal: z.boolean().optional(),
    busyTimeout: z.number().int().nonnegative().optional(),
    cacheSize: z.number().int().optional(),
}).strict();
const PartialPerformanceConfigSchema = z.object({
    enableCache: z.boolean().optional(),
    cacheMaxSize: z.number().int().positive().optional(),
    cacheTTL: z.number().int().positive().optional(),
    batchSize: z.number().int().positive().optional(),
    maxConcurrency: z.number().int().positive().optional(),
}).strict();
const PartialLoggingConfigSchema = z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    enableFileLogging: z.boolean().optional(),
    logFilePath: z.string().optional(),
    maxLogFiles: z.number().int().positive().optional(),
    maxLogSize: z.number().int().positive().optional(),
}).strict();
export const PartialConfigSchema = z.object({
    version: z.string().optional(),
    languages: z.record(z.string(), LanguageConfigSchema.partial()).optional(),
    search: PartialSearchConfigSchema.optional(),
    indexing: PartialIndexingConfigSchema.optional(),
    database: PartialDatabaseConfigSchema.optional(),
    performance: PartialPerformanceConfigSchema.optional(),
    logging: PartialLoggingConfigSchema.optional(),
}).strict();
/**
 * Configuration source types
 */
export var ConfigSource;
(function (ConfigSource) {
    ConfigSource["DEFAULT"] = "default";
    ConfigSource["GLOBAL"] = "global";
    ConfigSource["PROJECT"] = "project";
    ConfigSource["ENV"] = "env";
    ConfigSource["RUNTIME"] = "runtime";
})(ConfigSource || (ConfigSource = {}));
//# sourceMappingURL=Config.js.map