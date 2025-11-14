/**
 * WorkflowCache.ts
 *
 * Multi-level caching system for workflow execution results
 * Phase 5 Week 1: Performance Optimization
 */
import { EventEmitter } from 'events';
import { WorkflowResult, WorkflowContext } from '../types/schemas/workflow.schema.js';
/**
 * Cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalEntries: number;
    totalSize: number;
    evictions: number;
    averageHitTime: number;
    averageMissTime: number;
}
/**
 * Cache configuration
 */
export interface CacheConfig {
    maxSize: number;
    maxEntries: number;
    ttl: number;
    evictionPolicy: 'lru' | 'lfu' | 'fifo';
    enableL2?: boolean;
}
/**
 * Cache invalidation strategy
 */
export declare enum InvalidationStrategy {
    TTL = "ttl",// Time-based expiration
    MANUAL = "manual",// Manual invalidation
    TAG_BASED = "tag_based",// Invalidate by tags
    DEPENDENCY = "dependency"
}
/**
 * WorkflowCache - Multi-level LRU cache with statistics
 */
export declare class WorkflowCache extends EventEmitter {
    private cache;
    private config;
    private stats;
    private accessOrder;
    private accessFrequency;
    constructor(config?: Partial<CacheConfig>);
    /**
     * Generate cache key from workflow definition and context
     */
    private generateKey;
    /**
     * Get cached workflow result
     */
    get(workflowName: string, context: WorkflowContext): WorkflowResult | null;
    /**
     * Set workflow result in cache
     */
    set(workflowName: string, context: WorkflowContext, result: WorkflowResult, options?: {
        ttl?: number;
        tags?: string[];
    }): void;
    /**
     * Check if eviction is needed
     */
    private shouldEvict;
    /**
     * Evict entry based on policy
     */
    private evict;
    /**
     * Evict least recently used entry
     */
    private evictLRU;
    /**
     * Evict least frequently used entry
     */
    private evictLFU;
    /**
     * Evict first in, first out
     */
    private evictFIFO;
    /**
     * Update access order for LRU
     */
    private updateAccessOrder;
    /**
     * Remove from access order
     */
    private removeFromAccessOrder;
    /**
     * Update access frequency for LFU
     */
    private updateAccessFrequency;
    /**
     * Estimate size of result in bytes
     */
    private estimateSize;
    /**
     * Update hit rate
     */
    private updateHitRate;
    /**
     * Invalidate cache entry
     */
    invalidate(workflowName: string, context: WorkflowContext): boolean;
    /**
     * Invalidate by tag
     */
    invalidateByTag(tag: string): number;
    /**
     * Invalidate all entries
     */
    invalidateAll(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get cache entries (for debugging)
     */
    getEntries(): Array<{
        key: string;
        size: number;
        hits: number;
        age: number;
        tags: string[];
    }>;
    /**
     * Start periodic cleanup
     */
    private startCleanup;
    /**
     * Clean up expired entries
     */
    private cleanup;
    /**
     * Warm cache with frequently used workflows
     */
    warm(workflows: Array<{
        name: string;
        context: WorkflowContext;
        result: WorkflowResult;
    }>): Promise<void>;
    /**
     * Export cache for persistence (future: Redis integration)
     */
    export(): Array<{
        key: string;
        value: WorkflowResult;
        metadata: any;
    }>;
    /**
     * Import cache from persistence
     */
    import(data: Array<{
        key: string;
        value: WorkflowResult;
        metadata: any;
    }>): number;
}
//# sourceMappingURL=WorkflowCache.d.ts.map