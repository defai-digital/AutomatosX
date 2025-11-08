/**
 * Query filter conditions
 */
export interface QueryFilter {
    agent?: string;
    dateFrom?: Date;
    dateTo?: Date;
    tags?: string[];
    minRelevance?: number;
}
/**
 * Query options
 */
export interface QueryOptions {
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'date' | 'agent';
    sortOrder?: 'asc' | 'desc';
}
/**
 * Built query result
 */
export interface BuiltQuery {
    sql: string;
    params: any[];
    explanation: string;
}
/**
 * Memory Query Builder
 *
 * Constructs type-safe SQL queries for FTS5 full-text search with filters
 *
 * @example
 * ```typescript
 * const builder = new MemoryQueryBuilder()
 * const query = builder
 *   .search('authentication implementation')
 *   .filterByAgent('backend')
 *   .filterByDateRange(new Date('2025-01-01'), new Date('2025-01-31'))
 *   .limit(10)
 *   .build()
 *
 * // Execute query
 * const results = db.prepare(query.sql).all(...query.params)
 * ```
 */
export declare class MemoryQueryBuilder {
    private searchQuery?;
    private exactMatch;
    private filters;
    private options;
    /**
     * Set search query for FTS5
     */
    search(query: string, exactMatch?: boolean): this;
    /**
     * Filter by agent name
     */
    filterByAgent(agent: string): this;
    /**
     * Filter by date range
     */
    filterByDateRange(from?: Date, to?: Date): this;
    /**
     * Filter by tags (OR condition)
     */
    filterByTags(tags: string[]): this;
    /**
     * Filter by minimum relevance score
     */
    filterByRelevance(minScore: number): this;
    /**
     * Set result limit
     */
    limit(count: number): this;
    /**
     * Set result offset for pagination
     */
    offset(count: number): this;
    /**
     * Set sort order
     */
    sortBy(field: 'relevance' | 'date' | 'agent', order?: 'asc' | 'desc'): this;
    /**
     * Build final SQL query
     */
    build(): BuiltQuery;
    /**
     * Build FTS5 MATCH query with boolean operators
     */
    private buildFTS5Query;
    /**
     * Get sort column based on sort option
     */
    private getSortColumn;
    /**
     * Generate human-readable query explanation
     */
    private generateExplanation;
    /**
     * Reset builder to initial state
     */
    reset(): this;
    /**
     * Clone builder with current state
     */
    clone(): MemoryQueryBuilder;
}
/**
 * Quick query builders for common patterns
 */
export declare class QueryPresets {
    /**
     * Search recent memories
     */
    static recentMemories(limit?: number): MemoryQueryBuilder;
    /**
     * Search by agent
     */
    static byAgent(agent: string, limit?: number): MemoryQueryBuilder;
    /**
     * Search today's memories
     */
    static today(limit?: number): MemoryQueryBuilder;
    /**
     * Full-text search with relevance ranking
     */
    static search(query: string, limit?: number): MemoryQueryBuilder;
    /**
     * Search with agent and date filters
     */
    static searchAgentDateRange(query: string, agent: string, from: Date, to: Date, limit?: number): MemoryQueryBuilder;
}
//# sourceMappingURL=MemoryQueryBuilder.d.ts.map