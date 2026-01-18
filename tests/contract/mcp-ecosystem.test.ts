/**
 * MCP Ecosystem Contract Tests
 *
 * Tests for mcp-ecosystem contract schemas and invariants:
 * - INV-MCP-ECO-001: Tool discovery is idempotent
 * - INV-MCP-ECO-002: Failed servers don't block others
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 */

import { describe, it, expect } from 'vitest';
import {
  MCPServerConfigSchema,
  MCPServerStateSchema,
  MCPToolMetadataSchema,
  MCPResourceMetadataSchema,
  MCPDiscoveryRequestSchema,
  MCPDiscoveryResponseSchema,
  MCPToolInvokeRequestSchema,
  MCPToolInvokeResponseSchema,
  MCPServerRegisterRequestSchema,
  MCPServerRegisterResponseSchema,
  MCPServerListRequestSchema,
  MCPServerListResponseSchema,
  createMCPServerConfig,
  createToolFullName,
  parseToolFullName,
  MCPEcosystemErrorCodes,
} from '@defai.digital/contracts';

describe('MCP Ecosystem Contracts', () => {
  describe('MCPServerConfigSchema', () => {
    it('should validate minimal config', () => {
      const config = {
        serverId: 'test-server',
        name: 'Test Server',
        command: 'npx',
      };
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.serverId).toBe('test-server');
        expect(result.data.name).toBe('Test Server');
        expect(result.data.command).toBe('npx');
        expect(result.data.enabled).toBe(true); // default
      }
    });

    it('should validate full config', () => {
      const config = {
        serverId: 'my-mcp-server',
        name: 'My MCP Server',
        command: 'node',
        args: ['server.js', '--port', '3000'],
        env: { NODE_ENV: 'production' },
        enabled: true,
        connectionTimeoutMs: 15000,
        requestTimeoutMs: 60000,
        maxRetries: 3,
      };
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.args).toEqual(['server.js', '--port', '3000']);
        expect(result.data.connectionTimeoutMs).toBe(15000);
      }
    });

    it('should reject invalid serverId format', () => {
      const config = {
        serverId: 'Invalid-Server', // uppercase not allowed
        name: 'Test',
        command: 'test',
      };
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject serverId starting with number', () => {
      const config = {
        serverId: '123-server',
        name: 'Test',
        command: 'test',
      };
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept serverId with hyphens', () => {
      const config = {
        serverId: 'my-mcp-server-v2',
        name: 'My MCP Server v2',
        command: 'test',
      };
      const result = MCPServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPServerStateSchema', () => {
    it('should validate server state', () => {
      const state = {
        config: {
          serverId: 'test-server',
          name: 'Test Server',
          command: 'npx',
          enabled: true,
        },
        status: 'connected',
        toolCount: 5,
        resourceCount: 2,
        lastConnectedAt: new Date().toISOString(),
      };
      const result = MCPServerStateSchema.safeParse(state);
      expect(result.success).toBe(true);
    });

    it('should validate all status values', () => {
      const statuses = ['disconnected', 'connecting', 'connected', 'error', 'disabled'];
      for (const status of statuses) {
        const state = {
          config: {
            serverId: 'test',
            name: 'Test',
            command: 'test',
            enabled: true,
          },
          status,
          toolCount: 0,
          resourceCount: 0,
        };
        const result = MCPServerStateSchema.safeParse(state);
        expect(result.success).toBe(true);
      }
    });

    it('should include error message for error status', () => {
      const state = {
        config: {
          serverId: 'test',
          name: 'Test',
          command: 'test',
          enabled: true,
        },
        status: 'error',
        toolCount: 0,
        resourceCount: 0,
        lastError: 'Connection refused',
      };
      const result = MCPServerStateSchema.safeParse(state);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lastError).toBe('Connection refused');
      }
    });
  });

  describe('MCPToolMetadataSchema', () => {
    it('should validate tool metadata', () => {
      const tool = {
        toolName: 'read_file',
        serverId: 'filesystem',
        fullName: 'filesystem.read_file',
        description: 'Read file contents',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      };
      const result = MCPToolMetadataSchema.safeParse(tool);
      expect(result.success).toBe(true);
    });

    it('should accept optional category and tags', () => {
      const tool = {
        toolName: 'search',
        serverId: 'search-server',
        fullName: 'search-server.search',
        description: 'Search for items',
        inputSchema: {},
        category: 'search',
        tags: ['query', 'find'],
      };
      const result = MCPToolMetadataSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('search');
        expect(result.data.tags).toEqual(['query', 'find']);
      }
    });

    // INV-MCP-ECO-003: Tool namespacing prevents collisions
    it('should require fullName for unique identification', () => {
      const tool = {
        toolName: 'search',
        serverId: 'server-a',
        // fullName is required
        description: 'Search',
        inputSchema: {},
      };
      const result = MCPToolMetadataSchema.safeParse(tool);
      expect(result.success).toBe(false); // fullName is required
    });
  });

  describe('MCPResourceMetadataSchema', () => {
    it('should validate resource metadata', () => {
      const resource = {
        uri: 'file:///path/to/resource',
        fullUri: 'filesystem:///path/to/resource',
        serverId: 'filesystem',
        name: 'Config File',
        mimeType: 'application/json',
      };
      const result = MCPResourceMetadataSchema.safeParse(resource);
      expect(result.success).toBe(true);
    });

    it('should accept optional description', () => {
      const resource = {
        uri: 'db://users/schema',
        fullUri: 'database://users/schema',
        serverId: 'database',
        name: 'Users Schema',
        description: 'Database schema for users table',
      };
      const result = MCPResourceMetadataSchema.safeParse(resource);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPDiscoveryRequestSchema', () => {
    it('should validate empty request', () => {
      const request = {};
      const result = MCPDiscoveryRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate request with serverIds', () => {
      const request = {
        serverIds: ['server-a', 'server-b'],
        forceRefresh: true,
      };
      const result = MCPDiscoveryRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should default forceRefresh to false', () => {
      const request = { serverIds: ['test'] };
      const result = MCPDiscoveryRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.forceRefresh).toBe(false);
      }
    });
  });

  describe('MCPDiscoveryResponseSchema', () => {
    it('should validate discovery response', () => {
      const response = {
        tools: [
          {
            toolName: 'tool1',
            serverId: 'server1',
            fullName: 'server1.tool1',
            description: 'Test tool',
            inputSchema: {},
          },
        ],
        resources: [],
        serverResults: [
          {
            serverId: 'server1',
            status: 'success',
            toolCount: 1,
            resourceCount: 0,
            durationMs: 150,
          },
        ],
        totalDurationMs: 200,
        discoveredAt: new Date().toISOString(),
      };
      const result = MCPDiscoveryResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    // INV-MCP-ECO-002: Failed servers don't block others
    it('should allow mix of success and error results', () => {
      const response = {
        tools: [],
        resources: [],
        serverResults: [
          {
            serverId: 'server1',
            status: 'success',
            toolCount: 0,
            resourceCount: 0,
            durationMs: 100,
          },
          {
            serverId: 'server2',
            status: 'error',
            toolCount: 0,
            resourceCount: 0,
            error: 'Connection failed',
            durationMs: 5000,
          },
        ],
        totalDurationMs: 5100,
        discoveredAt: new Date().toISOString(),
      };
      const result = MCPDiscoveryResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPToolInvokeRequestSchema', () => {
    it('should validate request with toolName only', () => {
      const request = {
        toolName: 'read_file',
      };
      const result = MCPToolInvokeRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate request with serverId for disambiguation', () => {
      const request = {
        toolName: 'search',
        serverId: 'search-server',
        arguments: { query: 'test' },
      };
      const result = MCPToolInvokeRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should accept timeout configuration', () => {
      const request = {
        toolName: 'slow_operation',
        timeoutMs: 120000,
      };
      const result = MCPToolInvokeRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPToolInvokeResponseSchema', () => {
    it('should validate successful response', () => {
      const response = {
        success: true,
        toolName: 'read_file',
        serverId: 'filesystem',
        content: [{ type: 'text', text: 'file contents' }],
        durationMs: 50,
      };
      const result = MCPToolInvokeResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate error response', () => {
      const response = {
        success: false,
        toolName: 'read_file',
        serverId: 'filesystem',
        content: [],
        isError: true,
        error: 'File not found',
        durationMs: 10,
      };
      const result = MCPToolInvokeResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPServerRegisterRequestSchema', () => {
    it('should validate register request', () => {
      const request = {
        serverId: 'new-server',
        name: 'New Server',
        command: 'node',
        args: ['server.js'],
        connectNow: true,
        discoverNow: true,
      };
      const result = MCPServerRegisterRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should default connectNow and discoverNow to true', () => {
      const request = {
        serverId: 'test',
        name: 'Test',
        command: 'test',
      };
      const result = MCPServerRegisterRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.connectNow).toBe(true);
        expect(result.data.discoverNow).toBe(true);
      }
    });
  });

  describe('MCPServerRegisterResponseSchema', () => {
    it('should validate success response', () => {
      const response = {
        success: true,
        created: true,
        server: {
          config: {
            serverId: 'test',
            name: 'Test',
            command: 'test',
            enabled: true,
          },
          status: 'connected',
          toolCount: 3,
          resourceCount: 1,
        },
      };
      const result = MCPServerRegisterResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate error response', () => {
      const response = {
        success: false,
        created: false,
        error: 'Server already exists',
      };
      const result = MCPServerRegisterResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPServerListRequestSchema', () => {
    it('should validate empty request', () => {
      const request = {};
      const result = MCPServerListRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate request with filters', () => {
      const request = {
        status: 'connected',
        enabled: true,
        limit: 20,
        offset: 10,
      };
      const result = MCPServerListRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPServerListResponseSchema', () => {
    it('should validate list response', () => {
      const response = {
        servers: [
          {
            config: {
              serverId: 'test',
              name: 'Test',
              command: 'test',
              enabled: true,
            },
            status: 'connected',
            toolCount: 5,
            resourceCount: 2,
          },
        ],
        total: 1,
        hasMore: false,
      };
      const result = MCPServerListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    describe('createMCPServerConfig', () => {
      it('should create config with defaults', () => {
        const config = createMCPServerConfig('my-server', 'npx', {
          name: 'My Server',
          args: ['-y', 'server'],
        });
        expect(config.serverId).toBe('my-server');
        expect(config.name).toBe('My Server');
        expect(config.command).toBe('npx');
        expect(config.args).toEqual(['-y', 'server']);
        expect(config.enabled).toBe(true);
        expect(config.connectionTimeoutMs).toBe(10000);
      });

      it('should apply overrides', () => {
        const config = createMCPServerConfig('my-server', 'node', {
          name: 'My Server',
          enabled: false,
          connectionTimeoutMs: 30000,
        });
        expect(config.enabled).toBe(false);
        expect(config.connectionTimeoutMs).toBe(30000);
      });
    });

    describe('createToolFullName', () => {
      // INV-MCP-ECO-003: Tool namespacing prevents collisions
      it('should create namespaced tool name', () => {
        expect(createToolFullName('filesystem', 'read_file')).toBe('filesystem.read_file');
        expect(createToolFullName('search-server', 'search')).toBe('search-server.search');
      });
    });

    describe('parseToolFullName', () => {
      it('should parse namespaced tool name', () => {
        const result = parseToolFullName('filesystem.read_file');
        expect(result).toEqual({ serverId: 'filesystem', toolName: 'read_file' });
      });

      it('should return null for non-namespaced name', () => {
        const result = parseToolFullName('read_file');
        expect(result).toBeNull();
      });

      it('should handle multiple dots', () => {
        const result = parseToolFullName('server.tool.name');
        expect(result).toEqual({ serverId: 'server', toolName: 'tool.name' });
      });
    });
  });

  describe('Error Codes', () => {
    it('should define standard error codes', () => {
      expect(MCPEcosystemErrorCodes.SERVER_NOT_FOUND).toBe('MCP_ECO_SERVER_NOT_FOUND');
      expect(MCPEcosystemErrorCodes.TOOL_NOT_FOUND).toBe('MCP_ECO_TOOL_NOT_FOUND');
      expect(MCPEcosystemErrorCodes.AMBIGUOUS_TOOL).toBe('MCP_ECO_AMBIGUOUS_TOOL');
      expect(MCPEcosystemErrorCodes.CONNECTION_FAILED).toBe('MCP_ECO_CONNECTION_FAILED');
      expect(MCPEcosystemErrorCodes.INVOCATION_FAILED).toBe('MCP_ECO_INVOCATION_FAILED');
      expect(MCPEcosystemErrorCodes.DISCOVERY_FAILED).toBe('MCP_ECO_DISCOVERY_FAILED');
    });
  });
});
