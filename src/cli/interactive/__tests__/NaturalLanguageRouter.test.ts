/**
 * AutomatosX v8.0.0 - NaturalLanguageRouter Tests
 *
 * Test suite for natural language routing to AutomatosX systems
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NaturalLanguageRouter, type FileSystem } from '../NaturalLanguageRouter.js';
import type { RouteResult } from '../NaturalLanguageRouter.js';
import type { ConversationContext } from '../ConversationContext.js';
import type { Intent } from '../IntentClassifier.js';

describe('NaturalLanguageRouter', () => {
  describe('Route 1: MemoryService (Code Search)', () => {
    let router: NaturalLanguageRouter;
    let mockMemoryService: any;
    let mockWorkflowEngine: any;
    let mockAgentRegistry: any;
    let mockProviderRouter: any;
    let mockContext: any;
    let mockFileSystem: FileSystem;

    beforeEach(() => {
      // Mock MemoryService
      mockMemoryService = {
        search: vi.fn()
      };

      // Mock WorkflowEngine
      mockWorkflowEngine = {
        execute: vi.fn()
      };

      // Mock AgentRegistry
      mockAgentRegistry = {
        get: vi.fn(),
        list: vi.fn()
      };

      // Mock ProviderRouter
      mockProviderRouter = {
        route: vi.fn()
      };

      // Mock FileSystem
      mockFileSystem = {
        existsSync: vi.fn(),
        readdirSync: vi.fn()
      };

      // Mock ConversationContext
      mockContext = {
        addMessage: vi.fn(),
        getRecentMessages: vi.fn().mockReturnValue([]),
        setVariable: vi.fn(),
        getVariable: vi.fn(),
        setActiveWorkflow: vi.fn(),
        setActiveAgent: vi.fn(),
        getActiveAgent: vi.fn(),
        getActiveWorkflow: vi.fn()
      };

      router = new NaturalLanguageRouter(
        mockMemoryService,
        mockWorkflowEngine,
        mockAgentRegistry,
        mockProviderRouter,
        mockFileSystem
      );
    });

    it('should route memory-search intent to MemoryService', async () => {
      // Mock IntentClassifier to return memory-search
      const input = 'find authentication logic';

      mockMemoryService.search.mockResolvedValue([
        {
          file: 'src/auth/AuthService.ts',
          line: 45,
          name: 'authenticate',
          preview: 'function authenticate(credentials: Credentials) {'
        },
        {
          file: 'src/auth/JWTValidator.ts',
          line: 23,
          name: 'validateToken',
          preview: 'function validateToken(token: string) {'
        }
      ]);

      const result = await router.route(input, mockContext);

      // Verify MemoryService.search called
      expect(mockMemoryService.search).toHaveBeenCalledWith(
        expect.stringContaining('authentication'),
        expect.objectContaining({ limit: 10, includeContent: true })
      );

      // Verify result structure
      expect(result.source).toBe('memory-service');
      expect(result.intent.type).toBe('memory-search');
      expect(result.displayFormat).toBe('search-results');
      expect(result.results).toBeDefined();
      expect(result.raw).toHaveLength(2);

      // Verify context updated
      expect(mockContext.addMessage).toHaveBeenCalledWith('user', input);
      expect(mockContext.addMessage).toHaveBeenCalledWith(
        'assistant',
        expect.stringContaining('Found 2 results')
      );
    });

    it('should handle empty search results', async () => {
      const input = 'find nonexistent function xyz123';

      mockMemoryService.search.mockResolvedValue([]);

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('memory-service');
      expect(result.displayFormat).toBe('search-results');
      expect(result.results).toContain('No results found');
      expect(result.raw).toHaveLength(0);
    });

    it('should format search results with location and preview', async () => {
      const input = 'find getUserById function';

      mockMemoryService.search.mockResolvedValue([
        {
          file: 'src/users/UserService.ts',
          line: 78,
          name: 'getUserById',
          preview: 'async function getUserById(id: string) {'
        }
      ]);

      const result = await router.route(input, mockContext);

      expect(result.results).toBeDefined();
      expect(result.results).toContain('src/users/UserService.ts:78');
      expect(result.results).toContain('getUserById');
      expect(result.results).toContain('async function getUserById');
    });

    it('should handle memory search errors gracefully', async () => {
      const input = 'find authentication function';

      mockMemoryService.search.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('memory-service');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toContain('Memory search failed');
      expect(result.error).toContain('Database connection failed');
    });

    it('should extract query from natural language input', async () => {
      const input = 'find the authentication function in the codebase';

      mockMemoryService.search.mockResolvedValue([]);

      await router.route(input, mockContext);

      // Verify search was called with extracted query (without prefixes/suffixes)
      expect(mockMemoryService.search).toHaveBeenCalledWith(
        expect.not.stringContaining('find'),
        expect.any(Object)
      );
    });

    it('should handle search results with missing fields', async () => {
      const input = 'search for error handling function';

      mockMemoryService.search.mockResolvedValue([
        {
          file: 'unknown.ts',
          // Missing: line, name, preview
        }
      ]);

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('memory-service');
      expect(result.displayFormat).toBe('search-results');
      expect(result.results).toContain('unknown.ts');
      expect(result.results).toContain('unknown'); // Default name
    });
  });

  describe('Route 2: WorkflowEngine (Workflow Execution)', () => {
    let router: NaturalLanguageRouter;
    let mockMemoryService: any;
    let mockWorkflowEngine: any;
    let mockAgentRegistry: any;
    let mockProviderRouter: any;
    let mockContext: any;
    let mockFileSystem: FileSystem;

    beforeEach(() => {
      mockMemoryService = { search: vi.fn() };
      mockWorkflowEngine = { execute: vi.fn() };
      mockAgentRegistry = { get: vi.fn(), list: vi.fn() };
      mockProviderRouter = { route: vi.fn() };

      mockFileSystem = {
        existsSync: vi.fn(),
        readdirSync: vi.fn()
      };

      mockContext = {
        addMessage: vi.fn(),
        getRecentMessages: vi.fn().mockReturnValue([]),
        setVariable: vi.fn(),
        getVariable: vi.fn(),
        setActiveWorkflow: vi.fn(),
        setActiveAgent: vi.fn(),
        getActiveAgent: vi.fn(),
        getActiveWorkflow: vi.fn()
      };

      router = new NaturalLanguageRouter(
        mockMemoryService,
        mockWorkflowEngine,
        mockAgentRegistry,
        mockProviderRouter,
        mockFileSystem
      );
    });

    it('should route workflow-execute intent to WorkflowEngine', async () => {
      const input = 'run security audit';

      // Mock filesystem to have workflows directory
      vi.mocked(mockFileSystem.existsSync).mockReturnValue(true);
      vi.mocked(mockFileSystem.readdirSync).mockReturnValue([
        'security-audit.yaml',
        'ci-pipeline.yaml'
      ] as any);

      mockWorkflowEngine.execute.mockResolvedValue({
        id: 'wf-123',
        status: 'running'
      });

      const result = await router.route(input, mockContext);

      // Verify WorkflowEngine.execute called
      expect(mockWorkflowEngine.execute).toHaveBeenCalledWith(
        expect.stringContaining('security-audit.yaml')
      );

      // Verify result structure
      expect(result.source).toBe('workflow-engine');
      expect(result.intent.type).toBe('workflow-execute');
      expect(result.displayFormat).toBe('workflow-status');
      expect(result.workflowId).toBe('wf-123');
      expect(result.workflowName).toContain('security');
      expect(result.status).toBe('running');

      // Verify context updated
      expect(mockContext.addMessage).toHaveBeenCalledWith('user', input);
      expect(mockContext.setVariable).toHaveBeenCalledWith('lastWorkflowId', 'wf-123');
      expect(mockContext.setActiveWorkflow).toHaveBeenCalled();
    });

    it('should handle workflow not found error', async () => {
      const input = 'run nonexistent workflow';

      vi.mocked(mockFileSystem.existsSync).mockReturnValue(true);
      vi.mocked(mockFileSystem.readdirSync).mockReturnValue([
        'security-audit.yaml',
        'ci-pipeline.yaml'
      ] as any);

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('workflow-engine');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toContain('Workflow');
      expect(result.error).toContain('not found');
      expect(result.error).toContain('Available workflows');
    });

    it('should list available workflows when workflow not found', async () => {
      const input = 'run unknown workflow';

      // FileSystem is injected via constructor
      vi.mocked(mockFileSystem.existsSync).mockReturnValue(true);
      vi.mocked(mockFileSystem.readdirSync).mockReturnValue([
        'audit.yaml',
        'test.yml',
        'deploy.yaml'
      ] as any);

      const result = await router.route(input, mockContext);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('audit');
      expect(result.error).toContain('test');
      expect(result.error).toContain('deploy');
    });

    it('should handle missing workflows directory', async () => {
      const input = 'run security audit';

      // FileSystem is injected via constructor
      vi.mocked(mockFileSystem.existsSync).mockReturnValue(false);

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('workflow-engine');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toContain('not found');
      expect(result.error).toContain('workflows/ directory not found');
    });

    it('should match workflow names case-insensitively', async () => {
      const input = 'run SECURITY AUDIT';

      // FileSystem is injected via constructor
      vi.mocked(mockFileSystem.existsSync).mockReturnValue(true);
      vi.mocked(mockFileSystem.readdirSync).mockReturnValue([
        'security-audit.yaml'
      ] as any);

      mockWorkflowEngine.execute.mockResolvedValue({
        id: 'wf-456',
        status: 'running'
      });

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('workflow-engine');
      expect(result.displayFormat).toBe('workflow-status');
      expect(result.workflowId).toBe('wf-456');
    });

    it('should handle workflow execution errors', async () => {
      const input = 'run security audit';

      // FileSystem is injected via constructor
      vi.mocked(mockFileSystem.existsSync).mockReturnValue(true);
      vi.mocked(mockFileSystem.readdirSync).mockReturnValue(['security-audit.yaml'] as any);

      mockWorkflowEngine.execute.mockRejectedValue(
        new Error('Workflow execution failed: invalid YAML')
      );

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('workflow-engine');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toContain('Workflow execution failed');
      expect(result.error).toContain('invalid YAML');
    });

    it('should extract workflow name from natural language', async () => {
      const input = 'run tests';

      // FileSystem is injected via constructor
      vi.mocked(mockFileSystem.existsSync).mockReturnValue(true);
      vi.mocked(mockFileSystem.readdirSync).mockReturnValue(['tests.yaml', 'test.yaml'] as any);

      mockWorkflowEngine.execute.mockResolvedValue({
        id: 'wf-789',
        status: 'running'
      });

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('workflow-engine');
      expect(result.displayFormat).toBe('workflow-status');
      expect(result.workflowId).toBe('wf-789');
    });
  });

  describe('Route 3: AgentRuntime (Agent Delegation)', () => {
    let router: NaturalLanguageRouter;
    let mockMemoryService: any;
    let mockWorkflowEngine: any;
    let mockAgentRegistry: any;
    let mockProviderRouter: any;
    let mockContext: any;
    let mockFileSystem: FileSystem;

    beforeEach(() => {
      mockMemoryService = { search: vi.fn() };
      mockWorkflowEngine = { execute: vi.fn() };
      mockAgentRegistry = { get: vi.fn(), list: vi.fn() };
      mockProviderRouter = { route: vi.fn() };

      mockFileSystem = {
        existsSync: vi.fn(),
        readdirSync: vi.fn()
      };

      mockContext = {
        addMessage: vi.fn(),
        getRecentMessages: vi.fn().mockReturnValue([]),
        setVariable: vi.fn(),
        getVariable: vi.fn(),
        setActiveWorkflow: vi.fn(),
        setActiveAgent: vi.fn(),
        getActiveAgent: vi.fn(),
        getActiveWorkflow: vi.fn()
      };

      router = new NaturalLanguageRouter(
        mockMemoryService,
        mockWorkflowEngine,
        mockAgentRegistry,
        mockProviderRouter,
        mockFileSystem
      );
    });

    it('should route agent-delegate intent to AgentRuntime', async () => {
      const input = 'use BackendAgent';

      const mockAgent = {
        name: 'BackendAgent',
        description: 'Specialized in backend development',
        systemPrompt: 'You are a backend expert.'
      };

      mockAgentRegistry.get.mockReturnValue(mockAgent);
      mockProviderRouter.route.mockResolvedValue({
        content: 'Hello! I am BackendAgent. How can I help with your backend code?'
      });

      const result = await router.route(input, mockContext);

      // Verify AgentRegistry.get called
      expect(mockAgentRegistry.get).toHaveBeenCalledWith(
        expect.stringContaining('Backend')
      );

      // Verify result structure
      expect(result.source).toBe('agent-runtime');
      expect(result.intent.type).toBe('agent-delegate');
      expect(result.displayFormat).toBe('agent-response');
      expect(result.agentName).toContain('Backend');
      expect(result.response).toContain('BackendAgent');

      // Verify context updated
      expect(mockContext.setActiveAgent).toHaveBeenCalled();
      expect(mockContext.addMessage).toHaveBeenCalledWith('user', input);
    });

    it('should handle agent not found error', async () => {
      const input = 'use BackendAgent';

      mockAgentRegistry.get.mockReturnValue(null);
      mockAgentRegistry.list.mockReturnValue([
        { name: 'SecurityAgent' },
        { name: 'TestingAgent' },
        { name: 'FrontendAgent' }
      ]);

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('agent-runtime');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Agent');
      expect(result.error).toContain('not found');
      expect(result.error).toContain('Available agents');
    });

    it('should delegate to agent with conversation context', async () => {
      const input = 'use SecurityAgent';

      const mockAgent = {
        name: 'SecurityAgent',
        description: 'Security expert',
        systemPrompt: 'You specialize in security.'
      };

      mockContext.getRecentMessages.mockReturnValue([
        { role: 'user', content: 'use SecurityAgent' },
        { role: 'assistant', content: 'Hello! I am SecurityAgent.' }
      ]);

      mockAgentRegistry.get.mockReturnValue(mockAgent);
      mockProviderRouter.route.mockResolvedValue({
        content: 'I can help you debug that security error.'
      });

      const result = await router.route(input, mockContext);

      // Verify ProviderRouter called with context
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      );

      expect(result.response).toBeDefined();
      expect(result.response).toContain('security error');
    });

    it('should handle agent delegation errors', async () => {
      const input = 'ask TestingAgent about unit tests';

      const mockAgent = {
        name: 'TestingAgent',
        description: 'Testing expert'
      };

      mockAgentRegistry.get.mockReturnValue(mockAgent);
      mockProviderRouter.route.mockRejectedValue(
        new Error('Provider unavailable')
      );

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('agent-runtime');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toContain('Agent delegation failed');
      expect(result.error).toContain('Provider unavailable');
    });

    it('should list available agents when agent not found', async () => {
      const input = 'use BackendAgent';

      mockAgentRegistry.get.mockReturnValue(null);
      mockAgentRegistry.list.mockReturnValue([
        { name: 'FrontendAgent' },
        { name: 'SecurityAgent' },
        { name: 'TestingAgent' }
      ]);

      const result = await router.route(input, mockContext);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('FrontendAgent');
      expect(result.error).toContain('SecurityAgent');
      expect(result.error).toContain('TestingAgent');
    });
  });

  describe('Route 4: ProviderRouter (Chat Fallback)', () => {
    let router: NaturalLanguageRouter;
    let mockMemoryService: any;
    let mockWorkflowEngine: any;
    let mockAgentRegistry: any;
    let mockProviderRouter: any;
    let mockContext: any;
    let mockFileSystem: FileSystem;

    beforeEach(() => {
      mockMemoryService = { search: vi.fn() };
      mockWorkflowEngine = { execute: vi.fn() };
      mockAgentRegistry = { get: vi.fn(), list: vi.fn() };
      mockProviderRouter = { route: vi.fn() };

      mockFileSystem = {
        existsSync: vi.fn(),
        readdirSync: vi.fn()
      };

      mockContext = {
        addMessage: vi.fn(),
        getRecentMessages: vi.fn().mockReturnValue([]),
        setVariable: vi.fn(),
        getVariable: vi.fn(),
        setActiveWorkflow: vi.fn(),
        setActiveAgent: vi.fn(),
        getActiveAgent: vi.fn().mockReturnValue(null),
        getActiveWorkflow: vi.fn()
      };

      router = new NaturalLanguageRouter(
        mockMemoryService,
        mockWorkflowEngine,
        mockAgentRegistry,
        mockProviderRouter,
        mockFileSystem
      );
    });

    it('should route chat intent to ProviderRouter', async () => {
      const input = 'what is TypeScript?';

      mockProviderRouter.route.mockResolvedValue({
        content: 'TypeScript is a strongly typed programming language...'
      });

      const result = await router.route(input, mockContext);

      // Verify ProviderRouter.route called
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.any(Array),
          preferredProvider: 'auto',
          temperature: 0.7,
          maxTokens: 2000
        })
      );

      // Verify result structure
      expect(result.source).toBe('provider-router');
      expect(result.intent.type).toBe('chat');
      expect(result.displayFormat).toBe('chat-response');
      expect(result.content).toContain('TypeScript');

      // Verify context updated
      expect(mockContext.addMessage).toHaveBeenCalledWith('user', input);
      expect(mockContext.addMessage).toHaveBeenCalledWith(
        'assistant',
        expect.stringContaining('TypeScript')
      );
    });

    it('should include conversation history in chat requests', async () => {
      const input = 'tell me more';

      mockContext.getRecentMessages.mockReturnValue([
        { role: 'user', content: 'what is React?' },
        { role: 'assistant', content: 'React is a JavaScript library...' }
      ]);

      mockProviderRouter.route.mockResolvedValue({
        content: 'React was created by Facebook...'
      });

      const result = await router.route(input, mockContext);

      // Verify conversation history included
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'what is React?' }),
            expect.objectContaining({ role: 'assistant', content: expect.stringContaining('React') })
          ])
        })
      );

      expect(result.content).toContain('React');
    });

    it('should handle chat errors gracefully', async () => {
      const input = 'explain async/await';

      mockProviderRouter.route.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('provider-router');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toContain('Chat failed');
      expect(result.error).toContain('Rate limit exceeded');
    });
  });

  describe('Integration: IntentClassifier + Router', () => {
    let router: NaturalLanguageRouter;
    let mockMemoryService: any;
    let mockWorkflowEngine: any;
    let mockAgentRegistry: any;
    let mockProviderRouter: any;
    let mockContext: any;
    let mockFileSystem: FileSystem;

    beforeEach(() => {
      mockMemoryService = { search: vi.fn().mockResolvedValue([]) };
      mockWorkflowEngine = { execute: vi.fn() };
      mockAgentRegistry = { get: vi.fn(), list: vi.fn() };
      mockProviderRouter = { route: vi.fn().mockResolvedValue({ content: 'response' }) };

      mockFileSystem = {
        existsSync: vi.fn(),
        readdirSync: vi.fn()
      };

      mockContext = {
        addMessage: vi.fn(),
        getRecentMessages: vi.fn().mockReturnValue([]),
        setVariable: vi.fn(),
        getVariable: vi.fn(),
        setActiveWorkflow: vi.fn(),
        setActiveAgent: vi.fn(),
        getActiveAgent: vi.fn(),
        getActiveWorkflow: vi.fn()
      };

      router = new NaturalLanguageRouter(
        mockMemoryService,
        mockWorkflowEngine,
        mockAgentRegistry,
        mockProviderRouter,
        mockFileSystem
      );
    });

    it('should classify and route memory-search queries correctly', async () => {
      const input = 'find authentication logic';

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('memory-service');
      expect(result.intent.type).toBe('memory-search');
      expect(mockMemoryService.search).toHaveBeenCalled();
    });

    it('should classify and route workflow-execute queries correctly', async () => {
      const input = 'run tests';

      // FileSystem is injected via constructor
      vi.mocked(mockFileSystem.existsSync).mockReturnValue(true);
      vi.mocked(mockFileSystem.readdirSync).mockReturnValue(['tests.yaml'] as any);

      mockWorkflowEngine.execute.mockResolvedValue({
        id: 'wf-test',
        status: 'running'
      });

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('workflow-engine');
      expect(result.intent.type).toBe('workflow-execute');
      expect(mockWorkflowEngine.execute).toHaveBeenCalled();
    });

    it('should classify and route agent-delegate queries correctly', async () => {
      const input = 'use BackendAgent';

      mockAgentRegistry.get.mockReturnValue({
        name: 'BackendAgent',
        description: 'Backend expert'
      });

      const result = await router.route(input, mockContext);

      expect(result.source).toBe('agent-runtime');
      expect(result.intent.type).toBe('agent-delegate');
      expect(mockAgentRegistry.get).toHaveBeenCalled();
    });

    it('should handle top-level routing errors', async () => {
      const input = 'find authentication function';

      // Force an error in the routing layer
      mockMemoryService.search.mockImplementation(() => {
        throw new Error('Unexpected error in search');
      });

      const result = await router.route(input, mockContext);

      // When there's an error, it should be caught and returned
      expect(result.source).toBe('memory-service');
      expect(result.displayFormat).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Memory search failed');
    });

    it('should preserve intent information across routing', async () => {
      const input = 'find all API endpoints in code';

      const result = await router.route(input, mockContext);

      expect(result.intent).toBeDefined();
      expect(result.intent.type).toBe('memory-search');
      expect(result.intent.confidence).toBeGreaterThan(0);
      expect(result.intent.method).toMatch(/pattern|llm/);
    });
  });

  describe('Error Handling', () => {
    let router: NaturalLanguageRouter;
    let mockMemoryService: any;
    let mockWorkflowEngine: any;
    let mockAgentRegistry: any;
    let mockProviderRouter: any;
    let mockContext: any;
    let mockFileSystem: FileSystem;

    beforeEach(() => {
      mockMemoryService = { search: vi.fn() };
      mockWorkflowEngine = { execute: vi.fn() };
      mockAgentRegistry = { get: vi.fn(), list: vi.fn() };
      mockProviderRouter = { route: vi.fn() };

      mockFileSystem = {
        existsSync: vi.fn(),
        readdirSync: vi.fn()
      };

      mockContext = {
        addMessage: vi.fn(),
        getRecentMessages: vi.fn().mockReturnValue([]),
        setVariable: vi.fn(),
        getVariable: vi.fn(),
        setActiveWorkflow: vi.fn(),
        setActiveAgent: vi.fn(),
        getActiveAgent: vi.fn(),
        getActiveWorkflow: vi.fn()
      };

      router = new NaturalLanguageRouter(
        mockMemoryService,
        mockWorkflowEngine,
        mockAgentRegistry,
        mockProviderRouter,
        mockFileSystem
      );
    });

    it('should handle empty input gracefully', async () => {
      const result = await router.route('', mockContext);

      // Should default to chat
      expect(result.source).toBe('provider-router');
      expect(result.intent.type).toBe('chat');
    });

    it('should handle whitespace-only input', async () => {
      const result = await router.route('   ', mockContext);

      expect(result.source).toBe('provider-router');
      expect(result.intent.type).toBe('chat');
    });

    it('should add error messages to conversation context', async () => {
      const input = 'find authentication function';

      mockMemoryService.search.mockRejectedValue(
        new Error('Search failed')
      );

      await router.route(input, mockContext);

      // Verify error message added to context
      expect(mockContext.addMessage).toHaveBeenCalledWith(
        'assistant',
        expect.stringContaining('Memory search failed')
      );
    });

    it('should handle classification errors gracefully', async () => {
      const input = 'test input';

      // This should not throw even if classification has issues
      const result = await router.route(input, mockContext);

      expect(result).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.displayFormat).toBeDefined();
    });
  });
});
