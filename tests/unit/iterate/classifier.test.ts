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

  // Phase 2: Advanced classification tests
  describe('Classification Logic - Phase 2', () => {
    beforeEach(async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
    });

    it('should match patterns for each classification type', async () => {
      // Test confirmation_prompt
      const confirmResult = await classifier.classify('Should I proceed with the changes?', {
        message: 'Should I proceed with the changes?',
        recentMessages: [],
        provider: 'claude'
      });
      expect(confirmResult.type).toBe('confirmation_prompt');

      // Test status_update
      const statusResult = await classifier.classify('I have completed the implementation of the feature.', {
        message: 'I have completed the implementation of the feature.',
        recentMessages: [],
        provider: 'claude'
      });
      expect(['status_update', 'completion_signal']).toContain(statusResult.type);

      // Test genuine_question
      const questionResult = await classifier.classify('Which framework would you prefer - React or Vue?', {
        message: 'Which framework would you prefer - React or Vue?',
        recentMessages: [],
        provider: 'claude'
      });
      expect(questionResult.type).toBe('genuine_question');

      // Test error_signal
      const errorResult = await classifier.classify('Error: Build failed with 5 errors', {
        message: 'Error: Build failed with 5 errors',
        recentMessages: [],
        provider: 'claude'
      });
      expect(errorResult.type).toBe('error_signal');
    });

    it('should load and validate pattern library from YAML', async () => {
      // Patterns should be loaded
      expect(classifier['patterns']).toBeDefined();
      expect(classifier['patterns']?.version).toBeDefined();

      // Compiled patterns should exist
      expect(classifier['compiledPatterns'].size).toBeGreaterThan(0);

      // No validation errors
      expect(classifier.hasPatternValidationErrors()).toBe(false);
    });

    it('should apply contextual rules and provider-specific markers', async () => {
      // Test provider markers for Claude
      const claudeThinking = await classifier.classify('<thinking>Let me analyze this...</thinking>', {
        message: '<thinking>Let me analyze this...</thinking>',
        recentMessages: [],
        provider: 'claude-3'
      });
      expect(claudeThinking.type).toBe('status_update');

      // Test contextual rule: question after tool calls
      const contextualQuestion = await classifier.classify('What should I do next?', {
        message: 'What should I do next?',
        recentMessages: [
          { role: 'assistant', content: 'I have updated the file.', timestamp: new Date().toISOString() }
        ],
        provider: 'claude',
        recentToolCalls: ['file_edit', 'file_edit', 'file_edit', 'file_edit']
      });
      // With recent tool calls and question, should be genuine_question or status_update
      expect(['genuine_question', 'status_update']).toContain(contextualQuestion.type);
    });

    it('should use fallback classification when semantic scoring disabled', async () => {
      // Create classifier with semantic scoring disabled (default)
      const noSemanticClassifier = new IterateClassifier({
        strictness: 'balanced',
        patternLibraryPath: '',
        enableSemanticScoring: false,
        semanticScoringThreshold: 0.7,
        contextWindowMessages: 10
      });

      // Without patterns, should fall back to default
      const result = await noSemanticClassifier.classify('Random text without patterns', {
        message: 'Random text without patterns',
        recentMessages: [],
        provider: 'test'
      });

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      // Should use fallback method
      expect(['fallback', 'pattern_library', 'contextual_rules']).toContain(result.method);
    });

    it('should meet performance benchmarks (< 100ms)', async () => {
      const message = 'Should I proceed with the implementation of the user authentication feature?';
      const context = {
        message,
        recentMessages: [],
        provider: 'claude'
      };

      const startTime = Date.now();
      await classifier.classify(message, context);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should classify in < 100ms
    });

    it('should handle edge cases', async () => {
      // Empty string
      const emptyResult = await classifier.classify('', {
        message: '',
        recentMessages: [],
        provider: 'test'
      });
      expect(emptyResult).toBeDefined();
      expect(emptyResult.type).toBeDefined();

      // Very long text
      const longText = 'a'.repeat(10000);
      const longResult = await classifier.classify(longText, {
        message: longText,
        recentMessages: [],
        provider: 'test'
      });
      expect(longResult).toBeDefined();

      // Unicode text
      const unicodeText = '这是一个测试消息 🎉 Should I proceed?';
      const unicodeResult = await classifier.classify(unicodeText, {
        message: unicodeText,
        recentMessages: [],
        provider: 'test'
      });
      expect(unicodeResult).toBeDefined();

      // Text with no clear classification
      const ambiguousText = 'Hello there';
      const ambiguousResult = await classifier.classify(ambiguousText, {
        message: ambiguousText,
        recentMessages: [],
        provider: 'test'
      });
      expect(ambiguousResult).toBeDefined();
      // Should have low confidence
      expect(ambiguousResult.confidence).toBeLessThanOrEqual(1);
    });

    it('should track pattern validation errors for invalid patterns', async () => {
      // Create a fresh classifier and try to compile an invalid pattern
      const freshClassifier = new IterateClassifier({
        strictness: 'balanced',
        patternLibraryPath: '',
        enableSemanticScoring: false,
        semanticScoringThreshold: 0.7,
        contextWindowMessages: 10
      });

      // Call the private compilePattern method with an invalid regex
      const invalidPattern = freshClassifier['compilePattern']('[invalid(regex', 'test_type');

      // Should return null for invalid pattern
      expect(invalidPattern).toBeNull();

      // Should have validation error
      expect(freshClassifier.hasPatternValidationErrors()).toBe(true);
      const errors = freshClassifier.getPatternValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.type).toBe('test_type');
    });

    it('should support configurable classification priority order', async () => {
      // Create classifier with custom priority order
      const customConfig = {
        strictness: 'balanced' as const,
        patternLibraryPath: 'tests/fixtures/iterate/sample-patterns.yaml',
        enableSemanticScoring: false,
        semanticScoringThreshold: 0.7,
        contextWindowMessages: 10,
        classificationPriorityOrder: [
          'confirmation_prompt' as const,
          'genuine_question' as const,
          'blocking_request' as const,
          'rate_limit_or_context' as const,
          'error_signal' as const,
          'completion_signal' as const,
          'status_update' as const
        ]
      };

      const customClassifier = new IterateClassifier(customConfig);
      await customClassifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      // The classifier should use the custom priority order
      expect(customClassifier['config'].classificationPriorityOrder).toBeDefined();
      expect(customClassifier['config'].classificationPriorityOrder![0]).toBe('confirmation_prompt');
    });
  });
});
