/**
 * Tests for LLM Triage Prompt Builder
 */

import { describe, it, expect } from 'vitest';
import { buildTriagePrompt, estimateTokens } from '@/core/bugfix/llm-triage/prompt-builder.js';
import type { BugFinding } from '@/core/bugfix/types.js';

function createMockFinding(overrides: Partial<BugFinding> = {}): BugFinding {
  return {
    id: 'test-finding-1',
    file: 'src/test.ts',
    lineStart: 10,
    lineEnd: 15,
    type: 'timer_leak',
    severity: 'medium',
    message: 'setInterval without cleanup',
    context: 'const interval = setInterval(() => tick(), 1000);',
    confidence: 0.75,
    detectionMethod: 'ast',
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Prompt Builder', () => {
  describe('buildTriagePrompt', () => {
    it('should build prompt for single finding', () => {
      const finding = createMockFinding();
      const prompt = buildTriagePrompt([finding]);

      expect(prompt.system).toContain('static analysis reviewer');
      expect(prompt.system).toContain('false positive');
      expect(prompt.user).toContain('test-finding-1');
      expect(prompt.user).toContain('timer_leak');
      expect(prompt.user).toContain('src/test.ts:10');
    });

    it('should build prompt for multiple findings', () => {
      const findings = [
        createMockFinding({ id: 'f1', type: 'timer_leak' }),
        createMockFinding({ id: 'f2', type: 'missing_destroy' }),
        createMockFinding({ id: 'f3', type: 'event_leak' }),
      ];
      const prompt = buildTriagePrompt(findings);

      expect(prompt.user).toContain('f1');
      expect(prompt.user).toContain('f2');
      expect(prompt.user).toContain('f3');
      expect(prompt.user).toContain('3 finding');
    });

    it('should include code context', () => {
      const finding = createMockFinding({
        context: 'const heartbeat = setInterval(() => ping(), 5000);',
      });
      const prompt = buildTriagePrompt([finding]);

      expect(prompt.user).toContain('heartbeat');
      expect(prompt.user).toContain('ping()');
    });

    it('should include fix strategy if present', () => {
      const finding = createMockFinding({
        fixStrategy: 'Add .unref() to the interval',
      });
      const prompt = buildTriagePrompt([finding]);

      expect(prompt.user).toContain('Add .unref()');
    });

    it('should format confidence as percentage', () => {
      const finding = createMockFinding({ confidence: 0.85 });
      const prompt = buildTriagePrompt([finding]);

      expect(prompt.user).toContain('85%');
    });

    it('should throw error for empty findings array', () => {
      expect(() => buildTriagePrompt([])).toThrow('Cannot build prompt for empty findings array');
    });

    it('should include response format instructions', () => {
      const prompt = buildTriagePrompt([createMockFinding()]);

      expect(prompt.system).toContain('JSON');
      expect(prompt.system).toContain('verdicts');
      expect(prompt.system).toContain('accepted');
      expect(prompt.system).toContain('confidence');
    });

    it('should include bug type reference', () => {
      const prompt = buildTriagePrompt([createMockFinding()]);

      expect(prompt.user).toContain('timer_leak');
      expect(prompt.user).toContain('missing_destroy');
      expect(prompt.user).toContain('event_leak');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const prompt = buildTriagePrompt([createMockFinding()]);
      const tokens = estimateTokens(prompt);

      // Should be positive
      expect(tokens).toBeGreaterThan(0);

      // Rough check: ~4 chars per token
      const totalChars = prompt.system.length + prompt.user.length;
      expect(tokens).toBe(Math.ceil(totalChars / 4));
    });

    it('should increase with more findings', () => {
      const singlePrompt = buildTriagePrompt([createMockFinding()]);
      const multiplePrompt = buildTriagePrompt([
        createMockFinding({ id: 'f1' }),
        createMockFinding({ id: 'f2' }),
        createMockFinding({ id: 'f3' }),
      ]);

      expect(estimateTokens(multiplePrompt)).toBeGreaterThan(estimateTokens(singlePrompt));
    });
  });
});
