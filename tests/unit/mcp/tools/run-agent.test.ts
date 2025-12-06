/**
 * MCP Tool Tests: run_agent
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRunAgentHandler } from '../../../../src/mcp/tools/run-agent.js';
import type { RunAgentInput } from '../../../../src/mcp/types.js';
import { ValidationError } from '../../../../src/mcp/utils/validation.js';

// Create mock execute function
const mockExecute = vi.fn();

// Mock AgentExecutor class
vi.mock('../../../../src/agents/executor.js', () => {
  return {
    AgentExecutor: class MockAgentExecutor {
      execute = mockExecute;
    }
  };
});

describe('MCP Tool: run_agent', () => {
  let mockContextManager: any;

  beforeEach(() => {
    // Mock ContextManager
    mockContextManager = {
      createContext: vi.fn()
    };

    // Reset the mock
    mockExecute.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject empty agent name', async () => {
      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: '',
        task: 'test task'
      };

      await expect(handler(input)).rejects.toThrow(ValidationError);
      await expect(handler(input)).rejects.toThrow('cannot be empty');
    });

    it('should reject invalid agent name with special characters', async () => {
      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'agent;rm -rf',
        task: 'test task'
      };

      await expect(handler(input)).rejects.toThrow(ValidationError);
      await expect(handler(input)).rejects.toThrow('must contain only letters');
    });

    it('should reject empty task', async () => {
      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: ''
      };

      await expect(handler(input)).rejects.toThrow(ValidationError);
      await expect(handler(input)).rejects.toThrow('is required');
    });

    it('should reject task exceeding maximum length', async () => {
      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: 'a'.repeat(10001) // Exceeds maxLength: 10000
      };

      await expect(handler(input)).rejects.toThrow(ValidationError);
      await expect(handler(input)).rejects.toThrow('too long');
    });
  });

  describe('Successful Execution', () => {
    it('should execute agent and return result', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task',
        provider: 'claude'
      };

      const mockResult = {
        response: {
          content: 'Agent response',
          tokensUsed: {
            prompt: 100,
            completion: 200,
            total: 300
          }
        }
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue(mockResult);

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: 'test task'
      };

      const result = await handler(input);

      expect(result.content).toBe('Agent response');
      expect(result.agent).toBe('test-agent');
      expect(result.tokens).toEqual({
        prompt: 100,
        completion: 200,
        total: 300
      });
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify context creation
      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'test-agent',
        'test task',
        { provider: undefined, skipMemory: undefined }
      );

      // Verify execution
      expect(mockExecute).toHaveBeenCalledWith(
        mockContext,
        { showProgress: false, verbose: false }
      );
    });

    it('should handle result without tokens', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task'
      };

      const mockResult = {
        response: {
          content: 'Agent response'
          // No tokensUsed
        }
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue(mockResult);

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: 'test task'
      };

      const result = await handler(input);

      expect(result.content).toBe('Agent response');
      expect(result.tokens).toBeUndefined();
    });

    it('should pass provider parameter', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task',
        provider: 'gemini'
      };

      const mockResult = {
        response: { content: 'Response' }
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue(mockResult);

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: 'test task',
        provider: 'gemini'
      };

      await handler(input);

      // Provider should be mapped from 'gemini' (MCP) to 'gemini-cli' (actual)
      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'test-agent',
        'test task',
        { provider: 'gemini-cli', skipMemory: undefined }
      );
    });

    it('should pass no_memory parameter', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task'
      };

      const mockResult = {
        response: { content: 'Response' }
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue(mockResult);

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: 'test task',
        no_memory: true
      };

      await handler(input);

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'test-agent',
        'test task',
        { provider: undefined, skipMemory: true }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle context creation failure', async () => {
      mockContextManager.createContext.mockRejectedValue(
        new Error('Agent not found')
      );

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'nonexistent',
        task: 'test task'
      };

      await expect(handler(input)).rejects.toThrow('Agent not found');
    });

    it('should handle execution failure', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockRejectedValue(new Error('Provider timeout'));

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: 'test task'
      };

      await expect(handler(input)).rejects.toThrow('Provider timeout');
    });
  });
});
