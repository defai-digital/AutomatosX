/**
 * ProviderRateLimiter.ts
 *
 * Advanced token bucket rate limiter for AI provider requests
 * Implements per-user, per-provider, per-IP, and global rate limiting
 *
 * Phase 3 Week 2 Day 8-9: Rate Limiting System
 */
import { getDatabase } from '../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
/**
 * ProviderRateLimiter - Advanced rate limiting for AI provider requests
 *
 * Features:
 * - Token bucket algorithm with configurable refill rates
 * - Per-user, per-provider, per-IP, and global rate limiting
 * - Custom user quotas
 * - Violation tracking
 * - Real-time statistics
 * - Configurable burst allowances
 */
export class ProviderRateLimiter {
    db;
    configs;
    cacheTTL = 60000; // 1 minute
    constructor() {
        this.db = getDatabase();
        this.configs = new Map();
        this.loadConfigs();
    }
    /**
     * Load rate limit configurations from database
     */
    loadConfigs() {
        const configs = this.db
            .prepare('SELECT * FROM rate_limit_configs WHERE enabled = 1')
            .all();
        configs.forEach(config => {
            this.configs.set(config.name, config);
        });
    }
    /**
     * Check if request is allowed under rate limit
     *
     * @param key - Identifier (user_id, ip, provider, 'global')
     * @param type - Type of rate limit to check
     * @param tokensRequested - Number of tokens to consume (default: 1)
     * @returns Rate limit result
     */
    async checkLimit(key, type = 'user', tokensRequested = 1) {
        // Get configuration for this type
        const config = this.getConfigForType(type);
        if (!config || !config.enabled) {
            return { allowed: true, remaining: Infinity };
        }
        // Get or create token bucket
        let bucket = await this.getBucket(key, type);
        if (!bucket) {
            bucket = await this.createBucket(key, type, config);
        }
        // Check for custom user quota
        if (type === 'user') {
            const userQuota = await this.getUserQuota(key);
            if (userQuota && userQuota.enabled) {
                return this.checkUserQuota(key, userQuota, tokensRequested);
            }
        }
        // Refill tokens based on elapsed time
        bucket = this.refillBucket(bucket, config);
        // Check if sufficient tokens available
        if (bucket.tokens >= tokensRequested) {
            // Consume tokens
            bucket.tokens -= tokensRequested;
            await this.updateBucket(bucket);
            return {
                allowed: true,
                remaining: Math.floor(bucket.tokens),
                resetAt: this.calculateResetTime(bucket, config),
            };
        }
        else {
            // Rate limit exceeded - record violation
            await this.recordViolation(key, type, config.name, tokensRequested, bucket.tokens);
            return {
                allowed: false,
                remaining: 0,
                retryAfter: this.calculateRetryAfter(bucket, config, tokensRequested),
                resetAt: this.calculateResetTime(bucket, config),
            };
        }
    }
    /**
     * Get token bucket for key
     */
    async getBucket(key, type) {
        const result = this.db
            .prepare('SELECT * FROM rate_limit_buckets WHERE key = ? AND type = ?')
            .get(key, type);
        return result || null;
    }
    /**
     * Create new token bucket
     */
    async createBucket(key, type, config) {
        const now = Date.now();
        const maxTokens = config.maxRequests + config.burstSize;
        const refillRate = config.maxRequests / config.windowMs;
        const bucket = {
            id: uuidv4(),
            key,
            type,
            tokens: maxTokens,
            maxTokens,
            refillRate,
            lastRefill: now,
            createdAt: now,
            updatedAt: now,
        };
        this.db
            .prepare(`INSERT INTO rate_limit_buckets
        (id, key, type, tokens, max_tokens, refill_rate, last_refill, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(bucket.id, bucket.key, bucket.type, bucket.tokens, bucket.maxTokens, bucket.refillRate, bucket.lastRefill, bucket.createdAt, bucket.updatedAt);
        return bucket;
    }
    /**
     * Refill token bucket based on elapsed time
     */
    refillBucket(bucket, config) {
        const now = Date.now();
        const elapsed = now - bucket.lastRefill;
        // Calculate tokens to add
        const tokensToAdd = elapsed * bucket.refillRate;
        // Add tokens, but don't exceed max capacity
        bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
        bucket.updatedAt = now;
        return bucket;
    }
    /**
     * Update token bucket in database
     */
    async updateBucket(bucket) {
        this.db
            .prepare(`UPDATE rate_limit_buckets
        SET tokens = ?, last_refill = ?, updated_at = ?
        WHERE id = ?`)
            .run(bucket.tokens, bucket.lastRefill, bucket.updatedAt, bucket.id);
    }
    /**
     * Record rate limit violation
     */
    async recordViolation(key, type, configName, tokensRequested, tokensAvailable, metadata) {
        const violation = {
            id: uuidv4(),
            key,
            type,
            configName,
            violationTime: Date.now(),
            tokensRequested,
            tokensAvailable,
            metadata: metadata ? JSON.stringify(metadata) : null,
            createdAt: Date.now(),
        };
        this.db
            .prepare(`INSERT INTO rate_limit_violations
        (id, key, type, config_name, violation_time, tokens_requested, tokens_available, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(violation.id, violation.key, violation.type, violation.configName, violation.violationTime, violation.tokensRequested, violation.tokensAvailable, violation.metadata, violation.createdAt);
    }
    /**
     * Get configuration for rate limit type
     */
    getConfigForType(type) {
        const configNames = {
            user: 'per_user',
            provider: 'per_provider',
            ip: 'per_ip',
            global: 'global',
        };
        const configName = configNames[type];
        return this.configs.get(configName) || null;
    }
    /**
     * Calculate time until rate limit resets
     */
    calculateResetTime(bucket, config) {
        const timeToFull = (bucket.maxTokens - bucket.tokens) / bucket.refillRate;
        return Date.now() + Math.ceil(timeToFull);
    }
    /**
     * Calculate time until N tokens available
     */
    calculateRetryAfter(bucket, config, tokensNeeded) {
        const tokensDeficit = tokensNeeded - bucket.tokens;
        const timeNeeded = tokensDeficit / bucket.refillRate;
        return Math.ceil(timeNeeded);
    }
    /**
     * Get user quota
     */
    async getUserQuota(userId) {
        const result = this.db
            .prepare(`SELECT * FROM user_quotas
        WHERE user_id = ? AND enabled = 1
        AND (expires_at IS NULL OR expires_at > ?)`)
            .get(userId, Date.now());
        return result || null;
    }
    /**
     * Check user quota (custom per-user rate limit)
     */
    async checkUserQuota(userId, quota, tokensRequested) {
        // Create custom config for this user
        const customConfig = {
            id: quota.id,
            name: `user_${userId}`,
            description: 'Custom user quota',
            maxRequests: quota.maxRequests,
            windowMs: quota.windowMs,
            burstSize: quota.burstSize,
            enabled: quota.enabled,
            createdAt: quota.createdAt,
            updatedAt: quota.updatedAt,
        };
        // Get or create bucket for custom quota
        let bucket = await this.getBucket(userId, 'user');
        if (!bucket) {
            bucket = await this.createBucket(userId, 'user', customConfig);
        }
        // Refill and check
        bucket = this.refillBucket(bucket, customConfig);
        if (bucket.tokens >= tokensRequested) {
            bucket.tokens -= tokensRequested;
            await this.updateBucket(bucket);
            return {
                allowed: true,
                remaining: Math.floor(bucket.tokens),
                resetAt: this.calculateResetTime(bucket, customConfig),
            };
        }
        else {
            await this.recordViolation(userId, 'user', customConfig.name, tokensRequested, bucket.tokens, { customQuota: true });
            return {
                allowed: false,
                remaining: 0,
                retryAfter: this.calculateRetryAfter(bucket, customConfig, tokensRequested),
                resetAt: this.calculateResetTime(bucket, customConfig),
            };
        }
    }
    /**
     * Set custom user quota
     */
    async setUserQuota(userId, maxRequests, windowMs, burstSize = 0, expiresAt) {
        const now = Date.now();
        const quota = {
            id: uuidv4(),
            userId,
            maxRequests,
            windowMs,
            burstSize,
            enabled: true,
            expiresAt,
            createdAt: now,
            updatedAt: now,
        };
        this.db
            .prepare(`INSERT OR REPLACE INTO user_quotas
        (id, user_id, max_requests, window_ms, burst_size, enabled, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(quota.id, quota.userId, quota.maxRequests, quota.windowMs, quota.burstSize, quota.enabled ? 1 : 0, quota.expiresAt, quota.createdAt, quota.updatedAt);
    }
    /**
     * Remove user quota
     */
    async removeUserQuota(userId) {
        this.db.prepare('DELETE FROM user_quotas WHERE user_id = ?').run(userId);
    }
    /**
     * Get rate limit status for key
     */
    async getStatus(key, type) {
        const config = this.getConfigForType(type);
        if (!config) {
            return { allowed: true, remaining: Infinity, resetAt: 0, limit: Infinity };
        }
        let bucket = await this.getBucket(key, type);
        if (!bucket) {
            bucket = await this.createBucket(key, type, config);
        }
        bucket = this.refillBucket(bucket, config);
        return {
            allowed: bucket.tokens >= 1,
            remaining: Math.floor(bucket.tokens),
            resetAt: this.calculateResetTime(bucket, config),
            limit: bucket.maxTokens,
        };
    }
    /**
     * Reset rate limit for key
     */
    async reset(key, type) {
        const config = this.getConfigForType(type);
        if (!config)
            return;
        const bucket = await this.getBucket(key, type);
        if (bucket) {
            bucket.tokens = bucket.maxTokens;
            bucket.lastRefill = Date.now();
            bucket.updatedAt = Date.now();
            await this.updateBucket(bucket);
        }
    }
    /**
     * Get rate limit statistics
     */
    async getStatistics(startDate, endDate, type) {
        let query = 'SELECT * FROM rate_limit_stats WHERE 1=1';
        const params = [];
        if (startDate) {
            query += ' AND date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND date <= ?';
            params.push(endDate);
        }
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        query += ' ORDER BY date DESC';
        return this.db.prepare(query).all(...params);
    }
    /**
     * Get recent violations
     */
    async getViolations(key, type, limit = 100) {
        let query = 'SELECT * FROM rate_limit_violations WHERE 1=1';
        const params = [];
        if (key) {
            query += ' AND key = ?';
            params.push(key);
        }
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        query += ' ORDER BY violation_time DESC LIMIT ?';
        params.push(limit);
        return this.db.prepare(query).all(...params);
    }
    /**
     * Get active buckets
     */
    async getActiveBuckets(type) {
        let query = 'SELECT * FROM rate_limit_buckets WHERE tokens > 0';
        const params = [];
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        query += ' ORDER BY tokens ASC';
        return this.db.prepare(query).all(...params);
    }
    /**
     * Clean up expired buckets
     */
    async cleanup() {
        // Remove buckets that haven't been used in 24 hours
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const result = this.db
            .prepare('DELETE FROM rate_limit_buckets WHERE last_refill < ?')
            .run(cutoff);
        return result.changes || 0;
    }
    /**
     * Update configuration
     */
    updateConfig(name, updates) {
        const config = this.configs.get(name);
        if (!config)
            return;
        const updated = { ...config, ...updates, updatedAt: Date.now() };
        this.configs.set(name, updated);
        this.db
            .prepare(`UPDATE rate_limit_configs
        SET max_requests = ?, window_ms = ?, burst_size = ?, enabled = ?, updated_at = ?
        WHERE name = ?`)
            .run(updated.maxRequests, updated.windowMs, updated.burstSize, updated.enabled ? 1 : 0, updated.updatedAt, name);
    }
    /**
     * Get all configurations
     */
    getConfigs() {
        return Array.from(this.configs.values());
    }
    /**
     * Reload configurations from database
     */
    reload() {
        this.configs.clear();
        this.loadConfigs();
    }
}
//# sourceMappingURL=ProviderRateLimiter.js.map