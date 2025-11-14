/**
 * ProviderRateLimiter.ts
 *
 * Advanced token bucket rate limiter for AI provider requests
 * Implements per-user, per-provider, per-IP, and global rate limiting
 *
 * Phase 3 Week 2 Day 8-9: Rate Limiting System
 */
/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    id: string;
    name: string;
    description: string;
    maxRequests: number;
    windowMs: number;
    burstSize: number;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}
/**
 * Token bucket state
 */
export interface TokenBucket {
    id: string;
    key: string;
    type: 'user' | 'provider' | 'ip' | 'global';
    tokens: number;
    maxTokens: number;
    refillRate: number;
    lastRefill: number;
    createdAt: number;
    updatedAt: number;
}
/**
 * Rate limit check result
 */
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfter?: number;
    resetAt?: number;
}
/**
 * Rate limit violation record
 */
export interface RateLimitViolation {
    id: string;
    key: string;
    type: string;
    configName: string;
    violationTime: number;
    tokensRequested: number;
    tokensAvailable: number;
    metadata?: any;
    createdAt: number;
}
/**
 * User quota configuration
 */
export interface UserQuota {
    id: string;
    userId: string;
    maxRequests: number;
    windowMs: number;
    burstSize: number;
    enabled: boolean;
    expiresAt?: number;
    createdAt: number;
    updatedAt: number;
}
/**
 * Rate limit statistics
 */
export interface RateLimitStats {
    date: string;
    type: string;
    totalRequests: number;
    allowedRequests: number;
    deniedRequests: number;
    uniqueKeys: number;
}
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
export declare class ProviderRateLimiter {
    private db;
    private configs;
    private readonly cacheTTL;
    constructor();
    /**
     * Load rate limit configurations from database
     */
    private loadConfigs;
    /**
     * Check if request is allowed under rate limit
     *
     * @param key - Identifier (user_id, ip, provider, 'global')
     * @param type - Type of rate limit to check
     * @param tokensRequested - Number of tokens to consume (default: 1)
     * @returns Rate limit result
     */
    checkLimit(key: string, type?: 'user' | 'provider' | 'ip' | 'global', tokensRequested?: number): Promise<RateLimitResult>;
    /**
     * Get token bucket for key
     */
    private getBucket;
    /**
     * Create new token bucket
     */
    private createBucket;
    /**
     * Refill token bucket based on elapsed time
     */
    private refillBucket;
    /**
     * Update token bucket in database
     */
    private updateBucket;
    /**
     * Record rate limit violation
     */
    private recordViolation;
    /**
     * Get configuration for rate limit type
     */
    private getConfigForType;
    /**
     * Calculate time until rate limit resets
     */
    private calculateResetTime;
    /**
     * Calculate time until N tokens available
     */
    private calculateRetryAfter;
    /**
     * Get user quota
     */
    private getUserQuota;
    /**
     * Check user quota (custom per-user rate limit)
     */
    private checkUserQuota;
    /**
     * Set custom user quota
     */
    setUserQuota(userId: string, maxRequests: number, windowMs: number, burstSize?: number, expiresAt?: number): Promise<void>;
    /**
     * Remove user quota
     */
    removeUserQuota(userId: string): Promise<void>;
    /**
     * Get rate limit status for key
     */
    getStatus(key: string, type: 'user' | 'provider' | 'ip' | 'global'): Promise<{
        allowed: boolean;
        remaining: number;
        resetAt: number;
        limit: number;
    }>;
    /**
     * Reset rate limit for key
     */
    reset(key: string, type: 'user' | 'provider' | 'ip' | 'global'): Promise<void>;
    /**
     * Get rate limit statistics
     */
    getStatistics(startDate?: string, endDate?: string, type?: string): Promise<RateLimitStats[]>;
    /**
     * Get recent violations
     */
    getViolations(key?: string, type?: string, limit?: number): Promise<RateLimitViolation[]>;
    /**
     * Get active buckets
     */
    getActiveBuckets(type?: string): Promise<TokenBucket[]>;
    /**
     * Clean up expired buckets
     */
    cleanup(): Promise<number>;
    /**
     * Update configuration
     */
    updateConfig(name: string, updates: Partial<RateLimitConfig>): void;
    /**
     * Get all configurations
     */
    getConfigs(): RateLimitConfig[];
    /**
     * Reload configurations from database
     */
    reload(): void;
}
//# sourceMappingURL=ProviderRateLimiter.d.ts.map