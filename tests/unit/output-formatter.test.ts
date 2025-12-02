/**
 * Output Formatter Tests
 */

import { describe, it, expect } from 'vitest';
import { formatOutput, formatForSave } from '../../src/utils/output-formatter.js';
import type { ExecutionResult } from '../../src/agents/executor.js';
import type { ExecutionContext } from '../../src/types/agent.js';

describe('Output Formatter', () => {
  const mockContext: ExecutionContext = {
    agent: {
      name: 'test-agent',
      role: 'assistant',
      description: 'Test agent',
      systemPrompt: 'You are a test agent',
      abilities: [],
      model: 'claude-3',
      temperature: 0.7
    },
    task: 'Test task',
    memory: [],
    projectDir: '/test/project',
    workingDir: '/test/working',
    agentWorkspace: '/test/workspace',
    provider: {
      name: 'test-provider',
      execute: async () => ({
        content: 'Test response',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'claude-3',
        finishReason: 'stop' as const
      })
    } as any,
    abilities: '',
    createdAt: new Date()
  };

  const mockResult: ExecutionResult = {
    response: {
      content: 'This is a test response',
      tokensUsed: {
        prompt: 10,
        completion: 20,
        total: 30
      },
      latencyMs: 1234,
      model: 'claude-3',
      finishReason: 'stop'
    },
    duration: 1234,
    context: mockContext
  };

  describe('formatOutput', () => {
    describe('JSON format', () => {
      it('should format as valid JSON', () => {
        const output = formatOutput(mockResult, 'json', false);

        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('should include all required fields', () => {
        const output = formatOutput(mockResult, 'json', false);
        const parsed = JSON.parse(output);

        expect(parsed).toHaveProperty('content');
        expect(parsed).toHaveProperty('tokensUsed');
        expect(parsed).toHaveProperty('latencyMs');
        expect(parsed).toHaveProperty('model');
        expect(parsed).toHaveProperty('finishReason');
      });

      it('should have correct values', () => {
        const output = formatOutput(mockResult, 'json', false);
        const parsed = JSON.parse(output);

        expect(parsed.content).toBe('This is a test response');
        expect(parsed.tokensUsed.total).toBe(30);
        expect(parsed.latencyMs).toBe(1234);
        expect(parsed.model).toBe('claude-3');
        expect(parsed.finishReason).toBe('stop');
      });

      it('should handle missing token data', () => {
        const resultWithoutTokens: ExecutionResult = {
          ...mockResult,
          response: {
            ...mockResult.response,
            tokensUsed: undefined as any
          }
        };

        const output = formatOutput(resultWithoutTokens, 'json', false);
        const parsed = JSON.parse(output);

        expect(parsed.tokensUsed).toBeUndefined();
      });
    });

    describe('Markdown format', () => {
      it('should include markdown headers', () => {
        const output = formatOutput(mockResult, 'markdown', false);

        expect(output).toContain('# Execution Result');
        expect(output).toContain('## Response');
      });

      it('should include metadata', () => {
        const output = formatOutput(mockResult, 'markdown', false);

        expect(output).toContain('**Model**: claude-3');
        expect(output).toContain('**Latency**: 1234ms');
        expect(output).toContain('**Tokens**: 30');
      });

      it('should include response content', () => {
        const output = formatOutput(mockResult, 'markdown', false);

        expect(output).toContain('This is a test response');
      });

      it('should include token breakdown in verbose mode', () => {
        const output = formatOutput(mockResult, 'markdown', true);

        expect(output).toContain('## Token Usage');
        expect(output).toContain('- Prompt: 10');
        expect(output).toContain('- Completion: 20');
        expect(output).toContain('- Total: 30');
      });

      it('should not include token breakdown in non-verbose mode', () => {
        const output = formatOutput(mockResult, 'markdown', false);

        expect(output).not.toContain('## Token Usage');
      });

      it('should handle missing token data', () => {
        const resultWithoutTokens: ExecutionResult = {
          ...mockResult,
          response: {
            ...mockResult.response,
            tokensUsed: undefined as any
          }
        };

        const output = formatOutput(resultWithoutTokens, 'markdown', false);

        expect(output).toContain('**Tokens**: N/A');
      });
    });

    describe('Text format', () => {
      it('should include content in non-verbose mode', () => {
        const output = formatOutput(mockResult, 'text', false);

        expect(output).toContain('This is a test response');
      });

      it('should include metadata in verbose mode', () => {
        const output = formatOutput(mockResult, 'text', true);

        expect(output).toContain('Model: claude-3');
        expect(output).toContain('Latency: 1234ms');
        expect(output).toContain('Tokens: 30');
      });

      it('should not include metadata in non-verbose mode', () => {
        const output = formatOutput(mockResult, 'text', false);

        expect(output).not.toContain('Model:');
        expect(output).not.toContain('Latency:');
      });

      it('should handle missing token data', () => {
        const resultWithoutTokens: ExecutionResult = {
          ...mockResult,
          response: {
            ...mockResult.response,
            tokensUsed: undefined as any
          }
        };

        const output = formatOutput(resultWithoutTokens, 'text', true);

        // Should not crash, token line should not appear
        expect(output).not.toContain('Tokens:');
      });
    });
  });

  describe('formatForSave', () => {
    const metadata = {
      agent: 'test-agent',
      task: 'Test task',
      timestamp: '2025-10-05T00:00:00.000Z'
    };

    describe('JSON format', () => {
      it('should include metadata', () => {
        const output = formatForSave(mockResult, 'json', metadata);
        const parsed = JSON.parse(output);

        expect(parsed.agent).toBe('test-agent');
        expect(parsed.task).toBe('Test task');
        expect(parsed.timestamp).toBe('2025-10-05T00:00:00.000Z');
      });

      it('should include result data', () => {
        const output = formatForSave(mockResult, 'json', metadata);
        const parsed = JSON.parse(output);

        expect(parsed.result).toBeDefined();
        expect(parsed.result.content).toBe('This is a test response');
        expect(parsed.result.tokensUsed.total).toBe(30);
        expect(parsed.result.latencyMs).toBe(1234);
      });

      it('should use current timestamp if not provided', () => {
        const metadataWithoutTimestamp = {
          agent: 'test-agent',
          task: 'Test task'
        };

        const output = formatForSave(mockResult, 'json', metadataWithoutTimestamp);
        const parsed = JSON.parse(output);

        expect(parsed.timestamp).toBeDefined();
        expect(typeof parsed.timestamp).toBe('string');
        // Check it's a valid ISO string
        expect(() => new Date(parsed.timestamp)).not.toThrow();
      });
    });

    describe('Text format', () => {
      it('should return formatted text', () => {
        const output = formatForSave(mockResult, 'text', metadata);

        // formatForSave calls formatOutput with verbose=true
        // In verbose mode, text format shows metadata not content
        expect(output).toContain('Model: claude-3');
        expect(output).toContain('Latency: 1234ms');
      });
    });

    describe('Markdown format', () => {
      it('should return formatted markdown', () => {
        const output = formatForSave(mockResult, 'markdown', metadata);

        expect(output).toContain('# Execution Result');
        expect(output).toContain('**Model**: claude-3');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty content', () => {
      const emptyResult: ExecutionResult = {
        ...mockResult,
        response: {
          ...mockResult.response,
          content: ''
        }
      };

      expect(() => formatOutput(emptyResult, 'json', false)).not.toThrow();
      expect(() => formatOutput(emptyResult, 'markdown', false)).not.toThrow();
      expect(() => formatOutput(emptyResult, 'text', false)).not.toThrow();
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      const longResult: ExecutionResult = {
        ...mockResult,
        response: {
          ...mockResult.response,
          content: longContent
        }
      };

      const jsonOutput = formatOutput(longResult, 'json', false);
      const mdOutput = formatOutput(longResult, 'markdown', false);
      const textOutput = formatOutput(longResult, 'text', false);

      expect(jsonOutput).toContain(longContent);
      expect(mdOutput).toContain(longContent);
      expect(textOutput).toContain(longContent);
    });

    it('should handle special characters', () => {
      const specialContent = 'Test with "quotes", \'apostrophes\', and \n newlines \t tabs';
      const specialResult: ExecutionResult = {
        ...mockResult,
        response: {
          ...mockResult.response,
          content: specialContent
        }
      };

      const jsonOutput = formatOutput(specialResult, 'json', false);
      expect(() => JSON.parse(jsonOutput)).not.toThrow();
    });
  });
});
