/**
 * Filter Builder for Memory Search Queries
 *
 * Extracts the repetitive filter condition building logic from MemoryManager
 * into a reusable, testable utility with a fluent API.
 *
 * @module filter-builder
 */

/**
 * Filter options for memory search
 */
export interface MemorySearchFilters {
  type?: string | string[];
  source?: string | string[];
  agentId?: string;
  sessionId?: string;
  tags?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  minImportance?: number;
}

/**
 * Result of building filter conditions
 */
export interface FilterBuildResult {
  /** SQL WHERE conditions (without WHERE keyword) */
  conditions: string[];
  /** Parameter values for prepared statement */
  params: unknown[];
  /** Whether any filters were applied */
  hasFilters: boolean;
}

/**
 * FilterBuilder - Fluent API for building SQL filter conditions
 *
 * @example
 * ```typescript
 * const { conditions, params } = new FilterBuilder()
 *   .addTypeFilter(['task', 'note'])
 *   .addAgentFilter('backend')
 *   .addDateRangeFilter(new Date('2024-01-01'), new Date())
 *   .build();
 *
 * const whereClause = conditions.length > 0
 *   ? `WHERE ${conditions.join(' AND ')}`
 *   : '';
 * ```
 */
export class FilterBuilder {
  private conditions: string[] = [];
  private params: unknown[] = [];

  /**
   * Add filter for entry type(s)
   * @param types - Single type or array of types
   */
  addTypeFilter(types: string | string[] | undefined): this {
    if (!types) return this;

    const typeArray = Array.isArray(types) ? types : [types];
    if (typeArray.length === 0) return this;

    const placeholders = typeArray.map(() => '?').join(',');
    this.conditions.push(
      `json_extract(e.metadata, '$.type') IN (${placeholders})`
    );
    this.params.push(...typeArray);

    return this;
  }

  /**
   * Add filter for source(s)
   * @param sources - Single source or array of sources
   */
  addSourceFilter(sources: string | string[] | undefined): this {
    if (!sources) return this;

    const sourceArray = Array.isArray(sources) ? sources : [sources];
    if (sourceArray.length === 0) return this;

    const placeholders = sourceArray.map(() => '?').join(',');
    this.conditions.push(
      `json_extract(e.metadata, '$.source') IN (${placeholders})`
    );
    this.params.push(...sourceArray);

    return this;
  }

  /**
   * Add filter for agent ID
   * @param agentId - Agent identifier
   */
  addAgentFilter(agentId: string | undefined): this {
    if (!agentId) return this;

    this.conditions.push(`json_extract(e.metadata, '$.agentId') = ?`);
    this.params.push(agentId);

    return this;
  }

  /**
   * Add filter for session ID
   * @param sessionId - Session identifier
   */
  addSessionFilter(sessionId: string | undefined): this {
    if (!sessionId) return this;

    this.conditions.push(`json_extract(e.metadata, '$.sessionId') = ?`);
    this.params.push(sessionId);

    return this;
  }

  /**
   * Add filter for required tags (AND logic - all tags must be present)
   * @param tags - Array of required tags
   */
  addTagsFilter(tags: string[] | undefined): this {
    if (!tags || tags.length === 0) return this;

    // Check if all required tags are present (AND logic)
    for (const tag of tags) {
      this.conditions.push(
        `EXISTS (SELECT 1 FROM json_each(e.metadata, '$.tags') WHERE value = ?)`
      );
      this.params.push(tag);
    }

    return this;
  }

  /**
   * Add filter for date range
   * @param from - Start date (inclusive)
   * @param to - End date (inclusive)
   */
  addDateRangeFilter(from?: Date, to?: Date): this {
    if (from) {
      this.conditions.push('e.created_at >= ?');
      this.params.push(from.getTime());
    }

    if (to) {
      this.conditions.push('e.created_at <= ?');
      this.params.push(to.getTime());
    }

    return this;
  }

  /**
   * Add filter for minimum importance score
   * @param minImportance - Minimum importance value (0-1)
   */
  addMinImportanceFilter(minImportance: number | undefined): this {
    if (minImportance === undefined) return this;

    this.conditions.push(
      `CAST(json_extract(e.metadata, '$.importance') AS REAL) >= ?`
    );
    this.params.push(minImportance);

    return this;
  }

  /**
   * Add a custom filter condition
   * @param condition - SQL condition string (use ? for params)
   * @param params - Parameter values
   */
  addCustomFilter(condition: string, ...params: unknown[]): this {
    this.conditions.push(condition);
    this.params.push(...params);
    return this;
  }

  /**
   * Build all filters from a MemorySearchFilters object
   * @param filters - Filter configuration
   */
  addFilters(filters: MemorySearchFilters | undefined): this {
    if (!filters) return this;

    return this
      .addTypeFilter(filters.type)
      .addSourceFilter(filters.source)
      .addAgentFilter(filters.agentId)
      .addSessionFilter(filters.sessionId)
      .addTagsFilter(filters.tags)
      .addDateRangeFilter(filters.dateRange?.from, filters.dateRange?.to)
      .addMinImportanceFilter(filters.minImportance);
  }

  /**
   * Build the final filter result
   */
  build(): FilterBuildResult {
    return {
      conditions: [...this.conditions],
      params: [...this.params],
      hasFilters: this.conditions.length > 0,
    };
  }

  /**
   * Build a WHERE clause string (for convenience)
   * @returns WHERE clause or empty string if no filters
   */
  buildWhereClause(): string {
    if (this.conditions.length === 0) return '';
    return `WHERE ${this.conditions.join(' AND ')}`;
  }

  /**
   * Reset the builder for reuse
   */
  reset(): this {
    this.conditions = [];
    this.params = [];
    return this;
  }

  /**
   * Get the number of conditions added
   */
  get conditionCount(): number {
    return this.conditions.length;
  }
}

/**
 * Create a filter builder and optionally apply filters
 *
 * @example
 * ```typescript
 * const { conditions, params } = createFilterBuilder(filters).build();
 * ```
 */
export function createFilterBuilder(
  filters?: MemorySearchFilters
): FilterBuilder {
  const builder = new FilterBuilder();
  if (filters) {
    builder.addFilters(filters);
  }
  return builder;
}
