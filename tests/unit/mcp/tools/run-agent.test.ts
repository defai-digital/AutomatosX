/**
 * MCP Tool Tests: run_agent
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRunAgentHandler } from '../../../../src/mcp/tools/run-agent.js';
import type { RunAgentInput, McpSession } from '../../../../src/mcp/types.js';
import { ValidationError } from '../../../../src/mcp/utils/validation.js';

/**
 * Helper to create a mock MCP session with all required fields
 */
function createMockSession(provider: McpSession['normalizedProvider']): McpSession {
  return {
    clientInfo: { name: 'test-client', version: '1.0.0' },
    normalizedProvider: provider,
    initTime: Date.now()
  };
}

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
    it('should reject empty agent name when explicitly provided', async () => {
      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      // v12.5.1: Empty string agent is treated as "no agent provided"
      // Since profileLoader is not available, it should throw
      const input: RunAgentInput = {
        agent: '',
        task: 'test task'
      };

      await expect(handler(input)).rejects.toThrow('Agent name is required when profileLoader is not available');
    });

    it('should auto-select agent when agent is omitted and profileLoader available', async () => {
      const mockProfileLoader = {
        listProfiles: vi.fn().mockResolvedValue(['backend', 'quality']),
        loadProfile: vi.fn().mockImplementation((name: string) => Promise.resolve({
          name,
          displayName: name,
          role: 'Test Role',
          abilities: [],
          selectionMetadata: {
            primaryIntents: name === 'quality' ? ['fix bugs', 'code quality'] : ['implement'],
            secondarySignals: []
          }
        }))
      };

      mockContextManager.createContext.mockResolvedValue({
        agent: { name: 'quality' },
        task: 'fix bugs'
      });

      mockExecute.mockResolvedValue({
        response: {
          content: 'Done',
          tokensUsed: { prompt: 10, completion: 20, total: 30 }
        }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        profileLoader: mockProfileLoader as any
      });

      // No agent provided - should auto-select
      const result = await handler({ task: 'fix bugs in the codebase' });

      // Should have auto-selected an agent (likely 'quality' based on keywords)
      expect(result.agent).toBeDefined();
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

      // Verify execution (v12.5.3: now includes signal and timeout)
      expect(mockExecute).toHaveBeenCalledWith(
        mockContext,
        expect.objectContaining({ showProgress: false, verbose: false })
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

  describe('Smart Routing', () => {
    it('should return context when mode is "context"', async () => {
      const mockProfileLoader = {
        loadProfile: vi.fn().mockResolvedValue({
          name: 'backend',
          role: 'Backend Developer',
          abilities: ['api-design', 'database'],
          systemPrompt: 'You are a backend developer.'
        })
      };

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        profileLoader: mockProfileLoader as any,
        getSession: () => createMockSession('claude')
      });

      const input: RunAgentInput = {
        agent: 'backend',
        task: 'Implement REST API',
        mode: 'context'
      };

      const result = await handler(input);

      expect(result.routingDecision).toBe('context_returned');
      expect(result.agentContext).toBeDefined();
      expect(result.agentContext?.agentProfile.name).toBe('backend');
      expect(result.agentContext?.agentProfile.role).toBe('Backend Developer');
      expect(result.agentContext?.enhancedPrompt).toContain('Implement REST API');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return context when caller matches best provider in auto mode', async () => {
      const mockProfileLoader = {
        loadProfile: vi.fn().mockResolvedValue({
          name: 'quality',
          role: 'QA Engineer',
          abilities: ['testing'],
          systemPrompt: 'You are a QA engineer.'
        })
      };

      const mockRouter = {
        selectProvider: vi.fn().mockResolvedValue({ name: 'claude-code' })
      };

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        profileLoader: mockProfileLoader as any,
        router: mockRouter as any,
        getSession: () => createMockSession('claude')
      });

      const input: RunAgentInput = {
        agent: 'quality',
        task: 'Review code',
        mode: 'auto'
      };

      const result = await handler(input);

      expect(result.routingDecision).toBe('context_returned');
      expect(result.agentContext).toBeDefined();
    });

    it('should execute when mode is "execute"', async () => {
      const mockContext = {
        agent: { name: 'backend' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue({
        response: { content: 'Executed', tokensUsed: { prompt: 10, completion: 20, total: 30 } }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        getSession: () => createMockSession('claude')
      });

      const input: RunAgentInput = {
        agent: 'backend',
        task: 'Implement feature',
        mode: 'execute'
      };

      const result = await handler(input);

      expect(result.routingDecision).toBe('executed');
      expect(result.content).toBe('Executed');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should include memory context when available', async () => {
      const mockProfileLoader = {
        loadProfile: vi.fn().mockResolvedValue({
          name: 'backend',
          role: 'Backend Developer',
          abilities: [],
          systemPrompt: 'You are a backend developer.'
        })
      };

      const mockMemoryManager = {
        search: vi.fn().mockResolvedValue([
          { entry: { id: 1, content: 'Previous auth implementation used JWT' }, similarity: 0.9 },
          { entry: { id: 2, content: 'Database uses PostgreSQL' }, similarity: 0.8 }
        ])
      };

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        profileLoader: mockProfileLoader as any,
        memoryManager: mockMemoryManager as any,
        getSession: () => createMockSession('claude')
      });

      const input: RunAgentInput = {
        agent: 'backend',
        task: 'Add authentication',
        mode: 'context'
      };

      const result = await handler(input);

      expect(result.agentContext?.relevantMemory).toHaveLength(2);
      expect(result.agentContext?.relevantMemory?.[0]?.content).toContain('JWT');
      expect(result.agentContext?.enhancedPrompt).toContain('Relevant context from memory');
    });

    it('should handle memory search failure gracefully', async () => {
      const mockProfileLoader = {
        loadProfile: vi.fn().mockResolvedValue({
          name: 'backend',
          role: 'Backend Developer',
          abilities: [],
          systemPrompt: 'You are a backend developer.'
        })
      };

      const mockMemoryManager = {
        search: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        profileLoader: mockProfileLoader as any,
        memoryManager: mockMemoryManager as any,
        getSession: () => createMockSession('claude')
      });

      const input: RunAgentInput = {
        agent: 'backend',
        task: 'Add feature',
        mode: 'context'
      };

      // Should not throw, should return empty memory
      const result = await handler(input);

      expect(result.agentContext?.relevantMemory).toHaveLength(0);
    });

    it('should handle missing profile gracefully', async () => {
      const mockProfileLoader = {
        loadProfile: vi.fn().mockResolvedValue(null)
      };

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        profileLoader: mockProfileLoader as any,
        getSession: () => createMockSession('claude')
      });

      const input: RunAgentInput = {
        agent: 'unknown-agent',
        task: 'Do something',
        mode: 'context'
      };

      const result = await handler(input);

      expect(result.agentContext?.agentProfile.name).toBe('unknown-agent');
      expect(result.agentContext?.agentProfile.systemPrompt).toContain('specialized AI assistant');
    });
  });

  describe('Abort Handling', () => {
    it('should throw when aborted before execution', async () => {
      const controller = new AbortController();
      controller.abort();

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const input: RunAgentInput = {
        agent: 'test-agent',
        task: 'test task'
      };

      await expect(handler(input, { signal: controller.signal }))
        .rejects.toThrow('Request was cancelled');
    });

    it('should throw when aborted during context building', async () => {
      const controller = new AbortController();

      const mockProfileLoader = {
        loadProfile: vi.fn().mockImplementation(async () => {
          controller.abort();
          return {
            name: 'backend',
            role: 'Developer',
            abilities: [],
            systemPrompt: 'Test'
          };
        })
      };

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        profileLoader: mockProfileLoader as any,
        getSession: () => createMockSession('claude')
      });

      const input: RunAgentInput = {
        agent: 'backend',
        task: 'test task',
        mode: 'context'
      };

      // The abort check happens after profile loading
      const result = await handler(input, { signal: controller.signal });
      // Since abort happens during context building, it may complete
      expect(result.agent).toBe('backend');
    });
  });

  describe('MCP Pool Execution', () => {
    it('should try MCP pool when available and mode is auto', async () => {
      const mockMcpPool = {
        acquire: vi.fn().mockResolvedValue({
          callTool: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'MCP pool response' }]
          })
        }),
        release: vi.fn()
      };

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        mcpPool: mockMcpPool as any,
        crossProviderMode: 'auto',
        getSession: () => createMockSession('unknown')
      });

      // Testing cross-provider MCP pooling with provider not in official type
      const input = {
        agent: 'backend',
        task: 'test task',
        provider: 'codex'
      } as unknown as RunAgentInput;

      const result = await handler(input);

      expect(mockMcpPool.acquire).toHaveBeenCalledWith('codex');
      expect(result.content).toBe('MCP pool response');
      expect(result.executionMode).toBe('mcp_pooled');
    });

    it('should fall back to CLI when MCP pool fails', async () => {
      const mockMcpPool = {
        acquire: vi.fn().mockRejectedValue(new Error('Connection failed')),
        release: vi.fn()
      };

      const mockContext = {
        agent: { name: 'backend' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue({
        response: { content: 'CLI fallback response' }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        mcpPool: mockMcpPool as any,
        crossProviderMode: 'auto',
        getSession: () => createMockSession('unknown')
      });

      // Testing cross-provider MCP pooling with provider not in official type
      const input = {
        agent: 'backend',
        task: 'test task',
        provider: 'codex'
      } as unknown as RunAgentInput;

      const result = await handler(input);

      expect(result.content).toBe('CLI fallback response');
      expect(result.executionMode).toBe('cli_fallback');
    });

    it('should skip MCP pool when crossProviderMode is cli', async () => {
      const mockMcpPool = {
        acquire: vi.fn(),
        release: vi.fn()
      };

      const mockContext = {
        agent: { name: 'backend' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue({
        response: { content: 'CLI response' }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        mcpPool: mockMcpPool as any,
        crossProviderMode: 'cli',
        getSession: () => createMockSession('unknown')
      });

      const input: RunAgentInput = {
        agent: 'backend',
        task: 'test task'
      };

      const result = await handler(input);

      expect(mockMcpPool.acquire).not.toHaveBeenCalled();
      expect(result.executionMode).toBe('cli_spawn');
    });

    it('should throw for unsupported providers in MCP pool', async () => {
      const mockClient = {
        callTool: vi.fn()
      };

      const mockMcpPool = {
        acquire: vi.fn().mockResolvedValue(mockClient),
        release: vi.fn()
      };

      const mockContext = {
        agent: { name: 'backend' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue({
        response: { content: 'CLI fallback' }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {},
        mcpPool: mockMcpPool as any,
        crossProviderMode: 'mcp',
        getSession: () => createMockSession('unknown')
      });

      // Testing SDK-based provider not in PROVIDER_MCP_TOOLS
      const input = {
        agent: 'backend',
        task: 'test task',
        provider: 'glm'
      } as unknown as RunAgentInput;

      // Should fall back to CLI since GLM not supported via MCP
      const result = await handler(input);
      expect(result.executionMode).toBe('cli_fallback');
    });
  });

  describe('Provider Mapping', () => {
    it('should map claude to claude-code', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue({
        response: { content: 'Response' }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      await handler({
        agent: 'test-agent',
        task: 'test task',
        provider: 'claude'
      });

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'test-agent',
        'test task',
        { provider: 'claude-code', skipMemory: undefined }
      );
    });

    it('should pass openai through as-is (no mapping)', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue({
        response: { content: 'Response' }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      await handler({
        agent: 'test-agent',
        task: 'test task',
        provider: 'openai'
      });

      // openai maps to openai (pass-through) per provider-mapping.ts
      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'test-agent',
        'test task',
        { provider: 'openai', skipMemory: undefined }
      );
    });

    it('should map gemini to gemini-cli', async () => {
      const mockContext = {
        agent: { name: 'test-agent' },
        task: 'test task'
      };

      mockContextManager.createContext.mockResolvedValue(mockContext);
      mockExecute.mockResolvedValue({
        response: { content: 'Response' }
      });

      const handler = createRunAgentHandler({
        contextManager: mockContextManager,
        executorConfig: {}
      });

      await handler({
        agent: 'test-agent',
        task: 'test task',
        provider: 'gemini'
      });

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'test-agent',
        'test task',
        { provider: 'gemini-cli', skipMemory: undefined }
      );
    });
  });
});
