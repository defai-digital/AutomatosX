/**
 * Unit tests for AxCliResponseParser (v10.0.0)
 */

import { describe, it, expect } from 'vitest';
import { AxCliResponseParser } from '../../../../src/integrations/ax-cli/response-parser.js';

describe('AxCliResponseParser', () => {
  const parser = new AxCliResponseParser();

  describe('parse', () => {
    it('should parse simple JSONL response', () => {
      const stdout = `{"role":"user","content":"test prompt"}
{"role":"assistant","content":"test response"}`;

      const result = parser.parse(stdout, 'glm-4.6');

      expect(result.content).toBe('test response');
      expect(result.model).toBe('glm-4.6');
      expect(result.finishReason).toBe('stop');
      expect(result.cached).toBe(false);
    });

    it('should parse multiple assistant messages', () => {
      const stdout = `{"role":"user","content":"test"}
{"role":"assistant","content":"response 1"}
{"role":"assistant","content":"response 2"}`;

      const result = parser.parse(stdout);

      expect(result.content).toBe('response 1\n\nresponse 2');
    });

    it('should ignore user messages', () => {
      const stdout = `{"role":"user","content":"prompt 1"}
{"role":"assistant","content":"response"}
{"role":"user","content":"prompt 2"}`;

      const result = parser.parse(stdout);

      expect(result.content).toBe('response');
      expect(result.content).not.toContain('prompt 1');
      expect(result.content).not.toContain('prompt 2');
    });

    it('should ignore system messages', () => {
      const stdout = `{"role":"system","content":"system message"}
{"role":"assistant","content":"response"}`;

      const result = parser.parse(stdout);

      expect(result.content).toBe('response');
      expect(result.content).not.toContain('system message');
    });

    it('should handle whitespace and empty lines', () => {
      const stdout = `
{"role":"user","content":"test"}

{"role":"assistant","content":"response"}

`;

      const result = parser.parse(stdout);

      expect(result.content).toBe('response');
    });

    it('should use default model when not provided', () => {
      const stdout = `{"role":"assistant","content":"response"}`;

      const result = parser.parse(stdout);

      expect(result.model).toBe('unknown');
    });

    it('should throw error on empty output', () => {
      expect(() => parser.parse('')).toThrow('Empty output from ax-cli');
    });

    it('should throw error when no assistant response found', () => {
      const stdout = `{"role":"user","content":"test"}`;

      expect(() => parser.parse(stdout)).toThrow('No assistant response found');
    });

    it('should detect and throw error messages', () => {
      const stdout = `{"role":"assistant","content":"Sorry, I encountered an error: API error"}`;

      expect(() => parser.parse(stdout)).toThrow('ax-cli error: API error');
    });

    it('should handle invalid JSON lines gracefully', () => {
      const stdout = `{"role":"user","content":"test"}
invalid json line
{"role":"assistant","content":"response"}`;

      const result = parser.parse(stdout);

      expect(result.content).toBe('response');
    });

    it('should handle malformed messages gracefully', () => {
      const stdout = `{"role":"user"}
{"role":"assistant","content":"response"}`;

      const result = parser.parse(stdout);

      expect(result.content).toBe('response');
    });

    it('should handle long responses', () => {
      const longContent = 'A'.repeat(10000);
      const stdout = `{"role":"assistant","content":"${longContent}"}`;

      const result = parser.parse(stdout);

      expect(result.content).toBe(longContent);
      expect(result.content.length).toBe(10000);
    });

    it('should handle special characters in content', () => {
      const stdout = `{"role":"assistant","content":"Response with \\n newlines and \\"quotes\\""}`;

      const result = parser.parse(stdout);

      expect(result.content).toContain('newlines');
      expect(result.content).toContain('quotes');
    });

    it('should set usage to zeros (not provided by ax-cli)', () => {
      const stdout = `{"role":"assistant","content":"response"}`;

      const result = parser.parse(stdout);

      expect(result.tokensUsed.prompt).toBe(0);
      expect(result.tokensUsed.completion).toBe(0);
      expect(result.tokensUsed.total).toBe(0);
    });

    it('should accumulate token usage across multiple messages', () => {
      const stdout = [
        '{"role":"assistant","content":"part 1","usage":{"input_tokens":10,"output_tokens":20}}',
        '{"role":"assistant","content":"part 2","usage":{"input_tokens":5,"output_tokens":15}}'
      ].join('\n');

      const result = parser.parse(stdout);

      // Should accumulate: 10+5=15 input, 20+15=35 output, total=50
      expect(result.tokensUsed.prompt).toBe(15);
      expect(result.tokensUsed.completion).toBe(35);
      expect(result.tokensUsed.total).toBe(50);
      expect(result.content).toBe('part 1\n\npart 2');
    });

    it('should handle mixed messages with and without usage', () => {
      const stdout = [
        '{"role":"assistant","content":"part 1","usage":{"input_tokens":10,"output_tokens":20}}',
        '{"role":"assistant","content":"part 2"}',  // No usage
        '{"role":"assistant","content":"part 3","usage":{"input_tokens":8,"output_tokens":12}}'
      ].join('\n');

      const result = parser.parse(stdout);

      // Should accumulate only messages with usage: 10+8=18 input, 20+12=32 output, total=50
      expect(result.tokensUsed.prompt).toBe(18);
      expect(result.tokensUsed.completion).toBe(32);
      expect(result.tokensUsed.total).toBe(50);
      expect(result.content).toBe('part 1\n\npart 2\n\npart 3');
    });

    // Bug #9 fix: Regex catastrophic backtracking prevention
    it('should handle long error messages without catastrophic backtracking', () => {
      // Create a long error message that could cause backtracking with greedy regex
      const longError = 'a'.repeat(10000);
      const stdout = `{"role":"assistant","content":"Sorry, I encountered an error: ${longError}"}`;

      // Should throw error without hanging
      expect(() => parser.parse(stdout)).toThrow(/ax-cli error:/);
    });

    it('should handle error messages with special regex characters', () => {
      const stdout = `{"role":"assistant","content":"Sorry, I encountered an error: Error with . and * and +"}`;

      // Should parse without regex issues
      expect(() => parser.parse(stdout)).toThrow('ax-cli error: Error with . and * and +');
    });

    // Bug #10 fix: Unbounded array growth prevention
    it('should reject responses with too many assistant messages', () => {
      // Create 1001 assistant messages (exceeds MAX_ASSISTANT_MESSAGES = 1000)
      const messages = [];
      for (let i = 0; i < 1001; i++) {
        messages.push(`{"role":"assistant","content":"message ${i}"}`);
      }
      const stdout = messages.join('\n');

      // Should throw error about too many messages
      expect(() => parser.parse(stdout)).toThrow(/Too many assistant messages/);
    });

    it('should accept responses with exactly MAX_ASSISTANT_MESSAGES', () => {
      // Create exactly 1000 assistant messages (at the limit)
      const messages = [];
      for (let i = 0; i < 1000; i++) {
        messages.push(`{"role":"assistant","content":"message ${i}"}`);
      }
      const stdout = messages.join('\n');

      // Should parse successfully
      const result = parser.parse(stdout);
      expect(result.content).toContain('message 0');
      expect(result.content).toContain('message 999');
    });
  });

  describe('extractError', () => {
    it('should extract error from error message', () => {
      const stdout = `{"role":"assistant","content":"Sorry, I encountered an error: Network timeout"}`;

      const error = parser.extractError(stdout);

      expect(error).toBe('Network timeout');
    });

    it('should return null when no error found', () => {
      const stdout = `{"role":"assistant","content":"Normal response"}`;

      const error = parser.extractError(stdout);

      expect(error).toBeNull();
    });

    it('should return error message when error format is unexpected', () => {
      const stdout = `{"role":"assistant","content":"Sorry, I encountered an error"}`;

      const error = parser.extractError(stdout);

      // Returns 'API error' as fallback when no specific error text after the phrase
      expect(error).toBe('API error');
    });

    it('should handle invalid JSON gracefully', () => {
      const stdout = `invalid json`;

      const error = parser.extractError(stdout);

      expect(error).toBeNull();
    });

    it('should handle empty output', () => {
      const error = parser.extractError('');

      expect(error).toBeNull();
    });
  });
});
