/**
 * Config.ts
 *
 * Configuration types and Zod schemas for AutomatosX
 */
import { z } from 'zod';
/**
 * Zod schema for language-specific configuration
 */
export declare const LanguageConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    extensions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    excludePatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
    maxFileSize: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type LanguageConfig = z.infer<typeof LanguageConfigSchema>;
/**
 * Zod schema for search configuration
 */
export declare const SearchConfigSchema: z.ZodObject<{
    defaultLimit: z.ZodDefault<z.ZodNumber>;
    maxLimit: z.ZodDefault<z.ZodNumber>;
    enableSymbolSearch: z.ZodDefault<z.ZodBoolean>;
    enableNaturalSearch: z.ZodDefault<z.ZodBoolean>;
    enableHybridSearch: z.ZodDefault<z.ZodBoolean>;
    symbolMatchThreshold: z.ZodDefault<z.ZodNumber>;
    hybridSymbolWeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
/**
 * Zod schema for indexing configuration
 */
export declare const IndexingConfigSchema: z.ZodObject<{
    chunkSize: z.ZodDefault<z.ZodNumber>;
    chunkOverlap: z.ZodDefault<z.ZodNumber>;
    maxFileSize: z.ZodDefault<z.ZodNumber>;
    excludePatterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    includePatterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    followSymlinks: z.ZodDefault<z.ZodBoolean>;
    respectGitignore: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type IndexingConfig = z.infer<typeof IndexingConfigSchema>;
/**
 * Zod schema for database configuration
 */
export declare const DatabaseConfigSchema: z.ZodObject<{
    path: z.ZodDefault<z.ZodString>;
    inMemory: z.ZodDefault<z.ZodBoolean>;
    wal: z.ZodDefault<z.ZodBoolean>;
    busyTimeout: z.ZodDefault<z.ZodNumber>;
    cacheSize: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
/**
 * Zod schema for performance configuration
 */
export declare const PerformanceConfigSchema: z.ZodObject<{
    enableCache: z.ZodDefault<z.ZodBoolean>;
    cacheMaxSize: z.ZodDefault<z.ZodNumber>;
    cacheTTL: z.ZodDefault<z.ZodNumber>;
    batchSize: z.ZodDefault<z.ZodNumber>;
    maxConcurrency: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
/**
 * Zod schema for logging configuration
 */
export declare const LoggingConfigSchema: z.ZodObject<{
    level: z.ZodDefault<z.ZodEnum<{
        error: "error";
        info: "info";
        debug: "debug";
        warn: "warn";
    }>>;
    enableFileLogging: z.ZodDefault<z.ZodBoolean>;
    logFilePath: z.ZodDefault<z.ZodString>;
    maxLogFiles: z.ZodDefault<z.ZodNumber>;
    maxLogSize: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
/**
 * Main configuration schema with all subsections
 */
export declare const AutomatosXConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodString>;
    languages: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        extensions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        excludePatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxFileSize: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    search: z.ZodObject<{
        defaultLimit: z.ZodDefault<z.ZodNumber>;
        maxLimit: z.ZodDefault<z.ZodNumber>;
        enableSymbolSearch: z.ZodDefault<z.ZodBoolean>;
        enableNaturalSearch: z.ZodDefault<z.ZodBoolean>;
        enableHybridSearch: z.ZodDefault<z.ZodBoolean>;
        symbolMatchThreshold: z.ZodDefault<z.ZodNumber>;
        hybridSymbolWeight: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
    indexing: z.ZodObject<{
        chunkSize: z.ZodDefault<z.ZodNumber>;
        chunkOverlap: z.ZodDefault<z.ZodNumber>;
        maxFileSize: z.ZodDefault<z.ZodNumber>;
        excludePatterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        includePatterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        followSymlinks: z.ZodDefault<z.ZodBoolean>;
        respectGitignore: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>;
    database: z.ZodObject<{
        path: z.ZodDefault<z.ZodString>;
        inMemory: z.ZodDefault<z.ZodBoolean>;
        wal: z.ZodDefault<z.ZodBoolean>;
        busyTimeout: z.ZodDefault<z.ZodNumber>;
        cacheSize: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
    performance: z.ZodObject<{
        enableCache: z.ZodDefault<z.ZodBoolean>;
        cacheMaxSize: z.ZodDefault<z.ZodNumber>;
        cacheTTL: z.ZodDefault<z.ZodNumber>;
        batchSize: z.ZodDefault<z.ZodNumber>;
        maxConcurrency: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
    logging: z.ZodObject<{
        level: z.ZodDefault<z.ZodEnum<{
            error: "error";
            info: "info";
            debug: "debug";
            warn: "warn";
        }>>;
        enableFileLogging: z.ZodDefault<z.ZodBoolean>;
        logFilePath: z.ZodDefault<z.ZodString>;
        maxLogFiles: z.ZodDefault<z.ZodNumber>;
        maxLogSize: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type AutomatosXConfig = z.infer<typeof AutomatosXConfigSchema>;
export declare const PartialConfigSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodString>;
    languages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        extensions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        excludePatterns: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        maxFileSize: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>>;
    search: z.ZodOptional<z.ZodObject<{
        defaultLimit: z.ZodOptional<z.ZodNumber>;
        maxLimit: z.ZodOptional<z.ZodNumber>;
        enableSymbolSearch: z.ZodOptional<z.ZodBoolean>;
        enableNaturalSearch: z.ZodOptional<z.ZodBoolean>;
        enableHybridSearch: z.ZodOptional<z.ZodBoolean>;
        symbolMatchThreshold: z.ZodOptional<z.ZodNumber>;
        hybridSymbolWeight: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    indexing: z.ZodOptional<z.ZodObject<{
        chunkSize: z.ZodOptional<z.ZodNumber>;
        chunkOverlap: z.ZodOptional<z.ZodNumber>;
        maxFileSize: z.ZodOptional<z.ZodNumber>;
        excludePatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
        includePatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
        followSymlinks: z.ZodOptional<z.ZodBoolean>;
        respectGitignore: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    database: z.ZodOptional<z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        inMemory: z.ZodOptional<z.ZodBoolean>;
        wal: z.ZodOptional<z.ZodBoolean>;
        busyTimeout: z.ZodOptional<z.ZodNumber>;
        cacheSize: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    performance: z.ZodOptional<z.ZodObject<{
        enableCache: z.ZodOptional<z.ZodBoolean>;
        cacheMaxSize: z.ZodOptional<z.ZodNumber>;
        cacheTTL: z.ZodOptional<z.ZodNumber>;
        batchSize: z.ZodOptional<z.ZodNumber>;
        maxConcurrency: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    logging: z.ZodOptional<z.ZodObject<{
        level: z.ZodOptional<z.ZodEnum<{
            error: "error";
            info: "info";
            debug: "debug";
            warn: "warn";
        }>>;
        enableFileLogging: z.ZodOptional<z.ZodBoolean>;
        logFilePath: z.ZodOptional<z.ZodString>;
        maxLogFiles: z.ZodOptional<z.ZodNumber>;
        maxLogSize: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PartialConfig = z.infer<typeof PartialConfigSchema>;
/**
 * Configuration source types
 */
export declare enum ConfigSource {
    DEFAULT = "default",
    GLOBAL = "global",
    PROJECT = "project",
    ENV = "env",
    RUNTIME = "runtime"
}
/**
 * Configuration with metadata
 */
export interface ConfigWithMetadata {
    config: AutomatosXConfig;
    sources: Map<string, ConfigSource>;
    mergedFrom: ConfigSource[];
}
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors?: z.ZodError;
    config?: AutomatosXConfig;
}
//# sourceMappingURL=Config.d.ts.map