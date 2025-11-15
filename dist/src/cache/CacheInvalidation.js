// Sprint 2 Day 18: Cache Invalidation Strategy
// Smart cache invalidation with multiple strategies
import { EventEmitter } from 'events';
import { MemoryCache } from './MemoryCache.js';
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
export class CacheInvalidationManager extends EventEmitter {
    cache;
    rules;
    keyTags;
    keyVersions;
    eventPatterns;
    stats;
    constructor(cache) {
        super();
        this.cache = cache;
        this.rules = new Map();
        this.keyTags = new Map();
        this.keyVersions = new Map();
        this.eventPatterns = new Map();
        this.stats = {
            totalInvalidations: 0,
            invalidationsByStrategy: new Map(),
        };
    }
    /**
     * Add invalidation rule
     */
    addRule(rule) {
        const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.rules.set(ruleId, rule);
        // Register event patterns
        if (rule.strategy === 'event-based' && rule.target) {
            // Fixed: Replace all asterisks, not just the first one
            const pattern = rule.target instanceof RegExp
                ? rule.target
                : new RegExp(rule.target.replace(/\*/g, '.*'));
            if (!this.eventPatterns.has('event-based')) {
                this.eventPatterns.set('event-based', []);
            }
            this.eventPatterns.get('event-based').push(pattern);
        }
        this.emit('rule-added', { ruleId, rule });
        return ruleId;
    }
    /**
     * Remove invalidation rule
     */
    removeRule(ruleId) {
        const removed = this.rules.delete(ruleId);
        if (removed) {
            this.emit('rule-removed', { ruleId });
        }
        return removed;
    }
    /**
     * Set cache entry with tags
     */
    setWithTags(key, value, tags, ttl) {
        this.cache.set(key, value, ttl);
        // Store tags for this key
        const tagSet = new Set(tags);
        this.keyTags.set(key, tagSet);
    }
    /**
     * Set cache entry with version
     */
    setWithVersion(key, value, version, ttl) {
        this.cache.set(key, value, ttl);
        this.keyVersions.set(key, version);
    }
    /**
     * Invalidate by event
     */
    invalidateByEvent(eventName, reason) {
        const keysToInvalidate = [];
        const patterns = this.eventPatterns.get('event-based') || [];
        for (const key of this.cache.keys()) {
            for (const pattern of patterns) {
                if (pattern.test(key)) {
                    keysToInvalidate.push(key);
                    break;
                }
            }
        }
        return this.invalidateKeys(keysToInvalidate, 'event-based', reason || eventName);
    }
    /**
     * Invalidate by tag
     */
    invalidateByTag(tag, reason) {
        const keysToInvalidate = [];
        for (const [key, tags] of this.keyTags.entries()) {
            if (tags.has(tag)) {
                keysToInvalidate.push(key);
            }
        }
        return this.invalidateKeys(keysToInvalidate, 'tag-based', reason || `tag:${tag}`);
    }
    /**
     * Invalidate by tags (any match)
     */
    invalidateByTags(tags, reason) {
        const keysToInvalidate = [];
        const tagSet = new Set(tags);
        for (const [key, keyTags] of this.keyTags.entries()) {
            for (const tag of keyTags) {
                if (tagSet.has(tag)) {
                    keysToInvalidate.push(key);
                    break;
                }
            }
        }
        return this.invalidateKeys(keysToInvalidate, 'tag-based', reason || `tags:${tags.join(',')}`);
    }
    /**
     * Invalidate by pattern
     */
    invalidateByPattern(pattern, reason) {
        const keysToInvalidate = [];
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                keysToInvalidate.push(key);
            }
        }
        return this.invalidateKeys(keysToInvalidate, 'pattern-based', reason || `pattern:${pattern}`);
    }
    /**
     * Invalidate by version
     */
    invalidateByVersion(key, newVersion, reason) {
        const currentVersion = this.keyVersions.get(key);
        if (currentVersion !== undefined && newVersion > currentVersion) {
            this.cache.delete(key);
            this.keyVersions.set(key, newVersion);
            this.keyTags.delete(key);
            this.trackInvalidation('version-based', 1);
            this.emit('invalidated', {
                strategy: 'version-based',
                keysInvalidated: [key],
                reason: reason || `version:${currentVersion}->${newVersion}`,
                timestamp: Date.now(),
            });
            return true;
        }
        return false;
    }
    /**
     * Invalidate all entries
     */
    invalidateAll(reason) {
        const count = this.cache.size();
        this.cache.clear();
        this.keyTags.clear();
        this.keyVersions.clear();
        this.trackInvalidation('event-based', count);
        this.emit('invalidated', {
            strategy: 'event-based',
            keysInvalidated: ['*'],
            reason: reason || 'invalidate-all',
            timestamp: Date.now(),
        });
        return count;
    }
    /**
     * Invalidate specific keys
     */
    invalidateKeys(keys, strategy, reason) {
        let count = 0;
        for (const key of keys) {
            if (this.cache.delete(key)) {
                this.keyTags.delete(key);
                this.keyVersions.delete(key);
                count++;
            }
        }
        if (count > 0) {
            this.trackInvalidation(strategy, count);
            this.emit('invalidated', {
                strategy,
                keysInvalidated: keys,
                reason,
                timestamp: Date.now(),
            });
        }
        return count;
    }
    /**
     * Track invalidation statistics
     */
    trackInvalidation(strategy, count) {
        this.stats.totalInvalidations += count;
        const current = this.stats.invalidationsByStrategy.get(strategy) || 0;
        this.stats.invalidationsByStrategy.set(strategy, current + count);
    }
    /**
     * Get invalidation statistics
     */
    getStats() {
        const invalidationsByStrategy = {};
        this.stats.invalidationsByStrategy.forEach((count, strategy) => {
            invalidationsByStrategy[strategy] = count;
        });
        return {
            totalInvalidations: this.stats.totalInvalidations,
            invalidationsByStrategy,
            activeRules: this.rules.size,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats.totalInvalidations = 0;
        this.stats.invalidationsByStrategy.clear();
    }
    /**
     * Get all rules
     */
    getRules() {
        return new Map(this.rules);
    }
    /**
     * Check if key has tag
     */
    hasTag(key, tag) {
        const tags = this.keyTags.get(key);
        return tags ? tags.has(tag) : false;
    }
    /**
     * Get tags for key
     */
    getTags(key) {
        const tags = this.keyTags.get(key);
        return tags ? Array.from(tags) : [];
    }
    /**
     * Get version for key
     */
    getVersion(key) {
        return this.keyVersions.get(key);
    }
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
export function autoInvalidate(invalidation, options) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const result = await originalMethod.apply(this, args);
            // Invalidate cache after successful execution
            if (options.tags) {
                invalidation.invalidateByTags(options.tags, options.reason);
            }
            if (options.pattern) {
                invalidation.invalidateByPattern(options.pattern, options.reason);
            }
            return result;
        };
        return descriptor;
    };
}
/**
 * Create cache with invalidation
 */
export function createCacheWithInvalidation(cacheOptions) {
    const cache = new MemoryCache(cacheOptions);
    const invalidation = new CacheInvalidationManager(cache);
    return { cache, invalidation };
}
//# sourceMappingURL=CacheInvalidation.js.map