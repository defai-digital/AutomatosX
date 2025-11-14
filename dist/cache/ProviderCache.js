/**
 * ProviderCache.ts
 *
 * Intelligent response caching service for AI provider requests.
 * Implements content-based and semantic caching with TTL management.
 *
 * Phase 3 Week 1 Day 1-2: Response Caching Layer
 */
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection.js';
/**
 * ProviderCache provides intelligent caching for AI provider responses
 */
export class ProviderCache {
    db;
    config;
    inMemoryCache;
    maxInMemorySize = 1000;
    constructor(config) {
        this.db = getDatabase();
        this.config = {
            enabled: config?.enabled ?? true,
            defaultTTL: config?.defaultTTL ?? 3600, // 1 hour
            maxCacheSize: config?.maxCacheSize ?? 10000,
            evictionPolicy: config?.evictionPolicy ?? 'lru',
            semanticThreshold: config?.semanticThreshold ?? 0.85,
        };
        this.inMemoryCache = new Map();
    }
    /**
     * Lookup a cached response
     */
    async lookup(request, options) {
        const opts = {
            useCache: options?.useCache ?? true,
            skipCache: options?.skipCache ?? false,
            semanticMatch: options?.semanticMatch ?? false,
        };
        // Skip cache if disabled or explicitly requested
        if (!this.config.enabled || opts.skipCache || !opts.useCache) {
            return { hit: false };
        }
        // Generate cache key
        const cacheKey = this.generateCacheKey(request);
        const requestHash = this.generateRequestHash(request);
        // Try in-memory cache first
        const memEntry = this.inMemoryCache.get(cacheKey);
        if (memEntry && !this.isExpired(memEntry)) {
            await this.recordHit(memEntry.id);
            return {
                hit: true,
                entry: memEntry,
                savedCost: memEntry.costSaved,
                savedTokens: memEntry.tokensUsed,
            };
        }
        // Try database cache
        const dbEntry = this.db
            .prepare(`SELECT * FROM provider_cache
         WHERE cache_key = ?
         AND expires_at > ?
         LIMIT 1`)
            .get(cacheKey, Date.now());
        if (dbEntry) {
            // Add to in-memory cache
            this.addToMemoryCache(cacheKey, dbEntry);
            await this.recordHit(dbEntry.id);
            return {
                hit: true,
                entry: dbEntry,
                savedCost: dbEntry.costSaved,
                savedTokens: dbEntry.tokensUsed,
            };
        }
        // Try semantic matching if enabled
        if (opts.semanticMatch) {
            const semanticResult = await this.semanticLookup(request, requestHash);
            if (semanticResult.hit) {
                return semanticResult;
            }
        }
        // Cache miss
        await this.recordMiss(request.provider || 'claude');
        return { hit: false };
    }
    /**
     * Store a response in cache
     */
    async store(request, response, options) {
        if (!this.config.enabled) {
            return;
        }
        const cacheKey = this.generateCacheKey(request);
        const requestHash = this.generateRequestHash(request);
        const now = Date.now();
        const ttl = options?.ttl ?? this.config.defaultTTL;
        const cost = options?.cost ?? this.estimateCost(response);
        const entry = {
            id: uuidv4(),
            cacheKey,
            requestHash,
            provider: response.provider,
            model: response.model,
            requestContent: this.normalizeRequest(request),
            responseContent: response.content,
            responseData: JSON.stringify(response),
            tokensUsed: response.tokens.total,
            costSaved: cost,
            hitCount: 0,
            ttlSeconds: ttl,
            expiresAt: now + ttl * 1000,
            createdAt: now,
            updatedAt: now,
        };
        // Check cache size and evict if necessary
        await this.ensureCacheSize();
        // Store in database
        this.db
            .prepare(`INSERT INTO provider_cache (
          id, cache_key, request_hash, provider, model,
          request_content, response_content, response_data,
          tokens_used, cost_saved, hit_count, ttl_seconds,
          expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          response_content = excluded.response_content,
          response_data = excluded.response_data,
          tokens_used = excluded.tokens_used,
          cost_saved = excluded.cost_saved,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at`)
            .run(entry.id, entry.cacheKey, entry.requestHash, entry.provider, entry.model, entry.requestContent, entry.responseContent, entry.responseData, entry.tokensUsed, entry.costSaved, entry.hitCount, entry.ttlSeconds, entry.expiresAt, entry.createdAt, entry.updatedAt);
        // Add to in-memory cache
        this.addToMemoryCache(cacheKey, entry);
    }
    /**
     * Invalidate cache entries
     */
    async invalidate(pattern) {
        let deleted = 0;
        if (pattern) {
            // Invalidate matching pattern
            const result = this.db
                .prepare('DELETE FROM provider_cache WHERE cache_key LIKE ?')
                .run(`%${pattern}%`);
            deleted = result.changes;
            // Clear from in-memory cache
            for (const [key] of this.inMemoryCache) {
                if (key.includes(pattern)) {
                    this.inMemoryCache.delete(key);
                }
            }
        }
        else {
            // Invalidate all
            const result = this.db.prepare('DELETE FROM provider_cache').run();
            deleted = result.changes;
            this.inMemoryCache.clear();
        }
        return deleted;
    }
    /**
     * Get cache metrics
     */
    async getMetrics() {
        const stats = this.db
            .prepare(`SELECT
          COUNT(*) as total_entries,
          SUM(hit_count) as total_hits,
          AVG(ttl_seconds) as avg_ttl,
          MIN(created_at) as oldest,
          MAX(created_at) as newest
         FROM provider_cache`)
            .get();
        const dailyStats = this.db
            .prepare(`SELECT
          SUM(cache_hits) as total_hits,
          SUM(cache_misses) as total_misses,
          SUM(total_requests) as total_requests,
          SUM(cost_saved) as total_cost_saved,
          SUM(tokens_saved) as total_tokens_saved
         FROM cache_stats`)
            .get();
        const totalRequests = dailyStats.total_requests || 0;
        const totalHits = dailyStats.total_hits || 0;
        const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
        return {
            totalEntries: stats.total_entries || 0,
            hitRate,
            totalHits: totalHits || 0,
            totalMisses: dailyStats.total_misses || 0,
            totalCostSaved: dailyStats.total_cost_saved || 0,
            totalTokensSaved: dailyStats.total_tokens_saved || 0,
            averageTTL: stats.avg_ttl || 0,
            oldestEntry: stats.oldest,
            newestEntry: stats.newest,
        };
    }
    /**
     * Get cache statistics by provider
     */
    async getStatsByProvider() {
        const results = this.db
            .prepare('SELECT * FROM cache_hit_rate_summary')
            .all();
        return results.map((row) => ({
            provider: row.provider,
            totalHits: row.total_hits,
            totalMisses: row.total_misses,
            totalRequests: row.total_requests,
            overallHitRate: row.overall_hit_rate,
            totalCostSaved: row.total_cost_saved,
            totalTokensSaved: row.total_tokens_saved,
        }));
    }
    /**
     * Get top cached responses
     */
    async getTopCached(limit = 10) {
        const results = this.db
            .prepare('SELECT * FROM top_cached_responses LIMIT ?')
            .all(limit);
        return results.map((row) => ({
            id: row.id,
            provider: row.provider,
            model: row.model,
            requestContent: row.request_content,
            hitCount: row.hit_count,
            costSaved: row.cost_saved,
            tokensUsed: row.tokens_used,
            createdAt: row.created_at,
            lastHitAt: row.last_hit_at,
        }));
    }
    /**
     * Clean up expired entries
     */
    async cleanup() {
        const result = this.db
            .prepare('DELETE FROM provider_cache WHERE expires_at < ?')
            .run(Date.now());
        // Clean up in-memory cache
        for (const [key, entry] of this.inMemoryCache) {
            if (this.isExpired(entry)) {
                this.inMemoryCache.delete(key);
            }
        }
        return result.changes;
    }
    /**
     * Update cache configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Update database configuration
        if (config.enabled !== undefined) {
            this.db
                .prepare('UPDATE cache_config SET value = ?, updated_at = ? WHERE key = ?')
                .run(config.enabled.toString(), Date.now(), 'enabled');
        }
        if (config.defaultTTL !== undefined) {
            this.db
                .prepare('UPDATE cache_config SET value = ?, updated_at = ? WHERE key = ?')
                .run(config.defaultTTL.toString(), Date.now(), 'default_ttl');
        }
        if (config.maxCacheSize !== undefined) {
            this.db
                .prepare('UPDATE cache_config SET value = ?, updated_at = ? WHERE key = ?')
                .run(config.maxCacheSize.toString(), Date.now(), 'max_cache_size');
        }
        if (config.evictionPolicy !== undefined) {
            this.db
                .prepare('UPDATE cache_config SET value = ?, updated_at = ? WHERE key = ?')
                .run(config.evictionPolicy, Date.now(), 'eviction_policy');
        }
    }
    /**
     * Private helper methods
     */
    generateCacheKey(request) {
        const normalized = this.normalizeRequest(request);
        const hash = createHash('sha256').update(normalized).digest('hex');
        return `${request.provider || 'claude'}:${hash.substring(0, 16)}`;
    }
    generateRequestHash(request) {
        const normalized = this.normalizeRequest(request);
        return createHash('sha256').update(normalized).digest('hex');
    }
    normalizeRequest(request) {
        // Normalize request for consistent hashing
        const normalized = {
            messages: request.messages.map((msg) => ({
                role: msg.role,
                content: msg.content.trim().toLowerCase(),
            })),
            temperature: request.temperature ?? 1.0,
            maxTokens: request.maxTokens ?? 1000,
            // topP, topK, stopSequences can affect responses but are often optional
        };
        return JSON.stringify(normalized);
    }
    async semanticLookup(request, requestHash) {
        // Simplified semantic matching (could be enhanced with embeddings)
        // For now, just check for similar request hashes
        const similar = this.db
            .prepare(`SELECT * FROM provider_cache
         WHERE request_hash LIKE ?
         AND expires_at > ?
         LIMIT 1`)
            .get(`${requestHash.substring(0, 32)}%`, Date.now());
        if (similar) {
            await this.recordHit(similar.id);
            return {
                hit: true,
                entry: similar,
                similarity: 0.9, // Placeholder
                savedCost: similar.costSaved,
                savedTokens: similar.tokensUsed,
            };
        }
        return { hit: false };
    }
    async recordHit(entryId) {
        const now = Date.now();
        this.db
            .prepare(`UPDATE provider_cache
         SET hit_count = hit_count + 1,
             last_hit_at = ?,
             updated_at = ?
         WHERE id = ?`)
            .run(now, now, entryId);
        // Update in-memory cache
        for (const [key, entry] of this.inMemoryCache) {
            if (entry.id === entryId) {
                entry.hitCount++;
                entry.lastHitAt = now;
                entry.updatedAt = now;
                break;
            }
        }
    }
    async recordMiss(provider) {
        const today = new Date().toISOString().split('T')[0];
        this.db
            .prepare(`INSERT INTO cache_stats (id, date, provider, cache_hits, cache_misses, total_requests, hit_rate, cost_saved, tokens_saved, created_at, updated_at)
         VALUES (?, ?, ?, 0, 1, 1, 0.0, 0.0, 0, ?, ?)
         ON CONFLICT(date, provider) DO UPDATE SET
           cache_misses = cache_misses + 1,
           total_requests = total_requests + 1,
           hit_rate = CAST(cache_hits AS REAL) / total_requests * 100,
           updated_at = ?`)
            .run(uuidv4(), today, provider, Date.now(), Date.now(), Date.now());
    }
    async ensureCacheSize() {
        const count = this.db
            .prepare('SELECT COUNT(*) as count FROM provider_cache')
            .get();
        if (count.count >= this.config.maxCacheSize) {
            const toEvict = count.count - this.config.maxCacheSize + 100; // Evict 100 extra
            if (this.config.evictionPolicy === 'lru') {
                // Evict least recently used
                this.db
                    .prepare(`DELETE FROM provider_cache
             WHERE id IN (
               SELECT id FROM provider_cache
               ORDER BY COALESCE(last_hit_at, created_at) ASC
               LIMIT ?
             )`)
                    .run(toEvict);
            }
            else if (this.config.evictionPolicy === 'lfu') {
                // Evict least frequently used
                this.db
                    .prepare(`DELETE FROM provider_cache
             WHERE id IN (
               SELECT id FROM provider_cache
               ORDER BY hit_count ASC
               LIMIT ?
             )`)
                    .run(toEvict);
            }
            else {
                // FIFO - evict oldest
                this.db
                    .prepare(`DELETE FROM provider_cache
             WHERE id IN (
               SELECT id FROM provider_cache
               ORDER BY created_at ASC
               LIMIT ?
             )`)
                    .run(toEvict);
            }
        }
    }
    addToMemoryCache(key, entry) {
        if (this.inMemoryCache.size >= this.maxInMemorySize) {
            // Remove oldest entry
            const firstKey = this.inMemoryCache.keys().next().value;
            this.inMemoryCache.delete(firstKey);
        }
        this.inMemoryCache.set(key, entry);
    }
    isExpired(entry) {
        return entry.expiresAt < Date.now();
    }
    estimateCost(response) {
        // Simplified cost estimation (provider-specific pricing in next implementation)
        const pricePerToken = {
            claude: 0.000015, // $15 per 1M tokens (average)
            gemini: 0.0000005, // $0.50 per 1M tokens
            openai: 0.00001, // $10 per 1M tokens (average)
        };
        const price = pricePerToken[response.provider] || 0.00001;
        return response.tokens.total * price;
    }
}
//# sourceMappingURL=ProviderCache.js.map