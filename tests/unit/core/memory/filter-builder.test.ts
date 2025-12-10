/**
 * Tests for FilterBuilder utility
 */

import { describe, it, expect } from 'vitest';
import {
  FilterBuilder,
  createFilterBuilder,
  type MemorySearchFilters,
} from '../../../../src/core/memory/filter-builder.js';

describe('FilterBuilder', () => {
  describe('constructor', () => {
    it('should create an empty builder', () => {
      const builder = new FilterBuilder();
      const result = builder.build();

      expect(result.conditions).toEqual([]);
      expect(result.params).toEqual([]);
      expect(result.hasFilters).toBe(false);
    });
  });

  describe('addTypeFilter', () => {
    it('should add single type filter', () => {
      const builder = new FilterBuilder();
      builder.addTypeFilter('task');
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('$.type');
      expect(result.conditions[0]).toContain('IN (?)');
      expect(result.params).toEqual(['task']);
    });

    it('should add multiple type filter', () => {
      const builder = new FilterBuilder();
      builder.addTypeFilter(['task', 'note', 'decision']);
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('IN (?,?,?)');
      expect(result.params).toEqual(['task', 'note', 'decision']);
    });

    it('should skip undefined types', () => {
      const builder = new FilterBuilder();
      builder.addTypeFilter(undefined);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
      expect(result.hasFilters).toBe(false);
    });

    it('should skip empty array', () => {
      const builder = new FilterBuilder();
      builder.addTypeFilter([]);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('addSourceFilter', () => {
    it('should add single source filter', () => {
      const builder = new FilterBuilder();
      builder.addSourceFilter('claude-code');
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('$.source');
      expect(result.params).toEqual(['claude-code']);
    });

    it('should add multiple source filter', () => {
      const builder = new FilterBuilder();
      builder.addSourceFilter(['claude-code', 'gemini-cli']);
      const result = builder.build();

      expect(result.conditions[0]).toContain('IN (?,?)');
      expect(result.params).toEqual(['claude-code', 'gemini-cli']);
    });

    it('should skip undefined sources', () => {
      const builder = new FilterBuilder();
      builder.addSourceFilter(undefined);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('addAgentFilter', () => {
    it('should add agent filter', () => {
      const builder = new FilterBuilder();
      builder.addAgentFilter('backend');
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('$.agentId');
      expect(result.conditions[0]).toContain('= ?');
      expect(result.params).toEqual(['backend']);
    });

    it('should skip undefined agent', () => {
      const builder = new FilterBuilder();
      builder.addAgentFilter(undefined);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('addSessionFilter', () => {
    it('should add session filter', () => {
      const builder = new FilterBuilder();
      builder.addSessionFilter('session-123');
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('$.sessionId');
      expect(result.params).toEqual(['session-123']);
    });

    it('should skip undefined session', () => {
      const builder = new FilterBuilder();
      builder.addSessionFilter(undefined);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('addTagsFilter', () => {
    it('should add single tag filter', () => {
      const builder = new FilterBuilder();
      builder.addTagsFilter(['security']);
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('EXISTS');
      expect(result.conditions[0]).toContain('$.tags');
      expect(result.params).toEqual(['security']);
    });

    it('should add multiple tag filters (AND logic)', () => {
      const builder = new FilterBuilder();
      builder.addTagsFilter(['security', 'authentication', 'jwt']);
      const result = builder.build();

      // Each tag should create a separate condition (AND logic)
      expect(result.conditions).toHaveLength(3);
      expect(result.params).toEqual(['security', 'authentication', 'jwt']);
    });

    it('should skip undefined tags', () => {
      const builder = new FilterBuilder();
      builder.addTagsFilter(undefined);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });

    it('should skip empty tags array', () => {
      const builder = new FilterBuilder();
      builder.addTagsFilter([]);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('addDateRangeFilter', () => {
    it('should add from date filter', () => {
      const from = new Date('2024-01-01');
      const builder = new FilterBuilder();
      builder.addDateRangeFilter(from);
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('e.created_at >= ?');
      expect(result.params).toEqual([from.getTime()]);
    });

    it('should add to date filter', () => {
      const to = new Date('2024-12-31');
      const builder = new FilterBuilder();
      builder.addDateRangeFilter(undefined, to);
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('e.created_at <= ?');
      expect(result.params).toEqual([to.getTime()]);
    });

    it('should add both from and to filters', () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      const builder = new FilterBuilder();
      builder.addDateRangeFilter(from, to);
      const result = builder.build();

      expect(result.conditions).toHaveLength(2);
      expect(result.params).toEqual([from.getTime(), to.getTime()]);
    });

    it('should skip when both dates are undefined', () => {
      const builder = new FilterBuilder();
      builder.addDateRangeFilter();
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('addMinImportanceFilter', () => {
    it('should add importance filter', () => {
      const builder = new FilterBuilder();
      builder.addMinImportanceFilter(0.5);
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0]).toContain('$.importance');
      expect(result.conditions[0]).toContain('>= ?');
      expect(result.params).toEqual([0.5]);
    });

    it('should handle zero importance', () => {
      const builder = new FilterBuilder();
      builder.addMinImportanceFilter(0);
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.params).toEqual([0]);
    });

    it('should skip undefined importance', () => {
      const builder = new FilterBuilder();
      builder.addMinImportanceFilter(undefined);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('addCustomFilter', () => {
    it('should add custom filter with params', () => {
      const builder = new FilterBuilder();
      builder.addCustomFilter('e.id > ?', 100);
      const result = builder.build();

      expect(result.conditions).toEqual(['e.id > ?']);
      expect(result.params).toEqual([100]);
    });

    it('should add custom filter with multiple params', () => {
      const builder = new FilterBuilder();
      builder.addCustomFilter('e.id BETWEEN ? AND ?', 10, 100);
      const result = builder.build();

      expect(result.conditions).toEqual(['e.id BETWEEN ? AND ?']);
      expect(result.params).toEqual([10, 100]);
    });

    it('should add custom filter without params', () => {
      const builder = new FilterBuilder();
      builder.addCustomFilter('e.deleted = 0');
      const result = builder.build();

      expect(result.conditions).toEqual(['e.deleted = 0']);
      expect(result.params).toEqual([]);
    });
  });

  describe('addFilters', () => {
    it('should apply all filters from MemorySearchFilters', () => {
      const filters: MemorySearchFilters = {
        type: 'task',
        source: 'claude-code',
        agentId: 'backend',
        sessionId: 'session-123',
        tags: ['security'],
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
        minImportance: 0.7,
      };

      const builder = new FilterBuilder();
      builder.addFilters(filters);
      const result = builder.build();

      // type + source + agentId + sessionId + 1 tag + from + to + importance = 8
      expect(result.conditions).toHaveLength(8);
      expect(result.hasFilters).toBe(true);
    });

    it('should handle partial filters', () => {
      const filters: MemorySearchFilters = {
        agentId: 'backend',
      };

      const builder = new FilterBuilder();
      builder.addFilters(filters);
      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.params).toEqual(['backend']);
    });

    it('should handle undefined filters', () => {
      const builder = new FilterBuilder();
      builder.addFilters(undefined);
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
      expect(result.hasFilters).toBe(false);
    });

    it('should handle empty filters', () => {
      const builder = new FilterBuilder();
      builder.addFilters({});
      const result = builder.build();

      expect(result.conditions).toHaveLength(0);
    });
  });

  describe('fluent API', () => {
    it('should support method chaining', () => {
      const result = new FilterBuilder()
        .addTypeFilter('task')
        .addAgentFilter('backend')
        .addTagsFilter(['security'])
        .build();

      expect(result.conditions).toHaveLength(3);
    });
  });

  describe('buildWhereClause', () => {
    it('should return WHERE clause with conditions', () => {
      const builder = new FilterBuilder();
      builder.addAgentFilter('backend');
      builder.addTypeFilter('task');

      const whereClause = builder.buildWhereClause();

      expect(whereClause).toMatch(/^WHERE .+ AND .+$/);
    });

    it('should return empty string when no filters', () => {
      const builder = new FilterBuilder();
      const whereClause = builder.buildWhereClause();

      expect(whereClause).toBe('');
    });
  });

  describe('reset', () => {
    it('should clear all conditions and params', () => {
      const builder = new FilterBuilder();
      builder.addAgentFilter('backend');
      builder.addTypeFilter('task');

      expect(builder.conditionCount).toBe(2);

      builder.reset();

      expect(builder.conditionCount).toBe(0);
      expect(builder.build().hasFilters).toBe(false);
    });

    it('should support reuse after reset', () => {
      const builder = new FilterBuilder();
      builder.addAgentFilter('backend');
      builder.reset();
      builder.addTypeFilter('note');

      const result = builder.build();

      expect(result.conditions).toHaveLength(1);
      expect(result.params).toEqual(['note']);
    });
  });

  describe('conditionCount', () => {
    it('should return correct count', () => {
      const builder = new FilterBuilder();
      expect(builder.conditionCount).toBe(0);

      builder.addAgentFilter('backend');
      expect(builder.conditionCount).toBe(1);

      builder.addTypeFilter(['task', 'note']);
      expect(builder.conditionCount).toBe(2);

      builder.addTagsFilter(['a', 'b', 'c']);
      expect(builder.conditionCount).toBe(5); // +3 for AND logic tags
    });
  });
});

describe('createFilterBuilder', () => {
  it('should create builder without filters', () => {
    const builder = createFilterBuilder();
    const result = builder.build();

    expect(result.hasFilters).toBe(false);
  });

  it('should create builder with filters applied', () => {
    const filters: MemorySearchFilters = {
      agentId: 'backend',
      type: 'task',
    };

    const builder = createFilterBuilder(filters);
    const result = builder.build();

    expect(result.conditions).toHaveLength(2);
    expect(result.hasFilters).toBe(true);
  });

  it('should return usable builder for chaining', () => {
    const builder = createFilterBuilder({ agentId: 'backend' });
    builder.addTypeFilter('task');

    const result = builder.build();
    expect(result.conditions).toHaveLength(2);
  });
});
