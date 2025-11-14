// ============================================================================
// HybridSearchBridge.test.ts - HybridSearch bridge integration tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  combineSearchResults,
  getSearchResultStats,
  type TSMessage,
  type TSVectorResult,
  type TSSearchOptions,
} from '../../bridge/HybridSearchBridge.js';
import {
  resetFeatureFlags,
  applyRolloutPreset,
} from '../../bridge/ReScriptFeatureFlags.js';

describe('HybridSearchBridge', () => {
  // Test data
  const createMessage = (id: string, role: 'user' | 'assistant' | 'system' = 'user'): TSMessage => ({
    id,
    conversationId: 'conv-123',
    role,
    content: `Message ${id}`,
    tokens: 10,
    metadata: { test: true },
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  });

  const createVectorResult = (messageId: string, distance: number): TSVectorResult => ({
    messageId,
    distance,
    score: 1.0 - distance / 2.0,
  });

  beforeEach(() => {
    resetFeatureFlags();
  });

  describe('combineSearchResults - TypeScript Implementation', () => {
    it('should combine FTS-only results', () => {
      const ftsResults = [
        createMessage('msg-1'),
        createMessage('msg-2'),
      ];
      const vectorResults: TSVectorResult[] = [];

      const { results } = combineSearchResults(ftsResults, vectorResults);

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('fts');
      expect(results[1].source).toBe('fts');
    });

    it('should combine hybrid results (FTS + Vector)', () => {
      const ftsResults = [createMessage('msg-1')];
      const vectorResults = [createVectorResult('msg-1', 0.2)];

      const { results } = combineSearchResults(ftsResults, vectorResults);

      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('hybrid');
      expect(results[0].vectorResult).toBeDefined();
      expect(results[0].vectorResult?.distance).toBe(0.2);
    });

    it('should handle vector-only results (BUG #1 in TypeScript!)', () => {
      const ftsResults: TSMessage[] = [];
      const vectorResults = [createVectorResult('msg-999', 0.1)];

      // TypeScript implementation drops vector-only results (BUG #1)
      const { results } = combineSearchResults(ftsResults, vectorResults);

      // This test documents the bug - TypeScript drops vector-only results!
      // With feature flags disabled, this uses TypeScript implementation
      expect(results).toHaveLength(0); // BUG #1: Should be 1!
    });

    it('should apply score threshold', () => {
      const ftsResults = [
        createMessage('msg-1'),
        createMessage('msg-2'),
      ];
      const vectorResults: TSVectorResult[] = [];
      const options: TSSearchOptions = {
        minScore: 0.5,
      };

      const { results } = combineSearchResults(ftsResults, vectorResults, options);

      // Results with score < 0.5 should be filtered
      expect(results.every(r => r.combinedScore >= 0.5)).toBe(true);
    });

    it('should apply limit', () => {
      const ftsResults = Array.from({ length: 20 }, (_, i) => createMessage(`msg-${i}`));
      const vectorResults: TSVectorResult[] = [];
      const options: TSSearchOptions = {
        limit: 5,
      };

      const { results } = combineSearchResults(ftsResults, vectorResults, options);

      expect(results).toHaveLength(5);
    });

    it('should sort by combined score descending', () => {
      const ftsResults = [
        createMessage('msg-1'),
        createMessage('msg-2'),
      ];
      const vectorResults = [
        createVectorResult('msg-1', 0.1), // Better score
        createVectorResult('msg-2', 0.5), // Worse score
      ];

      const { results } = combineSearchResults(ftsResults, vectorResults);

      expect(results[0].message.id).toBe('msg-1'); // Better score should be first
      expect(results[1].message.id).toBe('msg-2');
    });
  });

  describe('combineSearchResults - ReScript Implementation', () => {
    beforeEach(() => {
      // Enable ReScript implementation
      applyRolloutPreset('production');
    });

    it('should combine FTS-only results with ReScript', () => {
      const ftsResults = [
        createMessage('msg-1'),
        createMessage('msg-2'),
      ];
      const vectorResults: TSVectorResult[] = [];

      const { results, metrics } = combineSearchResults(ftsResults, vectorResults);

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('fts');
      expect(metrics?.implementation).toBe('rescript');
    });

    it('should handle vector-only results correctly (BUG #1 PREVENTED!)', () => {
      const ftsResults: TSMessage[] = [];
      const vectorResults = [createVectorResult('msg-999', 0.1)];

      const { results } = combineSearchResults(ftsResults, vectorResults);

      // ReScript PREVENTS BUG #1: Vector-only results are included!
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('vector');
      expect(results[0].vectorResult?.messageId).toBe('msg-999');
    });

    it('should handle all three result types', () => {
      const ftsResults = [
        createMessage('msg-1'), // Hybrid (also in vector)
        createMessage('msg-2'), // FTS only
      ];
      const vectorResults = [
        createVectorResult('msg-1', 0.2), // Hybrid
        createVectorResult('msg-3', 0.1), // Vector only
      ];

      const { results } = combineSearchResults(ftsResults, vectorResults);

      expect(results).toHaveLength(3); // All three result types
      const sources = results.map(r => r.source).sort();
      expect(sources).toContain('fts');
      expect(sources).toContain('vector');
      expect(sources).toContain('hybrid');
    });

    it('should combine results with custom weights', () => {
      const ftsResults = [createMessage('msg-1')];
      const vectorResults = [createVectorResult('msg-1', 0.2)];
      const options: TSSearchOptions = {
        weights: {
          fts: 0.3,
          vector: 0.5,
          recency: 0.2,
        },
      };

      const { results } = combineSearchResults(ftsResults, vectorResults, options);

      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('hybrid');
      // Combined score should reflect custom weights
      expect(results[0].combinedScore).toBeGreaterThan(0);
      expect(results[0].combinedScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Feature Flag A/B Testing', () => {
    it('should use TypeScript when flags disabled', () => {
      // Flags disabled by default
      const ftsResults = [createMessage('msg-1')];
      const vectorResults: TSVectorResult[] = [];

      const { results, metrics } = combineSearchResults(ftsResults, vectorResults);

      expect(results).toHaveLength(1);
      expect(metrics?.implementation).toBe('typescript');
    });

    it('should use ReScript when enabled', () => {
      applyRolloutPreset('production');

      const ftsResults = [createMessage('msg-1')];
      const vectorResults: TSVectorResult[] = [];

      const { results, metrics } = combineSearchResults(ftsResults, vectorResults);

      expect(results).toHaveLength(1);
      expect(metrics?.implementation).toBe('rescript');
    });

    it('should assign users deterministically', () => {
      applyRolloutPreset('phase2_50percent'); // 50% rollout

      const userId = 'test-user-123';

      // Same user should always get same implementation
      const result1 = combineSearchResults(
        [createMessage('msg-1')],
        [],
        undefined,
        userId
      );
      const result2 = combineSearchResults(
        [createMessage('msg-1')],
        [],
        undefined,
        userId
      );
      const result3 = combineSearchResults(
        [createMessage('msg-1')],
        [],
        undefined,
        userId
      );

      expect(result1.metrics?.implementation).toBe(result2.metrics?.implementation);
      expect(result2.metrics?.implementation).toBe(result3.metrics?.implementation);
    });
  });

  describe('getSearchResultStats', () => {
    beforeEach(() => {
      applyRolloutPreset('production'); // Use ReScript for stats
    });

    it('should calculate stats for FTS-only results', () => {
      const ftsResults = [
        createMessage('msg-1'),
        createMessage('msg-2'),
      ];
      const vectorResults: TSVectorResult[] = [];

      const { results } = combineSearchResults(ftsResults, vectorResults);
      const stats = getSearchResultStats(results);

      expect(stats.total).toBe(2);
      expect(stats.ftsOnly).toBe(2);
      expect(stats.vectorOnly).toBe(0);
      expect(stats.hybrid).toBe(0);
    });

    it('should calculate stats for hybrid results', () => {
      const ftsResults = [createMessage('msg-1')];
      const vectorResults = [createVectorResult('msg-1', 0.2)];

      const { results } = combineSearchResults(ftsResults, vectorResults);
      const stats = getSearchResultStats(results);

      expect(stats.total).toBe(1);
      expect(stats.hybrid).toBe(1);
      expect(stats.ftsOnly).toBe(0);
      expect(stats.vectorOnly).toBe(0);
    });

    it('should calculate stats for vector-only results', () => {
      const ftsResults: TSMessage[] = [];
      const vectorResults = [createVectorResult('msg-999', 0.1)];

      const { results } = combineSearchResults(ftsResults, vectorResults);
      const stats = getSearchResultStats(results);

      expect(stats.total).toBe(1);
      expect(stats.vectorOnly).toBe(1);
      expect(stats.ftsOnly).toBe(0);
      expect(stats.hybrid).toBe(0);
    });

    it('should calculate stats for mixed results', () => {
      const ftsResults = [
        createMessage('msg-1'),
        createMessage('msg-2'),
      ];
      const vectorResults = [
        createVectorResult('msg-1', 0.2), // Hybrid
        createVectorResult('msg-3', 0.1), // Vector only
      ];

      const { results } = combineSearchResults(ftsResults, vectorResults);
      const stats = getSearchResultStats(results);

      expect(stats.total).toBe(3);
      expect(stats.hybrid).toBe(1);
      expect(stats.ftsOnly).toBe(1);
      expect(stats.vectorOnly).toBe(1);
    });

    it('should calculate average score', () => {
      const ftsResults = [createMessage('msg-1')];
      const vectorResults = [createVectorResult('msg-1', 0.2)];

      const { results } = combineSearchResults(ftsResults, vectorResults);
      const stats = getSearchResultStats(results);

      expect(stats.avgScore).toBeGreaterThan(0);
      expect(stats.avgScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      applyRolloutPreset('production');
    });

    it('should handle empty inputs', () => {
      const ftsResults: TSMessage[] = [];
      const vectorResults: TSVectorResult[] = [];

      const { results } = combineSearchResults(ftsResults, vectorResults);

      expect(results).toHaveLength(0);
    });

    it('should handle messages with missing optional fields', () => {
      const msg: TSMessage = {
        id: 'msg-1',
        conversationId: 'conv-123',
        role: 'user',
        content: 'Test',
        // tokens and metadata omitted
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };

      const { results } = combineSearchResults([msg], []);

      expect(results).toHaveLength(1);
      expect(results[0].message.tokens).toBeUndefined();
      expect(results[0].message.metadata).toBeUndefined();
    });

    it('should handle very large result sets', () => {
      const ftsResults = Array.from({ length: 1000 }, (_, i) => createMessage(`msg-${i}`));
      const vectorResults: TSVectorResult[] = [];

      const { results } = combineSearchResults(ftsResults, vectorResults, { limit: 100 });

      expect(results).toHaveLength(100);
    });

    it('should handle duplicate message IDs gracefully', () => {
      const ftsResults = [
        createMessage('msg-1'),
        createMessage('msg-1'), // Duplicate
      ];
      const vectorResults: TSVectorResult[] = [];

      const { results } = combineSearchResults(ftsResults, vectorResults);

      // Should deduplicate
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      applyRolloutPreset('production');
    });

    it('should handle large result sets efficiently', () => {
      const ftsResults = Array.from({ length: 1000 }, (_, i) => createMessage(`msg-fts-${i}`));
      const vectorResults = Array.from({ length: 1000 }, (_, i) =>
        createVectorResult(`msg-vec-${i}`, Math.random())
      );

      const startTime = performance.now();

      const { results } = combineSearchResults(ftsResults, vectorResults);

      const endTime = performance.now();
      const elapsed = endTime - startTime;

      expect(results.length).toBeGreaterThan(0);
      // Should complete in under 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it('should track performance metrics when enabled', () => {
      const ftsResults = [createMessage('msg-1')];
      const vectorResults: TSVectorResult[] = [];

      const { metrics } = combineSearchResults(ftsResults, vectorResults);

      expect(metrics).toBeDefined();
      expect(metrics?.implementation).toBe('rescript');
      expect(metrics?.rescriptTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
