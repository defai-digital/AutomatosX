/**
 * QueryOptimizer.ts
 *
 * Database query optimization with prepared statement caching
 * Phase 5 Week 1: Performance Optimization
 */
import { EventEmitter } from 'events';
import { getDatabase } from './connection.js';
/**
 * QueryOptimizer - Optimize database queries and track performance
 */
export class QueryOptimizer extends EventEmitter {
    db;
    preparedStatements;
    queryMetrics;
    queryCache; // Simple query result cache
    cacheMaxSize = 1000;
    cacheTTL = 60000; // 1 minute
    constructor(db) {
        super();
        this.db = db || getDatabase();
        this.preparedStatements = new Map();
        this.queryMetrics = new Map();
        this.queryCache = new Map();
        // Enable query plan analysis
        this.db.pragma('stats = ON');
    }
    /**
     * Execute optimized query with prepared statements
     */
    execute(query, params = []) {
        const startTime = Date.now();
        const normalizedQuery = this.normalizeQuery(query);
        // Try cache first (for SELECT queries)
        if (this.isSelectQuery(query)) {
            const cacheKey = this.getCacheKey(normalizedQuery, params);
            const cached = this.queryCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                this.emit('query_cache_hit', { query: normalizedQuery });
                return cached.result;
            }
        }
        // Get or create prepared statement
        let stmt = this.preparedStatements.get(normalizedQuery);
        if (!stmt) {
            stmt = this.db.prepare(query);
            this.preparedStatements.set(normalizedQuery, stmt);
            this.emit('prepared_statement_created', { query: normalizedQuery });
        }
        // Execute query
        let result;
        try {
            if (this.isSelectQuery(query)) {
                result = stmt.all(...params);
            }
            else {
                stmt.run(...params);
                result = [];
            }
        }
        catch (error) {
            this.emit('query_error', { query: normalizedQuery, error });
            throw error;
        }
        const duration = Date.now() - startTime;
        // Update metrics
        this.updateMetrics(normalizedQuery, duration);
        // Cache result if SELECT
        if (this.isSelectQuery(query) && result.length > 0) {
            const cacheKey = this.getCacheKey(normalizedQuery, params);
            this.queryCache.set(cacheKey, {
                result,
                timestamp: Date.now(),
            });
            // Evict old cache entries if needed
            if (this.queryCache.size > this.cacheMaxSize) {
                const oldestKey = this.findOldestCacheEntry();
                if (oldestKey) {
                    this.queryCache.delete(oldestKey);
                }
            }
        }
        // Emit slow query warning
        if (duration > 100) {
            this.emit('slow_query', { query: normalizedQuery, duration });
        }
        return result;
    }
    /**
     * Execute query and return single row
     */
    executeOne(query, params = []) {
        const startTime = Date.now();
        const normalizedQuery = this.normalizeQuery(query);
        // Try cache first
        if (this.isSelectQuery(query)) {
            const cacheKey = this.getCacheKey(normalizedQuery, params);
            const cached = this.queryCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                this.emit('query_cache_hit', { query: normalizedQuery });
                return cached.result;
            }
        }
        // Get or create prepared statement
        let stmt = this.preparedStatements.get(normalizedQuery);
        if (!stmt) {
            stmt = this.db.prepare(query);
            this.preparedStatements.set(normalizedQuery, stmt);
        }
        // Execute query
        const result = stmt.get(...params);
        const duration = Date.now() - startTime;
        // Update metrics
        this.updateMetrics(normalizedQuery, duration);
        // Cache result if SELECT
        if (this.isSelectQuery(query) && result) {
            const cacheKey = this.getCacheKey(normalizedQuery, params);
            this.queryCache.set(cacheKey, {
                result,
                timestamp: Date.now(),
            });
        }
        return result || null;
    }
    /**
     * Execute batch operations (transaction)
     */
    executeBatch(operations) {
        const startTime = Date.now();
        const transaction = this.db.transaction(() => {
            for (const op of operations) {
                this.execute(op.query, op.params);
            }
        });
        try {
            transaction();
            const duration = Date.now() - startTime;
            this.emit('batch_executed', { count: operations.length, duration });
        }
        catch (error) {
            this.emit('batch_error', { count: operations.length, error });
            throw error;
        }
    }
    /**
     * Analyze query plan
     */
    analyzeQueryPlan(query) {
        const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
        const stmt = this.db.prepare(explainQuery);
        const planRows = stmt.all();
        const planText = planRows.map(row => row.detail).join('\n');
        const usesIndex = planText.includes('USING INDEX');
        const estimatedRows = this.extractEstimatedRows(planText);
        return {
            query,
            plan: planText,
            estimatedRows,
            usesIndex,
            suggestedIndexes: this.suggestIndexes(query, planText),
        };
    }
    /**
     * Get query metrics
     */
    getMetrics(query) {
        if (query) {
            const normalized = this.normalizeQuery(query);
            const metrics = this.queryMetrics.get(normalized);
            return metrics ? [metrics] : [];
        }
        return Array.from(this.queryMetrics.values()).sort((a, b) => b.totalDurationMs - a.totalDurationMs);
    }
    /**
     * Get top slow queries
     */
    getSlowQueries(limit = 10) {
        return Array.from(this.queryMetrics.values())
            .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
            .slice(0, limit);
    }
    /**
     * Get optimization recommendations
     */
    getRecommendations() {
        const recommendations = [];
        // Analyze slow queries
        const slowQueries = this.getSlowQueries(20);
        for (const metrics of slowQueries) {
            if (metrics.avgDurationMs > 50) {
                // Analyze query plan
                try {
                    const plan = this.analyzeQueryPlan(metrics.query);
                    if (!plan.usesIndex && plan.estimatedRows > 1000) {
                        recommendations.push({
                            type: 'index',
                            severity: 'high',
                            description: `Query scans ${plan.estimatedRows} rows without index`,
                            query: metrics.query,
                            suggestedFix: plan.suggestedIndexes.join('\n'),
                            estimatedImprovement: '10-100x faster',
                        });
                    }
                    if (metrics.query.includes('SELECT *')) {
                        recommendations.push({
                            type: 'query_rewrite',
                            severity: 'medium',
                            description: 'Query uses SELECT * which fetches unnecessary columns',
                            query: metrics.query,
                            suggestedFix: 'Specify only needed columns explicitly',
                            estimatedImprovement: '2-5x faster',
                        });
                    }
                    if (metrics.executions > 1000 && metrics.avgDurationMs > 10) {
                        recommendations.push({
                            type: 'batch_operation',
                            severity: 'medium',
                            description: `High-frequency query executed ${metrics.executions} times`,
                            query: metrics.query,
                            suggestedFix: 'Consider batching operations or denormalizing data',
                            estimatedImprovement: '5-20x faster',
                        });
                    }
                }
                catch (error) {
                    // Skip queries that can't be analyzed
                }
            }
        }
        return recommendations;
    }
    /**
     * Invalidate query cache
     */
    invalidateCache(pattern) {
        if (!pattern) {
            const count = this.queryCache.size;
            this.queryCache.clear();
            this.emit('cache_invalidated', { count });
            return count;
        }
        let count = 0;
        for (const [key] of this.queryCache) {
            if (key.includes(pattern)) {
                this.queryCache.delete(key);
                count++;
            }
        }
        if (count > 0) {
            this.emit('cache_invalidated', { pattern, count });
        }
        return count;
    }
    /**
     * Clear prepared statements
     */
    clearPreparedStatements() {
        this.preparedStatements.clear();
        this.emit('prepared_statements_cleared');
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.queryMetrics.clear();
        this.emit('metrics_reset');
    }
    /**
     * Normalize query (remove whitespace variations)
     */
    normalizeQuery(query) {
        return query.trim().replace(/\s+/g, ' ');
    }
    /**
     * Check if query is SELECT
     */
    isSelectQuery(query) {
        return query.trim().toUpperCase().startsWith('SELECT');
    }
    /**
     * Generate cache key
     */
    getCacheKey(query, params) {
        return `${query}::${JSON.stringify(params)}`;
    }
    /**
     * Find oldest cache entry
     */
    findOldestCacheEntry() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, value] of this.queryCache) {
            if (value.timestamp < oldestTime) {
                oldestTime = value.timestamp;
                oldestKey = key;
            }
        }
        return oldestKey;
    }
    /**
     * Update query metrics
     */
    updateMetrics(query, duration) {
        let metrics = this.queryMetrics.get(query);
        if (!metrics) {
            metrics = {
                query,
                executions: 0,
                totalDurationMs: 0,
                avgDurationMs: 0,
                minDurationMs: Infinity,
                maxDurationMs: 0,
                lastExecutedAt: 0,
                usesPreparedStatement: this.preparedStatements.has(query),
            };
            this.queryMetrics.set(query, metrics);
        }
        metrics.executions++;
        metrics.totalDurationMs += duration;
        metrics.avgDurationMs = metrics.totalDurationMs / metrics.executions;
        metrics.minDurationMs = Math.min(metrics.minDurationMs, duration);
        metrics.maxDurationMs = Math.max(metrics.maxDurationMs, duration);
        metrics.lastExecutedAt = Date.now();
    }
    /**
     * Extract estimated rows from query plan
     */
    extractEstimatedRows(plan) {
        const match = plan.match(/\((\d+) rows?\)/);
        return match ? parseInt(match[1], 10) : 0;
    }
    /**
     * Suggest indexes based on query and plan
     */
    suggestIndexes(query, plan) {
        const suggestions = [];
        // Look for table scans
        const scanMatch = plan.match(/SCAN TABLE (\w+)/g);
        if (scanMatch) {
            for (const scan of scanMatch) {
                const table = scan.replace('SCAN TABLE ', '');
                // Extract WHERE clause columns
                const whereMatch = query.match(/WHERE\s+(\w+)/i);
                if (whereMatch) {
                    const column = whereMatch[1];
                    suggestions.push(`CREATE INDEX IF NOT EXISTS idx_${table}_${column} ON ${table}(${column});`);
                }
            }
        }
        // Look for sorting without index
        if (plan.includes('USE TEMP B-TREE FOR ORDER BY') || query.includes('ORDER BY')) {
            const orderByMatch = query.match(/ORDER BY\s+(\w+)/i);
            const fromMatch = query.match(/FROM\s+(\w+)/i);
            if (orderByMatch && fromMatch) {
                const column = orderByMatch[1];
                const table = fromMatch[1];
                suggestions.push(`CREATE INDEX IF NOT EXISTS idx_${table}_${column} ON ${table}(${column});`);
            }
        }
        return suggestions;
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        let oldestTime = Infinity;
        for (const [_, value] of this.queryCache) {
            if (value.timestamp < oldestTime) {
                oldestTime = value.timestamp;
            }
        }
        return {
            size: this.queryCache.size,
            hitRate: 0, // TODO: Track hit rate
            oldestEntry: oldestTime === Infinity ? 0 : Date.now() - oldestTime,
        };
    }
}
//# sourceMappingURL=QueryOptimizer.js.map