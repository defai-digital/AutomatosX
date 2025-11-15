import { EventEmitter } from 'events';
import { MemoryCache } from './MemoryCache.js';
/**
 * Invalidation strategy type
 */
export type InvalidationStrategy = 'time-based' | 'event-based' | 'version-based' | 'tag-based' | 'pattern-based';
/**
 * Invalidation rule
 */
export interface InvalidationRule {
    strategy: InvalidationStrategy;
    target?: string | RegExp;
    tags?: string[];
    version?: number;
    ttl?: number;
}
/**
 * Cache invalidation event
 */
export interface InvalidationEvent {
    strategy: InvalidationStrategy;
    keysInvalidated: string[];
    reason: string;
    timestamp: number;
}
/**
 * Cache Invalidation Manager
 *
 * Manages cache invalidation with multiple strategies
 *
 * @example
 * ```typescript
 * const cache = new MemoryCache<QueryResult>()
 * const invalidation = new CacheInvalidationManager(cache)
 *
 * // Add invalidation rules
 * invalidation.addRule({
 *   strategy: 'event-based',
 *   target: 'memory:*',
 * })
 *
 * // Cache data with tags
 * cache.set('memory:search:auth', result, undefined, {
 *   tags: ['memory', 'auth']
 * })
 *
 * // Invalidate by event
 * invalidation.invalidateByEvent('memory-updated')
 *
 * // Invalidate by tag
 * invalidation.invalidateByTag('auth')
 * ```
 */
export declare class CacheInvalidationManager<T = any> extends EventEmitter {
    private cache;
    private rules;
    private keyTags;
    private keyVersions;
    private eventPatterns;
    private stats;
    constructor(cache: MemoryCache<T>);
    /**
     * Add invalidation rule
     */
    addRule(rule: InvalidationRule): string;
    /**
     * Remove invalidation rule
     */
    removeRule(ruleId: string): boolean;
    /**
     * Set cache entry with tags
     */
    setWithTags(key: string, value: T, tags: string[], ttl?: number): void;
    /**
     * Set cache entry with version
     */
    setWithVersion(key: string, value: T, version: number, ttl?: number): void;
    /**
     * Invalidate by event
     */
    invalidateByEvent(eventName: string, reason?: string): number;
    /**
     * Invalidate by tag
     */
    invalidateByTag(tag: string, reason?: string): number;
    /**
     * Invalidate by tags (any match)
     */
    invalidateByTags(tags: string[], reason?: string): number;
    /**
     * Invalidate by pattern
     */
    invalidateByPattern(pattern: string | RegExp, reason?: string): number;
    /**
     * Invalidate by version
     */
    invalidateByVersion(key: string, newVersion: number, reason?: string): boolean;
    /**
     * Invalidate all entries
     */
    invalidateAll(reason?: string): number;
    /**
     * Invalidate specific keys
     */
    private invalidateKeys;
    /**
     * Track invalidation statistics
     */
    private trackInvalidation;
    /**
     * Get invalidation statistics
     */
    getStats(): {
        totalInvalidations: number;
        invalidationsByStrategy: Record<InvalidationStrategy, number>;
        activeRules: number;
    };
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Get all rules
     */
    getRules(): Map<string, InvalidationRule>;
    /**
     * Check if key has tag
     */
    hasTag(key: string, tag: string): boolean;
    /**
     * Get tags for key
     */
    getTags(key: string): string[];
    /**
     * Get version for key
     */
    getVersion(key: string): number | undefined;
}
/**
 * Auto-invalidation decorator
 *
 * Automatically invalidates cache when function is called
 *
 * @example
 * ```typescript
 * class UserService {
 *   @autoInvalidate(invalidationManager, { tags: ['users'] })
 *   async updateUser(id: string, data: any) {
 *     // Update user
 *   }
 * }
 * ```
 */
export declare function autoInvalidate<T>(invalidation: CacheInvalidationManager<T>, options: {
    tags?: string[];
    pattern?: string | RegExp;
    reason?: string;
}): (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Create cache with invalidation
 */
export declare function createCacheWithInvalidation<T>(cacheOptions?: any): {
    cache: MemoryCache<T>;
    invalidation: CacheInvalidationManager<T>;
};
//# sourceMappingURL=CacheInvalidation.d.ts.map