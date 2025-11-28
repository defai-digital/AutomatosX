import { z } from 'zod';

/**
 * Memory system schemas for AutomatosX
 * @module @ax/schemas/memory
 */

/**
 * Metadata associated with a memory entry
 */
declare const MemoryMetadataSchema: z.ZodObject<{
    /** Type of memory content */
    type: z.ZodEnum<["conversation", "code", "document", "task", "decision"]>;
    /** Source of the memory (agent, user, system) */
    source: z.ZodString;
    /** Agent ID that created this memory */
    agentId: z.ZodOptional<z.ZodString>;
    /** Session ID if part of a session */
    sessionId: z.ZodOptional<z.ZodString>;
    /** Tags for categorization */
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Importance score (0-1) */
    importance: z.ZodOptional<z.ZodNumber>;
    /** File path if memory relates to a file */
    filePath: z.ZodOptional<z.ZodString>;
    /** Language if code-related */
    language: z.ZodOptional<z.ZodString>;
    /** Custom metadata */
    custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: "code" | "conversation" | "document" | "task" | "decision";
    source: string;
    tags: string[];
    custom?: Record<string, unknown> | undefined;
    agentId?: string | undefined;
    sessionId?: string | undefined;
    importance?: number | undefined;
    filePath?: string | undefined;
    language?: string | undefined;
}, {
    type: "code" | "conversation" | "document" | "task" | "decision";
    source: string;
    custom?: Record<string, unknown> | undefined;
    agentId?: string | undefined;
    sessionId?: string | undefined;
    tags?: string[] | undefined;
    importance?: number | undefined;
    filePath?: string | undefined;
    language?: string | undefined;
}>;
type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;
/**
 * Complete memory entry
 */
declare const MemoryEntrySchema: z.ZodObject<{
    /** Unique identifier */
    id: z.ZodBranded<z.ZodNumber, "MemoryId">;
    /** Memory content */
    content: z.ZodString;
    /** Associated metadata */
    metadata: z.ZodObject<{
        /** Type of memory content */
        type: z.ZodEnum<["conversation", "code", "document", "task", "decision"]>;
        /** Source of the memory (agent, user, system) */
        source: z.ZodString;
        /** Agent ID that created this memory */
        agentId: z.ZodOptional<z.ZodString>;
        /** Session ID if part of a session */
        sessionId: z.ZodOptional<z.ZodString>;
        /** Tags for categorization */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Importance score (0-1) */
        importance: z.ZodOptional<z.ZodNumber>;
        /** File path if memory relates to a file */
        filePath: z.ZodOptional<z.ZodString>;
        /** Language if code-related */
        language: z.ZodOptional<z.ZodString>;
        /** Custom metadata */
        custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        tags: string[];
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    }, {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    }>;
    /** Creation timestamp */
    createdAt: z.ZodDate;
    /** Last accessed timestamp */
    lastAccessedAt: z.ZodOptional<z.ZodDate>;
    /** Number of times accessed */
    accessCount: z.ZodDefault<z.ZodNumber>;
    /** Relevance score from last search */
    score: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: number & z.BRAND<"MemoryId">;
    content: string;
    metadata: {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        tags: string[];
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    };
    createdAt: Date;
    accessCount: number;
    lastAccessedAt?: Date | undefined;
    score?: number | undefined;
}, {
    id: number;
    content: string;
    metadata: {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    };
    createdAt: Date;
    lastAccessedAt?: Date | undefined;
    accessCount?: number | undefined;
    score?: number | undefined;
}>;
type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
/**
 * Filter options for memory search
 */
declare const MemoryFilterSchema: z.ZodObject<{
    /** Filter by memory type */
    type: z.ZodOptional<z.ZodEnum<["conversation", "code", "document", "task", "decision"]>>;
    /** Filter by agent ID */
    agentId: z.ZodOptional<z.ZodString>;
    /** Filter by session ID */
    sessionId: z.ZodOptional<z.ZodString>;
    /** Filter by tags (any match) */
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Filter by tags (all must match) */
    tagsAll: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Filter by minimum importance */
    minImportance: z.ZodOptional<z.ZodNumber>;
    /** Filter by source */
    source: z.ZodOptional<z.ZodString>;
    /** Filter by date range - after */
    createdAfter: z.ZodOptional<z.ZodDate>;
    /** Filter by date range - before */
    createdBefore: z.ZodOptional<z.ZodDate>;
    /** Filter by minimum access count */
    minAccessCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
    source?: string | undefined;
    agentId?: string | undefined;
    sessionId?: string | undefined;
    tags?: string[] | undefined;
    tagsAll?: string[] | undefined;
    minImportance?: number | undefined;
    createdAfter?: Date | undefined;
    createdBefore?: Date | undefined;
    minAccessCount?: number | undefined;
}, {
    type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
    source?: string | undefined;
    agentId?: string | undefined;
    sessionId?: string | undefined;
    tags?: string[] | undefined;
    tagsAll?: string[] | undefined;
    minImportance?: number | undefined;
    createdAfter?: Date | undefined;
    createdBefore?: Date | undefined;
    minAccessCount?: number | undefined;
}>;
type MemoryFilter = z.infer<typeof MemoryFilterSchema>;
/**
 * Search options for memory queries
 */
declare const MemorySearchOptionsSchema: z.ZodObject<{
    /** Search query string */
    query: z.ZodString;
    /** Maximum results to return */
    limit: z.ZodDefault<z.ZodNumber>;
    /** Offset for pagination */
    offset: z.ZodDefault<z.ZodNumber>;
    /** Filter options */
    filter: z.ZodOptional<z.ZodObject<{
        /** Filter by memory type */
        type: z.ZodOptional<z.ZodEnum<["conversation", "code", "document", "task", "decision"]>>;
        /** Filter by agent ID */
        agentId: z.ZodOptional<z.ZodString>;
        /** Filter by session ID */
        sessionId: z.ZodOptional<z.ZodString>;
        /** Filter by tags (any match) */
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Filter by tags (all must match) */
        tagsAll: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Filter by minimum importance */
        minImportance: z.ZodOptional<z.ZodNumber>;
        /** Filter by source */
        source: z.ZodOptional<z.ZodString>;
        /** Filter by date range - after */
        createdAfter: z.ZodOptional<z.ZodDate>;
        /** Filter by date range - before */
        createdBefore: z.ZodOptional<z.ZodDate>;
        /** Filter by minimum access count */
        minAccessCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    }, {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    }>>;
    /** Sort by field */
    sortBy: z.ZodDefault<z.ZodEnum<["relevance", "created", "accessed", "importance"]>>;
    /** Sort direction */
    sortDirection: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    /** Include content in results */
    includeContent: z.ZodDefault<z.ZodBoolean>;
    /** Highlight matches in content */
    highlight: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
    offset: number;
    sortBy: "importance" | "relevance" | "created" | "accessed";
    sortDirection: "asc" | "desc";
    includeContent: boolean;
    highlight: boolean;
    filter?: {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    } | undefined;
}, {
    query: string;
    filter?: {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    } | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    sortBy?: "importance" | "relevance" | "created" | "accessed" | undefined;
    sortDirection?: "asc" | "desc" | undefined;
    includeContent?: boolean | undefined;
    highlight?: boolean | undefined;
}>;
type MemorySearchOptions = z.infer<typeof MemorySearchOptionsSchema>;
/**
 * Search result from memory query
 */
declare const MemorySearchResultSchema: z.ZodObject<{
    /** Matching entries */
    entries: z.ZodArray<z.ZodObject<{
        /** Unique identifier */
        id: z.ZodBranded<z.ZodNumber, "MemoryId">;
        /** Memory content */
        content: z.ZodString;
        /** Associated metadata */
        metadata: z.ZodObject<{
            /** Type of memory content */
            type: z.ZodEnum<["conversation", "code", "document", "task", "decision"]>;
            /** Source of the memory (agent, user, system) */
            source: z.ZodString;
            /** Agent ID that created this memory */
            agentId: z.ZodOptional<z.ZodString>;
            /** Session ID if part of a session */
            sessionId: z.ZodOptional<z.ZodString>;
            /** Tags for categorization */
            tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            /** Importance score (0-1) */
            importance: z.ZodOptional<z.ZodNumber>;
            /** File path if memory relates to a file */
            filePath: z.ZodOptional<z.ZodString>;
            /** Language if code-related */
            language: z.ZodOptional<z.ZodString>;
            /** Custom metadata */
            custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            tags: string[];
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        }, {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            tags?: string[] | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        }>;
        /** Creation timestamp */
        createdAt: z.ZodDate;
        /** Last accessed timestamp */
        lastAccessedAt: z.ZodOptional<z.ZodDate>;
        /** Number of times accessed */
        accessCount: z.ZodDefault<z.ZodNumber>;
        /** Relevance score from last search */
        score: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: number & z.BRAND<"MemoryId">;
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            tags: string[];
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
        createdAt: Date;
        accessCount: number;
        lastAccessedAt?: Date | undefined;
        score?: number | undefined;
    }, {
        id: number;
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            tags?: string[] | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
        createdAt: Date;
        lastAccessedAt?: Date | undefined;
        accessCount?: number | undefined;
        score?: number | undefined;
    }>, "many">;
    /** Total count (before pagination) */
    total: z.ZodNumber;
    /** Search duration in milliseconds */
    duration: z.ZodNumber;
    /** Query that was executed */
    query: z.ZodString;
    /** Whether more results exist */
    hasMore: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    entries: {
        id: number & z.BRAND<"MemoryId">;
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            tags: string[];
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
        createdAt: Date;
        accessCount: number;
        lastAccessedAt?: Date | undefined;
        score?: number | undefined;
    }[];
    total: number;
    query: string;
    duration: number;
    hasMore: boolean;
}, {
    entries: {
        id: number;
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            tags?: string[] | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
        createdAt: Date;
        lastAccessedAt?: Date | undefined;
        accessCount?: number | undefined;
        score?: number | undefined;
    }[];
    total: number;
    query: string;
    duration: number;
    hasMore: boolean;
}>;
type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;
/**
 * Input for adding a new memory entry
 */
declare const MemoryAddInputSchema: z.ZodObject<{
    /** Content to store */
    content: z.ZodString;
    /** Metadata for the entry */
    metadata: z.ZodObject<{
        /** Type of memory content */
        type: z.ZodEnum<["conversation", "code", "document", "task", "decision"]>;
        /** Source of the memory (agent, user, system) */
        source: z.ZodString;
        /** Agent ID that created this memory */
        agentId: z.ZodOptional<z.ZodString>;
        /** Session ID if part of a session */
        sessionId: z.ZodOptional<z.ZodString>;
        /** Tags for categorization */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Importance score (0-1) */
        importance: z.ZodOptional<z.ZodNumber>;
        /** File path if memory relates to a file */
        filePath: z.ZodOptional<z.ZodString>;
        /** Language if code-related */
        language: z.ZodOptional<z.ZodString>;
        /** Custom metadata */
        custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        tags: string[];
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    }, {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    content: string;
    metadata: {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        tags: string[];
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    };
}, {
    content: string;
    metadata: {
        type: "code" | "conversation" | "document" | "task" | "decision";
        source: string;
        custom?: Record<string, unknown> | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    };
}>;
type MemoryAddInput = z.infer<typeof MemoryAddInputSchema>;
/**
 * Input for updating a memory entry
 */
declare const MemoryUpdateInputSchema: z.ZodObject<{
    /** Entry ID to update */
    id: z.ZodBranded<z.ZodNumber, "MemoryId">;
    /** New content (optional) */
    content: z.ZodOptional<z.ZodString>;
    /** Updated metadata (merged with existing) */
    metadata: z.ZodOptional<z.ZodObject<{
        type: z.ZodOptional<z.ZodEnum<["conversation", "code", "document", "task", "decision"]>>;
        source: z.ZodOptional<z.ZodString>;
        agentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        sessionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        tags: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
        importance: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        filePath: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        language: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        custom: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        custom?: Record<string, unknown> | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    }, {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        custom?: Record<string, unknown> | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: number & z.BRAND<"MemoryId">;
    content?: string | undefined;
    metadata?: {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        custom?: Record<string, unknown> | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    } | undefined;
}, {
    id: number;
    content?: string | undefined;
    metadata?: {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        custom?: Record<string, unknown> | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        importance?: number | undefined;
        filePath?: string | undefined;
        language?: string | undefined;
    } | undefined;
}>;
type MemoryUpdateInput = z.infer<typeof MemoryUpdateInputSchema>;
/**
 * Bulk operation input
 */
declare const MemoryBulkAddInputSchema: z.ZodObject<{
    /** Entries to add */
    entries: z.ZodArray<z.ZodObject<{
        /** Content to store */
        content: z.ZodString;
        /** Metadata for the entry */
        metadata: z.ZodObject<{
            /** Type of memory content */
            type: z.ZodEnum<["conversation", "code", "document", "task", "decision"]>;
            /** Source of the memory (agent, user, system) */
            source: z.ZodString;
            /** Agent ID that created this memory */
            agentId: z.ZodOptional<z.ZodString>;
            /** Session ID if part of a session */
            sessionId: z.ZodOptional<z.ZodString>;
            /** Tags for categorization */
            tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            /** Importance score (0-1) */
            importance: z.ZodOptional<z.ZodNumber>;
            /** File path if memory relates to a file */
            filePath: z.ZodOptional<z.ZodString>;
            /** Language if code-related */
            language: z.ZodOptional<z.ZodString>;
            /** Custom metadata */
            custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            tags: string[];
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        }, {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            tags?: string[] | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            tags: string[];
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
    }, {
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            tags?: string[] | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            tags: string[];
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
    }[];
}, {
    entries: {
        content: string;
        metadata: {
            type: "code" | "conversation" | "document" | "task" | "decision";
            source: string;
            custom?: Record<string, unknown> | undefined;
            agentId?: string | undefined;
            sessionId?: string | undefined;
            tags?: string[] | undefined;
            importance?: number | undefined;
            filePath?: string | undefined;
            language?: string | undefined;
        };
    }[];
}>;
type MemoryBulkAddInput = z.infer<typeof MemoryBulkAddInputSchema>;
/**
 * Cleanup strategy options
 */
declare const CleanupStrategy: z.ZodEnum<["oldest", "least_accessed", "hybrid", "low_importance"]>;
type CleanupStrategy = z.infer<typeof CleanupStrategy>;
/**
 * Cleanup configuration
 */
declare const MemoryCleanupConfigSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    /** Whether automatic cleanup is enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Strategy for selecting entries to delete */
    strategy: z.ZodDefault<z.ZodEnum<["oldest", "least_accessed", "hybrid", "low_importance"]>>;
    /** Trigger cleanup when reaching this percentage of max entries */
    triggerThreshold: z.ZodDefault<z.ZodNumber>;
    /** Target percentage after cleanup */
    targetThreshold: z.ZodDefault<z.ZodNumber>;
    /** Minimum entries to delete per cleanup */
    minCleanupCount: z.ZodDefault<z.ZodNumber>;
    /** Maximum entries to delete per cleanup */
    maxCleanupCount: z.ZodDefault<z.ZodNumber>;
    /** Retention period in days */
    retentionDays: z.ZodDefault<z.ZodNumber>;
    /** Entries to always preserve (by tag) */
    preserveTags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    retentionDays: number;
    strategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
    triggerThreshold: number;
    targetThreshold: number;
    minCleanupCount: number;
    maxCleanupCount: number;
    preserveTags: string[];
}, {
    enabled?: boolean | undefined;
    retentionDays?: number | undefined;
    strategy?: "oldest" | "least_accessed" | "hybrid" | "low_importance" | undefined;
    triggerThreshold?: number | undefined;
    targetThreshold?: number | undefined;
    minCleanupCount?: number | undefined;
    maxCleanupCount?: number | undefined;
    preserveTags?: string[] | undefined;
}>, {
    enabled: boolean;
    retentionDays: number;
    strategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
    triggerThreshold: number;
    targetThreshold: number;
    minCleanupCount: number;
    maxCleanupCount: number;
    preserveTags: string[];
}, {
    enabled?: boolean | undefined;
    retentionDays?: number | undefined;
    strategy?: "oldest" | "least_accessed" | "hybrid" | "low_importance" | undefined;
    triggerThreshold?: number | undefined;
    targetThreshold?: number | undefined;
    minCleanupCount?: number | undefined;
    maxCleanupCount?: number | undefined;
    preserveTags?: string[] | undefined;
}>, {
    enabled: boolean;
    retentionDays: number;
    strategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
    triggerThreshold: number;
    targetThreshold: number;
    minCleanupCount: number;
    maxCleanupCount: number;
    preserveTags: string[];
}, {
    enabled?: boolean | undefined;
    retentionDays?: number | undefined;
    strategy?: "oldest" | "least_accessed" | "hybrid" | "low_importance" | undefined;
    triggerThreshold?: number | undefined;
    targetThreshold?: number | undefined;
    minCleanupCount?: number | undefined;
    maxCleanupCount?: number | undefined;
    preserveTags?: string[] | undefined;
}>;
type MemoryCleanupConfig = z.infer<typeof MemoryCleanupConfigSchema>;
/**
 * Cleanup result
 */
declare const MemoryCleanupResultSchema: z.ZodObject<{
    /** Number of entries deleted */
    deletedCount: z.ZodNumber;
    /** Strategy used */
    strategy: z.ZodEnum<["oldest", "least_accessed", "hybrid", "low_importance"]>;
    /** Duration in milliseconds */
    duration: z.ZodNumber;
    /** Entries before cleanup */
    entriesBefore: z.ZodNumber;
    /** Entries after cleanup */
    entriesAfter: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    duration: number;
    strategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
    deletedCount: number;
    entriesBefore: number;
    entriesAfter: number;
}, {
    duration: number;
    strategy: "oldest" | "least_accessed" | "hybrid" | "low_importance";
    deletedCount: number;
    entriesBefore: number;
    entriesAfter: number;
}>;
type MemoryCleanupResult = z.infer<typeof MemoryCleanupResultSchema>;
/**
 * Memory system statistics
 */
declare const MemoryStatsSchema: z.ZodObject<{
    /** Total number of entries */
    totalEntries: z.ZodNumber;
    /** Entries by type */
    entriesByType: z.ZodRecord<z.ZodEnum<["conversation", "code", "document", "task", "decision"]>, z.ZodNumber>;
    /** Database size in bytes */
    databaseSizeBytes: z.ZodNumber;
    /** Oldest entry date */
    oldestEntry: z.ZodOptional<z.ZodDate>;
    /** Newest entry date */
    newestEntry: z.ZodOptional<z.ZodDate>;
    /** Average content length */
    avgContentLength: z.ZodNumber;
    /** Total access count */
    totalAccessCount: z.ZodNumber;
    /** Top tags */
    topTags: z.ZodArray<z.ZodObject<{
        tag: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tag: string;
        count: number;
    }, {
        tag: string;
        count: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    totalEntries: number;
    entriesByType: Partial<Record<"code" | "conversation" | "document" | "task" | "decision", number>>;
    databaseSizeBytes: number;
    avgContentLength: number;
    totalAccessCount: number;
    topTags: {
        tag: string;
        count: number;
    }[];
    oldestEntry?: Date | undefined;
    newestEntry?: Date | undefined;
}, {
    totalEntries: number;
    entriesByType: Partial<Record<"code" | "conversation" | "document" | "task" | "decision", number>>;
    databaseSizeBytes: number;
    avgContentLength: number;
    totalAccessCount: number;
    topTags: {
        tag: string;
        count: number;
    }[];
    oldestEntry?: Date | undefined;
    newestEntry?: Date | undefined;
}>;
type MemoryStats = z.infer<typeof MemoryStatsSchema>;
/**
 * Export format options
 */
declare const ExportFormat: z.ZodEnum<["json", "jsonl", "csv"]>;
type ExportFormat = z.infer<typeof ExportFormat>;
/**
 * Export options
 */
declare const MemoryExportOptionsSchema: z.ZodObject<{
    /** Export format */
    format: z.ZodDefault<z.ZodEnum<["json", "jsonl", "csv"]>>;
    /** Filter to apply */
    filter: z.ZodOptional<z.ZodObject<{
        /** Filter by memory type */
        type: z.ZodOptional<z.ZodEnum<["conversation", "code", "document", "task", "decision"]>>;
        /** Filter by agent ID */
        agentId: z.ZodOptional<z.ZodString>;
        /** Filter by session ID */
        sessionId: z.ZodOptional<z.ZodString>;
        /** Filter by tags (any match) */
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Filter by tags (all must match) */
        tagsAll: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Filter by minimum importance */
        minImportance: z.ZodOptional<z.ZodNumber>;
        /** Filter by source */
        source: z.ZodOptional<z.ZodString>;
        /** Filter by date range - after */
        createdAfter: z.ZodOptional<z.ZodDate>;
        /** Filter by date range - before */
        createdBefore: z.ZodOptional<z.ZodDate>;
        /** Filter by minimum access count */
        minAccessCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    }, {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    }>>;
    /** Include metadata */
    includeMetadata: z.ZodDefault<z.ZodBoolean>;
    /** Compress output */
    compress: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    format: "json" | "jsonl" | "csv";
    includeMetadata: boolean;
    compress: boolean;
    filter?: {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    } | undefined;
}, {
    filter?: {
        type?: "code" | "conversation" | "document" | "task" | "decision" | undefined;
        source?: string | undefined;
        agentId?: string | undefined;
        sessionId?: string | undefined;
        tags?: string[] | undefined;
        tagsAll?: string[] | undefined;
        minImportance?: number | undefined;
        createdAfter?: Date | undefined;
        createdBefore?: Date | undefined;
        minAccessCount?: number | undefined;
    } | undefined;
    format?: "json" | "jsonl" | "csv" | undefined;
    includeMetadata?: boolean | undefined;
    compress?: boolean | undefined;
}>;
type MemoryExportOptions = z.infer<typeof MemoryExportOptionsSchema>;
/**
 * Import options
 */
declare const MemoryImportOptionsSchema: z.ZodObject<{
    /** How to handle duplicates */
    duplicateHandling: z.ZodDefault<z.ZodEnum<["skip", "replace", "merge"]>>;
    /** Validate entries before import */
    validate: z.ZodDefault<z.ZodBoolean>;
    /** Batch size for import */
    batchSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duplicateHandling: "skip" | "replace" | "merge";
    validate: boolean;
    batchSize: number;
}, {
    duplicateHandling?: "skip" | "replace" | "merge" | undefined;
    validate?: boolean | undefined;
    batchSize?: number | undefined;
}>;
type MemoryImportOptions = z.infer<typeof MemoryImportOptionsSchema>;
/**
 * Validate memory entry
 */
declare function validateMemoryEntry(data: unknown): MemoryEntry;
/**
 * Validate memory add input
 */
declare function validateMemoryAddInput(data: unknown): MemoryAddInput;
/**
 * Validate search options
 */
declare function validateSearchOptions(data: unknown): MemorySearchOptions;

export { CleanupStrategy, ExportFormat, type MemoryAddInput, MemoryAddInputSchema, type MemoryBulkAddInput, MemoryBulkAddInputSchema, type MemoryCleanupConfig, MemoryCleanupConfigSchema, type MemoryCleanupResult, MemoryCleanupResultSchema, type MemoryEntry, MemoryEntrySchema, type MemoryExportOptions, MemoryExportOptionsSchema, type MemoryFilter, MemoryFilterSchema, type MemoryImportOptions, MemoryImportOptionsSchema, type MemoryMetadata, MemoryMetadataSchema, type MemorySearchOptions, MemorySearchOptionsSchema, type MemorySearchResult, MemorySearchResultSchema, type MemoryStats, MemoryStatsSchema, type MemoryUpdateInput, MemoryUpdateInputSchema, validateMemoryAddInput, validateMemoryEntry, validateSearchOptions };
