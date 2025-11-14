/**
 * QueryOptimizer.ts
 *
 * Database query optimization with prepared statement caching
 * Phase 5 Week 1: Performance Optimization
 */
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
/**
 * Query performance metrics
 */
export interface QueryMetrics {
    query: string;
    executions: number;
    totalDurationMs: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    lastExecutedAt: number;
    usesPreparedStatement: boolean;
}
/**
 * Query plan analysis
 */
export interface QueryPlan {
    query: string;
    plan: string;
    estimatedRows: number;
    usesIndex: boolean;
    suggestedIndexes: string[];
}
/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
    type: 'index' | 'query_rewrite' | 'denormalization' | 'batch_operation';
    severity: 'high' | 'medium' | 'low';
    description: string;
    query: string;
    suggestedFix: string;
    estimatedImprovement: string;
}
/**
 * QueryOptimizer - Optimize database queries and track performance
 */
export declare class QueryOptimizer extends EventEmitter {
    private db;
    private preparedStatements;
    private queryMetrics;
    private queryCache;
    private cacheMaxSize;
    private cacheTTL;
    constructor(db?: Database.Database);
    /**
     * Execute optimized query with prepared statements
     */
    execute<T = any>(query: string, params?: any[]): T[];
    /**
     * Execute query and return single row
     */
    executeOne<T = any>(query: string, params?: any[]): T | null;
    /**
     * Execute batch operations (transaction)
     */
    executeBatch(operations: Array<{
        query: string;
        params: any[];
    }>): void;
    /**
     * Analyze query plan
     */
    analyzeQueryPlan(query: string): QueryPlan;
    /**
     * Get query metrics
     */
    getMetrics(query?: string): QueryMetrics[];
    /**
     * Get top slow queries
     */
    getSlowQueries(limit?: number): QueryMetrics[];
    /**
     * Get optimization recommendations
     */
    getRecommendations(): OptimizationRecommendation[];
    /**
     * Invalidate query cache
     */
    invalidateCache(pattern?: string): number;
    /**
     * Clear prepared statements
     */
    clearPreparedStatements(): void;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
    /**
     * Normalize query (remove whitespace variations)
     */
    private normalizeQuery;
    /**
     * Check if query is SELECT
     */
    private isSelectQuery;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Find oldest cache entry
     */
    private findOldestCacheEntry;
    /**
     * Update query metrics
     */
    private updateMetrics;
    /**
     * Extract estimated rows from query plan
     */
    private extractEstimatedRows;
    /**
     * Suggest indexes based on query and plan
     */
    private suggestIndexes;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        hitRate: number;
        oldestEntry: number;
    };
}
//# sourceMappingURL=QueryOptimizer.d.ts.map