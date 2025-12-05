/**
 * Iterate Classifier Tests
 *
 * Tests for the iterate mode classifier which classifies AI responses
 * to determine whether to auto-respond or pause for user input.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IterateClassifier } from '@/core/iterate/iterate-classifier.js';
import type { ClassifierConfig, ClassificationType } from '@/types/iterate.js';

describe('IterateClassifier', () => {
  let classifier: IterateClassifier;
  const defaultConfig: ClassifierConfig = {
    patternLibraryPath: 'tests/fixtures/iterate/sample-patterns.yaml',
    strictness: 'balanced',
    enableSemanticScoring: false,
    semanticScoringThreshold: 0.8,
    contextWindowMessages: 10
  };

  beforeEach(() => {
    classifier = new IterateClassifier(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('classify', () => {
    it('should return a classification result with low confidence when no patterns loaded', async () => {
      const result = await classifier.classify('Hello world', {
        message: 'Hello world',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('timestamp');
    });

    it('should classify messages after loading patterns', async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await classifier.classify('Should I proceed with the implementation?', {
        message: 'Should I proceed with the implementation?',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result.type).toBe('confirmation_prompt');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect genuine questions', async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await classifier.classify('Which approach would you prefer?', {
        message: 'Which approach would you prefer?',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result.type).toBe('genuine_question');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect status updates', async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await classifier.classify('I am working on implementing the feature now.', {
        message: 'I am working on implementing the feature now.',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result.type).toBe('status_update');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect completion signals', async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await classifier.classify('All tasks completed successfully.', {
        message: 'All tasks completed successfully.',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result.type).toBe('completion_signal');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect error signals', async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await classifier.classify('Error: Failed to connect to database', {
        message: 'Error: Failed to connect to database',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result.type).toBe('error_signal');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect blocking requests for credentials', async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await classifier.classify('API key required to continue', {
        message: 'API key required to continue',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result.type).toBe('blocking_request');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect rate limit signals', async () => {
      await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await classifier.classify('Rate limit exceeded, please try again later', {
        message: 'Rate limit exceeded, please try again later',
        recentMessages: [],
        provider: 'claude'
      });

      expect(result.type).toBe('rate_limit_or_context');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('loadPatterns', () => {
    it('should handle missing pattern file gracefully', async () => {
      // Should not throw, just log warning
      await expect(
        classifier.loadPatterns('/nonexistent/path/patterns.yaml')
      ).resolves.not.toThrow();
    });

    it('should load valid pattern file', async () => {
      await expect(
        classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml')
      ).resolves.not.toThrow();
    });
  });

  describe('provider markers', () => {
    it('should detect Claude thinking markers', async () => {
      const result = await classifier.classify(
        '<thinking>Let me analyze this problem step by step.</thinking>',
        {
          message: '<thinking>Let me analyze this problem step by step.</thinking>',
          recentMessages: [],
          provider: 'claude'
        }
      );

      expect(result.type).toBe('status_update');
    });
  });

  describe('contextual rules', () => {
    it('should detect questions after tool calls', async () => {
      const result = await classifier.classify('What would you like me to do next?', {
        message: 'What would you like me to do next?',
        recentMessages: [
          { role: 'assistant', content: 'File created', timestamp: new Date().toISOString() }
        ],
        provider: 'claude',
        recentToolCalls: ['write_file', 'read_file', 'edit_file', 'create_file']
      });

      // After multiple tool calls, should recognize status or question
      expect(['status_update', 'genuine_question']).toContain(result.type);
    });
  });
});
