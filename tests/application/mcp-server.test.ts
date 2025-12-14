import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMCPServer,
  MCPServer,
  ALL_TOOLS,
  TOOL_HANDLERS,
  MCPErrorCodes,
} from '@automatosx/mcp-server';
import type { MCPRequest } from '@automatosx/mcp-server';

describe('MCP Server', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = createMCPServer({
      name: 'test-server',
      version: '1.0.0',
    });
  });

  describe('Server Lifecycle', () => {
    it('should create server with config', () => {
      const info = server.getInfo();
      expect(info.name).toBe('test-server');
      expect(info.version).toBe('1.0.0');
    });

    it('should not be initialized initially', () => {
      expect(server.isInitialized()).toBe(false);
    });

    it('should initialize on initialize request', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(server.isInitialized()).toBe(true);
    });

    it('should shutdown properly', async () => {
      // Initialize first
      await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'shutdown',
      });

      expect(response.error).toBeUndefined();
      expect(server.isInitialized()).toBe(false);
    });
  });

  describe('Tool Listing', () => {
    it('should require initialization for tools/list', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(MCPErrorCodes.INVALID_REQUEST);
    });

    it('should list all tools after initialization', async () => {
      await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as { tools: unknown[] };
      expect(result.tools.length).toBe(ALL_TOOLS.length);
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });
    });

    it('should require tool name', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(MCPErrorCodes.INVALID_PARAMS);
    });

    it('should return error for unknown tool', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(MCPErrorCodes.INVALID_PARAMS);
    });

    it('should execute workflow_list tool', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'workflow_list',
          arguments: {},
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });

    it('should execute workflow_run tool', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'workflow_run',
          arguments: {
            workflowId: 'test-workflow',
          },
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });

    it('should execute trace_list tool', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'trace_list',
          arguments: { limit: 5 },
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });

    it('should execute memory_store tool', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'memory_store',
          arguments: {
            key: 'test-key',
            value: { data: 'test-value' },
          },
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });

    it('should execute memory_retrieve tool', async () => {
      // Store first
      await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'memory_store',
          arguments: {
            key: 'retrieve-test',
            value: { data: 'stored-value' },
          },
        },
      });

      // Then retrieve
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'memory_retrieve',
          arguments: {
            key: 'retrieve-test',
          },
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return METHOD_NOT_FOUND for unknown methods', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(MCPErrorCodes.METHOD_NOT_FOUND);
    });
  });

  describe('Tool Definitions', () => {
    it('should have all expected tools', () => {
      const toolNames = ALL_TOOLS.map((t) => t.name);

      expect(toolNames).toContain('workflow_run');
      expect(toolNames).toContain('workflow_list');
      expect(toolNames).toContain('workflow_describe');
      expect(toolNames).toContain('trace_list');
      expect(toolNames).toContain('trace_get');
      expect(toolNames).toContain('trace_analyze');
      expect(toolNames).toContain('memory_store');
      expect(toolNames).toContain('memory_retrieve');
      expect(toolNames).toContain('memory_search');
    });

    it('should have handlers for all tools', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_HANDLERS[tool.name]).toBeDefined();
      }
    });

    it('should have valid input schemas for all tools', () => {
      for (const tool of ALL_TOOLS) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });
});
