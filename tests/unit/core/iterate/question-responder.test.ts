/**
 * Unit tests for QuestionResponder
 *
 * Tests LLM-powered question answering for iterate mode.
 *
 * @module tests/unit/core/iterate/question-responder
 * @since v12.9.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  QuestionResponder,
  DEFAULT_MUST_PAUSE_PATTERNS,
  createDefaultQuestionResponderConfig,
  type ProviderExecutor
} from '../../../../src/core/iterate/question-responder.js';
import type { QuestionResponderConfig, QuestionContext } from '../../../../src/types/iterate.js';
import type { ExecutionResponse } from '../../../../src/types/provider.js';

describe('QuestionResponder', () => {
  let mockExecutor: ProviderExecutor;
  let responder: QuestionResponder;
  let defaultConfig: QuestionResponderConfig;

  const createMockResponse = (content: string, tokensUsed: number = 50): ExecutionResponse => ({
    content,
    model: 'gemini-test',
    tokensUsed: {
      prompt: tokensUsed / 2,
      completion: tokensUsed / 2,
      total: tokensUsed
    },
    latencyMs: 100,
    finishReason: 'stop'
  });

  const createContext = (question: string): QuestionContext => ({
    question,
    recentMessages: [],
    task: 'Refactor authentication module',
    agent: 'backend',
    mainProvider: 'claude'
  });

  beforeEach(() => {
    vi.useFakeTimers();

    mockExecutor = vi.fn();
    defaultConfig = {
      enabled: true,
      provider: 'gemini',
      confidenceThreshold: 0.7,
      maxAutoAnswers: 50,
      timeout: 30000,
      mustPausePatterns: [
        '(password|secret|api.?key)',
        '(which client|pricing)',
        '(production|prod) (database|server)'
      ]
    };

    responder = new QuestionResponder(
      defaultConfig,
      mockExecutor,
      'test-session-123',
      '/tmp/test-logs'
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isEnabled', () => {
    it('should return true when enabled', () => {
      expect(responder.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const disabledResponder = new QuestionResponder(
        { ...defaultConfig, enabled: false },
        mockExecutor,
        'test-session',
        '/tmp'
      );
      expect(disabledResponder.isEnabled()).toBe(false);
    });
  });

  describe('mustPause', () => {
    it('should return true for password questions', () => {
      expect(responder.mustPause('What password should I use?')).toBe(true);
    });

    it('should return true for API key questions', () => {
      expect(responder.mustPause('What is the API key?')).toBe(true);
    });

    it('should return true for apikey without space', () => {
      expect(responder.mustPause('What apikey should I use?')).toBe(true);
    });

    it('should return true for secret questions', () => {
      expect(responder.mustPause('What is the secret?')).toBe(true);
    });

    it('should return true for client questions', () => {
      expect(responder.mustPause('Which client is this for?')).toBe(true);
    });

    it('should return true for pricing questions', () => {
      expect(responder.mustPause('What is the pricing?')).toBe(true);
    });

    it('should return true for production database questions', () => {
      expect(responder.mustPause('What is the production database URL?')).toBe(true);
    });

    it('should return true for prod server questions', () => {
      expect(responder.mustPause('Which prod server should we deploy to?')).toBe(true);
    });

    it('should return false for technical questions', () => {
      expect(responder.mustPause('Should I use async/await or promises?')).toBe(false);
    });

    it('should return false for refactoring questions', () => {
      expect(responder.mustPause('Should I extract this into a separate function?')).toBe(false);
    });

    it('should return false for pattern questions', () => {
      expect(responder.mustPause('Factory pattern or builder pattern?')).toBe(false);
    });

    it('should return false for style questions', () => {
      expect(responder.mustPause('camelCase or snake_case?')).toBe(false);
    });
  });

  describe('answer', () => {
    it('should return answer when LLM provides good response', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('Use the factory pattern for this case because it provides better flexibility.')
      );

      const result = await responder.answer(createContext('Factory pattern or builder pattern?'));

      expect(result).not.toBeNull();
      expect(result?.answer).toContain('factory pattern');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result?.tokensUsed).toBe(50);
    });

    it('should return null when LLM responds with PAUSE_REQUIRED', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('PAUSE_REQUIRED - this needs human decision')
      );

      const result = await responder.answer(createContext('Which approach should I use?'));

      expect(result).toBeNull();
    });

    it('should return null when LLM responds with lowercase pause_required', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('pause_required - needs user input')
      );

      const result = await responder.answer(createContext('Which approach?'));

      expect(result).toBeNull();
    });

    it('should return null for blocked patterns without calling LLM', async () => {
      const result = await responder.answer(createContext('What password should I use?'));

      expect(result).toBeNull();
      expect(mockExecutor).not.toHaveBeenCalled();
    });

    it('should return null when below confidence threshold', async () => {
      // Response with uncertainty markers reduces confidence below threshold
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('Maybe try something? I think it could work possibly.')
      );

      const result = await responder.answer(createContext('Which pattern?'));

      expect(result).toBeNull();
    });

    it('should return null for empty response', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('')
      );

      const result = await responder.answer(createContext('Which pattern?'));

      expect(result).toBeNull();
    });

    it('should return null for very short response', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('Ok')
      );

      const result = await responder.answer(createContext('Which pattern?'));

      expect(result).toBeNull();
    });

    it('should track statistics correctly after successful answer', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('Use the factory pattern.', 30)
      );

      await responder.answer(createContext('Which pattern?'));
      const stats = responder.getStats();

      expect(stats.totalQuestions).toBe(1);
      expect(stats.autoAnswered).toBe(1);
      expect(stats.tokensUsed).toBe(30);
      expect(stats.pausedForUser).toBe(0);
    });

    it('should track statistics correctly after blocked pattern', async () => {
      await responder.answer(createContext('What password?'));
      const stats = responder.getStats();

      expect(stats.totalQuestions).toBe(1);
      expect(stats.autoAnswered).toBe(0);
      expect(stats.blockedByPattern).toBe(1);
      expect(stats.pausedForUser).toBe(1);
    });

    it('should track statistics correctly after below threshold', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('Maybe possibly perhaps.')
      );

      await responder.answer(createContext('Which pattern?'));
      const stats = responder.getStats();

      expect(stats.totalQuestions).toBe(1);
      expect(stats.autoAnswered).toBe(0);
      expect(stats.belowThreshold).toBe(1);
      expect(stats.pausedForUser).toBe(1);
    });

    it('should respect max auto-answers limit', async () => {
      // Create responder with low limit
      const limitedResponder = new QuestionResponder(
        { ...defaultConfig, maxAutoAnswers: 1 },
        mockExecutor,
        'test-session',
        '/tmp'
      );

      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('Use factory pattern.', 30)
      );

      // First should succeed
      const first = await limitedResponder.answer(createContext('Which pattern?'));
      expect(first).not.toBeNull();

      // Second should be blocked by limit
      const second = await limitedResponder.answer(createContext('Which approach?'));
      expect(second).toBeNull();

      const stats = limitedResponder.getStats();
      expect(stats.autoAnswered).toBe(1);
      expect(stats.totalQuestions).toBe(2);
    });

    it('should handle LLM execution errors gracefully', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Provider unavailable')
      );

      const result = await responder.answer(createContext('Which pattern?'));

      expect(result).toBeNull();
      expect(responder.getStats().pausedForUser).toBe(1);
    });

    it('should calculate averages correctly over multiple answers', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createMockResponse('Use factory pattern.', 20))
        .mockResolvedValueOnce(createMockResponse('Choose builder pattern.', 40));

      await responder.answer(createContext('Question 1?'));
      await responder.answer(createContext('Question 2?'));

      const stats = responder.getStats();
      expect(stats.autoAnswered).toBe(2);
      expect(stats.tokensUsed).toBe(60);
      expect(stats.avgConfidence).toBeGreaterThan(0);
    });
  });

  describe('confidence calculation', () => {
    it('should increase confidence for decisive answers', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('You should use the factory pattern for better flexibility.')
      );

      const result = await responder.answer(createContext('Which pattern?'));

      expect(result).not.toBeNull();
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it('should decrease confidence for uncertain answers', async () => {
      // This response has uncertainty markers
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('I think maybe the factory pattern might work, possibly.')
      );

      const result = await responder.answer(createContext('Which pattern?'));

      // Likely below threshold due to uncertainty
      expect(result).toBeNull();
    });

    it('should decrease confidence for answers with questions', async () => {
      (mockExecutor as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockResponse('Factory pattern is good. But what about your specific use case?')
      );

      const result = await responder.answer(createContext('Which pattern?'));

      // Should have lower confidence due to the question mark
      expect(result?.confidence || 0).toBeLessThan(0.9);
    });
  });

  describe('createDefaultQuestionResponderConfig', () => {
    it('should create disabled config by default', () => {
      const config = createDefaultQuestionResponderConfig();
      expect(config.enabled).toBe(false);
      expect(config.provider).toBe('gemini');
    });

    it('should create enabled config when specified', () => {
      const config = createDefaultQuestionResponderConfig(true, 'claude');
      expect(config.enabled).toBe(true);
      expect(config.provider).toBe('claude');
    });

    it('should include default must-pause patterns', () => {
      const config = createDefaultQuestionResponderConfig();
      expect(config.mustPausePatterns).toEqual(DEFAULT_MUST_PAUSE_PATTERNS);
    });
  });

  describe('DEFAULT_MUST_PAUSE_PATTERNS', () => {
    it('should include credential patterns', () => {
      const credentialPattern = DEFAULT_MUST_PAUSE_PATTERNS.find(p =>
        p.includes('password') || p.includes('secret')
      );
      expect(credentialPattern).toBeDefined();
    });

    it('should include business decision patterns', () => {
      const businessPattern = DEFAULT_MUST_PAUSE_PATTERNS.find(p =>
        p.includes('client') || p.includes('pricing')
      );
      expect(businessPattern).toBeDefined();
    });

    it('should include production environment patterns', () => {
      const prodPattern = DEFAULT_MUST_PAUSE_PATTERNS.find(p =>
        p.includes('production') || p.includes('prod')
      );
      expect(prodPattern).toBeDefined();
    });

    it('should include destructive operation patterns', () => {
      const destructivePattern = DEFAULT_MUST_PAUSE_PATTERNS.find(p =>
        p.includes('delete') || p.includes('drop')
      );
      expect(destructivePattern).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return initial stats when no questions processed', () => {
      const stats = responder.getStats();

      expect(stats.totalQuestions).toBe(0);
      expect(stats.autoAnswered).toBe(0);
      expect(stats.pausedForUser).toBe(0);
      expect(stats.blockedByPattern).toBe(0);
      expect(stats.belowThreshold).toBe(0);
      expect(stats.tokensUsed).toBe(0);
      expect(stats.avgConfidence).toBe(0);
      expect(stats.avgLatencyMs).toBe(0);
    });

    it('should return copy of stats (not reference)', () => {
      const stats1 = responder.getStats();
      const stats2 = responder.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });
});
