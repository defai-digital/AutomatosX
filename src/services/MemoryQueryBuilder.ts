// Sprint 2 Day 14: Memory Query Builder
// Type-safe query construction for SQLite FTS5 with filtering and pagination

/**
 * Query filter conditions
 */
export interface QueryFilter {
  agent?: string
  dateFrom?: Date
  dateTo?: Date
  tags?: string[]
  minRelevance?: number
}

/**
 * Query options
 */
export interface QueryOptions {
  limit?: number
  offset?: number
  sortBy?: 'relevance' | 'date' | 'agent'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Built query result
 */
export interface BuiltQuery {
  sql: string
  params: any[]
  explanation: string
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
export class MemoryQueryBuilder {
  private searchQuery?: string
  private exactMatch: boolean = false
  private filters: QueryFilter = {}
  private options: QueryOptions = {
    limit: 10,
    offset: 0,
    sortBy: 'relevance',
    sortOrder: 'desc',
  }

  /**
   * Set search query for FTS5
   */
  search(query: string, exactMatch: boolean = false): this {
    this.searchQuery = query
    this.exactMatch = exactMatch
    return this
  }

  /**
   * Filter by agent name
   */
  filterByAgent(agent: string): this {
    this.filters.agent = agent
    return this
  }

  /**
   * Filter by date range
   */
  filterByDateRange(from?: Date, to?: Date): this {
    this.filters.dateFrom = from
    this.filters.dateTo = to
    return this
  }

  /**
   * Filter by tags (OR condition)
   */
  filterByTags(tags: string[]): this {
    this.filters.tags = tags
    return this
  }

  /**
   * Filter by minimum relevance score
   */
  filterByRelevance(minScore: number): this {
    this.filters.minRelevance = minScore
    return this
  }

  /**
   * Set result limit
   */
  limit(count: number): this {
    this.options.limit = Math.min(count, 100) // Cap at 100
    return this
  }

  /**
   * Set result offset for pagination
   */
  offset(count: number): this {
    this.options.offset = Math.max(count, 0)
    return this
  }

  /**
   * Set sort order
   */
  sortBy(field: 'relevance' | 'date' | 'agent', order: 'asc' | 'desc' = 'desc'): this {
    this.options.sortBy = field
    this.options.sortOrder = order
    return this
  }

  /**
   * Build final SQL query
   */
  build(): BuiltQuery {
    const params: any[] = []
    const whereClauses: string[] = []
    const joinClauses: string[] = []

    // Base table selection
    let sql = `
      SELECT
        m.id,
        m.agent,
        m.content,
        m.timestamp,
        m.tags,
        m.metadata
    `

    // Add relevance score if using FTS5 search
    if (this.searchQuery) {
      sql += `,
        rank AS relevance
      `
    }

    sql += `
      FROM memories m
    `

    // Join with FTS5 table if searching
    if (this.searchQuery) {
      sql += `
      INNER JOIN memories_fts mfts ON m.id = mfts.rowid
      `

      // Build FTS5 MATCH query
      const matchQuery = this.exactMatch
        ? `"${this.searchQuery}"`
        : this.buildFTS5Query(this.searchQuery)

      whereClauses.push(`mfts MATCH ?`)
      params.push(matchQuery)
    }

    // Apply filters
    if (this.filters.agent) {
      whereClauses.push(`m.agent = ?`)
      params.push(this.filters.agent)
    }

    if (this.filters.dateFrom) {
      whereClauses.push(`m.timestamp >= ?`)
      params.push(this.filters.dateFrom.toISOString())
    }

    if (this.filters.dateTo) {
      whereClauses.push(`m.timestamp <= ?`)
      params.push(this.filters.dateTo.toISOString())
    }

    if (this.filters.tags && this.filters.tags.length > 0) {
      const tagConditions = this.filters.tags
        .map(() => `m.tags LIKE ?`)
        .join(' OR ')
      whereClauses.push(`(${tagConditions})`)
      this.filters.tags.forEach(tag => params.push(`%${tag}%`))
    }

    if (this.filters.minRelevance && this.searchQuery) {
      whereClauses.push(`rank >= ?`)
      params.push(this.filters.minRelevance)
    }

    // Add WHERE clause
    if (whereClauses.length > 0) {
      sql += `\n      WHERE ${whereClauses.join(' AND ')}`
    }

    // Add ORDER BY
    const sortColumn = this.getSortColumn()
    sql += `\n      ORDER BY ${sortColumn} ${this.options.sortOrder?.toUpperCase()}`

    // Add LIMIT and OFFSET
    sql += `\n      LIMIT ? OFFSET ?`
    params.push(this.options.limit, this.options.offset)

    // Generate explanation
    const explanation = this.generateExplanation()

    return {
      sql: sql.trim(),
      params,
      explanation,
    }
  }

  /**
   * Build FTS5 MATCH query with boolean operators
   */
  private buildFTS5Query(query: string): string {
    // Split query into terms
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)

    // Build FTS5 query with implicit AND
    return terms.join(' ')
  }

  /**
   * Get sort column based on sort option
   */
  private getSortColumn(): string {
    switch (this.options.sortBy) {
      case 'relevance':
        return this.searchQuery ? 'rank' : 'm.timestamp'
      case 'date':
        return 'm.timestamp'
      case 'agent':
        return 'm.agent'
      default:
        return 'm.timestamp'
    }
  }

  /**
   * Generate human-readable query explanation
   */
  private generateExplanation(): string {
    const parts: string[] = []

    if (this.searchQuery) {
      parts.push(`Search for "${this.searchQuery}" (${this.exactMatch ? 'exact' : 'fuzzy'})`)
    }

    if (this.filters.agent) {
      parts.push(`Agent: ${this.filters.agent}`)
    }

    if (this.filters.dateFrom || this.filters.dateTo) {
      const from = this.filters.dateFrom?.toISOString().split('T')[0] || 'beginning'
      const to = this.filters.dateTo?.toISOString().split('T')[0] || 'now'
      parts.push(`Date range: ${from} to ${to}`)
    }

    if (this.filters.tags && this.filters.tags.length > 0) {
      parts.push(`Tags: ${this.filters.tags.join(', ')}`)
    }

    parts.push(`Sort by ${this.options.sortBy} (${this.options.sortOrder})`)
    parts.push(`Limit: ${this.options.limit}, Offset: ${this.options.offset}`)

    return parts.join(' | ')
  }

  /**
   * Reset builder to initial state
   */
  reset(): this {
    this.searchQuery = undefined
    this.exactMatch = false
    this.filters = {}
    this.options = {
      limit: 10,
      offset: 0,
      sortBy: 'relevance',
      sortOrder: 'desc',
    }
    return this
  }

  /**
   * Clone builder with current state
   */
  clone(): MemoryQueryBuilder {
    const cloned = new MemoryQueryBuilder()
    cloned.searchQuery = this.searchQuery
    cloned.exactMatch = this.exactMatch
    cloned.filters = { ...this.filters }
    cloned.options = { ...this.options }
    return cloned
  }
}

/**
 * Quick query builders for common patterns
 */
export class QueryPresets {
  /**
   * Search recent memories
   */
  static recentMemories(limit: number = 10): MemoryQueryBuilder {
    return new MemoryQueryBuilder()
      .sortBy('date', 'desc')
      .limit(limit)
  }

  /**
   * Search by agent
   */
  static byAgent(agent: string, limit: number = 10): MemoryQueryBuilder {
    return new MemoryQueryBuilder()
      .filterByAgent(agent)
      .sortBy('date', 'desc')
      .limit(limit)
  }

  /**
   * Search today's memories
   */
  static today(limit: number = 10): MemoryQueryBuilder {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    return new MemoryQueryBuilder()
      .filterByDateRange(startOfDay, new Date())
      .sortBy('date', 'desc')
      .limit(limit)
  }

  /**
   * Full-text search with relevance ranking
   */
  static search(query: string, limit: number = 10): MemoryQueryBuilder {
    return new MemoryQueryBuilder()
      .search(query)
      .sortBy('relevance', 'desc')
      .limit(limit)
  }

  /**
   * Search with agent and date filters
   */
  static searchAgentDateRange(
    query: string,
    agent: string,
    from: Date,
    to: Date,
    limit: number = 10
  ): MemoryQueryBuilder {
    return new MemoryQueryBuilder()
      .search(query)
      .filterByAgent(agent)
      .filterByDateRange(from, to)
      .sortBy('relevance', 'desc')
      .limit(limit)
  }
}
