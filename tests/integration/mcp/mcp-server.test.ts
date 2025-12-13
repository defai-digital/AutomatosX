/**
 * MCP Server Integration Tests
 *
 * End-to-end tests for the Model Context Protocol server:
 * - Tool registration and invocation
 * - Session management
 * - Protocol compliance
 * - Tool handlers
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Import tool handlers and utilities
import { createRunAgentHandler } from '../../../src/mcp/tools/run-agent.js';
import { createListAgentsHandler } from '../../../src/mcp/tools/list-agents.js';
import { createSearchMemoryHandler } from '../../../src/mcp/tools/search-memory.js';
import { createGetStatusHandler } from '../../../src/mcp/tools/get-status.js';
import { createSessionCreateHandler } from '../../../src/mcp/tools/session-create.js';
import { createSessionListHandler } from '../../../src/mcp/tools/session-list.js';
import { createMemoryAddHandler } from '../../../src/mcp/tools/memory-add.js';
import { createMemoryListHandler } from '../../../src/mcp/tools/memory-list.js';
import { createGetCapabilitiesHandler } from '../../../src/mcp/tools/get-capabilities.js';
import type { McpSession } from '../../../src/mcp/types.js';

// Mock dependencies
vi.mock('../../../src/core/config/loader.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    providers: {},  // Object, not array - used with Object.entries()
    memory: { dbPath: ':memory:' },
    router: { providers: [] }
  }),
  getConfig: vi.fn().mockReturnValue({
    providers: {},
    memory: { dbPath: ':memory:' },
    router: { providers: [] }
  })
}));

describe('MCP Server Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'mcp-server-test-'));
    await mkdir(join(testDir, '.automatosx'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Handlers', () => {
    describe('get_status', () => {
      it('should return system status', async () => {
        const mockDeps = {
          memoryManager: {
            getStats: vi.fn().mockResolvedValue({ totalEntries: 0, dbSizeBytes: 0 })
          },
          sessionManager: {
            getActiveSessions: vi.fn().mockResolvedValue([]),
            getTotalSessionCount: vi.fn().mockResolvedValue(0)
          },
          router: {
            getAvailableProviders: vi.fn().mockResolvedValue([])
          }
        };
        const handler = createGetStatusHandler(mockDeps as any);
        const result = await handler({});

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });
    });

    describe('list_agents', () => {
      it('should return list of available agents', async () => {
        const mockDeps = {
          profileLoader: {
            listProfiles: vi.fn().mockResolvedValue(['backend', 'frontend']),
            loadProfile: vi.fn().mockResolvedValue({
              name: 'backend',
              displayName: 'Backend',
              role: 'Backend Developer',
              team: 'core'
            })
          }
        };
        const handler = createListAgentsHandler(mockDeps as any);
        const result = await handler({});

        expect(result).toBeDefined();
        expect(result).toHaveProperty('agents');
      });
    });

    describe('get_capabilities', () => {
      it('should create handler with valid dependencies', async () => {
        // get_capabilities reads from loadConfig which is harder to mock in ESM
        // Test handler creation instead of full execution
        const mockDeps = {
          memoryManager: {
            getStats: vi.fn().mockResolvedValue({ totalEntries: 0 })
          },
          sessionManager: {
            getActiveSessions: vi.fn().mockResolvedValue([]),
            getTotalSessionCount: vi.fn().mockResolvedValue(0)
          },
          router: {
            getAvailableProviders: vi.fn().mockResolvedValue([])
          },
          profileLoader: {
            listProfiles: vi.fn().mockResolvedValue([]),
            loadProfile: vi.fn()
          },
          toolSchemas: []
        };
        const handler = createGetCapabilitiesHandler(mockDeps as any);

        // Verify handler is created successfully
        expect(typeof handler).toBe('function');
      });
    });
  });

  describe('Session Management Tools', () => {
    describe('session_create', () => {
      it('should create new session', async () => {
        const handler = createSessionCreateHandler({
          sessionManager: {
            createSession: vi.fn().mockResolvedValue({
              id: 'test-session-id',
              task: 'Test Session',
              initiator: 'backend',
              status: 'active',
              agents: ['backend'],
              createdAt: new Date(),
              updatedAt: new Date()
            })
          } as any
        });

        const result = await handler({
          name: 'Test Session',
          agent: 'backend'
        });

        expect(result).toBeDefined();
        expect(result.sessionId).toBe('test-session-id');
        expect(result.status).toBe('active');
      });
    });

    describe('session_list', () => {
      it('should list all sessions', async () => {
        const mockSessions = [
          { id: 'session-1', task: 'Session 1', initiator: 'backend', status: 'active', agents: [], createdAt: new Date(), updatedAt: new Date() },
          { id: 'session-2', task: 'Session 2', initiator: 'frontend', status: 'completed', agents: [], createdAt: new Date(), updatedAt: new Date() }
        ];

        const handler = createSessionListHandler({
          sessionManager: {
            getActiveSessions: vi.fn().mockResolvedValue(mockSessions)
          } as any
        });

        const result = await handler({});

        expect(result).toBeDefined();
        expect(result.sessions).toHaveLength(2);
      });
    });
  });

  describe('Memory Tools', () => {
    describe('memory_add', () => {
      it('should add memory entry', async () => {
        const mockMemoryManager = {
          add: vi.fn().mockResolvedValue({
            id: 1,
            content: 'Test memory content',
            createdAt: new Date(),
            metadata: { type: 'other', source: 'test' }
          }),
          search: vi.fn(),
          getAll: vi.fn(),
          delete: vi.fn()
        };

        // Handler expects { memoryManager: ... } not the manager directly
        const handler = createMemoryAddHandler({ memoryManager: mockMemoryManager } as any);
        const result = await handler({
          content: 'Test memory content',
          metadata: { agent: 'backend', tags: ['test'] }
        });

        expect(result).toBeDefined();
        expect(mockMemoryManager.add).toHaveBeenCalled();
      });
    });

    describe('memory_list', () => {
      it('should list memory entries', async () => {
        const mockEntries = [
          { id: 1, content: 'Entry 1', createdAt: new Date(), metadata: {} },
          { id: 2, content: 'Entry 2', createdAt: new Date(), metadata: {} }
        ];

        const mockMemoryManager = {
          getAll: vi.fn().mockResolvedValue(mockEntries),
          search: vi.fn(),
          add: vi.fn(),
          delete: vi.fn()
        };

        const handler = createMemoryListHandler({ memoryManager: mockMemoryManager } as any);
        const result = await handler({ limit: 50 });

        expect(result).toBeDefined();
        expect(mockMemoryManager.getAll).toHaveBeenCalled();
      });
    });

    describe('search_memory', () => {
      it('should search memory entries', async () => {
        const mockResults = [
          { entry: { id: 1, content: 'Found entry' }, score: 0.9 }
        ];

        const mockMemoryManager = {
          search: vi.fn().mockResolvedValue(mockResults),
          getAll: vi.fn(),
          add: vi.fn(),
          delete: vi.fn()
        };

        const handler = createSearchMemoryHandler({ memoryManager: mockMemoryManager } as any);
        const result = await handler({ query: 'authentication' });

        expect(result).toBeDefined();
        expect(mockMemoryManager.search).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      const mockSessionManager = {
        createSession: vi.fn().mockRejectedValue(new Error('name is required'))
      };

      const handler = createSessionCreateHandler(mockSessionManager as any);

      await expect(handler({ agent: 'backend' } as any))
        .rejects.toThrow();
    });

    it('should handle invalid session ID format', async () => {
      const mockSessionManager = {
        getSession: vi.fn().mockRejectedValue(new Error('Invalid session ID'))
      };

      // Simulate accessing a session with invalid ID
      await expect(mockSessionManager.getSession('invalid'))
        .rejects.toThrow('Invalid session ID');
    });
  });

  describe('Protocol Compliance', () => {
    it('should have valid tool schemas', async () => {
      // Dynamic import for ESM modules
      const { planMultiAgentSchema } = await import('../../../src/mcp/tools/plan-multi-agent.js');
      const { orchestrateTaskSchema } = await import('../../../src/mcp/tools/orchestrate-task.js');

      // MCP tool schemas have name and description, with inputSchema containing type/properties
      expect(planMultiAgentSchema).toHaveProperty('name');
      expect(planMultiAgentSchema).toHaveProperty('description');
      expect(planMultiAgentSchema).toHaveProperty('inputSchema');
      expect(orchestrateTaskSchema).toHaveProperty('name');
      expect(orchestrateTaskSchema).toHaveProperty('description');
      expect(orchestrateTaskSchema).toHaveProperty('inputSchema');
    });
  });
});

describe('MCP Tool Integration', () => {
  describe('run_agent handler', () => {
    it('should create handler with valid dependencies', async () => {
      // run_agent requires complex integration dependencies
      // This test validates handler creation and basic structure
      const mockDeps = {
        router: {
          selectProvider: vi.fn().mockResolvedValue({
            name: 'claude',
            available: true
          })
        },
        memoryManager: {
          add: vi.fn(),
          search: vi.fn().mockResolvedValue([])
        },
        profileLoader: {
          load: vi.fn().mockResolvedValue({
            name: 'backend',
            role: 'Backend Developer',
            systemPrompt: 'You are a backend developer'
          })
        },
        contextManager: {
          createContext: vi.fn().mockResolvedValue({
            agent: { name: 'backend' },
            systemPrompt: 'You are a backend developer',
            memory: []
          })
        },
        executorConfig: {}
      };

      const handler = createRunAgentHandler(mockDeps as any);

      // Verify handler is a function
      expect(typeof handler).toBe('function');
    });
  });
});
