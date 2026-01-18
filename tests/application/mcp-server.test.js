import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMCPServer, ALL_TOOLS, TOOL_HANDLERS, MCPErrorCodes, } from '@defai.digital/mcp-server';
describe('MCP Server', () => {
    let server;
    const originalPrefix = process.env.AX_MCP_TOOL_PREFIX;
    beforeEach(() => {
        // Disable default prefix for backward compatibility in most tests
        // Tests for namespacing explicitly set/unset this
        process.env.AX_MCP_TOOL_PREFIX = '';
        server = createMCPServer({
            name: 'test-server',
            version: '1.0.0',
        });
    });
    afterEach(() => {
        // Restore original prefix
        if (originalPrefix === undefined) {
            delete process.env.AX_MCP_TOOL_PREFIX;
        }
        else {
            process.env.AX_MCP_TOOL_PREFIX = originalPrefix;
        }
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
            const request = {
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
            const result = response.result;
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
        // Guard tool tests
        it('should execute guard_list tool', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'guard_list',
                    arguments: {},
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.policies).toBeDefined();
            expect(Array.isArray(parsed.policies)).toBe(true);
        });
        it('should execute guard_check tool with valid policy', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'guard_check',
                    arguments: {
                        policyId: 'bugfix',
                        changedPaths: ['packages/cli/src/index.ts'],
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.policyId).toBe('bugfix');
            expect(parsed.status).toBeDefined();
        });
        it('should execute guard_apply tool', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'guard_apply',
                    arguments: {
                        sessionId: '00000000-0000-0000-0000-000000000000',
                        policyId: 'bugfix',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            // Guard can either apply successfully or return an error for non-existent session
            expect(parsed.applied === true ||
                parsed.error === 'SESSION_NOT_FOUND' ||
                parsed.error === 'GUARD_APPLY_FAILED').toBe(true);
        });
        // Agent tool tests
        it('should execute agent_list tool', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'agent_list',
                    arguments: {},
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.agents).toBeDefined();
            expect(Array.isArray(parsed.agents)).toBe(true);
        });
        it('should execute agent_get tool with non-existent agent', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'agent_get',
                    arguments: {
                        agentId: 'non-existent-agent',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            expect(result.isError).toBe(true);
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('AGENT_NOT_FOUND');
        });
        // Session tool tests
        it('should execute session_create tool', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'session_create',
                    arguments: {
                        initiator: 'test-agent',
                        task: 'Test session task',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.sessionId).toBeDefined();
            expect(parsed.initiator).toBe('test-agent');
            expect(parsed.task).toBe('Test session task');
            expect(parsed.status).toBe('active');
        });
        it('should execute session_list tool', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'session_list',
                    arguments: {},
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.sessions).toBeDefined();
            expect(Array.isArray(parsed.sessions)).toBe(true);
        });
        it('should execute session_status tool for non-existent session', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'session_status',
                    arguments: {
                        sessionId: '00000000-0000-0000-0000-000000000000',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            expect(result.isError).toBe(true);
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('SESSION_NOT_FOUND');
        });
        // New memory tool tests
        it('should execute memory_list tool', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'memory_list',
                    arguments: {},
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.keys).toBeDefined();
            expect(Array.isArray(parsed.keys)).toBe(true);
            expect(parsed.total).toBeDefined();
        });
        it('should execute memory_delete tool', async () => {
            // Store a key first
            await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'memory_store',
                    arguments: {
                        key: 'delete-test-key',
                        value: { test: 'data' },
                    },
                },
            });
            // Delete it
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'memory_delete',
                    arguments: {
                        key: 'delete-test-key',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.deleted).toBe(true);
            expect(parsed.key).toBe('delete-test-key');
        });
        it('should return deleted=false for non-existent key', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'memory_delete',
                    arguments: {
                        key: 'non-existent-key-12345',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.deleted).toBe(false);
        });
        // New session tool tests
        it('should execute session_join tool for non-existent session', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'session_join',
                    arguments: {
                        sessionId: '00000000-0000-0000-0000-000000000000',
                        agentId: 'test-agent',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            expect(result.isError).toBe(true);
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('SESSION_NOT_FOUND');
        });
        it('should execute session_leave tool for non-existent session', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'session_leave',
                    arguments: {
                        sessionId: '00000000-0000-0000-0000-000000000000',
                        agentId: 'test-agent',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            expect(result.isError).toBe(true);
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('SESSION_NOT_FOUND');
        });
        it('should execute session_fail tool for non-existent session', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'session_fail',
                    arguments: {
                        sessionId: '00000000-0000-0000-0000-000000000000',
                        error: {
                            code: 'TEST_ERROR',
                            message: 'Test error message',
                        },
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            expect(result.isError).toBe(true);
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('SESSION_NOT_FOUND');
        });
        // New agent tool tests
        it('should execute agent_register tool', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'agent_register',
                    arguments: {
                        agentId: 'test-agent-register',
                        description: 'A test agent for registration',
                        displayName: 'Test Agent',
                        team: 'test-team',
                        capabilities: ['test'],
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            // Agent can either be registered successfully, already exist, or fail gracefully
            expect(parsed.registered === true ||
                parsed.error === 'AGENT_ALREADY_EXISTS' ||
                parsed.error === 'AGENT_REGISTER_FAILED').toBe(true);
            if (parsed.registered === true) {
                expect(parsed.agentId).toBe('test-agent-register');
            }
        });
        it('should execute agent_remove tool for non-existent agent', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'agent_remove',
                    arguments: {
                        agentId: 'non-existent-agent-12345',
                    },
                },
            });
            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const result = response.result;
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.removed).toBe(false);
        });
    });
    describe('Tool Namespacing', () => {
        it('applies default ax_ prefix when env var not set', async () => {
            // Remove env var to test default behavior
            delete process.env.AX_MCP_TOOL_PREFIX;
            const defaultPrefixServer = createMCPServer({
                name: 'test-server',
                version: '1.0.0',
            });
            await defaultPrefixServer.handleRequest({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
            });
            const listResponse = await defaultPrefixServer.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
            });
            expect(listResponse.error).toBeUndefined();
            const tools = listResponse.result.tools;
            // Default prefix is 'ax_' - all tools should be prefixed
            expect(tools.every((tool) => tool.name.startsWith('ax_'))).toBe(true);
            expect(tools.some((tool) => tool.name === 'ax_workflow_list')).toBe(true);
            expect(tools.some((tool) => tool.name === 'ax_config_set')).toBe(true);
            // Should be able to call tools with prefix
            const callResponse = await defaultPrefixServer.handleRequest({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'ax_workflow_list',
                    arguments: {},
                },
            });
            expect(callResponse.error).toBeUndefined();
            expect(callResponse.result).toBeDefined();
        });
        it('disables prefix when env var set to empty string', async () => {
            process.env.AX_MCP_TOOL_PREFIX = '';
            const unprefixedServer = createMCPServer({
                name: 'test-server',
                version: '1.0.0',
            });
            await unprefixedServer.handleRequest({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
            });
            const listResponse = await unprefixedServer.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
            });
            expect(listResponse.error).toBeUndefined();
            const tools = listResponse.result.tools;
            // No prefix - tools should have original names
            expect(tools.some((tool) => tool.name === 'workflow_list')).toBe(true);
            expect(tools.some((tool) => tool.name === 'config_set')).toBe(true);
            expect(tools.every((tool) => !tool.name.startsWith('ax_'))).toBe(true);
        });
        it('applies custom AX_MCP_TOOL_PREFIX and routes prefixed tool calls', async () => {
            process.env.AX_MCP_TOOL_PREFIX = 'custom_';
            const namespacedServer = createMCPServer({
                name: 'test-server',
                version: '1.0.0',
            });
            await namespacedServer.handleRequest({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
            });
            const listResponse = await namespacedServer.handleRequest({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
            });
            expect(listResponse.error).toBeUndefined();
            const tools = listResponse.result.tools;
            expect(tools.some((tool) => tool.name === 'custom_workflow_list')).toBe(true);
            const callResponse = await namespacedServer.handleRequest({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'custom_workflow_list',
                    arguments: {},
                },
            });
            expect(callResponse.error).toBeUndefined();
            expect(callResponse.result).toBeDefined();
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
            // Workflow tools
            expect(toolNames).toContain('workflow_run');
            expect(toolNames).toContain('workflow_list');
            expect(toolNames).toContain('workflow_describe');
            // Trace tools
            expect(toolNames).toContain('trace_list');
            expect(toolNames).toContain('trace_get');
            expect(toolNames).toContain('trace_analyze');
            // Memory tools
            expect(toolNames).toContain('memory_store');
            expect(toolNames).toContain('memory_retrieve');
            expect(toolNames).toContain('memory_search');
            // Guard tools
            expect(toolNames).toContain('guard_check');
            expect(toolNames).toContain('guard_list');
            expect(toolNames).toContain('guard_apply');
            // Agent tools
            expect(toolNames).toContain('agent_list');
            expect(toolNames).toContain('agent_run');
            expect(toolNames).toContain('agent_get');
            // Session tools (7)
            expect(toolNames).toContain('session_create');
            expect(toolNames).toContain('session_status');
            expect(toolNames).toContain('session_complete');
            expect(toolNames).toContain('session_list');
            expect(toolNames).toContain('session_join');
            expect(toolNames).toContain('session_leave');
            expect(toolNames).toContain('session_fail');
            // Memory tools - new
            expect(toolNames).toContain('memory_list');
            expect(toolNames).toContain('memory_delete');
            // Agent tools - new
            expect(toolNames).toContain('agent_register');
            expect(toolNames).toContain('agent_remove');
        });
        it('should have reasonable tool count', () => {
            // Tools should be at least 30
            expect(ALL_TOOLS.length).toBeGreaterThanOrEqual(30);
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
//# sourceMappingURL=mcp-server.test.js.map