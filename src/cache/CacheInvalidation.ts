// Sprint 2 Day 18: Cache Invalidation Strategy
// Smart cache invalidation with multiple strategies

import { EventEmitter } from 'events'
import { MemoryCache } from './MemoryCache.js'

/**
 * Invalidation strategy type
 */
export type InvalidationStrategy =
  | 'time-based' // TTL expiration
  | 'event-based' // Explicit invalidation on events
  | 'version-based' // Version tracking
  | 'tag-based' // Tag-based invalidation
  | 'pattern-based' // Pattern matching

/**
 * Invalidation rule
 */
export interface InvalidationRule {
  strategy: InvalidationStrategy
  target?: string | RegExp
  tags?: string[]
  version?: number
  ttl?: number
}

/**
 * Cache invalidation event
 */
export interface InvalidationEvent {
  strategy: InvalidationStrategy
  keysInvalidated: string[]
  reason: string
  timestamp: number
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
export class CacheInvalidationManager<T = any> extends EventEmitter {
  private cache: MemoryCache<T>
  private rules: Map<string, InvalidationRule>
  private keyTags: Map<string, Set<string>>
  private keyVersions: Map<string, number>
  private eventPatterns: Map<string, RegExp[]>
  private stats: {
    totalInvalidations: number
    invalidationsByStrategy: Map<InvalidationStrategy, number>
  }

  constructor(cache: MemoryCache<T>) {
    super()
    this.cache = cache
    this.rules = new Map()
    this.keyTags = new Map()
    this.keyVersions = new Map()
    this.eventPatterns = new Map()
    this.stats = {
      totalInvalidations: 0,
      invalidationsByStrategy: new Map(),
    }
  }

  /**
   * Add invalidation rule
   */
  addRule(rule: InvalidationRule): string {
    const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.rules.set(ruleId, rule)

    // Register event patterns
    if (rule.strategy === 'event-based' && rule.target) {
      const pattern =
        rule.target instanceof RegExp
          ? rule.target
          : new RegExp(rule.target.replace('*', '.*'))

      if (!this.eventPatterns.has('event-based')) {
        this.eventPatterns.set('event-based', [])
      }
      this.eventPatterns.get('event-based')!.push(pattern)
    }

    this.emit('rule-added', { ruleId, rule })
    return ruleId
  }

  /**
   * Remove invalidation rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId)

    if (removed) {
      this.emit('rule-removed', { ruleId })
    }

    return removed
  }

  /**
   * Set cache entry with tags
   */
  setWithTags(key: string, value: T, tags: string[], ttl?: number): void {
    this.cache.set(key, value, ttl)

    // Store tags for this key
    const tagSet = new Set(tags)
    this.keyTags.set(key, tagSet)
  }

  /**
   * Set cache entry with version
   */
  setWithVersion(key: string, value: T, version: number, ttl?: number): void {
    this.cache.set(key, value, ttl)
    this.keyVersions.set(key, version)
  }

  /**
   * Invalidate by event
   */
  invalidateByEvent(eventName: string, reason?: string): number {
    const keysToInvalidate: string[] = []
    const patterns = this.eventPatterns.get('event-based') || []

    for (const key of this.cache.keys()) {
      for (const pattern of patterns) {
        if (pattern.test(key)) {
          keysToInvalidate.push(key)
          break
        }
      }
    }

    return this.invalidateKeys(keysToInvalidate, 'event-based', reason || eventName)
  }

  /**
   * Invalidate by tag
   */
  invalidateByTag(tag: string, reason?: string): number {
    const keysToInvalidate: string[] = []

    for (const [key, tags] of this.keyTags.entries()) {
      if (tags.has(tag)) {
        keysToInvalidate.push(key)
      }
    }

    return this.invalidateKeys(keysToInvalidate, 'tag-based', reason || `tag:${tag}`)
  }

  /**
   * Invalidate by tags (any match)
   */
  invalidateByTags(tags: string[], reason?: string): number {
    const keysToInvalidate: string[] = []
    const tagSet = new Set(tags)

    for (const [key, keyTags] of this.keyTags.entries()) {
      for (const tag of keyTags) {
        if (tagSet.has(tag)) {
          keysToInvalidate.push(key)
          break
        }
      }
    }

    return this.invalidateKeys(
      keysToInvalidate,
      'tag-based',
      reason || `tags:${tags.join(',')}`
    )
  }

  /**
   * Invalidate by pattern
   */
  invalidateByPattern(pattern: string | RegExp, reason?: string): number {
    const keysToInvalidate: string[] = []
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToInvalidate.push(key)
      }
    }

    return this.invalidateKeys(
      keysToInvalidate,
      'pattern-based',
      reason || `pattern:${pattern}`
    )
  }

  /**
   * Invalidate by version
   */
  invalidateByVersion(key: string, newVersion: number, reason?: string): boolean {
    const currentVersion = this.keyVersions.get(key)

    if (currentVersion !== undefined && newVersion > currentVersion) {
      this.cache.delete(key)
      this.keyVersions.set(key, newVersion)
      this.keyTags.delete(key)

      this.trackInvalidation('version-based', 1)

      this.emit('invalidated', {
        strategy: 'version-based',
        keysInvalidated: [key],
        reason: reason || `version:${currentVersion}->${newVersion}`,
        timestamp: Date.now(),
      })

      return true
    }

    return false
  }

  /**
   * Invalidate all entries
   */
  invalidateAll(reason?: string): number {
    const count = this.cache.size()
    this.cache.clear()
    this.keyTags.clear()
    this.keyVersions.clear()

    this.trackInvalidation('event-based', count)

    this.emit('invalidated', {
      strategy: 'event-based',
      keysInvalidated: ['*'],
      reason: reason || 'invalidate-all',
      timestamp: Date.now(),
    })

    return count
  }

  /**
   * Invalidate specific keys
   */
  private invalidateKeys(
    keys: string[],
    strategy: InvalidationStrategy,
    reason: string
  ): number {
    let count = 0

    for (const key of keys) {
      if (this.cache.delete(key)) {
        this.keyTags.delete(key)
        this.keyVersions.delete(key)
        count++
      }
    }

    if (count > 0) {
      this.trackInvalidation(strategy, count)

      this.emit('invalidated', {
        strategy,
        keysInvalidated: keys,
        reason,
        timestamp: Date.now(),
      })
    }

    return count
  }

  /**
   * Track invalidation statistics
   */
  private trackInvalidation(strategy: InvalidationStrategy, count: number): void {
    this.stats.totalInvalidations += count

    const current = this.stats.invalidationsByStrategy.get(strategy) || 0
    this.stats.invalidationsByStrategy.set(strategy, current + count)
  }

  /**
   * Get invalidation statistics
   */
  getStats(): {
    totalInvalidations: number
    invalidationsByStrategy: Record<InvalidationStrategy, number>
    activeRules: number
  } {
    const invalidationsByStrategy = {} as Record<InvalidationStrategy, number>

    this.stats.invalidationsByStrategy.forEach((count, strategy) => {
      invalidationsByStrategy[strategy] = count
    })

    return {
      totalInvalidations: this.stats.totalInvalidations,
      invalidationsByStrategy,
      activeRules: this.rules.size,
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.totalInvalidations = 0
    this.stats.invalidationsByStrategy.clear()
  }

  /**
   * Get all rules
   */
  getRules(): Map<string, InvalidationRule> {
    return new Map(this.rules)
  }

  /**
   * Check if key has tag
   */
  hasTag(key: string, tag: string): boolean {
    const tags = this.keyTags.get(key)
    return tags ? tags.has(tag) : false
  }

  /**
   * Get tags for key
   */
  getTags(key: string): string[] {
    const tags = this.keyTags.get(key)
    return tags ? Array.from(tags) : []
  }

  /**
   * Get version for key
   */
  getVersion(key: string): number | undefined {
    return this.keyVersions.get(key)
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
export function autoInvalidate<T>(
  invalidation: CacheInvalidationManager<T>,
  options: {
    tags?: string[]
    pattern?: string | RegExp
    reason?: string
  }
) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args)

      // Invalidate cache after successful execution
      if (options.tags) {
        invalidation.invalidateByTags(options.tags, options.reason)
      }

      if (options.pattern) {
        invalidation.invalidateByPattern(options.pattern, options.reason)
      }

      return result
    }

    return descriptor
  }
}

/**
 * Create cache with invalidation
 */
export function createCacheWithInvalidation<T>(
  cacheOptions?: any
): {
  cache: MemoryCache<T>
  invalidation: CacheInvalidationManager<T>
} {
  const cache = new MemoryCache<T>(cacheOptions)
  const invalidation = new CacheInvalidationManager<T>(cache)

  return { cache, invalidation }
}
