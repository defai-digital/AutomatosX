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
    extensions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    excludePatterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxFileSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    extensions?: string[] | undefined;
    excludePatterns?: string[] | undefined;
    maxFileSize?: number | undefined;
}, {
    enabled?: boolean | undefined;
    extensions?: string[] | undefined;
    excludePatterns?: string[] | undefined;
    maxFileSize?: number | undefined;
}>;
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
}, "strip", z.ZodTypeAny, {
    defaultLimit: number;
    maxLimit: number;
    enableSymbolSearch: boolean;
    enableNaturalSearch: boolean;
    enableHybridSearch: boolean;
    symbolMatchThreshold: number;
    hybridSymbolWeight: number;
}, {
    defaultLimit?: number | undefined;
    maxLimit?: number | undefined;
    enableSymbolSearch?: boolean | undefined;
    enableNaturalSearch?: boolean | undefined;
    enableHybridSearch?: boolean | undefined;
    symbolMatchThreshold?: number | undefined;
    hybridSymbolWeight?: number | undefined;
}>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
/**
 * Zod schema for indexing configuration
 */
export declare const IndexingConfigSchema: z.ZodObject<{
    chunkSize: z.ZodDefault<z.ZodNumber>;
    chunkOverlap: z.ZodDefault<z.ZodNumber>;
    maxFileSize: z.ZodDefault<z.ZodNumber>;
    excludePatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    includePatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    followSymlinks: z.ZodDefault<z.ZodBoolean>;
    respectGitignore: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    followSymlinks: boolean;
    excludePatterns: string[];
    maxFileSize: number;
    chunkSize: number;
    chunkOverlap: number;
    includePatterns: string[];
    respectGitignore: boolean;
}, {
    followSymlinks?: boolean | undefined;
    excludePatterns?: string[] | undefined;
    maxFileSize?: number | undefined;
    chunkSize?: number | undefined;
    chunkOverlap?: number | undefined;
    includePatterns?: string[] | undefined;
    respectGitignore?: boolean | undefined;
}>;
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
}, "strip", z.ZodTypeAny, {
    path: string;
    inMemory: boolean;
    wal: boolean;
    busyTimeout: number;
    cacheSize: number;
}, {
    path?: string | undefined;
    inMemory?: boolean | undefined;
    wal?: boolean | undefined;
    busyTimeout?: number | undefined;
    cacheSize?: number | undefined;
}>;
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
}, "strip", z.ZodTypeAny, {
    enableCache: boolean;
    cacheMaxSize: number;
    cacheTTL: number;
    batchSize: number;
    maxConcurrency: number;
}, {
    enableCache?: boolean | undefined;
    cacheMaxSize?: number | undefined;
    cacheTTL?: number | undefined;
    batchSize?: number | undefined;
    maxConcurrency?: number | undefined;
}>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
/**
 * Zod schema for logging configuration
 */
export declare const LoggingConfigSchema: z.ZodObject<{
    level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    enableFileLogging: z.ZodDefault<z.ZodBoolean>;
    logFilePath: z.ZodDefault<z.ZodString>;
    maxLogFiles: z.ZodDefault<z.ZodNumber>;
    maxLogSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    level: "error" | "info" | "debug" | "warn";
    enableFileLogging: boolean;
    logFilePath: string;
    maxLogFiles: number;
    maxLogSize: number;
}, {
    level?: "error" | "info" | "debug" | "warn" | undefined;
    enableFileLogging?: boolean | undefined;
    logFilePath?: string | undefined;
    maxLogFiles?: number | undefined;
    maxLogSize?: number | undefined;
}>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
/**
 * Main configuration schema with all subsections
 */
export declare const AutomatosXConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodString>;
    languages: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        extensions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        excludePatterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        maxFileSize: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }, {
        enabled?: boolean | undefined;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }>>>;
    search: z.ZodObject<{
        defaultLimit: z.ZodDefault<z.ZodNumber>;
        maxLimit: z.ZodDefault<z.ZodNumber>;
        enableSymbolSearch: z.ZodDefault<z.ZodBoolean>;
        enableNaturalSearch: z.ZodDefault<z.ZodBoolean>;
        enableHybridSearch: z.ZodDefault<z.ZodBoolean>;
        symbolMatchThreshold: z.ZodDefault<z.ZodNumber>;
        hybridSymbolWeight: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        defaultLimit: number;
        maxLimit: number;
        enableSymbolSearch: boolean;
        enableNaturalSearch: boolean;
        enableHybridSearch: boolean;
        symbolMatchThreshold: number;
        hybridSymbolWeight: number;
    }, {
        defaultLimit?: number | undefined;
        maxLimit?: number | undefined;
        enableSymbolSearch?: boolean | undefined;
        enableNaturalSearch?: boolean | undefined;
        enableHybridSearch?: boolean | undefined;
        symbolMatchThreshold?: number | undefined;
        hybridSymbolWeight?: number | undefined;
    }>;
    indexing: z.ZodObject<{
        chunkSize: z.ZodDefault<z.ZodNumber>;
        chunkOverlap: z.ZodDefault<z.ZodNumber>;
        maxFileSize: z.ZodDefault<z.ZodNumber>;
        excludePatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        includePatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        followSymlinks: z.ZodDefault<z.ZodBoolean>;
        respectGitignore: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        followSymlinks: boolean;
        excludePatterns: string[];
        maxFileSize: number;
        chunkSize: number;
        chunkOverlap: number;
        includePatterns: string[];
        respectGitignore: boolean;
    }, {
        followSymlinks?: boolean | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
        chunkSize?: number | undefined;
        chunkOverlap?: number | undefined;
        includePatterns?: string[] | undefined;
        respectGitignore?: boolean | undefined;
    }>;
    database: z.ZodObject<{
        path: z.ZodDefault<z.ZodString>;
        inMemory: z.ZodDefault<z.ZodBoolean>;
        wal: z.ZodDefault<z.ZodBoolean>;
        busyTimeout: z.ZodDefault<z.ZodNumber>;
        cacheSize: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        inMemory: boolean;
        wal: boolean;
        busyTimeout: number;
        cacheSize: number;
    }, {
        path?: string | undefined;
        inMemory?: boolean | undefined;
        wal?: boolean | undefined;
        busyTimeout?: number | undefined;
        cacheSize?: number | undefined;
    }>;
    performance: z.ZodObject<{
        enableCache: z.ZodDefault<z.ZodBoolean>;
        cacheMaxSize: z.ZodDefault<z.ZodNumber>;
        cacheTTL: z.ZodDefault<z.ZodNumber>;
        batchSize: z.ZodDefault<z.ZodNumber>;
        maxConcurrency: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enableCache: boolean;
        cacheMaxSize: number;
        cacheTTL: number;
        batchSize: number;
        maxConcurrency: number;
    }, {
        enableCache?: boolean | undefined;
        cacheMaxSize?: number | undefined;
        cacheTTL?: number | undefined;
        batchSize?: number | undefined;
        maxConcurrency?: number | undefined;
    }>;
    logging: z.ZodObject<{
        level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
        enableFileLogging: z.ZodDefault<z.ZodBoolean>;
        logFilePath: z.ZodDefault<z.ZodString>;
        maxLogFiles: z.ZodDefault<z.ZodNumber>;
        maxLogSize: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        level: "error" | "info" | "debug" | "warn";
        enableFileLogging: boolean;
        logFilePath: string;
        maxLogFiles: number;
        maxLogSize: number;
    }, {
        level?: "error" | "info" | "debug" | "warn" | undefined;
        enableFileLogging?: boolean | undefined;
        logFilePath?: string | undefined;
        maxLogFiles?: number | undefined;
        maxLogSize?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    version: string;
    search: {
        defaultLimit: number;
        maxLimit: number;
        enableSymbolSearch: boolean;
        enableNaturalSearch: boolean;
        enableHybridSearch: boolean;
        symbolMatchThreshold: number;
        hybridSymbolWeight: number;
    };
    database: {
        path: string;
        inMemory: boolean;
        wal: boolean;
        busyTimeout: number;
        cacheSize: number;
    };
    performance: {
        enableCache: boolean;
        cacheMaxSize: number;
        cacheTTL: number;
        batchSize: number;
        maxConcurrency: number;
    };
    logging: {
        level: "error" | "info" | "debug" | "warn";
        enableFileLogging: boolean;
        logFilePath: string;
        maxLogFiles: number;
        maxLogSize: number;
    };
    languages: Record<string, {
        enabled: boolean;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }>;
    indexing: {
        followSymlinks: boolean;
        excludePatterns: string[];
        maxFileSize: number;
        chunkSize: number;
        chunkOverlap: number;
        includePatterns: string[];
        respectGitignore: boolean;
    };
}, {
    search: {
        defaultLimit?: number | undefined;
        maxLimit?: number | undefined;
        enableSymbolSearch?: boolean | undefined;
        enableNaturalSearch?: boolean | undefined;
        enableHybridSearch?: boolean | undefined;
        symbolMatchThreshold?: number | undefined;
        hybridSymbolWeight?: number | undefined;
    };
    database: {
        path?: string | undefined;
        inMemory?: boolean | undefined;
        wal?: boolean | undefined;
        busyTimeout?: number | undefined;
        cacheSize?: number | undefined;
    };
    performance: {
        enableCache?: boolean | undefined;
        cacheMaxSize?: number | undefined;
        cacheTTL?: number | undefined;
        batchSize?: number | undefined;
        maxConcurrency?: number | undefined;
    };
    logging: {
        level?: "error" | "info" | "debug" | "warn" | undefined;
        enableFileLogging?: boolean | undefined;
        logFilePath?: string | undefined;
        maxLogFiles?: number | undefined;
        maxLogSize?: number | undefined;
    };
    indexing: {
        followSymlinks?: boolean | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
        chunkSize?: number | undefined;
        chunkOverlap?: number | undefined;
        includePatterns?: string[] | undefined;
        respectGitignore?: boolean | undefined;
    };
    version?: string | undefined;
    languages?: Record<string, {
        enabled?: boolean | undefined;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }> | undefined;
}>;
export type AutomatosXConfig = z.infer<typeof AutomatosXConfigSchema>;
export declare const PartialConfigSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodString>;
    languages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        extensions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        excludePatterns: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        maxFileSize: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }, {
        enabled?: boolean | undefined;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }>>>;
    search: z.ZodOptional<z.ZodObject<{
        defaultLimit: z.ZodOptional<z.ZodNumber>;
        maxLimit: z.ZodOptional<z.ZodNumber>;
        enableSymbolSearch: z.ZodOptional<z.ZodBoolean>;
        enableNaturalSearch: z.ZodOptional<z.ZodBoolean>;
        enableHybridSearch: z.ZodOptional<z.ZodBoolean>;
        symbolMatchThreshold: z.ZodOptional<z.ZodNumber>;
        hybridSymbolWeight: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        defaultLimit?: number | undefined;
        maxLimit?: number | undefined;
        enableSymbolSearch?: boolean | undefined;
        enableNaturalSearch?: boolean | undefined;
        enableHybridSearch?: boolean | undefined;
        symbolMatchThreshold?: number | undefined;
        hybridSymbolWeight?: number | undefined;
    }, {
        defaultLimit?: number | undefined;
        maxLimit?: number | undefined;
        enableSymbolSearch?: boolean | undefined;
        enableNaturalSearch?: boolean | undefined;
        enableHybridSearch?: boolean | undefined;
        symbolMatchThreshold?: number | undefined;
        hybridSymbolWeight?: number | undefined;
    }>>;
    indexing: z.ZodOptional<z.ZodObject<{
        chunkSize: z.ZodOptional<z.ZodNumber>;
        chunkOverlap: z.ZodOptional<z.ZodNumber>;
        maxFileSize: z.ZodOptional<z.ZodNumber>;
        excludePatterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        includePatterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        followSymlinks: z.ZodOptional<z.ZodBoolean>;
        respectGitignore: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        followSymlinks?: boolean | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
        chunkSize?: number | undefined;
        chunkOverlap?: number | undefined;
        includePatterns?: string[] | undefined;
        respectGitignore?: boolean | undefined;
    }, {
        followSymlinks?: boolean | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
        chunkSize?: number | undefined;
        chunkOverlap?: number | undefined;
        includePatterns?: string[] | undefined;
        respectGitignore?: boolean | undefined;
    }>>;
    database: z.ZodOptional<z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        inMemory: z.ZodOptional<z.ZodBoolean>;
        wal: z.ZodOptional<z.ZodBoolean>;
        busyTimeout: z.ZodOptional<z.ZodNumber>;
        cacheSize: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        path?: string | undefined;
        inMemory?: boolean | undefined;
        wal?: boolean | undefined;
        busyTimeout?: number | undefined;
        cacheSize?: number | undefined;
    }, {
        path?: string | undefined;
        inMemory?: boolean | undefined;
        wal?: boolean | undefined;
        busyTimeout?: number | undefined;
        cacheSize?: number | undefined;
    }>>;
    performance: z.ZodOptional<z.ZodObject<{
        enableCache: z.ZodOptional<z.ZodBoolean>;
        cacheMaxSize: z.ZodOptional<z.ZodNumber>;
        cacheTTL: z.ZodOptional<z.ZodNumber>;
        batchSize: z.ZodOptional<z.ZodNumber>;
        maxConcurrency: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enableCache?: boolean | undefined;
        cacheMaxSize?: number | undefined;
        cacheTTL?: number | undefined;
        batchSize?: number | undefined;
        maxConcurrency?: number | undefined;
    }, {
        enableCache?: boolean | undefined;
        cacheMaxSize?: number | undefined;
        cacheTTL?: number | undefined;
        batchSize?: number | undefined;
        maxConcurrency?: number | undefined;
    }>>;
    logging: z.ZodOptional<z.ZodObject<{
        level: z.ZodOptional<z.ZodEnum<["debug", "info", "warn", "error"]>>;
        enableFileLogging: z.ZodOptional<z.ZodBoolean>;
        logFilePath: z.ZodOptional<z.ZodString>;
        maxLogFiles: z.ZodOptional<z.ZodNumber>;
        maxLogSize: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        level?: "error" | "info" | "debug" | "warn" | undefined;
        enableFileLogging?: boolean | undefined;
        logFilePath?: string | undefined;
        maxLogFiles?: number | undefined;
        maxLogSize?: number | undefined;
    }, {
        level?: "error" | "info" | "debug" | "warn" | undefined;
        enableFileLogging?: boolean | undefined;
        logFilePath?: string | undefined;
        maxLogFiles?: number | undefined;
        maxLogSize?: number | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    version?: string | undefined;
    search?: {
        defaultLimit?: number | undefined;
        maxLimit?: number | undefined;
        enableSymbolSearch?: boolean | undefined;
        enableNaturalSearch?: boolean | undefined;
        enableHybridSearch?: boolean | undefined;
        symbolMatchThreshold?: number | undefined;
        hybridSymbolWeight?: number | undefined;
    } | undefined;
    database?: {
        path?: string | undefined;
        inMemory?: boolean | undefined;
        wal?: boolean | undefined;
        busyTimeout?: number | undefined;
        cacheSize?: number | undefined;
    } | undefined;
    performance?: {
        enableCache?: boolean | undefined;
        cacheMaxSize?: number | undefined;
        cacheTTL?: number | undefined;
        batchSize?: number | undefined;
        maxConcurrency?: number | undefined;
    } | undefined;
    logging?: {
        level?: "error" | "info" | "debug" | "warn" | undefined;
        enableFileLogging?: boolean | undefined;
        logFilePath?: string | undefined;
        maxLogFiles?: number | undefined;
        maxLogSize?: number | undefined;
    } | undefined;
    languages?: Record<string, {
        enabled?: boolean | undefined;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }> | undefined;
    indexing?: {
        followSymlinks?: boolean | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
        chunkSize?: number | undefined;
        chunkOverlap?: number | undefined;
        includePatterns?: string[] | undefined;
        respectGitignore?: boolean | undefined;
    } | undefined;
}, {
    version?: string | undefined;
    search?: {
        defaultLimit?: number | undefined;
        maxLimit?: number | undefined;
        enableSymbolSearch?: boolean | undefined;
        enableNaturalSearch?: boolean | undefined;
        enableHybridSearch?: boolean | undefined;
        symbolMatchThreshold?: number | undefined;
        hybridSymbolWeight?: number | undefined;
    } | undefined;
    database?: {
        path?: string | undefined;
        inMemory?: boolean | undefined;
        wal?: boolean | undefined;
        busyTimeout?: number | undefined;
        cacheSize?: number | undefined;
    } | undefined;
    performance?: {
        enableCache?: boolean | undefined;
        cacheMaxSize?: number | undefined;
        cacheTTL?: number | undefined;
        batchSize?: number | undefined;
        maxConcurrency?: number | undefined;
    } | undefined;
    logging?: {
        level?: "error" | "info" | "debug" | "warn" | undefined;
        enableFileLogging?: boolean | undefined;
        logFilePath?: string | undefined;
        maxLogFiles?: number | undefined;
        maxLogSize?: number | undefined;
    } | undefined;
    languages?: Record<string, {
        enabled?: boolean | undefined;
        extensions?: string[] | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
    }> | undefined;
    indexing?: {
        followSymlinks?: boolean | undefined;
        excludePatterns?: string[] | undefined;
        maxFileSize?: number | undefined;
        chunkSize?: number | undefined;
        chunkOverlap?: number | undefined;
        includePatterns?: string[] | undefined;
        respectGitignore?: boolean | undefined;
    } | undefined;
}>;
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