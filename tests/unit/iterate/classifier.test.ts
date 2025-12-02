/**
 * Iterate Classifier Tests
 *
 * Tests for AI response classification system
 *
 * @module tests/unit/iterate/classifier.test
 * @since v6.4.0 (Week 1 scaffolding)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IterateClassifier } from '../../../src/core/iterate/iterate-classifier.js';
import type {
  ClassifierConfig,
  Classification,
  ClassificationContext
} from '../../../src/types/iterate.js';

describe('IterateClassifier', () => {
  let classifier: IterateClassifier;
  let mockConfig: ClassifierConfig;

  beforeEach(() => {
    // Mock classifier configuration
    mockConfig = {
      strictness: 'balanced',
      patternLibraryPath: '.automatosx/iterate/patterns.yaml',
      enableSemanticScoring: false,
      semanticScoringThreshold: 0.75,
      contextWindowMessages: 10
    };

    classifier = new IterateClassifier(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create classifier with config', () => {
      expect(classifier).toBeDefined();
      expect(classifier).toBeInstanceOf(IterateClassifier);
    });

    it('should accept all strictness levels', () => {
      const paranoid = new IterateClassifier({ ...mockConfig, strictness: 'paranoid' });
      const balanced = new IterateClassifier({ ...mockConfig, strictness: 'balanced' });
      const permissive = new IterateClassifier({ ...mockConfig, strictness: 'permissive' });

      expect(paranoid).toBeDefined();
      expect(balanced).toBeDefined();
      expect(permissive).toBeDefined();
    });
  });

  describe('classify() - Week 2 Implementation', () => {
    it('should classify confirmation prompts correctly', async () => {
      const message = 'Should I proceed?';
      const context: ClassificationContext = {
        message,
        recentMessages: [],
        provider: 'claude-code',
        stageId: 'planning'
      };

      const result = await classifier.classify(message, context);

      expect(result).toBeDefined();
      expect(result.type).toBe('confirmation_prompt'); // Week 2: Real classification
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      // Method could be pattern_library or contextual_rules (both work)
      expect(['pattern_library', 'contextual_rules']).toContain(result.method);
      expect(result.reason).toBeDefined();
    });

    it('should include timestamp in classification', async () => {
      const message = 'Test message';
      const context: ClassificationContext = {
        message,
        recentMessages: [],
        provider: 'gemini-cli'
      };

      const result = await classifier.classify(message, context);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should include latency metrics', async () => {
      const message = 'Test message';
      const context: ClassificationContext = {
        message,
        recentMessages: [],
        provider: 'openai'
      };

      const result = await classifier.classify(message, context);

      expect(result.context).toBeDefined();
      expect(result.context?.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('loadPatterns() - Week 1 Skeleton', () => {
    it('should accept pattern library path', async () => {
      // Week 1: No-op, just verify it doesn't throw
      await expect(
        classifier.loadPatterns('.automatosx/iterate/patterns.yaml')
      ).resolves.not.toThrow();
    });
  });

  describe('updatePatterns() - Week 1 Skeleton', () => {
    it('should accept pattern library update', async () => {
      const mockPatterns = {
        version: '1.0.0',
        patterns: {}
      };

      // Week 1: No-op, just verify it doesn't throw
      await expect(
        classifier.updatePatterns(mockPatterns as any)
      ).resolves.not.toThrow();
    });
  });

  describe('getAccuracyStats() - Week 1 Skeleton', () => {
    it('should return placeholder stats', () => {
      const stats = classifier.getAccuracyStats();

      expect(stats).toBeDefined();
      expect(stats.precision).toBe(0);
      expect(stats.recall).toBe(0);
      expect(stats.f1).toBe(0);
      expect(stats.totalClassifications).toBe(0);
    });
  });

  // Phase 2 (Week 2): Advanced classification tests
  // Placeholder for comprehensive testing when pattern library and semantic analysis are implemented
  describe.skip('Classification Logic - Phase 2', () => {
    it('should match patterns for each classification type', () => {
      // Test pattern matching: confirmation_prompt, clarification_request, error_message, etc.
    });

    it('should load and validate pattern library from YAML', () => {
      // Test YAML parsing, validation, regex compilation, priority ordering
    });

    it('should apply contextual rules and provider-specific markers', () => {
      // Test context-aware classification
    });

    it('should perform semantic scoring when enabled', () => {
      // Test semantic analysis (if implemented)
    });

    it('should meet performance benchmarks (< 100ms)', () => {
      // Test classification speed
    });

    it('should handle edge cases (empty, long text, unicode, multiple/no matches)', () => {
      // Comprehensive edge case coverage
    });
  });
});
